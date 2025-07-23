// app-config.js
// Core Application Configuration and Utilities Module
// Foundation module for Enhanced Pandoc-WASM Mathematical Playground

const AppConfig = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[APP-CONFIG]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[APP-CONFIG]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[APP-CONFIG]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[APP-CONFIG]", message, ...args);
  }

  // ===========================================================================================
  // CORE UTILITY FUNCTIONS
  // ===========================================================================================

  /**
   * HTML escaping for security and proper display
   */
  function escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Screen reader announcements for accessibility
   */
  function announceToScreenReader(message) {
    logDebug("Announcing to screen reader:", message);

    try {
      const announcement = document.createElement("div");
      announcement.className = "sr-only";
      announcement.setAttribute("role", "status");
      announcement.setAttribute("aria-live", "polite");
      announcement.textContent = message;

      document.body.appendChild(announcement);
      setTimeout(function () {
        if (document.body.contains(announcement)) {
          document.body.removeChild(announcement);
        }
      }, 1000);
    } catch (error) {
      logError("Error making screen reader announcement:", error);
    }
  }

  /**
   * Generate safe filename from metadata with enhanced logic
   */
  function generateEnhancedFilename(metadata) {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      let baseFilename = "";

      if (metadata.title) {
        baseFilename = metadata.title;
      } else {
        baseFilename = "mathematical-document";
      }

      const safeFilename = baseFilename
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);

      const filename = safeFilename + "-" + timestamp + ".html";
      logInfo("Generated enhanced filename:", filename);
      return filename;
    } catch (error) {
      logError("Error generating filename:", error);
      const fallbackFilename =
        "mathematical-document-" +
        new Date().toISOString().slice(0, 10) +
        ".html";
      return fallbackFilename;
    }
  }

  /**
   * Enhanced content validation with pre-rendered MathJax detection
   */
  function validateEnhancedContent(content) {
    logInfo("Validating content for enhanced export");

    try {
      if (!content || content.trim() === "") {
        throw new Error("No content to export");
      }

      if (
        content.includes(
          "<p><em>Enter some LaTeX content to see the conversion...</em></p>"
        )
      ) {
        throw new Error("Please enter some LaTeX content before exporting");
      }

      if (
        content.includes("Output will appear here once the module loads...")
      ) {
        throw new Error(
          "Please wait for the module to load and enter some content"
        );
      }

      // Check for conversion errors
      if (content.includes("error-message")) {
        const shouldExport = confirm(
          "The content contains errors. Export anyway?"
        );
        if (!shouldExport) {
          throw new Error("Export cancelled due to errors in content");
        }
        logWarn("Exporting content with errors as requested by user");
      }

      // Check for pre-rendered MathJax
      if (content.includes("mjx-container")) {
        logInfo(
          "Detected pre-rendered MathJax content - will convert back to LaTeX for proper menu attachment"
        );
      }

      // Warn about large files
      const sizeEstimate = new Blob([content]).size;
      logInfo("Estimated content size:", sizeEstimate, "bytes");

      if (sizeEstimate > 5 * 1024 * 1024) {
        const shouldExport = confirm(
          "The file is quite large (over 5MB). This may take longer to download and load. Continue with export?"
        );
        if (!shouldExport) {
          throw new Error("Export cancelled due to large file size");
        }
        logWarn("Exporting large file as requested by user");
      }

      // Validate mathematical content
      const mathElementCount = (
        content.match(/\$|\\\(|\\\[|\\begin\{|mjx-container/g) || []
      ).length;
      if (mathElementCount > 0) {
        logInfo(
          "Document contains " + mathElementCount + " mathematical elements"
        );
      }

      logInfo("Enhanced content validation passed");
    } catch (error) {
      logError("Content validation error:", error);
      throw error;
    }
  }

  /**
   * Application configuration constants
   */
  const CONFIG = {
    DEFAULT_ACCESSIBILITY_LEVEL: 2,
    DEFAULT_ZOOM_TRIGGER: "Click",
    DEFAULT_ZOOM_SCALE: "200%",
    DEFAULT_MATH_SCALE: 1.0,
    DEFAULT_ASSISTIVE_MML: true,
    DEFAULT_TAB_NAVIGATION: false,
    MAX_FILE_SIZE_MB: 5,
    MATHJAX_CDN: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
    ANNOUNCEMENT_TIMEOUT: 1000,
  };

  /**
   * Accessibility level configuration
   */
  function configureAccessibilityLevel(level) {
    logInfo("Configuring accessibility level:", level);

    const features = {
      1: ["basic-rendering", "context-menus"],
      2: [
        "basic-rendering",
        "context-menus",
        "screen-reader-support",
        "dynamic-controls",
      ],
      3: [
        "basic-rendering",
        "context-menus",
        "screen-reader-support",
        "dynamic-controls",
        "explorer",
        "advanced-navigation",
      ],
    };

    return {
      level: level,
      features: features[level] || features[1],
      explorer: level >= 2,
      collapsible: level >= 3,
      assistiveMml: level >= 2,
      inTabOrder: level >= 2,
    };
  }

  /**
   * Browser compatibility checks
   */
  function checkBrowserCompatibility() {
    const checks = {
      es6: typeof Promise !== "undefined",
      webAssembly: typeof WebAssembly !== "undefined",
      customElements: typeof customElements !== "undefined",
      intersectionObserver: typeof IntersectionObserver !== "undefined",
      fetch: typeof fetch !== "undefined",
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;

    logInfo(`Browser compatibility: ${passed}/${total} features supported`);

    if (passed < total) {
      logWarn(
        "Some browser features not supported:",
        Object.entries(checks)
          .filter(([key, value]) => !value)
          .map(([key]) => key)
      );
    }

    return {
      compatible: passed >= 4, // Require at least ES6, WebAssembly, fetch, and one modern feature
      checks: checks,
      score: passed / total,
    };
  }

  /**
   * Performance monitoring utilities
   */
  const Performance = {
    timers: new Map(),

    start(label) {
      this.timers.set(label, performance.now());
      logDebug(`Performance timer started: ${label}`);
    },

    end(label) {
      const startTime = this.timers.get(label);
      if (startTime) {
        const duration = performance.now() - startTime;
        this.timers.delete(label);
        logInfo(`Performance: ${label} took ${duration.toFixed(2)}ms`);
        return duration;
      }
      logWarn(`Performance timer not found: ${label}`);
      return null;
    },

    measure(label, fn) {
      this.start(label);
      try {
        const result = fn();
        if (result instanceof Promise) {
          return result.finally(() => this.end(label));
        }
        this.end(label);
        return result;
      } catch (error) {
        this.end(label);
        throw error;
      }
    },
  };

  /**
   * Error handling utilities
   */
  function handleError(error, context = "Application") {
    logError(`${context} error:`, error);

    // Sanitise error message for user display
    let userMessage = error.message || "An unexpected error occurred";

    // Remove technical details that might be confusing
    userMessage = userMessage.replace(/at\s+.*?:\d+:\d+/g, "");
    userMessage = userMessage.replace(/\s+/g, " ").trim();

    return {
      technical: error,
      user: userMessage,
      context: context,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Application state management
   */
  const AppState = {
    _state: {
      isInitialised: false,
      isReady: false,
      accessibilityLevel: CONFIG.DEFAULT_ACCESSIBILITY_LEVEL,
      currentTheme: "light",
      exportInProgress: false,
    },

    get(key) {
      return this._state[key];
    },

    set(key, value) {
      const oldValue = this._state[key];
      this._state[key] = value;
      logDebug(`State change: ${key} = ${value} (was ${oldValue})`);

      // Emit state change event for other modules
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("appStateChange", {
            detail: { key, value, oldValue },
          })
        );
      }
    },

    getAll() {
      return { ...this._state };
    },

    reset() {
      logInfo("Resetting application state");
      this._state = {
        isInitialised: false,
        isReady: false,
        accessibilityLevel: CONFIG.DEFAULT_ACCESSIBILITY_LEVEL,
        currentTheme: "light",
        exportInProgress: false,
      };
    },
  };

  // ===========================================================================================
  // INITIALIZATION AND VALIDATION
  // ===========================================================================================

  /**
   * Initialise application configuration
   */
  function initialise() {
    logInfo("Initialising application configuration...");

    try {
      // Check browser compatibility
      const compatibility = checkBrowserCompatibility();
      if (!compatibility.compatible) {
        logWarn("Browser compatibility issues detected");
      }

      // Set initial state
      AppState.set("isInitialised", true);

      logInfo("✅ Application configuration initialised successfully");
      return true;
    } catch (error) {
      logError("Failed to initialise application configuration:", error);
      return false;
    }
  }

  // ===========================================================================================
  // FOCUS TRACKING UTILITY FOR ACCESSIBILITY TESTING
  // ===========================================================================================

  /**
   * Focus tracking system for accessibility testing and debugging
   */
  const FocusTracker = {
    isActive: false,
    logFocusChanges: null,

    /**
     * Describe a focused element with comprehensive detail
     */
    describeElement(el) {
      if (!el) return "No element focused";

      let desc = el.tagName.toLowerCase();

      // Add ID if present
      if (el.id) desc += `#${el.id}`;

      // Add classes if present
      if (el.className && el.className.toString().trim()) {
        desc += `.${el.className.toString().trim().replace(/\s+/g, ".")}`;
      }

      // Add name attribute if present
      if (el.name) desc += ` [name="${el.name}"]`;

      // Add ARIA label if present
      if (el.ariaLabel) desc += ` [aria-label="${el.ariaLabel}"]`;

      // Add aria-labelledby if present
      if (el.getAttribute("aria-labelledby")) {
        desc += ` [aria-labelledby="${el.getAttribute("aria-labelledby")}"]`;
      }

      // Add role if present
      if (el.getAttribute("role")) {
        desc += ` [role="${el.getAttribute("role")}"]`;
      }

      // Add tabindex if present and not default
      const tabindex = el.getAttribute("tabindex");
      if (tabindex !== null) {
        desc += ` [tabindex="${tabindex}"]`;
      }

      // Add parent context for better identification
      if (
        el.parentElement &&
        (el.parentElement.id || el.parentElement.className)
      ) {
        let parentDesc = el.parentElement.tagName.toLowerCase();
        if (el.parentElement.id) parentDesc += `#${el.parentElement.id}`;
        if (
          el.parentElement.className &&
          el.parentElement.className.toString().trim()
        ) {
          const parentClasses = el.parentElement.className
            .toString()
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .join(".");
          if (parentClasses) parentDesc += `.${parentClasses}`;
        }
        desc += ` (in ${parentDesc})`;
      }

      return desc;
    },

    /**
     * Start tracking focus changes
     */
    start() {
      if (this.isActive) {
        logWarn("Focus tracking already active");
        return;
      }

      logInfo("🎯 Starting focus tracking for accessibility testing...");

      this.logFocusChanges = (event) => {
        const elementDesc = this.describeElement(document.activeElement);
        const eventType = event.type === "focusin" ? "FOCUS IN" : "FOCUS OUT";

        console.log(
          `%c${eventType}:`,
          "color: #2563eb; font-weight: bold;",
          elementDesc
        );

        // Also check for focus-visible state
        if (
          document.activeElement &&
          document.activeElement.matches &&
          document.activeElement.matches(":focus-visible")
        ) {
          console.log(`%c  → Focus-visible: YES`, "color: #16a34a;");
        } else if (document.activeElement) {
          console.log(`%c  → Focus-visible: NO`, "color: #dc2626;");
        }
      };

      // Listen for both focusin and focusout events
      document.addEventListener("focusin", this.logFocusChanges);
      document.addEventListener("focusout", this.logFocusChanges);

      this.isActive = true;

      // Log initial state
      console.log(
        `%cINITIAL FOCUS:`,
        "color: #7c3aed; font-weight: bold;",
        this.describeElement(document.activeElement)
      );

      logInfo("✅ Focus tracking active - use stopFocusTracking() to disable");
    },

    /**
     * Stop tracking focus changes
     */
    stop() {
      if (!this.isActive) {
        logWarn("Focus tracking not active");
        return;
      }

      if (this.logFocusChanges) {
        document.removeEventListener("focusin", this.logFocusChanges);
        document.removeEventListener("focusout", this.logFocusChanges);
        this.logFocusChanges = null;
      }

      this.isActive = false;
      logInfo("🛑 Focus tracking stopped");
    },

    /**
     * Get current focus information without logging
     */
    getCurrentFocus() {
      return {
        element: document.activeElement,
        description: this.describeElement(document.activeElement),
        isFocusVisible:
          document.activeElement &&
          document.activeElement.matches &&
          document.activeElement.matches(":focus-visible"),
      };
    },
  };

  /**
   * Global function to start focus tracking
   */
  function trackFocus() {
    FocusTracker.start();
  }

  /**
   * Global function to stop focus tracking
   */
  function stopFocusTracking() {
    FocusTracker.stop();
  }

  /**
   * Global function to get current focus info
   */
  function getCurrentFocus() {
    const info = FocusTracker.getCurrentFocus();
    console.log("Current focus:", info.description);
    console.log("Focus-visible:", info.isFocusVisible);
    return info;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
    LOG_LEVELS,

    // Core utilities
    escapeHtml,
    announceToScreenReader,
    generateEnhancedFilename,
    validateEnhancedContent,
    handleError,

    // Configuration
    CONFIG,
    configureAccessibilityLevel,

    // Browser and performance
    checkBrowserCompatibility,
    Performance,

    // State management
    AppState,

    // Focus tracking utilities
    FocusTracker,
    trackFocus,
    stopFocusTracking,
    getCurrentFocus,

    // Initialisation
    initialise,
  };
})();

// Make globally available for other modules
// Make globally available for other modules
window.AppConfig = AppConfig;

// Make focus tracking functions globally available for console use
window.trackFocus = AppConfig.trackFocus;
window.stopFocusTracking = AppConfig.stopFocusTracking;
window.getCurrentFocus = AppConfig.getCurrentFocus;

console.log("🎯 Focus tracking commands available:");
console.log("  - trackFocus() - Start focus tracking");
console.log("  - stopFocusTracking() - Stop focus tracking");
console.log("  - getCurrentFocus() - Check current focus");
