// latex-processor-coordinator.js
// LaTeX Processor Coordinator - Intelligent Export Method Selection
// STAGE 6: Routes between legacy and enhanced processors with automatic fallback

const LaTeXProcessorCoordinator = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
  // ===========================================================================================
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[COORDINATOR]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[COORDINATOR]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[COORDINATOR]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[COORDINATOR]", message, ...args);
  }

  // ===========================================================================================
  // CONFIGURATION
  // ===========================================================================================

  let exportMethod = "auto"; // Default: try enhanced, fallback to legacy

  // ===========================================================================================
  // METHOD SELECTION LOGIC
  // ===========================================================================================

  /**
   * Determine which export method to use
   * @returns {string} - "enhanced" or "legacy"
   */
  function selectExportMethod() {
    logDebug("Selecting export method, current setting:", exportMethod);

    // If explicitly set, honour it
    if (exportMethod === "legacy") {
      logInfo("Using legacy method (explicitly set)");
      return "legacy";
    }

    if (exportMethod === "enhanced") {
      if (isEnhancedAvailable()) {
        logInfo("Using enhanced method (explicitly set)");
        return "enhanced";
      } else {
        logWarn(
          "Enhanced method requested but unavailable, falling back to legacy"
        );
        return "legacy";
      }
    }

    // Auto mode: Try enhanced if available
    if (exportMethod === "auto") {
      if (isEnhancedAvailable()) {
        logInfo("Using enhanced method (auto-detected)");
        return "enhanced";
      } else {
        logDebug("Enhanced method unavailable, using legacy");
        return "legacy";
      }
    }

    // Fallback
    logWarn("Unknown export method setting, defaulting to legacy");
    return "legacy";
  }

  // ===========================================================================================
  // FEATURE DETECTION
  // ===========================================================================================

  /**
   * Check if enhanced processor is available and ready
   * @returns {boolean}
   */
  function isEnhancedAvailable() {
    try {
      // Check module exists
      if (typeof LaTeXProcessorEnhanced === "undefined") {
        logDebug("Enhanced processor module not loaded");
        return false;
      }

      // Check method exists
      if (typeof LaTeXProcessorEnhanced.process !== "function") {
        logDebug("Enhanced processor missing process method");
        return false;
      }

      // Check storage available
      if (!isStorageAvailable()) {
        logDebug("Enhanced processor available but no storage");
        return false;
      }

      return true;
    } catch (error) {
      logError("Error checking enhanced availability:", error);
      return false;
    }
  }

  /**
   * Check if original LaTeX is stored and available
   * @returns {boolean}
   */
  function isStorageAvailable() {
    try {
      if (typeof LaTeXProcessorEnhanced === "undefined") {
        return false;
      }

      const validation = LaTeXProcessorEnhanced.validateOriginalLatex();
      return validation.hasLatex && !validation.isStale;
    } catch (error) {
      logError("Error checking storage availability:", error);
      return false;
    }
  }

  // ===========================================================================================
  // MAIN PROCESSING FUNCTION
  // ===========================================================================================

  /**
   * Main coordinated processing function
   * Replaces direct calls to LaTeXProcessorLegacy.process()
   *
   * @param {Object} options - Processing options
   * @param {string} options.content - HTML content to process
   * @returns {Promise<Object>} - Processed content with metadata
   */
  async function processWithCoordination(options) {
    logInfo("=== COORDINATED EXPORT PROCESSING START ===");
    logDebug("Processing options:", options);

    try {
      const selectedMethod = selectExportMethod();
      logInfo(`Selected method: ${selectedMethod}`);

      if (selectedMethod === "enhanced") {
        return await processWithEnhanced(options);
      } else {
        return await processWithLegacy(options);
      }
    } catch (error) {
      logError("Coordination error:", error);
      logError("Falling back to legacy method");
      return await processWithLegacy(options);
    }
  }

  /**
   * Process using enhanced method with automatic fallback
   */
  async function processWithEnhanced(options) {
    logInfo("Attempting enhanced processing...");

    try {
      const result = LaTeXProcessorEnhanced.process(options.content);

      if (result === null) {
        logWarn("Enhanced processing returned null (storage unavailable)");
        logInfo("Falling back to legacy method");
        return await processWithLegacy(options);
      }

      // Enhanced processing succeeded
      logInfo("✅ Enhanced processing successful");
      logInfo(`- Commands found: ${result.metadata.commandCount}`);
      logInfo(`- Macros generated: ${result.metadata.macroCount}`);

      // Return in same format as legacy for compatibility
      return {
        content: result.processedContent,
        metadata: {
          method: "enhanced",
          customMacros: result.customMacros,
          commandCount: result.metadata.commandCount,
          macroCount: result.metadata.macroCount,
        },
      };
    } catch (error) {
      logError("Enhanced processing failed:", error);
      logInfo("Falling back to legacy method");
      return await processWithLegacy(options);
    }
  }

  /**
   * Process using legacy method (reliable fallback)
   */
  async function processWithLegacy(options) {
    logInfo("Using legacy processing...");

    try {
      const result = await LaTeXProcessorLegacy.process(options);

      logInfo("✅ Legacy processing successful");

      // Ensure consistent return format
      return {
        content: result.content || result,
        metadata: {
          method: "legacy",
        },
      };
    } catch (error) {
      logError("Legacy processing failed:", error);
      throw new Error("Both enhanced and legacy processing failed");
    }
  }

  // ===========================================================================================
  // COMPARISON MODE
  // ===========================================================================================

  /**
   * Generate exports using both methods for side-by-side comparison
   * Useful for testing and validation
   *
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - { legacy: result, enhanced: result }
   */
  async function processComparison(options) {
    logInfo("=== COMPARISON MODE: Processing with both methods ===");

    const results = {
      legacy: null,
      enhanced: null,
      comparisonMetadata: {
        timestamp: Date.now(),
        enhancedAvailable: isEnhancedAvailable(),
        storageAvailable: isStorageAvailable(),
      },
    };

    try {
      // Process with legacy
      logInfo("Processing with legacy method...");
      results.legacy = await processWithLegacy(options);
      logInfo("✅ Legacy processing complete");
    } catch (error) {
      logError("Legacy processing failed in comparison mode:", error);
      results.legacy = { error: error.message };
    }

    try {
      // Process with enhanced
      logInfo("Processing with enhanced method...");
      const enhancedResult = LaTeXProcessorEnhanced.process(options.content);

      if (enhancedResult) {
        results.enhanced = {
          content: enhancedResult.processedContent,
          metadata: {
            method: "enhanced",
            customMacros: enhancedResult.customMacros,
            commandCount: enhancedResult.metadata.commandCount,
            macroCount: enhancedResult.metadata.macroCount,
          },
        };
        logInfo("✅ Enhanced processing complete");
      } else {
        results.enhanced = {
          error: "Enhanced processing returned null (storage unavailable)",
        };
        logWarn("Enhanced processing unavailable");
      }
    } catch (error) {
      logError("Enhanced processing failed in comparison mode:", error);
      results.enhanced = { error: error.message };
    }

    // Compare results
    if (results.legacy && results.enhanced && !results.enhanced.error) {
      logInfo("=== COMPARISON RESULTS ===");
      logInfo("Legacy content length:", results.legacy.content?.length || 0);
      logInfo(
        "Enhanced content length:",
        results.enhanced.content?.length || 0
      );

      if (results.enhanced.metadata?.macroCount > 0) {
        logInfo(
          `Enhanced found ${results.enhanced.metadata.macroCount} custom macros`
        );
      }
    }

    return results;
  }

  // ===========================================================================================
  // CONFIGURATION API
  // ===========================================================================================

  /**
   * Set export method preference
   * @param {string} method - "auto", "enhanced", or "legacy"
   * @returns {boolean} - Success status
   */
  function setExportMethod(method) {
    const validMethods = ["auto", "enhanced", "legacy"];

    if (!validMethods.includes(method)) {
      logError(
        `Invalid export method: ${method}. Must be one of: ${validMethods.join(
          ", "
        )}`
      );
      return false;
    }

    exportMethod = method;
    logInfo(`✅ Export method set to: ${method}`);

    return true;
  }

  /**
   * Get current export method setting
   * @returns {string} - Current method ("auto", "enhanced", or "legacy")
   */
  function getExportMethod() {
    return exportMethod;
  }

  // ===========================================================================================
  // DIAGNOSTICS
  // ===========================================================================================

  /**
   * Get comprehensive diagnostics about coordinator state
   * @returns {Object} - Diagnostic information
   */
  function getDiagnostics() {
    const diagnostics = {
      module: "LaTeXProcessorCoordinator",
      version: "1.0.0-stage6",
      timestamp: new Date().toISOString(),
      configuration: {
        currentMethod: exportMethod,
        availableMethods: ["auto", "enhanced", "legacy"],
      },
      availability: {
        legacyProcessor: typeof LaTeXProcessorLegacy !== "undefined",
        enhancedProcessor: typeof LaTeXProcessorEnhanced !== "undefined",
        enhancedReady: isEnhancedAvailable(),
        storageReady: isStorageAvailable(),
      },
      selectedMethod: null,
      recommendations: [],
    };

    // Determine what method would be selected
    try {
      diagnostics.selectedMethod = selectExportMethod();
    } catch (error) {
      diagnostics.selectedMethod = "error";
    }

    // Generate recommendations
    if (!diagnostics.availability.legacyProcessor) {
      diagnostics.recommendations.push(
        "⚠️ Legacy processor unavailable - exports will fail"
      );
    }

    if (!diagnostics.availability.enhancedProcessor) {
      diagnostics.recommendations.push(
        "ℹ️ Enhanced processor not loaded - using legacy only"
      );
    }

    if (
      diagnostics.availability.enhancedProcessor &&
      !diagnostics.availability.storageReady
    ) {
      diagnostics.recommendations.push(
        "ℹ️ Enhanced processor available but no storage - convert document first"
      );
    }

    if (diagnostics.availability.enhancedReady) {
      diagnostics.recommendations.push(
        "✅ Enhanced export ready - custom commands will be preserved"
      );
    }

    logInfo("Diagnostics retrieved:", diagnostics.selectedMethod);

    return diagnostics;
  }

  // ===========================================================================================
  // MODULE INITIALISATION
  // ===========================================================================================

  logInfo("=== LaTeX Processor Coordinator Loading ===");
  logInfo("Default export method:", exportMethod);

  // Initial availability check
  const initialDiagnostics = {
    legacy: typeof LaTeXProcessorLegacy !== "undefined",
    enhanced: typeof LaTeXProcessorEnhanced !== "undefined",
  };

  logInfo("Processor availability:", initialDiagnostics);

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main processing
    process: processWithCoordination,

    // Configuration
    setExportMethod: setExportMethod,
    getExportMethod: getExportMethod,

    // Feature detection
    isEnhancedAvailable: isEnhancedAvailable,
    isStorageAvailable: isStorageAvailable,

    // Comparison mode
    processComparison: processComparison,

    // Diagnostics
    getDiagnostics: getDiagnostics,
  };
})();

// Make globally available for other modules
window.LaTeXProcessorCoordinator = LaTeXProcessorCoordinator;

// Export for module systems (if available)
if (typeof module !== "undefined" && module.exports) {
  module.exports = LaTeXProcessorCoordinator;
}
