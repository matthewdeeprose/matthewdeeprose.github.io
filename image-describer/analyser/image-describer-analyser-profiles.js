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
   * Profile definitions. Each profile configures OCR, colour sampling,
   * and suppression behaviour for a specific image type.
   */
  const PROFILES = {
    default: {
      name: "default",
      description: "General-purpose analysis suitable for most image types",
      ocr: {
        enabled: true,
        timeout: 15000,
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
      depth: {
        enabled: true,
      },
    },
    chart: {
      name: "chart",
      description: "Optimised for charts, graphs, and plots with labelled axes",
      ocr: {
        enabled: true,
        timeout: 15000,
        language: "eng",
        recognitionLevel: "word",
        minConfidence: 0.25,
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
          type: "grid",
          rows: 4,
          columns: 4,
          includeCentre: false,
          centreSize: 0.33,
          customRegions: null,
        },
        paletteSize: 8,
        sampleInterval: 2,
        deriveGradientDirection: true,
      },
      suppression: {
        enabled: true,
        shortTextMinConfidence: { 1: 0.6, 2: 0.4 },
        punctuationFilter: true,
        duplicateProximity: 0.1,
      },
      objects: {
        enabled: true,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
      depth: {
        enabled: false,
      },
    },
    photograph: {
      name: "photograph",
      description:
        "Optimised for photographs (biology specimens, geological features, laboratory images)",
      ocr: {
        enabled: true,
        timeout: 15000,
        language: "eng",
        recognitionLevel: "word",
        minConfidence: 0.25,
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
        paletteSize: 6,
        sampleInterval: 4,
        deriveGradientDirection: true,
      },
      suppression: {
        enabled: true,
        shortTextThreshold: 1,
        punctuationOnly: true,
        duplicateThreshold: 0.9,
      },
      objects: {
        enabled: true,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
      depth: {
        enabled: true,
      },
    },
    map: {
      name: "map",
      description:
        "Optimised for maps with colour-coded regions and text labels",
      ocr: {
        enabled: true,
        timeout: 15000,
        language: "eng",
        recognitionLevel: "word",
        minConfidence: 0.3,
        preprocessGreyscale: true,
        grouping: {
          enabled: true,
          maxVerticalOverlap: 0.5,
          maxHorizontalGap: 2.0,
        },
      },
      colour: {
        enabled: true,
        timeout: 5000,
        grid: {
          type: "grid",
          rows: 4,
          columns: 4,
          includeCentre: false,
          centreSize: 0.33,
          customRegions: null,
        },
        paletteSize: 10,
        sampleInterval: 2,
        deriveGradientDirection: true,
      },
      suppression: {
        enabled: true,
        shortTextMinConfidence: { 1: 0.7, 2: 0.5 },
        punctuationFilter: true,
        duplicateProximity: 0.08,
      },
      objects: {
        enabled: true,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
      depth: {
        enabled: false,
      },
    },
    diagram: {
      name: "diagram",
      description:
        "Optimised for technical diagrams, flow charts, and labelled drawings",
      ocr: {
        enabled: true,
        timeout: 15000,
        language: "eng",
        recognitionLevel: "word",
        minConfidence: 0.3,
        preprocessGreyscale: true,
        grouping: {
          enabled: true,
          maxVerticalOverlap: 0.5,
          maxHorizontalGap: 1.0,
        },
      },
      colour: {
        enabled: true,
        timeout: 5000,
        grid: {
          type: "grid",
          rows: 3,
          columns: 3,
          includeCentre: true,
          centreSize: 0.33,
          customRegions: null,
        },
        paletteSize: 6,
        sampleInterval: 4,
        deriveGradientDirection: false,
      },
      suppression: {
        enabled: true,
        shortTextMinConfidence: { 1: 0.6, 2: 0.4 },
        punctuationFilter: true,
        duplicateProximity: 0.1,
      },
      objects: {
        enabled: true,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
      depth: {
        enabled: false,
      },
    },
    equation: {
      name: "equation",
      description: "Optimised for mathematical equations and formulae",
      ocr: {
        enabled: true,
        timeout: 20000,
        language: "eng",
        recognitionLevel: "line",
        minConfidence: 0.2,
        preprocessGreyscale: true,
        grouping: {
          enabled: false,
        },
      },
      colour: {
        enabled: true,
        timeout: 5000,
        grid: {
          type: "quadrants",
          rows: 2,
          columns: 2,
          includeCentre: false,
          centreSize: 0.33,
          customRegions: null,
        },
        paletteSize: 3,
        sampleInterval: 8,
        deriveGradientDirection: false,
      },
      suppression: {
        enabled: true,
        shortTextMinConfidence: { 1: 0.5, 2: 0.3 },
        punctuationFilter: false,
        duplicateProximity: 0.05,
      },
      objects: {
        enabled: false,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
      depth: {
        enabled: false,
      },
    },
    painting: {
      name: "painting",
      description: "Optimised for paintings, illustrations, and artistic works",
      ocr: {
        enabled: false,
      },
      colour: {
        enabled: true,
        timeout: 5000,
        grid: {
          type: "grid",
          rows: 3,
          columns: 3,
          includeCentre: true,
          centreSize: 0.33,
          customRegions: null,
        },
        paletteSize: 10,
        sampleInterval: 2,
        deriveGradientDirection: true,
      },
      suppression: {
        enabled: true,
        shortTextThreshold: 1,
        punctuationOnly: true,
        duplicateThreshold: 0.9,
      },
      objects: {
        enabled: true,
        confidenceThreshold: 0.3,
        maxDetections: 20,
      },
      depth: {
        enabled: true,
      },
    },
  };

  // ============================================================================
  // PROFILE NAMES
  // ============================================================================

  /** Ordered array of profile name strings for UI iteration */
  const PROFILE_NAMES = Object.keys(PROFILES);

  // ============================================================================
  // CLIP CLASSIFICATION LABELS
  // ============================================================================

  /** CLIP candidate labels for zero-shot classification */
  const ACADEMIC_IMAGE_LABELS = [
    "bar chart",
    "line graph",
    "pie chart",
    "scatter plot",
    "table",
    "scientific diagram",
    "technical diagram",
    "flowchart",
    "map",
    "geographical map",
    "satellite image",
    "mathematical equation",
    "formula",
    "photograph",
    "microscope image",
    "painting",
    "illustration",
    "sketch",
    "screenshot",
    "infographic",
  ];

  /** Maps CLIP labels to profile names */
  const LABEL_TO_PROFILE = {
    "bar chart": "chart",
    "line graph": "chart",
    "pie chart": "chart",
    "scatter plot": "chart",
    "table": "chart",
    "scientific diagram": "diagram",
    "technical diagram": "diagram",
    "flowchart": "diagram",
    "infographic": "diagram",
    "map": "map",
    "geographical map": "map",
    "satellite image": "map",
    "mathematical equation": "equation",
    "formula": "equation",
    "photograph": "photograph",
    "microscope image": "photograph",
    "painting": "painting",
    "illustration": "painting",
    "sketch": "diagram",
    "screenshot": "default",
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
    PROFILE_NAMES,
    ACADEMIC_IMAGE_LABELS,
    LABEL_TO_PROFILE,
    getProfile,
  };

  logInfo("Analyser profiles loaded");
})();
