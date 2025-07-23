// template-system.js
// HTML Template Generation System Module
// Replaces string concatenation with maintainable template system

const TemplateSystem = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[TEMPLATE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TEMPLATE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[TEMPLATE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TEMPLATE]", message, ...args);
  }

  // ===========================================================================================
  // TEMPLATE SYSTEM IMPLEMENTATION
  // ===========================================================================================

  /**
   * Enhanced HTML Template System for maintainable HTML generation
   * Replaces string concatenation approach
   */
  class EnhancedHTMLGenerator {
    constructor() {
      this.templates = new Map();
      this.initialiseTemplates();
    }

    /**
     * Initialise all HTML templates for the application
     */
    initialiseTemplates() {
      logInfo("Initialising Enhanced HTML Template System...");

      // Reading Tools Section Template
      this.templates.set("readingToolsSection", () => {
        let html = "";
        html += '        <div class="tool-group reading-tools-section">\n';
        html += "            <h4>📖 Reading Tools</h4>\n";

        // Font Family Control
        html += '            <div class="form-group">\n';
        html += '                <label for="font-family">Font:</label>\n';
        html +=
          '                <select id="font-family" aria-describedby="font-help">\n';
        html += this.getFontOptions();
        html += "                </select>\n";
        html +=
          '                <div id="font-help" class="sr-only">Choose a font that is comfortable for reading</div>\n';
        html += "            </div>\n";

        // Font Size Control
        html += '            <div class="form-group slider-group">\n';
        html += '                <label for="font-size">Font size:</label>\n';
        html += '                <div class="slider-container">\n';
        html +=
          '                    <input type="range" id="font-size" min="0.8" max="2.0" step="0.1" value="1.0" aria-describedby="font-size-help">\n';
        html +=
          '                    <span class="range-value" id="font-size-value" aria-live="polite">100%</span>\n';
        html += "                </div>\n";
        html +=
          '                <div id="font-size-help" class="sr-only">Adjust font size from 80% to 200%</div>\n';
        html += "            </div>\n";

        // Reading Width Control
        html += '            <div class="form-group">\n';
        html +=
          '                <label for="reading-width">Reading width:</label>\n';
        html +=
          '                <select id="reading-width" aria-describedby="width-help">\n';
        html +=
          '                    <option value="full">Full width</option>\n';
        html +=
          '                    <option value="wide">Wide (80ch)</option>\n';
        html +=
          '                    <option value="narrow" selected>Narrow (65ch) - Recommended</option>\n';
        html +=
          '                    <option value="extra-narrow">Extra narrow (50ch)</option>\n';
        html += "                </select>\n";
        html +=
          '                <div id="width-help" class="sr-only">Narrower text improves reading for dyslexia and focus issues</div>\n';
        html += "            </div>\n";

        // Line Height Control
        html += '            <div class="form-group">\n';
        html +=
          '                <label for="line-height">Line height:</label>\n';
        html +=
          '                <input type="number" id="line-height" min="1" max="3" step="0.1" value="1.6" aria-describedby="line-height-help">\n';
        html +=
          '                <div id="line-height-help" class="sr-only">Adjust spacing between lines (1.0 to 3.0)</div>\n';
        html += "            </div>\n";

        // Word Spacing Control
        html += '            <div class="form-group">\n';
        html +=
          '                <label for="word-spacing">Word spacing:</label>\n';
        html +=
          '                <input type="number" id="word-spacing" min="-0.5" max="2" step="0.1" value="0" aria-describedby="word-spacing-help">\n';
        html +=
          '                <div id="word-spacing-help" class="sr-only">Adjust spacing between words (-0.5 to 2.0)</div>\n';
        html += "            </div>\n";

        // Letter Spacing Control
        html += '            <div class="form-group">\n';
        html +=
          '                <label for="letter-spacing">Letter spacing:</label>\n';
        html +=
          '                <input type="number" id="letter-spacing" min="-0.1" max="0.5" step="0.05" value="0" aria-describedby="letter-spacing-help">\n';
        html +=
          '                <div id="letter-spacing-help" class="sr-only">Adjust spacing between letters (-0.1 to 0.5)</div>\n';
        html += "            </div>\n";

        // Paragraph Spacing Control
        html += '            <div class="form-group slider-group">\n';
        html +=
          '                <label for="paragraph-spacing">Paragraph spacing:</label>\n';
        html += '                <div class="slider-container">\n';
        html +=
          '                    <input type="range" id="paragraph-spacing" min="1" max="3" step="0.5" value="1" aria-describedby="para-help">\n';
        html +=
          '                    <span class="range-value" id="paragraph-spacing-value" aria-live="polite">1.0em</span>\n';
        html += "                </div>\n";
        html +=
          '                <div id="para-help" class="sr-only">Adjust spacing between paragraphs (1.0 to 3.0em)</div>\n';
        html += "            </div>\n";

        html += "        </div>\n";
        return html;
      });

      // Reset Controls Section Template
      this.templates.set("resetControlsSection", () => {
        let html = "";
        html += '        <div class="tool-group">\n';
        html += "            <h4>🔄 Reset Options</h4>\n";
        html +=
          '            <button class="reset-button" id="reset-reading-tools" aria-label="Reset all reading preferences to default">\n';
        html +=
          '                <span aria-hidden="true">↻</span> Reset to Defaults\n';
        html += "            </button>\n";
        html += "        </div>\n";
        return html;
      });

      // Theme Toggle Section Template
      this.templates.set("themeToggleSection", () => {
        let html = "";
        html += '        <div class="tool-group">\n';
        html += "            <h4>Appearance</h4>\n";
        html +=
          '            <button id="theme-toggle" class="theme-toggle" aria-label="Switch to dark mode" title="Switch colour theme">\n';
        html +=
          '                <span class="theme-toggle-icon" aria-hidden="true">🌙</span>\n';
        html += '                <span class="theme-toggle-text">Dark</span>\n';
        html += "            </button>\n";
        html += "        </div>\n";
        return html;
      });

      // Print Button Section Template
      this.templates.set("printButtonSection", () => {
        let html = "";
        html += '        <div class="tool-group">\n';
        html += "            <h4>Actions</h4>\n";
        html +=
          '            <button class="action-button print-button" onclick="window.print()" aria-label="Print this document">\n';
        html +=
          '                <span aria-hidden="true">🖨️</span> Print Document\n';
        html += "            </button>\n";
        html += "        </div>\n";
        return html;
      });

      // MathJax Accessibility Controls Template (Simplified - Proven Working Controls Only)
      this.templates.set("mathJaxAccessibilityControls", () => {
        let html = "";
        html +=
          '    <section class="sidebar-section accessibility-controls" aria-label="Accessibility Configuration">\n';
        html += "        <h3>📱 MathJax Accessibility</h3>\n";
        html += "        \n";

        // ✅ KEEP: Zoom Configuration Controls (PROVEN WORKING)
        html += '        <div class="control-group">\n';
        html += "            <h4>🎯 Zoom Configuration</h4>\n";
        html +=
          '            <div class="radio-group" role="radiogroup" aria-labelledby="zoom-config">\n';
        html += '                <div class="form-group">\n';
        html +=
          '                    <input type="radio" id="zoom-click" name="zoom-trigger" value="Click" checked>\n';
        html +=
          '                    <label for="zoom-click">Single click to zoom</label>\n';
        html += "                </div>\n";
        html += '                <div class="form-group">\n';
        html +=
          '                    <input type="radio" id="zoom-double" name="zoom-trigger" value="DoubleClick">\n';
        html +=
          '                    <label for="zoom-double">Double click to zoom</label>\n';
        html += "                </div>\n";
        html += '                <div class="form-group">\n';
        html +=
          '                    <input type="radio" id="zoom-none" name="zoom-trigger" value="NoZoom">\n';
        html +=
          '                    <label for="zoom-none">Zoom disabled</label>\n';
        html += "                </div>\n";
        html += "            </div>\n";
        html += '            <div class="form-group slider-group">\n';
        html += '                <label for="zoom-scale">Zoom scale:</label>\n';
        html += '                <div class="slider-container">\n';
        html +=
          '                    <input type="range" id="zoom-scale" min="150" max="400" step="25" value="200" aria-describedby="zoom-scale-help">\n';
        html +=
          '                    <span class="range-value" id="zoom-scale-value" aria-live="polite">200%</span>\n';
        html += "                </div>\n";
        html +=
          '                <div id="zoom-scale-help" class="sr-only">Adjust zoom level from 150% to 400%</div>\n';
        html += "            </div>\n";
        html += "        </div>\n\n";

        // ✅ KEEP: Screen Reader Support (WORKING with special handling)
        html += '        <div class="control-group">\n';
        html += "            <h4>🔊 Screen Reader Support</h4>\n";
        html += '            <div class="form-group">\n';
        html +=
          '                <input type="checkbox" id="assistive-mathml" checked aria-describedby="mathml-help">\n';
        html +=
          '                <label for="assistive-mathml">Generate assistive MathML</label>\n';
        html +=
          '                <div id="mathml-help" class="sr-only">Creates hidden MathML for screen readers (disable only - refresh required to re-enable)</div>\n';
        html +=
          '                <div id="assistive-mathml-help" style="display: none; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; font-style: italic;">To re-enable assistive MathML, refresh this page.</div>\n';
        html += "            </div>\n";
        html += '            <div class="form-group">\n';
        html +=
          '                <input type="checkbox" id="tab-navigation" checked aria-describedby="tab-help">\n';
        html +=
          '                <label for="tab-navigation">Include in tab order</label>\n';
        html +=
          '                <div id="tab-help" class="sr-only">Include equations in keyboard tab navigation</div>\n';
        html += "            </div>\n";
        html += "        </div>\n\n";

        return html;
      });

      // Complete Document Sidebar Template
      this.templates.set("integratedDocumentSidebar", (metadata) => {
        let html = "";
        html +=
          '<aside id="sidebar" class="document-sidebar" role="complementary">\n';

        // Tools Section
        html += '    <section class="sidebar-section tools-section">\n';
        html += "        <h3>Document Tools</h3>\n";

        // Theme Toggle
        html += this.renderTemplate("themeToggleSection");

        // Print Button
        html += this.renderTemplate("printButtonSection");

        // Reading Tools Section
        html += this.renderTemplate("readingToolsSection");

        // Reset Controls Section
        html += this.renderTemplate("resetControlsSection");

        html += "    </section>\n\n";

        // MathJax Accessibility Controls
        html += this.renderTemplate("mathJaxAccessibilityControls");

        html += "</aside>\n";
        return html;
      });

      logInfo("✅ Enhanced HTML Template System initialised");
    }

    /**
     * Get font options HTML
     */
    getFontOptions() {
      let html = "";
      html +=
        '                    <option value="Verdana, sans-serif" selected>Verdana (sans-serif)</option>\n';
      html +=
        '                    <option value="Arial, sans-serif">Arial (sans-serif)</option>\n';
      html +=
        '                    <option value="Tahoma, sans-serif">Tahoma (sans-serif)</option>\n';
      html +=
        "                    <option value=\"'Trebuchet MS', sans-serif\">Trebuchet MS (sans-serif)</option>\n";
      html +=
        "                    <option value=\"'Times New Roman', serif\">Times New Roman (serif)</option>\n";
      html +=
        '                    <option value="Georgia, serif">Georgia (serif)</option>\n';
      html +=
        '                    <option value="Garamond, serif">Garamond (serif)</option>\n';
      html +=
        "                    <option value=\"'Courier New', monospace\">Courier New (monospace)</option>\n";
      html +=
        "                    <option value=\"'Brush Script MT', cursive\">Brush Script MT (cursive)</option>\n";
      return html;
    }

    /**
     * Render a template by name
     */
    renderTemplate(templateName, ...args) {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new Error(`Template "${templateName}" not found`);
      }
      return template(...args);
    }

    generateSystemThemeDetectionJS() {
      let js = "";
      js += "        // System Theme Detection\n";
      js += "        (function() {\n";
      js +=
        "            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;\n";
      js +=
        "            const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;\n";
      js +=
        "            const userSetTheme = localStorage.getItem('user-theme');\n";
      js += "            if (!userSetTheme) {\n";
      js += "                if (prefersDark) {\n";
      js +=
        "                    document.documentElement.setAttribute('data-theme', 'dark');\n";
      js += "                } else if (prefersLight) {\n";
      js +=
        "                    document.documentElement.setAttribute('data-theme', 'light');\n";
      js += "                } else {\n";
      js +=
        "                    document.documentElement.setAttribute('data-theme', 'light');\n";
      js += "                }\n";
      js += "            }\n";
      js += "        })();\n";
      return js;
    }

    /**
     * Generate complete ReadingAccessibilityManager JavaScript
     */
    generateReadingAccessibilityManager() {
      let js = "";
      js += "        // Enhanced Reading Accessibility Manager\n";
      js += "        class ReadingAccessibilityManager {\n";
      js += "            constructor() {\n";
      js +=
        '                this.targetElement = document.querySelector("#main");\n';
      js += "                this.setupEventHandlers();\n";
      js += "            }\n\n";

      js += "            setupEventHandlers() {\n";

      // Font Family Control
      js +=
        '                const fontSelect = document.getElementById("font-family");\n';
      js += "                if (fontSelect) {\n";
      js +=
        '                    fontSelect.addEventListener("change", (e) => {\n';
      js += "                        this.updateFontFamily(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Font Size Control
      js +=
        '                const fontSizeInput = document.getElementById("font-size");\n';
      js +=
        '                const fontSizeValue = document.getElementById("font-size-value");\n';
      js += "                if (fontSizeInput && fontSizeValue) {\n";
      js +=
        '                    fontSizeInput.addEventListener("input", (e) => {\n';
      js +=
        "                        const percentage = Math.round(parseFloat(e.target.value) * 100);\n";
      js +=
        '                        fontSizeValue.textContent = percentage + "%";\n';
      js += "                    });\n";
      js +=
        '                    fontSizeInput.addEventListener("change", (e) => {\n';
      js += "                        this.updateFontSize(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Reading Width Control
      js +=
        '                const readingWidthSelect = document.getElementById("reading-width");\n';
      js += "                if (readingWidthSelect) {\n";
      js +=
        '                    readingWidthSelect.addEventListener("change", (e) => {\n';
      js +=
        "                        this.updateReadingWidth(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Line Height Control
      js +=
        '                const lineHeightInput = document.getElementById("line-height");\n';
      js += "                if (lineHeightInput) {\n";
      js +=
        '                    lineHeightInput.addEventListener("input", (e) => {\n';
      js += "                        this.updateLineHeight(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Word Spacing Control
      js +=
        '                const wordSpacingInput = document.getElementById("word-spacing");\n';
      js += "                if (wordSpacingInput) {\n";
      js +=
        '                    wordSpacingInput.addEventListener("input", (e) => {\n';
      js += "                        this.updateWordSpacing(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Letter Spacing Control
      js +=
        '                const letterSpacingInput = document.getElementById("letter-spacing");\n';
      js += "                if (letterSpacingInput) {\n";
      js +=
        '                    letterSpacingInput.addEventListener("input", (e) => {\n';
      js +=
        "                        this.updateLetterSpacing(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Paragraph Spacing Control
      js +=
        '                const paragraphSpacingInput = document.getElementById("paragraph-spacing");\n';
      js +=
        '                const paragraphSpacingValue = document.getElementById("paragraph-spacing-value");\n';
      js +=
        "                if (paragraphSpacingInput && paragraphSpacingValue) {\n";
      js +=
        '                    paragraphSpacingInput.addEventListener("input", (e) => {\n';
      js +=
        '                        paragraphSpacingValue.textContent = e.target.value + "em";\n';
      js += "                    });\n";
      js +=
        '                    paragraphSpacingInput.addEventListener("change", (e) => {\n';
      js +=
        "                        this.updateParagraphSpacing(e.target.value);\n";
      js += "                    });\n";
      js += "                }\n\n";

      // Reset Button
      js +=
        '                const resetButton = document.getElementById("reset-reading-tools");\n';
      js += "                if (resetButton) {\n";
      js +=
        '                    resetButton.addEventListener("click", () => {\n';
      js += "                        this.resetAllSettings();\n";
      js += "                    });\n";
      js += "                }\n";
      js += "            }\n\n";

      // Method implementations
      js += "            updateFontFamily(fontFamily) {\n";
      js += "                if (this.targetElement) {\n";
      js +=
        '                    this.targetElement.style.setProperty("font-family", fontFamily, "important");\n';
      js +=
        '                    this.announceChange("Font changed to " + fontFamily.split(",")[0]);\n';
      js +=
        '                    console.log("Font family updated:", fontFamily);\n';
      js += "                } else {\n";
      js +=
        '                    console.error("Target element not found for font family update");\n';
      js += "                }\n";
      js += "            }\n\n";
      js += "            updateFontSize(fontSize) {\n";
      js += "                if (this.targetElement) {\n";
      js += "                    // Set base font size on main element\n";
      js +=
        '                    this.targetElement.style.setProperty("font-size", fontSize + "rem", "important");\n';
      js += "                    \n";
      js +=
        "                    // Apply to text elements but maintain heading hierarchy\n";
      js +=
        '                    const textElements = this.targetElement.querySelectorAll("p, li, td, th, span, div");\n';
      js += "                    textElements.forEach(element => {\n";
      js +=
        '                        element.style.setProperty("font-size", "inherit", "important");\n';
      js += "                    });\n";
      js += "                    \n";
      js +=
        "                    // Handle headings with proportional scaling to maintain hierarchy\n";
      js +=
        '                    const headings = this.targetElement.querySelectorAll("h1, h2, h3, h4, h5, h6");\n';
      js += "                    headings.forEach(heading => {\n";
      js +=
        "                        const headingLevel = parseInt(heading.tagName.charAt(1));\n";
      js += "                        let scale;\n";
      js += "                        switch (headingLevel) {\n";
      js +=
        "                            case 1: scale = 2.25; break;  // h1: 2.25rem relative to base\n";
      js +=
        "                            case 2: scale = 1.75; break;  // h2: 1.75rem relative to base\n";
      js +=
        "                            case 3: scale = 1.375; break; // h3: 1.375rem relative to base\n";
      js +=
        "                            case 4: scale = 1.125; break; // h4: 1.125rem relative to base\n";
      js +=
        "                            case 5: scale = 1.0; break;   // h5: 1rem relative to base\n";
      js +=
        "                            case 6: scale = 0.875; break; // h6: 0.875rem relative to base\n";
      js += "                            default: scale = 1.0;\n";
      js += "                        }\n";
      js += "                        const headingSize = fontSize * scale;\n";
      js +=
        '                        heading.style.setProperty("font-size", headingSize + "rem", "important");\n';
      js += "                    });\n";
      js += "                    \n";
      js +=
        '                    this.announceChange("Font size set to " + Math.round(fontSize * 100) + "% with proportional heading sizes");\n';
      js +=
        '                    console.log("✅ Font size updated:", fontSize + "rem", "with", headings.length, "headings scaled proportionally");\n';
      js += "                } else {\n";
      js +=
        '                    console.error("❌ Target element not found for font size update");\n';
      js += "                }\n";
      js += "            }\n\n";

      js += "            updateLineHeight(lineHeight) {\n";
      js += "                if (this.targetElement) {\n";
      js +=
        "                    // Apply to main element and all its children\n";
      js +=
        '                    this.targetElement.style.setProperty("line-height", lineHeight, "important");\n';
      js += "                    \n";
      js +=
        "                    // Apply to all text elements to ensure consistency\n";
      js +=
        '                    const textElements = this.targetElement.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th, span, div");\n';
      js += "                    textElements.forEach(element => {\n";
      js +=
        '                        element.style.setProperty("line-height", lineHeight, "important");\n';
      js += "                    });\n";
      js += "                    \n";
      js +=
        '                    this.announceChange("Line height set to " + lineHeight);\n';
      js +=
        '                    console.log("✅ Line height updated:", lineHeight, "Applied to", textElements.length + 1, "elements");\n';
      js += "                } else {\n";
      js +=
        '                    console.error("❌ Target element not found for line height update");\n';
      js += "                }\n";
      js += "            }\n\n";

      js += "            updateWordSpacing(wordSpacing) {\n";
      js += "                if (this.targetElement) {\n";
      js +=
        '                    this.targetElement.style.wordSpacing = wordSpacing + "em";\n';
      js +=
        '                    this.announceChange("Word spacing set to " + wordSpacing);\n';
      js +=
        '                    console.log("Word spacing updated:", wordSpacing);\n';
      js += "                }\n";
      js += "            }\n\n";

      js += "            updateLetterSpacing(letterSpacing) {\n";
      js += "                if (this.targetElement) {\n";
      js +=
        '                    this.targetElement.style.letterSpacing = letterSpacing + "em";\n';
      js +=
        '                    this.announceChange("Letter spacing set to " + letterSpacing);\n';
      js +=
        '                    console.log("Letter spacing updated:", letterSpacing);\n';
      js += "                }\n";
      js += "            }\n\n";

      js += "            updateReadingWidth(width) {\n";
      js += "                if (this.targetElement) {\n";
      js += "                    const widthMap = {\n";
      js += '                        "full": "none",\n';
      js +=
        '                        "wide": "clamp(min(93.75vw, 60ch), 70vw, 80ch)",\n';
      js +=
        '                        "narrow": "clamp(min(93.75vw, 50ch), 60vw, 65ch)",\n';
      js +=
        '                        "extra-narrow": "clamp(min(93.75vw, 40ch), 50vw, 50ch)"\n';
      js += "                    };\n";
      js += "                    \n";
      js += "                    // Apply max-width\n";
      js +=
        "                    this.targetElement.style.maxWidth = widthMap[width];\n";
      js += "                    \n";
      js +=
        "                    // Center content when constrained (desktop only - mobile uses block layout)\n";
      js += '                    if (width === "full") {\n';
      js += '                        this.targetElement.style.margin = "0";\n';
      js += "                    } else {\n";
      js +=
        '                        this.targetElement.style.margin = "0 auto";\n';
      js += "                    }\n";
      js += "                    \n";
      js +=
        '                    this.announceChange("Reading width set to " + width);\n';
      js +=
        '                    console.log("Reading width updated:", width);\n';
      js += "                }\n";
      js += "            }\n\n";

      js += "            updateParagraphSpacing(spacing) {\n";
      js += "                if (this.targetElement) {\n";
      js +=
        '                    const paragraphs = this.targetElement.querySelectorAll("p");\n';
      js += "                    paragraphs.forEach(p => {\n";
      js += '                        p.style.marginBottom = spacing + "em";\n';
      js += "                    });\n";
      js +=
        '                    this.announceChange("Paragraph spacing set to " + spacing + "em");\n';
      js +=
        '                    console.log("Paragraph spacing updated:", spacing);\n';
      js += "                }\n";
      js += "            }\n\n";

      js += "            resetAllSettings() {\n";
      js += "                try {\n";
      js += "                    const controls = {\n";
      js += '                        "font-family": "Verdana, sans-serif",\n';
      js += '                        "font-size": "1.0",\n';
      js += '                        "reading-width": "narrow",\n';
      js += '                        "line-height": "1.6",\n';
      js += '                        "word-spacing": "0",\n';
      js += '                        "letter-spacing": "0",\n';
      js += '                        "paragraph-spacing": "1"\n';
      js += "                    };\n\n";

      js +=
        "                    Object.entries(controls).forEach(([id, value]) => {\n";
      js +=
        "                        const element = document.getElementById(id);\n";
      js += "                        if (element) element.value = value;\n";
      js += "                    });\n\n";

      js +=
        '                    const fontSizeValue = document.getElementById("font-size-value");\n';
      js +=
        '                    const paragraphSpacingValue = document.getElementById("paragraph-spacing-value");\n';
      js +=
        '                    if (fontSizeValue) fontSizeValue.textContent = "100%";\n';
      js +=
        '                    if (paragraphSpacingValue) paragraphSpacingValue.textContent = "1.0em";\n\n';

      js += "                    if (this.targetElement) {\n";
      js += "                        // Reset main element styles\n";
      js +=
        '                        this.targetElement.style.setProperty("font-family", "Verdana, sans-serif", "important");\n';
      js +=
        '                        this.targetElement.style.setProperty("font-size", "1rem", "important");\n';
      js +=
        '                        this.targetElement.style.setProperty("line-height", "1.6", "important");\n';
      js +=
        '                        this.targetElement.style.setProperty("word-spacing", "0", "important");\n';
      js +=
        '                        this.targetElement.style.setProperty("letter-spacing", "0", "important");\n';
      js +=
        '                        this.targetElement.style.setProperty("max-width", "clamp(min(93.75vw, 50ch), 60vw, 65ch)", "important");\n';
      js +=
        '                        this.targetElement.style.setProperty("margin", "0 auto", "important");\n';
      js += "                        \n";
      js +=
        "                        // Reset text elements (but not headings)\n";
      js +=
        '                        const textElements = this.targetElement.querySelectorAll("p, li, td, th, span, div");\n';
      js += "                        textElements.forEach(element => {\n";
      js +=
        '                            element.style.setProperty("font-size", "inherit", "important");\n';
      js +=
        '                            element.style.setProperty("line-height", "1.6", "important");\n';
      js += "                        });\n";
      js += "                        \n";
      js +=
        "                        // Reset headings with proper hierarchy (matching original CSS sizes)\n";
      js +=
        '                        const headings = this.targetElement.querySelectorAll("h1, h2, h3, h4, h5, h6");\n';
      js += "                        headings.forEach(heading => {\n";
      js +=
        "                            const headingLevel = parseInt(heading.tagName.charAt(1));\n";
      js += "                            let size;\n";
      js += "                            switch (headingLevel) {\n";
      js +=
        '                                case 1: size = "2.25rem"; break;\n';
      js +=
        '                                case 2: size = "1.75rem"; break;\n';
      js +=
        '                                case 3: size = "1.375rem"; break;\n';
      js +=
        '                                case 4: size = "1.125rem"; break;\n';
      js += '                                case 5: size = "1rem"; break;\n';
      js +=
        '                                case 6: size = "0.875rem"; break;\n';
      js += '                                default: size = "1rem";\n';
      js += "                            }\n";
      js +=
        '                            heading.style.setProperty("font-size", size, "important");\n';
      js +=
        '                            heading.style.setProperty("line-height", "1.25", "important");\n';
      js += "                        });\n";
      js += "                        \n";
      js += "                        // Reset paragraph spacing\n";
      js +=
        '                        const paragraphs = this.targetElement.querySelectorAll("p");\n';
      js += "                        paragraphs.forEach(p => {\n";
      js +=
        '                            p.style.setProperty("margin-bottom", "1rem", "important");\n';
      js += "                        });\n";
      js += "                    }\n\n";

      js +=
        '                    this.announceChange("All reading settings reset to defaults with proper heading hierarchy");\n';
      js +=
        '                    console.log("✅ Reading tools reset to defaults with proportional heading sizes");\n';
      js += "                    return true;\n";
      js += "                } catch (error) {\n";
      js +=
        '                    console.error("❌ Reading tools reset failed:", error);\n';
      js += "                    return false;\n";
      js += "                }\n";
      js += "            }\n\n";

      js += "            announceChange(message) {\n";
      js +=
        '                const announcement = document.createElement("div");\n';
      js += '                announcement.className = "sr-only";\n';
      js += '                announcement.setAttribute("role", "status");\n';
      js +=
        '                announcement.setAttribute("aria-live", "polite");\n';
      js += "                announcement.textContent = message;\n";
      js += "                document.body.appendChild(announcement);\n";
      js += "                setTimeout(() => {\n";
      js += "                    if (document.body.contains(announcement)) {\n";
      js +=
        "                        document.body.removeChild(announcement);\n";
      js += "                    }\n";
      js += "                }, 1000);\n";
      js += "            }\n";
      js += "        }\n";

      return js;
    }

    /**
     * Generate theme toggle JavaScript
     */
    generateThemeToggleJS() {
      let js = "";
      js +=
        "        // Enhanced Theme Management with System Preference Support\n";
      js += "        (function() {\n";
      js +=
        '            const themeToggle = document.getElementById("theme-toggle");\n';
      js +=
        '            const themeIcon = themeToggle?.querySelector(".theme-toggle-icon");\n';
      js +=
        '            const themeText = themeToggle?.querySelector(".theme-toggle-text");\n';
      js += "\n";
      js += "            function getPreferredTheme() {\n";
      js +=
        '                const stored = localStorage.getItem("user-theme");\n';
      js += "                if (stored) return stored;\n";
      js +=
        '                if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";\n';
      js +=
        '                if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";\n';
      js += '                return "light"; // fallback\n';
      js += "            }\n";
      js += "\n";
      js += "            function setTheme(theme) {\n";
      js +=
        '                document.documentElement.setAttribute("data-theme", theme);\n';
      js += '                localStorage.setItem("user-theme", theme);\n';
      js += '                if (theme === "dark") {\n';
      js +=
        '                    if (themeIcon) themeIcon.textContent = "☀️";\n';
      js +=
        '                    if (themeText) themeText.textContent = "Light";\n';
      js +=
        '                    if (themeToggle) themeToggle.setAttribute("aria-label", "Switch to light mode");\n';
      js += "                } else {\n";
      js +=
        '                    if (themeIcon) themeIcon.textContent = "🌙";\n';
      js +=
        '                    if (themeText) themeText.textContent = "Dark";\n';
      js +=
        '                    if (themeToggle) themeToggle.setAttribute("aria-label", "Switch to dark mode");\n';
      js += "                }\n";
      js += '                console.log("Theme set to:", theme);\n';
      js += "            }\n";
      js += "\n";
      js += "            const initialTheme = getPreferredTheme();\n";
      js += "            setTheme(initialTheme);\n";
      js += "\n";
      js += "            if (themeToggle) {\n";
      js +=
        '                themeToggle.addEventListener("click", function() {\n';
      js +=
        '                    const current = document.documentElement.getAttribute("data-theme") || "light";\n';
      js +=
        '                    const newTheme = current === "light" ? "dark" : "light";\n';
      js += "                    setTheme(newTheme);\n";
      js += "                });\n";
      js += "            }\n";
      js += "        })();\n";
      return js;
    }

    /**
     * Generate initialization JavaScript
     */
    generateInitializationJS() {
      let js = "";

      js += "        // Initialise System Theme Detection\n";
      js += this.generateSystemThemeDetectionJS();
      js += "\n";

      js += "        // Initialize Reading Accessibility Tools\n";
      js +=
        '        document.addEventListener("DOMContentLoaded", function() {\n';
      js +=
        "            window.readingAccessibilityManager = new ReadingAccessibilityManager();\n";
      js +=
        '            console.log("✅ Reading Accessibility Tools initialised");\n';
      js += "        });\n";
      js += "\n";
      js +=
        '        console.log("✅ Enhanced mathematical document with reading accessibility controls and theme toggle loaded");\n';

      return js;
    }
  }

  // ===========================================================================================
  // TEMPLATE VALIDATION AND UTILITIES
  // ===========================================================================================

  /**
   * Validate template system
   */
  function validateTemplateSystem() {
    logInfo("🧪 Validating template system...");

    try {
      const generator = new EnhancedHTMLGenerator();

      // Test key templates
      const testTemplates = [
        "readingToolsSection",
        "resetControlsSection",
        "themeToggleSection",
        "printButtonSection",
        "mathJaxAccessibilityControls",
      ];

      let passed = 0;
      testTemplates.forEach((templateName) => {
        try {
          const result = generator.renderTemplate(templateName);
          if (result && result.length > 0) {
            passed++;
            logDebug(`✅ Template ${templateName}: OK`);
          } else {
            logError(`❌ Template ${templateName}: Empty result`);
          }
        } catch (error) {
          logError(`❌ Template ${templateName}: ${error.message}`);
        }
      });

      const total = testTemplates.length;
      logInfo(`📊 Template validation: ${passed}/${total} templates working`);

      return {
        passed: passed,
        total: total,
        success: passed === total,
      };
    } catch (error) {
      logError("Template validation failed:", error);
      return {
        passed: 0,
        total: 0,
        success: false,
      };
    }
  }

  /**
   * Template performance measurement
   */
  function measureTemplatePerformance() {
    logInfo("📊 Measuring template performance...");

    try {
      const generator = new EnhancedHTMLGenerator();
      const testMetadata = {
        title: "Test Document",
        author: "Test Author",
        sections: [
          { title: "Introduction", level: 2, id: "intro" },
          { title: "Methods", level: 2, id: "methods" },
        ],
      };

      const startTime = performance.now();

      // Generate complete sidebar
      const sidebar = generator.renderTemplate(
        "integratedDocumentSidebar",
        testMetadata
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      logInfo(`⚡ Template generation time: ${duration.toFixed(2)}ms`);
      logInfo(`📏 Generated HTML size: ${sidebar.length} characters`);

      return {
        duration: duration,
        size: sidebar.length,
        efficient: duration < 50, // Under 50ms is good
      };
    } catch (error) {
      logError("Performance measurement failed:", error);
      return {
        duration: -1,
        size: 0,
        efficient: false,
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main template generator
    EnhancedHTMLGenerator,

    // Validation and testing
    validateTemplateSystem,
    measureTemplatePerformance,

    // Utilities
    createGenerator() {
      return new EnhancedHTMLGenerator();
    },

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.TemplateSystem = TemplateSystem;
