// ─── MathPixSessionRestorer File Registration Mixin ──────────────────────────
// File registration, cleanup, and utilities.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-file-registration.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // NEW SESSION
  // =========================================================================

  /**
   * Start new session (with unsaved changes confirmation)
   */
  proto.startNewSession = function () {
    logDebug("Starting new session requested");

    if (this.hasUnsavedChanges) {
      if (!confirm(RESTORER_CONFIG.MESSAGES.CONFIRM_NEW_SESSION)) {
        return;
      }
    }

    this.cleanup();
    this.resetToUploadState();
    this.showNotification("Ready for new session", "info");
  };

  /**
   * Reset UI to initial upload state
   * @private
   */
  proto.resetToUploadState = function () {
    logDebug("Resetting to upload state");

    // Show upload section
    if (this.elements.uploadSection) {
      this.elements.uploadSection.hidden = false;
    }

    // Hide working area
    if (this.elements.workingArea) {
      this.elements.workingArea.hidden = true;
    }

    // Hide edit selection
    this.hideEditSelectionDialog();

    // Clear validation messages
    this.clearValidationMessages();

    // Reset drop zone
    this.hideLoadingState();

    // Clear parse result
    this.parseResult = null;
    this.selectedEdit = null;
    this.hasUnsavedChanges = false;

    // Phase 8F: Clear raw ZIP file reference
    this._rawZIPFile = null;

    // Update storage dashboard (Phase 9 Feature 1A)
    this.updateStorageDashboard();
  };

  // =========================================================================
  // CLEANUP
  // =========================================================================

  /**
   * Clean up resources
   */
  proto.cleanup = function () {
    logDebug("Cleaning up session restorer resources");

    // Unsubscribe from MathJax recovery events
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
      this.mathJaxRecoveryUnsubscribe = null;
      logDebug("Unsubscribed from MathJax recovery events");
    }

    // Clear recovery state
    this.pendingPreviewRender = false;
    this.pendingContent = null;

    // Revoke object URLs
    this.objectURLs.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        logWarn("Failed to revoke object URL:", error);
      }
    });
    this.objectURLs = [];

    // Clear cached data
    this.parseResult = null;
    this.selectedEdit = null;
    this.restoredSession = null;
    this.hasUnsavedChanges = false;
    this.pdfRenderedForComparison = false;

    // Phase 8F: Clear image restore state
    // Note: blob URLs are already revoked above via this.objectURLs
    this.imageBlobUrlMap.clear();
    this.imageRegistry = null;
    this._rawZIPFile = null;

    // Phase 8G: Clear display layer state
    if (this.displayLayer) {
      this.displayLayer.clear();
    }
    this.isDisplayCollapsed = false;

    // Clear preview debounce
    clearTimeout(this.previewDebounce);
  };

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  /**
   * Show notification to user
   * @param {string} message - Message to display
   * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
   * @private
   */
  proto.showNotification = function (message, type = "info") {
    // Use controller's notification method if available
    if (
      this.controller &&
      typeof this.controller.showNotification === "function"
    ) {
      this.controller.showNotification(message, type);
      return;
    }

    // Use global notification functions if available
    const notifyFn = {
      success: window.notifySuccess,
      error: window.notifyError,
      warning: window.notifyWarning,
      info: window.notifyInfo,
    }[type];

    if (notifyFn) {
      notifyFn(message);
      return;
    }

    // Fallback to console
    logInfo(`Notification (${type}): ${message}`);
  };

  // =========================================================================
  // DEBUG / TEST INTERFACE
  // =========================================================================

  /**
   * Get debug information
   * @returns {Object} Debug information
   */
  proto.getDebugInfo = function () {
    return {
      isInitialised: this.isInitialised,
      hasParser: !!this.parser,
      hasParseResult: !!this.parseResult,
      hasRestoredSession: !!this.restoredSession,
      hasUnsavedChanges: this.hasUnsavedChanges,
      elementCount: Object.values(this.elements).filter(Boolean).length,
      objectURLCount: this.objectURLs.length,
      sessionKey: this.restoredSession?.sessionKey || null,
      sourceFilename: this.restoredSession?.source?.filename || null,
      isPDF: this.restoredSession?.isPDF || false,
      // Phase 8F: Image restore state
      hasImageRegistry: !!this.imageRegistry,
      imageBlobUrlCount: this.imageBlobUrlMap.size,
      imageRegistryCount: this.imageRegistry?.getCount?.() || 0,
      // Phase 8G: Display layer state
      isDisplayCollapsed: this.isDisplayCollapsed,
      displayLayerActive: !!this.displayLayer?.hasActiveMappings(),
      displayLayerMapSize: this.displayLayer?.getMapSize() || 0,
    };
  };

  /**
   * Validate module configuration
   * @returns {boolean} True if properly configured
   */
  proto.validate = function () {
    const required = [
      "container",
      "uploadSection",
      "dropZone",
      "fileInput",
      "workingArea",
    ];
    const missing = required.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      logWarn("Missing required elements:", missing);
      return false;
    }

    return this.isInitialised;
  };

  console.log("[SessionRestorer] File registration mixin loaded");
})();
