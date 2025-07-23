// event-manager.js
// Event Management System Module
// Handles keyboard shortcuts, global events, and user interactions

const EventManager = (function () {
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
      console.error("[EVENTS]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[EVENTS]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[EVENTS]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[EVENTS]", message, ...args);
  }

  // ===========================================================================================
  // EVENT MANAGEMENT IMPLEMENTATION
  // ===========================================================================================

  /**
   * Event Manager Class
   * Handles keyboard shortcuts and global event coordination
   */
  class EventSystemManager {
    constructor() {
      this.isInitialised = false;
      this.keyboardShortcuts = new Map();
      this.eventListeners = new Map();
      this.enableDebugLogging = false;
    }

    /**
     * Initialise the event system
     */
    initialise() {
      logInfo("Initialising Event System Manager...");

      try {
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Setup global event listeners
        this.setupGlobalEventListeners();

        // Setup window event listeners
        this.setupWindowEventListeners();

        this.isInitialised = true;
        logInfo("✅ Event System initialised successfully");

        return true;
      } catch (error) {
        logError("Failed to initialise Event System:", error);
        this.isInitialised = false;
        return false;
      }
    }

    /**
     * Setup keyboard shortcuts for the application
     */
    setupKeyboardShortcuts() {
      logInfo("Setting up keyboard shortcuts...");

      // Define keyboard shortcuts with their actions
      const shortcuts = [
        // Example shortcuts (Ctrl/Cmd + number)
        {
          key: "1",
          ctrl: true,
          action: () => this.loadExample("equations"),
          description: "Load Equations Example",
        },
        {
          key: "2",
          ctrl: true,
          action: () => this.loadExample("matrices"),
          description: "Load Matrices Example",
        },
        {
          key: "3",
          ctrl: true,
          action: () => this.loadExample("calculus"),
          description: "Load Calculus Example",
        },
        {
          key: "4",
          ctrl: true,
          action: () => this.loadExample("theorem"),
          description: "Load Theorem Example",
        },
        {
          key: "5",
          ctrl: true,
          action: () => this.loadExample("logic"),
          description: "Load Logic Example",
        },
        {
          key: "6",
          ctrl: true,
          action: () => this.loadExample("proofs"),
          description: "Load Proofs Example",
        },
        {
          key: "7",
          ctrl: true,
          action: () => this.loadExample("number-theory"),
          description: "Load Number Theory Example",
        },
        {
          key: "8",
          ctrl: true,
          action: () => this.loadExample("full-document"),
          description: "Load Full Document Example",
        },

        // Utility shortcuts
        {
          key: "r",
          ctrl: true,
          action: () => this.loadRandomExample(),
          description: "Load Random Example",
        },
        {
          key: "s",
          ctrl: true,
          action: () => this.triggerExport(),
          description: "Export Document (Ctrl+S)",
        },
        {
          key: "n",
          ctrl: true,
          action: () => this.clearContent(),
          description: "New Document (Clear Content)",
        },

        // Advanced examples (if available)
        {
          key: "9",
          ctrl: true,
          action: () => this.loadExample("advanced-calculus"),
          description: "Load Advanced Calculus Example",
        },
        {
          key: "0",
          ctrl: true,
          action: () => this.loadExample("linear-algebra"),
          description: "Load Linear Algebra Example",
        },
      ];

      // Register keyboard shortcut handler
      const keyboardHandler = (e) => {
        // Check if we're in an input field (allow normal typing)
        const activeElement = document.activeElement;
        const isInputField =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.contentEditable === "true");

        // For input fields, only handle Ctrl+S (save) and Ctrl+N (new)
        if (isInputField && !["s", "n"].includes(e.key.toLowerCase())) {
          return;
        }

        const isCtrlKey = e.ctrlKey || e.metaKey;

        shortcuts.forEach((shortcut) => {
          if (e.key === shortcut.key && shortcut.ctrl === isCtrlKey) {
            e.preventDefault();
            logDebug(`Keyboard shortcut triggered: ${shortcut.description}`);

            try {
              shortcut.action();
            } catch (error) {
              logError(
                `Error executing keyboard shortcut: ${shortcut.description}`,
                error
              );
            }
          }
        });
      };

      // Add to document
      document.addEventListener("keydown", keyboardHandler);
      this.eventListeners.set("keyboard", keyboardHandler);

      // Store shortcuts for reference
      shortcuts.forEach((shortcut) => {
        const key = `${
          shortcut.ctrl ? "Ctrl+" : ""
        }${shortcut.key.toUpperCase()}`;
        this.keyboardShortcuts.set(key, shortcut);
      });

      logInfo(
        `✅ Keyboard shortcuts setup complete (${shortcuts.length} shortcuts registered)`
      );
    }

    /**
     * Setup global event listeners for application coordination
     */
    setupGlobalEventListeners() {
      logInfo("Setting up global event listeners...");

      // Listen for status changes from StatusManager
      const statusChangeHandler = (event) => {
        const { status, message, progress } = event.detail;
        logDebug(
          `Status change detected: ${status} - ${message} (${progress}%)`
        );

        // Emit custom event for other modules
        this.emitEvent("applicationStatusChange", {
          status,
          message,
          progress,
        });
      };

      window.addEventListener("statusChange", statusChangeHandler);
      this.eventListeners.set("statusChange", statusChangeHandler);

      // Listen for application state changes from AppConfig
      const appStateChangeHandler = (event) => {
        const { key, value, oldValue } = event.detail;
        logDebug(`App state change: ${key} = ${value} (was ${oldValue})`);

        // React to specific state changes
        if (key === "isReady" && value === true) {
          this.onApplicationReady();
        }
      };

      window.addEventListener("appStateChange", appStateChangeHandler);
      this.eventListeners.set("appStateChange", appStateChangeHandler);

      logInfo("✅ Global event listeners setup complete");
    }

    /**
     * Setup window-level event listeners
     */
    setupWindowEventListeners() {
      logInfo("Setting up window event listeners...");

      // Window resize handler
      const resizeHandler = () => {
        logDebug("Window resize detected");
        this.emitEvent("windowResize", {
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };

      window.addEventListener("resize", resizeHandler);
      this.eventListeners.set("resize", resizeHandler);

      // Page visibility change handler
      const visibilityChangeHandler = () => {
        logDebug("Page visibility changed to:", document.visibilityState);
        this.emitEvent("visibilityChange", {
          visible: document.visibilityState === "visible",
        });
      };

      document.addEventListener("visibilitychange", visibilityChangeHandler);
      this.eventListeners.set("visibilitychange", visibilityChangeHandler);

      // Page unload handler (for cleanup)
      const beforeUnloadHandler = (e) => {
        // Only show warning if there's unsaved content
        if (this.hasUnsavedContent()) {
          e.preventDefault();
          e.returnValue = "";
          return "";
        }
      };

      window.addEventListener("beforeunload", beforeUnloadHandler);
      this.eventListeners.set("beforeunload", beforeUnloadHandler);

      logInfo("✅ Window event listeners setup complete");
    }

    /**
     * Handle application ready state
     */
    onApplicationReady() {
      logInfo("Application ready - enabling enhanced features...");

      // Load default example if ExampleSystem is available
      if (window.ExampleSystem && window.ExampleSystem.isReady()) {
        setTimeout(() => {
          window.ExampleSystem.loadDefaultExample();
        }, 100);
      }
    }

    /**
     * Load example via ExampleSystem
     */
    loadExample(exampleKey) {
      if (window.ExampleSystem && window.ExampleSystem.isReady()) {
        const success = window.ExampleSystem.loadExample(exampleKey);
        if (success) {
          logInfo(`Example loaded via keyboard shortcut: ${exampleKey}`);
        } else {
          logWarn(`Failed to load example: ${exampleKey}`);
        }
      } else {
        logWarn("ExampleSystem not available for keyboard shortcut");
      }
    }

    /**
     * Load random example via ExampleSystem
     */
    loadRandomExample() {
      if (window.ExampleSystem && window.ExampleSystem.isReady()) {
        const success = window.ExampleSystem.loadRandomExample();
        if (success) {
          logInfo("Random example loaded via keyboard shortcut");
        } else {
          logWarn("Failed to load random example");
        }
      } else {
        logWarn("ExampleSystem not available for random example shortcut");
      }
    }

    /**
     * Trigger export via ExportManager
     */
    triggerExport() {
      if (window.exportToHTML) {
        logInfo("Export triggered via keyboard shortcut");
        window.exportToHTML();
      } else {
        logWarn("Export function not available");
      }
    }

    /**
     * Clear content via ConversionEngine
     */
    clearContent() {
      if (window.ConversionEngine && window.ConversionEngine.isEngineReady()) {
        window.ConversionEngine.clearContent();
        logInfo("Content cleared via keyboard shortcut");
      } else {
        logWarn("ConversionEngine not available for clear content shortcut");
      }
    }

    /**
     * Check if there's unsaved content
     */
    hasUnsavedContent() {
      if (window.ConversionEngine) {
        const input = window.ConversionEngine.getCurrentInput();
        // FIXED: Only consider content "unsaved" if it's been modified from examples
        // and not just loaded from an example. Check if content differs from loaded examples.
        if (input && input.trim().length > 0) {
          // If ExampleSystem is available, check if current content matches any example
          if (window.ExampleSystem && window.ExampleSystem.isReady()) {
            const exampleKeys = window.ExampleSystem.getExampleKeys();
            const isMatchingExample = exampleKeys.some((key) => {
              const exampleContent = window.ExampleSystem.getExample(key);
              return exampleContent && exampleContent.trim() === input.trim();
            });
            // Only warn if content doesn't match any example (i.e., user has made changes)
            return !isMatchingExample;
          }
          // If ExampleSystem not available, consider any content as potentially unsaved
          return true;
        }
      }
      return false;
    }

    /**
     * Emit custom event for other modules
     */
    emitEvent(eventName, detail) {
      try {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
        logDebug(`Event emitted: ${eventName}`, detail);
      } catch (error) {
        logError(`Error emitting event ${eventName}:`, error);
      }
    }

    /**
     * Get registered keyboard shortcuts
     */
    getKeyboardShortcuts() {
      return Array.from(this.keyboardShortcuts.entries()).map(
        ([key, shortcut]) => ({
          key,
          description: shortcut.description,
        })
      );
    }

    /**
     * Enable or disable debug logging for events
     */
    setDebugLogging(enabled) {
      this.enableDebugLogging = enabled;
      logInfo(`Event debug logging ${enabled ? "enabled" : "disabled"}`);
    }

    /**
     * Cleanup event listeners (for testing or shutdown)
     */
    cleanup() {
      logInfo("Cleaning up event listeners...");

      this.eventListeners.forEach((handler, eventType) => {
        try {
          if (eventType === "keyboard") {
            document.removeEventListener("keydown", handler);
          } else if (eventType === "resize") {
            window.removeEventListener("resize", handler);
          } else if (eventType === "visibilitychange") {
            document.removeEventListener("visibilitychange", handler);
          } else if (eventType === "beforeunload") {
            window.removeEventListener("beforeunload", handler);
          } else {
            window.removeEventListener(eventType, handler);
          }
        } catch (error) {
          logError(`Error removing event listener ${eventType}:`, error);
        }
      });

      this.eventListeners.clear();
      this.keyboardShortcuts.clear();
      this.isInitialised = false;

      logInfo("✅ Event system cleanup complete");
    }

    /**
     * Get event system status
     */
    getSystemStatus() {
      return {
        initialised: this.isInitialised,
        keyboardShortcutsCount: this.keyboardShortcuts.size,
        eventListenersCount: this.eventListeners.size,
        debugLogging: this.enableDebugLogging,
        shortcuts: this.getKeyboardShortcuts(),
      };
    }
  }

  // ===========================================================================================
  // EVENT SYSTEM INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const eventManager = new EventSystemManager();

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Test event system functionality
   */
  function testEventSystem() {
    logInfo("🧪 Testing Event System...");

    const tests = {
      managerExists: () => !!eventManager,

      initialisation: () => eventManager.isInitialised,

      keyboardShortcuts: () => eventManager.keyboardShortcuts.size > 0,

      eventListeners: () => eventManager.eventListeners.size > 0,

      shortcutRetrieval: () => {
        const shortcuts = eventManager.getKeyboardShortcuts();
        return Array.isArray(shortcuts) && shortcuts.length > 0;
      },

      eventEmission: () => {
        let eventReceived = false;
        const testHandler = () => {
          eventReceived = true;
        };

        window.addEventListener("testEvent", testHandler);
        eventManager.emitEvent("testEvent", { test: true });
        window.removeEventListener("testEvent", testHandler);

        return eventReceived;
      },

      statusRetrieval: () => {
        const status = eventManager.getSystemStatus();
        return status && typeof status.initialised === "boolean";
      },
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
    logInfo(`📊 Event System: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      status: eventManager.getSystemStatus(),
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main manager instance
    manager: eventManager,

    // Core functionality
    initialise() {
      return eventManager.initialise();
    },

    // Event management
    emitEvent(eventName, detail) {
      return eventManager.emitEvent(eventName, detail);
    },

    // Keyboard shortcuts
    getKeyboardShortcuts() {
      return eventManager.getKeyboardShortcuts();
    },

    // System management
    setDebugLogging(enabled) {
      return eventManager.setDebugLogging(enabled);
    },

    cleanup() {
      return eventManager.cleanup();
    },

    // Status
    getSystemStatus() {
      return eventManager.getSystemStatus();
    },

    isInitialised() {
      return eventManager.isInitialised;
    },

    // Testing
    testEventSystem,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.EventManager = EventManager;
