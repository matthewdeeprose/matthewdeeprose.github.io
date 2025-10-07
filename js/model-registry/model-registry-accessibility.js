/**
 * @fileoverview Accessibility utilities for the model registry system.
 * Provides ARIA label generation, keyboard navigation support, and other accessibility features.
 */

import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import {
  DEFAULT_CONFIG,
  ACCESSIBILITY_PREFERENCES,
} from "./model-registry-config.js";

/**
 * ModelRegistryAccessibility class for handling accessibility features
 */
export class ModelRegistryAccessibility {
  /**
   * @param {Object} options - Accessibility configuration options
   */
  constructor(options = {}) {
    this.options = {
      announceStatusChanges: options.announceStatusChanges !== false,
      enhancedDescriptions: options.enhancedDescriptions !== false,
      keyboardSupport: options.keyboardSupport !== false,
    };

    // Reference to the main accessibility helper if available
    this.a11yHelper = options.a11yHelper || null;

    logger.debug("ModelRegistryAccessibility initialized", this.options);
  }

  /**
   * Generate ARIA labels for a model
   * @param {Object} model - Model configuration
   * @returns {Object} ARIA labels for the model
   */
  generateModelAriaLabels(model) {
    if (!model) return {};

    const baseLabels = {
      modelName: `Model: ${model.name}`,
      provider: `Provider: ${model.provider}`,
      category: `Category: ${model.category}`,
      description: model.description,
      ...(model.isFree ? { pricing: "Free tier model" } : {}),
      ...(model.disabled ? { status: "This model is currently disabled" } : {}),
      ...(model.fallbackTo
        ? { fallback: `Falls back to ${model.fallbackTo} if unavailable` }
        : {}),
    };

    // Add enhanced descriptions if available and enabled
    if (
      this.options.enhancedDescriptions &&
      model.metadata?.enhancedDescriptions
    ) {
      Object.entries(model.metadata.enhancedDescriptions).forEach(
        ([key, value]) => {
          baseLabels[`enhanced_${key}`] = value;
        }
      );
    }

    return baseLabels;
  }

  /**
   * Generate ARIA labels for policy links
   * @param {Object} model - Model configuration
   * @returns {Object} ARIA labels for policy links
   */
  generatePolicyAriaLabels(model) {
    if (!model || !model.metadata?.policyLinks) return {};

    const links = model.metadata.policyLinks;
    const labels = {};

    if (links.privacyPolicy) {
      labels.privacyPolicy = `Privacy Policy for ${model.name}`;
    }

    if (links.acceptableUse) {
      labels.acceptableUse = `Acceptable Use Policy for ${model.name}`;
    }

    if (links.termsOfService) {
      labels.termsOfService = `Terms of Service for ${model.name}`;
    }

    if (links.lastUpdated) {
      labels.updated = `Policy documentation last updated ${links.lastUpdated}`;
    }

    return labels;
  }

  /**
   * Generate ARIA labels for a category
   * @param {Object} category - Category configuration
   * @returns {Object} ARIA labels for the category
   */
  generateCategoryAriaLabels(category) {
    if (!category) return {};

    return {
      categoryName: `Category: ${category.name}`,
      description:
        category.description || `Models in the ${category.name} category`,
      ...(category.metadata?.accessibilityNotes
        ? { notes: category.metadata.accessibilityNotes }
        : {}),
    };
  }

  /**
   * Add keyboard navigation to model selector
   * @param {HTMLElement} selectElement - Select element for model selection
   * @param {Function} onModelChange - Callback for model change
   */
  addKeyboardNavigation(selectElement, onModelChange) {
    if (!this.options.keyboardSupport || !selectElement) return;

    // Ensure the select element has proper ARIA attributes
    selectElement.setAttribute("role", "combobox");
    selectElement.setAttribute("aria-label", "Select AI model");

    // Add keyboard event listeners
    selectElement.addEventListener("keydown", (event) => {
      // Handle arrow keys for navigation
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const direction = event.key === "ArrowUp" ? -1 : 1;
        const currentIndex = selectElement.selectedIndex;
        const newIndex = Math.max(
          0,
          Math.min(selectElement.options.length - 1, currentIndex + direction)
        );

        if (newIndex !== currentIndex) {
          selectElement.selectedIndex = newIndex;
          if (typeof onModelChange === "function") {
            onModelChange(selectElement.value);
          }

          this.announceSelectedModel(selectElement.options[newIndex].text);
          event.preventDefault();
        }
      }
    });
  }

  /**
   * Announce a status message using the screen reader
   * @param {string} message - Message to announce
   * @param {string} ariaLive - ARIA live setting (polite or assertive)
   */
  announceStatus(message, ariaLive = "polite") {
    if (!this.options.announceStatusChanges) return;

    if (
      this.a11yHelper &&
      typeof this.a11yHelper.announceStatus === "function"
    ) {
      // Use the main accessibility helper if available
      this.a11yHelper.announceStatus(message, ariaLive);
    } else {
      // Create a temporary announcement element
      const announcer = document.createElement("div");
      announcer.setAttribute("aria-live", ariaLive);
      announcer.setAttribute("role", "status");
      announcer.classList.add("sr-only");
      announcer.style.position = "absolute";
      announcer.style.width = "1px";
      announcer.style.height = "1px";
      announcer.style.padding = "0";
      announcer.style.margin = "-1px";
      announcer.style.overflow = "hidden";
      announcer.style.clip = "rect(0, 0, 0, 0)";
      announcer.style.whiteSpace = "nowrap";
      announcer.style.border = "0";

      document.body.appendChild(announcer);

      // Use setTimeout to ensure the element is in the DOM before setting text
      setTimeout(() => {
        announcer.textContent = message;

        // Remove the element after announcement
        setTimeout(() => {
          document.body.removeChild(announcer);
        }, 3000);
      }, 100);
    }
  }

  /**
   * Announce the selected model
   * @param {string} modelName - Name of the selected model
   */
  announceSelectedModel(modelName) {
    this.announceStatus(`Selected model: ${modelName}`, "polite");
  }

  /**
   * Announce a model registration
   * @param {string} modelId - ID of the registered model
   * @param {Object} model - Model configuration
   */
  announceModelRegistration(modelId, model) {
    this.announceStatus(
      `Model registered: ${model.name} from ${model.provider}`,
      "polite"
    );
  }

  /**
   * Announce a model status change
   * @param {string} modelId - ID of the model
   * @param {Object} status - New status information
   */
  announceStatusChange(modelId, status) {
    let message = `Model status updated`;

    if (status.isAvailable) {
      message = `Model is now available`;
    } else if (status.errorMessage) {
      message = `Model is unavailable: ${status.errorMessage}`;
    }

    this.announceStatus(message, "polite");
  }

  /**
   * Get accessibility information for a model
   * @param {Object} model - Model configuration
   * @returns {Object} Accessibility information
   */
  getAccessibilityInfo(model) {
    if (!model) return null;

    return {
      preferredFor: model.accessibility?.preferredFor || [],
      warnings: model.accessibility?.warnings || [],
      ariaLabels: {
        ...model.accessibility?.ariaLabels,
        ...this.generateModelAriaLabels(model),
      },
      enhancedDescriptions: model.metadata?.enhancedDescriptions || {},
      policyAriaLabels: this.generatePolicyAriaLabels(model),
    };
  }

  /**
   * Check if a model is preferred for an accessibility need
   * @param {Object} model - Model configuration
   * @param {string} accessibilityNeed - Accessibility need to check
   * @returns {boolean} Whether the model is preferred
   */
  isPreferredForAccessibilityNeed(model, accessibilityNeed) {
    if (!model || !model.accessibility?.preferredFor) return false;

    return model.accessibility.preferredFor.includes(accessibilityNeed);
  }

  /**
   * Get models preferred for an accessibility need
   * @param {Array} models - Array of models to check
   * @param {string} accessibilityNeed - Accessibility need to check
   * @returns {Array} Models preferred for the accessibility need
   */
  getModelsPreferredForAccessibilityNeed(models, accessibilityNeed) {
    if (!models || !Array.isArray(models)) return [];

    return models.filter((model) =>
      this.isPreferredForAccessibilityNeed(model, accessibilityNeed)
    );
  }

  /**
   * Add accessibility attributes to a model selector
   * @param {HTMLElement} selectElement - Select element for model selection
   * @param {Array} models - Array of models
   */
  enhanceModelSelector(selectElement, models) {
    if (!selectElement || !models) return;

    // Add ARIA attributes to the select element
    selectElement.setAttribute("aria-label", "Select AI model");
    selectElement.setAttribute("role", "combobox");

    // Add ARIA attributes to each option
    Array.from(selectElement.options).forEach((option, index) => {
      const modelId = option.value;
      const model = models.find((m) => m.id === modelId);

      if (model) {
        const ariaLabels = this.generateModelAriaLabels(model);

        option.setAttribute("aria-label", ariaLabels.modelName);
        option.setAttribute("data-provider", model.provider);
        option.setAttribute("data-category", model.category);

        if (model.disabled) {
          option.setAttribute("aria-disabled", "true");
        }

        if (model.isFree) {
          option.setAttribute("data-free", "true");
        }
      }
    });
  }
}

// Create and export a singleton instance
export const accessibility = new ModelRegistryAccessibility();
