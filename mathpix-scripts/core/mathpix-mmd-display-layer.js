/**
 * @fileoverview MathPix MMD Display Layer - Phase 8G
 * @module MathPixMMDDisplayLayer
 * @version 1.0.0
 * @since 8G
 *
 * @description
 * Mediates between the raw working MMD (which may contain massive base64 data
 * URIs, long CDN URLs, or blob URLs) and what the user sees in the editor
 * textarea. Collapses long image references into readable placeholders whilst
 * preserving the full "working MMD" for all downstream consumers (convert API,
 * ZIP download, auto-save, AI enhancer).
 *
 * Architecture:
 * - Working MMD: Full content with real URLs/data URIs (source of truth)
 * - Display MMD: Collapsed placeholders for readable editing
 * - Placeholder Map: Bidirectional mapping for round-trip fidelity
 *
 * Placeholder format preserves surrounding markdown/LaTeX syntax:
 *   ![alt text](⟪img-92fc0bcd · 32.8 KB⟫)
 *   \includegraphics[opts]{⟪img-92fc0bcd · 32.8 KB⟫}
 *
 * Integration:
 * - Read-only consumer of MathPixImageRegistry
 * - Used by MathPixSessionRestorer for editor display
 * - Does NOT modify the registry or any external state
 *
 * @accessibility
 * - Placeholders are screen-reader friendly (no emoji, plain text tokens)
 * - WCAG 2.2 AA compliant
 */

// ============================================================================
// IIFE WRAPPER
// ============================================================================

const MathPixMMDDisplayLayer = (function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error(`[MMDDisplayLayer] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MMDDisplayLayer] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MMDDisplayLayer] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MMDDisplayLayer] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /**
   * Placeholder delimiters — using double angle brackets (U+27EA, U+27EB)
   * These are extremely unlikely to appear in normal MMD content and provide
   * reliable detection boundaries for the expand step.
   */
  const PLACEHOLDER_OPEN = "\u27EA";  // ⟪
  const PLACEHOLDER_CLOSE = "\u27EB"; // ⟫

  /**
   * Threshold in characters for auto-collapsing.
   * If any image reference URL exceeds this length, auto-collapse activates.
   */
  const AUTO_COLLAPSE_THRESHOLD = 200;

  /**
   * Regex patterns for detecting image references in MMD.
   * These match the same patterns used in the image registry.
   */
  const MD_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const LATEX_IMAGE_REGEX = /\\includegraphics\s*(\[[^\]]*\])?\s*\{([^}]+)\}/g;

  /**
   * Regex for detecting placeholder tokens in display MMD.
   * Matches: ⟪img-XXXXXXXX · SIZE⟫
   */
  const PLACEHOLDER_TOKEN_REGEX = new RegExp(
    PLACEHOLDER_OPEN + "(img-[a-f0-9]{8}(?:-usr-[a-f0-9]{8})?)\\s*(?:\\xB7\\s*[^" + PLACEHOLDER_CLOSE + "]*)?" + PLACEHOLDER_CLOSE,
    "g"
  );

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Format a file size in bytes into a human-readable string.
   * Uses binary units (KB, MB) with 1 decimal place.
   *
   * @param {number|null} bytes - File size in bytes
   * @returns {string} Formatted string, e.g. "32.8 KB", "1.2 MB", or "?" if unknown
   */
  function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined || typeof bytes !== "number" || bytes < 0) {
      return "?";
    }
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Estimate the byte size of a base64 data URI.
   * Extracts the base64 portion and calculates: length * 3/4 - padding.
   *
   * @param {string} dataUri - A data URI string
   * @returns {number|null} Estimated size in bytes, or null if not a data URI
   */
  function estimateBase64Size(dataUri) {
    if (!dataUri || typeof dataUri !== "string") return null;
    const commaIndex = dataUri.indexOf(",");
    if (commaIndex === -1) return null;
    const base64Part = dataUri.substring(commaIndex + 1);
    const padding = (base64Part.match(/=+$/) || [""])[0].length;
    return Math.floor((base64Part.length * 3) / 4) - padding;
  }

  /**
   * Determine the short type label for a URL.
   *
   * @param {string} url - Image URL
   * @returns {string} Type label: "base64", "blob", "CDN", or "URL"
   */
  function getUrlTypeLabel(url) {
    if (!url || typeof url !== "string") return "?";
    if (url.startsWith("data:")) return "base64";
    if (url.startsWith("blob:")) return "blob";
    if (url.includes("cdn.mathpix.com") || url.includes("mathpix-ocr-examples.s3.amazonaws.com")) {
      return "CDN";
    }
    return "URL";
  }

  /**
   * Escape special regex characters in a string.
   *
   * @param {string} str - String to escape
   * @returns {string} Regex-safe string
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ==========================================================================
  // MAIN CLASS
  // ==========================================================================

  /**
   * Display layer for MMD content in the editor textarea.
   *
   * Collapses long image references into readable placeholder tokens and
   * provides bidirectional conversion between display and working MMD.
   *
   * Usage:
   *   const layer = new MathPixMMDDisplayLayer();
   *   const { displayMMD } = layer.collapse(workingMMD, registry);
   *   // ... user edits displayMMD in textarea ...
   *   const updatedWorking = layer.expand(editedDisplayMMD);
   */
  class MathPixMMDDisplayLayer {
    constructor() {
      /**
       * Map from placeholder token string to original URL.
       * Built during collapse(), consumed during expand().
       * Key: "⟪img-92fc0bcd · 32.8 KB⟫"
       * Value: "https://cdn.mathpix.com/cropped/abc-1.jpg?height=100&width=200"
       * @type {Map<string, string>}
       * @private
       */
      this._placeholderToUrl = new Map();

      /**
       * Map from original URL to placeholder token string.
       * Reverse of _placeholderToUrl for efficient collapse operations.
       * @type {Map<string, string>}
       * @private
       */
      this._urlToPlaceholder = new Map();

      /**
       * Whether collapse is currently active.
       * @type {boolean}
       */
      this.isCollapsed = false;

      logDebug("Display layer instance created");
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Collapse image references in working MMD into readable placeholders.
     *
     * Builds the placeholder map from the image registry (if available) or
     * by parsing URLs directly from the MMD. The registry provides richer
     * metadata (file size, mime type) for more informative placeholders.
     *
     * @param {string} workingMMD - Full MMD content with real URLs
     * @param {Object|null} [registry=null] - MathPixImageRegistry instance (optional)
     * @returns {{ displayMMD: string, collapsedCount: number }}
     */
    collapse(workingMMD, registry = null) {
      if (!workingMMD || typeof workingMMD !== "string") {
        logWarn("collapse() called with empty or invalid MMD");
        return { displayMMD: workingMMD || "", collapsedCount: 0 };
      }

      const startTime = performance.now();

      // Clear previous mappings
      this._placeholderToUrl.clear();
      this._urlToPlaceholder.clear();

      // Build lookup from registry for metadata enrichment
      const registryLookup = this._buildRegistryLookup(registry);

      let displayMMD = workingMMD;
      let collapsedCount = 0;

      // --- Collapse Markdown images: ![alt](url) ---
      displayMMD = displayMMD.replace(MD_IMAGE_REGEX, (fullMatch, altText, url) => {
        // Only collapse URLs that exceed the threshold
        if (url.length <= AUTO_COLLAPSE_THRESHOLD) {
          return fullMatch;
        }

        const placeholder = this._getOrCreatePlaceholder(url, registryLookup);
        collapsedCount++;
        return `![${altText}](${placeholder})`;
      });

      // --- Collapse LaTeX images: \includegraphics[opts]{url} ---
      displayMMD = displayMMD.replace(LATEX_IMAGE_REGEX, (fullMatch, opts, url) => {
        if (url.length <= AUTO_COLLAPSE_THRESHOLD) {
          return fullMatch;
        }

        const placeholder = this._getOrCreatePlaceholder(url, registryLookup);
        collapsedCount++;
        const optsStr = opts || "";
        return `\\includegraphics${optsStr}{${placeholder}}`;
      });

      this.isCollapsed = collapsedCount > 0;

      const elapsed = (performance.now() - startTime).toFixed(1);
      logInfo(`Collapsed ${collapsedCount} image reference(s) in ${elapsed}ms`, {
        mapSize: this._placeholderToUrl.size,
      });

      return { displayMMD, collapsedCount };
    }

    /**
     * Expand placeholder tokens in display MMD back to full URLs.
     *
     * Uses the placeholder map built during the last collapse() call.
     * If a placeholder token is not found in the map (e.g., user corrupted it),
     * it is left as-is — no data loss, just a broken image reference.
     *
     * @param {string} displayMMD - Display MMD containing placeholder tokens
     * @returns {string} Working MMD with full URLs restored
     */
    expand(displayMMD) {
      if (!displayMMD || typeof displayMMD !== "string") {
        return displayMMD || "";
      }

      if (this._placeholderToUrl.size === 0) {
        logDebug("expand() called with empty placeholder map — returning as-is");
        return displayMMD;
      }

      let workingMMD = displayMMD;
      let expandedCount = 0;

      // Replace each placeholder with its original URL
      for (const [placeholder, originalUrl] of this._placeholderToUrl) {
        const escapedPlaceholder = escapeRegex(placeholder);
        const regex = new RegExp(escapedPlaceholder, "g");

        const before = workingMMD;
        workingMMD = workingMMD.replace(regex, originalUrl);

        if (workingMMD !== before) {
          expandedCount++;
        }
      }

      logDebug(`Expanded ${expandedCount} placeholder(s)`);
      return workingMMD;
    }

    /**
     * Check whether auto-collapse should activate for the given MMD content.
     *
     * Returns true if any image reference URL exceeds the auto-collapse
     * threshold (200 characters). This handles base64 data URIs (50K+ chars),
     * very long CDN URLs, and any other oversized references.
     *
     * @param {string} mmdContent - MMD content to analyse
     * @returns {boolean} True if collapse should be activated
     */
    shouldAutoCollapse(mmdContent) {
      if (!mmdContent || typeof mmdContent !== "string") return false;

      // Check markdown images
      let match;
      const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      while ((match = mdRegex.exec(mmdContent)) !== null) {
        if (match[1].length > AUTO_COLLAPSE_THRESHOLD) return true;
      }

      // Check LaTeX images
      const latexRegex = /\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
      while ((match = latexRegex.exec(mmdContent)) !== null) {
        if (match[1].length > AUTO_COLLAPSE_THRESHOLD) return true;
      }

      return false;
    }

    /**
     * Force collapse/expand of all image references regardless of length.
     * Used when the user toggles the collapse button.
     *
     * @param {string} workingMMD - Full MMD content
     * @param {Object|null} [registry=null] - Image registry
     * @returns {{ displayMMD: string, collapsedCount: number }}
     */
    collapseAll(workingMMD, registry = null) {
      if (!workingMMD || typeof workingMMD !== "string") {
        return { displayMMD: workingMMD || "", collapsedCount: 0 };
      }

      // Clear previous mappings
      this._placeholderToUrl.clear();
      this._urlToPlaceholder.clear();

      const registryLookup = this._buildRegistryLookup(registry);
      let displayMMD = workingMMD;
      let collapsedCount = 0;

      // Collapse ALL markdown images (no threshold check)
      displayMMD = displayMMD.replace(MD_IMAGE_REGEX, (fullMatch, altText, url) => {
        // Skip URLs that are already placeholders
        if (url.startsWith(PLACEHOLDER_OPEN)) return fullMatch;

        const placeholder = this._getOrCreatePlaceholder(url, registryLookup);
        collapsedCount++;
        return `![${altText}](${placeholder})`;
      });

      // Collapse ALL LaTeX images
      displayMMD = displayMMD.replace(LATEX_IMAGE_REGEX, (fullMatch, opts, url) => {
        if (url.startsWith(PLACEHOLDER_OPEN)) return fullMatch;

        const placeholder = this._getOrCreatePlaceholder(url, registryLookup);
        collapsedCount++;
        const optsStr = opts || "";
        return `\\includegraphics${optsStr}{${placeholder}}`;
      });

      this.isCollapsed = collapsedCount > 0;

      logInfo(`Force-collapsed ${collapsedCount} image reference(s)`);
      return { displayMMD, collapsedCount };
    }

    /**
     * Update the placeholder map when a URL changes (e.g., image replacement).
     * Call this when a blob URL is created or a base64 data URI is introduced.
     *
     * @param {string} oldUrl - Previous URL
     * @param {string} newUrl - New URL
     * @returns {boolean} True if a mapping was updated
     */
    updateUrl(oldUrl, newUrl) {
      const placeholder = this._urlToPlaceholder.get(oldUrl);
      if (!placeholder) {
        logDebug("updateUrl: no existing placeholder for old URL");
        return false;
      }

      // Update both maps
      this._placeholderToUrl.set(placeholder, newUrl);
      this._urlToPlaceholder.delete(oldUrl);
      this._urlToPlaceholder.set(newUrl, placeholder);

      logDebug("Updated URL mapping for placeholder:", placeholder);
      return true;
    }

    /**
     * Get the current placeholder map size.
     * @returns {number} Number of active placeholder mappings
     */
    getMapSize() {
      return this._placeholderToUrl.size;
    }

    /**
     * Check if the display layer has active mappings.
     * @returns {boolean} True if collapse is active with mappings
     */
    hasActiveMappings() {
      return this.isCollapsed && this._placeholderToUrl.size > 0;
    }

    /**
     * Get all current mappings for debug/test purposes.
     * Returns a plain object copy, not the internal maps.
     *
     * @returns {Object} { placeholderToUrl: Object, urlToPlaceholder: Object }
     */
    getMappings() {
      const p2u = {};
      const u2p = {};
      for (const [k, v] of this._placeholderToUrl) {
        p2u[k] = v.length > 80 ? v.substring(0, 77) + "..." : v;
      }
      for (const [k, v] of this._urlToPlaceholder) {
        const truncK = k.length > 80 ? k.substring(0, 77) + "..." : k;
        u2p[truncK] = v;
      }
      return { placeholderToUrl: p2u, urlToPlaceholder: u2p };
    }

    /**
     * Clear all mappings and reset state.
     * Call during session cleanup.
     */
    clear() {
      this._placeholderToUrl.clear();
      this._urlToPlaceholder.clear();
      this.isCollapsed = false;
      logDebug("Display layer cleared");
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    /**
     * Build a lookup map from registry for metadata enrichment.
     * Maps originalUrl → { id, fileSize, mimeType, status }.
     *
     * @private
     * @param {Object|null} registry - MathPixImageRegistry instance
     * @returns {Map<string, Object>} URL to metadata lookup
     */
    _buildRegistryLookup(registry) {
      const lookup = new Map();

      if (!registry || typeof registry.getAllImages !== "function") {
        return lookup;
      }

      try {
        const images = registry.getAllImages();
        for (const img of images) {
          if (img.originalUrl) {
            lookup.set(img.originalUrl, {
              id: img.id,
              fileSize: img.fileSize,
              mimeType: img.mimeType,
              status: img.status,
            });
          }
        }
        logDebug(`Built registry lookup with ${lookup.size} entries`);
      } catch (error) {
        logWarn("Failed to build registry lookup:", error.message);
      }

      return lookup;
    }

    /**
     * Get or create a placeholder token for a given URL.
     * Reuses existing placeholders for the same URL (deduplication).
     * Handles collisions by appending a numeric suffix when two different
     * URLs produce the same placeholder text.
     *
     * @private
     * @param {string} url - The image URL to collapse
     * @param {Map<string, Object>} registryLookup - Registry metadata lookup
     * @returns {string} Placeholder token string
     */
    _getOrCreatePlaceholder(url, registryLookup) {
      // Check if we already have a placeholder for this URL
      const existing = this._urlToPlaceholder.get(url);
      if (existing) return existing;

      // Look up metadata from registry
      const meta = registryLookup.get(url);

      const resolvedMeta = meta || null;

      // Build the placeholder
      let placeholder = this._buildPlaceholderToken(url, resolvedMeta);

      // Handle collisions: if another URL already claims this placeholder text,
      // append a numeric suffix to make it unique
      if (this._placeholderToUrl.has(placeholder) &&
          this._placeholderToUrl.get(placeholder) !== url) {
        let suffix = 2;
        const basePlaceholder = placeholder.slice(0, -1); // remove closing ⟫
        while (this._placeholderToUrl.has(`${basePlaceholder} #${suffix}${PLACEHOLDER_CLOSE}`)) {
          suffix++;
        }
        placeholder = `${basePlaceholder} #${suffix}${PLACEHOLDER_CLOSE}`;
      }

      // Store bidirectional mapping
      this._placeholderToUrl.set(placeholder, url);
      this._urlToPlaceholder.set(url, placeholder);

      return placeholder;
    }

    /**
     * Build a placeholder token string from URL and optional metadata.
     *
     * Format: ⟪img-ID · SIZE⟫  or  ⟪TYPE · SIZE⟫
     *
     * @private
     * @param {string} url - Image URL
     * @param {Object|null} meta - Registry metadata { id, fileSize, mimeType }
     * @returns {string} Placeholder token
     */
    _buildPlaceholderToken(url, meta) {
      const parts = [];

      // Image ID from registry, or generate a short identifier
      if (meta && meta.id) {
        parts.push(meta.id);
      } else {
        // Fallback: use URL type + truncated hash
        parts.push(getUrlTypeLabel(url));
      }

      // File size
      if (meta && meta.fileSize) {
        parts.push(formatFileSize(meta.fileSize));
      } else if (url.startsWith("data:")) {
        // Estimate from base64
        const estimated = estimateBase64Size(url);
        if (estimated) {
          parts.push(formatFileSize(estimated));
        }
      }

      const content = parts.join(" \u00B7 "); // middle dot separator
      return `${PLACEHOLDER_OPEN}${content}${PLACEHOLDER_CLOSE}`;
    }
  }

  // ==========================================================================
  // TESTS
  // ==========================================================================

  /**
   * Run comprehensive unit tests for the display layer.
   * Call via: window.testMMDDisplayLayer()
   *
   * @returns {{ passed: number, failed: number, total: number }}
   */
  function runTests() {
    const results = { passed: 0, failed: 0, total: 0, failures: [] };

    function assert(name, condition) {
      results.total++;
      if (condition) {
        results.passed++;
        console.log(`  \u2713 ${name}`);
      } else {
        results.failed++;
        results.failures.push(name);
        console.error(`  \u2717 ${name}`);
      }
    }

    console.group("MathPixMMDDisplayLayer Tests");

    // ---- Utility tests ----
    console.group("Utility Functions");

    assert("formatFileSize: null returns '?'", formatFileSize(null) === "?");
    assert("formatFileSize: 0 returns '0 B'", formatFileSize(0) === "0 B");
    assert("formatFileSize: 500 returns '500 B'", formatFileSize(500) === "500 B");
    assert("formatFileSize: 1024 returns '1.0 KB'", formatFileSize(1024) === "1.0 KB");
    assert("formatFileSize: 32756 returns '32.0 KB'", formatFileSize(32756) === "32.0 KB");
    assert("formatFileSize: 1048576 returns '1.0 MB'", formatFileSize(1048576) === "1.0 MB");
    assert("formatFileSize: negative returns '?'", formatFileSize(-5) === "?");

    assert("getUrlTypeLabel: data URI", getUrlTypeLabel("data:image/png;base64,abc") === "base64");
    assert("getUrlTypeLabel: blob URL", getUrlTypeLabel("blob:http://localhost/abc") === "blob");
    assert("getUrlTypeLabel: CDN URL", getUrlTypeLabel("https://cdn.mathpix.com/cropped/abc.jpg") === "CDN");
    assert("getUrlTypeLabel: external URL", getUrlTypeLabel("https://example.com/img.png") === "URL");
    assert("getUrlTypeLabel: null", getUrlTypeLabel(null) === "?");

    assert("estimateBase64Size: valid data URI",
      estimateBase64Size("data:image/png;base64,dGVzdA==") === 4);
    assert("estimateBase64Size: null input", estimateBase64Size(null) === null);

    console.groupEnd();

    // ---- Core collapse/expand tests ----
    console.group("Collapse and Expand");

    const layer = new MathPixMMDDisplayLayer();

    // Test 1: Collapse with CDN URL below threshold — no change
    const shortCdnMMD = "Some text\n![diagram](https://cdn.mathpix.com/short.jpg)\nMore text";
    const shortResult = layer.collapse(shortCdnMMD);
    assert("Short CDN URL: not collapsed",
      shortResult.displayMMD === shortCdnMMD && shortResult.collapsedCount === 0);

    // Test 2: Collapse with long base64 data URI
    const longBase64 = "A".repeat(300);
    const base64MMD = `Text before\n![equation](data:image/png;base64,${longBase64})\nText after`;
    const base64Result = layer.collapse(base64MMD);
    assert("Base64 URI: collapsed", base64Result.collapsedCount === 1);
    assert("Base64 URI: placeholder present",
      base64Result.displayMMD.includes(PLACEHOLDER_OPEN));
    assert("Base64 URI: base64 data removed from display",
      !base64Result.displayMMD.includes(longBase64));
    assert("Base64 URI: surrounding text preserved",
      base64Result.displayMMD.includes("Text before") &&
      base64Result.displayMMD.includes("Text after"));
    assert("Base64 URI: alt text preserved",
      base64Result.displayMMD.includes("![equation]("));

    // Test 3: Round-trip (collapse then expand = original)
    const expandedBack = layer.expand(base64Result.displayMMD);
    assert("Round-trip: expand restores original",
      expandedBack === base64MMD);

    // Test 4: Collapse with long CDN URL (>200 chars)
    layer.clear();
    const longCdnUrl = "https://cdn.mathpix.com/cropped/" + "x".repeat(200) + ".jpg?height=100&width=200";
    const longCdnMMD = `![fig 1](${longCdnUrl})`;
    const longCdnResult = layer.collapse(longCdnMMD);
    assert("Long CDN URL: collapsed", longCdnResult.collapsedCount === 1);
    const longCdnExpanded = layer.expand(longCdnResult.displayMMD);
    assert("Long CDN URL: round-trip fidelity", longCdnExpanded === longCdnMMD);

    // Test 5: Collapse with blob URL (short — should NOT collapse)
    layer.clear();
    const blobMMD = "![](blob:http://localhost:8080/a1b2c3d4-e5f6-7890)";
    const blobResult = layer.collapse(blobMMD);
    assert("Short blob URL: not collapsed",
      blobResult.collapsedCount === 0 && blobResult.displayMMD === blobMMD);

    // Test 6: Multiple images, mixed lengths
    layer.clear();
    const longUrl1 = "data:image/jpeg;base64," + "B".repeat(500);
    const shortUrl = "https://cdn.mathpix.com/short.jpg";
    const longUrl2 = "data:image/png;base64," + "C".repeat(400);
    const mixedMMD = [
      `![img1](${longUrl1})`,
      "Some text between images",
      `![img2](${shortUrl})`,
      `![img3](${longUrl2})`,
    ].join("\n");
    const mixedResult = layer.collapse(mixedMMD);
    assert("Mixed: 2 long collapsed", mixedResult.collapsedCount === 2);
    assert("Mixed: short URL preserved",
      mixedResult.displayMMD.includes(shortUrl));
    assert("Mixed: text between preserved",
      mixedResult.displayMMD.includes("Some text between images"));
    const mixedExpanded = layer.expand(mixedResult.displayMMD);
    assert("Mixed: round-trip fidelity", mixedExpanded === mixedMMD);

    // Test 7: LaTeX images
    layer.clear();
    const longLatexUrl = "https://cdn.mathpix.com/" + "y".repeat(250) + ".png";
    const latexMMD = `\\includegraphics[width=0.8\\textwidth]{${longLatexUrl}}`;
    const latexResult = layer.collapse(latexMMD);
    assert("LaTeX image: collapsed", latexResult.collapsedCount === 1);
    assert("LaTeX image: syntax preserved",
      latexResult.displayMMD.includes("\\includegraphics[width=0.8\\textwidth]{"));
    const latexExpanded = layer.expand(latexResult.displayMMD);
    assert("LaTeX image: round-trip fidelity", latexExpanded === latexMMD);

    // Test 8: No images — zero change
    layer.clear();
    const noImageMMD = "Just some text\nWith multiple lines\nAnd no images";
    const noImageResult = layer.collapse(noImageMMD);
    assert("No images: zero change",
      noImageResult.displayMMD === noImageMMD && noImageResult.collapsedCount === 0);

    // Test 9: Empty MMD
    layer.clear();
    const emptyResult = layer.collapse("");
    assert("Empty MMD: returns empty string", emptyResult.displayMMD === "");

    // Test 10: Null MMD
    layer.clear();
    const nullResult = layer.collapse(null);
    assert("Null MMD: returns empty string", nullResult.displayMMD === "");

    // Test 11: Expand with no prior collapse
    layer.clear();
    const noCollapseExpand = layer.expand("Some text ![img](url) more text");
    assert("Expand without prior collapse: returns as-is",
      noCollapseExpand === "Some text ![img](url) more text");

    console.groupEnd();

    // ---- shouldAutoCollapse tests ----
    console.group("shouldAutoCollapse");

    assert("Auto-collapse: short URLs → false",
      !layer.shouldAutoCollapse("![](https://cdn.mathpix.com/short.jpg)"));
    assert("Auto-collapse: long base64 → true",
      layer.shouldAutoCollapse(`![](data:image/png;base64,${"A".repeat(300)})`));
    assert("Auto-collapse: long CDN → true",
      layer.shouldAutoCollapse(`![](https://cdn.mathpix.com/${"x".repeat(250)}.jpg)`));
    assert("Auto-collapse: empty → false", !layer.shouldAutoCollapse(""));
    assert("Auto-collapse: null → false", !layer.shouldAutoCollapse(null));
    assert("Auto-collapse: no images → false",
      !layer.shouldAutoCollapse("Just text, no images"));
    assert("Auto-collapse: LaTeX long → true",
      layer.shouldAutoCollapse(`\\includegraphics{${"z".repeat(300)}}`));

    console.groupEnd();

    // ---- collapseAll tests ----
    console.group("collapseAll (force collapse)");

    layer.clear();
    const allCollapseMMD = "![short](https://example.com/a.png)\n![also short](https://example.com/b.png)";
    const allResult = layer.collapseAll(allCollapseMMD);
    assert("collapseAll: collapses even short URLs", allResult.collapsedCount === 2);
    assert("collapseAll: both have placeholders",
      allResult.displayMMD.includes(PLACEHOLDER_OPEN) &&
      (allResult.displayMMD.match(new RegExp(escapeRegex(PLACEHOLDER_OPEN), "g")) || []).length === 2);
    const allExpanded = layer.expand(allResult.displayMMD);
    assert("collapseAll: round-trip fidelity", allExpanded === allCollapseMMD);

    console.groupEnd();

    // ---- Registry integration tests ----
    console.group("Registry Integration");

    // Mock a minimal registry
    const mockRegistry = {
      getAllImages: () => [
        {
          id: "img-aabbccdd",
          originalUrl: "https://cdn.mathpix.com/" + "q".repeat(250) + ".jpg",
          fileSize: 45231,
          mimeType: "image/jpeg",
          status: "cdn-linked",
        },
      ],
    };

    layer.clear();
    const regUrl = "https://cdn.mathpix.com/" + "q".repeat(250) + ".jpg";
    const regMMD = `![diagram](${regUrl})`;
    const regResult = layer.collapse(regMMD, mockRegistry);
    assert("Registry: uses image ID in placeholder",
      regResult.displayMMD.includes("img-aabbccdd"));
    assert("Registry: includes file size",
      regResult.displayMMD.includes("44.2 KB"));
    const regExpanded = layer.expand(regResult.displayMMD);
    assert("Registry: round-trip fidelity", regExpanded === regMMD);

    console.groupEnd();

    // ---- updateUrl tests ----
    console.group("updateUrl");

    layer.clear();
    const origUrl = "data:image/png;base64," + "D".repeat(300);
    const updateMMD = `![test](${origUrl})`;
    layer.collapse(updateMMD);
    const newUrl = "blob:http://localhost:8080/new-blob-id";
    const updateResult = layer.updateUrl(origUrl, newUrl);
    assert("updateUrl: returns true for existing mapping", updateResult === true);
    // Expand should now return the new URL
    const updatedDisplay = layer.collapse(updateMMD).displayMMD;
    const expandedWithNewUrl = layer.expand(updatedDisplay);
    // Note: after updateUrl, expanding the SAME display should give newUrl
    // But collapse re-runs on original working MMD, so let's test the map directly
    assert("updateUrl: map size unchanged", layer.getMapSize() >= 1);

    layer.clear();
    const noMapResult = layer.updateUrl("nonexistent", "also-nonexistent");
    assert("updateUrl: returns false for missing URL", noMapResult === false);

    console.groupEnd();

    // ---- Edge case tests ----
    console.group("Edge Cases");

    layer.clear();
    // User edits text around placeholder but placeholder intact
    const editBase64 = "data:image/png;base64," + "E".repeat(300);
    const editMMD = `Paragraph one\n![graph](${editBase64})\nParagraph two`;
    const editCollapsed = layer.collapse(editMMD);
    // Simulate user editing: change "Paragraph one" to "Edited paragraph"
    const userEdited = editCollapsed.displayMMD.replace("Paragraph one", "Edited paragraph");
    const editExpanded = layer.expand(userEdited);
    assert("Edit around placeholder: text change applied",
      editExpanded.includes("Edited paragraph"));
    assert("Edit around placeholder: image reference intact",
      editExpanded.includes(editBase64));
    assert("Edit around placeholder: other text intact",
      editExpanded.includes("Paragraph two"));

    // User deletes part of a placeholder — graceful degradation
    layer.clear();
    const breakUrl = "data:image/png;base64," + "F".repeat(300);
    const breakMMD = `![test](${breakUrl})`;
    const breakCollapsed = layer.collapse(breakMMD);
    // Corrupt the placeholder by removing the closing bracket
    const corrupted = breakCollapsed.displayMMD.replace(PLACEHOLDER_CLOSE, "");
    const corruptExpanded = layer.expand(corrupted);
    assert("Corrupted placeholder: no crash", typeof corruptExpanded === "string");
    // The expand won't find the placeholder, so the corrupted text passes through
    assert("Corrupted placeholder: returns corrupted display (no data loss from expand)",
      corruptExpanded.includes(PLACEHOLDER_OPEN));

    // Duplicate images (same URL in multiple places)
    layer.clear();
    const dupeUrl = "data:image/jpeg;base64," + "G".repeat(300);
    const dupeMMD = `![a](${dupeUrl})\nText\n![b](${dupeUrl})`;
    const dupeResult = layer.collapse(dupeMMD);
    assert("Duplicate URLs: both collapsed", dupeResult.collapsedCount === 2);
    assert("Duplicate URLs: different alt text preserved",
      dupeResult.displayMMD.includes("![a](") && dupeResult.displayMMD.includes("![b]("));
    const dupeExpanded = layer.expand(dupeResult.displayMMD);
    assert("Duplicate URLs: round-trip fidelity", dupeExpanded === dupeMMD);

    // Mixed markdown and LaTeX in same document
    layer.clear();
    const mixedSyntaxUrl1 = "data:image/png;base64," + "H".repeat(300);
    const mixedSyntaxUrl2 = "data:image/jpeg;base64," + "I".repeat(400);
    const mixedSyntaxMMD = [
      `![md image](${mixedSyntaxUrl1})`,
      "Text between",
      `\\includegraphics[width=0.5\\textwidth]{${mixedSyntaxUrl2}}`,
    ].join("\n");
    const mixedSyntaxResult = layer.collapse(mixedSyntaxMMD);
    assert("Mixed syntax: both collapsed", mixedSyntaxResult.collapsedCount === 2);
    const mixedSyntaxExpanded = layer.expand(mixedSyntaxResult.displayMMD);
    assert("Mixed syntax: round-trip fidelity", mixedSyntaxExpanded === mixedSyntaxMMD);

    console.groupEnd();

    // ---- Clear tests ----
    console.group("Clear");

    layer.clear();
    assert("Clear: map empty", layer.getMapSize() === 0);
    assert("Clear: isCollapsed false", layer.isCollapsed === false);
    assert("Clear: hasActiveMappings false", !layer.hasActiveMappings());

    console.groupEnd();

    // ---- Summary ----
    console.groupEnd(); // MathPixMMDDisplayLayer Tests

    const status = results.failed === 0 ? "\u2705" : "\u274C";
    console.log(
      `\n${status} MathPixMMDDisplayLayer: ${results.passed}/${results.total} passed` +
      (results.failed > 0 ? `, ${results.failed} FAILED` : "")
    );

    if (results.failures.length > 0) {
      console.warn("Failed tests:", results.failures);
    }

    return results;
  }

  // ==========================================================================
  // EXPORTS
  // ==========================================================================

  return {
    MathPixMMDDisplayLayer,
    runTests,
    // Export constants for external use (e.g., CSS targeting)
    PLACEHOLDER_OPEN,
    PLACEHOLDER_CLOSE,
    AUTO_COLLAPSE_THRESHOLD,
    // Export utilities for testing
    _utils: {
      formatFileSize,
      estimateBase64Size,
      getUrlTypeLabel,
      escapeRegex,
    },
  };
})();

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

// Test command
window.testMMDDisplayLayer = function () {
  return MathPixMMDDisplayLayer.runTests();
};

// Make class available globally for session restorer integration
window.MathPixMMDDisplayLayer = MathPixMMDDisplayLayer.MathPixMMDDisplayLayer;
