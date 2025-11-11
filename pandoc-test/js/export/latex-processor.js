// latex-processor.js
// LaTeX Processor - Shared Utilities for All Export Methods
// Core functions used by both legacy and enhanced processors
// STAGE 3 REFACTOR: Contains only shared utilities

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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
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
  // REMOVED AND WILL BE ONLY IN LEGACY MODULE
  // ===========================================================================================

  // ===========================================================================================
  // MATHJAX CONFIGURATION (SHARED)
  // ===========================================================================================
  // Both legacy and enhanced methods need MathJax configuration

  /**
   * Enhanced MathJax configuration with comprehensive tabindex debugging
   * Phase 3.1: Clean implementation with proper syntax and debugging
   * Phase 4A: Dynamic custom macro injection support
   *
   * @param {number} accessibilityLevel - Accessibility configuration level (0-3)
   * @param {Object} dynamicOptions - Dynamic configuration options
   * @param {string} [dynamicOptions.zoomTrigger='DoubleClick'] - Zoom activation method
   * @param {string} [dynamicOptions.zoomScale='200%'] - Zoom magnification level
   * @param {boolean} [dynamicOptions.inTabOrder=false] - Include equations in tab order
   * @param {boolean} [dynamicOptions.assistiveMml=true] - Enable assistive MathML
   * @param {Object} [dynamicOptions.customMacros] - Custom LaTeX macros to inject
   *   Format: { macroName: ['replacement', argCount] }
   *   Example: { 'R': ['\\mathbb{R}', 0], 'vec': ['\\mathbf{#1}', 1] }
   * @returns {string} - HTML string containing MathJax configuration script
   */
  function generateMathJaxConfig(accessibilityLevel = 2, dynamicOptions = {}) {
    logInfo(
      `Generating enhanced MathJax configuration - Level ${accessibilityLevel} (matching index.html)`
    );
    logDebug("Dynamic options received:", dynamicOptions);

    try {
      // ✅ PHASE 1F: API VALIDATION - Detect and fix incorrect macro passing
      // Check if macros were passed directly instead of wrapped in customMacros
      if (
        dynamicOptions &&
        !dynamicOptions.customMacros &&
        Object.keys(dynamicOptions).length > 0
      ) {
        // Check if any key looks like a macro (has Array value with 1-2 elements)
        const firstKey = Object.keys(dynamicOptions)[0];
        const firstValue = dynamicOptions[firstKey];

        // Detect macro pattern: Array with 1-2 elements where first is string
        if (
          Array.isArray(firstValue) &&
          firstValue.length >= 1 &&
          firstValue.length <= 3 &&
          typeof firstValue[0] === "string"
        ) {
          logWarn(
            "⚠️ API USAGE ERROR DETECTED: Macros passed directly to generateMathJaxConfig()"
          );
          logWarn(
            "   Expected: generateMathJaxConfig(level, { customMacros: macros })"
          );
          logWarn(
            `   Received: generateMathJaxConfig(level, macros) with ${
              Object.keys(dynamicOptions).length
            } macros`
          );
          logWarn("   🔧 Automatically wrapping for backward compatibility");

          // Auto-fix: Wrap the macros in customMacros property
          dynamicOptions = { customMacros: dynamicOptions };

          logInfo(
            `✅ Auto-wrapped ${
              Object.keys(dynamicOptions.customMacros).length
            } macro(s) for injection`
          );
        }
      }

      // Extract dynamic options with defaults
      const zoomTrigger = dynamicOptions.zoomTrigger || "DoubleClick";
      const zoomScale = dynamicOptions.zoomScale || "200%";
      const inTabOrder =
        dynamicOptions.inTabOrder !== undefined
          ? dynamicOptions.inTabOrder
          : false; // Changed default to match index.html
      const assistiveMml =
        dynamicOptions.assistiveMml !== undefined
          ? dynamicOptions.assistiveMml
          : true;

      // Phase 4A: Extract custom macros if provided
      const customMacros = dynamicOptions.customMacros || {};
      const macroCount = Object.keys(customMacros).length;

      if (macroCount > 0) {
        logInfo(
          `Injecting ${macroCount} custom LaTeX macro(s) into MathJax configuration`
        );
        logDebug("Custom macros to inject:", customMacros);
      }

      const mathJaxConfig = [];

      mathJaxConfig.push(
        "    <!-- Enhanced MathJax Configuration with Accessibility Module Loading -->"
      );
      mathJaxConfig.push("    <script>");
      mathJaxConfig.push(
        "        console.log('=== ENHANCED MATHJAX CONFIG LOADING ===');"
      );
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
        "                packages: {'[+]': ['ams', 'amssymb', 'cases', 'mathtools', 'cancel', 'color']},"
      );
      mathJaxConfig.push("                tags: 'ams',");
      mathJaxConfig.push("                macros: {");

      // Default macros (always included)
      mathJaxConfig.push(
        "                    widecheck: ['\\\\overset{\\\\vee}{#1}', 1],"
      );
      mathJaxConfig.push(
        "                    coloneqq: ['\\\\mathrel{:=}', 0]"
      );

      // Phase 4A: Inject custom macros dynamically
      if (macroCount > 0) {
        // Add comma after widecheck if we have custom macros
        const lastLine = mathJaxConfig[mathJaxConfig.length - 1];
        mathJaxConfig[mathJaxConfig.length - 1] = lastLine + ",";

        // Inject each custom macro
        const macroEntries = Object.entries(customMacros);
        macroEntries.forEach(([name, definition], index) => {
          // Add comma after each entry except the last
          const isLastMacro = index === macroEntries.length - 1;
          const comma = isLastMacro ? "" : ",";

          // Ensure definition is an array [replacement, argCount]
          const defArray = Array.isArray(definition)
            ? definition
            : [definition, 0];

          // Generate the macro line with proper indentation and escaping
          mathJaxConfig.push(
            `                    ${name}: ${JSON.stringify(defArray)}${comma}`
          );
        });

        logDebug(
          `Successfully injected ${macroCount} custom macro(s) into configuration`
        );
      }

      mathJaxConfig.push("                }");
      mathJaxConfig.push("            },");
      mathJaxConfig.push("");
      // MathJax 3.2.2 Compatible Accessibility Configuration
      mathJaxConfig.push("            loader: {");
      mathJaxConfig.push("                load: [");
      mathJaxConfig.push("                    'a11y/assistive-mml',");
      mathJaxConfig.push("                    'a11y/sre',");
      mathJaxConfig.push("                    'a11y/semantic-enrich',");
      mathJaxConfig.push("                    'a11y/explorer',");
      mathJaxConfig.push("                    '[tex]/cancel',");
      mathJaxConfig.push("                    '[tex]/color'");
      mathJaxConfig.push("                ],");
      mathJaxConfig.push("                paths: {");
      mathJaxConfig.push(
        "                    a11y: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/a11y'"
      );
      mathJaxConfig.push("                },");
      mathJaxConfig.push("                retries: 3,");
      mathJaxConfig.push("                timeout: 15000");
      mathJaxConfig.push("            },");
      mathJaxConfig.push("");
      mathJaxConfig.push("            options: {");
      mathJaxConfig.push("                enableMenu: true,");
      mathJaxConfig.push("                enableEnrichment: true,");
      mathJaxConfig.push("                ignoreHtmlClass: 'tex2jax_ignore',");
      mathJaxConfig.push(
        "                processHtmlClass: 'tex2jax_process',"
      );
      mathJaxConfig.push("                enableAssistiveMml: true,");
      mathJaxConfig.push("                menuOptions: {");
      mathJaxConfig.push("                    settings: {");
      mathJaxConfig.push("                        texHints: true,");
      mathJaxConfig.push("                        semantics: true,");
      mathJaxConfig.push(
        `                        assistiveMml: ${assistiveMml},`
      );
      mathJaxConfig.push("                        explorer: true,");
      mathJaxConfig.push(`                        zoom: '${zoomTrigger}',`);
      mathJaxConfig.push(`                        zscale: '${zoomScale}'`);
      mathJaxConfig.push("                    },");
      mathJaxConfig.push("                    annotationTypes: {");
      mathJaxConfig.push(
        "                        TeX: ['TeX', 'LaTeX', 'application/x-tex']"
      );
      mathJaxConfig.push("                    }");
      mathJaxConfig.push("                }");
      mathJaxConfig.push("            },");
      mathJaxConfig.push("");
      mathJaxConfig.push("            // Enhanced accessibility configuration");
      mathJaxConfig.push("            a11y: {");
      mathJaxConfig.push(`                assistiveMml: ${assistiveMml},`);
      mathJaxConfig.push(`                inTabOrder: ${inTabOrder},`);
      mathJaxConfig.push("                speechRules: 'mathspeak',");
      mathJaxConfig.push("                braille: false");
      mathJaxConfig.push("            },");
      mathJaxConfig.push("");
      mathJaxConfig.push("            chtml: {");
      mathJaxConfig.push("                displayAlign: 'center',");
      mathJaxConfig.push("                displayIndent: '0em'");
      mathJaxConfig.push("            },");
      mathJaxConfig.push("");

      // Simplified startup configuration (matching index.html approach)
      mathJaxConfig.push("            startup: {");
      mathJaxConfig.push("                ready() {");
      mathJaxConfig.push(
        "                    console.log('=== ENHANCED MATHJAX STARTUP READY ===');"
      );
      mathJaxConfig.push(
        "                    console.log('MathJax enhanced startup initiated');"
      );
      mathJaxConfig.push("                    MathJax.startup.defaultReady();");
      mathJaxConfig.push(
        "                    console.log('MathJax default ready complete');"
      );
      mathJaxConfig.push("");
      mathJaxConfig.push("                    // A11Y verification");
      mathJaxConfig.push("                    setTimeout(() => {");
      mathJaxConfig.push("                        try {");
      mathJaxConfig.push(
        "                            const a11yModules = Object.keys((MathJax._ && MathJax._.a11y) || {});"
      );
      mathJaxConfig.push(
        "                            console.log('♿ A11Y Modules loaded:', a11yModules.length, a11yModules);"
      );
      mathJaxConfig.push("");
      mathJaxConfig.push(
        "                            const targetModules = ['assistive-mml', 'sre', 'semantic-enrich', 'explorer'];"
      );
      mathJaxConfig.push(
        "                            const missingModules = targetModules.filter(m => !a11yModules.includes(m));"
      );
      mathJaxConfig.push("");
      mathJaxConfig.push(
        "                            if (missingModules.length > 0) {"
      );
      mathJaxConfig.push(
        "                                console.warn('⚠️ Missing A11Y modules:', missingModules);"
      );
      mathJaxConfig.push("                            } else {");
      mathJaxConfig.push(
        "                                console.log('🎉 All accessibility modules loaded successfully');"
      );
      mathJaxConfig.push(
        "                                console.log('✅ Educational accessibility: READY');"
      );
      mathJaxConfig.push("                            }");
      mathJaxConfig.push("                        } catch (error) {");
      mathJaxConfig.push(
        "                            console.error('❌ A11Y verification failed:', error);"
      );
      mathJaxConfig.push("                        }");
      mathJaxConfig.push("                    }, 1000);");
      mathJaxConfig.push("                }");
      mathJaxConfig.push("            }");
      mathJaxConfig.push("        };");
      mathJaxConfig.push("        console.log('Enhanced MathJax config set');");
      mathJaxConfig.push("    </script>");
      mathJaxConfig.push("");

      // Enhanced MathJax loading with error handling and fallback
      mathJaxConfig.push("    <script>");
      mathJaxConfig.push(
        "        // Enhanced MathJax loading with error handling and fallback"
      );
      mathJaxConfig.push("        (function() {");
      mathJaxConfig.push(
        "            const script = document.createElement('script');"
      );
      mathJaxConfig.push("            script.id = 'MathJax-script';");
      mathJaxConfig.push(
        "            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js';"
      );
      mathJaxConfig.push("            script.async = true;");
      mathJaxConfig.push("");
      mathJaxConfig.push("            script.onload = function() {");
      mathJaxConfig.push(
        "                console.log('✅ Enhanced MathJax core script loaded successfully');"
      );
      mathJaxConfig.push("            };");
      mathJaxConfig.push("");
      mathJaxConfig.push("            script.onerror = function() {");
      mathJaxConfig.push(
        "                console.error('❌ Failed to load enhanced MathJax core script');"
      );
      mathJaxConfig.push(
        "                console.log('🔄 Falling back to standard CDN...');"
      );
      mathJaxConfig.push("");
      mathJaxConfig.push("                // Fallback to jsdelivr CDN");
      mathJaxConfig.push(
        "                const fallbackScript = document.createElement('script');"
      );
      mathJaxConfig.push(
        "                fallbackScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';"
      );
      mathJaxConfig.push("                fallbackScript.async = true;");
      mathJaxConfig.push("");
      mathJaxConfig.push(
        "                fallbackScript.onload = function() {"
      );
      mathJaxConfig.push(
        "                    console.log('✅ MathJax fallback script loaded');"
      );
      mathJaxConfig.push(
        "                    console.log('⚠️ Using standard configuration - reduced accessibility');"
      );
      mathJaxConfig.push("                };");
      mathJaxConfig.push("");
      mathJaxConfig.push(
        "                fallbackScript.onerror = function() {"
      );
      mathJaxConfig.push(
        "                    console.error('❌ Both CDNs failed - network issue detected');"
      );
      mathJaxConfig.push("                };");
      mathJaxConfig.push("");
      mathJaxConfig.push(
        "                document.head.appendChild(fallbackScript);"
      );
      mathJaxConfig.push("            };");
      mathJaxConfig.push("");
      mathJaxConfig.push("            document.head.appendChild(script);");
      mathJaxConfig.push("        })();");
      mathJaxConfig.push("    </script>");

      // Return the complete configuration
      const configString = mathJaxConfig.join("\n");

      logInfo(
        "Enhanced MathJax configuration generated successfully (matching index.html setup)"
      );
      return configString;
    } catch (error) {
      logError("Error generating MathJax configuration:", error);
      // ✅ CRITICAL: Even in error case, include basic MathJax loading
      return `<!-- Error generating MathJax configuration -->
<script>
  window.MathJax = {
      tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
      options: { enableMenu: true }
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>`;
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
  // DOCUMENT METADATA EXTRACTION (SHARED)
  // ===========================================================================================
  // Used by both legacy and enhanced methods for export generation

  /**
   * Extract document metadata from HTML content
   * Supports both LaTeX source patterns and Pandoc HTML output
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

      // ===========================================================================================
      // FIXED: Extract author (LaTeX and Pandoc HTML formats)
      // ===========================================================================================

      const latexAuthorMatch = content.match(/\\author\{([^}]+)\}/);
      if (latexAuthorMatch) {
        metadata.author = latexAuthorMatch[1]
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, "")
          .trim();
        logDebug("Found LaTeX author:", metadata.author);
      } else {
        // FIXED: Look for Pandoc's actual HTML class "author" (not "document-author")
        const htmlAuthorMatch = content.match(
          /<p[^>]+class="author"[^>]*>(.*?)<\/p>/i
        );
        if (htmlAuthorMatch) {
          metadata.author = htmlAuthorMatch[1].replace(/<[^>]+>/g, "").trim();
          logDebug("Found Pandoc HTML author:", metadata.author);
        } else {
          // Fallback: try the old "document-author" pattern
          const oldAuthorMatch = content.match(
            /<[^>]+class="document-author"[^>]*>(.*?)<\/[^>]+>/i
          );
          if (oldAuthorMatch) {
            metadata.author = oldAuthorMatch[1].replace(/<[^>]+>/g, "").trim();
            logDebug("Found document-author class:", metadata.author);
          }
        }
      }

      // ===========================================================================================
      // FIXED: Extract date (LaTeX and Pandoc HTML formats)
      // ===========================================================================================

      const latexDateMatch = content.match(/\\date\{([^}]+)\}/);
      if (latexDateMatch) {
        metadata.date = latexDateMatch[1]
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, "")
          .trim();
        logDebug("Found LaTeX date:", metadata.date);
      } else {
        // FIXED: Look for Pandoc's actual HTML class "date" (not "document-date")
        const htmlDateMatch = content.match(
          /<p[^>]+class="date"[^>]*>(.*?)<\/p>/i
        );
        if (htmlDateMatch) {
          metadata.date = htmlDateMatch[1].replace(/<[^>]+>/g, "").trim();
          logDebug("Found Pandoc HTML date:", metadata.date);
        } else {
          // Fallback: try the old "document-date" pattern
          const oldDateMatch = content.match(
            /<[^>]+class="document-date"[^>]*>(.*?)<\/[^>]+>/i
          );
          if (oldDateMatch) {
            metadata.date = oldDateMatch[1].replace(/<[^>]+>/g, "").trim();
            logDebug("Found document-date class:", metadata.date);
          }
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
  // PUBLIC API - SHARED UTILITIES ONLY
  // ===========================================================================================
  // STAGE 3 REFACTOR: Removed method-specific functions
  // - convertMathJaxToLatex() → moved to latex-processor-legacy.js
  // - extractLatexFromSemanticMathML() → moved to latex-processor-legacy.js
  // - extractLatexFromVisual() → moved to latex-processor-legacy.js
  // KEPT: Enhanced generateMathJaxConfig (used by head-generator.js)

  return {
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
