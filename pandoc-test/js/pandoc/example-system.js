// example-system.js
// External Example Management System Module
// Handles loading, selection, and management of mathematical examples

const ExampleSystem = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[EXAMPLES]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[EXAMPLES]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[EXAMPLES]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[EXAMPLES]", message, ...args);
  }

  // ===========================================================================================
  // CONFIGURATION
  // ===========================================================================================

  /**
   * Default example to load on page startup
   * Change this value to set which example loads automatically
   * Must match a key in examples.json
   */
  const DEFAULT_EXAMPLE_KEY = "mathematical-foundations";

  // ===========================================================================================
  // EXAMPLE SYSTEM IMPLEMENTATION
  // ===========================================================================================

  /**
   * Example System Manager Class
   * Handles loading external examples and managing the example interface
   */
  class ExampleSystemManager {
    constructor() {
      this.allExamples = {};
      this.exampleKeys = [];
      this.isInitialised = false;
      this.exampleSelect = null;
      this.randomExampleBtn = null;
    }

    /**
     * Initialise the example system
     */
    async initialise() {
      logInfo("Initialising Example System Manager...");

      try {
        // Get DOM elements
        this.exampleSelect = document.getElementById("example-select");
        this.randomExampleBtn = document.getElementById("random-example-btn");

        if (!this.exampleSelect || !this.randomExampleBtn) {
          throw new Error("Required example system DOM elements not found");
        }

        // Load examples from external JSON
        await this.loadExternalExamples();

        // Update dropdown with loaded examples
        this.updateExampleDropdown();

        // Setup event handlers
        this.setupEventHandlers();

        this.isInitialised = true;
        logInfo(
          `✅ Example System initialised with ${this.exampleKeys.length} examples`
        );

        return true;
      } catch (error) {
        logError("Failed to initialise Example System:", error);
        this.isInitialised = false;
        return false;
      }
    }

    /**
     * Load examples from external JSON file only (no built-in fallback)
     */
    async loadExternalExamples() {
      try {
        logInfo("Loading examples from examples.json...");
        const response = await fetch("examples/examples.json");

        if (!response.ok) {
          throw new Error(
            `Failed to load examples.json: ${response.status} ${response.statusText}`
          );
        }

        const externalData = await response.json();

        if (!externalData || typeof externalData !== "object") {
          throw new Error("Invalid examples.json format");
        }

        this.allExamples = externalData;
        this.exampleKeys = Object.keys(externalData);

        logInfo(
          `✅ Successfully loaded ${this.exampleKeys.length} examples from external JSON`
        );

        if (this.exampleKeys.length === 0) {
          logWarn("No examples found in examples.json");
        }

        return true;
      } catch (error) {
        logError("Failed to load external examples:", error);

        // No fallback - require external examples file
        this.allExamples = {};
        this.exampleKeys = [];

        throw new Error(
          "Examples system requires examples.json file to be present and valid"
        );
      }
    }

    /**
     * Update dropdown options with loaded examples (in alphabetical order)
     */
    updateExampleDropdown() {
      if (!this.exampleSelect) {
        logError("Example select element not available");
        return;
      }

      logInfo("Updating example dropdown...");

      // Clear existing options (except the first placeholder)
      while (this.exampleSelect.children.length > 1) {
        this.exampleSelect.removeChild(this.exampleSelect.lastChild);
      }

      // Create friendly display names mapping
      const displayNames = {
        equations: "Fundamental Equations",
        matrices: "Matrix Mathematics",
        calculus: "Calculus Concepts",
        theorem: "Mathematical Theorem",
        logic: "Logic & Truth Tables",
        proofs: "Mathematical Proofs",
        "number-theory": "Number Theory",
        "full-document": "Complete Document",
        "advanced-calculus": "Advanced Calculus",
        "linear-algebra": "Linear Algebra",
        statistics: "Statistics & Probability",
        "complex-analysis": "Complex Analysis",
        "differential-equations": "Differential Equations",
        topology: "Topology",
        "algebraic-structures": "Abstract Algebra",
      };

      // Helper function to get display name for a key
      const getDisplayName = (key) => {
        return (
          displayNames[key] ||
          key.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        );
      };

      // Sort keys alphabetically by their display names
      const sortedKeys = [...this.exampleKeys].sort((a, b) => {
        const nameA = getDisplayName(a).toLowerCase();
        const nameB = getDisplayName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Add options for each example in alphabetical order
      sortedKeys.forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = getDisplayName(key);
        this.exampleSelect.appendChild(option);
      });

      logInfo(
        `✅ Dropdown updated with ${this.exampleKeys.length} examples (alphabetically sorted)`
      );
    }

    /**
     * Setup event handlers for example system
     */
    setupEventHandlers() {
      logInfo("Setting up example system event handlers...");

      // Example dropdown handler
      if (this.exampleSelect) {
        this.exampleSelect.addEventListener("change", (e) => {
          const selectedExample = e.target.value;
          if (selectedExample) {
            this.loadExample(selectedExample);
          }
        });
      }

      // Random example button handler
      if (this.randomExampleBtn) {
        this.randomExampleBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.loadRandomExample();
        });
      }

      logInfo("✅ Example system event handlers setup complete");
    }

    /**
     * Load a specific example with proper annotation timing
     */
    async loadExample(exampleKey) {
      logInfo(`Loading example: ${exampleKey}`);

      if (!this.allExamples[exampleKey]) {
        logError(`Example not found: ${exampleKey}`);
        return false;
      }

      try {
        const exampleContent = this.allExamples[exampleKey];

        // 🔄 ENHANCED: Clear any existing state first
        await this.clearPreviousContent();

        // Load content using appropriate method
        await this.setExampleContent(exampleContent, exampleKey);

        // 🔄 ENHANCED: Trigger conversion with proper timing
        await this.triggerConversionWithAnnotationWait();

        logInfo(`✅ Example with annotations loaded: ${exampleKey}`);
        return true;
      } catch (error) {
        logError("Error loading example:", error);
        return false;
      }
    }

    /**
     * 🧹 Clear previous content to prevent interference
     */
    async clearPreviousContent() {
      // Clear output first
      const outputDiv = document.getElementById("output");
      if (outputDiv) {
        outputDiv.innerHTML =
          '<p class="placeholder-text">Loading example...</p>';
      }

      // Clear input
      const inputTextarea =
        window.appElements?.inputTextarea || document.getElementById("input");
      if (inputTextarea) {
        inputTextarea.value = "";
      }

      // Clear Live LaTeX Editor if present
      if (window.liveLaTeXEditor?.contentEditableElement) {
        window.liveLaTeXEditor.contentEditableElement.innerHTML = "";
      }

      // Small delay to let DOM settle
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    /**
     * 📝 Set example content using appropriate method
     */
    async setExampleContent(content, exampleKey) {
      // 🔒 CRITICAL FIX: Disable automatic conversions during example loading
      const originalConversionLock = this.temporarilyDisableAutoConversion();

      try {
        if (
          window.liveLaTeXEditor &&
          window.liveLaTeXEditor.isReady &&
          window.liveLaTeXEditor.isReady()
        ) {
          // Use Live LaTeX Editor
          window.liveLaTeXEditor.setContent(content);

          // Focus for accessibility
          if (window.liveLaTeXEditor.contentEditableElement) {
            window.liveLaTeXEditor.contentEditableElement.focus({
              preventScroll: true,
            });
          }

          logInfo(`📝 Content set via Live LaTeX Editor: ${exampleKey}`);
        } else {
          // Use textarea
          const inputTextarea =
            window.appElements?.inputTextarea ||
            document.getElementById("input");

          if (!inputTextarea) {
            throw new Error("No input method available");
          }

          inputTextarea.value = content;
          inputTextarea.focus({ preventScroll: true });

          logInfo(`📝 Content set via textarea: ${exampleKey}`);
        }

        // Allow content to settle
        await new Promise((resolve) => setTimeout(resolve, 200));
      } finally {
        // 🔓 Re-enable automatic conversions after content is set
        this.restoreAutoConversion(originalConversionLock);
      }
    }

    /**
     * 🔒 Temporarily disable ConversionEngine's automatic conversion triggers
     * Returns lock state for restoration
     * ENHANCED: Properly handles StateManager integration
     */
    temporarilyDisableAutoConversion() {
      if (!window.ConversionEngine) {
        return null;
      }

      logInfo(
        "🔒 Temporarily disabling automatic conversions during example loading"
      );

      // Store current conversion queue state - get actual current value
      const currentDisabledState =
        window.ConversionEngine.automaticConversionsDisabled;

      const lockState = {
        wasQueued: window.ConversionEngine.isConversionQueued || false,
        activeTimeouts: new Set(window.ConversionEngine.activeTimeouts || []),
        wasDisabled: currentDisabledState, // Use actual current state, not || false
        timestamp: Date.now(), // Add timestamp for debugging
      };

      logInfo(
        `🔍 Current disabled state before locking: ${currentDisabledState}`
      );

      try {
        // 🔒 ENHANCED: Use proper StateManager integration for setting

        // Method 1: Try StateManager integration first (if available)
        if (
          window.StateManager &&
          typeof window.StateManager.updateConfiguration === "function"
        ) {
          logInfo("🔄 Disabling via StateManager integration");
          window.StateManager.updateConfiguration({
            automaticConversionsDisabled: true,
          });
        }

        // Method 2: Set on public API (backward compatibility)
        window.ConversionEngine.automaticConversionsDisabled = true;

        // Method 3: Set on manager instance (if accessible)
        if (window.ConversionEngine.manager) {
          // If manager uses StateManager delegation, this might not be needed,
          // but include for completeness
          if (!window.StateManager) {
            window.ConversionEngine.manager._automaticConversionsDisabled = true;
          }
        }

        // 🔧 ENHANCED: Force cache invalidation to ensure changes take effect immediately
        if (
          window.ConversionEngine.manager &&
          typeof window.ConversionEngine.manager._invalidateStatusCache ===
            "function"
        ) {
          window.ConversionEngine.manager._invalidateStatusCache();
        }

        // 🎯 CRITICAL FIX: Invalidate input event listener cache
        if (window.ConversionEngine.invalidateAutomaticConversionsCache) {
          window.ConversionEngine.invalidateAutomaticConversionsCache();
          logInfo("🔄 Input event cache invalidated during restoration");
        }

        // Clear any pending conversions
        if (window.ConversionEngine.conversionTimeout) {
          clearTimeout(window.ConversionEngine.conversionTimeout);
          window.ConversionEngine.conversionTimeout = null;
        }

        // Clear active timeouts
        if (window.ConversionEngine.activeTimeouts) {
          window.ConversionEngine.activeTimeouts.forEach((timeout) =>
            clearTimeout(timeout)
          );
          window.ConversionEngine.activeTimeouts.clear();
        }

        // Reset queue state
        window.ConversionEngine.isConversionQueued = false;

        // 🎯 VERIFICATION: Check that disabling actually worked
        const actualValue =
          window.ConversionEngine.automaticConversionsDisabled;
        if (actualValue !== true) {
          logWarn(
            `⚠️ Disabling verification failed: expected true, got ${actualValue}`
          );

          // Force direct property setting as fallback
          if (window.ConversionEngine.manager) {
            window.ConversionEngine.manager._automaticConversionsDisabled = true;
            logInfo("🔧 Applied direct fallback disabling");
          }
        } else {
          logInfo("✅ Disabling verified: automaticConversionsDisabled = true");
        }
      } catch (error) {
        logError("Error during automatic conversion disabling:", error);

        // Emergency fallback
        try {
          window.ConversionEngine.automaticConversionsDisabled = true;
          if (window.ConversionEngine.manager) {
            window.ConversionEngine.manager._automaticConversionsDisabled = true;
          }
          logInfo("🚨 Emergency fallback applied for disabling");
        } catch (fallbackError) {
          logError(
            "Emergency fallback for disabling also failed:",
            fallbackError
          );
        }
      }

      return lockState;
    }

    /**
     * 🔓 Restore ConversionEngine's automatic conversion triggers
     * Restores the previous lock state
     * ENHANCED: Properly handles StateManager integration
     */
    restoreAutoConversion(lockState) {
      if (!window.ConversionEngine || !lockState) {
        return;
      }

      logInfo("🔓 Restoring automatic conversions after example loading");

      try {
        // 🔓 CRITICAL FIX: Use proper StateManager integration for restoration
        const targetValue = lockState.wasDisabled;

        // Method 1: Try StateManager integration first (if available)
        if (
          window.StateManager &&
          typeof window.StateManager.updateConfiguration === "function"
        ) {
          logInfo("🔄 Restoring via StateManager integration");
          window.StateManager.updateConfiguration({
            automaticConversionsDisabled: targetValue,
          });
        }

        // Method 2: Set on public API (backward compatibility)
        window.ConversionEngine.automaticConversionsDisabled = targetValue;

        // Method 3: Set on manager instance (if accessible)
        if (window.ConversionEngine.manager) {
          // If manager uses StateManager delegation, this might not be needed,
          // but include for completeness
          if (!window.StateManager) {
            window.ConversionEngine.manager._automaticConversionsDisabled =
              targetValue;
          }
        }

        // 🔧 ENHANCED: Force cache invalidation to ensure changes take effect
        if (
          window.ConversionEngine.manager &&
          typeof window.ConversionEngine.manager._invalidateStatusCache ===
            "function"
        ) {
          window.ConversionEngine.manager._invalidateStatusCache();
        }

        // Restore timeout tracking
        if (lockState.activeTimeouts) {
          window.ConversionEngine.activeTimeouts = lockState.activeTimeouts;
        }

        // Restore queue state if it was previously queued
        if (lockState.wasQueued) {
          window.ConversionEngine.isConversionQueued = lockState.wasQueued;
        }

        // 🎯 VERIFICATION: Check that restoration actually worked
        const actualValue =
          window.ConversionEngine.automaticConversionsDisabled;
        if (actualValue !== targetValue) {
          logWarn(
            `⚠️ Restoration verification failed: expected ${targetValue}, got ${actualValue}`
          );

          // Final fallback: direct property setting
          if (window.ConversionEngine.manager) {
            window.ConversionEngine.manager._automaticConversionsDisabled =
              targetValue;
            logInfo("🔧 Applied direct fallback restoration");
          }
        } else {
          logInfo(
            `✅ Restoration verified: automaticConversionsDisabled = ${actualValue}`
          );
        }
      } catch (error) {
        logError("Error during automatic conversion restoration:", error);

        // Emergency fallback
        try {
          window.ConversionEngine.automaticConversionsDisabled = false;
          if (window.ConversionEngine.manager) {
            window.ConversionEngine.manager._automaticConversionsDisabled = false;
          }
          logInfo("🚨 Emergency fallback applied - forced to false");
        } catch (fallbackError) {
          logError("Emergency fallback also failed:", fallbackError);
        }
      }
    }

    /**
     * 🔄 Trigger conversion and wait for annotations
     */
    async triggerConversionWithAnnotationWait() {
      if (!window.ConversionEngine || !window.ConversionEngine.convertInput) {
        logWarn("ConversionEngine not available");
        return;
      }

      logInfo("🔄 Triggering conversion with annotation wait...");

      // Trigger conversion
      window.ConversionEngine.convertInput();

      // Wait for MathJax and annotations to complete
      const maxWaitTime = 10000; // 10 seconds
      const checkInterval = 200; // Check every 200ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));

        const mathElements = document.querySelectorAll("mjx-container").length;
        const annotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;

        if (mathElements > 0 && annotations > 0) {
          logInfo(
            `✅ Annotations ready: ${annotations} annotations for ${mathElements} math elements`
          );
          return;
        }

        if (mathElements === 0) {
          // No math content, no annotations needed
          logInfo("ℹ️ No math content detected - no annotations needed");
          return;
        }
      }

      // Timeout reached
      const mathElements = document.querySelectorAll("mjx-container").length;
      const annotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;
      logWarn(
        `⏱️ Annotation wait timeout: ${annotations} annotations for ${mathElements} math elements`
      );
    }

    /**
     * Load a random example
     */
    loadRandomExample() {
      if (this.exampleKeys.length === 0) {
        logWarn("No examples available for random selection");
        return false;
      }

      logInfo("Loading random example...");

      // Disable button temporarily to prevent rapid clicking
      if (this.randomExampleBtn) {
        this.randomExampleBtn.disabled = true;
        this.randomExampleBtn.innerHTML =
          '<span aria-hidden="true">🎲</span> Loading...';
      }

      setTimeout(() => {
        try {
          // Select random example
          const randomKey =
            this.exampleKeys[
              Math.floor(Math.random() * this.exampleKeys.length)
            ];

          // Update dropdown to reflect selection
          if (this.exampleSelect) {
            this.exampleSelect.value = randomKey;
          }

          // Load the example
          const success = this.loadExample(randomKey);

          // Announce to screen reader
          if (success && this.exampleSelect) {
            const exampleName =
              this.exampleSelect.options[this.exampleSelect.selectedIndex]
                ?.textContent || randomKey;

            this.announceToScreenReader(
              `Loaded random example: ${exampleName}`
            );
          }

          logInfo(`✅ Random example loaded: ${randomKey}`);
        } catch (error) {
          logError("Error loading random example:", error);
        } finally {
          // Re-enable button
          if (this.randomExampleBtn) {
            this.randomExampleBtn.disabled = false;
            this.randomExampleBtn.innerHTML =
              '<span aria-hidden="true">🎲</span> Random';
          }
        }
      }, 300); // Small delay for better UX

      return true;
    }

    /**
     * Load default example (for initialization)
     */
    loadDefaultExample() {
      if (this.exampleKeys.length === 0) {
        logWarn("No examples available for default loading");
        return false;
      }

      logInfo(`Loading default example: ${DEFAULT_EXAMPLE_KEY}...`);

      // Try to load configured default first, then first available example
      const defaultKey = this.exampleKeys.includes(DEFAULT_EXAMPLE_KEY)
        ? DEFAULT_EXAMPLE_KEY
        : this.exampleKeys[0];

      if (this.exampleSelect) {
        this.exampleSelect.value = defaultKey;
      }

      return this.loadExample(defaultKey);
    }

    /**
     * Get example content by key
     */
    getExample(exampleKey) {
      return this.allExamples[exampleKey] || null;
    }

    /**
     * Get all available example keys
     */
    getExampleKeys() {
      return [...this.exampleKeys];
    }

    /**
     * Check if system is initialised
     */
    isReady() {
      return this.isInitialised && this.exampleKeys.length > 0;
    }

    /**
     * Announce to screen reader
     */
    announceToScreenReader(message) {
      try {
        const announcement = document.createElement("div");
        announcement.className = "sr-only";
        announcement.setAttribute("role", "status");
        announcement.setAttribute("aria-live", "polite");
        announcement.textContent = message;

        document.body.appendChild(announcement);
        setTimeout(() => {
          if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
          }
        }, 1000);

        logDebug("Screen reader announcement:", message);
      } catch (error) {
        logError("Error making screen reader announcement:", error);
      }
    }

    /**
     * Get system status for testing
     */
    getSystemStatus() {
      return {
        initialised: this.isInitialised,
        exampleCount: this.exampleKeys.length,
        examples: this.allExamples,
        keys: this.exampleKeys,
      };
    }
  }

  // ===========================================================================================
  // EXAMPLE SYSTEM INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const exampleManager = new ExampleSystemManager();

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Test example system functionality
   */
  function testExampleSystem() {
    logInfo("🧪 Testing Example System...");

    const tests = {
      managerExists: () => !!exampleManager,

      initialisation: () => exampleManager.isReady(),

      hasExamples: () => exampleManager.getExampleKeys().length > 0,

      canLoadExample: () => {
        const keys = exampleManager.getExampleKeys();
        if (keys.length === 0) return false;

        const testKey = keys[0];
        const content = exampleManager.getExample(testKey);
        return content && content.length > 0;
      },

      domElementsConnected: () => {
        return (
          !!document.getElementById("example-select") &&
          !!document.getElementById("random-example-btn")
        );
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
    logInfo(`📊 Example System: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      status: exampleManager.getSystemStatus(),
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main manager instance
    manager: exampleManager,

    // Core functionality
    initialise() {
      return exampleManager.initialise();
    },

    loadExample(key) {
      return exampleManager.loadExample(key);
    },

    loadRandomExample() {
      return exampleManager.loadRandomExample();
    },

    loadDefaultExample() {
      return exampleManager.loadDefaultExample();
    },

    // Data access
    getExample(key) {
      return exampleManager.getExample(key);
    },

    getExampleKeys() {
      return exampleManager.getExampleKeys();
    },

    // Status
    isReady() {
      return exampleManager.isReady();
    },

    getSystemStatus() {
      return exampleManager.getSystemStatus();
    },

    // Testing
    testExampleSystem,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.ExampleSystem = ExampleSystem;

// ===========================================================================================
// ENHANCED EXAMPLE DEBUG SYSTEM FOR ANNOTATION DIAGNOSTICS
// ===========================================================================================

// Enhanced Example Debug System for Annotation Diagnostics
window.exampleDebug = (function () {
  "use strict";

  function logInfo(message, ...args) {
    console.log("[EXAMPLE-DEBUG]", message, ...args);
  }

  function logWarn(message, ...args) {
    console.warn("[EXAMPLE-DEBUG]", message, ...args);
  }

  /**
   * Test current example state using existing ExampleSystem
   */
  async function testCurrent() {
    logInfo("🔍 Testing current example state...");

    const timeline = {
      startTime: Date.now(),
      events: [],
      finalState: null,
    };

    function addEvent(event, data = {}) {
      timeline.events.push({
        timestamp: Date.now() - timeline.startTime,
        event: event,
        ...data,
      });
    }

    addEvent("test_current_start");

    // Check if ExampleSystem is ready
    if (!window.ExampleSystem?.isReady()) {
      addEvent("example_system_not_ready");
      logWarn("ExampleSystem not ready");
      return timeline;
    }

    // Check current DOM state
    const mathElements = document.querySelectorAll("mjx-container").length;
    const annotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;

    addEvent("dom_state_check", { mathElements, annotations });

    // If no math content, load a test example using existing system
    if (mathElements === 0) {
      addEvent("loading_test_example");

      const availableKeys = window.ExampleSystem.getExampleKeys();
      if (availableKeys.length > 0) {
        // Use first available example that likely has math
        const mathExamples = [
          "basic-math",
          "equations",
          "calculus",
          "statistics",
        ];
        const testKey =
          mathExamples.find((key) => availableKeys.includes(key)) ||
          availableKeys[0];

        addEvent("selected_test_example", { key: testKey });
        await window.ExampleSystem.loadExample(testKey);
        addEvent("test_example_loaded");

        // Wait a bit more for processing
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        addEvent("no_examples_available");
      }
    }

    // Final state check
    const finalMath = document.querySelectorAll("mjx-container").length;
    const finalAnnotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;

    timeline.finalState = {
      mathElements: finalMath,
      annotations: finalAnnotations,
      percentage:
        finalMath > 0 ? ((finalAnnotations / finalMath) * 100).toFixed(1) : "0",
      totalTime: Date.now() - timeline.startTime,
      status: finalAnnotations > 0 ? "WORKING" : "FAILING",
    };

    addEvent("test_current_complete", timeline.finalState);

    logInfo("📊 Current test results:", timeline.finalState);

    return timeline;
  }

  /**
   * Test specific example using existing ExampleSystem
   */
  async function testExample(exampleKey) {
    logInfo(`🧪 Testing specific example: ${exampleKey}`);

    if (!window.ExampleSystem?.isReady()) {
      logWarn("ExampleSystem not ready");
      return {
        example: exampleKey,
        mathElements: 0,
        annotations: 0,
        percentage: "0",
        success: false,
        error: "ExampleSystem not ready",
      };
    }

    const availableKeys = window.ExampleSystem.getExampleKeys();
    if (!availableKeys.includes(exampleKey)) {
      logWarn(`Example ${exampleKey} not found. Available:`, availableKeys);
      return {
        example: exampleKey,
        mathElements: 0,
        annotations: 0,
        percentage: "0",
        success: false,
        error: `Example not found. Available: ${availableKeys
          .slice(0, 5)
          .join(", ")}`,
      };
    }

    try {
      // Use the existing ExampleSystem's loadExample method
      logInfo(`Loading example ${exampleKey} using ExampleSystem...`);
      const loadSuccess = await window.ExampleSystem.loadExample(exampleKey);

      if (!loadSuccess) {
        throw new Error("ExampleSystem.loadExample returned false");
      }

      // Wait a bit longer for the enhanced annotation system to complete
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check results
      const mathElements = document.querySelectorAll("mjx-container").length;
      const annotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;
      const percentage =
        mathElements > 0
          ? ((annotations / mathElements) * 100).toFixed(1)
          : "0";

      logInfo(
        `Results for ${exampleKey}: ${annotations}/${mathElements} (${percentage}%)`
      );

      return {
        example: exampleKey,
        mathElements,
        annotations,
        percentage,
        success: annotations > 0,
        loadSuccess,
      };
    } catch (error) {
      logWarn(`❌ Error testing ${exampleKey}:`, error.message);
      return {
        example: exampleKey,
        mathElements: 0,
        annotations: 0,
        percentage: "0",
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Compare different loading methods using existing ExampleSystem
   */
  async function compareMethods() {
    logInfo("🔬 Comparing different loading methods...");

    if (!window.ExampleSystem?.isReady()) {
      return { error: "ExampleSystem not ready" };
    }

    const availableKeys = window.ExampleSystem.getExampleKeys();
    const testKey =
      availableKeys.find((key) =>
        ["statistics", "equations", "calculus", "basic-math"].includes(key)
      ) || availableKeys[0];

    if (!testKey) {
      return { error: "No suitable test example found" };
    }

    const methods = {
      standard: "Standard ExampleSystem.loadExample()",
      withDelay: "ExampleSystem.loadExample() with extra delay",
      viaDropdown: "Via dropdown selection change event",
    };

    const results = {};

    for (const [methodName, description] of Object.entries(methods)) {
      logInfo(`Testing method: ${methodName} with example: ${testKey}`);

      try {
        if (methodName === "standard") {
          // Standard ExampleSystem loading
          await window.ExampleSystem.loadExample(testKey);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else if (methodName === "withDelay") {
          // Loading with extra delay for annotation processing
          await window.ExampleSystem.loadExample(testKey);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else if (methodName === "viaDropdown") {
          // Simulate dropdown selection
          const dropdown = document.getElementById("example-select");
          if (dropdown) {
            dropdown.value = testKey;
            dropdown.dispatchEvent(new Event("change", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 2500));
          } else {
            throw new Error("Dropdown not found");
          }
        }

        // Check results
        const mathElements = document.querySelectorAll("mjx-container").length;
        const annotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;
        const percentage =
          mathElements > 0
            ? ((annotations / mathElements) * 100).toFixed(1)
            : "0";

        results[methodName] = {
          method: description,
          testExample: testKey,
          mathElements,
          annotations,
          percentage,
          success: annotations > 0,
        };

        logInfo(
          `${methodName} results: ${annotations}/${mathElements} (${percentage}%)`
        );
      } catch (error) {
        results[methodName] = {
          method: description,
          testExample: testKey,
          mathElements: 0,
          annotations: 0,
          percentage: "0",
          success: false,
          error: error.message,
        };

        logWarn(`${methodName} failed:`, error.message);
      }

      // Wait between methods to avoid interference
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logInfo("📊 Method comparison complete:", results);
    return results;
  }

  /**
   * Test example system health
   */
  function checkExampleSystemHealth() {
    const health = {
      exampleSystemReady: !!window.ExampleSystem?.isReady(),
      availableExamples: 0,
      hasRequiredExamples: false,
      domElementsPresent: {
        dropdown: !!document.getElementById("example-select"),
        randomButton: !!document.getElementById("random-example-btn"),
      },
      conversionEngineReady: !!window.ConversionEngine?.convertInput,
    };

    if (health.exampleSystemReady) {
      const keys = window.ExampleSystem.getExampleKeys();
      health.availableExamples = keys.length;
      health.exampleKeys = keys.slice(0, 10); // First 10 for reference
      health.hasRequiredExamples = keys.some((key) =>
        ["equations", "statistics", "calculus", "basic-math"].includes(key)
      );
    }

    health.overallHealth =
      health.exampleSystemReady &&
      health.availableExamples > 0 &&
      health.domElementsPresent.dropdown &&
      health.conversionEngineReady;

    logInfo("🏥 Example System Health Check:", health);
    return health;
  }

  return {
    testCurrent,
    testExample,
    compareMethods,
    checkExampleSystemHealth,
  };
})();
// ===========================================================================================
// ANNOTATION DEBUG SYSTEM
// ===========================================================================================

// Annotation Debug System
window.annotationDebug = (function () {
  "use strict";

  function logInfo(message, ...args) {
    console.log("[ANNOTATION-DEBUG]", message, ...args);
  }

  function logWarn(message, ...args) {
    console.warn("[ANNOTATION-DEBUG]", message, ...args);
  }

  /**
   * Check current annotation state with detailed analysis
   */
  function check() {
    logInfo("🔍 Checking annotation state...");

    const mathElements = document.querySelectorAll("mjx-container");
    const annotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    );

    const analysis = {
      timestamp: new Date().toISOString(),
      mathElements: mathElements.length,
      annotations: annotations.length,
      percentage:
        mathElements.length > 0
          ? ((annotations.length / mathElements.length) * 100).toFixed(1)
          : "0",
      status: annotations.length > 0 ? "✅ WORKING" : "❌ FAILING",
      details: {
        mathElementsWithAnnotations: 0,
        mathElementsWithoutAnnotations: 0,
        annotationSources: [],
        mathJaxState: !!window.MathJax,
        injectionFunctionExists: !!window.injectMathJaxAnnotations,
        conversionEngineReady: !!window.ConversionEngine?.convertInput,
        exampleSystemReady: !!window.ExampleSystem?.isReady(),
      },
    };

    // Detailed analysis of each math element
    mathElements.forEach((mathEl, index) => {
      const hasAnnotation = mathEl.querySelector(
        'annotation[encoding="application/x-tex"]'
      );
      if (hasAnnotation) {
        analysis.details.mathElementsWithAnnotations++;
        const source = hasAnnotation.textContent;
        if (source && analysis.details.annotationSources.length < 5) {
          analysis.details.annotationSources.push({
            index,
            source: source.substring(0, 50) + (source.length > 50 ? "..." : ""),
            element: mathEl.tagName,
          });
        }
      } else {
        analysis.details.mathElementsWithoutAnnotations++;
      }
    });

    // Check for any problematic patterns
    analysis.details.issues = [];

    if (mathElements.length > 0 && annotations.length === 0) {
      analysis.details.issues.push(
        "Math content present but no annotations found"
      );
    }

    if (analysis.details.mathElementsWithoutAnnotations > 0) {
      analysis.details.issues.push(
        `${analysis.details.mathElementsWithoutAnnotations} math elements missing annotations`
      );
    }

    if (!analysis.details.mathJaxState) {
      analysis.details.issues.push("MathJax not loaded");
    }

    if (!analysis.details.injectionFunctionExists) {
      analysis.details.issues.push("Annotation injection function not found");
    }

    logInfo("📊 Annotation Analysis:");
    logInfo(`  Math elements: ${analysis.mathElements}`);
    logInfo(`  Annotations: ${analysis.annotations} (${analysis.percentage}%)`);
    logInfo(`  Status: ${analysis.status}`);
    logInfo(
      `  With annotations: ${analysis.details.mathElementsWithAnnotations}`
    );
    logInfo(
      `  Without annotations: ${analysis.details.mathElementsWithoutAnnotations}`
    );

    if (analysis.details.issues.length > 0) {
      logWarn(`  Issues found: ${analysis.details.issues.length}`);
      analysis.details.issues.forEach((issue) => logWarn(`    - ${issue}`));
    }

    if (analysis.details.annotationSources.length > 0) {
      logInfo("  Sample sources:");
      analysis.details.annotationSources.forEach((source) =>
        logInfo(`    [${source.index}]: ${source.source}`)
      );
    }

    return analysis;
  }

  /**
   * Monitor annotation changes over time
   */
  async function monitorAnnotations(durationMs = 5000) {
    logInfo(`🕐 Monitoring annotations for ${durationMs}ms...`);

    const monitoring = {
      startTime: Date.now(),
      snapshots: [],
      changes: [],
    };

    const takeSnapshot = () => {
      const mathElements = document.querySelectorAll("mjx-container").length;
      const annotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;
      const timestamp = Date.now() - monitoring.startTime;

      const snapshot = {
        timestamp,
        mathElements,
        annotations,
        percentage:
          mathElements > 0
            ? ((annotations / mathElements) * 100).toFixed(1)
            : "0",
      };

      monitoring.snapshots.push(snapshot);

      // Detect changes
      if (monitoring.snapshots.length > 1) {
        const prev = monitoring.snapshots[monitoring.snapshots.length - 2];
        const curr = snapshot;

        if (
          prev.mathElements !== curr.mathElements ||
          prev.annotations !== curr.annotations
        ) {
          monitoring.changes.push({
            timestamp,
            mathChange: curr.mathElements - prev.mathElements,
            annotationChange: curr.annotations - prev.annotations,
            from: `${prev.annotations}/${prev.mathElements}`,
            to: `${curr.annotations}/${curr.mathElements}`,
          });

          logInfo(
            `📈 Change detected at ${timestamp}ms: ${prev.annotations}/${prev.mathElements} → ${curr.annotations}/${curr.mathElements}`
          );
        }
      }

      return snapshot;
    };

    // Take initial snapshot
    takeSnapshot();

    // Monitor at intervals
    const monitorInterval = setInterval(takeSnapshot, 200);

    // Stop after duration
    setTimeout(() => {
      clearInterval(monitorInterval);

      const finalSnapshot = takeSnapshot();

      logInfo("📊 Monitoring complete:");
      logInfo(`  Duration: ${durationMs}ms`);
      logInfo(`  Snapshots: ${monitoring.snapshots.length}`);
      logInfo(`  Changes detected: ${monitoring.changes.length}`);
      logInfo(
        `  Final state: ${finalSnapshot.annotations}/${finalSnapshot.mathElements} (${finalSnapshot.percentage}%)`
      );

      monitoring.summary = {
        duration: durationMs,
        totalSnapshots: monitoring.snapshots.length,
        totalChanges: monitoring.changes.length,
        finalState: finalSnapshot,
        successful: finalSnapshot.annotations > 0,
      };
    }, durationMs);

    // Return promise that resolves when monitoring is complete
    return new Promise((resolve) => {
      setTimeout(() => resolve(monitoring), durationMs + 100);
    });
  }

  return {
    check,
    monitorAnnotations,
  };
})();

// Enhanced checkAnnotationQuality function
window.checkAnnotationQuality = function () {
  return window.annotationDebug.check();
};
