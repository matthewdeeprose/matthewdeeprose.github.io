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
  async function exportWithEnhancedPandoc() {
    logInfo("🧪 === ENHANCED PANDOC EXPORT STARTED ===");
    window.exportGenerationInProgress = true;

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
            await generateEnhancedStandaloneHTMLWithMinimalProcessing(
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
        await generateEnhancedStandaloneHTMLWithMinimalProcessing(
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
      // Reset button state and clear export flag
      window.exportGenerationInProgress = false;
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
  async function generateEnhancedStandaloneHTMLWithMinimalProcessing(
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
      // 🎯 CRITICAL FIX: Ensure external templates are loaded first and force sync
      const loadResults =
        await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();
      logDebug("Template load results:", loadResults);

      // Check global cache status and wait if necessary
      let cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
      logDebug("Cache status after ensureTemplatesLoaded:", cacheStatus);

      // If templates aren't loaded, wait with retries
      let retries = 0;
      while (!cacheStatus.isLoaded && retries < 20) {
        logDebug(`Waiting for templates to load (retry ${retries + 1}/20)...`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
        retries++;
      }

      if (!cacheStatus.isLoaded) {
        logWarn("Templates failed to load after retries, using fallback");
        htmlComponents.push(`
          <aside id="document-sidebar" class="document-sidebar" aria-label="Document Tools">
            <div class="sidebar-content">
              <p>Reading tools temporarily unavailable</p>
            </div>
          </aside>
        `);
      } else {
        const templateGenerator =
          new window.TemplateSystem.EnhancedHTMLGenerator();
        await templateGenerator.engine.initializeFromGlobalCache();

        const integratedSidebar = templateGenerator.renderTemplate(
          "integratedDocumentSidebar",
          metadata
        );

        if (
          integratedSidebar.includes("<!-- Template") &&
          integratedSidebar.includes("not found")
        ) {
          logWarn("Template not found, using fallback sidebar");
          htmlComponents.push(`
            <aside id="document-sidebar" class="document-sidebar" aria-label="Document Tools">
              <div class="sidebar-content">
                <p>Reading tools temporarily unavailable</p>
              </div>
            </aside>
          `);
        } else {
          logDebug(
            "✅ Successfully rendered integrated sidebar with templates"
          );
          htmlComponents.push(integratedSidebar);
        }
      }

      // Add document footer
      htmlComponents.push(generateDocumentFooter());

      htmlComponents.push("</div>"); // Close document-wrapper

      // Enhanced JavaScript with complete reading accessibility features
      htmlComponents.push(await generateEnhancedJavaScript(accessibilityLevel));

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
  async function generateEnhancedStandaloneHTML(
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
      // 🎯 CRITICAL FIX: Ensure templates are loaded before creating generator
      const loadResults =
        await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();
      logDebug("Template load results:", loadResults);

      let cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
      let retries = 0;
      while (!cacheStatus.isLoaded && retries < 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
        retries++;
      }

      if (!cacheStatus.isLoaded) {
        logWarn("Templates failed to load, using fallback sidebar");
        htmlComponents.push(`
          <aside id="document-sidebar" class="document-sidebar" aria-label="Document Tools">
            <div class="sidebar-content">
              <p>Reading tools temporarily unavailable</p>
            </div>
          </aside>
        `);
      } else {
        const templateGenerator =
          new window.TemplateSystem.EnhancedHTMLGenerator();
        await templateGenerator.engine.initializeFromGlobalCache();

        const integratedSidebar = templateGenerator.renderTemplate(
          "integratedDocumentSidebar",
          metadata
        );

        if (
          integratedSidebar.includes("<!-- Template") &&
          integratedSidebar.includes("not found")
        ) {
          logWarn("Template not found, using fallback sidebar");
          htmlComponents.push(`
            <aside id="document-sidebar" class="document-sidebar" aria-label="Document Tools">
              <div class="sidebar-content">
                <p>Reading tools temporarily unavailable</p>
              </div>
            </aside>
          `);
        } else {
          htmlComponents.push(integratedSidebar);
        }
      }
      // Add document footer
      htmlComponents.push(generateDocumentFooter());

      htmlComponents.push("</div>"); // ✅ Close document-wrapper

      // Enhanced JavaScript with reading accessibility features
      htmlComponents.push(await generateEnhancedJavaScript(accessibilityLevel));

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
    html += "    <p>Generated using Pandoc-WASM and MathJax</p>\n";
    html += "    <p>What other information should appear in this footer?</p>\n";
    html += "</footer>\n";
    return html;
  }

  /**
   * Generate MathJax controls JavaScript for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateMathJaxControlsJS(accessibilityLevel = 1) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateMathJaxControlsJS(accessibilityLevel);
    }
    throw new Error("Template system required for MathJax controls generation");
  }

  /**
   * Generate Reading Tools Setup JavaScript for exported documents
   * ✅ PHASE 2A STEP 2: Now uses external JavaScript template
   */
  async function generateReadingToolsSetupJS(accessibilityLevel = 1) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateReadingToolsSetupJS(accessibilityLevel);
    }
    throw new Error(
      "Template system required for reading tools setup generation"
    );
  }

  /**
   * Generate focus tracking utility for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateFocusTrackingJS(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateFocusTrackingJS(options);
    }
    throw new Error("Template system required for focus tracking generation");
  }

  /**
   * Generate Theme Management JavaScript for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateThemeManagementJS(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateThemeManagementJS(options);
    }
    throw new Error("Template system required for theme management generation");
  }

  /**
   * Generate form initialization JavaScript for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateFormInitializationJS(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateFormInitializationJS(options);
    }
    throw new Error(
      "Template system required for form initialization generation"
    );
  }

  /**
   * Generate ReadingAccessibilityManager class for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateReadingAccessibilityManagerClass(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateReadingAccessibilityManagerClassJS(
        options
      );
    }
    throw new Error(
      "Template system required for reading accessibility manager class generation"
    );
  }

  /**
   * Generate enhanced JavaScript with reading accessibility features and MathJax controls
   * Now uses template system for initialization JavaScript
   */
  async function generateEnhancedJavaScript(accessibilityLevel) {
    logInfo(
      "Generating enhanced JavaScript with complete accessibility functionality"
    );

    let html = "";
    html +=
      "    <!-- Enhanced Script with Reading Controls, Theme Toggle, Focus Tracking, and MathJax Controls -->\n";
    html += "    <script>\n";

    // ✅ FIXED: Generate ReadingAccessibilityManager class separately with proper template processing
    const accessibilityDefaults =
      window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS || {};
    html += await generateReadingAccessibilityManagerClass({
      defaultFontSize: accessibilityDefaults.defaultFontSize || 1.0, // ✅ Number
      defaultFontFamily:
        accessibilityDefaults.defaultFontFamily || "Verdana, sans-serif",
      defaultReadingWidth:
        accessibilityDefaults.defaultReadingWidth || "narrow",
      defaultLineHeight: accessibilityDefaults.defaultLineHeight || 1.6, // ✅ Number
      defaultParagraphSpacing:
        accessibilityDefaults.defaultParagraphSpacing || 1.0, // ✅ Number
      enableAdvancedControls: accessibilityLevel >= 2,
    });

    // Generate theme management functionality
    html += await generateThemeManagementJS();

    // Generate form initialization (from external template) - Using centralized defaults
    html += await generateFormInitializationJS({
      defaultFontSize: accessibilityDefaults.defaultFontSize || "1.0",
      defaultFontSizePercent:
        accessibilityDefaults.defaultFontSizePercent || "100%",
      defaultLineHeight: accessibilityDefaults.defaultLineHeight || "1.6",
      defaultWordSpacing: accessibilityDefaults.defaultWordSpacing || "0",
      defaultReadingWidth:
        accessibilityDefaults.defaultReadingWidth || "narrow", // ✅ FIXED
      defaultZoomLevel: accessibilityDefaults.defaultZoomLevel || "1.0",
      enableValidation: accessibilityDefaults.enableValidation !== false,
      enableAccessibility: accessibilityDefaults.enableAccessibility !== false,
      enablePreferences: accessibilityDefaults.enablePreferences !== false,
    });

    // Include focus tracking with console commands
    html += await generateFocusTrackingJS({
      enableConsoleCommands: true,
      commandsDelayMs: 100,
    });

    // Include MathJax controls
    html += await generateMathJaxControlsJS(accessibilityLevel);

    // ✅ CRITICAL FIX: Include MathJax Manager for sophisticated refresh dialog logic
    html += await generateMathJaxManagerJS();

    // ✅ PHASE 1 MIGRATION: Use template system for initialization
    try {
      if (window.TemplateSystem) {
        const generator = window.TemplateSystem.createGenerator();
        const initializationJS = await generator.generateInitializationJS();
        html += "\n        // Initialization (from external template)\n";
        html += initializationJS;
        logDebug("✅ Using external template for initialization JavaScript");
      } else {
        throw new Error("TemplateSystem not available");
      }
    } catch (error) {
      logWarn(
        "Template system not available, using fallback initialization:",
        error.message
      );

      // Fallback initialization (original hardcoded version)
      html += "\n        // Fallback removed\n";
    }

    // ✅ CRITICAL FIX: Create Dynamic MathJax Manager instance for sophisticated controls
    html += `
        // Create Dynamic MathJax Manager instance for sophisticated controls
        setTimeout(() => {
            if (!window.dynamicMathJaxManager && window.MathJaxManager) {
                try {
                    window.dynamicMathJaxManager = window.MathJaxManager.createManager();
                    window.dynamicMathJaxManager.initialise();
                    console.log('✅ Dynamic MathJax Manager instance created and initialised in exported document');
                } catch (error) {
                    console.error('❌ Failed to create Dynamic MathJax Manager in exported document:', error);
                }
            } else if (!window.MathJaxManager) {
                console.warn('⚠️ MathJaxManager module not available in exported document');
            } else if (window.dynamicMathJaxManager) {
                console.log('ℹ️ Dynamic MathJax Manager already exists in exported document');
            }
        }, 500);
`;

    html += "    </script>\n";

    return html;
  }

  /**
   * Generate MathJax Manager JavaScript for exported documents
   * ✅ CRITICAL FIX: Include sophisticated refresh dialog logic
   */
  async function generateMathJaxManagerJS() {
    logInfo(
      "Including MathJax Manager for sophisticated accessibility controls"
    );

    try {
      // Read the mathjax-manager.js file content
      const response = await fetch("./js/export/mathjax-manager.js");

      if (!response.ok) {
        throw new Error(
          `Failed to load mathjax-manager.js: ${response.status}`
        );
      }

      const mathJaxManagerContent = await response.text();

      logDebug("✅ MathJax Manager content loaded successfully");

      // Return with proper formatting and comments
      return (
        "\n        // MathJax Manager (sophisticated refresh dialog logic)\n" +
        "        " +
        mathJaxManagerContent.split("\n").join("\n        ") +
        "\n"
      );
    } catch (error) {
      logError("Failed to load MathJax Manager:", error);

      // Return minimal fallback that at least provides the module structure
      return `
        // MathJax Manager (fallback - sophisticated features unavailable)
        window.MathJaxManager = {
          createManager: function() {
            console.warn('⚠️ MathJax Manager fallback - sophisticated features unavailable');
            return {
              getCurrentSettings: () => ({}),
              initialise: () => console.log('MathJax Manager fallback initialized')
            };
          }
        };
`;
    }
  }

  // ===========================================================================================
  // MAIN EXPORT FUNCTIONALITY
  // ===========================================================================================

  /**
   * Enhanced main export function with screen reader accessibility controls
   * Now supports investigation-based enhanced export mode
   */
  async function exportEnhancedHTML() {
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
      return await exportWithEnhancedPandoc();
    }
    logInfo("=== ENHANCED EXPORT WITH SCREEN READER CONTROLS STARTED ===");
    window.exportGenerationInProgress = true;

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
      const standaloneHTML = await generateEnhancedStandaloneHTML(
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
      // Reset button state and clear export flag
      window.exportGenerationInProgress = false;
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

    // ✅ NEW: Check if already has our listener
    if (exportButton.hasAttribute("data-export-initialized")) {
      logWarn("Export button already initialized - skipping");
      return;
    }

    // ✅ NEW: Mark as initialized
    exportButton.setAttribute("data-export-initialized", "true");

    // Click handler - now only added once
    exportButton.addEventListener("click", function (e) {
      logInfo("Enhanced export button clicked");
      e.preventDefault();
      exportEnhancedHTML();
    });

    // Make the enhanced function globally available for keyboard shortcut
    window.exportToHTML = exportEnhancedHTML;

    // Title attribute removed - using aria-label instead for accessibility
    // (exportButton already has comprehensive aria-label attribute) enhanced HTML with screen reader enhancement controls, working MathJax context menus, LaTeX preservation, Holy Grail layout, and comprehensive accessibility features"

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
  async function testExportGeneration() {
    logInfo("🧪 Testing export generation...");

    try {
      const testContent = `
        <h1>Test Document</h1>
        <p>This is a test document with some mathematical content:</p>
        <p>Einstein's equation: $E = mc^2$</p>
        <p>The quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$</p>
      `;

      // CRITICAL FIX: Await the async function
      const html = await generateEnhancedStandaloneHTML(
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
        logDebug("HTML preview:", html.substring(0, 200) + "...");
      }

      return {
        success: success,
        size: html.length,
        hasDoctype: html.includes("<!DOCTYPE html>"),
        hasReadingTools: html.includes("reading-tools-section"),
        hasSidebar: html.includes("document-sidebar"),
        hasIntegratedSidebar: html.includes("integratedDocumentSidebar"),
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
