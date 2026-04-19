/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — MODEL SELECTION SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Model selection, cost estimation, persistence, and accessibility
 * polish for the Image Describer controller.
 *
 * Mixed into window.ImageDescriberController via Object.assign.
 * Must load AFTER image-describer-controller.js (core).
 *
 * VERSION: 1.0.0
 * DATE: 14 March 2026
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ControllerModel] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ControllerModel] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ControllerModel] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ControllerModel] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION (moved from core — only used by model methods)
  // ============================================================================

  const PREFERENCE_CONFIG = {
    // localStorage key for model preference
    STORAGE_KEY: "imgdesc_model_preference",

    // Preference expiry in days
    EXPIRY_DAYS: 90,

    // Schema version for future migrations
    VERSION: "1.0.0",
  };

  /**
   * Default model ID — fallback when no model is selected.
   * Mirrors CONTROLLER_CONFIG.model in the core file.
   */
  const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

  // ============================================================================
  // METHODS (mixed into ImageDescriberController)
  // ============================================================================

  const methods = {
    // ========================================================================
    // MODEL SELECTION (Stage 2)
    // ========================================================================

    /**
     * Populate the model selector dropdown from the model registry
     * Filters for vision-capable models and groups by cost tier
     * Enhanced with loading states and error handling (Stage 6)
     * @param {boolean} showAllModels - If true, show all models regardless of vision capability
     */
    populateModelSelector(showAllModels = false) {
      logInfo(`Populating model selector... (showAll: ${showAllModels})`);

      const selector = this.elements.modelSelector;
      if (!selector) {
        logWarn("Model selector element not found");
        return;
      }

      // Show loading state (Stage 6)
      this.showModelLoadingState();

      // Check for model registry
      if (!window.modelRegistry) {
        logWarn("Model registry not available - disabling model selection");
        this.handleModelRegistryError(new Error("Model registry unavailable"));
        return;
      }

      try {
        // Get all models from registry
        let allModels = [];
        if (typeof window.modelRegistry.getAllModels === "function") {
          allModels = window.modelRegistry.getAllModels();
        } else {
          logWarn("modelRegistry.getAllModels() not available");
          this.handleModelRegistryError(new Error("Cannot retrieve models"));
          return;
        }

        if (!allModels || allModels.length === 0) {
          logWarn("No models found in registry");
          this.handleModelRegistryError(new Error("No models available"));
          return;
        }

        logDebug(`Found ${allModels.length} total models in registry`);

        // Filter models based on showAllModels setting
        let filteredModels = [];

        if (showAllModels) {
          // Show all models regardless of vision capability
          filteredModels = allModels;
          logInfo(`Showing all ${filteredModels.length} models (unfiltered)`);
        } else {
          // Filter for vision-capable models
          // Try EmbedModelSelector first (more robust capability checking)
          // EmbedModelSelector is a singleton, not a class — use directly
          if (
            window.EmbedModelSelector &&
            typeof window.EmbedModelSelector.getModelsWithCapabilities ===
              "function"
          ) {
            try {
              const visionModelIds =
                window.EmbedModelSelector.getModelsWithCapabilities(["vision"]);
              filteredModels = allModels.filter((m) =>
                visionModelIds.includes(m.id),
              );
              logDebug(
                `EmbedModelSelector found ${filteredModels.length} vision models`,
              );

              // Merge in known vision models that EmbedModelSelector may have missed
              const knownVisionModels =
                this.filterVisionModelsFallback(allModels);
              const existingIds = new Set(filteredModels.map((m) => m.id));
              let mergedCount = 0;
              knownVisionModels.forEach((m) => {
                if (!existingIds.has(m.id)) {
                  filteredModels.push(m);
                  mergedCount++;
                }
              });
              if (mergedCount > 0) {
                logDebug(
                  `Merged ${mergedCount} additional known vision models (total: ${filteredModels.length})`,
                );
              }
            } catch (error) {
              logWarn("EmbedModelSelector failed, using fallback:", error);
              filteredModels = this.filterVisionModelsFallback(allModels);
            }
          } else {
            // Fallback: check model properties directly
            filteredModels = this.filterVisionModelsFallback(allModels);
          }

          if (filteredModels.length === 0) {
            logWarn("No vision-capable models found");
            this.handleModelRegistryError(
              new Error("No vision models available"),
            );
            return;
          }

          logInfo(`Found ${filteredModels.length} vision-capable models`);
        }

        // Group models by cost tier
        const groupedModels = this.groupModelsByCostTier(filteredModels);

        // Clear loading state and existing options (Stage 6)
        this.clearModelLoadingState();
        selector.innerHTML = "";

        // Create optgroups for each tier
        const tierLabels = {
          low: "💰 Low Cost (Economical)",
          medium: "⚖️ Medium Cost (Balanced)",
          high: "🚀 High Cost (Premium)",
        };

        const tierOrder = ["low", "medium", "high"];

        tierOrder.forEach((tier) => {
          const models = groupedModels[tier];
          if (!models || models.length === 0) return;

          const optgroup = document.createElement("optgroup");
          optgroup.label = tierLabels[tier];

          // Sort models alphabetically within tier
          const sortedModels = [...models].sort((a, b) =>
            (a.name || a.id).localeCompare(b.name || b.id),
          );

          sortedModels.forEach((model) => {
            const option = document.createElement("option");
            option.value = model.id;

            // Display name with provider
            const displayName = model.name || model.id.split("/").pop();
            const provider = model.provider || model.id.split("/")[0];
            option.textContent = `${displayName} (${provider})`;

            // Add data attributes for cost calculation (Stage 3)
            if (model.costs) {
              option.dataset.inputCost = model.costs.input || 0;
              option.dataset.outputCost = model.costs.output || 0;
            }
            option.dataset.provider = provider;
            option.dataset.costTier = tier;

            optgroup.appendChild(option);
          });

          selector.appendChild(optgroup);
        });

        logInfo(
          `Model selector populated with ${filteredModels.length} models in ${
            Object.keys(groupedModels).filter(
              (k) => groupedModels[k].length > 0,
            ).length
          } tiers${showAllModels ? " (showing all)" : " (vision only)"}`,
        );

        // Bind change event
        selector.addEventListener("change", () => this.onModelChange());

        // Restore preference or set default (Stage 4 stub will handle this)
        this.restoreModelPreference();

        // Update cost estimate for initial selection
        this.updateCostEstimate();
      } catch (error) {
        // Enhanced error handling (Stage 6)
        this.handleModelRegistryError(error);
      }
    },

    /**
     * Fallback method to filter vision models when EmbedModelSelector unavailable
     * @param {Array} models - All models from registry
     * @returns {Array} Vision-capable models
     */
    filterVisionModelsFallback(models) {
      // Known vision-capable models that OpenRouter may not flag correctly
      // These are confirmed to support image input
      const KNOWN_VISION_MODELS = [
        // Anthropic Claude models (all recent versions support vision)
        "anthropic/claude-sonnet-4.6",
        "anthropic/claude-opus-4.6",
        "anthropic/claude-haiku-4.5",
        // OpenAI GPT-4 vision models
        "openai/gpt-4-vision-preview",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/gpt-4-turbo",
        // Google Gemini models
        "google/gemini-pro-vision",
        "google/gemini-1.5-pro",
        "google/gemini-1.5-flash",
        "google/gemini-2.0-flash-001",
        "google/gemini-2.5-pro-preview",
        "google/gemini-2.5-flash-preview",
      ];

      return models.filter((model) => {
        // Check if in known vision models list
        if (KNOWN_VISION_MODELS.includes(model.id)) return true;

        // Check various ways vision capability might be indicated
        if (model.supportsImages === true) return true;
        if (model.capabilities?.includes("vision")) return true;
        if (model.capabilities?.includes("image")) return true;

        // Check model ID patterns commonly associated with vision
        const id = (model.id || "").toLowerCase();
        if (id.includes("vision") || id.includes("-v")) return true;

        return false;
      });
    },

    /**
     * Group models by cost tier
     * @param {Array} models - Array of model objects
     * @returns {Object} Models grouped by tier: { low: [], medium: [], high: [] }
     */
    groupModelsByCostTier(models) {
      const grouped = {
        low: [],
        medium: [],
        high: [],
      };

      models.forEach((model) => {
        const tier = this.getModelCostTier(model);
        grouped[tier].push(model);
      });

      logDebug(
        `Grouped models: ${grouped.low.length} low, ${grouped.medium.length} medium, ${grouped.high.length} high`,
      );

      return grouped;
    },

    /**
     * Determine cost tier for a single model
     * Uses same thresholds as EmbedModelSelector for consistency
     * @param {Object} model - Model object with costs property
     * @returns {'low'|'medium'|'high'} Cost tier
     */
    getModelCostTier(model) {
      // Free models are always low tier
      if (model.isFree === true) {
        return "low";
      }

      // Calculate average cost (weighted towards output as it's typically more)
      if (!model.costs) {
        return "medium"; // Default when no cost info
      }

      const inputCost = model.costs.input || 0;
      const outputCost = model.costs.output || 0;

      // Use same formula as EmbedModelSelector: (input + output*2) / 3
      const avgCost = (inputCost + outputCost * 2) / 3;

      // Cost tier thresholds (per 1M tokens)
      // These match EmbedModelSelector for consistency
      const LOW_MAX = 1.0; // < $1 per 1M tokens
      const MEDIUM_MAX = 10.0; // $1-10 per 1M tokens

      if (avgCost < LOW_MAX) {
        return "low";
      } else if (avgCost < MEDIUM_MAX) {
        return "medium";
      } else {
        return "high";
      }
    },

    /**
     * Disable model selection with a message
     * Used when registry is unavailable or no models found
     * @param {string} reason - Reason for disabling
     */
    disableModelSelection(reason) {
      const selector = this.elements.modelSelector;
      if (!selector) return;

      // Clear and add disabled option
      selector.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = reason || "Model selection unavailable";
      option.disabled = true;
      selector.appendChild(option);
      selector.disabled = true;

      // Update cost estimate to show unavailable
      if (this.elements.costEstimate) {
        this.elements.costEstimate.textContent = "Cost estimate: Not available";
        this.elements.costEstimate.classList.remove(
          "imgdesc-cost-low",
          "imgdesc-cost-medium",
          "imgdesc-cost-high",
        );
      }

      // Hide remember checkbox since there's nothing to remember
      if (this.elements.rememberModel) {
        this.elements.rememberModel.closest(
          ".imgdesc-model-preference",
        ).hidden = true;
      }

      logWarn(`Model selection disabled: ${reason}`);
    },

    /**
     * Handle model selection change
     * Updates cost estimate, announces to screen readers, and optionally saves preference
     * Enhanced with accessibility announcements (Stage 6)
     */
    onModelChange() {
      const selector = this.elements.modelSelector;
      if (!selector) return;

      const selectedValue = selector.value;
      const selectedOption = selector.options[selector.selectedIndex];

      logInfo(`Model changed to: ${selectedValue}`);

      // Update cost estimate (Stage 3)
      this.updateCostEstimate();

      // Announce to screen readers (Stage 6)
      if (selectedOption && selectedValue) {
        const modelName = selectedOption.textContent || selectedValue;
        const costText = this.elements.costEstimate?.textContent || "";
        this.announceModelSelection(modelName, costText);
      }

      // Save preference if checkbox is checked (Stage 4)
      if (this.elements.rememberModel?.checked) {
        this.saveModelPreference();
      }

      // Log selection details for debugging
      if (selectedOption) {
        logDebug("Selected model details:", {
          value: selectedValue,
          text: selectedOption.textContent,
          inputCost: selectedOption.dataset.inputCost,
          outputCost: selectedOption.dataset.outputCost,
          provider: selectedOption.dataset.provider,
          costTier: selectedOption.dataset.costTier,
        });
      }

      // Update generate area model info subtitles (Phase 2D)
      this.updateGenerateAreaInfo();
    },

    // ========================================================================
    // COST ESTIMATION (Stage 3)
    // ========================================================================

    /**
     * Token estimation constants for typical image description
     * Based on analysis of real-world usage patterns
     */
    TOKEN_ESTIMATES: {
      SYSTEM_PROMPT: 500, // System prompt tokens
      USER_PROMPT: 100, // User prompt tokens
      IMAGE: 1000, // Image encoding tokens (varies by size/complexity)
      OUTPUT: 300, // Expected output tokens
      get INPUT_TOTAL() {
        return this.SYSTEM_PROMPT + this.USER_PROMPT + this.IMAGE;
      },
    },

    /**
     * Currency conversion rate (USD to GBP)
     * Model costs are in USD, we display in GBP
     */
    USD_TO_GBP: 0.8,

    /**
     * Update cost estimate display based on selected model
     * Calculates cost from data attributes and formats appropriately
     */
    updateCostEstimate() {
      const selector = this.elements.modelSelector;
      const costDisplay = this.elements.costEstimate;

      if (!selector || !costDisplay) {
        logWarn("Cost estimate elements not available");
        return;
      }

      const selectedOption = selector.options[selector.selectedIndex];

      if (!selectedOption || !selectedOption.value) {
        costDisplay.textContent = "Estimated cost: Select a model";
        this.applyCostTierStyling(costDisplay, null);
        this.lastEstimatedCost = null;
        return;
      }

      // Get cost data from data attributes (set in Stage 2)
      const inputCostPer1M = parseFloat(selectedOption.dataset.inputCost) || 0;
      const outputCostPer1M =
        parseFloat(selectedOption.dataset.outputCost) || 0;
      const costTier = selectedOption.dataset.costTier || "medium";

      // Calculate costs in USD
      const inputCostUSD =
        (inputCostPer1M / 1_000_000) * this.TOKEN_ESTIMATES.INPUT_TOTAL;
      const outputCostUSD =
        (outputCostPer1M / 1_000_000) * this.TOKEN_ESTIMATES.OUTPUT;
      const totalCostUSD = inputCostUSD + outputCostUSD;

      // Convert to GBP
      const totalCostGBP = totalCostUSD * this.USD_TO_GBP;

      // Store for debug panel
      this.lastEstimatedCost = totalCostGBP;

      // Format the display text
      const formattedCost = this.formatCostDisplay(totalCostGBP);
      const tierNote = this.getCostTierNote(costTier);

      costDisplay.textContent = `Estimated cost: ${formattedCost}${tierNote}`;

      // Apply tier-based styling
      this.applyCostTierStyling(costDisplay, costTier);

      logDebug(`Cost estimate updated: ${formattedCost} (tier: ${costTier})`, {
        inputCostPer1M,
        outputCostPer1M,
        totalCostUSD: totalCostUSD.toFixed(6),
        totalCostGBP: totalCostGBP.toFixed(6),
        costTier,
      });
    },

    /**
     * Format cost for display in appropriate units (pence or pounds)
     * @param {number} costGBP - Cost in British Pounds
     * @returns {string} Formatted cost string
     */
    formatCostDisplay(costGBP) {
      if (costGBP === 0) {
        return "Free";
      }

      // Convert to pence for easier threshold comparisons
      const costPence = costGBP * 100;

      if (costPence < 0.1) {
        // Very cheap: show decimal pence (e.g., "~0.05p per description")
        return `~${costPence.toFixed(2)}p per description`;
      } else if (costPence < 1) {
        // Cheap: show pence with one decimal (e.g., "~0.5p per description")
        return `~${costPence.toFixed(1)}p per description`;
      } else if (costPence < 10) {
        // Moderate: show whole pence (e.g., "~4p per description")
        return `~${Math.round(costPence)}p per description`;
      } else {
        // Expensive: show pounds (e.g., "~£0.15 per description")
        return `~£${costGBP.toFixed(2)} per description`;
      }
    },

    /**
     * Get contextual note based on cost tier
     * @param {string} tier - Cost tier ('low', 'medium', 'high')
     * @returns {string} Note to append to cost display
     */
    getCostTierNote(tier) {
      switch (tier) {
        case "low":
          return " (economical)";
        case "high":
          return " (premium quality)";
        default:
          return "";
      }
    },

    /**
     * Apply cost tier styling to the cost display element
     * @param {HTMLElement} element - The cost display element
     * @param {string|null} tier - Cost tier or null to remove all
     */
    applyCostTierStyling(element, tier) {
      if (!element) return;

      // Remove all tier classes first
      element.classList.remove(
        "imgdesc-cost-low",
        "imgdesc-cost-medium",
        "imgdesc-cost-high",
      );

      // Add appropriate class if tier specified
      if (tier && ["low", "medium", "high"].includes(tier)) {
        element.classList.add(`imgdesc-cost-${tier}`);
      }
    },

    /**
     * Get detailed cost breakdown for debugging
     * @returns {Object} Detailed cost breakdown object
     */
    getCostBreakdown() {
      const selector = this.elements.modelSelector;

      if (!selector) {
        return { error: "Model selector not available" };
      }

      const selectedOption = selector.options[selector.selectedIndex];

      if (!selectedOption || !selectedOption.value) {
        return { error: "No model selected" };
      }

      const inputCostPer1M = parseFloat(selectedOption.dataset.inputCost) || 0;
      const outputCostPer1M =
        parseFloat(selectedOption.dataset.outputCost) || 0;
      const costTier = selectedOption.dataset.costTier || "medium";
      const provider = selectedOption.dataset.provider || "unknown";

      // Calculate detailed costs
      const inputCostUSD =
        (inputCostPer1M / 1_000_000) * this.TOKEN_ESTIMATES.INPUT_TOTAL;
      const outputCostUSD =
        (outputCostPer1M / 1_000_000) * this.TOKEN_ESTIMATES.OUTPUT;
      const totalCostUSD = inputCostUSD + outputCostUSD;
      const totalCostGBP = totalCostUSD * this.USD_TO_GBP;

      return {
        model: {
          id: selectedOption.value,
          name: selectedOption.textContent,
          provider: provider,
          costTier: costTier,
        },
        pricing: {
          inputCostPer1M_USD: inputCostPer1M,
          outputCostPer1M_USD: outputCostPer1M,
        },
        tokenEstimates: {
          systemPrompt: this.TOKEN_ESTIMATES.SYSTEM_PROMPT,
          userPrompt: this.TOKEN_ESTIMATES.USER_PROMPT,
          image: this.TOKEN_ESTIMATES.IMAGE,
          inputTotal: this.TOKEN_ESTIMATES.INPUT_TOTAL,
          output: this.TOKEN_ESTIMATES.OUTPUT,
        },
        calculatedCosts: {
          inputCostUSD: inputCostUSD,
          outputCostUSD: outputCostUSD,
          totalCostUSD: totalCostUSD,
          totalCostGBP: totalCostGBP,
          totalCostPence: totalCostGBP * 100,
        },
        formatted: this.formatCostDisplay(totalCostGBP),
        conversionRate: this.USD_TO_GBP,
      };
    },

    // ========================================================================
    // PERSISTENCE METHODS (Stage 4)
    // ========================================================================

    /**
     * Restore model preference from localStorage
     * Validates preference, checks expiry, and handles missing models gracefully
     */
    restoreModelPreference() {
      logDebug("Restoring model preference from localStorage...");

      try {
        const saved = localStorage.getItem(PREFERENCE_CONFIG.STORAGE_KEY);

        if (!saved) {
          logDebug("No saved preference found - using default");
          this.setDefaultModel();
          return;
        }

        const preference = JSON.parse(saved);

        // Validate preference structure
        if (!preference.modelId || !preference.savedAt) {
          logWarn("Invalid preference structure - clearing and using default");
          this.clearModelPreference();
          this.setDefaultModel();
          return;
        }

        // Check if preference has expired (older than 90 days)
        const ageInDays =
          (Date.now() - preference.savedAt) / (1000 * 60 * 60 * 24);
        if (ageInDays > PREFERENCE_CONFIG.EXPIRY_DAYS) {
          logInfo(
            `Preference expired (${Math.round(ageInDays)} days old) - clearing`,
          );
          this.clearModelPreference();
          this.setDefaultModel();

          // Notify user if notification system available
          if (typeof window.notifyInfo === "function") {
            window.notifyInfo(
              "Your saved model preference has expired and been reset.",
            );
          }
          return;
        }

        // Check if saved model still exists in dropdown
        const modelExists = Array.from(
          this.elements.modelSelector.options,
        ).some((opt) => opt.value === preference.modelId);

        if (!modelExists) {
          logWarn(
            `Saved model no longer available: ${preference.modelId} - using default`,
          );
          this.clearModelPreference();
          this.setDefaultModel();

          // Notify user that their preferred model is no longer available
          if (typeof window.notifyWarning === "function") {
            window.notifyWarning(
              `Your previously saved model "${
                preference.modelName || preference.modelId
              }" is no longer available. Using default model.`,
            );
          }
          return;
        }

        // Restore the selection
        this.elements.modelSelector.value = preference.modelId;

        // Check the "Remember" checkbox since we have a valid preference
        if (this.elements.rememberModel) {
          this.elements.rememberModel.checked = true;
        }

        // Update cost estimate for restored selection
        this.updateCostEstimate();

        logInfo(
          `Restored model preference: ${
            preference.modelName || preference.modelId
          }`,
        );

        // Notify user of successful restoration (subtle feedback)
        if (typeof window.notifySuccess === "function") {
          window.notifySuccess(
            `Restored your preferred model: ${
              preference.modelName || preference.modelId
            }`,
          );
        }
      } catch (error) {
        logError("Failed to restore model preference:", error);
        this.clearModelPreference();
        this.setDefaultModel();
      }
    },

    /**
     * Save model preference to localStorage
     * Only saves if "Remember" checkbox is checked
     */
    saveModelPreference() {
      // Check if remember checkbox is checked
      if (!this.elements.rememberModel?.checked) {
        logDebug("Remember checkbox not checked - clearing preference instead");
        this.clearModelPreference();
        return;
      }

      const selector = this.elements.modelSelector;
      if (!selector || !selector.value) {
        logWarn("Cannot save preference - no model selected");
        return;
      }

      const selectedOption = selector.options[selector.selectedIndex];
      const modelId = selector.value;
      const modelName = selectedOption?.textContent?.trim() || modelId;

      const preference = {
        modelId: modelId,
        modelName: modelName,
        savedAt: Date.now(),
        version: PREFERENCE_CONFIG.VERSION,
      };

      try {
        localStorage.setItem(
          PREFERENCE_CONFIG.STORAGE_KEY,
          JSON.stringify(preference),
        );

        logInfo(`Model preference saved: ${modelName}`);

        // Subtle success feedback (if available)
        if (typeof window.notifySuccess === "function") {
          window.notifySuccess(`Model preference saved: ${modelName}`);
        }
      } catch (error) {
        logError("Failed to save model preference:", error);

        if (typeof window.notifyError === "function") {
          window.notifyError("Failed to save model preference");
        }
      }
    },

    /**
     * Clear model preference from localStorage
     */
    clearModelPreference() {
      try {
        localStorage.removeItem(PREFERENCE_CONFIG.STORAGE_KEY);
        logDebug("Model preference cleared from localStorage");
      } catch (error) {
        logError("Failed to clear model preference:", error);
      }
    },

    /**
     * Bind remember checkbox events (Stage 4)
     * Sets up checkbox to save/clear preferences on change
     */
    bindRememberCheckbox() {
      const checkbox = this.elements.rememberModel;
      if (!checkbox) {
        logWarn("Remember checkbox not found - persistence disabled");
        return;
      }

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          // Save current selection when checked
          this.saveModelPreference();
          logInfo("Remember model enabled - preference saved");

          if (window.notifySuccess) {
            window.notifySuccess("Model preference saved");
          }
        } else {
          // Clear saved preference when unchecked
          this.clearModelPreference();
          logInfo("Remember model disabled - preference cleared");

          if (window.notifyInfo) {
            window.notifyInfo("Model preference cleared");
          }
        }
      });

      logDebug("Remember checkbox bound");
    },

    /**
     * Bind show all models checkbox events
     * Repopulates model selector when toggled
     */
    bindShowAllModelsCheckbox() {
      const checkbox = this.elements.showAllModels;
      if (!checkbox) {
        logDebug("Show all models checkbox not found - feature disabled");
        return;
      }

      checkbox.addEventListener("change", () => {
        const showAll = checkbox.checked;
        logInfo(`Show all models: ${showAll ? "enabled" : "disabled"}`);

        // Remember current selection if possible
        const currentSelection = this.elements.modelSelector?.value;

        // Repopulate with new filter
        this.populateModelSelector(showAll);

        // Try to restore selection
        if (currentSelection) {
          const optionExists = Array.from(
            this.elements.modelSelector.options,
          ).some((opt) => opt.value === currentSelection);
          if (optionExists) {
            this.elements.modelSelector.value = currentSelection;
          }
        }

        // Update cost estimate
        this.updateCostEstimate();

        if (showAll && window.notifyWarning) {
          window.notifyWarning(
            "Showing all models. Some may not support image input.",
          );
        }
      });

      logDebug("Show all models checkbox bound");
    },

    // ========================================================================
    // MODEL SELECTION INTEGRATION (Stage 5)
    // ========================================================================

    /**
     * Get currently selected model ID (Stage 5)
     * Falls back to config default if no model selected
     * @returns {string} Model ID
     */
    getSelectedModel() {
      const selector = this.elements.modelSelector;

      // Return selected value if available and valid
      if (selector && selector.value) {
        logDebug("Using selected model:", selector.value);
        return selector.value;
      }

      // Fallback to config default
      logDebug("No model selected, using config default:", DEFAULT_MODEL);
      return DEFAULT_MODEL;
    },

    /**
     * Get selected model details from registry (Stage 5)
     * @returns {Object|null} Model object or null if not found
     */
    getSelectedModelDetails() {
      const modelId = this.getSelectedModel();

      // Check if registry is available
      if (!window.modelRegistry) {
        logWarn("Model registry not available");
        return null;
      }

      // Get model from registry
      if (typeof window.modelRegistry.getModel === "function") {
        const model = window.modelRegistry.getModel(modelId);
        if (model) {
          logDebug("Model details retrieved:", model.name || modelId);
          return model;
        }
      }

      logWarn("Model not found in registry:", modelId);
      return null;
    },

    // ========================================================================
    // ACCESSIBILITY & POLISH (Stage 6)
    // ========================================================================

    /**
     * Announce model selection to screen readers (Stage 6)
     * Uses window.a11y?.announceStatus if available, graceful degradation otherwise
     * @param {string} modelName - Name of selected model
     * @param {string} costEstimate - Cost estimate text
     */
    announceModelSelection(modelName, costEstimate) {
      // Build announcement message
      const message = `Model changed to ${modelName}. ${costEstimate}`;

      // Try to use a11y helper if available
      if (window.a11y?.announceStatus) {
        try {
          window.a11y.announceStatus(message);
          logDebug("Announced model selection via a11y helper:", message);
          return;
        } catch (error) {
          logWarn("a11y.announceStatus failed, using fallback:", error);
        }
      }

      // Fallback: Update the cost estimate element's aria-live region
      // (This should already be set up with role="status" and aria-live="polite")
      // The update in updateCostEstimate() will trigger the announcement
      logDebug("Model selection announced via aria-live region:", message);
    },

    /**
     * Enhance keyboard navigation for model selector (Stage 6)
     * Adds Ctrl+Home (first option) and Ctrl+End (last option) shortcuts
     */
    enhanceModelSelectorKeyboard() {
      const selector = this.elements.modelSelector;
      if (!selector) {
        logWarn("Cannot enhance keyboard - model selector not found");
        return;
      }

      selector.addEventListener("keydown", (event) => {
        // Only handle Ctrl+Home and Ctrl+End
        if (!event.ctrlKey) return;

        const options = Array.from(selector.options).filter(
          (opt) => opt.value && !opt.disabled,
        );

        if (options.length === 0) return;

        let handled = false;

        if (event.key === "Home") {
          // Ctrl+Home: Jump to first option
          selector.value = options[0].value;
          handled = true;
          logDebug("Keyboard: Jumped to first option");
        } else if (event.key === "End") {
          // Ctrl+End: Jump to last option
          selector.value = options[options.length - 1].value;
          handled = true;
          logDebug("Keyboard: Jumped to last option");
        }

        if (handled) {
          event.preventDefault();
          // Dispatch change event to update cost estimate
          selector.dispatchEvent(new Event("change"));
        }
      });

      logDebug("Model selector keyboard navigation enhanced");
    },

    /**
     * Show loading state whilst populating models (Stage 6)
     */
    showModelLoadingState() {
      const selector = this.elements.modelSelector;
      const costDisplay = this.elements.costEstimate;

      if (selector) {
        // Clear and add loading option
        selector.innerHTML = "";
        const loadingOption = document.createElement("option");
        loadingOption.value = "";
        loadingOption.textContent = "Loading models...";
        loadingOption.disabled = true;
        selector.appendChild(loadingOption);
        selector.disabled = true;
        selector.setAttribute("aria-busy", "true");
      }

      if (costDisplay) {
        costDisplay.textContent = "Loading...";
        costDisplay.setAttribute("aria-busy", "true");
      }

      // Hide remember checkbox during loading
      if (this.elements.rememberModel) {
        const preferenceContainer = this.elements.rememberModel.closest(
          ".imgdesc-model-preference",
        );
        if (preferenceContainer) {
          preferenceContainer.hidden = true;
        }
      }

      logDebug("Model loading state shown");
    },

    /**
     * Clear loading state after models loaded (Stage 6)
     */
    clearModelLoadingState() {
      const selector = this.elements.modelSelector;
      const costDisplay = this.elements.costEstimate;

      if (selector) {
        selector.disabled = false;
        selector.removeAttribute("aria-busy");
      }

      if (costDisplay) {
        costDisplay.removeAttribute("aria-busy");
      }

      // Show remember checkbox again
      if (this.elements.rememberModel) {
        const preferenceContainer = this.elements.rememberModel.closest(
          ".imgdesc-model-preference",
        );
        if (preferenceContainer) {
          preferenceContainer.hidden = false;
        }
      }

      logDebug("Model loading state cleared");
    },

    /**
     * Handle model registry errors gracefully (Stage 6)
     * Updates UI to error state and notifies user
     * @param {Error} error - The error that occurred
     */
    handleModelRegistryError(error) {
      logError("Model registry error:", error);

      const selector = this.elements.modelSelector;
      const costDisplay = this.elements.costEstimate;

      // Update selector to error state
      if (selector) {
        selector.innerHTML = "";
        const errorOption = document.createElement("option");
        errorOption.value = "";
        errorOption.textContent = "Unable to load models";
        errorOption.disabled = true;
        selector.appendChild(errorOption);
        selector.disabled = true;
        selector.removeAttribute("aria-busy");
        selector.setAttribute("aria-invalid", "true");
      }

      // Update cost display
      if (costDisplay) {
        costDisplay.textContent = "Model loading failed";
        costDisplay.removeAttribute("aria-busy");
        costDisplay.classList.remove(
          "imgdesc-cost-low",
          "imgdesc-cost-medium",
          "imgdesc-cost-high",
        );
      }

      // Hide remember checkbox since there's nothing to remember
      if (this.elements.rememberModel) {
        const preferenceContainer = this.elements.rememberModel.closest(
          ".imgdesc-model-preference",
        );
        if (preferenceContainer) {
          preferenceContainer.hidden = true;
        }
      }

      // Notify user if notification system available
      if (typeof window.notifyError === "function") {
        window.notifyError(
          "Failed to load AI models. Please refresh the page or try again later.",
        );
      }
    },

    /**
     * Set default model (economical option like Claude Haiku)
     * Used when no saved preference exists or preference is invalid
     * Prefers the configured default, falls back to newest Haiku, then first available
     */
    setDefaultModel() {
      if (!this.elements.modelSelector) return;

      const options = this.elements.modelSelector.options;
      if (options.length === 0) return;

      const optionsArray = Array.from(options).filter(
        (opt) => opt.value && !opt.disabled,
      );

      // Priority 1: Try to find the configured default model
      const configDefault = optionsArray.find(
        (opt) => opt.value === DEFAULT_MODEL,
      );

      if (configDefault) {
        this.elements.modelSelector.value = configDefault.value;
        logInfo(`Default model set to configured default: ${DEFAULT_MODEL}`);
        this.onModelChange();
        return;
      }

      // Priority 2: Try to find Claude Haiku 4.5 specifically
      const haiku45 = optionsArray.find(
        (opt) => opt.value === "anthropic/claude-haiku-4.5",
      );

      if (haiku45) {
        this.elements.modelSelector.value = haiku45.value;
        logInfo("Default model set to Claude Haiku 4.5");
        this.onModelChange();
        return;
      }

      // Priority 3: Try to find any Haiku model (prefer newer versions)
      const haikuModels = optionsArray.filter((opt) =>
        opt.value.toLowerCase().includes("haiku"),
      );

      if (haikuModels.length > 0) {
        // Sort to prefer higher version numbers (4.5 > 4 > 3.5 > 3)
        haikuModels.sort((a, b) => {
          // Extract version numbers if present
          const getVersion = (id) => {
            const match = id.match(/(\d+\.?\d*)/g);
            return match ? parseFloat(match[match.length - 1]) : 0;
          };
          return getVersion(b.value) - getVersion(a.value);
        });

        this.elements.modelSelector.value = haikuModels[0].value;
        logInfo(`Default model set to: ${haikuModels[0].value}`);
        this.onModelChange();
        return;
      }

      // Priority 4: Fall back to first available option
      if (optionsArray.length > 0) {
        this.elements.modelSelector.value = optionsArray[0].value;
        logInfo(
          `Default model set to first available: ${optionsArray[0].value}`,
        );
        this.onModelChange();
      }
    },

    // ========================================================================
    // GENERATE AREA MODEL INFO SUBTITLES (Phase 2D)
    // ========================================================================

    /**
     * Update the model info subtitles beneath the generate buttons.
     * Called on model change, local model change, and model state changes.
     */
    updateGenerateAreaInfo() {
      this._updateCloudModelInfo();
      this._updateLocalModelInfo();
    },

    /**
     * Update cloud generation model name in the generate area subtitle.
     * @private
     */
    _updateCloudModelInfo() {
      const nameSpan = this.elements.cloudModelName;
      if (!nameSpan) return;

      const selector = this.elements.modelSelector;
      if (!selector || !selector.value) {
        nameSpan.textContent = "\u2026";
        return;
      }

      const selectedOption = selector.options[selector.selectedIndex];
      if (!selectedOption) {
        nameSpan.textContent = "\u2026";
        return;
      }

      // Option text format is "Model Name (Provider)" — extract just the name
      const fullText = selectedOption.textContent || "";
      const lastParen = fullText.lastIndexOf(" (");
      const modelName = lastParen > 0 ? fullText.substring(0, lastParen).trim() : fullText.trim();

      nameSpan.textContent = modelName || "\u2026";
      logDebug("Cloud model info updated:", modelName);
    },

    /**
     * Update local generation model info in the generate area subtitle.
     * Shows model name if any local model is cached/loaded, or "No local models ready" otherwise.
     * @private
     */
    _updateLocalModelInfo() {
      const statusSpan = this.elements.localModelStatus;
      const changeBtn = this.elements.changeLocalModelBtn;
      if (!statusSpan) return;

      // Check if any local generation model is cached or loaded
      const mm = window.ImageDescriberModelManager;
      let anyLocalReady = false;

      if (mm && typeof mm.getModelState === "function") {
        const fastvlmState = mm.getModelState("fastvlm");
        const qwenState = mm.getModelState("qwen35");
        const lfm2vlState = mm.getModelState("lfm2vl");
        const readyStates = ["cached", "loading", "loaded"];
        anyLocalReady = readyStates.includes(fastvlmState) || readyStates.includes(qwenState) || readyStates.includes(lfm2vlState);
      }

      if (anyLocalReady) {
        // Show currently selected local model name
        const localSelect = this.elements.localModelSelect;
        let modelName = "FastVLM 0.5B";

        if (localSelect) {
          const selectedOption = localSelect.options[localSelect.selectedIndex];
          if (selectedOption) {
            // Option text format: "FastVLM 0.5B — Fast, free-form (~22s)"
            const fullText = selectedOption.textContent || "";
            const dashIndex = fullText.indexOf(" \u2014 ");
            modelName = dashIndex > 0 ? fullText.substring(0, dashIndex).trim() : fullText.trim();
          }
        }

        statusSpan.innerHTML = "Using <span id=\"imgdesc-local-model-name\">" +
          this._escapeHtmlForInfo(modelName) + "</span>";

        if (changeBtn) {
          changeBtn.textContent = "Change model";
        }
      } else {
        // No local models cached
        statusSpan.textContent = "No local models ready";

        if (changeBtn) {
          changeBtn.textContent = "Set up models";
        }
      }

      logDebug("Local model info updated, anyLocalReady:", anyLocalReady);
    },

    /**
     * Escape text for safe innerHTML insertion in model info.
     * @param {string} text
     * @returns {string}
     * @private
     */
    _escapeHtmlForInfo(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Open the Model & Generation Settings panel, highlight it, and move
     * keyboard focus to the relevant control.
     * @param {HTMLElement} [focusTarget] - Element to focus after the panel opens
     *   (e.g. the cloud or local model <select>). Falls back to the panel summary.
     */
    openModelManagerPanel(focusTarget) {
      const panel = this.elements.modelManagerPanel;
      if (!panel) {
        logWarn("Model manager panel not found");
        return;
      }

      // Open the details element
      panel.open = true;

      // Determine what to scroll to and focus
      const target = focusTarget || panel.querySelector("summary");

      // Scroll the target into view smoothly
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      // Move keyboard focus after scroll starts
      requestAnimationFrame(() => {
        if (target) {
          target.focus({ preventScroll: true });
        }
      });

      // Add highlight class (CSS animation handles the rest)
      panel.classList.remove("imgdesc-highlight-panel");
      // Force reflow to restart animation if already applied
      void panel.offsetWidth;
      panel.classList.add("imgdesc-highlight-panel");

      // Remove the class after animation completes
      panel.addEventListener("animationend", () => {
        panel.classList.remove("imgdesc-highlight-panel");
      }, { once: true });

      // For prefers-reduced-motion, remove highlight after a timeout
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setTimeout(() => {
          panel.classList.remove("imgdesc-highlight-panel");
        }, 2000);
      }

      logDebug("Model manager panel opened and highlighted, focus moved to:", target?.id || "summary");
    },
  };

  // ============================================================================
  // MIX INTO CONTROLLER
  // ============================================================================

  if (window.ImageDescriberController) {
    Object.assign(window.ImageDescriberController, methods);
    logInfo("Model selection methods loaded");
  } else {
    logError(
      "ImageDescriberController not found \u2014 model methods not loaded",
    );
  }
})();
