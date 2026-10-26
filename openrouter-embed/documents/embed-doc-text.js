/**
 * OpenRouter Embed API - text format module
 *
 * Registers window.EmbedDocumentFormats.text for openrouter-embed-documents.js.
 * Handles .txt, .md, .tex and .mmd. An .mmd is MathPix's own output, so the
 * core reports maths.detected = false for every text format.
 *
 * Privacy: document content is never logged (sizes and counts only).
 *
 * Parcel P1a: adopted nowhere.
 *
 * @version 1.0.0 (P1a)
 * @date 22 October 2026
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
      console.error(`[EmbedDocText ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedDocText WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedDocText INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedDocText DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // FORMAT MODULE
  // ============================================================================

  const DOC_TYPE = "text";
  const ERROR_TOO_LARGE = "too-large";
  const ERROR_UNREADABLE = "unreadable";

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    error.docType = DOC_TYPE;
    return error;
  }

  async function read(file, ctx) {
    if (file.size > ctx.caps.MAX_TEXT_FILE_BYTES) {
      ctx.log("Text file over the size cap", { bytes: file.size });
      throw fail(ERROR_TOO_LARGE);
    }

    let text;
    try {
      // Blob.text() decodes UTF-8 and drops a leading byte-order mark.
      text = await file.text();
    } catch (error) {
      throw fail(ERROR_UNREADABLE);
    }

    ctx.log("Text read", { bytes: file.size, chars: text.length });
    return { text, images: [], meta: {} };
  }

  window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
  window.EmbedDocumentFormats[DOC_TYPE] = { read };

  logInfo("Text format module loaded");
})();
