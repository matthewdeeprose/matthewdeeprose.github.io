// state-manager.js
// State Manager - Conversion state tracking and management
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7

const StateManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("STATE_MANAGER", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[STATE_MANAGER]"),
    logWarn: console.warn.bind(console, "[STATE_MANAGER]"),
    logInfo: console.log.bind(console, "[STATE_MANAGER]"),
    logDebug: console.log.bind(console, "[STATE_MANAGER]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // STATE MANAGEMENT IMPLEMENTATION
  // ===========================================================================================

  /**
   * Conversion State Manager Class
   * Handles all conversion state tracking, validation, and lifecycle management
   */
  class ConversionStateManager {
    constructor() {
      // Core state properties
      this.isReady = false;
      this.isInitialised = false;
      this.conversionInProgress = false;
      this.isConversionQueued = false;
      this.lastConversionTime = 0;
      this.automaticConversionsDisabled = false;

      // Timeout and debouncing state
      this.conversionTimeout = null;
      this.DEBOUNCE_DELAY = 800;
      this.activeTimeouts = new Set();
      this.pollingTimeouts = new Set();

      // Configuration state
      this.maxComplexityScore = 50;
      this.maxDocumentLength = 10000;
      this.defaultTimeout = 10000;
      this.memoryOptimisationEnabled = true;

      // Context state
      this.domContext = {
        inputTextarea: null,
        outputDiv: null,
        argumentsInput: null
      };

      // Pandoc state
      this.pandocFunction = null;

      logDebug("ConversionStateManager initialized");
    }

    // ===========================================================================================
    // STATE TRACKING METHODS
    // ===========================================================================================

    /**
     * Get comprehensive engine status with all state information
     * @returns {Object} - Complete state information object
     */
    getEngineStatus() {
      return {
        // Core state flags
        initialised: this.isInitialised,
        ready: this.isReady,
        pandocAvailable: !!this.pandocFunction,
        conversionInProgress: this.conversionInProgress,
        conversionQueued: this.isConversionQueued,
        automaticConversionsDisabled: this.automaticConversionsDisabled,

        // Content state
        hasInput: !!this.domContext.inputTextarea?.value?.trim(),
        hasOutput: !!this.domContext.outputDiv?.innerHTML?.trim(),

        // Timing and performance state
        lastConversionTime: this.lastConversionTime,
        debounceDelay: this.DEBOUNCE_DELAY,
        activeTimeouts: this.activeTimeouts.size,
        pollingTimeouts: this.pollingTimeouts.size,

        // Configuration state
        maxComplexityScore: this.maxComplexityScore,
        maxDocumentLength: this.maxDocumentLength,
        defaultTimeout: this.defaultTimeout,
        memoryOptimisationEnabled: this.memoryOptimisationEnabled,

        // Enhanced feature flags
        enhancedErrorHandling: true,
        complexityAssessment: true,
        chunkedProcessing: true,
        stateManagement: true // New feature flag
      };
    }

    /**
     * Check if conversion engine is ready for operation
     * @returns {boolean} - True if ready for conversion
     */
    isEngineReady() {
      return this.isReady && this.pandocFunction !== null && this.isInitialised;
    }

    /**
     * Validate current state consistency
     * @returns {Object} - Validation result with issues and recommendations
     */
    validateState() {
      const validation = {
        valid: true,
        issues: [],
        warnings: [],
        recommendations: []
      };

      // Check core state consistency
      if (this.isReady && !this.isInitialised) {
        validation.valid = false;
        validation.issues.push("Engine marked ready but not initialised");
      }

      if (this.isReady && !this.pandocFunction) {
        validation.valid = false;
        validation.issues.push("Engine marked ready but Pandoc function not available");
      }

      if (this.conversionInProgress && this.isConversionQueued) {
        validation.warnings.push("Conversion in progress while queued - may indicate timing issue");
      }

      // Check DOM context
      if (this.isInitialised) {
        if (!this.domContext.inputTextarea || !this.domContext.outputDiv || !this.domContext.argumentsInput) {
          validation.valid = false;
          validation.issues.push("DOM context incomplete after initialisation");
        }
      }

      // Check timeout management
      if (this.activeTimeouts.size > 10) {
        validation.warnings.push(`High number of active timeouts: ${this.activeTimeouts.size}`);
        validation.recommendations.push("Consider cleanup of stale timeouts");
      }

      // Check memory management
      if (!this.memoryOptimisationEnabled) {
        validation.warnings.push("Memory optimisation disabled");
        validation.recommendations.push("Enable memory optimisation for better performance");
      }

      logDebug("State validation completed:", validation);
      return validation;
    }

    // ===========================================================================================
    // STATE LIFECYCLE MANAGEMENT
    // ===========================================================================================

    /**
     * Set initialisation state
     * @param {boolean} success - Whether initialisation was successful
     * @param {Object} domElements - DOM element references
     */
    setInitialisationState(success, domElements = {}) {
      this.isInitialised = success;
      
      if (success) {
        this.domContext.inputTextarea = domElements.inputTextarea;
        this.domContext.outputDiv = domElements.outputDiv;
        this.domContext.argumentsInput = domElements.argumentsInput;
        logInfo("State manager: Initialisation state set to success");
      } else {
        logWarn("State manager: Initialisation state set to failed");
      }
    }

    /**
     * Set engine readiness state
     * @param {boolean} ready - Whether engine is ready
     * @param {Function} pandocFn - Pandoc function reference
     */
    setReadyState(ready, pandocFn = null) {
      this.isReady = ready;
      if (pandocFn) {
        this.pandocFunction = pandocFn;
      }
      
      logInfo(`State manager: Engine readiness set to ${ready}`);
    }

    /**
     * Start conversion tracking
     * @param {Object} options - Conversion options
     */
    startConversion(options = {}) {
      if (this.conversionInProgress) {
        logWarn("Attempted to start conversion while already in progress");
        return false;
      }

      this.conversionInProgress = true;
      this.isConversionQueued = false;
      this.lastConversionTime = Date.now();

      // Apply any conversion-specific options
      if (options.debounceDelay) {
        this.DEBOUNCE_DELAY = options.debounceDelay;
      }

      logInfo("State manager: Conversion started");
      return true;
    }

    /**
     * Complete conversion tracking
     * @param {boolean} success - Whether conversion was successful
     */
    completeConversion(success = true) {
      this.conversionInProgress = false;
      this.isConversionQueued = false;
      
      if (success) {
        logInfo("State manager: Conversion completed successfully");
      } else {
        logWarn("State manager: Conversion completed with failure");
      }
    }

    /**
     * Queue conversion for delayed execution
     */
    queueConversion() {
      this.isConversionQueued = true;
      logDebug("State manager: Conversion queued");
    }

    // ===========================================================================================
    // CONTEXT PRESERVATION AND RESTORATION
    // ===========================================================================================

    /**
     * Preserve current state context for restoration
     * @returns {Object} - Preserved state snapshot
     */
    preserveContext() {
      const context = {
        timestamp: Date.now(),
        state: {
          isReady: this.isReady,
          isInitialised: this.isInitialised,
          conversionInProgress: this.conversionInProgress,
          isConversionQueued: this.isConversionQueued,
          lastConversionTime: this.lastConversionTime,
          automaticConversionsDisabled: this.automaticConversionsDisabled
        },
        configuration: {
          DEBOUNCE_DELAY: this.DEBOUNCE_DELAY,
          maxComplexityScore: this.maxComplexityScore,
          maxDocumentLength: this.maxDocumentLength,
          defaultTimeout: this.defaultTimeout,
          memoryOptimisationEnabled: this.memoryOptimisationEnabled
        },
        timeoutCounts: {
          activeTimeouts: this.activeTimeouts.size,
          pollingTimeouts: this.pollingTimeouts.size
        }
      };

      logDebug("State context preserved", context);
      return context;
    }

    /**
     * Restore state from preserved context
     * @param {Object} context - Previously preserved context
     * @returns {boolean} - Success/failure of restoration
     */
    restoreContext(context) {
      if (!context || !context.state) {
        logError("Invalid context provided for restoration");
        return false;
      }

      try {
        // Restore core state (but preserve DOM context and Pandoc function)
        const { state, configuration } = context;
        
        this.isReady = state.isReady;
        this.isInitialised = state.isInitialised;
        this.conversionInProgress = state.conversionInProgress;
        this.isConversionQueued = state.isConversionQueued;
        this.lastConversionTime = state.lastConversionTime;
        this.automaticConversionsDisabled = state.automaticConversionsDisabled;

        // Restore configuration
        if (configuration) {
          this.DEBOUNCE_DELAY = configuration.DEBOUNCE_DELAY;
          this.maxComplexityScore = configuration.maxComplexityScore;
          this.maxDocumentLength = configuration.maxDocumentLength;
          this.defaultTimeout = configuration.defaultTimeout;
          this.memoryOptimisationEnabled = configuration.memoryOptimisationEnabled;
        }

        logInfo("State context restored successfully");
        return true;

      } catch (error) {
        logError("Failed to restore state context:", error);
        return false;
      }
    }

    // ===========================================================================================
    // TIMEOUT AND MEMORY MANAGEMENT
    // ===========================================================================================

    /**
     * Add timeout to tracking system
     * @param {number} timeoutId - Timeout ID to track
     * @param {string} type - Type of timeout ('active' or 'polling')
     */
    addTimeout(timeoutId, type = 'active') {
      if (type === 'polling') {
        this.pollingTimeouts.add(timeoutId);
      } else {
        this.activeTimeouts.add(timeoutId);
      }
      
      logDebug(`Timeout ${timeoutId} added to ${type} tracking`);
    }

    /**
     * Remove timeout from tracking system
     * @param {number} timeoutId - Timeout ID to remove
     * @param {string} type - Type of timeout ('active' or 'polling')
     */
    removeTimeout(timeoutId, type = 'active') {
      if (type === 'polling') {
        this.pollingTimeouts.delete(timeoutId);
      } else {
        this.activeTimeouts.delete(timeoutId);
      }
      
      logDebug(`Timeout ${timeoutId} removed from ${type} tracking`);
    }

    /**
     * Clear all tracked timeouts
     * @param {boolean} preserveConversion - Whether to preserve conversion-related timeouts
     */
    clearAllTimeouts(preserveConversion = false) {
      let clearedCount = 0;

      // Clear active timeouts
      this.activeTimeouts.forEach(timeoutId => {
        if (!preserveConversion || timeoutId !== this.conversionTimeout) {
          clearTimeout(timeoutId);
          clearedCount++;
        }
      });

      // Clear polling timeouts
      this.pollingTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
        clearedCount++;
      });

      if (!preserveConversion) {
        this.activeTimeouts.clear();
        this.pollingTimeouts.clear();
        if (this.conversionTimeout) {
          clearTimeout(this.conversionTimeout);
          this.conversionTimeout = null;
        }
      } else {
        // Only clear non-conversion timeouts
        this.activeTimeouts = new Set([this.conversionTimeout].filter(Boolean));
        this.pollingTimeouts.clear();
      }

      logInfo(`State manager: Cleared ${clearedCount} timeouts`);
    }

    // ===========================================================================================
    // CONFIGURATION MANAGEMENT
    // ===========================================================================================

    /**
     * Update configuration settings
     * @param {Object} config - Configuration updates
     */
    updateConfiguration(config) {
      const updatedFields = [];

      if (typeof config.debounceDelay === 'number') {
        this.DEBOUNCE_DELAY = config.debounceDelay;
        updatedFields.push('debounceDelay');
      }

      if (typeof config.maxComplexityScore === 'number') {
        this.maxComplexityScore = config.maxComplexityScore;
        updatedFields.push('maxComplexityScore');
      }

      if (typeof config.maxDocumentLength === 'number') {
        this.maxDocumentLength = config.maxDocumentLength;
        updatedFields.push('maxDocumentLength');
      }

      if (typeof config.defaultTimeout === 'number') {
        this.defaultTimeout = config.defaultTimeout;
        updatedFields.push('defaultTimeout');
      }

      if (typeof config.memoryOptimisationEnabled === 'boolean') {
        this.memoryOptimisationEnabled = config.memoryOptimisationEnabled;
        updatedFields.push('memoryOptimisationEnabled');
      }

      if (typeof config.automaticConversionsDisabled === 'boolean') {
        this.automaticConversionsDisabled = config.automaticConversionsDisabled;
        updatedFields.push('automaticConversionsDisabled');
      }

      logInfo(`State manager: Updated configuration fields: ${updatedFields.join(', ')}`);
    }

    // ===========================================================================================
    // RESET AND CLEANUP
    // ===========================================================================================

    /**
     * Reset state to initial conditions
     * @param {boolean} preserveInitialisation - Whether to preserve initialisation state
     */
    resetState(preserveInitialisation = true) {
      const wasInitialised = this.isInitialised;
      const domContext = { ...this.domContext };
      const pandocFunction = this.pandocFunction;

      // Reset all state
      this.isReady = false;
      this.isInitialised = preserveInitialisation ? wasInitialised : false;
      this.conversionInProgress = false;
      this.isConversionQueued = false;
      this.lastConversionTime = 0;
      this.automaticConversionsDisabled = false;

      // Reset timeouts
      this.clearAllTimeouts();

      // Reset configuration to defaults
      this.DEBOUNCE_DELAY = 800;
      this.maxComplexityScore = 50;
      this.maxDocumentLength = 10000;
      this.defaultTimeout = 10000;
      this.memoryOptimisationEnabled = true;

      // Restore context if preserving initialisation
      if (preserveInitialisation) {
        this.domContext = domContext;
        this.pandocFunction = pandocFunction;
        this.isReady = !!pandocFunction;
      } else {
        this.domContext = {
          inputTextarea: null,
          outputDiv: null,
          argumentsInput: null
        };
        this.pandocFunction = null;
      }

      logInfo(`State manager: State reset (initialisation ${preserveInitialisation ? 'preserved' : 'reset'})`);
    }
  }

  // ===========================================================================================
  // STATE MANAGER INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create singleton instance
  const stateManagerInstance = new ConversionStateManager();

  // ===========================================================================================
  // INTEGRATION HELPERS
  // ===========================================================================================

  /**
   * Create state management context for integration with other modules
   * @param {Object} conversionManager - Conversion manager instance
   * @returns {Object} - State management context
   */
  function createStateManagementContext(conversionManager) {
    if (!conversionManager) {
      logWarn("No conversion manager provided for state management context");
      return {};
    }

    return {
      stateManager: stateManagerInstance,
      getEngineStatus: () => stateManagerInstance.getEngineStatus(),
      validateState: () => stateManagerInstance.validateState(),
      preserveContext: () => stateManagerInstance.preserveContext(),
      restoreContext: (context) => stateManagerInstance.restoreContext(context),
      startConversion: (options) => stateManagerInstance.startConversion(options),
      completeConversion: (success) => stateManagerInstance.completeConversion(success),
      isEngineReady: () => stateManagerInstance.isEngineReady()
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testStateManager() {
    const tests = {
      moduleExists: () => !!window.StateManager,

      instanceCreated: () => !!stateManagerInstance,

      initialState: () => {
        const status = stateManagerInstance.getEngineStatus();
        return !status.initialised && !status.ready && !status.conversionInProgress;
      },

      stateValidation: () => {
        const validation = stateManagerInstance.validateState();
        return validation && typeof validation.valid === 'boolean';
      },

      contextPreservation: () => {
        const context = stateManagerInstance.preserveContext();
        return context && context.timestamp && context.state;
      },

      contextRestoration: () => {
        const originalContext = stateManagerInstance.preserveContext();
        stateManagerInstance.resetState(false);
        const restored = stateManagerInstance.restoreContext(originalContext);
        return restored;
      },

      conversionLifecycle: () => {
        const started = stateManagerInstance.startConversion();
        const inProgress = stateManagerInstance.getEngineStatus().conversionInProgress;
        stateManagerInstance.completeConversion(true);
        const completed = !stateManagerInstance.getEngineStatus().conversionInProgress;
        return started && inProgress && completed;
      },

      timeoutManagement: () => {
        const testTimeout = setTimeout(() => {}, 1000);
        stateManagerInstance.addTimeout(testTimeout);
        const status1 = stateManagerInstance.getEngineStatus();
        stateManagerInstance.removeTimeout(testTimeout);
        const status2 = stateManagerInstance.getEngineStatus();
        clearTimeout(testTimeout);
        return status1.activeTimeouts > status2.activeTimeouts;
      },

      configurationUpdate: () => {
        const originalDelay = stateManagerInstance.DEBOUNCE_DELAY;
        stateManagerInstance.updateConfiguration({ debounceDelay: 1000 });
        const updated = stateManagerInstance.DEBOUNCE_DELAY === 1000;
        stateManagerInstance.updateConfiguration({ debounceDelay: originalDelay });
        return updated;
      },

      stateReset: () => {
        stateManagerInstance.setInitialisationState(true, {});
        stateManagerInstance.setReadyState(true);
        stateManagerInstance.resetState(true);
        const status = stateManagerInstance.getEngineStatus();
        return status.initialised && !status.ready; // Should preserve initialisation
      },

      integrationContext: () => {
        const context = createStateManagementContext({ test: true });
        return context && context.stateManager && typeof context.getEngineStatus === 'function';
      }
    };

    return window.TestUtilities?.runTestSuite("StateManager", tests) || 
           fallbackTesting("StateManager", tests);
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logInfo(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core state management
    getEngineStatus: () => stateManagerInstance.getEngineStatus(),
    isEngineReady: () => stateManagerInstance.isEngineReady(),
    validateState: () => stateManagerInstance.validateState(),

    // Lifecycle management
    setInitialisationState: (success, domElements) => stateManagerInstance.setInitialisationState(success, domElements),
    setReadyState: (ready, pandocFn) => stateManagerInstance.setReadyState(ready, pandocFn),
    startConversion: (options) => stateManagerInstance.startConversion(options),
    completeConversion: (success) => stateManagerInstance.completeConversion(success),
    queueConversion: () => stateManagerInstance.queueConversion(),

    // Context management
    preserveContext: () => stateManagerInstance.preserveContext(),
    restoreContext: (context) => stateManagerInstance.restoreContext(context),

    // Timeout management
    addTimeout: (timeoutId, type) => stateManagerInstance.addTimeout(timeoutId, type),
    removeTimeout: (timeoutId, type) => stateManagerInstance.removeTimeout(timeoutId, type),
    clearAllTimeouts: (preserveConversion) => stateManagerInstance.clearAllTimeouts(preserveConversion),

    // Configuration
    updateConfiguration: (config) => stateManagerInstance.updateConfiguration(config),
    resetState: (preserveInitialisation) => stateManagerInstance.resetState(preserveInitialisation),

    // Integration helpers
    createStateManagementContext,

    // Testing
    testStateManager,

    // Direct instance access for advanced integration
    instance: stateManagerInstance
  };
})();

// Make globally available
window.StateManager = StateManager;