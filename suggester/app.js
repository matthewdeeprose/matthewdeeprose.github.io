/**
 * @fileoverview Main application entry point for the Colour Contrast Checker
 * This file handles the initialization of the color checker tool and sets up
 * event listeners for user interactions.
 * 
 * Accessibility Note: This tool helps ensure colour combinations meet WCAG 
 * contrast requirements for better readability for all users, including those
 * with visual impairments.
 *
 * Updated 3/11/2024
 */

import { ColorChecker } from './colorChecker.js';
import { CodeLocationHelper } from './utils/codeLocationHelper.js';  // Add for development

// Make helper available globally for development use
window.CodeLocationHelper = CodeLocationHelper;

// Log that the app is starting to load (helpful for debugging)
console.log('App.js is loading...');

/**
 * Main ColorChecker instance that will be used throughout the application
 * It's declared outside the event listener to be accessible everywhere in this module
 * @type {ColorChecker}
 */
let colorChecker;

/**
 * Wait for the DOM to be fully loaded before initializing the application
 * This ensures all HTML elements we need to work with are available
 * 
 * We use 'DOMContentLoaded' instead of 'load' because:
 * - DOMContentLoaded fires when HTML is loaded and parsed
 * - 'load' waits for all resources (images, etc.) which isn't necessary here
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded...');

    try {
        // Create a new instance of the ColorChecker
        colorChecker = new ColorChecker();
        console.log('ColorChecker instance created');
        
        // Initialize the color checker
        await colorChecker.init();
        console.log('ColorChecker core initialization complete');
        
        // Log the state after initialization
        console.log('Colors loaded:', colorChecker.storage.colors);
        console.log('Active colors:', colorChecker.storage.activeColors);
        
        // Find the randomize button in the DOM
        const randomizeBtn = document.getElementById('randomizeBtn');
        
        // Check if the button exists before adding the event listener
        if (randomizeBtn) {
            // Add click event listener to the randomize button
            randomizeBtn.addEventListener('click', () => {
                try {
                    // When clicked, generate new random color combinations
                    colorChecker.randomAll();
                } catch (error) {
                    // If something goes wrong during randomization
                    console.error('Randomize error:', error);
                    // Display the error to the user through the UI
                    colorChecker.uiManager.displayError(error.message);
                }
            });
            console.log('Randomize button event listener attached');
        } else {
            // Log a warning if the button isn't found - helpful for debugging
            console.warn('Randomize button not found in the DOM');
        }
        
        console.log('Application initialization complete - ready for user interaction');
    } catch (error) {
        // Log any errors that occur during initialization
        console.error('Failed to initialize ColorChecker:', error);
    }
});