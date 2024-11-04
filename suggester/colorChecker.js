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
 * - Supports color hold feature for better user control
 *
 * Updated 12:42 01/11/24
 *
 */

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
		// Initialize click counter
		this.randomizeClickCount = 0;
		console.log('Randomize click counter initialized');
        this.storage = new ColorStorage();
        this.uiManager = null;
        this.initialized = false;
        console.log('ColorChecker instance created');
    }

    /**
     * Gets all required DOM elements for the color checker
     * @returns {Object} Object containing all required DOM elements
     * @throws {Error} If any required elements are missing
     */
    getDomElements() {
        try {
            const elements = {
                // Color display elements
                backgroundColor: this.getRequiredElement('backgroundColor', 'Background color display element'),
                backgroundName: this.getRequiredElement('backgroundName', 'Background color name element'),
                bgColor: this.getRequiredElement('bgColor', 'Background color box'),
                
                // Text color elements
                tcolor: this.getRequiredElement('tcolor', 'Text color display element'),
                tColorName: this.getRequiredElement('tColorName', 'Text color name element'),
                tColorColor: this.getRequiredElement('tColorColor', 'Text color box'),
                tcontrast: this.getRequiredElement('tcontrast', 'Text contrast display'),
                tcontrastWCAG: this.getRequiredElement('tcontrastWCAG', 'Text WCAG rating display'),
                
                // Graphic color elements
                icon1: this.getRequiredElement('icon1', 'Graphic 1 icon'),
                icon2: this.getRequiredElement('icon2', 'Graphic 2 icon'),
                icon3: this.getRequiredElement('icon3', 'Graphic 3 icon'),
                
                // Graphic color boxes and info
                g1colourSpan1: this.getRequiredElement('g1colourSpan1', 'Graphic 1 color code'),
                g1colourSpan2: this.getRequiredElement('g1colourSpan2', 'Graphic 1 color box'),
                g1contrast: this.getRequiredElement('g1contrast', 'Graphic 1 contrast'),
                g1contrastWCAG: this.getRequiredElement('g1contrastWCAG', 'Graphic 1 WCAG rating'),
                gfx1ColorName: this.getRequiredElement('gfx1ColorName', 'Graphic 1 color name'),
                
                g2colourSpan1: this.getRequiredElement('g2colourSpan1', 'Graphic 2 color code'),
                g2colourSpan2: this.getRequiredElement('g2colourSpan2', 'Graphic 2 color box'),
                g2contrast: this.getRequiredElement('g2contrast', 'Graphic 2 contrast'),
                g2contrastWCAG: this.getRequiredElement('g2contrastWCAG', 'Graphic 2 WCAG rating'),
                gfx2ColorName: this.getRequiredElement('gfx2ColorName', 'Graphic 2 color name'),
                
                g3colourSpan1: this.getRequiredElement('g3colourSpan1', 'Graphic 3 color code'),
                g3colourSpan2: this.getRequiredElement('g3colourSpan2', 'Graphic 3 color box'),
                g3contrast: this.getRequiredElement('g3contrast', 'Graphic 3 contrast'),
                g3contrastWCAG: this.getRequiredElement('g3contrastWCAG', 'Graphic 3 WCAG rating'),
                gfx3ColorName: this.getRequiredElement('gfx3ColorName', 'Graphic 3 color name'),
                
                // Display areas
                infoGraphicBox: this.getRequiredElement('infoGraphicBox', 'Info graphic box'),
                infoTexT: this.getRequiredElement('infoTexT', 'Info text display'),
				// Counter display element
                counterDisplay: this.getRequiredElement('counterDisplay', 'Randomize counter display'),    
                // Screen reader and accessibility elements
                srResults: this.getRequiredElement('srResults', 'Screen reader results')
            };

            // Add file input elements if they exist (optional)
            const jsonInput = document.getElementById('jsonFileInput');
            const csvInput = document.getElementById('csvFileInput');
            if (jsonInput) elements.jsonFileInput = jsonInput;
            if (csvInput) elements.csvFileInput = csvInput;

            return elements;
        } catch (error) {
            console.error('Failed to get DOM elements:', error);
            throw new Error(`Failed to initialize: ${error.message}`);
        }
    }

    /**
     * Helper method to get a required DOM element
     * @param {string} id - Element ID to find
     * @param {string} description - Description of the element for error messages
     * @returns {HTMLElement} The found DOM element
     * @throws {Error} If the element is not found
     */
    getRequiredElement(id, description) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Required ${description} (ID: ${id}) not found in the DOM`);
        }
        return element;
    }

    /**
     * Initializes the color checker system
     * This needs to be called before using any other methods
     * @throws {Error} If initialization fails or required elements are missing
     */
async init() {
    console.log('ColorChecker init started');
    
    // Verify chroma.js is available
    if (typeof chroma === 'undefined') {
        throw new Error('chroma.js is required but not loaded');
    }

    try {
        // Get required DOM elements
        const elements = this.getDomElements();
        console.log('DOM elements retrieved');
        
        // Create UI manager
        this.uiManager = new UIManager(elements, this.storage);
        console.log('UI manager created');

        // Set up file upload handlers
        FileHandler.initFileUploads({
            colorStorage: this.storage,
            uiManager: this.uiManager
        });
        console.log('File upload handlers initialized');

        // Load and activate default colors
        const defaultStats = await this.loadDefaultColors();
        console.log('Default colors loaded:', defaultStats);
        
        // Initialize active colors (all colors active by default)
        const stats = this.storage.initActiveColors();
        console.log('Active colors initialized:', stats);
        
        // Mark as initialized BEFORE updating UI
        this.initialized = true;
        console.log('System marked as initialized');
        
        // Now update UI with current color management state
        this.updateColorManagement();
        
        // Display initial statistics
        this.uiManager.displayUploadStats(stats);
        
        console.log('ColorChecker initialization complete');
    } catch (error) {
        console.error('Failed to initialize ColorChecker:', error);
        throw error;
    }
}

    /**
     * Loads default colors from configuration
     * @returns {Promise<void>}
     */
    async loadDefaultColors() {
        try {
            // Validate default colors before loading
            ColorValidator.validateColorJson(defaultColors);
            
            // Load colors into storage
            const stats = this.storage.loadColors(defaultColors);
            console.log('Default colors loaded:', stats);
            
            return stats;
        } catch (error) {
            console.error('Failed to load default colors:', error);
            throw error;
        }
    }

    /**
     * Generates a random accessible color combination, respecting held colors
     * @returns {Object} Selected colors for background, text, and graphics
     * @throws {Error} If not initialized or no valid combinations exist
     */
    randomAll() {
		// Increment the click counter and update UI
        this.randomizeClickCount++;
        console.log('Randomize clicked:', this.randomizeClickCount, 'times');
        this.uiManager.updateRandomizeCounter(this.randomizeClickCount);

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
    console.log('updateColorManagement called');
    console.log('Is initialized?', this.initialized);
    console.log('Has UI manager?', !!this.uiManager);
    console.log('Has storage?', !!this.storage);
    console.log('Storage colors:', this.storage?.colors);
    console.log('Storage active colors:', this.storage?.activeColors);
    
    if (!this.initialized) {
        console.warn('Cannot update color management - system not fully initialized');
        return;
    }
    
    if (!this.uiManager) {
        console.warn('Cannot update color management - UI manager not available');
        return;
    }
    
    if (!this.storage || !this.storage.colors || !this.storage.activeColors) {
        console.warn('Cannot update color management - storage not properly initialized');
        return;
    }
    
    console.log('Updating color management UI with:', {
        colors: this.storage.colors,
        activeColors: this.storage.activeColors
    });
    
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