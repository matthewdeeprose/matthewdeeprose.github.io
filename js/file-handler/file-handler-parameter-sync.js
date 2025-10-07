/**
 * @fileoverview File Handler Parameter Synchronization System - Phase 4.3.1
 * @description Real-time bidirectional synchronization between file uploads and parameter controls
 *
 * js/file-handler/file-handler-parameter-sync.js
 *
 * This module provides seamless synchronization between:
 * - File upload state changes → Parameter updates
 * - Parameter value changes → File state updates
 * - Cost recalculations → UI updates
 * - Engine recommendations → Smart defaults
 */

import { CONFIG } from "../config.js";

// Logging configuration (Phase 4.3+ standard pattern)
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
    console.error(`[ParameterSync] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ParameterSync] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ParameterSync] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ParameterSync] ${message}`, ...args);
}

/**
 * Parameter Synchronization System for File Handler Integration
 * Provides real-time bidirectional sync between file state and parameters
 */
export class FileHandlerParameterSync {
  constructor(fileHandler) {
    this.fileHandler = fileHandler;
    this.isInitialised = false;
    this.syncEnabled = true;

    // Parameter references
    this.pdfEngineParameter = null;
    this.parameterController = null;
    this.parameterRegistry = null;

    // State tracking
    this.currentFileState = {
      hasFile: false,
      fileType: null,
      engineRecommendation: null,
      costEstimate: null,
    };

    // Event listeners tracking
    this.boundEventHandlers = new Map();

    // Sync statistics for debugging
    this.syncStats = {
      fileToParameterSyncs: 0,
      parameterToFileSyncs: 0,
      costRecalculations: 0,
      engineRecommendations: 0,
      errors: 0,
    };

    logInfo("Parameter synchronization system initialised");
  }

  /**
   * Initialise the synchronization system
   * @returns {boolean} Success status
   */
  async initialise() {
    logInfo("Starting parameter synchronization initialisation...");

    try {
      // Get parameter system references with defensive timing
      await this.establishParameterReferences();

      // Set up bidirectional event listeners
      this.setupFileToParameterSync();
      this.setupParameterToFileSync();

      // Set up cost recalculation handlers
      this.setupCostSyncHandlers();

      // Initialize current state sync
      this.syncCurrentState();

      this.isInitialised = true;
      logInfo("Parameter synchronization initialised successfully", {
        hasParameterController: !!this.parameterController,
        hasPDFParameter: !!this.pdfEngineParameter,
        syncEnabled: this.syncEnabled,
      });

      return true;
    } catch (error) {
      logError("Failed to initialise parameter synchronization:", error);
      this.handleInitialisationFailure(error);
      return false;
    }
  }

  /**
   * Establish references to parameter system components with timing resilience
   */
  async establishParameterReferences() {
    logDebug("Establishing parameter system references...");

    // Try immediate reference acquisition
    this.parameterController = window.parameterController;
    this.parameterRegistry = window.parameterRegistry;

    if (this.parameterController && this.parameterRegistry) {
      this.pdfEngineParameter =
        this.parameterRegistry.getParameter("pdf-engine");

      if (this.pdfEngineParameter) {
        logInfo("Parameter references established immediately");
        return;
      }
    }

    // Fallback: Wait for parameter system to be ready (Phase 4.3.1 enhanced timing resilience)
    logWarn(
      "Parameter system not immediately ready, implementing enhanced timing resilience..."
    );

    let attempts = 0;
    const maxAttempts = 20; // Increased attempts
    const retryDelay = 500; // Longer delay

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      attempts++;

      logDebug(`Parameter sync attempt ${attempts}/${maxAttempts}...`);

      this.parameterController = window.parameterController;
      this.parameterRegistry = window.parameterRegistry;

      if (this.parameterController && this.parameterRegistry) {
        logInfo(
          "Parameter controller and registry found, checking PDF parameter..."
        );

        this.pdfEngineParameter =
          this.parameterRegistry.getParameter("pdf-engine");

        if (this.pdfEngineParameter) {
          logInfo(
            `Parameter references established after ${attempts} attempts`
          );
          return;
        } else {
          logDebug("PDF parameter not yet available, continuing...");
        }
      } else {
        logDebug(
          `Still waiting for parameter system... Controller: ${!!this
            .parameterController}, Registry: ${!!this.parameterRegistry}`
        );
      }
    }

    // Instead of throwing error, set up a passive listener for later initialization
    logWarn(
      "Parameter system not available after maximum retry attempts - setting up passive initialization"
    );
    this.setupPassiveInitialization();
  }

  /**
   * Set up file state changes → parameter updates synchronization
   */
  setupFileToParameterSync() {
    logDebug("Setting up file-to-parameter synchronization...");

    // Listen for file handler state changes (NOT file-upload-state-changed!)
    const fileStateHandler = (event) => {
      this.handleFileStateMessage(event.detail);
    };

    window.addEventListener("file-handler-state-changed", fileStateHandler);
    this.boundEventHandlers.set("file-handler-state-changed", fileStateHandler);

    // Listen for file removal
    const fileRemovalHandler = () => {
      this.handleFileRemoval();
    };

    window.addEventListener("file-removed", fileRemovalHandler);
    this.boundEventHandlers.set("file-removed", fileRemovalHandler);

    logInfo("File-to-parameter sync listeners established");
  }

  /**
   * Set up parameter changes → file state updates synchronization
   */
  setupParameterToFileSync() {
    logDebug("Setting up parameter-to-file synchronization...");

    // Listen for PDF engine parameter changes
    const engineChangeHandler = (event) => {
      this.handlePDFEngineChange(event.detail);
    };

    document.addEventListener("pdf-engine-changed", engineChangeHandler);
    this.boundEventHandlers.set("pdf-engine-changed", engineChangeHandler);

    // Listen for parameter controller updates (broader parameter changes)
    const parameterUpdateHandler = (event) => {
      this.handleParameterUpdate(event.detail);
    };

    document.addEventListener("parameter-updated", parameterUpdateHandler);
    this.boundEventHandlers.set("parameter-updated", parameterUpdateHandler);

    logInfo("Parameter-to-file sync listeners established");
  }

  /**
   * Set up cost recalculation synchronization handlers
   */
  setupCostSyncHandlers() {
    logDebug("Setting up cost synchronization handlers...");

    // Listen for model changes that affect cost
    const modelChangeHandler = (event) => {
      this.handleModelChange(event.detail);
    };

    document.addEventListener("model-changed", modelChangeHandler);
    this.boundEventHandlers.set("model-changed", modelChangeHandler);

    // Listen for any parameter changes that affect cost
    const costImpactHandler = (event) => {
      this.handleCostImpactingChange(event.detail);
    };

    document.addEventListener(
      "cost-impacting-parameter-changed",
      costImpactHandler
    );
    this.boundEventHandlers.set(
      "cost-impacting-parameter-changed",
      costImpactHandler
    );

    logInfo("Cost synchronization handlers established");
  }

  /**
   * Handle file state change messages from file handler
   * @param {Object} fileState - File state details
   */
  handleFileStateMessage(fileState) {
    if (!this.syncEnabled) return;

    logDebug("Processing file state message:", fileState);

    // Handle both 'file' and 'currentFile' properties (UIController uses 'currentFile')
    const file = fileState.file || fileState.currentFile;
    const { hasFile, fileType, costEstimate, fileAnalysis } = fileState;

    // Update internal state tracking
    this.currentFileState = {
      hasFile,
      fileType,
      engineRecommendation: fileAnalysis?.engineRecommendation || null,
      costEstimate,
    };

    if (hasFile && fileType === "application/pdf") {
      // Show PDF engine parameter and update with file-specific recommendations
      this.syncPDFParameterForFile(file);
      this.syncStats.fileToParameterSyncs++;
    } else {
      // Hide PDF engine parameter for non-PDF files
      this.syncPDFParameterForNonPDF();
    }

    logInfo("File state synchronized to parameters", {
      fileType,
      hasFile,
      parameterVisible: hasFile && fileType === "application/pdf",
    });
  }

  /**
   * Synchronize PDF parameter settings for uploaded PDF file
   * @param {File} file - Uploaded PDF file
   */
  syncPDFParameterForFile(file) {
    // Defensive validation for file object
    if (!file || typeof file !== "object" || !file.type) {
      logWarn("Invalid file object passed to syncPDFParameterForFile:", file);
      return;
    }

    if (!this.pdfEngineParameter) {
      logWarn("PDF engine parameter not available for sync");
      return;
    }

    // Debounce mechanism to prevent duplicate calls
    const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
    if (this._lastSyncedFile === fileKey) {
      logDebug("Skipping duplicate sync for same file");
      return;
    }
    this._lastSyncedFile = fileKey;

    // Clear the debounce after a short delay
    setTimeout(() => {
      this._lastSyncedFile = null;
    }, 100);

    try {
      // Update parameter with file information
      this.pdfEngineParameter.updateForFile(file);

      // Get engine recommendation using CONFIG utilities
      if (CONFIG?.FILE_UPLOAD_UTILS?.getRecommendedPDFEngine) {
        const recommendation =
          CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file);

        // Apply recommendation if parameter is set to auto
        if (this.pdfEngineParameter.getValue() === "auto") {
          this.currentFileState.engineRecommendation = recommendation;

          // Actually apply the recommendation to the parameter
          logInfo(`Applying PDF engine recommendation: ${recommendation}`);
          this.pdfEngineParameter.setValue(recommendation);

          // Notify file handler of engine recommendation
          if (this.fileHandler?.fileStateManager) {
            this.fileHandler.fileStateManager.engineRecommendation =
              recommendation;
          }

          this.syncStats.engineRecommendations++;
        }
      }

      logInfo("PDF parameter synchronized for file", {
        fileName: file.name,
        fileSize: file.size,
        recommendation: this.currentFileState.engineRecommendation,
        appliedValue: this.pdfEngineParameter.getValue(),
      });
    } catch (error) {
      logError("Error synchronizing PDF parameter for file:", error);
      this.syncStats.errors++;
    }
  }

  /**
   * Handle PDF parameter for non-PDF files (hide parameter)
   */
  syncPDFParameterForNonPDF() {
    if (!this.pdfEngineParameter) return;

    try {
      this.pdfEngineParameter.hide();
      this.pdfEngineParameter.setValue(this.pdfEngineParameter.defaultValue);

      logInfo("PDF parameter hidden for non-PDF file");
    } catch (error) {
      logError("Error hiding PDF parameter:", error);
      this.syncStats.errors++;
    }
  }

  /**
   * Handle file removal - reset parameter states
   */
  handleFileRemoval() {
    if (!this.syncEnabled) return;

    logDebug("Processing file removal for parameter sync");

    // Reset current file state
    this.currentFileState = {
      hasFile: false,
      fileType: null,
      engineRecommendation: null,
      costEstimate: null,
    };

    // Reset PDF parameter state
    if (this.pdfEngineParameter) {
      try {
        this.pdfEngineParameter.reset();
        logInfo("PDF parameter reset due to file removal");
      } catch (error) {
        logError("Error resetting PDF parameter:", error);
        this.syncStats.errors++;
      }
    }
  }

  /**
   * Handle PDF engine parameter changes from UI
   * @param {Object} detail - Change event detail
   */
  handlePDFEngineChange(detail) {
    if (!this.syncEnabled) return;

    logDebug("Processing PDF engine change:", detail);

    const { engine, file } = detail;

    // Verify this change is for the current file
    if (file !== this.fileHandler?.currentFile) {
      logWarn("PDF engine change for different file, ignoring");
      return;
    }

    // Update file state with new engine selection
    if (this.fileHandler?.fileStateManager) {
      this.fileHandler.fileStateManager.selectedEngine = engine;
    }

    // Trigger cost recalculation with new engine
    this.triggerCostRecalculation("pdf-engine-change", { engine, file });

    this.syncStats.parameterToFileSyncs++;

    logInfo("PDF engine change synchronized to file state", {
      engine,
      fileName: file?.name,
    });
  }

  /**
   * Handle general parameter updates
   * @param {Object} detail - Parameter update details
   */
  handleParameterUpdate(detail) {
    if (!this.syncEnabled) return;

    logDebug("Processing parameter update:", detail);

    const { parameterId, value, source } = detail;

    // Only process parameters that affect file processing
    if (this.isFileProcessingParameter(parameterId)) {
      this.triggerCostRecalculation("parameter-update", {
        parameterId,
        value,
        source,
      });
      this.syncStats.parameterToFileSyncs++;
    }
  }

  /**
   * Handle model changes that affect file processing
   * @param {Object} detail - Model change details
   */
  handleModelChange(detail) {
    if (!this.syncEnabled) return;

    logDebug("Processing model change:", detail);

    // Recalculate costs if file is present
    if (this.currentFileState.hasFile) {
      this.triggerCostRecalculation("model-change", detail);
      this.syncStats.costRecalculations++;
    }
  }

  /**
   * Handle cost-impacting parameter changes
   * @param {Object} detail - Cost impact details
   */
  handleCostImpactingChange(detail) {
    if (!this.syncEnabled) return;

    logDebug("Processing cost-impacting change:", detail);

    this.triggerCostRecalculation("cost-impact", detail);
    this.syncStats.costRecalculations++;
  }

  /**
   * Trigger cost recalculation in file handler
   * @param {string} reason - Reason for recalculation
   * @param {Object} context - Context information
   */
  triggerCostRecalculation(reason, context = {}) {
    if (!this.fileHandler?.currentFile) {
      logDebug("No current file for cost recalculation");
      return;
    }

    try {
      logInfo("Triggering cost recalculation", { reason, context });

      // Call file handler's cost estimation method
      this.fileHandler.estimateAndDisplayCost(this.fileHandler.currentFile);

      // Update sync statistics
      this.syncStats.costRecalculations++;
    } catch (error) {
      logError("Error triggering cost recalculation:", error);
      this.syncStats.errors++;
    }
  }

  /**
   * Check if parameter affects file processing
   * @param {string} parameterId - Parameter identifier
   * @returns {boolean} True if parameter affects file processing
   */
  isFileProcessingParameter(parameterId) {
    const fileProcessingParameters = [
      "pdf-engine",
      "model",
      "max-tokens",
      "temperature", // Can affect processing approach
    ];

    return fileProcessingParameters.includes(parameterId);
  }

  /**
   * Synchronize current state (called during initialisation)
   */
  syncCurrentState() {
    logDebug("Synchronizing current state...");

    // Check if file handler has current file
    if (this.fileHandler?.hasValidFile && this.fileHandler?.currentFile) {
      const currentFile = this.fileHandler.currentFile;
      const fileState = {
        hasFile: true,
        file: currentFile,
        fileType: currentFile.type,
        costEstimate: this.fileHandler.costEstimate,
        fileAnalysis: this.fileHandler.fileAnalysis,
      };

      // Trigger sync as if file was just uploaded
      this.handleFileStateMessage(fileState);

      logInfo("Current state synchronized", {
        fileName: currentFile.name,
        fileType: currentFile.type,
      });
    }
  }

  /**
   * Handle initialisation failure
   * @param {Error} error - Initialisation error
   */
  handleInitialisationFailure(error) {
    logError("Parameter sync initialisation failed:", error);

    // Disable sync to prevent further errors
    this.syncEnabled = false;

    // Set fallback state
    this.isInitialised = false;

    // Notify file handler of sync unavailability
    if (this.fileHandler) {
      this.fileHandler.parameterSyncAvailable = false;
    }
  }

  /**
   * Enable/disable synchronization
   * @param {boolean} enabled - Sync enabled state
   */
  setSyncEnabled(enabled) {
    this.syncEnabled = enabled;
    logInfo(`Parameter synchronization ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get synchronization status and statistics
   * @returns {Object} Sync status and stats
   */
  getSyncStatus() {
    return {
      initialised: this.isInitialised,
      enabled: this.syncEnabled,
      hasParameterReferences: !!(
        this.parameterController && this.pdfEngineParameter
      ),
      currentFileState: { ...this.currentFileState },
      statistics: { ...this.syncStats },
    };
  }

  /**
   * Clean up event listeners and reset state
   */
  cleanup() {
    logInfo("Cleaning up parameter synchronization system...");

    // Remove all event listeners
    this.boundEventHandlers.forEach((handler, eventType) => {
      if (
        eventType === "pdf-engine-changed" ||
        eventType === "parameter-updated" ||
        eventType === "model-changed" ||
        eventType === "cost-impacting-parameter-changed"
      ) {
        document.removeEventListener(eventType, handler);
      } else {
        window.removeEventListener(eventType, handler);
      }
    });

    this.boundEventHandlers.clear();

    // Reset state
    this.isInitialised = false;
    this.syncEnabled = false;
    this.currentFileState = {
      hasFile: false,
      fileType: null,
      engineRecommendation: null,
      costEstimate: null,
    };

    logInfo("Parameter synchronization cleanup complete");
  }

  /**
   * Set up passive initialization for when parameter system becomes available later
   */
  setupPassiveInitialization() {
    logInfo("Setting up passive parameter sync initialization...");

    // Listen for parameter system ready event
    const parameterReadyHandler = () => {
      logInfo(
        "Parameter system ready event detected, attempting initialization..."
      );

      this.parameterController = window.parameterController;
      this.parameterRegistry = window.parameterRegistry;

      if (this.parameterController && this.parameterRegistry) {
        this.pdfEngineParameter =
          this.parameterRegistry.getParameter("pdf-engine");

        if (this.pdfEngineParameter) {
          logInfo("Passive parameter sync initialization successful");

          // Complete the setup
          this.setupFileToParameterSync();
          this.setupParameterToFileSync();
          this.setupCostSyncHandlers();
          this.syncCurrentState();

          this.isInitialised = true;

          // Remove the listener as we're done
          window.removeEventListener(
            "parameter-sync-ready",
            parameterReadyHandler
          );

          // Create test interface
          this.createTestInterface();
        }
      }
    };

    window.addEventListener("parameter-sync-ready", parameterReadyHandler);

    // Also set up a periodic check as backup
    const periodicCheck = setInterval(() => {
      if (window.parameterController && window.parameterRegistry) {
        clearInterval(periodicCheck);
        parameterReadyHandler();
      }
    }, 1000);

    // Clear periodic check after reasonable time
    setTimeout(() => {
      clearInterval(periodicCheck);
    }, 30000);
  }

  /**
   * Advanced testing interface (Phase 4.3+ debugging)
   */
  createTestInterface() {
    window.testParameterSync = () => {
      console.log(
        "🔬 Testing Parameter Synchronization System (Phase 4.3.1)..."
      );

      const status = this.getSyncStatus();

      const tests = {
        // Core functionality
        initialised: this.isInitialised,
        syncEnabled: this.syncEnabled,

        // References
        parameterReferences: {
          parameterController: !!this.parameterController,
          parameterRegistry: !!this.parameterRegistry,
          pdfEngineParameter: !!this.pdfEngineParameter,
        },

        // Event system
        eventListeners: {
          handlerCount: this.boundEventHandlers.size,
          registeredEvents: Array.from(this.boundEventHandlers.keys()),
        },

        // State management
        currentState: status.currentFileState,
        statistics: status.statistics,

        // Integration status
        fileHandlerIntegration: {
          hasFileHandler: !!this.fileHandler,
          fileHandlerInitialised: !!this.fileHandler?.isInitialised,
        },
      };

      // Calculate success rate
      const totalOps = Object.values(status.statistics).reduce(
        (sum, val) => sum + val,
        0
      );
      const errorRate =
        totalOps > 0
          ? ((status.statistics.errors / totalOps) * 100).toFixed(1)
          : "0.0";

      console.log("📊 Test Results:", tests);
      console.log("📈 Sync Statistics:", status.statistics);
      console.log(`🎯 Error Rate: ${errorRate}%`);

      const success =
        tests.initialised &&
        tests.syncEnabled &&
        tests.parameterReferences.pdfEngineParameter &&
        tests.eventListeners.handlerCount > 0;

      console.log(
        success
          ? "✅ Parameter Sync System Operational"
          : "❌ Parameter Sync Issues Detected"
      );

      return { success, tests, status };
    };

    // Quick status check
    window.checkParameterSyncStatus = () => {
      const status = this.getSyncStatus();
      console.log("📋 Parameter Sync Status:", status);
      return status;
    };

    // Manual sync trigger for testing
    window.triggerManualSync = () => {
      console.log("🔄 Triggering manual synchronization...");
      this.syncCurrentState();
      return this.getSyncStatus();
    };

    logInfo("Parameter sync test interface created");
  }
}
