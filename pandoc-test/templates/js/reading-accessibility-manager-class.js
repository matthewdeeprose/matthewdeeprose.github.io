// Enhanced Reading Accessibility Manager Class
class ReadingAccessibilityManager {
    constructor() {
        this.targetElement = document.querySelector("#main");
        this.currentSettings = {
            fontSize: {{defaultFontSize}},
            fontFamily: '{{defaultFontFamily}}',
            readingWidth: '{{defaultReadingWidth}}',
            lineHeight: {{defaultLineHeight}},
            paragraphSpacing: {{defaultParagraphSpacing}}
        };
        this.setupEventHandlers();
        console.log('✅ Reading Accessibility Manager initialised');
    }

    setupEventHandlers() {
        const fontSelect = document.getElementById("font-family");
        if (fontSelect) {
            fontSelect.addEventListener("change", (e) => {
                this.updateFontFamily(e.target.value);
            });
        }

        const fontSizeInput = document.getElementById("font-size");
        const fontSizeValue = document.getElementById("font-size-value");
        if (fontSizeInput && fontSizeValue) {
            fontSizeInput.addEventListener("input", (e) => {
                const percentage = Math.round(parseFloat(e.target.value) * 100);
                fontSizeValue.textContent = percentage + "%";
                this.updateFontSize(e.target.value);
            });
        }

        const lineHeightInput = document.getElementById("line-height");
        const lineHeightValue = document.getElementById("line-height-value");
        if (lineHeightInput && lineHeightValue) {
            lineHeightInput.addEventListener("input", (e) => {
                lineHeightValue.textContent = e.target.value;
                this.updateLineHeight(e.target.value);
            });
        }

        // Reading width controls (select element)
        const readingWidthSelect = document.getElementById("reading-width");
        if (readingWidthSelect) {
            readingWidthSelect.addEventListener("change", (e) => {
                this.updateReadingWidth(e.target.value);
            });
        }

        const paragraphSpacingInput = document.getElementById("paragraph-spacing");
        const paragraphSpacingValue = document.getElementById("paragraph-spacing-value");
        if (paragraphSpacingInput && paragraphSpacingValue) {
            paragraphSpacingInput.addEventListener("input", (e) => {
                paragraphSpacingValue.textContent = e.target.value + "x";
                this.updateParagraphSpacing(e.target.value);
            });
        }

        const resetButton = document.getElementById("reset-reading-tools");
        if (resetButton) {
            resetButton.addEventListener("click", () => {
                this.resetAllSettings();
            });
        }
    }

    updateFontFamily(fontFamily) {
        if (this.targetElement) {
            this.targetElement.style.setProperty("font-family", fontFamily, "important");
            this.announceChange("Font changed to " + fontFamily.split(",")[0]);
            console.log("Font family updated:", fontFamily);
        } else {
            console.error("Target element not found for font family update");
        }
    }

    updateFontSize(fontSize) {
        if (this.targetElement) {
            // Set base font size on main element
            this.targetElement.style.setProperty("font-size", fontSize + "rem", "important");
            
            // Apply to text elements but maintain heading hierarchy
            const textElements = this.targetElement.querySelectorAll("p, li, td, th, span, div");
            textElements.forEach(element => {
                element.style.setProperty("font-size", "inherit", "important");
            });
            
            // Handle headings with proportional scaling to maintain hierarchy
            const headings = this.targetElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
            headings.forEach(heading => {
                const headingLevel = parseInt(heading.tagName.charAt(1));
                let scale;
                switch (headingLevel) {
                    case 1: scale = 2.25; break;  // h1: 2.25em
                    case 2: scale = 1.875; break; // h2: 1.875em
                    case 3: scale = 1.5; break;   // h3: 1.5em
                    case 4: scale = 1.25; break;  // h4: 1.25em
                    case 5: scale = 1.125; break; // h5: 1.125em
                    case 6: scale = 1.0; break;   // h6: 1.0em
                    default: scale = 1.0;
                }
                const calculatedSize = parseFloat(fontSize) * scale;
                heading.style.setProperty("font-size", calculatedSize + "rem", "important");
            });

            const percentage = Math.round(parseFloat(fontSize) * 100);
            this.announceChange("Font size changed to " + percentage + "%");
            console.log("Font size updated:", fontSize + "rem");
        } else {
            console.error("Target element not found for font size update");
        }
    }

    updateLineHeight(lineHeight) {
        if (this.targetElement) {
            const allElements = this.targetElement.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th, div, span");
            allElements.forEach(element => {
                element.style.setProperty("line-height", lineHeight, "important");
            });
            this.announceChange("Line height changed to " + lineHeight);
            console.log("Line height updated:", lineHeight);
        } else {
            console.error("Target element not found for line height update");
        }
    }

    updateReadingWidth(width) {
        if (this.targetElement) {
            // Remove existing width classes
            this.targetElement.classList.remove("width-narrow", "width-medium", "width-wide", "width-full");
            // Add new width class
            this.targetElement.classList.add("width-" + width);
            
            const widthNames = {
                narrow: "narrow (600px)",
                medium: "medium (800px)", 
                wide: "wide (1000px)",
                full: "full width"
            };
            
            this.announceChange("Reading width changed to " + (widthNames[width] || width));
            console.log("Reading width updated:", width);
        } else {
            console.error("Target element not found for reading width update");
        }
    }

    updateParagraphSpacing(spacing) {
        if (this.targetElement) {
            const paragraphs = this.targetElement.querySelectorAll("p, li");
            paragraphs.forEach(p => {
                p.style.setProperty("margin-bottom", spacing + "rem", "important");
            });
            this.announceChange("Paragraph spacing changed to " + spacing + "x");
            console.log("Paragraph spacing updated:", spacing + "rem");
        } else {
            console.error("Target element not found for paragraph spacing update");
        }
    }

    resetAllSettings() {
        try {
            // Reset font family
            if (this.targetElement) {
                this.targetElement.style.removeProperty("font-family");
            }

            // Reset font sizes to defaults with proper heading hierarchy
            const textElements = document.querySelectorAll("p, li, td, th, span, div");
            textElements.forEach(element => {
                element.style.removeProperty("font-size");
            });

            // Reset headings to default proportional sizes
            const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
            headings.forEach(heading => {
                heading.style.removeProperty("font-size");
            });

            // Reset line height
            const lineHeightElements = document.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th, div, span");
            lineHeightElements.forEach(element => {
                element.style.removeProperty("line-height");
            });

            // Reset reading width
            if (this.targetElement) {
                this.targetElement.classList.remove("width-narrow", "width-medium", "width-wide", "width-full");
                this.targetElement.classList.add("width-{{defaultReadingWidth}}");
            }

            // Reset paragraph spacing
            const paragraphs = document.querySelectorAll("p, li");
            paragraphs.forEach(p => {
                p.style.setProperty("margin-bottom", "1rem", "important");
            });

            // Reset form controls to defaults
            const fontFamilySelect = document.getElementById("font-family");
            if (fontFamilySelect) {
                fontFamilySelect.value = "{{defaultFontFamily}}";
            }

            const fontSizeInput = document.getElementById("font-size");
            const fontSizeValue = document.getElementById("font-size-value");
            if (fontSizeInput && fontSizeValue) {
                fontSizeInput.value = "{{defaultFontSize}}";
                fontSizeValue.textContent = Math.round(parseFloat("{{defaultFontSize}}") * 100) + "%";
            }

            const lineHeightInput = document.getElementById("line-height");
            const lineHeightValue = document.getElementById("line-height-value");
            if (lineHeightInput && lineHeightValue) {
                lineHeightInput.value = "{{defaultLineHeight}}";
                lineHeightValue.textContent = "{{defaultLineHeight}}";
            }

            const readingWidthSelect = document.getElementById("reading-width");
            if (readingWidthSelect) {
                readingWidthSelect.value = "{{defaultReadingWidth}}";
            }

            const paragraphSpacingInput = document.getElementById("paragraph-spacing");
            const paragraphSpacingValue = document.getElementById("paragraph-spacing-value");
            if (paragraphSpacingInput && paragraphSpacingValue) {
                paragraphSpacingInput.value = "{{defaultParagraphSpacing}}";
                paragraphSpacingValue.textContent = "{{defaultParagraphSpacing}}" + "x";
            }

            this.announceChange("All reading settings reset to defaults with proper heading hierarchy");
            console.log("✅ Reading tools reset to defaults with proportional heading sizes");
            return true;
        } catch (error) {
            console.error("❌ Reading tools reset failed:", error);
            return false;
        }
    }

    announceChange(message) {
        const announcement = document.createElement("div");
        announcement.className = "sr-only";
        announcement.setAttribute("role", "status");
        announcement.setAttribute("aria-live", "polite");
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    // ✅ ADDED: Get current settings for debugging/testing
    getCurrentSettings() {
        return { ...this.currentSettings };
    }

    // ✅ ADDED: Check if manager is ready
    isReady() {
        return !!(this.targetElement && document.getElementById("font-family"));
    }
}