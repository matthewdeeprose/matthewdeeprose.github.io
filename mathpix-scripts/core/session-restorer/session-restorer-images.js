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
                registry.replaceImage(imageId, { dataUri });
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
   * Get MMD content with blob URLs swapped back to original CDN URLs.
   * Required for the convert API, which cannot resolve blob: protocol URLs.
   *
   * @param {string} mmdContent - MMD content potentially containing blob URLs
   * @returns {string} MMD with original CDN URLs restored
   */
  proto.getMMDForAPI = function (mmdContent) {
    if (!mmdContent) return mmdContent;

    let apiSafe = mmdContent;

    // Step 1: Reverse blob URLs to CDN URLs for OCR images
    if (this.imageBlobUrlMap && this.imageBlobUrlMap.size > 0) {
      for (const [originalUrl, blobUrl] of this.imageBlobUrlMap) {
        if (!blobUrl) {
          logWarn(
            `getMMDForAPI: skipping undefined blobUrl for ${originalUrl}`,
          );
          continue;
        }
        const escapedBlobUrl = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedBlobUrl, "g");
        apiSafe = apiSafe.replace(regex, originalUrl);
      }
    }

    // Step 2: Handle remaining blob URLs (user-added images) — Phase 8H.1
    if (this.imageRegistry && apiSafe.includes("blob:")) {
      const blobUrlRegex = /blob:https?:\/\/[^\s)}"\\]+/g;
      apiSafe = apiSafe.replace(blobUrlRegex, (blobUrl) => {
        const images = this.imageRegistry.getAllImages();
        const entry = images.find((img) => img.originalUrl === blobUrl);
        if (entry && entry.dataUri) {
          logDebug(
            `getMMDForAPI: embedded user-added image ${entry.id} as data URI`,
          );
          return entry.dataUri;
        }
        logWarn(
          `getMMDForAPI: unresolvable blob URL: ${blobUrl.substring(0, 60)}…`,
        );
        return blobUrl;
      });
    }

    return apiSafe;
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
        logWarn(
          `getMMDForStorage: unresolvable blob URL: ${blobUrl.substring(0, 60)}…`,
        );
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
            // Reuse the blob URL from extraction — avoids orphaned duplicates
            blobUrl = existingBlobUrl;
            this.imageRegistry.replaceImage(imageId, {
              originalUrl: blobUrl,
            });
            logInfo(
              `rewriteRelativePathsToBlobUrls: reused extraction blob URL for user-added image ${imageId}`,
            );
          } else if (registryEntry.blob instanceof Blob) {
            // Fallback: create a fresh blob URL from extracted blob data
            blobUrl = URL.createObjectURL(registryEntry.blob);
            this.objectURLs.push(blobUrl);
            this.imageRegistry.replaceImage(imageId, {
              originalUrl: blobUrl,
            });
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
              this.imageRegistry.replaceImage(actualId, {
                originalUrl: freshBlobUrl,
              });
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
