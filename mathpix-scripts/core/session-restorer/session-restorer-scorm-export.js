// ─── MathPixSessionRestorer SCORM/HTML Export Mixin ──────────────────────────
// Assembles the current resume session (working MMD + image registry + Stage 7
// context) into export-ready HTML for the vendored `scorm-builder` library.
// Route A: everything happens in the browser — no MathPix Convert API call.
// Depends on: session-restorer-core.js
//
// Phase 3 status: the assembly only. Nothing here mounts a control or touches
// the DOM of tools.html — the wiring is Phase 4 (H1/H3/H4 of the plan).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-scorm-export.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug } = window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // ========================================================================
  // SCORM/HTML export facade URL (captured at parse time)
  // ========================================================================

  // Classic IIFE: document.currentScript is valid only during this initial
  // synchronous execution and is null inside every later callback. Capture the
  // module URL now and resolve the ES-module facade relative to it, so the
  // mixin works from any served subpath. Mirrors ally-statement-preview.js.
  const EXPORT_FACADE_URL =
    document.currentScript && document.currentScript.src
      ? new URL(
          "../../../js/scorm-export/scorm-export.js",
          document.currentScript.src,
        ).href
      : null;

  // ========================================================================
  // Constants
  // ========================================================================

  /** Last-resort document title when the context carries nothing usable. */
  const DEFAULT_EXPORT_TITLE = "MathPix document";

  /**
   * The two export targets offered as Convert checkboxes, built ENTIRELY in the
   * browser — no MathPix Convert API call and no conversion credit.
   *
   * **Deliberately NOT in `MATHPIX_CONFIG.CONVERT.FORMATS`.** That object is the
   * same one the Convert API client validates against
   * (`mathpix-convert-api-client.js` `_validateFormats`), so an entry there would
   * be treated as a real API format and posted in the request body — and a
   * browser-only selection would be rejected outright as INVALID_FORMAT. Keeping
   * the registry here also keeps the facade coupling (`target`) in the one file
   * that owns the export.
   *
   * `target` is the value handed to `exportContent({ target })`.
   * Compound extensions mirror the existing `.tex.zip` / `.md.zip` convention.
   */
  const BROWSER_FORMATS = Object.freeze({
    scorm: Object.freeze({
      label: "SCORM package",
      extension: ".scorm.zip",
      mimeType: "application/zip",
      target: "scorm",
      binary: true,
    }),
    "standalone-html": Object.freeze({
      label: "Standalone HTML",
      extension: ".standalone.html",
      mimeType: "text/html",
      target: "html",
      binary: false,
    }),
  });

  /** Live region the browser branch reports progress into (already in tools.html). */
  const CONVERT_STATUS_ID = "resume-convert-status";

  /** base64 expands binary by 4/3; used for the advisory pre-export estimate. */
  const BASE64_EXPANSION = 4 / 3;

  /** Marker class the library's long-description enhancer looks for. */
  const LONGDESC_CLASS = "longdesc";

  /** Class the mathpix figure normaliser uses to spot an image wrapper. */
  const FIGURE_IMG_CLASS = "figure_img";

  /**
   * Render options for the MMD → HTML pass. `output_format: "latex"` keeps the
   * maths as TeX delimiters in the source so MathJax typesets it in the
   * exported document — the library's accessible maths route (L1/D10). Without
   * it mathpix pre-renders SVG, which exports as inaccessible pictures.
   */
  const EXPORT_RENDER_OPTIONS = Object.freeze({
    htmlTags: true,
    width: 0,
    outMath: { output_format: "latex" },
  });

  /** Registry stub that makes writeAppendix REMOVE the appendix wholesale. */
  const EMPTY_REGISTRY_STUB = Object.freeze({ getAllImages: () => [] });

  /**
   * Stage 7 audienceLevel → a human label. LOM has no vocabulary for these, so
   * they land in `classification` free text rather than a `<value>` token
   * (L4: `<source>` is itself enumerated to LOMv1.0, so inventing a token is
   * schema-invalid).
   */
  const AUDIENCE_LABELS = Object.freeze({
    general: "General audience",
    ug1: "Undergraduate year 1",
    ug2: "Undergraduate year 2",
    ug3: "Undergraduate year 3",
    ug4: "Undergraduate year 4",
    pg: "Postgraduate",
    staff: "Staff",
  });

  /**
   * Stage 7 documentType → a LOM `learningResourceType` token. Only tokens in
   * LOM_VOCABULARIES.learningResourceType are legal; anything unmapped is left
   * out so the library keeps its own default rather than being handed a token
   * it will drop with a warning.
   */
  const DOCUMENT_TYPE_TO_LRT = Object.freeze({
    "solution-sheet": "narrative text",
    handout: "narrative text",
    article: "narrative text",
    "past-exam-paper": "exam",
    "lecture-notes": "lecture",
    worksheet: "exercise",
  });

  /** Stage 7 documentType → a readable label for the classification taxon. */
  const DOCUMENT_TYPE_LABELS = Object.freeze({
    "solution-sheet": "Solution sheet",
    handout: "Handout",
    article: "Article",
    "past-exam-paper": "Past exam paper",
    "lecture-notes": "Lecture notes",
    worksheet: "Worksheet",
    other: "Other",
  });

  // ========================================================================
  // Small helpers
  // ========================================================================

  /** Trimmed string, or "" for anything that is not a usable string. */
  function str(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  /** Today as YYYY-MM-DD — the only date shape LOM's DATE_RE accepts. */
  function isoDateOnly() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Filename base of a source document, with the extension removed. */
  function filenameBase(name) {
    const clean = str(name);
    if (!clean) return "";
    return clean.replace(/\.[^.]+$/, "");
  }

  // ========================================================================
  // Step 3 — strip the long-description appendix
  // ========================================================================

  /**
   * Remove the "Long descriptions" heading appendix from the MMD.
   *
   * The manager writes long descriptions into the MMD as a trailing heading
   * appendix. The export renders each one as a per-image `<details>` disclosure
   * instead, so the appendix would duplicate every description. Reuse the
   * serialiser's own state machine with an EMPTY registry — the "no entry has a
   * long description" case is exactly "remove the appendix".
   *
   * @param {string} mmd
   * @returns {{mmd: string, removed: boolean}}
   */
  proto._stripLongDescriptionAppendix = function (mmd) {
    const safe = typeof mmd === "string" ? mmd : "";
    const serialiser = window.MathPixAltTextMMDSerialiser;

    if (!serialiser || typeof serialiser.writeAppendix !== "function") {
      logWarn(
        "_stripLongDescriptionAppendix: MathPixAltTextMMDSerialiser.writeAppendix unavailable; leaving the appendix in place",
      );
      return { mmd: safe, removed: false };
    }

    try {
      const result = serialiser.writeAppendix(safe, EMPTY_REGISTRY_STUB);
      const next = typeof result?.mmd === "string" ? result.mmd : safe;
      const removed = next !== safe;
      logDebug(
        `_stripLongDescriptionAppendix: ${removed ? "removed" : "no appendix present"} (${safe.length} → ${next.length} chars)`,
      );
      return { mmd: next, removed };
    } catch (err) {
      logError(
        "_stripLongDescriptionAppendix: writeAppendix threw; leaving the appendix in place",
        err,
      );
      return { mmd: safe, removed: false };
    }
  };

  // ========================================================================
  // The image index — <img src> → registry entry
  // ========================================================================

  /**
   * Build the `src` → registry-entry lookup the post-pass and the image
   * resolver share.
   *
   * Two key families are registered per entry, because the rendered HTML can
   * carry either form:
   *   - `entry.originalUrl` — the CDN URL, and the registry's own identity key
   *   - the blob URL from `imageBlobUrlMap` (CDN → blob) — what the working
   *     MMD actually contains once images have been restored from a ZIP
   *
   * @returns {{index: Map<string, object>, keyCount: number}}
   */
  proto._buildScormImageIndex = function () {
    const index = new Map();
    const entries = this.imageRegistry?.getAllImages?.() || [];

    for (const entry of entries) {
      const cdnUrl = str(entry.originalUrl);
      if (cdnUrl) index.set(cdnUrl, entry);
    }

    if (this.imageBlobUrlMap) {
      for (const [cdnUrl, blobUrl] of this.imageBlobUrlMap) {
        if (!blobUrl) continue;
        const entry = entries.find((e) => e.originalUrl === cdnUrl);
        if (entry) index.set(blobUrl, entry);
      }
    }

    logDebug(
      `_buildScormImageIndex: ${entries.length} registry entries → ${index.size} src keys`,
    );
    return { index, keyCount: index.size };
  };

  // ========================================================================
  // The image resolver — src → data: URI
  // ========================================================================

  /**
   * Resolver for the library's image embedder: `src` → base64 data URI, or
   * null to leave the src alone.
   *
   * **Passthrough first — the registry's own bytes, not a canvas re-encode.**
   * The Convert path's `encodeBestDataURI` decodes to a canvas, re-encodes with
   * every candidate encoder and keeps whichever is smallest. That rule is right
   * for an API upload with a hard size gate; it is wrong for an export, on both
   * of the two content shapes this app actually produces. Measured on
   * `s00894-022-05258-w-mathpix.zip`:
   *
   *   - RDKit chemistry renders (PNG line art, 1000×750): re-encoding picks
   *     JPEG because it roughly halves the bytes, and that costs a maximum
   *     channel deviation of 61/255 with 2,185 pure-white background pixels
   *     dirtied — ringing around the thin black bond strokes. Passthrough keeps
   *     the PNG, +38,431 base64 chars.
   *   - OCR scans (already JPEG): passthrough is *smaller* than the re-encode
   *     (-992, -812, -548 chars measured) AND avoids a second lossy generation.
   *     Strictly better on both axes; there is no trade-off to weigh.
   *
   * So passthrough is unambiguously right for the scans and a size-for-fidelity
   * trade for the renders. Sizes are recorded in `stats.bytes` so the host's
   * advisory size check (D9) can speak for itself rather than the codec quietly
   * deciding on the user's behalf.
   *
   * **The memo is deliberately export-local.** `_encodeCached` keys its memo on
   * `entry.id` ALONE — `allowedEncoders` is not part of the key (read from
   * `session-restorer-images.js:856-868`, not measured). Sharing it would mean
   * whichever of export/Convert ran first decided the codec for both. That is
   * benign today only because both happen to resolve to `["png","jpeg"]`; it
   * stops being benign the moment the two want different rules — which is
   * exactly what this function now does.
   *
   * @param {Map<string, object>} index - from _buildScormImageIndex
   * @param {{calls: string[], skipped: string[], bytes: object[]}} stats
   * @returns {(src: string) => Promise<string|null>}
   */
  proto._createScormImageResolver = function (index, stats) {
    const restorer = this;
    const memo = new Map(); // export-local; never restorer._encodeMemo

    const passthrough = window._fmEmbedHelpers?.blobToDataURI;

    return async function resolveImage(src) {
      stats.calls.push(src);

      const entry = index.get(src);
      if (!entry) {
        stats.skipped.push(src);
        logWarn(
          `scorm image resolver: no registry entry for ${String(src).substring(0, 80)}`,
        );
        return null;
      }

      if (memo.has(entry.id)) return memo.get(entry.id);

      if (entry.blob instanceof Blob && entry.blob.size > 0) {
        if (typeof passthrough === "function") {
          try {
            const uri = await passthrough(entry.blob);
            stats.bytes.push({
              id: entry.id,
              type: entry.blob.type,
              blobBytes: entry.blob.size,
              chars: uri.length,
              route: "passthrough",
            });
            memo.set(entry.id, uri);
            return uri;
          } catch (err) {
            logWarn(
              `scorm image resolver: passthrough failed for ${entry.id}; falling back to the re-encoder`,
              err,
            );
          }
        }

        // Fallback only. Uses the shared memo, so it inherits the codec caveat
        // above — acceptable because it is the same rule Convert would apply.
        try {
          const uri = await restorer._encodeCached(entry.id, entry.blob, undefined);
          stats.bytes.push({
            id: entry.id,
            type: entry.blob.type,
            blobBytes: entry.blob.size,
            chars: uri.length,
            route: "re-encoded",
          });
          memo.set(entry.id, uri);
          return uri;
        } catch (err) {
          logWarn(
            `scorm image resolver: encode failed for ${entry.id}; falling back to any cached dataUri`,
            err,
          );
        }
      }

      if (str(entry.dataUri)) {
        memo.set(entry.id, entry.dataUri);
        return entry.dataUri;
      }

      stats.skipped.push(src);
      logWarn(
        `scorm image resolver: entry ${entry.id} has neither blob nor dataUri`,
      );
      return null;
    };
  };

  // ========================================================================
  // The post-pass
  // ========================================================================

  /**
   * The container an image's `<figcaption>` and long-description disclosure
   * must be appended to, and how the caption should be spelled there.
   *
   * mathpix renders images in three shapes and only `![](url)` produces a real
   * `<figure>`. The library's `processMathpixFigures` normalises the other two
   * — but it runs INSIDE buildHtml, i.e. AFTER this post-pass. So the post-pass
   * must either find a real figure, or hand the normaliser markup it will
   * convert correctly, or build the figure itself:
   *
   *   - existing `<figure>`            → append `<figcaption>` directly
   *   - `div.table` wrapper (Rule A)   → append `div.caption_figure`; Rule A
   *                                      converts it to `<figcaption>` and the
   *                                      wrapper to `<figure>`
   *   - anything else                  → wrap in a `<figure>` here. Rule B is
   *                                      skipped for a `div.figure_img` already
   *                                      inside a figure, so this is stable.
   *
   * @param {HTMLImageElement} img
   * @param {Document} doc
   * @returns {{host: Element, captionMode: "figcaption"|"caption_figure"}}
   */
  function resolveFigureHost(img, doc) {
    const existingFigure = img.closest("figure");
    if (existingFigure) {
      return { host: existingFigure, captionMode: "figcaption" };
    }

    // Rule A's own discriminator: a div.table counts as a figure wrapper only
    // when it holds a figure_img and no table_tabular. Anything else is a real
    // table and must not be touched.
    const tableWrapper = img.closest("div.table");
    if (
      tableWrapper &&
      tableWrapper.querySelector(`.${FIGURE_IMG_CLASS}`) &&
      !tableWrapper.querySelector(".table_tabular")
    ) {
      return { host: tableWrapper, captionMode: "caption_figure" };
    }

    const inner = img.closest(`div.${FIGURE_IMG_CLASS}`) || img;
    const figure = doc.createElement("figure");
    inner.parentNode.insertBefore(figure, inner);
    figure.appendChild(inner);
    return { host: figure, captionMode: "figcaption" };
  }

  /**
   * Render one long description (markdown) to an HTML fragment.
   * @param {string} markdown
   * @returns {string} HTML, or "" when the renderer is unavailable
   */
  function renderDescriptionFragment(markdown) {
    if (typeof window.markdownToHTML !== "function") return "";
    try {
      return window.markdownToHTML(markdown, EXPORT_RENDER_OPTIONS);
    } catch (err) {
      logError("renderDescriptionFragment: markdownToHTML threw", err);
      return "";
    }
  }

  /**
   * Apply registry truth to the rendered DOM: alt text, decorative handling,
   * captions, and per-image long-description containers.
   *
   * NO REGISTRY WRITES HAPPEN HERE (decision D4). `applyRegistryToMMD` is
   * deliberately not called: it mutates the registry via `updateImageReference`,
   * which would leave every entry describing a document that was never
   * committed. The export must have no side effects.
   *
   * @param {Document} doc
   * @param {Map<string, object>} index
   * @param {object} stats - mutated: misses, altApplied, decorative, captions,
   *   longDescriptions, missingAlt
   * @returns {Promise<void>}
   */
  proto._applyRegistryToExportDom = async function (doc, index, stats) {
    const images = Array.from(doc.querySelectorAll("img"));
    stats.imgCount = images.length;

    // Pair each image with its entry first, so the markdown renders for every
    // long description happen in ONE Promise.all and the DOM walk stays
    // synchronous (no interleaved mutation while awaiting).
    const described = [];
    for (const img of images) {
      const src = img.getAttribute("src") || "";
      const entry = index.get(src);

      if (!entry) {
        stats.misses.push(src);
        continue;
      }

      if (entry.decorative) {
        // Decorative wins over everything stored. An empty alt is the whole
        // point; a caption or a description would put the image back into the
        // accessibility tree by another door.
        img.setAttribute("alt", "");
        stats.decorative.push(entry.id);
        continue;
      }

      const alt = str(entry.altText);
      if (alt) {
        img.setAttribute("alt", alt);
        stats.altApplied.push(entry.id);
      } else {
        // Deliberately NOT alt="". An empty alt is a positive claim that the
        // image is decorative, and stamping one here would (a) misdescribe six
        // real diagrams to a screen-reader user and (b) silence the library's
        // own img-missing-alt audit, which keys on the attribute being absent
        // (enhancers/audit.js). Measured: with alt="" stamped, the audit
        // reported 0 warnings for 6 undescribed images.
        stats.missingAlt.push(entry.id);
        if (img.hasAttribute("alt") && !str(img.getAttribute("alt"))) {
          // The renderer emitted its own empty alt, which defeats the audit
          // just as effectively. Record it so the gap is visible rather than
          // silently absorbed.
          stats.emptyAltFromRenderer.push(entry.id);
        }
      }

      if (str(entry.longDescription)) described.push({ img, entry });
    }

    const fragments = await Promise.all(
      described.map((d) => renderDescriptionFragment(d.entry.longDescription)),
    );

    // Synchronous DOM walk from here down.
    for (const img of images) {
      const entry = index.get(img.getAttribute("src") || "");
      if (!entry || entry.decorative) continue;

      const caption = str(entry.title);
      const describedIndex = described.findIndex((d) => d.img === img);
      const fragment = describedIndex >= 0 ? fragments[describedIndex] : "";

      if (!caption && !fragment) continue;

      const { host, captionMode } = resolveFigureHost(img, doc);

      if (caption && !host.querySelector("figcaption, .caption_figure")) {
        const el = doc.createElement(
          captionMode === "figcaption" ? "figcaption" : "div",
        );
        if (captionMode === "caption_figure") el.className = "caption_figure";
        el.textContent = caption;
        host.appendChild(el);
        stats.captions.push(entry.id);
      }

      if (fragment) {
        // MUST be a SIBLING AFTER the image, never a wrapper around it:
        // enhancers/long-descriptions.js REPLACES this element with the
        // <details> and then wires the nearest <img> BEFORE it. A wrapper
        // would put the image inside its own disclosure.
        const container = doc.createElement("div");
        container.className = LONGDESC_CLASS;
        container.innerHTML = fragment;
        host.appendChild(container);
        stats.longDescriptions.push(entry.id);
      }
    }
  };

  // ========================================================================
  // Metadata
  // ========================================================================

  /**
   * Map the Stage 7 context object onto the library's LOM metadata shape.
   *
   * Three rules that are easy to get wrong and silently lose data:
   *   - metadata must be passed as `metadata: {…}`; `build({ title })` is
   *     documented but silently ignored
   *   - dates must be YYYY / YYYY-MM / YYYY-MM-DD; a full ISO instant is
   *     rejected by the LOM date pattern
   *   - `keywords` REPLACES the default five; `addKeywords` appends
   *
   * `description` is OMITTED entirely when the context has nothing to say, so
   * generateLom still falls back to generateIntelligentDescription.
   *
   * @returns {{metadata: object, context: object, titleSource: string}}
   */
  proto._buildScormExportMetadata = function () {
    const context = window.MathPixContextManager?.getContext?.() || {};

    const specificTopic = str(context.specificTopic);
    const moduleName = str(context.moduleName);
    // Measured against the 08-capacitors fixture: the source filename lives at
    // metadata.processing.sourceFileName ("08-capacitors.pdf"), with the
    // results-file list as a second source. There is no top-level
    // `sourceFilename` on restoredSession — reading one yields the default
    // title and looks like a blank context rather than a bad lookup.
    const meta = this.restoredSession?.metadata || {};
    const sourceName = filenameBase(
      meta.processing?.sourceFileName ||
        meta.files?.source?.[0]?.filename ||
        meta.files?.results?.[0]?.filename ||
        "",
    );

    // Precedence per H2. Deliberately does NOT look for a first heading —
    // mathpix content starts at <h2> and has no <h1> to read (§1.2c).
    let title = DEFAULT_EXPORT_TITLE;
    let titleSource = "default";
    if (specificTopic) {
      title = specificTopic;
      titleSource = "specificTopic";
    } else if (moduleName) {
      title = moduleName;
      titleSource = "moduleName";
    } else if (sourceName) {
      title = sourceName;
      titleSource = "sourceFilename";
    }

    const metadata = {
      title,
      date: isoDateOnly(),
    };

    // The keyword tier is the one an LMS might actually display, so the two
    // most content-bearing context fields go there. addKeywords APPENDS to the
    // library's default five rather than replacing them.
    const extraKeywords = [str(context.subjectArea), specificTopic].filter(
      Boolean,
    );
    if (extraKeywords.length) metadata.addKeywords = extraKeywords;

    const description = str(context.learningObjective);
    if (description) metadata.description = description;

    const documentType = str(context.documentType);
    const lrt = DOCUMENT_TYPE_TO_LRT[documentType];
    if (lrt) metadata.educational = { learningResourceType: [lrt] };

    // Everything with no LOM vocabulary goes to classification free text.
    const taxons = [];
    if (str(context.moduleCode)) {
      taxons.push({ id: "moduleCode", entry: str(context.moduleCode) });
    }
    if (moduleName) taxons.push({ id: "moduleName", entry: moduleName });
    if (str(context.audienceLevel)) {
      taxons.push({
        id: "audienceLevel",
        entry:
          AUDIENCE_LABELS[str(context.audienceLevel)] ||
          str(context.audienceLevel),
      });
    }
    if (documentType) {
      taxons.push({
        id: "documentType",
        entry: DOCUMENT_TYPE_LABELS[documentType] || documentType,
      });
    }
    if (taxons.length) {
      metadata.classification = [
        {
          purpose: "discipline",
          taxonPath: [{ source: "MathPix document context", taxons }],
        },
      ];
    }

    return { metadata, context, titleSource };
  };

  // ========================================================================
  // The assembly
  // ========================================================================

  /**
   * Assemble the current session into export-ready HTML.
   *
   * 1. describeChemistryIntoWorkingMMD  — degrades, never blocks
   * 2. getCurrentMMDContent            — canonical read (display-layer aware)
   * 3. _stripLongDescriptionAppendix   — our disclosures replace it
   * 4. markdownToHTML                  — TeX out, not pre-rendered SVG
   * 5. DOMParser → post-pass → body.innerHTML
   *
   * The full build record (metadata, the export options, and the measurement
   * stats) is left on `this._lastScormExportBuild` so the Phase 4 control can
   * read it through `getMetadata` / `getOptions` without rebuilding.
   *
   * @param {object} [opts]
   * @param {(message: string) => void} [opts.setStatus] - progress reporter
   * @param {boolean} [opts.skipChemistry=false] - skip step 1 because the caller
   *   has already run it. `handleConvert` runs chemistry ONCE for both the API
   *   and browser branches, so the browser branch passes true. Defaults to false
   *   so every other caller — including the Phase 3 console harness — is
   *   unchanged.
   * @returns {Promise<string>} the content HTML
   */
  proto._buildScormExportContent = async function (opts = {}) {
    const setStatus = typeof opts.setStatus === "function" ? opts.setStatus : () => {};
    const stats = {
      misses: [],
      altApplied: [],
      missingAlt: [],
      emptyAltFromRenderer: [],
      decorative: [],
      captions: [],
      longDescriptions: [],
      imgCount: 0,
      chemistry: null,
      appendixRemoved: false,
    };
    const resolverStats = { calls: [], skipped: [], bytes: [] };

    // --- 1. chemistry prose ------------------------------------------------
    // Mirrors handleConvert:416-425 — a chemistry failure degrades to
    // "export with whatever the document already says", never blocks.
    if (opts.skipChemistry) {
      stats.chemistry = { skipped: true, reason: "already run by the caller" };
    } else if (typeof this.describeChemistryIntoWorkingMMD === "function") {
      setStatus("Preparing chemistry descriptions…");
      try {
        stats.chemistry = await this.describeChemistryIntoWorkingMMD();
      } catch (chemErr) {
        stats.chemistry = { failed: true, message: chemErr?.message || String(chemErr) };
        setStatus(
          "Chemistry descriptions could not be generated; exporting with the existing content.",
        );
        logError(
          "_buildScormExportContent: chemistry describe failed; continuing",
          chemErr,
        );
      }
    }

    // --- 2. canonical MMD read --------------------------------------------
    setStatus("Reading the document…");
    const workingMMD = this.getCurrentMMDContent();
    if (!str(workingMMD)) {
      throw new Error("There is no document content to export yet.");
    }

    // --- 3. strip the appendix --------------------------------------------
    const stripped = this._stripLongDescriptionAppendix(workingMMD);
    stats.appendixRemoved = stripped.removed;

    // --- 4. MMD → HTML -----------------------------------------------------
    setStatus("Rendering the document…");
    if (typeof window.markdownToHTML !== "function") {
      throw new Error("The markdown renderer has not loaded yet.");
    }
    const renderedHTML = window.markdownToHTML(stripped.mmd, EXPORT_RENDER_OPTIONS);

    // --- 5. post-pass ------------------------------------------------------
    setStatus("Applying image descriptions…");
    const { index } = this._buildScormImageIndex();
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body>${renderedHTML}</body></html>`,
      "text/html",
    );
    await this._applyRegistryToExportDom(doc, index, stats);
    const content = doc.body.innerHTML;

    if (stats.misses.length) {
      logWarn(
        `_buildScormExportContent: ${stats.misses.length} <img> src(s) did not resolve to a registry entry`,
        stats.misses,
      );
      setStatus(
        `${stats.misses.length} image(s) are not in the registry and will not be embedded.`,
      );
    }
    if (stats.missingAlt.length) {
      setStatus(`${stats.missingAlt.length} image(s) have no alt text.`);
    }

    const { metadata, context, titleSource } = this._buildScormExportMetadata();

    const options = {
      imageResolver: this._createScormImageResolver(index, resolverStats),
      onImageSkip: (src) => {
        resolverStats.skipped.push(src);
        logWarn(`scorm export: image could not be embedded — ${String(src).substring(0, 80)}`);
      },
      onAccessibilityWarning: (w) => logWarn("scorm export a11y warning", w),
      onLongDescriptionWarning: (w) => logWarn("scorm export longdesc warning", w),
      onMetadataWarning: (w) => logWarn("scorm export metadata warning", w),
      onQuizWarning: (w) => logWarn("scorm export quiz warning", w),
      onMathjaxAssetWarning: (w) => logWarn("scorm export mathjax asset warning", w),
      ensureH1: true,
      // Opt-in audit for "a long description has been crammed into alt": an <img>
      // with alt over 150 chars and no adjacent long description. P3 measured this
      // app's auto alt-text generator at 265 characters, so it fires precisely on
      // that shape and stays silent where the generator produced both fields.
      warnMissingLongDescription: true,
    };

    this._lastScormExportBuild = {
      content,
      metadata,
      context,
      titleSource,
      options,
      stats,
      resolverStats,
      facadeUrl: EXPORT_FACADE_URL,
      mmdLength: stripped.mmd.length,
    };

    logInfo(
      `_buildScormExportContent: ${stats.imgCount} image(s), ${stats.altApplied.length} with alt, ` +
        `${stats.decorative.length} decorative, ${stats.captions.length} caption(s), ` +
        `${stats.longDescriptions.length} long description(s), ${stats.misses.length} unresolved`,
    );
    setStatus("Document ready to export.");
    return content;
  };

  // ========================================================================
  // The control-facing half (Phase 4 / H2)
  // ========================================================================

  /**
   * Byte size of whatever `exportContent` handed back as its payload. Closure
   * helper, not a prototype method — nothing outside this file needs it.
   * @param {Blob|ArrayBuffer|ArrayBufferView|string|null} data
   * @returns {number|null} bytes, or null if the shape is unrecognised
   */
  function scormExportPayloadBytes(data) {
    if (!data) return null;
    if (typeof Blob !== "undefined" && data instanceof Blob) return data.size;
    if (typeof data === "string") return new TextEncoder().encode(data).length;
    if (data.byteLength != null) return data.byteLength;
    return null;
  }

  /**
   * Advisory projected size of the embedded images, in bytes.
   *
   * **Why this reads the registry and not `resolverStats.bytes`.** The plan
   * specifies summing `resolverStats.bytes[].blobBytes`, but that array is filled
   * by `imageResolver`, which the LIBRARY calls during `exportDocument` — i.e.
   * after this build has already returned. Measured: `resolverStats.bytes.length`
   * is 0 at the moment `_buildScormExportContent` resolves, so a pre-export
   * advisory built from it would read "0 B" on the first export and show the
   * PREVIOUS export's figure on every one after that. The distinct registry
   * entries behind the index carry the same `blob.size` values the resolver would
   * later record, and they are available now.
   *
   * Advisory only (D9) — it never blocks an export.
   *
   * @param {Map<string, object>} index - from _buildScormImageIndex
   * @returns {{bytes: number, images: number}}
   * @private
   */
  proto._estimateScormExportImageBytes = function (index) {
    const seen = new Set();
    let bytes = 0;
    for (const entry of index.values()) {
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      if (entry.blob instanceof Blob) bytes += entry.blob.size;
    }
    return { bytes: Math.round(bytes * BASE64_EXPANSION), images: seen.size };
  };

  // ========================================================================
  // Browser-only Convert formats (Phase 4b)
  // ========================================================================

  /**
   * Is this Convert checkbox value one of the browser-only export targets?
   * Used by `handleConvert` to partition the selection, and by `getFormatInfo`
   * to resolve a label/extension without touching the API whitelist.
   *
   * @param {string} format
   * @returns {boolean}
   */
  proto._isBrowserOnlyFormat = function (format) {
    return Object.prototype.hasOwnProperty.call(BROWSER_FORMATS, format);
  };

  /**
   * Label/extension/MIME/target record for a browser-only format, or null.
   * Returns the frozen record itself — callers must not mutate it.
   *
   * @param {string} format
   * @returns {{label:string, extension:string, mimeType:string, target:string, binary:boolean}|null}
   */
  proto._getBrowserFormatInfo = function (format) {
    return BROWSER_FORMATS[format] || null;
  };

  /**
   * Normalise an `exportContent` payload to a Blob for `conversionResults`.
   *
   * The payload SHAPE varies by target and is measured rather than assumed: the
   * zip targets hand back a Blob, standalone HTML hands back a string. A Blob
   * built from a JS string is UTF-8, so the charset is declared explicitly —
   * these documents routinely carry µ, ε and ₀, and a consumer that assumes
   * latin-1 would mangle them.
   *
   * @param {object} result - the `exportContent` return value
   * @param {string} format - browser-only format key
   * @returns {Blob}
   * @private
   */
  proto._toBrowserFormatBlob = function (result, format) {
    const info = BROWSER_FORMATS[format] || {};
    const data = result && result.data;

    if (typeof Blob !== "undefined" && data instanceof Blob) return data;
    if (typeof data === "string") {
      const mime = result.mediaType || info.mimeType || "text/html";
      return new Blob([data], { type: `${mime};charset=utf-8` });
    }
    if (data && data.byteLength != null) {
      return new Blob([data], { type: result.mediaType || info.mimeType });
    }
    throw new Error("The export produced no downloadable data.");
  };

  /**
   * Build the browser-only export formats and hand each one to the SHARED
   * convert UI — the same progress rows and the same "Ready for Download"
   * buttons the API formats use. No Convert API call is made.
   *
   * **`download: false` is load-bearing, not tidiness.** The library's
   * `download()` performs a programmatic `<a>` click. After a multi-second
   * assembly the click no longer carries transient user activation, so the
   * browser classes it as an automatic download and silently discards it —
   * measured 27 July 2026 in BOTH Chrome and Firefox, with the status line
   * reporting success and no file reaching disk in either. Suppressing it here
   * leaves `triggerDownload`, reached from the user's click on the rendered
   * download button, as the only save path. That click always carries live
   * activation, so no browser gates it and repeat downloads work.
   *
   * Isolation: one shared build for both targets, then a per-format try/catch,
   * so a SCORM failure still yields the standalone HTML and neither can abort
   * the API formats (which have already run and are in `conversionResults`).
   *
   * @param {string[]} browserFormats - subset of BROWSER_FORMATS keys
   * @param {string[]} errorMessages  - shared sink, rendered once by the caller
   * @returns {Promise<void>} never rejects
   * @private
   */
  proto._runBrowserConvertFormats = async function (browserFormats, errorMessages) {
    const statusEl = document.getElementById(CONVERT_STATUS_ID);
    const setStatus = (msg) => {
      if (statusEl) statusEl.textContent = msg;
    };

    const failAll = (message) => {
      for (const format of browserFormats) {
        this.updateConvertProgressItem(format, "error", message);
        const info = BROWSER_FORMATS[format] || { label: format };
        errorMessages.push(`${info.label}: ${message}`);
      }
    };

    for (const format of browserFormats) {
      this.updateConvertProgressItem(format, "processing");
    }

    // --- one build, shared by both targets ---------------------------------
    // Chemistry already ran once in handleConvert for both branches, so it is
    // skipped here rather than run a second time.
    let content;
    try {
      setStatus("Building your export in this browser…");
      content = await this._buildScormExportContent({
        setStatus,
        skipChemistry: true,
      });
    } catch (err) {
      // The assembly's two caller-facing messages surface here verbatim:
      // "There is no document content to export yet." / "The markdown renderer
      // has not loaded yet."
      const message = (err && err.message) || String(err);
      logError("browser export: build failed", err);
      failAll(message);
      setStatus("");
      return;
    }

    let exportContent;
    try {
      ({ exportContent } = await import(EXPORT_FACADE_URL));
    } catch (err) {
      const message = "The export library could not be loaded.";
      logError("browser export: facade import failed", err);
      failAll(message);
      setStatus("");
      return;
    }

    const build = this._lastScormExportBuild || {};

    // --- per-format, isolated ---------------------------------------------
    for (const format of browserFormats) {
      const info = BROWSER_FORMATS[format];
      try {
        setStatus(`Building the ${info.label.toLowerCase()}…`);
        const result = await exportContent({
          content,
          // The assembly returns rendered HTML, not MMD.
          format: "html",
          target: info.target,
          title: build.metadata && build.metadata.title,
          metadata: build.metadata,
          // Same object reference for every target on purpose: options.imageResolver
          // closes over an export-local memo, so each image is base64-encoded once
          // across both packages rather than once per package.
          options: build.options,
          download: false,
        });

        this.conversionResults.set(format, this._toBrowserFormatBlob(result, format));
        this.updateConvertProgressItem(format, "completed");
        logInfo(`browser export complete: ${format} → ${result && result.filename}`);
      } catch (err) {
        const message = (err && err.message) || String(err);
        logError(`browser export failed for ${format}`, err);
        this.updateConvertProgressItem(format, "error", message);
        errorMessages.push(`${info.label}: ${message}`);
      }
    }

    // Advisory notes, from the registry rather than the library's audit:
    // mathpix-markdown-it emits alt="" itself and the audit correctly reads that
    // as a decorative marker, so undescribed images produce ZERO warnings there.
    const stats = build.stats || {};
    const notes = [];
    const missingAlt = (stats.missingAlt || []).length;
    if (missingAlt) notes.push(`${missingAlt} image(s) have no alt text.`);

    const unembedded =
      (stats.misses || []).length +
      ((build.resolverStats && build.resolverStats.skipped) || []).length;
    if (unembedded) {
      notes.push(`${unembedded} image(s) could not be embedded.`);
      if (typeof this.showNotification === "function") {
        this.showNotification(
          `${unembedded} image(s) could not be embedded in the export.`,
          "warning",
        );
      }
    }

    setStatus(notes.length ? `Export ready. ${notes.join(" ")}` : "");
  };
})();
