/**
 * @module ResultsManager
 * @description Manages the display, processing, and accessibility of AI-generated responses
 * in the application. Handles content sanitization, error management, and screen reader
 * announcements for an accessible user experience.
 *
 * Key features:
 * - Content sanitization and processing
 * - Automatic URL detection and link creation
 * - Code block formatting with syntax highlighting support
 * - ARIA-compliant accessibility implementation
 * - Robust error handling for content and media
 *
 * Data flow:
 * 1. Receives raw content from AI responses
 * 2. Processes and sanitizes HTML content
 * 3. Manages DOM updates and scroll behavior
 * 4. Handles accessibility announcements
 */
import { ResultsManagerCore } from "./results-manager-core.js";
import { ContentProcessor } from "./results-manager-content.js";
import { StreamingManager } from "./results-manager-streaming.js";
import { AccessibilityManager } from "./results-manager-accessibility.js";
import { DebugManager } from "./results-manager-debug.js";
import { ResultsManagerUtils } from "./results-manager-utils.js";

// Logging configuration (at module level)
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

export class ResultsManager {
  /**
   * Create a new ResultsManager instance
   */
  constructor() {
    // Create utility instance for logging
    this.utils = new ResultsManagerUtils();
    this.utils.log("ResultsManager: Initializing modules");

    // Create instances of all modules
    this.core = new ResultsManagerCore();
    this.contentProcessor = new ContentProcessor();
    this.accessibilityManager = new AccessibilityManager();
    this.streamingManager = new StreamingManager(this.contentProcessor);
    this.debugManager = new DebugManager();

    // Initialize the core manager
    this.core.initialize();

    // Expose properties from core for backward compatibility
    this.resultsContent = this.core.resultsContent;
    this.resultsHeading = this.core.resultsHeading;
    this.isReducedMotion = this.core.isReducedMotion;
    this.streamBuffer = this.streamingManager.streamBuffer;
    this.updateInterval = this.streamingManager.updateInterval;
    this.debugMode = this.debugManager.debugMode;
    this.isStreaming = this.streamingManager.isStreaming;
    this.streamingContent = this.streamingManager.streamingContent;
    this.streaming = this.streamingManager;

    // Check for developer panel and add debug mode toggle
    const devPanel = document.getElementById("devPanel");
    if (devPanel) {
      this.debugManager.addDebugModeToggle(devPanel);
    } else {
      logWarn("Developer panel not found, debug toggle will not be added", {});
    }

    logInfo("ResultsManager: Initialisation complete");
  }

  /**
   * Initialize the results manager
   */
  initialize() {
    return this.core.initialize();
  }

  /**
   * Update the results content
   * @param {string} content - Content to display
   * @param {Object} options - Display options
   */
  async updateResults(content, options = {}) {
    // 🔍 COMPREHENSIVE DEBUG LOGGING - Add this at the start
    logDebug("[BRIDGE DEBUG] 🔍 RESULTS MANAGER UPDATE CALLED:", {
      contentLength: content?.length || 0,
      contentType: typeof content,
      contentPreview: content?.substring(0, 100) + "...",
      hasOptions: !!options,
      options: options,
      processorExists: !!this.contentProcessor,
      processorType: this.contentProcessor?.constructor?.name || "unknown",
      bridgeMethodExists: !!this.contentProcessor?.shouldUseMarkdownItBridge,
      debugMode: this.debugMode,
      timestamp: new Date().toISOString(),
      // Check for markdown patterns in the content
      contentAnalysis: {
        containsPipes: content?.includes("|") || false,
        containsTaskLists: content?.includes("- [") || false,
        containsCodeBlocks: content?.includes("```") || false,
        containsHeaders: content?.includes("#") || false,
        containsMath: content?.includes("$") || false,
      },
    });

    // 🔍 ADD DIAGNOSTIC ANALYSIS
    if (this.contentProcessor?.diagnosticTableAnalysis) {
      this.contentProcessor.diagnosticTableAnalysis(
        content,
        "updateResults-start"
      );
    }

    // 🔍 DETAILED BRIDGE STATUS CHECK
    if (this.contentProcessor?.shouldUseMarkdownItBridge) {
      const bridgeStatus = this.contentProcessor.shouldUseMarkdownItBridge();
      logDebug("[BRIDGE DEBUG] 🔍 BRIDGE CHECK FROM RESULTS MANAGER:", {
        bridgeAvailable: bridgeStatus,
        markdownEditorExists: typeof window.MarkdownEditor !== "undefined",
        markdownEditorHasRender:
          typeof window.MarkdownEditor?.render === "function",
        bridgeInstance: !!this.contentProcessor.markdownItBridge,
        urlParam: new URLSearchParams(window.location.search).has(
          "use-markdownit-bridge"
        ),
        localStorage: localStorage.getItem("use-markdownit-bridge"),
        // Additional environment checks
        markdownItAvailable: typeof window.markdownit !== "undefined",
        taskListsPluginAvailable:
          typeof window.markdownitTaskLists !== "undefined",
        sortableTablesAvailable:
          typeof window.sortableTablesEnhanced !== "undefined",
      });

      // Log the bridge decision logic
      if (bridgeStatus) {
        logInfo(
          "[BRIDGE DEBUG] ✅ BRIDGE MODE ACTIVATED - Content will be processed by markdown-it pipeline"
        );
      } else {
        logWarn(
          "[BRIDGE DEBUG] ⚠️ BRIDGE MODE INACTIVE - Content will use legacy processors"
        );

        // Help diagnose why bridge isn't active
        if (typeof window.MarkdownEditor === "undefined") {
          logError(
            "[BRIDGE DEBUG] ❌ BRIDGE INACTIVE REASON: MarkdownEditor object not found"
          );
        } else if (typeof window.MarkdownEditor.render !== "function") {
          logError(
            "[BRIDGE DEBUG] ❌ BRIDGE INACTIVE REASON: MarkdownEditor.render method not found"
          );
        } else if (localStorage.getItem("use-markdownit-bridge") !== "true") {
          logWarn(
            "[BRIDGE DEBUG] ❌ BRIDGE INACTIVE REASON: localStorage setting not enabled"
          );
        }
      }
    } else {
      logError(
        "[BRIDGE DEBUG] ❌ BRIDGE METHOD NOT AVAILABLE on content processor"
      );
    }

    // 🔍 PRE-PROCESSING LOG
    logDebug("[BRIDGE DEBUG] 📝 CALLING CONTENT PROCESSOR...");
    const processingStartTime = performance.now();

    // Process content first to get the formatted version - CRITICAL: Await this!
    const processedContent = await this.contentProcessor.processContent(
      content
    );

    const processingEndTime = performance.now();
    const processingDuration = processingEndTime - processingStartTime;

    // 🔍 POST-PROCESSING ANALYSIS (SINGLE SECTION - CLEANED)
    logDebug("[BRIDGE DEBUG] ✅ CONTENT PROCESSING COMPLETE:", {
      processingDuration: `${processingDuration.toFixed(2)}ms`,
      inputLength: content?.length || 0,
      outputLength: processedContent?.length || 0,
      outputType: typeof processedContent,
      outputPreview: processedContent?.substring(0, 200) + "...",
      // Check for successful markdown processing
      processingResults: {
        containsTableTags: processedContent?.includes("<table>") || false,
        containsTaskListInputs:
          processedContent?.includes("task-list-item-checkbox") || false,
        containsCodeBlocks:
          processedContent?.includes('<pre class="language-') || false,
        containsHeaderAnchors:
          processedContent?.includes("header-anchor") || false,
        containsMathJax: processedContent?.includes("MathJax") || false,
      },
      // Check for processing issues
      potentialIssues: {
        isPromiseObject: processedContent === "[object Promise]",
        isEmpty: !processedContent || processedContent.length === 0,
        isPlainText:
          !processedContent?.includes("<") && !processedContent?.includes(">"),
        hasUnprocessedMarkdown:
          processedContent?.includes("|") &&
          !processedContent?.includes("<table>"),
      },
    });

    // 🔍 CHECK FOR CRITICAL ISSUES
    if (processedContent === "[object Promise]") {
      logError(
        "[BRIDGE DEBUG] ❌ CRITICAL: processedContent is a Promise object - async/await issue detected!"
      );
    }

    // 🔧 FIXED: Use flexible regex-based table detection for bridge verification
    if (
      this.contentProcessor?.looksLikeMarkdownTable &&
      this.contentProcessor.looksLikeMarkdownTable(content)
    ) {
      // Use regex for more flexible table detection that catches bridge-generated tables
      const hasTableElement = /<table[^>]*>/i.test(processedContent);
      const hasSortableTable = processedContent?.includes(
        "mdSortableTable-table-container"
      );
      const hasAnyTable = hasTableElement || hasSortableTable;

      if (!hasAnyTable) {
        logWarn(
          "[BRIDGE DEBUG] ⚠️ TABLE PROCESSING ISSUE: Input contains tables but output has no table elements"
        );
        // Add additional diagnostic info
        if (this.contentProcessor?.diagnosticTableAnalysis) {
          this.contentProcessor.diagnosticTableAnalysis(
            content,
            "updateResults-table-issue"
          );
        }

        // 🔧 NEW: Enhanced diagnostic for bridge output verification issues
        logDebug("🔍 [BRIDGE DEBUG] 🔧 VERIFICATION DIAGNOSTIC:", {
          processedContentLength: processedContent?.length || 0,
          processedContentPreview: processedContent?.substring(0, 300) + "...",
          hasTableTag: processedContent?.includes("<table"),
          hasSortableClass: processedContent?.includes("sortable-table"),
          regexTableTest: /<table[^>]*>/i.test(processedContent || ""),
          bridgeMode:
            this.contentProcessor?.shouldUseMarkdownItBridge?.() || false,
        });
      } else {
        logInfo("[BRIDGE DEBUG] ✅ TABLE PROCESSING SUCCESS:", {
          tableType: hasSortableTable
            ? "enhanced sortable table"
            : hasTableElement
            ? "simple table ready for enhancement"
            : "table element",
          hasTableElement: hasTableElement,
          hasSortableTable: hasSortableTable,
          detectionMethod: "regex-based flexible detection",
        });
      }
    } else if (content?.includes("|")) {
      // 🔍 LOG FALSE POSITIVE AVOIDANCE
      logDebug("[BRIDGE DEBUG] ✅ FALSE POSITIVE AVOIDED:", {
        contentHasPipes: true,
        refinedDetectionResult: this.contentProcessor?.looksLikeMarkdownTable
          ? this.contentProcessor.looksLikeMarkdownTable(content)
          : "method not available",
        reason: "Content contains pipes but is not a markdown table",
        availableDetectionMethod:
          !!this.contentProcessor?.looksLikeMarkdownTable,
      });
    }

    if (
      content?.includes("- [") &&
      !processedContent?.includes("task-list-item-checkbox")
    ) {
      logWarn(
        "[BRIDGE DEBUG] ⚠️ TASK LIST PROCESSING ISSUE: Input contains task lists but output does not have checkboxes"
      );
    }

    // Update the debug view with both raw and formatted content
    if (this.debugMode) {
      logDebug("[BRIDGE DEBUG] 🐛 UPDATING DEBUG VIEW with processed content");
      this.utils.log("Updating debug view with content", {
        rawLength: content?.length || 0,
        processedLength: processedContent?.length || 0,
      });
      this.debugManager.updateDebugView(content, processedContent);
    }

    // 🔍 CORE UPDATE LOG
    logDebug("[BRIDGE DEBUG] 🎯 CALLING CORE.UPDATERESULTS...");
    const coreUpdateStartTime = performance.now();

    // Continue with normal update - CRITICAL: Await this too!
    const result = await this.core.updateResults(
      content,
      options,
      this.contentProcessor
    );

    const coreUpdateEndTime = performance.now();
    const coreUpdateDuration = coreUpdateEndTime - coreUpdateStartTime;

    // 🔍 FINAL VERIFICATION - Check what actually made it to the DOM
    const resultsContent = document.querySelector(".results-content");
    if (resultsContent) {
      logDebug("[BRIDGE DEBUG] ✅ FINAL DOM VERIFICATION:", {
        coreUpdateDuration: `${coreUpdateDuration.toFixed(2)}ms`,
        totalDuration: `${(coreUpdateEndTime - processingStartTime).toFixed(
          2
        )}ms`,
        domContentLength: resultsContent.innerHTML.length,
        domResults: {
          containsTableTags: resultsContent.innerHTML.includes("<table>"),
          containsTaskListInputs: resultsContent.innerHTML.includes(
            "task-list-item-checkbox"
          ),
          containsCodeBlocks: resultsContent.innerHTML.includes(
            '<pre class="language-'
          ),
          containsHeaderAnchors:
            resultsContent.innerHTML.includes("header-anchor"),
        },
        domPreview: resultsContent.innerHTML.substring(0, 200) + "...",
      });

      // Final success/failure assessment
      const hasExpectedMarkdown =
        (this.contentProcessor?.looksLikeMarkdownTable &&
          this.contentProcessor.looksLikeMarkdownTable(content)) ||
        content?.includes("- [");
      const hasProcessedMarkdown =
        resultsContent.innerHTML.includes("<table>") ||
        resultsContent.innerHTML.includes("task-list-item-checkbox");

      if (hasExpectedMarkdown && hasProcessedMarkdown) {
        logInfo(
          "[BRIDGE DEBUG] 🎉 SUCCESS: Markdown content properly processed and displayed!"
        );
      } else if (hasExpectedMarkdown && !hasProcessedMarkdown) {
        logError(
          "[BRIDGE DEBUG] ❌ FAILURE: Markdown content not properly processed"
        );
      } else {
        logDebug(
          "[BRIDGE DEBUG] ℹ️ INFO: No markdown content to process or verify"
        );
      }
    } else {
      logError(
        "[BRIDGE DEBUG] ❌ CRITICAL: .results-content element not found in DOM"
      );
    }

    return result;
  }

  /**
   * Process and sanitize content, converting Markdown to HTML
   * @param {string} content - Raw content to process
   * @returns {Promise<string>} Processed HTML content
   */
  async processContent(content) {
    return await this.contentProcessor.processContent(content);
  }

  /**
   * Generate a valid ID from header text
   * @param {string} text - Header text
   * @returns {string} Valid ID for use in anchor links
   */
  generateHeaderId(text) {
    return this.contentProcessor.generateHeaderId(text);
  }

  /**
   * Initialize streaming container and start streaming process
   * @param {Object} options - Streaming options
   */
  beginStreaming(options = {}) {
    return this.streamingManager.beginStreaming(options, this.core);
  }

  /**
   * Update content with streaming chunk
   * @param {string} chunk - New content chunk
   * @param {Object} options - Update options
   */
  async updateStreamingContent(chunk, options = {}) {
    // Call the streaming manager to update content
    const result = this.streamingManager.updateStreamingContent(
      chunk,
      options,
      this.core
    );

    // Update debug view periodically during streaming
    // Only do this occasionally to avoid performance issues
    if (this.debugMode && !options.isFullResponse) {
      // Update debug view every ~500 characters to avoid performance issues
      const currentLength = this.streamingManager.streamingContent.length;
      if (currentLength % 500 < chunk.length) {
        const rawContent = this.streamingManager.streamingContent;
        const processedContent = await this.contentProcessor.processContent(
          rawContent
        );

        logDebug("Updating debug view during streaming", {
          streamPosition: currentLength,
          chunkLength: chunk.length,
        });

        this.debugManager.updateDebugView(rawContent, processedContent);
      }
    }

    return result;
  }

  /**
   * Process a chunk of streaming content
   * @param {string} chunk - Content chunk to process
   * @returns {string} Processed chunk
   */
  processStreamingChunk(chunk) {
    return this.contentProcessor.processStreamingChunk(chunk);
  }

  /**
   * Complete the streaming response
   * @param {Object} options - Completion options
   */
  async completeStreaming(options = {}) {
    // Get the final streaming content before completion
    const rawContent = this.streamingManager.streamingContent;

    // Only process and update debug if we have content and debug mode is enabled
    if (rawContent && this.debugMode) {
      const processedContent = await this.contentProcessor.processContent(
        rawContent
      );

      logInfo("Updating debug view with final streaming content", {
        rawLength: rawContent.length,
        processedLength: processedContent.length,
      });

      // Update debug view with final content
      this.debugManager.updateDebugView(rawContent, processedContent);
    }

    // Continue with normal streaming completion - IMPORTANT: Await this
    return await this.streamingManager.completeStreaming(
      options,
      this.core,
      this.contentProcessor
    );
  }

  /**
   * Handle scroll behavior
   * @param {string} behavior - Scroll behavior
   */
  handleScroll(behavior = "smooth") {
    return this.core.handleScroll(behavior);
  }

  /**
   * Announce updates to screen readers
   * @param {string} message - Message to announce
   */
  announceUpdate(message) {
    return this.core.announceUpdate(message);
  }

  /**
   * Handle errors in results display
   * @param {Error} error - Error object
   */
  handleError(error) {
    return this.core.handleError(error);
  }

  /**
   * Handle media loading errors
   * @param {Event} event - Error event
   */
  handleMediaError(event) {
    return this.core.handleMediaError(event);
  }

  /**
   * Clear results content
   */
  clear() {
    return this.core.clear();
  }

  /**
   * Check if results are empty
   * @returns {boolean} True if results are empty
   */
  isEmpty() {
    return this.core.isEmpty();
  }

  /**
   * Get current results content
   * @returns {string} Current results content
   */
  getContent() {
    return this.core.getContent();
  }

  /**
   * Enable debugging mode for response formatting
   * @param {boolean} enabled - Whether debugging mode is enabled
   */
  async setDebugMode(enabled = false) {
    logInfo(`[RESULTS MANAGER] Setting debug mode to ${enabled}`);

    // Update the instance property for backward compatibility
    this.debugMode = enabled;

    // Call the debug manager's setDebugMode method
    const result = this.debugManager.setDebugMode(enabled);

    // Verify debug mode was set correctly
    logDebug(`[RESULTS MANAGER] After setting debug mode:`, {
      resultManagerDebugMode: this.debugMode,
      debugManagerDebugMode: this.debugManager.debugMode,
      result: result,
    });

    // Force a debug view update with current content if enabling debug mode
    if (enabled && this.core && this.core.getContent) {
      const currentContent = this.core.getContent();
      if (currentContent) {
        logInfo(
          `[RESULTS MANAGER] Forcing initial debug view update with existing content (${currentContent.length} chars)`
        );
        const processedContent = await this.contentProcessor.processContent(
          currentContent
        );
        this.debugManager.updateDebugView(currentContent, processedContent);
      } else {
        logInfo(`[RESULTS MANAGER] No existing content to show in debug view`);
      }
    }

    return result;
  }

  /**
   * Add debug mode toggle to developer settings panel
   * @param {HTMLElement} devPanel - The developer settings panel element
   */
  addDebugModeToggle(devPanel) {
    return this.debugManager.addDebugModeToggle(devPanel);
  }

  /**
   * Clean up resources when component is no longer needed
   */
  destroy() {
    // Clean up all modules
    logInfo("Destroying ResultsManager instance and cleaning up resources");

    this.core.destroy();
    this.accessibilityManager.cleanupMotionWatcher();

    // Clear references
    this.streamingContent = "";
    this.streamBuffer = "";
    this.isStreaming = false;
    this.debugMode = false;

    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logInfo("ResultsManager: Cleanup complete");
  }
}
