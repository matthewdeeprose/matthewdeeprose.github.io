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
     * Update dropdown options with loaded examples
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

      // Add options for each example
      this.exampleKeys.forEach((key) => {
        const option = document.createElement("option");
        option.value = key;

        // Create friendly display names
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

        option.textContent =
          displayNames[key] ||
          key.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

        this.exampleSelect.appendChild(option);
      });

      logInfo(`✅ Dropdown updated with ${this.exampleKeys.length} examples`);
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
     * Load a specific example by key
     */
    loadExample(exampleKey) {
      logInfo(`Loading example: ${exampleKey}`);

      if (!this.allExamples[exampleKey]) {
        logError(`Example not found: ${exampleKey}`);
        return false;
      }

      try {
        // Get input textarea (should be available globally)
        const inputTextarea =
          window.appElements?.inputTextarea || document.getElementById("input");

        if (!inputTextarea) {
          throw new Error("Input textarea not found");
        }

        // Load example content
        inputTextarea.value = this.allExamples[exampleKey];

        // Focus input for accessibility without scrolling
        inputTextarea.focus({ preventScroll: true });

        // Trigger conversion if available
        if (window.ConversionEngine && window.ConversionEngine.convertInput) {
          window.ConversionEngine.convertInput();
        } else {
          logWarn("ConversionEngine not available for automatic conversion");
        }

        logInfo(`✅ Example loaded successfully: ${exampleKey}`);
        return true;
      } catch (error) {
        logError("Error loading example:", error);
        return false;
      }
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

      logInfo("Loading default example...");

      // Try to load 'equations' first, then first available example
      const defaultKey = this.exampleKeys.includes("equations")
        ? "equations"
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
