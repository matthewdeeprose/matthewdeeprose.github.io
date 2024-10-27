import { defaultColors } from './config/defaultColors.js';
import { ColorValidator } from './utils/colorValidation.js';
import { MathUtils } from './utils/mathUtils.js';
import { ColorStorage } from './services/colorStorage.js';
import { FileHandler } from './services/fileHandler.js';
import { UIManager } from './ui/uiManager.js';

export class ColorChecker {
    constructor() {
        this.storage = new ColorStorage();
        this.uiManager = null;
        this.initialized = false;
    }

    /**
     * Initialize the color checker
     * @throws {Error} If initialization fails
     */
    async init() {
        // Check for required dependencies
        if (typeof chroma === 'undefined') {
            throw new Error('chroma.js is required but not loaded');
        }

        // Get and validate DOM elements
        const elements = this.getDomElements();
        this.uiManager = new UIManager(elements);

        // Initialize file uploads
        this.initFileUploads();

        // Load default colors
        await this.loadDefaultColors();

        this.initialized = true;
    }

    /**
     * Get all required DOM elements
     * @returns {Object} Object containing DOM element references
     * @throws {Error} If required elements are missing
     */
    getDomElements() {
        const elementIds = [
            'infoGraphicBox', 'bgColor', 'tColorColor',
            'g1colourSpan2', 'g2colourSpan2', 'g3colourSpan2',
            'infoTexT', 'icon1', 'icon2', 'icon3',
            'backgroundColor', 'tcolor', 'tcontrast', 'tcontrastWCAG',
            'tColorName', 'g1colourSpan1', 'g1contrast', 'g1contrastWCAG',
            'gfx1ColorName', 'g2colourSpan1', 'g2contrast', 'g2contrastWCAG',
            'gfx2ColorName', 'g3colourSpan1', 'g3contrast', 'g3contrastWCAG',
            'gfx3ColorName', 'backgroundName', 'srResults'
        ];

        const elements = {};
        const missingElements = [];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                missingElements.push(id);
            }
        });

        if (missingElements.length > 0) {
            throw new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
        }

        return elements;
    }

    /**
     * Initialize file upload handlers
     */
    initFileUploads() {
        const jsonInput = document.getElementById('jsonFileInput');
        const csvInput = document.getElementById('csvFileInput');

        if (jsonInput) {
            jsonInput.addEventListener('change', async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;

                    // Validate file size
                    FileHandler.validateFileSize(file);

                    // Process the file
                    const colors = await FileHandler.handleJsonUpload(file);
                    
                    // Load the colors into storage
                    const stats = this.storage.loadColors(colors);
                    
                    // Update UI
                    this.uiManager.displayUploadStats(stats);
                    this.uiManager.clearError();
                } catch (error) {
                    this.uiManager.displayError(error.message);
                }
            });
        }

        if (csvInput) {
            csvInput.addEventListener('change', async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;

                    // Validate file size
                    FileHandler.validateFileSize(file);

                    // Process the file
                    const colors = await FileHandler.handleCsvUpload(file);
                    
                    // Load the colors into storage
                    const stats = this.storage.loadColors(colors);
                    
                    // Update UI
                    this.uiManager.displayUploadStats(stats);
                    this.uiManager.clearError();
                } catch (error) {
                    this.uiManager.displayError(error.message);
                }
            });
        }
    }

    /**
     * Load default colors
     */
    async loadDefaultColors() {
        try {
            const stats = this.storage.loadColors(defaultColors);
            this.uiManager.displayUploadStats(stats);
        } catch (error) {
            this.uiManager.displayError('Failed to load default colors: ' + error.message);
        }
    }

    /**
     * Calculate WCAG rating based on contrast ratio
     * @param {number} contrastRatio 
     * @returns {string} WCAG rating
     */
    getWcagRating(contrastRatio) {
        if (contrastRatio >= 7) return "AAA";
        if (contrastRatio >= 4.5) return "AA";
        if (contrastRatio >= 3) return "G";
        return "F";
    }

    /**
     * Get color name from hex code
     * @param {string} colour - Hex color code
     * @returns {string} Color name
     */
    getColorName(colour) {
        return this.storage.getColorName(colour);
    }

    /**
     * Main function to randomize and check colors
     * @returns {Object} Selected color combination
     * @throws {Error} If no valid combinations are available
     */
    randomAll() {
        console.log("Randomise function starts");

        if (!this.initialized) {
            throw new Error('ColorChecker not initialized');
        }

        const validBackgrounds = Array.from(this.storage.validColorSets.keys());
        if (validBackgrounds.length === 0) {
            throw new Error("No valid color combinations available");
        }

        // Select random background color
        const backgroundColor = validBackgrounds[Math.floor(Math.random() * validBackgrounds.length)];
        const colorSet = this.storage.validColorSets.get(backgroundColor);

        // Select random text color
        const textColor = colorSet.textColors[Math.floor(Math.random() * colorSet.textColors.length)].colourHex;
        
        // Select random graphic colors
        const selectedGraphicColors = MathUtils.getRandom(
            colorSet.graphicColors.map(c => c.colourHex),
            3
        );

        // Update UI with new colors
        this.uiManager.updateUI(backgroundColor, textColor, selectedGraphicColors);

        console.log("Randomise function ends");
        return {
            background: backgroundColor,
            text: textColor,
            graphics: selectedGraphicColors
        };
    }

    /**
     * Add event listener for randomize button
     */
    initRandomizeButton() {
        const randomizeBtn = document.getElementById('randomizeBtn');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => {
                try {
                    this.randomAll();
                } catch (error) {
                    this.uiManager.displayError(error.message);
                }
            });
        }
    }
}