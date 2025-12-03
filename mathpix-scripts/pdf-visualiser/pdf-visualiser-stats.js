/**
 * @fileoverview PDF Visualiser Statistics Calculator
 * @module PDFVisualiserStats
 * @requires ./pdf-visualiser-config.js
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Provides comprehensive statistics calculation for PDF OCR confidence data.
 * Analyses lines.json data to generate document-level, page-level, and
 * per-category breakdowns of OCR confidence metrics.
 *
 * Key Features:
 * - Document-wide statistics aggregation
 * - Per-page confidence analysis
 * - Confidence level categorisation counts
 * - Line type distribution analysis
 * - Handwritten vs printed text breakdown
 * - Statistical calculations (mean, median, min, max, std dev)
 *
 * Integration:
 * - Used by pdf-visualiser-core.js for statistics display
 * - Receives data from MathPix lines.json API responses
 * - Provides data for statistics panel rendering
 *
 * Data Flow:
 * lines.json → parsePageData() → calculateStatistics() → Statistics Object
 *
 * Accessibility:
 * - Generates screen reader friendly summary text
 * - Provides structured data for accessible statistics display
 */

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

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
  if (shouldLog(LOG_LEVELS.ERROR)) console.error('[PDFVisualiserStats]', message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn('[PDFVisualiserStats]', message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log('[PDFVisualiserStats]', message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[PDFVisualiserStats]', message, ...args);
}

// =============================================================================
// IMPORTS
// =============================================================================

import PDF_VISUALISER_CONFIG, {
  getConfidenceLevelKey,
  formatPercentage
} from './pdf-visualiser-config.js';

// =============================================================================
// MAIN CLASS
// =============================================================================

/**
 * @class PDFVisualiserStats
 * @description Static utility class for calculating OCR confidence statistics
 *
 * Provides comprehensive statistical analysis of MathPix lines.json data,
 * generating document-wide and per-page metrics for confidence visualisation.
 *
 * All methods are static and stateless, enabling use without instantiation.
 *
 * @example
 * import PDFVisualiserStats from './pdf-visualiser-stats.js';
 *
 * const linesData = await apiClient.fetchLinesData(pdfId);
 * const stats = PDFVisualiserStats.calculateStatistics(linesData);
 * console.log(`Average confidence: ${stats.averageConfidence}`);
 *
 * @since 1.0.0
 */
class PDFVisualiserStats {

  // ===========================================================================
  // DOCUMENT-LEVEL STATISTICS
  // ===========================================================================

  /**
   * @method calculateStatistics
   * @static
   * @description Calculates comprehensive statistics for entire document
   *
   * Analyses all pages in the lines.json data to generate document-wide
   * statistics including total lines, average confidence, and breakdowns
   * by confidence level and line type.
   *
   * @param {Object} linesData - Complete lines.json response
   * @param {Array<Object>} linesData.pages - Array of page objects
   *
   * @returns {Object} Statistics object with comprehensive metrics
   * @returns {number} returns.totalPages - Total number of pages
   * @returns {number} returns.totalLines - Total number of lines analysed
   * @returns {number} returns.averageConfidence - Mean confidence (0-1)
   * @returns {number} returns.medianConfidence - Median confidence (0-1)
   * @returns {number} returns.minConfidence - Minimum confidence found
   * @returns {number} returns.maxConfidence - Maximum confidence found
   * @returns {number} returns.standardDeviation - Standard deviation of confidence
   * @returns {Object} returns.byLevel - Counts by confidence level
   * @returns {Object} returns.byType - Counts by line type
   * @returns {Object} returns.byWritingStyle - Counts for printed vs handwritten
   * @returns {Array<Object>} returns.pageStats - Per-page statistics array
   * @returns {string} returns.summaryText - Screen reader friendly summary
   *
   * @throws {Error} When linesData is invalid or missing pages array
   *
   * @example
   * const stats = PDFVisualiserStats.calculateStatistics(linesData);
   * console.log(`${stats.totalLines} lines with ${formatPercentage(stats.averageConfidence)} avg confidence`);
   *
   * @since 1.0.0
   */
  static calculateStatistics(linesData) {
    logInfo('Calculating document statistics');

    // Validate input
    if (!linesData || !Array.isArray(linesData.pages)) {
      logError('Invalid linesData: missing pages array');
      throw new Error('Invalid lines data: pages array is required');
    }

    const startTime = performance.now();

    // Collect all confidence values for statistical analysis
    const allConfidences = [];
    const byLevel = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      VERY_LOW: 0
    };
    const byType = {};
    const byWritingStyle = {
      printed: 0,
      handwritten: 0
    };

    // Calculate per-page statistics
    const pageStats = linesData.pages.map(page => {
      const pageStat = this.calculatePageStatistics(page);
      
      // Aggregate to document totals
      allConfidences.push(...pageStat.confidences);
      
      // Aggregate level counts
      for (const [level, count] of Object.entries(pageStat.byLevel)) {
        byLevel[level] = (byLevel[level] || 0) + count;
      }
      
      // Aggregate type counts
      for (const [type, count] of Object.entries(pageStat.byType)) {
        byType[type] = (byType[type] || 0) + count;
      }
      
      // Aggregate writing style counts
      byWritingStyle.printed += pageStat.printedCount;
      byWritingStyle.handwritten += pageStat.handwrittenCount;
      
      return pageStat;
    });

    // Calculate aggregate statistics
    const totalPages = linesData.pages.length;
    const totalLines = allConfidences.length;

    let averageConfidence = 0;
    let medianConfidence = 0;
    let minConfidence = 0;
    let maxConfidence = 0;
    let standardDeviation = 0;

    if (totalLines > 0) {
      // Sort for median and min/max
      const sorted = [...allConfidences].sort((a, b) => a - b);
      
      // Calculate mean
      averageConfidence = allConfidences.reduce((sum, c) => sum + c, 0) / totalLines;
      
      // Calculate median
      const mid = Math.floor(totalLines / 2);
      medianConfidence = totalLines % 2 !== 0 
        ? sorted[mid] 
        : (sorted[mid - 1] + sorted[mid]) / 2;
      
      // Min and max
      minConfidence = sorted[0];
      maxConfidence = sorted[sorted.length - 1];
      
      // Standard deviation
      const squaredDiffs = allConfidences.map(c => Math.pow(c - averageConfidence, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / totalLines;
      standardDeviation = Math.sqrt(variance);
    }

    // Generate summary text for screen readers
    const summaryText = this.generateSummaryText({
      totalPages,
      totalLines,
      averageConfidence,
      byLevel
    });

    const processingTime = performance.now() - startTime;

    const statistics = {
      totalPages,
      totalLines,
      averageConfidence,
      medianConfidence,
      minConfidence,
      maxConfidence,
      standardDeviation,
      byLevel,
      byType,
      byWritingStyle,
      pageStats,
      summaryText,
      calculatedAt: new Date().toISOString(),
      processingTimeMs: processingTime
    };

    logInfo('Document statistics calculated', {
      totalPages,
      totalLines,
      averageConfidence: formatPercentage(averageConfidence, 1),
      processingTime: `${processingTime.toFixed(2)}ms`
    });

    return statistics;
  }

  // ===========================================================================
  // PAGE-LEVEL STATISTICS
  // ===========================================================================

  /**
   * @method calculatePageStatistics
   * @static
   * @description Calculates statistics for a single page
   *
   * Analyses all lines on a page to generate page-specific metrics
   * including confidence distribution, line types, and writing styles.
   *
   * @param {Object} pageData - Single page object from lines.json
   * @param {number} pageData.page - Page number (1-indexed)
   * @param {number} pageData.page_width - Page width in pixels
   * @param {number} pageData.page_height - Page height in pixels
   * @param {Array<Object>} pageData.lines - Array of line objects
   *
   * @returns {Object} Page statistics object
   * @returns {number} returns.pageNumber - Page number
   * @returns {number} returns.lineCount - Number of lines on page
   * @returns {number} returns.averageConfidence - Page average confidence
   * @returns {number} returns.minConfidence - Minimum confidence on page
   * @returns {number} returns.maxConfidence - Maximum confidence on page
   * @returns {Object} returns.byLevel - Confidence level breakdown
   * @returns {Object} returns.byType - Line type breakdown
   * @returns {number} returns.printedCount - Number of printed text lines
   * @returns {number} returns.handwrittenCount - Number of handwritten lines
   * @returns {Array<number>} returns.confidences - Raw confidence values (for aggregation)
   * @returns {Object} returns.dimensions - Page dimensions
   *
   * @example
   * const pageStats = PDFVisualiserStats.calculatePageStatistics(linesData.pages[0]);
   * console.log(`Page ${pageStats.pageNumber}: ${pageStats.lineCount} lines`);
   *
   * @since 1.0.0
   */
  static calculatePageStatistics(pageData) {
    if (!pageData) {
      logWarn('calculatePageStatistics called with null pageData');
      return this.getEmptyPageStats(0);
    }

    const pageNumber = pageData.page || 0;
    const lines = pageData.lines || [];
    
    logDebug(`Calculating statistics for page ${pageNumber}`, {
      lineCount: lines.length
    });

    if (lines.length === 0) {
      return this.getEmptyPageStats(pageNumber, pageData);
    }

    // Collect metrics
    const confidences = [];
    const byLevel = { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 };
    const byType = {};
    let printedCount = 0;
    let handwrittenCount = 0;

    for (const line of lines) {
      // Use confidence_rate (geometric mean) as primary metric
      const confidence = line.confidence_rate ?? line.confidence ?? 0;
      confidences.push(confidence);

      // Categorise by confidence level
      const levelKey = getConfidenceLevelKey(confidence);
      byLevel[levelKey]++;

      // Count by type
      const lineType = line.type || 'unknown';
      byType[lineType] = (byType[lineType] || 0) + 1;

      // Count writing style
      if (line.is_handwritten) {
        handwrittenCount++;
      } else if (line.is_printed) {
        printedCount++;
      }
    }

    // Calculate statistics
    const sorted = [...confidences].sort((a, b) => a - b);
    const averageConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const minConfidence = sorted[0];
    const maxConfidence = sorted[sorted.length - 1];

    return {
      pageNumber,
      lineCount: lines.length,
      averageConfidence,
      minConfidence,
      maxConfidence,
      byLevel,
      byType,
      printedCount,
      handwrittenCount,
      confidences, // For document-level aggregation
      dimensions: {
        width: pageData.page_width,
        height: pageData.page_height
      }
    };
  }

  /**
   * @method getEmptyPageStats
   * @static
   * @description Returns empty statistics object for pages with no lines
   *
   * @param {number} pageNumber - Page number
   * @param {Object} [pageData] - Optional page data for dimensions
   * @returns {Object} Empty statistics object
   *
   * @private
   * @since 1.0.0
   */
  static getEmptyPageStats(pageNumber, pageData = null) {
    return {
      pageNumber,
      lineCount: 0,
      averageConfidence: 0,
      minConfidence: 0,
      maxConfidence: 0,
      byLevel: { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
      byType: {},
      printedCount: 0,
      handwrittenCount: 0,
      confidences: [],
      dimensions: pageData ? {
        width: pageData.page_width,
        height: pageData.page_height
      } : null
    };
  }

  // ===========================================================================
  // CONFIDENCE LEVEL ANALYSIS
  // ===========================================================================

  /**
   * @method countByConfidenceLevel
   * @static
   * @description Counts lines grouped by confidence level
   *
   * Provides a simple breakdown of line counts by confidence category
   * without full statistical analysis.
   *
   * @param {Object} linesData - Complete lines.json response
   * @returns {Object} Counts by level with percentages
   * @returns {Object} returns.HIGH - High confidence count and percentage
   * @returns {Object} returns.MEDIUM - Medium confidence count and percentage
   * @returns {Object} returns.LOW - Low confidence count and percentage
   * @returns {Object} returns.VERY_LOW - Very low confidence count and percentage
   * @returns {number} returns.total - Total line count
   *
   * @example
   * const counts = PDFVisualiserStats.countByConfidenceLevel(linesData);
   * console.log(`High confidence: ${counts.HIGH.count} (${counts.HIGH.percentage}%)`);
   *
   * @since 1.0.0
   */
  static countByConfidenceLevel(linesData) {
    logDebug('Counting lines by confidence level');

    if (!linesData || !Array.isArray(linesData.pages)) {
      return {
        HIGH: { count: 0, percentage: 0 },
        MEDIUM: { count: 0, percentage: 0 },
        LOW: { count: 0, percentage: 0 },
        VERY_LOW: { count: 0, percentage: 0 },
        total: 0
      };
    }

    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 };
    let total = 0;

    for (const page of linesData.pages) {
      for (const line of (page.lines || [])) {
        const confidence = line.confidence_rate ?? line.confidence ?? 0;
        const levelKey = getConfidenceLevelKey(confidence);
        counts[levelKey]++;
        total++;
      }
    }

    // Calculate percentages
    const result = { total };
    for (const [level, count] of Object.entries(counts)) {
      result[level] = {
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      };
    }

    logDebug('Confidence level counts', result);
    return result;
  }

  // ===========================================================================
  // PROBLEM DETECTION
  // ===========================================================================

  /**
   * @method findProblemLines
   * @static
   * @description Identifies lines with low confidence that may need review
   *
   * Finds all lines below a specified confidence threshold, useful for
   * identifying OCR problem areas that require manual verification.
   *
   * @param {Object} linesData - Complete lines.json response
   * @param {number} [threshold=0.8] - Confidence threshold (lines below this are flagged)
   * @returns {Array<Object>} Array of problem line objects with page and line info
   *
   * @example
   * const problems = PDFVisualiserStats.findProblemLines(linesData, 0.7);
   * console.log(`Found ${problems.length} lines needing review`);
   *
   * @since 1.0.0
   */
  static findProblemLines(linesData, threshold = 0.8) {
    logInfo('Finding problem lines', { threshold });

    const problemLines = [];

    if (!linesData || !Array.isArray(linesData.pages)) {
      return problemLines;
    }

    for (const page of linesData.pages) {
      const pageNumber = page.page;
      
      for (const line of (page.lines || [])) {
        const confidence = line.confidence_rate ?? line.confidence ?? 0;
        
        if (confidence < threshold) {
          problemLines.push({
            pageNumber,
            lineId: line.id,
            text: line.text,
            confidence,
            confidenceLevel: getConfidenceLevelKey(confidence),
            type: line.type,
            region: line.region,
            isHandwritten: line.is_handwritten
          });
        }
      }
    }

    // Sort by confidence (lowest first)
    problemLines.sort((a, b) => a.confidence - b.confidence);

    logInfo(`Found ${problemLines.length} problem lines below ${threshold * 100}% threshold`);
    return problemLines;
  }

  /**
   * @method getPageProblems
   * @static
   * @description Gets problem lines for a specific page
   *
   * @param {Object} pageData - Single page from lines.json
   * @param {number} [threshold=0.8] - Confidence threshold
   * @returns {Array<Object>} Problem lines on this page
   *
   * @since 1.0.0
   */
  static getPageProblems(pageData, threshold = 0.8) {
    if (!pageData || !Array.isArray(pageData.lines)) {
      return [];
    }

    return (pageData.lines || [])
      .filter(line => {
        const confidence = line.confidence_rate ?? line.confidence ?? 0;
        return confidence < threshold;
      })
      .map(line => ({
        lineId: line.id,
        text: line.text,
        confidence: line.confidence_rate ?? line.confidence ?? 0,
        confidenceLevel: getConfidenceLevelKey(line.confidence_rate ?? line.confidence ?? 0),
        type: line.type,
        region: line.region
      }))
      .sort((a, b) => a.confidence - b.confidence);
  }

  // ===========================================================================
  // SUMMARY GENERATION
  // ===========================================================================

  /**
   * @method generateSummaryText
   * @static
   * @description Generates screen reader friendly summary text
   *
   * Creates a natural language summary of document statistics
   * suitable for screen reader announcements and ARIA labels.
   *
   * @param {Object} stats - Statistics object
   * @param {number} stats.totalPages - Number of pages
   * @param {number} stats.totalLines - Number of lines
   * @param {number} stats.averageConfidence - Average confidence (0-1)
   * @param {Object} stats.byLevel - Confidence level breakdown
   *
   * @returns {string} Human-readable summary text
   *
   * @example
   * const summary = PDFVisualiserStats.generateSummaryText(stats);
   * // "5-page document with 127 lines analysed. Average confidence: 89%.
   * //  102 high confidence, 20 medium, 5 low, 0 very low."
   *
   * @since 1.0.0
   */
  static generateSummaryText(stats) {
    const { totalPages, totalLines, averageConfidence, byLevel } = stats;

    if (totalLines === 0) {
      return `${totalPages}-page document with no text lines detected.`;
    }

    const avgPercent = formatPercentage(averageConfidence, 0);
    
    const levelSummary = [
      byLevel.HIGH > 0 ? `${byLevel.HIGH} high confidence` : null,
      byLevel.MEDIUM > 0 ? `${byLevel.MEDIUM} medium` : null,
      byLevel.LOW > 0 ? `${byLevel.LOW} low` : null,
      byLevel.VERY_LOW > 0 ? `${byLevel.VERY_LOW} very low` : null
    ].filter(Boolean).join(', ');

    const pageWord = totalPages === 1 ? 'page' : 'pages';
    const lineWord = totalLines === 1 ? 'line' : 'lines';

    return `${totalPages}-${pageWord} document with ${totalLines} ${lineWord} analysed. ` +
           `Average confidence: ${avgPercent}. ${levelSummary}.`;
  }

  /**
   * @method generatePageSummary
   * @static
   * @description Generates summary text for a single page
   *
   * @param {Object} pageStats - Page statistics object
   * @returns {string} Page summary text
   *
   * @since 1.0.0
   */
  static generatePageSummary(pageStats) {
    const { pageNumber, lineCount, averageConfidence, byLevel } = pageStats;

    if (lineCount === 0) {
      return `Page ${pageNumber}: No text lines detected.`;
    }

    const avgPercent = formatPercentage(averageConfidence, 0);
    const lineWord = lineCount === 1 ? 'line' : 'lines';

    // Highlight any problem areas
    const lowCount = byLevel.LOW + byLevel.VERY_LOW;
    const problemNote = lowCount > 0 
      ? ` ${lowCount} ${lowCount === 1 ? 'line needs' : 'lines need'} review.`
      : '';

    return `Page ${pageNumber}: ${lineCount} ${lineWord}, ${avgPercent} average confidence.${problemNote}`;
  }

  // ===========================================================================
  // DATA FORMATTING
  // ===========================================================================

  /**
   * @method formatStatsForDisplay
   * @static
   * @description Formats statistics for UI display
   *
   * Transforms raw statistics into display-ready format with
   * formatted percentages and labels.
   *
   * @param {Object} stats - Raw statistics object
   * @returns {Object} Formatted statistics for display
   *
   * @since 1.0.0
   */
  static formatStatsForDisplay(stats) {
    const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;

    return {
      overview: {
        totalPages: stats.totalPages,
        totalLines: stats.totalLines,
        averageConfidence: formatPercentage(stats.averageConfidence, 1),
        medianConfidence: formatPercentage(stats.medianConfidence, 1),
        range: `${formatPercentage(stats.minConfidence, 0)} - ${formatPercentage(stats.maxConfidence, 0)}`
      },
      breakdown: [
        {
          level: 'HIGH',
          label: levels.HIGH.legendLabel,
          count: stats.byLevel.HIGH,
          colour: levels.HIGH.borderColour
        },
        {
          level: 'MEDIUM',
          label: levels.MEDIUM.legendLabel,
          count: stats.byLevel.MEDIUM,
          colour: levels.MEDIUM.borderColour
        },
        {
          level: 'LOW',
          label: levels.LOW.legendLabel,
          count: stats.byLevel.LOW,
          colour: levels.LOW.borderColour
        },
        {
          level: 'VERY_LOW',
          label: levels.VERY_LOW.legendLabel,
          count: stats.byLevel.VERY_LOW,
          colour: levels.VERY_LOW.borderColour
        }
      ],
      summary: stats.summaryText
    };
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * @method validateLinesData
   * @static
   * @description Validates lines.json data structure
   *
   * @param {Object} linesData - Data to validate
   * @returns {Object} Validation result with isValid flag and any errors
   *
   * @since 1.0.0
   */
  static validateLinesData(linesData) {
    const errors = [];

    if (!linesData) {
      errors.push('Lines data is null or undefined');
      return { isValid: false, errors };
    }

    if (!Array.isArray(linesData.pages)) {
      errors.push('Lines data missing pages array');
      return { isValid: false, errors };
    }

    // Validate page structure
    for (let i = 0; i < linesData.pages.length; i++) {
      const page = linesData.pages[i];
      
      if (typeof page.page !== 'number') {
        errors.push(`Page ${i}: missing page number`);
      }
      
      if (!Array.isArray(page.lines)) {
        errors.push(`Page ${i}: missing lines array`);
      }
      
      if (typeof page.page_width !== 'number' || typeof page.page_height !== 'number') {
        errors.push(`Page ${i}: missing page dimensions`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default PDFVisualiserStats;

export {
  PDFVisualiserStats
};

// =============================================================================
// GLOBAL EXPOSURE FOR TESTING
// =============================================================================

if (typeof window !== 'undefined') {
  window.PDFVisualiserStats = PDFVisualiserStats;

  /**
   * Test statistics calculation with sample data
   */
  window.testPDFStats = () => {
    console.log('🧪 Testing PDF Visualiser Statistics');

    // Create sample data
    const sampleData = {
      pages: [
        {
          page: 1,
          page_width: 2550,
          page_height: 3300,
          lines: [
            { id: '1', confidence_rate: 0.98, type: 'text', is_printed: true },
            { id: '2', confidence_rate: 0.85, type: 'math', is_printed: true },
            { id: '3', confidence_rate: 0.72, type: 'text', is_handwritten: true },
            { id: '4', confidence_rate: 0.45, type: 'text', is_handwritten: true }
          ]
        },
        {
          page: 2,
          page_width: 2550,
          page_height: 3300,
          lines: [
            { id: '5', confidence_rate: 0.99, type: 'text', is_printed: true },
            { id: '6', confidence_rate: 0.92, type: 'table', is_printed: true }
          ]
        }
      ]
    };

    // Test full statistics
    console.log('📊 Full Statistics:');
    const stats = PDFVisualiserStats.calculateStatistics(sampleData);
    console.table({
      'Total Pages': stats.totalPages,
      'Total Lines': stats.totalLines,
      'Average Confidence': formatPercentage(stats.averageConfidence, 1),
      'Min Confidence': formatPercentage(stats.minConfidence, 1),
      'Max Confidence': formatPercentage(stats.maxConfidence, 1)
    });

    console.log('📈 By Level:', stats.byLevel);
    console.log('📝 By Type:', stats.byType);
    console.log('✍️ Writing Style:', stats.byWritingStyle);
    console.log('💬 Summary:', stats.summaryText);

    // Test problem detection
    console.log('\n⚠️ Problem Lines (below 80%):');
    const problems = PDFVisualiserStats.findProblemLines(sampleData, 0.8);
    console.table(problems.map(p => ({
      Page: p.pageNumber,
      Confidence: formatPercentage(p.confidence, 1),
      Level: p.confidenceLevel
    })));

    console.log('\n✅ Statistics tests complete');
    return stats;
  };
}
