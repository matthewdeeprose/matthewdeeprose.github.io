/**
 * @fileoverview Application entry point managing core initialisation, dependency coordination,
 * and OpenRouter API integration. Handles credit management, UI validation, and accessibility features.
 *
 * @module main
 * @requires config - Application configuration and API settings
 * @requires openrouter-client - OpenRouter API client implementation
 * @requires ui-controller - UI state and interaction management
 * @requires accessibility-helpers - A11y utilities and screen reader support
 * @requires credit-formatter - Credit display formatting utilities
 * @requires token-counter - Token calculation and tracking
 *
 * @description
 * Initialises the application when DOM is loaded by:
 * - Validating presence of required UI elements
 * - Establishing OpenRouter API connection
 * - Managing credit balance monitoring
 * - Coordinating accessibility announcements
 *
 * Key responsibilities:
 * - Application bootstrap sequence
 * - Credit balance monitoring and display
 * - Screen reader status announcements
 * - Error state management
 */

// js/main.js
import { CONFIG } from "./config.js";
import { openRouterClient } from "./openrouter-client/openrouter-client-index.js";
import { uiController } from "./ui-controller.js";
import { mathJaxManager } from "./mathjax-manager.js";
import { a11y } from "./accessibility-helpers.js";
import { formatRemainingCredits } from "./credit-formatter.js";
import { TokenCounter } from "./token-counter/token-counter-index.js";
import { RequestManager } from "./request-manager/request-manager-index.js";

// Initialize token counter singleton
const tokenCounter = TokenCounter.getInstance();
import { parameterController } from "./modules/parameters/parameter-controller.js";
import { parameterRegistry } from "./modules/parameters/base/parameter-registry.js";
import { FileHandler } from "./file-handler/file-handler-core.js";
import { responseSizeManager } from "./response-size-manager.js";

import "./testing/pdf-testing-suite.js";

// Stage 7: Error Handling System imports
import { errorHandler } from "./error-handler/error-handler-main.js";
import { errorClassification } from "./error-handler/error-classification.js";
import { recoveryStrategies } from "./error-handler/recovery-strategies.js";
import { errorMessages } from "./error-handler/error-messages.js";

// Stage 7: Testing Commands (separate file for better organisation)
import "./testing/stage7-error-handling-tests.js";

// ============================================================================
// LOGGING CONFIGURATION (Module Scope)
// ============================================================================

/**
 * Logging level constants
 * @enum {number}
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * Current logging configuration
 */
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Current active log level (can be modified at runtime)
let currentLogLevel = DEFAULT_LOG_LEVEL;

/**
 * Check if logging should occur for the specified level
 * @param {number} level - The log level to check
 * @returns {boolean} Whether logging should occur
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= currentLogLevel;
}

/**
 * Log an error message
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) {
    console.error(message, ...args);
  }
}

/**
 * Log a warning message
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) {
    console.warn(message, ...args);
  }
}

/**
 * Log an informational message
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) {
    console.log(message, ...args);
  }
}

/**
 * Log a debug message
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) {
    console.log(message, ...args);
  }
}

/**
 * Set the current logging level
 * @param {number} level - The new log level
 */
function setLogLevel(level) {
  if (Object.values(LOG_LEVELS).includes(level)) {
    currentLogLevel = level;
    logInfo(`Logging level set to: ${Object.keys(LOG_LEVELS)[level]}`);
  } else {
    logWarn(`Invalid log level: ${level}`);
  }
}

/**
 * Get the current logging level
 * @returns {number} The current log level
 */
function getLogLevel() {
  return currentLogLevel;
}

// Temporary diagnostic logging
console.log("🔍 IMPORT DIAGNOSTIC:", {
  uiControllerImported: !!uiController,
  uiControllerType: typeof uiController,
  uiControllerConstructor: uiController?.constructor?.name,
  hasInputHandler: !!uiController?.inputHandler,
  inputHandlerType: typeof uiController?.inputHandler,
});

// ============================================================================
// APPLICATION INITIALISATION
// ============================================================================

// Initialise the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  logInfo("Main: DOM Content Loaded event fired");
  logDebug(
    "🔍 [BRIDGE DEBUG] 🚀 MAIN.JS: Starting application initialisation..."
  );

  // Check if we have all required elements
  const requiredElements = [
    "process-btn",
    "prompt-tokens",
    "completion-tokens",
    "credits-remaining",
    "last-cost",
    "token-efficiency",
    "model-changes",
  ];

  const missingElements = requiredElements.filter(
    (id) => !document.getElementById(id)
  );

  if (missingElements.length > 0) {
    logWarn("Main: Missing required elements:", missingElements);
  }

  // 🔍 LOG INITIAL BRIDGE ENVIRONMENT
  logDebug("🔍 [BRIDGE DEBUG] 📊 INITIAL ENVIRONMENT CHECK:", {
    timestamp: new Date().toISOString(),
    bridgeForceComplete: window.BRIDGE_FORCER_COMPLETE === true,
    markdownEditorExists: typeof window.MarkdownEditor !== "undefined",
    markdownItAvailable: typeof window.markdownit !== "undefined",
    localStorage: localStorage.getItem("use-markdownit-bridge"),
    uiControllerImported: !!uiController,
    parameterControllerImported: !!parameterController,
  });

  try {
    logInfo("Main: Starting parameter controller initialisation");
    logDebug("🔍 [BRIDGE DEBUG] 🎯 INITIALISING PARAMETER SYSTEM...");

    // Initialise parameter controller which will set up all parameters including system prompt
    const success = await parameterController.initialize();
    if (!success) {
      logError("Main: Parameter controller initialisation failed");
      throw new Error("Parameter controller initialisation failed");
    }
    logInfo("Main: Parameter system initialised successfully");
    logDebug("🔍 [BRIDGE DEBUG] ✅ Parameter system ready");

    // Initialize UI controller async components (including file handler)
    logInfo("Main: Initializing UI controller async components...");
    try {
      const uiInitSuccess = await uiController.initialize();
      if (uiInitSuccess) {
        logInfo("Main: UI controller async initialization successful");
      } else {
        logWarn(
          "Main: UI controller async initialization failed - continuing with basic functionality"
        );
      }
      // Initialize response size manager (Phase 4.5)
      logInfo("Main: Initializing response size manager...");
      try {
        const responseSizeInitSuccess = responseSizeManager.initialise();
        if (responseSizeInitSuccess) {
          responseSizeManager.createTestInterface();
          logInfo("Main: Response size manager initialization successful");
        } else {
          logWarn(
            "Main: Response size manager initialization failed - continuing without large response handling"
          );
        }
      } catch (error) {
        logError("Main: Response size manager initialization error:", error);
      }
    } catch (error) {
      logError("Main: UI controller async initialization error:", error);
    }
    // Initialize response size manager (Phase 4.5)
    logInfo("Main: Initializing response size manager...");
    try {
      const responseSizeInitSuccess = responseSizeManager.initialise();
      if (responseSizeInitSuccess) {
        responseSizeManager.createTestInterface();
        logInfo("Main: Response size manager initialization successful");
      } else {
        logWarn(
          "Main: Response size manager initialization failed - continuing without large response handling"
        );
      }
    } catch (error) {
      logError("Main: Response size manager initialization error:", error);
    }

    // 🔍 CRITICAL: EXPOSE MODULES GLOBALLY FOR BRIDGE INTEGRATION
    logDebug("🔍 [BRIDGE DEBUG] 🌐 EXPOSING MODULES GLOBALLY...");

    // Make uiController and its components globally accessible
    window.uiController = uiController;
    window.resultsManager = uiController.resultsManager;
    window.requestProcessor = uiController.requestProcessor;
    window.parameterController = parameterController;
    window.modelManager = uiController.modelManager;
    window.tokenCounter = tokenCounter;
    window.TokenCounter = TokenCounter; // Also expose the class for debugging
    // Make key functions and controllers globally accessible
    window.checkCredits = checkCredits;
    window.parameterRegistry = parameterRegistry;
    window.inputHandler = uiController.inputHandler; // Correct: access via uiController
    window.fileHandler = uiController.fileHandler;
    window.responseSizeManager = responseSizeManager;
    window.RequestManager = RequestManager;
    // Stage 7: Error Handling System exports
    window.errorHandler = errorHandler;
    window.errorClassification = errorClassification;
    window.recoveryStrategies = recoveryStrategies;
    window.errorMessages = errorMessages;
    // MathJax Manager export
    window.mathJaxManager = mathJaxManager;

    // Initialize MathJax Manager (lazy mode - won't block startup)
    console.log("🔢 Registering MathJax Manager...");
    try {
      // Attempt quick initialization without waiting for MathJax
      mathJaxManager
        .initialize(false)
        .then((success) => {
          if (success) {
            console.log("✅ MathJax Manager initialised successfully");
            logInfo(
              "MathJax Manager ready for mathematical content processing"
            );
          } else {
            console.log(
              "⏳ MathJax Manager registered - will initialize when MathJax becomes available"
            );
            logInfo("MathJax Manager using lazy initialization strategy");
          }
        })
        .catch((error) => {
          // Non-critical at startup - manager will initialize on first use
          console.log("ℹ️ MathJax Manager deferred initialization");
          logInfo("MathJax Manager will initialize when first needed");
        });
    } catch (error) {
      console.warn("⚠️ MathJax Manager registration encountered issue:", error);
      logWarn("MathJax Manager will attempt initialization on first use");
    }

    // Phase 4.3.1: Enhanced global exposure for parameter sync system
    if (window.fileHandler?.parameterSync) {
      window.parameterSync = window.fileHandler.parameterSync;

      // Trigger parameter sync initialization if not already done
      if (!window.fileHandler.parameterSyncAvailable) {
        setTimeout(() => {
          logInfo("Main: Triggering deferred parameter sync initialization...");
          window.fileHandler.initializeParameterSynchronizationManually();
        }, 100);
      }
    }
    // Make OpenRouter client components globally accessible
    window.openRouterClient = openRouterClient;
    // Import and expose individual components for testing
    import("./openrouter-client/openrouter-client-request.js").then(
      (module) => {
        window.openRouterRequest = module.openRouterRequest;
      }
    );
    import("./openrouter-client/openrouter-client-validator.js").then(
      (module) => {
        window.openRouterValidator = module.openRouterValidator;
      }
    );
    import("./openrouter-client/openrouter-client-display.js").then(
      (module) => {
        window.openRouterDisplay = module.openRouterDisplay;
      }
    );

    // Expose CONFIG globally for development and testing
    window.CONFIG = CONFIG;

    // Verify CONFIG exposure for debugging
    logDebug("🔍 [CONFIG DEBUG] CONFIG exposed globally:", {
      available: !!window.CONFIG,
      hasFileUpload: !!window.CONFIG?.FILE_UPLOAD,
      hasFileUtils: !!window.CONFIG?.FILE_UPLOAD_UTILS,
      utilMethods: window.CONFIG?.FILE_UPLOAD_UTILS
        ? Object.keys(window.CONFIG.FILE_UPLOAD_UTILS)
        : "not available",
    });

    // Verify global exposure worked
    const globalExposureCheck = {
      uiController: !!window.uiController,
      resultsManager: !!window.resultsManager,
      requestProcessor: !!window.requestProcessor,
      parameterController: !!window.parameterController,
      contentProcessor: !!window.resultsManager?.contentProcessor,
      bridgeDetectionMethod:
        typeof window.resultsManager?.contentProcessor
          ?.shouldUseMarkdownItBridge,
      markdownItBridge:
        !!window.resultsManager?.contentProcessor?.markdownItBridge,
    };

    logDebug(
      "🔍 [BRIDGE DEBUG] ✅ GLOBAL EXPOSURE COMPLETE:",
      globalExposureCheck
    );

    // 🔍 TEST BRIDGE DETECTION IMMEDIATELY
    if (window.resultsManager?.contentProcessor?.shouldUseMarkdownItBridge) {
      logDebug("🔍 [BRIDGE DEBUG] 🧪 TESTING BRIDGE DETECTION...");

      try {
        const bridgeActive =
          window.resultsManager.contentProcessor.shouldUseMarkdownItBridge();
        logDebug("🔍 [BRIDGE DEBUG] 🎯 BRIDGE DETECTION RESULT:", {
          bridgeWillBeUsed: bridgeActive,
          testTimestamp: new Date().toISOString(),
          systemStatus: bridgeActive
            ? "✅ READY FOR AI RESPONSES"
            : "⚠️ BRIDGE NOT ACTIVE",
          detectionFactors: {
            urlParam: new URLSearchParams(window.location.search).has(
              "use-markdownit-bridge"
            ),
            localStorage:
              localStorage.getItem("use-markdownit-bridge") === "true",
            markdownEditorExists: typeof window.MarkdownEditor !== "undefined",
            bridgeInstanceExists:
              !!window.resultsManager.contentProcessor.markdownItBridge,
          },
        });

        // UPDATED: If bridge is active, run integration test with fixed table detection
        if (bridgeActive) {
          logDebug("🔍 [BRIDGE DEBUG] 🧪 RUNNING INTEGRATION TEST...");
          const testContent =
            "| Test | Status |\n|------|--------|\n| Bridge | Active |\n\n- [x] Integration working\n- [ ] Ready for AI";

          try {
            const testResult =
              await window.resultsManager.contentProcessor.processContent(
                testContent
              );

            // UPDATED: Fixed table detection for sortable tables
            const hasDirectTable = testResult.includes("<table>");
            const hasSortableTable = testResult.includes(
              "mdSortableTable-table-container"
            );
            const hasAnyTable = hasDirectTable || hasSortableTable;
            const hasCheckbox = testResult.includes("checkbox");
            const integrationSuccess = hasAnyTable && hasCheckbox;

            logDebug("🔍 [BRIDGE DEBUG] 🎉 INTEGRATION TEST RESULT:", {
              success: integrationSuccess,
              tableAnalysis: {
                hasDirectTable: hasDirectTable,
                hasSortableTable: hasSortableTable,
                hasAnyTable: hasAnyTable,
                tableType: hasSortableTable
                  ? "sortable wrapped table"
                  : hasDirectTable
                  ? "direct table"
                  : "no table",
              },
              hasCheckbox: hasCheckbox,
              hasSortableTable: testResult.includes("sortable-table"),
              hasTaskListClass: testResult.includes("task-list"),
              resultLength: testResult.length,
              resultPreview: testResult.substring(0, 200) + "...",
              status: integrationSuccess
                ? "✅ BRIDGE FULLY OPERATIONAL"
                : "❌ BRIDGE PROCESSING FAILED",
            });

            if (integrationSuccess) {
              logDebug(
                "🔍 [BRIDGE DEBUG] 🚀 SYSTEM READY: AI responses will be processed through markdown-it bridge!"
              );
            }
          } catch (testError) {
            logError("🔍 [BRIDGE DEBUG] ❌ INTEGRATION TEST ERROR:", {
              error: testError.message,
              stack: testError.stack,
            });
          }
        } else {
          logWarn(
            "🔍 [BRIDGE DEBUG] ⚠️ BRIDGE INACTIVE - AI responses will use legacy processing"
          );
        }
      } catch (bridgeError) {
        logError("🔍 [BRIDGE DEBUG] ❌ BRIDGE DETECTION ERROR:", {
          error: bridgeError.message,
          stack: bridgeError.stack,
        });
      }
    } else {
      logError("🔍 [BRIDGE DEBUG] ❌ BRIDGE DETECTION METHOD NOT AVAILABLE");
      logError(
        "🔍 [BRIDGE DEBUG] 🔍 AVAILABLE METHODS ON CONTENT PROCESSOR:",
        window.resultsManager?.contentProcessor
          ? Object.getOwnPropertyNames(
              Object.getPrototypeOf(window.resultsManager.contentProcessor)
            )
          : "contentProcessor not found"
      );
    }

    // Continue with credit checking
    logDebug("🔍 [BRIDGE DEBUG] 💳 PROCEEDING TO CREDIT CHECK...");
    await checkCredits();

    logDebug("🔍 [BRIDGE DEBUG] 🎯 APPLICATION INITIALISATION COMPLETE");
  } catch (error) {
    logError("Main: Failed to initialise parameter system:", {
      error,
      stack: error.stack,
    });
    logError("🔍 [BRIDGE DEBUG] ❌ CRITICAL INITIALISATION ERROR:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    a11y.announceStatus(
      "Error initialising parameter controls. Please refresh the page.",
      "assertive"
    );
  }
});

async function checkCredits() {
  logDebug("🔍 [BRIDGE DEBUG] 💳 Starting credit check...");

  try {
    // Attempt to fetch with CORS mode
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${CONFIG.API_KEY}`,
      },
      // Add mode: 'cors' explicitly (this is the default, but adding for clarity)
      mode: "cors",
    });
    const data = await response.json();
    logDebug("Credits response:", data);

    const creditsElement = document.getElementById("credits-remaining");
    if (creditsElement && data.data) {
      const currentUsage = parseFloat(data.data.usage) || 0;
      const creditLimit = data.data.limit ? parseFloat(data.data.limit) : null;
      logDebug("Credit values:", { currentUsage, creditLimit });
      // Format credits using our new formatter
      const formattedCredits = formatRemainingCredits(
        currentUsage,
        creditLimit
      );
      logDebug("Formatted credits:", formattedCredits);
      // Update the display with formatted credits
      creditsElement.textContent = formattedCredits.displayText;

      // Set ARIA label for accessibility
      creditsElement.setAttribute("aria-label", formattedCredits.ariaLabel);

      // If credits are running low (below 20%), announce it to screen readers
      if (!formattedCredits.isUnlimited && formattedCredits.percentage < 20) {
        a11y.announceStatus("Warning: Credits are running low", "assertive");
      }

      logDebug("🔍 [BRIDGE DEBUG] ✅ Credit check complete");
    }
  } catch (error) {
    logError("Error checking credits:", error);

    // Handle the CORS error gracefully
    const creditsElement = document.getElementById("credits-remaining");
    if (creditsElement) {
      // Check if this is a CORS error
      if (error.message && error.message.includes("CORS")) {
        // Display a more helpful message for CORS errors
        creditsElement.textContent = "Credits unavailable on localhost";
        creditsElement.setAttribute(
          "aria-label",
          "Credits information unavailable when running on localhost"
        );
        logInfo(
          "Note: Credits cannot be fetched on localhost due to CORS restrictions. This is expected behaviour during local development."
        );
      } else {
        // Generic error message for other types of errors
        creditsElement.textContent = "Credits information unavailable";
        creditsElement.setAttribute(
          "aria-label",
          "Error occurred while checking available credits"
        );
      }
    }

    logDebug("🔍 [BRIDGE DEBUG] ⚠️ Credit check completed with errors");
  }
}

// 🔍 UPDATED: ENHANCED DEBUG HELPER FUNCTIONS with fixed table detection
window.testBridgeIntegration = async function (
  content = "| Name | Value |\n|------|-------|\n| Test | Bridge |\n\n- [x] Working\n- [ ] Testing\n\n```javascript\nconsole.log('Hello Bridge!');\n```"
) {
  logDebug("🔍 [BRIDGE DEBUG] 🧪 MANUAL BRIDGE TEST INITIATED");

  if (!window.resultsManager) {
    logError("🔍 [BRIDGE DEBUG] ❌ ResultsManager not globally available");
    return;
  }

  try {
    logDebug("🔍 [BRIDGE DEBUG] 📝 Testing content:", {
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + "...",
      containsTable: content.includes("|"),
      containsTaskList: content.includes("- ["),
      containsCodeBlock: content.includes("```"),
    });

    // Test bridge detection first
    const bridgeActive =
      window.resultsManager.contentProcessor.shouldUseMarkdownItBridge();
    logDebug("🔍 [BRIDGE DEBUG] 🔍 Bridge detection:", bridgeActive);

    // Test direct processing
    const processed = await window.resultsManager.processContent(content);

    // UPDATED: Fixed table detection for sortable tables
    const hasDirectTable = processed.includes("<table>");
    const hasSortableTable = processed.includes(
      "mdSortableTable-table-container"
    );
    const hasAnyTable = hasDirectTable || hasSortableTable;

    logDebug("🔍 [BRIDGE DEBUG] ✅ Direct processing result:", {
      inputLength: content.length,
      outputLength: processed.length,
      tableAnalysis: {
        hasDirectTable: hasDirectTable,
        hasSortableTable: hasSortableTable,
        hasAnyTable: hasAnyTable,
        tableType: hasSortableTable
          ? "sortable wrapped table"
          : hasDirectTable
          ? "direct table"
          : "no table",
      },
      hasCheckbox: processed.includes("checkbox"),
      hasCodeBlock: processed.includes('<pre class="language-'),
      outputPreview: processed.substring(0, 300) + "...",
    });

    // Test full update pipeline
    await window.resultsManager.updateResults(content, {
      announcement: "Manual bridge test complete",
    });

    logDebug(
      "🔍 [BRIDGE DEBUG] ✅ MANUAL TEST COMPLETE - Check .results-content element"
    );

    // Verify final DOM state
    const resultsContent = document.querySelector(".results-content");
    if (resultsContent) {
      // UPDATED: Fixed DOM analysis for sortable tables
      const domHasDirectTable = resultsContent.innerHTML.includes("<table>");
      const domHasSortableTable = resultsContent.innerHTML.includes(
        "mdSortableTable-table-container"
      );
      const domHasAnyTable = domHasDirectTable || domHasSortableTable;

      logDebug("🔍 [BRIDGE DEBUG] 📊 FINAL DOM STATE:", {
        htmlLength: resultsContent.innerHTML.length,
        domAnalysis: {
          tableAnalysis: {
            hasDirectTable: domHasDirectTable,
            hasSortableTable: domHasSortableTable,
            hasAnyTable: domHasAnyTable,
            tableType: domHasSortableTable
              ? "sortable wrapped table"
              : domHasDirectTable
              ? "direct table"
              : "no table",
          },
          hasSortableTableClass:
            resultsContent.innerHTML.includes("sortable-table"),
          hasCheckbox: resultsContent.innerHTML.includes("checkbox"),
          hasTaskList: resultsContent.innerHTML.includes("task-list"),
          hasCodeBlock: resultsContent.innerHTML.includes(
            '<pre class="language-'
          ),
          hasSyntaxHighlight:
            resultsContent.innerHTML.includes("hljs") ||
            resultsContent.innerHTML.includes("language-"),
        },
        domPreview: resultsContent.innerHTML.substring(0, 200) + "...",
      });

      return {
        success: true,
        processed: processed,
        domContent: resultsContent.innerHTML,
        tableAnalysis: {
          hasDirectTable: domHasDirectTable,
          hasSortableTable: domHasSortableTable,
          hasAnyTable: domHasAnyTable,
        },
      };
    }
  } catch (error) {
    logError("🔍 [BRIDGE DEBUG] ❌ MANUAL TEST ERROR:", {
      error: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
};

// Export functions and controllers that might be needed by other modules
export {
  checkCredits,
  parameterController, // Export parameter controller for other modules
  uiController, // Export UI controller for bridge integration
  // Export logging functions for use by other modules
  logError,
  logWarn,
  logInfo,
  logDebug,
  setLogLevel,
  getLogLevel,
  LOG_LEVELS,
};

// Make logging functions globally accessible for debugging
window.setLogLevel = setLogLevel;
window.getLogLevel = getLogLevel;
window.LOG_LEVELS = LOG_LEVELS;
