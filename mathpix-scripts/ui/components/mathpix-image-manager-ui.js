/**
 * @fileoverview MathPix Image Manager UI — Phase 8H.1
 * @module MathPixImageManagerUI
 * @version 1.0.0
 * @since Phase 8H.1
 *
 * @description
 * Modal-based UI for managing images in restored OCR documents.
 * Allows users to view, replace (swap), add, and delete images
 * via a thumbnail grid. Integrates with MathPixImageRegistry and
 * MathPixSessionRestorer.
 *
 * Architecture:
 * - IIFE with class pattern (matches image-registry, display-layer, ai-enhancer)
 * - Uses UniversalModal.Modal for modal lifecycle
 * - onclick handlers on buttons for simplicity
 * - Icons via data-icon attribute (auto-populated by icon-library.js)
 *
 * @see mathpix-image-registry.js — Registry API
 * @see mathpix-mmd-display-layer.js — Display layer API
 * @see mathpix-session-restorer.js — Integration target
 * @see mathpix-ai-enhancer.js — Modal pattern reference
 */

const MathPixImageManagerUI = (function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ImageManagerUI ERROR]: ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageManagerUI WARN]: ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageManagerUI INFO]: ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageManagerUI DEBUG]: ${message}`, ...args);
  }

  // ============================================================================
  // ESCAPING HELPERS
  // ============================================================================

  /**
   * Escape a value for safe interpolation into an inline
   * onclick="fn('${value}')" attribute. The onclick value is parsed twice:
   * first as an HTML attribute (decoding entities), then as JavaScript
   * (the decoded string is the JS source). So defence has to cover both
   * surfaces:
   *
   *   - HTML attribute breakout: &, ", <, > → HTML entities.
   *   - JS string breakout: \, ', newlines → JS backslash escapes.
   *
   * Image IDs are UUID-style in practice, but defence in depth is the right
   * posture for any attribute interpolation. Note: pass the raw ID here —
   * do NOT pass a value that has already been through _escapeAttr (the HTML
   * entities would be double-escaped).
   *
   * @param {string} value - Raw value to escape.
   * @returns {string} Escape-safe for the onclick double-surface context.
   */
  function escapeForOnclick(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const STATUS_LABELS = {
    "cdn-linked": "OCR original",
    downloaded: "Downloaded",
    "user-replaced": "Replaced",
    "user-added": "Added by user",
    "data-uri": "Embedded",
    missing: "Missing",
  };

  // Stage 4 — image manager metadata cluster and counter configuration.
  // All copy and icon choices are isolated here so wording or icon swaps
  // are a one-line edit.
  const COUNTER_LABEL = "covered";
  const COUNTER_DESCRIPTION =
    "Counts images with alt text or marked decorative.";
  const BADGE_ICONS = {
    caption: "message",
    alt: "missingAlt",
    longDesc: "document",
    decorative: "eyeOff",
  };
  const KEY_DECORATIVE_WORDING =
    "Decorative — alt and long description skipped";

  // ============================================================================
  // STAGE 5 — EDIT VIEW CONSTANTS
  // All wording strings and element IDs for the Edit Alt Text view live here
  // so adjusting copy or selectors is a one-line edit.
  // ============================================================================

  // --- Element IDs (grid view + edit view containers, edit view internals) ---
  const GRID_VIEW_CONTAINER_ID = "mmd-image-manager-grid-view";
  const GRID_REGION_HEADING_ID = "mmd-image-manager-grid-view-heading";
  const EDIT_VIEW_CONTAINER_ID = "mmd-image-manager-edit-view";
  const EDIT_VIEW_HEADING_ID = "edit-alt-view-heading";
  const EDIT_VIEW_SUBTITLE_ID = "edit-alt-view-subtitle";
  const EDIT_VIEW_FORM_ID = "edit-alt-form";
  const EDIT_VIEW_BACK_BTN_ID = "edit-alt-back-btn";
  const EDIT_VIEW_SAVE_BTN_ID = "edit-alt-save-btn";
  const EDIT_VIEW_BANNER_ID = "edit-alt-legacy-banner";
  const EDIT_VIEW_PREVIEW_IMG_ID = "edit-alt-preview-img";
  const EDIT_VIEW_PREVIEW_CAPTION_ID = "edit-alt-preview-caption";

  // Per-field IDs grouped by field key (consumed by Chunks 3 / 4).
  const FIELD_IDS = {
    caption: {
      input: "edit-alt-caption-input",
      help: "edit-alt-caption-help",
      count: "edit-alt-caption-count",
      provenance: "edit-alt-caption-provenance",
      hint: "edit-alt-caption-hint",
      toggletip: "edit-alt-caption-toggletip",
    },
    altText: {
      input: "edit-alt-alttext-input",
      help: "edit-alt-alttext-help",
      count: "edit-alt-alttext-count",
      provenance: "edit-alt-alttext-provenance",
    },
    longDescription: {
      input: "edit-alt-longdesc-input",
      help: "edit-alt-longdesc-help",
      count: "edit-alt-longdesc-count",
      provenance: "edit-alt-longdesc-provenance",
    },
    textInImage: {
      input: "edit-alt-textinimage-input",
      help: "edit-alt-textinimage-help",
      count: "edit-alt-textinimage-count",
      provenance: "edit-alt-textinimage-provenance",
    },
    decorative: {
      input: "edit-alt-decorative-input",
    },
  };

  // --- Provenance labels (registry source state per field) ---
  const EDIT_PROVENANCE_LABELS = {
    user: "Edited by you",
    "ai-generated": "Generated automatically",
    "ai-reviewed": "Generated, then edited by you",
  };
  // Visible text shows only for these three states. "original" and null carry the
  // data-provenance attribute but no label. "ai-generated" is algorithmic
  // generation, not model output; "ai-reviewed" today means generated then edited.

  // Q3 disable hint sits above the Alt + Long Description block and is shared.
  const EDIT_VIEW_DISABLE_HINT_ID = "edit-alt-disable-hint";

  // Stage 10 (H-7): dedicated polite region announcing decorative-toggle
  // transitions. Visually hidden; empty on render; written by
  // _applyDecorativeState; cleared on Edit-view open (F2.2).
  const EDIT_VIEW_DECORATIVE_ANNOUNCE_ID = "image-manager-decorative-announce";

  // --- Focus-management selectors (Chunks 3 / 4) ---
  // Q8b: focus returns to the Alt button of the card the user came from.
  function altButtonSelectorForId(imageId) {
    return `.image-manager-alt-btn[data-image-id="${imageId}"]`;
  }

  // --- Field labels ---
  const FIELD_LABELS = {
    caption: "Caption", // Q1
    altText: "Alt text", // Q7
    longDescription: "Long description", // Q7
    textInImage: "Text in image", // Q7
    decorative: "Mark image as decorative", // Q3
  };

  // --- Field help text ---
  // Q1 (caption), Q7 (alt text "two sentences usually works well"; long
  // description and text in image strings approved Stage 5 Chunk 2 Phase B).
  const FIELD_HELP_TEXT = {
    caption: "Adds a visible caption shown beneath the image.",
    altText: "Two sentences usually works well.",
    longDescription:
      "Use this for diagrams, charts, or images that need a fuller explanation than alt text can carry.",
    textInImage:
      "List any text visible inside the image (labels, captions, signs).",
  };

  // --- Hints (shown conditionally; initially hidden) ---
  // Q2 — appears when the user clears a non-empty caption on an
  // includegraphics-origin image. Visibility logic lives in Chunk 3.
  const INCLUDEGRAPHICS_CLEAR_HINT =
    "This image had a figure wrapper in the source document. Clearing the caption will keep the wrapper in place in the MMD. To remove it entirely, edit the MMD directly.";

  // Q3 — appears above Alt Text + Long Description when decorative is ticked.
  // Visibility logic lives in Chunk 3.
  const DISABLE_HINT =
    "Decorative images don't need alt text or long description.";

  // --- Legacy-conflict banner (Q6a) ---
  const LEGACY_CONFLICT_BANNER_TEXT =
    "Decorative is on, and this image has stored alt text and long description. Those values won't be used while decorative is on. Untick decorative to use them, or save without changes to keep things as they are.";

  // --- Decorative-toggle announcements (Stage 10 H-7 / Flag 1) ---
  // Three state-aware messages written to the dedicated polite region by
  // _applyDecorativeState. The region announces in EVERY transition; it never
  // defers to the static-text banner (which does not reliably announce on
  // un-hide). Wording is PROVISIONAL pending the P9 screen-reader gate.
  const DECORATIVE_ANNOUNCE_ON =
    "Marked decorative; alt text and long description disabled.";
  const DECORATIVE_ANNOUNCE_ON_CONFLICT =
    "Marked decorative; the stored alt text and long description won't be used while decorative is on.";
  const DECORATIVE_ANNOUNCE_OFF =
    "Decorative removed; alt text and long description enabled.";

  // --- Caption toggletip (Q1) ---
  // Single paragraph; covers both wrap (markdown-origin) and unwrap (with
  // the Q2 includegraphics-source asymmetry) so the toggletip carries both
  // directions. Used by Chunk 3's UniversalToggletip.create({ content }) call.
  const CAPTION_TOGGLETIP_CONTENT =
    "Adding a caption wraps the image in a figure environment in the MMD so the caption renders below it. If you clear a caption later, an image that started life without a wrapper unwraps back to a plain image; an image whose original document already had a figure wrapper keeps the wrapper in place with an empty caption.";

  // --- Button labels ---
  const BACK_BUTTON_LABEL = "Back"; // Q8a
  const SAVE_BUTTON_LABEL = "Save"; // Q5d / Q4

  // --- Chunk 4a save flow notifications ---
  // Success + undo + error wording per Q5d / Q5b. Duration per Q4 (12s).
  // The Undo affordance is rendered by notifySuccess's `actions` option
  // (Commit A) — auto-routes into the manager modal's in-modal status
  // area so the button renders where the user can see it.
  const TOAST_SUCCESS_TEXT = "Changes saved.";
  const TOAST_SUCCESS_UNDO_LABEL = "Undo";
  const TOAST_SUCCESS_UNDO_ARIA_LABEL = "Undo saved changes";
  const TOAST_SUCCESS_DURATION_MS = 12000;
  const TOAST_UNDONE_TEXT = "Changes undone.";
  const TOAST_ERROR_TEXT =
    "Couldn't save changes — please try again. Your typed values are still here.";

  // --- Heading and subtitle ---
  // Static prefix in Chunk 2; Chunk 3 overwrites with "Edit alt text for {filename}".
  const EDIT_VIEW_HEADING_PREFIX = "Edit alt text";
  // Grid-region heading (visually-hidden) — focus fallback per Q8e step 3.
  const GRID_REGION_HEADING_TEXT = "Document images";

  // --- Count-element format (Q7) ---
  function formatCharacterCount(n) {
    return `${n} character${n === 1 ? "" : "s"}`;
  }

  // --- Toggletip lifecycle (Chunk 3a) ---
  // UniversalToggletip.create returns a string ID stashed on the instance
  // (this._captionToggletipId) and destroyed on manager close. Position +
  // type are passed into create() per Q1.
  const TOGGLETIP_POSITION = "bottom"; // Q1 — toggletip appears below the trigger
  const TOGGLETIP_TYPE = "info"; // Q1 — informational tone

  // --- Body class for scoped CSS (Phase D Fix 1) ---
  // UniversalModal renders at z-index 107974, and UniversalToggletip appends
  // to <body> with a default z-index of 10001. Toggletips spawned from inside
  // the manager modal therefore sit *behind* the modal in the body's
  // stacking context. We add this class to <body> while the manager is open
  // and use it as a scoping selector in mathpix-image-manager.css so the
  // toggletip override (z-index: 200000 !important) only fires while the
  // manager is on screen — toggletips elsewhere in the app are unaffected.
  // Matches the existing project convention (cf. "resume-focus-mode").
  const BODY_CLASS_MANAGER_OPEN = "mathpix-manager-open";

  // --- Q8e fallback chain selector (Chunk 3a; consumed by Chunks 3b / 4) ---
  // Scoped to the image manager's own modal wrapper so the lookup is
  // unambiguous if another UniversalModal happens to be open at the same
  // time. The wrapper class is applied at UniversalModal construction —
  // see open() below.
  const MODAL_TITLE_SELECTOR =
    ".image-manager-modal-wrapper .universal-modal-heading";

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Format file size in human-readable form
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  function formatFileSize(bytes) {
    if (bytes == null || bytes < 0) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get MIME type label
   * @param {string} mimeType - MIME type string
   * @returns {string} Short label (e.g. "JPEG")
   */
  function getMimeLabel(mimeType) {
    if (!mimeType) return "";
    const map = {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
    };
    return map[mimeType] || mimeType;
  }

  // ============================================================================
  // CLASS: MathPixImageManagerUI
  // ============================================================================

  class MathPixImageManagerUI {
    /**
     * @param {Object} restorer - MathPixSessionRestorer instance
     */
    constructor(restorer) {
      if (!restorer) {
        logError("Constructor requires a MathPixSessionRestorer instance");
        return;
      }

      /** @type {Object} Reference to the session restorer */
      this.restorer = restorer;

      /** @type {UniversalModal.Modal|null} Current modal instance */
      this.currentModal = null;

      /** @type {string|null} Pending action context for file input */
      this._pendingAction = null;

      /** @type {string|null} Image ID for pending swap action */
      this._pendingSwapId = null;

      /** @type {HTMLElement|null} Trigger button for focus return */
      this._triggerButton = null;

      logInfo("MathPixImageManagerUI constructed");
    }

    // ========================================================================
    // MODAL LIFECYCLE
    // ========================================================================

    /**
     * Open the image manager modal.
     * Populates the grid from the registry.
     */
    open() {
      logInfo("Opening image manager modal");

      this._triggerButton = document.getElementById("resume-manage-images-btn");

      const content = this._buildModalContent();

      try {
        this.currentModal = new UniversalModal.Modal({
          title: "Manage Images",
          content: content,
          size: "fullscreen",
          className: "image-manager-modal-wrapper",
          closeOnOverlayClick: true,
          onClose: () => {
            // Chunk 4b — save-on-X is handled by _attachXButtonInterceptor,
            // a capture-phase click listener registered during open(). It
            // fires _performSave BEFORE UniversalModal's bubble-phase
            // listener tears the modal DOM down. onClose runs after
            // teardown, by which point _performSave's _readEditFieldValue
            // calls would read empty strings (Smoke Test 5 regression
            // from the Path-2 onClose fire-and-forget attempt).

            // Tear down toggletip and reset edit-view custody to grid
            // BEFORE returning focus. Reset is defensive — a next-open
            // should land on the grid view regardless of where the user
            // closed from (mode-switcher invariant: deterministic start).
            this._destroyToggletips();
            const editView = document.getElementById(EDIT_VIEW_CONTAINER_ID);
            const gridView = document.getElementById(GRID_VIEW_CONTAINER_ID);
            if (editView) editView.hidden = true;
            if (gridView) gridView.hidden = false;
            this._currentEditImageId = null;
            document.body.classList.remove(BODY_CLASS_MANAGER_OPEN);
            this._returnFocus();
          },
        });

        this.currentModal.open();
        document.body.classList.add(BODY_CLASS_MANAGER_OPEN);

        // After modal opens: reconcile the registry against the current
        // MMD (Stage 6) before rendering the grid. The reconcile is a
        // per-user-open event (Q5 hard rule: never in refresh()). The
        // rAF callback is async so the cleanup loop can await
        // _removeCachedImage; refresh() runs after reconcile completes
        // so the grid renders the reconciled state on first paint.
        requestAnimationFrame(async () => {
          try {
            await this._reconcileOnOpen();
          } catch (err) {
            logError("Stage 6 reconcile-on-open failed:", err);
          }

          this.refresh();
          this._attachFileInputListener();
          this._attachXButtonInterceptor();
          this._setupToggletips();
          this._attachEditViewListeners();

          // Populate data-icon spans inserted by _buildModalContent (key row)
          // and by refresh() above (cluster icons, Alt button pencil).
          // populateIcons() ignores arguments and queries the whole document.
          if (
            window.IconLibrary &&
            typeof window.IconLibrary.populateIcons === "function"
          ) {
            window.IconLibrary.populateIcons();
            logDebug("Populated icons after modal open");
          }
        });

        logDebug("Image manager modal opened");
      } catch (error) {
        logError("Failed to open modal:", error);
      }
    }

    /**
     * Close the image manager modal.
     * Returns focus to the trigger button.
     */
    close() {
      logInfo("Closing image manager modal");

      if (this.currentModal) {
        this.currentModal.close();
        this.currentModal = null;
      }

      this._returnFocus();
    }

    /**
     * Return focus to the trigger button
     * @private
     */
    _returnFocus() {
      if (
        this._triggerButton &&
        typeof this._triggerButton.focus === "function"
      ) {
        this._triggerButton.focus();
        logDebug("Focus returned to manage images button");
      }
      this._triggerButton = null;
    }

    // ========================================================================
    // STAGE 6: RECONCILE-ON-OPEN
    // ========================================================================

    /**
     * Reconcile the image registry against the current MMD before the
     * grid renders. Per Stage 6 planning Q5: fires once per
     * user-initiated open(), unconditionally; never appears in refresh()
     * or any other re-render path.
     *
     * Five-step sequence (Phase 2b URL-form fix):
     *
     *   A. Translate liveMMD blob URLs → CDN URLs using imageBlobUrlMap
     *      (reverse direction). Restored sessions hold blob URLs in the
     *      MMD but CDN URLs in the registry; IDs are hash(url + line),
     *      so passing the live MMD straight through to buildFromMMD
     *      would never match anything and would destroy every entry.
     *   B. registry.buildFromMMD(cdnMMD)
     *      Set-diff against the CDN-form MMD: preserves matched entries,
     *      adds new ones, removes entries whose IDs no longer appear in
     *      the MMD.
     *   C. _cleanupRemovedEntries(setDiff.removed)
     *      Per Q3 four-step ordering: resolve blob URL FIRST, then
     *      imageBlobUrlMap delete, then revoke, then Cache API removal.
     *   D. restorer.syncRegistryReferencesToBlobUrls()
     *      Step B refreshed matched entries' mmdReference to CDN-form;
     *      this restores blob-form so findImage and the rest of the
     *      live-editor pipeline keep working. Existing restorer helper
     *      (introduced for the initial restore flow) is idempotent.
     *   E. integrator.reconcileMMDIntoRegistry(liveMMD, registry, map)
     *      Field-content reverse-sync (Stage 3.B) against the LIVE
     *      (blob-form) MMD — findImage handles the CDN↔blob translation
     *      internally via Discovery 18.
     *
     * Defensive: when no restored session / no registry / empty MMD,
     * returns without throwing.
     *
     * @returns {Promise<void>}
     * @private
     */
    async _reconcileOnOpen() {
      let liveMMD = this.restorer?.restoredSession?.currentMMD ?? "";
      if (!liveMMD) {
        logDebug("_reconcileOnOpen: no current MMD, skipping");
        return;
      }

      const registry = this.restorer?.imageRegistry;
      if (!registry || typeof registry.buildFromMMD !== "function") {
        logWarn("_reconcileOnOpen: no registry available, skipping");
        return;
      }

      const blobMap = this.restorer?.imageBlobUrlMap || null;

      // Phase A: translate liveMMD (blob URLs) → CDN-form so buildFromMMD's
      // ID computation matches the registry's CDN-derived entries.
      // User-added images keep their blob URLs (no entry in blobMap) and
      // pass through unchanged — their registry originalUrl is the blob
      // URL itself, so the IDs match naturally.
      const cdnMMD = this._translateBlobUrlsToCdn(liveMMD, blobMap);

      // Phase B: set-diff (Stage 6 Q2/Q3) against the CDN-form MMD.
      const setDiff = registry.buildFromMMD(cdnMMD);
      logInfo(
        `_reconcileOnOpen: setDiff added=${setDiff.added.length} removed=${setDiff.removed.length}`,
      );

      // Phase C: per-entry external-state cleanup (Q3 four-step pattern).
      await this._cleanupRemovedEntries(setDiff.removed);

      // Phase D: repair matched entries' mmdReference. Phase B refreshed
      // mmdReference to CDN-form on every match; the live editor expects
      // blob-form. The restorer's existing helper iterates entries whose
      // originalUrl is keyed in imageBlobUrlMap and rewrites mmdReference
      // back to the blob form via syncMmdReferenceForRestore (Discovery 23
      // setter). Idempotent — entries already in blob form are a no-op.
      if (
        typeof this.restorer?.syncRegistryReferencesToBlobUrls === "function"
      ) {
        this.restorer.syncRegistryReferencesToBlobUrls();
      }

      // Lane C C-P3: manager-open generation host + pure-prose propagation.
      // Generate chemistry descriptions into the registry, propagate them into the
      // working MMD (alt slots + appendix) via the commit primitive, then refresh
      // liveMMD so the Phase E reconcile below reads the PROPAGATED content, not the
      // pre-propagation snapshot. Without the refresh, reconcile re-reads the
      // <smiles> slot and clobbers the prose, freezing it on the wrong value (F9).
      try {
        const chemWriter = window.MathPixChemistryRegistryWriter;
        if (chemWriter && typeof chemWriter.writeChemistryDescriptions === "function") {
          const pristineMmd =
            this.restorer?.restoredSession?.results?.mmd ||
            this.restorer?.restoredSession?.currentMMD ||
            "";
          const chemistryData =
            window.getMathPixController?.()?.resultRenderer?._chemistryData || [];
          const chemResult = await chemWriter.writeChemistryDescriptions({
            registry,
            pristineMmd,
            workingMmd: cdnMMD, // was liveMMD — CDN-form so alt-slot keys match img.originalUrl on recovered sessions
            chemistryData,
          });
          const chemWrote = Array.isArray(chemResult?.results)
            ? chemResult.results.filter((r) => r.altWritten || r.longWritten || r.textWritten).length
            : 0;
          if (chemWrote > 0) {
            // Propagate registry → working MMD, then re-read the refreshed source.
            this._writeMMDFromRegistry(registry);
            liveMMD = this.restorer?.restoredSession?.currentMMD ?? liveMMD;
          }
          logInfo(
            `Lane C manager-open host: chemistry generated for ${chemResult?.total ?? 0} image(s), ${chemWrote} wrote a field`,
          );
        }
      } catch (chemErr) {
        logError("Lane C manager-open chemistry generation failed", chemErr);
      }

      // Phase E: field-content reverse-sync (Stage 3.B) against the LIVE
      // (blob-form) MMD. findImage threads through blobMap per Discovery 18.
      const integrator = window.MathPixAltTextIntegrator;
      if (
        integrator &&
        typeof integrator.reconcileMMDIntoRegistry === "function"
      ) {
        integrator.reconcileMMDIntoRegistry(liveMMD, registry, blobMap);
      } else {
        logWarn(
          "_reconcileOnOpen: MathPixAltTextIntegrator.reconcileMMDIntoRegistry not available",
        );
      }
    }

    /**
     * Translate blob URLs back to their CDN-URL form using imageBlobUrlMap.
     * The map is CDN→blob; this walks it and substitutes each blobUrl back
     * to its originalUrl in the MMD string. User-added images and any blob
     * URL not present in the map pass through unchanged.
     *
     * Sibling helpers carrying the same regex-escape vocabulary (see F-E in
     * pre-stage-7-discoveries-stage6-post-close-audit.md): session-restorer-images.js
     * proto._translateBlobUrlsToCdnForMMD and proto.getMMDForAPI Step 1. Drift
     * risk on the regex-escape pattern is real but small — fix one, fix all.
     *
     * @param {string} mmd - Live MMD content (may contain blob URLs)
     * @param {Map<string,string>|null} blobMap - imageBlobUrlMap (CDN→blob)
     * @returns {string} MMD with restorer-substituted blob URLs reversed
     * @private
     */
    _translateBlobUrlsToCdn(mmd, blobMap) {
      if (!mmd || !blobMap || blobMap.size === 0) return mmd;

      let result = mmd;
      for (const [cdnUrl, blobUrl] of blobMap) {
        if (!cdnUrl || !blobUrl) continue;
        // Escape regex metacharacters in the blob URL for a literal match.
        const escaped = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "g"), cdnUrl);
      }
      return result;
    }

    /**
     * Per-entry cleanup for entries removed by buildFromMMD's set-diff.
     * Implements Q3's mandatory four-step ordering. Adapted from
     * deleteImage's cleanup block (session-restorer-images.js:1062-1091)
     * minus the user-initiated extras (no undo push, no auto-save, no
     * grid refresh — those belong to interactive delete, not reconcile).
     *
     * Step 1 MUST run before Step 2: the CDN-mapped lookup in Step 1
     * uses imageBlobUrlMap.get(entry.originalUrl), and Step 2 removes
     * that map entry. Flipping the order makes the lookup miss.
     *
     * _removeCachedImage is async; await it so memory-hygiene assertions
     * in runStage6Tests can observe the Cache API state post-cleanup.
     * Individual entry failures are caught and logged (do not abort
     * the whole loop) — matches deleteImage's fire-and-forget posture
     * for the Cache API call itself.
     *
     * @param {Object[]} removedClones - Entry clones from setDiff.removed
     * @returns {Promise<void>}
     * @private
     */
    async _cleanupRemovedEntries(removedClones) {
      if (!Array.isArray(removedClones) || removedClones.length === 0) return;

      const imageBlobUrlMap = this.restorer?.imageBlobUrlMap || null;
      const imageFilenameMap = this.restorer?.imageFilenameMap || {};

      for (const entry of removedClones) {
        try {
          // Step 1: Resolve blobUrl FIRST. Different lookup depending on
          // entry source — user-upload / user-added entries carry the
          // blob URL directly in originalUrl; OCR entries store CDN URLs
          // and need translation via imageBlobUrlMap.
          const isUserAdded =
            entry.source === "user-upload" || entry.status === "user-added";
          const blobUrl = isUserAdded
            ? entry.originalUrl
            : imageBlobUrlMap?.get(entry.originalUrl);

          // Step 2: Remove from imageBlobUrlMap (CDN-mapped entries only).
          // User-upload entries never had a map entry, so skip.
          if (
            !isUserAdded &&
            entry.originalUrl &&
            imageBlobUrlMap &&
            imageBlobUrlMap.has(entry.originalUrl)
          ) {
            imageBlobUrlMap.delete(entry.originalUrl);
          }

          // Step 3: Revoke the blob URL — guard against revoking CDN URLs.
          if (
            blobUrl &&
            typeof blobUrl === "string" &&
            blobUrl.startsWith("blob:")
          ) {
            URL.revokeObjectURL(blobUrl);
          }

          // Step 4: Remove from Cache API. Filename is the secondary
          // key; null is safe if the filename map has no record.
          const filename = imageFilenameMap?.[entry.id]?.filename || null;
          if (typeof this.restorer?._removeCachedImage === "function") {
            await this.restorer._removeCachedImage(entry.id, filename);
          }
        } catch (err) {
          logWarn(
            `_cleanupRemovedEntries: error cleaning up entry ${entry?.id}:`,
            err,
          );
        }
      }

      logInfo(
        `_cleanupRemovedEntries: completed for ${removedClones.length} entries`,
      );
    }

    // ========================================================================
    // CONTENT BUILDING
    // ========================================================================

    /**
     * Build the inner HTML content for the modal body.
     * The toolbar and grid container are static; cards are populated by refresh().
     * @returns {string} HTML string
     * @private
     */
    _buildModalContent() {
      return `
        <section id="${GRID_VIEW_CONTAINER_ID}"
                 class="mmd-image-manager-grid-view"
                 aria-labelledby="${GRID_REGION_HEADING_ID}">
          <h2 id="${GRID_REGION_HEADING_ID}" class="visually-hidden">${GRID_REGION_HEADING_TEXT}</h2>

          <div class="mmd-image-manager-icon-key" role="group" aria-label="Icon key">
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.caption}" aria-hidden="true"></span>Caption
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.alt}" aria-hidden="true"></span>Alt text
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.longDesc}" aria-hidden="true"></span>Long description
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.decorative}" aria-hidden="true"></span><span>${KEY_DECORATIVE_WORDING}</span>
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="warning" aria-hidden="true"></span>Needs attention
            </span>
          </div>

          <div class="image-manager-toolbar">
            <button
              type="button"
              id="image-manager-add-btn"
              class="image-manager-action-btn"
              onclick="addImageToDocument()"
            >
              <span aria-hidden="true" data-icon="plus"></span>
              Add Image
            </button>
            <span id="image-manager-count" class="image-manager-count" aria-live="polite"></span>
            <span class="mmd-image-manager-coverage-counter"
                  id="mmd-image-manager-coverage-counter"
                  aria-live="polite"
                  aria-describedby="mmd-image-manager-coverage-counter-description"></span>
            <span class="visually-hidden"
                  id="mmd-image-manager-coverage-counter-description">${COUNTER_DESCRIPTION}</span>
          </div>

          <ul
            id="image-manager-grid"
            class="image-manager-grid"
            aria-label="Document images"
          >
          </ul>

          <p id="image-manager-empty" class="image-manager-empty" hidden>
            No images in this document.
          </p>

          <input type="file" id="image-manager-file-input" accept="image/jpeg,image/png,image/webp" hidden />
        </section>

        ${this._buildEditAltViewHTML()}
      `;
    }

    /**
     * Build an image card HTML string from a registry entry.
     * @param {Object} entry - Image registry entry
     * @param {number} index - 0-based index
     * @param {number} total - Total image count
     * @returns {string} HTML string
     * @private
     */
    _buildImageCard(entry, index, total) {
      const imgSrc = this._getImageSrc(entry);
      const sizeLabel = formatFileSize(entry.fileSize);
      const mimeLabel = getMimeLabel(entry.mimeType);
      const sizeDisplay = [sizeLabel, mimeLabel].filter(Boolean).join(" · ");
      const statusLabel =
        STATUS_LABELS[entry.status] || entry.status || "Unknown";
      const safeId = this._escapeAttr(entry.id);
      const idAttr = `image-card-label-${safeId}`;

      // Stage 4 — metadata cluster: caption / alt / longDesc state
      const status = MathPixImageRegistry.getMetadataStatus(entry);
      const clusterHTML = this._buildMetadataClusterHTML(status);

      // Build meaningful alt text: prefer user/OCR alt text, fall back to identifiable description
      const altText = entry.altText
        ? `Image ${index + 1} of ${total}: ${entry.altText}`
        : `Image ${index + 1} of ${total} (${safeId}, ${sizeDisplay})`;

      // Look up friendly filename from the ZIP's filenameMap (if available)
      const filenameMap = this.restorer.imageFilenameMap || {};
      const mapEntry = filenameMap[entry.id];
      let friendlyName = mapEntry?.filename || null;

      // If the image was replaced by the user, show the replacement filename
      // instead of the stale ZIP filename (which refers to the original OCR image)
      if (entry.status === "user-replaced" && mapEntry?.replacedWithFilename) {
        friendlyName = mapEntry.replacedWithFilename;
      }

      // Group label for screen readers — used by aria-labelledby on the card
      // and to give context to the Replace/Remove buttons within it
      const displayName = friendlyName || safeId;

      // Stage 4 — per-card Alt button placeholder (Stage 5 wiring point).
      // Built here (not earlier) so displayName is in scope for its aria-label.
      const altButtonHTML = this._buildAltButtonHTML(
        safeId,
        entry.id,
        status,
        displayName,
      );

      const groupLabel = entry.altText
        ? `${entry.altText} — ${sizeDisplay}`
        : `${displayName} — ${sizeDisplay}`;

      return `
        <li class="image-manager-card"
            data-image-id="${safeId}">
          ${clusterHTML}
          <div role="group" aria-labelledby="${idAttr}">
          <div class="image-manager-thumbnail">
${
  imgSrc
    ? `<img src="${this._escapeAttr(imgSrc)}" alt="${this._escapeAttr(altText)}" loading="lazy" data-image-id="${safeId}" onerror="_handleThumbnailError(this)" />`
    : `<span class="image-manager-no-preview">No preview available</span>`
}
          </div>
          <dl class="image-manager-meta">
<dt class="visually-hidden">Image name</dt>
            <dd class="image-manager-id" id="${idAttr}">${this._escapeHTML(friendlyName || entry.id)}</dd>
            <dt class="visually-hidden">File details</dt>
            <dd class="image-manager-size">${this._escapeHTML(sizeDisplay)}</dd>
            <dt class="visually-hidden">Status</dt>
            <dd class="image-manager-status" data-status="${this._escapeAttr(entry.status)}">${this._escapeHTML(statusLabel)}</dd>
          </dl>
          <div class="image-manager-actions">
            <button type="button" class="image-manager-btn image-manager-swap-btn"
                    onclick="swapImage('${escapeForOnclick(entry.id)}')"
aria-label="Replace image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="refresh"></span> Replace
            </button>
            <button type="button" class="image-manager-btn image-manager-delete-btn"
                    onclick="deleteImage('${escapeForOnclick(entry.id)}')"
aria-label="Remove image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="trash"></span> Remove
            </button>
            ${altButtonHTML}
</div>
          </div>
        </li>
      `;
    }

    /**
     * Build the Stage 4 metadata cluster HTML for one card.
     *
     * Cluster wrapper is always emitted (role="group" stays stable per Q1)
     * even when no icons are inside it. Slots use show-vs-don't-show
     * rendering — no reserved positions. Decorative override collapses
     * both alt and long-description slots to the eyeOff icon.
     *
     * @param {{hasCaption: boolean, altState: string, longDescState: string}} status
     * @returns {string} HTML string
     * @private
     */
    _buildMetadataClusterHTML(status) {
      // Decorative === true sets BOTH altState and longDescState to
      // "decorative" together (getMetadataStatus contract). Treat them
      // as a single dimension here so the cluster does not render two
      // identical eyeOff icons, and so the aria-label does not duplicate
      // the "(decorative)" phrase. Matches the icon-key wording at the
      // top of the modal: "Decorative — alt and long description
      // skipped".
      const isDecorative = status.altState === "decorative";

      const captionPart = status.hasCaption ? "Caption set" : "Caption missing";

      let altLongPart;
      if (isDecorative) {
        altLongPart = "alt text and long description skipped (decorative)";
      } else {
        const altPart =
          status.altState === "has-alt" ? "alt text set" : "alt text missing";
        const longDescPart =
          status.longDescState === "has-longdesc"
            ? "long description set"
            : "long description missing";
        altLongPart = `${altPart}, ${longDescPart}`;
      }

      const ariaLabel = `Accessibility metadata: ${captionPart}, ${altLongPart}`;

      const slots = [];

      if (status.hasCaption) {
        slots.push(
          `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.caption}" aria-hidden="true"></span>`,
        );
      }

      if (isDecorative) {
        // Single decorative slot represents both alt and long-description
        // being skipped — the user-facing wording above keeps the audio
        // surface aligned with the visual surface.
        slots.push(
          `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.decorative}" aria-hidden="true"></span>`,
        );
      } else {
        if (status.altState === "has-alt") {
          slots.push(
            `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.alt}" aria-hidden="true"></span>`,
          );
        }
        if (status.longDescState === "has-longdesc") {
          slots.push(
            `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.longDesc}" aria-hidden="true"></span>`,
          );
        }
      }

      return `<div class="mmd-image-manager-metadata-cluster" role="group" aria-label="${this._escapeAttr(ariaLabel)}">${slots.join("")}</div>`;
    }

    /**
     * Build the Stage 4 per-card Alt button placeholder HTML.
     *
     * Stage 5 wiring point: this button will open the alt-text edit sub-view.
     * The Stage 5 implementation will call:
     *   - MathPixAltTextIntegrator.applyRegistryToMMD(mmd, registry) on save
     *   - MathPixAltTextIntegrator.reconcileMMDIntoRegistry(mmd, registry) on open
     * See mathpix-alt-text-integrator.js for the canonical save / open hooks.
     *
     * Variant follows altState: primary (needs attention) when alt missing,
     * secondary (addressed) when alt set or decorative. Visible "Alt" text
     * always present alongside the pencil icon.
     *
     * @param {string} safeId - Image ID escaped for HTML attribute context
     *   (via _escapeAttr). Used for data-image-id and aria-label.
     * @param {string} rawId - Raw image ID. Passed through escapeForOnclick
     *   for the inline onclick handler, which has its own escape requirements
     *   (HTML + JS double-surface) distinct from plain HTML-attribute escaping.
     * @param {{altState: string}} status - Metadata status
     * @returns {string} HTML string
     * @private
     */
    _buildAltButtonHTML(safeId, rawId, status, displayName) {
      const needsAttention = status.altState === "no-alt";
      // Two DOM signals, both gated by `needsAttention` above so they
      // cannot drift apart:
      //   1. --needs-attention modifier on the button: testable contract
      //      Stage 5 Cases 11A/11B/11C bind to (classList.contains).
      //   2. Warning icon appended inside the button (below): the
      //      user-visible cue. Positioned by .image-manager-alt-btn-warning;
      //      populateIcons() inflates the data-icon span after refresh.
      // If either signal is removed in future, update the other and the
      // Stage 5 tests together.
      const variantClass = needsAttention
        ? "image-manager-btn image-manager-alt-btn image-manager-alt-btn--needs-attention"
        : "image-manager-btn image-manager-alt-btn";
      const warningIcon = needsAttention
        ? ' <span aria-hidden="true" data-icon="warning" class="image-manager-alt-btn-warning"></span>'
        : "";
      return `<button type="button" class="${variantClass}"
                    data-action="alt"
                    data-image-id="${safeId}"
                    onclick="openEditAltText('${escapeForOnclick(rawId)}')"
                    aria-label="Edit alt text for image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="pencil"></span> Alt${warningIcon}
            </button>`;
    }

    /**
     * Build the Stage 5 Edit Alt Text view HTML.
     *
     * Pure DOM shell — no event handlers wired here. Chunk 3 attaches
     * handlers to the elements via the IDs in FIELD_IDS and
     * EDIT_VIEW_*_ID constants.
     *
     * The section is initially hidden via the `hidden` attribute. The
     * grid view (its sibling) is the default visible view. Chunk 3
     * toggles between them via openEditAltText() / Back-button closures.
     *
     * Semantic HTML throughout per the Stage 5 planning principle:
     *   <section> wraps the view; <header> contains Back + titles;
     *   <figure> wraps the image preview; <form> wraps the fields;
     *   <label for> ties labels to inputs; <p class="field-help"> for
     *   help; <small class="field-count"> for character counts;
     *   <footer> inside the form holds the Save button (Phase B B5
     *   Option A — natural DOM order matches Q8d tab order);
     *   <div role="status"> is the Q6d exception for the legacy banner.
     *
     * Caption toggletip trigger is a bare button shell. UniversalToggletip
     * is wired imperatively in Chunk 3 — no data-attribute auto-init.
     *
     * @returns {string} HTML string
     * @private
     */
    _buildEditAltViewHTML() {
      return `
        <section id="${EDIT_VIEW_CONTAINER_ID}"
                 class="mmd-image-manager-edit-view"
                 aria-labelledby="${EDIT_VIEW_HEADING_ID}"
                 hidden>
          <header class="mmd-image-manager-edit-view-header">
            <button type="button"
                    id="${EDIT_VIEW_BACK_BTN_ID}"
                    class="image-manager-btn mmd-image-manager-edit-back-btn">
              <span aria-hidden="true" data-icon="arrowLeft"></span> ${BACK_BUTTON_LABEL}
            </button>
            <div class="mmd-image-manager-edit-view-titles">
              <h2 id="${EDIT_VIEW_HEADING_ID}" tabindex="-1">${EDIT_VIEW_HEADING_PREFIX}</h2>
              <p id="${EDIT_VIEW_SUBTITLE_ID}" class="mmd-image-manager-edit-view-subtitle"></p>
            </div>
          </header>

          <div id="${EDIT_VIEW_BANNER_ID}"
               class="mmd-image-manager-edit-banner"
               role="status"
               aria-live="polite"
               hidden>${LEGACY_CONFLICT_BANNER_TEXT}</div>

          <div class="mmd-image-manager-edit-body">
            <figure class="mmd-image-manager-edit-preview">
              <img id="${EDIT_VIEW_PREVIEW_IMG_ID}" src="" alt="" />
              <figcaption id="${EDIT_VIEW_PREVIEW_CAPTION_ID}"></figcaption>
            </figure>

            <form id="${EDIT_VIEW_FORM_ID}" class="mmd-image-manager-edit-form">

              <div class="field-group">
                <div class="field-label-row">
                  <label for="${FIELD_IDS.caption.input}">${FIELD_LABELS.caption}</label>
                  <button type="button"
                          id="${FIELD_IDS.caption.toggletip}"
                          aria-label="More about captions">
                    ${getIcon("infoCircle")}
                  </button>
                </div>
                <!--
                  Caption input's aria-describedby intentionally omits
                  FIELD_IDS.caption.hint. NVDA reads aria-describedby
                  references into hidden elements (HTML5 spec says hidden
                  should remove from accessibility tree, but AT support
                  varies). Chunk 3 toggles BOTH the hint paragraph's
                  hidden attribute AND the input's aria-describedby
                  list — adds the hint ID when showing, removes when
                  hiding.
                -->
                <input type="text"
                       id="${FIELD_IDS.caption.input}"
                       aria-describedby="${FIELD_IDS.caption.help} ${FIELD_IDS.caption.count} ${FIELD_IDS.caption.provenance}" />
                <p id="${FIELD_IDS.caption.help}" class="field-help">${FIELD_HELP_TEXT.caption}</p>
                <small id="${FIELD_IDS.caption.count}" class="field-count">${formatCharacterCount(0)}</small>
                <small id="${FIELD_IDS.caption.provenance}" class="field-provenance" data-provenance=""></small>
                <p id="${FIELD_IDS.caption.hint}" class="field-hint" hidden>${INCLUDEGRAPHICS_CLEAR_HINT}</p>
              </div>

              <p id="${EDIT_VIEW_DISABLE_HINT_ID}" class="field-hint field-hint--disable" hidden>${DISABLE_HINT}</p>

              <div id="${EDIT_VIEW_DECORATIVE_ANNOUNCE_ID}"
                   class="visually-hidden"
                   role="status"
                   aria-live="polite"></div>

              <div class="field-group">
                <label for="${FIELD_IDS.altText.input}">${FIELD_LABELS.altText}</label>
                <textarea id="${FIELD_IDS.altText.input}"
                          rows="3"
                          aria-describedby="${FIELD_IDS.altText.help} ${FIELD_IDS.altText.count} ${FIELD_IDS.altText.provenance}"></textarea>
                <p id="${FIELD_IDS.altText.help}" class="field-help">${FIELD_HELP_TEXT.altText}</p>
                <small id="${FIELD_IDS.altText.count}" class="field-count">${formatCharacterCount(0)}</small>
                <small id="${FIELD_IDS.altText.provenance}" class="field-provenance" data-provenance=""></small>
              </div>

              <div class="field-group">
                <label for="${FIELD_IDS.longDescription.input}">${FIELD_LABELS.longDescription}</label>
                <textarea id="${FIELD_IDS.longDescription.input}"
                          rows="5"
                          aria-describedby="${FIELD_IDS.longDescription.help} ${FIELD_IDS.longDescription.count} ${FIELD_IDS.longDescription.provenance}"></textarea>
                <p id="${FIELD_IDS.longDescription.help}" class="field-help">${FIELD_HELP_TEXT.longDescription}</p>
                <small id="${FIELD_IDS.longDescription.count}" class="field-count">${formatCharacterCount(0)}</small>
                <small id="${FIELD_IDS.longDescription.provenance}" class="field-provenance" data-provenance=""></small>
              </div>

              <div class="field-group">
                <label for="${FIELD_IDS.textInImage.input}">${FIELD_LABELS.textInImage}</label>
                <input type="text"
                       id="${FIELD_IDS.textInImage.input}"
                       aria-describedby="${FIELD_IDS.textInImage.help} ${FIELD_IDS.textInImage.count} ${FIELD_IDS.textInImage.provenance}" />
                <p id="${FIELD_IDS.textInImage.help}" class="field-help">${FIELD_HELP_TEXT.textInImage}</p>
                <small id="${FIELD_IDS.textInImage.count}" class="field-count">${formatCharacterCount(0)}</small>
                <small id="${FIELD_IDS.textInImage.provenance}" class="field-provenance" data-provenance=""></small>
              </div>

              <div class="field-group field-group--checkbox">
                <input type="checkbox" id="${FIELD_IDS.decorative.input}" />
                <label for="${FIELD_IDS.decorative.input}">${FIELD_LABELS.decorative}</label>
              </div>

              <footer class="mmd-image-manager-edit-form-footer">
                <button type="button"
                        id="${EDIT_VIEW_SAVE_BTN_ID}"
                        class="image-manager-btn mmd-image-manager-edit-save-btn">
                  ${SAVE_BUTTON_LABEL}
                </button>
              </footer>

            </form>
          </div>
        </section>
      `;
    }

    // ========================================================================
    // STAGE 5 CHUNK 3a — EDIT VIEW LIFECYCLE
    //
    // Opening, closing, focus on open, toggletip wiring. No in-form
    // reactivity yet (Chunk 3b). No save flow yet (Chunk 4).
    // ========================================================================

    /**
     * Open the Edit Alt Text view for the given image. Populates form
     * fields from the registry entry, swaps grid view for edit view,
     * focuses the heading per Q8a.
     *
     * Replaces Stage 4's placeholder altPlaceholderClick handler.
     *
     * Chunk 3a wires opening + initial render only. Reactivity (decorative
     * disable, character count updates, dirty tracking, banner) lands in 3b.
     * Save flow lands in Chunk 4.
     *
     * @param {string} imageId - Registry image ID to edit.
     * @public
     */
    openEditAltText(imageId) {
      logInfo(`openEditAltText(${imageId})`);

      // 1. Fetch registry entry. Warn + return if missing.
      const registry = this.restorer.imageRegistry;
      if (!registry) {
        logWarn("openEditAltText: no registry on restorer");
        return;
      }
      const entry = registry.getImage(imageId);
      if (!entry) {
        logWarn(`openEditAltText: image ID "${imageId}" not found in registry`);
        return;
      }

      // 2. Resolve filename (replacement-aware per Q1 / B1).
      const filenameMap = this.restorer.imageFilenameMap || {};
      const mapEntry = filenameMap[entry.id];
      let friendlyName = mapEntry?.filename || null;
      if (entry.status === "user-replaced" && mapEntry?.replacedWithFilename) {
        friendlyName = mapEntry.replacedWithFilename;
      }
      logDebug(
        `openEditAltText: resolved filename "${friendlyName}" (status=${entry.status})`,
      );

      // 3. Populate form fields from the registry snapshot.
      // The form reads from the snapshot at open time; persistence on Save
      // (Chunk 4) goes through registry update* methods, not by mutating
      // this entry clone.
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      const altTextInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      const textInImageInput = document.getElementById(
        FIELD_IDS.textInImage.input,
      );
      const decorativeInput = document.getElementById(
        FIELD_IDS.decorative.input,
      );

      if (captionInput) captionInput.value = entry.title || "";
      if (altTextInput) altTextInput.value = entry.altText || "";
      if (longDescInput) longDescInput.value = entry.longDescription || "";
      if (textInImageInput) textInImageInput.value = entry.textInImage || "";
      if (decorativeInput) decorativeInput.checked = Boolean(entry.decorative);

      // Surface per-field registry provenance (caption reads titleSource).
      this._applyFieldProvenance(FIELD_IDS.caption.provenance, entry.titleSource);
      this._applyFieldProvenance(FIELD_IDS.altText.provenance, entry.altTextSource);
      this._applyFieldProvenance(
        FIELD_IDS.longDescription.provenance,
        entry.longDescriptionSource,
      );
      this._applyFieldProvenance(
        FIELD_IDS.textInImage.provenance,
        entry.textInImageSource,
      );

      // 4. Populate <img> preview from _getImageSrc(). When null, hide
      // the <figure> so the body collapses cleanly rather than showing a
      // broken image.
      const previewImg = document.getElementById(EDIT_VIEW_PREVIEW_IMG_ID);
      const previewFigure = previewImg?.closest("figure");
      const previewCaption = document.getElementById(
        EDIT_VIEW_PREVIEW_CAPTION_ID,
      );
      const imgSrc = this._getImageSrc(entry);
      if (previewImg && imgSrc) {
        previewImg.src = imgSrc;
        previewImg.alt = entry.altText || friendlyName || "";
        if (previewFigure) previewFigure.hidden = false;
      } else if (previewFigure) {
        previewFigure.hidden = true;
        logDebug("openEditAltText: no preview source; hiding <figure>");
      }
      if (previewCaption) {
        previewCaption.textContent = friendlyName || "";
      }

      // 5. Update heading text + subtitle paragraph. Heading takes the
      // filename suffix when resolved; subtitle mirrors filename or clears.
      const headingEl = document.getElementById(EDIT_VIEW_HEADING_ID);
      if (headingEl) {
        headingEl.textContent = friendlyName
          ? `${EDIT_VIEW_HEADING_PREFIX} for ${friendlyName}`
          : EDIT_VIEW_HEADING_PREFIX;
      }
      const subtitleEl = document.getElementById(EDIT_VIEW_SUBTITLE_ID);
      if (subtitleEl) {
        subtitleEl.textContent = friendlyName || "";
      }

      // 6. Initialise character count <small> elements from current values.
      this._setFieldCount(FIELD_IDS.caption.count, captionInput?.value || "");
      this._setFieldCount(FIELD_IDS.altText.count, altTextInput?.value || "");
      this._setFieldCount(
        FIELD_IDS.longDescription.count,
        longDescInput?.value || "",
      );
      this._setFieldCount(
        FIELD_IDS.textInImage.count,
        textInImageInput?.value || "",
      );

      // 6b. Chunk 3b: initialise reactivity state from the entry snapshot.
      //
      // _valuesAtOpen captures the value-at-open per field for the
      // value-dirty definition (Q3/Q4): a field is dirty iff its current
      // value differs from value-at-open. Type-and-revert clears the flag
      // naturally because the comparison flips back to equal.
      //
      // _dirtyFields is a Set of field keys ("caption", "altText",
      // "longDescription", "textInImage", "decorative") consumed by
      // Chunk 4's save flow. Empty at form open.
      //
      // _captionHadContent + _originalSyntaxForCurrent drive Q2's hint
      // (only relevant when origin === "includegraphics" AND the caption
      // transitions from non-empty to empty).
      this._valuesAtOpen = {
        caption: entry.title || "",
        altText: entry.altText || "",
        longDescription: entry.longDescription || "",
        textInImage: entry.textInImage || "",
        decorative: Boolean(entry.decorative),
      };
      this._dirtyFields = new Set();
      this._captionHadContent = (entry.title || "").length > 0;
      this._originalSyntaxForCurrent = entry.originalSyntax || null;

      // Apply initial decorative-driven state (matches checkbox state,
      // which was set from entry.decorative during population above).
      const isDecorative = Boolean(entry.decorative);
      if (altTextInput) altTextInput.disabled = isDecorative;
      if (longDescInput) longDescInput.disabled = isDecorative;

      const q3Hint = document.getElementById(EDIT_VIEW_DISABLE_HINT_ID);
      if (q3Hint) q3Hint.hidden = !isDecorative;

      // Q2 hint always hidden on open (no transition has happened yet).
      this._setCaptionHintVisible(false);

      // Initial banner visibility (Q6 single expression).
      this._updateBannerVisibility();

      // Stage 10 (F2.2): clear the decorative announce region on open so a
      // repeat same-direction toggle on a *different* image still announces.
      // The open path sets state by direct DOM (above), never via the
      // handler, so the region stays silent on open.
      const decorativeAnnounce = document.getElementById(
        EDIT_VIEW_DECORATIVE_ANNOUNCE_ID,
      );
      if (decorativeAnnounce) decorativeAnnounce.textContent = "";

      logDebug(
        `Chunk 3b: reactivity state initialised — decorative=${isDecorative}, ` +
          `captionHadContent=${this._captionHadContent}, ` +
          `originalSyntax=${this._originalSyntaxForCurrent}`,
      );

      // 7. Toggle grid-view hidden; un-hide edit-view.
      const gridView = document.getElementById(GRID_VIEW_CONTAINER_ID);
      const editView = document.getElementById(EDIT_VIEW_CONTAINER_ID);
      if (gridView) gridView.hidden = true;
      if (editView) editView.hidden = false;

      // 8. Stash the image ID for the back-button focus path, save flow,
      // and dirty tracking (Chunks 3b / 4).
      this._currentEditImageId = imageId;

      // 9. Focus the heading per Q8a.
      this._focusEditHeading();
    }

    /**
     * Close the Edit Alt Text view and return to grid view. No save in
     * Chunk 3a — Back closes unconditionally. Chunk 4 will replace this
     * with a save-then-close flow that respects dirty state.
     *
     * Phase D Fix 3 — wires focus return now (Q8b). The original Q10
     * deferral of "focus management triggered by save/return paths" was
     * about the save flow; the no-save Back path needs focus return now
     * to avoid a WCAG 2.4.3 Focus Order failure (focus would otherwise
     * land on <body> after Back).
     *
     * @private
     */
    _closeEditAltText() {
      logInfo("_closeEditAltText");

      // Close the Caption toggletip if it's still open — the ⓘ trigger is
      // about to be hidden along with the edit view, so leaving the toggletip
      // visible would look orphaned in the grid.
      if (this._captionToggletipId && window.UniversalToggletip?.hide) {
        window.UniversalToggletip.hide(this._captionToggletipId);
      }

      // Stash the ID before we null it — _focusCardAltBtn needs it.
      const closingImageId = this._currentEditImageId;

      const editView = document.getElementById(EDIT_VIEW_CONTAINER_ID);
      const gridView = document.getElementById(GRID_VIEW_CONTAINER_ID);
      if (editView) editView.hidden = true;
      if (gridView) gridView.hidden = false;

      // Q8b focus return — focus the Alt button of the originating card.
      // Q8e fallback chain if the card is no longer in the grid (rare).
      const focused = this._focusCardAltBtn(closingImageId);
      if (!focused) {
        this._focusGridFallback();
      }

      // Clear stashed imageId — Chunk 4 will respect this when deciding
      // save scope.
      this._currentEditImageId = null;

      // Chunk 3b: reset reactivity state so a re-open starts clean.
      this._valuesAtOpen = null;
      this._dirtyFields = null;
      this._captionHadContent = false;
      this._originalSyntaxForCurrent = null;

      // Reset transient UI state so a re-open starts from a clean slate.
      this._setCaptionHintVisible(false);
      const q3HintEl = document.getElementById(EDIT_VIEW_DISABLE_HINT_ID);
      if (q3HintEl) q3HintEl.hidden = true;
      const bannerEl = document.getElementById(EDIT_VIEW_BANNER_ID);
      if (bannerEl) bannerEl.hidden = true;

      // Re-enable Alt + Long Description in case decorative had disabled
      // them — keeps the DOM tidy for the next open's population.
      const altOnClose = document.getElementById(FIELD_IDS.altText.input);
      const longDescOnClose = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      if (altOnClose) altOnClose.disabled = false;
      if (longDescOnClose) longDescOnClose.disabled = false;
    }

    /**
     * Set the textContent of a character-count <small> element.
     * @param {string} countElementId
     * @param {string} value
     * @private
     */
    _setFieldCount(countElementId, value) {
      const el = document.getElementById(countElementId);
      if (el) el.textContent = formatCharacterCount(value.length);
    }

    /**
     * Surface the registry provenance state for a field. Writes the
     * data-provenance attribute for every state (null becomes ""), and a
     * visible label only for the three states in EDIT_PROVENANCE_LABELS
     * ("user", "ai-generated", "ai-reviewed"). "original" yields attribute
     * "original" with empty text.
     * @param {string} elementId
     * @param {string|null|undefined} source
     * @private
     */
    _applyFieldProvenance(elementId, source) {
      const el = document.getElementById(elementId);
      if (!el) return;
      const state = source == null ? "" : String(source);
      el.setAttribute("data-provenance", state);
      el.textContent = EDIT_PROVENANCE_LABELS[state] || "";
    }

    // ------------------------------------------------------------------------
    // Focus helpers (Q8). Declared in Chunk 3a; wired into save / Back / X
    // flows by Chunk 4. _focusEditHeading is already triggered by
    // openEditAltText above.
    // ------------------------------------------------------------------------

    /**
     * Focus the edit view's <h2> heading. Q8a — heading announces the new
     * context to screen readers ("Edit alt text for X, heading level 2").
     * The heading has tabindex="-1" so it's programmatically focusable
     * without being in the natural tab order.
     * @private
     */
    _focusEditHeading() {
      logInfo("_focusEditHeading");
      const heading = document.getElementById(EDIT_VIEW_HEADING_ID);
      if (heading && typeof heading.focus === "function") {
        heading.focus();
      } else {
        logWarn(
          "_focusEditHeading: heading element not found or not focusable",
        );
      }
    }

    /**
     * Focus the Alt button on the card matching the given image ID. Q8b
     * focus-return target after Back / Save flow (wired by Chunk 4).
     * @param {string} imageId
     * @returns {boolean} true if focus landed, false if the card is gone.
     * @private
     */
    _focusCardAltBtn(imageId) {
      logInfo(`_focusCardAltBtn(${imageId})`);
      const btn = document.querySelector(altButtonSelectorForId(imageId));
      if (btn && typeof btn.focus === "function") {
        btn.focus();
        return true;
      }
      logDebug(`_focusCardAltBtn: no Alt button matches image ID "${imageId}"`);
      return false;
    }

    /**
     * Card-missing fallback chain per Q8e. Used by Chunk 4 when the card
     * the user came from no longer exists on return (rare — would require
     * registry changes from outside the form).
     *
     * Order:
     *   1. First available Alt button in the grid.
     *   2. Grid region heading.
     *   3. Modal main heading.
     *
     * (Step 1 of the Q8e chain — "alt button matching the image ID" — is
     * covered by _focusCardAltBtn() being tried first by the caller.
     * _focusGridFallback() starts at Q8e step 2.)
     *
     * @returns {boolean} true if focus landed somewhere, false if nothing
     *   focusable was reachable.
     * @private
     */
    _focusGridFallback() {
      logInfo("_focusGridFallback");

      // Q8e step 2: first available Alt button in the grid.
      const firstAltBtn = document.querySelector(".image-manager-alt-btn");
      if (firstAltBtn && typeof firstAltBtn.focus === "function") {
        firstAltBtn.focus();
        return true;
      }

      // Q8e step 3: grid region heading.
      const gridHeading = document.getElementById(GRID_REGION_HEADING_ID);
      if (gridHeading && typeof gridHeading.focus === "function") {
        // Headings aren't focusable by default; setTabindex if missing so
        // the focus call lands. This is one-shot and doesn't pollute tab
        // order because the heading already exists in the layout.
        if (!gridHeading.hasAttribute("tabindex")) {
          gridHeading.setAttribute("tabindex", "-1");
        }
        gridHeading.focus();
        return true;
      }

      // Q8e step 4: modal main heading (UniversalModal's <h1>).
      const modalHeading = document.querySelector(MODAL_TITLE_SELECTOR);
      if (modalHeading && typeof modalHeading.focus === "function") {
        modalHeading.focus();
        return true;
      }

      logWarn("_focusGridFallback: no fallback target found");
      return false;
    }

    /**
     * Focus the original modal trigger. Q8c — when the X closes the
     * manager modal, focus returns to the button that opened it.
     *
     * The trigger is already stashed at open() time by Stage 4 (see
     * _triggerButton), and Stage 4's _returnFocus() implements the actual
     * focus call. This helper delegates to _returnFocus() to document
     * intent at Chunk 4 call sites — there is no separate Q8c focus
     * call to add; this is the symmetry stub.
     *
     * @private
     */
    _focusModalTrigger() {
      logInfo("_focusModalTrigger (delegating to _returnFocus)");
      this._returnFocus();
    }

    // ------------------------------------------------------------------------
    // Toggletip lifecycle (Q1). Caption toggletip is created on manager
    // open and destroyed on manager close — see open() and onClose below.
    // ------------------------------------------------------------------------

    /**
     * Create the Caption ⓘ toggletip and stash its ID. Idempotent: a
     * second call destroys any existing instance first so re-opens of the
     * manager don't leak orphan toggletips.
     * @private
     */
    _setupToggletips() {
      logInfo("_setupToggletips");

      if (!window.UniversalToggletip) {
        logError(
          "_setupToggletips: window.UniversalToggletip is not available",
        );
        return;
      }

      // Idempotency: tear down any prior instance before creating a new one.
      if (this._captionToggletipId) {
        this._destroyToggletips();
      }

      const trigger = document.getElementById(FIELD_IDS.caption.toggletip);
      if (!trigger) {
        logWarn("_setupToggletips: caption toggletip trigger not in DOM");
        return;
      }

      this._captionToggletipId = window.UniversalToggletip.create({
        trigger,
        content: CAPTION_TOGGLETIP_CONTENT,
        position: TOGGLETIP_POSITION,
        type: TOGGLETIP_TYPE,
      });

      logDebug(
        `_setupToggletips: caption toggletip created (id=${this._captionToggletipId})`,
      );

      // Re-parent the toggletip element into the dialog so it can render
      // above the modal. The manager modal is a native <dialog> opened with
      // showModal(), which enters the browser's top-layer — body-level
      // z-index cannot beat the top-layer regardless of CSS values.
      // Re-parenting puts the toggletip in the same top-layer stacking
      // context as the dialog. See Phase D round 2 finding.
      const toggletipEl = document.getElementById(this._captionToggletipId);
      // The .image-manager-modal-wrapper className is applied to a container,
      // not the dialog itself. Walk up from the trigger (which is inside the
      // modal's edit view) to find the nearest <dialog> ancestor — that's the
      // manager's dialog regardless of which classes UniversalModal applies.
      const dialog = trigger.closest("dialog");
      if (toggletipEl && dialog) {
        dialog.appendChild(toggletipEl);
        logDebug("_setupToggletips: toggletip moved into dialog top-layer");
      } else {
        if (!toggletipEl) {
          logWarn(
            "_setupToggletips: toggletip element not found in DOM after create()",
          );
        }
        if (!dialog) {
          logWarn(
            "_setupToggletips: could not find dialog ancestor of toggletip trigger",
          );
        }
      }
    }

    /**
     * Destroy the Caption toggletip created by _setupToggletips. Called
     * from UniversalModal's onClose so the toggletip's globally-stored
     * DOM and event listeners don't leak across manager open/close cycles.
     * @private
     */
    _destroyToggletips() {
      if (!this._captionToggletipId) return;

      logInfo(`_destroyToggletips: destroying ${this._captionToggletipId}`);

      if (window.UniversalToggletip?.destroy) {
        window.UniversalToggletip.destroy(this._captionToggletipId);
      }
      this._captionToggletipId = null;
    }

    /**
     * Attach edit-view event listeners. Called from open() after the
     * modal DOM is built. Chunk 3a wires only the Back button. Chunk 3b
     * adds field-input listeners; Chunk 4 wires the Save button.
     * @private
     */
    _attachEditViewListeners() {
      const backBtn = document.getElementById(EDIT_VIEW_BACK_BTN_ID);
      if (backBtn) {
        // Chunk 4b — Back routes through _performSave per Q10. Clean
        // form is a silent close (handled inside _performSave); dirty
        // form saves through to the MMD with an in-modal Undo toast.
        backBtn.addEventListener("click", () => this._performSave());
        logDebug("_attachEditViewListeners: Back button wired");
      } else {
        logWarn("_attachEditViewListeners: Back button not in DOM");
      }

      // Chunk 4a — Save button. Fires _performSave (Q5c six-step
      // sequence). No disabled-during-save state in 4a per the
      // discovery (B6) and Phase B sign-off — add a _savingInFlight
      // guard only if smoke testing surfaces re-entrancy.
      const saveBtn = document.getElementById(EDIT_VIEW_SAVE_BTN_ID);
      if (saveBtn) {
        saveBtn.addEventListener("click", () => this._performSave());
        logDebug("_attachEditViewListeners: Save button wired");
      } else {
        logWarn("_attachEditViewListeners: Save button not in DOM");
      }

      // Phase D round 3 — Escape cascade inside the manager:
      //   1. grid view shown (edit view hidden) → let UA close the dialog
      //   2. edit view shown + toggletip open   → close toggletip only
      //   3. edit view shown + no toggletip     → close edit view, return to grid
      //
      // The listener attaches to the <dialog> itself rather than the edit-view
      // section because _setupToggletips() re-parents the toggletip element
      // onto the dialog as a sibling of the edit view. When the toggletip is
      // open and focus is inside the toggletip, keydown bubbles up to the
      // dialog WITHOUT passing through the edit view section. A section-level
      // listener would never fire and the UA's native dialog-Escape would
      // close the manager. A dialog-level listener catches Escape regardless
      // of which descendant has focus.
      //
      // For case 2 + 3 we preventDefault + stopPropagation because the
      // manager modal is a native <dialog>, which has UA-level
      // Escape-to-close behaviour.
      const section = document.getElementById(EDIT_VIEW_CONTAINER_ID);
      const dialog = section ? section.closest("dialog") : null;
      if (dialog && section) {
        dialog.addEventListener("keydown", (e) => {
          if (e.key !== "Escape") return;
          if (section.hidden) return; // edit view not visible; let modal handle Escape

          e.preventDefault();
          e.stopPropagation();

          if (window.UniversalToggletip?.isActive?.()) {
            // Toggletip is open — close it via the tracked ID. The library
            // doesn't expose closeAll() despite the README mentioning it;
            // hide(id) is the documented per-toggletip close path.
            if (this._captionToggletipId && window.UniversalToggletip?.hide) {
              window.UniversalToggletip.hide(this._captionToggletipId);
            }
            logInfo("Escape: closing open toggletip");
            return;
          }

          // Chunk 4b — Escape-in-edit-view routes through _performSave
          // for consistency with Back (same user intent: return to
          // grid). Clean form is a silent close; dirty saves. Ctrl-Z
          // in the MMD editor remains as the deliberate discard
          // affordance (Q4 §197).
          logInfo("Escape: routing to _performSave (Chunk 4b)");
          this._performSave();
        });
        logDebug("_attachEditViewListeners: dialog-level Escape handler wired");
      } else {
        if (!section) {
          logWarn("_attachEditViewListeners: edit view section not in DOM");
        }
        if (section && !dialog) {
          logWarn(
            "_attachEditViewListeners: edit view section has no dialog ancestor",
          );
        }
      }

      // Chunk 3b: form-state reactivity (decorative toggle, character
      // counts, dirty tracking, banner, Q2 hint).
      this._attachFormReactivityListeners();
    }

    /**
     * Attach a capture-phase click listener to the manager modal's X
     * close button so we can intercept dirty-edit-view closes BEFORE
     * UniversalModal's bubble-phase listener fires modalManager.close
     * and tears down the modal DOM.
     *
     * _performSave's write path is synchronous (Phase B audit) but it
     * reads field values from the DOM at line 1867-1870. At click time
     * the DOM is still alive, so reads succeed; by the time onClose
     * fires (after teardown), it's gone — which is why Path 2 was
     * abandoned post-Smoke-Test-5.
     *
     * When _performSave finishes, _dirtyFields is null and the edit
     * view is hidden (step 5 — _closeEditAltText). The bubble-phase
     * listener then tears the modal down normally.
     *
     * Called from open() after the modal is rendered.
     *
     * @private
     */
    _attachXButtonInterceptor() {
      const modalEl = this.currentModal?.modal;
      const closeBtn =
        modalEl?.querySelector(".universal-modal-close") ||
        document.querySelector(".universal-modal-close");

      if (!closeBtn) {
        logWarn(
          "_attachXButtonInterceptor: X button not found — save-on-X will not fire",
        );
        return;
      }

      closeBtn.addEventListener(
        "click",
        () => {
          if (this._currentEditImageId && this._dirtyFields?.size > 0) {
            logInfo(
              "X button intercepted — saving dirty edit before modal close",
            );
            // forceToast: the bubble-phase X listener will tear down the
            // modal as soon as this handler returns, so the in-modal
            // status host would be destroyed before the user could see
            // the success toast (Discovery 19). Route to global toast
            // instead — it survives the close animation.
            this._performSave({ forceToast: true });
          }
        },
        { capture: true },
      );

      logDebug("X button interceptor attached");
    }

    // ========================================================================
    // STAGE 5 CHUNK 3b — FORM REACTIVITY
    //
    // Decorative-driven disable (Q3), character counts (Q7), value-dirty
    // tracking (Q3/Q4), banner visibility (Q6), and Q2 includegraphics-
    // clear hint with dual-toggle aria-describedby per discovery #8.
    // Save flow lands in Chunk 4.
    // ========================================================================

    /**
     * Attach Chunk 3b reactivity listeners to the edit-view form fields.
     * Called once per modal-open lifecycle (alongside the Back button
     * wiring); the listeners read from current state at fire time, so
     * they survive multiple openEditAltText / _closeEditAltText cycles.
     *
     * @private
     */
    _attachFormReactivityListeners() {
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      const altInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      const textInImageInput = document.getElementById(
        FIELD_IDS.textInImage.input,
      );
      const decorative = document.getElementById(FIELD_IDS.decorative.input);

      if (captionInput) {
        captionInput.addEventListener("input", () =>
          this._handleCaptionInput(),
        );
      } else {
        logWarn("_attachFormReactivityListeners: Caption input not in DOM");
      }
      if (altInput) {
        altInput.addEventListener("input", () => this._handleAltTextInput());
      } else {
        logWarn("_attachFormReactivityListeners: Alt Text input not in DOM");
      }
      if (longDescInput) {
        longDescInput.addEventListener("input", () =>
          this._handleLongDescriptionInput(),
        );
      } else {
        logWarn(
          "_attachFormReactivityListeners: Long Description input not in DOM",
        );
      }
      if (textInImageInput) {
        textInImageInput.addEventListener("input", () =>
          this._handleTextInImageInput(),
        );
      } else {
        logWarn(
          "_attachFormReactivityListeners: Text in Image input not in DOM",
        );
      }
      if (decorative) {
        decorative.addEventListener("change", () =>
          this._handleDecorativeChange(),
        );
      } else {
        logWarn(
          "_attachFormReactivityListeners: Decorative checkbox not in DOM",
        );
      }

      logDebug("_attachFormReactivityListeners: listeners attached");
    }

    /**
     * Update the character-count <small> element for the given field key.
     * Delegates to _setFieldCount so a future formatting or aria-live
     * change to that helper automatically applies to the reactive path
     * as well as Chunk 3a's open-time count population.
     *
     * @param {string} fieldKey - one of "caption", "altText",
     *   "longDescription", "textInImage".
     * @private
     */
    _updateCharacterCount(fieldKey) {
      const ids = FIELD_IDS[fieldKey];
      if (!ids) {
        logWarn(`_updateCharacterCount: unknown field "${fieldKey}"`);
        return;
      }
      const input = document.getElementById(ids.input);
      if (!input) return;
      this._setFieldCount(ids.count, input.value);
    }

    /**
     * Update the dirty flag for the given field per Q3/Q4's value-dirty
     * definition. Type-and-revert clears the flag because the current
     * value once again matches value-at-open.
     *
     * @param {string} fieldKey - one of "caption", "altText",
     *   "longDescription", "textInImage", "decorative".
     * @private
     */
    _updateDirtyFlag(fieldKey) {
      if (!this._valuesAtOpen || !this._dirtyFields) return;
      const ids = FIELD_IDS[fieldKey];
      if (!ids) {
        logWarn(`_updateDirtyFlag: unknown field "${fieldKey}"`);
        return;
      }
      const input = document.getElementById(ids.input);
      if (!input) return;

      const currentValue =
        input.type === "checkbox" ? input.checked : input.value;
      const openValue = this._valuesAtOpen[fieldKey];

      if (currentValue === openValue) {
        this._dirtyFields.delete(fieldKey);
      } else {
        this._dirtyFields.add(fieldKey);
      }
      logDebug(
        `_updateDirtyFlag: ${fieldKey} dirty=${this._dirtyFields.has(fieldKey)} ` +
          `(value=${JSON.stringify(currentValue)} open=${JSON.stringify(openValue)})`,
      );
    }

    /**
     * Q6 banner visibility — single expression re-evaluated on form
     * open, decorative change, alt-text input, and long-description
     * input. Banner shown when decorative is checked AND at least one
     * of altText / longDescription is non-empty.
     *
     * @private
     */
    _updateBannerVisibility() {
      const banner = document.getElementById(EDIT_VIEW_BANNER_ID);
      const decorative = document.getElementById(FIELD_IDS.decorative.input);
      const altText = document.getElementById(FIELD_IDS.altText.input);
      const longDesc = document.getElementById(FIELD_IDS.longDescription.input);
      if (!banner || !decorative || !altText || !longDesc) return;

      const shouldShow =
        decorative.checked && (altText.value !== "" || longDesc.value !== "");
      banner.hidden = !shouldShow;
      logDebug(`_updateBannerVisibility: shouldShow=${shouldShow}`);
    }

    /**
     * Q2 hint visibility with dual-toggle aria-describedby per discovery
     * #8. NVDA reads aria-describedby references into hidden elements,
     * so we toggle BOTH the `hidden` attribute AND the hint ID's
     * membership of the Caption input's aria-describedby list.
     *
     * @param {boolean} show
     * @private
     */
    _setCaptionHintVisible(show) {
      const hint = document.getElementById(FIELD_IDS.caption.hint);
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      if (!hint || !captionInput) return;

      if (show) {
        hint.hidden = false;
        const current = (
          captionInput.getAttribute("aria-describedby") || ""
        ).trim();
        const ids = current ? current.split(/\s+/) : [];
        if (!ids.includes(FIELD_IDS.caption.hint)) {
          ids.push(FIELD_IDS.caption.hint);
          captionInput.setAttribute("aria-describedby", ids.join(" "));
        }
      } else {
        hint.hidden = true;
        const current = (
          captionInput.getAttribute("aria-describedby") || ""
        ).trim();
        const ids = current
          ? current.split(/\s+/).filter((id) => id !== FIELD_IDS.caption.hint)
          : [];
        captionInput.setAttribute("aria-describedby", ids.join(" "));
      }
      logDebug(`_setCaptionHintVisible: show=${show}`);
    }

    /**
     * Caption input handler — character count, dirty flag, and Q2 hint
     * transition logic.
     * @private
     */
    _handleCaptionInput() {
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      if (!captionInput) return;

      this._updateCharacterCount("caption");
      this._updateDirtyFlag("caption");

      const value = captionInput.value;
      if (value.length > 0) {
        // Field has content — hide Q2 hint, remember that content was
        // present (so a future clear can trigger the hint).
        this._setCaptionHintVisible(false);
        this._captionHadContent = true;
      } else if (
        this._captionHadContent &&
        this._originalSyntaxForCurrent === "includegraphics"
      ) {
        // Field just emptied on an includegraphics-origin image — show
        // the hint to surface the figure-wrapper-stays asymmetry.
        this._setCaptionHintVisible(true);
      } else {
        // Empty but no transition condition met — keep hint hidden.
        this._setCaptionHintVisible(false);
      }
    }

    /**
     * Alt Text input handler — character count, dirty flag, banner.
     * @private
     */
    _handleAltTextInput() {
      this._updateCharacterCount("altText");
      this._updateDirtyFlag("altText");
      this._updateBannerVisibility();
    }

    /**
     * Long Description input handler — character count, dirty flag, banner.
     * @private
     */
    _handleLongDescriptionInput() {
      this._updateCharacterCount("longDescription");
      this._updateDirtyFlag("longDescription");
      this._updateBannerVisibility();
    }

    /**
     * Text in Image input handler — character count + dirty flag only.
     * Decorative-agnostic per Q3; not part of the banner expression.
     * @private
     */
    _handleTextInImageInput() {
      this._updateCharacterCount("textInImage");
      this._updateDirtyFlag("textInImage");
    }

    /**
     * Decorative checkbox change handler — Q3 disable + hint + banner +
     * announce + dirty flag. One-way per Q3: typing in content fields does
     * NOT untick decorative, so no reverse listener is needed.
     *
     * Stage 10 (Flag 4): the presentation-only consequences are extracted
     * into _applyDecorativeState so the P6 render harness can drive them via
     * a stub-restorer instance. The dirty flag stays HERE, never in the
     * helper, so the harness never trips it.
     * @private
     */
    _handleDecorativeChange() {
      const decorative = document.getElementById(FIELD_IDS.decorative.input);
      if (!decorative) return;
      const checked = decorative.checked;

      this._applyDecorativeState(checked);
      this._updateDirtyFlag("decorative");

      logDebug(`_handleDecorativeChange: checked=${checked}`);
    }

    /**
     * Apply the presentation-only consequences of the decorative state and
     * announce the change. Order is load-bearing: disable Alt + Long
     * Description, toggle the Q3 disable hint, recompute the legacy-conflict
     * banner, THEN write the state-aware message to the dedicated polite
     * region — so banner visibility is computed before the message is chosen.
     *
     * The region announces in EVERY transition and never defers to the
     * static-text banner (Flag 1 / F2.1). Presentation-only — the dirty flag
     * is owned by _handleDecorativeChange, so the P6 harness can call this
     * without dirtying state. The reorder versus the old handler is
     * behaviour-safe: _updateBannerVisibility reads only the checkbox + field
     * values, never the dirty flag (F2.5).
     * @param {boolean} checked
     * @private
     */
    _applyDecorativeState(checked) {
      // Q3: native disabled on Alt Text + Long Description.
      const altInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      if (altInput) altInput.disabled = checked;
      if (longDescInput) longDescInput.disabled = checked;

      // Q3 disable hint visibility (sighted-user feedback; aria-describedby
      // wiring deferred unless usability testing surfaces a need — see
      // Phase B7).
      const q3HintEl = document.getElementById(EDIT_VIEW_DISABLE_HINT_ID);
      if (q3HintEl) q3HintEl.hidden = !checked;

      this._updateBannerVisibility();

      // Stage 10 (Flag 1 / F2.1): announce the transition in the dedicated
      // region. Same conflict expression as _updateBannerVisibility, so the
      // ON-with-conflict message and the banner agree.
      const announce = document.getElementById(
        EDIT_VIEW_DECORATIVE_ANNOUNCE_ID,
      );
      if (announce) {
        const hasExistingContent =
          (altInput && altInput.value !== "") ||
          (longDescInput && longDescInput.value !== "");
        if (!checked) {
          announce.textContent = DECORATIVE_ANNOUNCE_OFF;
        } else if (hasExistingContent) {
          announce.textContent = DECORATIVE_ANNOUNCE_ON_CONFLICT;
        } else {
          announce.textContent = DECORATIVE_ANNOUNCE_ON;
        }
      }
    }

    /**
     * Update the Stage 4 coverage counter from the current registry state.
     *
     * M = entries with non-empty altText OR decorative === true (i.e.
     * getAltCompletionStatus(entry) !== "no-alt").
     * N = registry.getCount().
     *
     * Adds the --complete modifier class when M === N AND N > 0.
     *
     * @private
     */
    _updateCoverageCounter() {
      const counter = document.getElementById(
        "mmd-image-manager-coverage-counter",
      );
      if (!counter) return;

      const registry = this.restorer.imageRegistry;
      if (!registry) {
        counter.textContent = "";
        counter.classList.remove(
          "mmd-image-manager-coverage-counter--complete",
        );
        return;
      }

      const images = registry.getAllImages();
      const total = registry.getCount();
      const covered = images.filter(
        (entry) =>
          MathPixImageRegistry.getAltCompletionStatus(entry) !== "no-alt",
      ).length;

      counter.textContent = `${covered}/${total} ${COUNTER_LABEL}`;

      if (total > 0 && covered === total) {
        counter.classList.add("mmd-image-manager-coverage-counter--complete");
      } else {
        counter.classList.remove(
          "mmd-image-manager-coverage-counter--complete",
        );
      }
    }

    // ========================================================================
    // STAGE 5 CHUNK 4a — SAVE FLOW
    //
    // Q5c six-step sequence on Save click. Dirty-aware registry updates
    // with source = "user" (Q5a) → applyRegistryToMMD → push MMD via
    // loadMMDContent + currentMMD assignment + persistence saveContent
    // (option (b) — Ctrl-Z support per Q4 §197) → counter refresh →
    // edit-view close (focus return is free via _closeEditAltText) →
    // success toast with 12s Undo (Q4).
    //
    // On any error, persistent error toast (Q5b wording), edit view
    // stays open for retry. No registry rollback (Q5b § "no-rollback").
    //
    // Back / X save-decision integration is Chunk 4b.
    // ========================================================================

    /**
     * Read the current DOM value for an edit-view field key.
     *
     * @param {string} fieldKey - One of "caption", "altText",
     *   "longDescription", "textInImage", "decorative".
     * @returns {string|boolean|null} String value for text fields,
     *   boolean for decorative, null if the input element is missing.
     * @private
     */
    _readEditFieldValue(fieldKey) {
      const idMap = FIELD_IDS[fieldKey];
      if (!idMap) return null;
      const el = document.getElementById(idMap.input);
      if (!el) return null;
      if (fieldKey === "decorative") return Boolean(el.checked);
      return el.value || "";
    }

    /**
     * Apply a values-by-field-key bag to the registry. Iterates the
     * supplied dirtyKeys list and dispatches each to the matching
     * registry update* method.
     *
     * Note the asymmetry: updateDecorative takes (id, value) only — it
     * has no source parameter (no provenance tracking for decorative;
     * see mathpix-image-registry.js:883). The other four updates take
     * (id, value, "user") per Q5a.
     *
     * @param {Object} registry - MathPixImageRegistry instance.
     * @param {string} imageId
     * @param {Object} valuesByKey - Same shape as `_valuesAtOpen`.
     * @param {Array<string>} fieldKeys - Subset of valuesByKey keys to apply.
     * @returns {boolean} True if every dispatched update returned true.
     * @private
     */
    _applyValuesToRegistry(registry, imageId, valuesByKey, fieldKeys) {
      let allOk = true;
      // Read the current entry once so each provenance-stamped case can map its
      // existing source through the PF4 / LC-D4 transition (C-P1a helper). If
      // getImage returns null, optional chaining yields undefined, which
      // nextSource resolves to "user" — identical to the pre-C-P1b behaviour.
      const currentEntry = registry.getImage(imageId);
      for (const fieldKey of fieldKeys) {
        const value = valuesByKey[fieldKey];
        let ok = false;
        switch (fieldKey) {
          case "caption":
            ok = registry.updateTitle(
              imageId,
              value,
              window.MathPixAltTextProvenance.nextSource(
                currentEntry?.titleSource,
              ),
            );
            break;
          case "altText":
            ok = registry.updateAltText(
              imageId,
              value,
              window.MathPixAltTextProvenance.nextSource(
                currentEntry?.altTextSource,
              ),
            );
            break;
          case "longDescription":
            ok = registry.updateLongDescription(
              imageId,
              value,
              window.MathPixAltTextProvenance.nextSource(
                currentEntry?.longDescriptionSource,
              ),
            );
            break;
          case "textInImage":
            ok = registry.updateTextInImage(
              imageId,
              value,
              window.MathPixAltTextProvenance.nextSource(
                currentEntry?.textInImageSource,
              ),
            );
            break;
          case "decorative":
            ok = registry.updateDecorative(imageId, value);
            break;
          default:
            logWarn(
              `_applyValuesToRegistry: unknown fieldKey "${fieldKey}" — skipped`,
            );
            ok = true;
        }
        if (!ok) allOk = false;
      }
      return allOk;
    }

    /**
     * Regenerate the MMD from the current registry state and push it to
     * the editor + the persistence undo stack.
     *
     * Three sinks per the Phase B discovery + your Option (b) decision:
     *   1. loadMMDContent — updates the textarea, preview, display layer.
     *   2. restoredSession.currentMMD — source-of-truth assignment.
     *   3. MathPixMMDPersistence.saveContent — pushes previous content to
     *      the editor's undo stack so Ctrl-Z in the textarea reverts the
     *      save (Q4 §197 "Ctrl-Z is the power-user fallback").
     *
     * applyRegistryToMMD is synchronous (Phase B2) — no await needed.
     *
     * @param {Object} registry - MathPixImageRegistry instance.
     * @returns {{ mmd: string, captions: Object, altText: Object, appendix: Object }}
     * @throws Re-throws any error from applyRegistryToMMD / loadMMDContent
     *   for the caller's catch path.
     * @private
     */
    _writeMMDFromRegistry(registry) {
      const I = window.MathPixAltTextIntegrator;
      if (!I || typeof I.applyRegistryToMMD !== "function") {
        throw new Error(
          "_writeMMDFromRegistry: MathPixAltTextIntegrator.applyRegistryToMMD unavailable",
        );
      }
      const session = this.restorer?.restoredSession;
      const currentMmd = session?.currentMMD || "";
      const originalMmd = session?.originalMMD || currentMmd;

      // Discovery 18 — pass the session-restorer's CDN→blob URL map so
      // the alt-text serialiser's findImage URL-regex fallback can match
      // images by blob URL on restored sessions (where the MMD has been
      // rewritten to blob URLs but registry entries still hold CDN URLs).
      const imageBlobUrlMap = this.restorer?.imageBlobUrlMap || null;
      const result = I.applyRegistryToMMD(
        currentMmd,
        registry,
        imageBlobUrlMap,
      );
      const newMmd = result?.mmd;
      if (typeof newMmd !== "string") {
        throw new Error(
          "_writeMMDFromRegistry: applyRegistryToMMD returned no MMD string",
        );
      }

      if (typeof this.restorer.loadMMDContent === "function") {
        this.restorer.loadMMDContent(newMmd, originalMmd);
      }

      // Persist to the resume-session store so an Image Manager alt edit survives a
      // refresh-then-reload-ZIP, recovered by applyRecoveredSession — the same store
      // and code path an MMD-editor edit reaches via scheduleAutoSave. Called before
      // session.currentMMD is reassigned so the resume undo stack captures the
      // pre-edit content, identical to an editor edit. saveContentToStorage is
      // self-sufficient: it derives its own key and normalises blob URLs.
      if (this.restorer && typeof this.restorer.saveContentToStorage === "function") {
        this.restorer.saveContentToStorage(newMmd);
      }
      if (session) session.currentMMD = newMmd;

      const persistence = window.getMathPixMMDPersistence?.();
      if (persistence && typeof persistence.saveContent === "function") {
        persistence.saveContent(newMmd);
      } else {
        logDebug(
          "_writeMMDFromRegistry: persistence module not available; Ctrl-Z in editor will not revert",
        );
      }

      logInfo(
        `_writeMMDFromRegistry: captions=${result.captions?.transformations ?? 0} altText=${result.altText?.transformations ?? 0} appendix=${result.appendix?.transformations ?? 0}`,
      );
      return result;
    }

    /**
     * Q5c six-step save sequence. Reads dirty-field state, snapshots
     * pre-save values for Undo, applies registry updates, regenerates
     * MMD, recalcs the coverage counter, closes the edit view, and
     * shows a success toast with 12-second Undo.
     *
     * On any error in steps 1–3, catches, shows a persistent error
     * toast (Q5b wording), leaves the edit view open. No registry
     * rollback (Q5b § "no-rollback").
     *
     * @param {Object} [options] - Routing options for the success toast.
     * @param {boolean} [options.forceToast=false] - Spread into the success
     *   notifySuccess call so it bypasses the in-modal routing and renders
     *   as a global toast. Used only by the X-close-dirty path (via
     *   _attachXButtonInterceptor), where the in-modal status host would
     *   be destroyed by the modal close animation before the user could
     *   see the toast. Back and Escape paths keep the manager open and
     *   continue to route in-modal. See Discovery 19.
     * @returns {Promise<void>}
     * @private
     */
    async _performSave(options = {}) {
      logInfo("_performSave: invoked");

      const registry = this.restorer?.imageRegistry;
      const imageId = this._currentEditImageId;

      if (!registry || !imageId) {
        logWarn(
          `_performSave: missing registry or imageId (registry=${!!registry}, imageId=${imageId})`,
        );
        return;
      }

      // Q5c step 0 — clean form is a silent close (no toast per Q4
      // §194 "clean form + Back click. No save, no toast").
      if (!this._dirtyFields || this._dirtyFields.size === 0) {
        logDebug("_performSave: no dirty fields — silent close");
        this._closeEditAltText();
        return;
      }

      // Snapshot pre-save values for Undo. Shallow copy of
      // _valuesAtOpen — keys match the fieldKey set the form tracks.
      const snapshot = { ...this._valuesAtOpen };
      const dirtyKeys = [...this._dirtyFields];

      // Build the post-save values bag the same way: read each dirty
      // field's current DOM value.
      const newValues = {};
      for (const fieldKey of dirtyKeys) {
        newValues[fieldKey] = this._readEditFieldValue(fieldKey);
      }

      try {
        // Step 1 — apply registry updates per dirty field.
        this._applyValuesToRegistry(registry, imageId, newValues, dirtyKeys);

        // Steps 2 + 3 — apply registry to MMD, push to editor + undo stack.
        this._writeMMDFromRegistry(registry);

        // Step 4 — re-render the grid from current registry state so
        // every render-time derivation (Alt button --needs-attention
        // modifier, metadata cluster icons, card aria-labels, image alt
        // attribute) reflects the just-saved values. refresh() also
        // calls _updateCoverageCounter(), so this is a strict superset
        // of the prior counter-only update (13(c) / Discovery 20).
        // Lands before _closeEditAltText so the grid is fresh when the
        // edit view hides and reveals it (no flash of stale content).
        // _closeEditAltText's focus return re-queries by data-image-id,
        // which the rebuilt cards preserve, so Q8b focus return is safe.
        this.refresh();

        // Step 5 — navigate to grid view. _closeEditAltText handles
        // focus return to the originating Alt button (Q8b) and clears
        // the form's reactivity state.
        this._closeEditAltText();

        // Step 6 — success notification with Undo action. Auto-routes
        // to the manager modal's in-modal status area (Commit A) when
        // the manager is staying open. The X-close-dirty path passes
        // forceToast: true so the success renders as a global toast
        // instead — the in-modal host is destroyed by the close
        // animation before the user could see it (Discovery 19). The
        // aria-live announcement runs after the focus change has
        // completed (Q5d rationale).
        notifySuccess(TOAST_SUCCESS_TEXT, {
          duration: TOAST_SUCCESS_DURATION_MS,
          actions: [
            {
              label: TOAST_SUCCESS_UNDO_LABEL,
              ariaLabel: TOAST_SUCCESS_UNDO_ARIA_LABEL,
              onClick: () => this._undoSave(imageId, snapshot, dirtyKeys),
            },
          ],
          ...(options.forceToast ? { forceToast: true } : {}),
        });

        logInfo(
          `_performSave: completed — imageId=${imageId}, dirtyKeys=${JSON.stringify(dirtyKeys)}`,
        );
      } catch (err) {
        logError("_performSave: save failed", err);
        // Persistent error notification — Q5b wording verbatim. Edit
        // view stays open so the user can correct or retry. No
        // registry rollback.
        notifyError(TOAST_ERROR_TEXT, {
          duration: 0,
          dismissible: true,
        });
      }
    }

    /**
     * Revert a save by re-applying the pre-save snapshot to the
     * registry and re-running the MMD push pipeline. Source remains
     * "user" on undo (Q5a — every form-driven update is a user
     * decision, including a revert).
     *
     * Called from the success-toast Undo button within the 12s window.
     * Beyond that window the toast has dismissed and this method is
     * unreachable from the UI; Ctrl-Z in the MMD editor remains as
     * a deeper escape hatch (option (b) wiring in _writeMMDFromRegistry).
     *
     * @param {string} imageId
     * @param {Object} snapshot - Pre-save values bag (same shape as
     *   _valuesAtOpen).
     * @param {Array<string>} dirtyKeys - Fields that were modified.
     * @private
     */
    _undoSave(imageId, snapshot, dirtyKeys) {
      logInfo(
        `_undoSave: imageId=${imageId}, dirtyKeys=${JSON.stringify(dirtyKeys)}`,
      );

      const registry = this.restorer?.imageRegistry;
      if (!registry) {
        logWarn("_undoSave: no registry — undo aborted");
        return;
      }

      try {
        this._applyValuesToRegistry(registry, imageId, snapshot, dirtyKeys);
        this._writeMMDFromRegistry(registry);
        // 13(c) — re-render grid after undo so render-time derivations
        // (Alt button modifier, metadata cluster icons, card aria-labels,
        // image alt attribute) match the reverted altText. May re-acquire
        // the --needs-attention modifier if the revert emptied altText.
        // refresh() also calls _updateCoverageCounter() — strict superset.
        this.refresh();
        // Fire-and-forget confirmation — no action affordance, so the
        // 12s success-with-Undo duration would feel over-prominent.
        // 4s is the conventional confirmation-toast window.
        notifySuccess(TOAST_UNDONE_TEXT, { duration: 4000 });
        logInfo("_undoSave: completed");
      } catch (err) {
        logError("_undoSave: undo failed", err);
        // Match the save-error notification wording — the user's
        // options are the same (retry, edit MMD directly). No
        // second-level error ladder.
        notifyError(TOAST_ERROR_TEXT, {
          duration: 0,
          dismissible: true,
        });
      }
    }

    /**
     * Get the best available image source URL for display.
     * Prefers blob URL, then data URI, then original URL.
     * @param {Object} entry - Image registry entry
     * @returns {string|null} URL string or null
     * @private
     */
    _getImageSrc(entry) {
      // For OCR images: check the blob URL map on the restorer
      if (entry.originalUrl && this.restorer.imageBlobUrlMap) {
        const blobUrl = this.restorer.imageBlobUrlMap.get(entry.originalUrl);
        if (blobUrl) return blobUrl;
      }

      // For user-added images: originalUrl IS the blob URL
      if (entry.originalUrl && entry.originalUrl.startsWith("blob:")) {
        return entry.originalUrl;
      }

      // Fallback to data URI
      if (entry.dataUri) return entry.dataUri;

      // Fallback to original URL (CDN — may not load if offline)
      if (entry.originalUrl) return entry.originalUrl;

      return null;
    }

    // ========================================================================
    // GRID POPULATION
    // ========================================================================

    /**
     * Refresh the thumbnail grid from the current registry state.
     */
    refresh() {
      logDebug("Refreshing image manager grid");

      const grid = document.getElementById("image-manager-grid");
      const emptyMsg = document.getElementById("image-manager-empty");
      const countEl = document.getElementById("image-manager-count");

      if (!grid) {
        logWarn("Grid element not found — modal may not be open");
        return;
      }

      const registry = this.restorer.imageRegistry;
      if (!registry) {
        logWarn("No image registry on restorer");
        grid.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        if (countEl) countEl.textContent = "";
        this._updateCoverageCounter();
        return;
      }

      const images = registry.getAllImages();
      const total = images.length;

      if (total === 0) {
        grid.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        if (countEl) countEl.textContent = "0 images";
        this._updateCoverageCounter();
        return;
      }

      if (emptyMsg) emptyMsg.hidden = true;
      if (countEl) {
        countEl.textContent = `${total} image${total !== 1 ? "s" : ""}`;
      }

      const cardsHTML = images
        .map((entry, i) => this._buildImageCard(entry, i, total))
        .join("");

      grid.innerHTML = cardsHTML;

      // Populate data-icon spans inserted by _buildImageCard
      // (cluster slot icons, Alt button pencil icon).
      if (
        window.IconLibrary &&
        typeof window.IconLibrary.populateIcons === "function"
      ) {
        window.IconLibrary.populateIcons();
        logDebug("Populated icons after grid refresh");
      }

      this._updateCoverageCounter();

      logDebug(`Grid refreshed with ${total} image(s)`);
    }

    // ========================================================================
    // FILE INPUT HANDLING
    // ========================================================================

    /**
     * Attach the change listener to the hidden file input.
     * @private
     */
    _attachFileInputListener() {
      const fileInput = document.getElementById("image-manager-file-input");
      if (!fileInput) {
        logWarn("File input not found in modal");
        return;
      }

      // Remove any previous listener by replacing the element
      const clone = fileInput.cloneNode(true);
      fileInput.parentNode.replaceChild(clone, fileInput);

      clone.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be selected again
        clone.value = "";

        try {
          await this._handleFileSelected(file);
        } catch (error) {
          logError("File handling error:", error);
          this._showStatus(`Error: ${error.message}`, "error");
        }
      });

      logDebug("File input listener attached");
    }

    /**
     * Handle a file selected from the file picker.
     * Routes to swap or add based on pending action.
     * @param {File} file - Selected file
     * @private
     */
    async _handleFileSelected(file) {
      // Validate
      const validation = this.validateFile(file);
      if (!validation.valid) {
        this._showStatus(validation.message, "error");
        return;
      }

      // Process file
      this._showStatus("Processing image…", "loading");
      const fileData = await this.processFile(file);

      if (this._pendingAction === "swap" && this._pendingSwapId) {
        await this._executeSwap(this._pendingSwapId, fileData);
      } else if (this._pendingAction === "add") {
        await this._executeAdd(fileData);
      }

      this._pendingAction = null;
      this._pendingSwapId = null;
    }

    // ========================================================================
    // SWAP (REPLACE) FLOW
    // ========================================================================

    /**
     * Initiate the swap flow for a specific image.
     * Opens the file picker; completion handled by file input listener.
     * @param {string} imageId - Registry image ID
     */
    handleSwap(imageId) {
      logInfo(`Swap initiated for image: ${imageId}`);

      const registry = this.restorer.imageRegistry;
      if (!registry || !registry.hasImage(imageId)) {
        this._showStatus("Image not found in registry", "error");
        return;
      }

      this._pendingAction = "swap";
      this._pendingSwapId = imageId;

      const fileInput = document.getElementById("image-manager-file-input");
      if (fileInput) {
        fileInput.click();
      }
    }

    /**
     * Execute the swap after file is processed.
     * @param {string} imageId - Registry image ID
     * @param {Object} fileData - Processed file data
     * @private
     */
    async _executeSwap(imageId, fileData) {
      logInfo(`Executing swap for ${imageId}`);

      try {
        await this.restorer.swapImage(imageId, fileData);

        // Update the filenameMap so the card shows the new file's name
        const filenameMap = this.restorer.imageFilenameMap || {};
        if (filenameMap[imageId] && fileData.originalFilename) {
          filenameMap[imageId].replacedWithFilename = fileData.originalFilename;
        }

        this._showStatus("Image replaced successfully", "success");
        this.refresh();
      } catch (error) {
        logError("Swap failed:", error);
        this._showStatus(`Replace failed: ${error.message}`, "error");
      }
    }

    // ========================================================================
    // ADD FLOW
    // ========================================================================

    /**
     * Initiate the add-image flow.
     * Opens the file picker; completion handled by file input listener.
     */
    handleAdd() {
      logInfo("Add image initiated");

      this._pendingAction = "add";
      this._pendingSwapId = null;

      const fileInput = document.getElementById("image-manager-file-input");
      if (fileInput) {
        fileInput.click();
      }
    }

    /**
     * Execute the add after file is processed.
     * @param {Object} fileData - Processed file data
     * @private
     */
    async _executeAdd(fileData) {
      logInfo("Executing add image");

      try {
        await this.restorer.addImageToDocument(fileData);
        this._showStatus("Image added to document", "success");
        this.refresh();
      } catch (error) {
        logError("Add failed:", error);
        this._showStatus(`Add failed: ${error.message}`, "error");
      }
    }

    // ========================================================================
    // DELETE FLOW
    // ========================================================================

    /**
     * Initiate the delete flow for a specific image.
     * Shows confirmation dialog, then removes if confirmed.
     * @param {string} imageId - Registry image ID
     */
    async handleDelete(imageId) {
      logInfo(`Delete initiated for image: ${imageId}`);

      const registry = this.restorer.imageRegistry;
      if (!registry || !registry.hasImage(imageId)) {
        this._showStatus("Image not found in registry", "error");
        return;
      }

      // Close the current modal temporarily so safeConfirm is visible
      // (safeConfirm creates its own modal which would conflict)
      const confirmed = await this._confirmDelete();

      if (!confirmed) {
        logDebug("Delete cancelled by user");
        return;
      }

      try {
        await this.restorer.deleteImage(imageId);
        this._showStatus("Image removed from document", "success");
        this.refresh();

        // If no images remain, close the modal after a short delay.
        // Delay is necessary because safeConfirm's modal close uses a 200ms
        // animation timeout — resolve() fires before finishClose() removes it
        // from activeModals. Without this delay, getCurrentModalId() returns
        // the confirm modal's ID instead of ours, so our close() is misdirected.
        if (registry.getCount() === 0) {
          setTimeout(() => this.close(), 300);
        }
      } catch (error) {
        logError("Delete failed:", error);
        this._showStatus(`Remove failed: ${error.message}`, "error");
      }
    }

    /**
     * Show confirmation dialog for delete.
     * @returns {Promise<boolean>} True if confirmed
     * @private
     */
    async _confirmDelete() {
      if (typeof safeConfirm === "function") {
        return await safeConfirm(
          "Remove this image from the document?",
          "Remove Image",
        );
      }
      // Fallback
      return confirm("Remove this image from the document?");
    }

    // ========================================================================
    // FILE VALIDATION & PROCESSING
    // ========================================================================

    /**
     * Validate a file for upload.
     * Checks type (JPEG, PNG, WebP) and size (<10 MB).
     * @param {File} file - File to validate
     * @returns {{ valid: boolean, message: string }}
     */
    validateFile(file) {
      if (!file) {
        return { valid: false, message: "No file selected" };
      }

      if (!SUPPORTED_TYPES.includes(file.type)) {
        return {
          valid: false,
          message: `Unsupported file type: ${file.type || "unknown"}. Use JPEG, PNG, or WebP.`,
        };
      }

      if (file.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          message: `File too large (${formatFileSize(file.size)}). Maximum is 10 MB.`,
        };
      }

      return { valid: true, message: "OK" };
    }

    /**
     * Process a file into the data structure needed for registry operations.
     * Reads as data URI and gets dimensions.
     * @param {File} file - File to process
     * @returns {Promise<Object>} { blob, blobUrl, dataUri, mimeType, fileSize, dimensions }
     */
    async processFile(file) {
      const blob = file;
      const blobUrl = URL.createObjectURL(blob);
      const mimeType = file.type;
      const fileSize = file.size;
      const originalFilename = file.name || null;

      // Read as data URI (base64)
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Get dimensions
      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });

      logDebug("File processed:", {
        originalFilename,
        mimeType,
        fileSize: formatFileSize(fileSize),
        dimensions,
      });

      return {
        blob,
        blobUrl,
        dataUri,
        mimeType,
        fileSize,
        dimensions,
        originalFilename,
      };
    }
    // ========================================================================
    // STATUS MESSAGES
    // ========================================================================

    /**
     * Show a status message in the modal.
     * Uses UniversalModal.showStatus if available, else logs.
     * @param {string} message - Message text
     * @param {string} type - "info" | "success" | "error" | "loading"
     * @private
     */
    _showStatus(message, type) {
      if (typeof UniversalModal !== "undefined" && UniversalModal.showStatus) {
        UniversalModal.showStatus(message, type);

        // Auto-hide success/info after 3 seconds
        if (type === "success" || type === "info") {
          setTimeout(() => {
            if (typeof UniversalModal.hideStatus === "function") {
              UniversalModal.hideStatus();
            }
          }, 3000);
        }
      } else {
        logInfo(`[${type}] ${message}`);
      }
    }

    // ========================================================================
    // UTILITY: ESCAPING
    // ========================================================================

    /**
     * Escape HTML entities
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     * @private
     */
    _escapeHTML(str) {
      if (!str) return "";
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * Escape for use in HTML attributes
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     * @private
     */
    _escapeAttr(str) {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }

  // ============================================================================
  // THUMBNAIL ERROR RECOVERY
  // ============================================================================

  /**
   * Handle thumbnail load failure by falling back to dataUri or CDN URL.
   * Called via inline onerror on <img> elements in the image grid.
   * @param {HTMLImageElement} imgEl - The <img> element that failed to load
   */
  function handleThumbnailError(imgEl) {
    // Prevent infinite error loops
    imgEl.onerror = null;

    const imageId = imgEl.dataset.imageId;
    if (!imageId) {
      logWarn("Thumbnail error: no data-image-id on <img>");
      return;
    }

    // Get or create the singleton instance
    const mgr = getInstance();
    if (!mgr?.restorer?.imageRegistry) {
      logWarn(`Thumbnail error for ${imageId}: no registry available`);
      return;
    }

    const entry = mgr.restorer.imageRegistry.getImage(imageId);
    if (!entry) {
      logWarn(`Thumbnail error for ${imageId}: not found in registry`);
      return;
    }

    // Try dataUri first (works offline, always available for user-added)
    if (entry.dataUri) {
      logInfo(`Thumbnail fallback for ${imageId}: using dataUri`);
      imgEl.src = entry.dataUri;
      return;
    }

    // Try CDN URL (requires network, only for OCR images)
    if (entry.originalUrl && entry.originalUrl.startsWith("http")) {
      logInfo(`Thumbnail fallback for ${imageId}: using CDN URL`);
      imgEl.src = entry.originalUrl;
      return;
    }

    logWarn(
      `Thumbnail fallback exhausted for ${imageId}: no displayable source`,
    );
  }

  // Expose globally for inline onerror handlers
  window._handleThumbnailError = handleThumbnailError;

  // ============================================================================
  // SINGLETON & GLOBAL EXPOSURE
  // ============================================================================

  /** @type {MathPixImageManagerUI|null} Singleton instance */
  let instance = null;

  /**
   * Get or create the singleton instance.
   * @returns {MathPixImageManagerUI|null}
   */
  function getInstance() {
    if (instance) return instance;

    // Try to get the restorer via its getter function
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;

    if (!restorer) {
      logWarn("Cannot create instance: session restorer not available");
      return null;
    }

    instance = new MathPixImageManagerUI(restorer);
    return instance;
  }

  // ============================================================================
  // GLOBAL ONCLICK WRAPPERS
  // ============================================================================

  window.openImageManager = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr.open();
    } else {
      logError("Image manager could not be initialised");
    }
  };

  window.closeImageManager = function () {
    if (instance) {
      instance.close();
    }
  };

  window.swapImage = function (imageId) {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleSwap(imageId);
    }
  };

  window.addImageToDocument = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleAdd();
    }
  };

  window.deleteImage = function (imageId) {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleDelete(imageId);
    }
  };

  // Stage 5 Chunk 3a — global handler for the per-card Alt button.
  // Delegates to the manager instance method. Logs at INFO so the click
  // is visible during testing without flipping the file's log level.
  window.openEditAltText = function (imageId) {
    logInfo(`openEditAltText called for image: ${imageId}`);
    const mgr = getInstance();
    if (mgr) {
      mgr.openEditAltText(imageId);
    }
  };

  // ============================================================================
  // CONSOLE TESTS
  // ============================================================================

  /**
   * Test image manager UI functionality
   * @returns {Object} Test results
   */
  window.testImageManagerUI = function () {
    console.log("=== Image Manager UI Tests ===\n");
    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
      if (condition) {
        console.log(`  ✓ ${name}`);
        passed++;
      } else {
        console.error(`  ✗ ${name}`);
        failed++;
      }
    }

    // Test 1: Class exists
    assert(
      "MathPixImageManagerUI class exists",
      typeof MathPixImageManagerUI === "function",
    );

    // Test 2: Global functions exist
    assert(
      "openImageManager exists",
      typeof window.openImageManager === "function",
    );
    assert(
      "closeImageManager exists",
      typeof window.closeImageManager === "function",
    );
    assert("swapImage exists", typeof window.swapImage === "function");
    assert(
      "addImageToDocument exists",
      typeof window.addImageToDocument === "function",
    );
    assert("deleteImage exists", typeof window.deleteImage === "function");

    // Test 3: getInstance
    const mgr = getInstance();
    const hasRestorer = !!window.mathPixSessionRestorer;
    if (hasRestorer) {
      assert("getInstance returns instance when restorer available", !!mgr);
      assert("Instance has open method", typeof mgr?.open === "function");
      assert("Instance has close method", typeof mgr?.close === "function");
      assert("Instance has refresh method", typeof mgr?.refresh === "function");
      assert(
        "Instance has handleSwap method",
        typeof mgr?.handleSwap === "function",
      );
      assert(
        "Instance has handleAdd method",
        typeof mgr?.handleAdd === "function",
      );
      assert(
        "Instance has handleDelete method",
        typeof mgr?.handleDelete === "function",
      );
      assert(
        "Instance has validateFile method",
        typeof mgr?.validateFile === "function",
      );
      assert(
        "Instance has processFile method",
        typeof mgr?.processFile === "function",
      );
    } else {
      console.log("  ⚠ Skipping instance tests — no restorer available");
    }

    // Test 4: File validation
    if (mgr) {
      const fakeJPEG = new File(["data"], "test.jpg", { type: "image/jpeg" });
      const validResult = mgr.validateFile(fakeJPEG);
      assert("Valid JPEG passes validation", validResult.valid === true);

      const fakePDF = new File(["data"], "test.pdf", {
        type: "application/pdf",
      });
      const invalidResult = mgr.validateFile(fakePDF);
      assert("PDF fails validation", invalidResult.valid === false);

      const noFile = mgr.validateFile(null);
      assert("null file fails validation", noFile.valid === false);
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    return { passed, failed };
  };

  // Return public API
  return {
    MathPixImageManagerUI,
    getInstance,
    // Exposed for Stage 5 tests (Phase D Fix 1): asserts the body class
    // string the manager toggles is the one the scoped CSS rule targets.
    BODY_CLASS_MANAGER_OPEN,
  };
})();

// Export for external access
window.MathPixImageManagerUI = MathPixImageManagerUI;
