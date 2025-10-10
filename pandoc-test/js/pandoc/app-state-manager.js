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
      // 🔧 MEMORY MANAGEMENT: Track polling timeouts for cleanup
      this.pollingTimeouts = new Set();

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
     * Pre-load fonts during initialization to prevent export delays
     */
    async preloadFonts() {
      logInfo("🎨 Pre-loading fonts for export readiness...");

      try {
        if (window.TemplateSystem) {
          const generator = window.TemplateSystem.createGenerator();
          await generator.generateEmbeddedFontsCSS();
          logInfo("✅ Fonts pre-loaded successfully");
        } else {
          logWarn("⚠️ TemplateSystem not available for font pre-loading");
        }
      } catch (error) {
        logWarn(
          "⚠️ Font pre-loading failed (will retry on export):",
          error.message
        );
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

            // 🎯 CRITICAL FIX: Ensure automatic conversions are enabled after default example loading
            // This addresses the issue where the flag gets stuck during initialization
            setTimeout(() => {
              if (window.ConversionEngine) {
                logInfo(
                  "🔧 Post-initialization: Ensuring automatic conversions are enabled..."
                );

                // Force reset the flag using all available methods
                window.ConversionEngine.automaticConversionsDisabled = false;

                if (window.ConversionEngine.manager) {
                  window.ConversionEngine.manager.automaticConversionsDisabled = false;
                  // If using fallback state management
                  if (
                    window.ConversionEngine.manager
                      ._automaticConversionsDisabled !== undefined
                  ) {
                    window.ConversionEngine.manager._automaticConversionsDisabled = false;
                  }
                }

                // Use StateManager if available
                if (
                  window.StateManager &&
                  typeof window.StateManager.updateConfiguration === "function"
                ) {
                  window.StateManager.updateConfiguration({
                    automaticConversionsDisabled: false,
                  });
                }

                // Invalidate any cached values
                if (
                  window.ConversionEngine.invalidateAutomaticConversionsCache
                ) {
                  window.ConversionEngine.invalidateAutomaticConversionsCache();
                }

                // Force cache invalidation on the manager if available
                if (
                  window.ConversionEngine.manager &&
                  typeof window.ConversionEngine.manager
                    ._invalidateStatusCache === "function"
                ) {
                  window.ConversionEngine.manager._invalidateStatusCache();
                }

                logInfo(
                  "✅ Post-initialization: Automatic conversions restoration complete"
                );

                // Verify the fix worked
                const finalState =
                  window.ConversionEngine.automaticConversionsDisabled;
                if (finalState) {
                  logWarn(
                    `⚠️ Post-initialization restoration failed: automaticConversionsDisabled is still ${finalState}`
                  );
                } else {
                  logInfo(
                    `✅ Post-initialization verification: automaticConversionsDisabled = ${finalState}`
                  );
                }
              }
            }, 500); // Extra delay to ensure all systems are fully initialized
          }, 300);
        }

        // ✅ ENHANCED: DO NOT enable export buttons immediately
        // Wait for complete MathJax rendering and annotation injection instead
        logInfo(
          "🔄 Export buttons will be enabled after MathJax rendering completes"
        );

        // Set up MathJax completion monitoring system
        this.setupMathJaxCompletionMonitoring();

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

        // 🎨 NEW: Pre-load fonts for export readiness
        // This prevents timeout errors on first export attempt
        await this.preloadFonts();

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
     * ✅ NEW: Monitor MathJax completion and enable buttons when ready
     * This ensures buttons are only enabled after complete rendering pipeline
     */
    setupMathJaxCompletionMonitoring() {
      logInfo("🔄 Setting up MathJax completion monitoring system...");

      // Store button references for later enablement
      this.exportButton =
        window.appElements?.exportButton ||
        document.getElementById("exportButton");
      this.scormExportButton = document.getElementById("exportSCORMButton");

      // Enhanced completion detection system
      const enableButtonsWhenReady = () => {
        logInfo("🧪 Checking MathJax and annotation injection completion...");

        // Check if MathJax is ready and has finished initial rendering
        if (
          !window.MathJax ||
          !window.MathJax.startup ||
          !window.MathJax.startup.document
        ) {
          logDebug("⏳ MathJax not fully ready yet, waiting...");
          return false;
        }

        // Check if annotation injection system is available
        if (
          !window.injectMathJaxAnnotations ||
          !window.triggerAnnotationInjection
        ) {
          logDebug("⏳ Annotation injection system not ready yet, waiting...");
          return false;
        }

        // ✅ ENHANCED: Check for any active conversions (including chunked processing)
        if (
          window.ConversionEngine &&
          window.ConversionEngine.conversionInProgress
        ) {
          logDebug("⏳ Conversion still in progress, waiting...");
          return false;
        }

        // ✅ ENHANCED: Check if StatusManager shows loading state
        if (window.StatusManager) {
          const currentStatus = window.StatusManager.getCurrentStatus();
          if (currentStatus && currentStatus.state === "loading") {
            logDebug(
              `⏳ Status still loading: ${currentStatus.message}, waiting...`
            );
            return false;
          }
        }

        // ✅ ENHANCED: Check for active chunked processing
        if (
          window.ConversionEngine &&
          window.ConversionEngine.isProcessingChunks
        ) {
          logDebug("⏳ Chunked processing still active, waiting...");
          return false;
        }

        // ✅ ENHANCED: Check if we have content to process
        const currentInput = window.ConversionEngine?.getCurrentInput?.() || "";
        const hasContent = currentInput.trim().length > 0;

        // ✅ ENHANCED: Handle empty documents vs documents with content
        const mathElements = document.querySelectorAll("mjx-container");

        if (hasContent && mathElements.length === 0) {
          // Content exists but no MathJax elements yet - still processing
          logDebug(
            "⏳ Content exists but no MathJax elements found yet, waiting..."
          );
          return false;
        }

        if (!hasContent && mathElements.length === 0) {
          // No content and no MathJax elements - empty document is complete
          logDebug(
            "✅ Empty document detected - no content to render, marking as complete"
          );
          this.enableExportButtons("Empty document ready for export");
          return true;
        }

        // ✅ ENHANCED: For documents with content, ensure annotation injection completed
        if (hasContent && mathElements.length > 0) {
          const annotatedElements = document.querySelectorAll(
            'annotation[encoding="application/x-tex"]'
          );
          if (annotatedElements.length === 0) {
            logDebug(
              "⏳ Content has MathJax but annotations not yet injected, waiting..."
            );
            return false;
          }
        }

        // All systems ready - enable buttons using our enhanced method
        const message = hasContent
          ? "Complete rendering pipeline finished"
          : "Empty document ready";
        this.enableExportButtons(message);
        return true;
      };

      // Approach 1: Hook into MathJax completion events
      if (
        window.MathJax &&
        window.MathJax.startup &&
        window.MathJax.startup.promise
      ) {
        window.MathJax.startup.promise.then(() => {
          logInfo(
            "🔗 MathJax startup completed, setting up completion monitoring..."
          );

          // Hook into MathJax typesetPromise to detect completion
          const originalTypesetPromise = window.MathJax.typesetPromise;
          if (originalTypesetPromise) {
            window.MathJax.typesetPromise = function (...args) {
              return originalTypesetPromise.apply(this, args).then((result) => {
                // Wait a bit for annotation injection to complete
                setTimeout(() => {
                  enableButtonsWhenReady();
                }, 500);
                return result;
              });
            };
            logInfo("✅ MathJax completion hook installed");
          }
        });
      }

      // Approach 2: BOUNDED polling backup system (prevents memory leaks)
      let pollAttempts = 0;
      const maxPollAttempts = 20; // Maximum 10 seconds of polling

      const pollForCompletion = () => {
        pollAttempts++;
        if (pollAttempts > maxPollAttempts) {
          logWarn("⏰ Polling timeout reached - enabling buttons anyway");
          this.enableExportButtons("Timeout - ready for export");
          return;
        }

        if (!enableButtonsWhenReady()) {
          const timeoutId = setTimeout(pollForCompletion, 500);
          // Track timeout for cleanup
          this.pollingTimeouts.add(timeoutId);

          // Clean up completed timeout from tracking after it executes
          setTimeout(() => {
            this.pollingTimeouts.delete(timeoutId);
          }, 501);
        }
      };

      // Start polling after initial setup delay
      const initialTimeoutId = setTimeout(pollForCompletion, 1000);
      this.pollingTimeouts.add(initialTimeoutId);

      // Approach 3: Conversion completion hook
      if (window.ConversionEngine) {
        // Store original renderMathJax method
        const originalRenderMathJax = window.ConversionEngine.renderMathJax;
        if (originalRenderMathJax) {
          window.ConversionEngine.renderMathJax = function () {
            return originalRenderMathJax
              .call(this)
              .then((result) => {
                // Wait for annotation injection after MathJax rendering
                setTimeout(() => {
                  enableButtonsWhenReady();
                }, 300);
                return result;
              })
              .catch((error) => {
                // Enable buttons even if MathJax fails
                logWarn("⚠️ MathJax rendering failed, enabling buttons anyway");
                setTimeout(() => {
                  this.enableExportButtons(
                    "MathJax failed but ready for export"
                  );
                }, 100);
                throw error;
              });
          };
          logInfo("✅ ConversionEngine MathJax completion hook installed");
        }
      }

      logInfo("✅ MathJax completion monitoring system setup complete");

      // Set up change detection hooks to disable buttons during processing
      this.setupChangeDetectionHooks();
    }
    /**
     * ✅ ENHANCED: Control button states and processing overlay with smart messaging
     */
    disableExportButtons(reason = "Processing...", customDetail = null) {
      logInfo(`🔒 Disabling export buttons: ${reason}`);

      if (this.exportButton) {
        this.exportButton.disabled = true;
      }

      if (this.scormExportButton) {
        this.scormExportButton.disabled = true;
      }

      // Determine appropriate detail message if not provided
      let detailMessage = customDetail;
      if (!detailMessage) {
        // Add a small delay to let DOM updates complete before checking content
        setTimeout(() => {
          const currentInput =
            window.ConversionEngine?.getCurrentInput?.() || "";
          const hasContent = currentInput.trim().length > 0;

          logInfo(
            `🔍 DEBUG: Content check - hasContent: ${hasContent}, length: ${currentInput.length}`
          );

          const detail = document.getElementById("processingDetail");
          if (detail) {
            if (!hasContent) {
              detail.textContent =
                "Clearing output and preparing interface. Ready for your input.";
              logInfo("📝 Updated overlay message for empty content");
            } else {
              const hasMath = /\$|\\\[|\\begin\{/.test(currentInput);
              if (hasMath) {
                detail.textContent = "Please wait while we render equations";
              } else {
                detail.textContent = "Please wait while we convert the content";
              }
              logInfo(
                `📝 Updated overlay message for content (hasMath: ${hasMath})`
              );
            }
          }
        }, 50); // Small delay to let DOM update
      }

      // Show processing overlay with initial message
      this.showProcessingOverlay(reason, detailMessage);

      // Update status if available
      if (window.StatusManager) {
        window.StatusManager.showProcessing(reason);
      }
    }

    enableExportButtons(reason = "Ready") {
      logInfo(`🔓 Preparing to enable export buttons: ${reason}`);

      // First update the status and give it time to render
      if (window.StatusManager) {
        window.StatusManager.setReady("Ready! Export buttons enabled.");
      }

      // Hide processing overlay first
      this.hideProcessingOverlay();

      // Small delay to ensure status update renders before enabling buttons
      setTimeout(() => {
        if (this.exportButton) {
          this.exportButton.disabled = false;
          logInfo("✅ Export button enabled after status update");
        }

        if (this.scormExportButton) {
          this.scormExportButton.disabled = false;
          logInfo("✅ SCORM export button enabled after status update");
        }

        logInfo("🎉 All export buttons now enabled and ready for use");
      }, 100); // Small delay to allow DOM update to render
    }

    /**
     * ✅ ENHANCED: Show processing overlay with context-aware messages
     */
    showProcessingOverlay(reason = "Processing...", detailMessage = null) {
      const overlay = document.getElementById("processingOverlay");
      const message = document.getElementById("processingMessage");
      const detail = document.getElementById("processingDetail");

      if (overlay) {
        overlay.style.display = "flex";

        if (message) {
          message.textContent = reason;
        }

        if (detail) {
          // Use custom detail if provided, otherwise determine based on context
          if (detailMessage) {
            detail.textContent = detailMessage;
          } else {
            // Smart detection based on current input content
            const currentInput =
              window.ConversionEngine?.getCurrentInput?.() || "";
            const hasContent = currentInput.trim().length > 0;
            const hasMath =
              hasContent && /\$|\\\[|\\begin\{/.test(currentInput);

            if (!hasContent) {
              detail.textContent = "Please wait while we process the changes";
            } else if (hasMath) {
              detail.textContent = "Please wait while we render equations";
            } else {
              detail.textContent = "Please wait while we convert the content";
            }
          }
        }

        // Announce to screen readers
        if (window.AppConfig && window.AppConfig.announceToScreenReader) {
          const announcement = detailMessage
            ? `${reason}. ${detailMessage}`
            : `Processing started: ${reason}`;
          window.AppConfig.announceToScreenReader(announcement);
        }

        logInfo("☁️ Processing overlay shown");
      }
    }

    /**
     * ✅ NEW: Hide processing overlay
     */
    hideProcessingOverlay() {
      const overlay = document.getElementById("processingOverlay");

      if (overlay) {
        // Smooth fade out
        overlay.style.opacity = "0";

        setTimeout(() => {
          overlay.style.display = "none";
          overlay.style.opacity = "1"; // Reset for next time
        }, 300);

        // Announce to screen readers
        if (window.AppConfig && window.AppConfig.announceToScreenReader) {
          window.AppConfig.announceToScreenReader(
            "Processing complete - content is ready"
          );
        }

        logInfo("☁️ Processing overlay hidden");
      }
    }

    /**
     * ✅ NEW: Set up hooks to detect changes and disable buttons
     */
    setupChangeDetectionHooks() {
      logInfo("🔗 Setting up change detection hooks...");

      // Hook 1: Input textarea changes
      const inputTextarea = document.getElementById("input");
      if (inputTextarea) {
        // Disable buttons immediately on input
        inputTextarea.addEventListener("input", () => {
          this.disableExportButtons("Processing content changes...");
        });

        // Also disable on paste events
        inputTextarea.addEventListener("paste", () => {
          setTimeout(() => {
            this.disableExportButtons("Processing pasted content...");
          }, 10);
        });

        logInfo("✅ Input change detection hook installed");
      }

      // Hook 2: Example loading detection
      if (window.ExampleSystem) {
        // Store original loadExample method
        const originalLoadExample = window.ExampleSystem.loadExample;
        if (originalLoadExample) {
          window.ExampleSystem.loadExample = (...args) => {
            this.disableExportButtons("Loading example...");
            return originalLoadExample.apply(window.ExampleSystem, args);
          };
          logInfo("✅ ExampleSystem hook installed");
        }

        // Hook loadDefaultExample as well
        const originalLoadDefaultExample =
          window.ExampleSystem.loadDefaultExample;
        if (originalLoadDefaultExample) {
          window.ExampleSystem.loadDefaultExample = (...args) => {
            this.disableExportButtons("Loading default example...");
            return originalLoadDefaultExample.apply(window.ExampleSystem, args);
          };
          logInfo("✅ ExampleSystem default example hook installed");
        }
      }

      // Hook 3: Conversion start detection
      if (window.ConversionEngine) {
        // Store original convertInput method
        const originalConvertInput = window.ConversionEngine.convertInput;
        if (originalConvertInput) {
          window.ConversionEngine.convertInput = (...args) => {
            this.disableExportButtons("Converting LaTeX...");
            return originalConvertInput.apply(window.ConversionEngine, args);
          };
          logInfo("✅ ConversionEngine start hook installed");
        }
      }

      logInfo("✅ Change detection hooks setup complete");
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
     * 🧹 MEMORY MANAGEMENT: Cleanup polling timeouts and other resources
     */
    cleanup() {
      logInfo("🧹 Performing app state manager cleanup...");

      // Clear polling timeouts
      if (this.pollingTimeouts) {
        this.pollingTimeouts.forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.pollingTimeouts.clear();
      }

      // Cleanup conversion engine
      if (
        window.ConversionEngine &&
        window.ConversionEngine.manager &&
        window.ConversionEngine.manager.cleanup
      ) {
        window.ConversionEngine.manager.cleanup();
      }

      logInfo("🧹 App state manager cleanup completed");
    }

    /**
     * Shutdown application gracefully
     */
    shutdown() {
      logInfo("Shutting down application...");

      try {
        // Perform cleanup first
        this.cleanup();

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
   * 🎨 Test font pre-loading functionality
   * This verifies fonts are loaded and ready for export
   */
  async function testFontPreLoading() {
    console.log("🧪 Testing Font Pre-Loading System...");
    console.log("=".repeat(60));

    const results = {
      tests: [],
      passed: 0,
      failed: 0,
      warnings: 0,
    };

    // Test 1: Check if TemplateSystem exists
    console.log("\n📋 Test 1: TemplateSystem Availability");
    if (window.TemplateSystem) {
      console.log("✅ TemplateSystem is available");
      results.passed++;
      results.tests.push({ name: "TemplateSystem exists", status: "PASS" });
    } else {
      console.error("❌ TemplateSystem not found");
      results.failed++;
      results.tests.push({ name: "TemplateSystem exists", status: "FAIL" });
      return results;
    }

    // Test 2: Generate font CSS
    console.log("\n🎨 Test 2: Font CSS Generation");
    const startTime = Date.now();
    let fontCSS = "";

    try {
      const generator = window.TemplateSystem.createGenerator();
      fontCSS = await generator.generateEmbeddedFontsCSS();
      const loadTime = Date.now() - startTime;

      console.log(`✅ Font CSS generated in ${loadTime}ms`);
      console.log(`📊 Font CSS length: ${fontCSS.length} characters`);
      results.passed++;
      results.tests.push({
        name: "Font CSS generation",
        status: "PASS",
        time: loadTime,
      });
    } catch (error) {
      console.error("❌ Font CSS generation failed:", error.message);
      results.failed++;
      results.tests.push({ name: "Font CSS generation", status: "FAIL" });
      return results;
    }

    // Test 3: Validate font CSS content
    console.log("\n🔍 Test 3: Font CSS Validation");

    // Check for placeholders (bad)
    const placeholderMatches = fontCSS.match(/YOUR_BASE64_PLACEHOLDER/g);
    const placeholderCount = placeholderMatches ? placeholderMatches.length : 0;

    if (placeholderCount > 0) {
      console.error(
        `❌ Found ${placeholderCount} placeholder(s) - fonts not loaded`
      );
      results.failed++;
      results.tests.push({
        name: "No placeholders",
        status: "FAIL",
        details: `${placeholderCount} placeholders found`,
      });
    } else {
      console.log("✅ No placeholders found");
      results.passed++;
      results.tests.push({ name: "No placeholders", status: "PASS" });
    }

    // Check for real base64 font data (good) - support woff2, woff, truetype, opentype
    const realFontMatches = fontCSS.match(
      /data:font\/[^;]+;[^,]*base64,([A-Za-z0-9+/]{100,})/g
    );
    const realFontCount = realFontMatches ? realFontMatches.length : 0;

    if (realFontCount > 0) {
      console.log(`✅ Found ${realFontCount} real font data section(s)`);
      results.passed++;
      results.tests.push({
        name: "Real font data present",
        status: "PASS",
        details: `${realFontCount} fonts detected`,
      });
    } else {
      console.error("❌ No real font data detected");
      results.failed++;
      results.tests.push({ name: "Real font data present", status: "FAIL" });
    }

    // Check for font signatures
    const fontSignatures = ["d09G", "wOF2", "OTTO", "true", "0001"];
    let validSignatureCount = 0;

    console.log("\n🔬 Font Signature Analysis:");
    for (const signature of fontSignatures) {
      if (fontCSS.includes(signature)) {
        validSignatureCount++;
        console.log(`  ✅ Found signature: ${signature}`);
      }
    }

    if (validSignatureCount > 0) {
      console.log(`✅ Valid font signatures: ${validSignatureCount}/5`);
      results.passed++;
      results.tests.push({
        name: "Font signatures valid",
        status: "PASS",
        details: `${validSignatureCount} signatures found`,
      });
    } else {
      console.error("❌ No valid font signatures found");
      results.failed++;
      results.tests.push({ name: "Font signatures valid", status: "FAIL" });
    }

    // Test 4: Check font CSS size (should be substantial)
    console.log("\n📏 Test 4: Font CSS Size Check");
    if (fontCSS.length > 1000) {
      console.log(`✅ Font CSS size adequate: ${fontCSS.length} characters`);
      results.passed++;
      results.tests.push({
        name: "Font CSS size adequate",
        status: "PASS",
        details: `${fontCSS.length} chars`,
      });
    } else {
      console.error(`❌ Font CSS too short: ${fontCSS.length} characters`);
      results.failed++;
      results.tests.push({
        name: "Font CSS size adequate",
        status: "FAIL",
        details: `Only ${fontCSS.length} chars`,
      });
    }

    // Test 5: Simulate export validation
    console.log("\n🎯 Test 5: Export Validation Simulation");
    const validation = {
      isValid:
        !placeholderCount &&
        realFontCount > 0 &&
        validSignatureCount > 0 &&
        fontCSS.length > 1000,
    };

    if (validation.isValid) {
      console.log("✅ Fonts would pass export validation");
      results.passed++;
      results.tests.push({ name: "Export validation", status: "PASS" });
    } else {
      console.error("❌ Fonts would FAIL export validation");
      results.failed++;
      results.tests.push({ name: "Export validation", status: "FAIL" });
    }

    // Test 6: Check if fonts were pre-loaded during app init
    console.log("\n⏱️ Test 6: Pre-Loading Status Check");
    if (window.AppStateManager && window.AppStateManager.isReady()) {
      console.log(
        "✅ Application is ready (fonts should have been pre-loaded)"
      );
      results.passed++;
      results.tests.push({ name: "App ready state", status: "PASS" });
    } else {
      console.warn("⚠️ Application not fully ready yet");
      results.warnings++;
      results.tests.push({ name: "App ready state", status: "WARN" });
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 FONT PRE-LOADING TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️ Warnings: ${results.warnings}`);
    console.log(`📈 Total Tests: ${results.tests.length}`);

    const successRate = ((results.passed / results.tests.length) * 100).toFixed(
      1
    );
    console.log(`🎯 Success Rate: ${successRate}%`);

    if (results.failed === 0) {
      console.log("\n🎉 ALL TESTS PASSED - Fonts are ready for export!");
    } else {
      console.log("\n⚠️ SOME TESTS FAILED - Export may have issues");
      console.log(
        "💡 Try running: await window.AppStateManager.manager.preloadFonts()"
      );
    }

    return results;
  }
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
    testFontPreLoading,

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
