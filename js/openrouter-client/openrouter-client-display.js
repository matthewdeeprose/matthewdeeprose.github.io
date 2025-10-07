/**
 * OpenRouter Client Module - Display
 *
 * Handles UI display functions for the OpenRouter client.
 * Manages code display, developer panel updates, and accessibility features.
 */

import { openRouterUtils } from "./openrouter-client-utils.js";
import { calculateCost, formatCost } from "../cost-calculator.js";
import { modelRegistry } from "../model-definitions.js";

/**
 * Class for handling UI display functions
 */
export class OpenRouterDisplay {
  constructor() {
    // Initialize any display-specific state
  }

  /**
   * Populates a developer panel data element with accessible content
   * @param {string} elementId - The ID of the element to populate
   * @param {string} content - The visible content
   * @param {string} ariaLabel - The accessible label (optional, only use when needed)
   * @param {boolean} isLive - Whether to use aria-live for dynamic updates
   */
  populateDeveloperData(elementId, content, ariaLabel = null, isLive = false) {
    const element = document.getElementById(elementId);
    if (!element) {
      openRouterUtils.warn(`Element with ID '${elementId}' not found`, {
        elementId,
      });
      return;
    }
    
    try {
      // Remove aria-hidden to make element accessible
      element.removeAttribute('aria-hidden');
      
      // Set content
      element.textContent = content;
      
      // Only set aria-label if explicitly provided and different from content
      if (ariaLabel && ariaLabel !== content) {
        element.setAttribute('aria-label', ariaLabel);
      } else {
        // Remove any existing aria-label if not needed
        element.removeAttribute('aria-label');
      }
      
      // Add aria-live for dynamic updates if specified
      if (isLive) {
        element.setAttribute('aria-live', 'polite');
      }
      
      openRouterUtils.debug(`Populated ${elementId} with accessible content`, {
        elementId,
        content: content.substring(0, 100), // Log first 100 chars
        hasAriaLabel: !!ariaLabel,
        isLive
      });
    } catch (error) {
      openRouterUtils.error(`Failed to populate ${elementId}`, {
        error,
        elementId,
      });
    }
  }

  /**
   * Updates code elements with syntax highlighting
   * @param {string} elementId - The ID of the element to update
   * @param {Object|string} content - The content to display
   * @param {string} language - The language for syntax highlighting
   */
  updateCodeDisplay(elementId, content, language = "json") {
    const element = document.getElementById(elementId);
    if (!element) {
      openRouterUtils.warn(`Element with ID ${elementId} not found`, {
        elementId,
      });
      return;
    }

    try {
      // Convert content to string if it's an object
      const stringContent =
        typeof content === "object"
          ? openRouterUtils.safeJsonStringify(content)
          : String(content);

      // Escape HTML to prevent XSS
      const escapedContent = openRouterUtils.escapeHtml(stringContent);

      // Update content
      element.innerHTML = escapedContent;

      // Apply Prism highlighting if available
      if (window.Prism) {
        element.innerHTML = Prism.highlight(
          stringContent,
          Prism.languages[language],
          language
        );
      }

      // Set appropriate ARIA attributes for accessibility
      element.setAttribute("aria-label", `${language} code display`);

      openRouterUtils.debug(`Updated code display for ${elementId}`, {
        elementId,
        contentLength: stringContent.length,
        language,
      });
    } catch (error) {
      openRouterUtils.error(`Failed to update code display for ${elementId}`, {
        error,
        elementId,
      });
      element.innerHTML = `Error displaying content: ${error.message}`;
      element.setAttribute("aria-label", "Error in code display");
    }
  }

  /**
   * Updates developer panel with error information
   */
  updateDevPanelError() {
    try {
      // Use the new utility function for consistent error handling
      // No aria-labels needed - the <dt> elements provide context
      this.populateDeveloperData('prompt-tokens', 'Error');
      this.populateDeveloperData('completion-tokens', 'Error');
      this.populateDeveloperData('last-cost', 'Error');
      this.populateDeveloperData('provider-info', 'Error');
      this.populateDeveloperData('request-timing', 'Error');
      this.populateDeveloperData('finish-reason', 'Error');
      this.populateDeveloperData('token-efficiency', 'Error');
      this.populateDeveloperData('model-changes', 'Error');

      // Update code displays with error message
      this.updateCodeDisplay("original-request", "Error occurred");
      this.updateCodeDisplay("original-response", "Error occurred");

      openRouterUtils.debug("Updated dev panel with error information");
    } catch (error) {
      openRouterUtils.error("Failed to update dev panel with error information", { error });
    }
  }

  /**
   * Check if a model is free
   * @param {string} responseModel - Model ID from response
   * @param {string} requestModel - Model ID from request
   * @returns {boolean} Whether the model is free
   */
  isFreeModel(responseModel, requestModel) {
    // Check if either the response model or request model indicates this is a free model
    try {
      // Add detailed logging to help diagnose issues
      openRouterUtils.debug("Checking if model is free", {
        responseModel,
        requestModel,
        modelRegistryType: typeof modelRegistry,
        hasGetAllModels: typeof modelRegistry.getAllModels,
        modelRegistryMethods: Object.keys(modelRegistry),
      });

      // If getAllModels exists, log the number of models found
      if (typeof modelRegistry.getAllModels === "function") {
        const allModels = modelRegistry.getAllModels();
        openRouterUtils.debug("Models found in registry", {
          count: allModels.length,
          modelIds: allModels.map((model) => model.id),
          freeModels: allModels
            .filter((model) => model.isFree)
            .map((model) => model.id),
        });
      }

      return (
        // Check if the response model ends with :free
        responseModel?.endsWith(":free") ||
        // Check if the request model ends with :free
        requestModel?.endsWith(":free") ||
        // Check if the model exists in registry and is marked as free
        (typeof modelRegistry.getAllModels === "function"
          ? modelRegistry
              .getAllModels()
              .some(
                (model) =>
                  model.isFree &&
                  (model.id === responseModel ||
                    model.id.replace(":free", "") === responseModel)
              )
          : false) // If getAllModels is not a function, return false for this condition
      );
    } catch (error) {
      openRouterUtils.warn("Error checking if model is free", {
        error,
        responseModel,
        requestModel,
        modelRegistryType: typeof modelRegistry,
        hasGetAllModels: typeof modelRegistry.getAllModels,
      });
      // Fallback to just checking the model name pattern
      return (
        responseModel?.endsWith(":free") || requestModel?.endsWith(":free")
      );
    }
  }

  /**
   * Updates developer panel with usage information
   * @param {Object} data - Response data from API
   * @param {string} requestModel - Model ID from request
   */
  updateDevPanel(data, requestModel) {
    try {
      openRouterUtils.debug("Starting dev panel update", {
        hasData: !!data,
        hasUsage: !!data?.usage,
        hasTokenReport: !!data?.tokenReport,
        requestModel,
        responseModel: data?.model,
      });

      if (!data) {
        openRouterUtils.warn("No data available for dev panel update");
        return;
      }

      // For streaming responses, create a minimal usage object if not provided
      if (!data.usage && data.model) {
        // Estimate tokens for streaming if not provided
        data.usage = {
          prompt_tokens: data.promptTokens || 0,
          completion_tokens:
            data.completionTokens ||
            data.choices?.[0]?.message?.content?.length / 4 ||
            0,
          total_tokens:
            (data.promptTokens || 0) +
            (data.completionTokens ||
              data.choices?.[0]?.message?.content?.length / 4 ||
              0),
        };

        openRouterUtils.debug(
          "Created estimated usage for streaming",
          data.usage
        );
      }

      if (!data.usage && !data.tokenReport) {
        openRouterUtils.warn("No usage data available for dev panel update", {
          data,
        });
        return;
      }

      const report = data.tokenReport || {};
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;

      openRouterUtils.debug("Token usage information", {
        promptTokens,
        completionTokens,
        hasModelChanges: !!report.modelChanges?.length,
      });

      // Update current token counts with per-model breakdown
      const promptElement = document.getElementById("prompt-tokens");
      const completionElement = document.getElementById("completion-tokens");

      // Add provider information
      this.updateProviderInfo(data);

      // Add request timing information
      this.updateRequestTiming(data);

      // Add finish reason information
      this.updateFinishReason(data);

      // Update token counts based on whether there were model changes
      if (report.modelChanges?.length > 0) {
        this.updateTokenCountsWithHistory(
          promptElement,
          completionElement,
          promptTokens,
          completionTokens,
          report
        );
      } else {
        this.updateSimpleTokenCounts(
          promptElement,
          completionElement,
          promptTokens,
          completionTokens,
          report
        );
      }

      // Update token efficiency with detailed metrics
      this.updateTokenEfficiency(report);

      // Enhanced model changes display with accessibility
      this.updateModelChanges(data, report, requestModel);

      // First check if it's a free model before any cost calculations
      openRouterUtils.debug(
        "Checking if model is free before cost calculation",
        {
          responseModel: data.model,
          requestModel,
        }
      );

      if (this.isFreeModel(data.model, requestModel)) {
        openRouterUtils.debug(
          "Model identified as free, skipping cost calculation"
        );
        this.populateDeveloperData('last-cost', 'Free', 'Cost: Free (no charge)');
        return;
      }

      // Calculate and display cost
      this.updateCostDisplay(data, promptTokens, completionTokens);

      // Display validation warnings if any
      if (report.validation?.warnings?.length > 0) {
        openRouterUtils.warn(
          "Token validation warnings:",
          report.validation.warnings
        );
      }

      openRouterUtils.debug("Dev panel update completed successfully");
    } catch (error) {
      openRouterUtils.error("Failed to update dev panel", {
        error,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      this.updateDevPanelError();
    }
  }

  /**
   * Update provider information in the UI
   * @param {Object} data - Response data from API
   */
  updateProviderInfo(data) {
    const providerText = `${data.provider || "Unknown"} (Model ID: ${data.model})`;
    // No aria-label needed - the <dt> "Provider Information:" provides context
    this.populateDeveloperData('provider-info', providerText);
  }

  /**
   * Update request timing information in the UI
   * @param {Object} data - Response data from API
   */
  updateRequestTiming(data) {
    if (data.created) {
      const created = new Date(data.created * 1000);
      const timing = {
        requestTime: created.toLocaleTimeString(),
        requestDate: created.toLocaleDateString(),
        responseTime: Math.round((Date.now() - data.created * 1000) / 1000),
      };
      
      const timingText = `${timing.requestDate} ${timing.requestTime} (Response time: ${timing.responseTime}s)`;
      // No aria-label needed - the <dt> "Request Timing:" provides context
      this.populateDeveloperData('request-timing', timingText);
    }
  }

  /**
   * Update finish reason information in the UI
   * @param {Object} data - Response data from API
   */
  updateFinishReason(data) {
    if (data.choices) {
      const reason = data.choices[0]?.finish_reason || "unknown";
      const nativeReason = data.choices[0]?.native_finish_reason;
      const reasonText = nativeReason ? `${reason} (native: ${nativeReason})` : reason;
      // No aria-label needed - the <dt> "Finish Reason:" provides context
      this.populateDeveloperData('finish-reason', reasonText);
    }
  }

  /**
   * Update token counts with history information
   * @param {HTMLElement} promptElement - Prompt tokens element (deprecated - using IDs now)
   * @param {HTMLElement} completionElement - Completion tokens element (deprecated - using IDs now)
   * @param {number} promptTokens - Current prompt tokens
   * @param {number} completionTokens - Current completion tokens
   * @param {Object} report - Token report
   */
  updateTokenCountsWithHistory(
    promptElement,
    completionElement,
    promptTokens,
    completionTokens,
    report
  ) {
    // Show detailed breakdown for each model used
    const promptBreakdown = report.modelChanges
      .map((change) => `${change.previousMetrics?.promptTokens || 0} (${change.from})`)
      .join(" + ");

    const completionBreakdown = report.modelChanges
      .map((change) => `${change.previousMetrics?.completionTokens || 0} (${change.from})`)
      .join(" + ");

    const promptText = `${promptTokens} (Current) | History: ${promptBreakdown}`;
    const completionText = `${completionTokens} (Current) | History: ${completionBreakdown}`;

    // Keep aria-labels for complex history information to clarify the breakdown
    this.populateDeveloperData(
      'prompt-tokens', 
      promptText, 
      `Prompt tokens: ${promptTokens} current, with history: ${promptBreakdown}`
    );
    
    this.populateDeveloperData(
      'completion-tokens', 
      completionText, 
      `Completion tokens: ${completionTokens} current, with history: ${completionBreakdown}`
    );
  }

  /**
   * Update simple token counts without history
   * @param {HTMLElement} promptElement - Prompt tokens element (deprecated - using IDs now)
   * @param {HTMLElement} completionElement - Completion tokens element (deprecated - using IDs now)
   * @param {number} promptTokens - Current prompt tokens
   * @param {number} completionTokens - Current completion tokens
   * @param {Object} report - Token report
   */
  updateSimpleTokenCounts(
    promptElement,
    completionElement,
    promptTokens,
    completionTokens,
    report
  ) {
    // Simple display for single model usage
    const promptText = `${promptTokens} (Total: ${report.totalPromptTokens || promptTokens})`;
    const completionText = `${completionTokens} (Total: ${report.totalCompletionTokens || completionTokens})`;
    
    // No aria-labels needed - the <dt> elements provide context
    this.populateDeveloperData('prompt-tokens', promptText);
    this.populateDeveloperData('completion-tokens', completionText);
  }

  /**
   * Update token efficiency information in the UI
   * @param {Object} report - Token report
   */
  updateTokenEfficiency(report) {
    if (report.tokenEfficiency !== undefined) {
      const efficiency = report.tokenEfficiency.toFixed(1);
      const totalAttempts = report.attempts?.length || 1;
      const efficiencyText = `${efficiency}% efficiency | ${totalAttempts} attempt${totalAttempts > 1 ? "s" : ""}`;
      const ariaLabel = `Token efficiency: ${efficiency}% with ${totalAttempts} attempt${totalAttempts > 1 ? "s" : ""}`;
      
      this.populateDeveloperData('token-efficiency', efficiencyText, ariaLabel, true); // true for aria-live
    }
  }

  /**
   * Update model changes information in the UI
   * @param {Object} data - Response data from API
   * @param {Object} report - Token report
   * @param {string} requestModel - Model ID from request
   */
  updateModelChanges(data, report, requestModel) {
    let changesText = "None";
    let ariaLabel = "No model changes";
    
    if (report.modelChanges?.length > 0) {
      const changes = report.modelChanges
        .map((change) => {
          const tokens = change.previousMetrics
            ? ` (${change.previousMetrics.promptTokens}/${change.previousMetrics.completionTokens} tokens)`
            : "";
          return `${change.from} → ${change.to}${tokens}`;
        })
        .join(" → ");

      changesText = `Changes: ${changes}`;
      ariaLabel = `Model changes: ${changes.replace(/→/g, " to ")}`;
    } else if (data.model !== requestModel) {
      changesText = `${requestModel} → ${data.model}`;
      ariaLabel = `Model changed from ${requestModel} to ${data.model}`;
    }
    
    this.populateDeveloperData('model-changes', changesText, ariaLabel, true); // true for aria-live
  }

  /**
   * Update cost display in the UI
   * @param {Object} data - Response data from API
   * @param {number} promptTokens - Prompt tokens
   * @param {number} completionTokens - Completion tokens
   */
  updateCostDisplay(data, promptTokens, completionTokens) {
    try {
      // Calculate cost (checking if cache was used)
      const cacheDiscount = data.cached ? 0.5 : 0;
      const cost = calculateCost(data.model, promptTokens, completionTokens, cacheDiscount);

      // Display formatted cost
      const formattedCost = formatCost(cost);
      // No aria-label needed - the <dt> "Last Transaction Cost:" provides context
      this.populateDeveloperData('last-cost', formattedCost);
    } catch (error) {
      openRouterUtils.error("Error calculating cost", {
        error,
        model: data.model,
      });
      
      this.populateDeveloperData('last-cost', "Error calculating cost");
    }
  }
}

// Export singleton instance
export const openRouterDisplay = new OpenRouterDisplay();