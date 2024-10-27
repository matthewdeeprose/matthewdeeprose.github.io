export class ColorStorage {
    constructor() {
        console.log("ColorStorage initialized");
        this.colors = [];
        this.validColorSets = new Map();
    }

    /**
     * Load colors into storage and validate combinations
     * @param {Array} colors Array of color objects
     * @returns {Object} Statistics about valid combinations
     */
    loadColors(colors) {
        console.log("Loading colors:", colors);
        this.colors = colors;
        return this.preValidateColorCombinations();
    }

    /**
     * Pre-validates all possible color combinations
     * @returns {Object} Statistics about valid combinations
     */
    preValidateColorCombinations() {
        console.log("Pre-validating color combinations...");
        console.log("Current colors:", this.colors);

        const stats = {
            totalColors: this.colors.length,
            validBackgrounds: 0,
            totalCombinations: 0
        };

        this.validColorSets.clear();

        console.log("Checking each color as potential background...");
        this.colors.forEach(bgColor => {
            const backgroundColor = bgColor.colourHex;
            
            console.log(`Checking ${backgroundColor} (${bgColor.name}) as background`);

            const validTextColors = this.colors.filter(color => {
                const contrast = chroma.contrast(backgroundColor, color.colourHex);
                console.log(`Text contrast with ${color.colourHex}: ${contrast}`);
                return contrast >= 4.5;
            });

            const validGraphicColors = this.colors.filter(color => {
                const contrast = chroma.contrast(backgroundColor, color.colourHex);
                console.log(`Graphic contrast with ${color.colourHex}: ${contrast}`);
                return contrast >= 3;
            });

            console.log(`Found ${validTextColors.length} valid text colors and ${validGraphicColors.length} valid graphic colors`);

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
     * Calculate number of possible combinations
     * @param {number} n Total number of items
     * @param {number} r Number of items to choose
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
     * Get color name from hex code
     * @param {string} colour Hex color code
     * @returns {string} Color name
     */
    getColorName(colour) {
        console.log("Getting name for color:", colour);
        const colorObj = this.colors.find(x => x.colourHex === colour);
        const name = colorObj ? colorObj.name : "Unknown color";
        console.log("Found name:", name);
        return name;
    }

    /**
     * Get all valid background colors
     * @returns {Array} Array of valid background colors
     */
    getValidBackgrounds() {
        return Array.from(this.validColorSets.keys());
    }

    /**
     * Check if a color combination is valid
     * @param {string} backgroundColor Background color hex
     * @param {string} textColor Text color hex
     * @param {Array} graphicColors Array of graphic color hexes
     * @returns {boolean} True if combination is valid
     */
    isValidCombination(backgroundColor, textColor, graphicColors) {
        const colorSet = this.validColorSets.get(backgroundColor);
        if (!colorSet) return false;

        const isValidText = colorSet.textColors.some(c => c.colourHex === textColor);
        const allValidGraphics = graphicColors.every(gc => 
            colorSet.graphicColors.some(c => c.colourHex === gc)
        );

        return isValidText && allValidGraphics;
    }

    /**
     * Get the number of valid color combinations
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
     * Clear all stored colors and combinations
     */
    clear() {
        console.log("Clearing color storage");
        this.colors = [];
        this.validColorSets.clear();
    }
}