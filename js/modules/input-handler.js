/**
 * @fileoverview Manages user text input and processing controls with comprehensive accessibility support.
 * This module handles input validation, button state management, and keyboard interactions for text
 * processing functionality. It maintains processing states, provides focus management, and implements
 * ARIA attributes for screen reader compatibility. The handler integrates with accessibility-helpers.js
 * and exposes a callback system for processing text input, serving as a bridge between user interactions
 * and the application's processing logic.
 *
 * @module InputHandler
 */

// js/modules/input-handler.js
import { a11y } from "../accessibility-helpers.js";

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

export class InputHandler {
  constructor() {
    this.processBtn = document.getElementById("process-btn");
    this.userInput = document.getElementById("user-input");
    this.isProcessing = false;

    // File integration preparation
    this.hasAttachedFile = false;
    this.fileCostEstimate = null;
    this.fileIntegrationReady = false;

    this.initialize();
  }

  initialize() {
    if (!this.processBtn || !this.userInput) {
      logWarn("Required input elements not found");
      return;
    }

    logInfo("InputHandler initialised successfully");

    // Focus the input field for immediate typing
    this.userInput.focus();

    // Set up event listeners
    this.userInput.addEventListener("input", this.handleInput.bind(this));
    this.processBtn.addEventListener("click", this.handleClick.bind(this));
    this.setupKeyboardSupport();

    // Initialize button state
    this.updateButtonState(this.userInput.value.trim());

    // Prepare for file integration
    this.prepareFileIntegration();

    // Notify that InputHandler is ready (for coordination with other systems)
    window.dispatchEvent(
      new CustomEvent("inputhandler-ready", {
        detail: { handler: this },
      })
    );

    logInfo(
      "[INPUT DEBUG] 🎯 InputHandler initialization complete, button state synchronized"
    );
  }

  /**
   * Get current streaming mode from radio buttons
   * @returns {string} 'none' or 'standard'
   */
  getStreamingMode() {
    const streamingRadios = document.querySelectorAll(
      'input[name="streaming-mode"]'
    );

    logDebug(
      "[INPUT DEBUG] 🔍 Checking streaming mode - found",
      streamingRadios.length,
      "radio buttons"
    );

    for (const radio of streamingRadios) {
      logDebug("[INPUT DEBUG] 📻 Radio button:", {
        value: radio.value,
        checked: radio.checked,
        name: radio.name,
      });

      if (radio.checked) {
        logDebug("[INPUT DEBUG] ✅ Selected streaming mode:", radio.value);
        return radio.value;
      }
    }

    logWarn(
      "[INPUT DEBUG] ⚠️ No streaming mode selected, defaulting to standard"
    );
    return "standard"; // Default fallback
  }

  /**
   * Check if streaming is enabled (legacy method for backward compatibility)
   * @returns {boolean} Whether streaming is enabled
   */
  isStreamingEnabled() {
    const mode = this.getStreamingMode();
    const isEnabled = mode !== "none";

    logDebug("[INPUT DEBUG] 🌊 Streaming enabled check:", {
      mode: mode,
      enabled: isEnabled,
    });

    return isEnabled;
  }

  /**
   * Handle input changes and update button state
   * @param {Event} e - Input event
   */
  handleInput(e) {
    const text = e.target.value.trim();
    this.updateButtonState(text);
  }

  /**
   * Update button state based on input
   * @param {string} text - Current input text
   */
  /**
   * Update button state based on input
   * @param {string} text - Current input text
   */
  updateButtonState(text) {
    // Defensive check - ensure button exists
    if (!this.processBtn) {
      logWarn("[INPUT DEBUG] ⚠️ Process button not found, cannot update state");
      return;
    }

    const hasText = text.length > 0;

    // Check if API key is configured (layer 1 validation)
    const hasApiKey = window.CONFIG && window.CONFIG.HAS_API_KEY;

    // Only manage button if API key exists
    // If no API key, API config system owns the button state
    if (hasApiKey === false) {
      logDebug(
        "[INPUT DEBUG] ⚠️ No API key - button state managed by config system"
      );
      return; // API config system controls button when key missing
    }

    const isDisabled = !hasText || this.isProcessing;

    // Update button state - let CSS handle visual presentation
    this.processBtn.disabled = isDisabled;

    // Update semantic CSS classes for enhanced styling hooks
    this.processBtn.classList.toggle(
      "button-enabled",
      hasText && !this.isProcessing
    );
    this.processBtn.classList.toggle(
      "button-disabled",
      !hasText || this.isProcessing
    );

    // Update accessibility attributes
    if (hasText && !this.isProcessing) {
      this.processBtn.setAttribute("aria-label", "Process text with AI");
      this.processBtn.removeAttribute("aria-disabled");
    } else {
      const message = this.isProcessing
        ? "Processing in progress"
        : "Please enter text to process";
      this.processBtn.setAttribute("aria-label", message);
      this.processBtn.setAttribute("aria-disabled", "true");
    }

    // Log state change
    logDebug("[INPUT DEBUG] 🔄 Input state updated:", {
      textLength: text.length,
      hasText,
      hasApiKey,
      isProcessing: this.isProcessing,
      buttonEnabled: !this.processBtn.disabled,
    });
  }

  /**
   * Set up keyboard support for the process button
   */
  setupKeyboardSupport() {
    // Handle keyboard events
    this.processBtn.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !this.processBtn.disabled) {
        e.preventDefault();
        logDebug("[INPUT DEBUG] ⌨️ Process button activated via keyboard");
        this.handleClick();
      }
    });

    // Add general keyboard support
    a11y.addKeyboardSupport(this.processBtn, {
      Enter: () => !this.isProcessing && this.handleClick(),
      Space: () => !this.isProcessing && this.handleClick(),
    });

    logInfo("Keyboard support configured for input handler");
  }

  /**
   * Handle process button click
   */
  handleClick() {
    logDebug("[INPUT DEBUG] 🖱️ Process button clicked");

    if (this.processBtn.disabled || this.isProcessing) {
      logDebug(
        "[INPUT DEBUG] ⛔ Button is disabled or processing, ignoring click"
      );
      return;
    }

    const inputText = this.userInput.value.trim();
    const streamingMode = this.getStreamingMode();

    logInfo("[INPUT DEBUG] 📋 Processing request details:", {
      inputLength: inputText.length,
      streamingMode: streamingMode,
      hasOnProcess: typeof this.onProcess === "function",
      hasOnStreamingProcess: typeof this.onStreamingProcess === "function",
      timestamp: Date.now(),
    });

    // Route based on streaming mode
    if (streamingMode === "none") {
      // No streaming - use standard processing
      logInfo("[INPUT DEBUG] 🔄 Routing to standard processing (no streaming)");
      if (this.onProcess) {
        this.onProcess(inputText);
      } else {
        logError("[INPUT DEBUG] ❌ No onProcess callback set!");
      }
    } else {
      // Standard streaming mode
      logInfo(
        "[INPUT DEBUG] 🌊 Routing to streaming processing, mode:",
        streamingMode
      );
      if (this.onStreamingProcess) {
        this.onStreamingProcess(inputText);
      } else {
        logError("[INPUT DEBUG] ❌ No onStreamingProcess callback set!");

        // Fallback to standard processing
        logWarn("[INPUT DEBUG] 🔄 Falling back to standard processing");
        if (this.onProcess) {
          this.onProcess(inputText);
        }
      }
    }
  }

  /**
   * Set processing state
   * @param {boolean} isProcessing - Whether processing is active
   */
  setProcessing(isProcessing) {
    logInfo("[INPUT DEBUG] ⚙️ Setting processing state:", isProcessing);

    this.isProcessing = isProcessing;
    this.processBtn.classList.toggle("processing", isProcessing);
    this.updateButtonState(this.userInput.value.trim());
  }

  /**
   * Get the current input value
   * @returns {string} Current input text
   */
  getValue() {
    return this.userInput.value.trim();
  }

  /**
   * Clear the input field
   */
  clear() {
    logInfo("[INPUT DEBUG] 🗑️ Clearing input field");
    this.userInput.value = "";
    this.updateButtonState("");
  }

  /**
   * Focus the input field
   * @param {boolean} preventScroll - Whether to prevent scrolling
   */
  focus(preventScroll = true) {
    logDebug("[INPUT DEBUG] 🎯 Focusing input field");
    this.userInput.focus({ preventScroll });
  }

  /**
   * Set callback for standard process action
   * @param {Function} callback - Function to call when standard processing should start
   */
  onProcess = null;

  /**
   * Set callback for streaming process action
   * @param {Function} callback - Function to call when streaming processing should start
   */
  onStreamingProcess = null;

  /**
   * Prepare for file input integration
   */
  prepareFileIntegration() {
    // This will be expanded in Stage 4, but we set up the hooks now
    this.fileIntegrationReady = true;

    // Listen for file upload state changes
    window.addEventListener("file-upload-state-changed", (event) => {
      this.handleFileStateChange(event.detail);
    });

    logInfo("InputHandler: Input handler prepared for file integration");
  }

  /**
   * Handle file state changes
   * @param {Object} fileState - Current file state
   */
  handleFileStateChange(fileState) {
    // Update validation logic based on file presence
    this.hasAttachedFile = fileState.hasFile;

    // Update cost awareness
    this.fileCostEstimate = fileState.costEstimate;

    // This will be expanded in later stages
    logDebug("InputHandler: File state change handled", {
      hasFile: fileState.hasFile,
    });
  }

  /**
   * Check if request can be submitted (including file validation)
   * @returns {Object} Validation result
   */
  validateSubmissionWithFiles() {
    const text = this.getValue();
    const hasText = text.length > 0;

    if (!this.hasAttachedFile) {
      return {
        valid: hasText && !this.isProcessing,
        hasFiles: false,
        fileValidation: { valid: true, warnings: [] },
      };
    }

    // File-specific validation will be added in Stage 5
    // For now, just acknowledge file presence
    return {
      valid: hasText && !this.isProcessing,
      hasFiles: true,
      fileValidation: { valid: true, warnings: [] },
    };
  }
}
