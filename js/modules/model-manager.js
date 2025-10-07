// js/modules/model-manager.js

// Import helper functions for accessibility features and the list of available AI models
import { a11y } from "../accessibility-helpers.js";
import { modelRegistry } from "../model-definitions.js";
import { parameterController } from "./parameters/parameter-controller.js";

// The ModelManager class handles everything related to AI model selection and display
export class ModelManager {
  constructor() {
    // Logging configuration (within class scope)
    this.LOG_LEVELS = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    };

    this.DEFAULT_LOG_LEVEL = this.LOG_LEVELS.WARN;
    this.ENABLE_ALL_LOGGING = false;
    this.DISABLE_ALL_LOGGING = false;

    // Current logging configuration
    this.currentLogLevel = this.DEFAULT_LOG_LEVEL;

    // Wait for DOM content to be loaded before initialisation
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.initialize());
    } else {
      this.initialize();
    }
  }

  // Helper function to check if logging should occur based on current level
  shouldLog(level) {
    if (this.DISABLE_ALL_LOGGING) return false;
    if (this.ENABLE_ALL_LOGGING) return true;
    return level <= this.currentLogLevel;
  }

  // Logging helper methods
  logError(message, ...args) {
    if (this.shouldLog(this.LOG_LEVELS.ERROR)) {
      console.error(`ModelManager [ERROR]: ${message}`, ...args);
    }
  }

  logWarn(message, ...args) {
    if (this.shouldLog(this.LOG_LEVELS.WARN)) {
      console.warn(`ModelManager [WARN]: ${message}`, ...args);
    }
  }

  logInfo(message, ...args) {
    if (this.shouldLog(this.LOG_LEVELS.INFO)) {
      console.log(`ModelManager [INFO]: ${message}`, ...args);
    }
  }

  logDebug(message, ...args) {
    if (this.shouldLog(this.LOG_LEVELS.DEBUG)) {
      console.log(`ModelManager [DEBUG]: ${message}`, ...args);
    }
  }

  // Public method to configure logging level
  setLogLevel(level) {
    if (typeof level === "string") {
      level = this.LOG_LEVELS[level.toUpperCase()];
    }
    if (level >= 0 && level <= 3) {
      this.currentLogLevel = level;
      this.logInfo(`Logging level set to ${level}`);
    } else {
      this.logWarn(`Invalid logging level: ${level}`);
    }
  }

  initialize() {
    this.logInfo("Starting initialisation...");

    // Add this check at the start
    if (!parameterController.initialized) {
      this.logDebug("Waiting for ParameterController to initialise...");
      // Wait for next frame when ParameterController should be initialised
      requestAnimationFrame(() => {
        this.logDebug("Retrying initialisation...");
        this.initialize();
      });
      return;
    }

    // Now continue with existing initialisation
    this.logDebug("About to populate model select");
    this.populateModelSelect();
    this.setupKeyboardNavigation();

    // Update parameters for initial model
    this.logDebug("Scheduling parameter update for initial model");
    requestAnimationFrame(() => {
      const currentModel = this.getCurrentModel();
      if (currentModel) {
        const modelDetails = modelRegistry.getModel(currentModel);
        if (modelDetails) {
          parameterController.updateParametersForModel(modelDetails);
        }
      }
    });

    this.logInfo("Initialisation complete");
  }

  // Set up keyboard navigation for the model interface
  setupKeyboardNavigation() {
    const modelSelect = document.getElementById("model-select");
    if (!modelSelect) {
      this.logWarn(
        "Model select element not found during keyboard navigation setup"
      );
      return;
    }

    this.logDebug("Setting up keyboard navigation for model select");

    // Add keyboard support for the model select
    a11y.addKeyboardSupport(
      modelSelect,
      {
        Enter: () => this.updateModelInfo(modelSelect.value),
        Space: () => this.updateModelInfo(modelSelect.value),
        ArrowUp: () => this.handleModelNavigation("prev"),
        ArrowDown: () => this.handleModelNavigation("next"),
      },
      {
        announceActions: true,
      }
    );

    this.logInfo("Keyboard navigation configured successfully");
  }

  // Handle keyboard navigation through models
  handleModelNavigation(direction) {
    const modelSelect = document.getElementById("model-select");
    if (!modelSelect) {
      this.logWarn("Model select element not found during navigation");
      return;
    }

    const currentIndex = modelSelect.selectedIndex;
    const options = modelSelect.options;

    let newIndex =
      direction === "prev"
        ? Math.max(0, currentIndex - 1)
        : Math.min(options.length - 1, currentIndex + 1);

    this.logDebug(
      `Navigating from model index ${currentIndex} to ${newIndex} (${direction})`
    );

    modelSelect.selectedIndex = newIndex;
    this.updateModelInfo(options[newIndex].value);
  }

  // This function handles notifications when the AI model changes automatically
  showModelChangeNotification(originalModel, newModel, error = null) {
    let changeReason = "availability";
    if (error) {
      if (error.status === 429) {
        changeReason = "rate_limit";
      } else if (error.metadata?.quota_exceeded) {
        changeReason = "quota_exceeded";
      } else if (error.metadata?.model_unavailable) {
        changeReason = "availability";
      }
    }

    this.logInfo(
      `Model automatically changed from ${originalModel} to ${newModel} due to ${changeReason}`
    );

    if (error) {
      this.logWarn("Model change triggered by error:", {
        status: error.status,
        metadata: error.metadata,
        message: error.message,
      });
    }

    const modelSelect = document.getElementById("model-select");
    if (modelSelect) {
      modelSelect.value = newModel;

      // Update the display and announce the change
      this.updateModelInfo(newModel, "automatic", changeReason);

      // Set focus to the model select and announce the change
      a11y.focusElement("model-select", {
        announce: true,
        message: `Model automatically changed to ${
          modelRegistry.getModel(newModel).name
        }`,
      });
    } else {
      this.logWarn(
        "Model select element not found during automatic model change"
      );
    }

    // Log information for debugging
    this.logDebug("Model change details:", {
      from: originalModel,
      to: newModel,
      reason: changeReason,
      error: error
        ? {
            status: error.status,
            metadata: error.metadata,
            message: error.message,
          }
        : null,
    });
  }

  // Updates the display to show information about the currently selected model
  updateModelInfo(model, changeType = "user_selection", changeReason = null) {
    this.logDebug("Updating model info:", {
      model,
      changeType,
      changeReason,
    });

    const modelInfo = document.querySelector(".model-info");
    const processingStatus = document.querySelector(".processing-status");

    if (!modelInfo) {
      this.logWarn("Model info element not found during model info update");
    }

    // Update parameter controls for the new model
    const modelDetails = modelRegistry.getModel(model);
    if (modelDetails) {
      this.logDebug(`Updating parameters for model: ${modelDetails.name}`);
      parameterController.updateParametersForModel(modelDetails);
    } else {
      this.logWarn(`Model details not found for model: ${model}`);
    }

    if (modelInfo) {
      const modelSelectElement = document.getElementById("model-select");
      if (!modelSelectElement) {
        this.logWarn("Model select element not found during info update");
        return;
      }

      const selectedOption = Array.from(modelSelectElement.options).find(
        (option) => option.value === model
      );

      if (selectedOption) {
        const description = selectedOption.getAttribute("aria-description");
        const modelName = selectedOption.textContent;
        const modelDetails = modelRegistry.getModel(model);

        let content = document.createElement("div");
        let infoText;
        let statusText = "";

        if (changeType === "user_selection") {
          infoText = `Selected: ${modelName}${
            description ? ` (${description})` : ""
          }`;
          this.logInfo(`User selected model: ${modelName}`);
        } else if (changeType === "automatic") {
          const reasonText =
            {
              rate_limit: "rate limit reached",
              availability: "model unavailable",
              quota_exceeded: "quota exceeded",
            }[changeReason] || "system requirements";

          infoText = `Current model: ${modelName}`;
          statusText = `Automatically changed to ${modelName} due to ${reasonText}`;
          this.logInfo(
            `Model automatically changed to ${modelName} due to ${reasonText}`
          );
        }

        content.innerHTML = `
          <p class="modelP" style="display: none"></p>
          <details>
            <summary class="modelDetailsSummary">More information about ${
              modelDetails.name
            }</summary>
            <div class="modelDetails">
              <div id="modelParameters" class="modelDetailsGranule">
                <h2 class="genAIGPTHeading">About ${modelDetails.name}</h2>
                <p class="modelP">${modelDetails.description}</p>
                <ul>
                <li>
                  <a href="https://openrouter.ai/${modelDetails.provider}/${
          model.split("/")[1]
        }"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Read more about ${
                      modelDetails.name
                    } (opens in new window)">
                    Read more about ${modelDetails.name}.
                  </a></li>
                  <li>This includes information about the privacy policies of the model's providers.</li> 
                  <li>All requests are routed through OpenRouter.</li>
                  <li>Read <a href="https://openrouter.ai/privacy">OpenRouter's privacy policy</a>.</li>
                      </ul>
              </div>
              <div id="modelCostings" class="modelDetailsGranule">      
                <h2 class="genAIGPTHeading">${modelDetails.name} Costs</h2>
                <dl class="modelCosts">
                  <dt>Input Cost:</dt>
                  <dd class="modelCostDD"><strong>$${modelDetails.costs.input.toFixed(
                    3
                  )} per 1M tokens</strong></dd>
                  <dt>Output Cost:</dt>
                  <dd class="modelCostDD"><strong>$${modelDetails.costs.output.toFixed(
                    3
                  )} per 1M tokens</strong></dd>
                  ${
                    modelDetails.costs.image
                      ? `<dt>Image Cost:</dt>
                      <dd class="modelCostDD"><strong>$${modelDetails.costs.image.toFixed(
                        3
                      )} per 1K images</strong></dd>`
                      : ""
                  }
                </dl>

                <h2 class="genAIGPTHeading">${
                  modelDetails.name
                } Supported Parameters</h2>
                <ul class="supportedParameters">
                  ${modelDetails.parameterSupport.supported
                    .map((param) => `<li>${param}</li>`)
                    .join("")}
                </ul>
              </div>
            </div>
          </details>
        `;

        // Clear existing content and append new content
        modelInfo.innerHTML = "";
        modelInfo.appendChild(content);

        this.logDebug(`Model info display updated for: ${modelName}`);

        // Handle status messages and announcements
        if (processingStatus) {
          if (changeType === "automatic" && statusText) {
            processingStatus.textContent = statusText;
            a11y.announceStatus(statusText, "assertive");
          }
        } else if (changeType === "automatic") {
          this.logWarn(
            "Processing status element not found during automatic change notification"
          );
        }

        // Announce model selection to screen readers
        if (changeType === "user_selection") {
          a11y.announceStatus(
            `Selected model: ${modelName}. ${description || ""}`,
            "polite"
          );
        }
      } else {
        this.logWarn(`Selected option not found for model: ${model}`);
      }
    }
  }

  // Creates and fills the dropdown menu with all available AI models
  populateModelSelect() {
    const modelSelect = document.getElementById("model-select");
    if (!modelSelect) {
      this.logWarn("Model select element not found during population");
      return;
    }

    this.logInfo("Populating model select dropdown");
    modelSelect.innerHTML = "";

    const createOption = (model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.name} (${model.provider})`;
      return option;
    };

    const categories = modelRegistry.getAllCategories();
    this.logDebug(`Found ${categories.length} model categories`);

    let totalModelsAdded = 0;
    categories.forEach((category) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category.name;

      const models = modelRegistry.getModelsByCategory(category.id);
      // Sort models alphabetically by name
      const sortedModels = [...models].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );

      this.logDebug(
        `Adding ${sortedModels.length} models to category: ${category.name}`
      );

      sortedModels.forEach((model) => {
        optgroup.appendChild(createOption(model));
        totalModelsAdded++;
      });

      if (optgroup.children.length > 0) {
        modelSelect.appendChild(optgroup);
      }
    });

    this.logInfo(`Model select populated with ${totalModelsAdded} models`);

    // Find and set the default model
    const allModels = modelRegistry.getAllModels
      ? modelRegistry.getAllModels()
      : [];
    const defaultModel = allModels.find((model) => model.isDefault);

    if (defaultModel) {
      modelSelect.value = defaultModel.id;
      this.logInfo(`Default model set to: ${defaultModel.name}`);
    } else if (allModels.length > 0) {
      modelSelect.value = allModels[0].id;
      this.logWarn("No default model found, using first available model");
    } else {
      this.logError("No models available to populate select");
    }

    // Set up change event listener
    modelSelect.addEventListener("change", () => {
      this.logDebug(`Model selection changed to: ${modelSelect.value}`);
      this.updateModelInfo(modelSelect.value);
    });

    // Show initial model information
    this.updateModelInfo(modelSelect.value);
  }

  // Get the currently selected model
  getCurrentModel() {
    const modelSelect = document.getElementById("model-select");
    const currentModel = modelSelect ? modelSelect.value : null;

    if (!currentModel) {
      this.logWarn(
        "No current model selected or model select element not found"
      );
    }

    return currentModel;
  }
}
