// ===========================================================================================
// FOOTER GENERATOR MODULE
// ===========================================================================================
// Purpose: Generate document footer HTML with source viewer integration
// Dependencies: SourceViewer (optional, with graceful fallback)
// Used by: ExportManager during document generation
// Version: 1.0.0
// Phase: 3.6 - Extracted from export-manager.js
// ===========================================================================================

const FooterGenerator = (function () {
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

  // ===========================================================================================
  // MODULE INITIALIZATION
  // ===========================================================================================

  logInfo("🚀 FooterGenerator module initialising...");

  // ===========================================================================================
  // FOOTER GENERATION
  // ===========================================================================================

  /**
   * Generate document footer HTML with source viewer integration
   *
   * @param {string} originalSource - Original document source code
   * @param {string} pandocArgs - Pandoc conversion arguments used
   * @param {object} metadata - Document metadata
   * @returns {Promise<string>} Complete footer HTML
   */
  async function generateDocumentFooter(
    originalSource = "",
    pandocArgs = "",
    metadata = {}
  ) {
    try {
      // Check if SourceViewer module is available
      if (window.SourceViewer && originalSource.trim()) {
        logDebug("Generating enhanced footer with source viewer");
        const enhancedFooter = await window.SourceViewer.generateEnhancedFooter(
          originalSource,
          pandocArgs,
          metadata
        );

        // Defensive check: ensure we got a valid string
        if (
          enhancedFooter &&
          typeof enhancedFooter === "string" &&
          enhancedFooter.trim().length > 0
        ) {
          return enhancedFooter;
        } else {
          logWarn(
            "SourceViewer returned invalid footer (type: " +
              typeof enhancedFooter +
              "), using basic fallback"
          );
          return generateBasicFooter();
        }
      } else {
        // Fallback to basic footer
        logWarn(
          "SourceViewer not available or no source content, using basic footer"
        );
        return generateBasicFooter();
      }
    } catch (error) {
      logError("Error generating enhanced footer:", error);
      // Error fallback
      return generateErrorFooter();
    }
  }

  /**
   * Generate basic footer without source viewer
   *
   * @returns {string} Basic footer HTML
   */
  function generateBasicFooter() {
    const generationDate = new Date().toISOString().split("T")[0];
    let html = "";
    html += '<footer class="document-footer" role="contentinfo">\n';
    html += `    <p>Generated on <time datetime="${generationDate}">${generationDate}</time> using Pandoc-WASM and MathJax</p>\n`;
    html += "</footer>\n";
    return html;
  }

  /**
   * Generate error fallback footer
   *
   * @returns {string} Error fallback footer HTML
   */
  function generateErrorFooter() {
    const generationDate = new Date().toISOString().split("T")[0];
    let html = "";
    html += '<footer class="document-footer" role="contentinfo">\n';
    html += `    <p>Generated on <time datetime="${generationDate}">${generationDate}</time> using Pandoc-WASM and MathJax</p>\n`;
    html += "    <p><em>Source viewing temporarily unavailable</em></p>\n";
    html += "</footer>\n";
    return html;
  }

  // ===========================================================================================
  // DEPENDENCY VALIDATION
  // ===========================================================================================

  /**
   * Validate that all required dependencies are available
   *
   * @returns {object} Validation result with status and details
   */
  function validateDependencies() {
    const results = {
      success: true,
      optional: [],
      errors: [],
    };

    // SourceViewer is optional - enhanced functionality if available
    if (window.SourceViewer) {
      results.optional.push("SourceViewer available (enhanced footer)");
    } else {
      results.optional.push(
        "SourceViewer not available (basic footer fallback)"
      );
    }

    logInfo("FooterGenerator dependencies validated:", results);
    return results;
  }

  // ===========================================================================================
  // MODULE COMPLETION
  // ===========================================================================================

  logInfo("✅ FooterGenerator module initialised successfully");

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functionality
    generateDocumentFooter,

    // Helper functions (exposed for testing)
    generateBasicFooter,
    generateErrorFooter,

    // Validation
    validateDependencies,

    // Logging (exposed for debugging)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// ===========================================================================================
// GLOBAL REGISTRATION
// ===========================================================================================

window.FooterGenerator = FooterGenerator;
