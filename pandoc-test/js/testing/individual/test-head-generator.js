// test-head-generator.js
// Comprehensive tests for HeadGenerator module

const TestHeadGenerator = (function () {
  "use strict";

  /**
   * Test HeadGenerator module
   */
  function testHeadGenerator() {
    const tests = {
      // Test 1: Module exists
      moduleExists: () => {
        if (!window.HeadGenerator) {
          throw new Error("HeadGenerator module not found on window object");
        }
        return true;
      },

      // Test 2: Has required methods
      hasRequiredMethods: () => {
        const requiredMethods = [
          "generateEnhancedHead",
          "validateFontCSS",
          "waitForFontsToLoad",
          "generateFallbackFontCSS",
          "ensureEmbeddedFontsInclusion",
        ];

        const missing = requiredMethods.filter(
          (method) => typeof window.HeadGenerator[method] !== "function"
        );

        if (missing.length > 0) {
          throw new Error(`Missing methods: ${missing.join(", ")}`);
        }

        return true;
      },

      // Test 3: Validate font CSS detection
      validateFontCSSDetection: () => {
        // Test with placeholder CSS (should be invalid)
        const placeholderCSS = `
          @font-face {
            font-family: "Test";
            src: url("data:font/woff2;base64,YOUR_BASE64_PLACEHOLDER");
          }
        `;

        const placeholderResult =
          window.HeadGenerator.validateFontCSS(placeholderCSS);

        if (placeholderResult.isValid) {
          throw new Error("Placeholder CSS incorrectly marked as valid");
        }

        if (!placeholderResult.hasPlaceholders) {
          throw new Error("Failed to detect placeholder");
        }

        // Test with realistic font CSS (should be valid)
        const realCSS = `
          @font-face {
            font-family: "Test";
            src: url("data:font/woff2;charset=utf-8;base64,d09GMgABAAAAAAZQAA4AAAAADEwAAAYBAAEAAAAAAAAA${"A".repeat(
              1000
            )}");
          }
        `;

        const realResult = window.HeadGenerator.validateFontCSS(realCSS);

        if (!realResult.hasRealFontData) {
          throw new Error("Failed to detect real font data");
        }

        return true;
      },

      // Test 4: Fallback font CSS generation
      fallbackFontGeneration: () => {
        const fallbackCSS = window.HeadGenerator.generateFallbackFontCSS();

        if (!fallbackCSS || typeof fallbackCSS !== "string") {
          throw new Error("Fallback CSS generation failed");
        }

        if (fallbackCSS.length < 100) {
          throw new Error("Fallback CSS too short");
        }

        if (!fallbackCSS.includes("OpenDyslexic")) {
          throw new Error("Fallback CSS missing OpenDyslexic font");
        }

        if (!fallbackCSS.includes("YOUR_BASE64_PLACEHOLDER")) {
          throw new Error("Fallback CSS missing placeholders");
        }

        return true;
      },

      // Test 5: Head generation (integration test)
      headGeneration: async () => {
        // Check dependencies first
        if (!window.ContentGenerator) {
          console.warn(
            "⚠️ ContentGenerator not available, skipping head generation test"
          );
          return true; // Skip test if dependencies not available
        }

        if (!window.LaTeXProcessor) {
          console.warn(
            "⚠️ LaTeXProcessor not available, skipping head generation test"
          );
          return true; // Skip test if dependencies not available
        }

        const testMetadata = {
          title: "Test Document",
          author: "Test Author",
          date: "2025-10-25",
        };

        const head = await window.HeadGenerator.generateEnhancedHead(
          "Test Title",
          testMetadata,
          2
        );

        if (!head || typeof head !== "string") {
          throw new Error("Head generation failed");
        }

        if (!head.includes("<head>")) {
          throw new Error("Generated head missing <head> tag");
        }

        if (!head.includes("</head>")) {
          throw new Error("Generated head missing </head> tag");
        }

        if (!head.includes("Test Title")) {
          throw new Error("Generated head missing title");
        }

        if (!head.includes("Test Author")) {
          throw new Error("Generated head missing author metadata");
        }

        if (!head.includes("MathJax")) {
          throw new Error("Generated head missing MathJax config");
        }

        if (head.length < 1000) {
          throw new Error("Generated head suspiciously short");
        }

        return true;
      },

      // Test 6: Integration with ExportManager
      exportManagerIntegration: () => {
        if (!window.ExportManager) {
          throw new Error("ExportManager not available for integration test");
        }

        // Check that ExportManager still has the function (as delegation wrapper)
        if (typeof window.ExportManager.generateEnhancedHead !== "function") {
          throw new Error(
            "ExportManager missing generateEnhancedHead delegation wrapper"
          );
        }

        // Check other delegated functions
        const delegatedFunctions = [
          "validateFontCSS",
          "waitForFontsToLoad",
          "ensureEmbeddedFontsInclusion",
        ];

        const missingDelegations = delegatedFunctions.filter(
          (fn) => typeof window.ExportManager[fn] !== "function"
        );

        if (missingDelegations.length > 0) {
          throw new Error(
            `ExportManager missing delegations: ${missingDelegations.join(
              ", "
            )}`
          );
        }

        return true;
      },

      // Test 7: Logging functions exist
      loggingFunctionsExist: () => {
        const loggingFunctions = ["logError", "logWarn", "logInfo", "logDebug"];

        const missing = loggingFunctions.filter(
          (fn) => typeof window.HeadGenerator[fn] !== "function"
        );

        if (missing.length > 0) {
          throw new Error(`Missing logging functions: ${missing.join(", ")}`);
        }

        return true;
      },
    };

    // Use TestUtilities if available, otherwise run manually
    if (window.TestUtilities && window.TestUtilities.runTestSuite) {
      return window.TestUtilities.runTestSuite("HeadGenerator", tests);
    } else {
      // Fallback: run tests manually
      console.log("🧪 Testing HeadGenerator...");
      let passed = 0;
      let failed = 0;

      for (const [name, test] of Object.entries(tests)) {
        try {
          const result = test();
          if (result instanceof Promise) {
            result
              .then(() => {
                console.log(`✅ ${name}`);
                passed++;
              })
              .catch((error) => {
                console.error(`❌ ${name}:`, error.message);
                failed++;
              });
          } else {
            console.log(`✅ ${name}`);
            passed++;
          }
        } catch (error) {
          console.error(`❌ ${name}:`, error.message);
          failed++;
        }
      }

      return {
        passed,
        failed,
        total: passed + failed,
        success: failed === 0,
      };
    }
  }

  return { testHeadGenerator };
})();

// Make globally available
window.TestHeadGenerator = TestHeadGenerator;

// Global shortcut for convenience
window.testHeadGenerator = TestHeadGenerator.testHeadGenerator;
