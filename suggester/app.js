/**
 * @fileoverview Main application entry point for the Colour Contrast Checker
 * This file handles the initialization of the color checker tool and sets up
 * event listeners for user interactions.
 *
 * Accessibility Note: This tool helps ensure colour combinations meet WCAG
 * contrast requirements for better readability for all users, including those
 * with visual impairments.
 *
 *
 */

import { ColorChecker } from "./colorChecker.js";
import { CodeLocationHelper } from "./utils/codeLocationHelper.js"; // Add for development
import { DebugLogger } from "./utils/debugLogger.js";

// Initialize debug mode before anything else
DebugLogger.init();

// Log that the app is starting to load (now using DebugLogger)
DebugLogger.log("App.js is loading...");

// Make helper available globally for development use
window.CodeLocationHelper = CodeLocationHelper;

/**
 * Main ColorChecker instance that will be used throughout the application
 * @type {ColorChecker}
 */
let colorChecker;

document.addEventListener("DOMContentLoaded", async () => {
  DebugLogger.log("DOM Content Loaded...");

  try {
    // Create a new instance of the ColorChecker
    colorChecker = new ColorChecker();
    await colorChecker.init();

    // Set up randomize button
    const randomizeBtn = document.getElementById("randomizeBtn");
    if (randomizeBtn) {
      randomizeBtn.addEventListener("click", () => {
        try {
          colorChecker.randomAll();
        } catch (error) {
          DebugLogger.error("Randomize error:", error);
          colorChecker.uiManager.displayError(error.message);
        }
      });
    }
  } catch (error) {
    DebugLogger.error("Failed to initialize ColorChecker:", error);
  }
});
