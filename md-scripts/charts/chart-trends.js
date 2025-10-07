/**
 * Chart Trends Module
 * Provides advanced trend detection and analysis for chart data
 *
 * This module implements sophisticated trend analysis including seasonality detection,
 * pattern recognition, and advanced forecasting techniques.
 */

const ChartTrends = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ChartTrends ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ChartTrends WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ChartTrends INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ChartTrends DEBUG] ${message}`, ...args);
  }

  // Cache for expensive calculations
  const trendCache = new Map();

  logInfo("ChartTrends module initialised");

  /**
   * Generate cache key for trend analysis
   * @param {Array} data - Time series data
   * @param {string} analysisType - Type of analysis to perform
   * @returns {string} Cache key
   */
  function generateCacheKey(data, analysisType) {
    logDebug(
      `Generating cache key for analysis type: ${analysisType}, data length: ${data.length}`
    );
    return `${analysisType}-${data.join("_")}`;
  }

  /**
   * Detect trend direction and strength
   * @param {Array} data - Time series data
   * @returns {Object} Trend analysis results
   */
  function detectTrend(data) {
    logDebug("Starting trend detection analysis");

    if (!Array.isArray(data) || data.length < 2) {
      logWarn(
        "Invalid data provided for trend detection - insufficient data points"
      );
      return null;
    }

    logDebug(`Processing time series data with ${data.length} data points`);

    const cacheKey = generateCacheKey(data, "trend");
    if (trendCache.has(cacheKey)) {
      logDebug("Trend analysis result found in cache");
      return trendCache.get(cacheKey);
    }

    logDebug("Calculating trend analysis - not in cache");

    // Calculate simple moving averages for trend smoothing
    const sma3 = calculateSMA(data, 3);
    const sma7 = calculateSMA(data, 7);

    logDebug(
      `Calculated SMAs - SMA3: ${sma3.length} points, SMA7: ${sma7.length} points`
    );

    // Linear regression to detect overall trend
    const xData = Array.from({ length: data.length }, (_, i) => i);
    const regression = calculateLinearRegression(xData, data);

    logDebug(
      `Linear regression completed - slope: ${regression.slope.toFixed(
        4
      )}, R²: ${regression.rSquared.toFixed(4)}`
    );

    // Trend strength based on R-squared
    let trendStrength;
    if (regression.rSquared > 0.8) trendStrength = "Strong";
    else if (regression.rSquared > 0.5) trendStrength = "Moderate";
    else if (regression.rSquared > 0.2) trendStrength = "Weak";
    else trendStrength = "Very weak";

    // Trend direction
    let trendDirection;
    if (regression.slope > 0.05) trendDirection = "Upward";
    else if (regression.slope < -0.05) trendDirection = "Downward";
    else trendDirection = "Horizontal";

    logInfo(`Trend detected: ${trendStrength} ${trendDirection} trend`);

    // Identify trend changes (reversal points)
    const reversalPoints = identifyReversalPoints(data);
    logDebug(`Identified ${reversalPoints.length} reversal points`);

    // Calculate volatility around the trend
    const volatility = calculateVolatility(data, regression);
    logDebug(
      `Volatility calculated: ${
        volatility.interpretation
      } (${volatility.volatilityIndex.toFixed(2)}%)`
    );

    // Detect cycles/patterns
    const patterns = detectPatterns(data);
    logDebug("Pattern detection completed", patterns);

    const result = {
      direction: trendDirection,
      strength: trendStrength,
      slope: regression.slope,
      reversalPoints,
      volatility,
      patterns,
      sma3,
      sma7,
      regression,
    };

    trendCache.set(cacheKey, result);
    logInfo("Trend analysis completed and cached");

    return result;
  }

  /**
   * Calculate Simple Moving Average
   * @param {Array} data - Time series data
   * @param {number} period - SMA period
   * @returns {Array} SMA values
   */
  function calculateSMA(data, period) {
    logDebug(`Calculating SMA with period ${period}`);

    if (data.length < period) {
      logWarn(
        `Data length (${data.length}) is less than SMA period (${period})`
      );
      return [];
    }

    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    logDebug(`SMA calculation completed - ${sma.length} values generated`);
    return sma;
  }

  /**
   * Calculate linear regression (basic implementation for internal use)
   * @param {Array} xData - Independent variable data
   * @param {Array} yData - Dependent variable data
   * @returns {Object} Regression results
   */
  function calculateLinearRegression(xData, yData) {
    logDebug("Calculating linear regression");

    if (xData.length !== yData.length) {
      logError("X and Y data arrays must have the same length for regression");
      throw new Error("Data arrays must have equal length");
    }

    if (xData.length < 2) {
      logError("Insufficient data points for regression analysis");
      throw new Error("At least 2 data points required for regression");
    }

    const n = xData.length;
    const xMean = xData.reduce((acc, val) => acc + val, 0) / n;
    const yMean = yData.reduce((acc, val) => acc + val, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xData[i] - xMean) * (yData[i] - yMean);
      denominator += Math.pow(xData[i] - xMean, 2);
    }

    if (denominator === 0) {
      logWarn("Zero variance in X data - regression may be unreliable");
    }

    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;

    // Calculate R-squared
    let totalSS = 0;
    let residualSS = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * xData[i] + intercept;
      totalSS += Math.pow(yData[i] - yMean, 2);
      residualSS += Math.pow(yData[i] - predicted, 2);
    }

    const rSquared = totalSS === 0 ? 0 : 1 - residualSS / totalSS;

    logDebug(
      `Regression completed - slope: ${slope.toFixed(
        4
      )}, intercept: ${intercept.toFixed(4)}, R²: ${rSquared.toFixed(4)}`
    );

    return { slope, intercept, rSquared };
  }

  /**
   * Identify reversal points in the trend
   * @param {Array} data - Time series data
   * @returns {Array} Indices of reversal points
   */
  function identifyReversalPoints(data) {
    logDebug("Identifying trend reversal points");

    const reversalPoints = [];

    for (let i = 1; i < data.length - 1; i++) {
      // Local maximum (peak)
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        reversalPoints.push({
          index: i,
          type: "peak",
          value: data[i],
        });
      }
      // Local minimum (trough)
      else if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        reversalPoints.push({
          index: i,
          type: "trough",
          value: data[i],
        });
      }
    }

    logDebug(`Found ${reversalPoints.length} reversal points`);

    return reversalPoints;
  }

  /**
   * Calculate volatility around the trend
   * @param {Array} data - Time series data
   * @param {Object} regression - Regression analysis results
   * @returns {Object} Volatility metrics
   */
  function calculateVolatility(data, regression) {
    logDebug("Calculating volatility metrics");

    const residuals = data.map((value, index) => {
      const predicted = regression.slope * index + regression.intercept;
      return Math.abs(value - predicted);
    });

    const meanResidual =
      residuals.reduce((acc, val) => acc + val, 0) / residuals.length;
    const standardDeviation = Math.sqrt(
      residuals.reduce((acc, val) => acc + Math.pow(val - meanResidual, 2), 0) /
        residuals.length
    );

    // Volatility index: standard deviation as percentage of mean
    const volatilityIndex =
      meanResidual === 0
        ? 0
        : (standardDeviation / Math.abs(meanResidual)) * 100;

    const interpretation =
      volatilityIndex < 20 ? "Low" : volatilityIndex < 50 ? "Moderate" : "High";

    logDebug(
      `Volatility analysis: ${interpretation} (index: ${volatilityIndex.toFixed(
        2
      )}%)`
    );

    return {
      meanResidual,
      standardDeviation,
      volatilityIndex,
      interpretation,
    };
  }

  /**
   * Detect patterns in time series data
   * @param {Array} data - Time series data
   * @returns {Object} Pattern detection results
   */
  function detectPatterns(data) {
    logDebug("Starting pattern detection analysis");

    const patterns = {
      seasonality: detectSeasonality(data),
      cycles: detectCyclicalPattern(data),
      momentum: detectMomentum(data),
    };

    logDebug("Pattern detection completed");

    return patterns;
  }

  /**
   * Detect seasonality in data
   * @param {Array} data - Time series data
   * @returns {Object} Seasonality metrics
   */
  function detectSeasonality(data) {
    logDebug("Detecting seasonality patterns");

    if (data.length < 12) {
      logWarn(
        "Insufficient data for seasonality detection (minimum 12 points required)"
      );
      return null;
    }

    // Check for 4-period (quarterly) seasonality
    const quarterly = checkSeasonalPattern(data, 4);

    // Check for 12-period (monthly) seasonality
    const monthly = checkSeasonalPattern(data, 12);

    logDebug(
      `Seasonality check - quarterly: ${quarterly.strength.toFixed(
        3
      )}, monthly: ${monthly.strength.toFixed(3)}`
    );

    // Return the pattern with the strongest seasonality
    if (quarterly.strength > monthly.strength) {
      logInfo("Quarterly seasonality pattern detected");
      return { period: 4, strength: quarterly.strength, type: "quarterly" };
    } else if (monthly.strength > 0.3) {
      logInfo("Monthly seasonality pattern detected");
      return { period: 12, strength: monthly.strength, type: "monthly" };
    }

    logDebug("No significant seasonality patterns found");
    return null;
  }

  /**
   * Check for specific seasonal pattern
   * @param {Array} data - Time series data
   * @param {number} period - Period to check
   * @returns {Object} Seasonal pattern metrics
   */
  function checkSeasonalPattern(data, period) {
    if (data.length < period * 2) {
      logDebug(`Insufficient data for ${period}-period seasonality check`);
      return { strength: 0 };
    }

    const groups = Array(period)
      .fill()
      .map(() => []);

    // Group data by period
    data.forEach((value, index) => {
      groups[index % period].push(value);
    });

    // Calculate variance within groups vs overall variance
    const groupMeans = groups.map(
      (group) => group.reduce((acc, val) => acc + val, 0) / group.length
    );

    const overallMean = data.reduce((acc, val) => acc + val, 0) / data.length;

    // Between-group variance
    const betweenGroupVariance =
      groupMeans.reduce(
        (acc, mean) => acc + Math.pow(mean - overallMean, 2),
        0
      ) / period;

    // Within-group variance
    const withinGroupVariance =
      groups.reduce((acc, group) => {
        const groupMean = groupMeans[groups.indexOf(group)];
        return (
          acc +
          group.reduce((acc2, val) => acc2 + Math.pow(val - groupMean, 2), 0)
        );
      }, 0) / data.length;

    // Seasonality strength: ratio of between-group to within-group variance
    const strength =
      betweenGroupVariance / (withinGroupVariance + betweenGroupVariance);

    return { strength };
  }

  /**
   * Detect cyclical patterns
   * @param {Array} data - Time series data
   * @returns {Object} Cyclical pattern metrics
   */
  function detectCyclicalPattern(data) {
    logDebug("Detecting cyclical patterns using autocorrelation");

    // Use autocorrelation to detect cycles
    const autocorrelation = calculateAutocorrelation(
      data,
      Math.floor(data.length / 2)
    );

    // Find peaks in autocorrelation
    const peaks = [];
    for (let i = 2; i < autocorrelation.length - 2; i++) {
      if (
        autocorrelation[i] > autocorrelation[i - 1] &&
        autocorrelation[i] > autocorrelation[i + 1] &&
        autocorrelation[i] > 0.3
      ) {
        // Significance threshold
        peaks.push({ lag: i, correlation: autocorrelation[i] });
      }
    }

    if (peaks.length === 0) {
      logDebug("No significant cyclical patterns found");
      return { hasCycle: false };
    }

    // Find the strongest cycle
    const strongestCycle = peaks.reduce(
      (max, peak) => (peak.correlation > max.correlation ? peak : max),
      peaks[0]
    );

    logInfo(
      `Cyclical pattern detected - period: ${
        strongestCycle.lag
      }, strength: ${strongestCycle.correlation.toFixed(3)}`
    );

    return {
      hasCycle: true,
      period: strongestCycle.lag,
      strength: strongestCycle.correlation,
    };
  }

  /**
   * Calculate autocorrelation for lag analysis
   * @param {Array} data - Time series data
   * @param {number} maxLag - Maximum lag to calculate
   * @returns {Array} Autocorrelation values
   */
  function calculateAutocorrelation(data, maxLag) {
    logDebug(`Calculating autocorrelation up to lag ${maxLag}`);

    const n = data.length;
    const mean = data.reduce((acc, val) => acc + val, 0) / n;
    const variance = data.reduce(
      (acc, val) => acc + Math.pow(val - mean, 2),
      0
    );

    if (variance === 0) {
      logWarn("Zero variance in data - autocorrelation may be unreliable");
      return Array(maxLag + 1).fill(0);
    }

    const autocorrelation = [];

    for (let lag = 0; lag <= maxLag; lag++) {
      let covariance = 0;
      for (let i = 0; i < n - lag; i++) {
        covariance += (data[i] - mean) * (data[i + lag] - mean);
      }
      autocorrelation.push(covariance / variance);
    }

    logDebug(
      `Autocorrelation calculation completed for ${autocorrelation.length} lags`
    );

    return autocorrelation;
  }

  /**
   * Detect momentum in the data
   * @param {Array} data - Time series data
   * @returns {Object} Momentum metrics
   */
  function detectMomentum(data) {
    logDebug("Detecting momentum patterns");

    if (data.length < 10) {
      logWarn(
        "Insufficient data for momentum analysis (minimum 10 points required)"
      );
      return null;
    }

    // Calculate rate of change
    const roc = [];
    for (let i = 5; i < data.length; i++) {
      if (data[i - 5] === 0) {
        logWarn(
          `Division by zero detected at index ${
            i - 5
          } during momentum calculation`
        );
        roc.push(0);
      } else {
        roc.push(((data[i] - data[i - 5]) / data[i - 5]) * 100);
      }
    }

    // Calculate momentum strength and direction
    const momentum = roc.reduce((acc, val) => acc + val, 0) / roc.length;

    let momentumStrength;
    const absMomentum = Math.abs(momentum);
    if (absMomentum > 10) momentumStrength = "Strong";
    else if (absMomentum > 5) momentumStrength = "Moderate";
    else if (absMomentum > 2) momentumStrength = "Weak";
    else momentumStrength = "Negligible";

    logInfo(
      `Momentum analysis: ${momentumStrength} ${
        momentum > 0 ? "positive" : "negative"
      } momentum (${momentum.toFixed(2)}%)`
    );

    return {
      value: momentum,
      strength: momentumStrength,
      direction: momentum > 0 ? "Positive" : "Negative",
      acceleration: roc[roc.length - 1] > roc[0] ? "Increasing" : "Decreasing",
    };
  }

  /**
   * Generate narrative insights from trend analysis
   * @param {Object} trend - Trend analysis results
   * @returns {Array} Array of narrative insights
   */
  function generateTrendInsights(trend) {
    logDebug("Generating narrative insights from trend analysis");

    if (!trend) {
      logWarn("No trend data provided for insight generation");
      return [];
    }

    const insights = [];

    // Overall trend direction and strength
    insights.push(
      `The data shows a ${trend.strength.toLowerCase()} ${trend.direction.toLowerCase()} trend.`
    );

    // Volatility insight
    if (trend.volatility.interpretation === "High") {
      insights.push(
        "High volatility indicates significant fluctuations around the trend."
      );
    } else if (trend.volatility.interpretation === "Low") {
      insights.push(
        "Low volatility suggests data points follow the trend closely."
      );
    }

    // Reversal points insight
    if (trend.reversalPoints.length > 0) {
      const peaks = trend.reversalPoints.filter(
        (p) => p.type === "peak"
      ).length;
      const troughs = trend.reversalPoints.filter(
        (p) => p.type === "trough"
      ).length;
      insights.push(
        `The trend shows ${peaks} peaks and ${troughs} troughs, indicating ${
          peaks + troughs
        } potential turning points.`
      );
    }

    // Seasonality insight
    if (trend.patterns.seasonality) {
      insights.push(
        `Data exhibits ${trend.patterns.seasonality.type} seasonality with a period of ${trend.patterns.seasonality.period}.`
      );
    }

    // Cyclical pattern insight
    if (trend.patterns.cycles.hasCycle) {
      insights.push(
        `A cyclical pattern repeats approximately every ${trend.patterns.cycles.period} periods.`
      );
    }

    // Momentum insight
    if (trend.patterns.momentum) {
      insights.push(
        `Data shows ${trend.patterns.momentum.strength.toLowerCase()} ${trend.patterns.momentum.direction.toLowerCase()} momentum.`
      );
    }

    logInfo(`Generated ${insights.length} narrative insights`);

    return insights;
  }

  /**
   * Clear the trend cache
   */
  function clearCache() {
    const cacheSize = trendCache.size;
    trendCache.clear();
    logInfo(`Trend cache cleared - removed ${cacheSize} cached entries`);
  }

  logInfo("ChartTrends module ready for use");

  // Public API
  return {
    detectTrend,
    generateTrendInsights,
    clearCache,
  };
})();

// Export for use in chart-accessibility.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartTrends;
} else {
  window.ChartTrends = ChartTrends;
}
