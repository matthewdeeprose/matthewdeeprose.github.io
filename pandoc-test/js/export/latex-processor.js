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
   * Enhanced MathJax configuration with comprehensive tabindex debugging
   * Phase 3.1: Clean implementation with proper syntax and debugging
   */
  function generateMathJaxConfig(accessibilityLevel = 2, dynamicOptions = {}) {
    logInfo(
      `Generating simplified MathJax configuration - Level ${accessibilityLevel} with comprehensive debugging`
    );
    logDebug("Dynamic options received:", dynamicOptions);

    try {
      // Extract dynamic options with defaults
      const zoomTrigger = dynamicOptions.zoomTrigger || "DoubleClick";
      const zoomScale = dynamicOptions.zoomScale || "200%";
      const inTabOrder =
        dynamicOptions.inTabOrder !== undefined
          ? dynamicOptions.inTabOrder
          : true;
      const assistiveMml =
        dynamicOptions.assistiveMml !== undefined
          ? dynamicOptions.assistiveMml
          : true;

      const mathJaxConfig = [];

      mathJaxConfig.push(
        "    <!-- Enhanced MathJax Configuration with Phase 3.1 Debugging -->"
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

      // Core MathJax options
      mathJaxConfig.push("            options: {");
      mathJaxConfig.push("                enableMenu: true,");
      mathJaxConfig.push("                ignoreHtmlClass: 'tex2jax_ignore',");
      mathJaxConfig.push(
        "                processHtmlClass: 'tex2jax_process',"
      );
      mathJaxConfig.push("                menuOptions: {");
      mathJaxConfig.push("                    settings: {");
      mathJaxConfig.push("                        texHints: true,");
      mathJaxConfig.push("                        semantics: false,");
      mathJaxConfig.push(`                        zoom: '${zoomTrigger}',`);
      mathJaxConfig.push(`                        zscale: '${zoomScale}',`);
      mathJaxConfig.push(`                        inTabOrder: false,`);
      mathJaxConfig.push(
        `                        assistiveMml: ${assistiveMml},`
      );
      mathJaxConfig.push("                        explorer: true");
      mathJaxConfig.push("                    }");
      mathJaxConfig.push("                }");
      mathJaxConfig.push("            },");

      // Loader configuration
      mathJaxConfig.push("            loader: {");
      mathJaxConfig.push(
        "                load: ['input/tex', 'output/chtml', 'ui/menu']"
      );
      mathJaxConfig.push("            },");

      // Startup configuration with enhanced debugging
      mathJaxConfig.push("            startup: {");
      mathJaxConfig.push("                pageReady: () => {");
      mathJaxConfig.push(
        "                    console.log('🚀 MathJax pageReady - Phase 3.1 Debugging Active');"
      );
      mathJaxConfig.push(
        "                    return MathJax.startup.defaultPageReady().then(() => {"
      );
      mathJaxConfig.push(
        "                        console.log('✅ MathJax defaultPageReady completed');"
      );
      mathJaxConfig.push("                        ");
      mathJaxConfig.push(
        "                        // Phase 3.1: Comprehensive Element Analysis"
      );
      mathJaxConfig.push("                        setTimeout(() => {");
      mathJaxConfig.push(
        "                            console.log('🔍 === PHASE 3.1 COMPREHENSIVE DEBUGGING ===');"
      );
      mathJaxConfig.push("                            ");
      mathJaxConfig.push(
        "                            const allContainers = document.querySelectorAll('mjx-container');"
      );
      mathJaxConfig.push(
        "                            console.log(`📊 Total mjx-container elements found: ${allContainers.length}`);"
      );
      mathJaxConfig.push("                            ");
      mathJaxConfig.push(
        "                            // Analyze structure before our processing"
      );
      mathJaxConfig.push("                            let mainElements = 0;");
      mathJaxConfig.push(
        "                            let assistiveElements = 0;"
      );
      mathJaxConfig.push(
        "                            let elementsWithTabindex = 0;"
      );
      mathJaxConfig.push("                            ");
      mathJaxConfig.push(
        "                            allContainers.forEach((el, index) => {"
      );
      mathJaxConfig.push(
        "                                const isAssistive = !!el.closest('mjx-assistive-mml');"
      );
      mathJaxConfig.push(
        "                                const hasTabindex = el.hasAttribute('tabindex');"
      );
      mathJaxConfig.push(
        "                                const tabindexValue = el.getAttribute('tabindex');"
      );
      mathJaxConfig.push("                                ");
      mathJaxConfig.push("                                if (isAssistive) {");
      mathJaxConfig.push(
        "                                    assistiveElements++;"
      );
      mathJaxConfig.push("                                } else {");
      mathJaxConfig.push("                                    mainElements++;");
      mathJaxConfig.push("                                }");
      mathJaxConfig.push("                                ");
      mathJaxConfig.push("                                if (hasTabindex) {");
      mathJaxConfig.push(
        "                                    elementsWithTabindex++;"
      );
      mathJaxConfig.push(
        "                                    console.log(`⚠️ Element ${index + 1} already has tabindex '${tabindexValue}' - isAssistive: ${isAssistive}`);"
      );
      mathJaxConfig.push("                                }");
      mathJaxConfig.push("                            });");
      mathJaxConfig.push("                            ");
      mathJaxConfig.push(
        "                            console.log(`📊 Main elements (should get tabindex): ${mainElements}`);"
      );
      mathJaxConfig.push(
        "                            console.log(`📊 Assistive elements (should NOT get tabindex): ${assistiveElements}`);"
      );
      mathJaxConfig.push(
        "                            console.log(`📊 Elements with existing tabindex: ${elementsWithTabindex}`);"
      );
      mathJaxConfig.push("                            ");
      mathJaxConfig.push(
        "                            // Only proceed if we should apply tabindex"
      );
      mathJaxConfig.push(`                            if (${inTabOrder}) {`);
      mathJaxConfig.push(
        "                                console.log('🎯 Applying tabindex to main elements only...');"
      );
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                // Filter for main elements only"
      );
      mathJaxConfig.push(
        "                                const mainMathElements = Array.from(allContainers).filter(element => {"
      );
      mathJaxConfig.push(
        "                                    return !element.closest('mjx-assistive-mml');"
      );
      mathJaxConfig.push("                                });");
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                console.log(`🔧 Processing ${mainMathElements.length} main elements...`);"
      );
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                mainMathElements.forEach((el, index) => {"
      );
      mathJaxConfig.push(
        "                                    // Apply ARIA attributes"
      );
      mathJaxConfig.push(
        "                                    if (!el.getAttribute('role')) {"
      );
      mathJaxConfig.push(
        "                                        el.setAttribute('role', 'img');"
      );
      mathJaxConfig.push("                                    }");
      mathJaxConfig.push(
        "                                    if (!el.getAttribute('aria-label')) {"
      );
      mathJaxConfig.push(
        "                                        el.setAttribute('aria-label', `Mathematical expression ${index + 1}. Right-click for options.`);"
      );
      mathJaxConfig.push("                                    }");
      mathJaxConfig.push("                                    ");
      mathJaxConfig.push(
        "                                    // Apply tabindex"
      );
      mathJaxConfig.push(
        "                                    el.setAttribute('tabindex', '0');"
      );
      mathJaxConfig.push("                                    ");
      mathJaxConfig.push(
        "                                    console.log(`✅ Applied tabindex to main element ${index + 1}`);"
      );
      mathJaxConfig.push("                                });");
      mathJaxConfig.push("                            } else {");
      mathJaxConfig.push(
        "                                console.log('🚫 inTabOrder is false - not applying tabindex');"
      );
      mathJaxConfig.push("                            }");
      mathJaxConfig.push("                            ");
      mathJaxConfig.push("                            // Final verification");
      mathJaxConfig.push("                            setTimeout(() => {");
      mathJaxConfig.push(
        "                                console.log('🔍 === FINAL VERIFICATION ===');"
      );
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                const finalContainers = document.querySelectorAll('mjx-container');"
      );
      mathJaxConfig.push(
        "                                const mainWithTabindex = Array.from(finalContainers).filter(el => "
      );
      mathJaxConfig.push(
        "                                    !el.closest('mjx-assistive-mml') && el.getAttribute('tabindex') === '0'"
      );
      mathJaxConfig.push("                                ).length;");
      mathJaxConfig.push(
        "                                const assistiveWithTabindex = Array.from(finalContainers).filter(el => "
      );
      mathJaxConfig.push(
        "                                    el.closest('mjx-assistive-mml') && el.getAttribute('tabindex') === '0'"
      );
      mathJaxConfig.push("                                ).length;");
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                console.log(`📊 Final results:`);"
      );
      mathJaxConfig.push(
        "                                console.log(`   ✅ Main elements with tabindex: ${mainWithTabindex}`);"
      );
      mathJaxConfig.push(
        "                                console.log(`   ❌ Assistive elements with tabindex: ${assistiveWithTabindex}`);"
      );
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                if (assistiveWithTabindex === 0) {"
      );
      mathJaxConfig.push(
        "                                    console.log('🎉 SUCCESS: No duplicate tab navigation - assistive elements properly excluded!');"
      );
      mathJaxConfig.push("                                } else {");
      mathJaxConfig.push(
        "                                    console.error('🚨 PROBLEM: Assistive elements still have tabindex - duplicate navigation will occur');"
      );
      mathJaxConfig.push("                                }");
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                // Create debugging function for console access"
      );
      mathJaxConfig.push(
        "                                window.debugTabIndex = function() {"
      );
      mathJaxConfig.push(
        "                                    console.log('🔍 === MANUAL DEBUG ANALYSIS ===');"
      );
      mathJaxConfig.push(
        "                                    const containers = document.querySelectorAll('mjx-container');"
      );
      mathJaxConfig.push(
        "                                    console.log(`📊 Total: ${containers.length}`);"
      );
      mathJaxConfig.push("                                    ");
      mathJaxConfig.push(
        "                                    containers.forEach((el, i) => {"
      );
      mathJaxConfig.push(
        "                                        const isAssistive = !!el.closest('mjx-assistive-mml');"
      );
      mathJaxConfig.push(
        "                                        const hasTab = el.getAttribute('tabindex') === '0';"
      );
      mathJaxConfig.push(
        "                                        console.log(`   ${i+1}: ${isAssistive ? 'ASSISTIVE' : 'MAIN'} - tabindex: ${hasTab ? 'YES' : 'NO'}`);"
      );
      mathJaxConfig.push("                                    });");
      mathJaxConfig.push("                                };");
      mathJaxConfig.push("                                ");
      mathJaxConfig.push(
        "                                // Create focus tracking function"
      );
      mathJaxConfig.push(
        "                                window.trackFocus = function() {"
      );
      mathJaxConfig.push(
        "                                    let focusCount = 0;"
      );
      mathJaxConfig.push(
        "                                    document.addEventListener('focus', (e) => {"
      );
      mathJaxConfig.push(
        "                                        if (e.target.matches('mjx-container')) {"
      );
      mathJaxConfig.push(
        "                                            focusCount++;"
      );
      mathJaxConfig.push(
        "                                            const isAssistive = !!e.target.closest('mjx-assistive-mml');"
      );
      mathJaxConfig.push(
        "                                            console.log(`🎯 Focus #${focusCount}: ${isAssistive ? 'ASSISTIVE' : 'MAIN'} element`);"
      );
      mathJaxConfig.push("                                        }");
      mathJaxConfig.push("                                    }, true);");
      mathJaxConfig.push(
        "                                    console.log('👂 Focus tracking enabled - tab through math elements to see results');"
      );
      mathJaxConfig.push("                                };");
      mathJaxConfig.push("                            }, 500);");
      mathJaxConfig.push("                        }, 1000);");
      mathJaxConfig.push("                        ");
      mathJaxConfig.push(
        "                        // Initialize dynamic manager if available"
      );
      mathJaxConfig.push("                        setTimeout(() => {");
      mathJaxConfig.push(
        "                            if (window.dynamicMathJaxManager) {"
      );
      mathJaxConfig.push(
        "                                window.dynamicMathJaxManager.initialise();"
      );
      mathJaxConfig.push(
        "                                console.log('✅ Dynamic MathJax Manager initialised');"
      );
      mathJaxConfig.push("                            }");
      mathJaxConfig.push("                        }, 100);");
      mathJaxConfig.push("                    });");
      mathJaxConfig.push("                }");
      mathJaxConfig.push("            }");
      mathJaxConfig.push("        };");
      mathJaxConfig.push("    </script>");

      // ✅ CRITICAL FIX: Add the MathJax CDN script tag
      mathJaxConfig.push(
        '    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>'
      );

      // Return the complete configuration
      const configString = mathJaxConfig.join("\n");

      logInfo(
        "Enhanced MathJax configuration generated successfully with Phase 3.1 debugging and CDN script"
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
