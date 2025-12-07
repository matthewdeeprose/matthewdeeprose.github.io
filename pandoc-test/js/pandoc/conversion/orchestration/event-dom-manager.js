// event-dom-manager.js
// Event DOM Manager - DOM management and event handling coordination
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7 Step 27

const EventDOMManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("EVENT_DOM_MGR", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[EVENT_DOM_MGR]"),
    logWarn: console.warn.bind(console, "[EVENT_DOM_MGR]"),
    logInfo: console.log.bind(console, "[EVENT_DOM_MGR]"),
    logDebug: console.log.bind(console, "[EVENT_DOM_MGR]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // DOM & EVENT MANAGEMENT COORDINATION
  // ===========================================================================================

  /**
   * Setup event listeners for conversion triggers
   * EXTRACTED: From final-coordination-manager.js setupEventListeners method
   */
  function setupEventListeners(conversionManager) {
    logInfo(
      "Event DOM Manager: Setting up conversion engine event listeners..."
    );

    if (!conversionManager) {
      logError("No conversion manager provided for event listener setup");
      return false;
    }

    try {
      // Enhanced debouncing configuration
      conversionManager.conversionTimeout = null;
      conversionManager.DEBOUNCE_DELAY = 800; // Increased from 300ms to 800ms
      conversionManager.isConversionQueued = false;

      // Unified conversion trigger with enhanced debouncing and memory management
      conversionManager.scheduleConversion = () => {
        // Clear any existing timeout AND remove from tracking
        if (conversionManager.conversionTimeout) {
          clearTimeout(conversionManager.conversionTimeout);
          conversionManager.activeTimeouts.delete(
            conversionManager.conversionTimeout
          );
        }

        // Mark conversion as queued
        conversionManager.isConversionQueued = true;

        // 🔧 CRITICAL FIX: Track when conversion was scheduled to detect stuck conversions
        const scheduledTime = Date.now();
        const maxWaitTime = 15000; // 15 seconds max wait

        // Set new timeout with tracking
        conversionManager.conversionTimeout = setTimeout(() => {
          // Remove completed timeout from tracking
          conversionManager.activeTimeouts.delete(
            conversionManager.conversionTimeout
          );

          // 🔧 CRITICAL FIX: Verify conversion can actually start
          const currentlyInProgress = conversionManager.conversionInProgress;
          const waitedTime = Date.now() - scheduledTime;

          if (currentlyInProgress && waitedTime > maxWaitTime) {
            // Conversion stuck - force reset
            logWarn(`⚠️ Conversion stuck for ${waitedTime}ms - forcing reset`);
            conversionManager.conversionInProgress = false;
            conversionManager.isConversionQueued = false;

            // Update status to show issue
            if (window.StatusManager) {
              window.StatusManager.setError(
                "Conversion timeout - please try again"
              );
            }
            return;
          }

          // Only proceed if not already converting
          if (!currentlyInProgress) {
            conversionManager.isConversionQueued = false;
            conversionManager.convertInput();
          } else {
            // If conversion in progress, reschedule (with limit)
            if (waitedTime < maxWaitTime) {
              logDebug("Conversion in progress - rescheduling...");
              conversionManager.scheduleConversion();
            } else {
              logWarn("⚠️ Maximum reschedule time reached - aborting");
              conversionManager.isConversionQueued = false;
            }
          }
        }, conversionManager.DEBOUNCE_DELAY);

        // Track the new timeout
        conversionManager.activeTimeouts.add(
          conversionManager.conversionTimeout
        );
      };

      // OPTIMIZED: Regular textarea input handler with enhanced property access caching
      if (conversionManager.inputTextarea) {
        let lastInputLength = 0;
        let lastAutomaticDisabledCheck = 0;
        let cachedAutomaticDisabled = false;

        // CRITICAL FIX: Provide cache invalidation method
        conversionManager.invalidateAutomaticConversionsCache = () => {
          lastAutomaticDisabledCheck = 0; // Force cache refresh on next check
          cachedAutomaticDisabled = false; // Reset cache to false
          logDebug(
            "🔄 Automatic conversions cache invalidated - will refresh on next input"
          );
        };

        // Make cache invalidation globally accessible for example system
        if (window.ConversionEngine) {
          window.ConversionEngine.invalidateAutomaticConversionsCache =
            conversionManager.invalidateAutomaticConversionsCache;
        }

        conversionManager.inputTextarea.addEventListener("input", (event) => {
          // 🔧 CRITICAL DIAGNOSTIC: Log every input event
          const currentLength = conversionManager.inputTextarea.value.length;
          console.log(
            `🔍 INPUT EVENT FIRED: length=${currentLength}, lastLength=${lastInputLength}`
          );

          // OPTIMIZATION: Cache automatic conversions disabled check for 100ms
          const now = Date.now();
          if (now - lastAutomaticDisabledCheck > 100) {
            cachedAutomaticDisabled =
              conversionManager.automaticConversionsDisabled ||
              window.ConversionEngine?.automaticConversionsDisabled;
            lastAutomaticDisabledCheck = now;

            // DEBUG: Log cache refresh
            console.log(
              `🔄 Cache refreshed: automaticConversionsDisabled = ${cachedAutomaticDisabled}`
            );
          }

          if (cachedAutomaticDisabled) {
            console.warn(
              "⚠️ CONVERSION BLOCKED: Automatic conversions disabled"
            );
            return;
          }

          const isLargeDeletion = lastInputLength > 1000 && currentLength < 100;

          if (isLargeDeletion) {
            console.log(
              "🔥 Large deletion detected - implementing performance optimization"
            );

            // Immediate DOM cleanup
            if (window.FinalCoordinationManager?.performDOMCleanup) {
              window.FinalCoordinationManager.performDOMCleanup();
            }

            // Skip expensive processing for large deletions
            if (currentLength === 0) {
              console.log("🚀 Complete deletion detected - using fast path");

              // Fast path for complete clearing
              const outputDiv = document.getElementById("output");
              if (outputDiv) {
                outputDiv.innerHTML =
                  '<p class="placeholder-text">Content cleared. Enter LaTeX above to see the rendered output.</p>';
              }

              // Update status immediately
              if (window.StatusManager) {
                window.StatusManager.setReady(
                  "Content cleared - ready for new input"
                );
              }

              // Skip conversion scheduling for empty content
              lastInputLength = currentLength;
              return;
            }

            // Shorter debounce for deletions
            conversionManager.DEBOUNCE_DELAY = 100;
          } else {
            conversionManager.DEBOUNCE_DELAY = 800;
          }

          lastInputLength = currentLength;
          console.log(
            `✅ CALLING scheduleConversion() with debounce=${conversionManager.DEBOUNCE_DELAY}ms`
          );
          conversionManager.scheduleConversion();
        });
      }

      // NOTE: ContentEditable events are handled by Live LaTeX Editor
      // The Live LaTeX Editor will sync changes to the original textarea
      // which will then trigger our textarea input listener with proper content change detection
      const contentEditableDiv = document.getElementById(
        "input-contenteditable"
      );
      if (contentEditableDiv) {
        logInfo(
          "✅ ContentEditable div found - Live LaTeX Editor will handle events and sync to textarea"
        );
      } else {
        logDebug("No contenteditable div found - standard textarea mode");
      }

      // Arguments change handler with immediate conversion (no debounce needed)
      if (conversionManager.argumentsInput) {
        conversionManager.argumentsInput.addEventListener("input", () => {
          // Arguments changes are less frequent and should convert immediately
          if (!conversionManager.conversionInProgress) {
            conversionManager.convertInput();
          }
        });
      }

      logInfo("✅ Enhanced conversion engine event listeners setup complete");
      logInfo(
        `🕒 Debounce delay set to ${conversionManager.DEBOUNCE_DELAY}ms for improved typing experience`
      );

      return true;
    } catch (error) {
      logError("Failed to setup event listeners:", error);
      return false;
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testEventDOMManager() {
    const tests = {
      moduleExists: () => !!window.EventDOMManager,

      hasSetupEventListeners: () => typeof setupEventListeners === "function",

      eventListenerSetupWorks: () => {
        try {
          // Test with mock conversion manager
          const mockManager = {
            inputTextarea: document.createElement("textarea"),
            argumentsInput: document.createElement("input"),
            activeTimeouts: new Set(),
            conversionInProgress: false,
            isConversionQueued: false,
            automaticConversionsDisabled: false,
            convertInput: () => {},
          };

          const result = setupEventListeners(mockManager);
          return result === true;
        } catch (error) {
          logError("Event listener setup test failed:", error);
          return false;
        }
      },

      debounceConfigurationApplied: () => {
        const mockManager = {
          inputTextarea: document.createElement("textarea"),
          argumentsInput: document.createElement("input"),
          activeTimeouts: new Set(),
          conversionInProgress: false,
          isConversionQueued: false,
          automaticConversionsDisabled: false,
          convertInput: () => {},
        };

        setupEventListeners(mockManager);
        return (
          mockManager.DEBOUNCE_DELAY === 800 &&
          typeof mockManager.scheduleConversion === "function"
        );
      },

      integrationReadiness: () => {
        return typeof setupEventListeners === "function";
      },
    };

    return (
      window.TestUtilities?.runTestSuite("EventDOMManager", tests) ||
      fallbackTesting("EventDOMManager", tests)
    );
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logInfo(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // DOM & Event Management
    setupEventListeners,

    // Testing
    testEventDOMManager,
  };
})();

// Make globally available
window.EventDOMManager = EventDOMManager;
