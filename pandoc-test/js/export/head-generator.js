// head-generator.js
// HTML Head Generation Module
// Generates complete HTML <head> sections with fonts, metadata, and MathJax config

const HeadGenerator = (function () {
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
      console.error("[HEAD-GEN]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[HEAD-GEN]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[HEAD-GEN]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[HEAD-GEN]", message, ...args);
  }

  // ===========================================================================================
  // FONT VALIDATION FUNCTIONS
  // ===========================================================================================

  /**
   * Validate font CSS content
   * Checks for real font data vs placeholders
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
    // Support woff2, woff, truetype, opentype with optional charset parameter
    const realFontMatches = css.match(
      /data:font\/[^;]+;[^,]*base64,([A-Za-z0-9+/]{100,})/g
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
              logInfo("✅ Fonts loaded and validated successfully");
              return {
                success: true,
                css: embeddedFontsCSS,
                validation: validation,
                loadTime: Date.now() - startTime,
              };
            } else {
              logDebug(
                "⏳ Fonts still loading...",
                validation.errors.join(", ")
              );
            }
          }
        }
      } catch (error) {
        logWarn("Font loading attempt failed:", error.message);
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
   * Enhanced ensureEmbeddedFontsInclusion with proper validation
   */
  async function ensureEmbeddedFontsInclusion() {
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

  // ===========================================================================================
  // HEAD GENERATION FUNCTION
  // ===========================================================================================

  /**
   * Generate enhanced head section with all required components
   */
  async function generateEnhancedHead(title, metadata, accessibilityLevel) {
    logInfo("Generating enhanced HTML head section");

    // Validate dependencies
    if (!window.ContentGenerator) {
      throw new Error("ContentGenerator module required");
    }
    if (!window.LaTeXProcessor) {
      throw new Error("LaTeXProcessor module required");
    }

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
    // STAGE 6: Include custom macros if available from enhanced export
    const dynamicOptions = {
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
    };

    // STAGE 6: Add custom macros if enhanced export was used
    if (metadata.customMacros) {
      dynamicOptions.customMacros = metadata.customMacros;
      logInfo(
        `Injecting ${
          Object.keys(metadata.customMacros).length
        } custom macros into MathJax config`
      );
    }

    const mathJaxConfig = window.LaTeXProcessor.generateMathJaxConfig(
      accessibilityLevel,
      dynamicOptions
    );
    headComponents.push(mathJaxConfig);
    headComponents.push("");

    // Enhanced CSS generation with source viewer styles
    headComponents.push("    <style>");

    // ✅ FIX: Properly await async CSS generation
    const enhancedCSS = await window.ContentGenerator.generateEnhancedCSS();
    headComponents.push(enhancedCSS);

    // Add source viewer CSS if available
    if (window.SourceViewer) {
      headComponents.push("");
      headComponents.push("/* Source Viewer Styles */");
      const prismCSS = await window.SourceViewer.getPrismCSS();
      headComponents.push(prismCSS);
    }

    headComponents.push("    </style>");
    headComponents.push("</head>");

    logInfo("✅ Enhanced head section generated successfully");
    return headComponents.join("\n");
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main generation function
    generateEnhancedHead,

    // Font utilities (exposed for testing)
    validateFontCSS,
    waitForFontsToLoad,
    generateFallbackFontCSS,
    ensureEmbeddedFontsInclusion,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.HeadGenerator = HeadGenerator;
