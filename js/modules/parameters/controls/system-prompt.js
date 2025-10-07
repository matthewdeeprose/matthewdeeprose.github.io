import { ParameterBase } from "../base/parameter-base.js";
import { a11y } from "../../../accessibility-helpers.js";
/**
 * @fileoverview System Prompt Parameter Control
 * Manages system prompt input with token tracking, preset management,
 * and accessibility features using the modular token counter system.
 */

import { tokenCounter } from "../../../token-counter/token-counter-index.js";

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

export class SystemPromptParameter extends ParameterBase {
  constructor() {
    super({
      id: "system-prompt",
      name: "System Instructions",
      description:
        "Provide context and instructions for how the AI should behave.",
      validation: {
        maxLength: 2000,
        minLength: 0,
      },
      defaultValue: "",
    });

    // Additional state management
    this.lastUsedPreset = null;
    this.hasUnsavedChanges = false;
    this.tokenUpdateTimeout = null;
    this.currentRequestId = null;
    this.fallbackMode = false; // Add this flag to track if we're in fallback mode

    // Additional element references
    this.elements.tokenCountDisplay = null;
    this.elements.presetSelect = null;

    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  /**
   * Check if logging should occur based on current level
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments
   */
  logError(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  logWarn(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {...any} args - Additional arguments
   */
  logInfo(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  logDebug(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  /**
   * Initialize the parameter
   * @param {HTMLElement} container - Container element for the parameter
   */
  async initialize(container) {
    this.logInfo("SystemPromptParameter: Starting initialisation");

    if (!container) {
      this.logError("SystemPromptParameter: Container is null");
      return;
    }

    // Create a wrapper div for this parameter if not already created
    let wrapper = document.createElement("div");
    wrapper.className = "parameter-control system-prompt-container";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-labelledby", `${this.id}-label`);

    // Store references
    this.elements.container = container;
    this.elements.wrapper = wrapper;

    // Add wrapper to container first
    container.appendChild(wrapper);

    this.logDebug("SystemPromptParameter: Container and wrapper initialised");

    // Now render the component with the wrapper in place
    await this.render();

    // Set up event listeners after rendering
    this.setupEventListeners();

    this.logInfo("SystemPromptParameter: Initialised successfully");
  }

  /**
   * Render the parameter template
   */
  async render() {
    this.logDebug("SystemPromptParameter: Starting render");

    if (!this.elements.wrapper) {
      this.logError("SystemPromptParameter: Wrapper element is missing");
      return;
    }

    const template = `
      <div class="control-header">
        <label id="${this.id}-label" for="${this.id}">System Instructions</label>
      </div>
      <textarea 
        id="${this.id}"
        rows="3"
        aria-describedby="${this.id}-description ${this.id}-token-count"
        class="system-prompt-input"
      >${this.defaultValue}</textarea>
      <div id="${this.id}-token-count" class="token-count" aria-live="polite"></div>
      <div id="${this.id}-description" class="parameter-description" aria-live="polite">
        ${this.description}
      </div>
      <div class="preset-prompts">
        <label for="preset-select" class="preset-label sr-only">Choose a preset prompt:</label>
        <select id="preset-select" class="preset-select" aria-describedby="${this.id}-description">
          <option value="">-- Select a preset --</option>
        </select>
        <button 
          type="button" 
          class="preset-button clear-prompt" 
          aria-label="Clear system prompt"
          id="clear-system-prompt">
          Clear Prompt
        </button>
      </div>`;

    this.elements.wrapper.innerHTML = template;

    // Store element references
    this.elements.control = this.elements.wrapper.querySelector(`#${this.id}`);
    this.elements.description = this.elements.wrapper.querySelector(
      `#${this.id}-description`
    );
    this.elements.presetsContainer =
      this.elements.wrapper.querySelector(".preset-prompts");
    this.elements.tokenCountDisplay = this.elements.wrapper.querySelector(
      `#${this.id}-token-count`
    );
    this.elements.presetSelect =
      this.elements.wrapper.querySelector("#preset-select");

    // Verify elements were found
    this.logDebug("SystemPromptParameter: Element references set", {
      control: !!this.elements.control,
      description: !!this.elements.description,
      presetsContainer: !!this.elements.presetsContainer,
      tokenCountDisplay: !!this.elements.tokenCountDisplay,
      presetSelect: !!this.elements.presetSelect,
    });

    // Restore saved prompt if exists
    const savedPrompt = localStorage.getItem("lastSystemPrompt");
    if (savedPrompt && this.elements.control) {
      this.elements.control.value = savedPrompt;
      this.value = savedPrompt;
    }

    // Load and render preset buttons
    await this.loadPresets();

    this.logDebug("SystemPromptParameter: Render complete");
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.logDebug("SystemPromptParameter: Setting up event listeners");

    // Call parent's setupEventListeners if needed
    if (typeof super.setupEventListeners === "function") {
      super.setupEventListeners();
    }

    if (this.elements.control) {
      // Add keyboard shortcut handling
      this.elements.control.addEventListener("keydown", this.handleKeyDown);

      // Add token counting and description updates
      this.elements.control.addEventListener("input", () => {
        this.hasUnsavedChanges = true;

        // If text differs from last preset, clear the active state
        if (
          this.lastUsedPreset &&
          this.elements.control.value !== this.lastUsedPreset.text
        ) {
          this.clearActivePreset();
        }

        // Update description based on current content
        if (this.elements.description) {
          const currentContent = this.elements.control.value;
          const description = this.getValueDescription(currentContent);
          this.elements.description.textContent = description;
        }

        // Debounce token counting
        clearTimeout(this.tokenUpdateTimeout);
        this.tokenUpdateTimeout = setTimeout(() => {
          this.updateTokenCount();
        }, 300);
      });

      // Add clear button functionality
      const clearButton = this.elements.wrapper.querySelector(
        "#clear-system-prompt"
      );
      if (clearButton) {
        clearButton.addEventListener("click", () => {
          if (this.elements.control) {
            // Clear the textarea
            this.elements.control.value = "";
            this.value = "";
            this.hasUnsavedChanges = true;

            // Force a complete reset of token count by also resetting the request ID
            this.currentRequestId = null;

            // Clear any HTML nodes inside tokenCountDisplay for complete reset
            if (this.elements.tokenCountDisplay) {
              this.elements.tokenCountDisplay.innerHTML = `<span class="token-count-number">0</span> <span class="token-count-label">tokens (0% of limit)</span>`;
              this.elements.tokenCountDisplay.setAttribute(
                "aria-label",
                "System prompt contains 0 tokens, 0% of maximum allowed"
              );
            }

            // Clear active preset states
            this.clearActivePreset();

            // Update description
            if (this.elements.description) {
              const description = this.getValueDescription("");
              this.elements.description.textContent = description;
            }

            // Update token count
            this.updateTokenCount();

            // Announce to screen readers
            a11y.announceStatus("System prompt cleared");

            // Focus back to textarea
            this.elements.control.focus();
          }
        });

        // Add keyboard support
        clearButton.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clearButton.click();
          }
        });
      }
    }

    // Set up listeners for max tokens changes after DOM is ready
    setTimeout(() => {
      this.listenForMaxTokenChanges();
    }, 100);

    // Add local storage persistence
    window.addEventListener("beforeunload", this.handleBeforeUnload);

    this.logDebug("SystemPromptParameter: Event listeners setup complete");
  }

  /**
   * Add listeners for max tokens changes
   */
  listenForMaxTokenChanges() {
    this.logDebug(
      "SystemPromptParameter: Setting up max token change listeners"
    );

    // Find the max tokens slider and number input
    const maxTokensSlider = document.getElementById("max-tokens-slider");
    const maxTokensNumber = document.getElementById("max-tokens-number");

    if (maxTokensSlider) {
      maxTokensSlider.addEventListener("change", () => {
        this.logDebug("Max tokens slider changed");
        // Reset request ID to force recalculation with new context
        this.currentRequestId = null;
        // Update token count with the new max token limit
        this.updateTokenCount();
      });
    } else {
      this.logWarn("Max tokens slider element not found");
    }

    if (maxTokensNumber) {
      maxTokensNumber.addEventListener("change", () => {
        this.logDebug("Max tokens number input changed");
        // Reset request ID to force recalculation with new context
        this.currentRequestId = null;
        // Update token count with the new max token limit
        this.updateTokenCount();
      });
    } else {
      this.logWarn("Max tokens number input element not found");
    }

    // Also listen for model changes
    const modelSelect = document.getElementById("model-select");
    if (modelSelect) {
      modelSelect.addEventListener("change", () => {
        this.logDebug("Model selection changed");
        // Reset request ID to force recalculation with new model context
        this.currentRequestId = null;
        // Update token count with the new model context
        this.updateTokenCount();
      });
    } else {
      this.logWarn("Model select element not found");
    }
  }

  /**
   * Get the current model
   * @returns {string|null} Current model or null
   */
  getCurrentModel() {
    const modelSelect = document.getElementById("model-select");
    if (modelSelect && modelSelect.value) {
      try {
        return modelSelect.value;
      } catch (error) {
        this.logWarn("Error getting current model:", error);
        return null;
      }
    }
    return null;
  }

  /**
   * Update control state based on model
   * @param {string} model - Model identifier
   * @returns {boolean} Success indicator
   */
  updateControlState(model) {
    this.logDebug(
      "SystemPromptParameter: Updating control state for model:",
      model
    );
    // Basic implementation that doesn't break initialization
    return true;
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    // Allow Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const submitButton = document.querySelector("#process-btn");
      if (submitButton && !submitButton.disabled) {
        submitButton.click();
      }
    }
  }

  /**
   * Handle beforeunload event
   */
  handleBeforeUnload() {
    if (this.hasUnsavedChanges && this.elements.control) {
      localStorage.setItem("lastSystemPrompt", this.elements.control.value);
    }
  }

  /**
   * Update token count display
   */
  async updateTokenCount() {
    if (!this.elements.control || !this.elements.tokenCountDisplay) {
      this.logWarn(
        "SystemPromptParameter: Control or token display element missing"
      );
      return;
    }

    const content = this.elements.control.value.trim();

    // If content is completely empty, show zero tokens immediately
    if (!content) {
      this.elements.tokenCountDisplay.innerHTML = `
        <span class="token-count-number">0</span>
        <span class="token-count-label">tokens (0% of limit)</span>
      `;
      this.elements.tokenCountDisplay.setAttribute(
        "aria-label",
        "System prompt contains 0 tokens, 0% of maximum allowed"
      );
      return;
    }

    // Check if token counter is available
    if (typeof tokenCounter === "undefined") {
      this.logWarn("TokenCounter not available, using fallback");
      this.showFallbackTokenCount(content);
      return;
    }

    try {
      // Only attempt to use tokenCounter if we have a request in progress
      // Check if we already have a request ID or can safely generate one
      if (!this.currentRequestId) {
        try {
          this.currentRequestId = tokenCounter.generateRequestId();
        } catch (err) {
          // If we can't even generate a request ID, use fallback
          this.logWarn("Could not generate request ID:", err);
          this.showFallbackTokenCount(content);
          return;
        }
      }

      // Get max tokens value to calculate percentage correctly
      const maxTokensElement = document.getElementById("max-tokens-number");
      const maxTokensValue = maxTokensElement
        ? parseInt(maxTokensElement.value || "4096")
        : 4096;

      this.logDebug("Using max tokens value:", maxTokensValue);

      // Safely try to track tokens
      let tokenInfo;
      try {
        tokenInfo = tokenCounter.trackSystemPrompt(
          this.currentRequestId,
          content
        );

        // Update maxAllowed to reflect current token settings
        tokenInfo.maxAllowed = maxTokensValue;
      } catch (trackError) {
        // If tracking fails, use our fallback
        this.logWarn("Token tracking failed:", trackError);
        this.showFallbackTokenCount(content);
        return;
      }

      // If we have token info, display it
      if (tokenInfo) {
        const percentUsed = Math.round(
          (tokenInfo.estimatedTokens / tokenInfo.maxAllowed) * 100
        );
        const isNearLimit = percentUsed > 80;

        // Update display
        this.elements.tokenCountDisplay.innerHTML = `
          <span class="token-count-number ${isNearLimit ? "near-limit" : ""}">
            ${tokenInfo.estimatedTokens.toLocaleString()}
          </span>
          <span class="token-count-label">
            tokens (${percentUsed}% of limit)
          </span>
        `;

        // Update ARIA label
        this.elements.tokenCountDisplay.setAttribute(
          "aria-label",
          `System prompt using ${
            tokenInfo.estimatedTokens
          } tokens, ${percentUsed}% of maximum allowed${
            isNearLimit ? ". Warning: Approaching token limit" : ""
          }`
        );

        // Handle near-limit warning
        if (isNearLimit) {
          this.elements.tokenCountDisplay.classList.add("warning");
          a11y.announceStatus(
            "Warning: System prompt is approaching the token limit",
            "polite"
          );
        } else {
          this.elements.tokenCountDisplay.classList.remove("warning");
        }
      } else {
        // If we don't have token info, use fallback
        this.showFallbackTokenCount(content);
      }
    } catch (error) {
      // Catch-all for any other errors
      this.logWarn("Error updating token count:", error);
      this.showFallbackTokenCount(content);
    }
  }

  /**
   * Show fallback token count when tokenCounter fails
   * @param {string} content - Text content
   */
  showFallbackTokenCount(content) {
    if (!this.elements.tokenCountDisplay) return;

    // Get max tokens value
    const maxTokensElement = document.getElementById("max-tokens-number");
    const maxAllowed = maxTokensElement
      ? parseInt(maxTokensElement.value || "4096")
      : 4096;

    // If content is empty, show zero tokens
    if (!content.trim()) {
      this.elements.tokenCountDisplay.innerHTML = `
        <span class="token-count-number">0</span>
        <span class="token-count-label">tokens (0% of limit)</span>
      `;
      this.elements.tokenCountDisplay.setAttribute(
        "aria-label",
        "System prompt contains 0 tokens, 0% of maximum allowed"
      );
      return;
    }

    // Simple estimation: approximately 4 characters per token on average
    const estimatedTokens = Math.round(content.length / 4);
    const percentUsed = Math.round((estimatedTokens / maxAllowed) * 100);
    const isNearLimit = percentUsed > 80;

    // Show fallback estimation
    this.elements.tokenCountDisplay.innerHTML = `
      <span class="token-count-estimate ${isNearLimit ? "near-limit" : ""}">
        ~${estimatedTokens.toLocaleString()} tokens (${percentUsed}% of limit)
      </span>
    `;

    this.elements.tokenCountDisplay.setAttribute(
      "aria-label",
      `Approximately ${estimatedTokens} tokens estimated, ${percentUsed}% of limit. ${
        isNearLimit ? "Warning: Approaching estimated token limit." : ""
      }`
    );

    // Handle near-limit warning for fallback estimation
    if (isNearLimit) {
      this.elements.tokenCountDisplay.classList.add("warning");
    } else {
      this.elements.tokenCountDisplay.classList.remove("warning");
    }

    // Reset request ID for next attempt
    this.currentRequestId = null;
  }

  /**
   * Load preset prompts
   */
  async loadPresets() {
    try {
      this.logInfo("SystemPromptParameter: Loading system prompt presets...");
      const response = await fetch("/presets/system-prompts.json");

      if (!response.ok) {
        throw new Error(
          `Failed to load presets: ${response.status} ${response.statusText}`
        );
      }

      const presets = await response.json();
      this.logDebug("SystemPromptParameter: Loaded presets:", presets);

      if (!presets?.prompts?.length) {
        throw new Error("Invalid presets data structure");
      }

      this.renderPresetButtons(presets.prompts);
    } catch (error) {
      this.logError("SystemPromptParameter: Error loading presets:", error);
      this.handleError(error);
      // Render fallback presets
      this.renderPresetButtons([
        {
          label: "General Assistant",
          text: "You are a helpful, friendly AI assistant focused on providing clear and accurate information.",
        },
        {
          label: "Technical Writer",
          text: "You are a technical writer creating clear, accessible documentation. Use plain language, clear headings, and logical structure.",
        },
      ]);
    }
  }

  /**
   * Handle preset loading errors
   * @param {Error} error - Error object
   */
  handleError(error) {
    const message =
      "Unable to load system prompt presets. You can still enter custom prompts.";
    a11y.announceStatus(message, "assertive");

    if (this.elements.presetsContainer) {
      this.elements.presetsContainer.innerHTML = `
        <p class="error-message">${message}</p>
      `;
    }
  }

  /**
   * Clear active preset selection
   */
  clearActivePreset() {
    this.lastUsedPreset = null;
    if (this.elements.presetsContainer) {
      const buttons =
        this.elements.presetsContainer.querySelectorAll(".preset-button");
      buttons.forEach((button) => {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      });
    }
  }

  /**
   * Render preset buttons
   * @param {Array} prompts - Preset prompts array
   */
  renderPresetButtons(prompts) {
    // Use our stored reference instead of finding the select again
    const select = this.elements.presetSelect;
    if (!select) {
      this.logWarn("SystemPromptParameter: Preset select element not found", {
        elements: this.elements,
        wrapper: this.elements.wrapper?.innerHTML,
      });
      return;
    }

    // Clear any existing options except the first default one
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Sort prompts alphabetically by label
    const sortedPrompts = [...prompts].sort((a, b) => {
      return a.label.localeCompare(b.label, "en-GB", { sensitivity: "base" });
    });

    // Add presets as options
    sortedPrompts.forEach((prompt) => {
      const option = document.createElement("option");
      option.value = prompt.text;
      option.textContent = prompt.label;
      select.appendChild(option);
    });

    // Add change event listener
    select.addEventListener("change", (e) => {
      if (this.elements.control) {
        const selectedValue = e.target.value;

        // Update textarea with selected preset
        this.elements.control.value = selectedValue;
        this.value = selectedValue;
        this.hasUnsavedChanges = true;

        // Trigger input event to ensure value is registered
        const event = new Event("input", { bubbles: true });
        this.elements.control.dispatchEvent(event);

        // Update token count
        this.updateTokenCount();

        // Announce for screen readers
        const selectedOption = e.target.options[e.target.selectedIndex];
        a11y.announceStatus(`Applied ${selectedOption.textContent} preset`);

        // Focus the textarea for immediate editing
        this.elements.control?.focus();
      }
    });

    this.logDebug("SystemPromptParameter: Presets loaded:", {
      numberOfPresets: prompts.length,
      selectOptions: select.options.length,
    });
  }

  /**
   * Get description based on value length
   * @param {string} value - Parameter value
   * @returns {string} Description
   */
  getValueDescription(value) {
    const length = value?.length || 0;

    if (length === 0) {
      return "No system instructions provided. The AI will use default behaviour.";
    }

    if (length < 50) {
      return "Brief system instructions provided. Consider adding more detail for better results.";
    }

    if (length < 200) {
      return "Moderate system instructions provided. Good for basic task guidance.";
    }

    if (length < 500) {
      return "Detailed system instructions provided. Good balance of detail and conciseness.";
    }

    if (length < 1000) {
      return "Very detailed system instructions provided. Consider token usage.";
    }

    return "Extensive system instructions provided. Consider reducing length to optimise token usage.";
  }

  /**
   * Validate parameter value
   * @param {string} value - Value to validate
   * @returns {string} Validated value
   */
  validateValue(value) {
    if (!value) return "";

    if (typeof value !== "string") {
      return String(value);
    }

    // Trim if exceeds maxLength
    if (value.length > this.validation.maxLength) {
      return value.slice(0, this.validation.maxLength);
    }

    return value;
  }

  /**
   * Get current parameter value
   * @returns {string} Current value
   */
  getValue() {
    return this.value;
  }

  /**
   * Cleanup method to remove event listeners
   */
  destroy() {
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    if (this.elements.control) {
      this.elements.control.removeEventListener("keydown", this.handleKeyDown);
    }
  }
}
