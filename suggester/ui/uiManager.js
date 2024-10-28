// /ui/uiManager.js

export class UIManager {
    constructor(elements, colorStorage) {  // Add colorStorage parameter
        console.log("UIManager initialized with elements:", elements);
        this.elements = elements;
        this.colorStorage = colorStorage;  // Store the reference
    }

    /**
     * Update UI elements with new color information
     */
    updateUI(backgroundColor, textColor, graphicColors) {
        console.log("Updating UI with colors:", { backgroundColor, textColor, graphicColors });
        const { elements } = this;

        // Background color updates
        elements.backgroundColor.textContent = backgroundColor;
        elements.infoGraphicBox.style.backgroundColor = backgroundColor;
        elements.bgColor.style.backgroundColor = backgroundColor;
        elements.backgroundName.textContent = `(${this.getColorName(backgroundColor)})`;

        // Text color updates
        const textContrastRatio = chroma.contrast(textColor, backgroundColor).toFixed(2);
        elements.tcolor.textContent = textColor;
        elements.tcontrast.textContent = `${textContrastRatio}:1`;
        elements.tcontrastWCAG.textContent = this.getWcagRating(textContrastRatio);
        elements.tColorName.textContent = `(${this.getColorName(textColor)})`;
        elements.tColorColor.style.backgroundColor = textColor;
        elements.infoTexT.style.color = textColor;

        // Graphics colors updates
        graphicColors.forEach((color, index) => {
            const num = index + 1;
            const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);
            
            elements[`icon${num}`].style.color = color;
            elements[`g${num}colourSpan1`].textContent = color;
            elements[`g${num}contrast`].textContent = `${contrastRatio}:1`;
            elements[`g${num}contrastWCAG`].textContent = this.getWcagRating(contrastRatio);
            elements[`gfx${num}ColorName`].textContent = `(${this.getColorName(color)})`;
            elements[`g${num}colourSpan2`].style.backgroundColor = color;
        });

        // Update screen reader text
        this.updateScreenReaderText(backgroundColor, textColor, graphicColors);
    }

    /**
     * Display upload statistics
     */
    displayUploadStats(stats) {
        console.log("Displaying upload stats:", stats);
        const statsContainer = document.getElementById('uploadStats');
        if (!statsContainer) {
            console.warn('Stats container not found');
            return;
        }

        statsContainer.innerHTML = `
            <h3>Color Set Statistics</h3>
            <ul>
                <li>Total colors loaded: ${stats.totalColors}</li>
                <li>Valid background colors: ${stats.validBackgrounds}</li>
                <li>Possible combinations: ${stats.totalCombinations.toLocaleString()}</li>
            </ul>
        `;
    }

    /**
     * Display error message
     */
    displayError(message) {
        console.error("Displaying error:", message);
        const errorContainer = document.getElementById('uploadError');
        if (!errorContainer) {
            console.warn('Error container not found');
            return;
        }

        errorContainer.innerHTML = `<p class="error">Error: ${message}</p>`;
        errorContainer.style.display = 'block';
    }

    /**
     * Clear error message
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
     * Update screen reader text
     */
    updateScreenReaderText(backgroundColor, textColor, graphicColors) {
        console.log("Updating screen reader text");
        if (!this.elements.srResults) {
            console.warn('Screen reader results element not found');
            return;
        }

        const textContrastRatio = chroma.contrast(textColor, backgroundColor).toFixed(2);
        let srText = `Results: Background colour ${backgroundColor}, `;
        srText += `Text colour: ${textColor}, `;
        srText += `Text contrast: ${textContrastRatio}:1, WCAG Rating: ${this.getWcagRating(textContrastRatio)}. `;

        graphicColors.forEach((color, index) => {
            const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);
            srText += `Graphic ${index + 1} colour: ${color}, `;
            srText += `Graphic ${index + 1} contrast: ${contrastRatio}:1, `;
            srText += `WCAG Rating: ${this.getWcagRating(contrastRatio)}. `;
        });

        this.elements.srResults.textContent = srText.trim();
    }

    /**
     * Get WCAG rating based on contrast ratio
     */
    getWcagRating(contrastRatio) {
        if (contrastRatio >= 7) return "AAA";
        if (contrastRatio >= 4.5) return "AA";
        if (contrastRatio >= 3) return "G";
        return "F";
    }

    /**
     * Get color name (placeholder - should be implemented based on your color storage)
     */
    getColorName(colour) {
        // Use the colorStorage to get the name
        return this.colorStorage.getColorName(colour);
    }
}