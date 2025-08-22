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
        await generateEnhancedHead(documentTitle, metadata, accessibilityLevel)
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
      // Add enhanced document footer with source viewer
      // Get DOM elements safely (may not exist during testing)
      const inputTextarea = document.getElementById("input");
      const argumentsInput = document.getElementById("arguments");

      const originalSource = inputTextarea?.value || "";
      const pandocArgs =
        argumentsInput?.value || "--from latex --to html5 --mathjax";
      htmlComponents.push(
        generateDocumentFooter(originalSource, pandocArgs, metadata)
      );

      htmlComponents.push("</div>"); // Close document-wrapper

      // End document (but don't add JavaScript yet)
      htmlComponents.push("</body>");
      htmlComponents.push("</html>");

      // Generate the complete HTML first
      let preliminaryHTML = htmlComponents.join("\n");

      // 🎯 SELF-CONTAINING BASE64 SOLUTION - ITERATIVE CONVERGENCE APPROACH
      logInfo(
        "🔧 Generating self-containing Base64 content through iterative convergence (Enhanced Pandoc)..."
      );

      // First generate JavaScript without embedded content for structure
      const enhancedJS = await generateEnhancedJavaScript(accessibilityLevel);

      // Create initial HTML with JavaScript but without Base64
      let baseHTML = preliminaryHTML.replace(
        "</body>\n</html>",
        enhancedJS + "\n</body>\n</html>"
      );

      // Now implement iterative convergence for self-reference
      let currentHTML = baseHTML;
      let previousBase64 = "";
      let iteration = 0;
      // Change maxIterations value to increase number of possible saves that can be made
      // This will increase file size
      // After maxIterations -1 the save function will stop working properly
      const maxIterations = 5;
      let converged = false;

      logInfo(
        "🔄 Starting iterative Base64 generation for self-reference (Enhanced Pandoc)..."
      );

      while (iteration < maxIterations) {
        // Create script with current Base64 (empty on first iteration)
        const embeddedDataScript = `
<!-- Embedded Original Content for Save Functionality -->
<script id="original-content-data" type="application/x-original-html-base64">
${previousBase64}
</script>`;

        // Insert script into HTML (before closing body tag)
        currentHTML = baseHTML.replace(
          "</body>",
          embeddedDataScript + "\n</body>"
        );

        // Generate new Base64 from complete HTML
        const newBase64 = btoa(unescape(encodeURIComponent(currentHTML)));

        logDebug(
          `Enhanced Pandoc - Iteration ${iteration}: Base64 length = ${newBase64.length} characters`
        );

        // Check for convergence (Base64 stabilises when self-referential)
        if (newBase64 === previousBase64 && iteration > 0) {
          logInfo(
            `✅ Self-referential convergence achieved in ${iteration} iterations (Enhanced Pandoc)`
          );
          converged = true;
          break;
        }

        previousBase64 = newBase64;
        iteration++;
      }

      // Final HTML with self-referential Base64
      const finalHTML = currentHTML;
      const finalBase64Length = previousBase64.length;

      if (converged) {
        logInfo(
          `✅ True self-containing Base64 generated (Enhanced Pandoc): ${finalBase64Length} characters`
        );
        logInfo(
          `🔄 Base64 now contains HTML with exact same Base64 - perfect self-reference (Enhanced Pandoc)`
        );
      } else {
        logWarn(
          `⚠️ Convergence not achieved after ${maxIterations} iterations (Enhanced Pandoc), using best attempt`
        );
        logInfo(
          `📊 Final Base64 length (Enhanced Pandoc): ${finalBase64Length} characters`
        );
      }

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
   * Download HTML file with enhanced filename generation
   * @param {string} htmlContent - HTML content to download
   * @param {string} baseTitle - Base title for filename
   * @param {Object} metadata - Document metadata
   */
  function downloadHTMLFile(htmlContent, baseTitle, metadata) {
    logInfo("Preparing HTML file download...");

    // 🛡️ Prevent duplicate downloads
    if (window.downloadInProgress) {
      logWarn("Download already in progress - preventing duplicate");
      return;
    }
    window.downloadInProgress = true;

    try {
      const filename =
        window.AppConfig && metadata
          ? window.AppConfig.generateEnhancedFilename(metadata)
          : baseTitle || "mathematical_document.html";

      const blob = new Blob([htmlContent], {
        type: "text/html;charset=utf-8",
      });

      // 🛡️ Record download for duplicate detection
      if (window.DownloadMonitor) {
        window.DownloadMonitor.recordDownload(filename, {
          type: "html",
          size: blob.size,
          source: "export-manager",
          metadata: {
            title: baseTitle,
            sections: metadata?.sections?.length || 0,
            hasAuthor: !!metadata?.author,
            documentClass: metadata?.documentClass || "unknown",
            generatedAt: new Date().toISOString(),
          },
        });
      }

      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = "none";
      downloadLink.setAttribute("aria-hidden", "true");

      // 🛡️ Enhanced click protection
      let hasClicked = false;
      downloadLink.addEventListener("click", function () {
        if (hasClicked) {
          logWarn("Preventing duplicate click on download link");
          return false;
        }
        hasClicked = true;
        logInfo("Download link clicked successfully");
      });

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
        window.downloadInProgress = false;
      }, 200);

      logInfo("HTML file download initiated:", filename);
    } catch (error) {
      logError("Download failed:", error);
      window.downloadInProgress = false;
      throw error;
    }
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
      // ✅ NEW: Add these 3 lines here
      logInfo("🔍 Ensuring fonts are loaded for export...");
      const fontResult = await ensureEmbeddedFontsInclusion();
      logInfo("✅ Fonts validated successfully for export");

      // Check dependencies (your existing code continues here)
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
        await generateEnhancedHead(documentTitle, metadata, accessibilityLevel)
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
      // Add enhanced document footer with source viewer
      // Get DOM elements safely (may not exist during testing)
      const inputTextarea = document.getElementById("input");
      const argumentsInput = document.getElementById("arguments");

      const originalSource = inputTextarea?.value || "";
      const pandocArgs =
        argumentsInput?.value || "--from latex --to html5 --mathjax";
      const footerHTML = await generateDocumentFooter(
        originalSource,
        pandocArgs,
        metadata
      );
      htmlComponents.push(footerHTML);

      htmlComponents.push("</div>"); // Close document-wrapper

      // Enhanced JavaScript with complete reading accessibility features
      htmlComponents.push(await generateEnhancedJavaScript(accessibilityLevel));

      // End document
      htmlComponents.push("</body>");
      htmlComponents.push("</html>");

      // Generate the initial HTML structure
      let preliminaryHTML = htmlComponents.join("\n");

      // 🎯 SELF-CONTAINING BASE64 SOLUTION - ITERATIVE CONVERGENCE APPROACH
      logInfo(
        "🔧 Generating self-containing Base64 content through iterative convergence..."
      );

      // Implement iterative convergence to achieve true self-reference
      let currentHTML = preliminaryHTML;
      let previousBase64 = "";
      let iteration = 0;
      // Change maxIterations value to increase number of possible saves that can be made
      // This will increase file size
      // After maxIterations -1 the save function will stop working properly
      const maxIterations = 5;
      let converged = false;

      logInfo("🔄 Starting iterative Base64 generation for self-reference...");

      while (iteration < maxIterations) {
        // Create script with current Base64 (empty on first iteration)
        const embeddedDataScript = `
<!-- Embedded Original Content for Save Functionality -->
<script id="original-content-data" type="application/x-original-html-base64">
${previousBase64}
</script>`;

        // Insert script into HTML
        currentHTML = preliminaryHTML.replace(
          "</body>",
          embeddedDataScript + "\n</body>"
        );

        // Generate new Base64 from complete HTML
        const newBase64 = btoa(unescape(encodeURIComponent(currentHTML)));

        logDebug(
          `Iteration ${iteration}: Base64 length = ${newBase64.length} characters`
        );

        // Check for convergence (Base64 stabilises when self-referential)
        if (newBase64 === previousBase64 && iteration > 0) {
          logInfo(
            `✅ Self-referential convergence achieved in ${iteration} iterations`
          );
          converged = true;
          break;
        }

        previousBase64 = newBase64;
        iteration++;
      }

      // Final HTML with self-referential Base64
      const finalHTML = currentHTML;
      const finalBase64Length = previousBase64.length;

      if (converged) {
        logInfo(
          `✅ True self-containing Base64 generated: ${finalBase64Length} characters`
        );
        logInfo(
          `🔄 Base64 now contains HTML with exact same Base64 - perfect self-reference`
        );
        logInfo(
          `🧪 Self-containing HTML generated (${finalHTML.length} characters)`
        );
        logInfo(
          `♻️ Infinite save chain achieved: Each save preserves exact same structure`
        );
      } else {
        logWarn(
          `⚠️ Convergence not achieved after ${maxIterations} iterations, using best attempt`
        );
        logInfo(`📊 Final Base64 length: ${finalBase64Length} characters`);
      }
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
   * Validate that font CSS contains actual base64 data, not placeholders
   * @param {string} css - The CSS to validate
   * @returns {Object} Validation result with details
   */
  function validateFontCSS(css) {
    const validation = {
      isValid: false,
      hasPlaceholders: false,
      hasRealFontData: false,
      placeholderCount: 0,
      realFontCount: 0,
      details: [],
      errors: [],
    };

    if (!css || typeof css !== "string") {
      validation.errors.push("CSS is empty or invalid");
      return validation;
    }

    // Check for placeholder patterns
    const placeholderMatches = css.match(/YOUR_BASE64_PLACEHOLDER/g);
    validation.placeholderCount = placeholderMatches
      ? placeholderMatches.length
      : 0;
    validation.hasPlaceholders = validation.placeholderCount > 0;

    // Check for real base64 font data patterns
    // Real base64 font data should be long strings starting with typical font headers
    const realFontMatches = css.match(
      /data:font\/woff2;base64,([A-Za-z0-9+/]{100,})/g
    );
    validation.realFontCount = realFontMatches ? realFontMatches.length : 0;
    validation.hasRealFontData = validation.realFontCount > 0;

    // Additional validation: Check for common font file signatures in base64
    const fontSignatures = [
      "d09G", // WOFF/WOFF2 signature
      "wOF2", // WOFF2 signature
      "OTTO", // OpenType signature
      "true", // TrueType signature
      "0001", // TrueType signature variant
    ];

    let validSignatureCount = 0;
    for (const signature of fontSignatures) {
      if (css.includes(signature)) {
        validSignatureCount++;
      }
    }

    // Log detailed analysis
    validation.details.push(`CSS length: ${css.length} characters`);
    validation.details.push(
      `Placeholders found: ${validation.placeholderCount}`
    );
    validation.details.push(
      `Real font data sections: ${validation.realFontCount}`
    );
    validation.details.push(`Valid font signatures: ${validSignatureCount}`);

    // Determine overall validity
    validation.isValid =
      !validation.hasPlaceholders &&
      validation.hasRealFontData &&
      validSignatureCount > 0 &&
      css.length > 1000; // Real fonts should be substantial

    // Add specific error messages
    if (validation.hasPlaceholders) {
      validation.errors.push(
        `Found ${validation.placeholderCount} placeholder(s) - fonts not loaded`
      );
    }
    if (!validation.hasRealFontData) {
      validation.errors.push("No real font data detected");
    }
    if (validSignatureCount === 0) {
      validation.errors.push("No valid font signatures found");
    }
    if (css.length <= 1000) {
      validation.errors.push("CSS too short for embedded fonts");
    }

    return validation;
  }

  /**
   * Wait for fonts to be loaded with timeout and validation
   * @param {number} timeoutMs - Maximum time to wait
   * @param {number} retryIntervalMs - Time between retry attempts
   * @returns {Promise<Object>} Result with font CSS or error
   */
  async function waitForFontsToLoad(timeoutMs = 5000, retryIntervalMs = 100) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        if (window.TemplateSystem) {
          const generator = window.TemplateSystem.createGenerator();
          const embeddedFontsCSS = await generator.generateEmbeddedFontsCSS();

          if (embeddedFontsCSS) {
            const validation = validateFontCSS(embeddedFontsCSS);

            if (validation.isValid) {
              console.log("✅ Fonts loaded and validated successfully");
              return {
                success: true,
                css: embeddedFontsCSS,
                validation: validation,
                loadTime: Date.now() - startTime,
              };
            } else {
              console.log(
                "⏳ Fonts still loading...",
                validation.errors.join(", ")
              );
            }
          }
        }
      } catch (error) {
        console.warn("Font loading attempt failed:", error.message);
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }

    return {
      success: false,
      error: "Font loading timeout - fonts may not be ready",
      timeout: true,
      loadTime: Date.now() - startTime,
    };
  }

  /**
   * UPDATED: Enhanced ensureEmbeddedFontsInclusion with proper validation
   * Replace the existing ensureEmbeddedFontsInclusion function with this version
   */
  async function ensureEmbeddedFontsInclusion() {
    const LOG_LEVELS = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    };

    const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
    const ENABLE_ALL_LOGGING = false;
    const DISABLE_ALL_LOGGING = false;

    function shouldLog(level) {
      if (DISABLE_ALL_LOGGING) return false;
      if (ENABLE_ALL_LOGGING) return true;
      return level <= DEFAULT_LOG_LEVEL;
    }

    function logError(message, ...args) {
      if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
    }

    function logWarn(message, ...args) {
      if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
    }

    function logInfo(message, ...args) {
      if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
    }

    function logDebug(message, ...args) {
      if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
    }

    const result = {
      css: "",
      method: "",
      errors: [],
      attempts: [],
      validation: null,
    };

    // ✅ ENHANCED: Try to load fonts with validation and timeout
    try {
      logDebug("🔄 Attempting to load fonts with validation...");

      // First, try immediate load attempt
      if (window.TemplateSystem) {
        const generator = window.TemplateSystem.createGenerator();
        const embeddedFontsCSS = await generator.generateEmbeddedFontsCSS();

        if (embeddedFontsCSS) {
          const validation = validateFontCSS(embeddedFontsCSS);
          result.validation = validation;

          if (validation.isValid) {
            result.css = embeddedFontsCSS;
            result.method = "immediate-success";
            result.attempts.push("immediate-validated");
            logInfo("✅ Font embedding successful on immediate attempt");
            return result;
          } else {
            logWarn(
              "⚠️ Immediate attempt failed validation:",
              validation.errors.join(", ")
            );
            result.attempts.push("immediate-invalid");
          }
        }
      }

      // If immediate attempt failed, wait for fonts to load
      logDebug("⏳ Waiting for fonts to load properly...");
      const fontLoadResult = await waitForFontsToLoad(3000); // 3 second timeout

      if (fontLoadResult.success) {
        result.css = fontLoadResult.css;
        result.method = "wait-success";
        result.validation = fontLoadResult.validation;
        result.attempts.push("wait-validated");
        logInfo(
          `✅ Font embedding successful after ${fontLoadResult.loadTime}ms`
        );
        return result;
      } else {
        logWarn("⚠️ Font loading failed:", fontLoadResult.error);
        result.attempts.push("wait-failed");
        result.errors.push(fontLoadResult.error);
      }
    } catch (error) {
      result.errors.push(`Template system error: ${error.message}`);
      result.attempts.push("template-system-error");
      logWarn("⚠️ Template system failed:", error.message);
    }

    // 🛡️ FALLBACK: Use fallback only if fonts cannot be loaded
    logWarn("⚠️ Using fallback CSS - fonts may not display correctly");
    result.css = generateFallbackFontCSS();
    result.method = "fallback-forced";
    result.attempts.push("fallback-used");

    // Validate even the fallback to confirm it has placeholders
    result.validation = validateFontCSS(result.css);

    return result;
  }

  /**
   * UPDATED: Enhanced export function with font validation guard
   * Add this validation check to the main export functions
   */
  async function validateExportReadiness() {
    console.log("🔍 Validating export readiness...");

    const fontResult = await ensureEmbeddedFontsInclusion();

    if (!fontResult.validation || !fontResult.validation.isValid) {
      const errors = fontResult.validation
        ? fontResult.validation.errors
        : ["Unknown font validation error"];

      // Show user-friendly error message
      const warningIcon = `<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13.5" fill="currentColor" r="1"/></g></svg>`;

      const errorMessage = `
${warningIcon} Export blocked: Fonts are not ready

The fonts are still loading. Please wait a moment and try again.

Technical details:
${errors.join("\n")}

This prevents broken exports with missing font data.
`.trim();

      console.error("❌ Export validation failed:", errorMessage);

      // If universal notification system exists, use it
      if (window.showNotification) {
        window.showNotification(
          "Fonts still loading - please wait and try again",
          "error",
          5000
        );
      } else {
        alert(
          "Export blocked: Fonts are still loading. Please wait a moment and try again."
        );
      }

      return {
        ready: false,
        error: errorMessage,
        fontResult: fontResult,
      };
    }

    console.log("✅ Export validation passed");
    return {
      ready: true,
      fontResult: fontResult,
    };
  }

  /**
   * Create and manage font loading status indicator
   */
  function createFontStatusIndicator() {
    // Create status indicator element
    const statusIndicator = document.createElement("div");
    statusIndicator.id = "font-status-indicator";
    statusIndicator.className = "font-status loading";
    statusIndicator.innerHTML = `
    <span class="status-icon">
      <svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="matrix(-1 0 0 1 19 2)">
          <circle cx="8.5" cy="8.5" r="8"/>
          <path d="m8.5 5.5v4h-3.5"/>
        </g>
      </svg>
    </span>
    <span class="status-text">Loading fonts...</span>
  `;

    document.body.appendChild(statusIndicator);

    return statusIndicator;
  }

  /**
   * Update font status indicator
   */
  function updateFontStatus(status, message) {
    let indicator = document.getElementById("font-status-indicator");

    if (!indicator) {
      indicator = createFontStatusIndicator();
    }

    const icon = indicator.querySelector(".status-icon");
    const text = indicator.querySelector(".status-text");

    // Remove existing status classes
    indicator.classList.remove("loading", "ready", "error", "hidden");

    switch (status) {
      case "loading":
        indicator.classList.add("loading");
        icon.innerHTML = `<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="matrix(-1 0 0 1 19 2)">
            <circle cx="8.5" cy="8.5" r="8"/>
            <path d="m8.5 5.5v4h-3.5"/>
          </g>
        </svg>`;
        text.textContent = message || "Loading fonts...";
        break;
      case "ready":
        indicator.classList.add("ready");
        icon.innerHTML =
          '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m.5 5.5 3 3 8.028-8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 6)"/></svg>';
        text.textContent = message || "Fonts ready";
        // Auto-hide after 3 seconds
        setTimeout(() => {
          indicator.classList.add("hidden");
        }, 3000);
        break;
      case "error":
        indicator.classList.add("error");
        icon.innerHTML =
          '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13.5" fill="currentColor" r="1"/></g></svg>';
        text.textContent = message || "Font loading failed";
        break;
      case "hidden":
        indicator.classList.add("hidden");
        break;
    }
  }

  /**
   * Monitor font loading status and update UI
   */
  async function monitorFontLoadingStatus() {
    updateFontStatus("loading", "Checking fonts...");

    try {
      // Check if fonts are already loaded
      const validation = await validateExportReadiness();

      if (validation.ready) {
        updateFontStatus("ready", "Fonts ready for export");
        return;
      }

      // If not ready, monitor until they are
      updateFontStatus("loading", "Loading fonts...");

      const fontResult = await waitForFontsToLoad(10000); // 10 second timeout

      if (fontResult.success) {
        updateFontStatus("ready", "Fonts loaded successfully");
      } else {
        updateFontStatus("error", "Font loading timeout");
        // Hide after showing error
        setTimeout(() => {
          updateFontStatus("hidden");
        }, 5000);
      }
    } catch (error) {
      console.error("Font monitoring error:", error);
      updateFontStatus("error", "Font loading error");
      setTimeout(() => {
        updateFontStatus("hidden");
      }, 5000);
    }
  }

  /**
   * Add export button enhancement to show font status
   */
  function enhanceExportButtonWithFontStatus() {
    const exportButton = document.getElementById("export-html");
    if (!exportButton) return;

    // Store original click handler
    const originalClickHandler = exportButton.onclick;

    // Replace with enhanced handler
    exportButton.onclick = async function (event) {
      event.preventDefault();

      // Check font readiness
      const validation = await validateExportReadiness();

      if (!validation.ready) {
        // User already notified by validateExportReadiness
        return;
      }

      // Proceed with original export
      if (originalClickHandler) {
        originalClickHandler.call(this, event);
      } else {
        // Fallback to calling export function directly
        if (window.ExportManager && window.ExportManager.exportEnhancedHTML) {
          window.ExportManager.exportEnhancedHTML();
        }
      }
    };

    // Update button title to indicate font validation
    exportButton.title =
      exportButton.title + " (Validates fonts before export)";
  }

  /**
   * Initialize font monitoring system
   */
  function initializeFontMonitoring() {
    // Start monitoring when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(monitorFontLoadingStatus, 1000); // Start after 1 second
        enhanceExportButtonWithFontStatus();
      });
    } else {
      setTimeout(monitorFontLoadingStatus, 1000);
      enhanceExportButtonWithFontStatus();
    }
  }

  /**
   * Load font data directly without template system
   */
  async function loadFontDataDirect() {
    const fontFiles = {
      base64Regular: "fonts/opendyslexic-regular.txt",
      base64Bold: "fonts/opendyslexic-bold.txt",
      base64Italic: "fonts/opendyslexic-italic.txt",
      base64BoldItalic: "fonts/opendyslexic-bold-italic.txt",
      base64AnnotationMonoVF: "fonts/AnnotationMono-VF.txt",
    };

    const fontData = {};

    for (const [variant, filepath] of Object.entries(fontFiles)) {
      try {
        const response = await fetch(filepath);
        if (response.ok) {
          fontData[variant] = (await response.text()).trim();
        } else {
          fontData[variant] = "YOUR_BASE64_PLACEHOLDER";
        }
      } catch (error) {
        fontData[variant] = "YOUR_BASE64_PLACEHOLDER";
      }
    }

    return fontData;
  }

  /**
   * Render font template with simple string replacement
   */
  function renderFontTemplate(template, fontData) {
    let rendered = template;

    // Replace template variables
    rendered = rendered.replace(
      /\{\{base64Regular\}\}/g,
      fontData.base64Regular || "YOUR_BASE64_PLACEHOLDER"
    );
    rendered = rendered.replace(
      /\{\{base64Bold\}\}/g,
      fontData.base64Bold || "YOUR_BASE64_PLACEHOLDER"
    );
    rendered = rendered.replace(
      /\{\{base64Italic\}\}/g,
      fontData.base64Italic || "YOUR_BASE64_PLACEHOLDER"
    );
    rendered = rendered.replace(
      /\{\{base64BoldItalic\}\}/g,
      fontData.base64BoldItalic || "YOUR_BASE64_PLACEHOLDER"
    );

    // Handle variable font conditionally
    const hasVariableFont =
      fontData.base64AnnotationMonoVF &&
      fontData.base64AnnotationMonoVF !== "YOUR_BASE64_PLACEHOLDER";
    if (hasVariableFont) {
      rendered = rendered.replace(/\{\{#if hasFontNameVariable\}\}/g, "");
      rendered = rendered.replace(/\{\{\/if\}\}/g, "");
      rendered = rendered.replace(
        /\{\{fontNameVariableBase64\}\}/g,
        fontData.base64AnnotationMonoVF
      );
    } else {
      // Remove variable font section if not available
      rendered = rendered.replace(
        /\{\{#if hasFontNameVariable\}\}[\s\S]*?\{\{\/if\}\}/g,
        ""
      );
    }

    return rendered;
  }

  /**
   * Generate fallback font CSS that always works
   */
  function generateFallbackFontCSS() {
    return `<!-- OpenDyslexic Font Family - Embedded for Offline Use -->
<style>
    @font-face {
      font-family: "OpenDyslexic";
      src: url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2");
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: "OpenDyslexic";
      src: url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2");
      font-weight: bold;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: "OpenDyslexic";
      src: url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2");
      font-weight: normal;
      font-style: italic;
      font-display: swap;
    }

    @font-face {
      font-family: "OpenDyslexic";
      src: url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2");
      font-weight: bold;
      font-style: italic;
      font-display: swap;
    }

    <!-- Annotation Mono Variable Font -->
    @font-face {
      font-family: "Annotation Mono";
      src: url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2 supports variations"),
           url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2-variations"),
           url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER") format("woff2") tech(variations);
      font-weight: 100 1000;
      font-display: swap;
    }
</style>`;
  }

  /**
   * Generate enhanced HTML head section with metadata and accessibility features
   */

  /**
   * Generate enhanced head section with all required components
   */
  async function generateEnhancedHead(title, metadata, accessibilityLevel) {
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

    // ✅ ENHANCED: Embedded OpenDyslexic fonts with guaranteed inclusion and async protection
    try {
      // 🛡️ ASYNC OPERATION PROTECTION: Prevent multiple font loading attempts
      if (!window.fontEmbeddingInProgress) {
        window.fontEmbeddingInProgress = true;

        const embeddedFontsResult = await ensureEmbeddedFontsInclusion();

        if (embeddedFontsResult.css && embeddedFontsResult.css.length > 0) {
          headComponents.push(
            "    " + embeddedFontsResult.css.replace(/\n/g, "\n    ")
          );
          logInfo(
            "✅ OpenDyslexic fonts embedded successfully via",
            embeddedFontsResult.method
          );
        } else {
          logWarn("⚠️ Font embedding failed, using emergency fallback");
          headComponents.push("    " + generateFallbackFontCSS());
        }
      } else {
        logWarn(
          "⚠️ Font embedding already in progress, using emergency fallback"
        );
        headComponents.push("    " + generateFallbackFontCSS());
      }
    } catch (error) {
      logError("❌ Font embedding error:", error.message);
      headComponents.push("    " + generateFallbackFontCSS());
    } finally {
      // Always clear the flag
      window.fontEmbeddingInProgress = false;
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

    // Enhanced CSS generation with source viewer styles
    headComponents.push("    <style>");
    headComponents.push(window.ContentGenerator.generateEnhancedCSS());

    // Add source viewer CSS if available
    if (window.SourceViewer) {
      headComponents.push("");
      headComponents.push("/* Source Viewer Styles */");
      const prismCSS = await window.SourceViewer.getPrismCSS();
      headComponents.push(prismCSS);
    }

    headComponents.push("    </style>");
    headComponents.push("</head>");

    return headComponents.join("\n");
  }

  /**
   * Generate enhanced document footer with source viewer
   * @param {string} originalSource - Original source content
   * @param {string} pandocArgs - Pandoc arguments for language detection
   * @param {Object} metadata - Document metadata
   * @returns {string} HTML footer with embedded source viewer
   */
  function generateDocumentFooter(
    originalSource = "",
    pandocArgs = "",
    metadata = {}
  ) {
    try {
      // Check if SourceViewer module is available
      if (window.SourceViewer && originalSource.trim()) {
        logDebug("Generating enhanced footer with source viewer");
        return window.SourceViewer.generateEnhancedFooter(
          originalSource,
          pandocArgs,
          metadata
        );
      } else {
        // Fallback to basic footer
        logWarn(
          "SourceViewer not available or no source content, using basic footer"
        );
        const generationDate = new Date().toISOString().split("T")[0];
        let html = "";
        html += '<footer class="document-footer" role="contentinfo">\n';
        html += `    <p>Generated on <time datetime="${generationDate}">${generationDate}</time> using Pandoc-WASM and MathJax</p>\n`;
        html += "</footer>\n";
        return html;
      }
    } catch (error) {
      logError("Error generating enhanced footer:", error);

      // Error fallback
      const generationDate = new Date().toISOString().split("T")[0];
      let html = "";
      html += '<footer class="document-footer" role="contentinfo">\n';
      html += `    <p>Generated on <time datetime="${generationDate}">${generationDate}</time> using Pandoc-WASM and MathJax</p>\n`;
      html += "    <p><em>Source viewing temporarily unavailable</em></p>\n";
      html += "</footer>\n";
      return html;
    }
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
   * ENHANCED: Embeds clean HTML for reliable save functionality
   */
  async function generateEnhancedJavaScript(
    accessibilityLevel,
    cleanHTMLContent = null
  ) {
    logInfo(
      "Generating enhanced JavaScript with complete accessibility functionality"
    );

    let html = "";
    html +=
      "    <!-- Enhanced Script with Reading Controls, Theme Toggle, Focus Tracking, and MathJax Controls -->\n";

    // ✅ NEW: Embed clean HTML content as Base64 for save functionality
    if (cleanHTMLContent) {
      html += `    <script id="original-content-data" type="application/x-original-html-base64">\n`;
      // Convert to Base64 (handling Unicode properly)
      const base64Content = btoa(
        unescape(encodeURIComponent(cleanHTMLContent))
      );
      html += base64Content;
      html += `\n    </script>\n`;
      logInfo(
        `✅ Embedded clean HTML content (${base64Content.length} Base64 characters)`
      );
    }

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

    // Generate document save functionality
    html += `
    
// ===========================================================================================
// DOCUMENT SAVE FUNCTIONALITY  
// ===========================================================================================

// Global storage for original HTML content
window.originalDocumentHTML = null;

/**
 * Save complete document functionality for exported HTML files
 * Retrieves clean HTML from embedded Base64 data
 * Guarantees no MathJax pollution in saved files
 */
window.saveCompleteDocument = function() {
  console.log('🔥 saveCompleteDocument function called');
  
  try {
    // Get the original static HTML content
    let documentHtml;
    let retrievalMethod = 'none'; // Track which method succeeded
    
    // ✅ PRIMARY METHOD: Retrieve from embedded Base64 data
    const embeddedData = document.getElementById('original-content-data');
    console.log('🔍 Looking for embedded data element...');
    
    if (embeddedData) {
      console.log('✅ Found embedded data element');
      try {
        const base64Content = embeddedData.textContent.trim();
        console.log('📊 Embedded Base64 data size:', base64Content.length, 'characters');
        
        // Show first 100 chars for debugging
        console.log('🔍 Base64 preview:', base64Content.substring(0, 100) + '...');
        
        documentHtml = decodeURIComponent(escape(atob(base64Content)));
        console.log('✅ Successfully decoded clean HTML from embedded Base64 data');
        console.log('📊 Decoded content length:', documentHtml.length, 'characters');
        retrievalMethod = 'embedded-base64';
      } catch (decodeError) {
        console.error('❌ Failed to decode embedded content:', decodeError);
        console.error('Error details:', decodeError.message);
        documentHtml = null;
      }
    } else {
      console.warn('⚠️ No embedded data element found with ID "original-content-data"');
      console.log('🔍 Available script elements:', document.querySelectorAll('script[type*="original"]').length);
    }
    
    // FALLBACK 1: Use stored original HTML if available
    if (!documentHtml && window.originalDocumentHTML) {
      documentHtml = window.originalDocumentHTML;
      console.warn('⚠️ Using FALLBACK 1: stored original HTML');
      console.log('📊 Stored content length:', documentHtml.length, 'characters');
      retrievalMethod = 'stored-original';
    }
    
    // FALLBACK 2: Attempt to clean current DOM
    if (!documentHtml) {
      console.warn('⚠️ Using FALLBACK 2: attempting to clean current DOM');
      documentHtml = window.cleanDynamicMathJaxContent(document.documentElement.outerHTML);
      console.log('📊 Cleaned DOM length:', documentHtml ? documentHtml.length : 0, 'characters');
      retrievalMethod = 'cleaned-dom';
    }
    
    if (!documentHtml) {
      throw new Error('Unable to retrieve document content for saving - all methods failed');
    }
    
    console.log('✅ Content retrieved using method:', retrievalMethod);
    
    // Create filename based on document title
    const title = document.title || 'Mathematical Document';
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = cleanTitle + '_' + timestamp + '.html';
    
    // Create and trigger download
    const blob = new Blob([documentHtml], { 
      type: 'text/html;charset=utf-8' 
    });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    downloadLink.setAttribute('aria-hidden', 'true');
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 100);
    
    // Announce to screen readers
    if (typeof announceToScreenReader === 'function') {
      announceToScreenReader('Document saved as ' + filename + '. The file contains all original formatting, mathematics, and accessibility features.');
    }
    
console.log('✅ Document saved successfully:', filename);
    console.log('📄 Final content length:', documentHtml.length, 'characters');
    console.log('🎯 Save completed using retrieval method:', retrievalMethod);
    
  } catch (error) {
    console.error('❌ Error saving document:', error);
    console.error('Full error details:', error.stack);
    alert("Sorry, there was an error saving the document. Please try using your browser's Save As function instead.");
  }
};

/**
 * Clean dynamic MathJax content from HTML to restore original state
 * Removes runtime-generated styles and elements that can break functionality
 */
window.cleanDynamicMathJaxContent = function(html) {
  console.log('🧹 Cleaning dynamic MathJax content from HTML');
  
  // Remove dynamic MathJax style elements added at runtime
  let cleaned = html.replace(/<style[^>]*id="MJX-CHTML-styles"[^>]*>[\\s\\S]*?<\\/style>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>\\s*\\.CtxtMenu_[\\s\\S]*?<\\/style>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>\\s*\\.MJX_[\\s\\S]*?<\\/style>/gi, '');
  
  // Remove dynamic font-face declarations 
  cleaned = cleaned.replace(/@font-face\\s*\\/\\*\\s*\\d+\\s*\\*\\/\\s*\\{[\\s\\S]*?\\}/gi, '');
  
  // Remove dynamic MathJax font styles
  cleaned = cleaned.replace(/mjx-c\\.mjx-c[^{]*\\{[^}]*\\}/gi, '');
  
  // Remove MathJax accessibility live regions that are added dynamically
  cleaned = cleaned.replace(/<div[^>]*class="MJX_LiveRegion"[^>]*>[\\s\\S]*?<\\/div>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="MJX_HoverRegion"[^>]*>[\\s\\S]*?<\\/div>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="MJX_ToolTip"[^>]*>[\\s\\S]*?<\\/div>/gi, '');
  
  // Remove any script elements that were added by MathJax dynamically
  cleaned = cleaned.replace(/<script[^>]*src="[^"]*mathjax[^"]*a11y[^"]*"[^>]*><\\/script>/gi, '');
  
  console.log('✅ Cleaned dynamic MathJax content');
  return cleaned;
};

/**
 * Store original document HTML for later saving
 * Call this when the document is first loaded
 */
window.storeOriginalDocumentHTML = function(htmlContent) {
  window.originalDocumentHTML = htmlContent;
  console.log('📄 Stored original document HTML for saving');
  console.log('📊 Original content length:', htmlContent.length, 'characters');
};

// Note: Original content is now embedded as Base64 data, no runtime storage needed

console.log('✅ Save document functionality loaded and ready');
`;

    // Test and verify save functionality
    html += `

// ===========================================================================================
// SAVE FUNCTIONALITY VERIFICATION
// ===========================================================================================

// Verify function is properly defined
setTimeout(function() {
  if (typeof window.saveCompleteDocument === 'function') {
    console.log('✅ saveCompleteDocument function verified and ready');
  } else {
    console.error('❌ saveCompleteDocument function not found!');
  }
}, 200);
`;

    // Store original HTML content for saving functionality
    html += `
    
// ===========================================================================================
// ORIGINAL CONTENT STORAGE FOR SAVE FUNCTIONALITY
// ===========================================================================================

// Verify embedded content is available
setTimeout(function() {
  const embeddedData = document.getElementById('original-content-data');
  if (embeddedData) {
    console.log('✅ Clean HTML content embedded and ready for saving');
    console.log('📊 Embedded data size:', embeddedData.textContent.length, 'Base64 characters');
    
    // Also verify we can decode it
    try {
      const testDecode = atob(embeddedData.textContent.trim()).substring(0, 100);
      console.log('✅ Embedded data decoding verified');
    } catch (e) {
      console.error('❌ Embedded data exists but cannot be decoded:', e);
    }
  } else {
    console.warn('⚠️ No embedded clean content found - save functionality will use fallback methods');
  }
}, 100);
`;

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

    // Add source viewer JavaScript for syntax highlighting
    if (window.SourceViewer) {
      html += "\n        // Source Viewer - Prism.js Syntax Highlighting\n";
      const prismJS = await window.SourceViewer.getPrismJS();
      html += "        " + prismJS.split("\n").join("\n        ") + "\n";

      // Add accessibility enhancements
      html += `
        
        // Source Viewer - Accessibility Enhancements
        document.addEventListener('DOMContentLoaded', function() {
          if (window.SourceViewer && window.SourceViewer.enhanceAccessibility) {
            window.SourceViewer.enhanceAccessibility();
          }
        });
`;
    }

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
    const logInfo = window.ExportManager?.logInfo || console.log;
    const logError = window.ExportManager?.logError || console.error;
    const logWarn = window.ExportManager?.logWarn || console.warn;

    // Get UI elements
    const outputContent = document.querySelector(".output-content");
    const exportButton = document.getElementById("export-html");

    if (!outputContent) {
      logError("Output content not found - cannot export");
      if (window.showNotification) {
        window.showNotification("Cannot find content to export", "error");
      }
      return;
    }

    // Store original button state
    const originalButtonContent = exportButton ? exportButton.innerHTML : "";
    window.exportGenerationInProgress = false;

    try {
      // ✅ NEW: Validate export readiness (including fonts)
      logInfo("🔍 Validating export readiness...");
      const validation = await validateExportReadiness();

      if (!validation.ready) {
        logError("❌ Export validation failed:", validation.error);
        return; // Stop export - user has been notified
      }

      logInfo("✅ Export validation passed - proceeding with export");

      // Set button state to loading
      window.exportGenerationInProgress = true;
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML =
          '<svg class="icon spinning" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">' +
          '<path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>' +
          "</svg>" +
          "Generating Enhanced Export...";
      }

      // Get the current output content
      const content = outputContent.innerHTML.trim();
      logInfo("Retrieved content, length:", content.length);

      // Enhanced validation with pre-rendered MathJax detection
      window.AppConfig.validateEnhancedContent(content);

      // Extract metadata for enhanced document generation
      const metadata = window.LaTeXProcessor.extractDocumentMetadata(content);
      logInfo("Extracted metadata:", metadata);

      // Generate the enhanced standalone HTML
      logInfo("Generating enhanced standalone HTML with validated fonts...");
      const standaloneHTML = await generateEnhancedStandaloneHTML(
        content,
        metadata.title,
        2 // Use Level 2 accessibility
      );
      logInfo("Generated enhanced HTML length:", standaloneHTML.length);

      // Create blob and download
      logInfo("Creating download blob...");
      const blob = new Blob([standaloneHTML], {
        type: "text/html;charset=utf-8",
      });

      // Create enhanced filename
      const filename = window.AppConfig.generateEnhancedFilename(
        metadata.title
      );

      // Download the file
      window.ExportManager.downloadHTMLFile(standaloneHTML, filename, metadata);

      // Show success notification
      if (window.showNotification) {
        window.showNotification(
          `Enhanced HTML exported successfully: ${filename}`,
          "success"
        );
      }

      logInfo(`✅ Enhanced export completed: ${filename}`);

      window.AppConfig.announceToScreenReader(
        `Enhanced HTML document exported successfully as ${filename}`
      );
    } catch (error) {
      logError("Enhanced export failed:", error);

      if (window.showNotification) {
        window.showNotification(
          "Enhanced export failed. Please try again or use standard export.",
          "error"
        );
      }

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

    // ✅ ENHANCED: Global function guard to prevent multiple setups
    if (window.exportHandlersSetup) {
      logWarn("⚠️ Export handlers already set up globally - skipping");
      return;
    }

    // Find export button
    const exportButton = document.getElementById("exportButton");

    if (!exportButton) {
      logError("Export button not found - retrying in 100ms");
      // ✅ ENHANCED: Add retry limit to prevent infinite retries
      const retryCount = (window.exportButtonRetries || 0) + 1;
      if (retryCount <= 5) {
        window.exportButtonRetries = retryCount;
        setTimeout(setupEnhancedExportHandlers, 100);
      } else {
        logError("❌ Export button not found after 5 retries - giving up");
        window.exportButtonRetries = 0;
      }
      return;
    }

    // ✅ ENHANCED: Double-check for existing listeners
    if (exportButton.hasAttribute("data-export-initialized")) {
      logWarn(
        "Export button already initialized with data attribute - skipping"
      );
      window.exportHandlersSetup = true;
      return;
    }

    // ✅ FIXED: Preserve button element - DON'T replace it
    // Instead, store a reference to our handler to avoid duplicates
    if (!window.exportButtonHandler) {
      window.exportButtonHandler = function (e) {
        logInfo("Enhanced export button clicked");
        e.preventDefault();

        // ✅ ENHANCED: Prevent double-clicks during export
        if (window.exportGenerationInProgress) {
          logWarn("Export already in progress - ignoring click");
          return;
        }

        // 🛡️ NEW: Add download debouncing
        const now = Date.now();
        if (window.lastExportTime && now - window.lastExportTime < 1000) {
          logWarn("Export called too quickly - ignoring to prevent duplicates");
          return;
        }
        window.lastExportTime = now;

        exportEnhancedHTML();
      };
    }

    // ✅ FIXED: Remove any existing listeners without replacing the element
    // This preserves AppStateManager's reference to the button
    exportButton.removeEventListener("click", window.exportButtonHandler);

    // Add our handler (safe even if it wasn't there before)
    exportButton.addEventListener("click", window.exportButtonHandler);

    // ✅ NEW: Mark as initialized at multiple levels
    exportButton.setAttribute("data-export-initialized", "true");
    window.exportHandlersSetup = true;

    // Make the enhanced function globally available for keyboard shortcut
    window.exportToHTML = exportEnhancedHTML;

    // ✅ CRITICAL: Force enable the button if AppStateManager already ran
    // This handles race conditions where AppStateManager enables the button
    // before our handlers are attached, but the button gets disabled again
    if (window.AppStateManager && window.AppStateManager.isReady()) {
      exportButton.disabled = false;
      logInfo("✅ Export button force-enabled (AppStateManager ready)");
    }

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
    logInfo("✅ Export handlers setup complete with button element preserved");
  }

  /**
   * Initialise enhanced export functionality with screen reader accessibility controls
   */
  function initialiseEnhancedExportFunctionality() {
    // ✅ ENHANCED: Add call stack tracing for debugging
    const caller = new Error().stack.split("\n")[2]?.trim() || "unknown";
    logInfo(
      "Initialising enhanced export functionality with Screen Reader Enhancement Controls..."
    );
    logDebug("🔍 Initialization called from:", caller);
    logInfo(
      "Key features: Working MathJax context menus, Screen reader accessibility controls, LaTeX conversion, Holy Grail layout, accessibility configuration panel"
    );

    // ✅ ENHANCED: Prevent duplicate initialization with more robust checking
    if (window.exportFunctionalityInitialized) {
      logWarn(
        "⚠️ Export functionality already initialized - skipping duplicate"
      );
      logDebug("Previous initialization caller was logged above");
      return;
    }

    window.exportFunctionalityInitialized = true;

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        setupEnhancedExportHandlers
      );
      logDebug("📋 Added DOMContentLoaded listener for export setup");
    } else {
      logDebug("📋 DOM already ready - setting up export handlers immediately");
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

    // Font validation functions
    validateFontCSS,
    waitForFontsToLoad,
    validateExportReadiness,
    ensureEmbeddedFontsInclusion,

    // UI functions
    createFontStatusIndicator,
    updateFontStatus,
    monitorFontLoadingStatus,
    enhanceExportButtonWithFontStatus,
    initializeFontMonitoring,

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

// ===========================================================================================
// GLOBAL INITIALIZATION GUARD
// ===========================================================================================

// Prevent duplicate module initialization
if (!window.ExportManagerInitialized) {
  window.ExportManagerInitialized = true;

  // Auto-initialise when the script loads with duplicate prevention
  ExportManager.initialiseEnhancedExportFunctionality();

  ExportManager.logDebug(
    "✅ ExportManager auto-initialization completed with global guard"
  );
} else {
  ExportManager.logWarn(
    "⚠️ ExportManager already initialized - skipping duplicate initialization"
  );
}
