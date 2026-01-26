/**
 * @fileoverview MathPix Confidence Mapper - Phase 8.3.4
 * @module MathPixConfidenceMapper
 * @version 1.0.0
 * @since 8.3.4
 *
 * @description
 * Maps OCR confidence data from lines.json to MMD content lines.
 * Enables confidence highlighting in the Resume Mode MMD editor
 * to help users identify uncertain OCR regions that may need correction.
 *
 * Key Features:
 * - Text matching between lines.json and MMD content
 * - Confidence level categorisation (HIGH, MEDIUM, LOW, VERY_LOW)
 * - Stale detection when content is edited
 * - Integration with existing PDF Visualiser colour scheme
 *
 * Dependencies:
 * - None (standalone module)
 * - Optional: PDF_VISUALISER_CONFIG for colour consistency
 *
 * @accessibility
 * - WCAG 2.2 AA compliant colour contrast
 * - Screen reader friendly level descriptions
 * - Keyboard accessible gutter indicators
 *
 * @author MathPix Development Team
 */

// Wrap in IIFE to avoid global variable conflicts
(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION (scoped to IIFE)
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  /**
   * Determines if a message should be logged based on current configuration
   * @param {number} level - The log level to check
   * @returns {boolean} True if the message should be logged
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  /**
   * Logs error messages if error logging is enabled
   * @param {string} message - The error message to log
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ConfidenceMapper] ${message}`, ...args);
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ConfidenceMapper] ${message}`, ...args);
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ConfidenceMapper] ${message}`, ...args);
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ConfidenceMapper] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Configuration constants for confidence mapping
   * Aligned with PDF_VISUALISER_CONFIG thresholds for consistency
   * @constant {Object}
   */
  const CONFIDENCE_MAPPER_CONFIG = {
    /**
     * Confidence level thresholds
     * Matches PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS for consistency
     */
    THRESHOLDS: {
      HIGH: 0.95, // ≥95% confidence
      MEDIUM: 0.8, // 80-94% confidence
      LOW: 0.6, // 60-79% confidence
      // Below 60% = VERY_LOW
    },

    /**
     * Minimum text length for matching (avoids false positives)
     */
    MIN_MATCH_LENGTH: 3,

    /**
     * CSS classes for confidence levels (used in gutter indicators)
     */
    CSS_CLASSES: {
      HIGH: "mmd-confidence--high",
      MEDIUM: "mmd-confidence--medium",
      LOW: "mmd-confidence--low",
      VERY_LOW: "mmd-confidence--very-low",
      STALE: "mmd-confidence--stale",
    },

    /**
     * Accessible labels for each confidence level
     */
    ARIA_LABELS: {
      HIGH: "High confidence, 95% or above",
      MEDIUM: "Medium confidence, 80% to 94%",
      LOW: "Low confidence, 60% to 79%",
      VERY_LOW: "Very low confidence, below 60%",
      STALE: "Confidence data may be outdated due to edits",
    },

    /**
     * User-facing messages (British spelling)
     */
    MESSAGES: {
      ENABLED: "Confidence highlighting enabled",
      DISABLED: "Confidence highlighting disabled",
      STALE_WARNING: "Confidence data may be outdated due to edits",
      NO_DATA: "No confidence data available for this line",
    },
  };

  // ============================================================================
  // MAIN CLASS
  // ============================================================================

  /**
   * Maps OCR confidence data to MMD content lines
   *
   * Provides text matching between lines.json OCR data and the actual
   * MMD content to enable line-by-line confidence highlighting.
   *
   * @class MathPixConfidenceMapper
   * @since 8.3.4
   */
  class MathPixConfidenceMapper {
    /**
     * Create a new MathPixConfidenceMapper instance
     */
    constructor() {
      logInfo("Creating MathPixConfidenceMapper instance");

      /**
       * Map of MMD line numbers (1-indexed) to confidence data
       * @type {Map<number, Object>}
       */
      this.confidenceMap = new Map();

      /**
       * Original MMD content used for mapping (for stale detection)
       * @type {string|null}
       */
      this.mappedContent = null;

      /**
       * Whether the confidence data is stale (content has been edited)
       * @type {boolean}
       */
      this.isStale = false;

      /**
       * Statistics about the mapping
       * @type {Object}
       */
      this.stats = {
        totalLines: 0,
        mappedLines: 0,
        high: 0,
        medium: 0,
        low: 0,
        veryLow: 0,
      };
    }

    // ==========================================================================
    // MAPPING METHODS
    // ==========================================================================

    /**
     * Build a confidence map from lines data and MMD content
     *
     * @param {Object} linesData - Parsed lines.json data
     * @param {string} mmdContent - Current MMD content
     * @returns {Map<number, Object>} Map of line numbers to confidence data
     */
    buildConfidenceMap(linesData, mmdContent) {
      logDebug("Building confidence map", {
        hasLinesData: !!linesData,
        contentLength: mmdContent?.length,
      });

      // Reset state
      this.confidenceMap.clear();
      this.isStale = false;
      this.mappedContent = mmdContent;
      this.stats = {
        totalLines: 0,
        mappedLines: 0,
        high: 0,
        medium: 0,
        low: 0,
        veryLow: 0,
      };

      if (!linesData || !mmdContent) {
        logWarn("Missing linesData or mmdContent");
        return this.confidenceMap;
      }

      const mmdLines = mmdContent.split("\n");
      this.stats.totalLines = mmdLines.length;

      // Handle both formats: { pages: [...] } or direct array
      const pages =
        linesData.pages ||
        (Array.isArray(linesData) ? [{ lines: linesData }] : []);

      if (pages.length === 0) {
        logWarn("No pages found in linesData");
        return this.confidenceMap;
      }

      // Process each page
      for (const page of pages) {
        const lines = page.lines || [];

        for (const line of lines) {
          // Get confidence value (prefer confidence_rate, fall back to confidence)
          const confidence = line.confidence_rate ?? line.confidence ?? null;

          if (confidence === null) {
            continue; // Skip lines without confidence data
          }

          // Get searchable text (prefer text_display for better matching)
          const searchText = this.normaliseText(
            line.text_display || line.text || ""
          );

          if (searchText.length < CONFIDENCE_MAPPER_CONFIG.MIN_MATCH_LENGTH) {
            continue; // Skip very short text
          }

          // Find matching MMD line(s)
          this.findAndMapMatches(mmdLines, searchText, {
            confidence: confidence,
            confidenceRate: line.confidence_rate,
            type: line.type,
            isHandwritten: line.is_handwritten,
            isPrinted: line.is_printed,
            originalText: line.text_display || line.text,
            page: page.page || 1,
          });
        }
      }

      // Calculate statistics
      this.calculateStats();

      logInfo("Confidence map built", {
        totalLines: this.stats.totalLines,
        mappedLines: this.stats.mappedLines,
        distribution: {
          high: this.stats.high,
          medium: this.stats.medium,
          low: this.stats.low,
          veryLow: this.stats.veryLow,
        },
      });

      return this.confidenceMap;
    }

    /**
     * Find matching MMD lines and add to confidence map
     *
     * @param {string[]} mmdLines - Array of MMD content lines
     * @param {string} searchText - Normalised text to search for
     * @param {Object} confidenceData - Confidence data to associate
     * @private
     */
    findAndMapMatches(mmdLines, searchText, confidenceData) {
      for (let i = 0; i < mmdLines.length; i++) {
        const lineNum = i + 1; // 1-indexed line numbers

        // Skip if already mapped (first match wins)
        if (this.confidenceMap.has(lineNum)) {
          continue;
        }

        const mmdLineNorm = this.normaliseText(mmdLines[i]);

        if (this.isSubstantialMatch(mmdLineNorm, searchText)) {
          this.confidenceMap.set(lineNum, {
            ...confidenceData,
            level: this.getConfidenceLevel(confidenceData.confidence),
            levelKey: this.getConfidenceLevelKey(confidenceData.confidence),
          });
        }
      }
    }

    /**
     * Check if MMD line substantially matches search text
     *
     * Uses fuzzy matching to handle minor differences in whitespace,
     * line breaks, and formatting.
     *
     * @param {string} mmdLine - Normalised MMD line
     * @param {string} searchText - Normalised search text
     * @returns {boolean} True if substantial match found
     */
    isSubstantialMatch(mmdLine, searchText) {
      if (!mmdLine || !searchText) return false;

      // Direct inclusion (handles partial matches)
      if (mmdLine.includes(searchText) || searchText.includes(mmdLine)) {
        return true;
      }

      // Check for significant overlap (at least 70% of shorter string)
      const shorter = mmdLine.length < searchText.length ? mmdLine : searchText;
      const longer = mmdLine.length >= searchText.length ? mmdLine : searchText;

      const overlapThreshold = Math.floor(shorter.length * 0.7);
      if (overlapThreshold < CONFIDENCE_MAPPER_CONFIG.MIN_MATCH_LENGTH) {
        return false;
      }

      // Sliding window match for significant substring
      for (let i = 0; i <= longer.length - overlapThreshold; i++) {
        const substring = longer.substring(i, i + overlapThreshold);
        if (shorter.includes(substring)) {
          return true;
        }
      }

      return false;
    }

    /**
     * Normalise text for comparison
     *
     * - Converts to lowercase
     * - Collapses whitespace
     * - Removes leading/trailing whitespace
     * - Removes common LaTeX formatting
     *
     * @param {string} text - Text to normalise
     * @returns {string} Normalised text
     */
    normaliseText(text) {
      if (!text) return "";

      return text
        .toLowerCase()
        .replace(/\s+/g, " ") // Collapse whitespace
        .replace(/^\s+|\s+$/g, "") // Trim
        .replace(/\\[a-z]+\{([^}]*)\}/gi, "$1") // Strip simple LaTeX commands
        .replace(/\$+/g, "") // Remove math delimiters
        .replace(/[{}\\]/g, ""); // Remove remaining LaTeX syntax
    }

    /**
     * Calculate statistics from the confidence map
     * @private
     */
    calculateStats() {
      this.stats.mappedLines = this.confidenceMap.size;

      let high = 0,
        medium = 0,
        low = 0,
        veryLow = 0;

      this.confidenceMap.forEach((data) => {
        switch (data.levelKey) {
          case "HIGH":
            high++;
            break;
          case "MEDIUM":
            medium++;
            break;
          case "LOW":
            low++;
            break;
          case "VERY_LOW":
            veryLow++;
            break;
        }
      });

      this.stats.high = high;
      this.stats.medium = medium;
      this.stats.low = low;
      this.stats.veryLow = veryLow;
    }

    // ==========================================================================
    // CONFIDENCE LEVEL METHODS
    // ==========================================================================

    /**
     * Get confidence level information for a score
     *
     * @param {number} confidence - Confidence score (0-1)
     * @returns {Object} Level info with name, cssClass, ariaLabel
     */
    getConfidenceLevel(confidence) {
      const key = this.getConfidenceLevelKey(confidence);
      const thresholds = CONFIDENCE_MAPPER_CONFIG.THRESHOLDS;
      const cssClasses = CONFIDENCE_MAPPER_CONFIG.CSS_CLASSES;
      const ariaLabels = CONFIDENCE_MAPPER_CONFIG.ARIA_LABELS;

      const levels = {
        HIGH: {
          name: "High",
          minThreshold: thresholds.HIGH,
          cssClass: cssClasses.HIGH,
          ariaLabel: ariaLabels.HIGH,
        },
        MEDIUM: {
          name: "Medium",
          minThreshold: thresholds.MEDIUM,
          cssClass: cssClasses.MEDIUM,
          ariaLabel: ariaLabels.MEDIUM,
        },
        LOW: {
          name: "Low",
          minThreshold: thresholds.LOW,
          cssClass: cssClasses.LOW,
          ariaLabel: ariaLabels.LOW,
        },
        VERY_LOW: {
          name: "Very Low",
          minThreshold: 0,
          cssClass: cssClasses.VERY_LOW,
          ariaLabel: ariaLabels.VERY_LOW,
        },
      };

      return levels[key] || levels.VERY_LOW;
    }

    /**
     * Get confidence level key from score
     *
     * @param {number} confidence - Confidence score (0-1)
     * @returns {string} Level key: 'HIGH', 'MEDIUM', 'LOW', or 'VERY_LOW'
     */
    getConfidenceLevelKey(confidence) {
      const thresholds = CONFIDENCE_MAPPER_CONFIG.THRESHOLDS;

      if (confidence >= thresholds.HIGH) return "HIGH";
      if (confidence >= thresholds.MEDIUM) return "MEDIUM";
      if (confidence >= thresholds.LOW) return "LOW";
      return "VERY_LOW";
    }

    // ==========================================================================
    // QUERY METHODS
    // ==========================================================================

    /**
     * Get confidence data for a specific line
     *
     * @param {number} lineNumber - 1-indexed line number
     * @returns {Object|null} Confidence data or null if not mapped
     */
    getLineConfidence(lineNumber) {
      return this.confidenceMap.get(lineNumber) || null;
    }

    /**
     * Check if a line has confidence data
     *
     * @param {number} lineNumber - 1-indexed line number
     * @returns {boolean} True if line has confidence data
     */
    hasLineConfidence(lineNumber) {
      return this.confidenceMap.has(lineNumber);
    }

    /**
     * Get all lines with confidence below a threshold
     *
     * @param {number} threshold - Confidence threshold (0-1)
     * @returns {Array<{lineNumber: number, data: Object}>} Lines below threshold
     */
    getLinesNeedingReview(
      threshold = CONFIDENCE_MAPPER_CONFIG.THRESHOLDS.MEDIUM
    ) {
      const results = [];

      this.confidenceMap.forEach((data, lineNumber) => {
        if (data.confidence < threshold) {
          results.push({ lineNumber, data });
        }
      });

      // Sort by confidence (lowest first)
      return results.sort((a, b) => a.data.confidence - b.data.confidence);
    }

    /**
     * Get statistics about the confidence mapping
     *
     * @returns {Object} Statistics object
     */
    getStats() {
      return { ...this.stats };
    }

    // ==========================================================================
    // STALE DETECTION
    // ==========================================================================

    /**
     * Mark the confidence data as stale
     *
     * Called when content is edited after mapping was performed.
     */
    markAsStale() {
      if (!this.isStale) {
        this.isStale = true;
        logInfo("Confidence data marked as stale");
      }
    }

    /**
     * Check if confidence data matches current content
     *
     * @param {string} currentContent - Current MMD content
     * @returns {boolean} True if content has changed since mapping
     */
    isContentChanged(currentContent) {
      return this.mappedContent !== currentContent;
    }

    /**
     * Refresh the mapping with new content
     *
     * @param {Object} linesData - Lines data (reused from original)
     * @param {string} newContent - New MMD content
     * @returns {Map<number, Object>} Updated confidence map
     */
    refreshMapping(linesData, newContent) {
      logInfo("Refreshing confidence mapping");
      return this.buildConfidenceMap(linesData, newContent);
    }

    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================

    /**
     * Format confidence as percentage string
     *
     * @param {number} confidence - Confidence score (0-1)
     * @param {number} [decimals=1] - Decimal places
     * @returns {string} Formatted percentage
     */
    formatConfidencePercent(confidence, decimals = 1) {
      return `${(confidence * 100).toFixed(decimals)}%`;
    }

    /**
     * Build tooltip content for a line
     *
     * @param {number} lineNumber - 1-indexed line number
     * @returns {string} Tooltip HTML content
     */
    buildTooltipContent(lineNumber) {
      const data = this.getLineConfidence(lineNumber);

      if (!data) {
        return CONFIDENCE_MAPPER_CONFIG.MESSAGES.NO_DATA;
      }

      const percent = this.formatConfidencePercent(data.confidence);
      const level = data.level.name;
      const type = data.type || "text";

      let content = `<strong>Line ${lineNumber}</strong><br>`;
      content += `Confidence: ${percent}<br>`;
      content += `Level: ${level}<br>`;
      content += `Type: ${type}`;

      if (data.isHandwritten) {
        content += "<br><em>(Handwritten)</em>";
      }

      if (this.isStale) {
        content += `<br><small>${CONFIDENCE_MAPPER_CONFIG.MESSAGES.STALE_WARNING}</small>`;
      }

      return content;
    }

    /**
     * Build accessible label for a line
     *
     * @param {number} lineNumber - 1-indexed line number
     * @returns {string} Screen reader friendly label
     */
    buildAccessibleLabel(lineNumber) {
      const data = this.getLineConfidence(lineNumber);

      if (!data) {
        return `Line ${lineNumber}: No confidence data`;
      }

      const percent = this.formatConfidencePercent(data.confidence, 0);
      const levelLabel = data.level.ariaLabel;

      let label = `Line ${lineNumber}: ${percent} confidence. ${levelLabel}`;

      if (this.isStale) {
        label += ". " + CONFIDENCE_MAPPER_CONFIG.ARIA_LABELS.STALE;
      }

      return label;
    }

    /**
     * Clear the confidence map
     */
    clear() {
      this.confidenceMap.clear();
      this.mappedContent = null;
      this.isStale = false;
      this.stats = {
        totalLines: 0,
        mappedLines: 0,
        high: 0,
        medium: 0,
        low: 0,
        veryLow: 0,
      };
      logDebug("Confidence map cleared");
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE FOR TESTING AND INTEGRATION
  // ============================================================================

  // Expose class globally
  window.MathPixConfidenceMapper = MathPixConfidenceMapper;

  // Expose config for debugging
  window.CONFIDENCE_MAPPER_CONFIG = CONFIDENCE_MAPPER_CONFIG;

  // ============================================================================
  // CONSOLE TEST COMMANDS
  // ============================================================================

  /**
   * Test confidence mapping with current session data
   * @returns {Map|null} Confidence map or null if no data
   */
  window.testConfidenceMapping = async function () {
    console.log("🧪 Testing Confidence Mapping");
    console.log("=============================\n");

    const restorer = window.getMathPixSessionRestorer?.();

    if (!restorer) {
      console.log("❌ Session restorer not available");
      console.log("   Load a ZIP file first using Resume Mode");
      return null;
    }

    if (!restorer.restoredSession?.linesData) {
      console.log("❌ No lines data available");
      console.log("   Load a ZIP containing lines.json");
      return null;
    }

    const mapper = new MathPixConfidenceMapper();
    const map = mapper.buildConfidenceMap(
      restorer.restoredSession.linesData,
      restorer.restoredSession.currentMMD
    );

    const stats = mapper.getStats();

    console.log(
      `✅ Mapped ${stats.mappedLines} of ${stats.totalLines} lines\n`
    );
    console.log("Distribution:");
    console.log(`   🟢 High (≥95%):     ${stats.high}`);
    console.log(`   🟡 Medium (80-94%): ${stats.medium}`);
    console.log(`   🟠 Low (60-79%):    ${stats.low}`);
    console.log(`   🔴 Very Low (<60%): ${stats.veryLow}`);

    // Show lines needing review
    const needsReview = mapper.getLinesNeedingReview(0.8);
    if (needsReview.length > 0) {
      console.log(`\n⚠️ ${needsReview.length} lines need review:`);
      needsReview.slice(0, 5).forEach(({ lineNumber, data }) => {
        console.log(
          `   Line ${lineNumber}: ${mapper.formatConfidencePercent(
            data.confidence
          )} - "${data.originalText?.substring(0, 40)}..."`
        );
      });
      if (needsReview.length > 5) {
        console.log(`   ... and ${needsReview.length - 5} more`);
      }
    }

    return map;
  };

  /**
   * Validate Phase 8.3.4 implementation
   * @returns {boolean} True if all checks pass
   */
  window.validatePhase834 = function () {
    console.log("🧪 Phase 8.3.4 Validation");
    console.log("=========================\n");

    const checks = {
      "MathPixConfidenceMapper class exists":
        typeof window.MathPixConfidenceMapper === "function",
      "CONFIDENCE_MAPPER_CONFIG exists":
        typeof window.CONFIDENCE_MAPPER_CONFIG === "object",
      "Mapper can be instantiated": (() => {
        try {
          new MathPixConfidenceMapper();
          return true;
        } catch (e) {
          return false;
        }
      })(),
      "Toggle checkbox exists": !!document.getElementById(
        "resume-mmd-show-confidence"
      ),
      "Gutter element exists": !!document.getElementById(
        "resume-mmd-confidence-gutter"
      ),
      "Session restorer available": !!window.getMathPixSessionRestorer,
    };

    let passed = 0;
    Object.entries(checks).forEach(([name, result]) => {
      console.log(`${result ? "✅" : "❌"} ${name}`);
      if (result) passed++;
    });

    console.log(`\n${passed}/${Object.keys(checks).length} checks passed`);

    return passed === Object.keys(checks).length;
  };

  logInfo("MathPix Confidence Mapper loaded");
})();
