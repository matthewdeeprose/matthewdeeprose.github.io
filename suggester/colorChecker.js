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
        
        // Log initialization
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
     * Gets all required DOM elements for the application
     * @returns {Object} Map of element IDs to DOM elements
     * @throws {Error} If any required elements are missing
     */
    getDomElements() {
        // List of all required element IDs
        const elementIds = [
            // Visual elements
            'infoGraphicBox', 'bgColor', 'tColorColor',
            'g1colourSpan2', 'g2colourSpan2', 'g3colourSpan2',
            'infoTexT', 'icon1', 'icon2', 'icon3',
            
            // Color information displays
            'backgroundColor', 'tcolor', 'tcontrast', 'tcontrastWCAG',
            'tColorName', 'g1colourSpan1', 'g1contrast', 'g1contrastWCAG',
            'gfx1ColorName', 'g2colourSpan1', 'g2contrast', 'g2contrastWCAG',
            'gfx2ColorName', 'g3colourSpan1', 'g3contrast', 'g3contrastWCAG',
            'gfx3ColorName', 'backgroundName',
            
            // Screen reader results
            'srResults'
        ];

        const elements = {};
        const missingElements = [];

        // Check for existence of each required element
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                missingElements.push(id);
            }
        });

        // If any elements are missing, throw an error
        if (missingElements.length > 0) {
            throw new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
        }

        return elements;
    }

    /**
     * Sets up file upload handlers for JSON and CSV color palette imports
     */
    initFileUploads() {
        // Initialize file handler with storage and UI manager references
        FileHandler.initFileUploads({
            colorStorage: this.storage,
            uiManager: this.uiManager
        });
    }

    /**
     * Loads the default color palette into storage
     * @returns {Promise<Object>} Statistics about loaded colors
     */
    async loadDefaultColors() {
        try {
            const stats = this.storage.loadColors(defaultColors);
            this.uiManager.displayUploadStats(stats);
            return stats;
        } catch (error) {
            this.uiManager.displayError('Failed to load default colors: ' + error.message);
            throw error;
        }
    }

    /**
     * Gets the human-readable name for a color
     * @param {string} colour Hex color code
     * @returns {string} Color name
     */
    getColorName(colour) {
        return this.storage.getColorName(colour);
    }

    /**
     * Generates a random accessible color combination
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
        console.log("Checking valid backgrounds...");
        const validBackgrounds = Array.from(this.storage.validColorSets.keys());
        console.log("Valid backgrounds:", validBackgrounds);
        
        if (validBackgrounds.length === 0) {
            console.error("No valid color combinations found");
            throw new Error("No valid color combinations available");
        }

        // Select random background color
        console.log("Selecting background color...");
        const backgroundColor = validBackgrounds[Math.floor(Math.random() * validBackgrounds.length)];
        console.log("Selected background:", backgroundColor);
        
        // Get matching color set for selected background
        console.log("Getting color set...");
        const colorSet = this.storage.validColorSets.get(backgroundColor);
        console.log("Color set:", colorSet);

        // Select random text color from valid options
        console.log("Selecting text color...");
        const textColor = colorSet.textColors[Math.floor(Math.random() * colorSet.textColors.length)].colourHex;
        console.log("Selected text color:", textColor);
        
        // Select random graphic colors
        console.log("Selecting graphic colors...");
        const selectedGraphicColors = MathUtils.getRandom(
            colorSet.graphicColors.map(c => c.colourHex),
            3
        );
        console.log("Selected graphic colors:", selectedGraphicColors);

        // Update the UI with new colors
        console.log("Updating UI...");
        this.uiManager.updateUI(backgroundColor, textColor, selectedGraphicColors);

        console.log("Randomise function ends");
        return {
            background: backgroundColor,
            text: textColor,
            graphics: selectedGraphicColors
        };
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