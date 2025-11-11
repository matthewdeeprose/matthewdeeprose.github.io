// ===========================================================================================
// FOOTER GENERATOR MODULE - TEST SUITE
// ===========================================================================================
// Purpose: Validate FooterGenerator module functionality
// Tests: 8 comprehensive tests covering all features
// Phase: 3.6 - Footer Generator Module extraction
// ===========================================================================================

const TestFooterGenerator = (function () {
  "use strict";

  // ===========================================================================================
  // TEST SUITE: FOOTER GENERATOR MODULE
  // ===========================================================================================

  function testFooterGenerator() {
    const tests = {
      // Test 1: Module exists and is properly registered
      moduleExists: () => {
        if (!window.FooterGenerator) {
          throw new Error("FooterGenerator module not found on window object");
        }
        return true;
      },

      // Test 2: Public API methods are available
      hasRequiredMethods: () => {
        const required = [
          "generateDocumentFooter",
          "generateBasicFooter",
          "generateErrorFooter",
          "validateDependencies",
        ];

        const missing = required.filter(
          (method) => typeof window.FooterGenerator[method] !== "function"
        );

        if (missing.length > 0) {
          throw new Error(`Missing required methods: ${missing.join(", ")}`);
        }
        return true;
      },

      // Test 3: Dependency validation works
      dependencyValidation: () => {
        const result = window.FooterGenerator.validateDependencies();

        if (!result || typeof result !== "object") {
          throw new Error("validateDependencies should return an object");
        }

        if (!result.hasOwnProperty("success")) {
          throw new Error("Validation result missing 'success' property");
        }

        if (!Array.isArray(result.optional)) {
          throw new Error("Validation result missing 'optional' array");
        }

        return true;
      },

      // Test 4: Basic footer generation works
      basicFooterGeneration: () => {
        const footer = window.FooterGenerator.generateBasicFooter();

        if (typeof footer !== "string" || footer.length === 0) {
          throw new Error("generateBasicFooter should return non-empty string");
        }

        if (!footer.includes("<footer")) {
          throw new Error("Basic footer should include <footer> tag");
        }

        if (!footer.includes('role="contentinfo"')) {
          throw new Error(
            "Basic footer should include role='contentinfo' for accessibility"
          );
        }

        if (!footer.includes("<time")) {
          throw new Error("Basic footer should include <time> tag");
        }

        if (!footer.includes("Pandoc-WASM")) {
          throw new Error("Basic footer should mention Pandoc-WASM");
        }

        return true;
      },

      // Test 5: Error footer generation works
      errorFooterGeneration: () => {
        const footer = window.FooterGenerator.generateErrorFooter();

        if (typeof footer !== "string" || footer.length === 0) {
          throw new Error("generateErrorFooter should return non-empty string");
        }

        if (!footer.includes("<footer")) {
          throw new Error("Error footer should include <footer> tag");
        }

        if (!footer.includes("temporarily unavailable")) {
          throw new Error("Error footer should mention unavailability");
        }

        return true;
      },

      // Test 6: Main generateDocumentFooter function works with fallback
      documentFooterWithoutSourceViewer: async () => {
        // Temporarily hide SourceViewer if it exists
        const originalSourceViewer = window.SourceViewer;
        window.SourceViewer = null;

        try {
          const footer = await window.FooterGenerator.generateDocumentFooter(
            "",
            "",
            {}
          );

          if (typeof footer !== "string" || footer.length === 0) {
            throw new Error(
              "generateDocumentFooter should return non-empty string"
            );
          }

          if (!footer.includes("<footer")) {
            throw new Error("Document footer should include <footer> tag");
          }

          return true;
        } finally {
          // Restore SourceViewer
          window.SourceViewer = originalSourceViewer;
        }
      },

      // Test 7: Enhanced footer generation with SourceViewer (if available)
      documentFooterWithSourceViewer: async () => {
        if (!window.SourceViewer) {
          // Skip test if SourceViewer not available
          return true;
        }

        // Test with mock source content
        const mockSource =
          "\\documentclass{article}\n\\begin{document}\nTest\\end{document}";
        const mockArgs = "--from latex --to html5";
        const mockMetadata = { title: "Test Document" };

        const footer = await window.FooterGenerator.generateDocumentFooter(
          mockSource,
          mockArgs,
          mockMetadata
        );

        if (typeof footer !== "string" || footer.length === 0) {
          throw new Error("Enhanced footer should return non-empty string");
        }

        if (!footer.includes("<footer")) {
          throw new Error("Enhanced footer should include <footer> tag");
        }

        return true;
      },

// Test 8: Integration readiness check
      integrationReadiness: async () => {
        // Verify module can be called the way ExportManager will call it
        const testCases = [
          { source: "", args: "", metadata: {} },
          { source: "test", args: "--from latex", metadata: { title: "Test" } },
          // Note: null values removed - ExportManager always passes strings (even empty strings)
        ];

        for (const testCase of testCases) {
          const footer = await window.FooterGenerator.generateDocumentFooter(
            testCase.source,
            testCase.args,
            testCase.metadata
          );

          if (typeof footer !== "string") {
            throw new Error(
              `Footer generation failed for test case: ${JSON.stringify(
                testCase
              )}`
            );
          }
        }

        return true;
      },
    };

    // Run test suite
    return TestUtilities.runTestSuite("FooterGenerator", tests);
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testFooterGenerator,
  };
})();

// ===========================================================================================
// GLOBAL REGISTRATION
// ===========================================================================================

window.TestFooterGenerator = TestFooterGenerator;

// CRITICAL: Expose test function to console for easy access
window.testFooterGenerator = TestFooterGenerator.testFooterGenerator;
