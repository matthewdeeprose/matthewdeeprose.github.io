// logging-system.js
// Reusable Logging Configuration System
// Provides configurable logging levels for all conversion modules
// Uses British spelling throughout (initialised, colour)

const LoggingSystem = (function () {
  "use strict";

  // ===========================================================================================
  // GLOBAL LOGGING CONFIGURATION
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4, // NEW: Enhanced tracing level
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // ===========================================================================================
  // CONVERSION FLOW TRACING CONFIGURATION
  // ===========================================================================================

  // Flow tracing state management
  let tracingEnabled = false;
  let tracingSession = null;
  let moduleCallCounts = {};
  let conversionFlowData = [];
  let tracingStartTime = null;
  let currentScenario = null;

  // Enhanced tracing configuration for conversion modules
  const CONVERSION_MODULES = [
    "CONVERSION",
    "STATE_MGR",
    "CONVERSION_ORCHESTRATOR",
    "EVENT_COORDINATOR",
    "ERROR_HANDLER",
    "LATEX_PRESERVATION",
    "CHUNKED_PROCESSING",
    "PROCESSING_STRATEGY",
    "MEMORY_WATCHDOG",
    "CLEANUP_COORD",
    "INTEGRATION_MGR",
    "FALLBACK_COORDINATOR",
    "FINAL_COORDINATION",
  ];

  // ===========================================================================================
  // PER-FILE LOGGING CONFIGURATIONS
  // ===========================================================================================

  // Per-module logging configuration
  // Each module can have its own logging level
  const moduleConfigs = {
    CONVERSION: {
      level: LOG_LEVELS.DEBUG,
      enabled: true,
    },
    LATEX: {
      level: LOG_LEVELS.WARN, // Less verbose for LaTeX processing
      enabled: true,
    },
    MEMORY: {
      level: LOG_LEVELS.INFO,
      enabled: true,
    },
    EXPORT: {
      level: LOG_LEVELS.INFO,
      enabled: true,
    },
    TEMPLATE: {
      level: LOG_LEVELS.WARN, // Templates can be verbose
      enabled: true,
    },
    PROCESSING: {
      level: LOG_LEVELS.INFO,
      enabled: true,
    },
    PANDOC: {
      level: LOG_LEVELS.DEBUG,
      enabled: true,
    },
    ERROR: {
      level: LOG_LEVELS.ERROR, // Error handling only shows errors/warns
      enabled: true,
    },
    EVENTS: {
      level: LOG_LEVELS.WARN,
      enabled: true,
    },
    UTILS: {
      level: LOG_LEVELS.WARN,
      enabled: true,
    },
  };

  // ===========================================================================================
  // CONVERSION FLOW TRACING FUNCTIONS
  // ===========================================================================================

  /**
   * Enable comprehensive conversion flow tracing
   * @param {string} scenario - The tracing scenario name
   * @param {Array} focusModules - Modules to focus tracing on (optional)
   * @returns {string} - Tracing session ID
   */
  function enableConversionTracing(
    scenario = "general",
    focusModules = CONVERSION_MODULES
  ) {
    tracingEnabled = true;
    tracingSession = `trace_${Date.now()}_${scenario}`;
    tracingStartTime = performance.now();
    currentScenario = scenario;
    moduleCallCounts = {};
    conversionFlowData = [];

    // Set all conversion modules to TRACE level
    focusModules.forEach((module) => {
      if (moduleConfigs[module]) {
        moduleConfigs[module].level = LOG_LEVELS.TRACE;
        moduleConfigs[module].enabled = true;
      }
    });

    console.log("=== CONVERSION FLOW TRACING ENABLED ===");
    console.log(`Session: ${tracingSession}`);
    console.log(`Scenario: ${scenario}`);
    console.log(`Modules configured for tracing:`, focusModules);

    return tracingSession;
  }

  /**
   * Disable conversion flow tracing and return results
   * @returns {Object} - Complete tracing session results
   */
  function disableConversionTracing() {
    const tracingResults = {
      sessionId: tracingSession,
      scenario: currentScenario,
      duration: performance.now() - tracingStartTime,
      moduleCallCounts: { ...moduleCallCounts },
      flowData: [...conversionFlowData],
      summary: generateTracingSummary(),
    };

    // Reset tracing state
    tracingEnabled = false;
    tracingSession = null;
    currentScenario = null;
    moduleCallCounts = {};
    conversionFlowData = [];

    // Reset module log levels to defaults
    CONVERSION_MODULES.forEach((module) => {
      if (moduleConfigs[module]) {
        moduleConfigs[module].level = LOG_LEVELS.WARN; // Reset to default
      }
    });

    console.log("=== CONVERSION FLOW TRACING DISABLED ===");
    console.log("Tracing results:", tracingResults);

    return tracingResults;
  }

  /**
   * Record a conversion flow event for tracing
   * @param {string} moduleName - Name of the module generating the event
   * @param {string} eventType - Type of event (start, decision, completion, error)
   * @param {Object} eventData - Event data
   */
  function recordFlowEvent(moduleName, eventType, eventData = {}) {
    if (!tracingEnabled) return;

    const timestamp = performance.now() - tracingStartTime;

    // Count module calls
    moduleCallCounts[moduleName] = (moduleCallCounts[moduleName] || 0) + 1;

    // Enhanced event data with performance context
    const flowEvent = {
      timestamp,
      module: moduleName,
      eventType,
      data: {
        ...eventData,
        // Add performance context
        memoryUsage: performance.memory
          ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
          : null,
        // Add decision context for key events
        isDecisionPoint:
          eventType === "decision" ||
          eventData.decision ||
          (eventData.message && eventData.message.includes("assessment")) ||
          (eventData.message && eventData.message.includes("complexity")) ||
          (eventData.message && eventData.message.includes("strategy")),
      },
      callCount: moduleCallCounts[moduleName],
      // Performance delta from previous event
      deltaTime:
        conversionFlowData.length > 0
          ? timestamp -
            conversionFlowData[conversionFlowData.length - 1].timestamp
          : 0,
    };

    conversionFlowData.push(flowEvent);

    // Automatically detect high-frequency modules for optimization alerts
    if (
      moduleCallCounts[moduleName] > 15 &&
      moduleCallCounts[moduleName] % 5 === 0
    ) {
      console.warn(
        `[TRACING] High activity detected: ${moduleName} has ${moduleCallCounts[moduleName]} calls`
      );
    }
  }

  /**
   * Generate tracing summary analysis
   * @returns {Object} - Summary of tracing session
   */
  function generateTracingSummary() {
    const moduleFrequency = Object.entries(moduleCallCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 modules

    // Enhanced decision point detection
    const decisionPoints = conversionFlowData
      .filter(
        (event) => event.eventType === "decision" || event.data.isDecisionPoint
      )
      .map((event) => ({
        module: event.module,
        decision: event.data.decision || event.data.message,
        timestamp: event.timestamp,
      }));

    const errorEvents = conversionFlowData.filter(
      (event) => event.eventType === "error"
    ).length;

    // Performance analysis
    const performanceMetrics = {
      totalDuration:
        conversionFlowData.length > 0
          ? Math.max(...conversionFlowData.map((e) => e.timestamp))
          : 0,
      averageEventTime:
        conversionFlowData.length > 0
          ? conversionFlowData.reduce((sum, e) => sum + (e.deltaTime || 0), 0) /
            conversionFlowData.length
          : 0,
      slowestModule: moduleFrequency[0]
        ? {
            name: moduleFrequency[0][0],
            calls: moduleFrequency[0][1],
          }
        : null,
      highActivityModules: moduleFrequency.filter(
        ([name, count]) => count > 10
      ),
    };

    // Module interaction patterns
    const moduleFlow = conversionFlowData
      .map((event) => event.module)
      .filter(
        (module, index, array) => index === 0 || array[index - 1] !== module
      );

    return {
      topModules: moduleFrequency,
      decisionPointCount: decisionPoints.length,
      decisionPoints: decisionPoints.slice(0, 5), // Top 5 decision points
      errorEventCount: errorEvents,
      totalEvents: conversionFlowData.length,
      performanceMetrics,
      moduleFlow: moduleFlow.slice(0, 10), // First 10 modules in flow
      potentialBottlenecks: performanceMetrics.highActivityModules.map(
        ([name]) => name
      ),
    };
  }

  // ===========================================================================================
  // LOGGING FUNCTIONS
  // ===========================================================================================

  function shouldLog(level, moduleName = null) {
    // Global overrides
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;

    // Check module-specific configuration
    if (moduleName && moduleConfigs[moduleName.toUpperCase()]) {
      const moduleConfig = moduleConfigs[moduleName.toUpperCase()];
      if (!moduleConfig.enabled) return false;
      return level <= moduleConfig.level;
    }

    // Fall back to default level
    return level <= DEFAULT_LOG_LEVEL;
  }

  function createModuleLogger(moduleName, customConfig = {}) {
    const moduleKey = moduleName.toUpperCase();
    const prefix = `[${moduleKey}]`;

    // Ensure module config exists and merge custom config
    if (!moduleConfigs[moduleKey]) {
      moduleConfigs[moduleKey] = {
        level: DEFAULT_LOG_LEVEL,
        enabled: true,
      };
    }

    // Apply custom configuration
    if (customConfig.level !== undefined) {
      moduleConfigs[moduleKey].level = customConfig.level;
    }
    if (customConfig.enabled !== undefined) {
      moduleConfigs[moduleKey].enabled = customConfig.enabled;
    }

    // Capture the module key in closure scope
    const capturedModuleKey = moduleKey;

    return {
      logError(message, ...args) {
        if (shouldLog(LOG_LEVELS.ERROR, moduleName)) {
          console.error(prefix, message, ...args);
          if (tracingEnabled) {
            recordFlowEvent(capturedModuleKey, "error", { message, args });
          }
        }
      },

      logWarn(message, ...args) {
        if (shouldLog(LOG_LEVELS.WARN, moduleName)) {
          console.warn(prefix, message, ...args);
          if (tracingEnabled) {
            recordFlowEvent(capturedModuleKey, "warning", { message, args });
          }
        }
      },

      logInfo(message, ...args) {
        if (shouldLog(LOG_LEVELS.INFO, moduleName)) {
          console.log(prefix, message, ...args);
          if (tracingEnabled) {
            recordFlowEvent(capturedModuleKey, "info", { message, args });
          }
        }
      },

      logDebug(message, ...args) {
        if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(prefix, message, ...args);
          if (tracingEnabled) {
            recordFlowEvent(capturedModuleKey, "debug", { message, args });
          }
        }
      },

      // NEW: Enhanced tracing level
      logTrace(message, ...args) {
        if (shouldLog(LOG_LEVELS.TRACE, moduleName)) {
          console.log(prefix, `[TRACE]`, message, ...args);
          if (tracingEnabled) {
            recordFlowEvent(capturedModuleKey, "trace", { message, args });
          }
        }
      },

      // NEW: Enhanced tracing methods for conversion flow analysis
      logDecision(decision, data = {}) {
        if (tracingEnabled) {
          console.log(prefix, `[DECISION]`, decision, data);
          recordFlowEvent(capturedModuleKey, "decision", { decision, ...data });
        } else if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(prefix, `[DECISION]`, decision, data);
        }
      },

      logPerformance(operation, duration, data = {}) {
        if (tracingEnabled) {
          console.log(
            prefix,
            `[PERFORMANCE]`,
            `${operation}: ${duration}ms`,
            data
          );
          recordFlowEvent(capturedModuleKey, "performance", {
            operation,
            duration,
            ...data,
          });
        } else if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(
            prefix,
            `[PERFORMANCE]`,
            `${operation}: ${duration}ms`,
            data
          );
        }
      },

      logFlowStart(operation, data = {}) {
        if (tracingEnabled) {
          console.log(prefix, `[FLOW_START]`, operation, data);
          recordFlowEvent(capturedModuleKey, "flow_start", {
            operation,
            ...data,
          });
        } else if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(prefix, `[FLOW_START]`, operation, data);
        }
      },

      logFlowEnd(operation, data = {}) {
        if (tracingEnabled) {
          console.log(prefix, `[FLOW_END]`, operation, data);
          recordFlowEvent(capturedModuleKey, "flow_end", {
            operation,
            ...data,
          });
        } else if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(prefix, `[FLOW_END]`, operation, data);
        }
      },

      // NEW: Module interaction tracking
      logModuleCall(targetModule, operation, data = {}) {
        if (tracingEnabled) {
          console.log(
            prefix,
            `[MODULE_CALL]`,
            `→ ${targetModule}: ${operation}`,
            data
          );
          recordFlowEvent(capturedModuleKey, "module_call", {
            targetModule,
            operation,
            ...data,
          });
        } else if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(
            prefix,
            `[MODULE_CALL]`,
            `→ ${targetModule}: ${operation}`,
            data
          );
        }
      },

      logDelegation(targetModule, method, data = {}) {
        if (tracingEnabled) {
          console.log(
            prefix,
            `[DELEGATION]`,
            `→ ${targetModule}.${method}()`,
            data
          );
          recordFlowEvent(capturedModuleKey, "delegation", {
            targetModule,
            method,
            ...data,
          });
        } else if (shouldLog(LOG_LEVELS.DEBUG, moduleName)) {
          console.log(
            prefix,
            `[DELEGATION]`,
            `→ ${targetModule}.${method}()`,
            data
          );
        }
      },

      // Existing module-specific configuration methods (preserved)
      setLevel(level) {
        if (!moduleConfigs[capturedModuleKey]) {
          moduleConfigs[capturedModuleKey] = { level: level, enabled: true };
        } else {
          moduleConfigs[capturedModuleKey].level = level;
        }
      },

      getLevel() {
        const config = moduleConfigs[capturedModuleKey];
        return config?.level !== undefined ? config.level : DEFAULT_LOG_LEVEL;
      },

      setEnabled(enabled) {
        if (!moduleConfigs[capturedModuleKey]) {
          moduleConfigs[capturedModuleKey] = {
            level: DEFAULT_LOG_LEVEL,
            enabled: enabled,
          };
        } else {
          moduleConfigs[capturedModuleKey].enabled = enabled;
        }
      },

      isEnabled() {
        return moduleConfigs[capturedModuleKey]?.enabled !== false;
      },

      // NEW: Tracing-specific configuration
      enableTracing() {
        this.setLevel(LOG_LEVELS.TRACE);
        this.setEnabled(true);
      },

      getTracingCapabilities() {
        return {
          hasTrace: true,
          hasDecisionLogging: true,
          hasPerformanceLogging: true,
          hasFlowLogging: true,
          hasModuleCallLogging: true,
        };
      },
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testLoggingSystem() {
    const logger = createModuleLogger("TEST");

    const tests = {
      moduleLoggerCreation: () => !!logger,
      hasAllMethods: () =>
        logger.logError && logger.logWarn && logger.logInfo && logger.logDebug,
      logLevelsExist: () =>
        typeof LOG_LEVELS.ERROR === "number" &&
        typeof LOG_LEVELS.WARN === "number" &&
        typeof LOG_LEVELS.INFO === "number" &&
        typeof LOG_LEVELS.DEBUG === "number",
      shouldLogFunction: () => typeof shouldLog === "function",
      moduleConfigExists: () => !!moduleConfigs,
      perModuleLogging: () => {
        const testLogger = createModuleLogger("TESTMODULE", {
          level: LOG_LEVELS.ERROR,
        });

        const configuredLevel = testLogger.getLevel();

        return configuredLevel === LOG_LEVELS.ERROR;
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          console.log(`  ✅ ${testName}: PASSED`);
        } else {
          console.error(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        console.error(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    console.log(`📊 Logging System: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Logger creation
    createModuleLogger,

    // Direct access to logging functions (for backwards compatibility)
    LOG_LEVELS,
    shouldLog,

    // Per-module configuration
    setModuleLevel(moduleName, level) {
      const moduleKey = moduleName.toUpperCase();
      if (!moduleConfigs[moduleKey]) {
        moduleConfigs[moduleKey] = { level: level, enabled: true };
      } else {
        moduleConfigs[moduleKey].level = level;
      }
    },

    setModuleEnabled(moduleName, enabled) {
      const moduleKey = moduleName.toUpperCase();
      if (!moduleConfigs[moduleKey]) {
        moduleConfigs[moduleKey] = {
          level: DEFAULT_LOG_LEVEL,
          enabled: enabled,
        };
      } else {
        moduleConfigs[moduleKey].enabled = enabled;
      }
    },

    getModuleConfig(moduleName) {
      return (
        moduleConfigs[moduleName.toUpperCase()] || {
          level: DEFAULT_LOG_LEVEL,
          enabled: true,
        }
      );
    },

    getAllModuleConfigs() {
      return { ...moduleConfigs };
    },

    // Global logging controls (enhanced)
    setGlobalLogLevel: (level) => {
      DEFAULT_LOG_LEVEL = level;
    },

    enableAllLogging: () => {
      ENABLE_ALL_LOGGING = true;
    },

    disableAllLogging: () => {
      DISABLE_ALL_LOGGING = true;
    },

    // Enhanced conversion flow tracing controls
    enableConversionTracing,
    disableConversionTracing,

    getTracingStatus: () => ({
      enabled: tracingEnabled,
      session: tracingSession,
      scenario: currentScenario,
      moduleCallCounts: { ...moduleCallCounts },
      totalEvents: conversionFlowData.length,
    }),

    // Quick tracing scenarios for console use
    traceSimpleEquation: () => enableConversionTracing("simple_equation"),
    traceComplexDocument: () => enableConversionTracing("complex_document"),
    traceErrorRecovery: () => enableConversionTracing("error_recovery"),
    tracePerformanceOptimization: () =>
      enableConversionTracing("performance_optimization"),

    // Analysis helpers
    generateFlowAnalysis: () => {
      if (!tracingEnabled) {
        console.warn(
          "Tracing not enabled. Enable tracing first to collect flow data."
        );
        return null;
      }
      return {
        moduleFrequency: moduleCallCounts,
        flowEvents: conversionFlowData,
        summary: generateTracingSummary(),
      };
    },

    // Performance optimization helpers
    getPerformanceInsights: () => {
      // First check if we have active tracing data
      let dataSource = null;
      let sourceType = null;

      if (
        conversionFlowData.length > 0 ||
        Object.keys(moduleCallCounts).length > 0
      ) {
        // Active tracing session data
        dataSource = {
          flowData: conversionFlowData,
          moduleCallCounts: moduleCallCounts,
        };
        sourceType = "active_session";
      } else if (window.lastTracingResults) {
        // Use stored session data
        dataSource = {
          flowData: window.lastTracingResults.flowData || [],
          moduleCallCounts: window.lastTracingResults.moduleCallCounts || {},
        };
        sourceType = "stored_session";
      } else {
        return {
          error: "No tracing data available - run a tracing session first",
        };
      }

      const insights = [];

      // Analyze module call counts
      const sortedModules = Object.entries(dataSource.moduleCallCounts).sort(
        (a, b) => b[1] - a[1]
      );

      // Check for high-activity modules
      const highActivityModules = sortedModules.filter(
        ([name, count]) => count > 10
      );
      highActivityModules.forEach(([name, count]) => {
        insights.push(
          `High activity in ${name} (${count} calls) - consider optimization`
        );
      });

      // Check for complex processing patterns
      const chunkingCalls = dataSource.moduleCallCounts.CHUNKED_PROCESSING || 0;
      if (chunkingCalls > 15) {
        insights.push(
          `Frequent chunked processing detected (${chunkingCalls} calls) - documents may be too complex`
        );
      }

      // Check for module imbalance
      const totalCalls = Object.values(dataSource.moduleCallCounts).reduce(
        (a, b) => a + b,
        0
      );
      if (
        sortedModules[0] &&
        totalCalls > 0 &&
        sortedModules[0][1] / totalCalls > 0.4
      ) {
        insights.push(
          `Module imbalance: ${sortedModules[0][0]} accounts for ${Math.round(
            (sortedModules[0][1] / totalCalls) * 100
          )}% of calls`
        );
      }

      // Performance metrics
      let performanceMetrics = {};
      if (dataSource.flowData.length > 0) {
        const timestamps = dataSource.flowData
          .map((e) => e.timestamp)
          .filter((t) => t != null);
        performanceMetrics = {
          totalEvents: dataSource.flowData.length,
          duration:
            timestamps.length > 0
              ? Math.max(...timestamps) - Math.min(...timestamps)
              : 0,
          eventsPerSecond:
            timestamps.length > 1
              ? (
                  dataSource.flowData.length /
                  ((Math.max(...timestamps) - Math.min(...timestamps)) / 1000)
                ).toFixed(1)
              : 0,
        };

        if (performanceMetrics.duration > 10000) {
          // > 10 seconds
          insights.push(
            `Long processing time: ${(
              performanceMetrics.duration / 1000
            ).toFixed(1)} seconds`
          );
        }
      }

      return {
        dataSource: sourceType,
        sessionActive: tracingEnabled,
        sessionId: window.lastTracingResults?.sessionId || "current",
        scenario: window.lastTracingResults?.scenario || "active",
        totalEvents: dataSource.flowData.length,
        insights,
        performanceMetrics,
        topModules: sortedModules.slice(0, 5), // Top 5 modules
        recommendations:
          insights.length > 0
            ? [
                "Consider document complexity thresholds",
                "Review chunked processing efficiency",
                "Optimize high-activity modules",
                "Balance module workload distribution",
              ]
            : ["System performing within normal parameters"],
      };
    },

    // Helper to analyze the last tracing session results
    analyzeLastSession: () => {
      if (!window.lastTracingResults) {
        return { error: "No last tracing results available" };
      }

      const results = window.lastTracingResults;
      const insights = [];

      // Analyze the stored session data
      if (results.moduleCallCounts) {
        const sortedModules = Object.entries(results.moduleCallCounts).sort(
          (a, b) => b[1] - a[1]
        );

        if (sortedModules[0] && sortedModules[0][1] > 15) {
          insights.push(
            `High activity module: ${sortedModules[0][0]} (${sortedModules[0][1]} calls)`
          );
        }

        const totalCalls = Object.values(results.moduleCallCounts).reduce(
          (a, b) => a + b,
          0
        );
        if (sortedModules[0] && sortedModules[0][1] / totalCalls > 0.4) {
          insights.push(
            `Module concentration: ${
              sortedModules[0][0]
            } dominates with ${Math.round(
              (sortedModules[0][1] / totalCalls) * 100
            )}%`
          );
        }
      }

      return {
        sessionId: results.sessionId,
        scenario: results.scenario,
        duration: results.duration,
        eventCount: results.flowData?.length || 0,
        insights,
        moduleBreakdown: results.moduleCallCounts,
        recommendations:
          insights.length > 0
            ? [
                "Review high-activity modules",
                "Consider load balancing optimizations",
              ]
            : ["Session completed within normal parameters"],
      };
    },

    // Advanced tracing controls
    clearTracingData: () => {
      moduleCallCounts = {};
      conversionFlowData = [];
      console.log("Tracing data cleared");
    },

    exportTracingData: () => {
      const data = {
        session: tracingSession,
        scenario: currentScenario,
        moduleCallCounts,
        flowEvents: conversionFlowData,
        timestamp: Date.now(),
      };
      console.log("Tracing data export:", data);
      return data;
    },

    // Testing
    testLoggingSystem,

    // Configuration access (read-only)
    getConfiguration() {
      return {
        defaultLevel: DEFAULT_LOG_LEVEL,
        enableAll: ENABLE_ALL_LOGGING,
        disableAll: DISABLE_ALL_LOGGING,
        levels: { ...LOG_LEVELS },
        tracing: {
          enabled: tracingEnabled,
          session: tracingSession,
          scenario: currentScenario,
        },
      };
    },
  };
})();

// Make globally available
window.LoggingSystem = LoggingSystem;

// Export for modules that prefer explicit exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = LoggingSystem;
}
