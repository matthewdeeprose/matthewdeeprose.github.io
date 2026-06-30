/**
 * @fileoverview MathPix Image Registry — Standalone Image Data Management
 * @module MathPixImageRegistry
 * @requires None — Standalone data module (no DOM, no API, no side effects)
 * @version 1.0.0
 * @since Phase 8D (Conv AF)
 *
 * @description
 * Manages a registry of images detected in MMD content. Tracks each image's
 * source, state, user metadata (alt text), and serialisation status. The
 * registry sits alongside the MMD — the MMD text remains the source of truth
 * for where images appear; the registry tracks what each image is.
 *
 * Core operations:
 * - buildFromMMD(mmd): Parse MMD, detect all image references, create entries
 * - getImage(id) / getAllImages(): Retrieve entries (returns clones)
 * - addImage(data): Add user-supplied image, generate stable ID
 * - removeImage(id): Remove image from registry
 * - replaceImage(id, newData): Replace image data, preserve metadata
 * - updateAltText(id, altText, source): Update alt text with provenance
 * - toJSON() / fromJSON(data): Serialisation for ZIP storage
 * - getStats(): Summary statistics
 *
 * Architecture:
 * - IIFE with class pattern (matches mathpix-ai-semantic-mapper.js)
 * - Zero external dependencies — pure data transformation
 * - Defensive coding: never throws, returns null/false for bad input
 * - Immutable-ish: methods return clones, not internal references
 * - Stable IDs: generated from content hash (URL + line number)
 *
 * @see mathpix-ai-mmd-analyser.js — Detection patterns used by buildFromMMD()
 * @see mathpix-ai-semantic-mapper.js — Architectural pattern reference
 * @see phase-8-bible-v1-3.md — Image Data Model specification
 */

(function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ImageRegistry] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageRegistry] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageRegistry] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageRegistry] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /** Registry version for serialisation compatibility */
  const REGISTRY_VERSION = "1.0";

  /** Valid image status values */
  const VALID_STATUSES = [
    "cdn-linked",
    "data-uri",
    "downloaded",
    "user-replaced",
    "user-added",
    "missing",
  ];

  /** Valid alt text source values */
  const VALID_ALT_TEXT_SOURCES = [
    "original",
    "user",
    "ai-generated",
    "ai-reviewed",
    null,
  ];

  /** Valid long description source values */
  const VALID_LONG_DESC_SOURCES = [
    "original",
    "user",
    "ai-generated",
    "ai-reviewed",
    null,
  ];

  /** Valid title source values */
  const VALID_TITLE_SOURCES = [
    "original",
    "user",
    "ai-generated",
    "ai-reviewed",
    null,
  ];

  /** Valid text-in-image source values */
  const VALID_TEXT_IN_IMAGE_SOURCES = [
    "original",
    "user",
    "ai-generated",
    "ai-reviewed",
    null,
  ];

  /** Valid image source types */
  const VALID_IMAGE_SOURCES = ["mathpix-ocr", "user-upload", "user-paste"];

  /**
   * Single flat localStorage key holding the serialised registry; the
   * registry's reload-survival mirror, counterpart to the context mirror's
   * data key.
   */
  const MIRROR_REGISTRY_KEY = "mathpix-registry-current";

  /**
   * Module-local debounce, deliberately matching the context mirror, not a
   * config key.
   */
  const MIRROR_REGISTRY_DEBOUNCE_MS = 1000;

  /** Regex patterns for CDN detection */
  const CDN_PATTERNS = [
    /cdn\.mathpix\.com/,
    /mathpix-ocr-examples\.s3\.amazonaws\.com/,
  ];

  // ----------------------------------------------------------------------------
  // Image-detection regexes (module-scoped, hoisted out of buildFromMMD per
  // Stage 6 Q3 optional defensive technique — avoids per-call allocation).
  // Both carry the `g` flag, so callers MUST reset `.lastIndex = 0` before
  // each new input string to avoid state bleeding across calls.
  // ----------------------------------------------------------------------------

  /**
   * Markdown image syntax: `![alt](url)`. Alt text may contain `]` (e.g.
   * SMILES `[nH]`); the proper terminator is `](`, not the first `]`. Allow
   * `]` in alt-text only when it isn't followed by `(` so chemistry images on
   * markdown-form lines register instead of silently dropping out.
   */
  const MD_IMG_REGEX = /!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)/g;

  /** LaTeX `\includegraphics[options]{url}` — options bracket is optional. */
  const LATEX_IMG_REGEX = /\\includegraphics\s*(\[[^\]]*\])?\s*\{([^}]+)\}/g;

  /** MIME type inference from file extensions */
  const EXTENSION_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Generate a stable hash from a string. Uses a simple but deterministic
   * algorithm (djb2 variant) that produces consistent results across runs.
   *
   * @param {string} str - Input string to hash
   * @returns {string} Hexadecimal hash string
   */
  function stableHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      // hash * 33 + char code
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  /**
   * Generate a stable image ID from URL and line number.
   * Same MMD parsed twice produces identical IDs.
   *
   * @param {string} url - Image URL or data URI prefix
   * @param {number} lineNumber - Line number in MMD (1-based)
   * @returns {string} Stable ID in format "img-XXXXXXXX"
   */
  function generateStableId(url, lineNumber) {
    // F-N (2026-05-30) note: line-number-in-hash is a known fragility.
    // The Phase B URL-fallback in buildFromMMD compensates by matching
    // candidates whose ID-hash misses to existing entries by originalUrl,
    // preserving the old ID across line shifts. Any new code path that
    // recomputes IDs from scratch via this function (outside buildFromMMD)
    // would reintroduce the F-N cascade — see f-n-investigation-tracker.md
    // and prefer matching by originalUrl when reconciling against existing
    // registry state.
    const hashInput = `${url}::${lineNumber}`;
    return `img-${stableHash(hashInput)}`;
  }

  /**
   * Generate a unique ID for user-added images (not from MMD parsing).
   * Uses timestamp + random component for uniqueness.
   *
   * @returns {string} Unique ID in format "img-usr-XXXXXXXX"
   */
  function generateUserImageId() {
    const input = `user-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    return `img-usr-${stableHash(input)}`;
  }

  /**
   * Deep clone an object, excluding Blob references.
   * Returns a plain JSON-safe copy.
   *
   * @param {Object} obj - Object to clone
   * @param {boolean} [excludeBlobs=false] - Whether to exclude blob field
   * @returns {Object} Cloned object
   */
  function deepClone(obj, excludeBlobs = false) {
    if (obj === null || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => deepClone(item, excludeBlobs));
    }

    const clone = {};
    for (const key of Object.keys(obj)) {
      if (excludeBlobs && key === "blob") {
        clone[key] = null;
        continue;
      }
      // Skip actual Blob instances during cloning
      if (obj[key] instanceof Blob) {
        clone[key] = excludeBlobs ? null : obj[key];
        continue;
      }
      clone[key] = deepClone(obj[key], excludeBlobs);
    }
    return clone;
  }

  /**
   * Check if a URL is a data URI.
   *
   * @param {string} url - URL to check
   * @returns {boolean} True if data URI
   */
  function isDataUri(url) {
    return typeof url === "string" && url.startsWith("data:");
  }

  /**
   * Check if a URL matches a MathPix CDN pattern.
   *
   * @param {string} url - URL to check
   * @returns {boolean} True if MathPix CDN URL
   */
  function isMathPixCDN(url) {
    if (typeof url !== "string") return false;
    return CDN_PATTERNS.some((pattern) => pattern.test(url));
  }

  /**
   * Extract MIME type from a data URI.
   *
   * @param {string} dataUri - Data URI string
   * @returns {string|null} MIME type or null
   */
  function extractMimeFromDataUri(dataUri) {
    if (!isDataUri(dataUri)) return null;
    const match = dataUri.match(/^data:([^;,]+)/);
    return match ? match[1] : null;
  }

  /**
   * Infer MIME type from a URL's file extension.
   *
   * @param {string} url - URL to inspect
   * @returns {string|null} MIME type or null
   */
  function inferMimeFromUrl(url) {
    if (!url || typeof url !== "string") return null;
    // Strip query string and fragment
    const cleanUrl = url.split("?")[0].split("#")[0];
    const dotIndex = cleanUrl.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const ext = cleanUrl.substring(dotIndex).toLowerCase();
    return EXTENSION_MIME_MAP[ext] || null;
  }

  /**
   * Calculate approximate byte size of a base64-encoded data URI.
   *
   * @param {string} dataUri - Data URI string
   * @returns {number|null} Approximate byte size or null
   */
  function calculateBase64Size(dataUri) {
    if (!isDataUri(dataUri)) return null;
    const commaIndex = dataUri.indexOf(",");
    if (commaIndex === -1) return null;
    const base64Part = dataUri.substring(commaIndex + 1);
    // Base64 encodes 3 bytes per 4 characters
    // Account for padding
    const padding = (base64Part.match(/=+$/) || [""])[0].length;
    return Math.floor((base64Part.length * 3) / 4) - padding;
  }

  /**
   * Truncate a data URI for ID generation purposes.
   * We use the first 100 characters to avoid hashing massive strings.
   *
   * @param {string} url - URL which may be a data URI
   * @returns {string} Truncated URL suitable for hashing
   */
  function truncateForHashing(url) {
    if (isDataUri(url) && url.length > 100) {
      return url.substring(0, 100);
    }
    return url;
  }

  // ============================================================================
  // IMAGE ENTRY FACTORY
  // ============================================================================

  /**
   * Create a default image entry with all required fields.
   *
   * @returns {Object} Default image entry
   */
  function createDefaultEntry() {
    return {
      id: null,
      mmdReference: null,

      // Source tracking
      source: "mathpix-ocr",
      originalUrl: null,
      pageNumber: null,
      syntax: "markdown",
      originalSyntax: null,
      lineNumber: null,

      // Image data (populated later — not during buildFromMMD)
      blob: null,
      dataUri: null,
      mimeType: null,
      fileSize: null,
      dimensions: null,

      // User metadata
      altText: "",
      altTextSource: null,
      longDescription: "",
      longDescriptionSource: null,
      title: "",
      titleSource: null,
      decorative: false,
      textInImage: "",
      textInImageSource: null,
      userNotes: "",

      // State tracking
      status: "cdn-linked",
      isModified: false,
      replacedAt: null,
      downloadedAt: null,
    };
  }

  // ============================================================================
  // MAIN CLASS
  // ============================================================================

  /**
   * MathPixImageRegistry — Manages image metadata for MMD documents.
   *
   * Pure data module: no DOM, no API calls, no side effects.
   * Methods return clones to prevent external mutation of internal state.
   */
  class MathPixImageRegistry {
    constructor() {
      /** @private {Map<string, Object>} Internal image store keyed by ID */
      this._images = new Map();

      /** @private {Object} Registry-level metadata */
      this._metadata = {
        documentId: null,
        createdAt: null,
        lastUpdated: null,
        version: REGISTRY_VERSION,
      };

      /** @private {?number} Pending debounced mirror-write handle, null when idle. */
      this._pendingMirrorTimer = null;

      logDebug("MathPixImageRegistry instance created");
    }

    // ========================================================================
    // BUILD FROM MMD
    // ========================================================================

    /**
     * Parse MMD content, detect all image references, and reconcile the
     * registry against them.
     *
     * Build-or-sync contract (Stage 6 Q2/Q3, 2026-05-23):
     *
     * - When called on an empty registry, behaves like a fresh build —
     *   every detected reference is added.
     * - When called on a populated registry, preserves user metadata on
     *   entries whose IDs match newly-detected references, adds entries
     *   for newly-detected references, and removes entries whose IDs are
     *   no longer detected (hard-delete per Q3).
     *
     * For matched entries, exactly three structural fields are refreshed
     * from the candidate: `mmdReference`, `lineNumber`, `syntax`. Every
     * other field is preserved — user metadata (`altText`, `title`,
     * `decorative`, `longDescription`, `textInImage`, all `*Source`
     * provenance markers), state tracking (`status`, `isModified`,
     * `originalSyntax`, `originalUrl`), and image data (`blob`, `dataUri`,
     * `mimeType`, `fileSize`, `dimensions`).
     *
     * The `status` preservation is what allows Discovery 23's restored-
     * entry correction to survive reconcile calls. `originalSyntax`
     * preservation is part of Stage 1's state-machine invariant.
     *
     * Identity reconciliation (F-N, 2026-05-30): a candidate matches an
     * existing entry by exact ID first; failing that, it falls back to
     * matching by `originalUrl` so a line-shifting edit (e.g. writeCaption's
     * figure-wrap, which changes the `url::lineNumber` hash and therefore the
     * ID) is treated as the same entry rather than a remove+add pair. When two
     * or more candidates and two or more existing entries share a URL, the
     * i-th candidate (by ascending lineNumber) matches the i-th existing entry
     * (by ascending lineNumber) — an order-preserving tiebreak.
     *
     * Documented invariant (F-N Phase 1.5): the alt-text serialiser's write
     * paths preserve document order of image references. The buildFromMMD
     * set-diff's URL-fallback tiebreak depends on this invariant; any future
     * write path that reorders images must either update the tiebreak strategy
     * or refactor the identity scheme to not depend on order.
     *
     * Returns a diff describing what changed so the caller can clean up
     * external state (blob URLs, blob-URL maps, Cache API entries). The
     * registry itself performs no external-state cleanup — per its
     * "Zero external dependencies — pure data transformation" principle.
     *
     * @param {string} mmd - Raw MMD content
     * @returns {{added: string[], removed: Object[], matched: number, urlFallback: number}}
     *   Set-diff describing the mutation: `added` lists newly-inserted entry
     *   IDs; `removed` lists clones of entries that were deleted from the
     *   registry. Removed clones match `getImage()`'s shape with the `blob`
     *   field excluded for size. `matched` is the count of entries reconciled
     *   in place (exact-ID matches plus F-N URL-fallback matches); `urlFallback`
     *   is how many of those were recovered by the URL-fallback (0 when no line
     *   shift occurred). On invalid input (null, undefined, non-string) the
     *   defensive empty shape `{added: [], removed: []}` is returned without
     *   throwing.
     */
    buildFromMMD(mmd) {
      // Defensive input handling — never throw on bad input. Empty string
      // proceeds normally; on a populated registry it will remove every
      // existing entry (no candidates detected).
      if (typeof mmd !== "string") {
        logWarn("buildFromMMD() called with invalid input (not a string)");
        return { added: [], removed: [] };
      }

      const startTime = performance.now();
      logInfo("Reconciling image registry from MMD...", { length: mmd.length });

      const lines = mmd.split("\n");

      // ----- Phase 1: Detect candidates with per-candidate try/catch -----
      // Build a temporary map keyed by computed ID. One bad detection
      // (malformed URL, _createEntryFromDetection throw) does not abort
      // the whole reconcile — log and continue.
      const candidates = new Map();
      let malformedCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // Module-scoped regexes carry shared `lastIndex` state — reset
        // before each line.
        MD_IMG_REGEX.lastIndex = 0;
        let match;
        while ((match = MD_IMG_REGEX.exec(line)) !== null) {
          try {
            const entry = this._createEntryFromDetection({
              url: match[2],
              altText: match[1],
              fullMatch: match[0],
              lineNumber: lineNum,
              syntax: "markdown",
            });
            candidates.set(entry.id, entry);
          } catch (err) {
            malformedCount++;
            logWarn(
              `buildFromMMD: skipped malformed markdown image at line ${lineNum}: ${match[0]}`,
              err,
            );
          }
        }

        LATEX_IMG_REGEX.lastIndex = 0;
        let latexMatch;
        while ((latexMatch = LATEX_IMG_REGEX.exec(line)) !== null) {
          try {
            const entry = this._createEntryFromDetection({
              url: latexMatch[2],
              altText: "",
              fullMatch: latexMatch[0],
              lineNumber: lineNum,
              syntax: "includegraphics",
            });
            candidates.set(entry.id, entry);
          } catch (err) {
            malformedCount++;
            logWarn(
              `buildFromMMD: skipped malformed includegraphics at line ${lineNum}: ${latexMatch[0]}`,
              err,
            );
          }
        }
      }

      // ----- Phase 2: Compute the mutation plan without mutating -----
      //
      // Two-pass matching (F-N, 2026-05-30). Pass 1 is the original exact-ID
      // match. Pass 2 is the URL-fallback that recovers entries whose
      // hash-derived ID drifted because a line-changing edit (writeCaption's
      // figure-wrap) shifted their lineNumber — generateStableId hashes
      // `url::lineNumber`, so a pure line shift produces a different ID for an
      // otherwise-identical reference. Without Pass 2 the set-diff reports a
      // false-positive added=N/removed=N pair and the caller's cleanup drains
      // imageBlobUrlMap and revokes the live blob URLs (the F-N cascade). See
      // f-n-investigation-tracker.md and pre-stage-7-prompt-04-f-n-strategy.md.
      const matchedIds = new Set();
      const addedIds = new Set();
      const removedIds = new Set();
      const claimedExistingIds = new Set();
      // URL-fallback pairs: { existingId, candidate }. The OLD existingId is
      // the registry Map key that survives; the candidate's hash-derived id is
      // discarded — only its three structural fields are adopted in Phase 4.
      const urlMatches = [];

      // Candidates MUST be iterated in deterministic ascending-lineNumber
      // order so the order-preserving tiebreak below is reproducible — do NOT
      // rely on Map insertion order (strategy §11.1).
      const orderedCandidates = Array.from(candidates.values()).sort(
        (a, b) => a.lineNumber - b.lineNumber,
      );

      // Pass 1 — exact ID-match. MUST precede the URL-fallback so a candidate
      // whose line did NOT shift locks onto its existing entry before the
      // fallback could claim that entry for a same-URL sibling (strategy §4,
      // simulation finding ii).
      const unmatchedCandidates = [];
      for (const candidate of orderedCandidates) {
        if (this._images.has(candidate.id)) {
          matchedIds.add(candidate.id);
          claimedExistingIds.add(candidate.id);
        } else {
          unmatchedCandidates.push(candidate);
        }
      }

      // Pass 2 — URL-fallback for candidates whose ID-hash missed. Group both
      // the unmatched candidates and the still-unclaimed existing entries by
      // originalUrl; within each URL group, sort by lineNumber ascending and
      // match the i-th candidate to the i-th existing entry (order-preserving
      // tiebreak, strategy §4). The "claimed" Set prevents a second same-URL
      // candidate from re-binding an already-matched existing entry.
      if (unmatchedCandidates.length > 0) {
        const existingByUrl = new Map();
        for (const existing of this._images.values()) {
          if (claimedExistingIds.has(existing.id)) continue;
          const key = existing.originalUrl;
          if (!existingByUrl.has(key)) existingByUrl.set(key, []);
          existingByUrl.get(key).push(existing);
        }
        for (const list of existingByUrl.values()) {
          list.sort((a, b) => a.lineNumber - b.lineNumber);
        }

        // unmatchedCandidates is already in ascending-lineNumber order (it is
        // built from orderedCandidates), so each URL group's candidate list
        // inherits that order.
        const candidatesByUrl = new Map();
        for (const candidate of unmatchedCandidates) {
          const key = candidate.originalUrl;
          if (!candidatesByUrl.has(key)) candidatesByUrl.set(key, []);
          candidatesByUrl.get(key).push(candidate);
        }

        for (const [url, candList] of candidatesByUrl) {
          const existList = existingByUrl.get(url) || [];
          let i = 0;
          for (; i < candList.length && i < existList.length; i++) {
            const existing = existList[i];
            urlMatches.push({ existingId: existing.id, candidate: candList[i] });
            claimedExistingIds.add(existing.id);
          }
          // Surplus candidates (more references to this URL than existing
          // entries claim) are genuinely new → added.
          for (; i < candList.length; i++) {
            addedIds.add(candList[i].id);
          }
        }
      }

      // Existing entries claimed by neither pass are genuinely gone → removed.
      for (const existingId of this._images.keys()) {
        if (!claimedExistingIds.has(existingId)) {
          removedIds.add(existingId);
        }
      }

      // Belt-and-braces invariant assertions (Q3 optional defensive
      // technique). The algorithm structure makes these inconsistencies
      // impossible, but the checks are cheap and would surface any
      // future refactor that breaks the phasing.
      for (const id of addedIds) {
        if (matchedIds.has(id)) {
          logError(
            `buildFromMMD: invariant violation — id ${id} appears in both addedIds and matchedIds`,
          );
        }
      }
      for (const id of removedIds) {
        if (!this._images.has(id)) {
          logError(
            `buildFromMMD: invariant violation — removed id ${id} not in registry`,
          );
        }
      }
      for (const { existingId } of urlMatches) {
        if (!this._images.has(existingId)) {
          logError(
            `buildFromMMD: invariant violation — url-matched id ${existingId} not in registry`,
          );
        }
        if (removedIds.has(existingId)) {
          logError(
            `buildFromMMD: invariant violation — url-matched id ${existingId} also in removedIds`,
          );
        }
      }

      // ----- Phase 3: Snapshot removed entries BEFORE deletion -----
      // Must precede Phase 4. Once the entries are deleted from _images
      // their data is gone, and the caller's cleanup logic depends on
      // `entry.source`, `entry.status`, `entry.originalUrl` (per
      // deleteImage's reference cleanup pattern).
      const removedClones = [];
      for (const id of removedIds) {
        const existing = this._images.get(id);
        if (existing) {
          // Exclude blob from the clone — deleteImage's cleanup pattern
          // never reads entry.blob, and user-added entries can carry
          // multi-megabyte blobs which would bloat the return value.
          removedClones.push(deepClone(existing, true));
        }
      }

      // ----- Phase 4: Apply mutations as a synchronous block -----
      // No await, no setTimeout, no callbacks. JS's cooperative
      // concurrency makes this effectively atomic.
      for (const id of matchedIds) {
        const existing = this._images.get(id);
        const candidate = candidates.get(id);
        if (existing && candidate) {
          // Refresh exactly three structural fields. Preserve everything
          // else (per Q2's preserve-vs-refresh bucketing).
          existing.mmdReference = candidate.mmdReference;
          existing.lineNumber = candidate.lineNumber;
          existing.syntax = candidate.syntax;
        }
      }
      // F-N URL-fallback: refresh the OLD entry's structural fields from the
      // line-shifted candidate. The OLD id (the Map key) is preserved and the
      // candidate's hash-derived id is discarded — same three-field refresh as
      // the exact-ID matched branch above.
      for (const { existingId, candidate } of urlMatches) {
        const existing = this._images.get(existingId);
        if (existing && candidate) {
          existing.mmdReference = candidate.mmdReference;
          existing.lineNumber = candidate.lineNumber;
          existing.syntax = candidate.syntax;
        }
      }
      for (const id of addedIds) {
        this._images.set(id, candidates.get(id));
      }
      for (const id of removedIds) {
        this._images.delete(id);
      }

      // ----- Phase 5: Update metadata and return -----
      const now = new Date().toISOString();
      if (!this._metadata.createdAt) {
        this._metadata.createdAt = now;
      }
      this._metadata.lastUpdated = now;

      const elapsed = (performance.now() - startTime).toFixed(1);
      logInfo(
        `buildFromMMD: added=${addedIds.size} removed=${removedIds.size} matched=${matchedIds.size + urlMatches.length} lines=${lines.length} (${elapsed}ms)`,
        { malformed: malformedCount, urlFallback: urlMatches.length },
      );

      return {
        added: Array.from(addedIds),
        removed: removedClones,
        // Counts (not arrays) — additive observability for the F-N
        // URL-fallback. `matched` is the total reconciled count (exact-ID
        // matches plus URL-fallback matches); `urlFallback` isolates how many
        // of those were recovered by the URL-fallback because their ID-hash
        // drifted. Callers that only read `added`/`removed` are unaffected.
        matched: matchedIds.size + urlMatches.length,
        urlFallback: urlMatches.length,
      };
    }

    /**
     * Create a registry entry from detected image data.
     *
     * @private
     * @param {Object} detection - Detection data
     * @param {string} detection.url - Image URL
     * @param {string} detection.altText - Alt text (may be empty)
     * @param {string} detection.fullMatch - Full regex match string
     * @param {number} detection.lineNumber - Line number (1-based)
     * @param {string} detection.syntax - "markdown" or "includegraphics"
     * @returns {Object} Complete image entry
     */
    _createEntryFromDetection({ url, altText, fullMatch, lineNumber, syntax }) {
      const hashUrl = truncateForHashing(url);
      const id = generateStableId(hashUrl, lineNumber);

      const entry = createDefaultEntry();
      entry.id = id;
      entry.mmdReference = fullMatch;
      entry.originalUrl = url;
      entry.syntax = syntax;
      entry.originalSyntax = syntax;
      entry.lineNumber = lineNumber;
      entry.source = "mathpix-ocr";

      // Alt text
      if (altText && altText.length > 0) {
        entry.altText = altText;
        entry.altTextSource = "original";
      }

      // Determine status and extract metadata based on URL type
      if (isDataUri(url)) {
        entry.status = "data-uri";
        entry.mimeType = extractMimeFromDataUri(url);
        entry.fileSize = calculateBase64Size(url);
        // Do NOT store full base64 in dataUri — MMD already holds it
        entry.dataUri = null;
      } else if (isMathPixCDN(url)) {
        entry.status = "cdn-linked";
        entry.mimeType = inferMimeFromUrl(url);
      } else {
        // External URL
        entry.status = "cdn-linked";
        entry.mimeType = inferMimeFromUrl(url);
      }

      return entry;
    }

    // ========================================================================
    // READ OPERATIONS
    // ========================================================================

    /**
     * Retrieve a single image entry by ID.
     * Returns a deep clone to prevent external mutation.
     *
     * @param {string} id - Image ID
     * @returns {Object|null} Image entry clone, or null if not found
     */
    getImage(id) {
      if (!id || typeof id !== "string") {
        logWarn("getImage() called with invalid ID");
        return null;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`getImage(): ID "${id}" not found`);
        return null;
      }

      return deepClone(entry);
    }

    /**
     * Retrieve all image entries as an array.
     * Returns deep clones to prevent external mutation.
     *
     * @returns {Array<Object>} Array of image entry clones
     */
    getAllImages() {
      const entries = [];
      for (const entry of this._images.values()) {
        entries.push(deepClone(entry));
      }
      return entries;
    }

    /**
     * Get the total number of images in the registry.
     *
     * @returns {number} Image count
     */
    getCount() {
      return this._images.size;
    }

    /**
     * Check whether an image with the given ID exists.
     *
     * @param {string} id - Image ID
     * @returns {boolean} True if image exists
     */
    hasImage(id) {
      return this._images.has(id);
    }

    // ========================================================================
    // WRITE OPERATIONS
    // ========================================================================

    /**
     * Add a new image to the registry (user-supplied).
     * Generates a unique ID and returns the complete entry.
     *
     * @param {Object} data - Image data
     * @param {string} [data.originalUrl] - URL or identifier
     * @param {string} [data.altText] - Alt text
     * @param {string} [data.mimeType] - MIME type
     * @param {Blob} [data.blob] - Image blob
     * @param {number} [data.fileSize] - File size in bytes
     * @param {Object} [data.dimensions] - { width, height }
     * @param {string} [data.userNotes] - User notes
     * @returns {Object|null} Created entry clone, or null on failure
     */
    addImage(data) {
      if (!data || typeof data !== "object") {
        logWarn("addImage() called with invalid data");
        return null;
      }

      const id = generateUserImageId();
      const entry = createDefaultEntry();

      entry.id = id;
      entry.source = "user-upload";
      entry.status = "user-added";
      entry.originalUrl = data.originalUrl || null;
      entry.mmdReference = data.mmdReference || null;
      entry.altText = data.altText || "";
      entry.altTextSource = data.altTextSource !== undefined ? data.altTextSource : (data.altText ? "user" : null);
      entry.mimeType = data.mimeType || null;
      entry.blob = data.blob instanceof Blob ? data.blob : null;
      entry.fileSize = typeof data.fileSize === "number" ? data.fileSize : null;
      entry.dimensions = data.dimensions || null;
      entry.dataUri = data.dataUri || null;
      entry.lineNumber =
        typeof data.lineNumber === "number" ? data.lineNumber : null;
      entry.syntax = data.syntax || "markdown";
      // Stage 1 prep: originalSyntax remembers the image's syntax at creation
      // time. Defaults to whatever `syntax` resolves to so the immutable
      // "where this came from" record is always populated.
      entry.originalSyntax =
        data.originalSyntax !== undefined ? data.originalSyntax : entry.syntax;
      entry.userNotes = data.userNotes || "";

      // Phase 14 (alt-text v1): preserve new metadata fields when supplied.
      if (data.title !== undefined) entry.title = data.title;
      if (data.titleSource !== undefined) entry.titleSource = data.titleSource;
      if (data.decorative !== undefined)
        entry.decorative = Boolean(data.decorative);
      if (data.textInImage !== undefined) entry.textInImage = data.textInImage;
      if (data.textInImageSource !== undefined)
        entry.textInImageSource = data.textInImageSource;
      if (data.longDescription !== undefined)
        entry.longDescription = data.longDescription;
      if (data.longDescriptionSource !== undefined)
        entry.longDescriptionSource = data.longDescriptionSource;

      this._images.set(id, entry);
      this._metadata.lastUpdated = new Date().toISOString();

      logInfo(`Image added: ${id}`);
      return deepClone(entry);
    }

    /**
     * Remove an image from the registry.
     *
     * @param {string} id - Image ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeImage(id) {
      if (!id || typeof id !== "string") {
        logWarn("removeImage() called with invalid ID");
        return false;
      }

      if (!this._images.has(id)) {
        logDebug(`removeImage(): ID "${id}" not found`);
        return false;
      }

      this._images.delete(id);
      this._metadata.lastUpdated = new Date().toISOString();

      logInfo(`Image removed: ${id}`);
      return true;
    }

    /**
     * Replace image data for an existing entry. Preserves user metadata
     * (alt text, notes, long description) but updates image data and state.
     *
     * @param {string} id - Image ID to replace
     * @param {Object} newData - New image data
     * @param {string} [newData.originalUrl] - New URL
     * @param {Blob} [newData.blob] - New blob
     * @param {string} [newData.dataUri] - New data URI
     * @param {string} [newData.mimeType] - New MIME type
     * @param {number} [newData.fileSize] - New file size
     * @param {Object} [newData.dimensions] - New dimensions { width, height }
     * @returns {Object|null} Updated entry clone, or null if not found
     */
    replaceImage(id, newData) {
      if (!id || typeof id !== "string") {
        logWarn("replaceImage() called with invalid ID");
        return null;
      }

      if (!newData || typeof newData !== "object") {
        logWarn("replaceImage() called with invalid data");
        return null;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logWarn(`replaceImage(): ID "${id}" not found`);
        return null;
      }

      // Update image data fields
      if (newData.originalUrl !== undefined)
        entry.originalUrl = newData.originalUrl;
      if (newData.blob !== undefined)
        entry.blob = newData.blob instanceof Blob ? newData.blob : null;
      if (newData.dataUri !== undefined) entry.dataUri = newData.dataUri;
      if (newData.mimeType !== undefined) entry.mimeType = newData.mimeType;
      if (newData.fileSize !== undefined) entry.fileSize = newData.fileSize;
      if (newData.dimensions !== undefined)
        entry.dimensions = newData.dimensions;
      if (newData.mmdReference !== undefined)
        entry.mmdReference = newData.mmdReference;
      if (newData.syntax !== undefined) entry.syntax = newData.syntax;
      // Stage 1 prep: originalSyntax stays untouched if not explicitly
      // overridden. The current `syntax` may change (e.g. when an image is
      // wrapped in a figure environment), but the origin must persist.
      if (newData.originalSyntax !== undefined)
        entry.originalSyntax = newData.originalSyntax;

      // Phase 14 (alt-text v1): preserve new metadata fields if explicitly
      // supplied during replacement. Existing values stay put otherwise.
      if (newData.title !== undefined) entry.title = newData.title;
      if (newData.titleSource !== undefined)
        entry.titleSource = newData.titleSource;
      if (newData.decorative !== undefined)
        entry.decorative = Boolean(newData.decorative);
      if (newData.textInImage !== undefined)
        entry.textInImage = newData.textInImage;
      if (newData.textInImageSource !== undefined)
        entry.textInImageSource = newData.textInImageSource;

      // Update state
      entry.status = "user-replaced";
      entry.isModified = true;
      entry.replacedAt = new Date().toISOString();
      this._metadata.lastUpdated = new Date().toISOString();

      logInfo(`Image replaced: ${id}`);
      return deepClone(entry);
    }

    /**
     * Update alt text for an image, with source tracking.
     *
     * @param {string} id - Image ID
     * @param {string} altText - New alt text
     * @param {string|null} [source] - Alt text source: "original", "user", "ai-generated", "ai-reviewed"
     * @returns {boolean} True if updated, false if image not found
     */
    updateAltText(id, altText, source) {
      if (!id || typeof id !== "string") {
        logWarn("updateAltText() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`updateAltText(): ID "${id}" not found`);
        return false;
      }

      entry.altText = typeof altText === "string" ? altText : "";

      // Validate source
      if (source === undefined) {
        // Keep existing source if not specified
      } else if (VALID_ALT_TEXT_SOURCES.includes(source)) {
        entry.altTextSource = source;
      } else {
        logWarn(`updateAltText(): Invalid source "${source}", using "user"`);
        entry.altTextSource = "user";
      }

      entry.isModified = true;
      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(
        `Alt text updated for ${id}: "${altText}" (source: ${entry.altTextSource})`,
      );
      this._scheduleMirrorWrite();
      return true;
    }

    /**
     * Update long description for an image, with source tracking.
     *
     * @param {string} id - Image ID
     * @param {string} longDescription - New long description
     * @param {string|null} [source] - Description source
     * @returns {boolean} True if updated, false if image not found
     */
    updateLongDescription(id, longDescription, source) {
      if (!id || typeof id !== "string") {
        logWarn("updateLongDescription() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`updateLongDescription(): ID "${id}" not found`);
        return false;
      }

      entry.longDescription =
        typeof longDescription === "string" ? longDescription : "";

      if (source === undefined) {
        // Keep existing source
      } else if (VALID_LONG_DESC_SOURCES.includes(source)) {
        entry.longDescriptionSource = source;
      } else {
        logWarn(
          `updateLongDescription(): Invalid source "${source}", using "user"`,
        );
        entry.longDescriptionSource = "user";
      }

      entry.isModified = true;
      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(`Long description updated for ${id}`);
      this._scheduleMirrorWrite();
      return true;
    }

    /**
     * Update title (caption) for an image, with source tracking.
     *
     * @param {string} id - Image ID
     * @param {string} title - New title text
     * @param {string|null} [source] - Title source: "original", "user", "ai-generated", "ai-reviewed"
     * @returns {boolean} True if updated, false if image not found
     */
    updateTitle(id, title, source) {
      if (!id || typeof id !== "string") {
        logWarn("updateTitle() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`updateTitle(): ID "${id}" not found`);
        return false;
      }

      entry.title = typeof title === "string" ? title : "";

      if (source === undefined) {
        // Keep existing source if not specified
      } else if (VALID_TITLE_SOURCES.includes(source)) {
        entry.titleSource = source;
      } else {
        logWarn(`updateTitle(): Invalid source "${source}", using "user"`);
        entry.titleSource = "user";
      }

      entry.isModified = true;
      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(
        `Title updated for ${id}: "${title}" (source: ${entry.titleSource})`,
      );
      this._scheduleMirrorWrite();
      return true;
    }

    /**
     * Update the decorative flag for an image. Any truthy/falsy value is
     * coerced with Boolean() so "true", 1, null, undefined etc. all behave
     * predictably.
     *
     * @param {string} id - Image ID
     * @param {*} decorative - Value to coerce to boolean
     * @returns {boolean} True if updated, false if image not found
     */
    updateDecorative(id, decorative) {
      if (!id || typeof id !== "string") {
        logWarn("updateDecorative() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`updateDecorative(): ID "${id}" not found`);
        return false;
      }

      entry.decorative = Boolean(decorative);
      entry.isModified = true;
      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(`Decorative flag updated for ${id}: ${entry.decorative}`);
      return true;
    }

    /**
     * Update text-in-image (verbatim text content of the image), with source
     * tracking. Stored only — not serialised to MMD in v1.
     *
     * @param {string} id - Image ID
     * @param {string} text - New text-in-image content
     * @param {string|null} [source] - Source: "original", "user", "ai-generated", "ai-reviewed"
     * @returns {boolean} True if updated, false if image not found
     */
    updateTextInImage(id, text, source) {
      if (!id || typeof id !== "string") {
        logWarn("updateTextInImage() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`updateTextInImage(): ID "${id}" not found`);
        return false;
      }

      entry.textInImage = typeof text === "string" ? text : "";

      if (source === undefined) {
        // Keep existing source if not specified
      } else if (VALID_TEXT_IN_IMAGE_SOURCES.includes(source)) {
        entry.textInImageSource = source;
      } else {
        logWarn(
          `updateTextInImage(): Invalid source "${source}", using "user"`,
        );
        entry.textInImageSource = "user";
      }

      entry.isModified = true;
      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(
        `Text-in-image updated for ${id}: "${text}" (source: ${entry.textInImageSource})`,
      );
      this._scheduleMirrorWrite();
      return true;
    }

    /**
     * Update an image entry's `mmdReference` and `syntax` in place.
     *
     * Used by the alt-text MMD serialiser when wrap/unwrap transformations
     * change how the image appears in the MMD (e.g. bare `![](url)` becomes a
     * `\includegraphics` line inside a figure environment) but the underlying
     * image data is unchanged. Distinct from `replaceImage`, which is for
     * genuine image-data replacement and intentionally flips `status` to
     * `"user-replaced"`; this method preserves `status`, `replacedAt`,
     * `originalUrl`, `dataUri`, `blob`, `mimeType`, `fileSize`, `originalSyntax`,
     * and every content field (alt text, caption, long description, etc.).
     *
     * @param {string} id - Entry ID
     * @param {string} mmdReference - New literal MMD reference string (e.g. the
     *   `\includegraphics[...]{url}` line that was just inserted)
     * @param {string} syntax - New syntax, one of `"markdown"` or `"includegraphics"`
     * @returns {boolean} True on success, false if id not found or arguments invalid
     */
    updateImageReference(id, mmdReference, syntax) {
      if (!id || typeof id !== "string") {
        logWarn("updateImageReference() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`updateImageReference(): ID "${id}" not found`);
        return false;
      }

      if (typeof mmdReference !== "string" || mmdReference.length === 0) {
        logWarn(
          `updateImageReference(): mmdReference must be a non-empty string (got ${typeof mmdReference})`,
        );
        return false;
      }

      if (syntax !== "markdown" && syntax !== "includegraphics") {
        logWarn(
          `updateImageReference(): syntax must be "markdown" or "includegraphics" (got "${syntax}")`,
        );
        return false;
      }

      entry.mmdReference = mmdReference;
      entry.syntax = syntax;
      entry.isModified = true;
      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(
        `Image reference updated for ${id}: syntax="${syntax}" mmdReference="${mmdReference}"`,
      );
      return true;
    }

    /**
     * Sync an image entry's `mmdReference` to a new value during session
     * restore, after the MMD has been rewritten from CDN URLs to blob URLs.
     *
     * Distinct from both `updateImageReference` (which sets `isModified` and
     * touches `lastUpdated` — appropriate for user edits) and `replaceImage`
     * (which flips `status` to "user-replaced"). This method touches ONLY
     * `entry.mmdReference` and is intended exclusively for restore-time
     * bookkeeping that keeps the registry's references in sync with the
     * live MMD after `rewriteMMDWithBlobUrls()` runs.
     *
     * The caller is expected to emit one summary `logInfo` after the bulk
     * loop; per-entry logging here is at `logDebug` to avoid noise.
     *
     * @param {string} id - Entry ID
     * @param {string} mmdReference - New literal MMD reference string with
     *   blob URL substituted for the original CDN URL
     * @returns {boolean} True on success, false if id not found or arguments invalid
     */
    syncMmdReferenceForRestore(id, mmdReference) {
      if (!id || typeof id !== "string") {
        logWarn("syncMmdReferenceForRestore() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`syncMmdReferenceForRestore(): ID "${id}" not found`);
        return false;
      }

      if (typeof mmdReference !== "string" || mmdReference.length === 0) {
        logWarn(
          `syncMmdReferenceForRestore(): mmdReference must be a non-empty string (got ${typeof mmdReference})`,
        );
        return false;
      }

      entry.mmdReference = mmdReference;

      logDebug(
        `Synced mmdReference for ${id} to blob-URL form (restore bookkeeping)`,
      );
      return true;
    }

    /**
     * Sync an image entry's `originalUrl` to a new value during session
     * restore. Sibling of `syncMmdReferenceForRestore` for the case where
     * the ZIP-restored entry's stored URL is stale (e.g. a different CDN
     * host than the one currently in the MMD) and needs refreshing
     * without losing the entry's restore-time status / isModified.
     *
     * Distinct from `replaceImage` (which flips `status` to "user-replaced"
     * — wrong for restore-time bookkeeping). This setter touches ONLY
     * `entry.originalUrl`.
     *
     * The caller is expected to emit one summary `logInfo` after the bulk
     * loop; per-entry logging here is at `logDebug` to avoid noise.
     *
     * @param {string} id - Entry ID
     * @param {string} originalUrl - New originalUrl value (non-empty string)
     * @returns {boolean} True on success, false if id not found or arguments invalid
     */
    syncOriginalUrlForRestore(id, originalUrl) {
      if (!id || typeof id !== "string") {
        logWarn("syncOriginalUrlForRestore() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`syncOriginalUrlForRestore(): ID "${id}" not found`);
        return false;
      }

      if (typeof originalUrl !== "string" || originalUrl.length === 0) {
        logWarn(
          `syncOriginalUrlForRestore(): originalUrl must be a non-empty string (got ${typeof originalUrl})`,
        );
        return false;
      }

      entry.originalUrl = originalUrl;

      logDebug(
        `Synced originalUrl for ${id} (restore bookkeeping)`,
      );
      return true;
    }

    /**
     * Sync an image entry's `dataUri` to a new value during session
     * restore. Sibling of `syncMmdReferenceForRestore` for the case where
     * the restored entry needs its inline base64 data URI re-attached
     * without losing the entry's restore-time status / isModified.
     *
     * Distinct from `replaceImage` (which flips `status` to "user-replaced"
     * — wrong for restore-time bookkeeping). This setter touches ONLY
     * `entry.dataUri`.
     *
     * The caller is expected to emit one summary `logInfo` after the bulk
     * loop; per-entry logging here is at `logDebug` to avoid noise.
     *
     * @param {string} id - Entry ID
     * @param {string} dataUri - New dataUri value (non-empty string)
     * @returns {boolean} True on success, false if id not found or arguments invalid
     */
    syncDataUriForRestore(id, dataUri) {
      if (!id || typeof id !== "string") {
        logWarn("syncDataUriForRestore() called with invalid ID");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logDebug(`syncDataUriForRestore(): ID "${id}" not found`);
        return false;
      }

      if (typeof dataUri !== "string" || dataUri.length === 0) {
        logWarn(
          `syncDataUriForRestore(): dataUri must be a non-empty string (got ${typeof dataUri})`,
        );
        return false;
      }

      entry.dataUri = dataUri;

      logDebug(
        `Synced dataUri for ${id} (restore bookkeeping)`,
      );
      return true;
    }

    /**
     * Attach a blob to an existing image entry. Used during ZIP restore
     * when blobs are re-attached separately from JSON data.
     *
     * @param {string} id - Image ID
     * @param {Blob} blob - Image blob
     * @param {string} [mimeType] - MIME type override
     * @returns {boolean} True if attached, false if not found
     */
    attachBlob(id, blob) {
      if (!id || typeof id !== "string") {
        logWarn("attachBlob() called with invalid ID");
        return false;
      }

      if (!(blob instanceof Blob)) {
        logWarn("attachBlob() called with non-Blob data");
        return false;
      }

      const entry = this._images.get(id);
      if (!entry) {
        logWarn(`attachBlob(): ID "${id}" not found`);
        return false;
      }

      entry.blob = blob;
      entry.fileSize = blob.size;
      if (blob.type) {
        entry.mimeType = blob.type;
      }

      // Update status if it was cdn-linked
      if (entry.status === "cdn-linked") {
        entry.status = "downloaded";
        entry.downloadedAt = new Date().toISOString();
      }

      this._metadata.lastUpdated = new Date().toISOString();

      logDebug(`Blob attached to ${id}: ${blob.size} bytes`);
      return true;
    }

    // ========================================================================
    // METADATA
    // ========================================================================

    /**
     * Set the document ID for this registry.
     *
     * @param {string} documentId - Document identifier (PDF ID or filename)
     */
    setDocumentId(documentId) {
      this._metadata.documentId = documentId || null;
      this._metadata.lastUpdated = new Date().toISOString();
    }

    /**
     * Get registry-level metadata.
     *
     * @returns {Object} Metadata clone
     */
    getMetadata() {
      return { ...this._metadata };
    }

    // ========================================================================
    // STATISTICS
    // ========================================================================

    /**
     * Get summary statistics about the registry.
     *
     * @returns {Object} Statistics object
     */
    getStats() {
      const stats = {
        total: 0,
        withAltText: 0,
        withoutAltText: 0,
        withLongDescription: 0,
        withTitle: 0,
        withTextInImage: 0,
        decorativeCount: 0,
        cdnLinked: 0,
        dataUri: 0,
        downloaded: 0,
        userReplaced: 0,
        userAdded: 0,
        missing: 0,
        modified: 0,
        bySource: {
          "mathpix-ocr": 0,
          "user-upload": 0,
          "user-paste": 0,
        },
        bySyntax: {
          markdown: 0,
          includegraphics: 0,
        },
        altTextSources: {
          original: 0,
          user: 0,
          "ai-generated": 0,
          "ai-reviewed": 0,
          none: 0,
        },
      };

      for (const entry of this._images.values()) {
        stats.total++;

        // Alt text
        if (entry.altText && entry.altText.length > 0) {
          stats.withAltText++;
        } else {
          stats.withoutAltText++;
        }

        // Long description
        if (entry.longDescription && entry.longDescription.length > 0) {
          stats.withLongDescription++;
        }

        // Title (caption)
        if (entry.title && entry.title.length > 0) {
          stats.withTitle++;
        }

        // Text in image
        if (entry.textInImage && entry.textInImage.length > 0) {
          stats.withTextInImage++;
        }

        // Decorative flag
        if (entry.decorative === true) {
          stats.decorativeCount++;
        }

        // Status
        switch (entry.status) {
          case "cdn-linked":
            stats.cdnLinked++;
            break;
          case "data-uri":
            stats.dataUri++;
            break;
          case "downloaded":
            stats.downloaded++;
            break;
          case "user-replaced":
            stats.userReplaced++;
            break;
          case "user-added":
            stats.userAdded++;
            break;
          case "missing":
            stats.missing++;
            break;
        }

        // Modified
        if (entry.isModified) stats.modified++;

        // Source
        if (stats.bySource[entry.source] !== undefined) {
          stats.bySource[entry.source]++;
        }

        // Syntax
        if (stats.bySyntax[entry.syntax] !== undefined) {
          stats.bySyntax[entry.syntax]++;
        }

        // Alt text sources
        if (
          entry.altTextSource &&
          stats.altTextSources[entry.altTextSource] !== undefined
        ) {
          stats.altTextSources[entry.altTextSource]++;
        } else {
          stats.altTextSources.none++;
        }
      }

      return stats;
    }

    // ========================================================================
    // RELOAD-SURVIVAL MIRROR (write side)
    // ========================================================================

    /**
     * Synchronously write the serialised registry to the localStorage mirror.
     * Never throws — a quota or serialisation failure logs ERROR and is
     * swallowed, matching the context manager's mirror write.
     *
     * @returns {void}
     */
    _writeMirrorNow() {
      try {
        localStorage.setItem(MIRROR_REGISTRY_KEY, JSON.stringify(this.toJSON()));
        logDebug("Registry mirror written to localStorage.");
      } catch (error) {
        logError("Registry mirror write failed.", error);
      }
    }

    /**
     * Cancel any pending debounced mirror write.
     *
     * @returns {void}
     */
    _cancelMirrorWrite() {
      if (this._pendingMirrorTimer !== null) {
        clearTimeout(this._pendingMirrorTimer);
        this._pendingMirrorTimer = null;
      }
    }

    /**
     * Debounced, never-throws write triggered by the source mutators, mirroring
     * the context manager's scheduleMirrorWrite.
     *
     * @returns {void}
     */
    _scheduleMirrorWrite() {
      this._cancelMirrorWrite();
      this._pendingMirrorTimer = setTimeout(() => {
        this._pendingMirrorTimer = null;
        this._writeMirrorNow();
      }, MIRROR_REGISTRY_DEBOUNCE_MS);
    }

    // ------------------------------------------------------------------------
    // RELOAD-SURVIVAL MIRROR (read side)
    // ------------------------------------------------------------------------

    /**
     * Merge provenance source labels (and their content) from a parsed mirror
     * object back into the live registry after a reload.
     *
     * The restorer reads the localStorage mirror key and passes the already-
     * parsed object in; this method performs no localStorage access of its own.
     * Entries are matched by `originalUrl` (the registry's URL-fallback identity
     * key), NOT by id — the F-N note on generateStableId warns that recomputing
     * ids from scratch reintroduces the line-shift cascade, so we reconcile by
     * URL exactly as buildFromMMD's Pass 2 does.
     *
     * Only the four content/source pairs are restored — altText, longDescription,
     * title, textInImage — and only when the LIVE entry has no source for that
     * field yet (sourceField null/undefined) AND the mirror's source is a valid
     * member of that field's allow-list. A live entry that already carries a
     * source for a field is never overwritten. The `decorative` flag and all
     * other fields are deliberately left untouched.
     *
     * Fields are set DIRECTLY on the entry — this is restore bookkeeping, like
     * the syncXForRestore setters. It does NOT call the update* mutators, does
     * NOT flip `isModified`, and does NOT schedule a mirror write.
     *
     * Never throws: malformed input yields `{ matched: 0, applied: 0 }`.
     *
     * @param {Object} mirror - Parsed mirror object (shape of toJSON() output)
     * @returns {{matched: number, applied: number}} `matched` counts live
     *   entries that found a mirror entry by URL; `applied` counts individual
     *   field restorations performed across all matched entries.
     */
    hydrateFromMirror(mirror) {
      // Defensive guard — never throw on bad input.
      if (
        !mirror ||
        typeof mirror !== "object" ||
        !Array.isArray(mirror.images)
      ) {
        logWarn(
          "hydrateFromMirror(): mirror missing or malformed; nothing applied.",
        );
        return { matched: 0, applied: 0 };
      }

      // Index mirror entries by originalUrl. Skip any entry without a non-empty
      // string URL; on duplicate URLs, last-wins is acceptable.
      const mirrorByUrl = new Map();
      for (const m of mirror.images) {
        if (!m || typeof m !== "object") continue;
        if (typeof m.originalUrl !== "string" || m.originalUrl.length === 0) {
          continue;
        }
        mirrorByUrl.set(m.originalUrl, m);
      }

      // Each triple: [contentField, sourceField, allowList].
      const fieldTriples = [
        ["altText", "altTextSource", VALID_ALT_TEXT_SOURCES],
        ["longDescription", "longDescriptionSource", VALID_LONG_DESC_SOURCES],
        ["title", "titleSource", VALID_TITLE_SOURCES],
        ["textInImage", "textInImageSource", VALID_TEXT_IN_IMAGE_SOURCES],
      ];

      let matched = 0;
      let applied = 0;

      for (const entry of this._images.values()) {
        const mirrorEntry = mirrorByUrl.get(entry.originalUrl);
        if (!mirrorEntry) continue;
        matched++;

        for (const [contentField, sourceField, allowList] of fieldTriples) {
          const liveSource = entry[sourceField];
          const mirrorSource = mirrorEntry[sourceField];
          // Apply only into an empty slot, and only a valid, non-null source.
          if (liveSource !== null && liveSource !== undefined) continue;
          if (mirrorSource === null || mirrorSource === undefined) continue;
          if (!allowList.includes(mirrorSource)) continue;

          entry[contentField] =
            typeof mirrorEntry[contentField] === "string"
              ? mirrorEntry[contentField]
              : "";
          entry[sourceField] = mirrorSource;
          applied++;
        }
      }

      logInfo(`hydrateFromMirror(): matched=${matched} applied=${applied}`);
      return { matched, applied };
    }

    // ========================================================================
    // SERIALISATION
    // ========================================================================

    /**
     * Serialise registry to a plain object for storage (e.g., as image-registry.json in ZIP).
     * Excludes Blob references (non-serialisable) but includes a flag indicating
     * whether blob data existed.
     *
     * @returns {Object} Serialisable registry object
     */
    toJSON() {
      const entries = [];

      for (const entry of this._images.values()) {
        const serialised = deepClone(entry, true); // exclude blobs
        serialised.hadBlob = entry.blob !== null;
        // Phase 8H.2: Strip dataUri from serialised output.
        // The actual image data is in /images/ — keeping base64
        // in the JSON would bloat the metadata file enormously.
        serialised.hadDataUri =
          typeof entry.dataUri === "string" && entry.dataUri.length > 0;
        serialised.dataUri = null;
        entries.push(serialised);
      }

      return {
        version: REGISTRY_VERSION,
        metadata: { ...this._metadata },
        images: entries,
        stats: this.getStats(),
      };
    }

    /**
     * Restore registry from serialised JSON data.
     * Clears existing entries. Blobs will be re-attached separately
     * (e.g., during ZIP restore via attachBlob()).
     *
     * @param {Object} data - Serialised registry data (from toJSON())
     * @returns {boolean} True if restored successfully, false on failure
     */
    fromJSON(data) {
      if (!data || typeof data !== "object") {
        logWarn("fromJSON() called with invalid data");
        return false;
      }

      // Version check
      if (data.version && data.version !== REGISTRY_VERSION) {
        logWarn(
          `fromJSON(): Version mismatch — got "${data.version}", expected "${REGISTRY_VERSION}". Attempting restore anyway.`,
        );
      }

      // Restore metadata
      if (data.metadata && typeof data.metadata === "object") {
        this._metadata.documentId = data.metadata.documentId || null;
        this._metadata.createdAt = data.metadata.createdAt || null;
        this._metadata.lastUpdated =
          data.metadata.lastUpdated || new Date().toISOString();
        this._metadata.version = REGISTRY_VERSION;
      }

      // Restore images
      this._images.clear();

      const images = Array.isArray(data.images) ? data.images : [];
      let restoredCount = 0;

      for (const imgData of images) {
        if (!imgData || typeof imgData !== "object" || !imgData.id) {
          logWarn("fromJSON(): Skipping entry with missing ID");
          continue;
        }

        // Build entry from defaults + stored data
        const entry = createDefaultEntry();

        // Copy all valid fields
        for (const key of Object.keys(entry)) {
          if (imgData[key] !== undefined) {
            entry[key] = imgData[key];
          }
        }

        // Ensure ID is preserved
        entry.id = imgData.id;

        // Blobs are never in JSON — always null after restore
        entry.blob = null;

        // Validate status
        if (!VALID_STATUSES.includes(entry.status)) {
          logWarn(
            `fromJSON(): Invalid status "${entry.status}" for ${entry.id}, defaulting to "missing"`,
          );
          entry.status = "missing";
        }

        // Phase 14 (alt-text v1): defensively default new fields when reading
        // legacy data. The field-copying loop above already defaults to the
        // createDefaultEntry() values when imgData lacks a key, but this guards
        // against legacy ZIPs that explicitly stored null for fields that
        // should be strings, or stored non-boolean values for `decorative`.
        if (typeof entry.title !== "string") entry.title = "";
        if (entry.titleSource === undefined) entry.titleSource = null;
        entry.decorative = Boolean(entry.decorative);
        if (typeof entry.textInImage !== "string") entry.textInImage = "";
        if (entry.textInImageSource === undefined)
          entry.textInImageSource = null;

        // Stage 1 prep: legacy ZIPs predate `originalSyntax`. When the key is
        // absent, retrofill from the stored `syntax` so the immutable-origin
        // invariant holds. If `syntax` is also absent, fall back to null.
        if (imgData.originalSyntax === undefined) {
          entry.originalSyntax =
            typeof imgData.syntax === "string" ? imgData.syntax : null;
        }

        this._images.set(entry.id, entry);
        restoredCount++;
      }

      logInfo(`Registry restored from JSON: ${restoredCount} images`);
      return true;
    }

    // ========================================================================
    // UTILITY
    // ========================================================================

    /**
     * Clear all entries and reset metadata.
     */
    clear() {
      this._images.clear();
      this._metadata.documentId = null;
      this._metadata.createdAt = null;
      this._metadata.lastUpdated = null;
      this._metadata.version = REGISTRY_VERSION;
      logDebug("Registry cleared");
    }

    // ========================================================================
    // STATIC HELPERS
    // ========================================================================

    /**
     * Classify an entry's alt-text completion state for UI badges.
     * Pure function — does not touch registry state. Discoverable via the
     * class namespace (e.g. MathPixImageRegistry.getAltCompletionStatus).
     *
     * @param {Object} entry - Registry entry (or clone)
     * @returns {"has-alt"|"decorative"|"no-alt"} Status keyword
     */
    static getAltCompletionStatus(entry) {
      if (!entry || typeof entry !== "object") {
        logWarn("getAltCompletionStatus(): invalid entry, returning 'no-alt'");
        return "no-alt";
      }
      if (entry.decorative === true) return "decorative";
      if (typeof entry.altText === "string" && entry.altText.length > 0) {
        return "has-alt";
      }
      return "no-alt";
    }

    /**
     * Compute the full accessibility-metadata status for a registry entry,
     * suitable for driving the Stage 4 grid badge cluster. Returns the state
     * for the three user-editable accessibility dimensions surfaced in the
     * manager UI: caption (title), alt text, and long description.
     *
     * Decorative === true causes both altState and longDescState to return
     * "decorative" regardless of the stored values, matching Q1 in
     * stage-4-planning-decisions.md. Caption is decorative-agnostic.
     *
     * The altState dimension delegates to getAltCompletionStatus so we do
     * not duplicate the three-state classifier logic.
     *
     * @param {Object} entry - Registry entry (or clone)
     * @returns {{
     *   hasCaption: boolean,
     *   altState: "has-alt" | "no-alt" | "decorative",
     *   longDescState: "has-longdesc" | "no-longdesc" | "decorative"
     * }}
     */
    static getMetadataStatus(entry) {
      if (!entry || typeof entry !== "object") {
        return {
          hasCaption: false,
          altState: "no-alt",
          longDescState: "no-longdesc",
        };
      }

      const hasCaption =
        typeof entry.title === "string" && entry.title.length > 0;

      const altState = MathPixImageRegistry.getAltCompletionStatus(entry);

      let longDescState;
      if (entry.decorative === true) {
        longDescState = "decorative";
      } else if (
        typeof entry.longDescription === "string" &&
        entry.longDescription.length > 0
      ) {
        longDescState = "has-longdesc";
      } else {
        longDescState = "no-longdesc";
      }

      return { hasCaption, altState, longDescState };
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixImageRegistry = MathPixImageRegistry;

  // ============================================================================
  // TEST SUITE
  // ============================================================================

  /**
   * Comprehensive test suite for MathPixImageRegistry.
   * Self-contained — run via window.testImageRegistry() in browser console.
   */
  window.testImageRegistry = function () {
    console.log("=== MathPix Image Registry Test Suite ===\n");

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(testName, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${testName}`);
      } else {
        failed++;
        const msg = detail ? `${testName} — ${detail}` : testName;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    // ========================================================================
    // TEST DATA
    // ========================================================================

    // Simple markdown image
    const mmd1 =
      "Some text\n![A diagram](https://cdn.mathpix.com/cropped/2025_11_24_abc.jpg)\nMore text";

    // Multiple images, mixed syntax
    const mmd2 = `# Document
![Figure 1](https://cdn.mathpix.com/cropped/img1.png)
Some equations here.
\\includegraphics[width=0.5\\textwidth]{https://cdn.mathpix.com/cropped/img2.jpg}
![](external-image.png)
`;

    // Base64 data URI
    const mmd3 =
      "![Chart](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)\nText after.";

    // No images
    const mmd4 = "# Title\nJust text and math: $x = 1$\n$$y = 2$$";

    // Duplicate URL at different lines
    const mmd5 =
      "![First ref](https://cdn.mathpix.com/img.jpg)\nText\n![Second ref](https://cdn.mathpix.com/img.jpg)";

    // Image with extensive alt text
    const mmd6 =
      "![Free body diagram showing forces on an inclined plane with friction, normal force N, weight mg, and applied force F](https://cdn.mathpix.com/diagram.png)";

    // Multiple images on the same line
    const mmd7 =
      "![A](https://cdn.mathpix.com/a.png) and ![B](https://cdn.mathpix.com/b.png) side by side";

    // LaTeX includegraphics without options
    const mmd8 = "\\includegraphics{https://cdn.mathpix.com/fig.png}";

    // Images inside a table
    const mmd9 =
      "| Column |\n|---|\n| ![table img](https://cdn.mathpix.com/tbl.png) |";

    // External (non-CDN) URL
    const mmd10 = "![External](https://example.com/photo.jpg)";

    // S3 bucket URL (also MathPix CDN)
    const mmd11 =
      "![S3](https://mathpix-ocr-examples.s3.amazonaws.com/test.png)";

    // Unicode alt text
    const mmd12 =
      "![Diagramme montrant les forces — résultat](https://cdn.mathpix.com/uni.png)";

    // Image inside math block context
    const mmd13 =
      "$$\nx = 1\n$$\n![After math](https://cdn.mathpix.com/after.png)\n$$\ny = 2\n$$";

    // ========================================================================
    // GROUP 1: BUILD FROM MMD — Basic Detection
    // ========================================================================
    console.log("\n--- 1. Build from MMD: Basic Detection ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd1);
      assert(
        "mmd1: Detects 1 image (setDiff.added.length === 1)",
        setDiff.added.length === 1,
        `Got ${setDiff.added.length}`,
      );
      const images = reg.getAllImages();
      assert(
        "mmd1: Alt text is 'A diagram'",
        images[0]?.altText === "A diagram",
      );
      assert(
        "mmd1: URL contains cdn.mathpix.com",
        images[0]?.originalUrl?.includes("cdn.mathpix.com"),
      );
      assert("mmd1: Syntax is markdown", images[0]?.syntax === "markdown");
      assert("mmd1: Status is cdn-linked", images[0]?.status === "cdn-linked");
      assert(
        "mmd1: Line number is 2",
        images[0]?.lineNumber === 2,
        `Got ${images[0]?.lineNumber}`,
      );
      assert(
        "mmd1: Source is mathpix-ocr",
        images[0]?.source === "mathpix-ocr",
      );
      assert(
        "mmd1: altTextSource is 'original'",
        images[0]?.altTextSource === "original",
      );
      assert(
        "mmd1: MIME type inferred as image/jpeg",
        images[0]?.mimeType === "image/jpeg",
      );
    }

    // ========================================================================
    // GROUP 2: BUILD FROM MMD — Multiple & Mixed Syntax
    // ========================================================================
    console.log("\n--- 2. Build from MMD: Multiple & Mixed Syntax ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd2);
      assert(
        "mmd2: Detects 3 images (setDiff.added.length === 3)",
        setDiff.added.length === 3,
        `Got ${setDiff.added.length}`,
      );
      const images = reg.getAllImages();

      const markdownImages = images.filter((i) => i.syntax === "markdown");
      const latexImages = images.filter((i) => i.syntax === "includegraphics");
      assert(
        "mmd2: 2 markdown images",
        markdownImages.length === 2,
        `Got ${markdownImages.length}`,
      );
      assert(
        "mmd2: 1 LaTeX image",
        latexImages.length === 1,
        `Got ${latexImages.length}`,
      );

      const fig1 = images.find((i) => i.altText === "Figure 1");
      assert("mmd2: Figure 1 found", !!fig1);
      assert(
        "mmd2: Figure 1 is CDN",
        fig1?.originalUrl?.includes("cdn.mathpix.com"),
      );

      const noAlt = images.find((i) => i.originalUrl === "external-image.png");
      assert("mmd2: External image found", !!noAlt);
      assert("mmd2: External image has empty alt", noAlt?.altText === "");
      assert(
        "mmd2: External image altTextSource is null",
        noAlt?.altTextSource === null,
      );
    }

    // ========================================================================
    // GROUP 3: BUILD FROM MMD — Base64 Data URIs
    // ========================================================================
    console.log("\n--- 3. Build from MMD: Base64 Data URIs ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd3);
      assert(
        "mmd3: Detects 1 image (setDiff.added.length === 1)",
        setDiff.added.length === 1,
        `Got ${setDiff.added.length}`,
      );
      const img = reg.getAllImages()[0];
      assert("mmd3: Status is data-uri", img?.status === "data-uri");
      assert("mmd3: MIME type is image/png", img?.mimeType === "image/png");
      assert(
        "mmd3: fileSize is positive",
        img?.fileSize > 0,
        `Got ${img?.fileSize}`,
      );
      assert(
        "mmd3: dataUri field is null (not stored redundantly)",
        img?.dataUri === null,
      );
      assert("mmd3: Alt text is 'Chart'", img?.altText === "Chart");
    }

    // ========================================================================
    // GROUP 4: BUILD FROM MMD — No Images
    // ========================================================================
    console.log("\n--- 4. Build from MMD: No Images ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd4);
      assert(
        "mmd4: Detects 0 images (setDiff.added.length === 0)",
        setDiff.added.length === 0,
        `Got ${setDiff.added.length}`,
      );
      assert(
        "mmd4: getAllImages() returns empty array",
        reg.getAllImages().length === 0,
      );
      assert("mmd4: getCount() returns 0", reg.getCount() === 0);
    }

    // ========================================================================
    // GROUP 5: BUILD FROM MMD — Duplicate URLs
    // ========================================================================
    console.log("\n--- 5. Build from MMD: Duplicate URLs ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd5);
      assert(
        "mmd5: Detects 2 entries (same URL, different lines)",
        setDiff.added.length === 2,
        `Got ${setDiff.added.length}`,
      );
      const images = reg.getAllImages();
      assert("mmd5: Different IDs", images[0]?.id !== images[1]?.id);
      assert(
        "mmd5: Same URL",
        images[0]?.originalUrl === images[1]?.originalUrl,
      );
      assert("mmd5: First at line 1", images[0]?.lineNumber === 1);
      assert("mmd5: Second at line 3", images[1]?.lineNumber === 3);
      assert(
        "mmd5: First alt text 'First ref'",
        images[0]?.altText === "First ref",
      );
      assert(
        "mmd5: Second alt text 'Second ref'",
        images[1]?.altText === "Second ref",
      );
    }

    // ========================================================================
    // GROUP 6: BUILD FROM MMD — Extensive Alt Text
    // ========================================================================
    console.log("\n--- 6. Build from MMD: Extensive Alt Text ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd6);
      const img = reg.getAllImages()[0];
      assert(
        "mmd6: Long alt text preserved",
        img?.altText?.includes("Free body diagram"),
      );
      assert(
        "mmd6: Alt text includes 'friction'",
        img?.altText?.includes("friction"),
      );
      assert(
        "mmd6: Alt text length > 50",
        img?.altText?.length > 50,
        `Got ${img?.altText?.length}`,
      );
    }

    // ========================================================================
    // GROUP 7: BUILD FROM MMD — Multiple on Same Line
    // ========================================================================
    console.log("\n--- 7. Build from MMD: Multiple Images on Same Line ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd7);
      assert(
        "mmd7: Detects 2 images (setDiff.added.length === 2)",
        setDiff.added.length === 2,
        `Got ${setDiff.added.length}`,
      );
      const images = reg.getAllImages();
      assert(
        "mmd7: Both on line 1",
        images[0]?.lineNumber === 1 && images[1]?.lineNumber === 1,
      );
      assert(
        "mmd7: Different IDs (different URLs)",
        images[0]?.id !== images[1]?.id,
      );
    }

    // ========================================================================
    // GROUP 8: BUILD FROM MMD — LaTeX Without Options
    // ========================================================================
    console.log("\n--- 8. Build from MMD: LaTeX Without Options ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd8);
      assert(
        "mmd8: Detects 1 image (setDiff.added.length === 1)",
        setDiff.added.length === 1,
        `Got ${setDiff.added.length}`,
      );
      const img = reg.getAllImages()[0];
      assert(
        "mmd8: Syntax is includegraphics",
        img?.syntax === "includegraphics",
      );
      assert(
        "mmd8: MIME type inferred as image/png",
        img?.mimeType === "image/png",
      );
    }

    // ========================================================================
    // GROUP 9: BUILD FROM MMD — Image in Table
    // ========================================================================
    console.log("\n--- 9. Build from MMD: Image in Table ---");

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd9);
      assert(
        "mmd9: Detects image inside table (setDiff.added.length === 1)",
        setDiff.added.length === 1,
        `Got ${setDiff.added.length}`,
      );
      assert("mmd9: Line is 3", reg.getAllImages()[0]?.lineNumber === 3);
    }

    // ========================================================================
    // GROUP 10: BUILD FROM MMD — External & S3 URLs
    // ========================================================================
    console.log("\n--- 10. Build from MMD: External & S3 URLs ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd10);
      const img = reg.getAllImages()[0];
      assert(
        "mmd10: External URL detected",
        img?.originalUrl === "https://example.com/photo.jpg",
      );
      assert("mmd10: MIME type is image/jpeg", img?.mimeType === "image/jpeg");
    }

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd11);
      const img = reg.getAllImages()[0];
      assert("mmd11: S3 URL detected", !!img);
      assert("mmd11: S3 status is cdn-linked", img?.status === "cdn-linked");
    }

    // ========================================================================
    // GROUP 11: BUILD FROM MMD — Unicode & Context
    // ========================================================================
    console.log("\n--- 11. Build from MMD: Unicode & Context ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd12);
      const img = reg.getAllImages()[0];
      assert(
        "mmd12: Unicode alt text preserved",
        img?.altText?.includes("résultat"),
      );
    }

    {
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD(mmd13);
      assert(
        "mmd13: Image between math blocks detected",
        setDiff.added.length === 1,
        `Got ${setDiff.added.length}`,
      );
      assert(
        "mmd13: Line number is 4",
        reg.getAllImages()[0]?.lineNumber === 4,
      );
    }

    // ========================================================================
    // GROUP 12: BUILD FROM MMD — Invalid Input
    // ========================================================================
    console.log("\n--- 12. Build from MMD: Invalid Input ---");

    {
      const reg = new MathPixImageRegistry();
      // Stage 6 Q3: invalid input returns defensive empty shape, not 0.
      // Empty string is now valid input — on a fresh registry it returns
      // the same empty diff, but on a populated one it removes every entry.
      const nullDiff = reg.buildFromMMD(null);
      assert(
        "null input returns defensive empty shape",
        !!nullDiff &&
          Array.isArray(nullDiff.added) &&
          nullDiff.added.length === 0 &&
          Array.isArray(nullDiff.removed) &&
          nullDiff.removed.length === 0,
      );
      const undefDiff = reg.buildFromMMD(undefined);
      assert(
        "undefined input returns defensive empty shape",
        !!undefDiff &&
          Array.isArray(undefDiff.added) &&
          undefDiff.added.length === 0 &&
          Array.isArray(undefDiff.removed) &&
          undefDiff.removed.length === 0,
      );
      const numDiff = reg.buildFromMMD(42);
      assert(
        "number input returns defensive empty shape",
        !!numDiff &&
          Array.isArray(numDiff.added) &&
          numDiff.added.length === 0 &&
          Array.isArray(numDiff.removed) &&
          numDiff.removed.length === 0,
      );
      const emptyDiff = reg.buildFromMMD("");
      assert(
        "empty string returns empty diff on fresh registry",
        !!emptyDiff &&
          Array.isArray(emptyDiff.added) &&
          emptyDiff.added.length === 0 &&
          Array.isArray(emptyDiff.removed) &&
          emptyDiff.removed.length === 0,
      );
    }

    // ========================================================================
    // GROUP 13: ID STABILITY
    // ========================================================================
    console.log("\n--- 13. ID Stability ---");

    {
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd1);
      const id1 = reg1.getAllImages()[0]?.id;

      const reg2 = new MathPixImageRegistry();
      reg2.buildFromMMD(mmd1);
      const id2 = reg2.getAllImages()[0]?.id;

      assert("Same MMD produces same ID", id1 === id2, `${id1} !== ${id2}`);
      assert("ID has correct prefix", id1?.startsWith("img-"));
    }

    {
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd2);
      const ids1 = reg1.getAllImages().map((i) => i.id);

      const reg2 = new MathPixImageRegistry();
      reg2.buildFromMMD(mmd2);
      const ids2 = reg2.getAllImages().map((i) => i.id);

      assert(
        "Multiple images: same IDs across parses",
        JSON.stringify(ids1) === JSON.stringify(ids2),
      );
    }

    // ========================================================================
    // GROUP 14: CRUD — getImage
    // ========================================================================
    console.log("\n--- 14. CRUD: getImage ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const images = reg.getAllImages();
      const id = images[0]?.id;

      const retrieved = reg.getImage(id);
      assert("getImage returns entry", !!retrieved);
      assert(
        "getImage returns clone (not same reference)",
        retrieved !== reg._images.get(id),
      );
      assert("getImage clone has correct ID", retrieved?.id === id);

      assert(
        "getImage with invalid ID returns null",
        reg.getImage("nonexistent") === null,
      );
      assert("getImage with null returns null", reg.getImage(null) === null);
      assert(
        "getImage with undefined returns null",
        reg.getImage(undefined) === null,
      );
    }

    // ========================================================================
    // GROUP 15: CRUD — addImage
    // ========================================================================
    console.log("\n--- 15. CRUD: addImage ---");

    {
      const reg = new MathPixImageRegistry();
      const added = reg.addImage({
        originalUrl: "https://example.com/new.png",
        altText: "A new image",
        mimeType: "image/png",
        fileSize: 12345,
        dimensions: { width: 800, height: 600 },
        userNotes: "Added by user",
      });

      assert("addImage returns entry", !!added);
      assert("addImage ID has usr prefix", added?.id?.startsWith("img-usr-"));
      assert("addImage source is user-upload", added?.source === "user-upload");
      assert("addImage status is user-added", added?.status === "user-added");
      assert("addImage altText preserved", added?.altText === "A new image");
      assert("addImage altTextSource is user", added?.altTextSource === "user");
      assert("addImage dimensions preserved", added?.dimensions?.width === 800);
      assert(
        "addImage userNotes preserved",
        added?.userNotes === "Added by user",
      );
      assert("addImage count is 1", reg.getCount() === 1);

      // Add another
      const added2 = reg.addImage({ originalUrl: "second.png" });
      assert("Second add: count is 2", reg.getCount() === 2);
      assert("Second add: different ID", added?.id !== added2?.id);
    }

    {
      const reg = new MathPixImageRegistry();
      assert("addImage with null returns null", reg.addImage(null) === null);
      assert("addImage with string returns null", reg.addImage("bad") === null);
    }

    // ========================================================================
    // GROUP 16: CRUD — removeImage
    // ========================================================================
    console.log("\n--- 16. CRUD: removeImage ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd5); // 2 images
      const images = reg.getAllImages();
      const firstId = images[0]?.id;

      assert("removeImage returns true", reg.removeImage(firstId) === true);
      assert("Count reduced to 1", reg.getCount() === 1);
      assert("Removed image is gone", reg.getImage(firstId) === null);

      assert(
        "removeImage nonexistent returns false",
        reg.removeImage("nonexistent") === false,
      );
      assert("removeImage null returns false", reg.removeImage(null) === false);
    }

    // ========================================================================
    // GROUP 17: CRUD — replaceImage
    // ========================================================================
    console.log("\n--- 17. CRUD: replaceImage ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Add alt text first
      reg.updateAltText(id, "My custom alt", "user");

      const replaced = reg.replaceImage(id, {
        originalUrl: "https://example.com/better.png",
        mimeType: "image/png",
        fileSize: 50000,
        dimensions: { width: 1920, height: 1080 },
      });

      assert("replaceImage returns entry", !!replaced);
      assert(
        "replaceImage preserves alt text",
        replaced?.altText === "My custom alt",
      );
      assert(
        "replaceImage preserves altTextSource",
        replaced?.altTextSource === "user",
      );
      assert(
        "replaceImage updates URL",
        replaced?.originalUrl === "https://example.com/better.png",
      );
      assert(
        "replaceImage updates dimensions",
        replaced?.dimensions?.width === 1920,
      );
      assert(
        "replaceImage sets status to user-replaced",
        replaced?.status === "user-replaced",
      );
      assert("replaceImage sets isModified", replaced?.isModified === true);
      assert("replaceImage sets replacedAt", replaced?.replacedAt !== null);

      assert(
        "replaceImage nonexistent returns null",
        reg.replaceImage("nope", {}) === null,
      );
      assert(
        "replaceImage null ID returns null",
        reg.replaceImage(null, {}) === null,
      );
      assert(
        "replaceImage null data returns null",
        reg.replaceImage(id, null) === null,
      );
    }

    // Stage 4.A (Q7 addendum): verify all user-editable metadata fields
    // survive replaceImage when not supplied in newData. The block above
    // covers altText / altTextSource; this block extends coverage to the
    // other five fields (title, titleSource, longDescription,
    // longDescriptionSource, decorative, textInImage, textInImageSource).
    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      reg.updateTitle(id, "Test caption", "user");
      reg.updateAltText(id, "Test alt", "user");
      reg.updateLongDescription(id, "Test long description", "user");
      reg.updateDecorative(id, true);
      reg.updateTextInImage(id, "Test text in image", "user");

      const replaced = reg.replaceImage(id, {
        originalUrl: "https://example.com/swapped.png",
        mimeType: "image/png",
      });

      assert(
        "Stage 4.A: replaceImage preserves title",
        replaced?.title === "Test caption",
      );
      assert(
        "Stage 4.A: replaceImage preserves titleSource",
        replaced?.titleSource === "user",
      );
      assert(
        "Stage 4.A: replaceImage preserves longDescription",
        replaced?.longDescription === "Test long description",
      );
      assert(
        "Stage 4.A: replaceImage preserves longDescriptionSource",
        replaced?.longDescriptionSource === "user",
      );
      assert(
        "Stage 4.A: replaceImage preserves decorative",
        replaced?.decorative === true,
      );
      assert(
        "Stage 4.A: replaceImage preserves textInImage",
        replaced?.textInImage === "Test text in image",
      );
      assert(
        "Stage 4.A: replaceImage preserves textInImageSource",
        replaced?.textInImageSource === "user",
      );
    }

    // ========================================================================
    // GROUP 18: CRUD — updateAltText
    // ========================================================================
    console.log("\n--- 18. CRUD: updateAltText ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      assert(
        "updateAltText returns true",
        reg.updateAltText(id, "New alt", "user") === true,
      );
      assert("Alt text updated", reg.getImage(id)?.altText === "New alt");
      assert(
        "Alt text source updated",
        reg.getImage(id)?.altTextSource === "user",
      );

      // AI source
      assert(
        "updateAltText AI source",
        reg.updateAltText(id, "AI alt", "ai-generated") === true,
      );
      assert("AI alt text set", reg.getImage(id)?.altText === "AI alt");
      assert(
        "AI source set",
        reg.getImage(id)?.altTextSource === "ai-generated",
      );

      // Empty alt text
      assert(
        "updateAltText empty string",
        reg.updateAltText(id, "", "user") === true,
      );
      assert("Alt text is empty", reg.getImage(id)?.altText === "");

      // Invalid source defaults to user
      reg.updateAltText(id, "test", "invalid-source");
      assert(
        "Invalid source defaults to user",
        reg.getImage(id)?.altTextSource === "user",
      );

      // Non-existent ID
      assert(
        "updateAltText nonexistent returns false",
        reg.updateAltText("nope", "alt", "user") === false,
      );
      assert(
        "updateAltText null ID returns false",
        reg.updateAltText(null, "alt") === false,
      );
    }

    // ========================================================================
    // GROUP 19: attachBlob
    // ========================================================================
    console.log("\n--- 19. attachBlob ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Create a test blob
      const blob = new Blob(["test data"], { type: "image/jpeg" });
      assert("attachBlob returns true", reg.attachBlob(id, blob) === true);

      const img = reg.getImage(id);
      assert("attachBlob sets fileSize", img?.fileSize === blob.size);
      assert(
        "attachBlob sets mimeType from blob",
        img?.mimeType === "image/jpeg",
      );
      assert(
        "attachBlob changes status to downloaded",
        img?.status === "downloaded",
      );
      assert("attachBlob sets downloadedAt", img?.downloadedAt !== null);

      // Invalid inputs
      assert(
        "attachBlob nonexistent ID returns false",
        reg.attachBlob("nope", blob) === false,
      );
      assert(
        "attachBlob null blob returns false",
        reg.attachBlob(id, null) === false,
      );
      assert(
        "attachBlob non-Blob returns false",
        reg.attachBlob(id, "not a blob") === false,
      );
    }

    // ========================================================================
    // GROUP 20: SERIALISATION — toJSON
    // ========================================================================
    console.log("\n--- 20. Serialisation: toJSON ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd2);
      reg.setDocumentId("test-doc-001");

      const json = reg.toJSON();
      assert("toJSON has version", json.version === "1.0");
      assert("toJSON has metadata", !!json.metadata);
      assert(
        "toJSON metadata has documentId",
        json.metadata.documentId === "test-doc-001",
      );
      assert("toJSON has images array", Array.isArray(json.images));
      assert("toJSON images count matches", json.images.length === 3);
      assert("toJSON has stats", !!json.stats);
      assert("toJSON stats total matches", json.stats.total === 3);

      // Check blob exclusion
      const firstEntry = json.images[0];
      assert("toJSON blob is null", firstEntry?.blob === null);
      assert("toJSON hadBlob field exists", firstEntry?.hadBlob === false);
    }

    {
      // Test with blob attached
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;
      const blob = new Blob(["data"], { type: "image/png" });
      reg.attachBlob(id, blob);

      const json = reg.toJSON();
      const entry = json.images[0];
      assert("toJSON with blob: blob is null in output", entry?.blob === null);
      assert("toJSON with blob: hadBlob is true", entry?.hadBlob === true);
    }

    // ========================================================================
    // GROUP 21: SERIALISATION — fromJSON
    // ========================================================================
    console.log("\n--- 21. Serialisation: fromJSON ---");

    {
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd2);
      reg1.setDocumentId("test-doc-002");
      const id = reg1.getAllImages()[0]?.id;
      reg1.updateAltText(id, "Custom alt", "user");

      const json = reg1.toJSON();

      const reg2 = new MathPixImageRegistry();
      assert("fromJSON returns true", reg2.fromJSON(json) === true);
      assert("fromJSON restores count", reg2.getCount() === 3);
      assert(
        "fromJSON restores documentId",
        reg2.getMetadata().documentId === "test-doc-002",
      );

      const restored = reg2.getImage(id);
      assert("fromJSON restores alt text", restored?.altText === "Custom alt");
      assert(
        "fromJSON restores altTextSource",
        restored?.altTextSource === "user",
      );
      assert("fromJSON restores original URL", !!restored?.originalUrl);
      assert("fromJSON blob is null (expected)", restored?.blob === null);
    }

    {
      const reg = new MathPixImageRegistry();
      assert("fromJSON with null returns false", reg.fromJSON(null) === false);
      assert(
        "fromJSON with string returns false",
        reg.fromJSON("bad") === false,
      );
    }

    {
      // fromJSON with missing fields
      const reg = new MathPixImageRegistry();
      const result = reg.fromJSON({
        version: "1.0",
        images: [{ id: "img-test", originalUrl: "test.png" }],
      });
      assert("fromJSON with partial data succeeds", result === true);
      const img = reg.getImage("img-test");
      assert(
        "fromJSON partial: defaults filled in",
        img?.status === "cdn-linked",
      );
      assert(
        "fromJSON partial: altText defaults to empty",
        img?.altText === "",
      );
    }

    {
      // fromJSON skips entries without ID
      const reg = new MathPixImageRegistry();
      reg.fromJSON({
        images: [
          { id: "good-id", originalUrl: "a.png" },
          { originalUrl: "no-id.png" },
          { id: "also-good", originalUrl: "b.png" },
        ],
      });
      assert("fromJSON skips entries without ID", reg.getCount() === 2);
    }

    // ========================================================================
    // GROUP 22: SERIALISATION — Round Trip
    // ========================================================================
    console.log("\n--- 22. Serialisation: Round Trip ---");

    {
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd5);
      reg1.setDocumentId("roundtrip-test");

      const images1 = reg1.getAllImages();
      const id0 = images1[0]?.id;
      const id1 = images1[1]?.id;

      reg1.updateAltText(id0, "Updated first", "ai-generated");
      reg1.updateAltText(id1, "Updated second", "user");

      const json = reg1.toJSON();
      const jsonString = JSON.stringify(json);

      const reg2 = new MathPixImageRegistry();
      reg2.fromJSON(JSON.parse(jsonString));

      assert("Round trip: count preserved", reg2.getCount() === 2);
      assert(
        "Round trip: documentId preserved",
        reg2.getMetadata().documentId === "roundtrip-test",
      );
      assert(
        "Round trip: first alt text preserved",
        reg2.getImage(id0)?.altText === "Updated first",
      );
      assert(
        "Round trip: first alt source preserved",
        reg2.getImage(id0)?.altTextSource === "ai-generated",
      );
      assert(
        "Round trip: second alt text preserved",
        reg2.getImage(id1)?.altText === "Updated second",
      );
      assert(
        "Round trip: second alt source preserved",
        reg2.getImage(id1)?.altTextSource === "user",
      );
      assert("Round trip: IDs match", reg2.hasImage(id0) && reg2.hasImage(id1));
    }

    // ========================================================================
    // GROUP 23: STATS
    // ========================================================================
    console.log("\n--- 23. Stats ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd2);
      const stats = reg.getStats();

      assert("Stats: total = 3", stats.total === 3, `Got ${stats.total}`);
      assert(
        "Stats: withAltText = 1",
        stats.withAltText === 1,
        `Got ${stats.withAltText}`,
      );
      assert(
        "Stats: withoutAltText = 2",
        stats.withoutAltText === 2,
        `Got ${stats.withoutAltText}`,
      );
      assert(
        "Stats: cdnLinked = 3",
        stats.cdnLinked === 3,
        `Got ${stats.cdnLinked}`,
      );
      assert("Stats: bySyntax.markdown = 2", stats.bySyntax.markdown === 2);
      assert(
        "Stats: bySyntax.includegraphics = 1",
        stats.bySyntax.includegraphics === 1,
      );
    }

    {
      // Stats after operations
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Add a user image
      reg.addImage({ originalUrl: "user.png", altText: "User image" });

      const stats = reg.getStats();
      assert("Stats after add: total = 2", stats.total === 2);
      assert("Stats after add: userAdded = 1", stats.userAdded === 1);
      assert(
        "Stats after add: bySource.user-upload = 1",
        stats.bySource["user-upload"] === 1,
      );
      assert(
        "Stats after add: bySource.mathpix-ocr = 1",
        stats.bySource["mathpix-ocr"] === 1,
      );
      assert("Stats after add: withAltText = 2", stats.withAltText === 2);
    }

    {
      // Stats with data URI
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd3);
      const stats = reg.getStats();
      assert("Stats: dataUri = 1", stats.dataUri === 1, `Got ${stats.dataUri}`);
    }

    {
      // Stats after replace
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;
      reg.replaceImage(id, { originalUrl: "new.png" });

      const stats = reg.getStats();
      assert("Stats after replace: userReplaced = 1", stats.userReplaced === 1);
      assert("Stats after replace: modified = 1", stats.modified === 1);
    }

    // ========================================================================
    // GROUP 24: hasImage & getCount
    // ========================================================================
    console.log("\n--- 24. hasImage & getCount ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      assert("hasImage returns true for existing", reg.hasImage(id) === true);
      assert(
        "hasImage returns false for nonexistent",
        reg.hasImage("nope") === false,
      );
      assert("getCount returns 1", reg.getCount() === 1);

      reg.removeImage(id);
      assert("hasImage false after remove", reg.hasImage(id) === false);
      assert("getCount 0 after remove", reg.getCount() === 0);
    }

    // ========================================================================
    // GROUP 25: METADATA
    // ========================================================================
    console.log("\n--- 25. Metadata ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      reg.setDocumentId("my-document.pdf");

      const meta = reg.getMetadata();
      assert("Metadata: documentId set", meta.documentId === "my-document.pdf");
      assert("Metadata: createdAt set", !!meta.createdAt);
      assert("Metadata: lastUpdated set", !!meta.lastUpdated);
      assert("Metadata: version correct", meta.version === "1.0");
    }

    // ========================================================================
    // GROUP 26: CLEAR
    // ========================================================================
    console.log("\n--- 26. Clear ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd2);
      reg.setDocumentId("to-clear");
      assert("Before clear: count = 3", reg.getCount() === 3);

      reg.clear();
      assert("After clear: count = 0", reg.getCount() === 0);
      assert(
        "After clear: documentId null",
        reg.getMetadata().documentId === null,
      );
      assert(
        "After clear: getAllImages empty",
        reg.getAllImages().length === 0,
      );
    }

    // ========================================================================
    // GROUP 27: IMMUTABILITY — Returned Clones
    // ========================================================================
    console.log("\n--- 27. Immutability ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Mutate returned object — should NOT affect internal state
      const img = reg.getImage(id);
      img.altText = "MUTATED";
      img.status = "missing";

      const fresh = reg.getImage(id);
      assert(
        "Mutation of clone does not affect registry (altText)",
        fresh?.altText !== "MUTATED",
      );
      assert(
        "Mutation of clone does not affect registry (status)",
        fresh?.status !== "missing",
      );
    }

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);

      const all = reg.getAllImages();
      all[0].altText = "MUTATED";
      all.push({ id: "fake" });

      assert(
        "getAllImages mutation doesn't affect count",
        reg.getCount() === 1,
      );
      assert(
        "getAllImages item mutation doesn't affect alt",
        reg.getAllImages()[0]?.altText !== "MUTATED",
      );
    }

    // ========================================================================
    // GROUP 28: EDGE CASES
    // ========================================================================
    console.log("\n--- 28. Edge Cases ---");

    {
      // Very long base64
      const longBase64 = "A".repeat(100000);
      const mmdLong = `![Big](data:image/png;base64,${longBase64})`;
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmdLong);
      const img = reg.getAllImages()[0];
      assert("Long base64: detected", !!img);
      assert(
        "Long base64: size calculated",
        img?.fileSize > 0,
        `Got ${img?.fileSize}`,
      );
      assert("Long base64: size is reasonable", img?.fileSize > 70000); // ~75000 bytes
    }

    {
      // Malformed URL (still treated as external)
      const mmdBad = "![](not-a-real-url)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmdBad);
      assert("Malformed URL: detected", reg.getCount() === 1);
      assert(
        "Malformed URL: MIME is null",
        reg.getAllImages()[0]?.mimeType === null,
      );
    }

    {
      // Image with only whitespace alt text
      const mmdSpace = "![   ](https://cdn.mathpix.com/x.png)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmdSpace);
      const img = reg.getAllImages()[0];
      assert("Whitespace alt: preserved as-is", img?.altText === "   ");
      assert(
        "Whitespace alt: altTextSource is original",
        img?.altTextSource === "original",
      );
    }

    {
      // Stage 6 Q2: buildFromMMD is non-destructive — a second call with
      // a fully-disjoint MMD removes everything from the first and adds
      // the new entries. Final count is therefore still 1, but via the
      // set-diff path rather than clear-and-rebuild.
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd5); // 2 images
      assert("First build: 2 images", reg.getCount() === 2);
      const setDiff = reg.buildFromMMD(mmd1); // 1 image (disjoint URLs)
      assert(
        "Second build set-diffs: removed 2 (disjoint URLs)",
        setDiff.removed.length === 2,
        `Got ${setDiff.removed.length}`,
      );
      assert(
        "Second build set-diffs: added 1 (new URL)",
        setDiff.added.length === 1,
        `Got ${setDiff.added.length}`,
      );
      assert("Final count is 1", reg.getCount() === 1);
    }

    // ========================================================================
    // GROUP 29: updateLongDescription
    // ========================================================================
    console.log("\n--- 29. updateLongDescription ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      assert(
        "updateLongDescription returns true",
        reg.updateLongDescription(
          id,
          "A detailed description of the diagram.",
          "user",
        ) === true,
      );
      assert(
        "Long description set",
        reg.getImage(id)?.longDescription ===
          "A detailed description of the diagram.",
      );
      assert(
        "Long description source set",
        reg.getImage(id)?.longDescriptionSource === "user",
      );

      const stats = reg.getStats();
      assert("Stats: withLongDescription = 1", stats.withLongDescription === 1);

      assert(
        "updateLongDescription nonexistent returns false",
        reg.updateLongDescription("nope", "text", "user") === false,
      );
    }

    // ========================================================================
    // GROUP 30: MMDREFERENCE INTEGRITY
    // ========================================================================
    console.log("\n--- 30. mmdReference Integrity ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const img = reg.getAllImages()[0];
      assert(
        "mmdReference is full match string",
        img?.mmdReference ===
          "![A diagram](https://cdn.mathpix.com/cropped/2025_11_24_abc.jpg)",
      );
    }

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd8);
      const img = reg.getAllImages()[0];
      assert(
        "LaTeX mmdReference preserved",
        img?.mmdReference ===
          "\\includegraphics{https://cdn.mathpix.com/fig.png}",
      );
    }

    // ========================================================================
    // GROUP 31: TITLE FIELD
    // ========================================================================
    console.log("\n--- 31. Title field ---");

    {
      // Default value on a fresh entry
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const img = reg.getAllImages()[0];
      assert("Title: default is empty string", img?.title === "");
      assert("Title: default titleSource is null", img?.titleSource === null);
    }

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Set
      assert(
        "updateTitle returns true",
        reg.updateTitle(id, "Figure caption", "user") === true,
      );
      assert("Title set", reg.getImage(id)?.title === "Figure caption");
      assert(
        "Title source set",
        reg.getImage(id)?.titleSource === "user",
      );

      // Change
      reg.updateTitle(id, "Updated caption", "ai-generated");
      assert(
        "Title changed",
        reg.getImage(id)?.title === "Updated caption",
      );
      assert(
        "Title source changed",
        reg.getImage(id)?.titleSource === "ai-generated",
      );

      // Clear
      reg.updateTitle(id, "", "user");
      assert("Title cleared", reg.getImage(id)?.title === "");

      // Invalid source falls back to user
      reg.updateTitle(id, "test", "bogus-source");
      assert(
        "Title: invalid source falls back to 'user'",
        reg.getImage(id)?.titleSource === "user",
      );

      // Non-existent ID
      assert(
        "updateTitle nonexistent returns false",
        reg.updateTitle("nope", "x", "user") === false,
      );
      assert(
        "updateTitle null ID returns false",
        reg.updateTitle(null, "x") === false,
      );
    }

    {
      // Valid sources all accepted
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      reg.updateTitle(id, "a", "original");
      assert(
        "Title source 'original' accepted",
        reg.getImage(id)?.titleSource === "original",
      );
      reg.updateTitle(id, "a", "ai-reviewed");
      assert(
        "Title source 'ai-reviewed' accepted",
        reg.getImage(id)?.titleSource === "ai-reviewed",
      );
      reg.updateTitle(id, "a", null);
      assert(
        "Title source null accepted",
        reg.getImage(id)?.titleSource === null,
      );
    }

    {
      // Stats: withTitle increments correctly
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd2); // 3 images
      const ids = reg.getAllImages().map((i) => i.id);

      let stats = reg.getStats();
      assert("Stats: withTitle defaults to 0", stats.withTitle === 0);

      reg.updateTitle(ids[0], "Caption A", "user");
      stats = reg.getStats();
      assert(
        "Stats: withTitle = 1 after one title",
        stats.withTitle === 1,
        `Got ${stats.withTitle}`,
      );

      reg.updateTitle(ids[1], "Caption B", "user");
      stats = reg.getStats();
      assert("Stats: withTitle = 2 after two titles", stats.withTitle === 2);

      // Empty title does not count
      reg.updateTitle(ids[0], "", "user");
      stats = reg.getStats();
      assert(
        "Stats: withTitle = 1 after clearing one",
        stats.withTitle === 1,
        `Got ${stats.withTitle}`,
      );
    }

    {
      // Round-trip including legacy JSON
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd1);
      const id = reg1.getAllImages()[0]?.id;
      reg1.updateTitle(id, "Round-trip caption", "user");

      const json = reg1.toJSON();
      assert(
        "toJSON includes title",
        json.images[0]?.title === "Round-trip caption",
      );
      assert(
        "toJSON includes titleSource",
        json.images[0]?.titleSource === "user",
      );

      const reg2 = new MathPixImageRegistry();
      reg2.fromJSON(JSON.parse(JSON.stringify(json)));
      assert(
        "fromJSON restores title",
        reg2.getImage(id)?.title === "Round-trip caption",
      );
      assert(
        "fromJSON restores titleSource",
        reg2.getImage(id)?.titleSource === "user",
      );
    }

    {
      // Legacy JSON without title key loads with default ""
      const reg = new MathPixImageRegistry();
      const result = reg.fromJSON({
        version: "1.0",
        images: [{ id: "img-legacy", originalUrl: "old.png" }],
      });
      assert("Legacy fromJSON: title succeeds", result === true);
      const img = reg.getImage("img-legacy");
      assert("Legacy fromJSON: title defaults to ''", img?.title === "");
      assert(
        "Legacy fromJSON: titleSource defaults to null",
        img?.titleSource === null,
      );
    }

    // ========================================================================
    // GROUP 32: DECORATIVE FLAG
    // ========================================================================
    console.log("\n--- 32. Decorative flag ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const img = reg.getAllImages()[0];
      assert("Decorative: default is false", img?.decorative === false);
    }

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Boolean true
      assert(
        "updateDecorative true returns true",
        reg.updateDecorative(id, true) === true,
      );
      assert("Decorative is true", reg.getImage(id)?.decorative === true);

      // Boolean false
      reg.updateDecorative(id, false);
      assert(
        "Decorative is false after false",
        reg.getImage(id)?.decorative === false,
      );

      // String "true" → coerced truthy
      reg.updateDecorative(id, "true");
      assert(
        "Decorative: string 'true' coerces to true",
        reg.getImage(id)?.decorative === true,
      );

      // Number 1 → truthy
      reg.updateDecorative(id, 1);
      assert(
        "Decorative: number 1 coerces to true",
        reg.getImage(id)?.decorative === true,
      );

      // null → falsy
      reg.updateDecorative(id, null);
      assert(
        "Decorative: null coerces to false",
        reg.getImage(id)?.decorative === false,
      );

      // undefined → falsy
      reg.updateDecorative(id, true);
      reg.updateDecorative(id, undefined);
      assert(
        "Decorative: undefined coerces to false",
        reg.getImage(id)?.decorative === false,
      );

      // 0 → falsy
      reg.updateDecorative(id, true);
      reg.updateDecorative(id, 0);
      assert(
        "Decorative: number 0 coerces to false",
        reg.getImage(id)?.decorative === false,
      );

      // Non-existent ID
      assert(
        "updateDecorative nonexistent returns false",
        reg.updateDecorative("nope", true) === false,
      );
      assert(
        "updateDecorative null ID returns false",
        reg.updateDecorative(null, true) === false,
      );
    }

    {
      // Stats: decorativeCount
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd2); // 3 images
      const ids = reg.getAllImages().map((i) => i.id);

      let stats = reg.getStats();
      assert(
        "Stats: decorativeCount defaults to 0",
        stats.decorativeCount === 0,
      );

      reg.updateDecorative(ids[0], true);
      stats = reg.getStats();
      assert(
        "Stats: decorativeCount = 1",
        stats.decorativeCount === 1,
        `Got ${stats.decorativeCount}`,
      );

      reg.updateDecorative(ids[1], true);
      stats = reg.getStats();
      assert("Stats: decorativeCount = 2", stats.decorativeCount === 2);

      reg.updateDecorative(ids[0], false);
      stats = reg.getStats();
      assert(
        "Stats: decorativeCount = 1 after toggle off",
        stats.decorativeCount === 1,
      );
    }

    {
      // Legacy JSON without decorative key loads as false
      const reg = new MathPixImageRegistry();
      const result = reg.fromJSON({
        version: "1.0",
        images: [{ id: "img-legacy-2", originalUrl: "old.png" }],
      });
      assert("Legacy fromJSON: decorative succeeds", result === true);
      const img = reg.getImage("img-legacy-2");
      assert(
        "Legacy fromJSON: decorative defaults to false",
        img?.decorative === false,
      );
    }

    {
      // Decorative round-trip
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd1);
      const id = reg1.getAllImages()[0]?.id;
      reg1.updateDecorative(id, true);

      const json = reg1.toJSON();
      const reg2 = new MathPixImageRegistry();
      reg2.fromJSON(JSON.parse(JSON.stringify(json)));
      assert(
        "Decorative round-trip preserved",
        reg2.getImage(id)?.decorative === true,
      );
    }

    // ========================================================================
    // GROUP 33: TEXT IN IMAGE
    // ========================================================================
    console.log("\n--- 33. Text in image ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const img = reg.getAllImages()[0];
      assert("textInImage: default is empty", img?.textInImage === "");
      assert(
        "textInImageSource: default is null",
        img?.textInImageSource === null,
      );
    }

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      // Set
      assert(
        "updateTextInImage returns true",
        reg.updateTextInImage(id, "Hello world inside image", "user") === true,
      );
      assert(
        "textInImage set",
        reg.getImage(id)?.textInImage === "Hello world inside image",
      );
      assert(
        "textInImageSource set",
        reg.getImage(id)?.textInImageSource === "user",
      );

      // Change
      reg.updateTextInImage(id, "Different text", "ai-generated");
      assert(
        "textInImage changed",
        reg.getImage(id)?.textInImage === "Different text",
      );
      assert(
        "textInImageSource changed",
        reg.getImage(id)?.textInImageSource === "ai-generated",
      );

      // Clear
      reg.updateTextInImage(id, "", "user");
      assert("textInImage cleared", reg.getImage(id)?.textInImage === "");

      // Invalid source falls back to user
      reg.updateTextInImage(id, "x", "bogus-source");
      assert(
        "textInImage: invalid source falls back to 'user'",
        reg.getImage(id)?.textInImageSource === "user",
      );

      // Non-existent ID
      assert(
        "updateTextInImage nonexistent returns false",
        reg.updateTextInImage("nope", "x", "user") === false,
      );
      assert(
        "updateTextInImage null ID returns false",
        reg.updateTextInImage(null, "x") === false,
      );
    }

    {
      // Valid sources all accepted
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;

      reg.updateTextInImage(id, "a", "original");
      assert(
        "textInImage source 'original' accepted",
        reg.getImage(id)?.textInImageSource === "original",
      );
      reg.updateTextInImage(id, "a", "ai-reviewed");
      assert(
        "textInImage source 'ai-reviewed' accepted",
        reg.getImage(id)?.textInImageSource === "ai-reviewed",
      );
      reg.updateTextInImage(id, "a", null);
      assert(
        "textInImage source null accepted",
        reg.getImage(id)?.textInImageSource === null,
      );
    }

    {
      // Stats: withTextInImage
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd2); // 3 images
      const ids = reg.getAllImages().map((i) => i.id);

      let stats = reg.getStats();
      assert(
        "Stats: withTextInImage defaults to 0",
        stats.withTextInImage === 0,
      );

      reg.updateTextInImage(ids[0], "Some text", "user");
      stats = reg.getStats();
      assert(
        "Stats: withTextInImage = 1",
        stats.withTextInImage === 1,
        `Got ${stats.withTextInImage}`,
      );

      reg.updateTextInImage(ids[1], "More text", "user");
      stats = reg.getStats();
      assert(
        "Stats: withTextInImage = 2",
        stats.withTextInImage === 2,
      );

      reg.updateTextInImage(ids[0], "", "user");
      stats = reg.getStats();
      assert(
        "Stats: withTextInImage = 1 after clearing one",
        stats.withTextInImage === 1,
      );
    }

    {
      // Round-trip + legacy JSON
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmd1);
      const id = reg1.getAllImages()[0]?.id;
      reg1.updateTextInImage(id, "Round-trip text", "user");

      const json = reg1.toJSON();
      assert(
        "toJSON includes textInImage",
        json.images[0]?.textInImage === "Round-trip text",
      );
      assert(
        "toJSON includes textInImageSource",
        json.images[0]?.textInImageSource === "user",
      );

      const reg2 = new MathPixImageRegistry();
      reg2.fromJSON(JSON.parse(JSON.stringify(json)));
      assert(
        "fromJSON restores textInImage",
        reg2.getImage(id)?.textInImage === "Round-trip text",
      );
      assert(
        "fromJSON restores textInImageSource",
        reg2.getImage(id)?.textInImageSource === "user",
      );
    }

    {
      // Legacy JSON without textInImage key loads with default ""
      const reg = new MathPixImageRegistry();
      const result = reg.fromJSON({
        version: "1.0",
        images: [{ id: "img-legacy-3", originalUrl: "old.png" }],
      });
      assert("Legacy fromJSON: textInImage succeeds", result === true);
      const img = reg.getImage("img-legacy-3");
      assert(
        "Legacy fromJSON: textInImage defaults to ''",
        img?.textInImage === "",
      );
      assert(
        "Legacy fromJSON: textInImageSource defaults to null",
        img?.textInImageSource === null,
      );
    }

    // ========================================================================
    // GROUP 34: getAltCompletionStatus HELPER
    // ========================================================================
    console.log("\n--- 34. getAltCompletionStatus helper ---");

    {
      assert(
        "Static helper exists on class",
        typeof MathPixImageRegistry.getAltCompletionStatus === "function",
      );

      // Empty alt + decorative false → no-alt
      assert(
        "Empty alt + decorative false → 'no-alt'",
        MathPixImageRegistry.getAltCompletionStatus({
          altText: "",
          decorative: false,
        }) === "no-alt",
      );

      // Alt present + decorative false → has-alt
      assert(
        "Alt + decorative false → 'has-alt'",
        MathPixImageRegistry.getAltCompletionStatus({
          altText: "A diagram",
          decorative: false,
        }) === "has-alt",
      );

      // Alt present + decorative true → decorative
      assert(
        "Alt + decorative true → 'decorative'",
        MathPixImageRegistry.getAltCompletionStatus({
          altText: "A diagram",
          decorative: true,
        }) === "decorative",
      );

      // Empty alt + decorative true → decorative
      assert(
        "Empty alt + decorative true → 'decorative'",
        MathPixImageRegistry.getAltCompletionStatus({
          altText: "",
          decorative: true,
        }) === "decorative",
      );

      // Null entry → no-alt
      assert(
        "Null entry → 'no-alt'",
        MathPixImageRegistry.getAltCompletionStatus(null) === "no-alt",
      );

      // Non-object entry → no-alt
      assert(
        "String entry → 'no-alt'",
        MathPixImageRegistry.getAltCompletionStatus("string") === "no-alt",
      );
      assert(
        "Number entry → 'no-alt'",
        MathPixImageRegistry.getAltCompletionStatus(42) === "no-alt",
      );
      assert(
        "Undefined entry → 'no-alt'",
        MathPixImageRegistry.getAltCompletionStatus(undefined) === "no-alt",
      );

      // Real registry entry round-trip
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd1);
      const id = reg.getAllImages()[0]?.id;
      reg.updateAltText(id, "Real alt text", "user");
      assert(
        "Real entry with alt → 'has-alt'",
        MathPixImageRegistry.getAltCompletionStatus(reg.getImage(id)) ===
          "has-alt",
      );
      reg.updateDecorative(id, true);
      assert(
        "Real entry decorative → 'decorative'",
        MathPixImageRegistry.getAltCompletionStatus(reg.getImage(id)) ===
          "decorative",
      );
    }

    // ========================================================================
    // GROUP 35: originalSyntax FIELD (Stage 1 prep)
    // ========================================================================
    console.log("\n--- 35. originalSyntax field ---");

    {
      // 1. Default value — the createDefaultEntry() literal is null. Probe via
      // fromJSON on an imgData object lacking both keys: the retrofill yields
      // null when there's no syntax to fall back to, which matches the default.
      const probeReg = new MathPixImageRegistry();
      probeReg.fromJSON({
        version: "1.0",
        images: [{ id: "img-probe" }],
      });
      const probe = probeReg.getImage("img-probe");
      assert(
        "Default entry: originalSyntax field exists with null default",
        probe !== null && probe.originalSyntax === null,
      );

      // 2. Populated on buildFromMMD for markdown image (matches `syntax`)
      const regMd = new MathPixImageRegistry();
      regMd.buildFromMMD(mmd1);
      const mdImg = regMd.getAllImages()[0];
      assert(
        "buildFromMMD markdown: originalSyntax === 'markdown' (matches syntax)",
        mdImg?.originalSyntax === "markdown" &&
          mdImg?.originalSyntax === mdImg?.syntax,
      );

      // 3. Populated on buildFromMMD for includegraphics image
      const regLatex = new MathPixImageRegistry();
      regLatex.buildFromMMD(mmd8);
      const latexImg = regLatex.getAllImages()[0];
      assert(
        "buildFromMMD includegraphics: originalSyntax === 'includegraphics' (matches syntax)",
        latexImg?.originalSyntax === "includegraphics" &&
          latexImg?.originalSyntax === latexImg?.syntax,
      );

      // 4. addImage default — when originalSyntax not supplied, derives from syntax
      const regAdd = new MathPixImageRegistry();
      const addedDefault = regAdd.addImage({ syntax: "markdown" });
      assert(
        "addImage without originalSyntax: defaults from syntax 'markdown'",
        addedDefault?.originalSyntax === "markdown",
      );

      // 5. addImage explicit — both fields preserved as given
      const regExplicit = new MathPixImageRegistry();
      const addedExplicit = regExplicit.addImage({
        syntax: "includegraphics",
        originalSyntax: "markdown",
      });
      assert(
        "addImage explicit: syntax preserved as 'includegraphics'",
        addedExplicit?.syntax === "includegraphics",
      );
      assert(
        "addImage explicit: originalSyntax preserved as 'markdown'",
        addedExplicit?.originalSyntax === "markdown",
      );

      // 6. replaceImage preserves originalSyntax when not supplied
      const regReplace = new MathPixImageRegistry();
      regReplace.buildFromMMD(mmd1);
      const replaceId = regReplace.getAllImages()[0]?.id;
      regReplace.replaceImage(replaceId, {
        originalUrl: "replaced.png",
        syntax: "includegraphics",
      });
      const replaced = regReplace.getImage(replaceId);
      assert(
        "replaceImage: syntax updated to 'includegraphics'",
        replaced?.syntax === "includegraphics",
      );
      assert(
        "replaceImage: originalSyntax preserved as 'markdown'",
        replaced?.originalSyntax === "markdown",
      );

      // 7. toJSON / fromJSON round-trip
      const regRT1 = new MathPixImageRegistry();
      regRT1.buildFromMMD(mmd2);
      const json = JSON.parse(JSON.stringify(regRT1.toJSON()));
      const regRT2 = new MathPixImageRegistry();
      regRT2.fromJSON(json);
      const rtImages = regRT2.getAllImages();
      const allHaveOriginalSyntax = rtImages.every(
        (img) => img.originalSyntax === img.syntax,
      );
      assert(
        "toJSON/fromJSON round-trip: originalSyntax survives for all entries",
        allHaveOriginalSyntax,
      );

      // 8. Legacy JSON retrofill — markdown
      const regLegacyMd = new MathPixImageRegistry();
      regLegacyMd.fromJSON({
        version: "1.0",
        images: [{ id: "img-legacy-md", syntax: "markdown" }],
      });
      const legacyMd = regLegacyMd.getImage("img-legacy-md");
      assert(
        "Legacy JSON (markdown, no originalSyntax): retrofills to 'markdown'",
        legacyMd?.originalSyntax === "markdown",
      );

      // 8b. Legacy JSON retrofill — includegraphics
      const regLegacyLatex = new MathPixImageRegistry();
      regLegacyLatex.fromJSON({
        version: "1.0",
        images: [{ id: "img-legacy-latex", syntax: "includegraphics" }],
      });
      const legacyLatex = regLegacyLatex.getImage("img-legacy-latex");
      assert(
        "Legacy JSON (includegraphics, no originalSyntax): retrofills to 'includegraphics'",
        legacyLatex?.originalSyntax === "includegraphics",
      );

      // 9. Legacy JSON with both syntax and originalSyntax absent → null
      const regLegacyEmpty = new MathPixImageRegistry();
      regLegacyEmpty.fromJSON({
        version: "1.0",
        images: [{ id: "img-legacy-empty" }],
      });
      const legacyEmpty = regLegacyEmpty.getImage("img-legacy-empty");
      assert(
        "Legacy JSON (neither field): originalSyntax defaults to null",
        legacyEmpty?.originalSyntax === null,
      );
    }

    // ========================================================================
    // GROUP 36: updateImageReference — narrow reference refresh
    // ========================================================================
    console.log("\n--- 36. updateImageReference ---");
    {
      // Shared fixture: CDN-linked markdown image. Initial state is well-known
      // (status="cdn-linked", replacedAt=null, originalSyntax="markdown",
      // isModified=false) so we can detect any unintended mutation precisely.
      const mmdRef = "Hello\n![](https://cdn.mathpix.com/x.png)\nWorld";

      // 1. Method updates fields correctly
      const reg1 = new MathPixImageRegistry();
      reg1.buildFromMMD(mmdRef);
      const id1 = reg1.getAllImages()[0].id;
      const newRef =
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/x.png}";
      const ok1 = reg1.updateImageReference(id1, newRef, "includegraphics");
      const after1 = reg1.getImage(id1);
      assert(
        "updateImageReference: returns true on success",
        ok1 === true,
      );
      assert(
        "updateImageReference: mmdReference + syntax updated",
        after1.mmdReference === newRef && after1.syntax === "includegraphics",
        `mmdReference="${after1.mmdReference}" syntax="${after1.syntax}"`,
      );

      // 2. Status preserved
      assert(
        "updateImageReference: status preserved (cdn-linked, not user-replaced)",
        after1.status === "cdn-linked",
        `got "${after1.status}"`,
      );

      // 3. replacedAt preserved
      assert(
        "updateImageReference: replacedAt preserved (null on fresh CDN entry)",
        after1.replacedAt === null,
        `got ${JSON.stringify(after1.replacedAt)}`,
      );

      // 4. originalSyntax preserved
      assert(
        "updateImageReference: originalSyntax preserved",
        after1.originalSyntax === "markdown",
        `got "${after1.originalSyntax}"`,
      );

      // 5. isModified set to true
      assert(
        "updateImageReference: isModified set to true",
        after1.isModified === true,
      );

      // 6. registry-level lastUpdated metadata refreshed.
      // Note: this entry-shape does NOT carry a per-entry `lastUpdated` field;
      // the established convention (matching updateAltText / updateTitle / etc.)
      // is to refresh the registry's `_metadata.lastUpdated`. We assert that
      // metadata changed across the call, which is the equivalent observable.
      const reg2 = new MathPixImageRegistry();
      reg2.buildFromMMD(mmdRef);
      const id2 = reg2.getAllImages()[0].id;
      const metaBefore = reg2.getMetadata().lastUpdated;
      // Force a measurable delay so toISOString differs even on fast clocks.
      const t0 = Date.now();
      while (Date.now() === t0) {
        /* tight loop, exits after 1ms */
      }
      reg2.updateImageReference(id2, newRef, "includegraphics");
      const metaAfter = reg2.getMetadata().lastUpdated;
      assert(
        "updateImageReference: registry lastUpdated metadata refreshed",
        metaBefore !== metaAfter,
        `before="${metaBefore}" after="${metaAfter}"`,
      );

      // 7. Returns false for unknown id
      const reg3 = new MathPixImageRegistry();
      reg3.buildFromMMD(mmdRef);
      const beforeAll3 = JSON.stringify(reg3.getAllImages());
      const ok3 = reg3.updateImageReference("bogus-id-xyz", newRef, "markdown");
      const afterAll3 = JSON.stringify(reg3.getAllImages());
      assert(
        "updateImageReference: returns false on unknown id, no mutation",
        ok3 === false && beforeAll3 === afterAll3,
      );

      // 8. Returns false for invalid syntax (entry unchanged)
      const reg4 = new MathPixImageRegistry();
      reg4.buildFromMMD(mmdRef);
      const id4 = reg4.getAllImages()[0].id;
      const before4 = reg4.getImage(id4);
      const ok4 = reg4.updateImageReference(id4, newRef, "html");
      const after4 = reg4.getImage(id4);
      assert(
        "updateImageReference: returns false on invalid syntax, entry unchanged",
        ok4 === false &&
          after4.mmdReference === before4.mmdReference &&
          after4.syntax === before4.syntax,
        `ok=${ok4} mmdRefSame=${after4.mmdReference === before4.mmdReference} syntaxSame=${after4.syntax === before4.syntax}`,
      );
    }

    // ========================================================================
    // GROUP 37: getMetadataStatus (Stage 4.A) — locks the Q3 helper
    // ========================================================================
    console.log("\n--- 37. getMetadataStatus (Stage 4.A) ---");

    {
      // 1. Defensive defaults — null
      const nullResult = MathPixImageRegistry.getMetadataStatus(null);
      assert(
        "getMetadataStatus(null): hasCaption === false",
        nullResult.hasCaption === false,
      );
      assert(
        "getMetadataStatus(null): altState === 'no-alt'",
        nullResult.altState === "no-alt",
      );
      assert(
        "getMetadataStatus(null): longDescState === 'no-longdesc'",
        nullResult.longDescState === "no-longdesc",
      );

      // 2. Defensive defaults — non-object (string)
      const stringResult = MathPixImageRegistry.getMetadataStatus(
        "not an object",
      );
      assert(
        "getMetadataStatus(string): defensive defaults across all three dimensions",
        stringResult.hasCaption === false &&
          stringResult.altState === "no-alt" &&
          stringResult.longDescState === "no-longdesc",
      );

      // 3. Defensive defaults — undefined
      const undefResult = MathPixImageRegistry.getMetadataStatus(undefined);
      assert(
        "getMetadataStatus(undefined): defensive defaults across all three dimensions",
        undefResult.hasCaption === false &&
          undefResult.altState === "no-alt" &&
          undefResult.longDescState === "no-longdesc",
      );

      // 4. Empty entry — all empty strings, not decorative
      const emptyEntry = {
        title: "",
        altText: "",
        longDescription: "",
        decorative: false,
      };
      const emptyResult = MathPixImageRegistry.getMetadataStatus(emptyEntry);
      assert(
        "Empty entry: hasCaption === false",
        emptyResult.hasCaption === false,
      );
      assert(
        "Empty entry: altState === 'no-alt'",
        emptyResult.altState === "no-alt",
      );
      assert(
        "Empty entry: longDescState === 'no-longdesc'",
        emptyResult.longDescState === "no-longdesc",
      );

      // 5. Caption only
      const captionOnly = {
        title: "A caption",
        altText: "",
        longDescription: "",
        decorative: false,
      };
      const captionResult = MathPixImageRegistry.getMetadataStatus(captionOnly);
      assert(
        "Caption only: hasCaption === true",
        captionResult.hasCaption === true,
      );
      assert(
        "Caption only: altState === 'no-alt'",
        captionResult.altState === "no-alt",
      );
      assert(
        "Caption only: longDescState === 'no-longdesc'",
        captionResult.longDescState === "no-longdesc",
      );

      // 6. Alt only
      const altOnly = {
        title: "",
        altText: "Some alt",
        longDescription: "",
        decorative: false,
      };
      const altResult = MathPixImageRegistry.getMetadataStatus(altOnly);
      assert(
        "Alt only: hasCaption === false",
        altResult.hasCaption === false,
      );
      assert(
        "Alt only: altState === 'has-alt'",
        altResult.altState === "has-alt",
      );
      assert(
        "Alt only: longDescState === 'no-longdesc'",
        altResult.longDescState === "no-longdesc",
      );

      // 7. Long description only
      const longDescOnly = {
        title: "",
        altText: "",
        longDescription: "Some long description",
        decorative: false,
      };
      const longDescResult =
        MathPixImageRegistry.getMetadataStatus(longDescOnly);
      assert(
        "Long description only: hasCaption === false",
        longDescResult.hasCaption === false,
      );
      assert(
        "Long description only: altState === 'no-alt'",
        longDescResult.altState === "no-alt",
      );
      assert(
        "Long description only: longDescState === 'has-longdesc'",
        longDescResult.longDescState === "has-longdesc",
      );

      // 8. All three set, not decorative
      const allSet = {
        title: "Caption",
        altText: "Alt",
        longDescription: "Long",
        decorative: false,
      };
      const allSetResult = MathPixImageRegistry.getMetadataStatus(allSet);
      assert(
        "All three set: hasCaption === true",
        allSetResult.hasCaption === true,
      );
      assert(
        "All three set: altState === 'has-alt'",
        allSetResult.altState === "has-alt",
      );
      assert(
        "All three set: longDescState === 'has-longdesc'",
        allSetResult.longDescState === "has-longdesc",
      );

      // 9. Decorative, caption set, alt/longDesc empty
      const decorativeCaption = {
        title: "Caption",
        altText: "",
        longDescription: "",
        decorative: true,
      };
      const decorativeCaptionResult =
        MathPixImageRegistry.getMetadataStatus(decorativeCaption);
      assert(
        "Decorative + caption: hasCaption === true",
        decorativeCaptionResult.hasCaption === true,
      );
      assert(
        "Decorative + caption: altState === 'decorative'",
        decorativeCaptionResult.altState === "decorative",
      );
      assert(
        "Decorative + caption: longDescState === 'decorative'",
        decorativeCaptionResult.longDescState === "decorative",
      );

      // 10. Decorative + altText/longDescription conflict (legacy/MMD-reconcile path)
      const decorativeConflict = {
        title: "",
        altText: "Should be invisible",
        longDescription: "Should also be invisible",
        decorative: true,
      };
      const decorativeConflictResult =
        MathPixImageRegistry.getMetadataStatus(decorativeConflict);
      assert(
        "Decorative + altText conflict: altState === 'decorative' (decorative wins, stored altText hidden per Q2)",
        decorativeConflictResult.altState === "decorative",
      );
      assert(
        "Decorative + longDescription conflict: longDescState === 'decorative' (same logic)",
        decorativeConflictResult.longDescState === "decorative",
      );

      // 11. Integration with getAltCompletionStatus — delegation contract
      const integrationEntry = {
        title: "",
        altText: "Alt",
        longDescription: "",
        decorative: false,
      };
      const metaState =
        MathPixImageRegistry.getMetadataStatus(integrationEntry).altState;
      const altCompletionState =
        MathPixImageRegistry.getAltCompletionStatus(integrationEntry);
      assert(
        "Integration: getMetadataStatus.altState === getAltCompletionStatus (delegation contract)",
        metaState === altCompletionState,
      );

      // 12. Legacy entry without new fields
      const legacyEntry = {
        id: "img-legacy",
        syntax: "markdown",
        originalUrl: "test.png",
      };
      const legacyResult = MathPixImageRegistry.getMetadataStatus(legacyEntry);
      assert(
        "Legacy entry: hasCaption === false",
        legacyResult.hasCaption === false,
      );
      assert(
        "Legacy entry: altState === 'no-alt'",
        legacyResult.altState === "no-alt",
      );
      assert(
        "Legacy entry: longDescState === 'no-longdesc'",
        legacyResult.longDescState === "no-longdesc",
      );
    }

    // ========================================================================
    // GROUP 38: syncMmdReferenceForRestore — narrow restore-time sync
    // ========================================================================
    console.log("\n--- 38. syncMmdReferenceForRestore ---");
    {
      // Shared fixture: CDN-linked markdown image. Initial state is well-known
      // so we can detect any unintended side effect precisely. This setter is
      // intentionally distinct from updateImageReference (GROUP 36): it MUST
      // NOT flip isModified and MUST NOT touch _metadata.lastUpdated, because
      // it represents restore-time bookkeeping rather than a user edit.
      const mmdRefFixture =
        "Hello\n![](https://cdn.mathpix.com/sync.png)\nWorld";

      // 1. Method updates mmdReference correctly and returns true
      const regA = new MathPixImageRegistry();
      regA.buildFromMMD(mmdRefFixture);
      const idA = regA.getAllImages()[0].id;
      const newRefA = "![](blob:http://localhost/sync-A)";
      const okA = regA.syncMmdReferenceForRestore(idA, newRefA);
      const afterA = regA.getImage(idA);
      assert(
        "syncMmdReferenceForRestore: returns true on success",
        okA === true,
      );
      assert(
        "syncMmdReferenceForRestore: mmdReference updated to new value",
        afterA.mmdReference === newRefA,
        `got "${afterA.mmdReference}"`,
      );

      // 2. syntax is preserved (no syntax parameter on this setter)
      assert(
        "syncMmdReferenceForRestore: syntax preserved (no syntax param)",
        afterA.syntax === "markdown",
        `got "${afterA.syntax}"`,
      );

      // 3. isModified MUST remain false (restore is bookkeeping, not user edit)
      assert(
        "syncMmdReferenceForRestore: isModified remains false (not a user edit)",
        afterA.isModified === false,
        `got ${afterA.isModified}`,
      );

      // 4. status preserved
      assert(
        "syncMmdReferenceForRestore: status preserved (cdn-linked)",
        afterA.status === "cdn-linked",
        `got "${afterA.status}"`,
      );

      // 5. _metadata.lastUpdated NOT touched
      const regB = new MathPixImageRegistry();
      regB.buildFromMMD(mmdRefFixture);
      const idB = regB.getAllImages()[0].id;
      const metaBeforeB = regB.getMetadata().lastUpdated;
      // Force a measurable delay so toISOString would differ if anything ticked.
      const t0 = Date.now();
      while (Date.now() === t0) {
        /* tight loop, exits after 1ms */
      }
      regB.syncMmdReferenceForRestore(
        idB,
        "![](blob:http://localhost/sync-B)",
      );
      const metaAfterB = regB.getMetadata().lastUpdated;
      assert(
        "syncMmdReferenceForRestore: registry lastUpdated metadata NOT touched",
        metaBeforeB === metaAfterB,
        `before="${metaBeforeB}" after="${metaAfterB}"`,
      );

      // 6. isModified preserved when it was true before the call
      //    (the setter must not REGRESS state either — if a prior user edit
      //    set isModified, restore bookkeeping shouldn't undo that.)
      const regC = new MathPixImageRegistry();
      regC.buildFromMMD(mmdRefFixture);
      const idC = regC.getAllImages()[0].id;
      regC.updateAltText(idC, "user edited", "user"); // flips isModified=true
      const isModifiedBeforeC = regC.getImage(idC).isModified;
      regC.syncMmdReferenceForRestore(
        idC,
        "![user edited](blob:http://localhost/sync-C)",
      );
      const isModifiedAfterC = regC.getImage(idC).isModified;
      assert(
        "syncMmdReferenceForRestore: isModified preserved (true stays true)",
        isModifiedBeforeC === true && isModifiedAfterC === true,
        `before=${isModifiedBeforeC} after=${isModifiedAfterC}`,
      );

      // 7. Returns false for unknown id, no mutation
      const regD = new MathPixImageRegistry();
      regD.buildFromMMD(mmdRefFixture);
      const beforeAllD = JSON.stringify(regD.getAllImages());
      const okD = regD.syncMmdReferenceForRestore(
        "bogus-id-xyz",
        "![](blob:nope)",
      );
      const afterAllD = JSON.stringify(regD.getAllImages());
      assert(
        "syncMmdReferenceForRestore: returns false on unknown id, no mutation",
        okD === false && beforeAllD === afterAllD,
      );

      // 8. Returns false for invalid (non-string) id
      const regE = new MathPixImageRegistry();
      regE.buildFromMMD(mmdRefFixture);
      const okE1 = regE.syncMmdReferenceForRestore(null, "![](blob:x)");
      const okE2 = regE.syncMmdReferenceForRestore(123, "![](blob:x)");
      const okE3 = regE.syncMmdReferenceForRestore("", "![](blob:x)");
      assert(
        "syncMmdReferenceForRestore: returns false on null/non-string/empty id",
        okE1 === false && okE2 === false && okE3 === false,
        `null=${okE1} number=${okE2} empty=${okE3}`,
      );

      // 9. Returns false for empty/non-string mmdReference (entry unchanged)
      const regF = new MathPixImageRegistry();
      regF.buildFromMMD(mmdRefFixture);
      const idF = regF.getAllImages()[0].id;
      const refBeforeF = regF.getImage(idF).mmdReference;
      const okF1 = regF.syncMmdReferenceForRestore(idF, "");
      const okF2 = regF.syncMmdReferenceForRestore(idF, null);
      const okF3 = regF.syncMmdReferenceForRestore(idF, 42);
      const refAfterF = regF.getImage(idF).mmdReference;
      assert(
        "syncMmdReferenceForRestore: returns false on empty/non-string ref, entry unchanged",
        okF1 === false &&
          okF2 === false &&
          okF3 === false &&
          refAfterF === refBeforeF,
        `okF1=${okF1} okF2=${okF2} okF3=${okF3} refSame=${refAfterF === refBeforeF}`,
      );
    }

    // ========================================================================
    // GROUP 39: syncOriginalUrlForRestore — narrow restore-time sync
    // (Discovery 23 — mirrors GROUP 38's syncMmdReferenceForRestore shape)
    // ========================================================================
    console.log("\n--- 39. syncOriginalUrlForRestore ---");
    {
      // Shared fixture: CDN-linked markdown image. Initial state is well-known
      // so we can detect any unintended side effect precisely. This setter is
      // intentionally distinct from replaceImage: it MUST NOT flip status to
      // "user-replaced", MUST NOT flip isModified, and MUST NOT touch
      // _metadata.lastUpdated, because it represents restore-time bookkeeping
      // rather than a user-initiated replacement.
      const urlFixture =
        "Hello\n![](https://cdn.mathpix.com/orig.png)\nWorld";

      // 1. Method updates originalUrl correctly and returns true
      const regA = new MathPixImageRegistry();
      regA.buildFromMMD(urlFixture);
      const idA = regA.getAllImages()[0].id;
      const newUrlA = "https://cdn.example.test/refreshed-A.png";
      const okA = regA.syncOriginalUrlForRestore(idA, newUrlA);
      const afterA = regA.getImage(idA);
      assert(
        "syncOriginalUrlForRestore: returns true on success",
        okA === true,
      );
      assert(
        "syncOriginalUrlForRestore: originalUrl updated to new value",
        afterA.originalUrl === newUrlA,
        `got "${afterA.originalUrl}"`,
      );

      // 2. mmdReference preserved (not touched by this setter)
      assert(
        "syncOriginalUrlForRestore: mmdReference preserved",
        afterA.mmdReference === regA.getAllImages()[0].mmdReference,
      );

      // 3. isModified MUST remain false (restore is bookkeeping, not user edit)
      assert(
        "syncOriginalUrlForRestore: isModified remains false (not a user edit)",
        afterA.isModified === false,
        `got ${afterA.isModified}`,
      );

      // 4. status MUST NOT flip to "user-replaced" (the bug Discovery 23 fixes)
      assert(
        "syncOriginalUrlForRestore: status preserved (cdn-linked, NOT user-replaced)",
        afterA.status === "cdn-linked",
        `got "${afterA.status}"`,
      );

      // 5. _metadata.lastUpdated NOT touched
      const regB = new MathPixImageRegistry();
      regB.buildFromMMD(urlFixture);
      const idB = regB.getAllImages()[0].id;
      const metaBeforeB = regB.getMetadata().lastUpdated;
      const t0 = Date.now();
      while (Date.now() === t0) {
        /* tight loop, exits after 1ms */
      }
      regB.syncOriginalUrlForRestore(
        idB,
        "https://cdn.example.test/refreshed-B.png",
      );
      const metaAfterB = regB.getMetadata().lastUpdated;
      assert(
        "syncOriginalUrlForRestore: registry lastUpdated metadata NOT touched",
        metaBeforeB === metaAfterB,
        `before="${metaBeforeB}" after="${metaAfterB}"`,
      );

      // 6. isModified preserved when it was true before the call
      const regC = new MathPixImageRegistry();
      regC.buildFromMMD(urlFixture);
      const idC = regC.getAllImages()[0].id;
      regC.updateAltText(idC, "user edited", "user"); // flips isModified=true
      const isModifiedBeforeC = regC.getImage(idC).isModified;
      regC.syncOriginalUrlForRestore(
        idC,
        "https://cdn.example.test/refreshed-C.png",
      );
      const isModifiedAfterC = regC.getImage(idC).isModified;
      assert(
        "syncOriginalUrlForRestore: isModified preserved (true stays true)",
        isModifiedBeforeC === true && isModifiedAfterC === true,
        `before=${isModifiedBeforeC} after=${isModifiedAfterC}`,
      );

      // 7. Returns false for unknown id, no mutation
      const regD = new MathPixImageRegistry();
      regD.buildFromMMD(urlFixture);
      const beforeAllD = JSON.stringify(regD.getAllImages());
      const okD = regD.syncOriginalUrlForRestore(
        "bogus-id-xyz",
        "https://cdn.example.test/nope.png",
      );
      const afterAllD = JSON.stringify(regD.getAllImages());
      assert(
        "syncOriginalUrlForRestore: returns false on unknown id, no mutation",
        okD === false && beforeAllD === afterAllD,
      );

      // 8. Returns false for invalid (null/non-string/empty) id
      const regE = new MathPixImageRegistry();
      regE.buildFromMMD(urlFixture);
      const okE1 = regE.syncOriginalUrlForRestore(null, "https://cdn.example.test/x.png");
      const okE2 = regE.syncOriginalUrlForRestore(123, "https://cdn.example.test/x.png");
      const okE3 = regE.syncOriginalUrlForRestore("", "https://cdn.example.test/x.png");
      assert(
        "syncOriginalUrlForRestore: returns false on null/non-string/empty id",
        okE1 === false && okE2 === false && okE3 === false,
        `null=${okE1} number=${okE2} empty=${okE3}`,
      );

      // 9. Returns false for empty/non-string url (entry unchanged)
      const regF = new MathPixImageRegistry();
      regF.buildFromMMD(urlFixture);
      const idF = regF.getAllImages()[0].id;
      const urlBeforeF = regF.getImage(idF).originalUrl;
      const okF1 = regF.syncOriginalUrlForRestore(idF, "");
      const okF2 = regF.syncOriginalUrlForRestore(idF, null);
      const okF3 = regF.syncOriginalUrlForRestore(idF, 42);
      const urlAfterF = regF.getImage(idF).originalUrl;
      assert(
        "syncOriginalUrlForRestore: returns false on empty/non-string url, entry unchanged",
        okF1 === false &&
          okF2 === false &&
          okF3 === false &&
          urlAfterF === urlBeforeF,
        `okF1=${okF1} okF2=${okF2} okF3=${okF3} urlSame=${urlAfterF === urlBeforeF}`,
      );
    }

    // ========================================================================
    // GROUP 40: syncDataUriForRestore — narrow restore-time sync
    // (Discovery 23 — mirrors GROUP 38's syncMmdReferenceForRestore shape)
    // ========================================================================
    console.log("\n--- 40. syncDataUriForRestore ---");
    {
      // Shared fixture: CDN-linked markdown image. Tests parallel GROUP 39's
      // structure exactly — only the field name and target value differ.
      const dataUriFixture =
        "Hello\n![](https://cdn.mathpix.com/du.png)\nWorld";
      const sampleDataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

      // 1. Method updates dataUri correctly and returns true
      const regA = new MathPixImageRegistry();
      regA.buildFromMMD(dataUriFixture);
      const idA = regA.getAllImages()[0].id;
      const okA = regA.syncDataUriForRestore(idA, sampleDataUri);
      const afterA = regA.getImage(idA);
      assert(
        "syncDataUriForRestore: returns true on success",
        okA === true,
      );
      assert(
        "syncDataUriForRestore: dataUri updated to new value",
        afterA.dataUri === sampleDataUri,
      );

      // 2. mmdReference preserved (not touched by this setter)
      assert(
        "syncDataUriForRestore: mmdReference preserved",
        afterA.mmdReference === regA.getAllImages()[0].mmdReference,
      );

      // 3. isModified MUST remain false (restore is bookkeeping, not user edit)
      assert(
        "syncDataUriForRestore: isModified remains false (not a user edit)",
        afterA.isModified === false,
        `got ${afterA.isModified}`,
      );

      // 4. status MUST NOT flip to "user-replaced" (the bug Discovery 23 fixes)
      assert(
        "syncDataUriForRestore: status preserved (cdn-linked, NOT user-replaced)",
        afterA.status === "cdn-linked",
        `got "${afterA.status}"`,
      );

      // 5. _metadata.lastUpdated NOT touched
      const regB = new MathPixImageRegistry();
      regB.buildFromMMD(dataUriFixture);
      const idB = regB.getAllImages()[0].id;
      const metaBeforeB = regB.getMetadata().lastUpdated;
      const t0 = Date.now();
      while (Date.now() === t0) {
        /* tight loop, exits after 1ms */
      }
      regB.syncDataUriForRestore(idB, sampleDataUri);
      const metaAfterB = regB.getMetadata().lastUpdated;
      assert(
        "syncDataUriForRestore: registry lastUpdated metadata NOT touched",
        metaBeforeB === metaAfterB,
        `before="${metaBeforeB}" after="${metaAfterB}"`,
      );

      // 6. isModified preserved when it was true before the call
      const regC = new MathPixImageRegistry();
      regC.buildFromMMD(dataUriFixture);
      const idC = regC.getAllImages()[0].id;
      regC.updateAltText(idC, "user edited", "user"); // flips isModified=true
      const isModifiedBeforeC = regC.getImage(idC).isModified;
      regC.syncDataUriForRestore(idC, sampleDataUri);
      const isModifiedAfterC = regC.getImage(idC).isModified;
      assert(
        "syncDataUriForRestore: isModified preserved (true stays true)",
        isModifiedBeforeC === true && isModifiedAfterC === true,
        `before=${isModifiedBeforeC} after=${isModifiedAfterC}`,
      );

      // 7. Returns false for unknown id, no mutation
      const regD = new MathPixImageRegistry();
      regD.buildFromMMD(dataUriFixture);
      const beforeAllD = JSON.stringify(regD.getAllImages());
      const okD = regD.syncDataUriForRestore("bogus-id-xyz", sampleDataUri);
      const afterAllD = JSON.stringify(regD.getAllImages());
      assert(
        "syncDataUriForRestore: returns false on unknown id, no mutation",
        okD === false && beforeAllD === afterAllD,
      );

      // 8. Returns false for invalid (null/non-string/empty) id
      const regE = new MathPixImageRegistry();
      regE.buildFromMMD(dataUriFixture);
      const okE1 = regE.syncDataUriForRestore(null, sampleDataUri);
      const okE2 = regE.syncDataUriForRestore(123, sampleDataUri);
      const okE3 = regE.syncDataUriForRestore("", sampleDataUri);
      assert(
        "syncDataUriForRestore: returns false on null/non-string/empty id",
        okE1 === false && okE2 === false && okE3 === false,
        `null=${okE1} number=${okE2} empty=${okE3}`,
      );

      // 9. Returns false for empty/non-string dataUri (entry unchanged)
      const regF = new MathPixImageRegistry();
      regF.buildFromMMD(dataUriFixture);
      const idF = regF.getAllImages()[0].id;
      const duBeforeF = regF.getImage(idF).dataUri;
      const okF1 = regF.syncDataUriForRestore(idF, "");
      const okF2 = regF.syncDataUriForRestore(idF, null);
      const okF3 = regF.syncDataUriForRestore(idF, 42);
      const duAfterF = regF.getImage(idF).dataUri;
      assert(
        "syncDataUriForRestore: returns false on empty/non-string dataUri, entry unchanged",
        okF1 === false &&
          okF2 === false &&
          okF3 === false &&
          duAfterF === duBeforeF,
        `okF1=${okF1} okF2=${okF2} okF3=${okF3} duSame=${duAfterF === duBeforeF}`,
      );
    }

    // ========================================================================
    // GROUP 41: buildFromMMD — Q2 preserve / refresh bucketing
    // (Stage 6 — non-destructive reconcile on a populated registry)
    // ========================================================================
    console.log("\n--- 41. buildFromMMD: Q2 preserve / refresh bucketing ---");

    {
      // Fixture: a registry built from one MMD that includes a markdown
      // image plus an includegraphics reference, then user-edited so every
      // preservable field carries a recognisable value. The "same MMD again"
      // reconcile call must leave all those values intact and refresh only
      // the three structural fields.
      const seedMmd =
        "Intro.\n![Initial alt](https://cdn.mathpix.com/g41.png)\nMore text.\n\\includegraphics{https://cdn.mathpix.com/g41inc.png}";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(seedMmd);
      const ids = reg.getAllImages().map((i) => i.id);
      const idMd = reg
        .getAllImages()
        .find((i) => i.syntax === "markdown").id;
      const idInc = reg
        .getAllImages()
        .find((i) => i.syntax === "includegraphics").id;

      // User edits the markdown entry across every preservable surface.
      reg.updateAltText(idMd, "User-edited alt text", "user");
      reg.updateTitle(idMd, "User caption", "user");
      reg.updateLongDescription(idMd, "A long description.", "user");
      reg.updateDecorative(idMd, true);
      reg.updateTextInImage(idMd, "Visible label", "user");
      // Mimic a restore-time provenance touch so we can also confirm status.
      // Discovery 23's setter leaves status as "cdn-linked" — keep that.
      const beforeMd = reg.getImage(idMd);
      assert(
        "41-pre: idMd starts at status cdn-linked",
        beforeMd.status === "cdn-linked",
      );

      // Same MMD again — set-diff should be empty.
      const setDiff1 = reg.buildFromMMD(seedMmd);
      assert(
        "41.1a: same MMD → setDiff.added is empty",
        setDiff1.added.length === 0,
        `got ${setDiff1.added.length}`,
      );
      assert(
        "41.1b: same MMD → setDiff.removed is empty",
        setDiff1.removed.length === 0,
        `got ${setDiff1.removed.length}`,
      );
      assert(
        "41.1c: same MMD → count unchanged",
        reg.getCount() === 2,
        `got ${reg.getCount()}`,
      );
      assert(
        "41.1d: same MMD → IDs unchanged",
        JSON.stringify(reg.getAllImages().map((i) => i.id).sort()) ===
          JSON.stringify([...ids].sort()),
      );

      // Every user-metadata field preserved across the rebuild.
      const afterMd = reg.getImage(idMd);
      assert(
        "41.2a: altText preserved across reconcile",
        afterMd.altText === "User-edited alt text",
      );
      assert(
        "41.2b: altTextSource preserved (user)",
        afterMd.altTextSource === "user",
      );
      assert(
        "41.2c: title preserved across reconcile",
        afterMd.title === "User caption",
      );
      assert(
        "41.2d: titleSource preserved (user)",
        afterMd.titleSource === "user",
      );
      assert(
        "41.2e: longDescription preserved across reconcile",
        afterMd.longDescription === "A long description.",
      );
      assert(
        "41.2f: longDescriptionSource preserved (user)",
        afterMd.longDescriptionSource === "user",
      );
      assert(
        "41.2g: decorative preserved across reconcile (true)",
        afterMd.decorative === true,
      );
      assert(
        "41.2h: textInImage preserved across reconcile",
        afterMd.textInImage === "Visible label",
      );
      assert(
        "41.2i: textInImageSource preserved (user)",
        afterMd.textInImageSource === "user",
      );
      assert(
        "41.2j: status preserved across reconcile (regression guard for Discovery 23 fix)",
        afterMd.status === "cdn-linked",
        `got "${afterMd.status}"`,
      );
      assert(
        "41.2k: originalSyntax preserved (Stage 1 state-machine invariant)",
        afterMd.originalSyntax === "markdown",
        `got "${afterMd.originalSyntax}"`,
      );
      assert(
        "41.2l: originalUrl preserved across reconcile",
        afterMd.originalUrl === "https://cdn.mathpix.com/g41.png",
      );
    }

    {
      // Add an image to the MMD: new entry created, existing preserved.
      const seedMmd =
        "Intro.\n![Existing alt](https://cdn.mathpix.com/g41-keep.png)";
      const expandedMmd =
        "Intro.\n![Existing alt](https://cdn.mathpix.com/g41-keep.png)\nMore.\n![New alt](https://cdn.mathpix.com/g41-new.png)";

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(seedMmd);
      const keptId = reg.getAllImages()[0].id;
      reg.updateAltText(keptId, "USER-EDITED", "user");

      const setDiff = reg.buildFromMMD(expandedMmd);
      assert(
        "41.3a: add-only → setDiff.added.length === 1",
        setDiff.added.length === 1,
        `got ${setDiff.added.length}`,
      );
      assert(
        "41.3b: add-only → setDiff.removed.length === 0",
        setDiff.removed.length === 0,
        `got ${setDiff.removed.length}`,
      );
      assert(
        "41.3c: existing entry still present after add",
        reg.hasImage(keptId),
      );
      assert(
        "41.3d: existing entry's user-edited altText preserved",
        reg.getImage(keptId).altText === "USER-EDITED",
      );
      assert(
        "41.3e: registry count rose to 2",
        reg.getCount() === 2,
      );
    }

    {
      // Remove an image from the MMD: entry removed, others untouched.
      const seedMmd =
        "![A](https://cdn.mathpix.com/g41-a.png)\n\n![B](https://cdn.mathpix.com/g41-b.png)";
      const trimmedMmd = "![A](https://cdn.mathpix.com/g41-a.png)";

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(seedMmd);
      const idA = reg.getAllImages().find((i) => i.altText === "A").id;
      const idB = reg.getAllImages().find((i) => i.altText === "B").id;
      reg.updateAltText(idA, "KEEP_ME", "user");

      const setDiff = reg.buildFromMMD(trimmedMmd);
      assert(
        "41.4a: remove-only → setDiff.added.length === 0",
        setDiff.added.length === 0,
        `got ${setDiff.added.length}`,
      );
      assert(
        "41.4b: remove-only → setDiff.removed.length === 1",
        setDiff.removed.length === 1,
        `got ${setDiff.removed.length}`,
      );
      assert(
        "41.4c: removed entry was idB",
        setDiff.removed[0].id === idB,
      );
      assert(
        "41.4d: surviving entry's user edit preserved",
        reg.getImage(idA)?.altText === "KEEP_ME",
      );
      assert(
        "41.4e: removed entry no longer in registry",
        !reg.hasImage(idB),
      );
    }

    {
      // Mixed add + remove + match in a single reconcile call.
      const seedMmd =
        "![A](https://cdn.mathpix.com/g41-mix-a.png)\n![B](https://cdn.mathpix.com/g41-mix-b.png)";
      const mutatedMmd =
        "![A](https://cdn.mathpix.com/g41-mix-a.png)\n![C](https://cdn.mathpix.com/g41-mix-c.png)";

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(seedMmd);
      const idA = reg.getAllImages().find((i) => i.altText === "A").id;
      const idB = reg.getAllImages().find((i) => i.altText === "B").id;
      reg.updateAltText(idA, "A-USER-EDIT", "user");

      const setDiff = reg.buildFromMMD(mutatedMmd);
      assert(
        "41.5a: mixed → setDiff.added.length === 1 (the new C)",
        setDiff.added.length === 1,
        `got ${setDiff.added.length}`,
      );
      assert(
        "41.5b: mixed → setDiff.removed.length === 1 (the removed B)",
        setDiff.removed.length === 1,
        `got ${setDiff.removed.length}`,
      );
      assert(
        "41.5c: matched entry preserved its user edit",
        reg.getImage(idA)?.altText === "A-USER-EDIT",
      );
      assert(
        "41.5d: removed clone is the old B",
        setDiff.removed[0].id === idB,
      );
    }

    {
      // mmdReference refreshes on match. IDs are hash(url + lineNumber),
      // so a same-URL same-line alt-text edit keeps the ID stable but
      // changes the literal MMD substring — which is exactly what
      // mmdReference is meant to track. The refresh keeps mmdReference
      // in sync with what's actually in the MMD after the user's edit.
      const beforeMmd =
        "![original alt](https://cdn.mathpix.com/g41-struct.png)";
      const afterMmd =
        "![user edited alt text](https://cdn.mathpix.com/g41-struct.png)";

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(beforeMmd);
      const id = reg.getAllImages()[0].id;
      const beforeEntry = reg.getImage(id);
      assert(
        "41.6a: precondition — mmdReference is the before-string",
        beforeEntry.mmdReference ===
          "![original alt](https://cdn.mathpix.com/g41-struct.png)",
      );

      const setDiff = reg.buildFromMMD(afterMmd);
      assert(
        "41.6b: same URL + same line → entry matches (no add/remove)",
        setDiff.added.length === 0 && setDiff.removed.length === 0,
        `added=${setDiff.added.length} removed=${setDiff.removed.length}`,
      );
      const afterEntry = reg.getImage(id);
      assert(
        "41.6c: matched entry mmdReference refreshes to the new literal",
        afterEntry.mmdReference ===
          "![user edited alt text](https://cdn.mathpix.com/g41-struct.png)",
      );
      assert(
        "41.6d: matched entry lineNumber preserved (still 1)",
        afterEntry.lineNumber === 1,
      );
      assert(
        "41.6e: matched entry syntax preserved (still markdown)",
        afterEntry.syntax === "markdown",
      );
    }

    {
      // F-N URL-fallback contract (commit 32069c8, Phase F-N, 2026-05-31;
      // F-N strategy doc "Test 22"). When the user changes which line an
      // image is on (e.g. inserts a paragraph above it), generateStableId
      // hashes `url::lineNumber` so the candidate's hash-derived id drifts.
      // Pass 2 of buildFromMMD recovers the entry by URL: the OLD id is
      // preserved as the Map key, the line-shifted candidate's hash-derived
      // id is discarded, and the entry lands in NEITHER added NOR removed.
      // Its three structural fields (mmdReference, lineNumber, syntax) are
      // refreshed from the candidate while all user metadata is preserved.
      //
      // This REPLACES the pre-F-N model these subtests used to encode
      // (line-move retires the old id → removed, mints a new one → added);
      // that false added/removed pair is exactly what triggered the F-N
      // blob-URL revocation cascade, so the recovery is deliberate. The
      // block remains a regression guard, now under the NEW semantics: any
      // future change to the fallback's classification (dropping Pass 2, or
      // routing the recovered entry through added/removed) surfaces here.
      const beforeMmd =
        "![alt](https://cdn.mathpix.com/g41-linemove.png)";
      const afterMmd =
        "Intro.\n\n![alt](https://cdn.mathpix.com/g41-linemove.png)";

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(beforeMmd);
      // Capture the ID before the rebuild — F-N preserves it across the move.
      const oldId = reg.getAllImages()[0].id;
      reg.updateAltText(oldId, "USER_EDIT", "user");

      const setDiff = reg.buildFromMMD(afterMmd);
      assert(
        "41.7a: line-move → removed is empty (retires nothing)",
        setDiff.removed.length === 0,
        `got ${setDiff.removed.length}`,
      );
      assert(
        "41.7b: line-move → added is empty (mints nothing)",
        setDiff.added.length === 0,
        `got ${setDiff.added.length}`,
      );
      assert(
        "41.7c: line-move → surviving entry keeps its original ID (URL-fallback preserved it)",
        reg.getCount() === 1 && reg.getAllImages()[0].id === oldId,
      );
      assert(
        "41.7d: line-move → surviving entry's lineNumber refreshed to the new line (3)",
        reg.getImage(oldId)?.lineNumber === 3,
        `got ${reg.getImage(oldId)?.lineNumber}`,
      );
      assert(
        "41.7e: line-move → user metadata follows the surviving entry (the point of F-N)",
        reg.getImage(oldId)?.altText === "USER_EDIT",
        `got "${reg.getImage(oldId)?.altText}"`,
      );
      // 41.7f: the recovered entry lands in the URL-fallback bucket — it is
      // counted in setDiff.urlFallback (return field `urlFallback:
      // urlMatches.length`, populated where the Pass-2 match does
      // `urlMatches.push({ existingId, candidate })`) and in setDiff.matched
      // (`matchedIds.size + urlMatches.length`), NOT in added/removed. This
      // positively locks the bucket so a future reclassification is caught.
      assert(
        "41.7f: line-move → entry recovered via the URL-fallback bucket (urlFallback === 1, matched === 1)",
        setDiff.urlFallback === 1 && setDiff.matched === 1,
        `urlFallback=${setDiff.urlFallback} matched=${setDiff.matched}`,
      );
    }

    // ========================================================================
    // GROUP 42: buildFromMMD — Q3 return shape, clones, defensiveness
    // (Stage 6 — diff contract, snapshot-before-delete, error tolerance)
    // ========================================================================
    console.log(
      "\n--- 42. buildFromMMD: Q3 return shape, clones, defensiveness ---",
    );

    {
      // Return shape on an empty input string (fresh registry).
      const reg = new MathPixImageRegistry();
      const setDiff = reg.buildFromMMD("");
      assert(
        "42.1a: empty input returns {added:[], removed:[]}",
        Array.isArray(setDiff.added) &&
          setDiff.added.length === 0 &&
          Array.isArray(setDiff.removed) &&
          setDiff.removed.length === 0,
      );
    }

    {
      // Return shape on a no-change call against a populated registry.
      const mmd = "![Z](https://cdn.mathpix.com/g42-nochange.png)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const setDiff = reg.buildFromMMD(mmd);
      assert(
        "42.2a: no-change call returns empty added",
        setDiff.added.length === 0,
      );
      assert(
        "42.2b: no-change call returns empty removed",
        setDiff.removed.length === 0,
      );
    }

    {
      // Removed clones excluded blob, independent of internal entries.
      const mmd =
        "![Clone test](https://cdn.mathpix.com/g42-clone.png)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;

      // Attach a fake blob so we can verify it's NOT in the clone.
      const fakeBlob = new Blob(["fake"], { type: "image/png" });
      reg.attachBlob(id, fakeBlob);
      assert(
        "42.3-pre: blob attached on internal entry",
        reg._images.get(id).blob === fakeBlob,
      );

      const setDiff = reg.buildFromMMD(""); // remove everything
      assert(
        "42.3a: removed clone has same id as original",
        setDiff.removed.length === 1 && setDiff.removed[0].id === id,
      );
      assert(
        "42.3b: removed clone blob field is null (excluded)",
        setDiff.removed[0].blob === null,
        `got ${setDiff.removed[0].blob}`,
      );

      // Mutating the clone must not affect the (now-empty) registry's
      // sentinel state — and a fresh rebuild from the seed must not pull
      // the mutated value in.
      setDiff.removed[0].altText = "MUTATED_CLONE";
      reg.buildFromMMD(mmd);
      const after = reg.getAllImages()[0];
      assert(
        "42.3c: mutating clone did NOT bleed back into registry",
        after.altText === "Clone test",
        `got "${after.altText}"`,
      );
    }

    {
      // Per-candidate try/catch: a malformed includegraphics block in the
      // middle of an MMD must not abort the reconcile. We use a real
      // URL alongside the malformed one to confirm the good detection
      // still lands. (The current regex tolerates most syntaxes; the
      // assertion is that whatever the regex emits, _createEntryFromDetection
      // throwing on one candidate does not lose the next.)
      const goodMmd = "![ok](https://cdn.mathpix.com/g42-tolerant.png)";
      const reg = new MathPixImageRegistry();

      // Monkey-patch _createEntryFromDetection to throw for the first call,
      // then succeed for the second — this exercises the try/catch path
      // without depending on the regex producing a malformed candidate.
      const originalFn = reg._createEntryFromDetection.bind(reg);
      let callIdx = 0;
      reg._createEntryFromDetection = function (...args) {
        callIdx++;
        if (callIdx === 1) {
          throw new Error("synthetic malformation");
        }
        return originalFn(...args);
      };
      const mmdMulti =
        "![first](https://cdn.mathpix.com/g42-throw.png)\n" + goodMmd;

      // Suppress the expected console.warn from the catch path.
      const originalWarn = console.warn;
      console.warn = function () {};
      let setDiff;
      try {
        setDiff = reg.buildFromMMD(mmdMulti);
      } finally {
        console.warn = originalWarn;
      }
      assert(
        "42.4a: per-candidate try/catch isolates the throw",
        setDiff.added.length === 1,
        `got ${setDiff.added.length}`,
      );
      assert(
        "42.4b: surviving candidate is the second (good) entry",
        reg.getAllImages()[0]?.altText === "ok",
      );
    }

    {
      // Defensive input handling: invalid types return the empty shape
      // without throwing AND without mutating an existing populated registry.
      const mmd = "![hold](https://cdn.mathpix.com/g42-hold.png)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const snapshot = JSON.stringify(reg.getAllImages());

      const nullDiff = reg.buildFromMMD(null);
      assert(
        "42.5a: null does not throw, returns empty shape",
        !!nullDiff && nullDiff.added.length === 0 && nullDiff.removed.length === 0,
      );
      const undefDiff = reg.buildFromMMD(undefined);
      assert(
        "42.5b: undefined does not throw, returns empty shape",
        !!undefDiff && undefDiff.added.length === 0 && undefDiff.removed.length === 0,
      );
      const objDiff = reg.buildFromMMD({});
      assert(
        "42.5c: object does not throw, returns empty shape",
        !!objDiff && objDiff.added.length === 0 && objDiff.removed.length === 0,
      );

      assert(
        "42.5d: invalid-input calls did NOT mutate populated registry",
        JSON.stringify(reg.getAllImages()) === snapshot,
      );
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log("\n" + "=".repeat(60));
    console.log(
      `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`,
    );

    if (failed > 0) {
      console.log("Failed tests:");
      results
        .filter((r) => r.startsWith("❌"))
        .forEach((r) => console.log(`  ${r}`));
    }

    console.log("\n=== Test Suite Complete ===");

    return { passed, failed, total: passed + failed, results };
  };

  // Stage alias for use within the alt-text build plan's vocabulary.
  // Established at module load — must be assignable immediately, not after first run.
  window.runStage0Tests = window.testImageRegistry;

  logInfo("MathPixImageRegistry module loaded");
})();
