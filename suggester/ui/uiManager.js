/**
 * @fileoverview UI Manager for Color Contrast Tool
 * 
 * This class manages the user interface updates and accessibility features for
 * the color contrast checking tool. It ensures:
 * - Visual updates are synchronized with ARIA and screen reader text
 * - Contrast ratios are clearly displayed
 * - WCAG compliance levels are properly communicated
 * - Error messages are accessible
 * 
 * WCAG Compliance:
 * - 1.4.3 Contrast (Minimum) - Level AA
 * - 1.4.11 Non-text Contrast - Level AA
 * - 4.1.3 Status Messages - Level AA
 */

export class UIManager {
    /**
     * Creates a new UIManager instance
     * @param {Object} elements - Map of DOM elements used by the UI
     * @param {ColorStorage} colorStorage - Reference to the color storage system
     */
    constructor(elements, colorStorage) {
        console.log("UIManager initialized with elements:", elements);
        this.elements = elements;
        this.colorStorage = colorStorage;
        
        // Set up ARIA live regions for dynamic updates
        if (this.elements.srResults) {
            this.elements.srResults.setAttribute('aria-live', 'polite');
            this.elements.srResults.setAttribute('role', 'status');
        }
    }

    /**
     * Updates all UI elements with new color combinations
     * Handles visual updates and accessibility information
     * @param {string} backgroundColor - Hex code for background color
     * @param {string} textColor - Hex code for text color
     * @param {Array<string>} graphicColors - Array of hex codes for graphic colors
     */
    updateUI(backgroundColor, textColor, graphicColors) {
        console.log("Updating UI with colors:", { backgroundColor, textColor, graphicColors });
        const { elements } = this;

        // Update background color information
        this.updateBackgroundColor(backgroundColor);
        
        // Update text color information and contrast
        this.updateTextColor(backgroundColor, textColor);
        
        // Update graphics colors and their contrast
        this.updateGraphicColors(backgroundColor, graphicColors);

        // Update screen reader announcement
        this.updateScreenReaderText(backgroundColor, textColor, graphicColors);
    }

    /**
     * Updates background color-related elements
     * @param {string} backgroundColor - Hex code for background color
     */
    updateBackgroundColor(backgroundColor) {
        const { elements } = this;
        elements.backgroundColor.textContent = backgroundColor;
        elements.infoGraphicBox.style.backgroundColor = backgroundColor;
        elements.bgColor.style.backgroundColor = backgroundColor;
        elements.backgroundName.textContent = `(${this.getColorName(backgroundColor)})`;
    }

    /**
     * Updates text color-related elements and contrast information
     * @param {string} backgroundColor - Hex code for background color
     * @param {string} textColor - Hex code for text color
     */
    updateTextColor(backgroundColor, textColor) {
        const { elements } = this;
        const textContrastRatio = chroma.contrast(textColor, backgroundColor).toFixed(2);
        
        // Update text color display
        elements.tcolor.textContent = textColor;
        elements.tColorName.textContent = `(${this.getColorName(textColor)})`;
        elements.tColorColor.style.backgroundColor = textColor;
        
        // Update contrast information
        elements.tcontrast.textContent = `${textContrastRatio}:1`;
        elements.tcontrastWCAG.textContent = this.getWcagRating(textContrastRatio);
        
        // Apply text color to sample text
        elements.infoTexT.style.color = textColor;
    }

    /**
     * Updates graphic color elements and their contrast information
     * @param {string} backgroundColor - Hex code for background color
     * @param {Array<string>} graphicColors - Array of hex codes for graphic colors
     */
    updateGraphicColors(backgroundColor, graphicColors) {
        graphicColors.forEach((color, index) => {
            const num = index + 1;
            const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);
            
            // Update color samples
            this.elements[`icon${num}`].style.color = color;
            this.elements[`g${num}colourSpan2`].style.backgroundColor = color;
            
            // Update color information
            this.elements[`g${num}colourSpan1`].textContent = color;
            this.elements[`g${num}contrast`].textContent = `${contrastRatio}:1`;
            this.elements[`g${num}contrastWCAG`].textContent = this.getWcagRating(contrastRatio);
            this.elements[`gfx${num}ColorName`].textContent = `(${this.getColorName(color)})`;
        });
    }

    /**
     * Displays upload statistics in an accessible manner
     * @param {Object} stats - Statistics about color combinations
     */
    displayUploadStats(stats) {
        console.log("Displaying upload stats:", stats);
        const statsContainer = document.getElementById('uploadStats');
        if (!statsContainer) {
            console.warn('Stats container not found');
            return;
        }

        statsContainer.innerHTML = `
            <h3>Colour Set Statistics</h3>
            <ul role="list">
                <li>Total colors loaded: ${stats.totalColors}</li>
                <li>Valid background colors: ${stats.validBackgrounds}</li>
                <li>Possible combinations: ${stats.totalCombinations.toLocaleString()}</li>
            </ul>
        `;
        
        // Announce stats update to screen readers
        if (this.elements.srResults) {
            this.elements.srResults.textContent = 
                `Statistics updated: ${stats.totalColors} colors loaded, ` +
                `${stats.validBackgrounds} valid backgrounds, ` +
                `${stats.totalCombinations.toLocaleString()} possible combinations.`;
        }
    }

    /**
     * Displays error messages accessibly
     * @param {string} message - Error message to display
     */
    displayError(message) {
        console.error("Displaying error:", message);
        const errorContainer = document.getElementById('uploadError');
        if (!errorContainer) {
            console.warn('Error container not found');
            return;
        }

        errorContainer.innerHTML = `
            <div role="alert" class="error">
                <strong>Error:</strong> ${message}
            </div>
        `;
        errorContainer.style.display = 'block';
    }

    /**
     * Clears error messages
     */
    clearError() {
        console.log("Clearing error messages");
        const errorContainer = document.getElementById('uploadError');
        if (!errorContainer) {
            console.warn('Error container not found');
            return;
        }

        errorContainer.innerHTML = '';
        errorContainer.style.display = 'none';
    }

    /**
     * Updates screen reader announcement text with current color information
     * @param {string} backgroundColor - Hex code for background color
     * @param {string} textColor - Hex code for text color
     * @param {Array<string>} graphicColors - Array of hex codes for graphic colors
     */
    updateScreenReaderText(backgroundColor, textColor, graphicColors) {
        console.log("Updating screen reader text");
        if (!this.elements.srResults) {
            console.warn('Screen reader results element not found');
            return;
        }

        const textContrastRatio = chroma.contrast(textColor, backgroundColor).toFixed(2);
        const textWCAG = this.getWcagRating(textContrastRatio);
        
        // Build accessible announcement text
        let srText = `New color combination selected. `;
        srText += `Background color is ${this.getColorName(backgroundColor)} (${backgroundColor}). `;
        srText += `Text color is ${this.getColorName(textColor)} (${textColor}) `;
        srText += `with contrast ratio ${textContrastRatio}:1, WCAG level ${textWCAG}. `;

        graphicColors.forEach((color, index) => {
            const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);
            const wcagRating = this.getWcagRating(contrastRatio);
            srText += `Graphic element ${index + 1} uses ${this.getColorName(color)} (${color}) `;
            srText += `with contrast ratio ${contrastRatio}:1, WCAG level ${wcagRating}. `;
        });

        this.elements.srResults.textContent = srText.trim();
    }

    /**
     * Determines WCAG compliance level based on contrast ratio
     * @param {number} contrastRatio - The calculated contrast ratio
     * @returns {string} WCAG compliance level (AAA, AA, G, or F)
     */
    getWcagRating(contrastRatio) {
        if (contrastRatio >= 7) return "AAA";    // Highest contrast - Enhanced
        if (contrastRatio >= 4.5) return "AA";   // Standard level for text
        if (contrastRatio >= 3) return "G";      // Minimum for graphics
        return "F";                              // Fails contrast requirements
    }

    /**
     * Gets the human-readable name for a color
     * @param {string} colour - Hex code of the color
     * @returns {string} Human-readable color name
     */
    getColorName(colour) {
        return this.colorStorage.getColorName(colour);
    }
}