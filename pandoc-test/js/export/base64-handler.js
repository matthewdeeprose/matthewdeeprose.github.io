// base64-handler.js
// Base64 Encoding and Self-Referencing HTML Generation Module
// Handles safe Base64 encoding and iterative convergence for self-containing exports

const Base64Handler = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[BASE64]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[BASE64]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[BASE64]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[BASE64]", message, ...args);
  }

  // ===========================================================================================
  // SAFE BASE64 ENCODING
  // ===========================================================================================

  /**
   * Validate and clean Base64 content
   * @param {string} content - The content to encode
   * @returns {string} - Clean Base64 encoded content
   */
  function createSafeBase64(content) {
    try {
      // Ensure content is a string
      const stringContent =
        typeof content === "string" ? content : String(content);

      // Remove any null bytes or problematic characters
      const cleanContent = stringContent.replace(/\0/g, "");

      // Encode to Base64
      const base64Content = btoa(cleanContent);

      // Validate by attempting to decode
      const testDecode = atob(base64Content);

      logDebug("✅ Base64 encoding validated successfully");
      logDebug("📊 Original content length:", stringContent.length);
      logDebug("📊 Base64 content length:", base64Content.length);

      return base64Content;
    } catch (error) {
      logError("❌ Base64 encoding failed:", error);
      logDebug(
        "🔍 Content preview:",
        content ? String(content).substring(0, 100) : "null/undefined"
      );

      // Return empty string as fallback
      return "";
    }
  }

  // ===========================================================================================
  // SELF-REFERENCING HTML GENERATION
  // ===========================================================================================

  /**
   * Generate self-referencing HTML with iterative Base64 convergence
   * Creates HTML that contains a Base64-encoded version of itself for save functionality
   *
   * @param {string} preliminaryHTML - The initial HTML structure (without embedded Base64)
   * @param {string} contextLabel - Label for logging context (e.g., "Standard", "Enhanced Pandoc")
   * @param {number} maxIterations - Maximum convergence iterations (default: 5)
   * @returns {Object} - Result object with finalHTML, converged status, and iteration count
   */
  function generateSelfReferencingHTML(
    preliminaryHTML,
    contextLabel = "Standard",
    maxIterations = 5
  ) {
    logInfo(
      `🔧 Generating self-containing Base64 content through iterative convergence (${contextLabel})...`
    );

    // Implement iterative convergence to achieve true self-reference
    let currentHTML = preliminaryHTML;
    let previousBase64 = "";
    let iteration = 0;
    let converged = false;

    logInfo(
      `🔄 Starting iterative Base64 generation for self-reference (${contextLabel})...`
    );

    while (iteration < maxIterations) {
      // Create script with current Base64 (empty on first iteration)
      const embeddedDataScript = `
<!-- Embedded Original Content for Save Functionality -->
<script id="original-content-data" type="application/x-original-html-base64">
${previousBase64}
</script>`;

      // Insert script into HTML (before closing body tag)
      currentHTML = preliminaryHTML.replace(
        "</body>",
        embeddedDataScript + "\n</body>"
      );

      // Generate new Base64 from complete HTML
      const newBase64 = btoa(unescape(encodeURIComponent(currentHTML)));

      logDebug(
        `${contextLabel} - Iteration ${iteration}: Base64 length = ${newBase64.length} characters`
      );

      // Check for convergence (Base64 stabilises when self-referential)
      if (newBase64 === previousBase64 && iteration > 0) {
        logInfo(
          `✅ Self-referential convergence achieved in ${iteration} iterations (${contextLabel})`
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
        `✅ True self-containing Base64 generated (${contextLabel}): ${finalBase64Length} characters`
      );
      logInfo(
        `🔄 Base64 now contains HTML with exact same Base64 - perfect self-reference (${contextLabel})`
      );
    } else {
      logWarn(
        `⚠️ Convergence not achieved after ${maxIterations} iterations (${contextLabel}), using best attempt`
      );
      logInfo(
        `📊 Final Base64 length (${contextLabel}): ${finalBase64Length} characters`
      );
    }

    return {
      finalHTML: finalHTML,
      converged: converged,
      iterations: iteration,
      base64Length: finalBase64Length,
    };
  }

  // ===========================================================================================
  // VALIDATION AND TESTING
  // ===========================================================================================

  /**
   * Validate Base64Handler dependencies
   * @returns {Object} - Validation results
   */
  function validateDependencies() {
    logInfo("🧪 Validating Base64Handler dependencies...");

    // Base64Handler has no external dependencies - uses only native browser APIs
    const nativeAPIs = {
      btoa: typeof btoa === "function",
      atob: typeof atob === "function",
      unescape: typeof unescape === "function",
      encodeURIComponent: typeof encodeURIComponent === "function",
    };

    const allAvailable = Object.values(nativeAPIs).every((val) => val);

    if (allAvailable) {
      logInfo("✅ All native browser APIs available");
    } else {
      logError(
        "❌ Missing native APIs:",
        Object.entries(nativeAPIs)
          .filter(([key, value]) => !value)
          .map(([key]) => key)
      );
    }

    return {
      success: allAvailable,
      dependencies: nativeAPIs,
      errors: allAvailable
        ? []
        : Object.entries(nativeAPIs)
            .filter(([key, value]) => !value)
            .map(([key]) => `Missing: ${key}`),
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functions
    createSafeBase64,
    generateSelfReferencingHTML,

    // Testing and validation
    validateDependencies,

    // Logging (for testing)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.Base64Handler = Base64Handler;
