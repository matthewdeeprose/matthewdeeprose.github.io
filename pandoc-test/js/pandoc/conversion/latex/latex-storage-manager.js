// latex-storage-manager.js
// Protected LaTeX Storage Manager
// Prevents overwrites during exports and enforces data freshness
// Part of Enhanced Pandoc-WASM Mathematical Playground macro extraction fixes

const LatexStorageManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("LATEX_STORAGE", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[LATEX_STORAGE]"),
    logWarn: console.warn.bind(console, "[LATEX_STORAGE]"),
    logInfo: console.log.bind(console, "[LATEX_STORAGE]"),
    logDebug: console.log.bind(console, "[LATEX_STORAGE]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // STORAGE STATE
  // ===========================================================================================

  let storageState = {
    latexContent: null,
    storageTimestamp: null,
    isLocked: false,
    lockReasonText: null,
    isExportInProgress: false,
    conversionIdentifier: null, // Track which conversion this LaTeX belongs to
  };

  // ===========================================================================================
  // CORE STORAGE FUNCTIONS
  // ===========================================================================================

  /**
   * Store LaTeX source with protection against overwrites
   * @param {string} latexSource - LaTeX content to store
   * @param {boolean} forceOverride - Force storage even if locked (use with caution)
   * @returns {boolean} - Success status
   */
  function storeLatexSource(latexSource, forceOverride = false) {
    logDebug("storeLatexSource() called", {
      inputSize: latexSource?.length,
      forceOverride,
      currentlyLocked: storageState.isLocked,
      exportInProgress: storageState.isExportInProgress,
    });

    // Validation
    if (!latexSource || typeof latexSource !== "string") {
      logError("Invalid LaTeX source - must be non-empty string");
      return false;
    }

    if (latexSource.trim().length === 0) {
      logWarn("Empty LaTeX source - refusing to store");
      return false;
    }

    // Protection: Prevent overwrite if export is in progress
    if (storageState.isExportInProgress && !forceOverride) {
      logWarn("🔒 Export in progress - refusing to overwrite LaTeX storage");
      logWarn(
        `   Current storage: ${storageState.latexContent?.length || 0} chars`
      );
      logWarn(`   Attempted storage: ${latexSource.length} chars`);
      logWarn(
        "   Use forceOverride=true to override (not recommended during export)"
      );
      return false;
    }

    // Protection: Prevent overwrite if manually locked
    if (storageState.isLocked && !forceOverride) {
      logWarn(`🔒 Storage locked: ${storageState.lockReasonText}`);
      logWarn("   Use forceOverride=true to override or unlock() first");
      return false;
    }

    // Store the LaTeX
    const previousSize = storageState.latexContent?.length || 0;
    storageState.latexContent = latexSource;
    storageState.storageTimestamp = Date.now();
    storageState.conversionIdentifier = `conv_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    if (forceOverride) {
      logWarn(
        `⚠️  FORCED storage: ${latexSource.length.toLocaleString()} chars (previous: ${previousSize.toLocaleString()})`
      );
    } else {
      logInfo(
        `✅ Stored ${latexSource.length.toLocaleString()} chars of LaTeX`
      );
    }

    logDebug(`   Conversion ID: ${storageState.conversionIdentifier}`);
    logDebug(`   Locked: ${storageState.isLocked}`);
    logDebug(`   Export in progress: ${storageState.isExportInProgress}`);

    return true;
  }

  /**
   * Retrieve stored LaTeX with freshness validation
   * @param {number} maxAgeMinutes - Maximum age in minutes (default: 10)
   * @returns {string|null} - LaTeX source or null if unavailable/stale
   */
  function getLatexSource(maxAgeMinutes = 10) {
    logDebug("getLatexSource() called", { maxAgeMinutes });

    if (!storageState.latexContent) {
      logWarn("No LaTeX in storage");
      return null;
    }

    const ageSeconds = Math.floor(
      (Date.now() - storageState.storageTimestamp) / 1000
    );
    const ageMinutes = Math.floor(ageSeconds / 60);

    logDebug(
      `Stored LaTeX age: ${ageMinutes}m ${
        ageSeconds % 60
      }s (max: ${maxAgeMinutes}m)`
    );

    // Enforce freshness requirement
    if (ageMinutes > maxAgeMinutes) {
      logError(
        `❌ Stored LaTeX is ${ageMinutes} minutes old (max allowed: ${maxAgeMinutes})`
      );
      logError("   Data is too stale - refusing to use");
      logError("   💡 Solution: Reconvert the document to refresh storage");
      return null;
    }

    // Warning for approaching staleness
    if (ageMinutes > 5) {
      logWarn(
        `⚠️  Stored LaTeX is ${ageMinutes} minutes old - approaching stale threshold`
      );
    }

    logInfo(
      `Retrieved ${storageState.latexContent.length.toLocaleString()} chars of LaTeX (age: ${ageMinutes}m)`
    );
    return storageState.latexContent;
  }

  /**
   * Clear stored LaTeX
   * @param {string} clearReason - Reason for clearing (for logging)
   * @returns {boolean} - Success status
   */
  function clearStorage(clearReason = "Manual clear") {
    logInfo(`Clearing LaTeX storage: ${clearReason}`);

    const hadData = !!storageState.latexContent;
    const previousSize = storageState.latexContent?.length || 0;

    storageState.latexContent = null;
    storageState.storageTimestamp = null;
    storageState.conversionIdentifier = null;

    if (hadData) {
      logInfo(`   Cleared ${previousSize.toLocaleString()} chars`);
    } else {
      logDebug("   Storage was already empty");
    }

    return true;
  }

  // ===========================================================================================
  // PROTECTION FUNCTIONS
  // ===========================================================================================

  /**
   * Lock storage to prevent overwrites
   * @param {string} lockReason - Reason for locking (for logging)
   */
  function lockStorage(lockReason) {
    storageState.isLocked = true;
    storageState.lockReasonText = lockReason;
    logInfo(`🔒 Storage locked: ${lockReason}`);
  }

  /**
   * Unlock storage to allow overwrites
   */
  function unlockStorage() {
    const wasLocked = storageState.isLocked;
    storageState.isLocked = false;
    storageState.lockReasonText = null;

    if (wasLocked) {
      logInfo("🔓 Storage unlocked");
    } else {
      logDebug("Storage was not locked");
    }
  }

  /**
   * Mark export as started - protects storage from overwrites
   */
  function markExportStarted() {
    storageState.isExportInProgress = true;
    logInfo("🔒 Export started - storage protected from overwrites");
    logDebug(`   Protecting: ${storageState.latexContent?.length || 0} chars`);
  }

  /**
   * Mark export as complete - allows storage overwrites again
   */
  function markExportFinished() {
    const wasInProgress = storageState.isExportInProgress;
    storageState.isExportInProgress = false;

    if (wasInProgress) {
      logInfo("🔓 Export complete - storage unprotected");
    } else {
      logDebug("Export was not marked as in progress");
    }
  }

  // ===========================================================================================
  // STATUS AND DIAGNOSTICS
  // ===========================================================================================

  /**
   * Get comprehensive storage status
   * @returns {Object} - Status object with all storage details
   */
  function getStorageStatus() {
    const ageSeconds = storageState.storageTimestamp
      ? Math.floor((Date.now() - storageState.storageTimestamp) / 1000)
      : null;
    const ageMinutes = ageSeconds ? Math.floor(ageSeconds / 60) : null;

    return {
      hasData: !!storageState.latexContent,
      contentSize: storageState.latexContent
        ? storageState.latexContent.length
        : 0,
      ageSeconds,
      ageMinutes,
      isLocked: storageState.isLocked,
      lockReason: storageState.lockReasonText,
      isExportInProgress: storageState.isExportInProgress,
      conversionId: storageState.conversionIdentifier,
      timestamp: storageState.storageTimestamp
        ? new Date(storageState.storageTimestamp).toISOString()
        : null,
      isStale: ageMinutes ? ageMinutes > 10 : null,
      isApproachingStale: ageMinutes
        ? ageMinutes > 5 && ageMinutes <= 10
        : null,
    };
  }

  /**
   * Validate that storage is ready for export
   * @param {number} maxAgeMinutes - Maximum acceptable age
   * @returns {Object} - Validation result with detailed information
   */
  function validateStorageForExport(maxAgeMinutes = 10) {
    logDebug("validateStorageForExport() called", { maxAgeMinutes });

    const currentStatus = getStorageStatus();
    const validationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      status: currentStatus,
    };

    // Check 1: Has data
    if (!currentStatus.hasData) {
      validationResult.errors.push("No LaTeX in storage");
      logError("Validation failed: No LaTeX in storage");
      return validationResult;
    }

    // Check 2: Not too old
    if (currentStatus.isStale) {
      validationResult.errors.push(
        `Data is ${currentStatus.ageMinutes} minutes old (max: ${maxAgeMinutes})`
      );
      logError(
        `Validation failed: Data is ${currentStatus.ageMinutes} minutes old (max: ${maxAgeMinutes})`
      );
      return validationResult;
    }

    // Warning: Approaching stale
    if (currentStatus.isApproachingStale) {
      validationResult.warnings.push(
        `Data is ${currentStatus.ageMinutes} minutes old (approaching stale threshold)`
      );
      logWarn(
        `Validation warning: Data is ${currentStatus.ageMinutes} minutes old`
      );
    }

    // All checks passed
    validationResult.isValid = true;
    logInfo(`✅ Validation passed: Storage ready for export`);
    logDebug(`   Size: ${currentStatus.contentSize.toLocaleString()} chars`);
    logDebug(`   Age: ${currentStatus.ageMinutes}m`);

    return validationResult;
  }

  // ===========================================================================================
  // TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Clear storage for testing (use with caution in production)
   */
  function _clearAllStateForTesting() {
    logWarn("⚠️  TEST MODE: Clearing all storage state");
    storageState = {
      latexContent: null,
      storageTimestamp: null,
      isLocked: false,
      lockReasonText: null,
      isExportInProgress: false,
      conversionIdentifier: null,
    };
  }

  /**
   * Test the storage manager
   */
  function testLatexStorageManager() {
    const testSuite = {
      moduleExists: () => !!window.LatexStorageManager,

      basicStorage: () => {
        _clearAllStateForTesting();
        const testLatex = "\\newcommand{\\R}{\\mathbb{R}}";
        const stored = storeLatexSource(testLatex);
        const retrieved = getLatexSource();
        return stored && retrieved === testLatex;
      },

      preventOverwriteDuringExport: () => {
        _clearAllStateForTesting();
        storeLatexSource("Original LaTeX");
        markExportStarted();
        const overwriteBlocked = !storeLatexSource("New LaTeX");
        markExportFinished();
        const overwriteAllowed = storeLatexSource("New LaTeX after export");
        return overwriteBlocked && overwriteAllowed;
      },

      stalenessDetection: () => {
        _clearAllStateForTesting();
        storeLatexSource("Test LaTeX");
        // Manually set old timestamp
        storageState.storageTimestamp = Date.now() - 11 * 60 * 1000; // 11 minutes ago
        const retrieved = getLatexSource(10); // Max 10 minutes
        return retrieved === null; // Should reject stale data
      },

      manualLocking: () => {
        _clearAllStateForTesting();
        storeLatexSource("Original");
        lockStorage("Testing lock");
        const blocked = !storeLatexSource("Should be blocked");
        unlockStorage();
        const allowed = storeLatexSource("Should be allowed");
        return blocked && allowed;
      },

      validation: () => {
        _clearAllStateForTesting();
        storeLatexSource("Test LaTeX");
        const validation = validateStorageForExport();
        return validation.isValid && validation.errors.length === 0;
      },
    };

    return (
      window.TestUtilities?.runTestSuite?.(
        "LatexStorageManager",
        testSuite
      ) || {
        error: "TestUtilities not available",
        tests: Object.keys(testSuite),
      }
    );
  }

  // ===========================================================================================
  // MODULE INITIALIZATION
  // ===========================================================================================

  logInfo("LatexStorageManager module loaded");
  logInfo("Protected storage system ready");

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functions
    store: storeLatexSource,
    get: getLatexSource,
    clear: clearStorage,

    // Protection functions
    lock: lockStorage,
    unlock: unlockStorage,
    markExportStart: markExportStarted,
    markExportComplete: markExportFinished,

    // Status and diagnostics
    getStatus: getStorageStatus,
    validateForExport: validateStorageForExport,

    // Testing
    test: testLatexStorageManager,
    _clearForTest: _clearAllStateForTesting, // Exposed for testing, use with caution
  };
})();

// Make globally available
window.LatexStorageManager = LatexStorageManager;
// Add alias with correct LaTeX casing for backward compatibility
window.LaTeXStorageManager = LatexStorageManager;

// Export for module systems (if available)
if (typeof module !== "undefined" && module.exports) {
  module.exports = LatexStorageManager;
}
