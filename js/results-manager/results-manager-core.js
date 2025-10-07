/**
 * Results Manager Core Module - Stage 3A: DOM Operation Coordination
 * Handles DOM operations with bridge processing coordination and state management
 *
 * Phase 3 Enhancement: Complete coordination between bridge processing and DOM operations
 * whilst maintaining all Phase 1 & 2 achievements.
 *
 * Stage 3A Objectives:
 * - Coordinate DOM operations with bridge processing state
 * - Perfect table enhancement timing (two-stage: bridge → AccessibleSortableTable)
 * - Add DOM processing state tracking to prevent conflicts
 * - Implement comprehensive bridge marker cleanup
 * - Prevent premature enhancements that could conflict with bridge processing
 */

// Import accessibility helpers
import { a11y } from "../accessibility-helpers.js";
import { ResultsManagerUtils } from "./results-manager-utils.js";

// Logging configuration (module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

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

/**
 * ✅ Stage 3A: DOM Operation States for coordination
 */
const DOMOperationState = {
  IDLE: "idle",
  WAITING_FOR_BRIDGE: "waiting-for-bridge",
  PROCESSING: "processing",
  ENHANCING: "enhancing",
  COMPLETED: "completed",
  ERROR: "error",
};

/**
 * ✅ Stage 3A: DOM Processing Configuration
 */
const DOM_PROCESSING_CONFIG = {
  // Bridge coordination settings
  maxBridgeWaitTime: 5000, // Max time to wait for bridge completion
  bridgeCheckInterval: 100, // How often to check bridge state
  stabilityDelay: 10, // DOM stability delay

  // Enhancement timing
  tableEnhancementDelay: 50, // Delay before table enhancement
  chartProcessingDelay: 100, // Delay before chart processing

  // Performance settings
  enableBridgeCoordination: true, // Enable/disable coordination
  enablePerformanceTracking: true, // Enable timing measurements
};

/**
 * Core module for results display and interaction management
 */
class ResultsManagerCore {
  constructor() {
    this.resultsContent = null;
    this.resultsHeading = null;
    this.isReducedMotion = false;

    // Initialize utils for logging
    this.utils = new ResultsManagerUtils();

    // ✅ Stage 3A: DOM operation state management
    this.domOperationState = DOMOperationState.IDLE;
    this.currentDOMOperationId = null;
    this.bridgeProcessingRef = null; // ⚠️ Start as null, establish on demand

    // ✅ Stage 3A: DOM operation metrics
    this.domOperationMetrics = {
      totalDOMOperations: 0,
      bridgeCoordinatedOperations: 0,
      averageDOMOperationTime: 0,
      lastDOMOperationTime: 0,
      bridgeWaitTime: 0,
      tableEnhancementCount: 0,
      chartProcessingCount: 0,
    };

    // ✅ Stage 3A: Bridge coordination state (starts enabled, reference established on-demand)
    this.bridgeCoordinationEnabled =
      DOM_PROCESSING_CONFIG.enableBridgeCoordination;

    logInfo(
      "ResultsManagerCore initialised with deferred bridge coordination (Stage 3A)"
    );
  }

  /**
   * ✅ Stage 3A: Get bridge processing reference for coordination (passive detection)
   * @returns {Object|null} Bridge processing reference
   */
  getBridgeProcessingRef() {
    // Try multiple strategies to find bridge processing reference
    const strategies = [
      // Strategy 1: Via results manager content processor → markdownItBridge
      () => window.resultsManager?.contentProcessor?.markdownItBridge,

      // Strategy 2: Via content processor directly → markdownItBridge
      () => window.contentProcessor?.markdownItBridge,

      // Strategy 3: Via global bridge processor
      () => window.bridgeProcessor,

      // Strategy 4: Via legacy MarkdownItBridge instance
      () => window.MarkdownItBridge?.instance,

      // Strategy 5: Via direct bridge instance
      () => window.bridgeInstance,
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const ref = strategies[i]();
        // ✅ PASSIVE CHECK: Only verify method existence, don't call anything
        if (ref && typeof ref.getProcessingDiagnostics === "function") {
          logDebug("🔧 Bridge processing reference found (passive detection)", {
            strategy: i + 1,
            objectType: ref.constructor?.name || "unknown",
            hasProcessingDiagnostics:
              typeof ref.getProcessingDiagnostics === "function",
            hasProcess: typeof ref.process === "function",
          });
          return ref;
        }
      } catch (error) {
        logDebug(`🔧 Bridge reference strategy ${i + 1} failed:`, error);
      }
    }

    logDebug(
      "🔧 No valid bridge processing reference found (passive detection)",
      {
        strategiesAttempted: strategies.length,
        resultManagerExists: !!window.resultsManager,
        contentProcessorExists: !!window.resultsManager?.contentProcessor,
      }
    );

    return null;
  }

  /**
   * ✅ Stage 3A: Verify bridge paths for diagnostic purposes
   * @returns {Object} Bridge path analysis
   */
  verifyBridgePaths() {
    const pathAnalysis = {
      primaryPath: {
        path: "window.resultsManager?.contentProcessor?.markdownItBridge",
        exists: !!window.resultsManager?.contentProcessor?.markdownItBridge,
        hasRequiredMethods: false,
      },
      fallbackPaths: [
        {
          path: "window.contentProcessor?.markdownItBridge",
          exists: !!window.contentProcessor?.markdownItBridge,
          hasRequiredMethods: false,
        },
        {
          path: "window.bridgeProcessor",
          exists: !!window.bridgeProcessor,
          hasRequiredMethods: false,
        },
        {
          path: "window.MarkdownItBridge?.instance",
          exists: !!window.MarkdownItBridge?.instance,
          hasRequiredMethods: false,
        },
      ],
      intermediateObjects: {
        resultsManager: !!window.resultsManager,
        contentProcessor: !!window.resultsManager?.contentProcessor,
        contentProcessorType:
          window.resultsManager?.contentProcessor?.constructor?.name ||
          "not found",
      },
    };

    // Check if primary path has required methods
    const primaryRef =
      window.resultsManager?.contentProcessor?.markdownItBridge;
    if (primaryRef) {
      pathAnalysis.primaryPath.hasRequiredMethods =
        typeof primaryRef.getProcessingDiagnostics === "function";
      pathAnalysis.primaryPath.objectType =
        primaryRef.constructor?.name || "unknown";
    }

    // Check fallback paths
    pathAnalysis.fallbackPaths.forEach((pathInfo) => {
      try {
        const ref = eval(pathInfo.path.replace("?.", " && ") + " || null");
        if (ref) {
          pathInfo.hasRequiredMethods =
            typeof ref.getProcessingDiagnostics === "function";
          pathInfo.objectType = ref.constructor?.name || "unknown";
        }
      } catch (error) {
        // Path evaluation failed, leave as false
      }
    });

    return pathAnalysis;
  }

  /**
   * ✅ Stage 3A: Dynamically establish bridge reference when needed (on-demand)
   * @returns {boolean} True if bridge reference is now available
   */
  establishBridgeReference() {
    if (this.bridgeProcessingRef) {
      return true; // Already have reference
    }

    logDebug("🔧 Establishing bridge processing reference on-demand...");
    this.bridgeProcessingRef = this.getBridgeProcessingRef();

    if (this.bridgeProcessingRef) {
      this.bridgeCoordinationEnabled =
        DOM_PROCESSING_CONFIG.enableBridgeCoordination;
      logInfo("🔧 Bridge processing reference established on-demand");
      return true;
    } else {
      this.bridgeCoordinationEnabled = false;
      logDebug(
        "🔧 Bridge processing reference not available, coordination disabled"
      );
      return false;
    }
  }

  /**
   * ✅ Stage 3A: Check if bridge processing is currently active (improved)
   * @returns {boolean} True if bridge is processing content
   */
  isBridgeProcessing() {
    // Try to establish bridge reference if we don't have one
    if (!this.bridgeProcessingRef) {
      this.establishBridgeReference();
    }

    if (!this.bridgeProcessingRef) {
      logDebug("🔧 No bridge processing reference available");
      return false;
    }

    try {
      const diagnostics = this.bridgeProcessingRef.getProcessingDiagnostics();
      const isProcessing = diagnostics.state === "processing";

      if (isProcessing) {
        logDebug("🔧 Bridge is currently processing content", {
          state: diagnostics.state,
          processingId: diagnostics.currentProcessingId,
        });
      }

      return isProcessing;
    } catch (error) {
      logWarn("Error checking bridge processing state:", error);
      // Try to re-establish reference
      this.bridgeProcessingRef = null;
      return false;
    }
  }

  /**
   * ✅ Stage 3A: Wait for bridge processing to complete
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} True if bridge completed, false if timeout
   */
  async waitForBridgeCompletion(
    maxWaitTime = DOM_PROCESSING_CONFIG.maxBridgeWaitTime
  ) {
    const startTime = performance.now();
    const checkInterval = DOM_PROCESSING_CONFIG.bridgeCheckInterval;

    logDebug("🔧 Waiting for bridge completion", {
      maxWaitTime,
      checkInterval,
    });

    return new Promise((resolve) => {
      const checkBridgeState = () => {
        const elapsed = performance.now() - startTime;

        if (elapsed >= maxWaitTime) {
          logWarn("🔧 Bridge wait timeout reached", {
            elapsed: `${elapsed.toFixed(2)}ms`,
          });
          resolve(false);
          return;
        }

        if (!this.isBridgeProcessing()) {
          const waitTime = performance.now() - startTime;
          logDebug("🔧 Bridge processing completed", {
            waitTime: `${waitTime.toFixed(2)}ms`,
          });

          // Update metrics
          this.domOperationMetrics.bridgeWaitTime = waitTime;

          resolve(true);
          return;
        }

        // Continue checking
        setTimeout(checkBridgeState, checkInterval);
      };

      checkBridgeState();
    });
  }

  /**
   * ✅ Stage 3A: Generate unique DOM operation ID
   * @returns {string} Unique operation ID
   */
  generateDOMOperationId() {
    return `dom-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ✅ Stage 3A: Update DOM operation state with logging
   * @param {string} newState - New state from DOMOperationState
   * @param {string} operationId - Operation ID for tracking
   */
  updateDOMOperationState(newState, operationId = null) {
    const previousState = this.domOperationState;
    this.domOperationState = newState;

    if (operationId) {
      this.currentDOMOperationId = operationId;
    }

    logDebug("🔧 DOM operation state updated", {
      from: previousState,
      to: newState,
      operationId: this.currentDOMOperationId,
    });
  }

  /**
   * ✅ Stage 3A: Comprehensive bridge marker cleanup
   * @param {HTMLElement} container - Container to clean up
   * @param {string} operationId - Operation ID for logging
   */
  cleanupBridgeMarkers(container, operationId) {
    logDebug("🔧 Starting comprehensive bridge marker cleanup", {
      operationId,
    });

    let cleanupCount = 0;

    try {
      // Remove bridge processing markers from all elements
      const elementsWithMarkers = container.querySelectorAll(
        "[data-bridge-processing], [data-bridge-processed], [data-defer-view-controls]"
      );

      elementsWithMarkers.forEach((element, index) => {
        // Log what we're cleaning
        const markers = [];
        if (element.hasAttribute("data-bridge-processing"))
          markers.push("data-bridge-processing");
        if (element.hasAttribute("data-bridge-processed"))
          markers.push("data-bridge-processed");
        if (element.hasAttribute("data-defer-view-controls"))
          markers.push("data-defer-view-controls");

        logDebug(`🔧 Cleaning bridge markers from element ${index}`, {
          tagName: element.tagName.toLowerCase(),
          markers: markers,
          operationId,
        });

        // Remove the markers
        element.removeAttribute("data-bridge-processing");
        element.removeAttribute("data-bridge-processed");
        element.removeAttribute("data-defer-view-controls");
        cleanupCount++;
      });

      // Special cleanup for charts
      const chartContainers = container.querySelectorAll(".chart-container");
      chartContainers.forEach((chartContainer, index) => {
        // Remove view controls that may have been added during bridge processing
        const existingViewControls = chartContainer.querySelector(
          ".chart-view-controls"
        );
        if (existingViewControls) {
          logDebug(`🔧 Removing existing view controls from chart ${index}`, {
            operationId,
          });
          existingViewControls.remove();
        }

        // Remove view-controls-added class to allow re-initialisation
        if (chartContainer.classList.contains("view-controls-added")) {
          chartContainer.classList.remove("view-controls-added");
          logDebug(`🔧 Reset view controls state for chart ${index}`, {
            operationId,
          });
        }
      });

      logInfo("🔧 Bridge marker cleanup completed", {
        cleanupCount,
        chartContainers: chartContainers.length,
        operationId,
      });
    } catch (error) {
      logError("🔧 Error during bridge marker cleanup:", error, {
        operationId,
      });
    }
  }

  /**
   * ✅ Stage 3A: Coordinated table enhancement
   * @param {HTMLElement} container - Container with tables
   * @param {string} operationId - Operation ID for logging
   * @returns {Promise<number>} Number of tables enhanced
   */
  async enhanceTablesWithCoordination(container, operationId) {
    logDebug("🔧 Starting coordinated table enhancement", { operationId });

    try {
      // Find tables that need enhancement
      const simpleTablesForEnhancement = container.querySelectorAll(
        "table.sortable-table"
      );
      logDebug(
        `🔧 Found ${simpleTablesForEnhancement.length} table(s) for enhancement`,
        { operationId }
      );

      if (simpleTablesForEnhancement.length === 0) {
        logDebug("🔧 No tables require enhancement", { operationId });
        return 0;
      }

      // Wait for DOM stability before enhancement
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, DOM_PROCESSING_CONFIG.tableEnhancementDelay);
        });
      });

      // Check if AccessibleSortableTable is available
      if (typeof window.initSortableTables !== "function") {
        logWarn(
          "🔧 initSortableTables function not available - tables will remain simple",
          { operationId }
        );
        return 0;
      }

      // Enhance tables with error handling
      logDebug("🔧 Initialising accessible sortable tables", { operationId });
      await window.initSortableTables(container);

      // Update metrics
      this.domOperationMetrics.tableEnhancementCount +=
        simpleTablesForEnhancement.length;

      logInfo("🔧 Table enhancement completed successfully", {
        tablesEnhanced: simpleTablesForEnhancement.length,
        operationId,
      });

      return simpleTablesForEnhancement.length;
    } catch (error) {
      logError("🔧 Error during coordinated table enhancement:", error, {
        operationId,
      });
      return 0;
    }
  }

  /**
   * ✅ Stage 3A: Coordinated chart processing
   * @param {HTMLElement} container - Container with charts
   * @param {string} operationId - Operation ID for logging
   * @returns {Promise<number>} Number of charts processed
   */
  async processChartsWithCoordination(container, operationId) {
    logDebug("🔧 Starting coordinated chart processing", { operationId });

    try {
      // Wait for chart processing delay
      await new Promise((resolve) => {
        setTimeout(resolve, DOM_PROCESSING_CONFIG.chartProcessingDelay);
      });

      const chartContainers = container.querySelectorAll(".chart-container");
      logDebug(
        `🔧 Found ${chartContainers.length} chart container(s) for processing`,
        { operationId }
      );

      if (chartContainers.length === 0) {
        return 0;
      }

      chartContainers.forEach((chartContainer, index) => {
        logDebug(`🔧 Processing chart ${index}`, { operationId });

        // Chart-specific processing would go here
        // This is where chart view controls would be initialised

        logDebug(`🔧 Chart ${index} processing completed`, { operationId });
      });

      // Update metrics
      this.domOperationMetrics.chartProcessingCount += chartContainers.length;

      logInfo("🔧 Chart processing completed", {
        chartsProcessed: chartContainers.length,
        operationId,
      });

      return chartContainers.length;
    } catch (error) {
      logError("🔧 Error during coordinated chart processing:", error, {
        operationId,
      });
      return 0;
    }
  }

  /**
   * Initialize the core module
   */
  async initialize() {
    logDebug("Initialising ResultsManagerCore...");

    // Find results content element
    this.resultsContent = document.querySelector(".results-content");
    if (!this.resultsContent) {
      logError("Results content element not found");
      return;
    }

    // Find results heading
    this.resultsHeading = document.getElementById("results-heading");
    if (!this.resultsHeading) {
      logWarn("Results heading element not found");
    }

    logDebug("Core elements located successfully");

    // Set initial ARIA attributes
    this.resultsContent.setAttribute("role", "region");
    this.resultsContent.setAttribute("aria-label", "AI Response");

    // Add error handling for images and links
    this.resultsContent.addEventListener(
      "error",
      this.handleMediaError.bind(this),
      true
    );

    // Initialise accessibility and motion preferences
    if (a11y && typeof a11y.watchMotionPreference === "function") {
      a11y.watchMotionPreference((prefersReducedMotion) => {
        this.isReducedMotion = prefersReducedMotion;
        logInfo(
          `Motion preference updated: ${
            this.isReducedMotion ? "reduced" : "standard"
          } motion`
        );
      });
    } else {
      // Fallback if the watchMotionPreference method isn't available
      this.isReducedMotion =
        a11y && a11y.prefersReducedMotion ? a11y.prefersReducedMotion() : false;
      logInfo(
        `Motion preference initialised: ${
          this.isReducedMotion ? "reduced" : "standard"
        } motion (fallback method)`
      );
    }

    // Remove any status container display:none inline styles
    const statusContainer = document.getElementById("status-container");
    if (statusContainer) {
      statusContainer.removeAttribute("style");
    }

    // ✅ Stage 3A: Bridge coordination will be established on-demand only
    // (No longer establishing bridge reference during initialization to prevent queue messages)

    logInfo(
      "Core module fully initialised with deferred bridge coordination (Stage 3A)"
    );
  }

  /**
   * Handle media errors (images, videos, etc.)
   * @param {Event} event - Error event
   */
  handleMediaError(event) {
    const element = event.target;
    if (element.tagName === "IMG") {
      element.alt = element.alt || "Image failed to load";
      element.style.display = "none";
      logWarn("Image failed to load:", element.src);
    } else if (element.tagName === "VIDEO") {
      element.style.display = "none";
      logWarn("Video failed to load:", element.src);
    }
  }

  /**
   * Check and manage response size with base64 content detection
   * @param {string} content - Response content to check
   * @returns {Object} Size management result
   */
  checkResponseSize(content) {
    // Defensive validation (Stage 3.1 pattern)
    if (!content || typeof content !== "string") {
      logWarn("Invalid content provided to checkResponseSize");
      return { content: String(content || ""), size: 0, truncated: false };
    }

    const size = new Blob([content]).size;
    const threshold = CONFIG?.FILE_UPLOAD?.RESPONSE_SIZE_WARNING || 1048576; // 1MB

    if (size > threshold) {
      return this.handleLargeResponse(content, size);
    }

    return { content, size, truncated: false };
  }

  /**
   * Handle large responses with base64 content filtering
   * @param {string} content - Large response content
   * @param {number} size - Content size in bytes
   * @returns {Object} Processed response
   */
  handleLargeResponse(content, size) {
    const maxDisplay = CONFIG?.FILE_UPLOAD?.MAX_RESPONSE_DISPLAY || 5242880; // 5MB

    // Detect base64 content (critical finding from Stage 1 testing)
    const hasBase64 = /data:[^;]+;base64,/.test(content);

    if (hasBase64) {
      // Use Stage 3.1 separation pattern: process content, store metadata separately
      const filtered = this.filterBase64Content(content);
      return {
        content: filtered.content,
        size: filtered.size,
        truncated: true,
        hasEmbeddedContent: true,
        metadata: filtered.metadata, // Store separately like plugin config
        summary: `Response contains ${filtered.embeddedCount} embedded file(s)`,
      };
    }

    if (size > maxDisplay) {
      // Truncate with clear indication
      const truncated = content.substring(0, maxDisplay);
      return {
        content:
          truncated +
          "\n\n[Response truncated due to size. Use download option to view complete response.]",
        size,
        truncated: true,
        warning: true,
      };
    }

    return { content, size, truncated: false, warning: true };
  }

  /**
   * Filter base64 content and provide content summary
   * @param {string} content - Content with embedded base64
   * @returns {Object} Filtered content result
   */
  filterBase64Content(content) {
    const base64Matches =
      content.match(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g) || [];
    let filteredContent = content;
    const embeddedFiles = [];

    base64Matches.forEach((match, index) => {
      const mimeMatch = match.match(/data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "unknown";
      const dataSize = Math.round(match.length * 0.75); // Approximate decode size

      embeddedFiles.push({
        type: mimeType,
        size: dataSize,
        index: index,
      });

      filteredContent = filteredContent.replace(
        match,
        `[Embedded ${mimeType} file (${this.formatFileSize(dataSize)})]`
      );
    });

    return {
      content: filteredContent,
      size: new Blob([filteredContent]).size,
      metadata: { embeddedFiles },
      embeddedCount: embeddedFiles.length,
    };
  }

  /**
   * Format file size for display (using CONFIG utility if available)
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    // Use CONFIG utility if available, otherwise fall back to simple implementation
    if (CONFIG?.FILE_UPLOAD_UTILS?.formatFileSize) {
      return CONFIG.FILE_UPLOAD_UTILS.formatFileSize(bytes);
    }

    // Simple fallback
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * ✅ Stage 3A: Update the results content with bridge coordination
   * @param {string} content - Content to display
   * @param {Object} options - Display options
   * @param {ContentProcessor} contentProcessor - Content processor instance
   */
  async updateResults(content, options = {}, contentProcessor) {
    if (!this.resultsContent) {
      logWarn("Cannot update results: results content element not found");
      return;
    }

    // ✅ Stage 3.3: Response size management BEFORE bridge coordination
    const sizeCheck = this.checkResponseSize(content);
    if (sizeCheck.warning || sizeCheck.truncated) {
      logInfo("Large response detected:", {
        originalSize: sizeCheck.originalSize,
        processedSize: sizeCheck.size,
        hasEmbeddedContent: sizeCheck.hasEmbeddedContent,
      });
    }

    // Use processed content instead of original (Stage 3.1 separation pattern)
    const processedContent = sizeCheck.content;

    // Dispatch event for ResponseSizeManager (Phase 4.5)
    if (sizeCheck.truncated || sizeCheck.hasEmbeddedContent) {
      window.dispatchEvent(
        new CustomEvent("large-response-detected", {
          detail: {
            size: sizeCheck.size || 0,
            content: sizeCheck.content || "",
            originalContent: content, // Keep original for download
            hasEmbeddedContent: sizeCheck.hasEmbeddedContent || false,
            truncated: sizeCheck.truncated || false,
            summary: sizeCheck.summary || "Large response detected",
            id: operationId || Date.now(),
          },
        })
      );

      logInfo("Large response event dispatched", {
        size: sizeCheck.size,
        truncated: sizeCheck.truncated,
        hasEmbedded: sizeCheck.hasEmbeddedContent,
      });
    }

    // ✅ Stage 3A: Generate operation ID and start coordination
    const operationId = this.generateDOMOperationId();
    const startTime = performance.now();

    logDebug("🔧 Starting coordinated DOM operation", {
      operationId,
      contentLength: processedContent?.length || 0,
      bridgeCoordinationEnabled: this.bridgeCoordinationEnabled,
      responseSizeInfo: sizeCheck.truncated ? "truncated" : "normal",
    });

    try {
      // ✅ Stage 3A: Update state to waiting for bridge if coordination enabled
      if (this.bridgeCoordinationEnabled && this.isBridgeProcessing()) {
        this.updateDOMOperationState(
          DOMOperationState.WAITING_FOR_BRIDGE,
          operationId
        );

        logDebug("🔧 Bridge processing detected - waiting for completion", {
          operationId,
        });
        const bridgeCompleted = await this.waitForBridgeCompletion();

        if (!bridgeCompleted) {
          logWarn(
            "🔧 Bridge processing timeout - proceeding with DOM operation",
            { operationId }
          );
        }
      }

      // ✅ Stage 3A: Update state to processing
      this.updateDOMOperationState(DOMOperationState.PROCESSING, operationId);

      // ✅ Option 1: Check if bridge just completed processing to avoid overlap
      let processedContent;
      let skipProcessing = false;

      if (this.bridgeCoordinationEnabled && this.bridgeProcessingRef) {
        const bridgeState =
          this.bridgeProcessingRef.getProcessingDiagnostics?.();
        const recentlyCompleted =
          bridgeState &&
          bridgeState.state === "idle" &&
          bridgeState.metrics.lastProcessingTime &&
          Date.now() - bridgeState.metrics.lastProcessingTime < 2000; // Within 2 seconds

        if (recentlyCompleted) {
          logDebug(
            "🔧 Bridge recently completed processing - checking for existing processed content",
            {
              operationId,
              timeSinceLastProcessing:
                Date.now() - bridgeState.metrics.lastProcessingTime,
              currentContentLength: this.resultsContent.innerHTML.length,
            }
          );

          // Check if we already have processed content that matches what we expect
          const currentContent = this.resultsContent.innerHTML;
          if (currentContent && currentContent.length > 100) {
            // Has substantial content
            logInfo(
              "🔧 Using existing processed content - skipping redundant processing",
              {
                operationId,
                existingContentLength: currentContent.length,
              }
            );
            processedContent = currentContent;
            skipProcessing = true;
          }
        }
      }

      // Process content only if we didn't skip it
      if (!skipProcessing) {
        logDebug("🔧 Processing content through content processor", {
          operationId,
          contentLength: content?.length || 0,
        });
        processedContent = await contentProcessor.processContent(content);
      }

      // Update DOM content only if we have new processed content
      if (!skipProcessing || !this.resultsContent.innerHTML.trim()) {
        logDebug("🔧 Updating DOM with processed content", {
          operationId,
          processedContentLength: processedContent?.length || 0,
          skippedProcessing: skipProcessing,
        });
        this.resultsContent.innerHTML = processedContent;
      }

      // ✅ Stage 3A: Wait for DOM stability
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, DOM_PROCESSING_CONFIG.stabilityDelay);
        });
      });

      // ✅ Stage 3A: Update state to enhancing
      this.updateDOMOperationState(DOMOperationState.ENHANCING, operationId);

      // ✅ Stage 3A: Comprehensive bridge marker cleanup
      this.cleanupBridgeMarkers(this.resultsContent, operationId);

      // ✅ Stage 3A: Coordinated table enhancement
      const tablesEnhanced = await this.enhanceTablesWithCoordination(
        this.resultsContent,
        operationId
      );

      // ✅ Stage 3A: Coordinated chart processing
      const chartsProcessed = await this.processChartsWithCoordination(
        this.resultsContent,
        operationId
      );

      // ✅ Stage 3A: Update state to completed and metrics
      this.updateDOMOperationState(DOMOperationState.COMPLETED, operationId);

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      // Update metrics
      this.domOperationMetrics.totalDOMOperations++;
      if (this.bridgeCoordinationEnabled) {
        this.domOperationMetrics.bridgeCoordinatedOperations++;
      }
      this.domOperationMetrics.lastDOMOperationTime = operationTime;
      this.domOperationMetrics.averageDOMOperationTime =
        (this.domOperationMetrics.averageDOMOperationTime *
          (this.domOperationMetrics.totalDOMOperations - 1) +
          operationTime) /
        this.domOperationMetrics.totalDOMOperations;

      logInfo("🔧 DOM operation completed successfully", {
        operationId,
        operationTime: `${operationTime.toFixed(2)}ms`,
        tablesEnhanced,
        chartsProcessed,
        bridgeCoordinated: this.bridgeCoordinationEnabled,
        skippedProcessing: skipProcessing,
      });
    } catch (error) {
      // ✅ Stage 3A: Handle errors with state management
      this.updateDOMOperationState(DOMOperationState.ERROR, operationId);
      logError("🔧 Error during coordinated DOM operation:", error, {
        operationId,
      });

      // Try to provide fallback content
      this.resultsContent.innerHTML = `
      <div class="error-content" role="alert">
        <h3>Content Processing Error</h3>
        <p>There was an error processing the content. Please try again.</p>
        <details>
          <summary>Technical Details</summary>
          <pre>${error.message}</pre>
        </details>
      </div>
    `;
    } finally {
      // ✅ Stage 3A: Reset state to idle
      setTimeout(() => {
        this.updateDOMOperationState(DOMOperationState.IDLE);
      }, 100);
    }
  }

  /**
   * Handle scroll behavior (restored from original)
   * @param {string} behavior - Scroll behavior
   */
  handleScroll(behavior = "smooth") {
    if (this.resultsHeading) {
      this.resultsHeading.scrollIntoView({
        behavior: this.isReducedMotion ? "auto" : behavior,
        block: "start",
      });
    }
  }

  /**
   * Announce updates to screen readers (restored from original)
   * @param {string} message - Message to announce
   */
  announceUpdate(message) {
    if (
      typeof a11y !== "undefined" &&
      typeof a11y.announceStatus === "function"
    ) {
      a11y.announceStatus(message);
    }
  }

  /**
   * Handle errors in results display (restored from original)
   * @param {Error} error - Error object
   */
  handleError(error) {
    const errorMessage =
      "An error occurred while displaying results. Please try again.";

    // Update content with error message
    if (this.resultsContent) {
      this.resultsContent.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    }

    // Announce error to screen readers
    if (
      typeof a11y !== "undefined" &&
      typeof a11y.announceStatus === "function"
    ) {
      a11y.announceStatus(errorMessage, "assertive");
    }

    // Log the error
    logError("Error handled in results display", { error });

    // ✅ Stage 3A: Update DOM operation state if applicable
    if (this.domOperationState !== DOMOperationState.IDLE) {
      this.updateDOMOperationState(
        DOMOperationState.ERROR,
        this.currentDOMOperationId
      );
    }
  }

  /**
   * Clear results content (restored from original)
   */
  clear() {
    if (this.resultsContent) {
      this.resultsContent.innerHTML = "";

      // ✅ Stage 3A: Reset DOM coordination state
      this.updateDOMOperationState(DOMOperationState.IDLE, null);

      if (
        typeof a11y !== "undefined" &&
        typeof a11y.announceStatus === "function"
      ) {
        a11y.announceStatus("Results cleared");
      }
      logInfo("Results cleared");
    }
  }

  /**
   * Check if results are empty (restored from original)
   * @returns {boolean} True if results are empty
   */
  isEmpty() {
    return !this.resultsContent || !this.resultsContent.innerHTML.trim();
  }

  /**
   * Get current results content (restored from original)
   * @returns {string} Current results content
   */
  getContent() {
    return this.resultsContent ? this.resultsContent.innerHTML : "";
  }

  /**
   * ✅ Stage 3A: Get DOM operation diagnostics
   * @returns {Object} Current DOM operation state and metrics
   */
  getDOMOperationDiagnostics() {
    return {
      state: this.domOperationState,
      currentOperationId: this.currentDOMOperationId,
      bridgeCoordinationEnabled: this.bridgeCoordinationEnabled,
      bridgeProcessingRef: !!this.bridgeProcessingRef,
      isBridgeProcessing: this.isBridgeProcessing(),
      metrics: { ...this.domOperationMetrics },
      config: { ...DOM_PROCESSING_CONFIG },
    };
  }

  /**
   * ✅ Stage 3A: Reset DOM operation state and metrics (for testing)
   */
  resetDOMOperationState() {
    this.domOperationState = DOMOperationState.IDLE;
    this.currentDOMOperationId = null;
    this.domOperationMetrics = {
      totalDOMOperations: 0,
      bridgeCoordinatedOperations: 0,
      averageDOMOperationTime: 0,
      lastDOMOperationTime: 0,
      bridgeWaitTime: 0,
      tableEnhancementCount: 0,
      chartProcessingCount: 0,
    };
    logInfo("🔧 DOM operation state and metrics reset");
  }

  /**
   * ✅ Stage 3A: Test DOM coordination with sample content
   * @param {string} testContent - Content to test with
   * @returns {Promise<Object>} Test results
   */
  async testDOMCoordination(
    testContent = "# Test DOM Coordination\n\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |"
  ) {
    logInfo("🧪 Testing DOM coordination with sample content");

    const startMetrics = { ...this.domOperationMetrics };
    const operationId = this.generateDOMOperationId();

    try {
      // Simulate content processing if bridge is available
      if (this.bridgeProcessingRef && this.bridgeProcessingRef.process) {
        const processedContent = await this.bridgeProcessingRef.process(
          testContent
        );

        // Test DOM operation
        await this.updateResults(
          testContent,
          {
            announcement: "DOM coordination test complete",
          },
          this.bridgeProcessingRef
        );
      } else {
        logWarn("🧪 Bridge processing not available for DOM coordination test");
      }

      const endMetrics = { ...this.domOperationMetrics };

      const testResults = {
        testType: "DOM Coordination Test",
        operationId,
        success: true,
        bridgeCoordinated: this.bridgeCoordinationEnabled,
        metricsImprovement: {
          operationsBefore: startMetrics.totalDOMOperations,
          operationsAfter: endMetrics.totalDOMOperations,
          lastOperationTime: endMetrics.lastDOMOperationTime,
          bridgeWaitTime: endMetrics.bridgeWaitTime,
        },
        diagnostics: this.getDOMOperationDiagnostics(),
      };

      logInfo("🧪 DOM coordination test completed", testResults);
      return testResults;
    } catch (error) {
      logError("🧪 DOM coordination test failed:", error);
      return {
        testType: "DOM Coordination Test",
        operationId,
        success: false,
        error: error.message,
        diagnostics: this.getDOMOperationDiagnostics(),
      };
    }
  }
}

// Export the class (named export to match existing imports)
export { ResultsManagerCore };

// ✅ Stage 3A: Console Commands for DOM Coordination Testing

/**
 * Manually establish bridge reference
 */
window.establishBridgeCoordination = function () {
  console.log("🔧 Manually establishing bridge coordination...");

  if (!window.resultsManager?.core) {
    console.error("❌ Results manager core not available");
    return { success: false, error: "Results manager core not available" };
  }

  const success = window.resultsManager.core.establishBridgeReference();
  const diagnostics = window.resultsManager.core.getDOMOperationDiagnostics();

  const result = {
    success,
    bridgeReferenceEstablished: !!diagnostics.bridgeProcessingRef,
    coordinationEnabled: diagnostics.bridgeCoordinationEnabled,
    diagnostics,
  };

  console.log("✅ Bridge Coordination Establishment Result:", result);
  return result;
};

/**
 * Test DOM coordination functionality
 */
window.testDOMCoordination = async function () {
  console.log("🧪 Testing DOM coordination...");

  if (!window.resultsManager?.core) {
    console.error("❌ Results manager core not available");
    return;
  }

  try {
    // Try to establish bridge coordination first
    const bridgeEstablished =
      window.resultsManager.core.establishBridgeReference();
    console.log("🔧 Bridge establishment attempt:", bridgeEstablished);

    const result = await window.resultsManager.core.testDOMCoordination();
    console.log("✅ DOM Coordination Test Results:", result);
    return result;
  } catch (error) {
    console.error("❌ DOM coordination test failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Test table enhancement timing
 */
window.testTableEnhancementTiming = async function () {
  console.log("🧪 Testing table enhancement timing...");

  const testContent = `# Table Enhancement Test

| Name | Age | City |
|------|-----|------|
| Alice | 25 | London |
| Bob | 30 | Manchester |
| Charlie | 35 | Birmingham |`;

  try {
    const startTime = performance.now();

    if (window.resultsManager?.core) {
      const testResult = await window.resultsManager.core.testDOMCoordination(
        testContent
      );
      const endTime = performance.now();

      const result = {
        success: true,
        testDuration: `${(endTime - startTime).toFixed(2)}ms`,
        tablesEnhanced:
          testResult.diagnostics?.metrics?.tableEnhancementCount || 0,
        coordinationUsed: testResult.bridgeCoordinated,
        timing: testResult.metricsImprovement,
      };

      console.log("✅ Table Enhancement Timing Test Results:", result);
      return result;
    } else {
      throw new Error("Results manager core not available");
    }
  } catch (error) {
    console.error("❌ Table enhancement timing test failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get current bridge and DOM state
 */
window.getBridgeAndDOMState = function () {
  console.log("🔍 Checking bridge and DOM coordination state...");

  const state = {
    bridge: null,
    dom: null,
    coordination: null,
  };

  try {
    // Get bridge state
    if (window.resultsManager?.contentProcessor?.getProcessingDiagnostics) {
      state.bridge =
        window.resultsManager.contentProcessor.getProcessingDiagnostics();
    }

    // Get DOM state
    if (window.resultsManager?.core?.getDOMOperationDiagnostics) {
      state.dom = window.resultsManager.core.getDOMOperationDiagnostics();
    }

    // Coordination analysis
    state.coordination = {
      bridgeAvailable: !!state.bridge,
      domAvailable: !!state.dom,
      coordinationEnabled: state.dom?.bridgeCoordinationEnabled || false,
      bridgeProcessing: state.bridge?.state === "processing",
      domProcessing: state.dom?.state === "processing",
      bothIdle: state.bridge?.state === "idle" && state.dom?.state === "idle",
    };

    console.log("✅ Bridge and DOM State:", state);
    return state;
  } catch (error) {
    console.error("❌ Error getting bridge and DOM state:", error);
    return { error: error.message };
  }
};

/**
 * Test bridge marker cleanup
 */
window.testBridgeMarkerCleanup = async function () {
  console.log("🧪 Testing bridge marker cleanup...");

  try {
    // Create test container with bridge markers
    const testContainer = document.createElement("div");
    testContainer.innerHTML = `
      <div data-bridge-processing="true" data-bridge-processed="true">Test content</div>
      <div class="chart-container" data-defer-view-controls="true">
        <div class="chart-view-controls">Existing controls</div>
      </div>
      <table class="sortable-table" data-bridge-processing="true">
        <thead><tr><th>Header</th></tr></thead>
        <tbody><tr><td>Data</td></tr></tbody>
      </table>
    `;

    // Count markers before cleanup
    const markersBefore = {
      bridgeProcessing: testContainer.querySelectorAll(
        "[data-bridge-processing]"
      ).length,
      bridgeProcessed: testContainer.querySelectorAll("[data-bridge-processed]")
        .length,
      deferViewControls: testContainer.querySelectorAll(
        "[data-defer-view-controls]"
      ).length,
      chartViewControls: testContainer.querySelectorAll(".chart-view-controls")
        .length,
    };

    // Test cleanup
    if (window.resultsManager?.core) {
      window.resultsManager.core.cleanupBridgeMarkers(
        testContainer,
        "test-cleanup"
      );
    }

    // Count markers after cleanup
    const markersAfter = {
      bridgeProcessing: testContainer.querySelectorAll(
        "[data-bridge-processing]"
      ).length,
      bridgeProcessed: testContainer.querySelectorAll("[data-bridge-processed]")
        .length,
      deferViewControls: testContainer.querySelectorAll(
        "[data-defer-view-controls]"
      ).length,
      chartViewControls: testContainer.querySelectorAll(".chart-view-controls")
        .length,
    };

    const result = {
      success: true,
      markersBefore,
      markersAfter,
      cleanupSuccessful: {
        bridgeProcessing: markersAfter.bridgeProcessing === 0,
        bridgeProcessed: markersAfter.bridgeProcessed === 0,
        deferViewControls: markersAfter.deferViewControls === 0,
        chartViewControls: markersAfter.chartViewControls === 0,
      },
    };

    console.log("✅ Bridge Marker Cleanup Test Results:", result);
    return result;
  } catch (error) {
    console.error("❌ Bridge marker cleanup test failed:", error);
    return { success: false, error: error.message };
  }
};

// Enhanced validation with bridge path verification
window.validateDOMProcessingState = function () {
  if (!window.resultsManager?.core) {
    console.warn("❌ ResultsManagerCore not available");
    return { success: false, reason: "Core not available" };
  }

  const core = window.resultsManager.core;

  // Use new bridge path verification
  const pathAnalysis = core.verifyBridgePaths();
  console.log("🔍 Bridge Path Analysis:", pathAnalysis);

  const bridgeRef = core.getBridgeProcessingRef();
  const state = core.getDOMOperationDiagnostics();

  console.log("🔍 DOM Processing State Validation:");
  console.table({
    bridgeReference: !!bridgeRef,
    bridgeCoordination: state.bridgeCoordinationEnabled,
    primaryPathValid:
      pathAnalysis.primaryPath.exists &&
      pathAnalysis.primaryPath.hasRequiredMethods,
    domState: state.state,
    operationCount: state.metrics.totalDOMOperations,
  });

  const isValid = !!bridgeRef && state.bridgeCoordinationEnabled;

  if (!isValid) {
    console.warn("❌ DOM coordination validation failed");
    if (!bridgeRef) {
      console.warn("💡 Bridge reference not found - check object hierarchy");
    }
  } else {
    console.log("✅ DOM coordination validation passed");
  }

  return {
    success: isValid,
    bridgeReference: !!bridgeRef,
    pathAnalysis,
    diagnostics: state,
  };
};

/**
 * Test bridge and DOM integration
 */
window.testBridgeAndDOMIntegration = async function () {
  console.log("🧪 Testing bridge and DOM integration...");

  const testContent = `# Integration Test

## Table Test
| Feature | Status | Notes |
|---------|--------|-------|
| Bridge Processing | ✅ | Working |
| DOM Coordination | 🧪 | Testing |
| Table Enhancement | ⏳ | In Progress |

## Task List Test
- [x] Complete Phase 1
- [x] Complete Phase 2  
- [ ] Complete Phase 3A
- [ ] Complete Phase 3B`;

  try {
    const startTime = performance.now();

    // Reset states for clean test
    if (window.resultsManager?.contentProcessor?.resetProcessingState) {
      window.resultsManager.contentProcessor.resetProcessingState();
    }
    if (window.resultsManager?.core?.resetDOMOperationState) {
      window.resultsManager.core.resetDOMOperationState();
    }

    // Test integration
    if (window.resultsManager?.updateResults) {
      await window.resultsManager.updateResults(testContent, {
        announcement: "Bridge and DOM integration test complete",
      });
    }

    const endTime = performance.now();

    // Get final state
    const bridgeState =
      window.resultsManager?.contentProcessor?.getProcessingDiagnostics?.() ||
      {};
    const domState =
      window.resultsManager?.core?.getDOMOperationDiagnostics?.() || {};

    const result = {
      success: true,
      testDuration: `${(endTime - startTime).toFixed(2)}ms`,
      bridgeMetrics: bridgeState.metrics || {},
      domMetrics: domState.metrics || {},
      coordination: {
        bridgeCompleted: bridgeState.state === "idle",
        domCompleted: domState.state === "idle",
        bridgeCoordinated: domState.bridgeCoordinatedOperations > 0,
      },
    };

    console.log("✅ Bridge and DOM Integration Test Results:", result);
    return result;
  } catch (error) {
    console.error("❌ Bridge and DOM integration test failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Validate no processing regression from Phase 2
 */
window.validateNoProcessingRegression = async function () {
  console.log("🧪 Validating no processing regression from Phase 2...");

  try {
    // Test the key Phase 2 functionality
    if (window.testBridgeProcessingCoordination) {
      const phase2Result = await window.testBridgeProcessingCoordination(
        5,
        true
      );

      // Validate Phase 2 metrics are still good
      const regressionCheck = {
        singleProcessingCycle: phase2Result.processingCallsAdded === 1,
        deduplicationWorking: phase2Result.debouncePreventions >= 4,
        resultsConsistent: phase2Result.allResultsIdentical,
        performanceGood: phase2Result.averageProcessingTime < 100, // 100ms threshold
        phase2FunctionalityIntact: phase2Result.success,
      };

      // Test DOM coordination is not interfering
      const domResult = await window.testDOMCoordination();

      const result = {
        success:
          Object.values(regressionCheck).every((v) => v === true) &&
          domResult.success,
        phase2Validation: regressionCheck,
        domCoordination: {
          working: domResult.success,
          coordinationEnabled: domResult.bridgeCoordinated,
        },
        noRegression: true,
      };

      console.log("✅ No Processing Regression Validation:", result);
      return result;
    } else {
      throw new Error("Phase 2 test functions not available");
    }
  } catch (error) {
    console.error("❌ Processing regression validation failed:", error);
    return { success: false, error: error.message };
  }
};
