/**
 * @fileoverview Color Checker Class
 * This class manages color combinations checking for WCAG contrast compliance.
 * It handles color storage, UI updates, and file uploads for an accessible
 * color combination tool.
 * 
 * Accessibility Features:
 * - Validates color combinations against WCAG 2.1 contrast requirements
 * - Provides clear feedback for screen readers via srResults element
 * - Handles both mouse and keyboard interactions
 */

// Import required dependencies and utilities
import { defaultColors } from './config/defaultColors.js';
import { ColorValidator } from './utils/colorValidation.js';
import { MathUtils } from './utils/mathUtils.js';
import { ColorStorage } from './services/colorStorage.js';
import { FileHandler } from './services/fileHandler.js';
import { UIManager } from './ui/uiManager.js';

export class ColorChecker {
    /**
     * Creates a new ColorChecker instance
     * Initializes storage but waits for init() to set up UI
     */
    constructor() {
        this.storage = new ColorStorage();
        this.uiManager = null;
        this.initialized = false;
        
        console.log('ColorChecker instance created');
    }

    /**
     * Initializes the color checker system
     * This needs to be called before using any other methods
     * @throws {Error} If initialization fails or required elements are missing
     */
    async init() {
        // Verify chroma.js is available
        if (typeof chroma === 'undefined') {
            throw new Error('chroma.js is required but not loaded');
        }

        try {
            // Get required DOM elements
            const elements = this.getDomElements();
            
            // Create UI manager
            this.uiManager = new UIManager(elements, this.storage);

            // Set up file upload handlers
            this.initFileUploads();

            // Load and activate default colors
            await this.loadDefaultColors();
            
            // Initialize active colors (all colors active by default)
            this.storage.initActiveColors();
            
            // Pre-validate color combinations with active colors
            const stats = this.storage.preValidateColorCombinations();
            
            // Update UI with current color management state
            this.uiManager.updateColorManagementUI(
                this.storage.colors,
                this.storage.activeColors,
                (colorHex) => {
                    const stats = this.storage.toggleColor(colorHex);
                    this.uiManager.displayUploadStats(stats);
                },
                (active) => {
                    const stats = this.storage.toggleAllColors(active);
                    this.uiManager.displayUploadStats(stats);
                }
            );

            // Display initial statistics
            this.uiManager.displayUploadStats(stats);

            // Mark as initialized
            this.initialized = true;
            
            console.log('ColorChecker initialized successfully with stats:', stats);
        } catch (error) {
            console.error('Failed to initialize ColorChecker:', error);
            throw error;
        }
    }

    /**
     * Generates a random accessible color combination, respecting held colors
     * @returns {Object} Selected colors for background, text, and graphics
     * @throws {Error} If not initialized or no valid combinations exist
     */
    randomAll() {
        console.log("Randomise function starts");

        if (!this.initialized) {
            console.error('Not initialized!');
            throw new Error('ColorChecker not initialized');
        }

        // Get list of valid background colors
        const validBackgrounds = Array.from(this.storage.validColorSets.keys());
        console.log("Valid backgrounds:", validBackgrounds);
        
        if (validBackgrounds.length === 0) {
            console.error("No valid color combinations found");
            throw new Error("No valid color combinations available");
        }

        // Initialize result object
        const result = {
            background: null,
            text: null,
            graphics: []
        };

        // Handle background color
        if (this.storage.isColorHeld('background')) {
            result.background = this.storage.getHeldColor('background');
        } else {
            result.background = validBackgrounds[Math.floor(Math.random() * validBackgrounds.length)];
        }

        // Get the valid color set for this background
        const colorSet = this.storage.validColorSets.get(result.background);
        if (!colorSet) {
            throw new Error("Invalid background color or no valid combinations available");
        }

        // Handle text color
        if (this.storage.isColorHeld('text')) {
            result.text = this.storage.getHeldColor('text');
            // Verify the held text color is still valid with the current background
            if (!colorSet.textColors.some(c => c.colourHex === result.text)) {
                console.warn("Held text color no longer valid with current background");
                result.text = colorSet.textColors[Math.floor(Math.random() * colorSet.textColors.length)].colourHex;
            }
        } else {
            result.text = colorSet.textColors[Math.floor(Math.random() * colorSet.textColors.length)].colourHex;
        }

        // Handle graphic colors
        const graphicTypes = ['graphic1', 'graphic2', 'graphic3'];
        const availableGraphicColors = [...colorSet.graphicColors.map(c => c.colourHex)];
        
        // Process held graphic colors first
        graphicTypes.forEach((type, index) => {
            if (this.storage.isColorHeld(type)) {
                const heldColor = this.storage.getHeldColor(type);
                // Verify the held color is still valid with the current background
                if (colorSet.graphicColors.some(c => c.colourHex === heldColor)) {
                    result.graphics[index] = heldColor;
                    // Remove from available colors to prevent duplicates
                    const colorIndex = availableGraphicColors.indexOf(heldColor);
                    if (colorIndex > -1) {
                        availableGraphicColors.splice(colorIndex, 1);
                    }
                } else {
                    console.warn(`Held ${type} color no longer valid with current background`);
                }
            }
        });

        // Fill in remaining graphic colors
        graphicTypes.forEach((type, index) => {
            if (!result.graphics[index]) {  // If not already set by held color
                if (availableGraphicColors.length === 0) {
                    console.warn("Not enough valid graphic colors available");
                    // Reset available colors if we've used them all
                    availableGraphicColors.push(...colorSet.graphicColors.map(c => c.colourHex));
                }
                const randomIndex = Math.floor(Math.random() * availableGraphicColors.length);
                result.graphics[index] = availableGraphicColors[randomIndex];
                availableGraphicColors.splice(randomIndex, 1);
            }
        });

        // Update the UI with new colors
        this.uiManager.updateUI(result.background, result.text, result.graphics);

        console.log("Randomise function ends with result:", result);
        return result;
    }

    /**
     * Resets the color checker to its initial state
     * Useful when loading new color palettes
     */
    reset() {
        this.storage.clear();
        if (this.uiManager) {
            this.uiManager.clearError();
        }
    }

    /**
     * Updates the color management UI
     * Should be called after changes to active colors
     */
    updateColorManagement() {
        if (this.initialized && this.uiManager) {
            this.uiManager.updateColorManagementUI(
                this.storage.colors,
                this.storage.activeColors,
                (colorHex) => {
                    const stats = this.storage.toggleColor(colorHex);
                    this.uiManager.displayUploadStats(stats);
                },
                (active) => {
                    const stats = this.storage.toggleAllColors(active);
                    this.uiManager.displayUploadStats(stats);
                }
            );
        }
    }
}