/**
 * @module ContentProcessor
 * @description Orchestrates content processing using specialised processors
 */
import { ResultsManagerUtils } from "./results-manager-utils.js";
import { ContentProcessorState } from "./results-manager-content-state.js";
import { MathContentProcessor } from "./results-manager-content-math.js";
import { CodeContentProcessor } from "./results-manager-content-code.js";
import { StreamingContentProcessor } from "./results-manager-content-streaming.js";
import { AccessibilityContentProcessor } from "./results-manager-content-accessibility.js";
import { InlineContentProcessor } from "./results-manager-content-inline.js";
import { BlockContentProcessor } from "./results-manager-content-block.js";
import { TableContentProcessor } from "./results-manager-content-table.js";
import { ListContentProcessor } from "./results-manager-content-list.js";
import { EmojiContentProcessor } from "./results-manager-content-emoji.js";
import { DefinitionListProcessor } from "./results-manager-content-definition-list.js";
import { MarkdownItBridge } from "./results-manager-content-markdownit-bridge.js";

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

export class ContentProcessor {
  /**
   * Create a new ContentProcessor instance
   */
  constructor() {
    this.utils = new ResultsManagerUtils();

    // Initialise logging configuration
    this.currentLogLevel = DEFAULT_LOG_LEVEL;
    this.allLoggingEnabled = ENABLE_ALL_LOGGING;
    this.allLoggingDisabled = DISABLE_ALL_LOGGING;

    // Create shared state for processors
    this.state = new ContentProcessorState();

    // Initialise specialised processors
    this.mathProcessor = new MathContentProcessor(this.state);
    this.codeProcessor = new CodeContentProcessor();
    this.streamingProcessor = new StreamingContentProcessor();
    this.accessibilityProcessor = new AccessibilityContentProcessor();
    this.inlineProcessor = new InlineContentProcessor();
    this.markdownItBridge = new MarkdownItBridge();

    // Create BlockContentProcessor
    this.blockProcessor = new BlockContentProcessor();

    // Set this instance as the contentProcessorInstance in BlockContentProcessor
    // This must happen before any other processors that might use BlockContentProcessor
    BlockContentProcessor.contentProcessorInstance = this;
    this.log(
      "Set this ContentProcessor as the BlockContentProcessor.contentProcessorInstance",
      LOG_LEVELS.INFO
    );

    this.tableProcessor = new TableContentProcessor();
    this.listProcessor = new ListContentProcessor();
    this.emojiProcessor = new EmojiContentProcessor();
    this.definitionListProcessor = new DefinitionListProcessor();

    this.log("Content processor orchestrator initialised", LOG_LEVELS.INFO);

    // We now set the instance directly in the constructor, so no need to call setBlockProcessorInstance
  }

  /**
   * Check if logging should occur at the specified level
   * @param {number} level - Log level to check
   * @returns {boolean} True if logging should occur
   */
  shouldLog(level) {
    if (this.allLoggingDisabled) return false;
    if (this.allLoggingEnabled) return true;
    return level <= this.currentLogLevel;
  }

  /**
   * Log a message at the specified level
   * @param {string} message - Message to log
   * @param {number} level - Log level
   * @param {Object} data - Additional data to log (optional)
   */
  log(message, level = LOG_LEVELS.INFO, data = null) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const levelNames = { 0: "ERROR", 1: "WARN", 2: "INFO", 3: "DEBUG" };
    const levelName = levelNames[level] || "UNKNOWN";

    const logMessage = `[${timestamp}] [${levelName}] ${message}`;

    switch (level) {
      case LOG_LEVELS.ERROR:
        if (data) {
          console.error(logMessage, data);
        } else {
          console.error(logMessage);
        }
        break;
      case LOG_LEVELS.WARN:
        if (data) {
          console.warn(logMessage, data);
        } else {
          console.warn(logMessage);
        }
        break;
      case LOG_LEVELS.INFO:
        if (data) {
          console.log(logMessage, data);
        } else {
          console.log(logMessage);
        }
        break;
      case LOG_LEVELS.DEBUG:
        if (data) {
          console.log(logMessage, data);
        } else {
          console.log(logMessage);
        }
        break;
      default:
        console.log(logMessage, data);
    }
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Object} data - Additional error data (optional)
   */
  logError(message, data = null) {
    this.log(message, LOG_LEVELS.ERROR, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional warning data (optional)
   */
  logWarn(message, data = null) {
    this.log(message, LOG_LEVELS.WARN, data);
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object} data - Additional info data (optional)
   */
  logInfo(message, data = null) {
    this.log(message, LOG_LEVELS.INFO, data);
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional debug data (optional)
   */
  logDebug(message, data = null) {
    this.log(message, LOG_LEVELS.DEBUG, data);
  }

  /**
   * Enhanced diagnostic logging for table detection
   * @param {string} content - Content to analyse
   * @param {string} context - Context where this is being called from
   */
  diagnosticTableAnalysis(content, context = "unknown") {
    if (!content || typeof content !== "string") return;

    const pipeCount = (content.match(/\|/g) || []).length;
    if (pipeCount === 0) return; // No pipes, no need to analyse

    const lines = content.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

    // Find all lines containing pipes
    const pipeLines = lines
      .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
      .filter(({ line }) => line.includes("|"));

    // Analyse pipe contexts
    const pipeContexts = [];
    for (const { line, lineNumber } of pipeLines) {
      const context = {
        lineNumber,
        content: line,
        length: line.length,
        isHtmlComment: line.startsWith("<!--"),
        isCodeBlock: line.startsWith("```"),
        isHtmlTag: line.startsWith("<"),
        isHeader: line.startsWith("#"),
        startsWithPipe: line.startsWith("|"),
        endsWithPipe: line.endsWith("|"),
        pipeCount: (line.match(/\|/g) || []).length,
        likelyTable:
          line.startsWith("|") &&
          line.endsWith("|") &&
          line.split("|").length > 2,
        headerSeparator: /^\|[\s]*:?-+:?[\s]*(\|[\s]*:?-+:?[\s]*)+\|?$/.test(
          line
        ),
      };
      pipeContexts.push(context);
    }

    // Determine likely content source
    let contentSource = "unknown";
    if (content.includes("<html") || content.includes("<!DOCTYPE")) {
      contentSource = "HTML document";
    } else if (content.includes("```")) {
      contentSource = "code blocks";
    } else if (content.includes("<!--")) {
      contentSource = "HTML comments";
    } else if (content.length < 100 && pipeCount < 5) {
      contentSource = "short text fragment";
    } else if (content.includes("\n|") && content.includes("|-")) {
      contentSource = "markdown table";
    }

    this.logDebug(`🔍 ENHANCED ANALYSIS (${context}):`, {
      contentLength: content.length,
      contentType: typeof content,
      contentSource: contentSource,
      totalLines: lines.length,
      nonEmptyLines: nonEmptyLines.length,
      totalPipes: pipeCount,
      pipeLines: pipeLines.length,
      contentPreview:
        content.substring(0, 150) + (content.length > 150 ? "..." : ""),
      contentEnd:
        content.length > 150
          ? "..." + content.substring(content.length - 50)
          : "",
      pipeAnalysis: pipeContexts,
      looksLikeTable: this.looksLikeMarkdownTable(content),
      timestamp: new Date().toISOString(),
    });

    // Special analysis for false positives
    if (content.includes("|") && !this.looksLikeMarkdownTable(content)) {
      this.logDebug(`❌ FALSE POSITIVE ANALYSIS (${context}):`, {
        reason: "Contains pipes but not a markdown table",
        suspiciousContent: content.substring(0, 300),
        pipeLocations: this.findPipeLocations(content),
        recommendations: this.getFalsePositiveRecommendations(content),
      });
    }
  }

  /**
   * Find locations of pipe characters in content
   * @param {string} content - Content to analyse
   * @returns {Array} Array of pipe locations with context
   */
  findPipeLocations(content) {
    const locations = [];
    const lines = content.split("\n");

    lines.forEach((line, lineIndex) => {
      let charIndex = 0;
      for (const char of line) {
        if (char === "|") {
          locations.push({
            line: lineIndex + 1,
            char: charIndex + 1,
            context: line.substring(
              Math.max(0, charIndex - 10),
              charIndex + 10
            ),
            fullLine: line.trim(),
          });
        }
        charIndex++;
      }
    });

    return locations.slice(0, 10); // Limit to first 10 for readability
  }

  /**
   * Get recommendations for avoiding false positives
   * @param {string} content - Content that triggered false positive
   * @returns {Array} Array of recommendations
   */
  getFalsePositiveRecommendations(content) {
    const recommendations = [];

    if (content.includes("<")) {
      recommendations.push(
        "Content contains HTML - should be excluded from table detection"
      );
    }
    if (content.includes("```")) {
      recommendations.push(
        "Content contains code blocks - should be excluded from table detection"
      );
    }
    if (content.includes("<!--")) {
      recommendations.push(
        "Content contains HTML comments - should be excluded from table detection"
      );
    }
    if (!content.includes("|-") && !content.includes("|:")) {
      recommendations.push(
        "No header separator found - not a valid markdown table"
      );
    }
    if (
      content.split("\n").filter((line) => line.trim().startsWith("|")).length <
      2
    ) {
      recommendations.push(
        "Insufficient table-like lines - not a valid markdown table"
      );
    }

    return recommendations;
  }

  /**
   * Get SVG icon for copy button
   * @returns {string} SVG icon markup
   */
  getCopyButtonIcon() {
    return this.codeProcessor.processorUtils.getCopyButtonIcon();
  }

  /**
   * Process and sanitise content, converting Markdown to HTML
   * @param {string} content - Raw content to process
   * @returns {Promise<string>} Processed HTML content
   */
  async processContent(content) {
    if (!content) return "";

    try {
      // 🔍 ADD ENHANCED DIAGNOSTIC LOGGING
      this.diagnosticTableAnalysis(content, "processContent-start");

      const usesBridge = this.shouldUseMarkdownItBridge();
      const markdownEditorExists = typeof window.MarkdownEditor !== "undefined";
      const bridgeAvailable = !!this.markdownItBridge;

      this.logDebug("🔍 AI RESPONSE PROCESSING:", {
        contentLength: content?.length || 0,
        contentPreview: content?.substring(0, 100) + "...",
        usesBridge: usesBridge,
        markdownEditorExists: markdownEditorExists,
        bridgeAvailable: bridgeAvailable,
        processingMode: usesBridge ? "BRIDGE MODE" : "LEGACY MODE",
        containsTable: content?.includes("|") || false,
        actualTableDetected: this.looksLikeMarkdownTable(content), // 🔧 Use refined detection
        containsTaskList: content?.includes("- [") || false,
        timestamp: new Date().toISOString(),
      });

      // Check if we should use markdown-it bridge
      if (usesBridge) {
        this.logDebug(
          "🎯 USING BRIDGE PROCESSOR - routing to markdown-it pipeline"
        );
        const result = await this.markdownItBridge.process(content);
        this.logDebug("✅ BRIDGE PROCESSING COMPLETE:", {
          inputLength: content.length,
          outputLength: result.length,
          containsTableTags: result.includes("<table>"),
          containsTaskListInputs: result.includes("task-list-item-checkbox"),
          outputPreview: result.substring(0, 200) + "...",
        });

        // 🔧 FIXED: Use refined table detection instead of simple pipe check
        // 🔧 FIXED: Use comprehensive table detection for bridge output
        if (this.looksLikeMarkdownTable(content)) {
          // Check for various table patterns in the bridge output
          const hasDirectTable = result.includes("<table>");
          const hasSortableTable = result.includes(
            "mdSortableTable-table-container"
          );
          const hasSimpleTable = result.includes('class="sortable-table"'); // 🔧 NEW: Check for simple tables
          const hasTableElement = result.includes("<table"); // 🔧 NEW: More flexible table detection
          const hasAnyTable =
            hasDirectTable ||
            hasSortableTable ||
            hasSimpleTable ||
            hasTableElement;

          if (!hasAnyTable) {
            this.logWarn(
              "⚠️ TABLE PROCESSING ISSUE: Input contains tables but output has no table elements"
            );
            this.diagnosticTableAnalysis(content, "processContent-table-issue");

            // 🔧 NEW: Enhanced diagnostic for bridge output
            this.logDebug("🔧 BRIDGE OUTPUT ANALYSIS:", {
              resultLength: result.length,
              resultPreview: result.substring(0, 300),
              containsTableTag: result.includes("<table"),
              containsSortableClass: result.includes("sortable-table"),
              containsTableElement: /<table[^>]*>/i.test(result),
              bridgeGeneratedHtml: true,
            });
          } else {
            this.logDebug("✅ TABLE PROCESSING SUCCESS:", {
              inputHasTables: true,
              outputHasDirectTable: hasDirectTable,
              outputHasSortableTable: hasSortableTable,
              outputHasSimpleTable: hasSimpleTable, // 🔧 NEW
              outputHasTableElement: hasTableElement, // 🔧 NEW
              tableType: hasSortableTable
                ? "enhanced sortable table"
                : hasSimpleTable
                ? "simple table ready for enhancement"
                : "direct table",
              bridgeMode: true,
            });
          }
        } else if (content.includes("|")) {
          // 🔍 LOG FALSE POSITIVE AVOIDANCE
          this.logDebug("✅ FALSE POSITIVE AVOIDED:", {
            contentHasPipes: true,
            refinedDetectionResult: false,
            reason: "Content contains pipes but is not a markdown table",
          });
        }

        if (content.includes("- [")) {
          const hasTaskList = result.includes("task-list-item-checkbox");
          if (!hasTaskList) {
            this.logWarn(
              "⚠️ TASK LIST PROCESSING ISSUE: Input contains task lists but output does not have checkboxes"
            );
          } else {
            this.logDebug("✅ TASK LIST PROCESSING SUCCESS");
          }
        }

        return result;
      }

      // If we reach here, bridge is not being used
      this.logWarn("⚠️ USING LEGACY PROCESSORS - bridge not active");

      // Reset shared state for legacy processing
      this.state.reset();

      // Continue with existing legacy processing...
      let processed = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // 1. Emoji shortcodes - MOVED EARLIER in the pipeline
      processed = this.emojiProcessor.process(processed);

      // 2. Math processing (protect currency and math expressions)
      processed = this.mathProcessor.process(processed);

      // 3. Tables BEFORE block elements (to prevent paragraph wrapping)
      processed = this.tableProcessor.process(processed);

      // 4. Code blocks
      processed = this.codeProcessor.process(processed);

      // 5. Lists
      processed = this.listProcessor.process(processed);

      // 6. Definition lists (after lists, before block elements)
      processed = this.definitionListProcessor.process(processed);

      // 7. Block-level elements (after tables, lists, and definition lists)
      processed = this.blockProcessor.process(processed);

      // 8. Inline elements
      processed = this.inlineProcessor.process(processed);

      // 9. Restore math expressions
      processed = this.mathProcessor.restore(processed);

      // 10. Accessibility enhancements
      processed = this.accessibilityProcessor.process(processed);

      // 11. Remove empty paragraph tags
      processed = this.removeEmptyParagraphs(processed);

      // 12. Clean up definition list markers and any remaining <br> tags
      processed = this.cleanupDefinitionLists(processed);

      return processed;
    } catch (error) {
      this.logError("❌ ERROR IN CONTENT PROCESSING:", {
        error: error.message,
        stack: error.stack,
        contentLength: content?.length || 0,
        usesBridge: this.shouldUseMarkdownItBridge(),
      });
      return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }

  /**
   * Determine whether to use markdown-it bridge
   * @returns {boolean} True if should use markdown-it bridge
   */
  shouldUseMarkdownItBridge() {
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.has("use-markdownit-bridge") ||
      localStorage.getItem("use-markdownit-bridge") === "true" ||
      // Default to true if MarkdownEditor is available
      typeof window.MarkdownEditor !== "undefined"
    );
  }

  /**
   * Ultra-conservative check if content looks like it contains markdown tables
   * @param {string} content - Content to check
   * @returns {boolean} True if content appears to contain markdown tables
   */
  looksLikeMarkdownTable(content) {
    if (!content || typeof content !== "string") return false;

    // Immediate exclusions for non-table content
    const exclusionPatterns = [
      // HTML content
      /<!DOCTYPE/i,
      /<html\b/i,
      /<head\b/i,
      /<body\b/i,
      /<div\b/i,
      /<span\b/i,
      /<p\b/i,

      // Code blocks
      /```[\s\S]*```/,
      /`[^`\n]+`/,

      // HTML comments
      /<!--[\s\S]*?-->/,

      // Script tags
      /<script\b[\s\S]*?<\/script>/i,
      /<style\b[\s\S]*?<\/style>/i,

      // URLs with pipes
      /https?:\/\/[^\s]*\|/,

      // JSON-like content
      /\{[\s\S]*"[^"]*\|[^"]*"[\s\S]*\}/,

      // Command line content
      /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\|/m,
    ];

    // Check for exclusion patterns
    for (const pattern of exclusionPatterns) {
      if (pattern.test(content)) {
        this.logDebug("🚫 EXCLUSION PATTERN MATCHED:", {
          pattern: pattern.source,
          contentPreview: content.substring(0, 100) + "...",
        });
        return false;
      }
    }

    // Ultra-strict markdown table detection
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let hasHeaderSeparator = false;
    let potentialTableRows = [];
    let headerSeparatorLine = -1;

    // First pass: find header separator
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip obviously non-table content
      if (
        line.startsWith("<!--") ||
        line.startsWith("```") ||
        line.startsWith("<") ||
        line.startsWith("#") ||
        line.startsWith("//") ||
        line.startsWith("*") ||
        !line.includes("|")
      ) {
        continue;
      }

      // Check for header separator with very strict pattern
      // Must have at least 3 dashes and proper structure
      if (/^\|[\s]*:?-{3,}:?[\s]*(\|[\s]*:?-{3,}:?[\s]*)+\|?$/.test(line)) {
        hasHeaderSeparator = true;
        headerSeparatorLine = i;
        this.logDebug("📋 HEADER SEPARATOR FOUND:", {
          line: line,
          lineNumber: i + 1,
          pattern: "strict header separator",
        });
        break; // Only one header separator expected
      }
    }

    if (!hasHeaderSeparator) {
      this.logDebug("❌ NO HEADER SEPARATOR FOUND");
      return false;
    }

    // Second pass: validate table rows around header separator
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip the header separator line itself
      if (i === headerSeparatorLine) continue;

      // Skip non-table content
      if (
        line.startsWith("<!--") ||
        line.startsWith("```") ||
        line.startsWith("<") ||
        line.startsWith("#") ||
        !line.includes("|")
      ) {
        continue;
      }

      // Check for valid table row
      if (line.startsWith("|") && line.endsWith("|")) {
        const columns = line.split("|").filter((col) => col.trim().length > 0);

        // Must have at least 2 columns and reasonable structure
        if (columns.length >= 2) {
          // Additional validation: columns shouldn't be too long (likely not a table)
          const hasReasonableColumns = columns.every(
            (col) => col.trim().length > 0 && col.trim().length < 500
          );

          if (hasReasonableColumns) {
            potentialTableRows.push({
              lineNumber: i + 1,
              line: line,
              columnCount: columns.length,
              columns: columns.map((col) => col.trim()),
            });
          }
        }
      }
    }

    // Ultra-strict requirements:
    // 1. Must have header separator
    // 2. Must have at least 2 table rows (header + at least 1 data row)
    // 3. Table rows must be near the header separator (within 10 lines)
    const tableRowsNearSeparator = potentialTableRows.filter(
      (row) => Math.abs(row.lineNumber - (headerSeparatorLine + 1)) <= 10
    );

    const isTable = hasHeaderSeparator && tableRowsNearSeparator.length >= 2;

    this.logDebug("📊 ULTRA-CONSERVATIVE ANALYSIS:", {
      hasHeaderSeparator: hasHeaderSeparator,
      headerSeparatorLine: headerSeparatorLine + 1,
      potentialTableRows: potentialTableRows.length,
      tableRowsNearSeparator: tableRowsNearSeparator.length,
      isTable: isTable,
      requirements: {
        headerSeparator: hasHeaderSeparator,
        minimumRows: tableRowsNearSeparator.length >= 2,
        proximityToSeparator: "within 10 lines",
      },
    });

    if (content.includes("|") && !isTable) {
      this.logDebug("🔍 PIPE DETECTED BUT NOT A TABLE:", {
        contentPreview: content.substring(0, 200) + "...",
        hasHeaderSeparator: hasHeaderSeparator,
        tableRowCount: tableRowsNearSeparator.length,
        reason: !hasHeaderSeparator
          ? "No valid header separator found"
          : `Insufficient table rows (${tableRowsNearSeparator.length}/2 required)`,
        analysis: {
          totalLines: lines.length,
          linesWithPipes: lines.filter((line) => line.includes("|")).length,
          potentialTableRows: potentialTableRows.length,
          validatedTableRows: tableRowsNearSeparator.length,
        },
      });
    }

    return isTable;
  }

  /**
   * Remove empty paragraph tags from content
   * @param {string} content - Content to process
   * @returns {string} Content with empty paragraph tags removed
   */
  removeEmptyParagraphs(content) {
    try {
      this.logDebug("Removing empty paragraph tags");

      // Replace empty paragraph tags with nothing
      // This handles various forms of empty paragraphs including those with whitespace
      let processed = content.replace(/<p>\s*<\/p>/g, "");

      // Log how many were removed
      const removedCount = (content.match(/<p>\s*<\/p>/g) || []).length;
      this.logDebug(`Removed ${removedCount} empty paragraph tags`);

      return processed;
    } catch (error) {
      this.logError("Error removing empty paragraph tags", { error });
      return content; // Return original content on error
    }
  }

  /**
   * Clean up definition list markers and any remaining <br> tags
   * @param {string} content - Content to process
   * @returns {string} Cleaned content
   */
  cleanupDefinitionLists(content) {
    try {
      this.logDebug("Cleaning up definition lists");

      // Remove definition list markers
      let processed = content.replace(/<!-- definition-list-start -->/g, "");
      processed = processed.replace(/<!-- definition-list-end -->/g, "");

      // Remove any remaining <br> tags
      processed = processed.replace(/<br\s*\/?>/gi, "");

      // Remove empty paragraph tags around definition lists
      processed = processed.replace(/<p>\s*<\/p>\s*<dl/g, "<dl");
      processed = processed.replace(/<\/dl>\s*<p>\s*<\/p>/g, "</dl>");

      return processed;
    } catch (error) {
      this.logError("Error cleaning up definition lists", { error });
      return content; // Return original content on error
    }
  }

  /**
   * Process a chunk of streaming content
   * @param {string} chunk - Content chunk to process
   * @returns {string} Processed chunk
   */
  processStreamingChunk(chunk) {
    return this.streamingProcessor.process(chunk);
  }

  /**
   * Generate a valid ID from header text
   * @param {string} text - Header text
   * @returns {string} Valid ID for use in anchor links
   */
  generateHeaderId(text) {
    return this.blockProcessor.generateHeaderId(text);
  }

  /**
   * Process the final response after streaming is complete
   * @param {HTMLElement} container - The container element
   */
  processPostStreaming(container) {
    try {
      if (!container) {
        this.logWarn("No container provided for post-streaming processing");
        return;
      }

      this.logInfo("Processing post-streaming content");

      // Enhance code blocks with syntax highlighting
      this.codeProcessor.enhanceCodeBlocks(container);

      // Initialise sortable tables
      this.initializeSortableTables(container);

      // Apply accessibility enhancements
      this.accessibilityProcessor.enhanceContentAccessibility(container);

      // Initialise MathJax if available
      if (window.MathJax && typeof window.MathJax.typeset === "function") {
        const hasMathContent =
          container.textContent.includes("$") ||
          container.querySelector(".math");

        if (hasMathContent) {
          this.logDebug("Triggering MathJax typesetting");
          try {
            window.MathJax.typeset([container]);
            this.logDebug("MathJax processing completed");
          } catch (mathJaxError) {
            this.logError("Error in MathJax processing", {
              error: mathJaxError,
            });
          }
        }
      }

      this.logInfo("Post-streaming processing completed successfully");
    } catch (error) {
      this.logError("Error in post-streaming processing", { error });
    }
  }

  /**
   * Initialise sortable tables in the container
   * @param {HTMLElement} container - The container element
   */
  initializeSortableTables(container) {
    try {
      const tables = container.querySelectorAll(".sortable-table");
      if (tables.length === 0) return;

      this.logInfo(`Initialising ${tables.length} sortable table(s)`);

      if (typeof initSortableTables === "function") {
        initSortableTables();
      } else {
        this.logWarn("Sortable table script not loaded");
      }
    } catch (error) {
      this.logError("Error initialising sortable tables", { error });
    }
  }
}
