/**
 * ===================================================================
 * TESTS: Pre-Refactor Regression — Controller Extraction
 * ===================================================================
 *
 * Structural/existence checks for every method about to be extracted
 * into controller-analysis.js and controller-camera.js.
 *
 * Run BEFORE any code moves.  Run AFTER each extraction.
 * If it passes both times the refactoring is proven safe.
 *
 * Run:
 *   ImageDescriberTests.run('refactor-controller');
 *   ImageDescriberTests.run('refactor-controller', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: Refactor — controller extraction
 * ===================================================================
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-Refactor] ImageDescriberTests not loaded — cannot register."
    );
    return;
  }

  // ── Logging configuration ──────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[Tests-Refactor]", message, ...args);
  }

  // Shorthand
  const controller = window.ImageDescriberController;

  window.ImageDescriberTests.register("refactor-controller", {
    name: "Pre-Refactor Regression: Controller Extraction",
    tests: {
      // ────────────────────────────────────────────────────────────
      // Section A: Analysis Profile Selection (3 methods)
      // ────────────────────────────────────────────────────────────

      "A1: getSelectedProfile exists and is a function": function () {
        if (typeof controller.getSelectedProfile !== "function") {
          return { pass: false, reason: "getSelectedProfile is not a function" };
        }
        const result = controller.getSelectedProfile();
        if (typeof result !== "string") {
          return {
            pass: false,
            reason:
              "getSelectedProfile() did not return a string, got " +
              typeof result,
          };
        }
        return { pass: true };
      },

      "A2: setSelectedProfile exists and round-trips": function () {
        if (typeof controller.setSelectedProfile !== "function") {
          return { pass: false, reason: "setSelectedProfile is not a function" };
        }
        controller.setSelectedProfile("default");
        var got = controller.getSelectedProfile();
        if (got !== "default") {
          return {
            pass: false,
            reason:
              "After setSelectedProfile('default'), getSelectedProfile() returned '" +
              got +
              "'",
          };
        }
        return { pass: true };
      },

      "A3: handleProfileChange exists and is a function": function () {
        if (typeof controller.handleProfileChange !== "function") {
          return { pass: false, reason: "handleProfileChange is not a function" };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section B: Profile Suggestion (8 methods)
      // ────────────────────────────────────────────────────────────

      "B4: showProfileSuggestion exists": function () {
        if (typeof controller.showProfileSuggestion !== "function") {
          return {
            pass: false,
            reason: "showProfileSuggestion is not a function",
          };
        }
        return { pass: true };
      },

      "B5: _updateAnalysisStatus exists": function () {
        if (typeof controller._updateAnalysisStatus !== "function") {
          return {
            pass: false,
            reason: "_updateAnalysisStatus is not a function",
          };
        }
        return { pass: true };
      },

      "B6: _createAnalysisSlotLi exists": function () {
        if (typeof controller._createAnalysisSlotLi !== "function") {
          return {
            pass: false,
            reason: "_createAnalysisSlotLi is not a function",
          };
        }
        return { pass: true };
      },

      "B7: _updateAnalysisSlotLi exists": function () {
        if (typeof controller._updateAnalysisSlotLi !== "function") {
          return {
            pass: false,
            reason: "_updateAnalysisSlotLi is not a function",
          };
        }
        return { pass: true };
      },

      "B8: applyProfileSuggestion exists": function () {
        if (typeof controller.applyProfileSuggestion !== "function") {
          return {
            pass: false,
            reason: "applyProfileSuggestion is not a function",
          };
        }
        return { pass: true };
      },

      "B9: applyAlternativeSuggestion exists": function () {
        if (typeof controller.applyAlternativeSuggestion !== "function") {
          return {
            pass: false,
            reason: "applyAlternativeSuggestion is not a function",
          };
        }
        return { pass: true };
      },

      "B10: chooseProfileManually exists": function () {
        if (typeof controller.chooseProfileManually !== "function") {
          return {
            pass: false,
            reason: "chooseProfileManually is not a function",
          };
        }
        return { pass: true };
      },

      "B11: dismissProfileSuggestion exists": function () {
        if (typeof controller.dismissProfileSuggestion !== "function") {
          return {
            pass: false,
            reason: "dismissProfileSuggestion is not a function",
          };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section C: Cache Recall Banner (3 methods)
      // ────────────────────────────────────────────────────────────

      "C12: showCacheRecallBanner exists": function () {
        if (typeof controller.showCacheRecallBanner !== "function") {
          return {
            pass: false,
            reason: "showCacheRecallBanner is not a function",
          };
        }
        return { pass: true };
      },

      "C13: hideCacheRecallBanner exists": function () {
        if (typeof controller.hideCacheRecallBanner !== "function") {
          return {
            pass: false,
            reason: "hideCacheRecallBanner is not a function",
          };
        }
        return { pass: true };
      },

      "C14: reanalyse exists": function () {
        if (typeof controller.reanalyse !== "function") {
          return { pass: false, reason: "reanalyse is not a function" };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section D: Background Analysis (2 methods)
      // ────────────────────────────────────────────────────────────

      "D15: startBackgroundAnalysis exists": function () {
        if (typeof controller.startBackgroundAnalysis !== "function") {
          return {
            pass: false,
            reason: "startBackgroundAnalysis is not a function",
          };
        }
        return { pass: true };
      },

      "D16: runGatedAnalysis exists": function () {
        if (typeof controller.runGatedAnalysis !== "function") {
          return { pass: false, reason: "runGatedAnalysis is not a function" };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section E: Florence-2 Opt-in (2 methods)
      // ────────────────────────────────────────────────────────────

      "E17: runFlorenceAnalysis exists": function () {
        if (typeof controller.runFlorenceAnalysis !== "function") {
          return {
            pass: false,
            reason: "runFlorenceAnalysis is not a function",
          };
        }
        return { pass: true };
      },

      "E18: _updateFlorenceOptinState exists": function () {
        if (typeof controller._updateFlorenceOptinState !== "function") {
          return {
            pass: false,
            reason: "_updateFlorenceOptinState is not a function",
          };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section F: Florence-2 OCR Quick-Access (2 methods)
      // ────────────────────────────────────────────────────────────

      "F19: _updateFlorenceOCRPrompt exists": function () {
        if (typeof controller._updateFlorenceOCRPrompt !== "function") {
          return {
            pass: false,
            reason: "_updateFlorenceOCRPrompt is not a function",
          };
        }
        return { pass: true };
      },

      "F20: runFlorenceOCRDirect exists": function () {
        if (typeof controller.runFlorenceOCRDirect !== "function") {
          return {
            pass: false,
            reason: "runFlorenceOCRDirect is not a function",
          };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section G: Camera Capture (11 methods)
      // ────────────────────────────────────────────────────────────

      "G21: initCamera exists": function () {
        if (typeof controller.initCamera !== "function") {
          return { pass: false, reason: "initCamera is not a function" };
        }
        return { pass: true };
      },

      "G22: showCameraUnavailable exists": function () {
        if (typeof controller.showCameraUnavailable !== "function") {
          return {
            pass: false,
            reason: "showCameraUnavailable is not a function",
          };
        }
        return { pass: true };
      },

      "G23: toggleCamera exists": function () {
        if (typeof controller.toggleCamera !== "function") {
          return { pass: false, reason: "toggleCamera is not a function" };
        }
        return { pass: true };
      },

      "G24: toggleCameraMirror exists": function () {
        if (typeof controller.toggleCameraMirror !== "function") {
          return {
            pass: false,
            reason: "toggleCameraMirror is not a function",
          };
        }
        return { pass: true };
      },

      "G25: showCapturedPreview exists": function () {
        if (typeof controller.showCapturedPreview !== "function") {
          return {
            pass: false,
            reason: "showCapturedPreview is not a function",
          };
        }
        return { pass: true };
      },

      "G26: rotateCapturedPhoto exists": function () {
        if (typeof controller.rotateCapturedPhoto !== "function") {
          return {
            pass: false,
            reason: "rotateCapturedPhoto is not a function",
          };
        }
        return { pass: true };
      },

      "G27: flipCapturedPhoto exists": function () {
        if (typeof controller.flipCapturedPhoto !== "function") {
          return {
            pass: false,
            reason: "flipCapturedPhoto is not a function",
          };
        }
        return { pass: true };
      },

      "G28: confirmCapturedPhoto exists": function () {
        if (typeof controller.confirmCapturedPhoto !== "function") {
          return {
            pass: false,
            reason: "confirmCapturedPhoto is not a function",
          };
        }
        return { pass: true };
      },

      "G29: retakePhoto exists": function () {
        if (typeof controller.retakePhoto !== "function") {
          return { pass: false, reason: "retakePhoto is not a function" };
        }
        return { pass: true };
      },

      "G30: resetCameraUI exists": function () {
        if (typeof controller.resetCameraUI !== "function") {
          return { pass: false, reason: "resetCameraUI is not a function" };
        }
        return { pass: true };
      },

      "G31: cleanupCamera exists": function () {
        if (typeof controller.cleanupCamera !== "function") {
          return { pass: false, reason: "cleanupCamera is not a function" };
        }
        return { pass: true };
      },

      // ────────────────────────────────────────────────────────────
      // Section H: Cross-file shared state properties
      // ────────────────────────────────────────────────────────────

      "H32: controller.elements is an object": function () {
        if (typeof controller.elements !== "object" || controller.elements === null) {
          return {
            pass: false,
            reason: "controller.elements is not an object",
          };
        }
        return { pass: true };
      },

      "H33: controller.lastAnalysis property exists": function () {
        if (!("lastAnalysis" in controller)) {
          return {
            pass: false,
            reason: "lastAnalysis property does not exist on controller",
          };
        }
        return { pass: true };
      },

      "H34: controller._analysisPending property exists": function () {
        if (!("_analysisPending" in controller)) {
          return {
            pass: false,
            reason: "_analysisPending property does not exist on controller",
          };
        }
        return { pass: true };
      },

      "H35: controller.currentFileHash property exists": function () {
        if (!("currentFileHash" in controller)) {
          return {
            pass: false,
            reason: "currentFileHash property does not exist on controller",
          };
        }
        return { pass: true };
      },

      "H36: controller.cameraInstance property exists": function () {
        if (!("cameraInstance" in controller)) {
          return {
            pass: false,
            reason: "cameraInstance property does not exist on controller",
          };
        }
        return { pass: true };
      },

      "H37: controller.cameraInitialised property exists": function () {
        if (!("cameraInitialised" in controller)) {
          return {
            pass: false,
            reason: "cameraInitialised property does not exist on controller",
          };
        }
        return { pass: true };
      },
    },
  });
})();
