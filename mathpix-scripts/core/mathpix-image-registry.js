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

  /** Valid image source types */
  const VALID_IMAGE_SOURCES = ["mathpix-ocr", "user-upload", "user-paste"];

  /** Regex patterns for CDN detection */
  const CDN_PATTERNS = [
    /cdn\.mathpix\.com/,
    /mathpix-ocr-examples\.s3\.amazonaws\.com/,
  ];

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

      logDebug("MathPixImageRegistry instance created");
    }

    // ========================================================================
    // BUILD FROM MMD
    // ========================================================================

    /**
     * Parse MMD content, detect all image references, and populate the registry.
     * Clears any existing entries first. Leverages the same detection patterns
     * as mathpix-ai-mmd-analyser.js detectImages().
     *
     * @param {string} mmd - Raw MMD content
     * @returns {number} Number of images detected (0 for invalid input)
     */
    buildFromMMD(mmd) {
      if (!mmd || typeof mmd !== "string") {
        logWarn("buildFromMMD() called with empty or invalid input");
        return 0;
      }

      const startTime = performance.now();
      logInfo("Building image registry from MMD...", { length: mmd.length });

      // Clear existing entries
      this._images.clear();

      const lines = mmd.split("\n");
      let detectedCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // --- Markdown images: ![alt](url) ---
        // Alt text may contain `]` (e.g. SMILES `[nH]`); the proper terminator
        // is `](`, not the first `]`. Allow `]` in alt-text only when it isn't
        // followed by `(` so chemistry images on markdown-form lines register
        // instead of silently dropping out of the image registry.
        const mdImgRegex = /!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)/g;
        let match;
        while ((match = mdImgRegex.exec(line)) !== null) {
          const altText = match[1];
          const url = match[2];
          const fullMatch = match[0];

          const entry = this._createEntryFromDetection({
            url,
            altText,
            fullMatch,
            lineNumber: lineNum,
            syntax: "markdown",
          });

          this._images.set(entry.id, entry);
          detectedCount++;
        }

        // --- LaTeX \includegraphics[options]{url} ---
        // Use global regex to catch multiple on same line
        const latexImgRegex =
          /\\includegraphics\s*(\[[^\]]*\])?\s*\{([^}]+)\}/g;
        let latexMatch;
        while ((latexMatch = latexImgRegex.exec(line)) !== null) {
          const url = latexMatch[2];
          const fullMatch = latexMatch[0];

          const entry = this._createEntryFromDetection({
            url,
            altText: "",
            fullMatch,
            lineNumber: lineNum,
            syntax: "includegraphics",
          });

          this._images.set(entry.id, entry);
          detectedCount++;
        }
      }

      // Update metadata
      const now = new Date().toISOString();
      if (!this._metadata.createdAt) {
        this._metadata.createdAt = now;
      }
      this._metadata.lastUpdated = now;

      const elapsed = (performance.now() - startTime).toFixed(1);
      logInfo(`Registry built in ${elapsed}ms`, {
        images: detectedCount,
        lines: lines.length,
      });

      return detectedCount;
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
      entry.altTextSource = data.altText ? "user" : null;
      entry.mimeType = data.mimeType || null;
      entry.blob = data.blob instanceof Blob ? data.blob : null;
      entry.fileSize = typeof data.fileSize === "number" ? data.fileSize : null;
      entry.dimensions = data.dimensions || null;
      entry.dataUri = data.dataUri || null;
      entry.lineNumber =
        typeof data.lineNumber === "number" ? data.lineNumber : null;
      entry.syntax = data.syntax || "markdown";
      entry.userNotes = data.userNotes || "";

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
      const count = reg.buildFromMMD(mmd1);
      assert("mmd1: Detects 1 image", count === 1, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd2);
      assert("mmd2: Detects 3 images", count === 3, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd3);
      assert("mmd3: Detects 1 image", count === 1, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd4);
      assert("mmd4: Detects 0 images", count === 0, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd5);
      assert(
        "mmd5: Detects 2 entries (same URL, different lines)",
        count === 2,
        `Got ${count}`,
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
      const count = reg.buildFromMMD(mmd7);
      assert("mmd7: Detects 2 images", count === 2, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd8);
      assert("mmd8: Detects 1 image", count === 1, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd9);
      assert("mmd9: Detects image inside table", count === 1, `Got ${count}`);
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
      const count = reg.buildFromMMD(mmd13);
      assert(
        "mmd13: Image between math blocks detected",
        count === 1,
        `Got ${count}`,
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
      assert("null input returns 0", reg.buildFromMMD(null) === 0);
      assert("undefined input returns 0", reg.buildFromMMD(undefined) === 0);
      assert("number input returns 0", reg.buildFromMMD(42) === 0);
      assert("empty string returns 0", reg.buildFromMMD("") === 0);
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
      // buildFromMMD clears previous state
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd5); // 2 images
      assert("First build: 2 images", reg.getCount() === 2);
      reg.buildFromMMD(mmd1); // 1 image
      assert("Second build clears and rebuilds: 1 image", reg.getCount() === 1);
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

  logInfo("MathPixImageRegistry module loaded");
})();
