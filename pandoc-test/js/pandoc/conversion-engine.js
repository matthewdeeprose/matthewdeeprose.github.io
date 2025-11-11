// conversion-engine.js
// LaTeX to HTML Conversion Engine Module
// Handles Pandoc conversion and MathJax rendering integration
// ENHANCED: Now includes robust error handling for complex mathematical documents

const ConversionEngine = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  // Create logger instance for conversion module
  const logger = window.LoggingSystem?.createModuleLogger("CONVERSION") || {
    logError: console.error.bind(console, "[CONVERSION]"),
    logWarn: console.warn.bind(console, "[CONVERSION]"),
    logInfo: console.log.bind(console, "[CONVERSION]"),
    logDebug: console.log.bind(console, "[CONVERSION]"),
  };

  // Extract individual logging functions for backwards compatibility
  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // ENHANCED CONVERSION ENGINE IMPLEMENTATION
  // ===========================================================================================

  /**
   * Enhanced Conversion Engine Manager Class
   * Now includes robust error handling, complexity assessment, and chunked processing
   */
  class ConversionEngineManager {
    constructor() {
      // Initialize StateManager delegation
      if (!window.StateManager) {
        logError(
          "StateManager module not available - using fallback state management"
        );
        this.useStateManagerFallback = true;
        this.initializeFallbackState();
      } else {
        this.useStateManagerFallback = false;
        this.stateManager = window.StateManager.instance;
        logInfo("StateManager module integrated successfully");
      }

      // Non-state properties (kept in conversion engine)
      this.pandocFunction = null;
      this.inputTextarea = null;
      this.outputDiv = null;
      this.argumentsInput = null;
      this.conversionTimeout = null;
    }

    // ===========================================================================================
    // OPTIMIZED STATE PROPERTY GETTERS (DELEGATES TO STATEMANAGER)
    // ===========================================================================================

    /**
     * OPTIMIZATION: Get cached status object to reduce repeated getEngineStatus() calls
     * Cache is valid for 50ms to balance performance with state accuracy
     */
    _getCachedStatus() {
      const now = Date.now();
      if (!this._statusCache || now - this._statusCacheTime > 50) {
        if (!this.useStateManagerFallback && window.StateManager) {
          this._statusCache = window.StateManager.getEngineStatus();
          this._statusCacheTime = now;
        } else {
          this._statusCache = null;
        }
      }
      return this._statusCache;
    }

    /**
     * OPTIMIZATION: Invalidate status cache when state changes
     */
    _invalidateStatusCache() {
      this._statusCache = null;
      this._statusCacheTime = 0;
    }

    /**
     * Get conversionInProgress state (optimized StateManager delegation)
     */
    get conversionInProgress() {
      if (!this.useStateManagerFallback && window.StateManager) {
        const status = this._getCachedStatus();
        return status ? status.conversionInProgress : false;
      }
      return this._conversionInProgress || false;
    }

    /**
     * Set conversionInProgress state (optimized with cache invalidation)
     */
    set conversionInProgress(value) {
      if (!this.useStateManagerFallback && window.StateManager) {
        this._invalidateStatusCache(); // Clear cache before state change
        if (value) {
          window.StateManager.startConversion();
        } else {
          window.StateManager.completeConversion(true);
        }
      } else {
        this._conversionInProgress = value;
      }
    }

    /**
     * Get isConversionQueued state (optimized StateManager delegation)
     */
    get isConversionQueued() {
      if (!this.useStateManagerFallback && window.StateManager) {
        const status = this._getCachedStatus();
        return status ? status.conversionQueued : false;
      }
      return this._isConversionQueued || false;
    }

    /**
     * Set isConversionQueued state (optimized with cache invalidation)
     */
    set isConversionQueued(value) {
      if (!this.useStateManagerFallback && window.StateManager) {
        this._invalidateStatusCache(); // Clear cache before state change
        if (value) {
          window.StateManager.queueConversion();
        }
      } else {
        this._isConversionQueued = value;
      }
    }

    /**
     * Get activeTimeouts (optimized StateManager delegation with cached Set-like object)
     */
    get activeTimeouts() {
      if (!this.useStateManagerFallback && window.StateManager) {
        // Cache the Set-like object for better performance
        if (!this._cachedTimeoutsObject || this._statusCache === null) {
          const status = this._getCachedStatus();
          this._cachedTimeoutsObject = {
            get size() {
              const currentStatus = window.StateManager.getEngineStatus();
              return currentStatus.activeTimeouts;
            },
            add: (timeoutId) => {
              this._invalidateStatusCache(); // Clear cache when timeouts change
              return window.StateManager.addTimeout(timeoutId, "active");
            },
            delete: (timeoutId) => {
              this._invalidateStatusCache(); // Clear cache when timeouts change
              return window.StateManager.removeTimeout(timeoutId, "active");
            },
            clear: () => {
              this._invalidateStatusCache(); // Clear cache when timeouts change
              return window.StateManager.clearAllTimeouts(false);
            },
            forEach: () => {}, // Stub for compatibility
          };
        }
        return this._cachedTimeoutsObject;
      }
      return this._activeTimeouts || new Set();
    }

    /**
     * Get isInitialised state (optimized StateManager delegation)
     */
    get isInitialised() {
      if (!this.useStateManagerFallback && window.StateManager) {
        const status = this._getCachedStatus();
        return status ? status.initialised : false;
      }
      return this._isInitialised || false;
    }

    /**
     * Get isReady state (optimized StateManager delegation)
     */
    get isReady() {
      if (!this.useStateManagerFallback && window.StateManager) {
        const status = this._getCachedStatus();
        return status ? status.ready : false;
      }
      return this._isReady || false;
    }

    /**
     * Get automaticConversionsDisabled state (optimized StateManager delegation)
     */
    get automaticConversionsDisabled() {
      if (!this.useStateManagerFallback && window.StateManager) {
        const status = this._getCachedStatus();
        return status ? status.automaticConversionsDisabled : false;
      }
      return this._automaticConversionsDisabled || false;
    }

    /**
     * Set automaticConversionsDisabled state (optimized with cache invalidation)
     */
    set automaticConversionsDisabled(value) {
      if (!this.useStateManagerFallback && window.StateManager) {
        this._invalidateStatusCache(); // Clear cache before state change
        window.StateManager.updateConfiguration({
          automaticConversionsDisabled: value,
        });
      } else {
        this._automaticConversionsDisabled = value;
      }
    }

    /**
     * Initialize fallback state management when StateManager module not available
     * ENHANCED: Now delegates to FinalCoordinationManager for modular fallback state management
     */
    initializeFallbackState() {
      return (
        window.FinalCoordinationManager?.initializeFallbackState(this) || false
      );
    }

    /**
     * Initialise the conversion engine
     * ENHANCED: Now uses StateManager for state tracking
     */
    initialise() {
      logInfo("Initialising Enhanced Conversion Engine Manager...");

      try {
        // Get DOM elements
        this.inputTextarea =
          window.appElements?.inputTextarea || document.getElementById("input");
        this.outputDiv =
          window.appElements?.outputDiv || document.getElementById("output");
        this.argumentsInput =
          window.appElements?.argumentsInput ||
          document.getElementById("arguments");

        if (!this.inputTextarea || !this.outputDiv || !this.argumentsInput) {
          throw new Error("Required conversion engine DOM elements not found");
        }

        // Setup event listeners
        this.setupEventListeners();

        // Update state using StateManager or fallback
        const domElements = {
          inputTextarea: this.inputTextarea,
          outputDiv: this.outputDiv,
          argumentsInput: this.argumentsInput,
        };

        if (!this.useStateManagerFallback && window.StateManager) {
          window.StateManager.setInitialisationState(true, domElements);
          logInfo("✅ StateManager: Initialisation state updated");
        } else {
          this.isInitialised = true;
          logInfo("✅ Fallback: Initialisation state updated");
        }

        logInfo("✅ Enhanced Conversion Engine initialised successfully");
        return true;
      } catch (error) {
        logError("Failed to initialise Enhanced Conversion Engine:", error);

        // Update state using StateManager or fallback
        if (!this.useStateManagerFallback && window.StateManager) {
          window.StateManager.setInitialisationState(false);
        } else {
          this.isInitialised = false;
        }

        return false;
      }
    }

    /**
     * Setup event listeners for conversion triggers
     * ENHANCED: Now delegates to FinalCoordinationManager for modular event management
     */
    setupEventListeners() {
      return (
        window.FinalCoordinationManager?.setupEventListeners(this) || false
      );
    }

    /**
     * Set the Pandoc function (called after Pandoc initialisation)
     * ENHANCED: Now syncs with StateManager for centralized state tracking
     */
    setPandocFunction(pandocFn) {
      logInfo("Setting Pandoc function...");
      this.pandocFunction = pandocFn;

      // Update state using StateManager or fallback
      if (!this.useStateManagerFallback && window.StateManager) {
        window.StateManager.setReadyState(true, pandocFn);
        logInfo("✅ StateManager: Engine readiness updated");
      } else {
        this.isReady = true;
        logInfo("✅ Fallback: Engine readiness updated");
      }

      // Enable interface
      if (this.inputTextarea) {
        this.inputTextarea.readOnly = false;
        this.inputTextarea.placeholder =
          "Enter your LaTeX mathematical expressions here...";
      }

      logInfo("✅ Pandoc function set, enhanced conversion engine ready");
    }

    // ===========================================================================================
    // LATEX PRESERVATION SYSTEM - BREAKTHROUGH TECHNOLOGY
    // ===========================================================================================

    /**
     * Extract and map LaTeX expressions (delegates to LatexPreservationEngine)
     */
    extractAndMapLatexExpressions(content) {
      return window.LatexPreservationEngine.extractAndMapLatexExpressions(
        content
      );
    }

    // NOTE: Fallback LaTeX extraction removed - LatexPreservationEngine module required
    // ===========================================================================================
    // ENHANCED ERROR HANDLING AND COMPLEXITY ASSESSMENT METHODS
    // ===========================================================================================

    /**
     * Assess document complexity to determine processing strategy
     * Delegates to ProcessingStrategyManager for complexity assessment
     * @param {string} content - LaTeX content to assess
     * @returns {Object} - Complexity analysis with level, score, and recommendations
     */
    assessDocumentComplexity(content) {
      if (!window.ProcessingStrategyManager) {
        logError(
          "ProcessingStrategyManager not available - falling back to minimal assessment"
        );
        return this.fallbackComplexityAssessment(content);
      }

      try {
        const complexityResult =
          window.ProcessingStrategyManager.assessDocumentComplexity(content);
        logInfo(
          `Document complexity assessment: ${
            complexityResult.level
          } (score: ${complexityResult.score.toFixed(1)})`
        );
        logDebug("Complexity indicators:", complexityResult.indicators);
        return complexityResult;
      } catch (error) {
        logError("ProcessingStrategyManager failed - using fallback:", error);
        return this.fallbackComplexityAssessment(content);
      }
    }

    // NOTE: Fallback complexity assessment removed - ProcessingStrategyManager module required

    /**
     * Handle conversion errors with graceful fallback
     * @param {Error} error - The error that occurred
     * @param {string} inputText - LaTeX input text
     * @param {string} argumentsText - Pandoc arguments
     * @param {number} attempt - Current attempt number
     * @returns {Promise<boolean>} - Success/failure of error handling
     */
    async handleConversionError(error, inputText, argumentsText, attempt = 1) {
      if (!window.ErrorHandler) {
        logError(
          "ErrorHandler module not available - using fallback error handling"
        );
        return this.fallbackErrorHandling(
          error,
          inputText,
          argumentsText,
          attempt
        );
      }

      try {
        const dependencies = window.ErrorHandler.createErrorContext(this);
        return await window.ErrorHandler.handleConversionError(
          error,
          inputText,
          argumentsText,
          attempt,
          dependencies
        );
      } catch (handlerError) {
        logError("ErrorHandler module failed - using fallback:", handlerError);
        return this.fallbackErrorHandling(
          error,
          inputText,
          argumentsText,
          attempt
        );
      }
    }

    // NOTE: fallbackErrorHandling removed - ErrorHandler module now required

    /**
     * Generate user-friendly error messages (delegates to ErrorMessageGenerator)
     * @param {Error} originalError - The original error object
     * @param {string} errorMessage - Raw error message
     * @returns {string} - User-friendly error message
     */
    generateUserFriendlyErrorMessage(originalError, errorMessage) {
      if (!window.ErrorMessageGenerator) {
        logError("ErrorMessageGenerator module not available - using fallback");
        return this.fallbackErrorMessageGeneration(originalError, errorMessage);
      }

      try {
        return window.ErrorMessageGenerator.generateUserFriendlyErrorMessage(
          originalError,
          errorMessage
        );
      } catch (generatorError) {
        logError(
          "ErrorMessageGenerator failed - using fallback:",
          generatorError
        );
        return this.fallbackErrorMessageGeneration(originalError, errorMessage);
      }
    }

    // NOTE: fallbackErrorMessageGeneration removed - ErrorMessageGenerator module now required

    /**
     * Process large documents in chunks (delegates to ChunkedProcessingEngine)
     * @param {string} inputText - LaTeX document to process
     * @param {string} argumentsText - Pandoc arguments
     * @returns {Promise<boolean>} - Success/failure of chunked processing
     */
    async processInChunks(inputText, argumentsText) {
      if (!window.ChunkedProcessingEngine) {
        logError(
          "ChunkedProcessingEngine not available - falling back to error handling"
        );
        return await this.handleConversionError(
          new Error("Chunked processing not available"),
          inputText,
          argumentsText,
          2
        );
      }

      try {
        logInfo(
          "Delegating to ChunkedProcessingEngine for complex document processing..."
        );

        const chunkingResult =
          await window.ChunkedProcessingEngine.processInChunks(
            inputText,
            argumentsText,
            this.pandocFunction,
            {
              outputDiv: this.outputDiv,
              statusManager: window.StatusManager,
              renderMathJax: this.renderMathJax.bind(this),
            }
          );

        if (chunkingResult.success) {
          if (this.outputDiv && chunkingResult.output) {
            this.outputDiv.innerHTML = chunkingResult.output;
          }

          if (window.StatusManager) {
            window.StatusManager.setLoading(
              "Rendering mathematical expressions...",
              90
            );
          }

          await this.renderMathJax();

          if (window.StatusManager) {
            const successMessage = `Complex document processed successfully! (${chunkingResult.chunksProcessed} sections processed, ${chunkingResult.chunksSucceeded} succeeded)`;
            window.StatusManager.setReady(successMessage);
          }

          logInfo("ChunkedProcessingEngine completed successfully");
          return true;
        } else {
          logError("ChunkedProcessingEngine failed:", chunkingResult.error);
          return await this.handleConversionError(
            new Error(chunkingResult.error || "Chunked processing failed"),
            inputText,
            argumentsText,
            2
          );
        }
      } catch (error) {
        logError("Error delegating to ChunkedProcessingEngine:", error);
        return await this.handleConversionError(
          error,
          inputText,
          argumentsText,
          2
        );
      }
    }

    // NOTE: Chunked processing methods moved to ChunkedProcessingEngine module
    // These methods are now handled by window.ChunkedProcessingEngine:
    // - splitDocumentIntoChunks() → ChunkedProcessingEngine.splitDocumentIntoChunks()
    // - addSequentialSectionNumbering() → ChunkedProcessingEngine.addSequentialSectionNumbering()
    // - wrapContentInDocument() → ChunkedProcessingEngine.wrapContentInDocument()

    /**
     * Attempt simplified conversion with reduced arguments
     */
    async attemptSimplifiedConversion(inputText, simplifiedArgs) {
      if (!window.FallbackCoordinator) {
        logError("FallbackCoordinator module not available - using fallback");
        return this.fallbackSimplifiedConversion(inputText, simplifiedArgs);
      }

      try {
        const dependencies =
          window.FallbackCoordinator.createFallbackContext(this);
        return await window.FallbackCoordinator.attemptSimplifiedConversion(
          inputText,
          simplifiedArgs,
          this.pandocFunction,
          dependencies
        );
      } catch (coordinatorError) {
        logError(
          "FallbackCoordinator module failed - using fallback:",
          coordinatorError
        );
        return this.fallbackSimplifiedConversion(inputText, simplifiedArgs);
      }
    }

    // NOTE: fallbackSimplifiedConversion removed - FallbackCoordinator module now required

    /**
     * Announce error to screen readers (delegates to AccessibilityAnnouncer)
     */
    announceErrorToScreenReader(message) {
      return (
        window.AccessibilityAnnouncer?.announceErrorToScreenReader(message) ||
        this.fallbackScreenReaderAnnouncement?.(message) ||
        false
      );
    }

    // NOTE: fallbackScreenReaderAnnouncement removed - AccessibilityAnnouncer module now required

    // ===========================================================================================
    // MAIN CONVERSION METHODS (ENHANCED)
    // ===========================================================================================

    // ===========================================================================================
    // PANDOC INVESTIGATION METHODS - NOW DELEGATED TO PANDOC ARGUMENT ENHANCER
    // ===========================================================================================

    /**
     * INVESTIGATION: Enhanced Pandoc argument generation
     * ENHANCED: Now delegates to PandocArgumentEnhancer for modular argument enhancement
     */
    generateEnhancedPandocArgs(baseArgs) {
      return (
        window.PandocArgumentEnhancer?.generateEnhancedPandocArgs(baseArgs) ||
        baseArgs
      );
    }

    /**
     * INVESTIGATION: Get enhancement arguments by preset
     * ENHANCED: Now delegates to PandocArgumentEnhancer
     */
    getEnhancementsByPreset(preset) {
      return (
        window.PandocArgumentEnhancer?.getEnhancementsByPreset(preset) || [
          "--section-divs",
        ]
      );
    }

    /**
     * INVESTIGATION: Get custom arguments from textarea
     * ENHANCED: Now delegates to PandocArgumentEnhancer
     */
    getCustomArguments() {
      return (
        window.PandocArgumentEnhancer?.getCustomArguments() || [
          "--section-divs",
        ]
      );
    }

    /**
     * INVESTIGATION: Handle comparison mode for side-by-side analysis
     * ENHANCED: Now delegates to PandocArgumentEnhancer with pandoc function access
     */
    async handleComparisonMode(inputText, baseArgumentsText) {
      try {
        return (
          (await window.PandocArgumentEnhancer?.handleComparisonMode(
            inputText,
            baseArgumentsText,
            this.pandocFunction
          )) || null
        );
      } catch (error) {
        logError("Comparison mode failed:", error);
        window.StatusManager?.setError("Comparison analysis failed");
        return false;
      }
    }

    // NOTE: The following methods are now handled by PandocArgumentEnhancer module:
    // - displayComparisonResults() → PandocArgumentEnhancer.displayComparisonResults()
    // - generateComparisonAnalysis() → PandocArgumentEnhancer.generateComparisonAnalysis()
    // - escapeHtml() → PandocArgumentEnhancer.escapeHtml()

    /**
     * Memory management: Comprehensive cleanup system using modular system
     */
    cleanup() {
      logInfo("Performing comprehensive memory cleanup...");

      // Use the new CleanupCoordinator for comprehensive cleanup
      if (window.CleanupCoordinator) {
        window.CleanupCoordinator.cleanup(
          this.activeTimeouts,
          this.pollingTimeouts
        );
      } else {
        // Fallback cleanup if CleanupCoordinator not available
        logWarn("CleanupCoordinator not available - using fallback cleanup");

        // Clear ALL tracked timeouts
        this.activeTimeouts.forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.activeTimeouts.clear();

        // Clear polling timeouts
        this.pollingTimeouts.forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.pollingTimeouts.clear();
      }

      // Reset conversion state
      this.conversionInProgress = false;
      this.isConversionQueued = false;
      this.conversionTimeout = null;

      logInfo("Memory cleanup completed (LaTeX registries preserved)");
    }

    /**
     * Emergency: Full shutdown cleanup - clears everything including LaTeX registries
     */
    emergencyCleanup() {
      logWarn(
        "Emergency cleanup - clearing all memory including LaTeX registries"
      );

      // Use the new CleanupCoordinator for emergency cleanup
      if (window.CleanupCoordinator) {
        window.CleanupCoordinator.emergencyCleanup(
          this.activeTimeouts,
          this.pollingTimeouts
        );
      } else {
        // Fallback emergency cleanup
        logWarn(
          "CleanupCoordinator not available - using fallback emergency cleanup"
        );
        this.cleanup();
        this.performFullCleanup();
      }

      logWarn("Emergency cleanup completed");
    }

    /**
     * Performance: Enhanced DOM cleanup for empty content and large deletions
     * ENHANCED: Now delegates to FinalCoordinationManager for modular DOM cleanup
     */
    performDOMCleanup() {
      return window.FinalCoordinationManager?.performDOMCleanup() || false;
    }

    /**
     * Annotation-safe: Cleanup that preserves annotation elements
     * ENHANCED: Now delegates to FinalCoordinationManager for modular safe cleanup
     */
    performSafeCleanup() {
      return window.FinalCoordinationManager?.performSafeCleanup() || false;
    }

    // NOTE: Fallback DOM cleanup methods removed - CleanupCoordinator + FinalCoordinationManager now required
    // - performFallbackDOMCleanup() -> FinalCoordinationManager.performDOMCleanup()
    // - performFallbackSafeCleanup() -> FinalCoordinationManager.performSafeCleanup()
    // - performFullCleanup() -> CleanupCoordinator.performFullCleanup()

    /**
     * Convert input using Pandoc with robust error handling and complexity assessment
     */
    async convertInput() {
      const engineStatus = this._getCachedStatus();
      const isCurrentlyReady = engineStatus ? engineStatus.ready : this.isReady;
      const isCurrentlyInProgress = engineStatus
        ? engineStatus.conversionInProgress
        : this.conversionInProgress;

      if (!isCurrentlyReady || !this.pandocFunction || isCurrentlyInProgress) {
        logDebug(
          "Conversion skipped - engine not ready or conversion in progress"
        );
        return;
      }

      const rawInputText = this.inputTextarea?.value?.trim() || "";
      const argumentsText = this.argumentsInput?.value?.trim() || "";

      // Sanitise input using ValidationUtilities
      let inputText = rawInputText;
      if (window.ValidationUtilities) {
        const sanitisationResult =
          window.ValidationUtilities.sanitizeInput(rawInputText);
        inputText = sanitisationResult.sanitised;
        if (sanitisationResult.removed.length > 0) {
          const totalRemoved = sanitisationResult.removed.reduce(
            (sum, item) => sum + item.count,
            0
          );
          logInfo(
            `Preprocessing: ValidationUtilities removed ${totalRemoved} problematic elements`
          );
          sanitisationResult.removed.forEach((removal) => {
            logDebug(`   - ${removal.count} ${removal.description}`);
          });
        }
      } else {
        logWarn(
          "ValidationUtilities not available - using fallback sanitisation"
        );
        inputText = rawInputText
          .replace(/\\index\{[^}]*\}/g, "")
          .replace(/\\qedhere\b/g, "");
      }

      logInfo("=== ENHANCED CONVERSION START ===");

      // Handle empty content with cleanup
      if (!inputText) {
        logInfo(
          "Empty content detected - performing cleanup and completing conversion"
        );
        this.performDOMCleanup();
        this.setEmptyOutput();

        try {
          this.conversionInProgress = false;
          if (window.StatusManager) {
            window.StatusManager.setReady("Ready! Export buttons enabled.");
          }
          if (window.AppStateManager?.enableExportButtons) {
            window.AppStateManager.enableExportButtons(
              "Empty document ready for export"
            );
          }
          logInfo("Empty content conversion completed successfully");
        } catch (emptyContentError) {
          logError(
            "Error completing empty content conversion:",
            emptyContentError
          );
        }
        return;
      }

      try {
        this.conversionInProgress = true;

        if (!window.ConversionOrchestrator) {
          logError(
            "ConversionOrchestrator not available - falling back to direct processing"
          );
          return this.fallbackConversionWorkflow(inputText, argumentsText);
        }

        try {
          const orchestrationContext =
            window.ConversionOrchestrator.createOrchestrationContext(this);
          const conversionResult =
            await window.ConversionOrchestrator.orchestrateConversion(
              inputText,
              argumentsText,
              orchestrationContext
            );

          if (conversionResult) {
            logInfo("ConversionOrchestrator completed successfully");

            // ✅ CRITICAL FIX: Store LaTeX for enhanced export processor
            if (window.LaTeXProcessorEnhanced && rawInputText) {
              try {
                window.LaTeXProcessorEnhanced.storeOriginalLatex(rawInputText);
                logDebug("✅ Stored LaTeX for enhanced export (auto-capture)");
              } catch (storageError) {
                logWarn(
                  "Failed to store LaTeX for enhanced export:",
                  storageError
                );
                // Non-critical - conversion succeeded, just log warning
              }
            }

            // PHASE 1F PART B: Register LaTeX environments for export reconstruction
            if (window.MathJaxManagerInstance && rawInputText) {
              try {
                const envCount =
                  window.MathJaxManagerInstance.registerSourceEnvironments(
                    rawInputText
                  );
                if (envCount > 0) {
                  logInfo(
                    `✅ Registered ${envCount} LaTeX environment(s) for export`
                  );
                } else {
                  logDebug(
                    "No numbered environments found (align, gather, etc.)"
                  );
                }
              } catch (registrationError) {
                logWarn("Failed to register environments:", registrationError);
                // Non-critical - conversion succeeded, environment detection is optional
              }
            }
          }
          return conversionResult;
        } catch (orchestrationError) {
          logError(
            "ConversionOrchestrator failed - using fallback workflow:",
            orchestrationError
          );
          return this.fallbackConversionWorkflow(inputText, argumentsText);
        }
      } catch (error) {
        logError("Enhanced conversion error:", error);
        await this.handleConversionError(error, inputText, argumentsText);
      } finally {
        this.conversionInProgress = false;
      }
    }

    /**
     * Fallback conversion workflow when ConversionOrchestrator not available
     * ENHANCED: Now delegates to FinalCoordinationManager for modular fallback workflow
     */
    async fallbackConversionWorkflow(inputText, argumentsText) {
      if (!window.FinalCoordinationManager) {
        throw new Error(
          "FinalCoordinationManager module required for fallback workflow"
        );
      }
      return await window.FinalCoordinationManager.fallbackConversionWorkflow(
        this,
        inputText,
        argumentsText
      );
    }
    /**
     * Perform standard conversion with enhanced monitoring and error detection
     * ENHANCED: Now delegates to FinalCoordinationManager for modular standard conversion
     */
    async performStandardConversion(inputText, userArgumentsText, complexity) {
      if (!window.FinalCoordinationManager) {
        throw new Error(
          "FinalCoordinationManager module required for standard conversion"
        );
      }
      return await window.FinalCoordinationManager.performStandardConversion(
        this,
        inputText,
        userArgumentsText,
        complexity
      );
    }

    // ===========================================================================================
    // EXISTING UTILITY METHODS (PRESERVED)
    // ===========================================================================================

    /**
     * Clean Pandoc output for display - now uses utility module with cross-reference fixing
     * ENHANCED: Delegates to OutputCleaner utility with original LaTeX input for enhanced processing
     */
    cleanPandocOutput(output, originalLatexInput = null) {
      if (!window.OutputCleaner) {
        logError(
          "OutputCleaner utility not available - falling back to minimal cleaning"
        );
        return output ? output.trim() : "";
      }

      return window.OutputCleaner.cleanPandocOutput(output, originalLatexInput);
    }
    /**
     * Render MathJax on the output
     */
    async renderMathJax() {
      if (
        !window.MathJax ||
        !window.MathJax.typesetPromise ||
        !this.outputDiv
      ) {
        logWarn("MathJax not available for rendering");
        return;
      }

      try {
        logInfo("Starting MathJax typeset...");

        if (window.StatusManager) {
          window.StatusManager.updateConversionStatus("CONVERT_MATHJAX", 90);
        }

        // PHASE 1F PART B FIX: Clear MathJax processing state before rendering
        // This ensures MathJax treats content as new and applies correct equation numbering
        if (window.MathJax?.typesetClear) {
          logInfo(
            "🧹 Clearing MathJax processing state for output container..."
          );
          window.MathJax.typesetClear([this.outputDiv]);
          logInfo("✅ MathJax state cleared - ready for fresh processing");
        } else {
          logDebug(
            "MathJax.typesetClear not available - using standard render"
          );
        }

        await window.MathJax.typesetPromise([this.outputDiv]);
        logInfo("✅ MathJax typeset complete");

        // Verify equation numbers were created (for numbered environments)
        const equationTags = this.outputDiv.querySelectorAll(
          ".mjx-tag, .mjx-label"
        );
        if (equationTags.length > 0) {
          logInfo(
            `✅ Equation numbering successful: ${equationTags.length} number tags created`
          );
        } else {
          logDebug(
            "No equation number tags found (document may not contain numbered environments)"
          );
        }

        // PHASE 1F PART B: Auto-tag rendered containers with environment data
        if (window.tagMathEnvironments) {
          // Small delay to ensure MathJax DOM is fully settled
          setTimeout(() => {
            try {
              const taggedCount = window.tagMathEnvironments();
              if (taggedCount > 0) {
                logInfo(
                  `✅ Auto-tagged ${taggedCount} container(s) with environment data`
                );
              } else {
                logDebug(
                  "No containers needed tagging (already tagged or no environments found)"
                );
              }
            } catch (taggingError) {
              logWarn("Auto-tagging failed:", taggingError);
              // Non-critical - rendering succeeded, tagging is optional enhancement
            }
          }, 150); // Increased from 100ms to 150ms for better reliability
        } else {
          logDebug("tagMathEnvironments not available - skipping auto-tagging");
        }
      } catch (error) {
        logError("MathJax rendering error:", error);
        // Don't throw - conversion can continue without MathJax
      }
    }

    /**
     * Set empty output message
     */
    setEmptyOutput() {
      if (this.outputDiv) {
        this.outputDiv.innerHTML =
          "<p><em>Enter some LaTeX content to see the conversion...</em></p>";
      }
    }

    /**
     * Set error output
     */
    setErrorOutput(error) {
      if (this.outputDiv) {
        this.outputDiv.innerHTML = `
          <div class="error-message">
            <strong>Conversion Error:</strong> ${error.message || error}
          </div>`;
      }
    }

    // ===========================================================================================
    // PUBLIC API METHODS (PRESERVED)
    // ===========================================================================================

    /**
     * Get current output content
     */
    getCurrentOutput() {
      return this.outputDiv?.innerHTML || "";
    }

    /**
     * Get current input content
     */
    getCurrentInput() {
      return this.inputTextarea?.value || "";
    }

    /**
     * Set input content (programmatically)
     */
    setInputContent(content) {
      if (this.inputTextarea) {
        this.inputTextarea.value = content;
        // Trigger conversion
        this.convertInput();
      }
    }

    /**
     * Clear all content
     */
    clearContent() {
      if (this.inputTextarea) {
        this.inputTextarea.value = "";
      }
      this.setEmptyOutput();
    }

    /**
     * Check if conversion engine is ready (optimized with status caching)
     * ENHANCED: Now delegates to StateManager with optimized access patterns
     */
    isEngineReady() {
      if (!this.useStateManagerFallback && window.StateManager) {
        const status = this._getCachedStatus();
        return status
          ? status.ready && status.pandocAvailable
          : window.StateManager.isEngineReady();
      }

      // Fallback when StateManager not available
      return this.isReady && this.pandocFunction !== null;
    }

    /**
     * Get conversion engine status with enhanced information
     * ENHANCED: Now delegates to StateManager for comprehensive state tracking
     */
    getEngineStatus() {
      if (!this.useStateManagerFallback && window.StateManager) {
        return window.StateManager.getEngineStatus();
      }

      // Fallback when StateManager not available
      return {
        initialised: this.isInitialised,
        ready: this.isReady,
        pandocAvailable: !!this.pandocFunction,
        conversionInProgress: this.conversionInProgress,
        hasInput: !!this.inputTextarea?.value?.trim(),
        hasOutput: !!this.outputDiv?.innerHTML?.trim(),
        enhancedErrorHandling: true,
        complexityAssessment: true,
        chunkedProcessing: true,
        stateManagement: false, // Fallback mode
      };
    }
  }

  // ===========================================================================================
  // CONVERSION ENGINE INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const conversionManager = new ConversionEngineManager();

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  // Delegate to ConversionAPIManager for public API creation
  return (
    window.ConversionAPIManager?.createPublicAPI(conversionManager) || {
      error: "ConversionAPIManager not available - API creation failed",
      manager: conversionManager,
    }
  );
})();

// Make globally available for other modules
window.ConversionEngine = ConversionEngine;
