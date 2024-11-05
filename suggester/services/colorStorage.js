/**
 * @fileoverview Color Storage and Validation Manager
 * 
 * This class manages the storage and validation of color combinations according to
 * WCAG accessibility guidelines. It ensures:
 * - Text colors have sufficient contrast (4.5:1 ratio) with backgrounds
 * - Graphic elements have sufficient contrast (3:1 ratio) with backgrounds
 * - Efficient storage and retrieval of valid color combinations
 * 
 * WCAG Success Criteria Referenced:
 * - 1.4.3 Contrast (Minimum) Level AA
 * - 1.4.11 Non-text Contrast Level AA
 */

export class ColorStorage {
    /**
     * Creates a new ColorStorage instance
     * Initializes empty storage for colors and valid combinations
     */
    constructor() {
        console.log("ColorStorage initialized");
        // Array to store all available colors
        this.colors = [];
        // Map to store valid color combinations for each background color
        this.validColorSets = new Map();
        // Set to track active colors
        this.activeColors = new Set();
        // Object to track held colors
        this.heldColors = {
            background: null,
            text: null,
            graphic1: null,
            graphic2: null,
            graphic3: null
        };
    }

    /**
     * Loads colors into storage
     * @param {Array<{colourHex: string, name: string}>} colors Array of color objects
     * @returns {Object} Initial statistics about loaded colors
     */

loadColors(colors) {
    console.log("Loading colours into storage:", colors);
    if (!Array.isArray(colors)) {
        console.error("Invalid colours data:", colors);
        throw new Error('Colours must be an array');
    }
    
    this.colors = colors;
    
    // Return initial stats without validation
    const stats = {
        totalColors: this.colors.length,
        activeColors: 0,
        validBackgrounds: 0,
        totalCombinations: 0
    };
    
    console.log("Colours loaded with stats:", stats);
    return stats;
}

// Also modify initActiveColors
initActiveColors() {
    console.log("Initializing active colours");
    console.log("Current colours:", this.colors);
    
    // Activate all colors by default
    this.activeColors = new Set(this.colors.map(c => c.colourHex));
    console.log("Active colors initialized:", this.activeColors);
    
    // Now that we have active colors, validate combinations
    const stats = this.preValidateColorCombinations();
    console.log("Colour validation complete with stats:", stats);
    return stats;
}

    /**
     * Initialize active colors
     * @returns {Object} Statistics about valid combinations
     */
    initActiveColors() {
        console.log("Initializing active colours");
        // Activate all colors by default
        this.activeColors = new Set(this.colors.map(c => c.colourHex));
        // Now that we have active colors, validate combinations
        return this.preValidateColorCombinations();
    }

    /**
     * Toggle a color's active status
     * @param {string} colorHex - The hex code of the color to toggle
     * @returns {Object} Updated statistics
     */
    toggleColor(colorHex) {
        console.log(`Toggling colour: ${colorHex}`);
        if (this.activeColors.has(colorHex)) {
            this.activeColors.delete(colorHex);
        } else {
            this.activeColors.add(colorHex);
        }
        return this.preValidateColorCombinations();
    }

    /**
     * Toggle all colors
     * @param {boolean} active - Whether to activate or deactivate all colors
     * @returns {Object} Updated statistics
     */
    toggleAllColors(active) {
        console.log(`Toggling all colours: ${active}`);
        if (active) {
            this.activeColors = new Set(this.colors.map(c => c.colourHex));
        } else {
            this.activeColors.clear();
        }
        return this.preValidateColorCombinations();
    }

    /**
     * Toggle hold state for a specific color
     * @param {string} colorType - Type of color (background, text, graphic1, etc.)
     * @param {string} colorValue - Hex code of the color
     * @returns {boolean} True if color is now held, false if released
     */
    toggleHoldColor(colorType, colorValue) {
        console.log(`Toggling hold for ${colorType}:`, colorValue);
        
        // If this color is already held, release it
        if (this.heldColors[colorType] === colorValue) {
            this.heldColors[colorType] = null;
            return false; // Return false to indicate color is no longer held
        } 
        // Otherwise, hold this color
        else {
            this.heldColors[colorType] = colorValue;
            return true; // Return true to indicate color is now held
        }
    }

    /**
     * Check if a color is currently held
     * @param {string} colorType - Type of color to check
     * @returns {boolean} True if the color is held
     */
    isColorHeld(colorType) {
        return this.heldColors[colorType] !== null;
    }

    /**
     * Get the held color value for a specific type
     * @param {string} colorType - Type of color to get
     * @returns {string|null} Hex code of held color or null if not held
     */
    getHeldColor(colorType) {
        return this.heldColors[colorType];
    }

    /**
     * Clear all held colors
     */
    clearHeldColors() {
        Object.keys(this.heldColors).forEach(key => {
            this.heldColors[key] = null;
        });
    }
	/**
     * Pre-validates all possible color combinations against WCAG criteria
     * @returns {Object} Statistics about the validation results
     */
    preValidateColorCombinations() {
        console.log("Pre-validating colour combinations...");
        console.log("All colours:", this.colors);
        console.log("Active colours:", this.activeColors);

        const stats = {
            totalColors: this.colors.length,
            activeColors: this.activeColors.size,
            validBackgrounds: 0,
            totalCombinations: 0
        };

        this.validColorSets.clear();

        // Filter to only use active colors
        const activeColorObjects = this.colors.filter(c => this.activeColors.has(c.colourHex));
        console.log("Active colour objects:", activeColorObjects);

        // Check each active color as a potential background
        activeColorObjects.forEach(bgColor => {
            const backgroundColor = bgColor.colourHex;
            console.log(`Checking ${backgroundColor} (${bgColor.name}) as background`);

            // Only check against other active colors for valid text colors
            const validTextColors = activeColorObjects.filter(color => {
                const contrast = chroma.contrast(backgroundColor, color.colourHex);
                console.log(`Text contrast with ${color.colourHex}: ${contrast}`);
                return contrast >= 4.5;
            });

            // Only check against other active colors for valid graphic colors
            const validGraphicColors = activeColorObjects.filter(color => {
                const contrast = chroma.contrast(backgroundColor, color.colourHex);
                console.log(`Graphic contrast with ${color.colourHex}: ${contrast}`);
                return contrast >= 3;
            });

            console.log(`Found ${validTextColors.length} valid text colours and ${validGraphicColors.length} valid graphic colors`);

            // Only add to valid sets if we have enough colors for a complete combination
            if (validTextColors.length >= 1 && validGraphicColors.length >= 3) {
                this.validColorSets.set(backgroundColor, {
                    background: bgColor,
                    textColors: validTextColors,
                    graphicColors: validGraphicColors
                });
                stats.validBackgrounds++;
                stats.totalCombinations += validTextColors.length * this.calculateCombinations(validGraphicColors.length, 3);
                console.log(`Added ${backgroundColor} as valid background`);
            } else {
                console.log(`${backgroundColor} rejected as background - insufficient valid color combinations`);
            }
        });

        console.log("Validation complete. Stats:", stats);
        console.log("Valid color sets:", this.validColorSets);

        return stats;
    }

    /**
     * Calculates the number of possible combinations (nCr)
     * @param {number} n Total number of items to choose from
     * @param {number} r Number of items being chosen
     * @returns {number} Number of possible combinations
     */
    calculateCombinations(n, r) {
        if (r > n) return 0;
        let result = 1;
        for (let i = 1; i <= r; i++) {
            result *= (n - r + i) / i;
        }
        return Math.floor(result);
    }

    /**
     * Gets all valid background colors
     * @returns {Array<string>} Array of valid background color hex codes
     */
    getValidBackgrounds() {
        if (!this.validColorSets) {
            console.warn('Valid colour sets not yet initialized');
            return [];
        }
        return Array.from(this.validColorSets.keys());
    }

    /**
     * Gets all colors that can serve as valid backgrounds
     * @returns {Array<{hex: string, name: string}>} Array of valid background colors with names
     */
    getValidBackgroundsWithNames() {
        if (!this.validColorSets) {
            console.warn('Valid colour sets not yet initialized');
            return [];
        }
        
        return Array.from(this.validColorSets.keys()).map(hex => ({
            hex,
            name: this.getColorName(hex)
        }));
    }

    /**
     * Gets all colors that cannot serve as valid backgrounds with reasons
     * @returns {Array<{hex: string, name: string, reason: string}>} Array of invalid background colors
     */
    getInvalidBackgroundsWithNames() {
        if (!this.colors || !this.validColorSets) {
            console.warn('Colors or valid color sets not yet initialized');
            return [];
        }
        
        // Get set of valid background colors for quick lookup
        const validBackgrounds = new Set(this.validColorSets.keys());
        
        return this.colors
            .filter(color => !validBackgrounds.has(color.colourHex))
            .map(color => {
                const textContrastCount = this.colors.filter(textColor => 
                    chroma.contrast(color.colourHex, textColor.colourHex) >= 4.5
                ).length;
                
                const graphicContrastCount = this.colors.filter(graphicColor => 
                    chroma.contrast(color.colourHex, graphicColor.colourHex) >= 3
                ).length;

                let reason = '';
                if (textContrastCount < 1) {
                    reason = 'Does not have sufficient contrast (4.5:1 or higher) with any colour for text';
                } else if (graphicContrastCount < 3) {
                    reason = `Has sufficient contrast for text but only has sufficient contrast (3:1) with ${graphicContrastCount} colours for graphics (minimum 3 required)`;
                } else {
                    reason = 'Does not meet minimum contrast requirements';
                }

                return {
                    hex: color.colourHex,
                    name: color.name,
                    reason
                };
            });
    }

    /**
     * Retrieves the human-readable name for a color
     * @param {string} colour Hex color code to look up
     * @returns {string} Color name or "Unknown color" if not found
     */
    getColorName(colour) {
        console.log("Getting name for color:", colour);
        const colorObj = this.colors.find(x => x.colourHex === colour);
        const name = colorObj ? colorObj.name : "Unknown color";
        console.log("Found name:", name);
        return name;
    }

    /**
     * Checks if a color is currently active
     * @param {string} colorHex Color hex code to check
     * @returns {boolean} True if the color is active
     */
    isColorActive(colorHex) {
        return this.activeColors.has(colorHex);
    }

    /**
     * Clears all stored colors and validated combinations
     * Useful when reloading a new color palette
     */
    clear() {
        console.log("Clearing color storage");
        this.colors = [];
        this.validColorSets.clear();
        this.activeColors.clear();
        this.clearHeldColors();
    }
}