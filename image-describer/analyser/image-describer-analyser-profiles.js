/**
 * ===================================================================
 * IMAGE DESCRIBER ANALYSER — PROFILES
 * ===================================================================
 *
 * Analysis profile definitions for the Image Describer Analyser.
 * Each profile configures OCR, colour sampling, and suppression
 * behaviour for a specific image type.
 *
 * Extracted from image-describer-analyser-utils.js to allow profiles
 * to grow independently (e.g. CLIP/Transformers.js config blocks).
 *
 * VERSION: 1.0.0
 * DATE: 15 March 2026
 * PHASE: Local Analysis — Profile extraction housekeeping
 * ===================================================================
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

  /** One 60 s budget for the whole text-detection stage; defined once in utils (H-30). */
  const OCR_STAGE_BUDGET_MS =
    window.ImageDescriberAnalyserUtils.OCR_STAGE_BUDGET_MS;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[AnalyserProfiles] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserProfiles] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserProfiles] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserProfiles] ${message}`, ...args);
  }

  // ============================================================================
  // ANALYSIS PROFILES
  // ============================================================================

  /**
   * Profile definitions. Phase H-56: the image classifier and the six other
   * categories (chart, photograph, map, diagram, equation, painting) were
   * removed, so there is one definition, "default", used for every picture.
   * Any code that asks for another name gets "default" (see getProfile and
   * analyseGated).
   */
  const PROFILES = {
    default: {
      name: "default",
      description: "General-purpose analysis suitable for most image types",
      ocr: {
        enabled: true,
        timeout: OCR_STAGE_BUDGET_MS,
        language: "eng",
        recognitionLevel: "word",
        minConfidence: 0.3,
        preprocessGreyscale: true,
        grouping: {
          enabled: true,
          maxVerticalOverlap: 0.5,
          maxHorizontalGap: 1.5,
        },
      },
      colour: {
        enabled: true,
        timeout: 5000,
        grid: {
          type: "quadrants",
          rows: 2,
          columns: 2,
          includeCentre: true,
          centreSize: 0.33,
          customRegions: null,
        },
        paletteSize: 5,
        sampleInterval: 4,
        deriveGradientDirection: true,
      },
        suppression: {
        enabled: true,
        shortTextMinConfidence: { 1: 0.7, 2: 0.5 },
        punctuationFilter: true,
        duplicateProximity: 0.1,
      },
      objects: {
        enabled: true,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
    },
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Returns the named profile, or falls back to 'default' with a warning.
   *
   * @param {string} name — profile name to look up
   * @returns {Object} the matching profile definition
   */
  function getProfile(name) {
    if (PROFILES[name]) {
      return PROFILES[name];
    }
    logWarn(`Profile "${name}" not recognised, falling back to default`);
    return PROFILES.default;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserProfiles = {
    PROFILES,
    getProfile,
  };

  logInfo("Analyser profiles loaded");
})();
