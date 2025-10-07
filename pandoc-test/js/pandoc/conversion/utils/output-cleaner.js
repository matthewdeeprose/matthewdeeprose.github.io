// output-cleaner.js
// Pandoc Output Cleaning Utilities
// Handles HTML cleaning, duplicate removal, and body content extraction
// Uses modular logging system from Phase 1

const OutputCleaner = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("OUTPUT_CLEANER", {
    level: window.LoggingSystem.LOG_LEVELS.WARN, // Less verbose for utilities
  }) || {
    logError: console.error.bind(console, "[OUTPUT_CLEANER]"),
    logWarn: console.warn.bind(console, "[OUTPUT_CLEANER]"),
    logInfo: console.log.bind(console, "[OUTPUT_CLEANER]"),
    logDebug: console.log.bind(console, "[OUTPUT_CLEANER]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // HTML CLEANING UTILITIES
  // ===========================================================================================

  /**
   * Clean Pandoc output for display
   * ENHANCED: Now removes duplicate title blocks from chunked processing and fixes cross-references
   * @param {string} output - Raw Pandoc HTML output
   * @param {string} originalLatexInput - Original LaTeX input for enhanced cross-reference fixing (optional)
   * @returns {string} - Cleaned HTML content with working cross-references
   */
  function cleanPandocOutput(output, originalLatexInput = null) {
    logDebug("Starting Pandoc output cleaning...");

    if (!output || typeof output !== "string") {
      logWarn("Invalid output provided to cleanPandocOutput");
      return "";
    }

    let cleanOutput = output;

    // Extract only the body content if Pandoc generated a complete HTML document
    if (output.includes("<html") && output.includes("<body")) {
      const bodyMatch = output.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        cleanOutput = bodyMatch[1];
        logInfo("Extracted body content from complete HTML document");
      }
    } else if (output.includes("<head>") || output.includes("<meta")) {
      // Remove any head elements that might have been included
      cleanOutput = cleanOutput
        .replace(/<head[\s\S]*?<\/head>/gi, "")
        .replace(/<meta[^>]*>/gi, "")
        .replace(/<link[^>]*>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "");
      logInfo("Cleaned HTML output of head elements");
    }

    // ENHANCEMENT: Remove duplicate title blocks (fixes chunked processing issue)
    cleanOutput = removeDuplicateTitleBlocks(cleanOutput);

    // ENHANCEMENT: Fix cross-references after HTML cleaning is complete
    // TIMING FIX: Defer cross-reference fixing to next tick to ensure DOM is ready
    const finalOutput = cleanOutput.trim();

    // Schedule cross-reference fixing to run after DOM is updated
    setTimeout(() => {
      if (window.CrossReferenceFixer) {
        logInfo("🔗 Running deferred cross-reference fixing...");
        const fixResults =
          window.CrossReferenceFixer.fixCrossReferences(originalLatexInput);
        if (fixResults && fixResults.fixed > 0) {
          logInfo(
            `✅ Deferred cross-reference fixing: ${fixResults.fixed} anchors created`
          );
        }
      }
    }, 200); // Small delay to ensure MathJax and DOM are ready

    logDebug(`Output cleaning complete: ${finalOutput.length} characters`);
    return finalOutput;
  }

  /**
   * Fix cross-references in cleaned HTML output
   * @param {string} htmlOutput - Cleaned HTML output
   * @param {string} originalLatexInput - Original LaTeX input for enhanced analysis
   * @returns {string} - HTML output with fixed cross-references
   */
  function fixCrossReferencesInOutput(htmlOutput, originalLatexInput) {
    logDebug("Starting cross-reference fixing in cleaned output...");

    try {
      // OPTIMIZATION: Detect if this is part of chunked processing
      const isChunkedProcessing =
        window.ChunkedProcessingEngine?.isProcessing === true;

      if (isChunkedProcessing) {
        // Skip fixing during individual chunks, rely on post-assembly fixing
        logDebug(
          "Chunked processing detected - deferring cross-reference fixing to post-assembly"
        );
        return htmlOutput;
      }

      // Get the output div for cross-reference fixing
      const outputDiv = document.getElementById("output");
      const originalContent = outputDiv ? outputDiv.innerHTML : "";

      if (outputDiv) {
        // Insert HTML into DOM for processing
        outputDiv.innerHTML = htmlOutput;

        // Apply cross-reference fixing if module is available
        if (window.CrossReferenceFixer) {
          const fixResults =
            window.CrossReferenceFixer.fixCrossReferences(originalLatexInput);

          if (fixResults && fixResults.fixed > 0) {
            logInfo(
              `Cross-reference fixing: ${fixResults.fixed} anchors created, ${fixResults.failed} failed`
            );

            // Get the enhanced HTML back from the DOM
            const enhancedHtml = outputDiv.innerHTML;

            // SUCCESS: Keep anchors in live DOM, don't restore original content
            // The anchors must remain in the DOM for cross-references to work
            logDebug(
              "Cross-reference fixing completed successfully - anchors preserved in DOM"
            );
            return enhancedHtml;
          } else {
            logDebug(
              "No cross-references needed fixing or no references found"
            );
            // Only restore original content if no fixes were made
            outputDiv.innerHTML = originalContent;
          }
        } else {
          logWarn(
            "CrossReferenceFixer module not available - skipping cross-reference fixing"
          );
          // Only restore original content if CrossReferenceFixer not available
          outputDiv.innerHTML = originalContent;
        }
      } else {
        logWarn("Output div not found - cross-reference fixing skipped");
      }
    } catch (error) {
      logError("Error during cross-reference fixing:", error);
      // On error, try to restore original content if we have access to outputDiv
      const outputDiv = document.getElementById("output");
      if (outputDiv && typeof originalContent !== "undefined") {
        outputDiv.innerHTML = originalContent;
      }
    }

    // Return original HTML if fixing failed or wasn't needed
    return htmlOutput;
  }

  /**
   * Remove duplicate title blocks from chunked processing
   * @param {string} content - HTML content to process
   * @returns {string} - Content with duplicate title blocks removed
   */
  function removeDuplicateTitleBlocks(content) {
    const titleBlockRegex =
      /<header id="title-block-header">[\s\S]*?<\/header>/g;
    const titleBlocks = content.match(titleBlockRegex);

    if (titleBlocks && titleBlocks.length > 1) {
      logInfo(
        `Removing ${
          titleBlocks.length - 1
        } duplicate title blocks from chunked processing`
      );

      // Keep the first title block, remove all others
      const firstTitleBlock = titleBlocks[0];
      let cleanContent = content.replace(titleBlockRegex, "");

      // Add the first title block back at the beginning
      cleanContent = firstTitleBlock + "\n" + cleanContent;

      logInfo("✅ Duplicate title blocks removed successfully");
      return cleanContent;
    }

    return content;
  }

  /**
   * Extract body content from complete HTML document
   * @param {string} htmlContent - Complete HTML document
   * @returns {string} - Body content only
   */
  function extractBodyContent(htmlContent) {
    if (!htmlContent.includes("<body")) {
      logDebug("No body tag found, returning content as-is");
      return htmlContent;
    }

    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      logInfo("Successfully extracted body content from complete HTML");
      return bodyMatch[1];
    }

    logWarn("Body tag found but content extraction failed");
    return htmlContent;
  }

  /**
   * Remove head elements and metadata from partial HTML
   * @param {string} htmlContent - HTML content with potential head elements
   * @returns {string} - Cleaned content without head elements
   */
  function removeHeadElements(htmlContent) {
    const elementsToRemove = [
      /<head[\s\S]*?<\/head>/gi,
      /<meta[^>]*>/gi,
      /<link[^>]*>/gi,
      /<style[\s\S]*?<\/style>/gi,
      /<script[\s\S]*?<\/script>/gi,
    ];

    let cleanedContent = htmlContent;
    let removedCount = 0;

    elementsToRemove.forEach((regex) => {
      const matches = cleanedContent.match(regex);
      if (matches) {
        removedCount += matches.length;
        cleanedContent = cleanedContent.replace(regex, "");
      }
    });

    if (removedCount > 0) {
      logInfo(`Removed ${removedCount} head elements from HTML content`);
    }

    return cleanedContent;
  }

  /**
   * Comprehensive HTML sanitisation for export
   * @param {string} htmlContent - HTML content to sanitise
   * @returns {string} - Sanitised HTML content
   */
  function sanitiseHTMLForExport(htmlContent) {
    logDebug("Performing comprehensive HTML sanitisation...");

    let sanitised = htmlContent;

    // Remove dangerous script and object elements
    sanitised = sanitised
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<object[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[\s\S]*?>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

    // Clean up malformed HTML
    sanitised = sanitised
      .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
      .replace(/\s+/g, " ") // Normalise whitespace
      .replace(/>\s+</g, "><"); // Remove whitespace between tags

    logInfo("HTML sanitisation completed for export");
    return sanitised.trim();
  }

  // ===========================================================================================
  // TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Test output cleaner functionality
   */
  function testOutputCleaner() {
    const tests = {
      moduleExists: () => !!window.OutputCleaner,

      cleanPandocOutputExists: () => typeof cleanPandocOutput === "function",

      handlesEmptyInput: () => {
        const result = cleanPandocOutput("");
        return result === "";
      },

      extractsBodyContent: () => {
        const testHTML = "<html><body><p>Test content</p></body></html>";
        const result = cleanPandocOutput(testHTML);
        return result === "<p>Test content</p>";
      },

      removesHeadElements: () => {
        const testHTML = "<head><title>Test</title></head><p>Content</p>";
        const result = cleanPandocOutput(testHTML);
        return result === "<p>Content</p>";
      },

      removesDuplicateTitles: () => {
        const testHTML = `
            <header id="title-block-header"><h1>Title</h1></header>
            <p>Content</p>
            <header id="title-block-header"><h1>Title</h1></header>
          `;
        const result = cleanPandocOutput(testHTML);
        const titleCount = (
          result.match(/<header id="title-block-header">/g) || []
        ).length;
        return titleCount === 1;
      },

      utilityFunctionsWork: () => {
        return (
          typeof extractBodyContent === "function" &&
          typeof removeHeadElements === "function" &&
          typeof sanitiseHTMLForExport === "function"
        );
      },
    };

    // Run tests using TestUtilities pattern from Phase 1
    if (window.TestUtilities?.runTestSuite) {
      return window.TestUtilities.runTestSuite("OutputCleaner", tests);
    }

    // Fallback testing if TestUtilities not available
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 OutputCleaner: ${passed}/${total} tests passed`);

    return {
      success: success,
      allPassed: success,
      passed: passed,
      total: total,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core cleaning functions
    cleanPandocOutput,
    cleanOutput: cleanPandocOutput, // Alias for ConversionEngine compatibility
    removeDuplicateTitleBlocks,
    extractBodyContent,
    removeHeadElements,
    sanitiseHTMLForExport,

    // Testing
    testOutputCleaner,
  };
})();

window.OutputCleaner = OutputCleaner;
