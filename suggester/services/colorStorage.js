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
 *
 * Updated 10:41 29/10/2024
 *
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
    }

    /**
     * Loads colors into storage
     * @param {Array<{colourHex: string, name: string}>} colors Array of color objects
     * @returns {Object} Initial statistics about loaded colors
     */
    loadColors(colors) {
        console.log("Loading colors:", colors);
        this.colors = colors;
        // Return initial stats without validation
        return {
            totalColors: this.colors.length,
            activeColors: 0,
            validBackgrounds: 0,
            totalCombinations: 0
        };
    }

    /**
     * Initialize active colors
     * @returns {Object} Statistics about valid combinations
     */
    initActiveColors() {
        console.log("Initializing active colors");
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
        console.log(`Toggling color: ${colorHex}`);
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
        console.log(`Toggling all colors: ${active}`);
        if (active) {
            this.activeColors = new Set(this.colors.map(c => c.colourHex));
        } else {
            this.activeColors.clear();
        }
        return this.preValidateColorCombinations();
    }

    /**
     * Pre-validates all possible color combinations against WCAG criteria
     * @returns {Object} Statistics about the validation results
     */
    preValidateColorCombinations() {
        console.log("Pre-validating color combinations...");
        console.log("All colors:", this.colors);
        console.log("Active colors:", this.activeColors);

        const stats = {
            totalColors: this.colors.length,
            activeColors: this.activeColors.size,
            validBackgrounds: 0,
            totalCombinations: 0
        };

        this.validColorSets.clear();

        // Filter to only use active colors
        const activeColorObjects = this.colors.filter(c => this.activeColors.has(c.colourHex));
        console.log("Active color objects:", activeColorObjects);

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

            console.log(`Found ${validTextColors.length} valid text colors and ${validGraphicColors.length} valid graphic colors`);

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
 * Gets all colors that can serve as valid backgrounds
 * Ensures we return an empty array if validColorSets isn't initialized
 * @returns {Array<string>} Array of valid background color hex codes
 */
getValidBackgrounds() {
    if (!this.validColorSets) {
        console.warn('Valid color sets not yet initialized');
        return [];
    }
    return Array.from(this.validColorSets.keys());
}

/**
 * Gets the name and hex value for each valid background color
 * @returns {Array<{hex: string, name: string}>} Array of valid background colors with names
 */
getValidBackgroundsWithNames() {
    if (!this.validColorSets) {
        console.warn('Valid color sets not yet initialized');
        return [];
    }
    
    return Array.from(this.validColorSets.keys()).map(hex => ({
        hex,
        name: this.getColorName(hex)
    }));
}

    /**
     * Validates a specific color combination against WCAG requirements
     * @param {string} backgroundColor Background color hex
     * @param {string} textColor Text color hex
     * @param {Array<string>} graphicColors Array of graphic color hexes
     * @returns {boolean} True if the combination meets WCAG requirements
     */
    isValidCombination(backgroundColor, textColor, graphicColors) {
        const colorSet = this.validColorSets.get(backgroundColor);
        if (!colorSet) return false;

        // Check if text color meets contrast requirements
        const isValidText = colorSet.textColors.some(c => c.colourHex === textColor);
        
        // Check if all graphic colors meet contrast requirements
        const allValidGraphics = graphicColors.every(gc => 
            colorSet.graphicColors.some(c => c.colourHex === gc)
        );

        return isValidText && allValidGraphics;
    }

    /**
     * Returns active color statistics
     * @returns {Object} Statistics about current active colors
     */
    getActiveColorStats() {
        return {
            total: this.colors.length,
            active: this.activeColors.size,
            inactive: this.colors.length - this.activeColors.size
        };
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
    }
}