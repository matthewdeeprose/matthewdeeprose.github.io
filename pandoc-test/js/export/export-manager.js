// export-manager.js
// Export Orchestrator - Coordinates all export modules for enhanced HTML generation
//
// Delegates to:
//   - HeadGenerator (head-generator.js) - HTML head with metadata and CSS
//   - BodyGenerator (body-generator.js) - Document body structure and content
//   - FooterGenerator (footer-generator.js) - Document footer with scripts
//   - ContentGenerator (content-generator.js) - CSS generation and content enhancement
//   - TemplateSystem (template-system.js) - Template loading and processing
//   - MathJaxManager (mathjax-manager.js) - MathJax configuration and integration
//   - LaTeXProcessor (latex-processor.js) - LaTeX metadata extraction
//
// Stage 1 Status: In Progress
//   - Architecture: Pure delegation orchestrator
//   - Code organisation: Adding comprehensive section headers
//   - Error handling: Consistent [EXPORT] prefix pattern
//   - Documentation: Adding complete JSDoc with delegation info
//   - Test status: Baseline to be established

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
  // EXPORT CONVERGENCE CONFIGURATION
  // ===========================================================================================
  // Controls the Base64 self-referencing convergence iterations for save functionality.
  //
  // USE_LEGACY_CONVERGENCE = false (default):
  //   All exports use 2 iterations — works reliably for both image and non-image documents.
  //   Produces smaller files, avoids btoa() failures on large documents, and supports
  //   infinite save chains. Recommended setting.
  //
  // USE_LEGACY_CONVERGENCE = true:
  //   Non-image exports use 5 iterations (original behaviour), image exports use 2.
  //   May produce marginally tighter self-referencing for small non-image documents,
  //   but risks btoa() failure on larger documents. Use only if issues found with
  //   the 2-iteration approach for non-image exports.

  const USE_LEGACY_CONVERGENCE = false;

  // ===========================================================================================
  // PANDOC ARGUMENT CAPTURE SYSTEM
  // ===========================================================================================
  // Captures the exact Pandoc arguments used in frontend conversion to ensure export
  // uses identical settings. Critical for preventing align environment breakage and
  // maintaining LaTeX consistency between UI and exports.

  /**
   * Capture the actual Pandoc arguments currently being used in frontend conversion.
   *
   * Retrieves arguments from the UI arguments input field and stores them globally
   * for later use during export. This ensures that exports use EXACTLY the same
   * Pandoc conversion settings as the frontend, preventing discrepancies in LaTeX
   * interpretation (especially for complex environments like align, cases, etc.).
   *
   * Critical for Stage 1 of export quality enhancement - ensures unified pipeline.
   *
   * @returns {string} The current Pandoc arguments string
   */
  function captureFrontendPandocArgs() {
    try {
      const argumentsInput = document.getElementById("arguments");
      const actualArgs =
        argumentsInput?.value || "--from latex --to html5 --mathjax";

      // Store globally for export use
      window.lastUsedPandocArgs = actualArgs;

      logInfo(`📋 Captured frontend Pandoc arguments: ${actualArgs}`);
      logDebug("Stored in window.lastUsedPandocArgs for export use");

      return actualArgs;
    } catch (error) {
      logError("Error capturing Pandoc arguments:", error);
      // Return safe default
      return "--from latex --to html5 --mathjax";
    }
  }

  /**
   * Get the last captured Pandoc arguments, with fallback to current UI state.
   *
   * Attempts to retrieve the stored Pandoc arguments from the last conversion.
   * If not available (e.g., page just loaded), falls back to reading current
   * UI arguments input. Ensures exports always have valid arguments to use.
   *
   * @returns {string} Pandoc arguments to use for export conversion
   */
  function getStoredPandocArgs() {
    // First try stored args from last conversion
    if (window.lastUsedPandocArgs) {
      logInfo(`✅ Using stored Pandoc args: ${window.lastUsedPandocArgs}`);
      return window.lastUsedPandocArgs;
    }

    // Fallback to current UI state
    const argumentsInput = document.getElementById("arguments");
    const currentArgs =
      argumentsInput?.value || "--from latex --to html5 --mathjax";

    logWarn(`⚠️ No stored args found, using current UI state: ${currentArgs}`);
    return currentArgs;
  }

  // ============================================================================
  // ENHANCED PANDOC EXPORT INTEGRATION
  // ============================================================================
  // Handles enhanced Pandoc conversion with semantic HTML structure
  // Primary delegation: ConversionEngine for Pandoc operations
  // Uses enhanced Pandoc arguments for improved document semantics

  /**
   * Export document using enhanced Pandoc arguments for improved semantic structure.
   * Delegates to: ConversionEngine for Pandoc conversion with enhanced arguments
   * Delegates to: LaTeXProcessor for metadata extraction
   * Delegates to: AppConfig for validation, filename generation, and screen reader announcements
   * Uses current rendered content and re-converts with enhanced Pandoc arguments
   * for better semantic HTML. Falls back to current content if re-conversion fails.
   * Generates single standalone HTML file with embedded resources.
   * @returns {Promise<void>} Completes when export is finished or error handled
   */
  async function exportWithEnhancedPandoc() {
    // DEPRECATED: This function is superseded by exportEnhancedHTML()
    // Log caller information to identify source of unexpected calls
    const stack = new Error().stack;
    logWarn("DEPRECATED exportWithEnhancedPandoc() called!");
    logWarn("Call stack:", stack);
    logWarn(
      "This function should not be used - use exportEnhancedHTML() instead"
    );

    // Prevent execution to avoid duplicate exports
    alert(
      "This export method is deprecated. Please refresh the page and try again."
    );
    return;

    // DEAD CODE BELOW - Kept for reference only
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
        throw new Error(
          `[EXPORT] Missing dependencies: ${missingDeps.join(", ")}`
        );
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

      // === CONTENT RETRIEVAL ===
      // Get the CURRENT rendered content (same as standard export)
      const currentContent = outputContent.innerHTML.trim();
      logInfo("Retrieved current content, length:", currentContent.length);

      // Enhanced validation with pre-rendered MathJax detection
      window.AppConfig.validateEnhancedContent(currentContent);

      // === ENHANCED CONVERSION ===
      // For enhanced export, we'll convert the rendered content to LaTeX,
      // then re-convert with enhanced Pandoc args to get better semantic structure
      if (window.ConversionEngine && inputTextarea?.value?.trim()) {
        logInfo(
          "🧪 Re-converting with enhanced Pandoc arguments for better semantic HTML..."
        );

        // ✅ STAGE 1.1: Use EXACT frontend arguments for unified pipeline
        // Get the stored arguments from last frontend conversion
        const frontendArgs = getStoredPandocArgs();

        logInfo(
          `✅ Using unified Pandoc arguments (same as frontend): ${frontendArgs}`
        );
        logInfo("📊 This ensures export LaTeX matches UI LaTeX exactly");

        // ❌ REMOVED: Enhanced argument generation (caused align environment breakage)
        // const enhancedArgs = window.ConversionEngine.generateEnhancedPandocArgs(baseArgs);

        // Re-convert the original LaTeX with SAME arguments as frontend
        const enhancedHTML = window.ConversionEngine.pandocFunction(
          frontendArgs,
          inputTextarea.value
        );

        if (enhancedHTML && enhancedHTML.trim() !== "") {
          // Clean the enhanced output
          const cleanedHTML =
            window.ConversionEngine.cleanPandocOutput(enhancedHTML);

          // Get metadata from the enhanced content
          const metadata =
            window.LaTeXProcessor.extractDocumentMetadata(cleanedHTML);

          // ✅ STAGE 1.1: Verification logging
          logInfo("📊 Export conversion verification:");
          logInfo(`  - Frontend args used: ${frontendArgs}`);
          logInfo(`  - Generated HTML length: ${cleanedHTML.length} chars`);
          logInfo(`  - Document title: ${metadata.title || "untitled"}`);
          logDebug(
            "Unified pipeline ensures frontend and export use identical Pandoc settings"
          );

          // === EXPORT GENERATION ===
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

      // === FALLBACK HANDLING ===
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
   * Get user-configured Pandoc arguments from UI elements.
   * Delegates to: ConversionEngine for enhancement preset application
   * Reads configuration from DOM elements: arguments input, export-enhanced-pandoc checkbox,
   * pandoc-enhancement-preset select, and custom-pandoc-args textarea.
   * Respects enhancement presets, custom arguments, and export settings.
   * @returns {string} Complete Pandoc arguments string for conversion
   */
  function getUserConfiguredPandocArgs() {
    // Start with base arguments from main input
    const argumentsInput = document.getElementById("arguments");
    let baseArgs =
      argumentsInput?.value || "-s --from latex --to html5 --mathjax";

    // Check if enhanced export is enabled
    const exportEnhanced = document.getElementById(
      "export-enhanced-pandoc"
    )?.checked;

    if (exportEnhanced) {
      // Apply enhancement preset if selected
      const preset = document.getElementById(
        "pandoc-enhancement-preset"
      )?.value;

      if (
        preset &&
        preset !== "" &&
        window.ConversionEngine?.generateEnhancedPandocArgs
      ) {
        try {
          logInfo("Applying enhancement preset:", preset);
          baseArgs =
            window.ConversionEngine.generateEnhancedPandocArgs(baseArgs);
        } catch (error) {
          logWarn("Enhancement preset application failed:", error.message);
        }
      }

      // Add custom arguments if provided
      const customArgs = document
        .getElementById("custom-pandoc-args")
        ?.value?.trim();
      if (customArgs) {
        logInfo("Adding custom arguments:", customArgs);
        baseArgs = baseArgs + " " + customArgs;
      }
    }

    return baseArgs;
  }

  /**
   * Validate and create safe Base64 encoded content without line breaks.
   * Delegates to: Base64Handler for Base64 encoding operations and validation
   * Ensures content is properly encoded as valid Base64 string without line breaks
   * or invalid characters that could break data URLs or embedded content.
   * @param {string} content - Content to encode as Base64
   * @returns {string} Clean Base64 encoded content suitable for data URLs
   * @throws {Error} If Base64Handler module not available
   */
  function createSafeBase64(content) {
    if (!window.Base64Handler) {
      throw new Error(
        "[EXPORT] Base64Handler module required for Base64 encoding"
      );
    }
    return window.Base64Handler.createSafeBase64(content);
  }

  // ============================================================================
  // MAIN EXPORT ORCHESTRATION
  // ============================================================================
  // Primary export functions coordinating all generation modules
  // Delegates to: HeadGenerator, BodyGenerator, FooterGenerator, ContentGenerator

  /**
   * Generate complete enhanced standalone HTML document with full feature set.
   * Delegates to: HeadGenerator for HTML head with metadata and embedded CSS
   * Delegates to: BodyGenerator for document body structure and content wrapping
   * Delegates to: FooterGenerator for credits, acknowledgements, and closing elements
   * Delegates to: ContentGenerator for document structure enhancement and CSS generation
   * Delegates to: LaTeXProcessor for metadata extraction and MathJax conversion
   * Delegates to: ConversionEngine for Pandoc operations with user-configured arguments
   * Delegates to: Base64Handler for self-referencing HTML generation with convergence
   * Main orchestration function coordinating all export modules to produce a single
   * self-contained HTML file with embedded resources, accessibility features, and
   * MathJax support. Includes smart content source detection to preserve quality and
   * functionality. Supports infinite save chain through Base64 convergence.
   * @param {string} content - HTML content to export (from output div or processed input)
   * @param {string} title - Document title for metadata and filename generation
   * @param {number} accessibilityLevel - Accessibility feature level (1-3), default 2
   * @returns {Promise<string>} Complete standalone HTML document with embedded resources
   * @throws {Error} If required modules (LaTeXProcessor, ContentGenerator, TemplateSystem, Base64Handler) unavailable
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
      // === FONT VALIDATION ===
      logInfo("Ensuring fonts are loaded for export...");
      const fontResult = await ensureEmbeddedFontsInclusion();
      logInfo("Fonts validated successfully for export");

      // === DEPENDENCY VALIDATION ===
      if (!window.LaTeXProcessor) {
        throw new Error("[EXPORT] LaTeXProcessor module not available");
      }
      if (!window.ContentGenerator) {
        throw new Error("[EXPORT] ContentGenerator module not available");
      }
      if (!window.TemplateSystem) {
        throw new Error("[EXPORT] TemplateSystem module not available");
      }

      // === CONTENT SOURCE OPTIMIZATION ===
      // SMART: Use optimal content source to preserve quality when possible
      const contentSource = getOptimalContentSource();
      logInfo(
        `Export strategy: ${contentSource.type} (quality: ${contentSource.qualityLevel})`
      );

      // ✅ STAGE 1.2: DETAILED TRACKING - Show content sample at start
      logInfo("📊 === EXPORT PIPELINE TRACKING START ===");
      logInfo(`📋 Source type: ${contentSource.type}`);
      logInfo(`📏 Source length: ${contentSource.content.length} chars`);
      logInfo(`🔍 First 200 chars: ${contentSource.content.substring(0, 200)}`);

      // Track specific LaTeX commands
      const trackCommands = ["widecheck", "align", "cases", "widetilde"];
      trackCommands.forEach((cmd) => {
        const count = (
          contentSource.content.match(new RegExp(`\\\\${cmd}`, "g")) || []
        ).length;
        if (count > 0) {
          logInfo(`🎯 Found ${count} instances of \\${cmd}`);
        }
      });

      let latexContent;
      let htmlContent;

      // === MATHJAX CONVERSION ===
      // Step 1: Handle MathJax conversion if needed
      if (contentSource.needsConversion) {
        // Convert pre-rendered content for menu functionality
        logInfo(
          "🔧 STEP 1: Converting pre-rendered MathJax for menu attachment"
        );

        // STAGE 6: Use coordinator for intelligent method selection
        if (window.LaTeXProcessorCoordinator) {
          // Use coordinator (tries enhanced, falls back to legacy)
          const processingResult =
            await window.LaTeXProcessorCoordinator.process({
              content: contentSource.content,
            });

          latexContent = processingResult.content;

          logInfo(`✅ Used ${processingResult.metadata.method} export method`);

          // If enhanced method was used, store custom macros for later
          if (
            processingResult.metadata.method === "enhanced" &&
            processingResult.metadata.customMacros
          ) {
            logInfo(
              `Enhanced export: ${processingResult.metadata.macroCount} custom macros found`
            );
            // Store for use in metadata
            window.__customMacrosForExport =
              processingResult.metadata.customMacros;
          }
        } else if (window.LaTeXProcessorLegacy) {
          // Fallback to legacy if coordinator not available
          latexContent = await window.LaTeXProcessorLegacy.process({
            content: contentSource.content,
          });
          logInfo(
            "✅ Used legacy module for LaTeX conversion (coordinator unavailable)"
          );
        } else {
          throw new Error(
            "[EXPORT] No LaTeX processor available. " +
              "Both coordinator and legacy modules missing."
          );
        }

        // ✅ STAGE 1.2: Track after MathJax conversion
        logInfo(`📊 After MathJax conversion: ${latexContent.length} chars`);
        logInfo(`🔍 First 200 chars: ${latexContent.substring(0, 200)}`);
        trackCommands.forEach((cmd) => {
          const count = (
            latexContent.match(new RegExp(`\\\\${cmd}`, "g")) || []
          ).length;
          if (count > 0) {
            logInfo(`🎯 After conversion: ${count} instances of \\${cmd}`);
          }
        });
      } else {
        // Use content directly - no MathJax conversion needed
        logInfo(
          "📝 STEP 1: Using content directly - no MathJax conversion needed"
        );
        latexContent = contentSource.content;
      }

      // === PANDOC CONVERSION ===
      // Step 2: Handle Pandoc conversion if needed
      if (contentSource.needsPandocConversion) {
        logInfo(
          "📝 STEP 2: Running Pandoc conversion for LaTeX structure commands"
        );

        // Run through Pandoc to convert LaTeX commands to HTML
        if (window.ConversionEngine && window.ConversionEngine.pandocFunction) {
          try {
            // Get user's configured arguments from UI
            let pandocArgs = getUserConfiguredPandocArgs();

            logInfo("Using user-configured Pandoc args:", pandocArgs);
            logInfo(
              `📏 Content going into Pandoc: ${latexContent.length} chars`
            );

            htmlContent = await window.ConversionEngine.pandocFunction(
              latexContent,
              pandocArgs.split(" ")
            );

            // ✅ STAGE 1.2: Track after Pandoc
            logInfo(`📊 After Pandoc: ${htmlContent.length} chars`);
            logInfo(`🔍 First 200 chars: ${htmlContent.substring(0, 200)}`);
            trackCommands.forEach((cmd) => {
              const count = (
                htmlContent.match(new RegExp(`\\\\${cmd}`, "g")) || []
              ).length;
              if (count > 0) {
                logInfo(`🎯 After Pandoc: ${count} instances of \\${cmd}`);
              }
            });

            // Clean the output
            if (window.ConversionEngine.cleanPandocOutput) {
              const beforeClean = htmlContent.length;
              htmlContent =
                window.ConversionEngine.cleanPandocOutput(htmlContent);

              logInfo(
                `📊 After cleaning: ${htmlContent.length} chars (was ${beforeClean})`
              );
              trackCommands.forEach((cmd) => {
                const count = (
                  htmlContent.match(new RegExp(`\\\\${cmd}`, "g")) || []
                ).length;
                if (count > 0) {
                  logInfo(`🎯 After cleaning: ${count} instances of \\${cmd}`);
                }
              });
            }

            logInfo("Pandoc conversion completed successfully");
          } catch (error) {
            logError("[EXPORT] Pandoc conversion failed:", error);
            // Fallback to original content
            htmlContent = latexContent;
          }
        } else {
          logWarn("ConversionEngine not available - using content as-is");
          htmlContent = latexContent;
        }
      } else {
        // Content is already processed HTML
        logInfo("📝 STEP 2: Content already processed - using as-is");
        htmlContent = latexContent;

        // ✅ STAGE 1.2: Track the already-processed content
        logInfo(`📊 Already-processed HTML: ${htmlContent.length} chars`);
        trackCommands.forEach((cmd) => {
          const count = (htmlContent.match(new RegExp(`\\\\${cmd}`, "g")) || [])
            .length;
          if (count > 0) {
            logInfo(`🎯 In processed HTML: ${count} instances of \\${cmd}`);
          }
        });
      }

      // ✅ STAGE 1.2: Final content tracking before metadata extraction
      logInfo("📊 === EXPORT PIPELINE TRACKING: BEFORE METADATA ===");
      logInfo(`📏 Final HTML length: ${htmlContent.length} chars`);
      logInfo(`🔍 First 300 chars: ${htmlContent.substring(0, 300)}`);
      trackCommands.forEach((cmd) => {
        const count = (htmlContent.match(new RegExp(`\\\\${cmd}`, "g")) || [])
          .length;
        if (count > 0) {
          logInfo(`🎯 Final check: ${count} instances of \\${cmd}`);
        }
      });
      // === METADATA EXTRACTION ===
      // Extract comprehensive metadata from the processed content
      const metadata =
        window.LaTeXProcessor.extractDocumentMetadata(htmlContent);
      const documentTitle = metadata.title || title || "Mathematical Document";

      // STAGE 6: Add custom macros to metadata if available from enhanced export
      if (window.__customMacrosForExport) {
        metadata.customMacros = window.__customMacrosForExport;
        logInfo(
          `Added ${
            Object.keys(metadata.customMacros).length
          } custom macros to metadata`
        );
        // Clean up global variable
        delete window.__customMacrosForExport;
      }

      // === DOCUMENT STRUCTURE ENHANCEMENT ===
      // Enhance document structure with integrated sidebar
      const enhancedContent =
        await window.ContentGenerator.enhanceDocumentStructure(
          htmlContent,
          metadata
        );

      logInfo("Document title:", documentTitle);
      logInfo("Metadata:", metadata);

      // === HTML COMPONENT ASSEMBLY ===
      // Build HTML structure using template system
      const htmlComponents = [];

      // Document declaration and opening
      htmlComponents.push("<!DOCTYPE html>");
      htmlComponents.push('<html lang="en-GB">');

      // === HEAD GENERATION ===
      // Enhanced head section
      htmlComponents.push(
        await generateEnhancedHead(documentTitle, metadata, accessibilityLevel)
      );

      // === FOOTER GENERATION ===
      // Generate document footer first
      // Get DOM elements safely (may not exist during testing)
      const inputTextarea = document.getElementById("input");

      // Use user-configured args for footer display
      const originalSource = inputTextarea?.value || "";
      const pandocArgs = getUserConfiguredPandocArgs();
      const footerHTML = await generateDocumentFooter(
        originalSource,
        pandocArgs,
        metadata
      );

      // === BODY GENERATION ===
      // Generate complete body section using BodyGenerator module
      // This includes: <body>, content, sidebar, footer, </div> (document-wrapper)
      const bodyHTML = await window.BodyGenerator.generateDocumentBody(
        enhancedContent,
        metadata,
        footerHTML
      );
      htmlComponents.push(bodyHTML);

      // === JAVASCRIPT GENERATION ===
      // Enhanced JavaScript with complete reading accessibility features
      htmlComponents.push(await generateEnhancedJavaScript(accessibilityLevel));

      // === FINAL ASSEMBLY ===
      // End document
      htmlComponents.push("</body>");
      htmlComponents.push("</html>");

// Generate the initial HTML structure
      let preliminaryHTML = htmlComponents.join("\n");

// === IMAGE EMBEDDING ===
      // Embed registered images as base64 data URLs before Base64 convergence
      // Must happen AFTER HTML assembly but BEFORE self-referencing Base64 step
      //
      // CRITICAL: replaceImagesForExport uses tempDiv.innerHTML for DOM parsing,
      // which strips structural HTML tags (DOCTYPE, html, head, body, /body, /html).
      // To preserve the complete document structure, we extract only the body content,
      // process that through image embedding, then reassemble with the structural wrapper.
      let hasEmbeddedImages = false;
      if (window.ImageAssetManager && window.ImageAssetManager.getImageCount() > 0) {
        try {
          // Clean up preview-injected long descriptions before export injection
          // Preview uses blob-URL-based IDs (longdesc-blob-...) which must be removed
          // to prevent duplicates when replaceImagesForExport adds clean filename-based IDs
          preliminaryHTML = preliminaryHTML.replace(
            /<div\s+id="longdesc-blob-[^"]*"[^>]*class="image-long-description"[^>]*>[\s\S]*?<\/div>/g,
            ""
          );
          logDebug("Cleaned preview long description elements from export HTML");

          // Extract body content to avoid innerHTML stripping structural tags
          const bodyOpenMatch = preliminaryHTML.match(/<body[^>]*>/i);
          const bodyCloseIndex = preliminaryHTML.lastIndexOf('</body>');

          if (bodyOpenMatch && bodyCloseIndex > -1) {
            const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;
            const preamble = preliminaryHTML.substring(0, bodyOpenEnd);
            const bodyContent = preliminaryHTML.substring(bodyOpenEnd, bodyCloseIndex);
            const postamble = preliminaryHTML.substring(bodyCloseIndex);

            logDebug("Extracted body content for image embedding, length:", bodyContent.length);
            const processedBody = window.ImageAssetManager.replaceImagesForExport(bodyContent);
            preliminaryHTML = preamble + processedBody + postamble;
            logDebug("Reassembled document with structural tags preserved");
          } else {
            // Fallback: process full HTML (structural tags may be lost)
            logWarn("Could not extract body content — processing full HTML");
            preliminaryHTML = window.ImageAssetManager.replaceImagesForExport(preliminaryHTML);
          }

          hasEmbeddedImages = true;
          logInfo(`Embedded ${window.ImageAssetManager.getImageCount()} image(s) in export`);
        } catch (imageError) {
          logWarn("Image embedding failed, continuing without embedded images:", imageError.message);
        }
      }

      // === SELF-REFERENCING HTML ===
      // Self-containing Base64 solution - DELEGATED to Base64Handler
      if (!window.Base64Handler) {
        throw new Error(
          "[EXPORT] Base64Handler module required for self-referencing HTML"
        );
      }
// Determine convergence iterations for Base64 self-referencing
      // Default (USE_LEGACY_CONVERGENCE = false): always use 2 iterations — reliable for all sizes
      // Legacy (USE_LEGACY_CONVERGENCE = true): 5 for non-image, 2 for image exports
      const maxIterations = hasEmbeddedImages ? 2 : (USE_LEGACY_CONVERGENCE ? 5 : 2);
      if (hasEmbeddedImages) {
        logInfo("Using 2 Base64 convergence iterations for image-heavy export");
      } else if (!USE_LEGACY_CONVERGENCE) {
        logInfo("Using 2 Base64 convergence iterations (modern default)");
      }

      let convergenceResult;
      try {
        convergenceResult =
          window.Base64Handler.generateSelfReferencingHTML(
            preliminaryHTML,
            "Standard",
            maxIterations
          );
} catch (convergenceError) {
        logWarn("Base64 convergence failed (document may be too large):", convergenceError.message);
        logInfo("Exporting without self-referencing save functionality");
        // Inject empty embedded data element so content-storage-handler
        // detects it and hides the save button (preventing broken saves
        // where MathJax state from the live DOM pollutes the saved file)
        const fallbackHTML = preliminaryHTML.replace(
          '</body>',
          '\n<!-- Embedded Original Content for Save Functionality (convergence failed) -->\n' +
          '<script id="original-content-data" type="application/x-original-html-base64">\n' +
          '</script>\n</body>'
        );
        convergenceResult = {
          finalHTML: fallbackHTML,
          converged: false,
          iterations: 0,
          base64Length: 0,
        };
      }

      const finalHTML = convergenceResult.finalHTML;
      const converged = convergenceResult.converged;
      const finalBase64Length = convergenceResult.base64Length;

      logInfo(`Enhanced export completed: ${finalHTML.length} characters`);
      logInfo(`Quality level: ${contentSource.qualityLevel}`);
      logInfo(
        `Menu functionality: ${
          contentSource.needsConversion ? "preserved via conversion" : "native"
        }`
      );

      if (converged) {
        logInfo(
          "Infinite save chain achieved: Each save preserves exact same structure"
        );
      }

      logInfo(
        "Accessibility level " +
          accessibilityLevel +
          " features included with reading controls and theme toggle"
      );

      return finalHTML;
    } catch (error) {
      logError("[EXPORT] Error generating enhanced standalone HTML:", error);
      throw new Error(
        "[EXPORT] Failed to generate enhanced HTML: " + error.message
      );
    }
  }

  // ============================================================================
  // ENHANCED EXPORT WITH MINIMAL PROCESSING
  // ============================================================================
  // Variant export function using minimal post-processing
  // Delegates to: Same modules as main export but with reduced processing

  /**
   * Generate enhanced HTML with minimal post-processing using enhanced Pandoc output.
   * Delegates to: HeadGenerator for HTML head with metadata and embedded CSS
   * Delegates to: BodyGenerator for minimal document body structure (preserves Pandoc semantics)
   * Delegates to: FooterGenerator for credits and acknowledgements
   * Delegates to: ContentGenerator for minimal document structure enhancement
   * Delegates to: LaTeXProcessor for metadata extraction from enhanced Pandoc content
   * Delegates to: Base64Handler for self-referencing HTML with convergence
   * Variant of main export that leverages enhanced Pandoc arguments to reduce regex
   * post-processing while maintaining 100% feature parity. Uses enhanced Pandoc
   * semantic HTML structure directly with minimal modifications. Preserves better
   * semantic HTML from enhanced Pandoc whilst providing full accessibility features.
   * @param {string} content - Enhanced Pandoc HTML content with semantic structure
   * @param {string} title - Document title for metadata and filename generation
   * @param {number} accessibilityLevel - Accessibility feature level (1-3)
   * @returns {Promise<string>} Complete standalone HTML document with enhanced Pandoc semantics
   * @throws {Error} If required modules (LaTeXProcessor, ContentGenerator, TemplateSystem, Base64Handler) unavailable
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
        throw new Error("[EXPORT] LaTeXProcessor module not available");
      }
      if (!window.ContentGenerator) {
        throw new Error("[EXPORT] ContentGenerator module not available");
      }
      if (!window.TemplateSystem) {
        throw new Error("[EXPORT] TemplateSystem module not available");
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
      const enhancedContent =
        await window.ContentGenerator.enhanceDocumentStructure(
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

      // Generate document footer first
      // Get DOM elements safely (may not exist during testing)
      const inputTextarea = document.getElementById("input");
      const argumentsInput = document.getElementById("arguments");

      const originalSource = inputTextarea?.value || "";
      const pandocArgs =
        argumentsInput?.value || "--from latex --to html5 --mathjax";
      const footerHTML = generateDocumentFooter(
        originalSource,
        pandocArgs,
        metadata
      );

      // Generate complete body section using BodyGenerator module (minimal processing)
      // This includes: <body>, content, sidebar with template loading/retries, footer, </div>
      const bodyHTML = await window.BodyGenerator.generateDocumentBodyMinimal(
        enhancedContent,
        metadata,
        footerHTML
      );
      htmlComponents.push(bodyHTML);

      // End document (but don't add JavaScript yet)
      htmlComponents.push("</body>");
      htmlComponents.push("</html>");

// Generate the complete HTML first
      let preliminaryHTML = htmlComponents.join("\n");

      // 🎯 SELF-CONTAINING BASE64 SOLUTION - DELEGATED to Base64Handler
      // First generate JavaScript without embedded content for structure
      const enhancedJS = await generateEnhancedJavaScript(accessibilityLevel);

      // Create initial HTML with JavaScript but without Base64
      let baseHTML = preliminaryHTML.replace(
        "</body>\n</html>",
        enhancedJS + "\n</body>\n</html>"
      );

// === IMAGE EMBEDDING ===
      // Embed registered images as base64 data URLs before Base64 convergence
      // Must happen AFTER HTML assembly but BEFORE self-referencing Base64 step
      //
      // CRITICAL: replaceImagesForExport uses tempDiv.innerHTML for DOM parsing,
      // which strips structural HTML tags (DOCTYPE, html, head, body, /body, /html).
      // To preserve the complete document structure, we extract only the body content,
      // process that through image embedding, then reassemble with the structural wrapper.
      let hasEmbeddedImages = false;
      if (window.ImageAssetManager && window.ImageAssetManager.getImageCount() > 0) {
        try {
          // Clean up preview-injected long descriptions before export injection
          baseHTML = baseHTML.replace(
            /<div\s+id="longdesc-blob-[^"]*"[^>]*class="image-long-description"[^>]*>[\s\S]*?<\/div>/g,
            ""
          );
          logDebug("Cleaned preview long description elements from enhanced export HTML");

          // Extract body content to avoid innerHTML stripping structural tags
          const bodyOpenMatch = baseHTML.match(/<body[^>]*>/i);
          const bodyCloseIndex = baseHTML.lastIndexOf('</body>');

          if (bodyOpenMatch && bodyCloseIndex > -1) {
            const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;
            const preamble = baseHTML.substring(0, bodyOpenEnd);
            const bodyContent = baseHTML.substring(bodyOpenEnd, bodyCloseIndex);
            const postamble = baseHTML.substring(bodyCloseIndex);

            logDebug("Extracted body content for image embedding, length:", bodyContent.length);
            const processedBody = window.ImageAssetManager.replaceImagesForExport(bodyContent);
            baseHTML = preamble + processedBody + postamble;
            logDebug("Reassembled document with structural tags preserved");
          } else {
            // Fallback: process full HTML (structural tags may be lost)
            logWarn("Could not extract body content — processing full HTML");
            baseHTML = window.ImageAssetManager.replaceImagesForExport(baseHTML);
          }

          hasEmbeddedImages = true;
          logInfo(`Embedded ${window.ImageAssetManager.getImageCount()} image(s) in enhanced export`);
        } catch (imageError) {
          logWarn("Image embedding failed, continuing without embedded images:", imageError.message);
        }
      }


      // Generate self-referencing HTML using Base64Handler
      if (!window.Base64Handler) {
        throw new Error(
          "[EXPORT] Base64Handler module required for self-referencing HTML"
        );
      }

// Determine convergence iterations for Base64 self-referencing
      // Default (USE_LEGACY_CONVERGENCE = false): always use 2 iterations — reliable for all sizes
      // Legacy (USE_LEGACY_CONVERGENCE = true): 5 for non-image, 2 for image exports
      const maxIterations = hasEmbeddedImages ? 2 : (USE_LEGACY_CONVERGENCE ? 5 : 2);
      if (hasEmbeddedImages) {
        logInfo("Using 2 Base64 convergence iterations for image-heavy export");
      } else if (!USE_LEGACY_CONVERGENCE) {
        logInfo("Using 2 Base64 convergence iterations (modern default)");
      }

      let convergenceResult;
      try {
        convergenceResult =
          window.Base64Handler.generateSelfReferencingHTML(
            baseHTML,
            "Enhanced Pandoc",
            maxIterations
          );
      } catch (convergenceError) {
        logWarn("Base64 convergence failed (document may be too large):", convergenceError.message);
        logInfo("Exporting without self-referencing save functionality");
        // Inject empty embedded data element so content-storage-handler
        // detects it and hides the save button (preventing broken saves
        // where MathJax state from the live DOM pollutes the saved file)
        const fallbackHTML = baseHTML.replace(
          '</body>',
          '\n<!-- Embedded Original Content for Save Functionality (convergence failed) -->\n' +
          '<script id="original-content-data" type="application/x-original-html-base64">\n' +
          '</script>\n</body>'
        );
        convergenceResult = {
          finalHTML: fallbackHTML,
          converged: false,
          iterations: 0,
          base64Length: 0,
        };
      }

      const finalHTML = convergenceResult.finalHTML;
      const converged = convergenceResult.converged;
      const finalBase64Length = convergenceResult.base64Length;

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
        "[EXPORT] Error generating enhanced standalone HTML with minimal processing:",
        error
      );
      throw new Error(
        "[EXPORT] Failed to generate enhanced HTML: " + error.message
      );
    }
  }

  // ============================================================================
  // EXPORT UTILITIES
  // ============================================================================
  // Helper functions for file downloads and UI management

  /**
   * Download HTML file using robust method that prevents browser-level duplicates.
   * Uses object URL with Content-Disposition header simulation and delayed cleanup.
   * Prevents multiple simultaneous downloads with global flag and validates filename safety.
   * Records download metrics for monitoring and analysis.
   *
   * @param {string} htmlContent - Complete HTML content to download
   * @param {string} baseTitle - Base title for filename (optional, metadata preferred)
   * @param {Object} metadata - Document metadata for enhanced filename generation
   * @returns {void}
   */
  function downloadHTMLFile(htmlContent, baseTitle, metadata) {
    logInfo("Preparing HTML file download...");

    // 🛡️ CRITICAL: Prevent duplicate downloads with strict checking
    if (window.downloadInProgress) {
      logWarn("Download already in progress - preventing duplicate");
      return;
    }

    // Set flag immediately to prevent race conditions
    window.downloadInProgress = true;
    const downloadId = `download_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      // Generate filename once
      const filename =
        window.AppConfig && metadata
          ? window.AppConfig.generateEnhancedFilename(metadata)
          : baseTitle || "mathematical_document.html";

      logInfo(`[${downloadId}] Creating download for: ${filename}`);

      // Create blob with explicit MIME type
      const blob = new Blob([htmlContent], {
        type: "text/html;charset=utf-8",
      });

      // 🛡️ Record download for monitoring
      if (window.DownloadMonitor) {
        window.DownloadMonitor.recordDownload(filename, {
          type: "html",
          size: blob.size,
          source: "export-manager",
          downloadId: downloadId,
          metadata: {
            title: baseTitle,
            sections: metadata?.sections?.length || 0,
            hasAuthor: !!metadata?.author,
            documentClass: metadata?.documentClass || "unknown",
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // 🎯 NEW METHOD: Use saveAs simulation without FileSaver.js
      // This method is more reliable across browsers and prevents duplicates

      // Create object URL
      const url = URL.createObjectURL(blob);

      // Create invisible iframe for download (prevents multiple clicks)
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      // Use iframe to trigger download (more reliable, single trigger)
      let iframeDoc = iframe.contentWindow || iframe.contentDocument;
      if (iframeDoc.document) {
        iframeDoc = iframeDoc.document;
      }

      // Create download link in iframe context
      const downloadLink = iframeDoc.createElement("a");
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = "none";

      // Add to iframe document and trigger
      iframeDoc.body.appendChild(downloadLink);

      // Single click event with immediate cleanup
      downloadLink.addEventListener(
        "click",
        function () {
          logInfo(`[${downloadId}] Download triggered successfully`);
        },
        { once: true }
      );

      // Trigger download
      downloadLink.click();

      // Cleanup after delay (ensure download starts)
      setTimeout(() => {
        // Remove iframe
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }

        // Revoke object URL
        URL.revokeObjectURL(url);

        // Clear download flag
        window.downloadInProgress = false;

        logInfo(`[${downloadId}] Download cleanup completed`);
      }, 2000);

      logInfo(`[${downloadId}] HTML file download initiated: ${filename}`);
    } catch (error) {
      logError(`[${downloadId}] Download failed:`, error);
      window.downloadInProgress = false;
      throw error;
    }
  }

  /**
   * Smart content source detection with chunked document support and quality assessment.
   * Analyzes available content sources (original LaTeX input vs processed HTML output)
   * to determine optimal export strategy. Detects full documents with chunking
   * requirements and ensures combined output is used for multi-chunk processing.
   * Prioritizes original LaTeX for single-pass documents to preserve quality,
   * whilst using processed output for chunked documents to preserve combined results.
   * Returns content with comprehensive metadata about conversion requirements and quality level.
   * @returns {Object} Content source with type, content, conversion flags, and quality assessment
   * @returns {string} Object.content - The actual content string for export
   * @returns {string} Object.type - Source type: "original-latex", "chunked-processed", "pre-rendered", or "empty"
   * @returns {boolean} Object.needsConversion - Whether MathJax to LaTeX conversion needed
   * @returns {boolean} Object.needsPandocConversion - Whether Pandoc conversion needed
   * @returns {string} Object.qualityLevel - Quality assessment: "optimal", "optimal-chunked", "processed", or "none"
   * @returns {string} Object.sourceInfo - Human-readable description of content source
   */
  function getOptimalContentSource() {
    logInfo("Determining optimal content source for export...");

    // ✅ STAGE 1.1: Capture current Pandoc arguments for unified pipeline
    captureFrontendPandocArgs();

    const inputTextarea = document.getElementById("input");
    const outputDiv = document.getElementById("output");

    // Check for original LaTeX input (highest priority for quality)
    if (inputTextarea && inputTextarea.value.trim()) {
      const originalLatex = inputTextarea.value.trim();

      // ENHANCED: Detect if this is a full document with chunking requirements
      const isFullDocument =
        originalLatex.includes("\\documentclass") &&
        originalLatex.includes("\\begin{document}");

      // CRITICAL FIX: Check if the document was processed in chunks
      const outputContent = outputDiv?.innerHTML?.trim();
      const hasProcessedOutput =
        outputContent &&
        outputContent.length > 100 &&
        !outputContent.includes("Enter some LaTeX content");

      if (isFullDocument && hasProcessedOutput) {
        // Document was chunked and processed - use the combined output
        logInfo("CHUNKED DOCUMENT DETECTED: Using combined processed output");
        logInfo(
          `Original input length: ${originalLatex.length}, Combined output length: ${outputContent.length}`
        );

        return {
          content: outputContent,
          type: "chunked-processed",
          needsConversion: true, // MathJax conversion needed for menus
          needsPandocConversion: false, // Already processed by Pandoc in chunks
          qualityLevel: "optimal-chunked",
          sourceInfo: "Combined output from chunked processing",
        };
      } else if (hasProcessedOutput) {
        // ✅ STAGE 1.2: Use processed output for single documents too!
        // The output has already been through ConversionEngine with all fixes
        logInfo(
          "SINGLE DOCUMENT WITH PROCESSED OUTPUT: Using processed output (preserves all fixes)"
        );
        logInfo(`Processed output length: ${outputContent.length}`);

        return {
          content: outputContent,
          type: "processed-single",
          needsConversion: true, // MathJax conversion needed for menus
          needsPandocConversion: false, // ✅ Already processed - don't re-convert!
          qualityLevel: "optimal-processed",
          sourceInfo:
            "Processed output from ConversionEngine (preserves align, widecheck fixes)",
        };
      } else {
        // Only re-convert if there's NO processed output at all
        logWarn("NO PROCESSED OUTPUT: Will re-convert original LaTeX");

        return {
          content: originalLatex,
          type: "original-latex",
          needsConversion: false,
          needsPandocConversion: true,
          qualityLevel: "optimal",
          sourceInfo: "Original LaTeX from input (fallback)",
        };
      }
    }

    // Fallback: Use processed output if available
    if (outputDiv && outputDiv.innerHTML.trim()) {
      const outputHtml = outputDiv.innerHTML.trim();

      if (!outputHtml.includes("Enter some LaTeX content")) {
        logInfo("FALLBACK: Using existing processed output");

        return {
          content: outputHtml,
          type: "pre-rendered",
          needsConversion: true, // MathJax conversion needed
          needsPandocConversion: false, // Already processed
          qualityLevel: "processed",
          sourceInfo: "Existing processed output",
        };
      }
    }

    // No valid content found
    logWarn("[EXPORT] No valid content source found for export");
    return {
      content: "",
      type: "empty",
      needsConversion: false,
      needsPandocConversion: false,
      qualityLevel: "none",
      sourceInfo: "No content available",
    };
  }

  // ============================================================================
  // FONT LOADING AND VALIDATION
  // ============================================================================
  // Ensures embedded fonts are properly loaded and included in exports
  // Validates font availability and provides user feedback

  /**
   * Validate that font CSS contains actual Base64 data, not placeholder strings.
   * Delegates to: HeadGenerator for CSS validation and Base64 content verification
   * Checks embedded font CSS to ensure Base64 font data is present and valid,
   * detecting placeholder strings like "YOUR_BASE64_PLACEHOLDER" that indicate
   * font loading failure. Returns validation result with detailed error information
   * for debugging font embedding issues. Critical for preventing broken exports.
   * @param {string} css - Font CSS content to validate
   * @returns {Object} Validation result with isValid boolean and error details array
   * @returns {boolean} Object.isValid - Whether CSS contains valid Base64 font data
   * @returns {Array<string>} Object.errors - Array of validation error messages
   * @throws {Error} If HeadGenerator module not available
   */
  function validateFontCSS(css) {
    if (!window.HeadGenerator) {
      logError("[EXPORT] HeadGenerator module not available");
      throw new Error("[EXPORT] HeadGenerator module required");
    }
    return window.HeadGenerator.validateFontCSS(css);
  }

  /**
   * Wait for fonts to be loaded with timeout, retries, and validation.
   * Delegates to: HeadGenerator for font loading monitoring and validation
   * Polls font loading status at regular intervals until fonts are ready or timeout
   * occurs. Validates loaded font CSS to ensure Base64 data is present. Returns
   * success status with font CSS or error information. Prevents exports with
   * incomplete font data that would result in broken typography in exported documents.
   * @param {number} timeoutMs - Maximum time to wait in milliseconds, default 5000 (5 seconds)
   * @param {number} retryIntervalMs - Time between retry attempts in milliseconds, default 100
   * @returns {Promise<Object>} Result object with success status and font CSS or error details
   * @returns {boolean} Object.success - Whether fonts loaded successfully within timeout
   * @returns {string} Object.css - Font CSS content if successful
   * @returns {Object} Object.validation - Validation result with isValid and errors
   * @returns {string} Object.error - Error message if loading failed
   * @throws {Error} If HeadGenerator module not available
   */
  async function waitForFontsToLoad(timeoutMs = 5000, retryIntervalMs = 100) {
    if (!window.HeadGenerator) {
      logError("[EXPORT] HeadGenerator module not available");
      throw new Error("[EXPORT] HeadGenerator module required");
    }
    return await window.HeadGenerator.waitForFontsToLoad(
      timeoutMs,
      retryIntervalMs
    );
  }

  /**
   * Ensure embedded fonts are loaded and validated before export operations.
   * Delegates to: HeadGenerator for font loading coordination and validation
   * Primary font readiness check called before export generation. Waits for fonts
   * to load with timeout, validates Base64 content, and returns comprehensive result
   * including validation status. Blocks exports if fonts are not ready to prevent
   * broken typography. Essential for maintaining font embedding quality in exports.
   * @returns {Promise<Object>} Font loading result with validation details
   * @returns {boolean} Object.success - Whether fonts loaded and validated successfully
   * @returns {string} Object.css - Font CSS content with embedded Base64 data
   * @returns {Object} Object.validation - Detailed validation result with errors array
   * @returns {boolean} Object.validation.isValid - Whether validation passed
   * @returns {Array<string>} Object.validation.errors - Validation error messages
   * @throws {Error} If HeadGenerator module not available
   */
  async function ensureEmbeddedFontsInclusion() {
    if (!window.HeadGenerator) {
      logError("[EXPORT] HeadGenerator module not available");
      throw new Error("[EXPORT] HeadGenerator module required");
    }

    // ✅ CRITICAL: Ensure templates are loaded before creating generators
    // This prevents inline fallback templates on first export
    if (
      window.TemplateSystem &&
      !window.TemplateSystem.getGlobalCacheStatus().isLoaded
    ) {
      logDebug("[EXPORT] Pre-loading templates for font generation...");
      await window.TemplateSystem.ensureTemplatesLoaded();
      logDebug("[EXPORT] ✅ Templates ready for export");
    }

    return await window.HeadGenerator.ensureEmbeddedFontsInclusion();
  }

  /**
   * Validate complete export readiness including font loading and resource availability.
   * Delegates to: ensureEmbeddedFontsInclusion for font validation
   * Comprehensive pre-export validation checking all required resources are ready.
   * Validates fonts are loaded with proper Base64 data, checks resource availability,
   * and provides user-friendly error messages via notifications or alerts. Blocks
   * exports if validation fails, preventing broken documents. Returns detailed
   * readiness status for export decision-making.
   * @returns {Promise<Object>} Export readiness result with detailed status
   * @returns {boolean} Object.ready - Whether export can proceed safely
   * @returns {string} Object.error - User-friendly error message if not ready
   * @returns {Object} Object.fontResult - Detailed font loading and validation result
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
   * Create DOM element for font loading status indicator with visual feedback.
   * Creates floating status indicator element displaying font loading progress to
   * users. Shows loading spinner icon and status text. Indicator provides visual
   * feedback during font loading process, automatically hides after fonts load
   * successfully. Improves user experience by making font loading visible and
   * preventing confusion about export button availability.
   * @returns {HTMLElement} Created status indicator DOM element
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
   * Update font status indicator with current loading state and message.
   * Updates existing status indicator element (or creates one if missing) with
   * current font loading status. Supports four states: "loading" (spinner icon),
   * "ready" (checkmark, auto-hides after 3 seconds), "error" (warning icon), and
   * "hidden". Changes icon, text, and styling to match status. Provides immediate
   * visual feedback about font loading progress to users.
   * @param {string} status - Status type: "loading", "ready", "error", or "hidden"
   * @param {string} message - Status message to display to user
   * @returns {void}
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
   * Monitor font loading status continuously and update UI feedback accordingly.
   * Orchestrates font loading monitoring process: checks if fonts are already ready,
   * displays loading indicator whilst waiting, updates status as fonts load, handles
   * timeouts gracefully. Provides comprehensive user feedback throughout font loading
   * lifecycle. Automatically hides indicators after success or error display period.
   * Called during application initialization to ensure fonts ready before exports.
   * @returns {Promise<void>} Completes when monitoring finished (success, error, or timeout)
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
      console.error("[EXPORT] Font monitoring error:", error);
      updateFontStatus("error", "Font loading error");
      setTimeout(() => {
        updateFontStatus("hidden");
      }, 5000);
    }
  }

  /**
   * Enhance export button with font validation check before export execution.
   * Wraps export button click handler with font readiness validation. Prevents
   * exports when fonts are not ready, providing user feedback via notifications.
   * Only proceeds with export if validateExportReadiness returns ready status.
   * Updates button title to indicate font validation is active. Improves user
   * experience by preventing broken exports and providing clear feedback.
   * @returns {void}
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
   * Initialize font monitoring system on document load with delayed start.
   * Sets up font loading monitoring and export button enhancement when DOM is ready.
   * Waits for DOMContentLoaded if necessary, then starts monitoring after 1 second
   * delay to allow initial font loading to begin. Enhances export button with
   * validation checks. Coordinates all font monitoring initialization in single
   * function for easy setup.
   * @returns {void}
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
   * Load font data directly from files without template system (fallback method).
   * Fetches Base64 font data directly from font files in fonts/ directory using
   * fetch API. Provides fallback loading mechanism if template system unavailable.
   * Loads OpenDyslexic font variants (regular, bold, italic, bold-italic) and
   * AnnotationMono variable font. Returns object with Base64 data or placeholders
   * on fetch failure. Used internally by font loading system.
   * @returns {Promise<Object>} Font data object with Base64 strings for each variant
   * @returns {string} Object.base64Regular - OpenDyslexic regular variant Base64
   * @returns {string} Object.base64Bold - OpenDyslexic bold variant Base64
   * @returns {string} Object.base64Italic - OpenDyslexic italic variant Base64
   * @returns {string} Object.base64BoldItalic - OpenDyslexic bold-italic variant Base64
   * @returns {string} Object.base64AnnotationMonoVF - AnnotationMono variable font Base64
   */
async function loadFontDataDirect() {
    const fontFiles = {
      base64Regular: "fonts/opendyslexic-regular.txt",
      base64Bold: "fonts/opendyslexic-bold.txt",
      base64Italic: "fonts/opendyslexic-italic.txt",
      base64BoldItalic: "fonts/opendyslexic-bold-italic.txt",
      base64AnnotationMonoVF: "fonts/AnnotationMono-VF.txt",
      base64AtkinsonHyperlegibleVF: "fonts/atkinson-hyperlegible-vf.txt",
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
   * Render font template with simple string replacement for Base64 data injection.
   * Processes font CSS template by replacing template variables ({{base64Regular}},
   * {{base64Bold}}, etc.) with actual Base64 font data. Handles conditional sections
   * for variable font availability using {{#if}} syntax. Provides simple template
   * rendering without requiring full template system. Used as fallback when template
   * system unavailable or for direct font CSS generation.
   * @param {string} template - Font CSS template with template variable placeholders
   * @param {Object} fontData - Font data object with Base64 strings for each variant
   * @param {string} fontData.base64Regular - OpenDyslexic regular Base64 data
   * @param {string} fontData.base64Bold - OpenDyslexic bold Base64 data
   * @param {string} fontData.base64Italic - OpenDyslexic italic Base64 data
   * @param {string} fontData.base64BoldItalic - OpenDyslexic bold-italic Base64 data
   * @param {string} fontData.base64AnnotationMonoVF - AnnotationMono variable font Base64 data
   * @returns {string} Rendered font CSS with embedded Base64 font data
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

// Handle Annotation Mono variable font conditionally
    const hasAnnotationMono =
      fontData.base64AnnotationMonoVF &&
      fontData.base64AnnotationMonoVF !== "YOUR_BASE64_PLACEHOLDER";
    if (hasAnnotationMono) {
      rendered = rendered.replace(/\{\{#if hasFontNameVariable\}\}/g, "");
      rendered = rendered.replace(
        /\{\{fontNameVariableBase64\}\}/g,
        fontData.base64AnnotationMonoVF
      );
    } else {
      // Remove Annotation Mono section if not available
      rendered = rendered.replace(
        /\{\{#if hasFontNameVariable\}\}[\s\S]*?\{\{\/if\}\}/g,
        ""
      );
    }

    // Handle Atkinson Hyperlegible variable font conditionally
    const hasAtkinson =
      fontData.base64AtkinsonHyperlegibleVF &&
      fontData.base64AtkinsonHyperlegibleVF !== "YOUR_BASE64_PLACEHOLDER";
    if (hasAtkinson) {
      rendered = rendered.replace(/\{\{#if hasAtkinsonHyperlegible\}\}/g, "");
      rendered = rendered.replace(
        /\{\{atkinsonHyperlegibleBase64\}\}/g,
        fontData.base64AtkinsonHyperlegibleVF
      );
    } else {
      // Remove Atkinson Hyperlegible section if not available
      rendered = rendered.replace(
        /\{\{#if hasAtkinsonHyperlegible\}\}[\s\S]*?\{\{\/if\}\}/g,
        ""
      );
    }

    // Clean up remaining {{/if}} tags
    rendered = rendered.replace(/\{\{\/if\}\}/g, "");

    return rendered;
  }

  // ============================================================================
  // HEAD GENERATION DELEGATION
  // ============================================================================
  // Delegates head generation to HeadGenerator module
  // Handles metadata, CSS loading, and accessibility configuration

  /**
   * Generate enhanced HTML head section with metadata, CSS, and accessibility features.
   * Delegates to: HeadGenerator for complete head section generation
   * Templates: embedded-fonts.html for font embedding with Base64 validation
   * Generates complete head section including meta tags, title, embedded CSS from
   * templates, embedded fonts with validation, MathJax configuration, and accessibility
   * meta tags. Ensures all resources are embedded for offline standalone functionality.
   * @param {string} title - Document title for head metadata
   * @param {Object} metadata - Document metadata (author, date, sections, etc.)
   * @param {number} accessibilityLevel - Accessibility feature level (1-3)
   * @returns {Promise<string>} Complete HTML head section with embedded resources
   * @throws {Error} If HeadGenerator module not available
   */
  async function generateEnhancedHead(title, metadata, accessibilityLevel) {
    if (!window.HeadGenerator) {
      logError("[EXPORT] HeadGenerator module not available");
      throw new Error("[EXPORT] HeadGenerator module required");
    }

    logInfo("Delegating head generation to HeadGenerator module");
    return await window.HeadGenerator.generateEnhancedHead(
      title,
      metadata,
      accessibilityLevel
    );
  }

  // ============================================================================
  // FOOTER GENERATION DELEGATION
  // ============================================================================
  // Delegates footer generation to FooterGenerator module
  // Handles credits, acknowledgements, and closing elements

  /**
   * Generate document footer with credits, acknowledgements, and metadata display.
   * Delegates to: FooterGenerator for footer HTML generation
   * Templates: credits-acknowledgements.html for credits and attribution section
   * Generates footer containing document metadata, generation timestamp, Pandoc
   * arguments used, credits for open-source tools (Pandoc, MathJax, OpenDyslexic),
   * and accessibility acknowledgements. Includes collapsible source code viewer.
   * @param {string} originalSource - Original LaTeX source code for display
   * @param {string} pandocArgs - Pandoc arguments used for conversion display
   * @param {Object} metadata - Document metadata for footer display
   * @returns {Promise<string>} Complete HTML footer section with credits
   * @throws {Error} If FooterGenerator module not available
   */
  async function generateDocumentFooter(
    originalSource = "",
    pandocArgs = "",
    metadata = {}
  ) {
    if (!window.FooterGenerator) {
      logError("[EXPORT] FooterGenerator module not available");
      throw new Error("[EXPORT] FooterGenerator module required");
    }
    logInfo("Delegating footer generation to FooterGenerator module");
    return await window.FooterGenerator.generateDocumentFooter(
      originalSource,
      pandocArgs,
      metadata
    );
  }

  /**
   * Generate MathJax accessibility controls JavaScript for exported documents.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/mathjax-controls.js for MathJax context menu controls
   * Generates JavaScript enabling MathJax equation explorer, context menus, zoom
   * controls, and screen reader accessibility features in exported documents.
   * Controls are accessibility-level aware for progressive enhancement.
   * @param {number} accessibilityLevel - Accessibility feature level (1-3), default 1
   * @returns {Promise<string>} JavaScript code for MathJax accessibility controls
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateMathJaxControlsJS(accessibilityLevel = 1) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating MathJax controls generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateMathJaxControlsJS(
      accessibilityLevel
    );
  }

  /**
   * Generate reading tools initialization JavaScript for exported documents.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/initialization.js for reading tools setup and initialization
   * Generates JavaScript that initializes reading tools panel (font selection, spacing
   * controls, width controls, theme toggle) and sets up event listeners for user
   * preferences. Ensures reading tools are available immediately on document load.
   * @param {number} accessibilityLevel - Accessibility feature level (1-3), default 1
   * @returns {Promise<string>} JavaScript code for reading tools initialization
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateReadingToolsSetupJS(accessibilityLevel = 1) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating reading tools setup generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateReadingToolsSetupJS(
      accessibilityLevel
    );
  }

  /**
   * Generate focus tracking utility JavaScript for keyboard navigation support.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/focus-tracking.js for focus management and visible focus indicators
   * Generates JavaScript providing visible focus indicators for keyboard navigation,
   * focus trap management for modal dialogs, and focus restoration after interactions.
   * Critical for WCAG 2.2 AA keyboard accessibility compliance.
   * @param {Object} options - Configuration options for focus tracking behaviour
   * @returns {Promise<string>} JavaScript code for focus tracking utilities
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateFocusTrackingJS(options = {}) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating focus tracking generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateFocusTrackingJS(options);
  }

  /**
   * Generate theme management JavaScript for light/dark theme switching.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/theme-management.js for theme toggle and persistence
   * Generates JavaScript managing light/dark theme switching with localStorage
   * persistence, respects user's system preferences (prefers-color-scheme), and
   * provides smooth transitions. Includes ARIA announcements for theme changes.
   * @param {Object} options - Configuration options for theme management behaviour
   * @returns {Promise<string>} JavaScript code for theme management system
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateThemeManagementJS(options = {}) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating theme management generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateThemeManagementJS(options);
  }

  /**
   * Generate form initialization JavaScript for accessibility control forms.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/form-initialization.js for form setup and state restoration
   * Generates JavaScript initializing accessibility control forms (font selection,
   * spacing, width controls) with saved preferences from localStorage, sets up
   * change event listeners, and manages form state persistence across sessions.
   * @param {Object} options - Configuration options for form initialization behaviour
   * @returns {Promise<string>} JavaScript code for form initialization
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateFormInitializationJS(options = {}) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating form initialization generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateFormInitializationJS(
      options
    );
  }

  /**
   * Generate ReadingAccessibilityManager class for comprehensive accessibility control.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/reading-accessibility-manager-class.js for manager class implementation
   * Generates complete JavaScript class managing all reading accessibility features:
   * font selection, line spacing, letter spacing, word spacing, reading width,
   * zoom levels, and preference persistence. Provides unified API for accessibility
   * controls with localStorage integration and screen reader announcements.
   * @param {Object} options - Configuration options for accessibility manager behaviour
   * @returns {Promise<string>} JavaScript code for ReadingAccessibilityManager class
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateReadingAccessibilityManagerClass(options = {}) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating reading accessibility manager generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateReadingAccessibilityManagerClass(
      options
    );
  }

  /**
   * Generate document save functionality JavaScript for self-contained HTML updates.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/document-save-functionality.js for save mechanism implementation
   * Generates JavaScript enabling users to save modified versions of exported documents
   * whilst preserving all functionality. Implements self-referencing HTML technique
   * allowing infinite save chains where each save produces fully functional copy.
   * Includes UI feedback, error handling, and download management.
   * @returns {Promise<string>} JavaScript code for document save functionality
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateDocumentSaveFunctionalityJS() {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating document save functionality generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateDocumentSaveFunctionalityJS();
  }

  /**
   * Generate save verification JavaScript for validating successful document saves.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/save-verification.js for save validation implementation
   * Generates JavaScript verifying saved documents maintain all functionality including
   * embedded resources, accessibility features, and save capability itself. Provides
   * user feedback on save success/failure and validates HTML structure integrity.
   * Critical for ensuring infinite save chain reliability.
   * @returns {Promise<string>} JavaScript code for save verification utilities
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateSaveVerificationJS() {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating save verification generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateSaveVerificationJS();
  }

  /**
   * Generate content storage handler JavaScript for managing embedded content updates.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/content-storage-handler.js for storage management implementation
   * Generates JavaScript handling storage and retrieval of updated document content
   * within self-contained HTML structure. Manages Base64 encoding/decoding for
   * embedded content updates and ensures content integrity during save operations.
   * Supports infinite save chain by properly updating embedded content references.
   * @returns {Promise<string>} JavaScript code for content storage management
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateContentStorageHandlerJS() {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating content storage handler generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateContentStorageHandlerJS();
  }

  // ============================================================================
  // JAVASCRIPT GENERATION DELEGATION
  // ============================================================================
  // Delegates JavaScript generation to ScriptOrchestrator and TemplateSystem
  // Handles all interactive features, MathJax, and accessibility controls

  /**
   * Generate complete enhanced JavaScript for all interactive document features.
   * Delegates to: ScriptOrchestrator for coordinated JavaScript generation from all templates
   * Templates: Multiple JavaScript templates for all interactive features (see individual generators)
   * Main orchestration function coordinating generation of all JavaScript components:
   * MathJax controls, reading tools, focus tracking, theme management, form initialization,
   * accessibility manager, document save functionality, save verification, and content
   * storage. Ensures proper initialization order and integration of all features.
   * @param {number} accessibilityLevel - Accessibility feature level (1-3) for progressive enhancement
   * @param {string|null} cleanHTMLContent - Optional pre-cleaned HTML content for optimization
   * @returns {Promise<string>} Complete JavaScript code for all document features
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateEnhancedJavaScript(
    accessibilityLevel,
    cleanHTMLContent = null
  ) {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating enhanced JavaScript generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateEnhancedJavaScript(
      accessibilityLevel,
      cleanHTMLContent
    );
  }

  /**
   * Generate MathJax Manager JavaScript for MathJax lifecycle management.
   * Delegates to: ScriptOrchestrator for JavaScript template loading and processing
   * Templates: templates/js/mathjax-manager.js (conceptual - may use inline MathJax config)
   * Generates JavaScript managing MathJax initialization, configuration, and lifecycle
   * in exported documents. Handles MathJax loading, equation rendering, re-rendering
   * on content updates, and configuration of accessibility features (context menus,
   * equation explorer). Ensures MathJax is ready before document interactions.
   * @returns {Promise<string>} JavaScript code for MathJax manager
   * @throws {Error} If ScriptOrchestrator module not available
   */
  async function generateMathJaxManagerJS() {
    if (!window.ScriptOrchestrator) {
      logError("[EXPORT] ScriptOrchestrator module not available");
      throw new Error("[EXPORT] ScriptOrchestrator module required");
    }
    logInfo(
      "Delegating MathJax Manager generation to ScriptOrchestrator module"
    );
    return await window.ScriptOrchestrator.generateMathJaxManagerJS();
  }

  // ===========================================================================================
  // MAIN EXPORT FUNCTIONALITY
  // ===========================================================================================

  /**
   * Main export function triggered by UI export button with full validation.
   * Delegates to: generateEnhancedStandaloneHTML for complete HTML generation
   * Delegates to: validateExportReadiness for font and resource validation
   * Delegates to: AppConfig for filename generation and screen reader announcements
   * Delegates to: LaTeXProcessor for metadata extraction from content
   * Delegates to: downloadHTMLFile for file download coordination
   * Primary user-facing export function that validates export readiness (including
   * font loading), generates enhanced HTML, creates download file, and provides
   * comprehensive user feedback via notifications and screen reader announcements.
   * Includes error handling, button state management, and duplicate download prevention.
   * @returns {Promise<void>} Completes when export finished or error handled and user notified
   */
  async function exportEnhancedHTML() {
    const logInfo = window.ExportManager?.logInfo || console.log;
    const logError = window.ExportManager?.logError || console.error;
    const logWarn = window.ExportManager?.logWarn || console.warn;

    // ✅ NEW: Lock storage during export to prevent overwrites
    if (window.LatexStorageManager) {
      window.LatexStorageManager.markExportStart();
      logInfo("🔒 Export started - LaTeX storage protected from overwrites");
    }

// === DUPLICATE EXPORT PREVENTION ===
    // Check BEFORE resetting — prevents race condition with concurrent calls
    if (window.exportGenerationInProgress) {
      logWarn("Export already in progress — ignoring duplicate call");
      return;
    }

    // === VALIDATION ===
    // Get UI elements
    const outputContent = document.querySelector(".output-content");
    const exportButton = document.getElementById("exportButton");

    if (!outputContent) {
      logError("[EXPORT] Output content not found — cannot export");
      if (window.showNotification) {
        window.showNotification("Cannot find content to export", "error");
      }
      return;
    }

    // Store original button state
    const originalButtonContent = exportButton ? exportButton.innerHTML : "";

    try {
      // ✅ NEW: Validate export readiness (including fonts)
      logInfo("🔍 Validating export readiness...");
      const validation = await validateExportReadiness();

      if (!validation.ready) {
        logError("[EXPORT] Export validation failed:", validation.error);
        return; // Stop export - user has been notified
      }

      logInfo("✅ Export validation passed - proceeding with export");

      // === BUTTON STATE MANAGEMENT ===
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

      // === CONTENT PREPARATION ===
      // Get the current output content
      const content = outputContent.innerHTML.trim();
      logInfo("Retrieved content, length:", content.length);

      // Enhanced validation with pre-rendered MathJax detection
      window.AppConfig.validateEnhancedContent(content);

      // Extract metadata for enhanced document generation
      const metadata = window.LaTeXProcessor.extractDocumentMetadata(content);
      logInfo("Extracted metadata:", metadata);

      // === HTML GENERATION ===
      // Generate the enhanced standalone HTML
      logInfo("Generating enhanced standalone HTML with validated fonts...");
      const standaloneHTML = await generateEnhancedStandaloneHTML(
        content,
        metadata.title,
        2 // Use Level 2 accessibility
      );
      logInfo("Generated enhanced HTML length:", standaloneHTML.length);

      // ✅ PHASE 1F: Store export for diagnostic analysis
      if (window.ExportDiagnostics) {
        window.ExportDiagnostics.storeExport(standaloneHTML);
        logInfo("🔬 Export stored for diagnostic analysis (use quickCheck())");
      }

      // === FILE DOWNLOAD ===
      // Generate filename (downloadHTMLFile will use this if provided)
      logInfo("Creating download blob...");
      const filename = window.AppConfig.generateEnhancedFilename(metadata);
      logInfo(`Generated filename: ${filename}`);

      // Download the file (pass null for filename param to prevent duplicate generation)
      window.ExportManager.downloadHTMLFile(standaloneHTML, null, metadata);

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
      logError("[EXPORT] Enhanced export failed:", error);

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
      // === CLEANUP AND NOTIFICATIONS ===
      // Reset button state and clear export flag
      window.exportGenerationInProgress = false;
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = originalButtonContent;
      }

      // ✅ NEW: Always unlock storage, even on error
      if (window.LatexStorageManager) {
        window.LatexStorageManager.markExportComplete();
        logInfo("🔓 Export complete - LaTeX storage unprotected");
      }
    }
  }

  // ============================================================================
  // INITIALIZATION AND EVENT HANDLERS
  // ============================================================================
  // Sets up export button handlers and initializes export functionality
  // Manages event listeners and prevents duplicate initialization

  /**
   * Set up enhanced event handlers for export functionality with duplicate prevention.
   * Attaches click event handler to export button with comprehensive safeguards:
   * global setup flag to prevent multiple attachments, retry mechanism with limit
   * for button not found scenarios, data attribute marking for initialization tracking,
   * and duplicate click prevention during export generation. Preserves button element
   * reference for AppStateManager compatibility. Includes debouncing to prevent
   * rapid-fire export attempts. Makes exportEnhancedHTML globally available for
   * keyboard shortcuts.
   * @returns {void}
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
    // === VALIDATION AND SETUP ===
    const exportButton = document.getElementById("exportButton");

    if (!exportButton) {
      logError("[EXPORT] Export button not found - retrying in 100ms");
      // ✅ ENHANCED: Add retry limit to prevent infinite retries
      const retryCount = (window.exportButtonRetries || 0) + 1;
      if (retryCount <= 5) {
        window.exportButtonRetries = retryCount;
        setTimeout(setupEnhancedExportHandlers, 100);
      } else {
        logError(
          "[EXPORT] Export button not found after 5 retries - giving up"
        );
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
        // 🔍 CRITICAL: Add call tracking for debugging
        const callId = `export_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        logInfo(`Enhanced export button clicked [${callId}]`);
        console.trace("Export call stack:");

        e.preventDefault();

        // ✅ ENHANCED: Prevent double-clicks during export
        if (window.exportGenerationInProgress) {
          logWarn(`Export already in progress - ignoring click [${callId}]`);
          return;
        }

        // 🛡️ ENHANCED: Stricter download debouncing (2 seconds instead of 1)
        const now = Date.now();
        if (window.lastExportTime && now - window.lastExportTime < 2000) {
          logWarn(
            `Export called too quickly (${
              now - window.lastExportTime
            }ms ago) - ignoring to prevent duplicates [${callId}]`
          );
          return;
        }
        window.lastExportTime = now;

        logInfo(`Proceeding with export [${callId}]`);
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
   * Initialise enhanced export functionality with screen reader accessibility controls.
   * Delegates to: setupEnhancedExportHandlers for event handler attachment
   * Primary initialization function for export system. Includes call stack tracing
   * for debugging initialization order, duplicate initialization prevention with
   * global flag, and DOMContentLoaded coordination for proper timing. Ensures export
   * functionality is ready when document loads. Called automatically when module loads
   * via global initialization guard. Logs initialization context for troubleshooting.
   * @returns {void}
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

    // 🧹 CRITICAL: Clear any stale export state
    window.lastConvertedLatex = null;
    window.lastExportTime = null;
    window.downloadInProgress = false;
    window.exportGenerationInProgress = false;
    logInfo("🧹 Cleared stale export state variables");

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
   * Validate export manager dependencies are available and report status.
   * Checks availability of all required modules: AppConfig, LaTeXProcessor,
   * ContentGenerator, TemplateSystem, and MathJaxManager. Returns comprehensive
   * validation result with passed/total counts, success status, and list of missing
   * modules. Logs validation results for debugging. Used in testing and initialization
   * to ensure export system has all required dependencies before operation.
   * @returns {Object} Dependency validation result with detailed status
   * @returns {number} Object.passed - Number of available dependencies
   * @returns {number} Object.total - Total number of required dependencies
   * @returns {boolean} Object.success - Whether all dependencies available
   * @returns {Array<string>} Object.missing - Array of missing module names
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
   * Test export generation without download for validation and debugging.
   * Delegates to: generateEnhancedStandaloneHTML for HTML generation
   * Synthetic test function generating complete export from test content including
   * mathematical equations. Validates generated HTML structure (DOCTYPE, reading
   * tools, sidebar, integrated sidebar) without triggering actual download. Returns
   * comprehensive test result with success status, size metrics, and structure
   * validation flags. Used in automated testing and manual validation of export
   * functionality. Critical for regression testing after modifications.
   * @returns {Promise<Object>} Test result with detailed validation status
   * @returns {boolean} Object.success - Whether test passed all validations
   * @returns {number} Object.size - Generated HTML size in characters
   * @returns {boolean} Object.hasDoctype - Whether HTML includes DOCTYPE declaration
   * @returns {boolean} Object.hasReadingTools - Whether reading tools section present
   * @returns {boolean} Object.hasSidebar - Whether document sidebar present
   * @returns {boolean} Object.hasIntegratedSidebar - Whether integrated sidebar present
   * @returns {string} Object.error - Error message if test failed
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
  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  // ✅ STAGE 1.1 COMPLETE: Unified Conversion Pipeline
  // The export system now uses IDENTICAL Pandoc arguments as the frontend, ensuring
  // consistent LaTeX interpretation. This fixes align environment breakage and other
  // discrepancies between UI rendering and export output.
  //
  // Key Changes:
  //   - captureFrontendPandocArgs(): Stores frontend arguments globally
  //   - getStoredPandocArgs(): Retrieves stored arguments for export use
  //   - exportWithEnhancedPandoc(): Now uses frontend args, not enhanced args
  //
  // Impact: Eliminates "Misplaced &" errors in align environments and ensures
  // all LaTeX that renders correctly in UI also renders correctly in exports.

  return {
    // === MAIN EXPORT ORCHESTRATION ===
    // Primary functions for generating and exporting enhanced HTML documents
    generateEnhancedStandaloneHTML,
    exportEnhancedHTML,
    //  REMOVED: exportWithEnhancedPandoc (deprecated - superseded by exportEnhancedHTML)
    generateEnhancedStandaloneHTMLWithMinimalProcessing,

    // === HEAD, BODY, AND FOOTER GENERATION ===
    // Delegation functions for document structure components
    generateEnhancedHead,
    generateDocumentFooter,
    generateEnhancedJavaScript,

    // === JAVASCRIPT GENERATION DELEGATION ===
    // Individual JavaScript component generators
    generateMathJaxControlsJS,
    generateReadingToolsSetupJS,
    generateFocusTrackingJS,
    generateThemeManagementJS,
    generateFormInitializationJS,
    generateReadingAccessibilityManagerClass,
    generateDocumentSaveFunctionalityJS,
    generateSaveVerificationJS,
    generateContentStorageHandlerJS,
    generateMathJaxManagerJS,

    // === FONT VALIDATION AND LOADING ===
    // Functions ensuring proper font embedding in exports
    validateFontCSS,
    waitForFontsToLoad,
    validateExportReadiness,
    ensureEmbeddedFontsInclusion,

    // === FONT UI MONITORING ===
    // User interface functions for font loading feedback
    createFontStatusIndicator,
    updateFontStatus,
    monitorFontLoadingStatus,
    enhanceExportButtonWithFontStatus,
    initializeFontMonitoring,

    // === CONTENT SOURCE OPTIMIZATION ===
    // Smart content detection and strategy functions
    getOptimalContentSource,
    getUserConfiguredPandocArgs,
    createSafeBase64,

    // === FONT TEMPLATE UTILITIES ===
    // Direct font loading and template rendering (fallback methods)
    loadFontDataDirect,
    renderFontTemplate,

    // === INITIALIZATION AND EVENT HANDLING ===
    // Setup functions for export functionality
    initialiseEnhancedExportFunctionality,
    setupEnhancedExportHandlers,

    // === TESTING AND VALIDATION ===
    // Development and testing utilities
    validateDependencies,
    testExportGeneration,

    // === STAGE 1.1: PANDOC ARGUMENT MANAGEMENT ===
    // Functions for unified pipeline argument capture and retrieval
    captureFrontendPandocArgs,
    getStoredPandocArgs,

    // === UTILITIES ===
    // Helper functions for exports
    downloadHTMLFile,

    // === LOGGING ===
    // Logging functions for debugging and monitoring
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
