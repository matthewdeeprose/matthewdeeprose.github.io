// test-base64-handler.js
// Comprehensive test suite for Base64Handler module

const TestBase64Handler = (function () {
  "use strict";

  /**
   * Main test function for Base64Handler module
   * Tests safe encoding, self-referencing HTML generation, and integration readiness
   */
  function testBase64Handler() {
    const tests = {
      // ===========================================================================================
      // BASIC MODULE TESTS
      // ===========================================================================================

      moduleExists: () => {
        const exists = typeof window.Base64Handler !== "undefined";
        return {
          success: exists,
          message: exists
            ? "Base64Handler module is defined"
            : "Base64Handler module is not defined",
        };
      },

      hasRequiredMethods: () => {
        const requiredMethods = [
          "createSafeBase64",
          "generateSelfReferencingHTML",
          "validateDependencies",
        ];

        const missingMethods = requiredMethods.filter(
          (method) => typeof window.Base64Handler[method] !== "function"
        );

        return {
          success: missingMethods.length === 0,
          message:
            missingMethods.length === 0
              ? `All ${requiredMethods.length} required methods present`
              : `Missing methods: ${missingMethods.join(", ")}`,
        };
      },

      validatesDependencies: () => {
        const result = window.Base64Handler.validateDependencies();
        return {
          success: result.success === true,
          message: result.success
            ? "All native browser APIs available"
            : `Dependency validation failed: ${result.errors.join(", ")}`,
        };
      },

      // ===========================================================================================
      // SAFE BASE64 ENCODING TESTS
      // ===========================================================================================

      encodesSimpleContent: () => {
        const testContent = "Hello, World!";
        const encoded = window.Base64Handler.createSafeBase64(testContent);
        const expectedEncoded = btoa(testContent);

        return {
          success: encoded === expectedEncoded && encoded.length > 0,
          message:
            encoded === expectedEncoded
              ? `Simple content encoded correctly (${encoded.length} chars)`
              : `Encoding mismatch: expected ${expectedEncoded}, got ${encoded}`,
        };
      },

      encodesComplexContent: () => {
        const testContent = `
          <h1>Test Document</h1>
          <p>This contains special characters: & < > " '</p>
          <script>console.log("test");</script>
        `;
        const encoded = window.Base64Handler.createSafeBase64(testContent);

        // Should be able to decode back to original
        let decoded;
        try {
          decoded = atob(encoded);
          const matches = decoded === testContent;
          return {
            success: matches && encoded.length > 0,
            message: matches
              ? `Complex content encoded and decoded correctly (${encoded.length} chars)`
              : "Encoding/decoding mismatch for complex content",
          };
        } catch (error) {
          return {
            success: false,
            message: `Decoding failed: ${error.message}`,
          };
        }
      },

      handlesEmptyContent: () => {
        const encoded = window.Base64Handler.createSafeBase64("");
        const expectedEncoded = btoa("");

        return {
          success: encoded === expectedEncoded,
          message:
            encoded === expectedEncoded
              ? "Empty content handled correctly"
              : `Empty content encoding failed: expected ${expectedEncoded}, got ${encoded}`,
        };
      },

      handlesInvalidInput: () => {
        // Test with null, undefined, number
        const testInputs = [null, undefined, 123, { test: "object" }];
        const results = testInputs.map((input) => {
          try {
            const encoded = window.Base64Handler.createSafeBase64(input);
            // Should return a string (even if empty fallback)
            return typeof encoded === "string";
          } catch (error) {
            return false;
          }
        });

        const allHandled = results.every((result) => result === true);
        return {
          success: allHandled,
          message: allHandled
            ? "All invalid inputs handled gracefully"
            : "Some invalid inputs not handled correctly",
        };
      },

      // ===========================================================================================
      // SELF-REFERENCING HTML GENERATION TESTS
      // ===========================================================================================

      generatesBasicSelfReferencingHTML: () => {
        const preliminaryHTML = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Test Document</h1>
</body>
</html>`;

        const result = window.Base64Handler.generateSelfReferencingHTML(
          preliminaryHTML,
          "Test",
          5
        );

        const hasRequiredProperties =
          result.finalHTML &&
          typeof result.converged === "boolean" &&
          typeof result.iterations === "number" &&
          typeof result.base64Length === "number";

        const hasEmbeddedScript = result.finalHTML.includes(
          'id="original-content-data"'
        );

        return {
          success: hasRequiredProperties && hasEmbeddedScript,
          message:
            hasRequiredProperties && hasEmbeddedScript
              ? `Self-referencing HTML generated (${result.iterations} iterations, ${result.base64Length} chars Base64)`
              : "Self-referencing HTML generation failed",
        };
      },

      achievesConvergence: () => {
        const preliminaryHTML = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Convergence Test</h1>
</body>
</html>`;

        const result = window.Base64Handler.generateSelfReferencingHTML(
          preliminaryHTML,
          "ConvergenceTest",
          5
        );

        // Convergence should occur within 5 iterations for small documents
        const converged = result.converged === true;
        const withinIterations =
          result.iterations > 0 && result.iterations <= 5;

        return {
          success: converged && withinIterations,
          message:
            converged && withinIterations
              ? `Convergence achieved in ${result.iterations} iterations`
              : `Convergence failed: converged=${result.converged}, iterations=${result.iterations}`,
        };
      },

      preservesHTMLStructure: () => {
        const preliminaryHTML = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<title>Structure Test</title>
</head>
<body>
<header><h1>Test Header</h1></header>
<main><p>Test content</p></main>
<footer><p>Test footer</p></footer>
</body>
</html>`;

        const result = window.Base64Handler.generateSelfReferencingHTML(
          preliminaryHTML,
          "StructureTest",
          5
        );

        const finalHTML = result.finalHTML;

        // Check that key structural elements are preserved
        const hasDoctype = finalHTML.includes("<!DOCTYPE html>");
        const hasHeader = finalHTML.includes("<header>");
        const hasMain = finalHTML.includes("<main>");
        const hasFooter = finalHTML.includes("<footer>");
        const hasLanguage = finalHTML.includes('lang="en-GB"');

        const allPreserved =
          hasDoctype && hasHeader && hasMain && hasFooter && hasLanguage;

        return {
          success: allPreserved,
          message: allPreserved
            ? "HTML structure preserved correctly"
            : "HTML structure not fully preserved",
        };
      },

      // ===========================================================================================
      // INTEGRATION READINESS
      // ===========================================================================================

      integrationReadiness: () => {
        // Test that Base64Handler can be used by other modules
        const testContent = "<html><body>Integration Test</body></html>";

        try {
          // Test basic encoding
          const encoded = window.Base64Handler.createSafeBase64(testContent);

          // Test self-referencing HTML generation
          const result = window.Base64Handler.generateSelfReferencingHTML(
            testContent,
            "IntegrationTest",
            3
          );

          // Test dependency validation
          const deps = window.Base64Handler.validateDependencies();

          const allWorking =
            encoded.length > 0 &&
            result.finalHTML.length > 0 &&
            deps.success === true;

          return {
            success: allWorking,
            message: allWorking
              ? "Base64Handler ready for integration with other modules"
              : "Integration readiness check failed",
          };
        } catch (error) {
          return {
            success: false,
            message: `Integration test failed: ${error.message}`,
          };
        }
      },
    };

    return TestUtilities.runTestSuite("Base64Handler", tests);
  }

  // Make test function available globally for console access
  return {
    testBase64Handler,
  };
})();

// Export to window for console access
window.TestBase64Handler = TestBase64Handler;
window.testBase64Handler = TestBase64Handler.testBase64Handler;
