// ─── MathPixSessionRestorer Images Mixin ─────────────────────────────────────
// Image extraction, MMD rewriting, swap/add/delete, and image cache API.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-images.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // F-M PHASE 4: BYTES-FIRST EMBEDDING HELPERS
  //
  // Convert-time image embedding for getMMDForAPI. The pre-Phase-4 helper
  // reverse-translated blob URLs back to CDN URLs, which silently lost
  // (a) user replacements (the swap's bytes never reached the API), and
  // (b) chemistry RDKit renders (the API fetched the original Mathpix
  // crops). The bytes-first policy embeds the live registry blob as a
  // dataURI; CDN fallback applies only when no blob is available.
  //
  // See pre-stage-7-prompt-03b-f-m-convert-strategy.md.
  // =========================================================================

  /**
   * Wrap canvas.toBlob in a Promise for use in async encode chains.
   * Supports both HTMLCanvasElement and OffscreenCanvas; we use the
   * HTMLCanvasElement path for broadest compatibility.
   * @param {HTMLCanvasElement} canvas
   * @param {string} mime - e.g. "image/png", "image/jpeg", "image/webp"
   * @param {number} [quality] - 0-1 quality for lossy formats
   * @returns {Promise<Blob>}
   */
  function canvasToBlobPromise(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error(`canvas.toBlob produced null for ${mime}`));
          },
          mime,
          quality,
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Read a Blob as a data: URI via FileReader.
   * @param {Blob} blob
   * @returns {Promise<string>} data URI string
   */
  function blobToDataURI(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Pick the encoder candidates for a per-image comparison, given the
   * formats the user has selected for conversion. Always includes PNG and
   * JPEG; adds WebP only when ENABLE_WEBP_EMBEDDING is true AND every
   * selected format is on FORMATS_SUPPORTING_WEBP (format-aware
   * activation per §4a of the strategy doc).
   *
   * @param {Array<string>} selectedFormats - Convert API format keys
   * @returns {Array<string>} encoder format keys, e.g. ["png", "jpeg"] or ["png", "jpeg", "webp"]
   */
  function pickEncoders(selectedFormats) {
    const config = window.MATHPIX_CONFIG?.CONVERT?.EMBEDDING;
    const candidates = ["png", "jpeg"];
    if (!config) return candidates;
    if (!config.ENABLE_WEBP_EMBEDDING) return candidates;
    if (!Array.isArray(selectedFormats) || selectedFormats.length === 0) {
      return candidates;
    }
    const safeList = config.FORMATS_SUPPORTING_WEBP || [];
    const allSafe = selectedFormats.every((f) => safeList.includes(f));
    if (allSafe) candidates.push("webp");
    return candidates;
  }

  /**
   * Encode a Blob to a dataURI using each allowed encoder and return the
   * smallest result. PNG and JPEG are always attempted; WebP joins when
   * pickEncoders returned it.
   *
   * Uses canvas.toBlob() in parallel per encoder so the total cost is
   * dominated by the slowest single encoder rather than their sum.
   *
   * @param {Blob} sourceBlob - Bytes to encode
   * @param {Array<string>} allowedEncoders - Output of pickEncoders()
   * @returns {Promise<string>} The smallest dataURI candidate
   * @throws if no encoder succeeds
   */
  async function encodeBestDataURI(sourceBlob, allowedEncoders) {
    if (!(sourceBlob instanceof Blob) || sourceBlob.size === 0) {
      throw new Error("encodeBestDataURI: empty or non-Blob input");
    }

    const jpegQuality =
      window.MATHPIX_CONFIG?.CONVERT?.EMBEDDING?.JPEG_QUALITY ?? 0.9;

    // Decode source bytes to a canvas. createImageBitmap is the modern,
    // efficient path; fall back to an <img> load if it throws (extremely
    // old engines).
    let imageBitmap;
    try {
      imageBitmap = await createImageBitmap(sourceBlob);
    } catch (e) {
      logWarn(
        "encodeBestDataURI: createImageBitmap failed; falling back to <img> load",
        e,
      );
      imageBitmap = await loadBlobAsImage(sourceBlob);
    }

    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width || imageBitmap.naturalWidth;
    canvas.height = imageBitmap.height || imageBitmap.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0);
    if (typeof imageBitmap.close === "function") imageBitmap.close();

    const encodePromises = allowedEncoders.map(async (format) => {
      const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
      const quality = format === "jpeg" ? jpegQuality : undefined;
      try {
        const encodedBlob = await canvasToBlobPromise(canvas, mime, quality);
        const uri = await blobToDataURI(encodedBlob);
        return { format, uri, size: uri.length };
      } catch (err) {
        logDebug(`encodeBestDataURI: ${format} encoder failed`, err);
        return null;
      }
    });

    const results = (await Promise.all(encodePromises)).filter(Boolean);
    if (results.length === 0) {
      throw new Error(
        "encodeBestDataURI: no encoder candidate succeeded",
      );
    }

    results.sort((a, b) => a.size - b.size);
    logDebug(
      `encodeBestDataURI: chose ${results[0].format} (${results[0].size} chars; candidates: ${results.map((r) => `${r.format}=${r.size}`).join(", ")})`,
    );
    return results[0].uri;
  }

  /**
   * Last-resort image decoder for engines without createImageBitmap.
   * Returns an HTMLImageElement that can be drawn to a canvas.
   * @param {Blob} blob
   * @returns {Promise<HTMLImageElement>}
   */
  function loadBlobAsImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image decode failed"));
      };
      img.src = url;
    });
  }

  // Expose for tests (window-side so tests can verify encoder selection
  // and dataURI shape without driving a full convert flow).
  if (typeof window !== "undefined") {
    window._fmEmbedHelpers = {
      pickEncoders,
      encodeBestDataURI,
      blobToDataURI,
    };
  }

  // =========================================================================
  // PHASE 8F: IMAGE RESTORE FROM ZIP
  // =========================================================================

  /**
   * Extract images from ZIP and restore the image registry.
   * Creates blob URLs for local display and builds a URL replacement map.
   *
   * @returns {Promise<{restored: boolean, imageCount: number, errors: string[]}>}
   * @private
   */
  proto.extractAndRestoreImages = async function () {
    const result = { restored: false, imageCount: 0, errors: [] };

    // Guard: need raw ZIP file
    if (!this._rawZIPFile) {
      logDebug("No raw ZIP file available — skipping image restore");
      return result;
    }

    // Guard: need MathPixImageRegistry class
    if (typeof window.MathPixImageRegistry !== "function") {
      logDebug("MathPixImageRegistry not loaded — skipping image restore");
      return result;
    }

    try {
      // Re-load ZIP for image extraction
      const zip = await JSZip.loadAsync(this._rawZIPFile);
      const allFiles = Object.keys(zip.files);

      // Check for image-registry.json in metadata/
      const registryPath = allFiles.find(
        (f) => f.endsWith("image-registry.json") && f.includes("metadata"),
      );

      if (!registryPath) {
        logDebug("No image-registry.json found — ZIP predates Phase 8E");
        return result;
      }

      // Parse registry JSON
      let registryData;
      try {
        const registryText = await zip.files[registryPath].async("text");
        registryData = JSON.parse(registryText);
      } catch (parseError) {
        const msg = `Failed to parse image-registry.json: ${parseError.message}`;
        logWarn(msg);
        result.errors.push(msg);
        return result;
      }

      // Validate registry data has images
      if (
        !registryData.images ||
        !Array.isArray(registryData.images) ||
        registryData.images.length === 0
      ) {
        logDebug("image-registry.json has no images — nothing to restore");
        return result;
      }

      // Check for images/ folder
      const imageFiles = allFiles.filter(
        (f) => f.includes("images/") && !f.endsWith("/"),
      );

      if (imageFiles.length === 0) {
        logDebug("No image files found in ZIP /images/ folder");
        return result;
      }

      logInfo(
        `Found ${registryData.images.length} registry entries and ${imageFiles.length} image files`,
      );

      // Create and restore registry
      const registry = new window.MathPixImageRegistry();
      const fromJsonOk = registry.fromJSON(registryData);

      if (!fromJsonOk) {
        const msg = "Failed to restore image registry from JSON";
        logWarn(msg);
        result.errors.push(msg);
        return result;
      }

      // Build filename → ZIP path lookup from the filenameMap
      const filenameMap = registryData.filenameMap || {};

      // Phase 8H.1: Preserve for image manager display
      this.imageFilenameMap = filenameMap;
      const filenameLookup = new Map();

      for (const [imageId, mapEntry] of Object.entries(filenameMap)) {
        if (mapEntry && mapEntry.filename && mapEntry.downloaded) {
          // Find matching file in ZIP (case-insensitive path match)
          const targetFilename = mapEntry.filename;
          const matchingPath = imageFiles.find((zipPath) => {
            const zipFilename = zipPath.split("/").pop();
            return zipFilename === targetFilename;
          });

          if (matchingPath) {
            filenameLookup.set(imageId, matchingPath);
          } else {
            logDebug(
              `Image file not found in ZIP for ${imageId}: ${targetFilename}`,
            );
          }
        }
      }

      logDebug(`Mapped ${filenameLookup.size} images to ZIP paths`);

      // Extract each image, create blob URLs, attach to registry
      let extractedCount = 0;

      for (const [imageId, zipPath] of filenameLookup) {
        try {
          // Extract blob from ZIP
          const blob = await zip.files[zipPath].async("blob");

          // Determine MIME type from filename
          const filename = zipPath.split("/").pop();
          const ext = filename.split(".").pop().toLowerCase();
          const mimeTypes = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            gif: "image/gif",
          };
          const mimeType = mimeTypes[ext] || "image/jpeg";

          // Create typed blob if JSZip returned an untyped one
          const typedBlob =
            blob.type && blob.type !== "application/octet-stream"
              ? blob
              : new Blob([blob], { type: mimeType });

          // Create blob URL
          const blobUrl = URL.createObjectURL(typedBlob);

          // Track for cleanup
          this.objectURLs.push(blobUrl);

          // Get the original CDN URL from the registry entry
          const registryEntry = registry.getImage(imageId);
          if (registryEntry && registryEntry.originalUrl) {
            this.imageBlobUrlMap.set(registryEntry.originalUrl, blobUrl);
          }

          // Attach blob to registry entry
          registry.attachBlob(imageId, typedBlob);
          extractedCount++;

          // For user-added images: regenerate dataUri so getMMDForAPI can embed them
          if (
            registryEntry &&
            (registryEntry.source === "user-upload" ||
              registryEntry.status === "user-added")
          ) {
            try {
              const dataUri = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(typedBlob);
              });
              if (dataUri) {
                // Discovery 23 — restore-time housekeeping. The earlier
                // replaceImage call here wrongly flipped status to
                // "user-replaced" because the registry sees the dataUri
                // field as a content change; this is just re-deriving
                // dataUri from the restored blob, not a user replacement.
                registry.syncDataUriForRestore(imageId, dataUri);
                logDebug(
                  `Regenerated dataUri for user-added image ${imageId} (${(dataUri.length / 1024).toFixed(1)} KB)`,
                );
              }
            } catch (dataUriError) {
              logWarn(
                `Failed to regenerate dataUri for ${imageId}: ${dataUriError.message}`,
              );
            }
          }

          // Phase 9 Feature 2: Cache for cross-session persistence
          const zipFilename = zipPath.split("/").pop();
          this._cacheImage(imageId, zipFilename, typedBlob);

          logDebug(
            `Extracted image: ${imageId} → ${filename} (${typedBlob.size} bytes)`,
          );
        } catch (imgError) {
          const msg = `Failed to extract image ${imageId}: ${imgError.message}`;
          logWarn(msg);
          result.errors.push(msg);
        }
      }

      // Store registry
      this.imageRegistry = registry;

      result.restored = extractedCount > 0;
      result.imageCount = extractedCount;

      logInfo(
        `Image restore complete: ${extractedCount}/${filenameLookup.size} images extracted, ${this.imageBlobUrlMap.size} URL mappings created`,
      );

      return result;
    } catch (error) {
      const msg = `Image restore failed: ${error.message}`;
      logError(msg, error);
      result.errors.push(msg);
      return result;
    }
  };

  /**
   * Rewrite MMD content replacing CDN URLs with local blob URLs.
   * Handles both Markdown image syntax and LaTeX \\includegraphics syntax.
   *
   * @param {string} mmdContent - Original MMD content with CDN URLs
   * @returns {string} Rewritten MMD with blob URLs (or unchanged if no mappings)
   * @private
   */
  proto.rewriteMMDWithBlobUrls = function (mmdContent) {
    if (!mmdContent || this.imageBlobUrlMap.size === 0) {
      return mmdContent;
    }

    let rewritten = mmdContent;
    let replacementCount = 0;

    for (const [originalUrl, blobUrl] of this.imageBlobUrlMap) {
      if (!originalUrl || !blobUrl) {
        logWarn(`rewriteMMDWithBlobUrls: skipping invalid map entry`);
        continue;
      }
      // Escape special regex characters in the URL
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Replace in both Markdown ![](url) and LaTeX \includegraphics{url} contexts
      // Using a global regex to catch all occurrences
      const regex = new RegExp(escapedUrl, "g");
      const beforeLength = rewritten.length;
      rewritten = rewritten.replace(regex, blobUrl);

      if (rewritten.length !== beforeLength) {
        replacementCount++;
      }
    }

    logInfo(`Rewrote ${replacementCount} image URL(s) in MMD content`);
    return rewritten;
  };

  /**
   * Sync each registry entry's `mmdReference` from CDN-URL form to
   * blob-URL form, mirroring what `rewriteMMDWithBlobUrls()` just did
   * to the MMD string itself. Must be called immediately after
   * `rewriteMMDWithBlobUrls()` during session restore.
   *
   * Without this sync the registry's `mmdReference` field keeps pointing
   * at the original CDN URL while the live MMD holds blob URLs, so any
   * consumer that does substring matching (e.g. the alt-text serialiser's
   * `findImage`) can no longer bridge the two forms.
   *
   * User-added images skip naturally because their `originalUrl` is a
   * blob URL not present as a key in `imageBlobUrlMap`. A belt-and-braces
   * equality check after `.replace()` covers the residual case where
   * `originalUrl` is not literally present in `mmdReference`.
   *
   * @private
   */
  proto.syncRegistryReferencesToBlobUrls = function () {
    if (!this.imageRegistry || this.imageBlobUrlMap.size === 0) {
      return;
    }

    const entries = this.imageRegistry.getAllImages();
    let syncedCount = 0;

    for (const entry of entries) {
      if (!entry.originalUrl || !entry.mmdReference) continue;

      const blobUrl = this.imageBlobUrlMap.get(entry.originalUrl);
      if (!blobUrl) continue; // user-added images skip naturally

      const newMmdRef = entry.mmdReference.replace(entry.originalUrl, blobUrl);
      if (newMmdRef === entry.mmdReference) continue; // belt-and-braces

      const ok = this.imageRegistry.syncMmdReferenceForRestore(
        entry.id,
        newMmdRef,
      );
      if (ok) syncedCount++;
    }

    logInfo(
      `Synced ${syncedCount} registry mmdReference(s) to blob-URL form`,
    );
  };

  /**
   * Get MMD content with image bytes embedded for the convert API.
   *
   * Thin orchestrator (P1b): builds the ordered substitution manifest via
   * buildManifest, then replays it against the original MMD via applyManifest.
   * The embedded output is byte-for-byte identical to the pre-P1b single-pass
   * method — the branch/encode logic lives in buildManifest now.
   *
   * @param {string} mmdContent - MMD content potentially containing blob URLs
   *   or chemistry CDN references
   * @param {Array<string>} [selectedFormats] - Output formats requested for
   *   this convert (see buildManifest / pickEncoders). Optional.
   * @returns {Promise<string>} MMD with image bytes embedded where present,
   *   CDN URLs preserved otherwise
   */
  proto.getMMDForAPI = async function (mmdContent, selectedFormats) {
    if (!mmdContent) return mmdContent;
    const manifest = await this.buildManifest(mmdContent, selectedFormats);
    return this.applyManifest(mmdContent, manifest);
  };

  /**
   * Build the ordered substitution manifest for convert-time image embedding.
   *
   * F-M Phase 4 — bytes-first policy. For each image referenced in the
   * MMD (OCR blob URL, chemistry CDN URL with cached RDKit render, or
   * user-added blob URL), if live bytes exist in the registry or
   * chemistry cache, encode them with the smallest-candidate selection
   * (PNG vs JPEG, optionally WebP — see pickEncoders) and record a
   * dataURI substitution. Fall back to the original CDN URL only when no
   * bytes are available.
   *
   * Three steps in order:
   *   1. OCR images via imageBlobUrlMap — replaces the pre-Phase-4
   *      reverse-to-CDN step which silently lost user swaps and chemistry
   *      RDKit content.
   *   2. Chemistry RDKit renders via chemistryBlobUrlMap (read from
   *      mathpix-mmd-preview) — embed when the CDN URL appears in the
   *      MMD and a cached blob URL exists.
   *   3. User-added images (blob URL is the originalUrl) — embed bytes
   *      or fall back to cached dataURI from add-time encoding.
   *
   * The internal `apiSafe` working copy is mutated at each step exactly as the
   * pre-P1b method did, because Step 2's `apiSafe.includes(cdnUrl)` gate and
   * Step 3's blob: scan must see the post-prior-stage string. That working copy
   * is discarded; getMMDForAPI rebuilds the output by replaying the manifest.
   *
   * Async because canvas.toBlob() is callback-style. Site 3
   * (session-restorer-convert.js handleConvert) already awaits.
   *
   * See pre-stage-7-prompt-03b-f-m-convert-strategy.md for the locked
   * strategy and rationale.
   *
   * Step 1's blob→CDN regex-escape shares its vocabulary with two sibling
   * helpers (see F-E in pre-stage-7-discoveries-stage6-post-close-audit.md):
   * proto._translateBlobUrlsToCdnForMMD (this file) and
   * MathPixImageManagerUI._translateBlobUrlsToCdn (manager-side). Drift risk on
   * the regex-escape pattern is real but small — fix one, fix all.
   *
   * @param {string} mmdContent - MMD content potentially containing blob URLs
   *   or chemistry CDN references
   * @param {Array<string>} [selectedFormats] - Output formats requested
   *   for this convert. Drives pickEncoders' decision about WebP
   *   participation. Optional; defaults to PNG+JPEG only.
   * @returns {Promise<Array<{url: string, replacement: string}>>} ordered
   *   substitution manifest — each (url, replacement) recorded in application
   *   order; replaying it via applyManifest reproduces the embedded MMD.
   */
  proto.buildManifest = async function (mmdContent, selectedFormats) {
    if (!mmdContent) return [];

    let apiSafe = mmdContent;
    const manifest = [];
    const allowedEncoders = pickEncoders(selectedFormats);

    // -------------------------------------------------------------------
    // Step 1: OCR images via imageBlobUrlMap.
    //
    // The map is CDN_URL → blob_URL where blob_URL is the LIVE URL
    // (post-swap if the user replaced the image, original-fetch otherwise).
    // The MMD contains the blob URLs (the editor's preview rewrote them
    // in for display). For each, find the registry entry by its
    // originalUrl (the CDN URL key) and embed entry.blob bytes.
    // -------------------------------------------------------------------
    if (this.imageBlobUrlMap && this.imageBlobUrlMap.size > 0) {
      const registryImages = this.imageRegistry?.getAllImages() || [];

      const ocrSubs = await Promise.all(
        Array.from(this.imageBlobUrlMap.entries()).map(
          async ([originalUrl, blobUrl]) => {
            if (!blobUrl) {
              logWarn(
                `buildManifest: skipping undefined blobUrl for ${originalUrl}`,
              );
              return null;
            }
            const entry = registryImages.find(
              (img) => img.originalUrl === originalUrl,
            );
            let replacement;
            if (entry?.blob instanceof Blob && entry.blob.size > 0) {
              try {
                replacement = await this._encodeCached(
                  entry.id,
                  entry.blob,
                  allowedEncoders,
                );
                logDebug(
                  `buildManifest: embedded OCR bytes for ${originalUrl.substring(0, 60)} (${replacement.length} chars)`,
                );
              } catch (encodeError) {
                logWarn(
                  `buildManifest: encode failed for ${originalUrl.substring(0, 60)}; falling back to CDN`,
                  encodeError,
                );
                replacement = originalUrl;
              }
            } else if (entry?.dataUri) {
              replacement = entry.dataUri;
              logDebug(
                `buildManifest: used cached dataURI for ${originalUrl.substring(0, 60)}`,
              );
            } else {
              replacement = originalUrl;
              logDebug(
                `buildManifest: no bytes; CDN fallback for ${originalUrl.substring(0, 60)}`,
              );
            }
            return { blobUrl, replacement };
          },
        ),
      );

      for (const sub of ocrSubs) {
        if (!sub) continue;
        const escaped = sub.blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        apiSafe = apiSafe.replace(new RegExp(escaped, "g"), sub.replacement);
        manifest.push({ url: sub.blobUrl, replacement: sub.replacement });
      }
    }

    // -------------------------------------------------------------------
    // Step 2: Chemistry RDKit renders via mathpix-mmd-preview's
    // chemistryBlobUrlMap (CDN_URL → { blobUrl, fingerprint }).
    //
    // Unlike Step 1, the chemistry blob URLs typically do NOT appear in
    // the MMD textbox — the editor holds CDN URLs throughout, and only
    // the rendered preview DOM swaps to blob URLs visually. The fix:
    // walk the chemistry map; for each CDN URL that appears in the MMD
    // AND has a cached blob URL, fetch the blob bytes and embed.
    // -------------------------------------------------------------------
    const mmdPreview =
      typeof window.getMathPixMMDPreview === "function"
        ? window.getMathPixMMDPreview()
        : null;
    const chemMap = mmdPreview?.chemistryBlobUrlMap;
    if (chemMap && chemMap.size > 0) {
      const chemSubs = await Promise.all(
        Array.from(chemMap.entries()).map(async ([cdnUrl, chemEntry]) => {
          const blobUrl = chemEntry?.blobUrl;
          if (!blobUrl) return null;
          if (!apiSafe.includes(cdnUrl)) return null;
          try {
            this._encodeMemo ??= new Map();
            let replacement = this._encodeMemo.get(cdnUrl);
            if (replacement === undefined) {
              const blob = await fetch(blobUrl).then((r) => r.blob());
              if (!blob || blob.size === 0) return null;
              replacement = await encodeBestDataURI(blob, allowedEncoders);
              this._encodeMemo.set(cdnUrl, replacement);
              logDebug(
                `buildManifest: embedded chemistry RDKit bytes for ${cdnUrl.substring(0, 60)} (${replacement.length} chars)`,
              );
            } else {
              logDebug(
                `buildManifest: chemistry cache hit for ${cdnUrl.substring(0, 60)}`,
              );
            }
            return { cdnUrl, replacement };
          } catch (chemErr) {
            logWarn(
              `buildManifest: chemistry embed failed for ${cdnUrl.substring(0, 60)}; preserving CDN URL`,
              chemErr,
            );
            return null;
          }
        }),
      );

      for (const sub of chemSubs) {
        if (!sub) continue;
        const escaped = sub.cdnUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        apiSafe = apiSafe.replace(new RegExp(escaped, "g"), sub.replacement);
        manifest.push({ url: sub.cdnUrl, replacement: sub.replacement });
      }
    }

    // -------------------------------------------------------------------
    // Step 3: User-added images.
    //
    // Any blob URLs still present in apiSafe after Step 1 are user-added
    // uploads — their originalUrl IS the blob URL (created at upload via
    // URL.createObjectURL). Prefer encode-from-blob; fall back to the
    // cached dataURI the registry stored at add time.
    // -------------------------------------------------------------------
    if (this.imageRegistry && apiSafe.includes("blob:")) {
      const blobUrlRegex = /blob:https?:\/\/[^\s)}"\\]+/g;
      const matches = [...apiSafe.matchAll(blobUrlRegex)];
      const seen = new Set();
      const userAddedSubs = [];

      for (const match of matches) {
        const blobUrl = match[0];
        if (seen.has(blobUrl)) continue;
        seen.add(blobUrl);

        const images = this.imageRegistry.getAllImages();
        const entry = images.find((img) => img.originalUrl === blobUrl);
        if (!entry) {
          logWarn(
            `buildManifest: unresolvable blob URL: ${blobUrl.substring(0, 60)}…`,
          );
          continue;
        }

        let replacement;
        if (entry.blob instanceof Blob && entry.blob.size > 0) {
          try {
            replacement = await this._encodeCached(
              entry.id,
              entry.blob,
              allowedEncoders,
            );
            logDebug(
              `buildManifest: embedded user-added bytes for ${entry.id}`,
            );
          } catch (encodeError) {
            replacement = entry.dataUri;
            if (!replacement) {
              logWarn(
                `buildManifest: user-added encode failed and no cached dataURI for ${entry.id}`,
                encodeError,
              );
              continue;
            }
          }
        } else if (entry.dataUri) {
          replacement = entry.dataUri;
          logDebug(
            `buildManifest: used cached dataURI for user-added ${entry.id}`,
          );
        } else {
          logWarn(
            `buildManifest: user-added image ${entry.id} has neither blob nor dataUri`,
          );
          continue;
        }

        userAddedSubs.push({ blobUrl, replacement });
      }

      for (const sub of userAddedSubs) {
        const escaped = sub.blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        apiSafe = apiSafe.replace(new RegExp(escaped, "g"), sub.replacement);
        manifest.push({ url: sub.blobUrl, replacement: sub.replacement });
      }
    }

    return manifest;
  };

  /**
   * Replay a recorded substitution manifest against the original MMD.
   *
   * Uses the SAME regex-escape and global replace the pre-P1b method applied,
   * in the SAME order the manifest records, so the output is byte-for-byte
   * identical to the original single-pass embedding.
   *
   * @param {string} mmdContent - the original MMD (the unmutated input)
   * @param {Array<{url: string, replacement: string}>} manifest - ordered
   *   substitutions from buildManifest
   * @returns {string} MMD with each recorded substitution applied in order
   */
  proto.applyManifest = function (mmdContent, manifest) {
    let apiSafe = mmdContent;
    for (const { url, replacement } of manifest) {
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      apiSafe = apiSafe.replace(new RegExp(escaped, "g"), replacement);
    }
    return apiSafe;
  };

  /**
   * Estimate the convert payload's byte size after image embedding, without
   * committing the embedded string anywhere downstream.
   *
   * Shares getMMDForAPI's exact path: build the ordered substitution manifest,
   * replay it against the MMD, and measure the result. Measuring the replayed
   * output (rather than predicting it from a raw-MMD occurrence count) keeps the
   * estimate byte-identical to the convert gate's own new Blob([...]).size,
   * including the cascade where a later step's URL exists only after an earlier
   * step has run. The size returned equals
   *   Blob([textMMD]).size + sum over images of (dataURIbytes - URLbytes) * occurrences
   * but that sum is realised by the replay, so occurrences and ordering match
   * the gate by construction rather than by a re-derived count.
   *
   * The encode is the cost; it lives in buildManifest (P3 will cache it).
   * Building and measuring the string is light and runs on the auto-save debounce.
   *
   * @param {string} mmdContent - the MMD to size
   * @param {Array<string>} [selectedFormats] - formats for this convert; drives
   *   pickEncoders inside buildManifest. Optional.
   * @returns {Promise<number>} projected convert-payload size in bytes (0 for
   *   empty input, matching getMMDForAPI's early return)
   */
  proto._estimateConvertSize = async function (mmdContent, selectedFormats) {
    if (!mmdContent) return 0;
    const manifest = await this.buildManifest(mmdContent, selectedFormats);
    const embedded = this.applyManifest(mmdContent, manifest);
    const size = new Blob([embedded]).size;
    logDebug(
      `_estimateConvertSize: ${size} bytes (${manifest.length} substitution(s))`,
    );
    return size;
  };

  // ---------------------------------------------------------------------
  // Convert-size encode cache (P3)
  //
  // _estimateConvertSize calls buildManifest on every auto-save debounce,
  // which would re-encode every embedded image each tick. This per-instance
  // memo caches each image's encoded dataURI by stable identity so repeat
  // ticks skip the encode — and, for chemistry, the network fetch. Keys:
  // registry entry id for OCR and user-added images; CDN URL for chemistry
  // renders (one CDN URL is one fixed molecule render, so its bytes are
  // stable). Only SUCCESSFUL encodes are stored, so a failed encode falls
  // back exactly as before and is never memoised. The memo is instance-
  // scoped and lazily created, so each restorer (and each test stand-in)
  // owns its own and it clears with the instance.
  // ---------------------------------------------------------------------

  /**
   * Return the memoised encoded dataURI for `key`, or encode `blob` once and
   * cache it. The encoder's throw propagates so the caller's existing
   * fallback path runs unchanged and no fallback is memoised.
   * @param {string} key - stable identity (registry id or CDN URL)
   * @param {Blob} blob - source bytes to encode on a miss
   * @param {Array<string>} allowedEncoders - from pickEncoders
   * @returns {Promise<string>} encoded dataURI
   */
  proto._encodeCached = async function (key, blob, allowedEncoders) {
    if (key == null) {
      // No stable identity — do not cache (keyless images would collide).
      return encodeBestDataURI(blob, allowedEncoders);
    }
    this._encodeMemo ??= new Map();
    if (this._encodeMemo.has(key)) {
      logDebug(`_encodeCached: hit for ${String(key).substring(0, 60)}`);
      return this._encodeMemo.get(key);
    }
    const dataUri = await encodeBestDataURI(blob, allowedEncoders);
    this._encodeMemo.set(key, dataUri);
    return dataUri;
  };

  /**
   * Evict one image's memoised encode by key. Called by swapImage (bytes
   * changed) and deleteImage (image removed). Safe before the memo exists.
   * @param {string} key - the registry id (or CDN URL) to drop
   */
  proto._invalidateEncode = function (key) {
    this._encodeMemo?.delete(key);
  };

  /**
   * Estimate the convert payload size AND split it into embedded-image bytes
   * versus text, in a single counting replay of the manifest. The breakdown
   * surfaces the actionable number ("images 9.2 MB") near or over the limit.
   *
   * The replay mirrors applyManifest exactly — same order, same escape, same
   * global replace — but counts how many times each url is actually replaced,
   * so the image tally is replay-aware and stays consistent with the gate
   * total even in the cascade case (a url that exists only after an earlier
   * step has run). total therefore equals _estimateConvertSize, and
   * imageBytes + textBytes === total by construction. Only data: replacements
   * are image bytes; a CDN-fallback url is text, not embedded image data.
   *
   * @param {string} mmdContent - the MMD to size
   * @param {Array<string>} [selectedFormats] - formats; drives buildManifest
   * @returns {Promise<{total:number, imageBytes:number, textBytes:number}>}
   */
  proto._estimateConvertSizeBreakdown = async function (
    mmdContent,
    selectedFormats,
  ) {
    if (!mmdContent) return { total: 0, imageBytes: 0, textBytes: 0 };
    const manifest = await this.buildManifest(mmdContent, selectedFormats);
    let embedded = mmdContent;
    let imageBytes = 0;
    for (const { url, replacement } of manifest) {
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let count = 0;
      embedded = embedded.replace(new RegExp(escaped, "g"), () => {
        count += 1;
        return replacement;
      });
      // data: replacements are embedded image bytes; the dataURI is ASCII so
      // its character length equals its UTF-8 byte length. A CDN-fallback url
      // is text and contributes nothing to the image tally.
      if (replacement.startsWith("data:")) {
        imageBytes += replacement.length * count;
      }
    }
    const total = new Blob([embedded]).size;
    return { total, imageBytes, textBytes: total - imageBytes };
  };

  // The projection enters the "close" band at this fraction of the limit, so
  // the indicator warns before Convert would fail. Tune here if needed.
  const CONVERT_SIZE_CLOSE_FRACTION = 0.9;

  /**
   * Classify a projected size against the limit: "under", "close" (at or above
   * 90% and below the limit), or "over" (at or above the limit). Pure; the
   * caller supplies the limit via _getConvertSizeLimit so the band and the
   * gate share one boundary.
   * @param {number} total - projected bytes
   * @param {number} limit - limit in bytes
   * @returns {"under"|"close"|"over"}
   */
  proto._convertSizeBand = function (total, limit) {
    if (total >= limit) return "over";
    if (total >= limit * CONVERT_SIZE_CLOSE_FRACTION) return "close";
    return "under";
  };

  // =========================================================================
  // POST-STAGE-6 GHOST-PURGE RETIREMENT (Finding 5 of stage-6-planning-decisions.md)
  //
  // The two helpers below replace the hand-rolled markdown-only ghost-purge
  // loops that used to live at proto.loadZIPContents and proto.applyRecoveredSession
  // in session-restorer-sessions.js. They consolidate the work that used to be
  // done by ad-hoc regex scans + removeImage(id) calls into the Stage 6 Phase 1
  // pattern: registry.buildFromMMD(cdnMMD) for set-diff, then the Q3 four-step
  // cleanup for external state.
  //
  // Three locked-as-improvement gains over the old loops:
  //   - Handles \includegraphics references as well as markdown ![](url). The
  //     old loops used markdown-only regex; entries referenced via includegraphics
  //     would be wrongly purged on session restore. See Group C, Case C4.
  //   - Performs the full Q3 four-step cleanup (blob revocation, imageBlobUrlMap
  //     trim, Cache API removal). The old loops called removeImage(id) only and
  //     leaked both Cache API entries and imageBlobUrlMap entries indefinitely.
  //     See Group C, Cases C1/C2 assertions on removedCacheKeys / blobMap.size.
  //   - Detects and adds MMD-referenced images that aren't in the registry. The
  //     old loops had no add path. See Group C, Case C3.
  //
  // The retirement keeps cleanup at session-load time (no trigger-point shift):
  // moving it to manager-open would mean updateManageImagesButtonState sees the
  // wrong count between session-load and first-manager-open. The replacement is
  // implementation-pattern only.
  // =========================================================================

  /**
   * Translate blob URLs back to their CDN form using imageBlobUrlMap.
   * Walks the map and substitutes each blobUrl back to its originalUrl in the
   * MMD string. User-added images and any blob URL not present in the map pass
   * through unchanged.
   *
   * Used by the post-Stage-6 ghost-purge retirement at proto.loadZIPContents
   * and proto.applyRecoveredSession (session-restorer-sessions.js): the registry's
   * IDs are hash(originalUrl + lineNumber) computed against CDN form, so any
   * MMD passed to registry.buildFromMMD must be translated to CDN form first
   * or every entry lands in setDiff.removed (the Phase 2b discovery from
   * stage-6-planning-decisions.md Finding 10).
   *
   * Sibling helpers carrying the same regex-escape vocabulary (see F-E in
   * pre-stage-7-discoveries-stage6-post-close-audit.md):
   *   - MathPixImageManagerUI._translateBlobUrlsToCdn (manager-side, identical
   *     shape, used in _reconcileOnOpen Phase A).
   *   - proto.getMMDForAPI Step 1 (this file, kept inline because Step 2 composes
   *     with user-added dataURI embedding).
   * Drift risk on the regex-escape pattern is real but small — fix one, fix all.
   *
   * @param {string} mmd - Live MMD content (may contain blob URLs)
   * @returns {string} MMD with restorer-substituted blob URLs reversed to CDN form
   * @private
   */
  proto._translateBlobUrlsToCdnForMMD = function (mmd) {
    if (!mmd || !this.imageBlobUrlMap || this.imageBlobUrlMap.size === 0) {
      return mmd;
    }

    let result = mmd;
    for (const [cdnUrl, blobUrl] of this.imageBlobUrlMap) {
      if (!cdnUrl || !blobUrl) continue;
      const escaped = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(escaped, "g"), cdnUrl);
    }
    return result;
  };

  /**
   * Per-entry cleanup for entries returned in buildFromMMD's setDiff.removed.
   * Implements Q3's mandatory four-step ordering (per
   * stage-6-planning-decisions.md). Adapted from deleteImage's cleanup block
   * (lines 1062-1091 of this file) minus the user-initiated extras (no undo
   * push, no auto-save, no display refresh — those belong to interactive
   * delete, not reconcile).
   *
   * Step 1 MUST run before Step 2: the CDN-mapped lookup in Step 1 uses
   * imageBlobUrlMap.get(entry.originalUrl), and Step 2 removes that map entry.
   * Flipping the order makes the lookup miss.
   *
   * Mirror of MathPixImageManagerUI._cleanupRemovedEntries (manager-side, Stage 6
   * Phase 2) — same four-step ordering, same null guards, same per-entry try/catch.
   * Collaborator access differs by file: this restorer-side helper reads
   * this.imageBlobUrlMap / this.imageFilenameMap / this._removeCachedImage
   * directly (it IS the restorer), whereas the manager's reference reaches
   * through this.restorer.* indirection.
   *
   * Cache-recovery fidelity note (F-K of
   * pre-stage-7-discoveries-stage6-post-close-audit.md): the isUserAdded
   * predicate below intentionally omits source === "cache-recovery" to
   * mirror the manager's reference exactly. Cache-recovery entries store
   * their blob URL in originalUrl (no imageBlobUrlMap key), so they leak the
   * blob URL through Step 3 if they ever land in setDiff.removed. This is a
   * pre-existing bug in the reference pattern, deferred to Stage 7 for a
   * coordinated fix across both helpers — DO NOT widen the predicate here
   * alone, that would create a fidelity gap.
   *
   * @param {Object[]} removedClones - Entry clones from setDiff.removed
   *   (full clones via buildFromMMD's Phase 3 snapshot, blob field excluded)
   * @returns {Promise<void>}
   * @private
   */
  proto._cleanupBuildFromMMDRemoved = async function (removedClones) {
    if (!Array.isArray(removedClones) || removedClones.length === 0) return;

    for (const entry of removedClones) {
      try {
        // Step 1: Resolve blobUrl FIRST (before Step 2's map.delete invalidates the lookup).
        const isUserAdded =
          entry.source === "user-upload" || entry.status === "user-added";
        const blobUrl = isUserAdded
          ? entry.originalUrl
          : this.imageBlobUrlMap?.get(entry.originalUrl);

        // Step 2: Remove from imageBlobUrlMap (CDN-mapped entries only).
        if (
          !isUserAdded &&
          entry.originalUrl &&
          this.imageBlobUrlMap &&
          this.imageBlobUrlMap.has(entry.originalUrl)
        ) {
          this.imageBlobUrlMap.delete(entry.originalUrl);
        }

        // Step 3: Revoke the blob URL — guard against revoking CDN URLs.
        if (
          blobUrl &&
          typeof blobUrl === "string" &&
          blobUrl.startsWith("blob:")
        ) {
          URL.revokeObjectURL(blobUrl);
        }

        // Step 4: Remove from Cache API. Filename is the secondary key;
        // null is safe when filenameMap has no record for this entry.
        const filename = this.imageFilenameMap?.[entry.id]?.filename || null;
        if (typeof this._removeCachedImage === "function") {
          await this._removeCachedImage(entry.id, filename);
        }
      } catch (err) {
        logWarn(
          `_cleanupBuildFromMMDRemoved: error cleaning up entry ${entry?.id}:`,
          err,
        );
      }
    }

    logInfo(
      `_cleanupBuildFromMMDRemoved: completed for ${removedClones.length} entries`,
    );
  };

  /**
   * Get MMD content safe for localStorage storage.
   * Like getMMDForAPI(), reverses blob→CDN for OCR images.
   * Unlike getMMDForAPI(), uses compact placeholders for user-added images
   * instead of embedding full data URIs (which would blow localStorage quota).
   *
   * Placeholder format: [user-image:img-usr-xxxxxxxx]
   * These are resolved back to blob URLs on session recovery.
   *
   * @param {string} mmdContent - MMD with blob URLs
   * @returns {string} MMD safe for localStorage (no blob URLs, no large data URIs)
   */
  proto.getMMDForStorage = function (mmdContent) {
    if (!mmdContent) return mmdContent;

    let storageSafe = mmdContent;

    // Step 1: Reverse blob URLs to CDN URLs for OCR images (same as getMMDForAPI)
    if (this.imageBlobUrlMap && this.imageBlobUrlMap.size > 0) {
      for (const [originalUrl, blobUrl] of this.imageBlobUrlMap) {
        if (!blobUrl) {
          logWarn(
            `getMMDForStorage: skipping undefined blobUrl for ${originalUrl}`,
          );
          continue;
        }
        const escapedBlobUrl = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedBlobUrl, "g");
        storageSafe = storageSafe.replace(regex, originalUrl);
      }
    }

    // Step 2: Replace user-added image blob URLs with compact placeholders
    if (this.imageRegistry && storageSafe.includes("blob:")) {
      const blobUrlRegex = /blob:https?:\/\/[^\s)}"\\]+/g;
      storageSafe = storageSafe.replace(blobUrlRegex, (blobUrl) => {
        const images = this.imageRegistry.getAllImages();
        const entry = images.find((img) => img.originalUrl === blobUrl);
        if (entry) {
          // Include filename for cross-session fallback lookup (IDs change between sessions)
          const fnEntry = this.imageFilenameMap?.[entry.id];
          const suffix = fnEntry?.filename ? `|${fnEntry.filename}` : "";
          return `[user-image:${entry.id}${suffix}]`;
        }
        // Item 2 — distinguish an EXPECTED stale-snapshot blob (case a) from a
        // GENUINE unreversible live blob (case b) before warning.
        //
        // getMMDForStorage is called with snapshots as `mmdContent` (undo/redo
        // entries, baseline, original) as well as the live `current`. A blob can
        // strand here because a swap revoked the pre-swap blob and overwrote its
        // map mapping (CDN→new): that OLD blob survives in older snapshots but is
        // no longer reversible — and that is the working-as-designed outcome, not
        // a failure (the durable copy is the ZIP, not localStorage).
        //
        // The reliable signal (confirmed empirically — re-swap-proof, and the
        // mmdReference/user-replaced signal was refuted) is the LIVE document:
        // `this.restoredSession.currentMMD` — NOT the `mmdContent`/`storageSafe`
        // being processed. If the stranded blob is NOT present in the live
        // document, it is a stale snapshot artifact → downgrade to debug.
        //
        // Fail-toward-warn (load-bearing): downgrade ONLY when currentMMD is a
        // string AND does not contain the blob. Anything else — currentMMD
        // missing/non-string, or the blob IS live in it — keeps the warning, so
        // genuine corruption is never silenced.
        const liveMMD = this.restoredSession?.currentMMD;
        const isStaleSnapshotArtifact =
          typeof liveMMD === "string" && !liveMMD.includes(blobUrl);
        if (isStaleSnapshotArtifact) {
          logDebug(
            `getMMDForStorage: stale snapshot blob (not in live document), reversed to CDN — expected: ${blobUrl.substring(0, 60)}…`,
          );
        } else {
          logWarn(
            `getMMDForStorage: unresolvable blob URL: ${blobUrl.substring(0, 60)}…`,
          );
        }
        return blobUrl;
      });
    }

    return storageSafe;
  };

  /**
   * Rewrite MMD content for ZIP storage.
   * Converts blob URLs to relative paths (images/filename.jpg)
   * that correspond to files in the ZIP's /images/ folder.
   *
   * Handles three URL types:
   *  1. OCR images (original + swapped) — via imageBlobUrlMap reverse lookup
   *  2. User-added images — blob URL is the originalUrl in registry
   *
   * @param {string} mmdContent - MMD with blob URLs
   * @returns {string} MMD with relative image paths
   */
  proto.rewriteMMDForZIP = function (mmdContent) {
    if (!mmdContent) return mmdContent;
    let rewritten = mmdContent;
    let replacementCount = 0;

    // Step 1: OCR images (original + swapped) via imageBlobUrlMap
    if (this.imageBlobUrlMap?.size > 0 && this.imageFilenameMap) {
      for (const [cdnUrl, blobUrl] of this.imageBlobUrlMap) {
        const imageId = this._findImageIdByCdnUrl(cdnUrl);
        if (imageId && this.imageFilenameMap[imageId]?.filename) {
          const relativePath = `images/${this.imageFilenameMap[imageId].filename}`;
          const before = rewritten;
          rewritten = rewritten.replaceAll(blobUrl, relativePath);
          if (rewritten !== before) replacementCount++;
        }
      }
    }

    // Step 2: User-added images — blob URL is the originalUrl in registry
    if (this.imageRegistry && rewritten.includes("blob:")) {
      // Ensure imageFilenameMap exists
      if (!this.imageFilenameMap) {
        this.imageFilenameMap = {};
      }

      // Counter for generating filenames — start after existing entries
      let addedImageCounter = Object.keys(this.imageFilenameMap).length + 1;

      // Derive document base name for filename generation
      const docBaseName = (
        this.restoredSession?.source?.filename || "document"
      ).replace(/\.[^/.]+$/, "");

      const allImages = this.imageRegistry.getAllImages();
      for (const img of allImages) {
        if (img.source === "user-upload" || img.status === "user-added") {
          if (img.originalUrl?.startsWith("blob:")) {
            // Generate filename if missing from the map
            if (!this.imageFilenameMap[img.id]?.filename) {
              const ext =
                img.mimeType === "image/png"
                  ? ".png"
                  : img.mimeType === "image/webp"
                    ? ".webp"
                    : ".jpg";
              const filename = `${docBaseName}-image-${addedImageCounter}${ext}`;
              addedImageCounter++;

              this.imageFilenameMap[img.id] = {
                filename: filename,
                url: img.originalUrl,
                downloaded: true,
                status: "user-added",
              };
              logInfo(
                `rewriteMMDForZIP: generated filename "${filename}" for ${img.id}`,
              );
            }

            const relativePath = `images/${this.imageFilenameMap[img.id].filename}`;
            const before = rewritten;
            rewritten = rewritten.replaceAll(img.originalUrl, relativePath);
            if (rewritten !== before) replacementCount++;
          }
        }
      }
    }

    // Safety check: warn if any blob URLs survived
    if (rewritten.includes("blob:")) {
      logWarn("rewriteMMDForZIP: some blob URLs could not be resolved");
    }

    logInfo(
      `rewriteMMDForZIP: rewrote ${replacementCount} image URL(s) to relative paths`,
    );
    return rewritten;
  };

  /**
   * Find image ID by CDN URL from the registry.
   * @param {string} cdnUrl - CDN URL to look up
   * @returns {string|null} Image ID or null
   * @private
   */
  proto._findImageIdByCdnUrl = function (cdnUrl) {
    if (!this.imageRegistry) return null;
    const allImages = this.imageRegistry.getAllImages();
    const match = allImages.find((img) => img.originalUrl === cdnUrl);
    return match ? match.id : null;
  };

  /**
   * Rewrite relative image paths (images/filename.jpg) to blob URLs
   * for display. Used when loading edits from ZIP that were saved
   * with relative paths (Phase 8H.3).
   *
   * @param {string} mmdContent - MMD with relative image paths
   * @returns {string} MMD with blob URLs for display
   */
  proto.rewriteRelativePathsToBlobUrls = function (mmdContent) {
    if (!mmdContent || !this.imageFilenameMap || !this.imageBlobUrlMap) {
      return mmdContent;
    }

    let rewritten = mmdContent;
    let replacementCount = 0;

    for (const [imageId, mapEntry] of Object.entries(this.imageFilenameMap)) {
      if (!mapEntry?.filename) continue;

      const relativePath = `images/${mapEntry.filename}`;
      if (!rewritten.includes(relativePath)) continue;

      // Find blob URL for this image
      let blobUrl = null;
      const registryEntry = this.imageRegistry?.getImage(imageId);

      if (registryEntry) {
        if (
          registryEntry.source === "user-upload" ||
          registryEntry.status === "user-added"
        ) {
          // User-added: originalUrl may be a stale blob URL from a previous session.
          // Check if extraction already created a blob URL (via imageBlobUrlMap)
          const existingBlobUrl = this.imageBlobUrlMap.get(
            registryEntry.originalUrl,
          );

          if (existingBlobUrl) {
            // Reuse the blob URL from extraction — avoids orphaned duplicates.
            // Discovery 23 — restore-time housekeeping: replaceImage would
            // flip status to "user-replaced", but this is bookkeeping that
            // refreshes the persisted URL from the just-extracted ZIP, not
            // a user-initiated replacement.
            blobUrl = existingBlobUrl;
            this.imageRegistry.syncOriginalUrlForRestore(imageId, blobUrl);
            logInfo(
              `rewriteRelativePathsToBlobUrls: reused extraction blob URL for user-added image ${imageId}`,
            );
          } else if (registryEntry.blob instanceof Blob) {
            // Fallback: create a fresh blob URL from extracted blob data.
            // Same housekeeping rationale as above — see Discovery 23.
            blobUrl = URL.createObjectURL(registryEntry.blob);
            this.objectURLs.push(blobUrl);
            this.imageRegistry.syncOriginalUrlForRestore(imageId, blobUrl);
            logInfo(
              `rewriteRelativePathsToBlobUrls: created fresh blob URL for user-added image ${imageId}`,
            );
          } else {
            // No blob data — fall back to originalUrl (may or may not work)
            blobUrl = registryEntry.originalUrl;
            logWarn(
              `rewriteRelativePathsToBlobUrls: no blob data for user-added image ${imageId}, using originalUrl`,
            );
          }
        } else {
          // OCR image: look up in imageBlobUrlMap
          blobUrl = this.imageBlobUrlMap.get(registryEntry.originalUrl);
        }
      }

      if (blobUrl) {
        rewritten = rewritten.replaceAll(relativePath, blobUrl);
        replacementCount++;
      } else {
        logWarn(
          `rewriteRelativePathsToBlobUrls: no blob URL for ${imageId} (${relativePath})`,
        );
      }
    }

    if (replacementCount > 0) {
      logInfo(
        `rewriteRelativePathsToBlobUrls: resolved ${replacementCount} relative path(s) to blob URLs`,
      );
    }
    return rewritten;
  };

  /**
   * Reconcile recovered MMD content with the current image registry.
   * Handles two patterns from localStorage-stored content:
   *  1. [user-image:xxx] placeholders (Phase 8H.3) — resolve from registry or remove
   *  2. Data URIs (legacy, pre-Phase 8H.3) — create registry entries, convert to blob URLs
   *
   * @param {string} mmdContent - Recovered MMD content
   * @returns {string} MMD with blob URLs for all resolvable images
   */
  proto.reconcileRecoveredImages = function (mmdContent, cachedImages = null) {
    if (!mmdContent) return mmdContent;
    let reconciled = mmdContent;
    let resolvedCount = 0;
    let removedCount = 0;

    // Pattern 1: Resolve [user-image:xxx] or [user-image:xxx|filename.jpg] placeholders
    const placeholderRegex =
      /\[user-image:(img-usr-[a-f0-9]+)(?:\|([^\]]+))?\]/g;
    reconciled = reconciled.replace(
      placeholderRegex,
      (match, imageId, filename) => {
        // Try direct ID lookup first (same session)
        let entry = this.imageRegistry?.getImage(imageId);

        // Fallback: search by filename across registry (cross-session, IDs differ)
        if (!entry && filename && this.imageFilenameMap) {
          for (const [id, mapEntry] of Object.entries(this.imageFilenameMap)) {
            if (mapEntry?.filename === filename) {
              entry = this.imageRegistry?.getImage(id);
              if (entry) {
                logInfo(
                  `reconcileRecoveredImages: resolved ${imageId} via filename fallback "${filename}" → ${id}`,
                );
                break;
              }
            }
          }
        }

        if (entry) {
          // Image found — resolve to blob URL
          if (entry.originalUrl?.startsWith("blob:")) {
            // For user-added images, the originalUrl may be stale (from a previous session
            // or from registry.json in the ZIP). Create a fresh blob URL from extracted data.
            if (
              (entry.source === "user-upload" ||
                entry.status === "user-added") &&
              entry.blob instanceof Blob
            ) {
              const freshBlobUrl = URL.createObjectURL(entry.blob);
              this.objectURLs.push(freshBlobUrl);
              // Look up the actual ID used in the registry (may differ from placeholder ID)
              const actualId = entry.id;
              // Discovery 23 — restore-time housekeeping: this branch
              // refreshes a stale persisted blob URL from the just-extracted
              // ZIP blob. replaceImage would wrongly flip status to
              // "user-replaced"; this is bookkeeping, not user replacement.
              this.imageRegistry.syncOriginalUrlForRestore(
                actualId,
                freshBlobUrl,
              );
              logInfo(
                `reconcileRecoveredImages: created fresh blob URL for ${actualId}`,
              );
              resolvedCount++;
              return freshBlobUrl;
            }
            resolvedCount++;
            return entry.originalUrl;
          }
          const blobUrl = this.imageBlobUrlMap?.get(entry.originalUrl);
          if (blobUrl) {
            resolvedCount++;
            return blobUrl;
          }
        }

        // Phase 9 Feature 2: Try Cache API before removing
        if (cachedImages && cachedImages.size > 0) {
          const cachedBlob =
            cachedImages.get(imageId) ||
            (filename ? cachedImages.get(filename) : null);

          if (cachedBlob) {
            const cachedBlobUrl = URL.createObjectURL(cachedBlob);
            this.objectURLs.push(cachedBlobUrl);

            // Re-register in image registry if available
            if (this.imageRegistry) {
              const recoveredEntry = this.imageRegistry.addImage({
                originalUrl: cachedBlobUrl,
                blob: cachedBlob,
                mimeType: cachedBlob.type || "image/jpeg",
                fileSize: cachedBlob.size,
                source: "cache-recovery",
              });
              if (recoveredEntry) {
                logInfo(
                  `reconcileRecoveredImages: recovered ${imageId} from Cache API as ${recoveredEntry.id}`,
                );
              }
            }

            resolvedCount++;
            return cachedBlobUrl;
          }
        }

        // Image not in registry or cache — remove the reference
        logWarn(
          `reconcileRecoveredImages: placeholder ${imageId}${filename ? " (" + filename + ")" : ""} not resolvable — removing`,
        );
        removedCount++;
        return "";
      },
    );

    // Pattern 2: Handle legacy data URIs in image syntax
    // Match ![...](data:image/...;base64,...) patterns
    const dataUriImageRegex =
      /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;
    let dataUriMatch;
    const dataUriReplacements = [];

    while ((dataUriMatch = dataUriImageRegex.exec(reconciled)) !== null) {
      const fullMatch = dataUriMatch[0];
      const altText = dataUriMatch[1];
      const dataUri = dataUriMatch[2];

      // Check if this data URI image is already in the registry
      const allImages = this.imageRegistry?.getAllImages() || [];
      const existingEntry = allImages.find((img) => img.dataUri === dataUri);

      if (existingEntry) {
        // Already known — resolve to blob URL
        let blobUrl = existingEntry.originalUrl?.startsWith("blob:")
          ? existingEntry.originalUrl
          : this.imageBlobUrlMap?.get(existingEntry.originalUrl);
        if (blobUrl) {
          dataUriReplacements.push({
            fullMatch,
            replacement: `![${altText}](${blobUrl})`,
          });
          resolvedCount++;
        }
      } else if (this.imageRegistry) {
        // Unknown data URI — create blob and registry entry
        try {
          const mimeMatch = dataUri.match(/^data:(image\/[^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
          const base64Data = dataUri.split(",")[1];
          const byteChars = atob(base64Data);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteArray[i] = byteChars.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          this.objectURLs.push(blobUrl);

          const addedEntry = this.imageRegistry.addImage({
            originalUrl: blobUrl,
            mimeType: mimeType,
            fileSize: blob.size,
            blob: blob,
            dataUri: dataUri,
            mmdReference: `![${altText}](${blobUrl})`,
          });

          if (addedEntry) {
            dataUriReplacements.push({
              fullMatch,
              replacement: `![${altText}](${blobUrl})`,
            });
            resolvedCount++;
            logInfo(
              `reconcileRecoveredImages: created registry entry ${addedEntry.id} from data URI`,
            );
          }
        } catch (err) {
          logWarn(
            `reconcileRecoveredImages: failed to process data URI: ${err.message}`,
          );
        }
      }
    }

    // Apply data URI replacements (done separately to avoid regex interference)
    for (const { fullMatch, replacement } of dataUriReplacements) {
      reconciled = reconciled.replace(fullMatch, replacement);
    }

    if (resolvedCount > 0 || removedCount > 0) {
      logInfo(
        `reconcileRecoveredImages: resolved ${resolvedCount}, removed ${removedCount} image reference(s)`,
      );
    }
    return reconciled;
  };

  // =========================================================================
  // PHASE 8H.1: IMAGE MANAGEMENT — SWAP / ADD / DELETE
  // =========================================================================

  /**
   * Replace an existing image with a new file.
   *
   * @param {string} imageId - Registry image ID
   * @param {Object} fileData - Processed file data from MathPixImageManagerUI.processFile()
   * @param {Blob} fileData.blob - Image blob
   * @param {string} fileData.blobUrl - Object URL for display
   * @param {string} fileData.dataUri - Base64 data URI for API/ZIP
   * @param {string} fileData.mimeType - MIME type
   * @param {number} fileData.fileSize - File size in bytes
   * @param {Object|null} fileData.dimensions - { width, height } or null
   */
  proto.swapImage = async function (imageId, fileData) {
    logInfo(`Swapping image: ${imageId}`);

    const entry = this.imageRegistry.getImage(imageId);
    if (!entry) {
      logError(`swapImage: image ${imageId} not found in registry`);
      throw new Error("Image not found in registry");
    }

    // Determine the old blob URL currently in the working MMD
    let oldBlobUrl = null;
    if (entry.source === "user-upload" || entry.status === "user-added") {
      // User-added: originalUrl IS the blob URL in the MMD
      oldBlobUrl = entry.originalUrl;
    } else {
      // OCR image: look up the blob URL from the map
      oldBlobUrl = this.imageBlobUrlMap.get(entry.originalUrl);
    }

    if (!oldBlobUrl) {
      logWarn(`swapImage: could not determine old blob URL for ${imageId}`);
      // Try originalUrl as fallback
      oldBlobUrl = entry.originalUrl;
    }

    // Push undo
    this.pushToUndoStack(this.restoredSession.currentMMD);

    // Update registry — keep originalUrl as CDN URL for OCR images
    const replaceData = {
      blob: fileData.blob,
      dataUri: fileData.dataUri,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize,
      dimensions: fileData.dimensions,
    };

    // For user-added images, update the originalUrl to the new blob URL
    if (entry.source === "user-upload" || entry.status === "user-added") {
      replaceData.originalUrl = fileData.blobUrl;
    }

    this.imageRegistry.replaceImage(imageId, replaceData);
    // Convert-size encode cache: the bytes for this image id changed, so its
    // memoised dataURI is stale. Evict it; the next estimate re-encodes.
    this._invalidateEncode(imageId);

    // Update blob map for OCR images (overwrites old mapping)
    if (entry.source !== "user-upload" && entry.status !== "user-added") {
      this.imageBlobUrlMap.set(entry.originalUrl, fileData.blobUrl);
    }

    // Replace in working MMD
    if (oldBlobUrl && this.restoredSession?.currentMMD) {
      this.restoredSession.currentMMD =
        this.restoredSession.currentMMD.replaceAll(
          oldBlobUrl,
          fileData.blobUrl,
        );
    }

    // Update display layer if collapsed
    if (this.isDisplayCollapsed && this.displayLayer) {
      this.displayLayer.updateUrl(oldBlobUrl, fileData.blobUrl);
    }

    // Refresh textarea/code/preview display
    this.loadMMDContent(
      this.restoredSession.currentMMD,
      this.restoredSession.originalMMD,
    );

    // Revoke old blob URL
    if (oldBlobUrl && oldBlobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(oldBlobUrl);
    }

    // Phase 9 Feature 2: Update cache — remove old, cache new
    const swapFilename = this.imageFilenameMap?.[imageId]?.filename || null;
    this._removeCachedImage(imageId, swapFilename);
    this._cacheImage(imageId, swapFilename, fileData.blob);

    // Trigger auto-save
    this.updateSessionStatus("modified");
    this.scheduleAutoSave(this.restoredSession.currentMMD);

    // Screen reader announcement
    this.announceToScreenReader("Image replaced successfully");
    logInfo(`Image ${imageId} swapped successfully`);

    // Phase 9 Feature 1C: Warn about unsaved image changes
    this.showImageSaveWarning();
  };

  /**
   * Add a new user-supplied image to the document.
   * Appends the image reference at the end of the MMD.
   *
   * @param {Object} fileData - Processed file data from MathPixImageManagerUI.processFile()
   */
  proto.addImageToDocument = async function (fileData) {
    logInfo("Adding new image to document");

    // Push undo
    this.pushToUndoStack(this.restoredSession.currentMMD);

    // Build MMD reference before registry call so we can include it
    const mmdRef = `![](${fileData.blobUrl})`;

    // Add to registry with all data in one call (avoids replaceImage overwriting status)
    const addedEntry = this.imageRegistry.addImage({
      originalUrl: fileData.blobUrl,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize,
      dimensions: fileData.dimensions,
      blob: fileData.blob,
      dataUri: fileData.dataUri,
      mmdReference: mmdRef,
    });

    if (!addedEntry) {
      logError("Failed to add image to registry");
      throw new Error("Failed to add image to registry");
    }

    // Phase 9 Feature 2: Cache for cross-session persistence
    const addedFilename = fileData.blob?.name || null;
    this._cacheImage(addedEntry.id, addedFilename, fileData.blob);

    // Append to end of working MMD
    this.restoredSession.currentMMD += `\n\n${mmdRef}`;
    // If display collapsed, re-collapse entire document
    if (this.isDisplayCollapsed && this.displayLayer) {
      // Re-collapse will pick up the new image
      const { displayMMD } = this.displayLayer.collapseAll(
        this.restoredSession.currentMMD,
        this.imageRegistry,
      );
      // The display layer tracks the new mapping
      logDebug("Re-collapsed after add");
    }

    // Refresh display
    this.loadMMDContent(
      this.restoredSession.currentMMD,
      this.restoredSession.originalMMD,
    );

    // Show buttons now that images exist
    if (this.elements.collapseImagesBtn) {
      this.elements.collapseImagesBtn.hidden = false;
    }
    // Update manage button label (switches from "Add image" back to "Manage images")
    this.updateManageImagesButtonState();

    // Trigger auto-save
    this.updateSessionStatus("modified");
    this.scheduleAutoSave(this.restoredSession.currentMMD);

    // Screen reader announcement
    this.announceToScreenReader(
      "Image added at end of document. Move to desired position in the MMD.",
    );
    logInfo(`Image ${addedEntry.id} added to document`);

    // Phase 9 Feature 1C: Warn about unsaved image changes
    this.showImageSaveWarning();
  };

  /**
   * Delete an image from the document.
   * Removes the MMD reference line and the registry entry.
   *
   * @param {string} imageId - Registry image ID
   */
  proto.deleteImage = async function (imageId) {
    logInfo(`Deleting image: ${imageId}`);

    const entry = this.imageRegistry.getImage(imageId);
    if (!entry) {
      logError(`deleteImage: image ${imageId} not found in registry`);
      throw new Error("Image not found in registry");
    }

    // Determine the blob URL in the working MMD
    let blobUrl = null;
    if (entry.source === "user-upload" || entry.status === "user-added") {
      blobUrl = entry.originalUrl;
    } else {
      blobUrl = this.imageBlobUrlMap.get(entry.originalUrl);
    }

    // Push undo
    this.pushToUndoStack(this.restoredSession.currentMMD);

    // Remove the MMD reference line
    if (blobUrl && this.restoredSession?.currentMMD) {
      // Match markdown image: ![...](blobUrl)
      const escapedUrl = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mdPattern = new RegExp(
        `\\n?!\\[[^\\]]*\\]\\(${escapedUrl}\\)\\n?`,
        "g",
      );
      this.restoredSession.currentMMD = this.restoredSession.currentMMD.replace(
        mdPattern,
        "\n",
      );

      // Also try LaTeX includegraphics pattern
      const latexPattern = new RegExp(
        `\\n?\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedUrl}\\}\\n?`,
        "g",
      );
      this.restoredSession.currentMMD = this.restoredSession.currentMMD.replace(
        latexPattern,
        "\n",
      );

      // Clean up any resulting double blank lines
      this.restoredSession.currentMMD = this.restoredSession.currentMMD.replace(
        /\n{3,}/g,
        "\n\n",
      );
    }

    // Remove from registry
    this.imageRegistry.removeImage(imageId);
    // Convert-size encode cache: image removed, so drop any memoised dataURI
    // for its id to prevent a stale embed in a later estimate.
    this._invalidateEncode(imageId);

    // Remove from blob map if applicable
    if (entry.source !== "user-upload" && entry.originalUrl) {
      this.imageBlobUrlMap.delete(entry.originalUrl);
    }

    // Phase 9 Feature 2: Remove from image cache
    const deleteFilename = this.imageFilenameMap?.[imageId]?.filename || null;
    this._removeCachedImage(imageId, deleteFilename);

    // If display collapsed, re-collapse
    if (this.isDisplayCollapsed && this.displayLayer) {
      const { displayMMD } = this.displayLayer.collapseAll(
        this.restoredSession.currentMMD,
        this.imageRegistry,
      );
      logDebug("Re-collapsed after delete");
    }

    // Refresh display
    this.loadMMDContent(
      this.restoredSession.currentMMD,
      this.restoredSession.originalMMD,
    );

    // Revoke blob URL
    if (blobUrl && blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
    }

    // Update buttons based on remaining image count
    const hasImages = this.imageRegistry.getCount() > 0;
    if (this.elements.collapseImagesBtn) {
      this.elements.collapseImagesBtn.hidden = !hasImages;
    }
    // Manage button stays visible (label switches to "Add image" when empty)
    this.updateManageImagesButtonState();

    // Trigger auto-save
    this.updateSessionStatus("modified");
    this.scheduleAutoSave(this.restoredSession.currentMMD);

    // Screen reader announcement
    this.announceToScreenReader("Image removed from document");
    logInfo(`Image ${imageId} deleted from document`);

    // Phase 9 Feature 1C: Warn about unsaved image changes
    this.showImageSaveWarning();
  };

  // =========================================================================
  // CACHE API IMAGE PERSISTENCE (Phase 9 Feature 2)
  // Relocated from session-restorer-sessions.js for cohesion — these methods
  // are called by extractAndRestoreImages, swapImage, addImageToDocument,
  // deleteImage, and reconcileRecoveredImages, all in this file.
  // =========================================================================

  /**
   * Check if the Cache API is available in this browser context.
   * @returns {boolean}
   * @private
   */
  proto._hasCacheAPI = function () {
    return typeof caches !== "undefined" && "open" in caches;
  };

  /**
   * Cache an image blob for cross-session persistence.
   * Stores under both image ID and filename for flexible lookup.
   * Fire-and-forget — failures are logged but do not block the caller.
   *
   * @param {string} imageId - Registry image ID (e.g. "img-usr-a1b2c3")
   * @param {string|null} filename - Original filename for secondary lookup
   * @param {Blob} blob - Image blob to cache
   * @private
   */
  proto._cacheImage = async function (imageId, filename, blob) {
    if (!this._hasCacheAPI() || !imageId || !blob) return;

    try {
      const cache = await caches.open("mathpix-user-images");
      const headers = { "Content-Type": blob.type || "image/jpeg" };

      // Primary key: image ID
      await cache.put(
        new Request(`/mathpix-images/id/${imageId}`),
        new Response(blob.slice(), { headers }),
      );

      // Secondary key: filename (for cross-session lookup where IDs differ)
      if (filename) {
        await cache.put(
          new Request(`/mathpix-images/fn/${filename}`),
          new Response(blob.slice(), { headers }),
        );
      }

      logDebug(
        `Cached image: ${imageId}${filename ? " (" + filename + ")" : ""}`,
      );
    } catch (error) {
      logWarn("Failed to cache image:", imageId, error);
    }
  };

  /**
   * Remove a cached image by ID and optional filename.
   * Fire-and-forget — failures are logged but do not block the caller.
   *
   * @param {string} imageId - Registry image ID
   * @param {string|null} filename - Original filename (secondary key)
   * @private
   */
  proto._removeCachedImage = async function (imageId, filename) {
    if (!this._hasCacheAPI() || !imageId) return;

    try {
      const cache = await caches.open("mathpix-user-images");

      await cache.delete(new Request(`/mathpix-images/id/${imageId}`));
      if (filename) {
        await cache.delete(new Request(`/mathpix-images/fn/${filename}`));
      }

      logDebug(
        `Removed cached image: ${imageId}${filename ? " (" + filename + ")" : ""}`,
      );
    } catch (error) {
      logWarn("Failed to remove cached image:", imageId, error);
    }
  };

  /**
   * Pre-fetch all cached images into a synchronous lookup Map.
   * Used by reconcileRecoveredImages() to resolve placeholders without
   * making the regex callback async.
   *
   * @returns {Promise<Map<string, Blob>>} Map of imageId/filename → Blob
   * @private
   */
  proto._prefetchCachedImages = async function () {
    const map = new Map();
    if (!this._hasCacheAPI()) return map;

    try {
      const cache = await caches.open("mathpix-user-images");
      const keys = await cache.keys();

      for (const request of keys) {
        const url = new URL(request.url, location.origin).pathname;
        const idMatch = url.match(/\/mathpix-images\/id\/(.+)$/);
        const fnMatch = url.match(/\/mathpix-images\/fn\/(.+)$/);

        const response = await cache.match(request);
        if (!response) continue;

        const blob = await response.blob();
        if (idMatch) map.set(idMatch[1], blob);
        if (fnMatch) map.set(fnMatch[1], blob);
      }

      if (map.size > 0) {
        logInfo(`Pre-fetched ${map.size} cached image entries`);
      }
    } catch (error) {
      logWarn("Failed to pre-fetch cached images:", error);
    }

    return map;
  };

  /**
   * Clear all localStorage sessions matching the current ZIP file
   * Shows a confirmation modal before proceeding.
   * After clearing, loads the ZIP original contents into the MMD preview.
   * @param {HTMLElement} banner - The session recovery banner element to remove
   * @private
   */
  proto.clearLocalSavesForCurrentZIP = async function (banner) {
    const sourceFilename = this.restoredSession?.source?.filename;
    if (!sourceFilename) {
      logWarn("Cannot clear local saves — no source filename");
      this.showNotification("No active session to clear", "warning");
      return;
    }

    // Confirm with user via modal
    const confirmed = await window.safeConfirm(
      `This will permanently delete all locally saved edits for "${this.escapeHtml(sourceFilename)}" from your browser. The original ZIP contents will be loaded instead.\n\nThis cannot be undone.`,
      "Clear Local Saves",
    );

    if (!confirmed) return;

    // Find ALL matching localStorage sessions (no filtering — remove everything for this ZIP)
    const uploadedBaseName = sourceFilename.replace(/\.[^/.]+$/, "");
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("mathpix-resume-session"),
    );

    let clearedCount = 0;
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const storedName = data?.sourceFileName || data?.sourceFilename || "";
        const storedBaseName = storedName.replace(/\.[^/.]+$/, "");

        if (storedBaseName && storedBaseName === uploadedBaseName) {
          localStorage.removeItem(key);
          clearedCount++;
          logDebug("Cleared localStorage session:", key);
        }
      } catch (e) {
        logDebug("Skipping invalid entry during clear:", key);
      }
    }

    logInfo(
      `Cleared ${clearedCount} localStorage session(s) for ${sourceFilename}`,
    );

    // Clear internal recovery session references
    this._recoverySessions = [];

    // Load the ZIP original contents into MMD preview
    this.loadZIPContents();
    this._currentSessionIndex = -1;

    // Start a fresh persistence session so new edits are tracked cleanly
    this.startPersistenceSession(sourceFilename);

    // Remove the banner
    if (banner) {
      banner.remove();
    }

    // Only show switch version button if there are ZIP edits to switch between
    const zipEdits = this.parseResult?.edits?.files || [];
    if (zipEdits.length > 0) {
      this.showSwitchVersionButton();
    }

    this.showNotification(
      `Cleared ${clearedCount} local save${clearedCount !== 1 ? "s" : ""}. Loaded original ZIP contents.`,
      "success",
    );
  };

  console.log("[SessionRestorer] Images mixin loaded");
})();
