// ─── MathPixSessionRestorer Index ────────────────────────────────────────────
// Creates the singleton instance, sets up global assignments, keyboard handler,
// and validates method count. MUST load after all other session-restorer-*.js files.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (typeof MathPixSessionRestorer === "undefined") {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-index.js",
    );
    return;
  }

  // ── Method count validation ───────────────────────────────────────────────
const EXPECTED_METHOD_COUNT = 202;
  const actualCount = Object.getOwnPropertyNames(
    MathPixSessionRestorer.prototype,
  ).filter(
    (name) => typeof MathPixSessionRestorer.prototype[name] === "function",
  ).length;
  if (actualCount < EXPECTED_METHOD_COUNT) {
    console.warn(
      `[SessionRestorer] Only ${actualCount}/${EXPECTED_METHOD_COUNT} methods loaded. Some mixin files may have failed.`,
    );
  } else {
    console.log(
      `[SessionRestorer] All ${actualCount} methods loaded successfully.`,
    );
  }

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  let sessionRestorerInstance = null;

  /**
   * Get or create singleton instance of MathPixSessionRestorer
   * @returns {MathPixSessionRestorer} Singleton instance
   */
  function getMathPixSessionRestorer() {
    if (!sessionRestorerInstance) {
      const { logDebug, logError } = window._SRShared || {};
      if (logDebug)
        logDebug("Creating new MathPixSessionRestorer singleton instance");

      // Try to get controller reference from main controller
      const controller = window.getMathPixController?.();

      sessionRestorerInstance = new MathPixSessionRestorer(controller);

      // Initialise asynchronously
      sessionRestorerInstance.initialise().catch((error) => {
        if (logError) logError("Failed to initialise session restorer:", error);
        else
          console.error(
            "[SessionRestorer] Failed to initialise session restorer:",
            error,
          );
      });
    }
    return sessionRestorerInstance;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixSessionRestorer = MathPixSessionRestorer;
  window.getMathPixSessionRestorer = getMathPixSessionRestorer;

  // ============================================================================
  // GLOBAL FUNCTIONS FOR HTML ONCLICK HANDLERS
  // ============================================================================

  /**
   * Toggle fullscreen mode for Resume MMD editor
   * Called by onclick in HTML buttons
   */
  window.toggleResumeMMDFullscreen = function () {
    const restorer = getMathPixSessionRestorer();
    if (restorer && restorer.isInitialised) {
      restorer.toggleFullscreen();
    } else {
      console.warn(
        "[SessionRestorer] Cannot toggle fullscreen - not initialised",
      );
    }
  };

  /**
   * Toggle edit mode for Resume MMD editor
   * Called by onclick in HTML button
   */
  window.toggleResumeMMDEdit = function () {
    const restorer = getMathPixSessionRestorer();
    if (restorer && restorer.isInitialised) {
      restorer.toggleEditMode();
    } else {
      console.warn("[SessionRestorer] Cannot toggle edit - not initialised");
    }
  };

  // ============================================================================
  // KEYBOARD EVENT HANDLER FOR ESCAPE KEY AND FOCUS MODE
  // ============================================================================

  document.addEventListener("keydown", function (event) {
    const restorer = sessionRestorerInstance;
    if (!restorer || !restorer.isInitialised) return;

    // Only handle if Resume Mode container is visible
    const container = document.getElementById("mathpix-resume-mode-container");
    if (!container || container.style.display === "none") return;

    // Ctrl+Shift+F: Toggle Focus Mode (Phase 8.3.3)
    if (event.ctrlKey && event.shiftKey && event.key === "F") {
      event.preventDefault();
      restorer.toggleFocusMode();
      return;
    }

    // Escape key handling - peel back layers one at a time
    if (event.key === "Escape") {
      // Priority 1: Exit Edit Fullscreen first (if active)
      // This takes precedence even when in Focus Mode
      if (restorer.isFullscreen) {
        event.preventDefault();
        restorer.exitFullscreen();
        return;
      }

      // Priority 2: Exit Focus Mode (if active)
      if (restorer.isFocusMode) {
        event.preventDefault();
        restorer.exitFocusMode();
        return;
      }

      // Priority 3: Exit edit mode (if editing but not fullscreen)
      const isEditing =
        restorer.elements.mmdCodeContainer?.dataset.editing === "true";
      if (isEditing) {
        event.preventDefault();
        restorer.setEditMode(false);
        // Return focus to edit button
        if (restorer.elements.mmdEditBtn) {
          restorer.elements.mmdEditBtn.focus();
        }
      }
    }
  });

  // ============================================================================
  // TEST COMMANDS
  // ============================================================================
  // Tests have been migrated to mathpix-session-restorer-tests.js
  // Include that file after this one to access test commands:
  //   - runAllSessionRestorerTests()
  //   - testSessionRestorer()
  //   - validatePhase82()
  //   - validateSessionRecoveryFixes()
  //   - testContentPreview()
  //   - testImageRestore()            (Phase 8F)
  //   - validateImageRestoreLive()    (Phase 8F)
  //   - showSessionRestorerTestHelp()
  // ============================================================================

  console.log(
    "[SessionRestorer] Index loaded — singleton created, globals assigned",
  );
})();
