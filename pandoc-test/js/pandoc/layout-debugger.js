// layout-debugger.js
// Layout Debugging System Module (Optional Development Tool)
// Comprehensive layout tracking and debugging for development

const LayoutDebugger = (function () {
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
      console.error("[LAYOUT-DEBUG]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) 
      console.warn("[LAYOUT-DEBUG]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) 
      console.log("[LAYOUT-DEBUG]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) 
      console.log("[LAYOUT-DEBUG]", message, ...args);
  }

  // ===========================================================================================
  // LAYOUT DEBUGGING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Layout Debugger Manager Class
   * Optional development tool for comprehensive layout analysis
   */
  class LayoutDebuggerManager {
    constructor() {
      this.isEnabled = false;
      this.isInitialised = false;
      this.observers = new Map();
      this.debugSessions = [];
      this.elementTracking = new Set();
    }

    /**
     * Enable layout debugging (call this to activate)
     */
    enable() {
      logInfo("Enabling Layout Debugger...");
      this.isEnabled = true;
      
      if (!this.isInitialised) {
        this.initialise();
      }
      
      logInfo("✅ Layout Debugger enabled");
    }

    /**
     * Disable layout debugging
     */
    disable() {
      logInfo("Disabling Layout Debugger...");
      this.isEnabled = false;
      this.cleanup();
      logInfo("✅ Layout Debugger disabled");
    }

    /**
     * Initialise the layout debugging system
     */
    initialise() {
      if (this.isInitialised) {
        return true;
      }

      logInfo("Initialising Layout Debugger Manager...");

      try {
        // Setup observers and tracking
        this.setupResizeObservers();
        this.setupMutationObservers();
        this.setupEventTracking();
        this.setupPeriodicLogging();

        // Make globally available for MathJax callbacks
        window.logLayoutState = (event) => this.logLayoutState(event);

        this.isInitialised = true;
        logInfo("✅ Layout Debugger initialised successfully");
        
        return true;
      } catch (error) {
        logError("Failed to initialise Layout Debugger:", error);
        this.isInitialised = false;
        return false;
      }
    }

    /**
     * Enhanced debug logging for layout tracking
     */
    logLayoutState(event) {
      if (!this.isEnabled) return;

      const body = document.body;
      const html = document.documentElement;
      const main = document.querySelector("main");
      const workspace = document.querySelector(".workspace");
      const outputPanel = document.querySelector(".output-panel");
      const outputContent = document.querySelector(".output-content");

      logInfo(`=== LAYOUT DEBUG: ${event} ===`);
      logInfo("Viewport:", window.innerWidth, "x", window.innerHeight);
      
      // Element dimensions
      this.logElementDimensions("HTML", html);
      this.logElementDimensions("Body", body);
      this.logElementDimensions("Main", main);
      this.logElementDimensions("Workspace", workspace);
      this.logElementDimensions("Output Panel", outputPanel);
      this.logElementDimensions("Output Content", outputContent);

      // Check computed styles
      this.checkComputedStyles(html, "HTML");
      this.checkComputedStyles(body, "Body");
      this.checkComputedStyles(main, "Main");

      // Check for constraining elements
      this.checkConstrainingElements();

      // Media query status
      this.logMediaQueryStatus();

      // CSS information
      this.logStylesheetInfo();

      logInfo("================================");

      // Store debug session
      this.debugSessions.push({
        event,
        timestamp: Date.now(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        elements: this.gatherElementInfo()
      });

      // Keep only last 50 sessions
      if (this.debugSessions.length > 50) {
        this.debugSessions.shift();
      }
    }

    /**
     * Log element dimensions
     */
    logElementDimensions(name, element) {
      if (!element) {
        logInfo(`${name}: Not found`);
        return;
      }

      logInfo(
        `${name} dimensions:`,
        "offset:", `${element.offsetWidth}x${element.offsetHeight}`,
        "client:", `${element.clientWidth}x${element.clientHeight}`,
        "scroll:", `${element.scrollWidth}x${element.scrollHeight}`
      );
    }

    /**
     * Check computed styles for key layout properties
     */
    checkComputedStyles(element, name) {
      if (!element) return;

      const styles = getComputedStyle(element);
      const keyProperties = {
        width: styles.width,
        maxWidth: styles.maxWidth,
        minWidth: styles.minWidth,
        display: styles.display,
        position: styles.position,
        overflowX: styles.overflowX,
        overflowY: styles.overflowY
      };

      logInfo(`${name} computed styles:`, keyProperties);

      // Check for inline styles
      const inlineStyles = {};
      if (element.style.width) inlineStyles.width = element.style.width;
      if (element.style.maxWidth) inlineStyles.maxWidth = element.style.maxWidth;
      if (element.style.minWidth) inlineStyles.minWidth = element.style.minWidth;

      if (Object.keys(inlineStyles).length > 0) {
        logInfo(`${name} inline styles:`, inlineStyles);
      }
    }

    /**
     * Check for elements with constraining width styles
     */
    checkConstrainingElements() {
      const allElements = document.querySelectorAll("*");
      const constrainingElements = [];

      allElements.forEach((el) => {
        const styles = getComputedStyle(el);
        if (styles.maxWidth && styles.maxWidth !== "none") {
          constrainingElements.push({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            maxWidth: styles.maxWidth
          });
        }
        
        if (el.style.width || el.style.maxWidth) {
          constrainingElements.push({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            inlineWidth: el.style.width,
            inlineMaxWidth: el.style.maxWidth
          });
        }
      });

      if (constrainingElements.length > 0) {
        logWarn("Elements with constraining widths found:", constrainingElements.slice(0, 10));
      }
    }

    /**
     * Log media query status
     */
    logMediaQueryStatus() {
      const mediaQueries = [
        { query: "(max-width: 768px)", name: "Mobile" },
        { query: "(max-width: 1200px)", name: "Tablet" },
        { query: "(max-width: 1600px)", name: "Desktop" },
        { query: "(min-width: 1200px)", name: "Large Desktop" },
        { query: "(min-width: 1600px)", name: "Extra Large Desktop" }
      ];

      const activeQueries = mediaQueries
        .filter(mq => window.matchMedia(mq.query).matches)
        .map(mq => mq.name);

      logInfo("Active media queries:", activeQueries);
    }

    /**
     * Log stylesheet information
     */
    logStylesheetInfo() {
      logInfo("Stylesheet count:", document.styleSheets.length);
      
      // Check for specific stylesheets
      Array.from(document.styleSheets).forEach((sheet, index) => {
        try {
          logDebug(`Stylesheet ${index}:`, {
            href: sheet.href,
            title: sheet.title,
            disabled: sheet.disabled,
            rulesCount: sheet.cssRules ? sheet.cssRules.length : "inaccessible"
          });
        } catch (error) {
          logDebug(`Stylesheet ${index}: Cross-origin or inaccessible`);
        }
      });
    }

    /**
     * Gather comprehensive element information
     */
    gatherElementInfo() {
      const elements = {};
      const keySelectors = [
        "html", "body", "main", ".workspace", 
        ".output-panel", ".output-content", ".input-panel"
      ];

      keySelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const styles = getComputedStyle(element);
          elements[selector] = {
            dimensions: {
              offset: { width: element.offsetWidth, height: element.offsetHeight },
              client: { width: element.clientWidth, height: element.clientHeight },
              scroll: { width: element.scrollWidth, height: element.scrollHeight }
            },
            styles: {
              width: styles.width,
              maxWidth: styles.maxWidth,
              display: styles.display,
              position: styles.position,
              overflow: styles.overflow
            }
          };
        }
      });

      return elements;
    }

    /**
     * Setup resize observers for element tracking
     */
    setupResizeObservers() {
      if (!ResizeObserver) {
        logWarn("ResizeObserver not available");
        return;
      }

      const elementsToTrack = ["body", "main", ".workspace", ".output-content"];

      elementsToTrack.forEach(selector => {
        const element = document.querySelector(selector);
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
          if (!this.isEnabled) return;
          
          for (let entry of entries) {
            logInfo(
              `RESIZE DETECTED - ${selector}:`,
              "contentRect:", `${entry.contentRect.width}x${entry.contentRect.height}`,
              "borderBoxSize:", entry.borderBoxSize?.[0]?.inlineSize || "unknown"
            );
            this.logLayoutState(`Resize: ${selector}`);
          }
        });

        resizeObserver.observe(element);
        this.observers.set(`resize-${selector}`, resizeObserver);
      });

      logDebug("Resize observers setup complete");
    }

    /**
     * Setup mutation observers for DOM changes
     */
    setupMutationObservers() {
      const mutationObserver = new MutationObserver((mutations) => {
        if (!this.isEnabled) return;

        mutations.forEach((mutation) => {
          if (mutation.type === "attributes" && 
              (mutation.attributeName === "style" || mutation.attributeName === "class")) {
            
            logInfo(
              "Style/class change detected on:", 
              mutation.target.tagName,
              "class:", mutation.target.className,
              "id:", mutation.target.id
            );

            // Check for width-related changes
            if (mutation.attributeName === "style") {
              const element = mutation.target;
              if (element.style.width || element.style.maxWidth) {
                logWarn(
                  "WIDTH STYLE CHANGE:",
                  element.tagName,
                  "width:", element.style.width,
                  "maxWidth:", element.style.maxWidth
                );
              }
            }

            this.logLayoutState("After style/class mutation");
          }

          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                logDebug(
                  "DOM node added:",
                  node.tagName,
                  "class:", node.className,
                  "id:", node.id
                );

                // Check for constraining elements
                if (node.style && (node.style.width || node.style.maxWidth)) {
                  logWarn(
                    "CONSTRAINING ELEMENT ADDED:",
                    node.tagName,
                    "width:", node.style.width,
                    "maxWidth:", node.style.maxWidth
                  );
                }
              }
            });
            this.logLayoutState("After DOM nodes added");
          }
        });
      });

      // Start observing
      mutationObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["style", "class"]
      });

      this.observers.set("mutation", mutationObserver);
      logDebug("Mutation observer setup complete");
    }

    /**
     * Setup event tracking for layout-related events
     */
    setupEventTracking() {
      // Window events
      const windowEvents = [
        { event: "resize", handler: () => this.logLayoutState("Window resize") },
        { event: "load", handler: () => this.logLayoutState("Window load") },
        { event: "DOMContentLoaded", handler: () => this.logLayoutState("DOMContentLoaded") }
      ];

      windowEvents.forEach(({ event, handler }) => {
        window.addEventListener(event, handler);
        this.observers.set(`window-${event}`, handler);
      });

      // Document events
      const documentEvents = [
        { event: "visibilitychange", handler: () => this.logLayoutState("Visibility change") }
      ];

      documentEvents.forEach(({ event, handler }) => {
        document.addEventListener(event, handler);
        this.observers.set(`document-${event}`, handler);
      });

      logDebug("Event tracking setup complete");
    }

    /**
     * Setup periodic layout logging for development
     */
    setupPeriodicLogging() {
      const intervals = [100, 500, 1000, 2000, 5000];

      intervals.forEach(delay => {
        setTimeout(() => {
          if (this.isEnabled) {
            this.logLayoutState(`${delay}ms after load`);
          }
        }, delay);
      });

      logDebug("Periodic logging scheduled");
    }

    /**
     * Get debug session history
     */
    getDebugHistory() {
      return this.debugSessions.slice(); // Return copy
    }

    /**
     * Clear debug session history
     */
    clearHistory() {
      this.debugSessions = [];
      logInfo("Debug session history cleared");
    }

    /**
     * Export debug data for analysis
     */
    exportDebugData() {
      const debugData = {
        enabled: this.isEnabled,
        initialized: this.isInitialised,
        sessions: this.debugSessions,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        currentLayout: this.gatherElementInfo()
      };

      return debugData;
    }

    /**
     * Cleanup observers and event listeners
     */
    cleanup() {
      logInfo("Cleaning up layout debugger...");

      this.observers.forEach((observer, key) => {
        try {
          if (key.startsWith("resize-")) {
            observer.disconnect();
          } else if (key === "mutation") {
            observer.disconnect();
          } else if (key.startsWith("window-")) {
            window.removeEventListener(key.replace("window-", ""), observer);
          } else if (key.startsWith("document-")) {
            document.removeEventListener(key.replace("document-", ""), observer);
          }
        } catch (error) {
          logError(`Error cleaning up observer ${key}:`, error);
        }
      });

      this.observers.clear();
      this.elementTracking.clear();

      // Remove global function
      if (window.logLayoutState) {
        delete window.logLayoutState;
      }

      this.isInitialised = false;
      logInfo("✅ Layout debugger cleanup complete");
    }

    /**
     * Get debugger status
     */
    getStatus() {
      return {
        enabled: this.isEnabled,
        initialized: this.isInitialised,
        observersCount: this.observers.size,
        sessionsCount: this.debugSessions.length,
        elementsTracking: this.elementTracking.size
      };
    }
  }

  // ===========================================================================================
  // LAYOUT DEBUGGER INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const layoutDebugger = new LayoutDebuggerManager();

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Test layout debugger functionality
   */
  function testLayoutDebugger() {
    logInfo("🧪 Testing Layout Debugger...");

    const tests = {
      managerExists: () => !!layoutDebugger,
      
      enableDisable: () => {
        layoutDebugger.enable();
        const enabled = layoutDebugger.isEnabled;
        layoutDebugger.disable();
        const disabled = !layoutDebugger.isEnabled;
        return enabled && disabled;
      },
      
      initialization: () => {
        layoutDebugger.enable();
        const initialized = layoutDebugger.isInitialised;
        layoutDebugger.disable();
        return initialized;
      },
      
      layoutLogging: () => {
        layoutDebugger.enable();
        const beforeCount = layoutDebugger.getDebugHistory().length;
        layoutDebugger.logLayoutState("Test logging");
        const afterCount = layoutDebugger.getDebugHistory().length;
        layoutDebugger.disable();
        return afterCount > beforeCount;
      },
      
      dataExport: () => {
        layoutDebugger.enable();
        const data = layoutDebugger.exportDebugData();
        layoutDebugger.disable();
        return data && typeof data.timestamp === "string";
      },
      
      statusRetrieval: () => {
        const status = layoutDebugger.getStatus();
        return status && typeof status.enabled === "boolean";
      }
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 Layout Debugger: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      status: layoutDebugger.getStatus()
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main manager instance
    manager: layoutDebugger,
    
    // Core functionality
    enable() {
      return layoutDebugger.enable();
    },
    
    disable() {
      return layoutDebugger.disable();
    },
    
    logLayoutState(event) {
      return layoutDebugger.logLayoutState(event);
    },
    
    // Data management
    getDebugHistory() {
      return layoutDebugger.getDebugHistory();
    },
    
    clearHistory() {
      return layoutDebugger.clearHistory();
    },
    
    exportDebugData() {
      return layoutDebugger.exportDebugData();
    },
    
    // Status
    getStatus() {
      return layoutDebugger.getStatus();
    },
    
    isEnabled() {
      return layoutDebugger.isEnabled;
    },
    
    // Testing
    testLayoutDebugger,
    
    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug
  };
})();

// Make globally available for other modules
window.LayoutDebugger = LayoutDebugger;