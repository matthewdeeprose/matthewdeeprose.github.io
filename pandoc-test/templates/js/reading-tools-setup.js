// Reading Tools Setup and Accessibility Controls
// Migrated from: export-manager.js generateReadingAccessibilityManagerClass()
// External JavaScript template for Enhanced Pandoc-WASM Mathematical Playground

// Enhanced Reading Accessibility Manager for Exported Documents
class ReadingAccessibilityManager {
    constructor() {
        this.targetElement = document.querySelector("#main");
        this.currentSettings = {
            fontSize: {{fontSize}},
            fontFamily: '{{fontFamily}}',
            readingWidth: '{{readingWidth}}',
            lineHeight: {{lineHeight}},
            paragraphSpacing: {{paragraphSpacing}}
        };
        this.setupEventHandlers();
        console.log('✅ Reading Accessibility Manager initialised');
    }

    setupEventHandlers() {
        // Font family selection
        const fontSelect = document.getElementById("font-family");
        if (fontSelect) {
            fontSelect.addEventListener("change", (e) => {
                this.updateFontFamily(e.target.value);
            });
        }

        // Font size slider with live display update
        const fontSizeInput = document.getElementById("font-size");
        const fontSizeValue = document.getElementById("font-size-value");
        if (fontSizeInput && fontSizeValue) {
            fontSizeInput.addEventListener("input", (e) => {
                const percentage = Math.round(parseFloat(e.target.value) * 100);
                fontSizeValue.textContent = percentage + "%";
            });
            fontSizeInput.addEventListener("change", (e) => {
                this.updateFontSize(e.target.value);
            });
        }

        // Reading width controls
        const readingWidthSelect = document.getElementById("reading-width");
        if (readingWidthSelect) {
            readingWidthSelect.addEventListener("change", (e) => {
                this.updateReadingWidth(e.target.value);
            });
        }

        // Line height controls
        const lineHeightInput = document.getElementById("line-height");
        const lineHeightValue = document.getElementById("line-height-value");
        if (lineHeightInput && lineHeightValue) {
            lineHeightInput.addEventListener("input", (e) => {
                lineHeightValue.textContent = e.target.value;
            });
            lineHeightInput.addEventListener("change", (e) => {
                this.updateLineHeight(e.target.value);
            });
        }

        // Paragraph spacing controls
        const paragraphSpacingInput = document.getElementById("paragraph-spacing");
        const paragraphSpacingValue = document.getElementById("paragraph-spacing-value");
        if (paragraphSpacingInput && paragraphSpacingValue) {
            paragraphSpacingInput.addEventListener("input", (e) => {
                paragraphSpacingValue.textContent = e.target.value + "em";
            });
            paragraphSpacingInput.addEventListener("change", (e) => {
                this.updateParagraphSpacing(e.target.value);
            });
        }

        // Reset button
        const resetButton = document.getElementById("reset-reading-tools");
        if (resetButton) {
            resetButton.addEventListener("click", () => {
                this.resetAllSettings();
            });
        }

        console.log('✅ Reading accessibility event handlers setup complete');
    }

    updateFontFamily(fontFamily) {
        if (this.targetElement) {
            this.targetElement.style.setProperty("font-family", fontFamily, "important");
            this.currentSettings.fontFamily = fontFamily;
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
            this.currentSettings.fontSize = parseFloat(fontSize);
            
            // Apply to text elements but maintain heading hierarchy
            const textElements = this.targetElement.querySelectorAll("p, li, td, th, span, div");
            textElements.forEach(element => {
                element.style.setProperty("font-size", "inherit", "important");
            });
            
            // Handle headings with proportional scaling to maintain hierarchy
            const headings = this.targetElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
            headings.forEach(heading => {
                const level = parseInt(heading.tagName.charAt(1));
                const scale = 2.5 - (level * 0.25); // h1=2.25rem, h2=2rem, h3=1.75rem, etc.
                const adjustedSize = parseFloat(fontSize) * scale;
                heading.style.setProperty("font-size", adjustedSize + "rem", "important");
            });
            
            this.announceChange("Font size changed to " + Math.round(parseFloat(fontSize) * 100) + "%");
            console.log("Font size updated:", fontSize + "rem");
        } else {
            console.error("Target element not found for font size update");
        }
    }

    updateReadingWidth(width) {
        if (this.targetElement) {
            // Remove existing width classes
            this.targetElement.classList.remove("reading-width-narrow", "reading-width-medium", "reading-width-wide", "reading-width-full");
            
            // Add new width class
            if (width !== "full") {
                this.targetElement.classList.add("reading-width-" + width);
            }
            
            this.currentSettings.readingWidth = width;
            this.announceChange("Reading width changed to " + width);
            console.log("Reading width updated:", width);
        } else {
            console.error("Target element not found for reading width update");
        }
    }

    updateLineHeight(lineHeight) {
        if (this.targetElement) {
            this.targetElement.style.setProperty("line-height", lineHeight, "important");
            this.currentSettings.lineHeight = parseFloat(lineHeight);
            this.announceChange("Line height changed to " + lineHeight);
            console.log("Line height updated:", lineHeight);
        } else {
            console.error("Target element not found for line height update");
        }
    }

    updateParagraphSpacing(spacing) {
        if (this.targetElement) {
            const paragraphs = this.targetElement.querySelectorAll("p");
            paragraphs.forEach(p => {
                p.style.setProperty("margin-bottom", spacing + "em", "important");
            });
            
            this.currentSettings.paragraphSpacing = parseFloat(spacing);
            this.announceChange("Paragraph spacing changed to " + spacing + "em");
            console.log("Paragraph spacing updated:", spacing + "em");
        } else {
            console.error("Target element not found for paragraph spacing update");
        }
    }

    resetAllSettings() {
        console.log("Resetting all reading accessibility settings...");
        
        // Reset to default values
        this.updateFontFamily('{{fontFamily}}');
        this.updateFontSize('{{fontSize}}');
        this.updateReadingWidth('{{readingWidth}}');
        this.updateLineHeight('{{lineHeight}}');
        this.updateParagraphSpacing('{{paragraphSpacing}}');
        
        // Reset form controls to default values
        const fontSelect = document.getElementById("font-family");
        if (fontSelect) fontSelect.value = '{{fontFamily}}';
        
        const fontSizeInput = document.getElementById("font-size");
        const fontSizeValue = document.getElementById("font-size-value");
        if (fontSizeInput) {
            fontSizeInput.value = '{{fontSize}}';
            if (fontSizeValue) {
                fontSizeValue.textContent = Math.round({{fontSize}} * 100) + "%";
            }
        }
        
        const readingWidthSelect = document.getElementById("reading-width");
        if (readingWidthSelect) readingWidthSelect.value = '{{readingWidth}}';
        
        const lineHeightInput = document.getElementById("line-height");
        const lineHeightValue = document.getElementById("line-height-value");
        if (lineHeightInput) {
            lineHeightInput.value = '{{lineHeight}}';
            if (lineHeightValue) {
                lineHeightValue.textContent = '{{lineHeight}}';
            }
        }
        
        const paragraphSpacingInput = document.getElementById("paragraph-spacing");
        const paragraphSpacingValue = document.getElementById("paragraph-spacing-value");
        if (paragraphSpacingInput) {
            paragraphSpacingInput.value = '{{paragraphSpacing}}';
            if (paragraphSpacingValue) {
                paragraphSpacingValue.textContent = '{{paragraphSpacing}}' + "em";
            }
        }
        
        this.announceChange("All reading settings reset to defaults");
        console.log("✅ All reading accessibility settings reset to defaults");
    }

    {{#if advancedControls}}
    // Advanced accessibility controls for level 2+
    setupAdvancedControls() {
        console.log('Setting up advanced reading accessibility controls...');
        
        // Word spacing controls
        const wordSpacingInput = document.getElementById("word-spacing");
        if (wordSpacingInput) {
            wordSpacingInput.addEventListener("change", (e) => {
                this.updateWordSpacing(e.target.value);
            });
        }
        
        // Letter spacing controls  
        const letterSpacingInput = document.getElementById("letter-spacing");
        if (letterSpacingInput) {
            letterSpacingInput.addEventListener("change", (e) => {
                this.updateLetterSpacing(e.target.value);
            });
        }
        
        console.log('✅ Advanced reading controls setup complete');
    }

    updateWordSpacing(spacing) {
        if (this.targetElement) {
            this.targetElement.style.setProperty("word-spacing", spacing + "em", "important");
            this.announceChange("Word spacing changed to " + spacing + "em");
            console.log("Word spacing updated:", spacing + "em");
        }
    }

    updateLetterSpacing(spacing) {
        if (this.targetElement) {
            this.targetElement.style.setProperty("letter-spacing", spacing + "em", "important");
            this.announceChange("Letter spacing changed to " + spacing + "em");
            console.log("Letter spacing updated:", spacing + "em");
        }
    }
    {{/if}}

    // Screen reader announcement system
    announceChange(message) {
        // Create temporary live region for screen reader announcements
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.textContent = message;
        announcement.className = 'sr-only';
        announcement.style.cssText = 'position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important;';
        
        document.body.appendChild(announcement);
        
        // Remove announcement after screen readers have processed it
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
        
        console.log('📢 Screen reader announcement:', message);
    }

    // Get current settings for debugging/testing
    getCurrentSettings() {
        return { ...this.currentSettings };
    }

    // Check if manager is ready
    isReady() {
        return !!(this.targetElement && document.getElementById("font-family"));
    }
}

// Initialize reading accessibility manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('🚀 Initialising Reading Accessibility Manager...');
        window.readingAccessibilityManager = new ReadingAccessibilityManager();
        
        {{#if advancedControls}}
        // Setup advanced controls if enabled
        if (window.readingAccessibilityManager.setupAdvancedControls) {
            window.readingAccessibilityManager.setupAdvancedControls();
        }
        {{/if}}
        
        console.log('✅ Reading Accessibility Manager fully initialised and ready');
    } catch (error) {
        console.error('❌ Failed to initialise Reading Accessibility Manager:', error);
    }
});

// Export for testing and console access
if (typeof window !== 'undefined') {
    window.ReadingAccessibilityManager = ReadingAccessibilityManager;
}