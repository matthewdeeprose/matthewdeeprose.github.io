/**
 * Chart Statistics Module
 * Provides advanced statistical analysis functions for chart data
 *
 * This module is designed to be performant with large datasets by using
 * progressive enhancement and caching strategies.
 */

const ChartStatistics = (function () {
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

  // Cache for computed statistics to avoid recalculation
  const statsCache = new Map();

  logInfo("Chart Statistics module initialised with caching enabled");

  /**
   * Generate a cache key for the dataset
   * @param {Array} data - The dataset to analyze
   * @returns {string} A unique cache key
   */
  function generateCacheKey(data) {
    try {
      // Simple hash function for array
      const cacheKey = data
        .reduce((acc, val, idx) => acc + val * (idx + 1), 0)
        .toString();
      logDebug("Generated cache key for dataset:", cacheKey);
      return cacheKey;
    } catch (error) {
      logError("Error generating cache key:", error);
      return "invalid-key";
    }
  }

  /**
   * Calculate advanced statistics for a dataset
   * @param {Array} data - Array of numeric values
   * @returns {Object} Object containing advanced statistical measures
   */
  function calculateAdvancedStats(data) {
    logDebug(
      "Starting advanced statistics calculation for dataset of length:",
      data?.length
    );

    if (!Array.isArray(data) || data.length === 0) {
      logWarn(
        "Invalid dataset provided for advanced statistics calculation - must be non-empty array"
      );
      return null;
    }

    const cacheKey = generateCacheKey(data);

    // Check cache first
    if (statsCache.has(cacheKey)) {
      logDebug("Returning cached statistics for dataset");
      return statsCache.get(cacheKey);
    }

    logInfo("Computing advanced statistics for new dataset");

    try {
      // Sort data for percentile calculations
      const sortedData = [...data].sort((a, b) => a - b);
      const n = data.length;

      // Basic statistics
      const sum = data.reduce((acc, val) => acc + val, 0);
      const mean = sum / n;

      logDebug("Basic calculations complete - mean:", mean);

      // Median
      const median =
        n % 2 === 0
          ? (sortedData[n / 2 - 1] + sortedData[n / 2]) / 2
          : sortedData[Math.floor(n / 2)];

      // Mode calculation (most frequent value)
      const frequency = {};
      let mode = null;
      let maxFrequency = 0;

      data.forEach((value) => {
        frequency[value] = (frequency[value] || 0) + 1;
        if (frequency[value] > maxFrequency) {
          maxFrequency = frequency[value];
          mode = value;
        }
      });

      logDebug(
        "Central tendency calculations complete - median:",
        median,
        "mode:",
        mode
      );

      // Variance and standard deviation
      const squaredDiffs = data.map((value) => Math.pow(value - mean, 2));
      const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / n;
      const standardDeviation = Math.sqrt(variance);

      // Quartiles
      const q1 = sortedData[Math.floor(n * 0.25)];
      const q3 = sortedData[Math.floor(n * 0.75)];
      const iqr = q3 - q1;

      logDebug(
        "Variability measures complete - std dev:",
        standardDeviation,
        "IQR:",
        iqr
      );

      // Skewness calculation
      const cubeSum = data.reduce(
        (acc, val) => acc + Math.pow(val - mean, 3),
        0
      );
      const skewness = cubeSum / n / Math.pow(standardDeviation, 3);

      // Kurtosis calculation
      const fourthSum = data.reduce(
        (acc, val) => acc + Math.pow(val - mean, 4),
        0
      );
      const kurtosis = fourthSum / n / Math.pow(standardDeviation, 4) - 3;

      logDebug(
        "Distribution shape calculations complete - skewness:",
        skewness,
        "kurtosis:",
        kurtosis
      );

      // Identify outliers using IQR method
      const outliers = data.filter(
        (value) => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr
      );

      if (outliers.length > 0) {
        logInfo(`Detected ${outliers.length} outliers in dataset`);
        logDebug("Outlier values:", outliers);
      }

      // Calculate percentiles
      const percentiles = {
        p10: sortedData[Math.floor(n * 0.1)],
        p90: sortedData[Math.floor(n * 0.9)],
      };

      // Confidence interval for the mean (95%)
      const standardError = standardDeviation / Math.sqrt(n);
      const marginOfError = 1.96 * standardError; // 95% confidence
      const confidenceInterval = {
        lower: mean - marginOfError,
        upper: mean + marginOfError,
      };

      const result = {
        mean,
        median,
        mode,
        standardDeviation,
        variance,
        skewness,
        kurtosis,
        quartiles: { q1, q3 },
        iqr,
        outliers,
        percentiles,
        confidenceInterval,
        min: sortedData[0],
        max: sortedData[n - 1],
        range: sortedData[n - 1] - sortedData[0],
      };

      // Cache the result
      statsCache.set(cacheKey, result);
      logInfo("Advanced statistics calculation completed and cached");
      logDebug("Statistical summary:", {
        mean: result.mean,
        median: result.median,
        standardDeviation: result.standardDeviation,
      });

      return result;
    } catch (error) {
      logError("Error calculating advanced statistics:", error);
      return null;
    }
  }

  /**
   * Calculate correlation between two datasets
   * @param {Array} xData - First dataset
   * @param {Array} yData - Second dataset
   * @returns {Object} Correlation coefficient and interpretation
   */
  function calculateCorrelation(xData, yData) {
    logDebug("Starting correlation calculation between datasets");

    if (
      !Array.isArray(xData) ||
      !Array.isArray(yData) ||
      xData.length !== yData.length ||
      xData.length === 0
    ) {
      logWarn(
        "Invalid datasets for correlation calculation - arrays must be same length and non-empty"
      );
      return null;
    }

    logInfo(`Calculating correlation for ${xData.length} data points`);

    try {
      const n = xData.length;
      const xMean = xData.reduce((acc, val) => acc + val, 0) / n;
      const yMean = yData.reduce((acc, val) => acc + val, 0) / n;

      let numerator = 0;
      let xDenominator = 0;
      let yDenominator = 0;

      for (let i = 0; i < n; i++) {
        const xDiff = xData[i] - xMean;
        const yDiff = yData[i] - yMean;

        numerator += xDiff * yDiff;
        xDenominator += xDiff * xDiff;
        yDenominator += yDiff * yDiff;
      }

      const correlation = numerator / Math.sqrt(xDenominator * yDenominator);

      logDebug("Correlation coefficient calculated:", correlation);

      // Interpret correlation strength
      let interpretation;
      const absCorrelation = Math.abs(correlation);

      if (absCorrelation > 0.9) interpretation = "Very strong";
      else if (absCorrelation > 0.7) interpretation = "Strong";
      else if (absCorrelation > 0.5) interpretation = "Moderate";
      else if (absCorrelation > 0.3) interpretation = "Weak";
      else interpretation = "Very weak or none";

      const direction = correlation > 0 ? "positive" : "negative";

      const result = {
        coefficient: correlation,
        interpretation,
        direction,
      };

      logInfo(
        `Correlation analysis complete: ${interpretation} ${direction} correlation (${correlation.toFixed(
          3
        )})`
      );

      return result;
    } catch (error) {
      logError("Error calculating correlation:", error);
      return null;
    }
  }

  /**
   * Calculate regression line coefficients
   * @param {Array} xData - Independent variable data
   * @param {Array} yData - Dependent variable data
   * @returns {Object} Regression coefficients and R-squared
   */
  function calculateRegression(xData, yData) {
    logDebug("Starting regression analysis");

    if (
      !Array.isArray(xData) ||
      !Array.isArray(yData) ||
      xData.length !== yData.length ||
      xData.length === 0
    ) {
      logWarn(
        "Invalid datasets for regression calculation - arrays must be same length and non-empty"
      );
      return null;
    }

    logInfo(`Calculating linear regression for ${xData.length} data points`);

    try {
      const n = xData.length;
      const xMean = xData.reduce((acc, val) => acc + val, 0) / n;
      const yMean = yData.reduce((acc, val) => acc + val, 0) / n;

      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i < n; i++) {
        const xDiff = xData[i] - xMean;
        const yDiff = yData[i] - yMean;

        numerator += xDiff * yDiff;
        denominator += xDiff * xDiff;
      }

      const slope = numerator / denominator;
      const intercept = yMean - slope * xMean;

      logDebug(
        "Regression coefficients calculated - slope:",
        slope,
        "intercept:",
        intercept
      );

      // Calculate R-squared
      let totalSS = 0;
      let residualSS = 0;

      for (let i = 0; i < n; i++) {
        const predicted = slope * xData[i] + intercept;
        totalSS += Math.pow(yData[i] - yMean, 2);
        residualSS += Math.pow(yData[i] - predicted, 2);
      }

      const rSquared = 1 - residualSS / totalSS;

      const result = {
        slope,
        intercept,
        rSquared,
        equation: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
      };

      logInfo(
        `Regression analysis complete: ${
          result.equation
        } (R² = ${rSquared.toFixed(3)})`
      );

      if (rSquared < 0.3) {
        logWarn(
          "Low R-squared value indicates weak linear relationship between variables"
        );
      }

      return result;
    } catch (error) {
      logError("Error calculating regression:", error);
      return null;
    }
  }

  /**
   * Generate statistical insights from the advanced calculations
   * @param {Object} stats - Advanced statistics object
   * @returns {Array} Array of narrative insights
   */
  function generateStatisticalInsights(stats) {
    logDebug("Generating statistical insights from computed statistics");

    if (!stats) {
      logWarn("No statistics provided for insight generation");
      return [];
    }

    try {
      const insights = [];

      // Distribution shape insight
      if (Math.abs(stats.skewness) < 0.5) {
        insights.push("The data shows a roughly symmetric distribution.");
      } else if (stats.skewness > 0.5) {
        insights.push(
          "The data is positively skewed (right-tailed), with more values clustered toward the lower end."
        );
      } else {
        insights.push(
          "The data is negatively skewed (left-tailed), with more values clustered toward the higher end."
        );
      }

      // Variability insight
      const coefficientOfVariation =
        (stats.standardDeviation / stats.mean) * 100;
      if (coefficientOfVariation < 10) {
        insights.push(
          "The data exhibits low variability, with values tightly clustered around the mean."
        );
      } else if (coefficientOfVariation < 30) {
        insights.push("The data shows moderate variability around the mean.");
      } else {
        insights.push(
          "The data displays high variability, with values widely spread from the mean."
        );
      }

      // Outlier insight
      if (stats.outliers.length > 0) {
        const outlierPercent = (stats.outliers.length / stats.dataCount) * 100;
        insights.push(
          `There are ${
            stats.outliers.length
          } outliers (${outlierPercent.toFixed(
            1
          )}% of the data), which may represent exceptional cases or data anomalies.`
        );
      } else {
        insights.push("No significant outliers were detected in the dataset.");
      }

      // Clustering insight (if median and mean differ significantly)
      const meanMedianDiff = Math.abs(stats.mean - stats.median) / stats.mean;
      if (meanMedianDiff > 0.1) {
        insights.push(
          "The difference between mean and median suggests potential data clustering or asymmetry."
        );
      }

      logInfo(`Generated ${insights.length} statistical insights`);
      logDebug("Insights generated:", insights);

      return insights;
    } catch (error) {
      logError("Error generating statistical insights:", error);
      return [];
    }
  }

  /**
   * Clear the statistics cache
   */
  function clearCache() {
    try {
      const cacheSize = statsCache.size;
      statsCache.clear();
      logInfo(`Statistics cache cleared - removed ${cacheSize} cached entries`);
    } catch (error) {
      logError("Error clearing statistics cache:", error);
    }
  }

  // Initialisation complete
  logInfo("Chart Statistics module fully initialised and ready for use");

  // Public API
  return {
    calculateAdvancedStats,
    calculateCorrelation,
    calculateRegression,
    generateStatisticalInsights,
    clearCache,
  };
})();

// Export for use in chart-accessibility.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartStatistics;
} else {
  window.ChartStatistics = ChartStatistics;
}
