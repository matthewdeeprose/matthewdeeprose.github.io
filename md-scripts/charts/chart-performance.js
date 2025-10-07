/**
 * Chart Performance Module
 * Provides performance optimization utilities for chart analysis
 *
 * This module implements caching, memoization, and progressive computation
 * to ensure efficient processing of large datasets.
 */

const ChartPerformance = (function () {
  // Logging configuration (inside IIFE scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // Configuration for performance thresholds
  const config = {
    maxSampleSize: 1000, // Maximum data points for full analysis
    memoizationCacheSize: 100, // Maximum entries in memoization cache
    batchSize: 100, // Size of batches for progressive computation
    analysisTimeout: 5000, // Maximum time for analysis in ms
  };

  // Memoization cache with LRU (Least Recently Used) strategy
  const memoizationCache = new Map();
  const cacheOrder = [];

  logInfo("Chart Performance module initialised with configuration:", config);

  /**
   * Memoize a function for performance optimization
   * @param {Function} fn - Function to memoize
   * @param {Function} keyGenerator - Function to generate cache key
   * @returns {Function} Memoized function
   */
  function memoize(fn, keyGenerator) {
    logDebug("Creating memoized version of function");

    return function (...args) {
      const key = keyGenerator(...args);

      // Check if result is in cache
      if (memoizationCache.has(key)) {
        logDebug("Cache hit for key:", key);
        // Move to end of order (most recently used)
        const index = cacheOrder.indexOf(key);
        if (index > -1) {
          cacheOrder.splice(index, 1);
          cacheOrder.push(key);
        }
        return memoizationCache.get(key);
      }

      logDebug("Cache miss for key, computing result:", key);

      // Compute result
      const result = fn(...args);

      // Add to cache
      memoizationCache.set(key, result);
      cacheOrder.push(key);

      // Enforce cache size limit
      if (cacheOrder.length > config.memoizationCacheSize) {
        const oldestKey = cacheOrder.shift();
        memoizationCache.delete(oldestKey);
        logDebug("Cache evicted oldest entry:", oldestKey);
      }

      logDebug("Result cached with key:", key);
      return result;
    };
  }

  /**
   * Sample a large dataset for efficient processing
   * @param {Array} data - Large dataset
   * @param {number} sampleSize - Desired sample size
   * @returns {Array} Sampled data
   */
  function sampleData(data, sampleSize = config.maxSampleSize) {
    if (!Array.isArray(data)) {
      logWarn("Data is not an array, returning original data");
      return data;
    }

    if (data.length <= sampleSize) {
      logDebug(
        `Data size (${data.length}) is within sample limit, returning original data`
      );
      return data;
    }

    logInfo(
      `Sampling data from ${data.length} points to ${sampleSize} points using reservoir sampling`
    );

    // Use reservoir sampling for uniform random sampling
    const result = [];
    for (let i = 0; i < sampleSize; i++) {
      result.push(data[i]);
    }

    for (let i = sampleSize; i < data.length; i++) {
      const j = Math.floor(Math.random() * (i + 1));
      if (j < sampleSize) {
        result[j] = data[i];
      }
    }

    logDebug("Data sampling completed successfully");
    return result;
  }

  /**
   * Process data in batches for progressive computation
   * @param {Array} data - Dataset to process
   * @param {Function} processFn - Function to process each batch
   * @param {Function} combineFn - Function to combine results
   * @returns {Promise} Promise resolving to final result
   */
  function processBatches(data, processFn, combineFn) {
    logInfo(
      `Starting batch processing for ${data.length} data points with batch size ${config.batchSize}`
    );

    return new Promise((resolve, reject) => {
      const results = [];
      let currentIndex = 0;
      const startTime = Date.now();

      function processNextBatch() {
        // Check for timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > config.analysisTimeout) {
          logError(
            `Analysis timeout exceeded: ${elapsed}ms > ${config.analysisTimeout}ms`
          );
          reject(new Error("Analysis timeout exceeded"));
          return;
        }

        const batchEnd = Math.min(currentIndex + config.batchSize, data.length);
        const batch = data.slice(currentIndex, batchEnd);

        logDebug(
          `Processing batch ${
            Math.floor(currentIndex / config.batchSize) + 1
          }: items ${currentIndex}-${batchEnd - 1}`
        );

        try {
          const result = processFn(batch);
          results.push(result);

          currentIndex = batchEnd;

          if (currentIndex >= data.length) {
            // All batches processed
            logInfo(
              `Batch processing completed successfully in ${
                Date.now() - startTime
              }ms`
            );
            const finalResult = combineFn(results);
            resolve(finalResult);
          } else {
            // Schedule next batch (allow UI updates)
            setTimeout(processNextBatch, 0);
          }
        } catch (error) {
          logError("Error processing batch:", error);
          reject(error);
        }
      }

      processNextBatch();
    });
  }

  /**
   * Perform progressive analysis with fallback
   * @param {Array} data - Dataset to analyze
   * @param {Function} fullAnalysis - Full analysis function
   * @param {Function} quickAnalysis - Quick/basic analysis function
   * @returns {Promise} Promise resolving to analysis result
   */
  function progressiveAnalysis(data, fullAnalysis, quickAnalysis) {
    logInfo(
      `Starting progressive analysis for dataset of ${data.length} points`
    );

    return new Promise((resolve, reject) => {
      // First try quick analysis for immediate feedback
      logDebug("Performing quick analysis for immediate feedback");
      let quickResult;

      try {
        quickResult = quickAnalysis(data);
        logDebug("Quick analysis completed successfully");
      } catch (error) {
        logError("Quick analysis failed:", error);
        reject(error);
        return;
      }

      // If data is small enough, perform full analysis synchronously
      if (data.length <= config.maxSampleSize) {
        logInfo("Dataset is small enough for synchronous full analysis");
        try {
          const fullResult = fullAnalysis(data);
          logInfo("Full analysis completed successfully");
          resolve({ ...quickResult, ...fullResult, analysisType: "full" });
        } catch (error) {
          logWarn(
            "Full analysis failed, falling back to quick analysis:",
            error
          );
          resolve({ ...quickResult, analysisType: "quick", error });
        }
        return;
      }

      // For large datasets, perform progressive analysis
      logInfo(
        "Dataset is large, performing progressive analysis on sampled data"
      );
      const sampledData = sampleData(data);
      const timeout = config.analysisTimeout;

      // Race between full analysis on sampled data and timeout
      Promise.race([
        new Promise((resolve) => {
          logDebug("Starting full analysis on sampled data");
          const result = fullAnalysis(sampledData);
          logInfo("Full analysis on sampled data completed");
          resolve({
            ...result,
            analysisType: "sampled",
            sampleSize: sampledData.length,
          });
        }),
        new Promise((_, reject) =>
          setTimeout(() => {
            logWarn(`Analysis timeout of ${timeout}ms reached`);
            reject("timeout");
          }, timeout)
        ),
      ])
        .then((fullResult) => {
          resolve({ ...quickResult, ...fullResult });
        })
        .catch(() => {
          // Fallback to quick analysis on timeout
          logWarn("Full analysis timed out, falling back to quick analysis");
          resolve({ ...quickResult, analysisType: "quick" });
        });
    });
  }

  /**
   * Calculate statistics incrementally for streaming data
   * @param {Object} currentStats - Current statistics state
   * @param {number} newValue - New data point
   * @returns {Object} Updated statistics
   */
  function incrementalStats(currentStats = {}, newValue) {
    logDebug("Updating incremental statistics with new value:", newValue);

    const count = (currentStats.count || 0) + 1;
    const sum = (currentStats.sum || 0) + newValue;
    const mean = sum / count;

    // Update min and max
    const min =
      currentStats.min === undefined
        ? newValue
        : Math.min(currentStats.min, newValue);
    const max =
      currentStats.max === undefined
        ? newValue
        : Math.max(currentStats.max, newValue);

    // Update variance using Welford's online algorithm
    let m2 = currentStats.m2 || 0;
    if (count > 1) {
      const delta = newValue - (currentStats.mean || 0);
      m2 += delta * (newValue - mean);
    }

    const variance = count > 1 ? m2 / (count - 1) : 0;
    const standardDeviation = Math.sqrt(variance);

    const updatedStats = {
      count,
      sum,
      mean,
      min,
      max,
      variance,
      standardDeviation,
      m2, // Store for future updates
    };

    logDebug("Incremental statistics updated:", updatedStats);
    return updatedStats;
  }

  /**
   * Create a debounced version of a function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay = 250) {
    logDebug(`Creating debounced function with ${delay}ms delay`);
    let timeoutId;

    return function (...args) {
      logDebug("Debounced function called, clearing previous timeout");
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logDebug("Debounced function executing after delay");
        fn.apply(this, args);
      }, delay);
    };
  }

  /**
   * Create a throttled version of a function
   * @param {Function} fn - Function to throttle
   * @param {number} limit - Minimum time between calls in ms
   * @returns {Function} Throttled function
   */
  function throttle(fn, limit = 250) {
    logDebug(`Creating throttled function with ${limit}ms limit`);
    let inThrottle;

    return function (...args) {
      if (!inThrottle) {
        logDebug("Throttled function executing");
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          logDebug("Throttle period ended");
          inThrottle = false;
        }, limit);
      } else {
        logDebug("Throttled function call ignored (still in throttle period)");
      }
    };
  }

  /**
   * Estimate computational complexity of an analysis
   * @param {Array} data - Dataset to analyze
   * @param {string} analysisType - Type of analysis
   * @returns {Object} Complexity estimate and recommendation
   */
  function estimateComplexity(data, analysisType) {
    const n = data.length;
    logDebug(
      `Estimating complexity for ${analysisType} analysis on ${n} data points`
    );

    const complexityMap = {
      basic: n, // O(n)
      statistics: n * Math.log(n), // O(n log n) for sorting
      correlation: n * n, // O(n²)
      trend: n * Math.log(n), // O(n log n)
      pattern: n * n, // O(n²) for pattern matching
    };

    const complexity = complexityMap[analysisType] || n;

    if (!complexityMap[analysisType]) {
      logWarn(
        `Unknown analysis type '${analysisType}', defaulting to O(n) complexity`
      );
    }

    // Recommend approach based on complexity
    let approach;
    if (complexity < 1000) {
      approach = "synchronous";
    } else if (complexity < 10000) {
      approach = "progressive";
    } else {
      approach = "sampled";
    }

    const estimate = {
      estimatedOperations: complexity,
      recommendedApproach: approach,
      estimatedTime: complexity * 0.001, // Rough estimate in ms
    };

    logInfo(`Complexity estimation completed:`, estimate);
    return estimate;
  }

  /**
   * Clear all caches
   */
  function clearAllCaches() {
    const cacheSize = memoizationCache.size;
    memoizationCache.clear();
    cacheOrder.length = 0;
    logInfo(`All caches cleared. Removed ${cacheSize} cached entries`);
  }

  logInfo("Chart Performance module initialisation completed");

  // Public API
  return {
    memoize,
    sampleData,
    processBatches,
    progressiveAnalysis,
    incrementalStats,
    debounce,
    throttle,
    estimateComplexity,
    clearAllCaches,
    config, // Expose config for customization
  };
})();

// Export for use in chart-accessibility.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartPerformance;
} else {
  window.ChartPerformance = ChartPerformance;
}
