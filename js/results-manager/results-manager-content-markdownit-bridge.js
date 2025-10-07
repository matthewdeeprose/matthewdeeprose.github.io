/**
 * @module MarkdownItBridge
 * @description Bridge to connect OpenRouter with MarkdownEditor processing
 * Phase 2: Enhanced with processing coordination and diagnostics
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

// Logging configuration (at module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN; // ✅ Changed from DEBUG to WARN for production
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Helper functions for controlled logging
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

// ✅ Phase 2: Processing State Management
const ProcessingState = {
  IDLE: "idle",
  PROCESSING: "processing",
  COMPLETED: "completed",
  ERROR: "error",
};

// ✅ Phase 2: Processing Coordination Configuration
const PROCESSING_CONFIG = {
  DEBOUNCE_DELAY: 150, // milliseconds - leading edge delay
  MAX_DEBOUNCE_WAIT: 1000, // milliseconds - maximum wait time
  RETRY_ATTEMPTS: 3, // maximum retry attempts
  TIMEOUT_DURATION: 15000, // milliseconds - processing timeout
};

export class MarkdownItBridge extends ContentProcessorBase {
  /**
   * Create a new MarkdownItBridge instance
   */
  constructor() {
    super();
    this.markdownEditorReady = false;
    this.initializationPromise = null;

    // ✅ Phase 2: Processing State Tracking
    this.processingState = ProcessingState.IDLE;
    this.currentProcessingId = null;
    this.processingQueue = new Map(); // content hash -> processing promise
    this.lastProcessedHash = null; // Track hash of currently processing content
    this.processingMetrics = {
      totalProcessingCalls: 0,
      successfulProcessing: 0,
      debouncePreventions: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
    };

    // ✅ Phase 2: Debouncing Infrastructure
    this.debouncedProcess = this.createDebouncedProcess();

    // ✅ Phase 2: Expose instance globally for testing
    if (typeof window !== "undefined") {
      // Store instance for global access
      if (!window.MarkdownItBridge) window.MarkdownItBridge = {};
      window.MarkdownItBridge.instance = this;

      // Also store as bridgeInstance for easier access
      window.bridgeInstance = this;
    }

    logInfo("MarkdownIt bridge initialised with processing coordination");
  }

  /**
   * ✅ Phase 2: Create debounced processing function with leading and trailing edge
   * @returns {Function} Debounced process function
   */
  createDebouncedProcess() {
    let timeoutId = null;
    let lastCallTime = 0;
    let lastArgs = null;
    let leadingProcessed = false;
    let activePromise = null; // Track active processing promise

    return (content, options = {}) => {
      const currentTime = Date.now();
      const timeSinceLastCall = currentTime - lastCallTime;
      const contentHash = this.generateContentHash(content);
      lastCallTime = currentTime;
      lastArgs = [content, options];

      // ✅ Check for identical content in progress (immediate deduplication)
      if (activePromise && this.lastProcessedHash === contentHash) {
        this.processingMetrics.debouncePreventions++;
        logInfo(
          `🔄 Reusing active processing for identical content (hash: ${contentHash})`
        );
        return activePromise;
      }

      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // ✅ Leading edge: Process immediately if enough time has passed
      if (
        timeSinceLastCall >= PROCESSING_CONFIG.DEBOUNCE_DELAY &&
        !leadingProcessed
      ) {
        leadingProcessed = true;
        this.lastProcessedHash = contentHash;
        logInfo("🚀 Processing content immediately (leading edge)");

        activePromise = this.processWithCoordination(content, options).finally(
          () => {
            activePromise = null;
            this.lastProcessedHash = null;
          }
        );

        return activePromise;
      }

      // ✅ For simultaneous calls, reuse active promise if content is identical
      if (activePromise && this.lastProcessedHash === contentHash) {
        this.processingMetrics.debouncePreventions++;
        logInfo(
          `🔄 Reusing active processing for simultaneous identical call (hash: ${contentHash})`
        );
        return activePromise;
      }

      // ✅ Trailing edge: Process after delay
      const trailingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          leadingProcessed = false;
          this.lastProcessedHash = contentHash;
          logInfo("⏱️ Processing content after debounce delay (trailing edge)");

          activePromise = this.processWithCoordination(
            content,
            options
          ).finally(() => {
            activePromise = null;
            this.lastProcessedHash = null;
          });

          activePromise.then(resolve).catch(reject);
        }, PROCESSING_CONFIG.DEBOUNCE_DELAY);

        // ✅ Maximum wait safeguard
        setTimeout(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            leadingProcessed = false;
            this.lastProcessedHash = this.generateContentHash(lastArgs[0]);
            logInfo("⏰ Processing content after maximum wait time");

            activePromise = this.processWithCoordination(
              lastArgs[0],
              lastArgs[1]
            ).finally(() => {
              activePromise = null;
              this.lastProcessedHash = null;
            });

            activePromise.then(resolve).catch(reject);
          }
        }, PROCESSING_CONFIG.MAX_DEBOUNCE_WAIT);
      });

      return trailingPromise;
    };
  }

  /**
   * ✅ Phase 2: Generate content hash for deduplication
   * @param {string} content - Content to hash
   * @returns {string} Simple hash of content
   */
  generateContentHash(content) {
    let hash = 0;
    if (!content || content.length === 0) return hash.toString();

    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * ✅ Phase 2: Enhanced processing with coordination and metrics
   * @param {string} content - Content to process
   * @param {Object} options - Processing options
   * @returns {Promise<string>} Processed content with metrics
   */
  async processWithCoordination(content, options = {}) {
    const processingId = Math.random().toString(36).substring(2, 15);
    const contentHash = this.generateContentHash(content);
    const startTime = performance.now();

    // ✅ Update metrics
    this.processingMetrics.totalProcessingCalls++;

    try {
      // ✅ Check if identical content is already being processed
      if (this.processingQueue.has(contentHash)) {
        this.processingMetrics.debouncePreventions++;
        logInfo(`Reusing existing processing for content hash: ${contentHash}`);
        return await this.processingQueue.get(contentHash);
      }

      // ✅ Check processing state
      if (
        this.processingState === ProcessingState.PROCESSING &&
        !options.force
      ) {
        logWarn(
          `Processing already in progress (ID: ${this.currentProcessingId}), queueing request`
        );
        // Wait for current processing to complete, then try again
        await this.waitForProcessingComplete();
        return this.processWithCoordination(content, {
          ...options,
          force: false,
        });
      }

      // ✅ Set processing state
      this.processingState = ProcessingState.PROCESSING;
      this.currentProcessingId = processingId;

      logInfo(
        `🔄 Starting coordinated processing (ID: ${processingId}, Hash: ${contentHash})`
      );

      // ✅ Create processing promise and add to queue
      const processingPromise = this.executeProcessing(
        content,
        processingId,
        startTime
      );
      this.processingQueue.set(contentHash, processingPromise);

      const result = await processingPromise;

      // ✅ Update metrics on success
      const processingTime = performance.now() - startTime;
      this.processingMetrics.successfulProcessing++;
      this.processingMetrics.lastProcessingTime = processingTime;
      this.processingMetrics.averageProcessingTime =
        (this.processingMetrics.averageProcessingTime *
          (this.processingMetrics.successfulProcessing - 1) +
          processingTime) /
        this.processingMetrics.successfulProcessing;

      logInfo(
        `✅ Processing completed successfully (ID: ${processingId}, Time: ${processingTime.toFixed(
          2
        )}ms)`
      );

      return result;
    } catch (error) {
      this.processingState = ProcessingState.ERROR;
      logError(`❌ Processing failed (ID: ${processingId}):`, error);
      throw error;
    } finally {
      // ✅ Cleanup
      this.processingQueue.delete(contentHash);
      if (this.currentProcessingId === processingId) {
        this.processingState = ProcessingState.IDLE;
        this.currentProcessingId = null;
      }
    }
  }

  /**
   * ✅ Phase 2: Wait for current processing to complete
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>} Promise that resolves when processing is complete
   */
  async waitForProcessingComplete(
    timeout = PROCESSING_CONFIG.TIMEOUT_DURATION
  ) {
    return new Promise((resolve, reject) => {
      const checkInterval = 50; // milliseconds
      let elapsed = 0;

      const checker = setInterval(() => {
        elapsed += checkInterval;

        if (
          this.processingState === ProcessingState.IDLE ||
          this.processingState === ProcessingState.COMPLETED ||
          this.processingState === ProcessingState.ERROR
        ) {
          clearInterval(checker);
          resolve();
        } else if (elapsed >= timeout) {
          clearInterval(checker);
          reject(new Error(`Processing timeout after ${timeout}ms`));
        }
      }, checkInterval);
    });
  }

  /**
   * ✅ Phase 2: Execute the actual processing with enhanced timing
   * @param {string} content - Content to process
   * @param {string} processingId - Unique processing identifier
   * @param {number} startTime - Processing start time
   * @returns {Promise<string>} Processed content
   */
  async executeProcessing(content, processingId, startTime) {
    if (!content) return "";

    // ✅ Stage 1: Ensure MarkdownEditor Ready
    const stageStart = performance.now();
    logDebug(`📊 Stage 1: Ensuring MarkdownEditor ready (ID: ${processingId})`);

    const isReady = await this.ensureMarkdownEditorReady();
    if (!isReady) {
      logWarn("MarkdownEditor not available, using fallback");
      return this.fallbackProcess(content);
    }

    const stage1Time = performance.now() - stageStart;
    logDebug(`📊 Stage 1 Complete: ${stage1Time.toFixed(2)}ms`);

    // ✅ Stage 2: MarkdownEditor Pipeline Processing
    const stage2Start = performance.now();
    logInfo(
      `📊 Stage 2: Processing content with MarkdownEditor pipeline (ID: ${processingId})`
    );

    // Create a temporary container to capture the output
    const tempContainer = document.createElement("div");
    tempContainer.style.display = "none";
    tempContainer.setAttribute("data-processing-id", processingId);
    document.body.appendChild(tempContainer);

    try {
      // ✅ Stage 3: Core Processing
      const stage3Start = performance.now();
      logDebug(
        `📊 Stage 3: Core MarkdownEditor processing (ID: ${processingId})`
      );

      const result = await this.processWithMarkdownEditor(
        content,
        tempContainer,
        processingId
      );

      const stage3Time = performance.now() - stage3Start;
      const stage2Time = performance.now() - stage2Start;
      const totalTime = performance.now() - startTime;

      logDebug(`📊 Stage 3 Complete: ${stage3Time.toFixed(2)}ms`);
      logDebug(`📊 Stage 2 Complete: ${stage2Time.toFixed(2)}ms`);
      logInfo(
        `📊 Total Processing Time: ${totalTime.toFixed(
          2
        )}ms (ID: ${processingId})`
      );

      return result;
    } finally {
      // Clean up
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * Public process method (now uses debounced coordination)
   * @param {string} content - Raw markdown content
   * @returns {Promise<string>} Processed HTML content
   */
  async process(content) {
    try {
      return await this.debouncedProcess(content);
    } catch (error) {
      logError("Error in coordinated processing", { error });
      return this.fallbackProcess(content);
    }
  }

  /**
   * ✅ Phase 2: Enhanced processing with better coordination
   * @param {string} content - Markdown content
   * @param {HTMLElement} container - Temporary container for processing
   * @param {string} processingId - Processing identifier for tracking
   * @returns {Promise<string>} Processed HTML
   */
  async processWithMarkdownEditor(content, container, processingId) {
    return new Promise((resolve, reject) => {
      try {
        logDebug(`🔧 Creating MarkdownIt instance (ID: ${processingId})`);

        // Access MarkdownEditor's internal markdown-it instance
        const md = this.createMarkdownItInstance();

        logDebug(`🔧 Rendering markdown content (ID: ${processingId})`);

        // Process the content
        let htmlResult = md.render(content);

        logDebug(`🔧 Enhancing header anchors (ID: ${processingId})`);

        // Apply the same enhancements as MarkdownEditor
        htmlResult = this.enhanceHeaderAnchors(htmlResult);

        logDebug(`🔧 Setting container content (ID: ${processingId})`);

        // Set the content to trigger post-processing
        container.innerHTML = htmlResult;

        logDebug(`🔧 Starting post-processing (ID: ${processingId})`);

        // Apply post-processing like MarkdownEditor does
        this.applyPostProcessing(container, processingId)
          .then(() => {
            logDebug(`🔧 Post-processing complete (ID: ${processingId})`);
            resolve(container.innerHTML);
          })
          .catch(reject);
      } catch (error) {
        logError(`Processing error (ID: ${processingId}):`, error);
        reject(error);
      }
    });
  }

  /**
   * ✅ Phase 2: Enhanced post-processing with coordination tracking
   * @param {HTMLElement} container - Container with rendered content
   * @param {string} processingId - Processing identifier
   * @returns {Promise<void>} Promise that resolves when post-processing is complete
   */
  async applyPostProcessing(container, processingId = "unknown") {
    try {
      logDebug(`🔧 Starting post-processing (ID: ${processingId})...`);

      // Apply syntax highlighting
      if (window.Prism) {
        window.Prism.highlightAllUnder(container);
        logDebug(`🔧 Prism syntax highlighting applied (ID: ${processingId})`);
      }

      // Apply MathJax typesetting
      if (
        window.MathJax &&
        typeof window.MathJax.typesetPromise === "function"
      ) {
        // Try queue system first for race condition prevention
        if (window.mathJaxManager) {
          const managerStatus = window.mathJaxManager.getStatus();

          if (managerStatus.isHealthy) {
            try {
              await window.mathJaxManager.queueTypeset(container);
              logDebug(`🔧 MathJax rendering via queue (ID: ${processingId})`);
            } catch (error) {
              logWarn(
                `Queue rendering failed for ${processingId}, using direct fallback:`,
                error
              );
              // Fallback to direct rendering if queue fails
              await window.MathJax.typesetPromise([container]);
              logDebug(
                `🔧 MathJax direct fallback applied (ID: ${processingId})`
              );
            }
          } else {
            // Manager exists but unhealthy, use direct rendering
            logDebug(
              `🔧 MathJax Manager unhealthy, using direct rendering (ID: ${processingId})`
            );
            await window.MathJax.typesetPromise([container]);
          }
        } else {
          // Manager not available, use direct rendering
          logDebug(
            `🔧 MathJax Manager not available, using direct rendering (ID: ${processingId})`
          );
          await window.MathJax.typesetPromise([container]);
        }
      }

      // Don't enhance tables in temporary container
      logDebug(
        `🔧 Skipping table enhancement in temporary container (ID: ${processingId})`
      );
      logDebug(
        `🔧 Tables will be enhanced after HTML insertion (ID: ${processingId})`
      );

      // Find simple tables for logging purposes only
      const simpleTables = container.querySelectorAll("table.sortable-table");
      logDebug(
        `🔧 Found ${simpleTables.length} simple table(s) ready for enhancement (ID: ${processingId})`
      );

      // Initialize code copy functionality
      if (window.MarkdownCodeCopy) {
        window.MarkdownCodeCopy.init(container);
        logDebug(
          `🔧 Code copy functionality initialised (ID: ${processingId})`
        );
      }

      logDebug(
        `🔧 Post-processing complete - charts and tables will be enhanced after DOM insertion (ID: ${processingId})`
      );
    } catch (error) {
      logError(`Error in post-processing (ID: ${processingId}):`, error);
    }
  }

  /**
   * ✅ Phase 2: Enhanced diagnostics and testing methods
   */

  /**
   * Get current processing metrics
   * @returns {Object} Processing metrics and state
   */
  getProcessingDiagnostics() {
    return {
      state: this.processingState,
      currentProcessingId: this.currentProcessingId,
      metrics: { ...this.processingMetrics },
      queueSize: this.processingQueue.size,
      isReady: this.markdownEditorReady,
      config: { ...PROCESSING_CONFIG },
    };
  }

  /**
   * Reset processing state and metrics (for testing)
   */
  resetProcessingState() {
    this.processingState = ProcessingState.IDLE;
    this.currentProcessingId = null;
    this.processingQueue.clear();
    this.lastProcessedHash = null;
    this.processingMetrics = {
      totalProcessingCalls: 0,
      successfulProcessing: 0,
      debouncePreventions: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
    };
    logInfo("Processing state and metrics reset");
  }

  /**
   * Test processing coordination with sample content
   * @param {number} calls - Number of rapid calls to make
   * @param {boolean} useIdenticalContent - Whether to use identical content for all calls
   * @returns {Promise<Object>} Test results
   */
  async testProcessingCoordination(calls = 5, useIdenticalContent = true) {
    logInfo(
      `🧪 Testing processing coordination with ${calls} rapid calls (identical content: ${useIdenticalContent})`
    );

    const startMetrics = { ...this.processingMetrics };
    const baseContent =
      "# Test Coordination\n\nThis is a test of processing coordination.";

    // Make rapid successive calls
    const promises = [];
    for (let i = 0; i < calls; i++) {
      const testContent = useIdenticalContent
        ? baseContent // Same content for debouncing test
        : baseContent + ` Call ${i}`; // Different content for queue management test
      promises.push(this.process(testContent));
    }

    const results = await Promise.all(promises);
    const endMetrics = { ...this.processingMetrics };

    const testResults = {
      testType: useIdenticalContent ? "debouncing" : "queue-management",
      callsMade: calls,
      resultsReceived: results.length,
      processingCallsAdded:
        endMetrics.totalProcessingCalls - startMetrics.totalProcessingCalls,
      debouncePreventions:
        endMetrics.debouncePreventions - startMetrics.debouncePreventions,
      averageProcessingTime: endMetrics.averageProcessingTime,
      lastProcessingTime: endMetrics.lastProcessingTime,
      allResultsIdentical: results.every((result) => result === results[0]),
      sampleResultLength: results[0]?.length || 0,
      uniqueResults: new Set(results).size,
    };

    logInfo("🧪 Coordination test results:", testResults);

    // Provide interpretation
    if (useIdenticalContent) {
      logInfo("📊 Debouncing Test Analysis:");
      logInfo(
        `   Expected: 1-2 processing calls, ~${calls - 1} debounce preventions`
      );
      logInfo(
        `   Actual: ${testResults.processingCallsAdded} processing calls, ${testResults.debouncePreventions} debounce preventions`
      );
      logInfo(
        `   Debouncing ${
          testResults.processingCallsAdded <= 2 &&
          testResults.debouncePreventions >= calls - 2
            ? "✅ WORKING"
            : "❌ NOT WORKING"
        }`
      );
    } else {
      logInfo("📊 Queue Management Test Analysis:");
      logInfo(`   Expected: ${calls} processing calls (different content)`);
      logInfo(
        `   Actual: ${testResults.processingCallsAdded} processing calls`
      );
      logInfo(
        `   Queue Management ${
          testResults.processingCallsAdded === calls
            ? "✅ WORKING"
            : "❌ ISSUE DETECTED"
        }`
      );
    }

    return testResults;
  }

  /**
   * Simple test function that bypasses full processing for quick testing
   * @returns {Promise<Object>} Basic test results
   */
  async testBasicFunctionality() {
    logInfo("🧪 Testing basic bridge functionality...");

    const startTime = performance.now();
    const testResults = {
      bridgeReady: this.markdownEditorReady,
      markdownEditorExists: typeof window.MarkdownEditor !== "undefined",
      markdownItExists: typeof window.markdownit !== "undefined",
      processingState: this.processingState,
      metrics: { ...this.processingMetrics },
    };

    // Test MarkdownEditor readiness
    try {
      const isReady = await this.ensureMarkdownEditorReady();
      testResults.canInitializeMarkdownEditor = isReady;
      testResults.initializationTime = performance.now() - startTime;
    } catch (error) {
      testResults.initializationError = error.message;
    }

    logInfo("🧪 Basic functionality test results:", testResults);
    return testResults;
  }

  // ✅ Keep all existing methods unchanged (ensureMarkdownEditorReady, createMarkdownItInstance, etc.)

  /**
   * Ensure MarkdownEditor is available and ready
   * @returns {Promise<boolean>} Promise that resolves when MarkdownEditor is ready
   */
  async ensureMarkdownEditorReady() {
    // Wait for DOM to be fully ready first
    if (document.readyState !== "complete") {
      await new Promise((resolve) => {
        if (document.readyState === "complete") resolve();
        else window.addEventListener("load", resolve, { once: true });
      });
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise((resolve) => {
      // Check if MarkdownEditor is already available
      if (
        window.MarkdownEditor &&
        typeof window.MarkdownEditor.init === "function"
      ) {
        this.markdownEditorReady = true;
        logInfo("MarkdownEditor is already available");
        resolve(true);
        return;
      }

      // Wait for MarkdownEditor to become available
      const checkInterval = setInterval(() => {
        if (
          window.MarkdownEditor &&
          typeof window.MarkdownEditor.init === "function"
        ) {
          clearInterval(checkInterval);
          this.markdownEditorReady = true;
          logInfo("MarkdownEditor became available");
          resolve(true);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!this.markdownEditorReady) {
          logWarn("MarkdownEditor not available after timeout");
          resolve(false);
        }
      }, 10000);
    });

    return this.initializationPromise;
  }

  /**
   * Create markdown-it instance with the same configuration as MarkdownEditor
   * @returns {Object} Configured markdown-it instance
   */
  createMarkdownItInstance() {
    // This replicates MarkdownEditor's initializeMarkdownIt() function
    const md = window.markdownit({
      html: true,
      breaks: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang) {
        if (lang && window.Prism && window.Prism.languages[lang]) {
          try {
            return (
              '<pre class="language-' +
              lang +
              '"><code>' +
              window.Prism.highlight(str, window.Prism.languages[lang], lang) +
              "</code></pre>"
            );
          } catch (err) {
            logWarn(`Syntax highlighting failed for ${lang}`);
          }
        }
        return (
          '<pre class="language-none"><code>' +
          md.utils.escapeHtml(str) +
          "</code></pre>"
        );
      },
    });

    // Add the same plugins that MarkdownEditor uses
    this.addMarkdownItPlugins(md);

    // Add the same custom renderers
    this.addCustomRenderers(md);

    return md;
  }

  /**
   * Add markdown-it plugins (same as MarkdownEditor)
   * @param {Object} md - markdown-it instance
   */
  addMarkdownItPlugins(md) {
    // Enable tables
    md.enable("table");

    // 🔧 BRIDGE FIX: Use simple table renderer instead of pre-enhanced sortable tables
    // This generates simple tables that AccessibleSortableTable can properly enhance
    this.addSimpleTableRenderer(md);

    // Add all the plugins that MarkdownEditor uses
    const plugins = [
      { name: "sub", plugin: window.markdownitSub },
      { name: "sup", plugin: window.markdownitSup },
      { name: "footnote", plugin: window.markdownitFootnote },
      { name: "deflist", plugin: window.markdownitDeflist },
      { name: "abbr", plugin: window.markdownitAbbr },
      { name: "emoji", plugin: window.markdownitEmoji },
      { name: "ins", plugin: window.markdownitIns },
      { name: "mark", plugin: window.markdownitMark },
      { name: "task-lists", plugin: window.markdownitTaskLists },
      { name: "container", plugin: window.markdownitContainer },
      { name: "anchor", plugin: window.markdownItAnchor },
      { name: "toc", plugin: window.markdownItTocDoneRight },
      { name: "attrs", plugin: window.markdownitAttrs },
      { name: "multimd-table", plugin: window.markdownitMultimdTable },
      { name: "implicit-figures", plugin: window.markdownitImplicitFigures },
      { name: "tab", plugin: window.markdownitTab },
    ];

    // Add each plugin with the same configuration as MarkdownEditor
    plugins.forEach(({ name, plugin }) => {
      if (plugin) {
        try {
          if (name === "container") {
            md.use(plugin, "info").use(plugin, "warning").use(plugin, "danger");
          } else if (name === "anchor") {
            md.use(plugin, {
              permalink: plugin.permalink.linkInsideHeader({
                class: "header-anchor",
                symbol:
                  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
                placement: "after",
                space: true,
                ariaHidden: false,
              }),
              slugify: function (s) {
                return String(s)
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^\w\-]+/g, "")
                  .replace(/\-\-+/g, "-")
                  .replace(/^-+/, "")
                  .replace(/-+$/, "");
              },
            });
          } else {
            md.use(plugin);
          }
        } catch (error) {
          logWarn(`Failed to add ${name} plugin`, { error });
        }
      }
    });
  }

  /**
   * Add simple table renderer that generates tables for AccessibleSortableTable enhancement
   * @param {Object} md - markdown-it instance
   */
  addSimpleTableRenderer(md) {
    // Store original table renderer
    const originalTableOpen =
      md.renderer.rules.table_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    // Override table_open to add sortable class for later enhancement
    md.renderer.rules.table_open = function (tokens, idx, options, env, self) {
      const token = tokens[idx];

      // Add the sortable-table class that AccessibleSortableTable looks for
      token.attrJoin("class", "sortable-table");

      logDebug("Generated simple table with sortable-table class");

      return originalTableOpen(tokens, idx, options, env, self);
    };
  }

  /**
   * Add custom renderers (charts, mermaid, etc.)
   * @param {Object} md - markdown-it instance
   */
  addCustomRenderers(md) {
    // Add the same fence renderer as MarkdownEditor for charts and mermaid
    const originalFence =
      md.renderer.rules.fence ||
      function (tokens, idx, options, env, slf) {
        return (
          "<pre><code>" +
          md.utils.escapeHtml(tokens[idx].content) +
          "</code></pre>"
        );
      };

    md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
      const token = tokens[idx];
      const code = token.content.trim();
      const info = token.info.trim();

      if (info === "chart") {
        return this.renderChart(code);
      } else if (info === "mermaid" && window.mermaid) {
        return this.renderMermaid(code);
      }

      return originalFence(tokens, idx, options, env, slf);
    };
  }

  /**
   * Render chart with improved JSON validation for streaming
   * @param {string} code - Chart configuration JSON
   * @returns {string} Chart HTML or placeholder
   */
  renderChart(code) {
    try {
      // Validate JSON completeness before parsing
      if (!this.isValidCompleteJSON(code)) {
        logDebug(
          "Incomplete chart JSON detected during streaming, skipping parse"
        );
        // Return a placeholder that will be processed later
        return `<div class="chart-placeholder" data-chart-pending="true">
                <p>Loading chart...</p>
                <pre style="display: none;">${code}</pre>
              </div>`;
      }

      const chartData = JSON.parse(code);
      const chartId = "chart-" + Math.random().toString(36).substring(2, 15);

      setTimeout(() => {
        try {
          const canvas = document.getElementById(chartId);
          if (canvas && window.Chart) {
            // Create the chart instance
            const chartInstance = new window.Chart(canvas, chartData);

            // Apply default palette after chart creation
            setTimeout(() => {
              const container = canvas.closest(".chart-container");
              if (container && window.ChartControls) {
                const defaultPalette =
                  window.ChartControls.utils.getDefaultPaletteForCurrentMode();

                window.ChartControls.applyPalette(
                  container,
                  canvas,
                  defaultPalette
                );

                const paletteSelect = container.querySelector(
                  ".chart-palette-select"
                );
                if (paletteSelect) {
                  paletteSelect.value = defaultPalette;
                }

                logDebug(
                  "Applied default palette to bridge-rendered chart:",
                  defaultPalette
                );
              }
            }, 100);

            // Add basic chart controls
            if (
              window.ChartControls &&
              typeof window.ChartControls.addControlsToContainer === "function"
            ) {
              const container = canvas.closest(".chart-container");
              if (container) {
                window.ChartControls.addControlsToContainer(container, chartId);
              }
            }

            // Mark container to prevent early view control initialization
            const container = canvas.closest(".chart-container");
            if (container) {
              container.setAttribute("data-bridge-processed", "true");
              container.setAttribute("data-defer-view-controls", "true");
            }
          }
        } catch (err) {
          logError("Chart rendering failed", { error: err });
        }
      }, 0);

      return `<div class="chart-container" aria-label="Chart" role="figure" data-chart-code="${encodeURIComponent(
        code
      )}" data-bridge-processing="true">
              <canvas id="${chartId}" width="600" height="400"></canvas>
          </div>`;
    } catch (err) {
      logError("Invalid chart data", { error: err });

      // During streaming, return a placeholder for incomplete JSON
      if (
        err.message.includes("Unexpected end of JSON input") ||
        err.message.includes("Expected property name")
      ) {
        logDebug(
          "JSON parsing error likely due to streaming, creating placeholder"
        );
        return `<div class="chart-placeholder" data-chart-pending="true">
                <p>Loading chart...</p>
                <pre style="display: none;">${code}</pre>
              </div>`;
      }

      // For genuine JSON errors, show error message
      return `<pre class="error-boundary"><code>Chart Error: ${err.message}</code></pre>`;
    }
  }

  /**
   * Process any pending chart placeholders after streaming completes
   * @param {HTMLElement} container - Container to search for placeholders
   */
  processPendingCharts(container = document) {
    const placeholders = container.querySelectorAll(
      '[data-chart-pending="true"]'
    );

    if (placeholders.length === 0) {
      return;
    }

    logDebug(
      `Processing ${placeholders.length} pending chart placeholder(s) after streaming`
    );

    placeholders.forEach((placeholder, index) => {
      try {
        // Get the stored JSON from the hidden pre element
        const preElement = placeholder.querySelector("pre");
        if (!preElement) {
          logError(`No JSON found in chart placeholder ${index}`);
          return;
        }

        const chartJSON = preElement.textContent;

        // Validate the JSON is now complete
        if (!this.isValidCompleteJSON(chartJSON)) {
          logError(
            `Chart JSON still incomplete after streaming completion for placeholder ${index}`
          );
          placeholder.innerHTML =
            '<p class="error-boundary">Chart JSON incomplete</p>';
          return;
        }

        // Render the chart properly now
        const chartHTML = this.renderChart(chartJSON);

        // Replace the placeholder with the actual chart
        placeholder.outerHTML = chartHTML;

        logDebug(`Successfully processed chart placeholder ${index}`);
      } catch (error) {
        logError(`Error processing chart placeholder ${index}:`, error);
        placeholder.innerHTML =
          '<p class="error-boundary">Chart processing failed</p>';
      }
    });
  }

  /**
   * Validate if JSON string is complete and valid
   * @param {string} jsonString - JSON string to validate
   * @returns {boolean} True if JSON is complete and valid
   */
  isValidCompleteJSON(jsonString) {
    if (!jsonString || typeof jsonString !== "string") {
      return false;
    }

    // Trim whitespace
    const trimmed = jsonString.trim();

    // Basic completeness checks
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      return false;
    }

    // Count braces to ensure they're balanced
    let braceCount = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
        }
      }
    }

    // Braces must be balanced
    if (braceCount !== 0) {
      return false;
    }

    // Try a basic JSON parse test
    try {
      JSON.parse(trimmed);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Render mermaid diagram (same logic as MarkdownEditor)
   * @param {string} code - Mermaid diagram code
   * @returns {string} Mermaid HTML
   */
  renderMermaid(code) {
    try {
      const mermaidId =
        "mermaid-diagram-" + Math.random().toString(36).substring(2, 15);
      const cleanCode = code.trim();

      setTimeout(() => {
        try {
          const element = document.getElementById(mermaidId);
          if (element && window.mermaid) {
            window.mermaid
              .render(mermaidId + "-svg", cleanCode)
              .then((result) => {
                element.innerHTML = result.svg;
                const svg = element.querySelector("svg");
                if (svg) {
                  svg.setAttribute("aria-label", "Mermaid diagram");
                  svg.setAttribute("role", "img");
                  svg.style.maxWidth = "100%";
                  svg.style.height = "auto";
                }

                if (
                  window.MermaidControls &&
                  typeof window.MermaidControls.addControlsToContainer ===
                    "function"
                ) {
                  const container = element.closest(".mermaid-container");
                  if (container) {
                    window.MermaidControls.addControlsToContainer(
                      container,
                      mermaidId.split("-").pop()
                    );
                  }
                }
              });
          }
        } catch (err) {
          logError("Mermaid rendering failed", { error: err });
        }
      }, 0);

      return `<div class="mermaid-container" aria-label="Diagram" role="figure" data-diagram-code="${encodeURIComponent(
        cleanCode
      )}">
              <div id="${mermaidId}" class="mermaid">${cleanCode}</div>
            </div>`;
    } catch (err) {
      logError("Invalid mermaid diagram", { error: err });
      return `<pre class="error-boundary"><code>${err.message}</code></pre>`;
    }
  }

  /**
   * Enhance header anchors (same as MarkdownEditor)
   * @param {string} html - HTML content
   * @returns {string} Enhanced HTML
   */
  enhanceHeaderAnchors(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const anchors = doc.querySelectorAll(".header-anchor");

    anchors.forEach((anchor) => {
      const heading = anchor.closest("h1, h2, h3, h4, h5, h6");
      if (heading) {
        let headingText = heading.textContent || "";
        headingText = headingText.replace(/[\s\u200B]*$/g, "");
        anchor.setAttribute(
          "aria-label",
          `Direct link to "${headingText}" section`
        );
      }
    });

    return doc.body.innerHTML;
  }

  /**
   * Fallback processing when MarkdownEditor isn't available
   * @param {string} content - Content to process
   * @returns {string} Basic processed content
   */
  fallbackProcess(content) {
    logInfo("Using fallback processing");
    return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * Process streaming content (uses coordinated processing)
   * @param {string} content - Content chunk
   * @returns {Promise<string>} Processed chunk
   */
  async processStreaming(content) {
    try {
      // Use the same coordinated processing for streaming
      return await this.process(content);
    } catch (error) {
      logError("Error in streaming processing", { error });
      return this.fallbackProcess(content);
    }
  }
}

// ✅ Phase 2: Global testing and diagnostic functions
if (typeof window !== "undefined") {
  // Helper function to find the bridge instance
  function findBridgeInstance() {
    // Try multiple possible paths to the bridge instance
    const paths = [
      "window.resultsManager?.contentProcessor?.markdownItBridge",
      "window.contentProcessor?.markdownItBridge",
      "window.MarkdownItBridge?.instance",
      "window.bridgeInstance",
    ];

    // Check resultsManager path first (most likely)
    if (window.resultsManager?.contentProcessor?.markdownItBridge) {
      return window.resultsManager.contentProcessor.markdownItBridge;
    }

    // Check contentProcessor path
    if (window.contentProcessor?.markdownItBridge) {
      return window.contentProcessor.markdownItBridge;
    }

    // Check legacy paths
    if (window.MarkdownItBridge?.instance) {
      return window.MarkdownItBridge.instance;
    }

    if (window.bridgeInstance) {
      return window.bridgeInstance;
    }

    return null;
  }

  // Create global testing functions for console debugging
  window.testBridgeProcessingCoordination = async function (
    calls = 5,
    useIdenticalContent = true
  ) {
    const bridgeInstance = findBridgeInstance();
    if (
      bridgeInstance &&
      typeof bridgeInstance.testProcessingCoordination === "function"
    ) {
      console.log(
        `🧪 Testing bridge processing coordination with ${calls} calls (identical content: ${useIdenticalContent})...`
      );
      return await bridgeInstance.testProcessingCoordination(
        calls,
        useIdenticalContent
      );
    } else {
      console.warn("❌ MarkdownItBridge instance not available for testing");
      console.log("💡 Available paths checked:", [
        "window.resultsManager?.contentProcessor?.markdownItBridge",
        "window.contentProcessor?.markdownItBridge",
        "window.MarkdownItBridge?.instance",
        "window.bridgeInstance",
      ]);
      console.log("💡 Current state:", {
        hasResultsManager: !!window.resultsManager,
        hasContentProcessor: !!window.resultsManager?.contentProcessor,
        hasBridge: !!window.resultsManager?.contentProcessor?.markdownItBridge,
      });
      return null;
    }
  };

  // Add separate test functions for clarity
  window.testBridgeDebouncing = async function (calls = 5) {
    console.log("🧪 Testing debouncing (identical content)...");
    return await window.testBridgeProcessingCoordination(calls, true);
  };

  window.testBridgeQueueManagement = async function (calls = 5) {
    console.log("🧪 Testing queue management (different content)...");
    return await window.testBridgeProcessingCoordination(calls, false);
  };

  window.getBridgeProcessingDiagnostics = function () {
    const bridgeInstance = findBridgeInstance();
    if (
      bridgeInstance &&
      typeof bridgeInstance.getProcessingDiagnostics === "function"
    ) {
      console.log("🔍 Bridge processing diagnostics:");
      const diagnostics = bridgeInstance.getProcessingDiagnostics();
      console.table(diagnostics.metrics);
      return diagnostics;
    } else {
      console.warn(
        "❌ MarkdownItBridge instance not available for diagnostics"
      );
      console.log(
        "💡 Try: window.resultsManager?.contentProcessor?.markdownItBridge"
      );
      return null;
    }
  };

  window.resetBridgeProcessingState = function () {
    const bridgeInstance = findBridgeInstance();
    if (
      bridgeInstance &&
      typeof bridgeInstance.resetProcessingState === "function"
    ) {
      bridgeInstance.resetProcessingState();
      console.log("✅ Bridge processing state reset");
      return true;
    } else {
      console.warn("❌ MarkdownItBridge instance not available for reset");
      return false;
    }
  };

  // Add a helper function to check bridge availability
  window.checkBridgeAvailability = function () {
    const bridgeInstance = findBridgeInstance();
    console.log("🔍 Bridge Availability Check:");
    console.log("Bridge instance found:", !!bridgeInstance);
    if (bridgeInstance) {
      console.log("Bridge type:", bridgeInstance.constructor.name);
      console.log("Bridge ready:", bridgeInstance.markdownEditorReady);
      if (typeof bridgeInstance.getProcessingDiagnostics === "function") {
        const diagnostics = bridgeInstance.getProcessingDiagnostics();
        console.log("Processing state:", diagnostics.state);
        console.log(
          "Total processing calls:",
          diagnostics.metrics.totalProcessingCalls
        );
      }
    }
    return !!bridgeInstance;
  };

  // Add basic functionality test
  window.testBridgeBasicFunctionality = async function () {
    const bridgeInstance = findBridgeInstance();
    if (
      bridgeInstance &&
      typeof bridgeInstance.testBasicFunctionality === "function"
    ) {
      console.log("🧪 Testing basic bridge functionality...");
      return await bridgeInstance.testBasicFunctionality();
    } else {
      console.warn(
        "❌ MarkdownItBridge instance not available for basic testing"
      );
      return null;
    }
  };
}
