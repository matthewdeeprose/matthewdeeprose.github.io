// template-system.js
// Backward Compatibility Wrapper - Re-exports all classes from split modules
// This file maintains the original TemplateSystem API while delegating to modular implementation

const TemplateSystem = (function () {
  "use strict";

  // ===========================================================================================
  // IMPORT DEPENDENCIES FROM SPLIT MODULES
  // ===========================================================================================

  // Import from extracted modules
  const GlobalTemplateCache = window.TemplateCache.GlobalTemplateCache;
  const EnhancedTemplateEngine = window.TemplateEngine.EnhancedTemplateEngine;
  const EnhancedHTMLGenerator = window.TemplateGenerator.EnhancedHTMLGenerator;

  // ===========================================================================================
  // LOGGING CONFIGURATION (Keep minimal logging for this wrapper)
  // ===========================================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error("[TemplateSystem]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TemplateSystem]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TemplateSystem]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TemplateSystem]", message, ...args);
  }

  // ===========================================================================================
  // PRIVATE HELPER FUNCTIONS
  // ===========================================================================================

  /**
   * Pre-warm global template cache if not already initialised.
   *
   * Uses fire-and-forget pattern to avoid blocking factory functions.
   * Only triggers loading if cache is completely uninitialized (modern state machine).
   *
   * This function is called by factory methods (createGenerator, createEngine)
   * to ensure templates are loading in the background without blocking
   * the instantiation of new engine or generator instances.
   *
   * State Machine Behaviour:
   * - 'uninitialized': Triggers template loading (fire-and-forget)
   * - 'loading': Does nothing (already loading)
   * - 'loaded': Does nothing (already loaded)
   * - 'failed': Does nothing (user must manually retry)
   *
   * This replaces the previous pattern that checked two boolean flags
   * (isLoaded && loadAttempted), which was error-prone and used deprecated
   * state tracking. The modern state machine provides more reliable state
   * management with clear transitions.
   *
   * @private
   * @returns {void}
   */
  function prewarmGlobalCache() {
    // Only trigger loading if cache is completely uninitialized
    if (GlobalTemplateCache.state === "uninitialized") {
      GlobalTemplateCache.ensureTemplatesLoaded().catch((err) =>
        logWarn("Background template loading failed:", err.message)
      );
    }
  }

  // ===========================================================================================
  // PERFORMANCE MONITORING (Keep for backward compatibility)
  // ===========================================================================================

  const performanceMetrics = {
    renderCount: 0,
    totalRenderTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  function measurePerformance(fn, name) {
    return function (...args) {
      const start = window.performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        const duration = window.performance.now() - start;
        performanceMetrics.totalRenderTime += duration;
        performanceMetrics.renderCount++;
        if (duration > 10) {
          logWarn(
            `Slow template render for "${name}": ${duration.toFixed(2)}ms`
          );
        }
      }
    };
  }
  // ===========================================================================================
  // PUBLIC API - BACKWARD COMPATIBILITY WRAPPER
  // ===========================================================================================

  const TemplateSystem = {
    // ===========================================================================================
    // CLASS EXPORTS (Re-export from split modules)
    // ===========================================================================================

    EnhancedHTMLGenerator: EnhancedHTMLGenerator,
    EnhancedTemplateEngine: EnhancedTemplateEngine,
    GlobalTemplateCache: GlobalTemplateCache, // ⚠️ CRITICAL: Re-export for backward compatibility

    // ===========================================================================================
    // FACTORY FUNCTIONS (Delegate to split modules)
    // ===========================================================================================

    /**
     * Create EnhancedHTMLGenerator instance (synchronous).
     *
     * Auto-triggers template loading in background if not already loaded.
     * First call may use inline fallbacks, subsequent calls use loaded templates.
     *
     * Uses modern state machine (checks 'uninitialized' state) rather than
     * deprecated boolean flags for more reliable template loading coordination.
     * The prewarmGlobalCache() function handles all pre-warming logic in one place.
     *
     * @returns {EnhancedHTMLGenerator} Generator instance
     *
     * @example
     * const generator = TemplateSystem.createGenerator();
     * const html = generator.generateReadingToolsSection();
     */
    createGenerator() {
      prewarmGlobalCache();
      return new EnhancedHTMLGenerator();
    },

    /**
     * Create EnhancedTemplateEngine instance (synchronous).
     *
     * Auto-triggers template loading in background if not already loaded.
     * First call may use inline fallbacks, subsequent calls use loaded templates.
     *
     * Uses modern state machine (checks 'uninitialized' state) rather than
     * deprecated boolean flags for more reliable template loading coordination.
     * The prewarmGlobalCache() function handles all pre-warming logic in one place.
     *
     * @returns {EnhancedTemplateEngine} Engine instance
     *
     * @example
     * const engine = TemplateSystem.createEngine();
     * const html = engine.render('readingToolsSection', {});
     */
    createEngine() {
      prewarmGlobalCache();
      return new EnhancedTemplateEngine();
    },

    // ===========================================================================================
    // GLOBAL CACHE METHODS (Delegate to GlobalTemplateCache)
    // ===========================================================================================

    getGlobalCacheStatus() {
      return {
        isLoaded: GlobalTemplateCache.isLoaded,
        state: GlobalTemplateCache.state,
        loadAttempted: GlobalTemplateCache.loadAttempted,
        templatesCount: GlobalTemplateCache.templates.size,
        templateNames: Array.from(GlobalTemplateCache.templates.keys()),
      };
    },

    async ensureTemplatesLoaded() {
      return await GlobalTemplateCache.ensureTemplatesLoaded();
    },

    /**
     * Clear all template caches - Global cache and performance metrics.
     *
     * This static method provides a complete system reset by clearing:
     * - Global template cache (all loaded templates)
     * - Performance metrics (render counts, times, cache hits)
     * - Compiled template caches
     *
     * Use cases:
     * - Testing and development (reload templates without page refresh)
     * - Performance benchmarking (measure cold-start performance)
     * - Memory management (free resources when no longer needed)
     *
     * @returns {void}
     *
     * @example
     * TemplateSystem.clearAllCaches();
     * // All caches cleared, next template use will reload from files
     */
    clearAllCaches() {
      logInfo("🧹 Clearing all template system caches...");

      // Clear global template cache
      GlobalTemplateCache.clearCache();

      // Reset performance metrics
      performanceMetrics.cacheHits = 0;
      performanceMetrics.cacheMisses = 0;
      performanceMetrics.totalRenderTime = 0;
      performanceMetrics.renderCount = 0;

      logInfo("✅ All template caches cleared");
    },
    // ===========================================================================================
    // VALIDATION & TESTING METHODS
    // ===========================================================================================

    /**
     * Validate template system - Test framework compatibility wrapper.
     * Delegates to: EnhancedTemplateEngine.test() for actual validation
     */
    validateTemplateSystem() {
      logDebug("🧪 Running template system validation...");

      try {
        // Engine automatically initialises from global cache
        // No need to manually check or copy templates
        const engine = new EnhancedTemplateEngine();

        // Run validation tests (engine handles template loading internally)
        const testResults = engine.test();

        const validation = {
          success: testResults.success,
          valid: testResults.success,
          errors: testResults.success
            ? []
            : testResults.results
                .filter((r) => !r.passed)
                .map((r) => r.error || `Test "${r.name}" failed`),
          warnings: [],
          templatesLoaded: engine.templates.size,
          performanceMetrics: engine.getPerformanceReport(),
          allPassed: testResults.success,
          passed: testResults.passed || (testResults.success ? 1 : 0),
          total: testResults.total || 1,
        };

        logInfo(
          `✅ Template validation complete: ${
            validation.success ? "PASSED" : "FAILED"
          } (${validation.passed}/${validation.total})`
        );
        return validation;
      } catch (error) {
        logError("❌ Template validation failed:", error);
        return {
          success: false,
          valid: false,
          errors: [error.message],
          warnings: ["Template validation encountered an error"],
          allPassed: false,
          passed: 0,
          total: 1,
        };
      }
    },
    /**
     * Measure template rendering performance - Test framework compatibility wrapper.
     * Delegates to: EnhancedTemplateEngine.getPerformanceReport() for metrics
     */ measureTemplatePerformance() {
      logInfo("📊 Measuring template performance...");

      try {
        const engine = new EnhancedTemplateEngine();
        const perfReport = engine.getPerformanceReport();

        // Parse average render time to get numeric duration
        const avgTimeStr = perfReport.averageRenderTime || "0ms";
        const duration = parseFloat(avgTimeStr.replace("ms", "")) || 0;

        const performanceData = {
          duration: duration,
          efficient: duration < 5.0,
          totalRenders: perfReport.totalRenders || 0,
          averageRenderTime: duration,
          cacheHitRate: parseFloat(
            (perfReport.cacheHitRate || "0%").replace("%", "")
          ),
          templatesLoaded: perfReport.templatesLoaded || 0,
          report: perfReport,
        };

        logInfo(
          `✅ Performance measurement complete: ${duration.toFixed(
            2
          )}ms average`
        );
        return performanceData;
      } catch (error) {
        logError("❌ Performance measurement failed:", error);
        return {
          duration: 999,
          efficient: false,
          error: error.message,
        };
      }
    },

    /**
     * Run self-test suite - Delegates to engine test method
     */
    test() {
      logInfo("🧪 Running TemplateSystem self-tests...");
      const engine = new EnhancedTemplateEngine();
      return engine.test();
    },

    /**
     * Get performance report - Delegates to engine
     */
    getPerformanceReport() {
      const engine = new EnhancedTemplateEngine();
      return engine.getPerformanceReport();
    },
  }; // Log successful loading
  logInfo(
    "✅ Enhanced Template System loaded successfully (modular architecture)"
  );
  logInfo(
    "💡 Commands: TemplateSystem.test() | TemplateSystem.getPerformanceReport()"
  );
  logInfo(
    "📦 Architecture: Cache (219 lines) + Engine (2,126 lines) + Generator (1,227 lines)"
  );

  return TemplateSystem;
})();

// Make globally available
window.TemplateSystem = TemplateSystem;

// Also export for ES6 module compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = TemplateSystem;
}
