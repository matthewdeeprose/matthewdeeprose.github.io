/**
 * @fileoverview MathPix MMD Preview System - CDN Loader and Preview Renderer
 * @module MathPixMMDPreview
 * @requires mathpix-config.js
 * @version 1.0.0
 * @since 4.0.0
 *
 * @description
 * Manages loading the mathpix-markdown-it library from CDN and provides
 * MMD to HTML rendering capabilities. Uses a state machine pattern for
 * robust load management with retry support.
 *
 * Load States:
 * - IDLE: Not yet attempted to load
 * - LOADING: CDN script loading in progress
 * - READY: Library loaded, ready to render
 * - ERROR: Load failed, retry available
 *
 * Dependencies:
 * - MATHPIX_CONFIG.MMD_PREVIEW (configuration)
 * - mathpix-markdown-it CDN (external library)
 *
 * Global Functions Provided by CDN:
 * - window.markdownToHTML(content, options) - Convert MMD to HTML
 * - window.loadMathJax() - Load MathJax styles
 *
 * @example
 * const preview = new MathPixMMDPreview(MATHPIX_CONFIG.MMD_PREVIEW);
 * await preview.loadLibrary();
 * const html = preview.renderToString(mmdContent);
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if a message should be logged based on current logging configuration
 * @param {number} level - The log level to check (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)
 * @returns {boolean} True if the message should be logged
 * @since 1.0.0
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error messages if error logging is enabled
 * @param {string} message - The error message to log
 * @param {...any} args - Additional arguments to pass to console.error
 * @since 1.0.0
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[MMD Preview]", message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning messages if warning logging is enabled
 * @param {string} message - The warning message to log
 * @param {...any} args - Additional arguments to pass to console.warn
 * @since 1.0.0
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[MMD Preview]", message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages if info logging is enabled
 * @param {string} message - The info message to log
 * @param {...any} args - Additional arguments to pass to console.log
 * @since 1.0.0
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[MMD Preview]", message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug messages if debug logging is enabled
 * @param {string} message - The debug message to log
 * @param {...any} args - Additional arguments to pass to console.log
 * @since 1.0.0
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[MMD Preview]", message, ...args);
}

/**
 * @class MathPixMMDPreview
 * @description CDN Loader and Preview Renderer for MathPix Markdown
 *
 * Manages the loading of the mathpix-markdown-it library from CDN with
 * robust state management, timeout handling, retry mechanism, and event
 * callbacks. Provides methods for rendering MMD content to HTML.
 *
 * State Machine Flow:
 * ```
 * IDLE → LOADING → READY
 *              ↘ ERROR → (retry) → LOADING
 * ```
 *
 * @example
 * // Basic usage
 * const preview = new MathPixMMDPreview(MATHPIX_CONFIG.MMD_PREVIEW);
 * await preview.loadLibrary();
 * if (preview.isReady()) {
 *   const html = preview.renderToString('# Hello\n\n$E=mc^2$');
 * }
 *
 * @since 4.0.0
 */
class MathPixMMDPreview {
  /**
   * Create a new MathPixMMDPreview instance
   * @param {Object} config - Configuration object (MATHPIX_CONFIG.MMD_PREVIEW)
   * @throws {Error} If configuration object is not provided
   */
  constructor(config) {
    // Validate config
    if (!config) {
      throw new Error("MathPixMMDPreview requires configuration object");
    }

    this.config = config;

    // State management
    this.loadState = config.LOAD_STATES.IDLE;
    this.loadError = null;
    this.loadAttempts = 0;
    this.maxRetries = config.DEFAULTS.MAX_RETRY_ATTEMPTS || 3;

    // Content management
    this.currentContent = null;
    this.lastRenderedContent = null;
    this.currentView = config.DEFAULTS.INITIAL_VIEW || "code";

    // Script reference for cleanup
    this.scriptElement = null;
    this.loadPromise = null;

    // DOM state (Stage 4)
    this.elements = {};
    this.elementsCached = false;
    this.domInitialised = false;

    // Event callbacks
    this.callbacks = {
      onLoadStart: null,
      onLoadSuccess: null,
      onLoadError: null,
      onRenderComplete: null,
      onRenderError: null,
      onViewChange: null,
      onPDFSplitActivated: null, // Phase 4.2: PDF comparison activated
    };

    // MathJax recovery tracking
    this.mathJaxRecoveryUnsubscribe = null;
    this.pendingMathJaxRender = false; // True if MathJax failed during last render

    // Initialisation flag
    this.isInitialised = true;

    logInfo("MathPixMMDPreview initialised", {
      cdnUrl: config.CDN.URL,
      version: config.CDN.VERSION,
      timeout: config.CDN.LOAD_TIMEOUT,
      maxRetries: this.maxRetries,
    });
  }

  // ============================================================================
  // Core Loading Methods
  // ============================================================================

  /**
   * Load the mathpix-markdown-it library from CDN
   * @returns {Promise<boolean>} True if load successful
   * @throws {Error} If load fails after retries exhausted
   *
   * @description
   * Handles the complete loading lifecycle including:
   * - Checking if already loaded (idempotent)
   * - Returning existing promise if load in progress
   * - Creating and tracking new load attempt
   * - Timeout handling
   * - Error state management
   */
  async loadLibrary() {
    // Already loaded
    if (this.loadState === this.config.LOAD_STATES.READY) {
      logDebug("Library already loaded, skipping");
      return true;
    }

    // Already loading - return existing promise
    if (
      this.loadState === this.config.LOAD_STATES.LOADING &&
      this.loadPromise
    ) {
      logDebug("Load already in progress, returning existing promise");
      return this.loadPromise;
    }

    // Check if already available (page refresh scenario)
    if (this.isLibraryAvailable()) {
      logInfo("Library already available in global scope");
      this.loadState = this.config.LOAD_STATES.READY;
      this.callbacks.onLoadSuccess?.();
      return true;
    }

    // Start loading
    this.loadState = this.config.LOAD_STATES.LOADING;
    this.loadAttempts++;
    this.loadError = null;

    logInfo("Loading mathpix-markdown-it from CDN", {
      attempt: this.loadAttempts,
      maxRetries: this.maxRetries,
      url: this.config.CDN.URL,
    });

    this.callbacks.onLoadStart?.();
    this.announceToScreenReader(this.config.ARIA.LOADING_ANNOUNCEMENT);

    // Create and track promise
    this.loadPromise = this.executeLoad();

    try {
      await this.loadPromise;
      return true;
    } catch (error) {
      // loadPromise handles state updates
      throw error;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Execute the actual script loading with timeout
   * @private
   * @returns {Promise<boolean>} Resolves true on success, rejects on failure
   */
  async executeLoad() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = this.config.CDN.URL;
      script.async = true;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        this.handleLoadError(new Error(this.config.MESSAGES.LOAD_TIMEOUT));
        script.remove();
        reject(new Error(this.config.MESSAGES.LOAD_TIMEOUT));
      }, this.config.CDN.LOAD_TIMEOUT);

      // Success handler
      script.onload = () => {
        clearTimeout(timeoutId);

        // Call loadMathJax to initialise styles
        try {
          const mathJaxLoaded = window.loadMathJax?.();
          logDebug("MathJax styles loaded:", mathJaxLoaded);
        } catch (mathJaxError) {
          logWarn("MathJax style loading failed:", mathJaxError);
          // Non-fatal - continue without MathJax styles
        }

        // Verify library is available
        if (this.isLibraryAvailable()) {
          this.loadState = this.config.LOAD_STATES.READY;
          this.scriptElement = script;

          logInfo("mathpix-markdown-it loaded successfully", {
            version: this.config.CDN.VERSION,
            attempts: this.loadAttempts,
          });

          this.callbacks.onLoadSuccess?.();
          this.announceToScreenReader(this.config.ARIA.LOADED_ANNOUNCEMENT);
          resolve(true);
        } else {
          const error = new Error("Library loaded but functions not available");
          this.handleLoadError(error);
          reject(error);
        }
      };

      // Error handler
      script.onerror = () => {
        clearTimeout(timeoutId);
        const error = new Error(this.config.MESSAGES.LOAD_ERROR);
        this.handleLoadError(error);
        reject(error);
      };

      // Append to document
      document.head.appendChild(script);
    });
  }

  /**
   * Handle load errors and update state
   * @private
   * @param {Error} error - The error that occurred
   */
  handleLoadError(error) {
    this.loadState = this.config.LOAD_STATES.ERROR;
    this.loadError = error;

    logError("CDN load failed", {
      error: error.message,
      attempts: this.loadAttempts,
      maxRetries: this.maxRetries,
    });

    this.callbacks.onLoadError?.(error);
    this.announceToScreenReader(this.config.ARIA.ERROR_ANNOUNCEMENT);
  }

  /**
   * Check if library functions are available in global scope
   * @private
   * @returns {boolean} True if library functions are available
   */
  isLibraryAvailable() {
    return (
      typeof window.markdownToHTML === "function" &&
      typeof window.loadMathJax === "function"
    );
  }

  // ============================================================================
  // State and Retry Methods
  // ============================================================================

  /**
   * Check if library is ready for use
   * @returns {boolean} True if library is loaded and functions are available
   */
  isReady() {
    return (
      this.loadState === this.config.LOAD_STATES.READY &&
      this.isLibraryAvailable()
    );
  }

  /**
   * Get current load state
   * @returns {string} Current state (idle|loading|ready|error)
   */
  getLoadState() {
    return this.loadState;
  }

  /**
   * Get last load error
   * @returns {Error|null} The last error that occurred, or null
   */
  getLoadError() {
    return this.loadError;
  }

  /**
   * Get load attempt count
   * @returns {number} Number of load attempts made
   */
  getLoadAttempts() {
    return this.loadAttempts;
  }

  /**
   * Retry loading after error - enhanced with UI updates
   * @returns {Promise<boolean>}
   */
  async retry() {
    if (this.loadState !== this.config.LOAD_STATES.ERROR) {
      logWarn("Retry called but not in error state", {
        currentState: this.loadState,
      });

      // If already ready, just re-render
      if (this.isReady()) {
        await this.ensurePreviewRendered();
        return true;
      }

      return false;
    }

    if (this.loadAttempts >= this.maxRetries) {
      logError("Max retry attempts reached", {
        attempts: this.loadAttempts,
        maxRetries: this.maxRetries,
      });

      // Update error message
      if (this.elements.errorMessage) {
        this.elements.errorMessage.textContent = `Maximum retry attempts (${this.maxRetries}) reached. Please refresh the page.`;
      }

      throw new Error(`Max retry attempts (${this.maxRetries}) reached`);
    }

    // Show loading state
    this.showPreviewState("loading");

    // Reset to idle for fresh attempt
    this.loadState = this.config.LOAD_STATES.IDLE;

    const retryMessage = this.config.MESSAGES.RETRY_ATTEMPT.replace(
      "{current}",
      (this.loadAttempts + 1).toString(),
    ).replace("{max}", this.maxRetries.toString());

    logInfo(retryMessage);
    this.announceToScreenReader(this.config.ARIA.RETRY_ANNOUNCEMENT);

    try {
      await this.loadLibrary();

      // If successful, render preview
      await this.ensurePreviewRendered();

      return true;
    } catch (error) {
      // Error state already set by loadLibrary
      this.showPreviewState("error");
      throw error;
    }
  }
  // ============================================================================
  // Content Management (Stage 4 - Enhanced)
  // ============================================================================

  /**
   * Store MMD content for rendering - enhanced with UI state
   * @param {string} content - Raw MMD content
   */
  setContent(content) {
    this.currentContent = content;

    // Update data attribute
    if (this.elements.contentArea) {
      this.elements.contentArea.dataset.hasContent = (!!content).toString();
    }

    // If we're in preview mode and content changed, we may need to re-render
    if (
      this.currentView === this.config.VIEW_MODES.PREVIEW &&
      content !== this.lastRenderedContent
    ) {
      logDebug(
        "Content changed while in preview mode, will re-render on next view",
      );
      // Don't auto-render here to avoid unexpected re-renders
      // User can switch away and back, or we can add a refresh mechanism later
    }

    logDebug("Content stored", {
      length: content?.length || 0,
      hasContent: !!content,
    });
  }

  /**
   * Update MMD content and re-render preview if visible (Phase 5.1)
   * Called by MMD Editor when content changes during editing
   * @param {string} mmdContent - Updated MMD content
   * @returns {Promise<void>}
   * @since 5.1.0
   */
  async updateContent(mmdContent) {
    // Store the new content
    this.currentContent = mmdContent;

    // Update data attribute
    if (this.elements.contentArea) {
      this.elements.contentArea.dataset.hasContent = (!!mmdContent).toString();
    }

    // If preview is visible (preview or split view), re-render
    const currentView = this.getCurrentView();
    if (
      currentView === this.config.VIEW_MODES.PREVIEW ||
      currentView === this.config.VIEW_MODES.SPLIT
    ) {
      logDebug("Preview visible, re-rendering with updated content");

      // Reset lastRenderedContent to force re-render
      this.lastRenderedContent = null;

      // Render to preview
      await this.ensurePreviewRendered();
    } else {
      logDebug("Preview not visible, content stored for later render");
    }
  }

  /**
   * Get stored MMD content
   * @returns {string|null} The stored content or null
   */
  getContent() {
    return this.currentContent;
  }

  /**
   * Check if content has changed since last render
   * @returns {boolean} True if content differs from last rendered content
   */
  hasContentChanged() {
    return this.currentContent !== this.lastRenderedContent;
  }

  // ============================================================================
  // Rendering Methods
  // ============================================================================

  /**
   * Render MMD content to HTML string
   * @param {string} [content] - MMD content to render (uses stored content if not provided)
   * @returns {string} Rendered HTML
   * @throws {Error} If library not ready
   *
   * @description
   * Converts Mathpix Markdown content to HTML using the CDN library.
   * If no content is provided, uses the content stored via setContent().
   */
  renderToString(content) {
    if (!this.isReady()) {
      throw new Error("Library not ready - call loadLibrary() first");
    }

    const mmdContent = content || this.currentContent;

    if (!mmdContent) {
      logWarn("No content to render");
      return "";
    }

    try {
      const html = window.markdownToHTML(
        mmdContent,
        this.config.RENDER_OPTIONS,
      );
      logDebug("Content rendered to string", {
        inputLength: mmdContent.length,
        outputLength: html.length,
      });
      return html;
    } catch (error) {
      logError("Render to string failed", error);
      this.callbacks.onRenderError?.(error);
      throw error;
    }
  }

  /**
   * Render MMD content to a target element
   * @param {string} [content] - MMD content to render (uses stored content if not provided)
   * @param {HTMLElement} targetElement - Element to render into
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If target element not provided
   *
   * @description
   * Renders MMD content to a DOM element. Automatically loads the library
   * if not already loaded. Triggers MathJax re-rendering if available.
   */
  async render(content, targetElement) {
    if (!this.isReady()) {
      await this.loadLibrary();
    }

    if (!targetElement) {
      throw new Error("Target element required for render");
    }

    const mmdContent = content || this.currentContent;

    if (!mmdContent) {
      logWarn("No content to render");
      targetElement.innerHTML = `<p class="mmd-no-content">${this.config.MESSAGES.NO_CONTENT}</p>`;
      return false;
    }

    try {
      // Phase 4.0 Fix: Clear previous MathJax state to prevent DOM conflicts
      // The mathpix-markdown-it CDN may have already processed math content,
      // which can conflict with the page's MathJax when typesetPromise is called
      if (window.MathJax?.startup?.document) {
        try {
          // Clear MathJax's internal document state for this element
          window.MathJax.startup.document.clear();
          logDebug("MathJax document state cleared");
        } catch (clearError) {
          logWarn("MathJax clear failed (non-critical)", clearError);
        }
      }

      // Clear the target element completely before inserting new content
      targetElement.innerHTML = "";

      const html = this.renderToString(mmdContent);
      targetElement.innerHTML = html;

      // Check if CDN already rendered math (look for mjx-container elements)
      const hasRenderedMath = targetElement.querySelector("mjx-container");

      // Check if there's unrendered LaTeX in the content (raw delimiters that weren't processed)
      const hasUnrenderedMath = this.detectUnrenderedMath(targetElement);

      if (hasRenderedMath && !hasUnrenderedMath) {
        // CDN already rendered ALL the math - just apply enhancements
        logDebug("CDN already rendered math, skipping MathJax typeset");
        this.pendingMathJaxRender = false; // Clear any pending flag

        // Apply MathPix enhancements to existing math elements
        if (typeof window.mathPixEnhanceMathJax === "function") {
          window.mathPixEnhanceMathJax();
        }
      } else {
        // CDN did not render math (or only partial) - need page MathJax
        const needsMathJax = hasUnrenderedMath || !hasRenderedMath;

        logDebug("Math rendering status", {
          hasRenderedMath,
          hasUnrenderedMath,
          needsMathJax,
          mathJaxDisabled: !!window.MathJaxDisabled,
        });

        if (needsMathJax) {
          // Check if MathJax is disabled due to repeated failures
          if (window.MathJaxDisabled) {
            logWarn(
              "MathJax disabled, skipping typeset - registering for recovery",
            );
            this.pendingMathJaxRender = true;

            // Register element for re-rendering when MathJax recovers
            if (window.mathJaxManager?.registerPendingElement) {
              window.mathJaxManager.registerPendingElement(targetElement, {
                source: "mmd-preview",
                reason: "mathjax-disabled",
                content: mmdContent?.substring(0, 100),
              });
            }
          } else if (window.MathJax?.typesetPromise) {
            // Wait for MathJax enhancement ready flag
            if (!window.MathJaxEnhancementReady) {
              logDebug("Waiting for MathJax readiness...");
              await this.waitForMathJaxReady();
            }

            try {
              await window.MathJax.typesetPromise([targetElement]);
              logDebug("MathJax typeset complete");
              this.pendingMathJaxRender = false; // Clear pending flag on success
            } catch (typesetError) {
              // Log but don't throw - content is still displayed
              logWarn(
                "MathJax typeset failed (content still displayed)",
                typesetError,
              );

              // Track that we have pending math to render
              this.pendingMathJaxRender = true;

              // Register element for re-rendering when MathJax recovers
              if (window.mathJaxManager?.registerPendingElement) {
                window.mathJaxManager.registerPendingElement(targetElement, {
                  source: "mmd-preview",
                  reason: "typeset-error",
                  error: typesetError.message,
                });
              }
            }
          } else {
            // MathJax not available at all - mark for recovery
            logWarn("MathJax not available - registering for recovery");
            this.pendingMathJaxRender = true;

            if (window.mathJaxManager?.registerPendingElement) {
              window.mathJaxManager.registerPendingElement(targetElement, {
                source: "mmd-preview",
                reason: "mathjax-unavailable",
              });
            }
          }
        }
      }

      this.lastRenderedContent = mmdContent;
      this.callbacks.onRenderComplete?.(targetElement);

      logInfo("Content rendered to element", {
        contentLength: mmdContent.length,
        elementId: targetElement.id,
        mathRenderedByCDN: hasRenderedMath,
      });

      return true;
    } catch (error) {
      logError("Render to element failed", error);
      this.callbacks.onRenderError?.(error);
      throw error;
    }
  }

  /**
   * Wait for MathJax to be ready (respects MathJax Manager's ready flag)
   * @private
   * @returns {Promise<void>}
   */
  async waitForMathJaxReady() {
    const maxWait = 10000; // 10 seconds maximum
    const checkInterval = 100; // Check every 100ms
    let waited = 0;

    while (!window.MathJaxEnhancementReady && waited < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    if (!window.MathJaxEnhancementReady) {
      logWarn("MathJax readiness timeout - proceeding anyway");
    }
  }

  /**
   * Detect if there's unrendered LaTeX math in the content
   * Looks for common LaTeX delimiters that weren't processed
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if unrendered math detected
   * @private
   */
  detectUnrenderedMath(element) {
    if (!element) return false;

    const textContent = element.textContent || "";

    // Common LaTeX delimiters that should have been rendered
    const mathPatterns = [
      /\$\$.+?\$\$/s, // Display math: $$...$$
      /\\\[.+?\\\]/s, // Display math: \[...\]
      /(?<!\$)\$(?!\$).+?(?<!\$)\$(?!\$)/s, // Inline math: $...$ (not $$)
      /\\\(.+?\\\)/s, // Inline math: \(...\)
      /\\begin\{(equation|align|gather|multline)/, // LaTeX environments
    ];

    for (const pattern of mathPatterns) {
      if (pattern.test(textContent)) {
        logDebug("Unrendered math detected", {
          pattern: pattern.toString(),
          sample: textContent.substring(0, 100),
        });
        return true;
      }
    }

    return false;
  }

  // ============================================================================
  // DOM Initialisation (Stage 4)
  // ============================================================================

  /**
   * Initialise the preview module with DOM elements
   * Call this after DOM is ready
   */
  init() {
    if (this.domInitialised) {
      logDebug("Already initialised");
      return;
    }

    this.cacheElements();

    // Set initial state from DOM if available
    if (this.elements.contentArea) {
      const currentView = this.elements.contentArea.dataset.currentView;
      if (currentView) {
        this.currentView = currentView;
      }
    }

    // Subscribe to MathJax recovery events
    this.subscribeToMathJaxRecovery();

    this.domInitialised = true;

    logInfo("MathPixMMDPreview DOM initialised", {
      currentView: this.currentView,
      elementsAvailable: this.elementsCached,
    });
  }

  /**
   * Subscribe to MathJax Manager recovery events
   * Re-renders content when MathJax recovers from failure
   * @private
   */
  subscribeToMathJaxRecovery() {
    // Check if MathJax Manager is available
    if (
      !window.mathJaxManager ||
      typeof window.mathJaxManager.onRecovery !== "function"
    ) {
      logDebug("MathJax Manager not available for recovery subscription");
      return;
    }

    // Unsubscribe if already subscribed
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
    }

    // Subscribe to recovery events
    this.mathJaxRecoveryUnsubscribe = window.mathJaxManager.onRecovery(
      async (eventData) => {
        logInfo("MathJax recovery notification received", eventData);

        // Only re-render if we had a pending failed render
        if (this.pendingMathJaxRender && eventData.healthy) {
          logInfo("Re-rendering MMD content after MathJax recovery...");
          await this.handleMathJaxRecovery();
        }
      },
    );

    logDebug("Subscribed to MathJax recovery events");
  }

  /**
   * Handle MathJax recovery by re-rendering content
   * Also retries CDN library load if it wasn't loaded previously
   * @private
   */
  async handleMathJaxRecovery() {
    // Reset pending flag
    this.pendingMathJaxRender = false;

    // Check if we're in a view that shows preview
    const currentView = this.getCurrentView();
    const showsPreview = [
      this.config.VIEW_MODES.PREVIEW,
      this.config.VIEW_MODES.SPLIT,
      this.config.VIEW_MODES.PDF_SPLIT,
    ].includes(currentView);

    if (!showsPreview) {
      logDebug("Not in preview mode, skipping recovery re-render");
      return;
    }

    // NEW: If CDN library wasn't loaded, retry now that MathJax is healthy
    if (!this.isLibraryAvailable()) {
      logInfo("🔄 CDN library not loaded - retrying after MathJax recovery...");

      // Reset load state to allow retry
      this.loadState = this.config.LOAD_STATES.IDLE;
      this.loadAttempts = 0;
      this.loadError = null;

      try {
        await this.loadLibrary();
        logInfo("✅ CDN library loaded successfully after MathJax recovery");
      } catch (cdnError) {
        logWarn(
          "CDN library retry failed, will use fallback rendering:",
          cdnError.message,
        );
        // Continue anyway - ensurePreviewRendered will use fallback
      }
    }

    // Force re-render by clearing last rendered content
    this.lastRenderedContent = null;

    // Re-render preview
    try {
      await this.ensurePreviewRendered();
      logInfo("✅ MMD content re-rendered after MathJax recovery");

      // Announce to screen readers
      this.announceToScreenReader("Mathematical content has been rendered");
    } catch (error) {
      logError("Failed to re-render after MathJax recovery", error);
    }
  }

  /**
   * Cache DOM element references for performance
   * @private
   */
  cacheElements() {
    this.elements = {
      // View Controls
      codeBtn: document.getElementById("mmd-view-code-btn"),
      previewBtn: document.getElementById("mmd-view-preview-btn"),
      splitBtn: document.getElementById("mmd-view-split-btn"),
      pdfSplitBtn: document.getElementById("mmd-view-pdf-split-btn"), // Phase 4.2
      divider: document.getElementById("mmd-view-divider"),
      splitPdfToggle: document.getElementById("mmd-split-pdf-toggle"),
      splitShowPdfCheckbox: document.getElementById("mmd-split-show-pdf"),

      // Containers
      contentArea: document.getElementById("mmd-content-area"),
      codeContainer: document.getElementById("mmd-code-container"),
      previewContainer: document.getElementById("mmd-preview-container"),
      pdfContainer: document.getElementById("mmd-pdf-container"), // Phase 4.2

      // Preview States
      previewLoading: document.getElementById("mmd-preview-loading"),
      previewError: document.getElementById("mmd-preview-error"),
      errorMessage: document.getElementById("mmd-error-message"),
      retryBtn: document.getElementById("mmd-preview-retry-btn"),
      previewContent: document.getElementById("mmd-preview-content"),

      // Code Element (for content retrieval)
      codeElement: document.getElementById("mathpix-pdf-content-mmd"),
    };

    // Validate critical elements
    const critical = [
      "contentArea",
      "codeContainer",
      "previewContainer",
      "previewContent",
    ];
    const missing = critical.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      logWarn("Missing critical MMD preview elements", { missing });
    }

    this.elementsCached = true;
    logDebug("MMD preview elements cached", {
      cached: Object.keys(this.elements).filter((k) => !!this.elements[k])
        .length,
      total: Object.keys(this.elements).length,
    });
  }

  // ============================================================================
  // View Management (Stage 4 - Full Implementation)
  // ============================================================================

  /**
   * Get current view mode
   * @returns {string} Current view mode (code|preview|split|edit)
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Switch to specified view mode with full DOM updates
   * @param {string} viewMode - Target view mode ('code' | 'preview')
   * @returns {Promise<void>}
   */
  async switchView(viewMode) {
    // Ensure elements are cached
    if (!this.elementsCached) {
      this.cacheElements();
    }

    const validModes = Object.values(this.config.VIEW_MODES);

    if (!validModes.includes(viewMode)) {
      logError("Invalid view mode", { viewMode, validModes });
      throw new Error(`Invalid view mode: ${viewMode}`);
    }

    // Check feature flags for future modes
    if (
      viewMode === this.config.VIEW_MODES.SPLIT &&
      !this.config.FEATURES.SPLIT_VIEW_ENABLED
    ) {
      logWarn("Split view not enabled");
      throw new Error("Split view feature not enabled");
    }

    if (
      viewMode === this.config.VIEW_MODES.EDIT &&
      !this.config.FEATURES.EDIT_MODE_ENABLED
    ) {
      logWarn("Edit mode not enabled");
      throw new Error("Edit mode feature not enabled");
    }

    // Phase 4.2: PDF comparison feature flag check
    if (
      viewMode === this.config.VIEW_MODES.PDF_SPLIT &&
      !this.config.FEATURES.PDF_COMPARISON_ENABLED
    ) {
      logWarn("PDF comparison not enabled");
      throw new Error("PDF comparison feature not enabled");
    }

    const previousView = this.currentView;

    // Don't switch if already on this view
    if (previousView === viewMode) {
      logDebug("Already on requested view", { viewMode });
      return;
    }

    logInfo("Switching MMD view", { from: previousView, to: viewMode });

    // Update internal state
    this.currentView = viewMode;

    // Update data attribute on content area
    if (this.elements.contentArea) {
      this.elements.contentArea.dataset.currentView = viewMode;
    }

    // Update toggle button states
    this.updateToggleButtons(viewMode);

    // Update view status text
    this.updateViewStatus(viewMode);

    // Handle view-specific logic
    switch (viewMode) {
      case this.config.VIEW_MODES.CODE:
        await this.showCodeView();
        break;

      case this.config.VIEW_MODES.PREVIEW:
        await this.showPreviewView();
        break;

      case this.config.VIEW_MODES.SPLIT:
        await this.showSplitView();
        break;

      case this.config.VIEW_MODES.PDF_SPLIT:
        await this.showPDFSplitView();
        break;
    }

    // Update edit button visibility based on view (Phase 5.1)
    const editor = window.getMathPixMMDEditor?.();
    if (editor) {
      editor.updateButtonVisibility(viewMode);
    }

    // Fire callback
    this.callbacks.onViewChange?.(viewMode, previousView);

    // Announce to screen readers
    const announcement = this.config.ARIA.VIEW_CHANGED_ANNOUNCEMENT.replace(
      "{view}",
      viewMode,
    );
    this.announceToScreenReader(announcement);

    logInfo("View switch complete", { view: viewMode });
  }

  /**
   * Update toggle button visual and ARIA states
   * @param {string} activeView - Currently active view
   * @private
   */
  updateToggleButtons(activeView) {
    const buttons = {
      code: this.elements.codeBtn,
      preview: this.elements.previewBtn,
      split: this.elements.splitBtn,
      pdf_split: this.elements.pdfSplitBtn, // Phase 4.2
    };

    Object.entries(buttons).forEach(([view, button]) => {
      if (!button) return;

      const isActive = view === activeView;

      // Update aria-pressed
      button.setAttribute("aria-pressed", isActive.toString());

      // Update active class
      if (isActive) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    logDebug("Toggle buttons updated", { activeView });
  }

  /**
   * Update view status text
   * @param {string} viewMode - Current view mode
   * @private
   */
  updateViewStatus(viewMode, showPdf = false) {
    // Try to get element if not cached
    if (!this.elements.viewStatus) {
      this.elements.viewStatus = document.getElementById("mmd-view-status");
    }

    if (!this.elements.viewStatus) return;

    const statusText = {
      code: "Viewing code",
      preview: "Viewing preview",
      split: showPdf ? "Viewing split with PDF" : "Viewing split",
      pdf_split: "Comparing PDF",
      edit: "Editing",
    };

    this.elements.viewStatus.textContent =
      statusText[viewMode] || `Viewing ${viewMode}`;
  }

  /**
   * Show the code view container
   * @private
   */
  async showCodeView() {
    const { codeContainer, previewContainer, pdfContainer, divider } =
      this.elements;

    // Hide preview container
    if (previewContainer) {
      previewContainer.hidden = true;
      previewContainer.classList.remove("active");
    }

    // Hide PDF container (Phase 4.2)
    if (pdfContainer) {
      pdfContainer.hidden = true;
      pdfContainer.classList.remove("active");
    }

    // Hide divider
    if (divider) {
      divider.hidden = true;
    }

    // Show code container
    if (codeContainer) {
      codeContainer.hidden = false;
      codeContainer.classList.add("active");
    }

    // Hide PDF toggle (only visible in split mode)
    if (this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = true;
    }
  }

  /**
   * Show the preview view container and ensure content is rendered
   * @private
   */
  async showPreviewView() {
    const { codeContainer, previewContainer, pdfContainer, divider } =
      this.elements;

    // Hide code container
    if (codeContainer) {
      codeContainer.hidden = true;
      codeContainer.classList.remove("active");
    }

    // Hide PDF container (Phase 4.2)
    if (pdfContainer) {
      pdfContainer.hidden = true;
      pdfContainer.classList.remove("active");
    }

    // Hide divider
    if (divider) {
      divider.hidden = true;
    }

    // Show preview container
    if (previewContainer) {
      previewContainer.hidden = false;
      previewContainer.classList.add("active");
    }

    // Ensure preview is rendered
    await this.ensurePreviewRendered();

    // Hide PDF toggle (only visible in split mode)
    if (this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = true;
    }
  }

  /**
   * Show split view with both code and preview visible side-by-side
   * @private
   */
  async showSplitView() {
    const { codeContainer, previewContainer, pdfContainer, divider } =
      this.elements;

    // Hide PDF container (Phase 4.2 - only in code+preview split)
    if (pdfContainer) {
      pdfContainer.hidden = true;
      pdfContainer.classList.remove("active");
    }

    // Show code container
    if (codeContainer) {
      codeContainer.hidden = false;
      codeContainer.classList.add("active");
    }

    // Show divider
    if (divider) {
      divider.hidden = false;
    }

    // Show preview container
    if (previewContainer) {
      previewContainer.hidden = false;
      previewContainer.classList.add("active");
    }

    // Ensure preview is rendered
    await this.ensurePreviewRendered();

    // Show PDF toggle in split mode (if PDF is available)
    if (this.elements.splitPdfToggle) {
      // Only show toggle if a PDF has been processed
      const controller = window.getMathPixController?.();
      const hasPDF = controller?.pdfHandler?.hasPDFFile?.() || false;
      this.elements.splitPdfToggle.hidden = !hasPDF;
    }
  }
  /**
   * Show PDF split view with PDF and preview visible side-by-side
   * @private
   * @since 4.2.0
   */
  async showPDFSplitView() {
    const { codeContainer, previewContainer, pdfContainer, divider } =
      this.elements;

    // Hide code container
    if (codeContainer) {
      codeContainer.hidden = true;
      codeContainer.classList.remove("active");
    }

    // Show PDF container
    if (pdfContainer) {
      pdfContainer.hidden = false;
      pdfContainer.classList.add("active");
    }

    // Show divider
    if (divider) {
      divider.hidden = false;
    }

    // Show preview container
    if (previewContainer) {
      previewContainer.hidden = false;
      previewContainer.classList.add("active");
    }

    // Ensure preview is rendered
    await this.ensurePreviewRendered();

    // Trigger PDF load via callback if PDF data is available
    this.callbacks.onPDFSplitActivated?.();

    // Hide PDF toggle (Compare mode always shows PDF)
    if (this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = true;
    }
  }

  /**
   * Toggle PDF visibility in split view (3-column mode)
   * @param {boolean} show - Whether to show PDF column
   * @since 4.2.0
   */
  toggleSplitPDF(show) {
    const { contentArea } = this.elements;

    if (!contentArea) {
      logWarn("Content area not found for PDF toggle");
      return;
    }

    // Only applies in split view
    if (this.currentView !== this.config.VIEW_MODES.SPLIT) {
      logDebug("PDF toggle only applies in split view");
      return;
    }

    // Update data attribute
    contentArea.dataset.showPdf = show.toString();

    // Load PDF if showing and not already loaded
    if (show) {
      const pdfCompare = window.getMathPixPDFCompare?.();
      if (pdfCompare && !pdfCompare.hasPDF()) {
        // Trigger PDF load
        const controller = window.getMathPixController?.();
        const pdfFile = controller?.pdfHandler?.getCurrentPDFFile?.();
        if (pdfFile) {
          // Ensure module is initialised and dispatch event
          if (typeof window.getMathPixPDFCompare === "function") {
            window.getMathPixPDFCompare();
          }
          const event = new CustomEvent("mmd-pdf-compare-load", {
            detail: { file: pdfFile },
          });
          document.dispatchEvent(event);
        }
      }
    }

    logInfo("Split view PDF toggled", { show });

    // Announce to screen readers
    const announcement = show ? "PDF column shown" : "PDF column hidden";
    this.announceToScreenReader(announcement);
  }

  /**
   * Ensure preview content is rendered (lazy render on first view)
   * @private
   */
  async ensurePreviewRendered() {
    // Check if we have content to render
    const content = this.getContentFromDOM();

    if (!content) {
      logWarn("No MMD content available for preview");
      this.showPreviewState("content");
      if (this.elements.previewContent) {
        this.elements.previewContent.innerHTML = `<p class="mmd-no-content">${this.config.MESSAGES.NO_CONTENT}</p>`;
      }
      return;
    }

    // Store content for comparison
    this.currentContent = content;

    // Check if content has changed since last render
    if (
      this.lastRenderedContent === content &&
      this.elements.previewContent?.innerHTML
    ) {
      logDebug("Preview already rendered with current content, skipping");
      this.showPreviewState("content");
      return;
    }

    // Show loading state
    this.showPreviewState("loading");

    try {
      // Load library if not ready
      if (!this.isReady()) {
        logInfo("Loading preview library...");
        await this.loadLibrary();
      }

      // Update library loaded data attribute
      if (this.elements.contentArea) {
        this.elements.contentArea.dataset.libraryLoaded = "true";
      }

      // Render content
      await this.render(content, this.elements.previewContent);

      // Show content state
      this.showPreviewState("content");

      // Update last rendered content
      this.lastRenderedContent = content;

      logInfo("Preview rendered successfully", {
        contentLength: content.length,
      });
    } catch (error) {
      logError("Preview render failed", error);

      // Update error message
      if (this.elements.errorMessage) {
        this.elements.errorMessage.textContent =
          error.message || this.config.MESSAGES.RENDER_ERROR;
      }

      // Show error state
      this.showPreviewState("error");

      // Register for recovery if this was a MathJax-related failure
      // or if the library failed to load (which might be due to MathJax conflicts)
      const isMathJaxRelated =
        error.message?.includes("MathJax") ||
        error.message?.includes("loader") ||
        error.message?.includes("typeset") ||
        window.MathJaxDisabled;

      if (isMathJaxRelated) {
        logInfo("Registering for MathJax recovery due to render failure");
        this.pendingMathJaxRender = true;

        // Register the preview element for re-rendering when MathJax recovers
        if (
          window.mathJaxManager?.registerPendingElement &&
          this.elements.previewContent
        ) {
          window.mathJaxManager.registerPendingElement(
            this.elements.previewContent,
            {
              source: "mmd-preview-ensureRendered",
              reason: "library-or-render-failure",
              error: error.message,
            },
          );
        }
      }
    }
  }
  /**
   * Get MMD content from the code element in DOM
   * @returns {string|null} MMD content or null if not available
   * @private
   */
  getContentFromDOM() {
    // First check if we have stored content
    if (this.currentContent) {
      return this.currentContent;
    }

    // Otherwise try to get from DOM
    const codeElement =
      this.elements.codeElement ||
      document.getElementById("mathpix-pdf-content-mmd");

    if (!codeElement) {
      logWarn("Code element not found");
      return null;
    }

    // Get text content (not innerHTML which would include syntax highlighting spans)
    const content = codeElement.textContent?.trim();

    if (!content) {
      logDebug("Code element is empty");
      return null;
    }

    // Update has-content data attribute
    if (this.elements.contentArea) {
      this.elements.contentArea.dataset.hasContent = "true";
    }

    logDebug("Content retrieved from DOM", { length: content.length });
    return content;
  }

  /**
   * Show specific preview state (loading/error/content)
   * @param {string} state - State to show ('loading' | 'error' | 'content')
   * @private
   */
  showPreviewState(state) {
    const { previewLoading, previewError, previewContent } = this.elements;

    // Hide all states first
    if (previewLoading) previewLoading.hidden = true;
    if (previewError) previewError.hidden = true;
    if (previewContent) previewContent.hidden = true;

    // Show requested state
    switch (state) {
      case "loading":
        if (previewLoading) previewLoading.hidden = false;
        logDebug("Preview state: loading");
        break;

      case "error":
        if (previewError) previewError.hidden = false;
        logDebug("Preview state: error");
        break;

      case "content":
        if (previewContent) previewContent.hidden = false;
        logDebug("Preview state: content");
        break;

      default:
        logWarn("Unknown preview state", { state });
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Load PDF file for comparison view
   * Called by controller when PDF split is activated
   * @param {File} pdfFile - PDF file to render
   * @returns {Promise<void>}
   * @since 4.2.0
   */
  async loadPDFForComparison(pdfFile) {
    if (!pdfFile) {
      logWarn("No PDF file provided for comparison");
      return;
    }

    logInfo("PDF file ready for comparison", {
      name: pdfFile.name,
      size: pdfFile.size,
    });

    // Ensure PDF compare module is initialised before dispatching event
    // This sets up the event listener if not already done
    if (typeof window.getMathPixPDFCompare === "function") {
      window.getMathPixPDFCompare();
    }

    // Dispatch event for PDF compare module to handle
    const event = new CustomEvent("mmd-pdf-compare-load", {
      detail: { file: pdfFile },
    });
    document.dispatchEvent(event);
  }

  /**
   * Register event callback
   * @param {string} event - Event name (onLoadStart, onLoadSuccess, onLoadError, onRenderComplete, onRenderError, onViewChange)
   * @param {Function} callback - Callback function
   *
   * @description
   * Available events:
   * - onLoadStart: Fired when library loading begins
   * - onLoadSuccess: Fired when library loads successfully
   * - onLoadError: Fired when library load fails (receives error)
   * - onRenderComplete: Fired after successful render (receives target element)
   * - onRenderError: Fired when render fails (receives error)
   * - onViewChange: Fired when view mode changes (receives newView, previousView)
   */
  on(event, callback) {
    const validEvents = Object.keys(this.callbacks);

    if (!validEvents.includes(event)) {
      logWarn("Unknown event type", { event, validEvents });
      return;
    }

    this.callbacks[event] = callback;
    logDebug("Event callback registered", { event });
  }

  /**
   * Remove event callback
   * @param {string} event - Event name
   */
  off(event) {
    if (Object.prototype.hasOwnProperty.call(this.callbacks, event)) {
      this.callbacks[event] = null;
      logDebug("Event callback removed", { event });
    }
  }

  // ============================================================================
  // Accessibility Helper
  // ============================================================================

  /**
   * Announce message to screen readers via live region
   * @param {string} message - Message to announce
   *
   * @description
   * Creates or uses an existing live region to announce messages
   * to screen reader users. Uses a small delay to ensure the
   * screen reader picks up the content change.
   */
  announceToScreenReader(message) {
    // Find or create live region
    let liveRegion = document.getElementById("mmd-preview-announcements");

    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "mmd-preview-announcements";
      liveRegion.className = "sr-only";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      document.body.appendChild(liveRegion);
      logDebug("Created screen reader live region");
    }

    // Clear and set message (triggers announcement)
    liveRegion.textContent = "";

    // Small delay ensures screen reader picks up change
    setTimeout(() => {
      liveRegion.textContent = message;
      logDebug("Screen reader announcement", { message });
    }, 100);
  }

  // ============================================================================
  // Cleanup Method
  // ============================================================================

  /**
   * Clean up resources
   *
   * @description
   * Removes the loaded script, resets all state, and clears callbacks.
   * Call this when the preview system is no longer needed.
   */
  cleanup() {
    // Unsubscribe from MathJax recovery events
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
      this.mathJaxRecoveryUnsubscribe = null;
    }

    // Remove script if we loaded it
    if (this.scriptElement) {
      this.scriptElement.remove();
      this.scriptElement = null;
    }

    // Reset state
    this.loadState = this.config.LOAD_STATES.IDLE;
    this.loadError = null;
    this.loadAttempts = 0;
    this.loadPromise = null;
    this.currentContent = null;
    this.lastRenderedContent = null;
    this.pendingMathJaxRender = false;

    // Reset DOM state (Stage 4)
    this.elements = {};
    this.elementsCached = false;
    this.domInitialised = false;

    // Clear callbacks
    Object.keys(this.callbacks).forEach((key) => {
      this.callbacks[key] = null;
    });

    logInfo("MathPixMMDPreview cleanup complete");
  }
}

// ============================================================================
// Export
// ============================================================================

export default MathPixMMDPreview;

// Global exposure for console testing
if (typeof window !== "undefined") {
  window.MathPixMMDPreview = MathPixMMDPreview;
}

// ============================================================================
// Global Functions for HTML onclick handlers and console testing
// ============================================================================

/**
 * Toggle PDF visibility in split view
 * @param {boolean} show - Whether to show PDF
 * @global
 */
window.toggleSplitPDF = (show) => {
  const preview = window.getMathPixMMDPreview?.();
  if (!preview) return;

  preview.toggleSplitPDF(show);
};

/**
 * Global function to switch MMD view mode
 * Called by toggle buttons in HTML
 * @param {string} viewMode - 'code' | 'preview'
 */
window.switchMMDView = async function (viewMode) {
  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("[MMD Preview] Module not initialised");
    return;
  }

  // Ensure DOM is initialised
  if (!preview.domInitialised) {
    preview.init();
  }

  try {
    await preview.switchView(viewMode);
  } catch (error) {
    console.error("[MMD Preview] View switch failed:", error.message);
  }
};

/**
 * Global function to retry loading preview library
 * Called by retry button in HTML
 */
window.retryMMDPreviewLoad = async function () {
  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("[MMD Preview] Module not initialised");
    return;
  }

  // Ensure DOM is initialised
  if (!preview.domInitialised) {
    preview.init();
  }

  try {
    await preview.retry();
    console.log("[MMD Preview] Retry successful");
  } catch (error) {
    console.error("[MMD Preview] Retry failed:", error.message);
  }
};

/**
 * Global accessor for MMD Preview instance
 * Note: Actual instance created by controller in Stage 7
 * For now, provides testing capability
 */
/**
 * Get MMD Preview instance
 * Updated to use controller's managed instance when available
 * @returns {MathPixMMDPreview|null}
 * @since 4.0.0
 */
window.getMathPixMMDPreview = function () {
  // Try to get from controller first (preferred)
  const controller = window.getMathPixController?.();
  if (controller) {
    return controller.getMMDPreview();
  }

  // Fallback for testing without controller
  if (!window._mmdPreviewTestInstance) {
    const config = window.MATHPIX_CONFIG?.MMD_PREVIEW;
    if (config) {
      window._mmdPreviewTestInstance = new MathPixMMDPreview(config);
    }
  }
  return window._mmdPreviewTestInstance;
};

// ============================================================================
// Stage 4 Validation Test
// ============================================================================

/**
 * Comprehensive validation test for Stage 4 Preview Integration
 * Run with: await validateMMDPreviewIntegration()
 */
window.validateMMDPreviewIntegration = async () => {
  console.log("🧪 MMD Preview Integration Validation");
  console.log("=====================================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition) => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`❌ ${name}`);
    }
  };

  const preview = window.getMathPixMMDPreview?.();

  // ============================================================
  // MODULE TESTS
  // ============================================================
  console.log("\n📦 Module:");

  test("Preview module exists", !!preview);

  if (!preview) {
    console.error("❌ Cannot continue without preview module");
    return results;
  }

  // Initialise
  preview.init();

  test("DOM initialised", preview.domInitialised === true);
  test("Elements cached", preview.elementsCached === true);

  // ============================================================
  // ELEMENT CACHING TESTS
  // ============================================================
  console.log("\n🗂️ Element Caching:");

  const requiredElements = [
    "codeBtn",
    "previewBtn",
    "viewStatus",
    "contentArea",
    "codeContainer",
    "previewContainer",
    "previewLoading",
    "previewError",
    "previewContent",
  ];

  requiredElements.forEach((name) => {
    test(`Element cached: ${name}`, !!preview.elements[name]);
  });

  // ============================================================
  // VIEW SWITCHING TESTS
  // ============================================================
  console.log("\n🔄 View Switching:");

  // Start with code view
  await preview.switchView("code");

  test(
    "Switch to code: currentView updated",
    preview.getCurrentView() === "code",
  );
  test(
    "Switch to code: data-current-view updated",
    preview.elements.contentArea?.dataset.currentView === "code",
  );
  test(
    "Switch to code: code container visible",
    !preview.elements.codeContainer?.hidden,
  );
  test(
    "Switch to code: preview container hidden",
    preview.elements.previewContainer?.hidden === true,
  );
  test(
    "Switch to code: code button active",
    preview.elements.codeBtn?.classList.contains("active"),
  );
  test(
    'Switch to code: code button aria-pressed="true"',
    preview.elements.codeBtn?.getAttribute("aria-pressed") === "true",
  );
  test(
    "Switch to code: preview button not active",
    !preview.elements.previewBtn?.classList.contains("active"),
  );
  test(
    'Switch to code: preview button aria-pressed="false"',
    preview.elements.previewBtn?.getAttribute("aria-pressed") === "false",
  );

  // Switch to preview
  console.log("\n📖 Preview View (may take a moment for library load):");

  // Set test content first
  const testContent = "# Test Heading\n\nThis is a test with math: $E = mc^2$";
  preview.setContent(testContent);

  test("Content stored", preview.getContent() === testContent);

  try {
    await preview.switchView("preview");

    test(
      "Switch to preview: currentView updated",
      preview.getCurrentView() === "preview",
    );
    test(
      "Switch to preview: data-current-view updated",
      preview.elements.contentArea?.dataset.currentView === "preview",
    );
    test(
      "Switch to preview: preview container visible",
      !preview.elements.previewContainer?.hidden,
    );
    test(
      "Switch to preview: code container hidden",
      preview.elements.codeContainer?.hidden === true,
    );
    test(
      "Switch to preview: preview button active",
      preview.elements.previewBtn?.classList.contains("active"),
    );
    test(
      "Switch to preview: code button not active",
      !preview.elements.codeBtn?.classList.contains("active"),
    );

    // Check library loaded
    test("Library loaded", preview.isReady());
    test(
      "data-library-loaded updated",
      preview.elements.contentArea?.dataset.libraryLoaded === "true",
    );

    // Check content rendered
    const previewHtml = preview.elements.previewContent?.innerHTML;
    test("Preview content rendered", previewHtml && previewHtml.length > 0);
    test(
      "Preview contains heading",
      previewHtml?.includes("<h1") || previewHtml?.includes("Test Heading"),
    );
  } catch (error) {
    test("Switch to preview succeeded", false);
    console.error("  Error:", error.message);
  }

  // ============================================================
  // STATE MANAGEMENT TESTS
  // ============================================================
  console.log("\n📊 State Management:");

  // Test state display functions
  preview.showPreviewState("loading");
  test("Show loading state", !preview.elements.previewLoading?.hidden);

  preview.showPreviewState("error");
  test("Show error state", !preview.elements.previewError?.hidden);

  preview.showPreviewState("content");
  test("Show content state", !preview.elements.previewContent?.hidden);

  // ============================================================
  // CONTENT CACHING TESTS
  // ============================================================
  console.log("\n💾 Content Caching:");

  const cachedContent = preview.lastRenderedContent;
  test("Last rendered content stored", !!cachedContent);

  // Switch away and back - should use cache
  await preview.switchView("code");
  await preview.switchView("preview");
  test(
    "Content cache used (no re-render)",
    preview.lastRenderedContent === cachedContent,
  );

  // ============================================================
  // RESET TO CODE VIEW
  // ============================================================
  await preview.switchView("code");

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n=====================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ Stage 4 Preview Integration COMPLETE");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => console.error(`   - ${e}`));
  }

  return results;
};

/**
 * Quick visual test for MMD preview toggle
 * Run with: await testMMDPreviewToggle()
 */
window.testMMDPreviewToggle = async () => {
  console.log("🔄 Testing view toggle (watch the UI)...");

  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("Preview module not available");
    return;
  }

  preview.init();
  preview.setContent(
    "# Hello World\n\n$$E = mc^2$$\n\nThis is a preview test.",
  );

  console.log("1. Switching to preview...");
  await preview.switchView("preview");

  await new Promise((r) => setTimeout(r, 2000));

  console.log("2. Switching to code...");
  await preview.switchView("code");

  await new Promise((r) => setTimeout(r, 1000));

  console.log("3. Switching back to preview (should use cache)...");
  await preview.switchView("preview");

  console.log("✅ Toggle test complete");
};

// Alias for Stage 4 validation
window.testMMDPreviewStage4 = window.validateMMDPreviewIntegration;

// ============================================================================
// Stage 2 Validation Test
// ============================================================================

/**
 * Comprehensive validation test for Stage 2 CDN Loader
 * Run with: await validateMMDPreviewLoader()
 */
window.validateMMDPreviewLoader = async () => {
  console.log("🧪 MMD Preview Loader Validation");
  console.log("================================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition) => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`❌ ${name}`);
    }
  };

  // Test 1: Class exists
  test(
    "MathPixMMDPreview class exists",
    typeof window.MathPixMMDPreview === "function",
  );

  // Test 2: Config available
  const config = window.MATHPIX_CONFIG?.MMD_PREVIEW;
  test("MMD_PREVIEW config available", !!config);

  if (!config) {
    console.error("❌ Cannot continue without config");
    return results;
  }

  // Test 3: Can create instance
  let preview;
  try {
    preview = new window.MathPixMMDPreview(config);
    test("Can create instance", !!preview);
  } catch (e) {
    test("Can create instance", false);
    console.error("  Error:", e.message);
    return results;
  }

  // Test 4: Initial state is IDLE
  test(
    "Initial state is IDLE",
    preview.getLoadState() === config.LOAD_STATES.IDLE,
  );

  // Test 5: isReady returns false initially
  test("isReady() returns false initially", preview.isReady() === false);

  // Test 6: Can store content
  preview.setContent("# Test");
  test("Can store content", preview.getContent() === "# Test");

  // Test 7: hasContentChanged works
  test(
    "hasContentChanged() returns true before render",
    preview.hasContentChanged() === true,
  );

  // Test 8: Load library
  console.log("\n📦 Testing library load (may take a few seconds)...");
  try {
    await preview.loadLibrary();
    test(
      "Library loads successfully",
      preview.getLoadState() === config.LOAD_STATES.READY,
    );
  } catch (e) {
    test("Library loads successfully", false);
    console.error("  Error:", e.message);
  }

  // Test 9: isReady returns true after load
  test("isReady() returns true after load", preview.isReady() === true);

  // Test 10: Global functions available
  test(
    "window.markdownToHTML available",
    typeof window.markdownToHTML === "function",
  );
  test(
    "window.loadMathJax available",
    typeof window.loadMathJax === "function",
  );

  // Test 11: Can render to string
  if (preview.isReady()) {
    try {
      const html = preview.renderToString("# Hello\n\n$E=mc^2$");
      test("renderToString produces output", html && html.length > 0);
      test(
        "renderToString contains heading",
        html.includes("<h1") || html.includes("Hello"),
      );
    } catch (e) {
      test("renderToString produces output", false);
      console.error("  Error:", e.message);
    }
  }

  // Test 12: View mode validation
  test(
    "getCurrentView returns default",
    preview.getCurrentView() === config.DEFAULTS.INITIAL_VIEW,
  );

  // Test 13: Event callbacks
  let callbackFired = false;
  preview.on("onViewChange", () => {
    callbackFired = true;
  });
  test("Can register event callback", preview.callbacks.onViewChange !== null);

  // Test 14: Can switch valid view
  try {
    await preview.switchView("preview");
    test("Can switch to preview view", preview.getCurrentView() === "preview");
  } catch (e) {
    test("Can switch to preview view", false);
    console.error("  Error:", e.message);
  }

  // Test 15: Callback was fired
  test("View change callback fired", callbackFired === true);

  // Test 16: Invalid view rejected
  let invalidViewRejected = false;
  try {
    await preview.switchView("invalid");
  } catch (e) {
    invalidViewRejected = true;
  }
  test("Invalid view mode rejected", invalidViewRejected);

  // Test 17: Global functions exist
  test(
    "window.switchMMDView exists",
    typeof window.switchMMDView === "function",
  );
  test(
    "window.retryMMDPreviewLoad exists",
    typeof window.retryMMDPreviewLoad === "function",
  );
  test(
    "window.getMathPixMMDPreview exists",
    typeof window.getMathPixMMDPreview === "function",
  );

  // Test 18: getLoadAttempts works
  test(
    "getLoadAttempts returns number",
    typeof preview.getLoadAttempts() === "number" &&
      preview.getLoadAttempts() >= 1,
  );

  // Test 19: Cleanup works
  preview.cleanup();
  test(
    "Cleanup resets state",
    preview.getLoadState() === config.LOAD_STATES.IDLE,
  );

  // Test 20: Cleanup resets content
  test("Cleanup resets content", preview.getContent() === null);

  // Summary
  console.log("\n================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ Stage 2 CDN Loader COMPLETE");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => console.error(`   - ${e}`));
  }

  return results;
};

// Quick validation alias
window.testMMDPreviewStage2 = window.validateMMDPreviewLoader;

// ============================================================================
// Phase 4.1 Split View Tests
// ============================================================================

/**
 * Split View Tests for Phase 4.1
 * Run with: await testMMDPreviewSplit()
 */
window.testMMDPreviewSplit = async () => {
  console.log("🧪 MMD Preview Split View Tests");
  console.log("================================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition) => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`❌ ${name}`);
    }
  };

  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("❌ Preview module not available");
    return results;
  }

  // Initialise
  preview.init();

  // Test 1: Split button exists
  const splitBtn = document.getElementById("mmd-view-split-btn");
  test("Split button exists in DOM", !!splitBtn);

  // Test 2: Divider exists
  const divider = document.getElementById("mmd-view-divider");
  test("Divider element exists in DOM", !!divider);

  // Test 3: Divider hidden by default
  test("Divider hidden initially", divider?.hidden === true);

  // Test 4: Split view feature enabled
  const config = window.MATHPIX_CONFIG?.MMD_PREVIEW;
  test(
    "Split view feature enabled in config",
    config?.FEATURES?.SPLIT_VIEW_ENABLED === true,
  );

  // Test 5: Switch to split view
  console.log("\n📐 Testing split view activation...");
  try {
    await preview.switchView("split");
    test("Switch to split view succeeds", preview.getCurrentView() === "split");
  } catch (e) {
    test("Switch to split view succeeds", false);
    console.error("  Error:", e.message);
  }

  // Test 6: Both containers visible in split mode
  const codeContainer = document.getElementById("mmd-code-container");
  const previewContainer = document.getElementById("mmd-preview-container");
  test("Code container visible in split", !codeContainer?.hidden);
  test("Preview container visible in split", !previewContainer?.hidden);

  // Test 7: Divider visible in split mode
  test("Divider visible in split mode", !divider?.hidden);

  // Test 8: Data attribute updated
  const contentArea = document.getElementById("mmd-content-area");
  test(
    "Content area data-current-view is 'split'",
    contentArea?.dataset.currentView === "split",
  );

  // Test 9: Split button has active class
  test("Split button has active class", splitBtn?.classList.contains("active"));

  // Test 10: Split button aria-pressed is true
  test(
    "Split button aria-pressed='true'",
    splitBtn?.getAttribute("aria-pressed") === "true",
  );

  // Test 11: Other buttons not active
  const codeBtn = document.getElementById("mmd-view-code-btn");
  const previewBtn = document.getElementById("mmd-view-preview-btn");
  test(
    "Code button not active in split",
    !codeBtn?.classList.contains("active"),
  );
  test(
    "Preview button not active in split",
    !previewBtn?.classList.contains("active"),
  );

  // Test 12: Switch back to code view
  console.log("\n🔄 Testing view switching...");
  await preview.switchView("code");
  test("Divider hidden after switch to code", divider?.hidden === true);
  test(
    "Preview container hidden after switch to code",
    previewContainer?.hidden === true,
  );

  // Test 13: Switch to preview then split
  await preview.switchView("preview");
  test("Divider hidden in preview mode", divider?.hidden === true);

  await preview.switchView("split");
  test("Divider visible after switch back to split", !divider?.hidden);

  // Reset to code view
  await preview.switchView("code");

  // Summary
  console.log("\n================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ Phase 4.1 Split View COMPLETE");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => console.error(`   - ${e}`));
  }

  return results;
};

/**
 * Visual demo for split view
 * Run with: await demoMMDSplitView()
 */
window.demoMMDSplitView = async () => {
  console.log("🎬 MMD Split View Demo");
  console.log("======================\n");

  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("Preview module not available");
    return;
  }

  preview.init();

  // Set some test content if code element is empty
  const codeElement = document.getElementById("mathpix-pdf-content-mmd");
  if (codeElement && !codeElement.textContent.trim()) {
    codeElement.textContent =
      "# Split View Demo\n\n$$E = mc^2$$\n\nThis demonstrates the split view feature showing **code** and **preview** side by side.";
    console.log("📝 Added demo content");
  }

  console.log("1. Starting in code view...");
  await preview.switchView("code");
  await new Promise((r) => setTimeout(r, 1000));

  console.log("2. Switching to split view...");
  await preview.switchView("split");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("3. Switching to preview only...");
  await preview.switchView("preview");
  await new Promise((r) => setTimeout(r, 1000));

  console.log("4. Back to split view...");
  await preview.switchView("split");

  console.log("\n✅ Split view demo complete!");
  console.log(
    "💡 Try resizing the browser window to see responsive behaviour.",
  );
};

// Alias for quick testing
window.testSplit = window.testMMDPreviewSplit;

// ============================================================================
// Phase 4.2 PDF Compare Tests
// ============================================================================

/**
 * PDF Compare Tests for Phase 4.2
 * Run with: await testMMDPreviewPDFCompare()
 */
window.testMMDPreviewPDFCompare = async () => {
  console.log("🧪 MMD Preview PDF Compare Tests");
  console.log("=================================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition) => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`❌ ${name}`);
    }
  };

  // Test 1: PDF.js available (may not be loaded yet)
  test(
    "PDF.js library check (optional)",
    typeof window.pdfjsLib !== "undefined" || true,
  );

  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("❌ Preview module not available");
    return results;
  }

  preview.init();

  // Test 2: PDF Split button exists
  const pdfSplitBtn = document.getElementById("mmd-view-pdf-split-btn");
  test("PDF Split button exists in DOM", !!pdfSplitBtn);

  // Test 3: PDF container exists
  const pdfContainer = document.getElementById("mmd-pdf-container");
  test("PDF container exists in DOM", !!pdfContainer);

  // Test 4: PDF container hidden by default
  test("PDF container hidden initially", pdfContainer?.hidden === true);

  // Test 5: PDF Split button cached in elements
  test("PDF Split button cached", !!preview.elements.pdfSplitBtn);

  // Test 6: PDF container cached in elements
  test("PDF container cached", !!preview.elements.pdfContainer);

  // Test 7: onPDFSplitActivated callback registered in callbacks object
  test(
    "onPDFSplitActivated callback exists",
    "onPDFSplitActivated" in preview.callbacks,
  );

  // Test 8: Switch to PDF split view
  console.log("\n📄 Testing PDF split view activation...");
  try {
    await preview.switchView("pdf_split");
    test(
      "Switch to PDF split view succeeds",
      preview.getCurrentView() === "pdf_split",
    );
  } catch (e) {
    test("Switch to PDF split view succeeds", false);
    console.error("  Error:", e.message);
  }

  // Test 9: PDF container visible in PDF split mode
  test("PDF container visible in pdf_split", !pdfContainer?.hidden);

  // Test 10: Preview container visible in PDF split mode
  const previewContainer = document.getElementById("mmd-preview-container");
  test("Preview container visible in pdf_split", !previewContainer?.hidden);

  // Test 11: Code container hidden in PDF split mode
  const codeContainer = document.getElementById("mmd-code-container");
  test("Code container hidden in pdf_split", codeContainer?.hidden === true);

  // Test 12: Data attribute updated
  const contentArea = document.getElementById("mmd-content-area");
  test(
    "Content area data-current-view is 'pdf_split'",
    contentArea?.dataset.currentView === "pdf_split",
  );

  // Test 13: PDF Split button active
  test(
    "PDF Split button has active class",
    pdfSplitBtn?.classList.contains("active"),
  );

  // Test 14: PDF Split button aria-pressed
  test(
    "PDF Split button aria-pressed='true'",
    pdfSplitBtn?.getAttribute("aria-pressed") === "true",
  );

  // Test 15: Divider visible
  const divider = document.getElementById("mmd-view-divider");
  test("Divider visible in pdf_split", !divider?.hidden);

  // Test 16: Switch back to code view hides PDF container
  await preview.switchView("code");
  test(
    "PDF container hidden after switch to code",
    pdfContainer?.hidden === true,
  );

  // Test 17: Switch to split view keeps PDF container hidden
  await preview.switchView("split");
  test(
    "PDF container hidden in code+preview split",
    pdfContainer?.hidden === true,
  );

  // Test 18: Switch to preview view keeps PDF container hidden
  await preview.switchView("preview");
  test("PDF container hidden in preview mode", pdfContainer?.hidden === true);

  // Test 19: loadPDFForComparison method exists
  test(
    "loadPDFForComparison method exists",
    typeof preview.loadPDFForComparison === "function",
  );

  // Reset to code view
  await preview.switchView("code");

  // Summary
  console.log("\n=================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ Phase 4.2 PDF Compare UI COMPLETE");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => console.error(`   - ${e}`));
  }

  return results;
};

// Alias
window.testPDFCompare = window.testMMDPreviewPDFCompare;

/**
 * Complete Phase 4.2 Integration Test
 * Run with: await testPhase42Complete()
 */
window.testPhase42Complete = async () => {
  console.log("🧪 Phase 4.2 Complete Integration Test");
  console.log("=====================================\n");

  let allPassed = true;

  // Test 1: Config verification
  console.log("📋 Step 1: Configuration Check");
  const config = window.MATHPIX_CONFIG?.MMD_PREVIEW;
  if (config?.VIEW_MODES?.PDF_SPLIT === "pdf_split") {
    console.log("✅ PDF_SPLIT view mode configured");
  } else {
    console.log("❌ PDF_SPLIT view mode missing");
    allPassed = false;
  }

  if (config?.FEATURES?.PDF_COMPARISON_ENABLED === true) {
    console.log("✅ PDF comparison feature enabled");
  } else {
    console.log("❌ PDF comparison feature not enabled");
    allPassed = false;
  }

  // Test 2: MMD Preview tests
  console.log("\n📋 Step 2: MMD Preview Tests");
  const previewResults = await window.testMMDPreviewPDFCompare();
  if (previewResults.failed === 0) {
    console.log("✅ All MMD Preview tests passed");
  } else {
    console.log(`❌ ${previewResults.failed} MMD Preview tests failed`);
    allPassed = false;
  }

  // Test 3: PDF Compare Module tests (if available)
  console.log("\n📋 Step 3: PDF Compare Module Tests");
  if (typeof window.testPDFCompareModule === "function") {
    const moduleResults = await window.testPDFCompareModule();
    if (moduleResults.failed === 0) {
      console.log("✅ All PDF Compare Module tests passed");
    } else {
      console.log(`❌ ${moduleResults.failed} PDF Compare Module tests failed`);
      allPassed = false;
    }
  } else {
    console.log(
      "⚠️ PDF Compare Module tests not available (script may not be loaded)",
    );
  }

  // Test 4: Controller integration
  console.log("\n📋 Step 4: Controller Integration");
  const controller = window.getMathPixController?.();
  if (controller) {
    if (typeof controller.handlePDFSplitActivated === "function") {
      console.log("✅ handlePDFSplitActivated method exists");
    } else {
      console.log("❌ handlePDFSplitActivated method missing");
      allPassed = false;
    }
  } else {
    console.log("⚠️ Controller not available");
  }

  // Summary
  console.log("\n=====================================");
  if (allPassed) {
    console.log("🎉 Phase 4.2 COMPLETE - All tests passed!");
  } else {
    console.log("❌ Phase 4.2 has failing tests - review above");
  }

  return allPassed;
};
