/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — ORCHESTRATOR
 * ═══════════════════════════════════════════════════════════════
 *
 * Main entry point for the Image Describer Analyser module.
 * Maintains the identical public API as the original monolithic file.
 * Delegates to sub-modules for OCR, colour, cross-referencing,
 * formatting, and shared utilities.
 *
 * Public API:
 *   analyse(imageSource, profileName?)  → ImageAnalysisResult (backward-compatible)
 *   analyseImmediate(imageSource)       → { result, canvasData }  (Phase 15A)
 *   analyseGated(result, canvasData, profileName, options?) → ImageAnalysisResult (Phase 15A)
 *   extractLabels(imageSource)          → OCRAnalysisResult
 *   sampleColours(imageSource, grid?)   → ColourAnalysisResult
 *   crossReference(ocr, colour, ctx, w, h) → void
 *   formatForPrompt(analysis, config?)  → string
 *   isAvailable()                       → boolean
 *   getProfiles()                       → { [name]: AnalysisProfile }
 *   destroy()                           → void
 *
 * Depends on (load order):
 *   1. window.ImageDescriberAnalyserUtils
 *   2. window.ImageDescriberAnalyserColour
 *   3. window.ImageDescriberAnalyserOCR
 *   4. window.ImageDescriberAnalyserXRef
 *   5. window.ImageDescriberAnalyserFormat
 *
 * VERSION: 3.0.0
 * DATE: 28 March 2026
 * PHASE: Local Analysis — Phase 15A (two-phase analysis split)
 * ═══════════════════════════════════════════════════════════════
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
      console.error(`[ImageAnalyser] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageAnalyser] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageAnalyser] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageAnalyser] ${message}`, ...args);
  }

  // ============================================================================
  // ANALYSIS EVENT EMITTER (Phase 6A)
  // ============================================================================

  /**
   * Emit an analysis stage event via EmbedEventEmitter.
   * @param {string} stage — "analysis", "ocr", "colour", "clip"
   * @param {string} status — "started", "running", "complete", "skipped", "error"
   * @param {object} [extra] — optional additional data
   */
  function emitStage(stage, status, extra) {
    if (window.EmbedEventEmitter) {
      const data = Object.assign({ stage: stage, status: status }, extra);
      window.EmbedEventEmitter.emit("analysis:stage", data);
    }
  }

  // ============================================================================
  // DEPENDENCY REFERENCES
  // ============================================================================

  /** Shorthand references — resolved at call time, not load time */
  function utils() {
    return window.ImageDescriberAnalyserUtils;
  }
  function colourEngine() {
    return window.ImageDescriberAnalyserColour;
  }
  function ocrEngine() {
    return window.ImageDescriberAnalyserOCR;
  }
  function xrefEngine() {
    return window.ImageDescriberAnalyserXRef;
  }
  function formatEngine() {
    return window.ImageDescriberAnalyserFormat;
  }

  // ============================================================================
  // MAIN ANALYSER OBJECT
  // ============================================================================

  const ImageDescriberAnalyser = {
    // Internal state
    lastAnalysis: null,

    // ========================================================================
    // PUBLIC API: isAvailable()
    // ========================================================================

    /**
     * Checks whether the module is ready.
     * Returns true if the module itself is loaded. Tesseract availability
     * is checked lazily on first OCR call.
     */
    isAvailable() {
      return true;
    },

    // ========================================================================
    // PUBLIC API: getProfiles()
    // ========================================================================

    /**
     * Returns available profile definitions.
     */
    getProfiles() {
      const u = utils();
      // Return a shallow copy to prevent external mutation
      const result = {};
      for (const key of Object.keys(u.PROFILES)) {
        result[key] = u.PROFILES[key];
      }
      return result;
    },

    // ========================================================================
    // PUBLIC API: analyse()
    // ========================================================================

    /**
     * Runs the full analysis pipeline (backward-compatible).
     * Phase 15A: internally calls analyseImmediate() then analyseGated().
     * Signature and return value are identical to pre-15A behaviour.
     *
     * @param {HTMLImageElement|HTMLCanvasElement|File|string} imageSource
     * @param {string} [profileName='default'] — name of the profile to use
     * @returns {Promise<object>} ImageAnalysisResult
     */
    async analyse(imageSource, profileName) {
      const immediate = await this.analyseImmediate(imageSource);
      if (!immediate || !immediate.result) {
        return immediate?.result ||
          this._buildFailedResult(
            Date.now(),
            profileName || "default",
            "Immediate analysis failed",
          );
      }
      return this.analyseGated(
        immediate.result,
        immediate.canvasData,
        profileName || "default",
      );
    },

    // ========================================================================
    // PUBLIC API: analyseImmediate()
    // ========================================================================

    /**
     * Phase 15A: Runs the fast, profile-independent analyses only (CLIP + colour).
     * Returns a partial result plus canvas data needed by analyseGated().
     *
     * @param {HTMLImageElement|HTMLCanvasElement|File|string} imageSource
     * @returns {Promise<{result: object, canvasData: object|null}>}
     */
    async analyseImmediate(imageSource) {
      const u = utils();
      const startedAt = Date.now();

      logInfo("Starting immediate analysis (CLIP + colour)...");

      // Prepare the canvas (shared between phases)
      let canvasData;
      try {
        canvasData = await u.loadImageToCanvas(imageSource);
      } catch (err) {
        logError("Failed to load image to canvas:", err);
        return {
          result: this._buildFailedResult(
            startedAt,
            "pending",
            "Failed to load image: " + err.message,
          ),
          canvasData: null,
        };
      }

      const { canvas, ctx, width, height } = canvasData;

      logDebug(`Image loaded: ${width}×${height} pixels`);

      // Build the base result (partial — OCR/depth not yet run)
      const result = {
        schemaVersion: u.SCHEMA_VERSION,
        source: {
          width,
          height,
          aspectRatio: parseFloat((width / height).toFixed(3)),
          compressionApplied: false,
          originalWidth: width,
          originalHeight: height,
        },
        profile: "pending", // Not yet confirmed
        startedAt,
        completedAt: null,
        totalDuration: null,
        ocr: null, // Not yet run
        colour: null,
        florenceCaption: { status: "skipped" },
        florenceObjects: { status: "skipped" },
        edges: null,
        objects: null,
        faces: null,
        depth: null, // Not yet run
        classification: null,
      };

      // Run CLIP + colour in parallel
      emitStage("analysis", "started");
      const promises = [];
      let clipResult = null;

      // CLIP classification (Phase 5B-2) — runs in parallel, failure doesn't block
      const transformers = window.ImageDescriberAnalyserTransformers;
      if (transformers && transformers.isAvailable()) {
        emitStage("clip", "running");
        const profiles = window.ImageDescriberAnalyserProfiles;
        const clipPromise = transformers
          .classifyImage(canvas, profiles.ACADEMIC_IMAGE_LABELS)
          .then((r) => {
            clipResult = r;
            emitStage("clip", "complete");
          })
          .catch((err) => {
            logWarn("CLIP classification failed:", err.message);
            emitStage("clip", "error");
          });
        promises.push(clipPromise);
      } else if (transformers) {
        // Gateway exists but library not loaded — try to load it
        emitStage("clip", "running");
        const clipPromise = transformers
          .ensureLibrary()
          .then(() => {
            const profiles = window.ImageDescriberAnalyserProfiles;
            return transformers.classifyImage(
              canvas,
              profiles.ACADEMIC_IMAGE_LABELS,
            );
          })
          .then((r) => {
            clipResult = r;
            emitStage("clip", "complete");
          })
          .catch((err) => {
            logWarn("CLIP classification failed:", err.message);
            emitStage("clip", "error");
          });
        promises.push(clipPromise);
      }

      // Colour — use default profile config (profile not yet confirmed)
      const defaultColourConfig = u.PROFILES.default.colour;
      if (defaultColourConfig && defaultColourConfig.enabled !== false) {
        emitStage("colour", "running");
        promises.push(
          colourEngine()
            .runColourAnalysis(ctx, width, height, defaultColourConfig)
            .then((colourResult) => {
              result.colour = colourResult;
              emitStage("colour", "complete");
            }),
        );
      } else {
        result.colour = {
          status: "skipped",
          duration: null,
          error: null,
          gridConfig: null,
          regions: [],
          palette: [],
          luminanceRange: 0,
          gradientDirection: null,
          isDarkDominant: false,
          isHighContrast: false,
        };
      }

      // Await CLIP + colour
      await Promise.all(promises);

      // Attach CLIP classification if available
      if (typeof window.ImageDescriberAnalyserClassify !== "undefined") {
        try {
          result.classification =
            window.ImageDescriberAnalyserClassify.suggestProfile(
              result,
              clipResult,
            );
          logDebug(
            "Immediate classification:",
            result.classification?.profile,
            `(${Math.round((result.classification?.confidence || 0) * 100)}%)`,
          );
        } catch (err) {
          logWarn("Classification failed:", err);
          result.classification = null;
        }
      }

      if (clipResult && clipResult.status === "success") {
        if (!result.classification) {
          result.classification = {
            profile: null,
            confidence: 0,
            reason: "No heuristic signal",
            source: "heuristic",
            scores: {},
          };
        }
        result.classification.clip = clipResult;
        logDebug(
          "CLIP classification attached:",
          clipResult.topLabel,
          `(${(clipResult.topConfidence * 100).toFixed(0)}%)`,
        );
      }

      // Finalise immediate timing
      result.completedAt = Date.now();
      result.totalDuration = result.completedAt - result.startedAt;

      // Do NOT emit ("analysis", "complete") — that happens in the gated phase
      logInfo(
        `Immediate analysis complete in ${result.totalDuration}ms ` +
          `(Colour: ${result.colour?.status}, CLIP: ${clipResult ? "yes" : "no"})`,
      );

      return { result, canvasData: { canvas, ctx, width, height } };
    },

    // ========================================================================
    // PUBLIC API: analyseGated()
    // ========================================================================

    /**
     * Phase 15A: Runs profile-dependent analyses (OCR + depth) using canvas
     * data from analyseImmediate().
     *
     * @param {object} immediateResult — the .result from analyseImmediate()
     * @param {object} canvasData — the .canvasData from analyseImmediate() — { canvas, ctx, width, height }
     * @param {string} profileName — confirmed profile name
     * @param {object} [options] — optional: { skipOCR: boolean }
     * @returns {Promise<object>} Completed ImageAnalysisResult
     */
    async analyseGated(immediateResult, canvasData, profileName, options) {
      const u = utils();
      const profile = u.PROFILES[profileName] || u.PROFILES.default;
      const resolvedProfileName = profile.name;
      const skipOCR = options && options.skipOCR === true;

      logInfo(
        `Starting gated analysis with profile: ${resolvedProfileName}` +
          (skipOCR ? " (skipOCR)" : ""),
      );

      // Guard: if canvasData is missing, return immediate result as-is
      if (!canvasData || !canvasData.canvas) {
        logError("analyseGated called without valid canvasData — returning immediate result");
        immediateResult.profile = resolvedProfileName;
        immediateResult.completedAt = Date.now();
        immediateResult.totalDuration =
          immediateResult.completedAt - immediateResult.startedAt;
        emitStage("analysis", "complete", {
          duration: immediateResult.totalDuration,
        });
        this.lastAnalysis = immediateResult;
        return immediateResult;
      }

      const { canvas, ctx, width, height } = canvasData;
      const result = immediateResult;

      // Confirm profile (was "pending")
      result.profile = resolvedProfileName;

      // Run OCR + depth in parallel
      const promises = [];

      // Depth estimation (Phase 11A) — profile-gated
      if (profile.depth && profile.depth.enabled !== false) {
        const depthTransformers = window.ImageDescriberAnalyserTransformers;
        if (depthTransformers) {
          emitStage("depth", "running");
          const depthPromise = depthTransformers
            .estimateDepth(canvas)
            .then((depthResult) => {
              result.depth = depthResult;
              emitStage("depth", "complete");
            })
            .catch((err) => {
              logWarn("Depth estimation failed:", err.message);
              result.depth = { status: "error", error: err.message };
              emitStage("depth", "error");
            });
          promises.push(depthPromise);
        }
      } else {
        emitStage("depth", "skipped");
        result.depth = { status: "skipped" };
      }

      // OCR — profile-gated + skipOCR option
      if (
        profile.ocr &&
        profile.ocr.enabled !== false &&
        !skipOCR
      ) {
        emitStage("ocr", "running");
        const ocrConfig = Object.assign({}, profile.ocr);
        if (profile.suppression) {
          ocrConfig.suppression = profile.suppression;
        }
        promises.push(
          ocrEngine()
            .runOCR(canvas, width, height, ocrConfig)
            .then((ocrResult) => {
              result.ocr = ocrResult;
              emitStage("ocr", "complete");
            }),
        );
      } else {
        const skipReason = skipOCR
          ? "User skipped text detection"
          : "Profile OCR disabled";
        emitStage("ocr", "skipped");
        result.ocr = {
          status: "skipped",
          duration: null,
          error: null,
          items: [],
          labelCount: 0,
          quadrantSummary: {
            "top-left": [],
            "top-right": [],
            "bottom-left": [],
            "bottom-right": [],
            centre: [],
          },
        };
        logDebug(`OCR skipped: ${skipReason}`);
      }

      // Await all gated analysers
      await Promise.all(promises);

      // Cross-reference OCR labels with nearby colours
      if (
        result.ocr &&
        result.ocr.status === "complete" &&
        result.colour &&
        result.colour.status === "complete" &&
        result.ocr.items.length > 0
      ) {
        try {
          xrefEngine().crossReference(
            result.ocr,
            result.colour,
            ctx,
            width,
            height,
          );
          logDebug("Cross-referencing complete");
        } catch (err) {
          logWarn("Cross-referencing failed:", err.message);
        }
      }

      // Re-run full classification with OCR + depth data now available
      let clipResult = result.classification?.clip || null;
      if (typeof window.ImageDescriberAnalyserClassify !== "undefined") {
        try {
          result.classification =
            window.ImageDescriberAnalyserClassify.suggestProfile(
              result,
              clipResult,
            );
          logDebug(
            "Gated classification:",
            result.classification?.profile,
            `(${Math.round((result.classification?.confidence || 0) * 100)}%)`,
          );
        } catch (err) {
          logWarn("Classification failed:", err);
          result.classification = null;
        }
      }

      // Re-attach CLIP data if available
      if (clipResult && clipResult.status === "success") {
        if (!result.classification) {
          result.classification = {
            profile: null,
            confidence: 0,
            reason: "No heuristic signal",
            source: "heuristic",
            scores: {},
          };
        }
        result.classification.clip = clipResult;
      }

      // Florence-2 — opt-in only (unchanged)
      result.florenceCaption = { status: "skipped" };
      result.florenceObjects = { status: "skipped" };

      // Finalise timing
      result.completedAt = Date.now();
      result.totalDuration = result.completedAt - result.startedAt;

      emitStage("analysis", "complete", { duration: result.totalDuration });

      // Store as last analysis
      this.lastAnalysis = result;

      logInfo(
        `Gated analysis complete in ${result.totalDuration}ms ` +
          `(OCR: ${result.ocr?.status}, Depth: ${result.depth?.status})`,
      );

      // Phase 9B/11C: Save to cache if hash is available
      if (
        typeof window.ImageDescriberCache !== "undefined" &&
        typeof window.ImageDescriberController !== "undefined" &&
        window.ImageDescriberController.currentFileHash
      ) {
        const hash = window.ImageDescriberController.currentFileHash;
        const stripped = window.ImageDescriberCache.stripForCache(result);
        window.ImageDescriberCache.save(hash, stripped)
          .then(function () {
            if (typeof window.imgdescMMRefreshCacheStats === "function") {
              window.imgdescMMRefreshCacheStats();
            }
          })
          .catch(function (err) {
            logWarn("Failed to save analysis to cache:", err.message);
          });
        logDebug(
          "Analysis saved to cache (stripped): " +
            hash.substring(0, 16) +
            "...",
        );
      }

      return result;
    },

    // ========================================================================
    // PUBLIC API: extractLabels()
    // ========================================================================

    /**
     * Runs OCR only, returning an OCRAnalysisResult.
     *
     * @param {HTMLImageElement|HTMLCanvasElement|File|string} imageSource
     * @returns {Promise<object>} OCRAnalysisResult
     */
    async extractLabels(imageSource) {
      const u = utils();
      let width, height;

      try {
        const canvasData = await u.loadImageToCanvas(imageSource);
        width = canvasData.width;
        height = canvasData.height;
      } catch (err) {
        logError("Failed to determine image dimensions:", err);
        return {
          status: "failed",
          duration: null,
          error: "Failed to load image: " + err.message,
          items: [],
          labelCount: 0,
          quadrantSummary: {
            "top-left": [],
            "top-right": [],
            "bottom-left": [],
            "bottom-right": [],
            centre: [],
          },
        };
      }

      return ocrEngine().runOCR(
        imageSource,
        width,
        height,
        u.PROFILES.default.ocr,
      );
    },

    // ========================================================================
    // PUBLIC API: sampleColours()
    // ========================================================================

    /**
     * Runs colour sampling only, returning a ColourAnalysisResult.
     *
     * @param {HTMLImageElement|HTMLCanvasElement|File|string} imageSource
     * @param {object} [gridConfig] — optional grid configuration override
     * @returns {Promise<object>} ColourAnalysisResult
     */
    async sampleColours(imageSource, gridConfig) {
      const u = utils();
      let ctx, width, height;

      try {
        const canvasData = await u.loadImageToCanvas(imageSource);
        ctx = canvasData.ctx;
        width = canvasData.width;
        height = canvasData.height;
      } catch (err) {
        logError("Failed to load image for colour sampling:", err);
        return {
          status: "failed",
          duration: null,
          error: "Failed to load image: " + err.message,
          gridConfig: null,
          regions: [],
          palette: [],
          luminanceRange: 0,
          gradientDirection: null,
          isDarkDominant: false,
          isHighContrast: false,
        };
      }

      const colourConfig = Object.assign({}, u.PROFILES.default.colour);
      if (gridConfig) {
        colourConfig.grid = gridConfig;
      }

      return colourEngine().runColourAnalysis(ctx, width, height, colourConfig);
    },

    // ========================================================================
    // PUBLIC API: crossReference()
    // ========================================================================

    /**
     * Post-processing: pairs OCR labels with nearby colours.
     * Mutates ocr.items to populate nearbyColour fields.
     *
     * @param {object} ocr — OCRAnalysisResult
     * @param {object} colour — ColourAnalysisResult
     * @param {CanvasRenderingContext2D} ctx — canvas context for sampling
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    crossReference(ocr, colour, ctx, canvasWidth, canvasHeight) {
      xrefEngine().crossReference(ocr, colour, ctx, canvasWidth, canvasHeight);
    },

    // ========================================================================
    // PUBLIC API: formatForPrompt()
    // ========================================================================

    /**
     * Formats an ImageAnalysisResult into prompt text.
     * Returns an empty string if no analysers produced usable results.
     *
     * @param {object} analysis — ImageAnalysisResult
     * @param {object} [config] — optional { confidenceThreshold }
     * @returns {string}
     */
    formatForPrompt(analysis, config) {
      return formatEngine().formatForPrompt(analysis, config);
    },

    // ========================================================================
    // PUBLIC API: destroy()
    // ========================================================================

    /**
     * Cleans up the Tesseract worker and any other resources.
     */
    async destroy() {
      await ocrEngine().destroyWorker();
      this.lastAnalysis = null;
    },

    // ========================================================================
    // INTERNAL: _buildFailedResult()
    // ========================================================================

    /**
     * Constructs a minimal failed result when the image cannot be loaded.
     */
    _buildFailedResult(startedAt, profileName, errorMessage) {
      const u = utils();
      const now = Date.now();
      return {
        schemaVersion: u.SCHEMA_VERSION,
        source: {
          width: 0,
          height: 0,
          aspectRatio: 0,
          compressionApplied: false,
          originalWidth: 0,
          originalHeight: 0,
        },
        profile: profileName,
        startedAt,
        completedAt: now,
        totalDuration: now - startedAt,
        ocr: {
          status: "failed",
          duration: null,
          error: errorMessage,
          items: [],
          labelCount: 0,
          quadrantSummary: {
            "top-left": [],
            "top-right": [],
            "bottom-left": [],
            "bottom-right": [],
            centre: [],
          },
        },
        colour: {
          status: "failed",
          duration: null,
          error: errorMessage,
          gridConfig: null,
          regions: [],
          palette: [],
          luminanceRange: 0,
          gradientDirection: null,
          isDarkDominant: false,
          isHighContrast: false,
        },
        // Florence-2 slots (Phase 10B)
        florenceCaption: null,
        florenceObjects: null,
        // Future analyser slots
        edges: null,
        objects: null,
        faces: null,
        depth: null,
        classification: null,
      };
    },
  };

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyser = ImageDescriberAnalyser;

  logInfo(
    "Image Describer Analyser loaded (call analyse() with an image source to begin)",
  );
})();
