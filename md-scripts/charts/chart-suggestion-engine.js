/**
 * Chart Suggestion Engine
 * Analyzes data and recommends appropriate chart types with educational context
 *
 * Features:
 * - Intelligent chart type recommendations based on data characteristics
 * - Educational explanations for each suggestion
 * - Ranking of suggestions by suitability
 * - Customisation recommendations for optimal visualisation
 *
 * @version 1.0.0
 */

const ChartSuggestionEngine = (function () {
  "use strict";

  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level (can be changed at runtime)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Logging helper functions
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Suggestion Engine] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Suggestion Engine] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Suggestion Engine] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Suggestion Engine] DEBUG: ${message}`, ...args);
    }
  }

  // Configuration
  const CONFIG = {
    maxSuggestions: 3,
    minConfidenceThreshold: 0.5, // 0-1 scale, minimum confidence to include in suggestions
    analyzeStatistics: true,
    educationalMode: true, // Include educational context in suggestions
  };

  // Chart type definitions with characteristics and suitability rules
  const CHART_TYPES = {
    bar: {
      name: "Bar Chart",
      suitableFor: [
        "categorical",
        "comparison",
        "discrete",
        "ranking",
        "distribution",
      ],
      notSuitableFor: ["correlation", "precise temporal trends"],
      maxRecommendedSeries: 10,
      maxRecommendedCategories: 15,
      educationalContext:
        "Bar charts are excellent for comparing values across categories. They work well in educational contexts where clear comparison of values is needed.",
      variants: {
        horizontal: {
          name: "Horizontal Bar Chart",
          description: "Bars run horizontally instead of vertically",
          whenToUse:
            "When category labels are long or there are many categories",
        },
        stacked: {
          name: "Stacked Bar Chart",
          description: "Bars are stacked to show part-to-whole relationships",
          whenToUse: "When showing composition within categories",
        },
        grouped: {
          name: "Grouped Bar Chart",
          description: "Multiple bars are grouped by category",
          whenToUse: "When comparing multiple series across categories",
        },
      },
    },

    line: {
      name: "Line Chart",
      suitableFor: ["temporal", "continuous", "trends", "progression"],
      notSuitableFor: [
        "categorical comparison",
        "part-to-whole",
        "few data points",
      ],
      minRecommendedDataPoints: 5,
      educationalContext:
        "Line charts are ideal for showing trends over time or continuous data. They help students visualise progression and changes.",
      variants: {
        area: {
          name: "Area Chart",
          description: "Area under the line is filled",
          whenToUse: "When emphasising volume or cumulative values",
        },
        multiLine: {
          name: "Multi-line Chart",
          description: "Multiple lines showing different series",
          whenToUse: "When comparing trends across different categories",
        },
        steppedLine: {
          name: "Stepped Line Chart",
          description:
            "Line connects points with horizontal and vertical lines",
          whenToUse:
            "When showing changes that happen at specific points (e.g., policy changes)",
        },
      },
    },

    pie: {
      name: "Pie Chart",
      suitableFor: ["part-to-whole", "proportion", "percentage", "composition"],
      notSuitableFor: [
        "precise comparison",
        "many categories",
        "similar values",
      ],
      maxRecommendedCategories: 6,
      educationalContext:
        "Pie charts show part-to-whole relationships and are good for teaching about percentages and proportions. Best used with a small number of categories.",
      variants: {
        doughnut: {
          name: "Doughnut Chart",
          description: "Pie chart with a hole in the center",
          whenToUse: "When you want to put a number or label in the centre",
        },
        semiCircle: {
          name: "Semi-circle Pie Chart",
          description: "Half of a pie chart",
          whenToUse: "When space is limited or for gauge-like visualisation",
        },
      },
    },

    doughnut: {
      name: "Doughnut Chart",
      suitableFor: ["part-to-whole", "proportion", "percentage", "composition"],
      notSuitableFor: [
        "precise comparison",
        "many categories",
        "similar values",
      ],
      maxRecommendedCategories: 6,
      educationalContext:
        "Doughnut charts, like pie charts, show part-to-whole relationships. The centre can be used to display total or key information.",
      isVariantOf: "pie",
    },

    scatter: {
      name: "Scatter Plot",
      suitableFor: [
        "correlation",
        "distribution",
        "clusters",
        "outliers",
        "relationships",
      ],
      notSuitableFor: ["categorical data", "time series", "part-to-whole"],
      minRecommendedDataPoints: 10,
      educationalContext:
        "Scatter plots are excellent for exploring relationships between two variables. They help students identify patterns, correlations, and outliers.",
      variants: {
        bubble: {
          name: "Bubble Chart",
          description: "Scatter plot with varying point sizes",
          whenToUse: "When there is a third variable to represent by size",
        },
      },
    },

    bubble: {
      name: "Bubble Chart",
      suitableFor: [
        "correlation",
        "distribution",
        "three-variable",
        "multi-dimensional",
      ],
      notSuitableFor: [
        "categorical data",
        "precise comparison",
        "part-to-whole",
      ],
      minRecommendedDataPoints: 5,
      educationalContext:
        "Bubble charts add a third dimension to scatter plots through bubble size. They are useful for teaching multi-variable relationships.",
      isVariantOf: "scatter",
    },

    radar: {
      name: "Radar Chart",
      suitableFor: [
        "multi-variable",
        "comparison",
        "performance",
        "assessment",
      ],
      notSuitableFor: [
        "precise values",
        "many categories",
        "unrelated variables",
      ],
      maxRecommendedCategories: 8,
      maxRecommendedSeries: 3,
      educationalContext:
        "Radar charts are useful for comparing multiple variables in a unified view. They work well for skill assessments, performance reviews, or comparing attributes.",
      variants: {
        filled: {
          name: "Filled Radar Chart",
          description: "Radar chart with filled areas",
          whenToUse: "When comparing overall coverage or footprint",
        },
      },
    },

    polarArea: {
      name: "Polar Area Chart",
      suitableFor: ["categorical", "cyclic", "part-to-whole", "magnitude"],
      notSuitableFor: [
        "precise comparison",
        "many categories",
        "unrelated variables",
      ],
      maxRecommendedCategories: 8,
      educationalContext:
        "Polar area charts use angle for categories and radius for values. They are good for showing cyclic patterns or comparing magnitude across categories.",
    },

    horizontalBar: {
      name: "Horizontal Bar Chart",
      suitableFor: ["categorical", "comparison", "ranking", "long labels"],
      notSuitableFor: ["correlation", "temporal trends", "many series"],
      maxRecommendedSeries: 5,
      maxRecommendedCategories: 20,
      educationalContext:
        "Horizontal bar charts are excellent when category labels are long or when you have many categories. They are ideal for rankings and survey results.",
      isVariantOf: "bar",
    },
  };

  // Data characteristics and their detection functions
  const DATA_CHARACTERISTICS = {
    temporal: {
      name: "Time Series",
      description: "Data represents values over time",
      detect: function (data) {
        logDebug("Detecting temporal characteristics", {
          labels: data?.labels?.slice(0, 3),
        });

        // Check if labels look like dates or time periods
        if (!data || !data.labels || data.labels.length < 2) return 0;

        const timePatterns = [
          // Year pattern (e.g., 2023)
          /^(19|20)\d{2}$/,
          // Month names or abbreviations
          /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i,
          // Date patterns (various formats)
          /^\d{1,2}[-/\.]\d{1,2}([-/\.]\d{2,4})?$/,
          // Quarter patterns (Q1, Q2, etc.)
          /^Q[1-4](\s\d{4})?$/i,
          // Time patterns (HH:MM, HH:MM:SS)
          /^\d{1,2}:\d{2}(:\d{2})?$/,
        ];

        // Count how many labels match time patterns
        let timeMatchCount = 0;
        data.labels.forEach((label) => {
          const labelStr = String(label);
          if (timePatterns.some((pattern) => pattern.test(labelStr))) {
            timeMatchCount++;
          }
        });

        // Calculate confidence based on percentage of matches
        const confidence = timeMatchCount / data.labels.length;
        logDebug(
          `Temporal detection complete: ${timeMatchCount}/${
            data.labels.length
          } matches (${Math.round(confidence * 100)}%)`
        );
        return confidence;
      },
    },

    categorical: {
      name: "Categorical",
      description: "Data is organised into distinct categories",
      detect: function (data) {
        logDebug("Detecting categorical characteristics");

        if (!data || !data.labels) return 0;

        // Check if labels are distinct text values that don't look like numbers or dates
        const distinctLabels = new Set(data.labels).size;
        const numericLabels = data.labels.filter(
          (label) => !isNaN(label)
        ).length;

        // Calculate how categorical the data is (non-numeric, distinct labels)
        const nonNumericRatio = 1 - numericLabels / data.labels.length;
        const distinctRatio = distinctLabels / data.labels.length;

        const confidence = (nonNumericRatio + distinctRatio) / 2;
        logDebug(
          `Categorical detection: distinct=${distinctLabels}, numeric=${numericLabels}, confidence=${Math.round(
            confidence * 100
          )}%`
        );
        return confidence;
      },
    },

    comparison: {
      name: "Comparison",
      description: "Data compares values across categories",
      detect: function (data) {
        logDebug("Detecting comparison characteristics");

        if (!data || !data.datasets || data.datasets.length === 0) return 0;

        // Check if there are multiple datasets or significant variance in values
        const hasSingleDataset = data.datasets.length === 1;

        // For single dataset, check variance
        if (hasSingleDataset) {
          const values = data.datasets[0].data;
          if (!values || values.length < 2) return 0;

          // Calculate variance and range
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          const variance =
            values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
            values.length;
          const stdDev = Math.sqrt(variance);
          const variationCoefficient = stdDev / avg;

          // Higher variation coefficient suggests comparison data
          const confidence = Math.min(variationCoefficient * 2, 1);
          logDebug(
            `Comparison detection (single dataset): variationCoeff=${variationCoefficient.toFixed(
              3
            )}, confidence=${Math.round(confidence * 100)}%`
          );
          return confidence;
        }

        // Multiple datasets already suggest comparison
        logDebug(
          `Comparison detection (multiple datasets): ${data.datasets.length} datasets, confidence=80%`
        );
        return 0.8;
      },
    },

    correlation: {
      name: "Correlation",
      description: "Data shows relationship between two variables",
      detect: function (data) {
        logDebug("Detecting correlation characteristics");

        if (!data || !data.datasets || data.datasets.length === 0) return 0;

        // Check if data structure looks like x/y coordinates
        const hasXYFormat = data.datasets.some(
          (dataset) =>
            dataset.data &&
            dataset.data.length > 0 &&
            typeof dataset.data[0] === "object" &&
            "x" in dataset.data[0] &&
            "y" in dataset.data[0]
        );

        if (hasXYFormat) {
          logDebug(
            "Correlation detection: found x/y format data, confidence=90%"
          );
          return 0.9;
        }

        // Alternative: check if we have two numeric columns
        if (
          data.datasets.length >= 2 &&
          data.datasets[0].data &&
          data.datasets[1].data
        ) {
          // Both datasets have numeric data
          const allNumeric = data.datasets.every((dataset) =>
            dataset.data.every((val) => !isNaN(val))
          );

          if (allNumeric) {
            logDebug(
              "Correlation detection: found two numeric datasets, confidence=60%"
            );
            return 0.6; // Potential correlation, but less certain
          }
        }

        logDebug("Correlation detection: no correlation patterns found");
        return 0;
      },
    },

    distribution: {
      name: "Distribution",
      description: "Data shows how values are distributed",
      detect: function (data) {
        logDebug("Detecting distribution characteristics");

        if (
          !data ||
          !data.datasets ||
          data.datasets.length === 0 ||
          !data.datasets[0].data
        )
          return 0;

        // Check if we have a single dataset with enough data points
        const singleDataset = data.datasets.length === 1;
        const dataPoints = data.datasets[0].data.length;

        if (singleDataset && dataPoints >= 8) {
          // Analyse if there's a distribution pattern
          const values = data.datasets[0].data;

          // Sort values to check for distribution patterns
          const sortedValues = [...values]
            .filter((v) => !isNaN(v))
            .sort((a, b) => a - b);
          if (sortedValues.length < 5) return 0;

          // Check if values form a gradient (suggesting distribution)
          const min = sortedValues[0];
          const max = sortedValues[sortedValues.length - 1];
          const range = max - min;

          if (range === 0) return 0; // All values the same

          // Check evenness of distribution
          const expectedGap = range / (sortedValues.length - 1);
          let gapVariation = 0;

          for (let i = 1; i < sortedValues.length; i++) {
            const actualGap = sortedValues[i] - sortedValues[i - 1];
            gapVariation += Math.abs(actualGap - expectedGap);
          }

          const normalizedVariation = 1 - gapVariation / (range * 2);
          const confidence = Math.max(0.3, normalizedVariation); // Minimum 0.3 confidence if we have enough sorted data
          logDebug(
            `Distribution detection: range=${range}, normalizedVariation=${normalizedVariation.toFixed(
              3
            )}, confidence=${Math.round(confidence * 100)}%`
          );
          return confidence;
        }

        logDebug(
          "Distribution detection: insufficient data for pattern analysis"
        );
        return 0;
      },
    },

    part_to_whole: {
      name: "Part-to-Whole",
      description: "Data represents parts of a complete whole",
      detect: function (data) {
        logDebug("Detecting part-to-whole characteristics");

        if (!data || !data.datasets || data.datasets.length === 0) return 0;

        // Check if we have a single dataset with reasonable number of categories
        if (
          data.datasets.length === 1 &&
          data.labels &&
          data.labels.length >= 2 &&
          data.labels.length <= 12
        ) {
          const values = data.datasets[0].data;

          // Check if all values are positive
          const allPositive = values.every((val) => val >= 0);
          if (!allPositive) {
            logDebug(
              "Part-to-whole detection: negative values found, not suitable"
            );
            return 0;
          }

          // For percentage data, check if values sum close to 100
          const sum = values.reduce((acc, val) => acc + val, 0);
          const avgValue = sum / values.length;

          // Check if values are similar in magnitude (suggesting parts of a whole)
          let variationSum = 0;
          values.forEach((val) => {
            variationSum += Math.abs(val - avgValue) / avgValue;
          });

          const averageVariation = variationSum / values.length;

          // Lower variation means more even parts (higher confidence for part-to-whole)
          const confidence = Math.max(0, 1 - averageVariation);
          logDebug(
            `Part-to-whole detection: sum=${sum}, avgVariation=${averageVariation.toFixed(
              3
            )}, confidence=${Math.round(confidence * 100)}%`
          );
          return confidence;
        }

        logDebug("Part-to-whole detection: data structure not suitable");
        return 0;
      },
    },

    multi_variable: {
      name: "Multi-Variable",
      description: "Data contains multiple variables for comparison",
      detect: function (data) {
        logDebug("Detecting multi-variable characteristics");

        if (!data || !data.datasets || data.datasets.length < 2) return 0;

        // Check if we have multiple datasets with the same structure
        const sameLength = data.datasets.every(
          (ds) => ds.data && ds.data.length === data.datasets[0].data.length
        );

        if (sameLength && data.datasets.length >= 3) {
          logDebug(
            `Multi-variable detection: ${data.datasets.length} datasets with same length, confidence=90%`
          );
          return 0.9; // High confidence for multi-variable data
        } else if (sameLength && data.datasets.length === 2) {
          logDebug(
            "Multi-variable detection: 2 datasets with same length, confidence=70%"
          );
          return 0.7; // Moderate confidence with just two variables
        }

        logDebug(
          "Multi-variable detection: datasets have different lengths or insufficient count"
        );
        return 0;
      },
    },

    ranking: {
      name: "Ranking",
      description: "Data shows ordered comparison by magnitude",
      detect: function (data) {
        logDebug("Detecting ranking characteristics");

        if (
          !data ||
          !data.datasets ||
          data.datasets.length === 0 ||
          !data.datasets[0].data
        )
          return 0;

        // Ranking is likely if we have categorical data with values that can be sorted
        const isCategorical =
          DATA_CHARACTERISTICS.categorical.detect(data) > 0.5;

        if (isCategorical && data.datasets[0].data.length >= 3) {
          const values = data.datasets[0].data;

          // Check if values have significant differences for ranking
          const sortedValues = [...values].sort((a, b) => b - a);
          const highest = sortedValues[0];
          const lowest = sortedValues[sortedValues.length - 1];

          if (highest === lowest) {
            logDebug(
              "Ranking detection: all values are the same, no ranking possible"
            );
            return 0; // No ranking if all values are the same
          }

          // Calculate ratio between highest and lowest
          const ratio = highest / Math.max(0.00001, lowest); // Prevent division by zero

          // Higher ratio suggests ranking data
          const confidence = Math.min(ratio / 10, 0.9); // Cap at 0.9
          logDebug(
            `Ranking detection: ratio=${ratio.toFixed(
              2
            )}, confidence=${Math.round(confidence * 100)}%`
          );
          return confidence;
        }

        logDebug(
          "Ranking detection: not categorical or insufficient data points"
        );
        return 0;
      },
    },

    trend: {
      name: "Trend",
      description: "Data shows a pattern of change over a sequence",
      detect: function (data) {
        logDebug("Detecting trend characteristics");

        if (
          !data ||
          !data.datasets ||
          !data.datasets[0] ||
          !data.datasets[0].data
        )
          return 0;

        // Check if data looks like a sequence (temporal or ordered)
        const isTemporal = DATA_CHARACTERISTICS.temporal.detect(data) > 0.5;
        const values = data.datasets[0].data;

        if ((isTemporal || data.labels) && values.length >= 4) {
          // Calculate trend consistency
          let increasingCount = 0;
          let decreasingCount = 0;

          for (let i = 1; i < values.length; i++) {
            if (values[i] > values[i - 1]) increasingCount++;
            else if (values[i] < values[i - 1]) decreasingCount++;
          }

          const changesCount = increasingCount + decreasingCount;
          if (changesCount === 0) {
            logDebug("Trend detection: no changes in values, no trend");
            return 0; // No changes, no trend
          }

          // Check if mostly increasing or mostly decreasing
          const dominantDirection = Math.max(increasingCount, decreasingCount);
          const trendConsistency = dominantDirection / changesCount;

          // Higher consistency suggests a clearer trend
          logDebug(
            `Trend detection: increasing=${increasingCount}, decreasing=${decreasingCount}, consistency=${trendConsistency.toFixed(
              3
            )}`
          );
          return trendConsistency;
        }

        logDebug(
          "Trend detection: not temporal/ordered or insufficient data points"
        );
        return 0;
      },
    },
  };

  /**
   * Analyse data to detect characteristics
   * @param {Object} data - Chart data object
   * @returns {Object} Analysis results with characteristic scores
   */
  function analyzeData(data) {
    logInfo("Starting data analysis");

    if (!data) {
      const error = new Error("No data provided for analysis");
      logError("Analysis failed: no data provided");
      throw error;
    }

    // Normalise data format if needed
    const normalizedData = normalizeDataFormat(data);
    logDebug("Data normalised successfully", {
      labels: normalizedData.labels?.length || 0,
      datasets: normalizedData.datasets?.length || 0,
    });

    // Run each characteristic detection function
    const characteristics = {};
    for (const [key, characteristic] of Object.entries(DATA_CHARACTERISTICS)) {
      try {
        const score = characteristic.detect(normalizedData);
        characteristics[key] = {
          name: characteristic.name,
          description: characteristic.description,
          score: score,
        };
        logDebug(
          `Characteristic ${characteristic.name}: ${Math.round(
            score * 100
          )}% confidence`
        );
      } catch (error) {
        logError(`Error detecting ${characteristic.name}:`, error);
        characteristics[key] = {
          name: characteristic.name,
          description: characteristic.description,
          score: 0,
          error: error.message,
        };
      }
    }

    const metadata = extractMetadata(normalizedData);
    logInfo("Data analysis completed successfully", {
      characteristics: Object.keys(characteristics).length,
      metadata: Object.keys(metadata).length,
    });

    return {
      characteristics,
      metadata: metadata,
    };
  }

  /**
   * Normalise different data formats to a consistent structure
   * @param {Object} data - Input data in various formats
   * @returns {Object} Normalised data structure
   */
  function normalizeDataFormat(data) {
    logDebug("Starting data format normalisation");

    // If data is already in Chart.js format, return as is
    if (data.datasets && (data.labels || data.datasets[0].data)) {
      logDebug("Data already in Chart.js format");
      return data;
    }

    // If data comes from ChartDataManager, extract the transformed data
    if (data.transformedData) {
      logDebug("Extracting data from ChartDataManager format");
      return data.transformedData;
    }

    // If data is an array of objects, convert to Chart.js format
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      logDebug("Converting array of objects to Chart.js format");
      return convertArrayOfObjectsToChartFormat(data);
    }

    // If data is a simple array, convert to Chart.js format
    if (Array.isArray(data) && data.length > 0 && typeof data[0] !== "object") {
      logDebug("Converting simple array to Chart.js format");
      return {
        labels: Array.from({ length: data.length }, (_, i) => `Item ${i + 1}`),
        datasets: [
          {
            data: data,
          },
        ],
      };
    }

    // If data format is unrecognised, throw an error
    const error = new Error("Unrecognised data format");
    logError("Data normalisation failed: unrecognised format", {
      dataType: typeof data,
      isArray: Array.isArray(data),
    });
    throw error;
  }

  /**
   * Convert array of objects to Chart.js format
   * @param {Array} data - Array of data objects
   * @returns {Object} Chart.js formatted data
   */
  function convertArrayOfObjectsToChartFormat(data) {
    logDebug("Converting array of objects", { length: data.length });

    if (!Array.isArray(data) || data.length === 0) {
      logWarn("Empty or invalid array provided for conversion");
      return { labels: [], datasets: [{ data: [] }] };
    }

    // Get all keys from the first object
    const keys = Object.keys(data[0]);

    if (keys.length === 0) {
      logWarn("First data object has no properties");
      return { labels: [], datasets: [{ data: [] }] };
    }

    // Use first key as labels and rest as datasets
    const labelKey = keys[0];
    const dataKeys = keys.slice(1);

    const labels = data.map((item) => item[labelKey]);
    const datasets = dataKeys.map((key) => ({
      label: key,
      data: data.map((item) => item[key]),
    }));

    logDebug(
      `Conversion complete: ${labels.length} labels, ${datasets.length} datasets`
    );

    return { labels, datasets };
  }

  /**
   * Extract metadata about the dataset
   * @param {Object} data - Normalised chart data
   * @returns {Object} Metadata about the dataset
   */
  function extractMetadata(data) {
    logDebug("Extracting metadata from normalised data");

    const metadata = {
      hasCategoricalLabels: false,
      hasNumericLabels: false,
      hasTemporalLabels: false,
      datasetCount: 0,
      pointCount: 0,
      categoryCount: 0,
      allPositiveValues: true,
      hasNegativeValues: false,
      hasZeroValues: false,
    };

    // Check labels
    if (data.labels && data.labels.length > 0) {
      metadata.categoryCount = data.labels.length;

      // Check label types
      const numericLabelCount = data.labels.filter(
        (label) => !isNaN(label)
      ).length;
      metadata.hasNumericLabels = numericLabelCount > 0;
      metadata.hasCategoricalLabels = numericLabelCount < data.labels.length;
      metadata.hasTemporalLabels =
        DATA_CHARACTERISTICS.temporal.detect(data) > 0.5;
    }

    // Check datasets
    if (data.datasets && data.datasets.length > 0) {
      metadata.datasetCount = data.datasets.length;

      // Analyse values
      data.datasets.forEach((dataset) => {
        if (!dataset.data) return;

        metadata.pointCount += dataset.data.length;

        // Check for special values
        dataset.data.forEach((value) => {
          // Handle scatter/bubble data format
          const actualValue =
            typeof value === "object"
              ? value.y !== undefined
                ? value.y
                : value.x
              : value;

          if (actualValue === 0) metadata.hasZeroValues = true;
          if (actualValue < 0) {
            metadata.hasNegativeValues = true;
            metadata.allPositiveValues = false;
          }
        });
      });
    }

    logDebug("Metadata extraction complete", {
      datasetCount: metadata.datasetCount,
      pointCount: metadata.pointCount,
      categoryCount: metadata.categoryCount,
    });

    return metadata;
  }

  /**
   * Get chart type suggestions based on data analysis
   * @param {Object} data - Chart data object
   * @param {Object} options - Options for suggestion generation
   * @returns {Array} Ranked chart suggestions
   */
  function suggestChartTypes(data, options = {}) {
    logInfo("Generating chart type suggestions");

    // Merge options with defaults
    const mergedOptions = {
      maxSuggestions: options.maxSuggestions || CONFIG.maxSuggestions,
      minConfidence: options.minConfidence || CONFIG.minConfidenceThreshold,
      includeVariants:
        options.includeVariants !== undefined ? options.includeVariants : true,
      educationalMode:
        options.educationalMode !== undefined
          ? options.educationalMode
          : CONFIG.educationalMode,
    };

    logDebug("Suggestion options", mergedOptions);

    // Analyse data
    const analysis = analyzeData(data);

    // Score each chart type
    const scores = scoreChartTypes(analysis);
    logDebug("Chart type scoring complete", {
      chartTypesScored: Object.keys(scores).length,
    });

    // Rank and filter suggestions
    let rankedSuggestions = Object.entries(scores)
      .filter(([_, score]) => score.confidence >= mergedOptions.minConfidence)
      .sort((a, b) => b[1].confidence - a[1].confidence)
      .map(([chartType, score]) => ({
        chartType,
        ...CHART_TYPES[chartType],
        confidence: score.confidence,
        reasons: score.reasons,
      }));

    logInfo(
      `Initial suggestions: ${rankedSuggestions.length} chart types meet confidence threshold`
    );

    // Add variants if requested
    if (mergedOptions.includeVariants) {
      rankedSuggestions = addVariants(rankedSuggestions, analysis);
      logDebug(
        `After adding variants: ${rankedSuggestions.length} total suggestions`
      );
    }

    // Limit number of suggestions
    rankedSuggestions = rankedSuggestions.slice(
      0,
      mergedOptions.maxSuggestions
    );

    // Add educational context if requested
    if (mergedOptions.educationalMode) {
      rankedSuggestions = addEducationalContext(rankedSuggestions, analysis);
      logDebug("Educational context added to suggestions");
    }

    logInfo(`Returning ${rankedSuggestions.length} final suggestions`);

    return {
      suggestions: rankedSuggestions,
      analysis: analysis,
    };
  }

  /**
   * Score chart types based on data analysis
   * @param {Object} analysis - Data analysis results
   * @returns {Object} Scores for each chart type
   */
  function scoreChartTypes(analysis) {
    logDebug("Starting chart type scoring");

    const scores = {};
    const { characteristics, metadata } = analysis;

    // Score each chart type
    for (const [chartType, definition] of Object.entries(CHART_TYPES)) {
      // Skip variants that are explicitly marked
      if (definition.isVariantOf) continue;

      const reasons = [];
      let totalScore = 0;
      let penaltyMultiplier = 1;

      // Score based on suitable characteristics
      if (definition.suitableFor) {
        definition.suitableFor.forEach((characteristic) => {
          // Convert characteristic name to key (e.g., 'part-to-whole' -> 'part_to_whole')
          const key = characteristic.replace(/-/g, "_");

          if (characteristics[key] && characteristics[key].score > 0.3) {
            const characteristicScore = characteristics[key].score;
            totalScore += characteristicScore;

            if (characteristicScore > 0.6) {
              reasons.push(
                `Strong match for ${characteristics[
                  key
                ].name.toLowerCase()} data (${Math.round(
                  characteristicScore * 100
                )}% confidence)`
              );
            } else if (characteristicScore > 0.3) {
              reasons.push(
                `Suitable for ${characteristics[
                  key
                ].name.toLowerCase()} data (${Math.round(
                  characteristicScore * 100
                )}% confidence)`
              );
            }
          }
        });
      }

      // Apply penalties for unsuitable characteristics
      if (definition.notSuitableFor) {
        definition.notSuitableFor.forEach((characteristic) => {
          const key = characteristic.replace(/-/g, "_");

          if (characteristics[key] && characteristics[key].score > 0.5) {
            const penalty = characteristics[key].score * 0.5;
            penaltyMultiplier -= penalty;

            reasons.push(
              `Less ideal for ${characteristics[
                key
              ].name.toLowerCase()} data (${Math.round(
                penalty * 100
              )}% penalty)`
            );
          }
        });
      }

      // Apply metadata rules

      // Check for too many categories
      if (
        definition.maxRecommendedCategories &&
        metadata.categoryCount > definition.maxRecommendedCategories
      ) {
        const overage =
          metadata.categoryCount - definition.maxRecommendedCategories;
        const penalty = Math.min(
          0.5,
          overage / definition.maxRecommendedCategories
        );
        penaltyMultiplier -= penalty;

        reasons.push(
          `Has ${metadata.categoryCount} categories, more than recommended ${
            definition.maxRecommendedCategories
          } (${Math.round(penalty * 100)}% penalty)`
        );
      }

      // Check for too many data series
      if (
        definition.maxRecommendedSeries &&
        metadata.datasetCount > definition.maxRecommendedSeries
      ) {
        const overage = metadata.datasetCount - definition.maxRecommendedSeries;
        const penalty = Math.min(
          0.5,
          overage / definition.maxRecommendedSeries
        );
        penaltyMultiplier -= penalty;

        reasons.push(
          `Has ${metadata.datasetCount} data series, more than recommended ${
            definition.maxRecommendedSeries
          } (${Math.round(penalty * 100)}% penalty)`
        );
      }

      // Check for minimum data points
      if (
        definition.minRecommendedDataPoints &&
        metadata.pointCount < definition.minRecommendedDataPoints
      ) {
        const shortage =
          definition.minRecommendedDataPoints - metadata.pointCount;
        const penalty = Math.min(
          0.5,
          shortage / definition.minRecommendedDataPoints
        );
        penaltyMultiplier -= penalty;

        reasons.push(
          `Has only ${metadata.pointCount} data points, less than recommended ${
            definition.minRecommendedDataPoints
          } (${Math.round(penalty * 100)}% penalty)`
        );
      }

      // Check for part-to-whole charts requiring positive values
      if (
        definition.suitableFor &&
        definition.suitableFor.includes("part-to-whole") &&
        !metadata.allPositiveValues
      ) {
        penaltyMultiplier -= 0.3;
        reasons.push(
          `Contains negative values, not ideal for part-to-whole charts (30% penalty)`
        );
      }

      // Apply specific chart type rules
      switch (chartType) {
        case "pie":
        case "doughnut":
          // Pie charts are terrible for comparing similar values
          if (
            characteristics.comparison &&
            characteristics.comparison.score > 0.7
          ) {
            const similarityPenalty = characteristics.comparison.score * 0.4;
            penaltyMultiplier -= similarityPenalty;
            reasons.push(
              `Values are similar, making segments hard to compare (${Math.round(
                similarityPenalty * 100
              )}% penalty)`
            );
          }
          break;

        case "scatter":
          // Scatter plots need x/y data
          if (
            !characteristics.correlation ||
            characteristics.correlation.score < 0.3
          ) {
            penaltyMultiplier -= 0.5;
            reasons.push(
              `Data doesn't appear to have correlation pairs (50% penalty)`
            );
          }
          break;

        case "line":
          // Line charts benefit from ordered data
          if (
            !characteristics.temporal ||
            characteristics.temporal.score < 0.3
          ) {
            if (!characteristics.trend || characteristics.trend.score < 0.3) {
              penaltyMultiplier -= 0.3;
              reasons.push(
                `Data doesn't appear to be time-based or show a clear trend (30% penalty)`
              );
            }
          }
          break;
      }

      // Ensure penalty multiplier doesn't go below 0.1
      penaltyMultiplier = Math.max(0.1, penaltyMultiplier);

      // Calculate final confidence score
      const normalizedBaseScore = Math.min(
        1,
        totalScore / Math.max(1, definition.suitableFor.length)
      );
      const confidence = normalizedBaseScore * penaltyMultiplier;

      // Add bonus for primary chart types
      const primaryChartBonus = ["bar", "line", "pie", "scatter"].includes(
        chartType
      )
        ? 0.1
        : 0;

      scores[chartType] = {
        confidence: Math.min(0.99, confidence + primaryChartBonus),
        reasons,
      };

      logDebug(
        `Scored ${chartType}: ${Math.round(
          scores[chartType].confidence * 100
        )}% confidence`
      );
    }

    return scores;
  }

  /**
   * Add variant suggestions based on top recommendations
   * @param {Array} suggestions - Base chart suggestions
   * @param {Object} analysis - Data analysis
   * @returns {Array} Suggestions with variants
   */
  function addVariants(suggestions, analysis) {
    logDebug("Adding chart variants to suggestions");

    const result = [...suggestions];
    const { metadata } = analysis;

    // For each suggestion, check if variants would be appropriate
    suggestions.forEach((suggestion) => {
      const chartType = suggestion.chartType;
      const variants = CHART_TYPES[chartType]?.variants;

      if (!variants) return;

      // Check each variant
      for (const [variantKey, variant] of Object.entries(variants)) {
        // Skip already included variants
        if (result.some((s) => s.chartType === variantKey)) continue;

        let shouldInclude = false;
        let variantConfidence = suggestion.confidence * 0.9; // Slightly lower confidence for variants
        const variantReasons = [];

        // Apply variant-specific rules
        switch (variantKey) {
          case "horizontal":
            // Suggest horizontal bar for many categories or long labels
            if (metadata.categoryCount > 7) {
              shouldInclude = true;
              variantReasons.push(
                `Better for displaying ${metadata.categoryCount} categories`
              );
            }
            break;

          case "stacked":
            // Suggest stacked for multiple datasets
            if (metadata.datasetCount > 1) {
              shouldInclude = true;
              variantReasons.push(
                `Good for showing composition across ${metadata.datasetCount} data series`
              );
            }
            break;

          case "area":
            // Suggest area charts for continuous data with clear trends
            if (
              analysis.characteristics.trend &&
              analysis.characteristics.trend.score > 0.5
            ) {
              shouldInclude = true;
              variantReasons.push(
                `Emphasises the volume and magnitude of the trend`
              );
            }
            break;

          case "bubble":
            // Only suggest bubble charts for scatter data with meaningful third dimension
            if (chartType === "scatter" && metadata.datasetCount > 1) {
              shouldInclude = true;
              variantReasons.push(
                `Can show a third dimension through bubble size`
              );
            }
            break;

          default:
            // For other variants, include if the base chart has high confidence
            if (suggestion.confidence > 0.7) {
              shouldInclude = true;
              variantReasons.push(
                `Alternative visualisation style for ${CHART_TYPES[
                  chartType
                ].name.toLowerCase()}`
              );
            }
        }

        // Add variant to results if appropriate
        if (shouldInclude) {
          // Look up the full variant definition
          const variantDef = CHART_TYPES[variantKey] || {
            name: variant.name,
            suitableFor: CHART_TYPES[chartType].suitableFor,
            isVariantOf: chartType,
          };

          result.push({
            chartType: variantKey,
            ...variantDef,
            confidence: variantConfidence,
            reasons: variantReasons,
            isVariant: true,
            variantOf: chartType,
            variantDescription: variant.description,
            whenToUse: variant.whenToUse,
          });

          logDebug(
            `Added variant ${variantKey} for ${chartType} (${Math.round(
              variantConfidence * 100
            )}% confidence)`
          );
        }
      }
    });

    // Re-sort by confidence
    return result.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Add educational context to suggestions
   * @param {Array} suggestions - Chart suggestions
   * @param {Object} analysis - Data analysis
   * @returns {Array} Suggestions with educational context
   */
  function addEducationalContext(suggestions, analysis) {
    logDebug("Adding educational context to suggestions");

    return suggestions.map((suggestion) => {
      // Start with basic educational context from chart type definition
      let educationalContext = suggestion.educationalContext || "";

      // Add variant-specific education
      if (suggestion.isVariant && suggestion.whenToUse) {
        educationalContext += ` ${suggestion.whenToUse}.`;
      }

      // Add data-specific educational insights
      const insights = generateEducationalInsights(suggestion, analysis);

      if (insights) {
        educationalContext += ` ${insights}`;
      }

      return {
        ...suggestion,
        educationalContext,
      };
    });
  }

  /**
   * Generate educational insights for specific chart and data
   * @param {Object} suggestion - Chart suggestion
   * @param {Object} analysis - Data analysis
   * @returns {string} Educational insights
   */
  function generateEducationalInsights(suggestion, analysis) {
    const { characteristics, metadata } = analysis;
    const chartType = suggestion.chartType;
    const insights = [];

    // Add chart-specific insights
    switch (chartType) {
      case "bar":
      case "horizontalBar":
        if (metadata.categoryCount > 10) {
          insights.push(
            `With ${metadata.categoryCount} categories, consider focusing on the most significant items or grouping minor categories.`
          );
        }
        if (metadata.hasNegativeValues) {
          insights.push(
            `This chart displays both positive and negative values, which is useful for showing contrasts or deviations from a baseline.`
          );
        }
        break;

      case "line":
        if (characteristics.trend && characteristics.trend.score > 0.6) {
          insights.push(
            `Line charts excel at showing trends over time, making patterns easily visible to students.`
          );
        }
        if (metadata.datasetCount > 1) {
          insights.push(
            `With ${metadata.datasetCount} data series, you can compare trends across different categories or variables.`
          );
        }
        break;

      case "pie":
      case "doughnut":
        if (metadata.categoryCount > 7) {
          insights.push(
            `For educational clarity, consider combining smaller segments into an "Other" category, as pie charts become harder to interpret with too many segments.`
          );
        }
        if (
          characteristics.part_to_whole &&
          characteristics.part_to_whole.score > 0.7
        ) {
          insights.push(
            `Pie charts are excellent for teaching about percentages, fractions, and how parts relate to a whole.`
          );
        }
        break;

      case "scatter":
        if (
          characteristics.correlation &&
          characteristics.correlation.score > 0.7
        ) {
          insights.push(
            `Scatter plots help students understand relationships between variables and concepts like correlation.`
          );
        }
        if (metadata.pointCount > 20) {
          insights.push(
            `With ${metadata.pointCount} data points, students can identify patterns, clusters, and outliers.`
          );
        }
        break;

      case "radar":
        if (metadata.categoryCount >= 3 && metadata.categoryCount <= 6) {
          insights.push(
            `Radar charts with ${metadata.categoryCount} axes provide a balanced visualisation for comparing multiple attributes.`
          );
        }
        insights.push(
          `This chart type works well for comparing holistic profiles, such as skill assessments or performance metrics.`
        );
        break;

      case "bubble":
        insights.push(
          `Bubble charts help students grasp three-dimensional relationships, adding complexity to their data analysis skills.`
        );
        break;
    }

    return insights.join(" ");
  }

  /**
   * Generate chart configuration based on suggestion and data
   * @param {Object} suggestion - Chart suggestion
   * @param {Object} data - Chart data
   * @param {Object} options - Configuration options
   * @returns {Object} Chart.js configuration
   */
  function generateChartConfig(suggestion, data, options = {}) {
    logInfo("Generating chart configuration", {
      chartType: suggestion.chartType,
    });

    // Extract chart type and ensure it exists
    const chartType = suggestion.chartType;
    if (!CHART_TYPES[chartType]) {
      const error = new Error(`Unknown chart type: ${chartType}`);
      logError("Chart configuration failed", { chartType });
      throw error;
    }

    // Normalise data if needed
    const normalizedData = normalizeDataFormat(data);

    // Start with basic configuration
    const config = {
      type: chartType,
      data: normalizedData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: options.title || `${CHART_TYPES[chartType].name}`,
          },
          subtitle: {
            display: !!options.subtitle,
            text: options.subtitle || "",
          },
          legend: {
            position: getLegendPosition(chartType, normalizedData),
          },
        },
      },
    };

    // Apply chart-specific configurations
    switch (chartType) {
      case "bar":
        config.options.scales = {
          y: {
            beginAtZero: !data.metadata?.hasNegativeValues,
            title: {
              display: true,
              text: options.yAxisTitle || "Values",
            },
          },
          x: {
            title: {
              display: true,
              text: options.xAxisTitle || "Categories",
            },
          },
        };
        break;

      case "horizontalBar":
        // Set type to bar with indexAxis = 'y' for horizontal bars
        config.type = "bar";
        config.options.indexAxis = "y";
        config.options.scales = {
          x: {
            beginAtZero: !data.metadata?.hasNegativeValues,
            title: {
              display: true,
              text: options.xAxisTitle || "Values",
            },
          },
          y: {
            title: {
              display: true,
              text: options.yAxisTitle || "Categories",
            },
          },
        };
        break;

      case "line":
        config.options.scales = {
          y: {
            title: {
              display: true,
              text: options.yAxisTitle || "Values",
            },
          },
          x: {
            title: {
              display: true,
              text:
                options.xAxisTitle ||
                (data.metadata?.hasTemporalLabels ? "Time" : "Categories"),
            },
          },
        };

        // Apply tension for smoother lines if it's a trend
        if (data.analysis?.characteristics?.trend?.score > 0.5) {
          config.data.datasets.forEach((dataset) => {
            dataset.tension = 0.3;
          });
        }
        break;

      case "pie":
      case "doughnut":
        // Move legend to right for pie/doughnut
        config.options.plugins.legend.position = "right";

        // Add doughnut specific options
        if (chartType === "doughnut") {
          config.options.cutout = "50%";
        }
        break;

      case "scatter":
        config.options.scales = {
          x: {
            type: "linear",
            position: "bottom",
            title: {
              display: true,
              text: options.xAxisTitle || "X Axis",
            },
          },
          y: {
            title: {
              display: true,
              text: options.yAxisTitle || "Y Axis",
            },
          },
        };
        break;

      case "bubble":
        config.options.scales = {
          x: {
            type: "linear",
            position: "bottom",
            title: {
              display: true,
              text: options.xAxisTitle || "X Axis",
            },
          },
          y: {
            title: {
              display: true,
              text: options.yAxisTitle || "Y Axis",
            },
          },
        };
        break;

      case "radar":
        config.options.scales = {
          r: {
            beginAtZero: !data.metadata?.hasNegativeValues,
            ticks: {
              showLabelBackdrop: true,
            },
          },
        };
        break;
    }

    // Add descriptive text if available
    if (options.includeEducationalContext && suggestion.educationalContext) {
      // Add descriptions for accessibility and context
      config.descriptions = {
        short: `${CHART_TYPES[chartType].name} showing ${
          normalizedData.datasets.length
        } data series with ${normalizedData.labels?.length || 0} categories.`,
        detailed: suggestion.educationalContext,
      };
    }

    // Apply any custom options
    if (options.chartOptions) {
      deepMerge(config, options.chartOptions);
    }

    logInfo("Chart configuration generated successfully", {
      type: config.type,
      hasScales: !!config.options.scales,
    });

    return config;
  }

  /**
   * Get appropriate legend position for chart type
   * @param {string} chartType - Chart type
   * @param {Object} data - Chart data
   * @returns {string} Legend position
   */
  function getLegendPosition(chartType, data) {
    switch (chartType) {
      case "pie":
      case "doughnut":
      case "polarArea":
        return "right";

      case "radar":
        return "top";

      default:
        // For other charts, use top if few datasets, otherwise right
        return data.datasets && data.datasets.length > 3 ? "right" : "top";
    }
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  function deepMerge(target, source) {
    if (!source) return target;

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          // Create key if it doesn't exist
          if (!target[key]) {
            target[key] = {};
          }

          // Recursive merge for objects
          deepMerge(target[key], source[key]);
        } else {
          // Direct assignment for primitives and arrays
          target[key] = source[key];
        }
      }
    }

    return target;
  }

  // Module initialisation
  logInfo("Chart Suggestion Engine initialised successfully", {
    chartTypes: Object.keys(CHART_TYPES).length,
    characteristics: Object.keys(DATA_CHARACTERISTICS).length,
    version: "1.0.0",
  });

  // Public API
  return {
    // Core analysis and suggestions
    analyzeData,
    suggestChartTypes,

    // Chart configuration
    generateChartConfig,

    // Chart type definitions
    getChartTypes: () => ({ ...CHART_TYPES }),

    // Configure the engine
    configure: function (options) {
      if (options.logLevel !== undefined) {
        if (LOG_LEVELS.hasOwnProperty(options.logLevel)) {
          currentLogLevel = LOG_LEVELS[options.logLevel];
          logInfo(
            `Logging level set to ${options.logLevel} (${currentLogLevel})`
          );
        } else {
          logWarn(
            `Invalid log level: ${
              options.logLevel
            }. Valid levels: ${Object.keys(LOG_LEVELS).join(", ")}`
          );
        }
      }

      Object.assign(CONFIG, options);
      logDebug("Configuration updated", CONFIG);
      return this;
    },

    // Logging controls
    setLogLevel: function (level) {
      if (typeof level === "string" && LOG_LEVELS.hasOwnProperty(level)) {
        currentLogLevel = LOG_LEVELS[level];
        logInfo(`Logging level set to ${level} (${currentLogLevel})`);
      } else if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        const levelName = Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        );
        logInfo(`Logging level set to ${levelName} (${level})`);
      } else {
        logWarn(
          `Invalid log level: ${level}. Valid levels: ${Object.keys(
            LOG_LEVELS
          ).join(", ")} or 0-3`
        );
      }
      return this;
    },

    getLogLevel: function () {
      const levelName = Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === currentLogLevel
      );
      return { level: currentLogLevel, name: levelName };
    },

    // Educational resources
    getEducationalResources: function (chartType) {
      const resources = {
        general: [
          {
            title: "Choosing the Right Chart Type",
            description:
              "Educational guide on selecting appropriate visualisations for different data types",
            url: "https://www.tableau.com/learn/whitepapers/which-chart-or-graph-is-right-for-you",
          },
          {
            title: "Data Visualisation Best Practices",
            description:
              "Guidelines for creating effective and honest data visualisations in education",
            url: "https://depictdatastudio.com/charts/",
          },
        ],
      };

      // Chart-specific resources
      const chartResources = {
        bar: [
          {
            title: "Teaching with Bar Charts",
            description:
              "Using bar charts to develop comparison and analytical skills",
            url: "https://www.teachervision.com/bar-graphs",
          },
        ],
        line: [
          {
            title: "Line Charts for Teaching Trends",
            description:
              "How to use line charts to demonstrate changes over time",
            url: "https://www.mathsisfun.com/data/line-graphs.html",
          },
        ],
        pie: [
          {
            title: "Teaching Fractions with Pie Charts",
            description:
              "Connecting pie charts to fraction concepts for younger students",
            url: "https://www.education.com/activity/article/Pie-Chart-Fractions/",
          },
        ],
        scatter: [
          {
            title: "Introducing Correlation with Scatter Plots",
            description:
              "Using scatter plots to teach statistical relationships",
            url: "https://www.mathsisfun.com/data/scatter-xy-plots.html",
          },
        ],
      };

      // Return either specific chart resources or general ones
      return {
        general: resources.general,
        specific: chartType ? chartResources[chartType] || [] : [],
      };
    },
  };
})();

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartSuggestionEngine;
} else {
  window.ChartSuggestionEngine = ChartSuggestionEngine;
}
