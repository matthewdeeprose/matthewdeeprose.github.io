/**
 * @module AccessibilityManager
 * @description Manages accessibility features
 */
import { a11y } from "../accessibility-helpers.js";
import { ResultsManagerUtils } from "./results-manager-utils.js";

export class AccessibilityManager {
  /**
   * Create a new AccessibilityManager instance
   */
  constructor() {
    this.motionWatcher = null;
    this.utils = new ResultsManagerUtils();
    this.utils.log("Accessibility manager initialized");
  }

  /**
   * Setup motion watcher
   * @param {Function} callback - Callback to call when preference changes
   * @returns {Function|null} Function to remove watcher or null if not supported
   */
  setupMotionWatcher(callback) {
    if (!callback || typeof callback !== "function") {
      this.utils.log(
        "Invalid callback provided for motion watcher",
        {},
        "warn"
      );
      return null;
    }

    try {
      if (a11y.watchMotionPreference) {
        this.motionWatcher = a11y.watchMotionPreference((prefersReduced) => {
          this.utils.log(
            `Motion preference changed: ${
              prefersReduced ? "reduced" : "standard"
            } motion`
          );
          callback(prefersReduced);
        });

        this.utils.log("Motion watcher setup successfully");
        return this.motionWatcher;
      } else {
        // Fallback if the watchMotionPreference method isn't available
        const isReducedMotion = a11y.prefersReducedMotion
          ? a11y.prefersReducedMotion()
          : false;

        this.utils.log(
          `Motion preference initialized (fallback): ${
            isReducedMotion ? "reduced" : "standard"
          } motion`
        );

        // Call the callback with the initial value
        callback(isReducedMotion);
        return null;
      }
    } catch (error) {
      this.utils.log("Error setting up motion watcher", { error }, "error");
      return null;
    }
  }

  /**
   * Cleanup motion watcher
   */
  cleanupMotionWatcher() {
    if (this.motionWatcher && typeof this.motionWatcher === "function") {
      this.utils.log("Cleaning up motion watcher");
      this.motionWatcher();
      this.motionWatcher = null;
    }
  }

  /**
   * Announce status to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - Announcement priority
   */
  announceStatus(message, priority = "polite") {
    if (!message) {
      this.utils.log(
        "Empty message provided for screen reader announcement",
        {},
        "warn"
      );
      return;
    }

    try {
      a11y.announceStatus(message, priority);
      this.utils.log(`Announced to screen readers (${priority}): ${message}`);
    } catch (error) {
      this.utils.log(
        "Error announcing status to screen readers",
        { error, message },
        "error"
      );
    }
  }

  /**
   * Setup ARIA attributes for results container
   * @param {HTMLElement} element - Element to setup
   */
  setupAriaAttributes(element) {
    if (!element) {
      this.utils.log(
        "Cannot setup ARIA attributes: element not provided",
        {},
        "warn"
      );
      return;
    }

    try {
      // Set basic ARIA attributes for results container
      element.setAttribute("role", "region");
      element.setAttribute("aria-label", "AI Response");

      this.utils.log("ARIA attributes set up for results container");
    } catch (error) {
      this.utils.log("Error setting up ARIA attributes", { error }, "error");
    }
  }

  /**
   * Setup ARIA attributes for streaming container
   * @param {HTMLElement} element - Element to setup
   */
  setupStreamingAriaAttributes(element) {
    if (!element) {
      this.utils.log(
        "Cannot setup streaming ARIA attributes: element not provided",
        {},
        "warn"
      );
      return;
    }

    try {
      // Set ARIA attributes for streaming container
      element.setAttribute("role", "region");
      element.setAttribute("aria-live", "polite");
      element.setAttribute("aria-atomic", "false");
      element.setAttribute("aria-relevant", "additions");
      element.setAttribute("aria-label", "AI is generating a response");

      this.utils.log("ARIA attributes set up for streaming container");
    } catch (error) {
      this.utils.log(
        "Error setting up streaming ARIA attributes",
        { error },
        "error"
      );
    }
  }

  /**
   * Check if reduced motion is preferred
   * @returns {boolean} True if reduced motion is preferred
   */
  isReducedMotionPreferred() {
    try {
      return a11y.prefersReducedMotion ? a11y.prefersReducedMotion() : false;
    } catch (error) {
      this.utils.log(
        "Error checking reduced motion preference",
        { error },
        "error"
      );
      return false; // Default to standard motion if there's an error
    }
  }

  /**
   * Enhance accessibility for code blocks
   * @param {HTMLElement} container - Container with code blocks
   */
  enhanceCodeBlockAccessibility(container) {
    if (!container) return;

    try {
      const codeBlocks = container.querySelectorAll("pre code");
      if (codeBlocks.length === 0) return;

      this.utils.log(
        `Enhancing accessibility for ${codeBlocks.length} code blocks`
      );

      codeBlocks.forEach((block) => {
        // Check if the code block is within a <dt> element or other non-interactive context
        let isInNonInteractiveContext = false;
        let parent = block.parentElement;

        // Traverse up the DOM tree to check for non-interactive parent contexts
        while (parent) {
          const parentTag = parent.tagName.toLowerCase();
          if (parentTag === "dt" || parentTag === "dd") {
            isInNonInteractiveContext = true;
            this.utils.log("Code block found in non-interactive context", {
              context: parentTag,
            });
            break;
          }
          parent = parent.parentElement;
        }

        // Only add tabindex if not in a non-interactive context
        if (!isInNonInteractiveContext) {
          // Add tabindex for keyboard navigation
          block.setAttribute("tabindex", "0");
        } else {
          // Remove tabindex if it was previously set
          if (block.hasAttribute("tabindex")) {
            block.removeAttribute("tabindex");
          }
        }

        // Add aria-label for screen readers (always add this regardless of context)
        const language = block.className.match(/language-(\w+)/);
        if (language) {
          block.setAttribute("aria-label", `Code example in ${language[1]}`);
        } else {
          block.setAttribute("aria-label", "Code example");
        }
      });
    } catch (error) {
      this.utils.log(
        "Error enhancing code block accessibility",
        { error },
        "error"
      );
    }
  }

  /**
   * Enhance accessibility for links
   * @param {HTMLElement} container - Container with links
   */
  enhanceLinkAccessibility(container) {
    if (!container) return;

    try {
      const links = container.querySelectorAll("a");
      if (links.length === 0) return;

      this.utils.log(`Enhancing accessibility for ${links.length} links`);

      links.forEach((link) => {
        // Add target and rel attributes for external links
        if (link.getAttribute("href")?.startsWith("http")) {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");

          // Add screen reader indication that link opens in new tab
          if (!link.getAttribute("aria-label")) {
            link.setAttribute(
              "aria-label",
              `${link.textContent} (opens in new tab)`
            );
          }
        }
      });
    } catch (error) {
      this.utils.log("Error enhancing link accessibility", { error }, "error");
    }
  }

  /**
   * Enhance accessibility for images
   * @param {HTMLElement} container - Container with images
   */
  enhanceImageAccessibility(container) {
    if (!container) return;

    try {
      const images = container.querySelectorAll("img");
      if (images.length === 0) return;

      this.utils.log(`Enhancing accessibility for ${images.length} images`);

      images.forEach((img) => {
        // Ensure all images have alt text
        if (!img.hasAttribute("alt")) {
          img.setAttribute("alt", "Image in AI response");
          this.utils.log("Added missing alt text to image", {}, "warn");
        }
      });
    } catch (error) {
      this.utils.log("Error enhancing image accessibility", { error }, "error");
    }
  }
}
