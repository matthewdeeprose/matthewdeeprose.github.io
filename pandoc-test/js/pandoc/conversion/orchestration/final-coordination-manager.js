// final-coordination-manager.js
// Final Coordination Manager - Modular Coordination Hub
// Enhanced Pandoc-WASM Mathematical Playground //
//
// CURRENT ROLE: Central coordination point for cross-module integration
// - Delegates DOM/Event management to EventDOMManager
// - Delegates Fallback workflows to FallbackWorkflowManager  
// - Delegates Testing/API utilities to TestingAPIManager
// - Coordinates Memory management integration (retained)
// - Provides unified API for conversion-engine.js integration

const FinalCoordinationManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger(
    "FINAL_COORDINATION",
    {
      level: window.LoggingSystem.LOG_LEVELS.WARN,
    }
  ) || {
    logError: console.error.bind(console, "[FINAL_COORDINATION]"),
    logWarn: console.warn.bind(console, "[FINAL_COORDINATION]"),
    logInfo: console.log.bind(console, "[FINAL_COORDINATION]"),
    logDebug: console.log.bind(console, "[FINAL_COORDINATION]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // DOM & EVENT MANAGEMENT COORDINATION
  // Phase 7 Step 27: Delegated to EventDOMManager module
  // ===========================================================================================

  /**
   * Setup event listeners for conversion triggers
   * 
   * DELEGATION PATTERN: Routes to EventDOMManager.setupEventListeners()
   * 
   * RESPONSIBILITY: Coordinates DOM event handling across the conversion system
   * - Input textarea events with debouncing optimization
   * - Arguments input change detection  
   * - ContentEditable integration with Live LaTeX Editor
   * - Large deletion performance optimization
   * - Timeout tracking and memory management
   * 
   * @param {ConversionEngineManager} conversionManager - The conversion engine instance
   * @returns {boolean} - Success/failure of event listener setup
   * 
   * ERROR HANDLING: Graceful fallback with detailed error logging
   * PERFORMANCE: Optimized debouncing (800ms standard, 100ms for deletions)
   * INTEGRATION: Seamless coordination with Live LaTeX Editor
   */
  function setupEventListeners(conversionManager) {
    if (!window.EventDOMManager) {
      logError(
        "EventDOMManager module not available - event listeners setup failed"
      );
      return false;
    }

    try {
      return window.EventDOMManager.setupEventListeners(conversionManager);
    } catch (error) {
      logError("Failed to delegate event listeners setup:", error);
      return false;
    }
  }

  // ===========================================================================================
  // FALLBACK IMPLEMENTATION SYSTEM COORDINATION  
  // Phase 7 Step 27: Delegated to FallbackWorkflowManager module
  // ===========================================================================================

  /**
   * Initialize fallback state management when StateManager module not available
   * 
   * DELEGATION PATTERN: Routes to FallbackWorkflowManager.initializeFallbackState()
   * 
   * RESPONSIBILITY: Establishes fallback state management for system resilience
   * - Initializes conversion state properties (_isReady, _isInitialised, etc.)
   * - Sets up timeout and memory management defaults
   * - Configures complexity assessment parameters
   * - Establishes debouncing and polling timeout tracking
   * 
   * @param {ConversionEngineManager} conversionManager - The conversion engine instance  
   * @returns {boolean} - Success/failure of fallback state initialization
   * 
   * FALLBACK STRATEGY: Essential for system operation when StateManager unavailable
   * CONFIGURATION: Comprehensive state property initialization
   * RESILIENCE: Ensures conversion system remains functional under all conditions
   */
  function initializeFallbackState(conversionManager) {
    if (!window.FallbackWorkflowManager) {
      logError(
        "FallbackWorkflowManager module not available - fallback state initialization failed"
      );
      return false;
    }

    try {
      return window.FallbackWorkflowManager.initializeFallbackState(
        conversionManager
      );
    } catch (error) {
      logError("Failed to delegate fallback state initialization:", error);
      return false;
    }
  }

  /**
   * Fallback conversion workflow when ConversionOrchestrator not available
   * 
   * DELEGATION PATTERN: Routes to FallbackWorkflowManager.fallbackConversionWorkflow()
   * 
   * RESPONSIBILITY: Orchestrates complete conversion when primary orchestrator fails
   * - Document complexity assessment and strategy selection
   * - Status management and user feedback during conversion
   * - Comparison mode detection and handling
   * - Chunked processing coordination for complex documents
   * - Standard conversion workflow with enhanced error handling
   * 
   * @param {ConversionEngineManager} conversionManager - The conversion engine instance
   * @param {string} inputText - The LaTeX input text to convert
   * @param {string} argumentsText - The Pandoc arguments for conversion
   * @returns {Promise<boolean>} - Success/failure of fallback conversion workflow
   * 
   * WORKFLOW STAGES: Assessment → Status Updates → Mode Detection → Processing → Completion
   * ERROR RECOVERY: Comprehensive error handling with graceful degradation
   * PERFORMANCE: Optimized processing strategy selection based on document complexity
   */
  async function fallbackConversionWorkflow(
    conversionManager,
    inputText,
    argumentsText
  ) {
    if (!window.FallbackWorkflowManager) {
      logError(
        "FallbackWorkflowManager module not available - fallback workflow failed"
      );
      throw new Error(
        "FallbackWorkflowManager module required for fallback workflow"
      );
    }

    try {
      return await window.FallbackWorkflowManager.fallbackConversionWorkflow(
        conversionManager,
        inputText,
        argumentsText
      );
    } catch (error) {
      logError("Failed to delegate fallback conversion workflow:", error);
      throw error;
    }
  }

  /**
   * Perform standard conversion with enhanced monitoring and error detection
   * 
   * DELEGATION PATTERN: Routes to FallbackWorkflowManager.performStandardConversion()
   * 
   * RESPONSIBILITY: Executes core conversion process with comprehensive monitoring
   * - Pandoc argument enhancement and debugging output
   * - LaTeX expression preservation for annotation injection
   * - Timeout management based on document complexity
   * - Output cleaning and MathJax rendering coordination
   * - Status updates and success/error state management
   * 
   * @param {ConversionEngineManager} conversionManager - The conversion engine instance
   * @param {string} inputText - The LaTeX input text to convert
   * @param {string} userArgumentsText - User-specified Pandoc arguments
   * @param {Object} complexity - Document complexity assessment results
   * @returns {Promise<boolean>} - Success/failure of standard conversion
   * 
   * PERFORMANCE OPTIMIZATION: Dynamic timeout adjustment based on complexity
   * ANNOTATION PRESERVATION: Critical LaTeX expression mapping before conversion
   * ERROR DETECTION: Comprehensive monitoring with detailed debugging output
   */
  async function performStandardConversion(
    conversionManager,
    inputText,
    userArgumentsText,
    complexity
  ) {
    if (!window.FallbackWorkflowManager) {
      logError(
        "FallbackWorkflowManager module not available - standard conversion failed"
      );
      throw new Error(
        "FallbackWorkflowManager module required for standard conversion"
      );
    }

    try {
      return await window.FallbackWorkflowManager.performStandardConversion(
        conversionManager,
        inputText,
        userArgumentsText,
        complexity
      );
    } catch (error) {
      logError("Failed to delegate standard conversion:", error);
      throw error;
    }
  }

  // ===========================================================================================
  // MEMORY MANAGEMENT INTEGRATION COORDINATION
  // Phase 7 Step 27: Retained in FinalCoordinationManager (specialized coordination)
  // ===========================================================================================

  /**
   * Enhanced DOM cleanup for empty content and large deletions
   * 
   * DIRECT IMPLEMENTATION: Specialized memory management coordination
   * 
   * RESPONSIBILITY: Coordinates annotation-safe DOM cleanup operations
   * - Delegates to CleanupCoordinator when available
   * - Implements fallback DOM cleanup with annotation protection
   * - Manages timing delays for annotation injection completion
   * - Provides comprehensive cleanup logging and status reporting
   * 
   * @returns {void}
   * 
   * ANNOTATION SAFETY: Critical protection for mathematical annotation injection
   * PERFORMANCE: Optimized cleanup strategies for different content scenarios
   * RESILIENCE: Multiple fallback layers for cleanup coordination
   */
  function performDOMCleanup() {
    logInfo("Performing annotation-safe DOM cleanup...");

    // Use the new CleanupCoordinator for DOM cleanup
    if (window.CleanupCoordinator) {
      window.CleanupCoordinator.performDOMCleanup();
    } else {
      // Fallback DOM cleanup
      logWarn("CleanupCoordinator not available - using fallback DOM cleanup");
      performFallbackDOMCleanup();
    }
  }

  /**
   * Fallback DOM cleanup when CleanupCoordinator not available
   * 
   * FALLBACK IMPLEMENTATION: Essential system resilience
   * 
   * RESPONSIBILITY: Provides annotation-aware cleanup when primary system unavailable
   * - Monitors mathematical elements and annotation status
   * - Implements intelligent delay for annotation completion
   * - Protects against cleanup interference during annotation injection
   * - Coordinates with performSafeCleanup for comprehensive cleanup
   * 
   * @returns {void}
   * 
   * TIMING STRATEGY: 2-second delay allows annotation injection to complete
   * SAFETY CHECKS: Comprehensive validation before proceeding with cleanup
   * ERROR PREVENTION: Avoids cleanup during critical annotation processes
   */
  function performFallbackDOMCleanup() {
    // Check annotation status
    const mathElements = document.querySelectorAll("mjx-container").length;
    const annotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;

    if (mathElements > 0 && annotations === 0) {
      logWarn(
        "Math elements present but no annotations - delaying cleanup to protect annotation injection"
      );

      setTimeout(() => {
        const finalAnnotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;
        if (finalAnnotations > 0 || mathElements === 0) {
          logInfo(
            "Resuming delayed cleanup - annotations complete or math removed"
          );
          performSafeCleanup();
        } else {
          logWarn(
            "Annotations still missing - skipping cleanup to prevent interference"
          );
        }
      }, 2000);

      return;
    }

    // Safe to clean up
    performSafeCleanup();
  }

  /**
   * Annotation-safe cleanup that preserves annotation elements
   * 
   * DIRECT IMPLEMENTATION: Specialized annotation protection
   * 
   * RESPONSIBILITY: Executes comprehensive cleanup while preserving annotations
   * - Coordinates with CleanupCoordinator for optimal cleanup
   * - Implements fallback safe cleanup when coordinator unavailable  
   * - Provides detailed logging for cleanup operations
   * - Ensures mathematical annotations remain intact throughout process
   * 
   * @returns {void}
   * 
   * ANNOTATION PRESERVATION: Core requirement for accessibility compliance
   * MODULAR COORDINATION: Leverages specialized cleanup modules when available
   * COMPREHENSIVE LOGGING: Detailed operation tracking for debugging
   */
  function performSafeCleanup() {
    logInfo("Performing safe cleanup (annotation-protected)...");

    // Use the new CleanupCoordinator for safe cleanup
    if (window.CleanupCoordinator) {
      window.CleanupCoordinator.performSafeCleanup();
    } else {
      // Fallback safe cleanup
      logWarn("CleanupCoordinator not available - using fallback safe cleanup");
      performFallbackSafeCleanup();
    }

    logInfo("Safe cleanup completed (annotations preserved)");
  }

  /**
   * Fallback safe cleanup when CleanupCoordinator not available
   * 
   * FALLBACK IMPLEMENTATION: Essential annotation protection
   * 
   * RESPONSIBILITY: Provides basic safe cleanup when specialized modules unavailable
   * - Utilizes DOMCleanupUtilities for comprehensive cleanup when available
   * - Implements minimal cleanup targeting temporary processing elements
   * - Avoids interference with mathematical content and annotations
   * - Provides status logging for cleanup operations
   * 
   * @returns {void}
   * 
   * MINIMAL APPROACH: Conservative cleanup to prevent annotation damage
   * UTILITY INTEGRATION: Leverages DOM utilities when available
   * SAFETY FIRST: Prioritizes annotation preservation over aggressive cleanup
   */
  function performFallbackSafeCleanup() {
    if (window.DOMCleanupUtilities) {
      window.DOMCleanupUtilities.performComprehensiveCleanup();
    } else {
      // Basic fallback cleanup
      const tempNodes = document.querySelectorAll(
        ".temp-math-processing, .processing-marker"
      );
      tempNodes.forEach((node) => node.remove());

      logInfo("Basic fallback cleanup completed");
    }
  }

  /**
   * Initialize memory watchdog after modules are loaded
   * 
   * DIRECT IMPLEMENTATION: Memory monitoring coordination
   * 
   * RESPONSIBILITY: Establishes system-wide memory monitoring capabilities
   * - Creates MemoryWatchdog instance when module available
   * - Configures automatic monitoring startup with appropriate delay
   * - Provides comprehensive error handling for watchdog initialization
   * - Returns watchdog instance for integration with other systems
   * 
   * @returns {Object|null} - MemoryWatchdog instance or null if unavailable
   * 
   * INITIALIZATION DELAY: 5-second delay allows complete system initialization
   * MONITORING SCOPE: System-wide memory tracking and management
   * ERROR RESILIENCE: Graceful degradation when memory monitoring unavailable
   */
  function initializeMemoryWatchdog() {
    if (!window.MemoryWatchdog) {
      logWarn(
        "MemoryWatchdog module not available - memory monitoring disabled"
      );
      return null;
    }

    try {
      const memoryWatchdog = window.MemoryWatchdog.createWatchdog();

      // Start monitoring automatically after initialization
      setTimeout(() => {
        if (memoryWatchdog) {
          memoryWatchdog.startMonitoring();
          logInfo("Modular memory watchdog system initialized and started");
        }
      }, 5000); // Start after 5 seconds to allow app to initialize

      return memoryWatchdog;
    } catch (error) {
      logError("Failed to initialize modular memory watchdog:", error);
      return null;
    }
  }

  /**
   * Get comprehensive memory diagnostics
   * 
   * DIRECT IMPLEMENTATION: System diagnostic coordination
   * 
   * RESPONSIBILITY: Aggregates memory and performance diagnostics from multiple sources
   * - Integrates PerformanceMonitor system diagnostics when available
   * - Includes conversion-specific timeout tracking
   * - Aggregates DOM cleanup statistics and health metrics
   * - Provides memory watchdog status and monitoring data
   * - Implements comprehensive fallback diagnostic collection
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine for metrics
   * @param {Object} memoryWatchdog - Memory watchdog instance for status
   * @returns {Object} - Comprehensive diagnostic data object
   * 
   * DIAGNOSTIC SCOPE: System-wide performance and memory metrics
   * FALLBACK CAPABILITY: Comprehensive diagnostics even without specialized modules
   * INTEGRATION: Coordinates multiple diagnostic sources into unified report
   */
  function getMemoryDiagnostics(conversionManager, memoryWatchdog) {
    if (window.PerformanceMonitor) {
      const diagnostics = window.PerformanceMonitor.getSystemDiagnostics();
      // Add conversion-specific metrics
      const conversionActiveTimeouts =
        conversionManager?.activeTimeouts?.size || 0;

      // Add DOM cleanup utilities statistics if available
      let domStats = {};
      if (window.DOMCleanupUtilities) {
        domStats = window.DOMCleanupUtilities.getDOMStatistics();
      }

      return {
        ...diagnostics.performance.metrics,
        activeTimeouts: conversionActiveTimeouts,
        systemDiagnostics: diagnostics,
        domStatistics: domStats,
        memoryWatchdogStatus: memoryWatchdog?.getStatus() || {
          monitoring: false,
        },
      };
    } else {
      // Enhanced fallback using new DOM utilities
      logWarn(
        "PerformanceMonitor not available - using enhanced fallback diagnostics"
      );

      const conversionActiveTimeouts =
        conversionManager?.activeTimeouts?.size || 0;
      let domStats = {};

      if (window.DOMCleanupUtilities) {
        domStats = window.DOMCleanupUtilities.getDOMStatistics();
      } else {
        // Basic fallback stats
        domStats = {
          totalElements: document.querySelectorAll("*").length,
          mathElements: document.querySelectorAll("mjx-container").length,
          annotations: document.querySelectorAll(
            'annotation[encoding="application/x-tex"]'
          ).length,
          tempElements: document.querySelectorAll(
            ".temp-math-processing, .processing-marker"
          ).length,
        };
      }

      return {
        heapSizeMB: performance.memory
          ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
          : "unknown",
        activeTimeouts: conversionActiveTimeouts,
        ...domStats,
        mathJaxQueued: document.querySelectorAll('[data-mml-node="math"]')
          .length,
        memoryWatchdogStatus: memoryWatchdog?.getStatus() || {
          monitoring: false,
        },
      };
    }
  }

  /**
   * Perform emergency cleanup
   * 
   * DIRECT IMPLEMENTATION: Critical system recovery
   * 
   * RESPONSIBILITY: Coordinates emergency cleanup across all system components
   * - Triggers memory watchdog emergency cleanup when available
   * - Delegates to CleanupCoordinator for comprehensive emergency procedures
   * - Implements ultimate fallback cleanup for system recovery
   * - Provides comprehensive logging for emergency operations
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine instance
   * @param {Object} memoryWatchdog - Memory watchdog for emergency procedures
   * @returns {void}
   * 
   * EMERGENCY PRIORITY: Memory watchdog emergency procedures take precedence
   * COMPREHENSIVE SCOPE: System-wide cleanup including timeouts and memory
   * RECOVERY FOCUS: Designed to restore system functionality under critical conditions
   */
  function performEmergencyCleanup(conversionManager, memoryWatchdog) {
    logWarn("Manual emergency cleanup triggered");

    if (memoryWatchdog && memoryWatchdog.triggerEmergencyCleanup) {
      memoryWatchdog.triggerEmergencyCleanup("Manual trigger");
    } else if (window.CleanupCoordinator) {
      // Fallback to direct cleanup coordinator
      window.CleanupCoordinator.emergencyCleanup(
        conversionManager?.activeTimeouts,
        conversionManager?.pollingTimeouts
      );
    } else {
      // Ultimate fallback
      logWarn(
        "No memory management modules available - using conversion manager emergency cleanup"
      );
      if (conversionManager && conversionManager.emergencyCleanup) {
        conversionManager.emergencyCleanup();
      }
    }
  }

  /**
   * Get DOM health assessment
   * 
   * DIRECT IMPLEMENTATION: DOM health monitoring
   * 
   * RESPONSIBILITY: Provides comprehensive DOM health status assessment
   * - Utilizes DOMCleanupUtilities for detailed health analysis when available
   * - Implements fallback health reporting when utilities unavailable
   * - Provides recommendations and warnings for DOM management
   * - Supports system monitoring and maintenance decision making
   * 
   * @returns {Object} - DOM health assessment with status, warnings, and recommendations
   * 
   * HEALTH METRICS: Comprehensive DOM element analysis and recommendations
   * FALLBACK REPORTING: Basic health status when specialized utilities unavailable
   * MAINTENANCE GUIDANCE: Actionable recommendations for DOM optimization
   */
  function getDOMHealthAssessment() {
    if (window.DOMCleanupUtilities) {
      return window.DOMCleanupUtilities.assessDOMHealth();
    } else {
      return {
        healthy: true,
        warnings: [
          "DOM health assessment not available - DOMCleanupUtilities module not loaded",
        ],
        recommendations: [
          "Load DOM cleanup utilities for comprehensive health monitoring",
        ],
      };
    }
  }

  // ===========================================================================================
  // TESTING COORDINATION SYSTEM
  // Phase 7 Step 27: Delegated to TestingAPIManager module  
  // ===========================================================================================

  /**
   * Test complete state synchronization across all modules
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.testStateSynchronization()
   * 
   * RESPONSIBILITY: Validates state consistency across the entire modular system
   * - StateManager integration and cache performance validation
   * - Property delegation consistency checking
   * - Cross-module state synchronization verification
   * - Memory leak prevention and optimization validation
   * - Performance benchmarking for property access patterns
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine for testing
   * @returns {Object} - Test results with success status and performance metrics
   * 
   * TEST SCOPE: 13 comprehensive tests covering state management integration
   * PERFORMANCE VALIDATION: Cache optimization and property access benchmarking
   * INTEGRATION TESTING: Cross-module consistency and synchronization verification
   */
  function testStateSynchronization(conversionManager) {
    if (!window.TestingAPIManager) {
      logError(
        "TestingAPIManager module not available - state synchronization test failed"
      );
      return {
        success: false,
        passed: 0,
        total: 1,
        error: "TestingAPIManager module not available",
      };
    }

    try {
      return window.TestingAPIManager.testStateSynchronization(
        conversionManager
      );
    } catch (error) {
      logError("Failed to delegate state synchronization test:", error);
      return {
        success: false,
        passed: 0,
        total: 1,
        error: error.message,
      };
    }
  }

  /**
   * Test orchestration performance and state consistency
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.testOrchestrationPerformance()
   * 
   * RESPONSIBILITY: Validates performance optimization and orchestration efficiency
   * - Orchestration module readiness and integration validation
   * - Performance benchmarking for conversion readiness checks
   * - Memory efficiency validation under load conditions
   * - Cache hit ratio optimization verification
   * - End-to-end performance baseline establishment
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine for testing
   * @returns {Object} - Test results with performance metrics and optimization status
   * 
   * TEST SCOPE: 10 comprehensive tests covering orchestration and performance
   * PERFORMANCE METRICS: Detailed timing and efficiency measurements
   * OPTIMIZATION VALIDATION: Cache performance and memory efficiency verification
   */
  function testOrchestrationPerformance(conversionManager) {
    if (!window.TestingAPIManager) {
      logError(
        "TestingAPIManager module not available - orchestration performance test failed"
      );
      return {
        success: false,
        passed: 0,
        total: 1,
        error: "TestingAPIManager module not available",
      };
    }

    try {
      return window.TestingAPIManager.testOrchestrationPerformance(
        conversionManager
      );
    } catch (error) {
      logError("Failed to delegate orchestration performance test:", error);
      return {
        success: false,
        passed: 0,
        total: 1,
        error: error.message,
      };
    }
  }

  /**
   * Test integrated memory management system
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.testMemoryManagementIntegration()
   * 
   * RESPONSIBILITY: Validates comprehensive memory management system integration
   * - Memory management module availability verification
   * - Memory diagnostics and health assessment validation
   * - Cleanup integration and emergency procedures testing
   * - Memory watchdog functionality and status verification
   * - System resilience under memory management scenarios
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine for testing
   * @param {Object} memoryWatchdog - Memory watchdog instance for testing
   * @returns {Object} - Test results with memory management validation status
   * 
   * TEST SCOPE: 8 comprehensive tests covering memory management integration
   * SYSTEM VALIDATION: Memory modules, diagnostics, and cleanup coordination
   * RESILIENCE TESTING: Emergency procedures and system recovery validation
   */
  function testMemoryManagementIntegration(conversionManager, memoryWatchdog) {
    if (!window.TestingAPIManager) {
      logError(
        "TestingAPIManager module not available - memory management integration test failed"
      );
      return {
        success: false,
        passed: 0,
        total: 1,
        error: "TestingAPIManager module not available",
      };
    }

    try {
      return window.TestingAPIManager.testMemoryManagementIntegration(
        conversionManager,
        memoryWatchdog
      );
    } catch (error) {
      logError("Failed to delegate memory management integration test:", error);
      return {
        success: false,
        passed: 0,
        total: 1,
        error: error.message,
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API UTILITIES COORDINATION
  // Phase 7 Step 27: Delegated to TestingAPIManager module
  // ===========================================================================================

  /**
   * Get current output content
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.getCurrentOutput()
   * 
   * RESPONSIBILITY: Provides unified access to conversion output content
   * - Retrieves HTML content from conversion engine output div
   * - Handles graceful fallback when manager unavailable
   * - Supports programmatic access to conversion results
   * - Integrates with testing and validation workflows
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine instance
   * @returns {string} - Current HTML output content or empty string
   * 
   * API INTEGRATION: Essential for export systems and content validation
   * ERROR HANDLING: Graceful degradation with empty string fallback
   * TESTING SUPPORT: Critical for automated testing and validation workflows
   */
  function getCurrentOutput(conversionManager) {
    if (!window.TestingAPIManager) {
      logError("TestingAPIManager module not available for getCurrentOutput");
      return "";
    }

    try {
      return window.TestingAPIManager.getCurrentOutput(conversionManager);
    } catch (error) {
      logError("Failed to delegate getCurrentOutput:", error);
      return "";
    }
  }

  /**
   * Get current input content
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.getCurrentInput()
   * 
   * RESPONSIBILITY: Provides unified access to conversion input content
   * - Retrieves LaTeX content from conversion engine input textarea
   * - Handles graceful fallback when manager unavailable
   * - Supports programmatic access to user input
   * - Integrates with validation and preprocessing workflows
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine instance  
   * @returns {string} - Current LaTeX input content or empty string
   * 
   * API INTEGRATION: Essential for preprocessing and validation systems
   * ERROR HANDLING: Graceful degradation with empty string fallback
   * WORKFLOW SUPPORT: Critical for content analysis and processing workflows
   */
  function getCurrentInput(conversionManager) {
    if (!window.TestingAPIManager) {
      logError("TestingAPIManager module not available for getCurrentInput");
      return "";
    }

    try {
      return window.TestingAPIManager.getCurrentInput(conversionManager);
    } catch (error) {
      logError("Failed to delegate getCurrentInput:", error);
      return "";
    }
  }

  /**
   * Set input content (programmatically)
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.setInputContent()
   * 
   * RESPONSIBILITY: Provides programmatic control over conversion input content
   * - Sets LaTeX content in conversion engine input textarea
   * - Triggers automatic conversion workflow when content is set
   * - Handles graceful fallback when manager unavailable
   * - Supports automated content loading and testing scenarios
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine instance
   * @param {string} content - LaTeX content to set as input
   * @returns {void}
   * 
   * AUTOMATION SUPPORT: Essential for programmatic content management
   * CONVERSION TRIGGER: Automatically initiates conversion after content setting
   * ERROR HANDLING: Graceful degradation with comprehensive error logging
   */
  function setInputContent(conversionManager, content) {
    if (!window.TestingAPIManager) {
      logError("TestingAPIManager module not available for setInputContent");
      return;
    }

    try {
      return window.TestingAPIManager.setInputContent(
        conversionManager,
        content
      );
    } catch (error) {
      logError("Failed to delegate setInputContent:", error);
    }
  }

  /**
   * Clear all content
   * 
   * DELEGATION PATTERN: Routes to TestingAPIManager.clearContent()
   * 
   * RESPONSIBILITY: Provides comprehensive content clearing functionality
   * - Clears LaTeX content from conversion engine input textarea
   * - Resets output display to empty state with placeholder message
   * - Handles graceful fallback when manager unavailable
   * - Supports content reset and testing cleanup scenarios
   * 
   * @param {ConversionEngineManager} conversionManager - Conversion engine instance
   * @returns {void}
   * 
   * RESET FUNCTIONALITY: Complete content clearing for fresh start scenarios
   * UI COORDINATION: Coordinated clearing of both input and output areas
   * ERROR HANDLING: Graceful degradation with comprehensive error logging
   */
  function clearContent(conversionManager) {
    if (!window.TestingAPIManager) {
      logError("TestingAPIManager module not available for clearContent");
      return;
    }

    try {
      return window.TestingAPIManager.clearContent(conversionManager);
    } catch (error) {
      logError("Failed to delegate clearContent:", error);
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testFinalCoordinationManager() {
    const tests = {
      moduleExists: () => !!window.FinalCoordinationManager,

      hasSetupEventListeners: () => typeof setupEventListeners === "function",

      hasInitializeFallbackState: () =>
        typeof initializeFallbackState === "function",

      hasFallbackConversionWorkflow: () =>
        typeof fallbackConversionWorkflow === "function",

      hasPerformStandardConversion: () =>
        typeof performStandardConversion === "function",

      hasMemoryCoordination: () =>
        typeof initializeMemoryWatchdog === "function",

      hasTestingCoordination: () =>
        typeof testStateSynchronization === "function",

      hasAPIUtilities: () => typeof getCurrentOutput === "function",

      integrationReadiness: () => {
        // Test that the module is ready for integration
        return !!(
          setupEventListeners &&
          initializeFallbackState &&
          fallbackConversionWorkflow &&
          performStandardConversion &&
          initializeMemoryWatchdog &&
          testStateSynchronization &&
          testOrchestrationPerformance &&
          testMemoryManagementIntegration &&
          getCurrentOutput &&
          getCurrentInput &&
          setInputContent &&
          clearContent
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("FinalCoordinationManager", tests) ||
      fallbackTesting("FinalCoordinationManager", tests)
    );
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
    // DOM & Event Management (Delegated to EventDOMManager)
    setupEventListeners,

    // Fallback System Coordination (Delegated to FallbackWorkflowManager)
    initializeFallbackState,
    fallbackConversionWorkflow,
    performStandardConversion,

    // Memory Management Integration (Direct Implementation)
    performDOMCleanup,
    performFallbackDOMCleanup,
    performSafeCleanup,
    performFallbackSafeCleanup,
    initializeMemoryWatchdog,
    getMemoryDiagnostics,
    performEmergencyCleanup,
    getDOMHealthAssessment,

    // Testing Coordination (Delegated to TestingAPIManager)
    testStateSynchronization,
    testOrchestrationPerformance,
    testMemoryManagementIntegration,

    // API Utilities (Delegated to TestingAPIManager)
    getCurrentOutput,
    getCurrentInput,
    setInputContent,
    clearContent,

    // Testing
    testFinalCoordinationManager,
  };
})();

// Make globally available
window.FinalCoordinationManager = FinalCoordinationManager;