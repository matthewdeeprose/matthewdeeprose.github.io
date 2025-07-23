// latex-processor.js
// LaTeX Preservation Engine and MathJax Configuration Module
// Core breakthrough technology for preserving LaTeX expressions

const LaTeXProcessor = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[LATEX]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[LATEX]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[LATEX]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[LATEX]", message, ...args);
  }

  // ===========================================================================================
  // LATEX PRESERVATION ENGINE - CORE BREAKTHROUGH TECHNOLOGY
  // ===========================================================================================

  /**
   * CRITICAL FIX: Convert pre-rendered MathJax back to LaTeX
   * This ensures MathJax can process it fresh and attach context menus
   */
  function convertMathJaxToLatex(content) {
    logInfo("Converting pre-rendered MathJax elements back to LaTeX...");

    try {
      let processedContent = content;
      let conversionCount = 0;

      // Find all mjx-container elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");
      const mathContainers = doc.querySelectorAll("mjx-container");

      mathContainers.forEach((container) => {
        // Check if it has assistive MathML
        const mathML = container.querySelector("mjx-assistive-mml math");
        if (mathML) {
          // Try to extract LaTeX from MathML annotation
          const annotation = mathML.querySelector(
            'annotation[encoding="application/x-tex"]'
          );
          if (annotation) {
            const latex = annotation.textContent;
            const isDisplay = container.getAttribute("display") === "true";

            // Replace the entire mjx-container with LaTeX delimiters
            if (isDisplay) {
              container.outerHTML = `\\[${latex}\\]`;
            } else {
              container.outerHTML = `\\(${latex}\\)`;
            }
            conversionCount++;
            logDebug(
              `Converted equation ${conversionCount}: ${latex.substring(
                0,
                30
              )}...`
            );
          } else {
            // Fallback: Try to extract from the visual representation
            const texContent = extractLatexFromVisual(container);
            if (texContent) {
              const isDisplay = container.getAttribute("display") === "true";
              container.outerHTML = isDisplay
                ? `\\[${texContent}\\]`
                : `\\(${texContent}\\)`;
              conversionCount++;
              logDebug(
                `Converted equation ${conversionCount} using visual extraction`
              );
            }
          }
        }
      });

      // Also look for any span.math elements (older format)
      const mathSpans = doc.querySelectorAll("span.math");
      mathSpans.forEach((span) => {
        const mathContainer = span.querySelector("mjx-container");
        if (!mathContainer) {
          // Already has raw LaTeX, keep it
          return;
        }
        // Process as above
        const mathML = mathContainer.querySelector("mjx-assistive-mml math");
        if (mathML) {
          const annotation = mathML.querySelector(
            'annotation[encoding="application/x-tex"]'
          );
          if (annotation) {
            const latex = annotation.textContent;
            const isDisplay = span.classList.contains("display");
            span.innerHTML = isDisplay ? `\\[${latex}\\]` : `\\(${latex}\\)`;
            conversionCount++;
          }
        }
      });

      // Get the processed HTML
      processedContent = doc.body.innerHTML;

      logInfo(
        `Converted ${conversionCount} pre-rendered MathJax elements back to LaTeX`
      );

      // Also check for any remaining MathJax scripts/styles and remove them
      processedContent = processedContent.replace(
        /<script[^>]*mathjax[^>]*>[\s\S]*?<\/script>/gi,
        ""
      );
      processedContent = processedContent.replace(
        /<style[^>]*mathjax[^>]*>[\s\S]*?<\/style>/gi,
        ""
      );

      return processedContent;
    } catch (error) {
      logError("Error converting MathJax to LaTeX:", error);
      // Return original content if conversion fails
      return content;
    }
  }

  /**
   * Fallback: Try to extract LaTeX from visual MathJax representation
   */
  function extractLatexFromVisual(container) {
    try {
      // Common patterns we can recognise
      const textContent = container.textContent;

      // Very basic conversion - this would need to be much more sophisticated
      // for production use
      if (textContent.includes("=")) {
        // Try to preserve basic structure
        return textContent.replace(/\s+/g, " ").trim();
      }

      return null;
    } catch (error) {
      logError("Error extracting LaTeX from visual:", error);
      return null;
    }
  }

  // ===========================================================================================
  // ENHANCED MATHJAX CONFIGURATION WITH PHASE 2.3 SCREEN READER CONTROLS
  // ===========================================================================================

  /**
   * Enhanced MathJax configuration with screen reader accessibility support
   * Replaces the static version with support for runtime configuration changes
   */
  function generateMathJaxConfig(accessibilityLevel = 2, dynamicOptions = {}) {
    logInfo(
      `Generating simplified MathJax configuration - Level ${accessibilityLevel} with proven working controls only`
    );
    logDebug("Dynamic options received:", dynamicOptions);

    try {
      const mathJaxConfig = [];

      mathJaxConfig.push(
        "    <!-- Simplified MathJax Configuration with Proven Working Controls -->"
      );
      mathJaxConfig.push("    <script>");
      mathJaxConfig.push("        window.MathJax = {");
      mathJaxConfig.push("            tex: {");
      mathJaxConfig.push(
        "                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], "
      );
      mathJaxConfig.push(
        "                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],"
      );
      mathJaxConfig.push("                processEscapes: true,");
      mathJaxConfig.push("                processEnvironments: true,");
      mathJaxConfig.push(
        "                packages: {'[+]': ['ams', 'amssymb', 'cases', 'mathtools']},"
      );
      mathJaxConfig.push("                tags: 'ams'");
      mathJaxConfig.push("            },");

      // ✅ FIXED: Optimal defaults that always work
      mathJaxConfig.push("            options: {");
      mathJaxConfig.push("                enableMenu: true,"); // Always enabled via LaTeX preservation
      mathJaxConfig.push("                ignoreHtmlClass: 'tex2jax_ignore',");
      mathJaxConfig.push(
        "                processHtmlClass: 'tex2jax_process',"
      );
      mathJaxConfig.push("                menuOptions: {");
      mathJaxConfig.push("                    settings: {");
      mathJaxConfig.push("                        texHints: true,");
      mathJaxConfig.push("                        semantics: false,");

      // ✅ RUNTIME CONFIGURABLE: Working controls only
      const zoomTrigger = dynamicOptions.zoomTrigger || "Click";
      const zoomScale = dynamicOptions.zoomScale || "200%";
      const inTabOrder = dynamicOptions.inTabOrder !== false; // Default true
      const assistiveMml = dynamicOptions.assistiveMml !== false; // Default true

      mathJaxConfig.push(`                        zoom: '${zoomTrigger}',`);
      mathJaxConfig.push(`                        zscale: '${zoomScale}',`);
      mathJaxConfig.push(`                        inTabOrder: ${inTabOrder},`);
      mathJaxConfig.push(
        `                        assistiveMml: ${assistiveMml},`
      );

      // ✅ FIXED: Optimal renderer and scale (not runtime configurable)
      mathJaxConfig.push("                        renderer: 'CHTML',"); // Always optimal
      mathJaxConfig.push("                        scale: 1.0,"); // Always optimal

      // ✅ FIXED: Explorer enabled by default for accessibility level 2+
      if (accessibilityLevel >= 2) {
        mathJaxConfig.push("                        explorer: true,");
        logInfo("✅ Explorer component enabled (baked in)");
      } else {
        mathJaxConfig.push("                        explorer: false,");
      }

      mathJaxConfig.push("                        collapsible: false"); // Removed (broken)
      mathJaxConfig.push("                    }");
      mathJaxConfig.push("                }");
      mathJaxConfig.push("            },");

      // ✅ FIXED: Optimal CHTML configuration
      mathJaxConfig.push("            chtml: {");
      mathJaxConfig.push("                scale: 1.0,"); // Always optimal
      mathJaxConfig.push("                minScale: 0.5,");
      mathJaxConfig.push("                matchFontHeight: false,");
      mathJaxConfig.push("                displayAlign: 'center',");
      mathJaxConfig.push("                displayIndent: '0'");
      mathJaxConfig.push("            },");

      // ✅ SIMPLIFIED: Only working components
      mathJaxConfig.push("            loader: {");
      const loadComponents = ["ui/menu"];

      if (accessibilityLevel >= 2) {
        loadComponents.push("a11y/explorer");
        logInfo("✅ Explorer component added to loader");
      }
      // ❌ REMOVED: semantic-enrich (loading fails)

      mathJaxConfig.push(
        `                load: ${JSON.stringify(loadComponents)}`
      );
      mathJaxConfig.push("            },");

      // ✅ ENHANCED: Startup with better logging
      mathJaxConfig.push("            startup: {");
      mathJaxConfig.push("                ready() {");
      mathJaxConfig.push(
        "                    console.log('=== SIMPLIFIED MATHJAX READY ===');"
      );
      mathJaxConfig.push(
        "                    console.log('✅ Accessibility Level:', " +
          accessibilityLevel +
          ");"
      );
      mathJaxConfig.push(
        "                    console.log('✅ Context Menus: Always enabled');"
      );
      mathJaxConfig.push(
        "                    console.log('✅ Renderer: CHTML (optimal)');"
      );
      mathJaxConfig.push(
        "                    console.log('🎯 Zoom Trigger:', '" +
          zoomTrigger +
          "');"
      );
      mathJaxConfig.push(
        "                    console.log('🎯 Zoom Scale:', '" +
          zoomScale +
          "');"
      );
      mathJaxConfig.push(
        "                    console.log('🔊 Assistive MathML:', " +
          assistiveMml +
          ");"
      );
      mathJaxConfig.push(
        "                    console.log('⌨️ Tab Navigation:', " +
          inTabOrder +
          ");"
      );

      mathJaxConfig.push("                    MathJax.startup.defaultReady();");
      mathJaxConfig.push("                    ");

      // ✅ ENHANCED: Dynamic MathJax Manager initialisation
      mathJaxConfig.push("                    setTimeout(() => {");
      mathJaxConfig.push(
        "                        if (window.dynamicMathJaxManager) {"
      );
      mathJaxConfig.push(
        "                            window.dynamicMathJaxManager.initialise();"
      );
      mathJaxConfig.push(
        "                            console.log('✅ Simplified Dynamic MathJax Manager initialised');"
      );
      mathJaxConfig.push("                        }");
      mathJaxConfig.push("                    }, 100);");

      mathJaxConfig.push("                    setTimeout(() => {");
      mathJaxConfig.push(
        "                        const mathElements = document.querySelectorAll('mjx-container');"
      );
      mathJaxConfig.push(
        "                        console.log('📊 Math elements found:', mathElements.length);"
      );
      mathJaxConfig.push("                        ");
      mathJaxConfig.push(
        "                        mathElements.forEach((el, index) => {"
      );
      mathJaxConfig.push(
        "                            if (!el.getAttribute('role')) {"
      );
      mathJaxConfig.push(
        "                                el.setAttribute('role', 'img');"
      );
      mathJaxConfig.push("                            }");
      mathJaxConfig.push(
        "                            if (!el.getAttribute('aria-label')) {"
      );
      mathJaxConfig.push(
        "                                el.setAttribute('aria-label', 'Mathematical expression ' + (index + 1) + '. Right-click for options.');"
      );
      mathJaxConfig.push("                            }");

      // ✅ ENHANCED: Apply tab navigation if enabled
      mathJaxConfig.push(
        "                            if (" + inTabOrder + ") {"
      );
      mathJaxConfig.push(
        "                                el.setAttribute('tabindex', '0');"
      );
      mathJaxConfig.push("                            }");

      mathJaxConfig.push("                        });");
      mathJaxConfig.push("                        ");
      mathJaxConfig.push(
        "                        console.log('=== SIMPLIFIED SETUP COMPLETE ===');"
      );
      mathJaxConfig.push("                    }, 1000);");
      mathJaxConfig.push("                }");
      mathJaxConfig.push("            }");
      mathJaxConfig.push("        };");
      mathJaxConfig.push("    </script>");
      mathJaxConfig.push(
        '    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>'
      );

      const fullConfig = mathJaxConfig.join("\n");
      logInfo(
        "✅ Simplified MathJax configuration generated successfully with proven working controls only"
      );
      return fullConfig;
    } catch (error) {
      logError("Error generating simplified MathJax configuration:", error);
      // Return minimal working configuration as fallback
      return (
        "    <!-- Fallback MathJax Configuration -->\n" +
        "    <script>\n" +
        "        window.MathJax = {\n" +
        "            tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },\n" +
        "            options: { enableMenu: true },\n" +
        "            loader: { load: ['ui/menu'] }\n" +
        "        };\n" +
        "    </script>\n" +
        '    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>'
      );
    }
  }

  // ===========================================================================================
  // EXPLORER COMPONENT MANAGEMENT
  // ===========================================================================================

  /**
   * PHASE 2.1: Enhanced Explorer Configuration Management
   * Manages the Explorer component enable/disable functionality
   */
  function configureExplorerComponent(enableExplorer) {
    logInfo("🔍 Configuring Explorer component:", enableExplorer);

    try {
      // Update the current accessibility level to 2 when Explorer is enabled
      if (enableExplorer) {
        logInfo(
          "✅ Enabling Explorer component - upgrading to accessibility level 2"
        );
        return 2; // Return new accessibility level
      } else {
        logInfo(
          "❌ Disabling Explorer component - reverting to accessibility level 1"
        );
        return 1; // Return basic accessibility level
      }
    } catch (error) {
      logError("Error configuring Explorer component:", error);
      return 1; // Fallback to basic level
    }
  }

  // ===========================================================================================
  // DOCUMENT METADATA EXTRACTION
  // ===========================================================================================

  /**
   * Enhanced document metadata extraction from LaTeX and HTML content
   */
  function extractDocumentMetadata(content) {
    logInfo("Extracting document metadata from content");

    const metadata = {
      title: "Mathematical Document",
      author: null,
      date: null,
      documentClass: null,
      sections: [],
    };

    try {
      // Extract LaTeX document class if present
      const docClassMatch = content.match(
        /\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/
      );
      if (docClassMatch) {
        metadata.documentClass = docClassMatch[1];
        logDebug("Found document class:", metadata.documentClass);
      }

      // Extract LaTeX title with priority over HTML h1
      const latexTitleMatch = content.match(/\\title\{([^}]+)\}/);
      if (latexTitleMatch) {
        metadata.title = latexTitleMatch[1]
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, "")
          .trim();
        logDebug("Found LaTeX title:", metadata.title);
      } else {
        // Fall back to HTML h1 extraction
        const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (h1Match) {
          metadata.title = h1Match[1].replace(/<[^>]+>/g, "").trim();
          logDebug("Found HTML h1 title:", metadata.title);
        } else {
          // Try to find document-title class
          const docTitleMatch = content.match(
            /<[^>]+class="document-title"[^>]*>(.*?)<\/[^>]+>/i
          );
          if (docTitleMatch) {
            metadata.title = docTitleMatch[1].replace(/<[^>]+>/g, "").trim();
            logDebug("Found document-title class:", metadata.title);
          }
        }
      }

      // Extract author
      const latexAuthorMatch = content.match(/\\author\{([^}]+)\}/);
      if (latexAuthorMatch) {
        metadata.author = latexAuthorMatch[1]
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, "")
          .trim();
        logDebug("Found LaTeX author:", metadata.author);
      } else {
        const htmlAuthorMatch = content.match(
          /<[^>]+class="document-author"[^>]*>(.*?)<\/[^>]+>/i
        );
        if (htmlAuthorMatch) {
          metadata.author = htmlAuthorMatch[1].replace(/<[^>]+>/g, "").trim();
          logDebug("Found HTML author:", metadata.author);
        }
      }

      // Extract date
      const latexDateMatch = content.match(/\\date\{([^}]+)\}/);
      if (latexDateMatch) {
        metadata.date = latexDateMatch[1]
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, "")
          .trim();
        logDebug("Found LaTeX date:", metadata.date);
      } else {
        const htmlDateMatch = content.match(
          /<[^>]+class="document-date"[^>]*>(.*?)<\/[^>]+>/i
        );
        if (htmlDateMatch) {
          metadata.date = htmlDateMatch[1].replace(/<[^>]+>/g, "").trim();
          logDebug("Found HTML date:", metadata.date);
        }
      }

      // Extract section structure for better navigation (include h1-h6)
      const sectionMatches = content.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi);
      for (const match of sectionMatches) {
        const level = parseInt(match[1]);
        const sectionTitle = match[2].replace(/<[^>]+>/g, "").trim();

        // Create clean ID from title
        const cleanId = sectionTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "") // Remove special chars except spaces
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

        metadata.sections.push({
          level: level,
          title: sectionTitle,
          id: cleanId,
        });
      }

      logInfo("Extracted metadata:", metadata);
      return metadata;
    } catch (error) {
      logError("Error extracting metadata:", error);
      return metadata; // Return default metadata
    }
  }

  // ===========================================================================================
  // LATEX PROCESSING UTILITIES
  // ===========================================================================================

  /**
   * Clean LaTeX content for processing
   */
  function cleanLatexContent(content) {
    try {
      // Remove HTML comments
      let cleaned = content.replace(/<!--[\s\S]*?-->/g, "");

      // Remove empty lines
      cleaned = cleaned.replace(/^\s*\n/gm, "");

      // Normalise line endings
      cleaned = cleaned.replace(/\r\n/g, "\n");

      // Trim whitespace
      cleaned = cleaned.trim();

      logDebug("LaTeX content cleaned, length:", cleaned.length);
      return cleaned;
    } catch (error) {
      logError("Error cleaning LaTeX content:", error);
      return content;
    }
  }

  /**
   * Validate LaTeX syntax
   */
  function validateLatexSyntax(content) {
    const issues = [];

    try {
      // Check for unmatched delimiters
      const inlineMathCount = (content.match(/(?<!\\)\$/g) || []).length;
      if (inlineMathCount % 2 !== 0) {
        issues.push("Unmatched inline math delimiters ($)");
      }

      // Check for unmatched display math
      const displayOpenCount = (content.match(/\\\[/g) || []).length;
      const displayCloseCount = (content.match(/\\\]/g) || []).length;
      if (displayOpenCount !== displayCloseCount) {
        issues.push("Unmatched display math delimiters (\\[ \\])");
      }

      // Check for unmatched environments
      const beginCount = (content.match(/\\begin\{/g) || []).length;
      const endCount = (content.match(/\\end\{/g) || []).length;
      if (beginCount !== endCount) {
        issues.push("Unmatched LaTeX environments (\\begin/\\end)");
      }

      if (issues.length > 0) {
        logWarn("LaTeX syntax issues found:", issues);
      } else {
        logDebug("LaTeX syntax validation passed");
      }

      return {
        valid: issues.length === 0,
        issues: issues,
      };
    } catch (error) {
      logError("Error validating LaTeX syntax:", error);
      return {
        valid: false,
        issues: ["Validation error: " + error.message],
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // LaTeX preservation
    convertMathJaxToLatex,
    extractLatexFromVisual,

    // MathJax configuration
    generateMathJaxConfig,
    configureExplorerComponent,

    // Document processing
    extractDocumentMetadata,
    cleanLatexContent,
    validateLatexSyntax,

    // Utilities
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.LaTeXProcessor = LaTeXProcessor;
