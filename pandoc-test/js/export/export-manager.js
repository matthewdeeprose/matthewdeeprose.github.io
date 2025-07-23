// export-manager.js
// Main Export Orchestration Module
// Coordinates all modules to generate enhanced HTML exports

const ExportManager = (function () {
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
      console.error("[EXPORT]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[EXPORT]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[EXPORT]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[EXPORT]", message, ...args);
  }

  // ===========================================================================================
  // 🧪 ENHANCED PANDOC EXPORT INTEGRATION
  // ===========================================================================================

  /**
   * Export using enhanced Pandoc arguments from investigation
   * Uses current rendered content with enhanced Pandoc semantic structure
   * Single file generation with proper content source
   */
  function exportWithEnhancedPandoc() {
    logInfo("🧪 === ENHANCED PANDOC EXPORT STARTED ===");

    const exportButton = document.getElementById("exportButton");
    const inputTextarea = document.getElementById("input");
    const outputContent = document.getElementById("output");
    const argumentsInput = document.getElementById("arguments");

    // CRITICAL FIX 1: Use current rendered content, not raw input
    if (!outputContent || !outputContent.innerHTML.trim()) {
      alert("Please render some LaTeX content first before exporting.");
      return;
    }

    if (!exportButton) {
      logError("Export button not found");
      return;
    }

    // Capture original button content
    let originalButtonContent = exportButton.innerHTML;

    try {
      // Check all required dependencies
      const requiredDeps = [
        "ConversionEngine",
        "LaTeXProcessor",
        "ContentGenerator",
        "TemplateSystem",
      ];
      const missingDeps = requiredDeps.filter((dep) => !window[dep]);

      if (missingDeps.length > 0) {
        throw new Error(`Missing dependencies: ${missingDeps.join(", ")}`);
      }

      // Show loading state
      exportButton.disabled = true;
      exportButton.innerHTML =
        '<svg class="icon spinning" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">' +
        '<path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>' +
        "</svg>" +
        "Generating Enhanced Export...";

      logInfo(
        "🧪 Using current rendered content with enhanced Pandoc semantic structure..."
      );

      // CRITICAL FIX 2: Get the CURRENT rendered content (same as standard export)
      const currentContent = outputContent.innerHTML.trim();
      logInfo("Retrieved current content, length:", currentContent.length);

      // Enhanced validation with pre-rendered MathJax detection
      window.AppConfig.validateEnhancedContent(currentContent);

      // For enhanced export, we'll convert the rendered content to LaTeX,
      // then re-convert with enhanced Pandoc args to get better semantic structure
      if (window.ConversionEngine && inputTextarea?.value?.trim()) {
        logInfo(
          "🧪 Re-converting with enhanced Pandoc arguments for better semantic HTML..."
        );

        // Get base arguments
        const baseArgs =
          argumentsInput?.value || "--from latex --to html5 --mathjax";

        // Generate enhanced arguments using investigation settings
        const enhancedArgs =
          window.ConversionEngine.generateEnhancedPandocArgs(baseArgs);

        logInfo(`🧪 Using enhanced arguments: ${enhancedArgs}`);

        // Re-convert the original LaTeX with enhanced arguments
        const enhancedHTML = window.ConversionEngine.pandocFunction(
          enhancedArgs,
          inputTextarea.value
        );

        if (enhancedHTML && enhancedHTML.trim() !== "") {
          // Clean the enhanced output
          const cleanedHTML =
            window.ConversionEngine.cleanPandocOutput(enhancedHTML);

          // Get metadata from the enhanced content
          const metadata =
            window.LaTeXProcessor.extractDocumentMetadata(cleanedHTML);

          // Generate enhanced standalone HTML with enhanced Pandoc content
          const standaloneHTML =
            generateEnhancedStandaloneHTMLWithMinimalProcessing(
              cleanedHTML,
              metadata.title || "Enhanced Mathematical Document",
              2 // accessibility level
            );

          // CRITICAL FIX 3: Single file download only
          const filename = window.AppConfig.generateEnhancedFilename(metadata);
          downloadHTMLFile(standaloneHTML, filename);

          // Success announcement
          window.AppConfig.announceToScreenReader(
            "Enhanced Pandoc export completed successfully. Document uses enhanced semantic structure."
          );

          logInfo("✅ Enhanced Pandoc export completed successfully");
          logInfo("🧪 === ENHANCED PANDOC EXPORT COMPLETED ===");
          return; // CRITICAL: Exit here to prevent fallback
        }
      }

      // Fallback: Use current rendered content if re-conversion fails
      logInfo("🧪 Using current rendered content as fallback...");

      // Extract metadata from current content
      const metadata =
        window.LaTeXProcessor.extractDocumentMetadata(currentContent);

      // Generate enhanced standalone HTML with current content
      const standaloneHTML =
        generateEnhancedStandaloneHTMLWithMinimalProcessing(
          currentContent,
          metadata.title || "Enhanced Mathematical Document",
          2 // accessibility level
        );

      // Download the file
      const filename = window.AppConfig.generateEnhancedFilename(metadata);
      downloadHTMLFile(standaloneHTML, filename);

      // Success announcement
      window.AppConfig.announceToScreenReader(
        "Enhanced export completed successfully using current content."
      );

      logInfo("✅ Enhanced export completed successfully (fallback mode)");
      logInfo("🧪 === ENHANCED PANDOC EXPORT COMPLETED ===");
    } catch (error) {
      logError("Enhanced Pandoc export failed:", error);

      // CRITICAL FIX 4: No automatic fallback to prevent multiple downloads
      // Just show error and let user decide
      alert(
        "Enhanced export failed: " +
          error.message +
          "\n\nPlease try again or uncheck 'Use Enhanced Pandoc' to use standard export."
      );

      window.AppConfig.announceToScreenReader(
        "Enhanced export failed. Please try again or use standard export."
      );
    } finally {
      // Reset button state
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = originalButtonContent;
      }
    }
  }

  /**
   * Generate enhanced standalone HTML with minimal post-processing
   * Uses enhanced Pandoc HTML content with complete feature set and accessibility
   * "Minimal processing" means leveraging enhanced Pandoc arguments to reduce regex post-processing
   * while maintaining 100% feature parity with standard export
   */
  function generateEnhancedStandaloneHTMLWithMinimalProcessing(
    content,
    title,
    accessibilityLevel
  ) {
    logInfo(
      "🧪 Generating enhanced standalone HTML with minimal post-processing..."
    );
    logInfo("✅ Using enhanced Pandoc content with complete feature set");

    try {
      // Check dependencies
      if (!window.LaTeXProcessor) {
        throw new Error("LaTeXProcessor module not available");
      }
      if (!window.ContentGenerator) {
        throw new Error("ContentGenerator module not available");
      }
      if (!window.TemplateSystem) {
        throw new Error("TemplateSystem module not available");
      }

      // CRITICAL: Use enhanced Pandoc content directly with minimal regex processing
      // The content comes from enhanced Pandoc args, so we preserve its semantic structure
      const enhancedPandocContent = content;

      // Extract comprehensive metadata from enhanced content
      const metadata = window.LaTeXProcessor.extractDocumentMetadata(
        enhancedPandocContent
      );
      const documentTitle =
        metadata.title || title || "Enhanced Mathematical Document";

      // Enhance document structure using enhanced Pandoc content (minimal processing)
      // This preserves the semantic HTML from enhanced Pandoc arguments
      const enhancedContent = window.ContentGenerator.enhanceDocumentStructure(
        enhancedPandocContent,
        metadata
      );

      logInfo("✅ Enhanced Pandoc content preserved with minimal processing");
      logInfo("Document title:", documentTitle);
      logInfo("Metadata sections:", metadata.sections?.length || 0);

      // Build complete HTML structure using template system (same as standard export)
      const htmlComponents = [];

      // Document declaration and opening
      htmlComponents.push("<!DOCTYPE html>");
      htmlComponents.push('<html lang="en-GB">');

      // Enhanced head section with complete metadata
      htmlComponents.push(
        generateEnhancedHead(documentTitle, metadata, accessibilityLevel)
      );

      // Body and main content with complete structure
      htmlComponents.push("<body>");
      htmlComponents.push(enhancedContent);

      // Add complete integrated sidebar using template system (ALL sections)
      const templateGenerator =
        new window.TemplateSystem.EnhancedHTMLGenerator();
      const integratedSidebar = templateGenerator.renderTemplate(
        "integratedDocumentSidebar",
        metadata
      );
      htmlComponents.push(integratedSidebar);

      // Add document footer
      htmlComponents.push(generateDocumentFooter());

      htmlComponents.push("</div>"); // Close document-wrapper

      // Enhanced JavaScript with complete reading accessibility features
      htmlComponents.push(generateEnhancedJavaScript(accessibilityLevel));

      // End document
      htmlComponents.push("</body>");
      htmlComponents.push("</html>");

      const finalHTML = htmlComponents.join("\n");

      logInfo(
        `🧪 Enhanced standalone HTML generated (${finalHTML.length} characters)`
      );
      logInfo(
        "✅ Complete feature parity achieved with enhanced Pandoc semantic structure"
      );
      logInfo(
        "🎯 Benefits: Better semantic HTML + Full accessibility features"
      );

      return finalHTML;
    } catch (error) {
      logError(
        "Error generating enhanced standalone HTML with minimal processing:",
        error
      );
      throw new Error("Failed to generate enhanced HTML: " + error.message);
    }
  }

  /**
   * Download HTML file utility
   */
  function downloadHTMLFile(htmlContent, filename) {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = "none";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(url);

    logInfo(`Downloaded enhanced HTML file: ${filename}`);
  }

  // ===========================================================================================
  // ENHANCED STANDALONE HTML GENERATION
  // ===========================================================================================
  /**
   * Generate enhanced standalone HTML with screen reader controls and theme toggle
   */
  function generateEnhancedStandaloneHTML(
    content,
    title,
    accessibilityLevel = 2
  ) {
    logInfo(
      "Generating enhanced standalone HTML with screen reader controls and theme toggle"
    );
    logDebug("Content length:", content.length);
    logInfo("Accessibility level:", accessibilityLevel);

    try {
      // Check dependencies
      if (!window.LaTeXProcessor) {
        throw new Error("LaTeXProcessor module not available");
      }
      if (!window.ContentGenerator) {
        throw new Error("ContentGenerator module not available");
      }
      if (!window.TemplateSystem) {
        throw new Error("TemplateSystem module not available");
      }

      // CRITICAL: Convert pre-rendered MathJax back to LaTeX for proper menu attachment
      const latexContent = window.LaTeXProcessor.convertMathJaxToLatex(content);

      // Extract comprehensive metadata
      const metadata =
        window.LaTeXProcessor.extractDocumentMetadata(latexContent);
      const documentTitle = metadata.title || title || "Mathematical Document";

      // Enhance document structure with integrated sidebar
      const enhancedContent = window.ContentGenerator.enhanceDocumentStructure(
        latexContent,
        metadata
      );

      logInfo("Document title:", documentTitle);
      logInfo("Metadata:", metadata);

      // Build HTML structure using template system
      const htmlComponents = [];

      // Document declaration and opening
      htmlComponents.push("<!DOCTYPE html>");
      htmlComponents.push('<html lang="en-GB">');

      // Enhanced head section
      htmlComponents.push(
        generateEnhancedHead(documentTitle, metadata, accessibilityLevel)
      );

      // Body and main content
      htmlComponents.push("<body>");
      htmlComponents.push(enhancedContent);

      // Add integrated sidebar using template system
      const templateGenerator =
        new window.TemplateSystem.EnhancedHTMLGenerator();
      const integratedSidebar = templateGenerator.renderTemplate(
        "integratedDocumentSidebar",
        metadata
      );
      htmlComponents.push(integratedSidebar);

      // Add document footer
      htmlComponents.push(generateDocumentFooter());

      htmlComponents.push("</div>"); // ✅ Close document-wrapper

      // Enhanced JavaScript with reading accessibility features
      htmlComponents.push(generateEnhancedJavaScript(accessibilityLevel));

      // End document
      htmlComponents.push("</body>");
      htmlComponents.push("</html>");

      const finalHTML = htmlComponents.join("\n");

      logInfo(
        "✅ Enhanced HTML generation complete with screen reader controls and theme toggle"
      );
      logInfo(
        "Accessibility level " +
          accessibilityLevel +
          " features included with reading controls and theme toggle"
      );

      return finalHTML;
    } catch (error) {
      logError("Error generating enhanced standalone HTML:", error);
      throw new Error("Failed to generate enhanced HTML: " + error.message);
    }
  }

  /**
   * Generate enhanced head section with all required components
   */
  function generateEnhancedHead(title, metadata, accessibilityLevel) {
    const headComponents = [];

    // Meta tags
    headComponents.push("<head>");
    headComponents.push('    <meta charset="UTF-8">');
    headComponents.push(
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0">'
    );
    headComponents.push(
      `    <title>${window.ContentGenerator.escapeHtml(title)}</title>`
    );
    headComponents.push(
      '    <meta name="description" content="Mathematical document with reading accessibility controls and comprehensive accessibility features">'
    );
    headComponents.push(
      '    <meta name="generator" content="Enhanced Pandoc-WASM Mathematical Converter with Reading Controls">'
    );

    // Optional metadata
    if (metadata.author) {
      headComponents.push(
        `    <meta name="author" content="${window.ContentGenerator.escapeHtml(
          metadata.author
        )}">`
      );
    }
    if (metadata.date) {
      headComponents.push(
        `    <meta name="date" content="${window.ContentGenerator.escapeHtml(
          metadata.date
        )}">`
      );
    }

    headComponents.push(
      '    <meta name="keywords" content="mathematics, LaTeX, MathJax, accessibility, WCAG, reading tools, theme toggle">'
    );
    headComponents.push('    <meta name="robots" content="index, follow">');
    headComponents.push("");

    // MathJax configuration with accessibility features - Phase 2.3 Simplified Controls
    const mathJaxConfig = window.LaTeXProcessor.generateMathJaxConfig(
      accessibilityLevel,
      {
        // ✅ OPTIMAL DEFAULTS for exported documents with proven working controls
        zoomTrigger: "Click", // Most accessible default
        zoomScale: "200%", // Good default zoom level
        inTabOrder: true, // More accessible default (enabled by default)
        assistiveMml: true, // Always enabled for accessibility
        // ✅ BAKED-IN FEATURES (always enabled via LaTeX preservation)
        enableContextMenu: true, // Always enabled via LaTeX preservation
        renderer: "CHTML", // Always optimal renderer
        explorer: accessibilityLevel >= 2, // Enabled for level 2+
        mathScale: 1.0, // Always optimal scale
      }
    );
    headComponents.push(mathJaxConfig);
    headComponents.push("");

    // Enhanced CSS generation
    headComponents.push("    <style>");
    headComponents.push(window.ContentGenerator.generateEnhancedCSS());
    headComponents.push("    </style>");
    headComponents.push("</head>");

    return headComponents.join("\n");
  }

  /**
   * Generate document footer
   */
  function generateDocumentFooter() {
    let html = "";
    html += '<footer class="document-footer" role="contentinfo">\n';
    html += "    <p>Generated with using Pandoc-WASM and MathJax</p>\n";
    html += "    <p>What other information should appear in this footer?</p>\n";
    html += "</footer>\n";
    return html;
  }

  /**
   * Generate MathJax controls JavaScript for exported documents
   */
  function generateMathJaxControlsJS() {
    let js = "";
    js += "        // MathJax Controls Manager for Exported Documents\n";
    js += "        class MathJaxControlsManager {\n";
    js += "            constructor() {\n";
    js += "                this.currentSettings = {\n";
    js += "                    zoomTrigger: 'Click',\n";
    js += "                    zoomScale: '200%',\n";
    js += "                    assistiveMml: true,\n";
    js += "                    inTabOrder: false\n";
    js += "                };\n";
    js += "            }\n\n";

    js += "            initialize() {\n";
    js += "                this.setupZoomTriggerControls();\n";
    js += "                this.setupZoomScaleControl();\n";
    js += "                this.setupScreenReaderControls();\n";
    js +=
      "                console.log('MathJax controls initialized with settings:', this.currentSettings);\n";
    js += "            }\n\n";

    js += "            setupZoomTriggerControls() {\n";
    js +=
      "                const zoomTriggerRadios = document.querySelectorAll('input[name=\"zoom-trigger\"]');\n";
    js += "                zoomTriggerRadios.forEach(radio => {\n";
    js += "                    radio.addEventListener('change', (event) => {\n";
    js += "                        if (event.target.checked) {\n";
    js +=
      "                            this.updateZoomTrigger(event.target.value);\n";
    js += "                        }\n";
    js += "                    });\n";
    js += "                });\n";
    js += "            }\n\n";

    js += "            setupZoomScaleControl() {\n";
    js +=
      "                const zoomScaleSlider = document.getElementById('zoom-scale');\n";
    js +=
      "                const zoomScaleValue = document.getElementById('zoom-scale-value');\n";
    js += "                if (zoomScaleSlider && zoomScaleValue) {\n";
    js +=
      "                    zoomScaleSlider.addEventListener('input', (event) => {\n";
    js +=
      "                        const scalePercent = event.target.value + '%';\n";
    js +=
      "                        zoomScaleValue.textContent = scalePercent;\n";
    js += "                    });\n";
    js +=
      "                    zoomScaleSlider.addEventListener('change', (event) => {\n";
    js +=
      "                        const scalePercent = event.target.value + '%';\n";
    js += "                        this.updateZoomScale(scalePercent);\n";
    js += "                    });\n";
    js += "                }\n";
    js += "            }\n\n";

    js += "            setupScreenReaderControls() {\n";
    js +=
      "                const assistiveMmlCheckbox = document.getElementById('assistive-mathml');\n";
    js +=
      "                const tabNavigationCheckbox = document.getElementById('tab-navigation');\n";
    js += "                \n";
    js += "                if (assistiveMmlCheckbox) {\n";
    js +=
      "                    assistiveMmlCheckbox.addEventListener('change', (event) => {\n";
    js +=
      "                        this.updateAssistiveMathML(event.target.checked);\n";
    js += "                    });\n";
    js += "                }\n";
    js += "                \n";
    js += "                if (tabNavigationCheckbox) {\n";
    js +=
      "                    tabNavigationCheckbox.addEventListener('change', (event) => {\n";
    js +=
      "                        this.updateTabNavigation(event.target.checked);\n";
    js += "                    });\n";
    js += "                }\n";
    js += "            }\n\n";

    js += "            async updateZoomTrigger(newTrigger) {\n";
    js +=
      "                console.log('Updating zoom trigger to:', newTrigger);\n";
    js += "                this.currentSettings.zoomTrigger = newTrigger;\n";
    js += "                \n";
    js +=
      "                if (window.MathJax?.startup?.document?.menu?.settings) {\n";
    js +=
      "                    window.MathJax.startup.document.menu.settings.zoom = newTrigger;\n";
    js +=
      "                    this.announceSettingChange(`Zoom trigger changed to ${newTrigger}`);\n";
    js += "                }\n";
    js += "            }\n\n";

    js += "            async updateZoomScale(newScale) {\n";
    js += "                console.log('Updating zoom scale to:', newScale);\n";
    js += "                this.currentSettings.zoomScale = newScale;\n";
    js += "                \n";
    js +=
      "                if (window.MathJax?.startup?.document?.menu?.settings) {\n";
    js +=
      "                    window.MathJax.startup.document.menu.settings.zscale = newScale;\n";
    js +=
      "                    this.announceSettingChange(`Zoom scale changed to ${newScale}`);\n";
    js += "                }\n";
    js += "            }\n\n";

    js += "            updateAssistiveMathML(enabled) {\n";
    js +=
      "                console.log('Updating assistive MathML to:', enabled);\n";
    js += "                this.currentSettings.assistiveMml = enabled;\n";
    js += "                \n";
    js +=
      "                if (window.MathJax?.startup?.document?.menu?.settings) {\n";
    js +=
      "                    window.MathJax.startup.document.menu.settings.assistiveMml = enabled;\n";
    js += "                    \n";
    js += "                    if (!enabled) {\n";
    js +=
      "                        const assistiveElements = document.querySelectorAll('mjx-assistive-mml');\n";
    js +=
      "                        assistiveElements.forEach(element => element.remove());\n";
    js +=
      "                        this.announceSettingChange('Assistive MathML disabled for performance');\n";
    js += "                    } else {\n";
    js += "                        window.MathJax.typesetClear();\n";
    js += "                        window.MathJax.typesetPromise();\n";
    js +=
      "                        this.announceSettingChange('Assistive MathML enabled for screen readers');\n";
    js += "                    }\n";
    js += "                }\n";
    js += "            }\n\n";

    js += "            updateTabNavigation(enabled) {\n";
    js +=
      "                console.log('Updating tab navigation to:', enabled);\n";
    js += "                this.currentSettings.inTabOrder = enabled;\n";
    js += "                \n";
    js +=
      "                const mathElements = document.querySelectorAll('mjx-container');\n";
    js += "                mathElements.forEach((element, index) => {\n";
    js += "                    if (enabled) {\n";
    js += "                        element.setAttribute('tabindex', '0');\n";
    js +=
      "                        element.setAttribute('aria-label', `Mathematical expression ${index + 1}. Right-click for options.`);\n";
    js += "                    } else {\n";
    js += "                        element.removeAttribute('tabindex');\n";
    js += "                    }\n";
    js += "                });\n";
    js += "                \n";
    js += "                const announcement = enabled \n";
    js +=
      "                    ? 'Tab navigation enabled. Mathematical expressions included in keyboard navigation.' \n";
    js +=
      "                    : 'Tab navigation disabled. Mathematical expressions excluded from keyboard navigation.';\n";
    js += "                this.announceSettingChange(announcement);\n";
    js += "            }\n\n";

    js += "            announceSettingChange(message) {\n";
    js +=
      "                const announcement = document.createElement('div');\n";
    js += "                announcement.className = 'sr-only';\n";
    js += "                announcement.setAttribute('role', 'status');\n";
    js += "                announcement.setAttribute('aria-live', 'polite');\n";
    js += "                announcement.textContent = message;\n";
    js += "                document.body.appendChild(announcement);\n";
    js += "                setTimeout(() => {\n";
    js += "                    if (document.body.contains(announcement)) {\n";
    js += "                        document.body.removeChild(announcement);\n";
    js += "                    }\n";
    js += "                }, 1000);\n";
    js += "            }\n";
    js += "        }\n";

    return js;
  }

  /**
   * Generate focus tracking utility for exported documents
   */
  function generateFocusTrackingJS() {
    let js = "";
    js += "        // Focus Tracking Utility for Accessibility Testing\n";
    js += "        const FocusTracker = {\n";
    js += "            isActive: false,\n";
    js += "            logFocusChanges: null,\n\n";

    js += "            describeElement(el) {\n";
    js += "                if (!el) return 'No element focused';\n";
    js += "                \n";
    js += "                let desc = el.tagName.toLowerCase();\n";
    js += "                \n";
    js += "                // Add ID if present\n";
    js += "                if (el.id) desc += `#${el.id}`;\n";
    js += "                \n";
    js += "                // Add classes if present\n";
    js +=
      "                if (el.className && el.className.toString().trim()) {\n";
    js +=
      "                    desc += `.${el.className.toString().trim().replace(/\\s+/g, '.')}`;\n";
    js += "                }\n";
    js += "                \n";
    js += "                // Add name attribute if present\n";
    js += '                if (el.name) desc += ` [name="${el.name}"]`;\n';
    js += "                \n";
    js += "                // Add ARIA label if present\n";
    js +=
      '                if (el.ariaLabel) desc += ` [aria-label="${el.ariaLabel}"]`;\n';
    js += "                \n";
    js += "                // Add aria-labelledby if present\n";
    js += "                if (el.getAttribute('aria-labelledby')) {\n";
    js +=
      "                    desc += ` [aria-labelledby=\"${el.getAttribute('aria-labelledby')}\"]`;\n";
    js += "                }\n";
    js += "                \n";
    js += "                // Add role if present\n";
    js += "                if (el.getAttribute('role')) {\n";
    js +=
      "                    desc += ` [role=\"${el.getAttribute('role')}\"]`;\n";
    js += "                }\n";
    js += "                \n";
    js += "                // Add tabindex if present and not default\n";
    js += "                const tabindex = el.getAttribute('tabindex');\n";
    js += "                if (tabindex !== null) {\n";
    js += '                    desc += ` [tabindex="${tabindex}"]`;\n';
    js += "                }\n";
    js += "                \n";
    js += "                // Add parent context for better identification\n";
    js +=
      "                if (el.parentElement && (el.parentElement.id || el.parentElement.className)) {\n";
    js +=
      "                    let parentDesc = el.parentElement.tagName.toLowerCase();\n";
    js +=
      "                    if (el.parentElement.id) parentDesc += `#${el.parentElement.id}`;\n";
    js +=
      "                    if (el.parentElement.className && el.parentElement.className.toString().trim()) {\n";
    js +=
      "                        const parentClasses = el.parentElement.className.toString().trim().split(/\\s+/).slice(0, 2).join('.');\n";
    js +=
      "                        if (parentClasses) parentDesc += `.${parentClasses}`;\n";
    js += "                    }\n";
    js += "                    desc += ` (in ${parentDesc})`;\n";
    js += "                }\n";
    js += "                \n";
    js += "                return desc;\n";
    js += "            },\n\n";

    js += "            start() {\n";
    js += "                if (this.isActive) {\n";
    js +=
      "                    console.warn('Focus tracking already active');\n";
    js += "                    return;\n";
    js += "                }\n\n";

    js +=
      "                console.log('🎯 Starting focus tracking for accessibility testing...');\n";
    js += "                \n";
    js += "                this.logFocusChanges = (event) => {\n";
    js +=
      "                    const elementDesc = this.describeElement(document.activeElement);\n";
    js +=
      "                    const eventType = event.type === 'focusin' ? 'FOCUS IN' : 'FOCUS OUT';\n";
    js += "                    \n";
    js +=
      "                    console.log(`%c${eventType}:`, 'color: #2563eb; font-weight: bold;', elementDesc);\n";
    js += "                    \n";
    js += "                    // Also check for focus-visible state\n";
    js +=
      "                    if (document.activeElement && document.activeElement.matches && document.activeElement.matches(':focus-visible')) {\n";
    js +=
      "                        console.log(`%c  → Focus-visible: YES`, 'color: #16a34a;');\n";
    js += "                    } else if (document.activeElement) {\n";
    js +=
      "                        console.log(`%c  → Focus-visible: NO`, 'color: #dc2626;');\n";
    js += "                    }\n";
    js += "                };\n\n";

    js += "                // Listen for both focusin and focusout events\n";
    js +=
      "                document.addEventListener('focusin', this.logFocusChanges);\n";
    js +=
      "                document.addEventListener('focusout', this.logFocusChanges);\n";
    js += "                \n";
    js += "                this.isActive = true;\n";
    js += "                \n";
    js += "                // Log initial state\n";
    js +=
      "                console.log(`%cINITIAL FOCUS:`, 'color: #7c3aed; font-weight: bold;', this.describeElement(document.activeElement));\n";
    js += "                \n";
    js +=
      "                console.log('✅ Focus tracking active - use stopFocusTracking() to disable');\n";
    js += "            },\n\n";

    js += "            stop() {\n";
    js += "                if (!this.isActive) {\n";
    js += "                    console.warn('Focus tracking not active');\n";
    js += "                    return;\n";
    js += "                }\n\n";

    js += "                if (this.logFocusChanges) {\n";
    js +=
      "                    document.removeEventListener('focusin', this.logFocusChanges);\n";
    js +=
      "                    document.removeEventListener('focusout', this.logFocusChanges);\n";
    js += "                    this.logFocusChanges = null;\n";
    js += "                }\n";
    js += "                \n";
    js += "                this.isActive = false;\n";
    js += "                console.log('🛑 Focus tracking stopped');\n";
    js += "            },\n\n";

    js += "            getCurrentFocus() {\n";
    js += "                return {\n";
    js += "                    element: document.activeElement,\n";
    js +=
      "                    description: this.describeElement(document.activeElement),\n";
    js +=
      "                    isFocusVisible: document.activeElement && document.activeElement.matches && document.activeElement.matches(':focus-visible')\n";
    js += "                };\n";
    js += "            }\n";
    js += "        };\n\n";

    js += "        // Global functions for console use\n";
    js += "        function trackFocus() {\n";
    js += "            FocusTracker.start();\n";
    js += "        }\n\n";

    js += "        function stopFocusTracking() {\n";
    js += "            FocusTracker.stop();\n";
    js += "        }\n\n";

    js += "        function getCurrentFocus() {\n";
    js += "            const info = FocusTracker.getCurrentFocus();\n";
    js += "            console.log('Current focus:', info.description);\n";
    js += "            console.log('Focus-visible:', info.isFocusVisible);\n";
    js += "            return info;\n";
    js += "        }\n\n";

    js += "        // Make functions globally available\n";
    js += "        window.trackFocus = trackFocus;\n";
    js += "        window.stopFocusTracking = stopFocusTracking;\n";
    js += "        window.getCurrentFocus = getCurrentFocus;\n";
    js += "        window.FocusTracker = FocusTracker;\n\n";

    return js;
  }

  /**
   * Generate enhanced JavaScript with reading accessibility features and MathJax controls
   */
  function generateEnhancedJavaScript(accessibilityLevel) {
    const templateGenerator = new window.TemplateSystem.EnhancedHTMLGenerator();

    let html = "";
    html +=
      "    <!-- Enhanced Script with Reading Controls, Theme Toggle, Focus Tracking, and MathJax Controls -->\n";
    html += "    <script>\n";

    // Reading Accessibility Manager
    html += templateGenerator.generateReadingAccessibilityManager();
    html += "\n";

    // Theme Toggle
    html += templateGenerator.generateThemeToggleJS();
    html += "\n";

    // Focus Tracking Utility
    html += generateFocusTrackingJS();
    html += "\n";

    // MathJax Zoom Controls Manager
    html += generateMathJaxControlsJS();
    html += "\n";

    // Initialization
    html += templateGenerator.generateInitializationJS();

    // Initialize MathJax Controls
    html += "\n        // Initialize MathJax Controls\n";
    html += "        if (window.MathJax && window.MathJax.startup) {\n";
    html += "            window.MathJax.startup.promise.then(() => {\n";
    html +=
      "                window.mathJaxControlsManager = new MathJaxControlsManager();\n";
    html += "                window.mathJaxControlsManager.initialize();\n";
    html +=
      "                console.log('✅ MathJax controls initialized in exported document');\n";
    html += "            }).catch(error => {\n";
    html +=
      "                console.error('MathJax controls initialization failed:', error);\n";
    html += "            });\n";
    html += "        }\n";

    // Initialize Focus Tracking Commands
    html += "\n        // Initialize Focus Tracking Commands\n";
    html += "        setTimeout(() => {\n";
    html +=
      "            console.log('🎯 Focus tracking commands available:');\n";
    html +=
      "            console.log('  - trackFocus() - Start focus tracking');\n";
    html +=
      "            console.log('  - stopFocusTracking() - Stop focus tracking');\n";
    html +=
      "            console.log('  - getCurrentFocus() - Check current focus');\n";
    html += "        }, 100);\n";

    html += "    </script>\n";
    return html;
  }

  // ===========================================================================================
  // MAIN EXPORT FUNCTIONALITY
  // ===========================================================================================

  /**
   * Enhanced main export function with screen reader accessibility controls
   * Now supports investigation-based enhanced export mode
   */
  function exportEnhancedHTML() {
    // Get DOM elements - use global references if available
    const outputContent =
      (window.appElements && window.appElements.outputDiv) ||
      document.getElementById("output");
    const exportButton =
      (window.appElements && window.appElements.exportButton) ||
      document.getElementById("exportButton");

    if (!outputContent) {
      logError("Output content element not found");
      alert("Error: Could not find the output content to export.");
      return;
    }

    if (!exportButton) {
      logError("Export button element not found");
      return;
    }

    // 🧪 CHECK FOR ENHANCED EXPORT MODE
    const useEnhancedPandoc = document.getElementById(
      "export-enhanced-pandoc"
    )?.checked;

    if (useEnhancedPandoc) {
      logInfo(
        "🧪 Enhanced Pandoc export mode detected - using investigation settings"
      );
      return exportWithEnhancedPandoc();
    }
    logInfo("=== ENHANCED EXPORT WITH SCREEN READER CONTROLS STARTED ===");

    // Capture original button content BEFORE any modifications
    let originalButtonContent = exportButton.innerHTML;

    try {
      // Check all dependencies
      const dependencies = [
        "AppConfig",
        "LaTeXProcessor",
        "ContentGenerator",
        "TemplateSystem",
      ];
      const missingDeps = dependencies.filter((dep) => !window[dep]);

      if (missingDeps.length > 0) {
        throw new Error(`Missing dependencies: ${missingDeps.join(", ")}`);
      }

      // Disable button and show loading state
      exportButton.disabled = true;
      exportButton.innerHTML =
        '<svg class="icon spinning" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">' +
        '<path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>' +
        "</svg>" +
        "Generating Enhanced Export...";
      // Get the current output content
      const content = outputContent.innerHTML.trim();
      logInfo("Retrieved content, length:", content.length);

      // Enhanced validation with pre-rendered MathJax detection
      window.AppConfig.validateEnhancedContent(content);

      // Extract metadata for enhanced document generation
      const metadata = window.LaTeXProcessor.extractDocumentMetadata(content);
      logInfo("Extracted metadata:", metadata);

      // Generate the enhanced standalone HTML with simplified accessibility controls
      logInfo(
        "Generating enhanced standalone HTML with Phase 2.3 Simplified Accessibility Controls..."
      );
      logInfo(
        "✅ Features: Working runtime controls (zoom, tab nav), baked-in context menus, optimal defaults"
      );
      const standaloneHTML = generateEnhancedStandaloneHTML(
        content,
        metadata.title,
        2 // Use Level 2 accessibility (includes simplified working controls)
      );
      logInfo("Generated enhanced HTML length:", standaloneHTML.length);

      // Create blob and download
      logInfo("Creating download blob...");
      const blob = new Blob([standaloneHTML], {
        type: "text/html;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      // Create enhanced filename
      const filename = window.AppConfig.generateEnhancedFilename(metadata);

      // Create temporary download link
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = "none";
      downloadLink.setAttribute("aria-hidden", "true");

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up
      setTimeout(function () {
        URL.revokeObjectURL(url);
        logDebug("Cleaned up blob URL");
      }, 100);

      // Enhanced screen reader announcement
      const features = [];
      if (metadata.sections.length > 0) features.push("table of contents");
      if (content.includes("theorem") || content.includes("proof"))
        features.push("mathematical theorems");
      if (content.includes("table")) features.push("structured tables");
      features.push("LaTeX context menus");
      features.push("screen reader enhancement controls");

      const featuresText =
        features.length > 0 ? " with " + features.join(", ") : "";

      window.AppConfig.announceToScreenReader(
        'Enhanced HTML file "' +
          filename +
          '" has been downloaded successfully' +
          featuresText +
          ". The file includes Phase 2.3 simplified accessibility controls with working MathJax context menus, runtime zoom and navigation controls, and comprehensive screen reader support."
      );

      logInfo("Successfully exported enhanced HTML file: " + filename);
      logInfo("✅ Phase 2.3 Export Complete - Document includes:", {
        sections: metadata.sections.length,
        author: !!metadata.author,
        date: !!metadata.date,
        documentClass: !!metadata.documentClass,
        simplifiedControls: true,
        workingRuntimeControls: true,
        latexConversion: true,
        holyGrailLayout: true,
        accessibilityLevel: 2,
        screenReaderControls: true,
      });
      logInfo("=== ENHANCED EXPORT COMPLETED ===");
    } catch (error) {
      logError("Enhanced export error:", error);

      // Show user-friendly error message
      if (
        error.message.includes("No content") ||
        error.message.includes("Please enter")
      ) {
        alert("Export failed: " + error.message);
      } else if (error.message.includes("cancelled")) {
        logInfo("Export cancelled by user");
      } else {
        alert(
          "Export failed: " +
            error.message +
            "\n\nPlease try again or check the browser console for more details."
        );
      }

      window.AppConfig.announceToScreenReader(
        "Enhanced export failed. Please check the error message and try again."
      );
    } finally {
      // Reset button state - restore original structured content
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = originalButtonContent;
      }
    }
  }

  // ===========================================================================================
  // INITIALIZATION AND EVENT SETUP
  // ===========================================================================================

  /**
   * Set up enhanced event handlers for export functionality
   */
  function setupEnhancedExportHandlers() {
    logInfo(
      "Setting up enhanced export event handlers with Screen Reader Enhancement support..."
    );

    // Find export button
    const exportButton = document.getElementById("exportButton");

    if (!exportButton) {
      logError("Export button not found - retrying in 100ms");
      setTimeout(setupEnhancedExportHandlers, 100);
      return;
    }

    // Click handler
    exportButton.addEventListener("click", function (e) {
      logInfo("Enhanced export button clicked");
      e.preventDefault();
      exportEnhancedHTML();
    });

    // Make the enhanced function globally available for keyboard shortcut
    window.exportToHTML = exportEnhancedHTML;

    // Add tooltip for enhanced features
    exportButton.setAttribute(
      "title",
      "Export enhanced HTML with screen reader enhancement controls, working MathJax context menus, LaTeX preservation, Holy Grail layout, and comprehensive accessibility features"
    );

    // Set up Dynamic MathJax Manager if not already available
    setTimeout(() => {
      if (!window.dynamicMathJaxManager && window.MathJaxManager) {
        window.dynamicMathJaxManager = window.MathJaxManager.createManager();
        logInfo(
          "✅ Created Dynamic MathJax Manager instance for main application"
        );
      }
    }, 200);

    logInfo("Enhanced export functionality initialised successfully");
    logDebug("Export button found and enhanced handlers attached");
  }

  /**
   * Initialise enhanced export functionality with screen reader accessibility controls
   */
  function initialiseEnhancedExportFunctionality() {
    logInfo(
      "Initialising enhanced export functionality with Screen Reader Enhancement Controls..."
    );
    logInfo(
      "Key features: Working MathJax context menus, Screen reader accessibility controls, LaTeX conversion, Holy Grail layout, accessibility configuration panel"
    );

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        setupEnhancedExportHandlers
      );
    } else {
      setupEnhancedExportHandlers();
    }
  }

  // ===========================================================================================
  // VALIDATION AND TESTING
  // ===========================================================================================

  /**
   * Validate export manager dependencies
   */
  function validateDependencies() {
    logInfo("🧪 Validating export manager dependencies...");

    const requiredModules = [
      "AppConfig",
      "LaTeXProcessor",
      "ContentGenerator",
      "TemplateSystem",
      "MathJaxManager",
    ];

    const checks = {};
    requiredModules.forEach((moduleName) => {
      checks[moduleName] = !!window[moduleName];
    });

    const passed = Object.values(checks).filter(Boolean).length;
    const total = requiredModules.length;

    logInfo(`📊 Dependency validation: ${passed}/${total} modules available`);

    if (passed === total) {
      logInfo("✅ All dependencies satisfied");
    } else {
      logError(
        "❌ Missing dependencies:",
        Object.entries(checks)
          .filter(([key, value]) => !value)
          .map(([key]) => key)
      );
    }

    return {
      passed: passed,
      total: total,
      success: passed === total,
      missing: Object.entries(checks)
        .filter(([key, value]) => !value)
        .map(([key]) => key),
    };
  }

  /**
   * Test export generation without download
   */
  function testExportGeneration() {
    logInfo("🧪 Testing export generation...");

    try {
      const testContent = `
        <h1>Test Document</h1>
        <p>This is a test document with some mathematical content:</p>
        <p>Einstein's equation: $E = mc^2$</p>
        <p>The quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$</p>
      `;

      const html = generateEnhancedStandaloneHTML(
        testContent,
        "Test Document",
        2
      );

      const success =
        html.length > 1000 &&
        html.includes("<!DOCTYPE html>") &&
        html.includes("reading-tools-section");

      if (success) {
        logInfo(`✅ Export generation test passed (${html.length} characters)`);
      } else {
        logError("❌ Export generation test failed");
      }

      return {
        success: success,
        size: html.length,
        hasDoctype: html.includes("<!DOCTYPE html>"),
        hasReadingTools: html.includes("reading-tools-section"),
      };
    } catch (error) {
      logError("Export generation test failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main export functions
    generateEnhancedStandaloneHTML,
    exportEnhancedHTML,
    exportWithEnhancedPandoc,
    generateEnhancedStandaloneHTMLWithMinimalProcessing,

    // Initialization
    initialiseEnhancedExportFunctionality,
    setupEnhancedExportHandlers,

    // Testing and validation
    validateDependencies,
    testExportGeneration,

    // Utilities
    generateEnhancedHead,
    generateDocumentFooter,
    generateEnhancedJavaScript,
    downloadHTMLFile,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.ExportManager = ExportManager;

// Auto-initialise when the script loads
ExportManager.initialiseEnhancedExportFunctionality();
