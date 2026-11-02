/**
 * @file safe-html.js
 * @description One place that cleans AI-supplied HTML before it is written into the page.
 * Uses the vendored DOMPurify build (vendor/dompurify/) with ONE frozen configuration.
 * Fails closed: if DOMPurify is not loaded, the input is escaped, never passed through.
 *
 * @module SafeHTML
 * @since M-2i (31 October 2026)
 */
(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[SafeHTML]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[SafeHTML]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[SafeHTML]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[SafeHTML]", message, ...args);
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  /** MathJax CHTML output is made of <mjx-…> custom elements; keep them. */
  const MATHJAX_TAG_PATTERN = /^mjx-[a-z0-9-]+$/;

  /** On a custom (mjx-) element, any attribute except an event handler. */
  const CUSTOM_ATTRIBUTE_PATTERN = /^(?!on)[a-z][a-z0-9_:-]*$/i;

  /** Elements that can run code or reshape the page; never allowed. */
  const FORBIDDEN_TAGS = Object.freeze([
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "base",
    "style",
    "meta",
    "link",
    "frame",
    "frameset",
    "applet",
  ]);

  /** Attributes that carry code or a nested document. */
  const FORBIDDEN_ATTRIBUTES = Object.freeze(["srcdoc", "formaction", "ping"]);

  /** Harmless attributes DOMPurify's profiles drop: the inline SVG icons carry focusable="false". */
  const ADDED_ATTRIBUTES = Object.freeze(["focusable"]);

  const PURIFY_CONFIG = Object.freeze({
    USE_PROFILES: Object.freeze({ html: true, svg: true, svgFilters: true, mathMl: true }),
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTRIBUTES,
    ADD_ATTR: ADDED_ATTRIBUTES,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    CUSTOM_ELEMENT_HANDLING: Object.freeze({
      tagNameCheck: MATHJAX_TAG_PATTERN,
      attributeNameCheck: CUSTOM_ATTRIBUTE_PATTERN,
      allowCustomizedBuiltInElements: false,
    }),
  });

  // =========================================================================
  // Public API
  // =========================================================================

  /** Escape the three characters that start markup. */
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Clean an HTML string for insertion with innerHTML.
   * @param {string} html - HTML that may hold AI-supplied markup
   * @returns {string} cleaned HTML; escaped text if DOMPurify is missing
   */
  function sanitise(html) {
    if (html === null || html === undefined || html === "") return "";
    const input = String(html);

    if (!window.DOMPurify || typeof window.DOMPurify.sanitize !== "function") {
      logWarn("DOMPurify is not loaded; escaping the content instead of inserting it as HTML");
      return escapeHtml(input);
    }

    return window.DOMPurify.sanitize(input, PURIFY_CONFIG);
  }

  window.SafeHTML = Object.freeze({
    sanitise,
    config: PURIFY_CONFIG,
  });

  logInfo("SafeHTML ready");
})();
