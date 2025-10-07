/**
 * @module AccessibilityContentProcessor
 * @description Enhances content with accessibility features
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

export class AccessibilityContentProcessor extends ContentProcessorBase {
  /**
   * Create a new AccessibilityContentProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Accessibility content processor initialized");
  }

  /**
   * Enhance content with accessibility features
   * @param {string} content - Content to process
   * @returns {string} Processed content with accessibility enhancements
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing content for accessibility");
      // Accessibility processing focuses on DOM enhancements after rendering
      return content;
    } catch (error) {
      this.utils.log(
        "Error processing accessibility features",
        { error },
        "error"
      );
      return content;
    }
  }

  /**
   * Enhance accessibility for rendered content
   * @param {HTMLElement} container - Container with rendered content
   */
  enhanceContentAccessibility(container) {
    if (!container) {
      this.utils.log(
        "No container provided for accessibility enhancement",
        {},
        "warn"
      );
      return;
    }

    try {
      this.utils.log("Enhancing content accessibility");

      // Enhance code blocks
      this.enhanceCodeBlockAccessibility(container);

      // Enhance links
      this.enhanceLinkAccessibility(container);

      // Enhance images
      this.enhanceImageAccessibility(container);
    } catch (error) {
      this.utils.log(
        "Error enhancing content accessibility",
        { error },
        "error"
      );
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
      element.setAttribute("role", "region");
      element.setAttribute("aria-label", "AI Response");
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
      element.setAttribute("role", "region");
      element.setAttribute("aria-live", "polite");
      element.setAttribute("aria-atomic", "false");
      element.setAttribute("aria-relevant", "additions");
      element.setAttribute("aria-label", "AI is generating a response");
    } catch (error) {
      this.utils.log(
        "Error setting up streaming ARIA attributes",
        { error },
        "error"
      );
    }
  }
}
