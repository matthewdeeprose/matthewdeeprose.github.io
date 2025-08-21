// app-state-manager.js
// Application State Management and Coordination Module
// Main coordinator for Enhanced Pandoc-WASM Mathematical Playground
// FIXED: Initialization order to eliminate StatusManager warnings

const AppStateManager = (function () {
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
      console.error("[APP-STATE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[APP-STATE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[APP-STATE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[APP-STATE]", message, ...args);
  }

  // ===========================================================================================
  // APPLICATION STATE MANAGEMENT IMPLEMENTATION
  // ===========================================================================================

  /**
   * Application State Manager Class
   * Coordinates all modules and manages application lifecycle
   */
  class ApplicationStateManager {
    constructor() {
      this.pandocFunction = null;
      this.isReady = false;
      this.isInitialised = false;
      this.initializationPhase = "not-started";
      this.moduleStates = new Map();
      this.requiredModules = [
        "AppConfig",
        "StatusManager",
        "ExampleSystem",
        "ConversionEngine",
        "EventManager",
        "MathJaxManager",
        "LaTeXProcessor",
        "ContentGenerator",
        "TemplateSystem",
        "ExportManager",
        "AppStateManager", // FIXED: Include self (brings count to 11)
      ];

      // Optional development modules (tracked but not required)
      this.optionalModules = [
        "LayoutDebugger",
        "TestCommands",
        "LiveLaTeXEditor",
      ];
    }

    /**
     * Initialise the entire application
     */
    async initialise() {
      logInfo("=== ENHANCED PANDOC-WASM MATHEMATICAL PLAYGROUND STARTING ===");
      this.initializationPhase = "starting";

      try {
        // Phase 1: Validate module dependencies
        if (!this.validateModuleDependencies()) {
          throw new Error("Required modules not available");
        }

        // Phase 2: Initialize core modules (FIXED: StatusManager first)
        await this.initializeCoreModules();

        // Phase 3: Initialize Pandoc WebAssembly
        await this.initializePandoc();

        // Phase 4: Setup integrations and final configuration
        await this.setupIntegrations();

        // Phase 5: Mark application as ready
        this.finalizeInitialization();

        logInfo("=== APPLICATION INITIALIZATION COMPLETE ===");
        return true;
      } catch (error) {
        logError("Application initialization failed:", error);
        this.initializationPhase = "failed";

        if (window.StatusManager) {
          window.StatusManager.showError("ERROR_INIT", error);
        }

        return false;
      }
    }

    /**
     * FIXED: Enhanced module validation including optional modules
     */
    validateModuleDependencies() {
      logInfo("Validating module dependencies...");

      const missingModules = [];

      // Check required modules
      this.requiredModules.forEach((moduleName) => {
        if (window[moduleName]) {
          this.moduleStates.set(moduleName, "available");
          logDebug(`✅ ${moduleName}: Available`);
        } else {
          this.moduleStates.set(moduleName, "missing");
          missingModules.push(moduleName);
          logError(`❌ ${moduleName}: Missing`);
        }
      });

      // FIXED: Also track optional modules (don't fail if missing)
      this.optionalModules.forEach((moduleName) => {
        if (window[moduleName]) {
          this.moduleStates.set(moduleName, "available");
          logDebug(`✅ ${moduleName}: Available (optional)`);
        } else {
          this.moduleStates.set(moduleName, "not-available");
          logDebug(`ℹ️ ${moduleName}: Not available (optional)`);
        }
      });

      if (missingModules.length > 0) {
        logError(`Missing required modules: ${missingModules.join(", ")}`);
        return false;
      }

      logInfo("✅ All module dependencies validated");
      return true;
    }

    /**
     * FIXED: Initialize core application modules with StatusManager first
     * This eliminates the circular dependency warnings
     */
    async initializeCoreModules() {
      logInfo("Initializing core modules...");
      this.initializationPhase = "core-modules";

      // FIXED: StatusManager first - other modules depend on it for status updates
      const initSequence = [
        {
          name: "StatusManager",
          action: () => window.StatusManager.initialise(),
          progress: 10,
          skipStatusUpdate: true, // Don't update status before StatusManager is ready
        },
        {
          name: "AppConfig",
          action: () => window.AppConfig.initialise(),
          progress: 20,
        },
        {
          name: "ExampleSystem",
          action: () => window.ExampleSystem.initialise(),
          progress: 30,
        },
        {
          name: "ConversionEngine",
          action: () => window.ConversionEngine.initialise(),
          progress: 40,
        },
        {
          name: "EventManager",
          action: () => window.EventManager.initialise(),
          progress: 50,
        },
      ];

      for (const module of initSequence) {
        try {
          // Only update status if StatusManager is available and initialized
          if (!module.skipStatusUpdate && window.StatusManager) {
            window.StatusManager.setLoading(
              `Initialising ${module.name}...`,
              module.progress
            );
          }

          logInfo(`Initialising ${module.name}...`);
          const success = await module.action();

          if (success) {
            this.moduleStates.set(module.name, "initialized");
            logInfo(`✅ ${module.name} initialised successfully`);
          } else {
            throw new Error(`${module.name} initialisation returned false`);
          }
        } catch (error) {
          logError(`Failed to initialise ${module.name}:`, error);
          this.moduleStates.set(module.name, "failed");
          throw new Error(`Core module initialisation failed: ${module.name}`);
        }
      }

      logInfo("✅ Core modules initialisation complete");
    }

    /**
     * Initialize Pandoc WebAssembly with enhanced progress feedback
     */
    async initializePandoc() {
      logInfo("Initializing Pandoc WebAssembly...");
      this.initializationPhase = "pandoc-wasm";

      try {
        // Import WebAssembly shim components
        if (window.StatusManager) {
          window.StatusManager.updateInitialisationStatus("INIT_WASI", 55);
        }

        const { WASI, OpenFile, File, ConsoleStdout, PreopenDirectory } =
          await import(
            "https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.3.0/dist/index.js"
          );

        // Setup WASI environment
        if (window.StatusManager) {
          window.StatusManager.updateInitialisationStatus("INIT_DOWNLOAD", 60);
        }

        const args = ["pandoc.wasm", "+RTS", "-H64m", "-RTS"];
        const env = [];
        const in_file = new File(new Uint8Array(), { readonly: true });
        const out_file = new File(new Uint8Array(), { readonly: false });
        const fds = [
          new OpenFile(new File(new Uint8Array(), { readonly: true })),
          ConsoleStdout.lineBuffered((msg) => logInfo(`[WASI stdout] ${msg}`)),
          ConsoleStdout.lineBuffered((msg) => logWarn(`[WASI stderr] ${msg}`)),
          new PreopenDirectory("/", [
            ["in", in_file],
            ["out", out_file],
          ]),
        ];
        const options = { debug: false };
        const wasi = new WASI(args, env, fds, options);

        // Download and instantiate Pandoc WebAssembly
        if (window.StatusManager) {
          window.StatusManager.updateInitialisationStatus("INIT_RUNTIME", 70);
        }

        const { instance } = await WebAssembly.instantiateStreaming(
          fetch("wasm/pandoc.wasm"),
          {
            wasi_snapshot_preview1: wasi.wasiImport,
          }
        );

        // Initialize WebAssembly instance
        if (window.StatusManager) {
          window.StatusManager.updateInitialisationStatus("INIT_MEMORY", 80);
        }

        wasi.initialize(instance);
        instance.exports.__wasm_call_ctors();

        // Setup memory management
        function memory_data_view() {
          return new DataView(instance.exports.memory.buffer);
        }

        if (window.StatusManager) {
          window.StatusManager.updateInitialisationStatus("INIT_PANDOC", 90);
        }

        // Configure Pandoc arguments
        const argc_ptr = instance.exports.malloc(4);
        memory_data_view().setUint32(argc_ptr, args.length, true);
        const argv = instance.exports.malloc(4 * (args.length + 1));

        for (let i = 0; i < args.length; ++i) {
          const arg = instance.exports.malloc(args[i].length + 1);
          new TextEncoder().encodeInto(
            args[i],
            new Uint8Array(instance.exports.memory.buffer, arg, args[i].length)
          );
          memory_data_view().setUint8(arg + args[i].length, 0);
          memory_data_view().setUint32(argv + 4 * i, arg, true);
        }
        memory_data_view().setUint32(argv + 4 * args.length, 0, true);
        const argv_ptr = instance.exports.malloc(4);
        memory_data_view().setUint32(argv_ptr, argv, true);

        // Initialize Haskell runtime
        instance.exports.hs_init_with_rtsopts(argc_ptr, argv_ptr);

        // Create pandoc function
        this.pandocFunction = function (args_str, in_str) {
          const args_ptr = instance.exports.malloc(args_str.length);
          new TextEncoder().encodeInto(
            args_str,
            new Uint8Array(
              instance.exports.memory.buffer,
              args_ptr,
              args_str.length
            )
          );
          in_file.data = new TextEncoder().encode(in_str);
          instance.exports.wasm_main(args_ptr, args_str.length);
          return new TextDecoder("utf-8", { fatal: true }).decode(
            out_file.data
          );
        };

        // Make pandoc function globally available
        window.pandocFunction = this.pandocFunction;

        if (window.StatusManager) {
          window.StatusManager.updateInitialisationStatus("INIT_FINALISE", 95);
        }

        logInfo("✅ Pandoc WebAssembly initialised successfully");
      } catch (error) {
        logError("Failed to initialise Pandoc WebAssembly:", error);
        throw new Error(`Pandoc initialisation failed: ${error.message}`);
      }
    }

    /**
     * Setup integrations between modules
     */
    async setupIntegrations() {
      logInfo("Setting up module integrations...");
      this.initializationPhase = "integrations";

      try {
        // Connect ConversionEngine with Pandoc function
        if (window.ConversionEngine && this.pandocFunction) {
          window.ConversionEngine.setPandocFunction(this.pandocFunction);
          logInfo("✅ ConversionEngine connected to Pandoc function");
        }

        // Setup dynamic MathJax manager if available
        if (window.MathJaxManager) {
          setTimeout(() => {
            window.dynamicMathJaxManager =
              window.MathJaxManager.createManager();
            logInfo("✅ Dynamic MathJax Manager instance created");
          }, 200);
        }

        // Load default example if ExampleSystem is ready
        if (window.ExampleSystem && window.ExampleSystem.isReady()) {
          setTimeout(() => {
            window.ExampleSystem.loadDefaultExample();
            logInfo("✅ Default example loaded");
          }, 300);
        }

        // Enable export buttons
        const exportButton =
          window.appElements?.exportButton ||
          document.getElementById("exportButton");
        if (exportButton) {
          exportButton.disabled = false;
          logInfo("✅ Export button enabled");
        }

        // Enable SCORM export button
        const scormExportButton = document.getElementById("exportSCORMButton");
        if (scormExportButton) {
          scormExportButton.disabled = false;
          logInfo("✅ SCORM export button enabled");
        }

        // Initialize Live LaTeX Editor if available - CONTENTEDITABLE VERSION
        if (window.LiveLaTeXEditor && window.initLiveHighlighting) {
          try {
            // Initialize Live LaTeX Editor first (before examples load)
            setTimeout(async () => {
              const textarea = document.getElementById("input");
              if (textarea) {
                logInfo("Initializing Live LaTeX Editor (contenteditable)...");
                const success = await window.initLiveHighlighting();
                if (success) {
                  logInfo("✅ Live LaTeX Editor initialized successfully");

                  // FIXED: Re-sync after example system loads default content
                  setTimeout(() => {
                    if (
                      window.liveLaTeXEditor &&
                      window.liveLaTeXEditor.isEnabled
                    ) {
                      // FIXED: Use correct method name for contenteditable implementation
                      window.liveLaTeXEditor.updateHighlighting();
                      logInfo(
                        "✅ Live LaTeX Editor re-synced after example loading"
                      );
                    }
                  }, 400); // Re-sync 400ms after init (100ms after example loads at 300ms)
                } else {
                  logWarn("⚠️ Live LaTeX Editor initialization returned false");
                }
              } else {
                logWarn(
                  "⚠️ LaTeX input textarea not found for Live LaTeX Editor"
                );
              }
            }, 200); // FIXED: Initialize earlier (200ms instead of 500ms)
          } catch (error) {
            logWarn(
              "⚠️ Live LaTeX Editor initialization failed:",
              error.message
            );
            // Don't throw - this is optional functionality
          }
        } else {
          logDebug("ℹ️ Live LaTeX Editor not available (optional feature)");
        }

        logInfo("✅ Module integrations setup complete");
      } catch (error) {
        logError("Error setting up integrations:", error);
        throw error;
      }
    }

    /**
     * Finalize initialization and mark application as ready
     */
    finalizeInitialization() {
      logInfo("Finalising application initialisation...");
      this.initializationPhase = "finalizing";

      try {
        // Mark application as ready
        this.isReady = true;
        this.isInitialised = true;
        this.initializationPhase = "complete";
        // FIXED: Mark AppStateManager itself as initialized
        this.moduleStates.set("AppStateManager", "initialized");

        // Update AppConfig state if available
        if (window.AppConfig && window.AppConfig.AppState) {
          window.AppConfig.AppState.set("isReady", true);
        }

        // Set final status
        if (window.StatusManager) {
          window.StatusManager.setReady();
        }

        // Announce completion
        logInfo("🎉 Enhanced Pandoc-WASM Mathematical Playground ready!");
        logInfo(
          "Features: LaTeX conversion, MathJax rendering, accessibility controls, offline export"
        );

        this.initializationPhase = "ready";
      } catch (error) {
        logError("Error finalising initialisation:", error);
        throw error;
      }
    }

    /**
     * FIXED: Enhanced status reporting with all tracked modules
     */
    getApplicationStatus() {
      const moduleStatuses = {};

      // FIXED: Include both required and optional modules in status
      const allModules = [...this.requiredModules, ...this.optionalModules];

      allModules.forEach((moduleName) => {
        moduleStatuses[moduleName] = {
          available: !!window[moduleName],
          state: this.moduleStates.get(moduleName) || "unknown",
          required: this.requiredModules.includes(moduleName),
        };
      });

      return {
        initialized: this.isInitialised,
        ready: this.isReady,
        phase: this.initializationPhase,
        pandocAvailable: !!this.pandocFunction,
        modules: moduleStatuses,
        timestamp: new Date().toISOString(),
      };
    }

    /**
     * Restart application (for development/testing)
     */
    async restart() {
      logInfo("Restarting application...");

      try {
        // Reset state
        this.isReady = false;
        this.isInitialised = false;
        this.initializationPhase = "restarting";
        this.moduleStates.clear();

        // Reset status
        if (window.StatusManager) {
          window.StatusManager.reset();
        }

        // Re-initialize
        await this.initialise();

        logInfo("✅ Application restart complete");
        return true;
      } catch (error) {
        logError("Application restart failed:", error);
        return false;
      }
    }

    /**
     * Shutdown application gracefully
     */
    shutdown() {
      logInfo("Shutting down application...");

      try {
        // Cleanup event manager
        if (window.EventManager) {
          window.EventManager.cleanup();
        }

        // Reset state
        this.isReady = false;
        this.isInitialised = false;
        this.initializationPhase = "shutdown";
        this.pandocFunction = null;

        logInfo("✅ Application shutdown complete");
      } catch (error) {
        logError("Error during application shutdown:", error);
      }
    }
  }

  // ===========================================================================================
  // APPLICATION INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const appStateManager = new ApplicationStateManager();

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Test application state management functionality
   */
  function testAppStateManager() {
    logInfo("🧪 Testing Application State Manager...");

    const tests = {
      managerExists: () => !!appStateManager,

      initialisation: () => appStateManager.isInitialised,

      applicationReady: () => appStateManager.isReady,

      pandocFunction: () => !!appStateManager.pandocFunction,

      moduleValidation: () => {
        const status = appStateManager.getApplicationStatus();
        return status.modules && Object.keys(status.modules).length > 0;
      },

      statusRetrieval: () => {
        const status = appStateManager.getApplicationStatus();
        return status && typeof status.ready === "boolean";
      },

      phaseTracking: () => {
        const status = appStateManager.getApplicationStatus();
        return status.phase && typeof status.phase === "string";
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
    logInfo(`📊 Application State Manager: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      status: appStateManager.getApplicationStatus(),
    };
  }

  // ===========================================================================================
  // AUTO-INITIALIZATION
  // ===========================================================================================

  /**
   * Auto-initialize when DOM is ready
   */
  function autoInitialize() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => appStateManager.initialise(), 100);
      });
    } else {
      setTimeout(() => appStateManager.initialise(), 100);
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main manager instance
    manager: appStateManager,

    // Core functionality
    initialise() {
      return appStateManager.initialise();
    },

    restart() {
      return appStateManager.restart();
    },

    shutdown() {
      return appStateManager.shutdown();
    },

    // Status
    getApplicationStatus() {
      return appStateManager.getApplicationStatus();
    },

    isReady() {
      return appStateManager.isReady;
    },

    isInitialised() {
      return appStateManager.isInitialised;
    },

    // Pandoc access
    getPandocFunction() {
      return appStateManager.pandocFunction;
    },

    // Auto-initialization
    autoInitialize,

    // Testing
    testAppStateManager,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.AppStateManager = AppStateManager;

// Auto-initialize the application
AppStateManager.autoInitialize();
