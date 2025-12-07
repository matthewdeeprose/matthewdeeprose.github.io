// latex-processor-legacy.js
// Legacy LaTeX Processor - Annotation-Based Export Method
// Preserves exact current behavior for backwards compatibility and comparison

const LaTeXProcessorLegacy = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[LATEX-LEGACY]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LATEX-LEGACY]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LATEX-LEGACY]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LATEX-LEGACY]", message, ...args);
  }

  // ===========================================================================================
  // PHASE 1F: ENVIRONMENT RECONSTRUCTION
  // ===========================================================================================

  /**
   * Detect multi-line math content and wrap in appropriate environment
   *
   * Problem: MathJax annotations strip \begin{align} wrappers, only keeping inner content
   * Solution: Detect alignment/multi-line patterns and reconstruct proper environment
   *
   * Detection Logic:
   * - Has & and \\ → align (aligned equations)
   * - Has \\ no & → gather (centred equations)
   * - No special chars → standard display/inline
   *
   * Limitations:
   * - Cannot distinguish align vs align* (numbered vs unnumbered)
   * - Specialised environments (alignat, multline) treated as align
   * - Edge case: & in text mode would trigger false positive (rare)
   *
   * @param {string} latex - The LaTeX content to wrap
   * @param {boolean} isDisplay - Whether this is display math (true) or inline (false)
   * @returns {string} - Wrapped LaTeX with appropriate delimiters/environment
   */
  function wrapInAppropriateEnvironment(latex, isDisplay, container = null) {
    // PHASE 1F PART D: PRIORITY 1 - Check for stored environment data
    if (container) {
      let envName = null;

      // The container might be mjx-container, but attributes are on parent span
      // Check both the container and its parent
      const elementsToCheck = [container, container.parentElement];

      for (const element of elementsToCheck) {
        if (!element || !element.getAttribute) continue;

        // Try data-math-env attribute (new attribute name)
        let attrValue = element.getAttribute("data-math-env");

        // Try data-latex-env attribute for backwards compatibility
        if (!attrValue) {
          attrValue = element.getAttribute("data-latex-env");
        }

        if (attrValue && attrValue !== null && typeof attrValue === "string") {
          // getAttribute always returns a string, so we use it directly
          // Validate it's not empty and not a JSON stringified object
          if (
            attrValue &&
            attrValue.length > 0 &&
            !attrValue.startsWith("{") &&
            !attrValue.startsWith("[")
          ) {
            envName = attrValue;
            logDebug(`✅ Using stored environment from registry: ${envName}`);
            break;
          } else {
            logWarn(`⚠️ Invalid attribute value: "${attrValue}"`);
          }
        }
      }

      if (envName) {
        return `\\begin{${envName}}\n${latex}\n\\end{${envName}}`;
      } else {
        logDebug(`⚠️ No environment data found on container or parent`);
      }
    }

    // Check if LaTeX already has environment wrapper (shouldn't happen, but be safe)
    if (/^\s*\\begin\{[^}]+\}/.test(latex)) {
      logDebug("LaTeX already has environment wrapper, returning as-is");
      return latex;
    }

    // FALLBACK: Heuristic detection when no environment data stored
    // Check for alignment character (&) - indicates align environment
    const hasAlignment = latex.includes("&");

    // Check for line breaks (\\) - indicates multi-line content
    const hasLineBreaks = latex.includes("\\\\") || latex.includes("\\\n");

    if (hasAlignment && hasLineBreaks) {
      // Multi-line with alignment → align* (default to unnumbered in fallback)
      logWarn("⚠️ No environment data found, defaulting to align* (heuristic)");
      return `\\begin{align*}\n${latex}\n\\end{align*}`;
    } else if (hasLineBreaks && !hasAlignment) {
      // Multi-line without alignment → gather* (default to unnumbered in fallback)
      logWarn(
        "⚠️ No environment data found, defaulting to gather* (heuristic)"
      );
      return `\\begin{gather*}\n${latex}\n\\end{gather*}`;
    } else if (isDisplay) {
      // Single-line display math → use \[...\]
      logDebug("Standard display math (no multi-line indicators)");
      return `\\[${latex}\\]`;
    } else {
      // Inline math → use \(...\)
      logDebug("Standard inline math");
      return `\\(${latex}\\)`;
    }
  }

  // ===========================================================================================
  // LEGACY ANNOTATION-BASED PROCESSING
  // ===========================================================================================

  /**
   * LEGACY METHOD: Convert pre-rendered MathJax back to LaTeX
   * This is the EXACT current implementation from latex-processor.js lines 53-191
   * Preserved for backwards compatibility and comparison testing
   *
   * IMPORTANT: Keep this IDENTICAL to original - no improvements, no changes!
   */
  function convertMathJaxToLatex(content, useLiveDOM = false) {
    logInfo("Converting pre-rendered MathJax elements back to LaTeX...");

    let tempDiv = null; // Track temp div for cleanup

    try {
      let processedContent = content;
      let conversionCount = 0;
      let doc;
      let mathContainers;

      // CRITICAL FIX: Use live DOM when available to preserve expression order
      // DOMParser can scramble large documents (200KB+)
      if (useLiveDOM && document.getElementById("output")) {
        logInfo(
          "✅ USING LIVE DOM for extraction (preserves order in large documents)"
        );

        // Work directly with the output div to preserve order
        const outputDiv = document.getElementById("output");

        // Clone it so we don't modify the visible page
        const clone = outputDiv.cloneNode(true);

        // Create a temporary container
        tempDiv = document.createElement("div");
        tempDiv.appendChild(clone);
        document.body.appendChild(tempDiv);
        tempDiv.style.display = "none";
        tempDiv.id = "temp-export-processing-" + Date.now(); // Unique ID

        // Get containers from the live DOM clone (preserves document order)
        mathContainers = tempDiv.querySelectorAll("mjx-container");

        logInfo(
          `✅ Found ${mathContainers.length} expressions in live DOM (order preserved)`
        );

        // We'll work with the clone and extract processed HTML at the end
        doc = { body: tempDiv };
      } else {
        // Find all mjx-container elements via DOMParser (old method)
        if (useLiveDOM) {
          logWarn(
            "⚠️ Live DOM requested but output div not found, using DOMParser"
          );
        } else {
          logInfo("Using DOMParser for extraction");
        }

        const parser = new DOMParser();
        doc = parser.parseFromString(content, "text/html");
        mathContainers = doc.querySelectorAll("mjx-container");
      }

      // CRITICAL FIX: Convert NodeList to Array to prevent iteration issues
      // When we modify outerHTML, it changes the DOM structure which can
      // affect NodeList iteration and cause expression reordering
      const mathContainersArray = Array.from(mathContainers);
      logDebug(`Processing ${mathContainersArray.length} math containers...`);

      // MARK AND REPLACE STRATEGY: Mark containers with data attributes, then replace all at once
      // This prevents DOM reference invalidation when modifying outerHTML
      const markerId = `latex-export-${Date.now()}`;
      let markerCount = 0;

      // PASS 1: Mark all containers with unique IDs and replacement LaTeX
      mathContainersArray.forEach((container, index) => {
        // CRITICAL: Skip TikZ placeholders - these contain preserved content for future rendering
        if (
          container.closest('[data-skip-latex-export="true"]') ||
          container.hasAttribute("data-tikz-math")
        ) {
          logDebug(`⏭️ Skipping TikZ placeholder at index ${index}`);
          return; // Don't process TikZ content
        }

        // Check if it has assistive MathML
        const mathML = container.querySelector("mjx-assistive-mml math");
        if (mathML) {
          // ENHANCED: Try multiple annotation encodings
          let annotation = mathML.querySelector(
            'annotation[encoding="application/x-tex"]'
          );

          // Also try alternative encodings
          if (!annotation) {
            annotation = mathML.querySelector('annotation[encoding="TeX"]');
          }
          if (!annotation) {
            annotation = mathML.querySelector('annotation[encoding="LaTeX"]');
          }

          if (annotation && annotation.textContent.trim()) {
            const latex = annotation.textContent.trim();
            const isDisplay = container.getAttribute("display") === "true";

            // ENHANCED: Better LaTeX validation
            if (latex && latex.length > 0 && !latex.includes("undefined")) {
              // PHASE 1F: Use environment reconstruction for proper wrapping
              const wrappedLatex = wrapInAppropriateEnvironment(
                latex,
                isDisplay,
                container
              );

              // CRITICAL FIX: Escape HTML entities before setting as HTML
              const escapeHTML = (str) =>
                str
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;");

              const safeWrappedLatex = escapeHTML(wrappedLatex);

              // MARK container with unique ID and store replacement text
              const uniqueId = `${markerId}-${markerCount++}`;
              container.setAttribute("data-replacement-id", uniqueId);
              container.setAttribute("data-replacement-text", safeWrappedLatex);

              // NEW: Add parent tracking for stability against index shifting
              const containerParent = container.parentElement;
              if (
                containerParent &&
                !containerParent.hasAttribute("data-math-parent-id")
              ) {
                const parentId = `parent-${markerId}-${markerCount}`;
                containerParent.setAttribute("data-math-parent-id", parentId);
                logDebug(`🔗 Parent tracking: ${parentId} for index ${index}`);
              }

              logDebug(
                `📝 Marked equation ${markerCount} (index ${index}): ${latex.substring(
                  0,
                  50
                )}...`
              );
            } else {
              logWarn(
                "Empty or invalid LaTeX annotation found, skipping conversion"
              );
            }
          } else {
            // ENHANCED: Better fallback with semantic structure preservation
            logInfo(
              "No LaTeX annotation found, attempting semantic extraction..."
            );
            const texContent = extractLatexFromSemanticMathML(mathML);
            if (texContent) {
              const isDisplay = container.getAttribute("display") === "true";
              // PHASE 1F: Use environment reconstruction for proper wrapping
              const wrappedLatex = wrapInAppropriateEnvironment(
                texContent,
                isDisplay,
                container
              );

              // CRITICAL FIX: Escape HTML entities (same as above)
              const escapeHTML = (str) =>
                str
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;");

              const safeWrappedLatex = escapeHTML(wrappedLatex);

              // MARK container with unique ID and store replacement text
              const uniqueId = `${markerId}-${markerCount++}`;
              container.setAttribute("data-replacement-id", uniqueId);
              container.setAttribute("data-replacement-text", safeWrappedLatex);

              // NEW: Add parent tracking for stability against index shifting
              const containerParentAlt = container.parentElement;
              if (
                containerParentAlt &&
                !containerParentAlt.hasAttribute("data-math-parent-id")
              ) {
                const parentId = `parent-${markerId}-${markerCount}`;
                containerParentAlt.setAttribute(
                  "data-math-parent-id",
                  parentId
                );
                logDebug(
                  `🔗 Parent tracking (semantic): ${parentId} for index ${index}`
                );
              }

              logDebug(
                `📝 Marked equation ${markerCount} (index ${index}) using semantic extraction: ${texContent}`
              );
            } else {
              logWarn(
                "Could not extract LaTeX from MathJax container, leaving as-is"
              );
            }
          }
        } else {
          logDebug("No MathML found in container, skipping");
        }
      });

      // PASS 2: Replace all marked containers IN REVERSE ORDER
      // CRITICAL: Process from last to first so earlier elements' positions stay stable
      logInfo(
        `🔄 Replacing ${markerCount} marked containers (reverse order)...`
      );
      const markedContainers = doc.body
        ? doc.body.querySelectorAll(`[data-replacement-id^="${markerId}"]`)
        : doc.querySelectorAll(`[data-replacement-id^="${markerId}"]`);

      // Convert to array and reverse to process from last to first
      const markedArray = Array.from(markedContainers).reverse();

      markedArray.forEach((container, reverseIndex) => {
        const replacement = container.getAttribute("data-replacement-text");
        if (replacement) {
          container.outerHTML = replacement;
          conversionCount++;
          // Log actual position (inverse of reverse index)
          const actualIndex = markedArray.length - reverseIndex - 1;
          logDebug(`✅ Converted marked equation at position ${actualIndex}`);
        }
      });

      // Also look for any span.math elements (older format)
      // CRITICAL FIX: Convert to array before iteration
      const mathSpans = doc.body
        ? doc.body.querySelectorAll("span.math")
        : doc.querySelectorAll("span.math");
      const mathSpansArray = Array.from(mathSpans);
      logDebug(`Processing ${mathSpansArray.length} span.math elements...`);

      // MARK AND REPLACE STRATEGY: Mark spans with data attributes, then replace all at once
      const spanMarkerId = `span-latex-export-${Date.now()}`;
      let spanMarkerCount = 0;

      // PASS 1: Mark all spans that need conversion
      mathSpansArray.forEach((span, index) => {
        // CRITICAL: Skip TikZ placeholders - these contain preserved content for future rendering
        if (
          span.closest('[data-skip-latex-export="true"]') ||
          span.hasAttribute("data-tikz-math")
        ) {
          logDebug(`⏭️ Skipping TikZ placeholder at index ${index}`);
          return; // Don't process TikZ content
        }

        const mathContainer = span.querySelector("mjx-container");
        if (!mathContainer) {
          // Already has raw LaTeX, keep it
          return;
        }
        // Process as above with same enhanced logic
        const mathML = mathContainer.querySelector("mjx-assistive-mml math");
        if (mathML) {
          let annotation = mathML.querySelector(
            'annotation[encoding="application/x-tex"]'
          );

          if (!annotation) {
            annotation = mathML.querySelector('annotation[encoding="TeX"]');
          }
          if (!annotation) {
            annotation = mathML.querySelector('annotation[encoding="LaTeX"]');
          }

          if (annotation && annotation.textContent.trim()) {
            const latex = annotation.textContent.trim();
            const isDisplay = span.classList.contains("display");
            if (latex && latex.length > 0 && !latex.includes("undefined")) {
              // PHASE 1F: Use environment reconstruction for proper wrapping
              const wrappedLatex = wrapInAppropriateEnvironment(
                latex,
                isDisplay,
                mathContainer
              );

              // MARK span with unique ID and store replacement text
              const uniqueId = `${spanMarkerId}-${spanMarkerCount++}`;
              span.setAttribute("data-replacement-id", uniqueId);
              span.setAttribute("data-replacement-text", wrappedLatex);

              // NEW: Add parent tracking for stability against index shifting
              const spanParent = span.parentElement;
              if (
                spanParent &&
                !spanParent.hasAttribute("data-math-parent-id")
              ) {
                const parentId = `parent-span-${spanMarkerId}-${spanMarkerCount}`;
                spanParent.setAttribute("data-math-parent-id", parentId);
                logDebug(`🔗 Parent tracking: ${parentId} for index ${index}`);
              }

              logDebug(
                `📝 Marked span equation (index ${index}): ${latex.substring(
                  0,
                  50
                )}...`
              );
            }
          }
        }
      });

      // PASS 2: Replace all marked spans IN REVERSE ORDER
      // CRITICAL: Process from last to first so earlier elements' positions stay stable
      logInfo(
        `🔄 Replacing ${spanMarkerCount} marked span elements (reverse order)...`
      );
      const markedSpans = doc.body
        ? doc.body.querySelectorAll(`[data-replacement-id^="${spanMarkerId}"]`)
        : doc.querySelectorAll(`[data-replacement-id^="${spanMarkerId}"]`);

      // Convert to array and reverse to process from last to first
      const markedSpansArray = Array.from(markedSpans).reverse();

      markedSpansArray.forEach((span, reverseIndex) => {
        const replacement = span.getAttribute("data-replacement-text");
        if (replacement) {
          span.innerHTML = replacement;
          conversionCount++;
          // Log actual position (inverse of reverse index)
          const actualIndex = markedSpansArray.length - reverseIndex - 1;
          logDebug(
            `✅ Converted marked span equation at position ${actualIndex}`
          );
        }
      });

      // Get the processed HTML
      processedContent = doc.body.innerHTML;

      // CRITICAL FIX: Clean up temporary div if it was created
      if (tempDiv && tempDiv.parentNode) {
        logDebug("Cleaning up temporary DOM element...");
        tempDiv.parentNode.removeChild(tempDiv);
        logDebug("✅ Temporary DOM element removed");
      }

      logInfo(
        `✅ Successfully converted ${conversionCount} pre-rendered MathJax elements back to LaTeX`
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

      // PHASE 1F PART B: Check for invalid nesting and clean if enabled
      // This handles direct calls to convertMathJaxToLatex (e.g., from enhanced processor)
      if (
        window.AppConfig?.CONFIG?.LATEX_PROCESSOR?.CLEAN_INVALID_NESTING !==
        false
      ) {
        if (detectInvalidNesting(processedContent)) {
          processedContent = cleanInvalidNesting(processedContent);
        }
      }

      return processedContent;
    } catch (error) {
      logError("Error converting MathJax to LaTeX:", error);

      // CRITICAL FIX: Ensure cleanup even on error
      if (tempDiv && tempDiv.parentNode) {
        logDebug("Cleaning up temporary DOM element after error...");
        tempDiv.parentNode.removeChild(tempDiv);
      }

      // Return original content if conversion fails
      return content;
    }
  }

  /**
   * ENHANCED: Extract LaTeX from semantic MathML structure
   * EXACT COPY from latex-processor.js lines 197-618
   * This preserves mathematical structure better than text extraction
   *
   * IMPORTANT: Keep this IDENTICAL to original!
   */
  function extractLatexFromSemanticMathML(mathML) {
    // PASTE EXACT COPY HERE from latex-processor.js lines 197-618
    // This is a long function - copy completely from original

    try {
      logInfo("Attempting semantic MathML to LaTeX conversion...");

      // Start with the root math element
      const mathElement = mathML.querySelector("math") || mathML;

      // Simple recursive conversion for common structures
      const convertElement = (element) => {
        if (!element) return "";

        const tagName = element.tagName.toLowerCase();
        const textContent = element.textContent.trim();

        switch (tagName) {
          case "math":
            // Process children
            return Array.from(element.children).map(convertElement).join("");

          case "mi": // Identifier (variables)
            return textContent;

          case "mn": // Number
            return textContent;

          case "mo": // Operator
            const op = textContent;
            // Map special operators
            if (op === "⁢") return ""; // Invisible times - omit
            if (op === "∅") return "\\varnothing";
            return op;

          case "msup": // Superscript
            const base = element.children[0]
              ? convertElement(element.children[0])
              : "";
            const sup = element.children[1]
              ? convertElement(element.children[1])
              : "";
            return `${base}^{${sup}}`;

          case "msub": // Subscript
            const baseS = element.children[0]
              ? convertElement(element.children[0])
              : "";
            const sub = element.children[1]
              ? convertElement(element.children[1])
              : "";
            return `${baseS}_{${sub}}`;

          case "mfrac": // Fraction
            const num = element.children[0]
              ? convertElement(element.children[0])
              : "";
            const denom = element.children[1]
              ? convertElement(element.children[1])
              : "";
            return `\\frac{${num}}{${denom}}`;

          case "mrow": // Row (grouping)
            return Array.from(element.children).map(convertElement).join("");

          case "mspace": // Space
            return " ";

          case "mtext": // Text
            return `\\text{${textContent}}`;

          case "msqrt": // Square root
            const content = Array.from(element.children)
              .map(convertElement)
              .join("");
            return `\\sqrt{${content}}`;

          case "mroot": // nth root
            const contentR = element.children[0]
              ? convertElement(element.children[0])
              : "";
            const index = element.children[1]
              ? convertElement(element.children[1])
              : "";
            return `\\sqrt[${index}]{${contentR}}`;

          default:
            logWarn(`Unhandled MathML element: ${tagName}`);
            return textContent;
        }
      };

      const result = convertElement(mathElement);
      logDebug(`Semantic extraction result: ${result}`);
      return result;
    } catch (error) {
      logError("Error in semantic MathML extraction:", error);
      return null;
    }
  }

  /**
   * PHASE 1F PART B: Detect invalid nested environments
   * Example: \begin{equation}\begin{align}...\end{align}\end{equation}
   * This is invalid LaTeX - equation is single-line, cannot wrap multi-line align
   *
   * @param {string} content - HTML content to check
   * @returns {boolean} - True if invalid nesting detected
   */
  function detectInvalidNesting(content) {
    const patterns = [
      // Equation wrapping align/gather (any variant)
      /\\begin\{equation\}[^]*?\\begin\{(align\*?|gather\*?)\}/gi,
      // Align/gather inside equation with matching end tags
      /\\begin\{(align\*?|gather\*?)\}[^]*?\\end\{\1\}[^]*?\\end\{equation\}/gi,
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * PHASE 1F PART B: Clean invalid nested environments
   * Removes \begin{equation}...\end{equation} wrappers around multi-line environments
   *
   * @param {string} content - HTML content to clean
   * @returns {string} - Cleaned content
   */
  function cleanInvalidNesting(content) {
    logWarn("⚠️ Invalid nested environments detected - auto-cleaning");

    // Remove equation wrapper around align/gather (any variant)
    let cleaned = content.replace(
      /\\begin\{equation\}\s*(\\begin\{(align\*?|gather\*?)\}[^]*?\\end\{\2\})\s*\\end\{equation\}/gi,
      "$1"
    );

    if (cleaned !== content) {
      logInfo(
        "✅ Removed invalid equation wrappers around multi-line environments"
      );

      // Optional: Show UI warning if enabled
      if (window.AppConfig?.CONFIG?.LATEX_PROCESSOR?.UI_WARNINGS_ENABLED) {
        if (window.UniversalNotifications) {
          window.UniversalNotifications.warning(
            "Cleaned invalid LaTeX nesting (equation wrapping align/gather)"
          );
        }
      }
    }

    return cleaned;
  }

  /**
   * Main processing function for legacy method
   * Uses shared utilities from core LaTeXProcessor module
   * @param {Object} options - Processing options
   * @param {string} options.content - HTML content to process
   * @returns {Promise<string>} - Processed HTML content
   */
  async function process(options) {
    logInfo("🔙 LEGACY METHOD: Starting annotation-based processing");

    const { content } = options;

    // STAGE 3: Always use shared utilities (no longer conditional)
    if (!window.LaTeXProcessor) {
      throw new Error(
        "[LATEX-LEGACY] Core LaTeXProcessor module not available. " +
          "Shared utilities required for legacy processing."
      );
    }

    // Step 1: Validate syntax using shared utility
    const validation = window.LaTeXProcessor.validateLatexSyntax(content);
    if (!validation.valid) {
      logWarn("⚠️ Syntax issues detected:", validation.issues);
      // Continue anyway - might be false positives
    }

    // Step 2: Clean content using shared utility
    const cleanedContent = window.LaTeXProcessor.cleanLatexContent(content);
    logDebug("Content cleaned, length:", cleanedContent.length);

    // Step 3: Process with legacy annotation-based method
    // CRITICAL FIX: Use live DOM when available to preserve order in large documents
    const useLiveDOM = document.getElementById("output") !== null;
    if (useLiveDOM) {
      logInfo(
        "🎯 Export context detected - using live DOM for order preservation"
      );
    }
    let processedContent = convertMathJaxToLatex(cleanedContent, useLiveDOM);

    // PHASE 1F PART B: Check for invalid nesting and clean if enabled
    // CRITICAL: This runs AFTER conversion when we have actual LaTeX to check
    if (
      window.AppConfig?.CONFIG?.LATEX_PROCESSOR?.CLEAN_INVALID_NESTING !== false
    ) {
      if (detectInvalidNesting(processedContent)) {
        processedContent = cleanInvalidNesting(processedContent);
      }
    }

    logInfo("✅ LEGACY METHOD: Processing complete");
    logInfo(`   Input length: ${content.length} chars`);
    logInfo(`   Output length: ${processedContent.length} chars`);

    return processedContent;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    process,
    convertMathJaxToLatex,
    extractLatexFromSemanticMathML,
    wrapInAppropriateEnvironment, // PHASE 1F: Expose for testing
  };
})();

// Make globally available for other modules
window.LaTeXProcessorLegacy = LaTeXProcessorLegacy;
