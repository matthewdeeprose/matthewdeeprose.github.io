/**
 * @fileoverview Contrast Checker Module
 * This module helps check if color combinations are accessible for all users.
 * It uses both WCAG 2.1 and APCA standards to measure contrast.
 *
 * WCAG 2.1: Traditional contrast measurement (ratio based)
 * APCA: Newer, more advanced contrast measurement
 *
 * Required: You need to include chroma.js in your project for this to work!
 */

export class ContrastChecker {
  /**
   * Creates a new ContrastChecker
   * This is called when you do: new ContrastChecker()
   * Example: const checker = new ContrastChecker();
   */
  constructor() {
    // Check if we have access to the chroma.js library
    // If not, we can't calculate contrasts, so we throw an error
    if (typeof chroma === "undefined") {
      throw new Error("Chroma.js is required for contrast calculations");
    }
  }

  /**
   * The main function to check contrast between two colors
   * Both WCAG and APCA results are calculated at once
   *
   * @param {string} foreground - The text/front color (like "#000000" for black)
   * @param {string} background - The background color (like "#FFFFFF" for white)
   * @returns {Object} All the contrast information for both standards
   *
   * Example usage:
   * const results = checker.calculateContrast("#000000", "#FFFFFF");
   * console.log(results.wcag.ratio);  // Shows WCAG contrast ratio
   * console.log(results.apca.contrast);  // Shows APCA contrast value
   */
  calculateContrast(foreground, background) {
    // Calculate WCAG contrast
    const wcagContrast = chroma.contrast(foreground, background);
    const wcagRating = this.getWCAGRating(wcagContrast);

    // Calculate APCA contrast - Using correct method
    const apcaContrast = chroma.contrastAPCA(foreground, background);
    const apcaCompliance = this.getAPCACompliance(apcaContrast);

    return {
      wcag: {
        ratio: wcagContrast,
        rating: wcagRating,
        isTextReadable: wcagContrast >= 4.5,
        isLargeTextReadable: wcagContrast >= 3,
        isGraphicsReadable: wcagContrast >= 3,
      },
      apca: {
        contrast: apcaContrast,
        compliance: apcaCompliance,
        isTextReadable: Math.abs(apcaContrast) >= 60,
        isLargeTextReadable: Math.abs(apcaContrast) >= 45,
        isGraphicsReadable: Math.abs(apcaContrast) >= 45,
      },
    };
  }

  /**
   * Figures out the WCAG rating based on contrast ratio
   *
   * @param {number} contrast - The WCAG contrast ratio
   * @returns {string} The rating (AAA, AA, G, or F)
   *
   * Ratings mean:
   * AAA = Best possible (7:1 or higher)
   * AA  = Good enough for most uses (4.5:1 or higher)
   * G   = Good enough for large text only (3:1 or higher)
   * F   = Failed, not accessible enough (less than 3:1)
   */
  getWCAGRating(contrast) {
    if (contrast >= 7) return "AAA";
    if (contrast >= 4.5) return "AA";
    if (contrast >= 3) return "G";
    return "F";
  }

  /**
   * Determines the APCA compliance level
   * APCA is more detailed than WCAG and gives specific use cases
   *
   * @param {number} contrast - The APCA contrast value
   * @returns {Object} Detailed compliance information
   *
   * Example return value:
   * {
   *   level: "Preferred",
   *   description: "Preferred level for body text",
   *   useCase: "Body text, large text, and graphics"
   * }
   */
  getAPCACompliance(contrast) {
    // We use absolute value because APCA can be negative
    const absContrast = Math.abs(contrast);

    // Check each level from best to worst
    if (absContrast >= 90)
      return {
        level: "Preferred",
        description: "Preferred level for body text",
        useCase: "Body text, large text, and graphics",
      };

    if (absContrast >= 75)
      return {
        level: "High",
        description: "High contrast for body text",
        useCase: "Body text and large text",
      };

    if (absContrast >= 60)
      return {
        level: "Standard",
        description: "Standard level for text",
        useCase: "Body text (minimum)",
      };

    if (absContrast >= 45)
      return {
        level: "Minimum",
        description: "Minimum for large text",
        useCase: "Large text and graphics",
      };

    if (absContrast >= 30)
      return {
        level: "Low",
        description: "Low contrast, use for large text only",
        useCase: "Large text (minimum)",
      };

    return {
      level: "Insufficient",
      description: "Insufficient contrast",
      useCase: "Not recommended for text",
    };
  }

  /**
   * Checks if colors work well together for a specific use
   * Can check against both WCAG and APCA standards
   *
   * @param {string} foreground - The text/front color (hex code)
   * @param {string} background - The background color (hex code)
   * @param {Object} options - Settings for the check
   * @param {boolean} options.strictMode - If true, must pass both WCAG and APCA
   * @param {string} options.useCase - What the colors are for ('text', 'largeText', or 'graphics')
   * @returns {Object} Results of the validation
   *
   * Example usage:
   * const result = checker.validateColorCombination("#000000", "#FFFFFF", {
   *   strictMode: true,
   *   useCase: "text"
   * });
   */
  validateColorCombination(foreground, background, options = {}) {
    // Set default options if none provided
    const { strictMode = false, useCase = "text" } = options;

    // Get all contrast calculations
    const contrast = this.calculateContrast(foreground, background);

    // Track if colors pass each standard
    let wcagPasses = false;
    let apcaPasses = false;

    // Check against appropriate standards based on use case
    switch (useCase) {
      case "text":
        wcagPasses = contrast.wcag.isTextReadable;
        apcaPasses = contrast.apca.isTextReadable;
        break;
      case "largeText":
        wcagPasses = contrast.wcag.isLargeTextReadable;
        apcaPasses = contrast.apca.isLargeTextReadable;
        break;
      case "graphics":
        wcagPasses = contrast.wcag.isGraphicsReadable;
        apcaPasses = contrast.apca.isGraphicsReadable;
        break;
      default:
        throw new Error(`Invalid use case: ${useCase}`);
    }

    // Return comprehensive results
    return {
      // In strict mode, both standards must pass
      // In normal mode, passing either standard is enough
      isAccessible: strictMode
        ? wcagPasses && apcaPasses
        : wcagPasses || apcaPasses,
      wcag: {
        passes: wcagPasses,
        ...contrast.wcag,
      },
      apca: {
        passes: apcaPasses,
        ...contrast.apca,
      },
    };
  }

  /**
   * Creates a human-readable summary of the accessibility check
   * Perfect for screen readers or displaying results to users
   *
   * @param {string} foreground - The text/front color (hex code)
   * @param {string} background - The background color (hex code)
   * @param {string} useCase - What the colors are for ('text', 'largeText', or 'graphics')
   * @returns {string} A friendly summary of the results
   *
   * Example usage:
   * const summary = checker.getAccessibilitySummary("#000000", "#FFFFFF", "text");
   * console.log(summary);
   */
  getAccessibilitySummary(foreground, background, useCase = "text") {
    // Get all the contrast information
    const contrast = this.calculateContrast(foreground, background);
    const validation = this.validateColorCombination(foreground, background, {
      useCase,
    });

    // Create a nicely formatted summary
    // We use template literals (`) to make multi-line text easier to read
    return `
            Color combination ${
              validation.isAccessible ? "meets" : "does not meet"
            } accessibility standards.
            WCAG contrast ratio is ${contrast.wcag.ratio.toFixed(
              2
            )} to 1, rated ${contrast.wcag.rating}.
            APCA contrast value is ${contrast.apca.contrast.toFixed(
              1
            )}, rated as ${contrast.apca.compliance.level}.
            ${contrast.apca.compliance.description}.
            Recommended for: ${contrast.apca.compliance.useCase}.
        `
      .replace(/\s+/g, " ")
      .trim();
  }
}
