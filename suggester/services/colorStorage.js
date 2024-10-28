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
    }

    /**
     * Loads colors into storage and validates all possible combinations
     * @param {Array<{colourHex: string, name: string}>} colors Array of color objects
     * @returns {Object} Statistics about valid combinations found
     */
    loadColors(colors) {
        console.log("Loading colors:", colors);
        this.colors = colors;
        return this.preValidateColorCombinations();
    }

    /**
     * Pre-validates all possible color combinations against WCAG criteria
     * This is done once at load time to avoid repeated contrast calculations
     * @returns {Object} Statistics about the validation results
     */
    preValidateColorCombinations() {
        console.log("Pre-validating color combinations...");
        console.log("Current colors:", this.colors);

        // Initialize statistics tracking
        const stats = {
            totalColors: this.colors.length,
            validBackgrounds: 0,
            totalCombinations: 0
        };

        // Clear any existing validation results
        this.validColorSets.clear();

        console.log("Checking each color as potential background...");
        this.colors.forEach(bgColor => {
            const backgroundColor = bgColor.colourHex;
            
            console.log(`Checking ${backgroundColor} (${bgColor.name}) as background`);

            // Find colors that meet WCAG text contrast requirement (4.5:1)
            const validTextColors = this.colors.filter(color => {
                const contrast = chroma.contrast(backgroundColor, color.colourHex);
                console.log(`Text contrast with ${color.colourHex}: ${contrast}`);
                return contrast >= 4.5; // WCAG AA standard for regular text
            });

            // Find colors that meet WCAG graphic contrast requirement (3:1)
            const validGraphicColors = this.colors.filter(color => {
                const contrast = chroma.contrast(backgroundColor, color.colourHex);
                console.log(`Graphic contrast with ${color.colourHex}: ${contrast}`);
                return contrast >= 3; // WCAG AA standard for graphic elements
            });

            console.log(`Found ${validTextColors.length} valid text colors and ${validGraphicColors.length} valid graphic colors`);

            // Store valid combinations if we have enough colors for a complete set
            // We need at least 1 text color and 3 graphic colors
            if (validTextColors.length >= 1 && validGraphicColors.length >= 3) {
                this.validColorSets.set(backgroundColor, {
                    background: bgColor,
                    textColors: validTextColors,
                    graphicColors: validGraphicColors
                });
                stats.validBackgrounds++;
                // Calculate total possible combinations for this background
                stats.totalCombinations += validTextColors.length * 
                    this.calculateCombinations(validGraphicColors.length, 3);
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
     * Using the combination formula: n!/(r!(n-r)!)
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
     * @returns {Array<string>} Array of valid background color hex codes
     */
    getValidBackgrounds() {
        return Array.from(this.validColorSets.keys());
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
     * Calculates total number of valid color combinations possible
     * @returns {number} Total number of valid combinations
     */
    getTotalCombinations() {
        let total = 0;
        this.validColorSets.forEach(set => {
            total += set.textColors.length * this.calculateCombinations(set.graphicColors.length, 3);
        });
        return total;
    }

    /**
     * Clears all stored colors and validated combinations
     * Useful when reloading a new color palette
     */
    clear() {
        console.log("Clearing color storage");
        this.colors = [];
        this.validColorSets.clear();
    }
}