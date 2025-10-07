/**
 * UI Controller - Core orchestrator for the application's user interface components.
 *
 * Coordinates interactions between various UI modules including parameter controls,
 * model management, input handling, request processing, and results display.
 * Implements a modular architecture to maintain separation of concerns while
 * ensuring smooth data flow and state management across components.
 * Features accessible UI updates with ARIA announcements and focus management.
 * Now includes support for three streaming modes: none, standard, and incremental.
 *
 * @module ui-controller
 */

import { ModelManager } from "./modules/model-manager.js";
import { ProgressHandler } from "./modules/progress-handler.js";
import { InputHandler } from "./modules/input-handler.js";
import { RequestProcessor } from "./request-manager/request-manager-index.js";
import { ResultsManager } from "./results-manager/results-manager-index.js";
import { parameterController } from "./modules/parameters/parameter-controller.js";
import { a11y } from "./accessibility-helpers.js";
import { FileHandler } from "./file-handler/file-handler-core.js";

// Logging configuration (at module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Helper functions for logging
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

class UIController {
  constructor() {
    logInfo("UIController: Starting initialisation...");

    // Initialize recursion guard
    this._updatingFileUploadState = false;

    // Check for reduced motion preference
    this.prefersReducedMotion = a11y.prefersReducedMotion
      ? a11y.prefersReducedMotion()
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    logDebug(
      "UIController: Reduced motion preference detected:",
      this.prefersReducedMotion
    );

    // Initialize all modules
    logInfo("UIController: Initialising modules...");
    this.modelManager = new ModelManager();
    this.progressHandler = new ProgressHandler();
    this.inputHandler = new InputHandler();
    this.fileHandler = new FileHandler();

    // Pass the motion preference to the results manager
    this.resultsManager = new ResultsManager();

    // Enable debug mode by default for development
    logInfo("UIController: Enabling debug mode for development");
    this.resultsManager.setDebugMode(true);

    // Initialize request processor with dependencies
    logInfo("UIController: Setting up RequestProcessor...");
    this.requestProcessor = new RequestProcessor(
      this.modelManager,
      this.progressHandler
    );

    // Initialize file upload state management
    this.initFileUploadState();

    // Set up callbacks
    logInfo("UIController: Binding event handlers...");
    this.inputHandler.onProcess = this.handleProcessClick.bind(this);
    this.inputHandler.onStreamingProcess =
      this.handleStreamingRequest.bind(this);
    this.requestProcessor.setResultsCallback(this.handleResults.bind(this));

    // Initialize streaming functionality with enhanced mode support
    this.initializeStreamingWithModes();

    // Handle reduced motion preference for streaming options
    this.handleReducedMotionStreamingOptions();

    // Set up motion preference watcher
    if (a11y.watchMotionPreference) {
      this.motionWatcher = a11y.watchMotionPreference((prefersReduced) => {
        this.prefersReducedMotion = prefersReduced;
        logInfo("UIController: Motion preference changed:", prefersReduced);
      });
    }

    // Set up streaming mode change listeners
    this.setupStreamingModeListeners();

    logInfo("UIController: Initialisation complete");
  }

  /**
   * Initialize the UI controller and all its components
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    logInfo("UIController: Starting async initialization...");

    try {
      // Initialize file handler
      logInfo("UIController: Initializing file handler...");
      const fileHandlerInitialized = await this.fileHandler.initialise();

      if (fileHandlerInitialized) {
        this.fileHandler.createTestInterface();

        // Connect file handler to existing file upload state management
        this.connectFileHandlerToState();

        logInfo("UIController: File handler initialized successfully");
      } else {
        logWarn(
          "UIController: File handler initialization failed - continuing with degraded functionality"
        );
      }

      // Initialize other async components here if needed

      logInfo("UIController: Async initialization complete");
      return true;
    } catch (error) {
      logError("UIController: Async initialization failed:", error);
      return false;
    }
  }

  /**
   * Connect file handler events to existing state management
   */
  connectFileHandlerToState() {
    // Listen for file upload state changes from the file handler
    // Use a specific event name to avoid circular updates
    window.addEventListener("file-handler-state-changed", (event) => {
      const fileState = event.detail;

      // Update the existing file upload state WITHOUT re-emitting the same event
      this.updateFileUploadStateInternal({
        hasFile: fileState.hasFile,
        currentFile: fileState.file,
        fileType: fileState.fileType,
        costEstimate: fileState.costEstimate,
        // Map to existing state structure
        processingEngine: fileState.fileAnalysis?.recommendedEngine || null,
        responseWarnings: {
          sizeWarning: fileState.fileAnalysis?.isLarge || false,
          costWarning: fileState.costEstimate?.warning || "none",
        },
      });

      logDebug("UIController: File state synchronized:", this.fileUploadState);
    });

    logInfo("UIController: File handler connected to state management");
  }

  /**
   * Initialize streaming functionality with enhanced mode support
   */
  initializeStreamingWithModes() {
    logInfo("UIController: Setting up enhanced streaming functionality");

    // Set up streaming callbacks on the request processor
    this.requestProcessor.setStreamingCallbacks({
      onBeginStreaming: () => {
        logInfo("UIController: Starting streaming display");
        this.resultsManager.beginStreaming();
      },
      onStreamChunk: (chunk) => {
        logDebug("UIController: Received chunk:", {
          chunk,
          length: chunk.length,
          preview: chunk.substring(0, 20) + (chunk.length > 20 ? "..." : ""),
          streamingMode: this.getStreamingMode(),
        });
        this.resultsManager.updateStreamingContent(chunk);
      },
      onStreamComplete: (fullResponse, responseData) => {
        // Enhanced debug logging with streaming mode context
        logDebug("🔍 STREAMING COMPLETE - UI CONTROLLER:", {
          responseLength: fullResponse?.length || 0,
          responseType: typeof fullResponse,
          responsePreview: fullResponse?.substring(0, 100) + "...",
          streamingMode: this.getStreamingMode(),
          containsMarkdown: {
            tables: fullResponse?.includes("|") || false,
            taskLists: fullResponse?.includes("- [") || false,
            codeBlocks: fullResponse?.includes("```") || false,
          },
          debugModeEnabled: this.resultsManager?.debugMode || false,
          timestamp: new Date().toISOString(),
        });

        // Check bridge status during streaming completion
        if (this.resultsManager?.contentProcessor?.shouldUseMarkdownItBridge) {
          logDebug("🔍 BRIDGE STATUS DURING STREAMING:", {
            bridgeWillBeUsed:
              this.resultsManager.contentProcessor.shouldUseMarkdownItBridge(),
            markdownEditorExists: typeof window.MarkdownEditor !== "undefined",
            streamingMode: this.getStreamingMode(),
          });
        }

        logDebug("UIController: Streaming complete:", {
          length: fullResponse?.length || 0,
          content: fullResponse
            ? fullResponse.substring(0, 50) + "..."
            : "empty",
          responseDataType: typeof responseData,
          responseDataKeys: responseData ? Object.keys(responseData) : "none",
          responseDataUsage: responseData?.usage
            ? JSON.stringify(responseData.usage)
            : "none",
          responseDataModel: responseData?.model || "unknown",
          streamingMode: this.getStreamingMode(),
        });

        // Check debug container before completing streaming
        const debugContainer = document.getElementById(
          "response-debug-container"
        );
        logDebug(
          "UIController: Debug container status before completing streaming:",
          {
            debugModeEnabled: this.resultsManager.debugMode,
            debugContainerExists: !!debugContainer,
            debugContainerVisible: debugContainer
              ? debugContainer.style.display !== "none"
              : false,
          }
        );

        // Make sure we have a valid response
        if (fullResponse && fullResponse.length > 0) {
          logDebug("UIController: Processing valid full response", {
            fullResponseType: typeof fullResponse,
            fullResponseLength: fullResponse.length,
            fullResponseStart: fullResponse.substring(0, 100) + "...",
            fullResponseEnd:
              "..." + fullResponse.substring(fullResponse.length - 100),
            streamingMode: this.getStreamingMode(),
          });

          // Update the streaming content in ResultsManager
          this.resultsManager.updateStreamingContent(fullResponse, {
            autoScroll: false,
            isFullResponse: true,
          });

          // Then complete streaming
          this.resultsManager.completeStreaming();

          // Check debug container after completing streaming
          const debugContainerAfter = document.getElementById(
            "response-debug-container"
          );
          const rawResponse = document.getElementById("raw-response");
          const formattedResponse =
            document.getElementById("formatted-response");

          logDebug(
            "UIController: Debug container status after completing streaming:",
            {
              debugModeEnabled: this.resultsManager.debugMode,
              debugContainerExists: !!debugContainerAfter,
              debugContainerVisible: debugContainerAfter
                ? debugContainerAfter.style.display !== "none"
                : false,
              rawResponseExists: !!rawResponse,
              rawResponseHasContent: rawResponse
                ? !!rawResponse.textContent
                : false,
              rawResponseLength: rawResponse
                ? rawResponse.textContent.length
                : 0,
              formattedResponseExists: !!formattedResponse,
              formattedResponseHasContent: formattedResponse
                ? !!formattedResponse.innerHTML
                : false,
              formattedResponseLength: formattedResponse
                ? formattedResponse.innerHTML.length
                : 0,
            }
          );

          // If debug mode is enabled but container doesn't exist, try to force create it
          if (this.resultsManager.debugMode && !debugContainerAfter) {
            logWarn(
              "UIController: Debug mode is enabled but container doesn't exist after streaming, forcing creation"
            );
            this.resultsManager.setDebugMode(true);
          }
        } else {
          logWarn("UIController: Empty response received from streaming", {
            fullResponseType: typeof fullResponse,
            fullResponseValue: fullResponse,
            hasResponseData: !!responseData,
            streamingMode: this.getStreamingMode(),
          });

          // Provide fallback for empty responses
          this.resultsManager.completeStreaming({
            announcement: "Response complete, but no content was received",
          });
        }
      },
      onStreamCancel: () => {
        logInfo("UIController: Streaming cancelled");
        this.resultsManager.completeStreaming({
          announcement: "Response generation was cancelled",
        });
      },
    });

    // Add a cancel button to the UI
    this.setupCancelButton();
  }

  /**
   * Handle reduced motion preference for streaming options
   */
  handleReducedMotionStreamingOptions() {
    const updateStreamingOptions = (prefersReduced) => {
      const standardRadio = document.getElementById("stream-standard");
      const noneRadio = document.getElementById("stream-none");
      const standardLabel = document.getElementById("standard-streaming-label");
      const reducedMotionNotice = document.getElementById(
        "reduced-motion-notice"
      );

      if (
        !standardRadio ||
        !noneRadio ||
        !standardLabel ||
        !reducedMotionNotice
      ) {
        logWarn("UIController: Streaming option elements not found");
        return;
      }

      if (prefersReduced) {
        // Disable standard streaming for reduced motion users
        standardRadio.disabled = true;
        standardLabel.classList.add("disabled");
        reducedMotionNotice.style.display = "inline";

        // Switch to "none" if standard was selected
        if (standardRadio.checked) {
          noneRadio.checked = true;

          // Update the results manager streaming mode
          if (this.resultsManager?.streaming?.setStreamingMode) {
            this.resultsManager.streaming.setStreamingMode("none");
          }

          // Announce the change
          a11y.announceStatus(
            "Standard streaming has been disabled because animations are disabled in your system settings. Switched to no streaming mode.",
            "polite"
          );
        }

        logInfo(
          "UIController: Standard streaming disabled due to reduced motion preference"
        );
      } else {
        // Re-enable standard streaming
        standardRadio.disabled = false;
        standardLabel.classList.remove("disabled");
        reducedMotionNotice.style.display = "none";

        logInfo(
          "UIController: Standard streaming enabled - no motion preference detected"
        );
      }
    };

    // Apply initial state
    updateStreamingOptions(this.prefersReducedMotion);

    // Update when preference changes
    if (a11y.watchMotionPreference) {
      a11y.watchMotionPreference((prefersReduced) => {
        updateStreamingOptions(prefersReduced);
      });
    }
  }

  /**
   * Set up streaming mode change listeners
   */
  setupStreamingModeListeners() {
    const streamingRadios = document.querySelectorAll(
      'input[name="streaming-mode"]'
    );

    streamingRadios.forEach((radio) => {
      radio.addEventListener("change", (event) => {
        if (event.target.checked) {
          const mode = event.target.value;
          logInfo(`UIController: Streaming mode changed to: ${mode}`);

          // Announce mode change to screen readers
          let announcement = "";
          switch (mode) {
            case "none":
              announcement =
                "Streaming disabled - responses will appear when complete";
              break;
            case "standard":
              announcement =
                "Standard streaming enabled - responses will appear as plain text during generation";
              break;
            default:
              announcement = `Streaming mode changed to ${mode}`;
          }

          a11y.announceStatus(announcement, "polite");
        }
      });
    });

    logDebug(
      `UIController: Set up ${streamingRadios.length} streaming mode listeners`
    );
  }

  /**
   * Get current streaming mode from UI
   * @returns {string} Current streaming mode ('none' or 'standard')
   */
  getStreamingMode() {
    const streamingRadios = document.querySelectorAll(
      'input[name="streaming-mode"]'
    );
    for (const radio of streamingRadios) {
      if (radio.checked) {
        return radio.value;
      }
    }
    return "standard"; // Default fallback
  }

  /**
   * Determine if streaming should be used based on current mode
   * @returns {boolean} True if streaming should be used
   */
  shouldUseStreaming() {
    const mode = this.getStreamingMode();
    return mode !== "none";
  }

  /**
   * Set up cancel button for streaming
   */
  setupCancelButton() {
    // Find or create the cancel button
    let cancelButton = document.querySelector("#cancel-stream-btn");

    if (!cancelButton) {
      const actionControls = document.querySelector(".action-controls");
      if (!actionControls) return;

      cancelButton = document.createElement("button");
      cancelButton.id = "cancel-stream-btn";
      cancelButton.className = "actionButton cancelButton";
      cancelButton.textContent = "Cancel Generation";
      cancelButton.setAttribute(
        "aria-label",
        "Cancel the ongoing response generation"
      );
      cancelButton.style.display = "none"; // Hide initially

      actionControls.appendChild(cancelButton);
    }

    // Add event listener
    cancelButton.addEventListener("click", () => {
      this.requestProcessor.cancelStreaming();
    });

    // Add keyboard support
    a11y.addKeyboardSupport(cancelButton, {
      Enter: () => this.requestProcessor.cancelStreaming(),
      Space: () => this.requestProcessor.cancelStreaming(),
    });

    // Store reference
    this.cancelButton = cancelButton;
  }

  /**
   * Handle streaming request with enhanced mode detection
   * @param {string} inputText - Input text to process
   */
  async handleStreamingRequest(inputText) {
    logInfo("UIController: Handle streaming request started", {
      inputTextLength: inputText?.length,
      streamingMode: this.getStreamingMode(),
    });

    try {
      // Get streaming mode
      const streamingMode = this.getStreamingMode();

      // If streaming is disabled, use standard processing instead
      if (streamingMode === "none") {
        logInfo("UIController: Streaming disabled - using standard processing");
        a11y.announceStatus("Processing request without streaming", "polite");
        return await this.handleProcessClick(inputText);
      }

      // Set streaming mode on results manager
      if (this.resultsManager?.streamingManager) {
        this.resultsManager.streamingManager.setStreamingMode(streamingMode);
        logDebug(`UIController: Set streaming mode to ${streamingMode}`);
      }

      // Update UI state
      this.inputHandler.setProcessing(true);

      // Show cancel button
      if (this.cancelButton) {
        this.cancelButton.style.display = "block";
      }

      logDebug("[STREAM DEBUG] 🚀 Streaming request initiated", {
        streamingMode: this.getStreamingMode(),
        inputLength: inputText?.length,
        timestamp: Date.now(),
      });

      // Announce streaming start with mode information
      let announcement = "Starting response generation";
      if (streamingMode === "incremental") {
        announcement += " with progressive formatting";
      } else {
        announcement += " with streaming";
      }
      a11y.announceStatus(announcement, "polite");

      // Process streaming request
      await this.requestProcessor.processStreamingRequest(inputText);
    } catch (error) {
      logError("UIController: Error in streaming request handler:", error);
      a11y.announceStatus(
        "Error occurred during response generation",
        "assertive"
      );
    } finally {
      logDebug("UIController: Resetting processing state...");
      // Reset processing state
      this.inputHandler.setProcessing(false);

      // Hide cancel button
      if (this.cancelButton) {
        this.cancelButton.style.display = "none";
      }

      // Return focus to input without scrolling
      this.inputHandler.focus();
      logDebug("UIController: Streaming request handling complete");
    }
  }

  /**
   * Handle standard (non-streaming) processing
   * @param {string} inputText - Input text to process
   */
  async handleProcessClick(inputText) {
    logInfo("UIController: Handle process click started", {
      inputTextLength: inputText?.length,
      streamingMode: this.getStreamingMode(),
    });

    try {
      // Update UI state
      this.inputHandler.setProcessing(true);

      // Get parameters
      const model = this.modelManager.getCurrentModel();
      logDebug("UIController: Current model:", model);

      // Get parameters from parameter controller
      const parameters = parameterController.getParameterValues();
      parameters.model = model;

      logDebug("UIController: Request parameters:", parameters);

      logDebug("[STREAM DEBUG] 🔄 Standard processing request initiated", {
        inputLength: inputText?.length,
        timestamp: Date.now(),
      });

      // Announce processing start
      a11y.announceStatus("Processing request", "polite");

      // Process request
      await this.requestProcessor.processRequest(inputText);
    } catch (error) {
      logError("UIController: Error in process click handler:", error);
      logError("UIController: Error stack:", error.stack);
      a11y.announceStatus("Error occurred during processing", "assertive");
    } finally {
      logDebug("UIController: Resetting processing state...");
      // Reset processing state
      this.inputHandler.setProcessing(false);

      // Return focus to input without scrolling
      this.inputHandler.focus();
      logDebug("UIController: Process click handling complete");
    }
  }

  /**
   * Handle results display with enhanced debug support
   * @param {string} content - Content to display
   */
  handleResults(content) {
    // Check debug container before updating results
    const debugContainer = document.getElementById("response-debug-container");
    logDebug("UIController: Debug container status before updating results:", {
      debugModeEnabled: this.resultsManager.debugMode,
      debugContainerExists: !!debugContainer,
      debugContainerVisible: debugContainer
        ? debugContainer.style.display !== "none"
        : false,
      streamingMode: this.getStreamingMode(),
    });

    this.resultsManager.updateResults(content, {
      scrollBehavior: "smooth",
      announcement: "New AI response received",
    });

    // Check debug container after updating results
    const debugContainerAfter = document.getElementById(
      "response-debug-container"
    );
    const rawResponse = document.getElementById("raw-response");
    const formattedResponse = document.getElementById("formatted-response");

    logDebug("UIController: Debug container status after updating results:", {
      debugModeEnabled: this.resultsManager.debugMode,
      debugContainerExists: !!debugContainerAfter,
      debugContainerVisible: debugContainerAfter
        ? debugContainerAfter.style.display !== "none"
        : false,
      rawResponseExists: !!rawResponse,
      rawResponseHasContent: rawResponse ? !!rawResponse.textContent : false,
      rawResponseLength: rawResponse ? rawResponse.textContent.length : 0,
      formattedResponseExists: !!formattedResponse,
      formattedResponseHasContent: formattedResponse
        ? !!formattedResponse.innerHTML
        : false,
      formattedResponseLength: formattedResponse
        ? formattedResponse.innerHTML.length
        : 0,
    });

    // If debug mode is enabled but container doesn't exist, try to force create it
    if (this.resultsManager.debugMode && !debugContainerAfter) {
      logWarn(
        "UIController: Debug mode is enabled but container doesn't exist, forcing creation"
      );
      this.resultsManager.setDebugMode(true);
    }
  }

  /**
   * Get streaming mode information for display
   * @returns {Object} Streaming mode information
   */
  getStreamingModeInfo() {
    const mode = this.getStreamingMode();
    const info = {
      mode: mode,
      isStreaming: mode !== "none",
      description: "",
    };

    switch (mode) {
      case "none":
        info.description = "No streaming - wait for complete response";
        break;
      case "standard":
        info.description = "Standard streaming - plain text while generating";
        break;
      default:
        info.description = `Unknown mode: ${mode}`;
    }

    return info;
  }

  /**
   * Update streaming mode programmatically
   * @param {string} mode - New streaming mode ('none' or 'standard')
   */
  setStreamingMode(mode) {
    const validModes = ["none", "standard"];
    if (!validModes.includes(mode)) {
      logWarn(`UIController: Invalid streaming mode: ${mode}`);
      return false;
    }

    const radio = document.querySelector(
      `input[name="streaming-mode"][value="${mode}"]`
    );
    if (radio) {
      radio.checked = true;

      logInfo(`UIController: Streaming mode set to: ${mode}`);

      // Announce change
      const modeInfo = this.getStreamingModeInfo();
      a11y.announceStatus(
        `Streaming mode changed to ${modeInfo.description}`,
        "polite"
      );

      return true;
    } else {
      logWarn(
        `UIController: Streaming mode radio button not found for mode: ${mode}`
      );
      return false;
    }
  }

  /**
   * File upload state management
   */
  initFileUploadState() {
    this.fileUploadState = {
      hasFile: false,
      currentFile: null,
      fileType: null,
      costEstimate: null,
      processingEngine: null,
      responseWarnings: {
        sizeWarning: false,
        costWarning: "none",
      },
    };

    logInfo("UIController: File upload state initialised");
  }

  /**
   * Update file upload state
   * @param {Object} newState - State updates to apply
   */
  updateFileUploadState(newState) {
    // Recursion guard to prevent infinite loops
    if (this._updatingFileUploadState) {
      logWarn("UIController: Preventing recursive updateFileUploadState call");
      return;
    }

    this._updatingFileUploadState = true;

    try {
      Object.assign(this.fileUploadState, newState);

      // Emit state change event
      window.dispatchEvent(
        new CustomEvent("file-upload-state-changed", {
          detail: this.fileUploadState,
        })
      );

      logDebug("UIController: File upload state updated", this.fileUploadState);
    } finally {
      this._updatingFileUploadState = false;
    }
  }

  /**
   * Internal state update without event emission (prevents circular events)
   * @param {Object} newState - State updates to apply
   */
  updateFileUploadStateInternal(newState) {
    Object.assign(this.fileUploadState, newState);
    logDebug(
      "UIController: File upload state updated internally",
      this.fileUploadState
    );

    // Only emit to other components that need to know (not back to file handler)
    window.dispatchEvent(
      new CustomEvent("ui-file-state-updated", {
        detail: this.fileUploadState,
      })
    );
  }

  /**
   * Get current file upload state
   * @returns {Object} Current file upload state
   */
  getFileUploadState() {
    return { ...this.fileUploadState };
  }

  /**
   * Reset file upload state
   */
  resetFileUploadState() {
    this.updateFileUploadState({
      hasFile: false,
      currentFile: null,
      fileType: null,
      costEstimate: null,
      processingEngine: null,
      responseWarnings: {
        sizeWarning: false,
        costWarning: "none",
      },
    });

    logInfo("UIController: File upload state reset");
  }

  /**
   * Clean up resources when the controller is no longer needed
   */
  destroy() {
    logInfo("UIController: Starting cleanup...");

    // Clean up motion preference watcher
    if (this.motionWatcher && typeof this.motionWatcher === "function") {
      this.motionWatcher();
      this.motionWatcher = null;
    }

    // Clean up streaming mode listeners
    const streamingRadios = document.querySelectorAll(
      'input[name="streaming-mode"]'
    );
    streamingRadios.forEach((radio) => {
      radio.removeEventListener("change", this.handleStreamingModeChange);
    });

    // Clean up results manager
    if (
      this.resultsManager &&
      typeof this.resultsManager.destroy === "function"
    ) {
      this.resultsManager.destroy();
    }

    logInfo("UIController: Cleanup complete");
  }
}

export const uiController = new UIController();

// Diagnostic: Verify export succeeded
console.log("🔍 UI-CONTROLLER.JS: Export successful", {
  uiControllerExists: !!uiController,
  inputHandlerExists: !!uiController.inputHandler,
});
