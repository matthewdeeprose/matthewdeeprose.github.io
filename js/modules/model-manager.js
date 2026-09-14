// js/modules/model-manager.js

// Import helper functions for accessibility features and the list of available AI models
import { a11y } from "../accessibility-helpers.js";
import { modelRegistry } from "../model-definitions.js";
import { parameterController } from "./parameters/parameter-controller.js";

// --- The promotional-price marker ------------------------------------------------------
//
// THIS FILE OWNS BOTH SURFACES ON THE LIVE JOURNEY, which is not obvious from reading it.
// js/enhanced-model-selection.js also builds picker options and also updates #modelCostings,
// and both of those paths exist and are correct — but measured on 10 September 2026 by
// driving tools.html, the options a user actually sees and the panel they actually read are
// the ones built HERE. Marking only the other file leaves every line looking right and the
// browser showing nothing.
//
// The WORDING lives in js/pricing-display.js, once, because three surfaces show a model price
// in three module styles and a copy per surface is three chances for them to drift apart.
// Resolved at call time and never cached: that plain script is loaded before this deferred
// module, so the global is present, and a cached reference taken at module scope would be the
// dead-announcement pattern this codebase has already paid for.


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
        Enter: () => this.updateModelInfo(modelSelect.value, "user_selection"),
        Space: () => this.updateModelInfo(modelSelect.value, "user_selection"),
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
    this.updateModelInfo(options[newIndex].value, "user_selection");
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

  // Updates the display to show information about the currently selected model.
  //
  // changeType defaults to "programmatic" — the SILENT branch — deliberately.
  // It used to default to "user_selection", the one value that announces, so
  // populateModelSelect()'s initial call below said "Selected model: X" on every
  // page load while claiming the user had chosen it. A caller that announces by
  // default makes every future caller announce unless it remembers not to; the
  // four genuinely user-initiated paths now say so explicitly.
  updateModelInfo(model, changeType = "programmatic", changeReason = null) {
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
                  ${this._costLinesHTML(modelDetails.costs)}
                </dl>
                ${this._promotionNoticeHTML(modelDetails)}

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

  /**
   * The short marker for a picker option, or "". Delegates to js/pricing-display.js.
   * @param {Object} model - a registry model
   * @returns {string}
   */
  _promotionalMarker(model) {
    const pricing = window.PricingDisplay;
    if (!pricing) {
      // LOUD, not silent. A missing helper means a temporary price is shown as if it were
      // permanent, which is the defect this whole feature exists to prevent.
      this.logError(
        "window.PricingDisplay is unavailable — promotional prices will not be marked in the picker"
      );
      return "";
    }
    return pricing.markerFor(model && model.metadata);
  }

  /**
   * The promotional notice for the information panel as HTML, or "".
   *
   * This panel is rebuilt wholesale on every model change, so the stale-notice hazard the
   * in-place updater has to handle explicitly does not arise here: a model with no promotion
   * simply renders no notice.
   *
   * @param {Object} modelDetails - a registry model
   * @returns {string}
   */
  _promotionNoticeHTML(modelDetails) {
    const pricing = window.PricingDisplay;
    if (!pricing) {
      this.logError(
        "window.PricingDisplay is unavailable — the promotional price notice will not be shown"
      );
      return "";
    }
    return pricing.noticeHTML(modelDetails && modelDetails.metadata);
  }

  /**
   * The cost lines below Input and Output: the legacy image figure, the unit-tagged meters,
   * and a short sentence saying what is NOT shown.
   *
   * WHAT THIS REPLACED, AND WHY IT MATTERS HERE RATHER THAN IN THE REGISTRY. This panel used
   * to render `costs.image` as "$X per 1K images". Measured 11 September 2026, that label is
   * wrong for 10 of the field's 46 non-zero entries and right for about 35 — the field is
   * mixed-unit, so no single label can be correct, and one enabled entry
   * (anthropic/claude-sonnet-4.5) was showing "$4800.000 per 1K images" for a rate its own
   * comment gives as $4.80 per thousand. The wording now lives in js/pricing-display.js so
   * all three price surfaces answer the question the same way.
   *
   * @param {Object} [costs] - a registry entry's costs block
   * @returns {string}
   */
  _costLinesHTML(costs) {
    const pricing = window.PricingDisplay;
    if (!pricing) {
      this.logError(
        "window.PricingDisplay is unavailable — per-meter costs will not be shown"
      );
      return "";
    }
    return pricing.costLinesHTML(costs);
  }


  // Creates and fills the dropdown menu with all available AI models
  populateModelSelect() {
    const modelSelect = document.getElementById("model-select");
    if (!modelSelect) {
      this.logWarn("Model select element not found during population");
      return;
    }

    // Task 3.6a follow-up #3 — provider-aware skip. ModelManager's
    // initialize() waits for parameterController via requestAnimationFrame,
    // so this method routinely runs AFTER EnhancedModelSelection.init() has
    // already entered its mismatch branch (cleared dropdown, rendered notice,
    // disabled #process-btn) when the active provider isn't OpenRouter.
    // Unconditionally populating here silently overwrites that state.
    // Skip the option-population block when non-OR is active; still attach
    // the change listener so future user-driven selection — after the user
    // switches back to OR and EnhancedModelSelection's applyFilters
    // re-populates via updateModelSelect — updates the model info display.
    const activeProvider =
      window.ProviderSwitcher &&
      typeof window.ProviderSwitcher.getActive === "function"
        ? window.ProviderSwitcher.getActive()
        : "openrouter";

    if (activeProvider !== "openrouter") {
      this.logInfo(
        `Active provider '${activeProvider}' isn't OpenRouter; skipping ModelManager populate (EnhancedModelSelection owns the dropdown in mismatch state)`
      );

      modelSelect.addEventListener("change", () => {
        this.logDebug(`Model selection changed to: ${modelSelect.value}`);
        this.updateModelInfo(modelSelect.value, "user_selection");
      });

      return;
    }

    this.logInfo("Populating model select dropdown");
    modelSelect.innerHTML = "";

    // WHY THERE IS NO aria-label HERE, AND WHY THAT IS THE RIGHT OUTCOME. Options built on this
    // path carry no aria-label at all, so the accessible name IS the visible text. Adding one
    // would create two strings that have to be kept in step (SC 2.5.3 — the visible label must
    // be contained in the accessible name). Putting the marker in textContent alone means they
    // cannot diverge, because there is only one of them.
    const createOption = (model) => {
      const option = document.createElement("option");
      option.value = model.id;
      // A promotional price is temporary and the registry knows it. A picker showing only the
      // number invites someone to choose on a price that rises on an unpublished date.
      option.textContent =
        `${model.name} (${model.provider})` + this._promotionalMarker(model);
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
      this.updateModelInfo(modelSelect.value, "user_selection");
    });

    // Show initial model information. Deliberately bare: this runs at page load,
    // so it must take the silent "programmatic" default. A screen-reader user
    // arriving on the page has not chosen anything yet.
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
