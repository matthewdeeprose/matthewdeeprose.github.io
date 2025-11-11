// test-latex-processor-legacy.js
// Tests for Legacy LaTeX Processor Module

const TestLaTeXProcessorLegacy = (function () {
  "use strict";

  /**
   * Test LaTeX Processor Legacy Module
   * Verifies the legacy annotation-based method works correctly
   */
  function testLaTeXProcessorLegacy() {
    const tests = {
      // Test 1: Module exists and loaded
      moduleExists: () => {
        return !!window.LaTeXProcessorLegacy;
      },

      // Test 2: Required methods available
      hasProcessMethod: () => {
        return typeof window.LaTeXProcessorLegacy.process === "function";
      },

      hasConvertMathJaxMethod: () => {
        return (
          typeof window.LaTeXProcessorLegacy.convertMathJaxToLatex ===
          "function"
        );
      },

      hasExtractMethod: () => {
        return (
          typeof window.LaTeXProcessorLegacy.extractLatexFromSemanticMathML ===
          "function"
        );
      },

      // Test 3: Process simple content
      processSimpleContent: async () => {
        const testContent = "<p>Test content with no math</p>";
        const result = await window.LaTeXProcessorLegacy.process({
          content: testContent,
        });
        // Should return unchanged for non-math content
        return result.includes("Test content");
      },

      // Test 4: Process MathJax container
      processMathJaxContainer: () => {
        const testHTML = `
            <mjx-container display="true">
              <mjx-assistive-mml>
                <math>
                  <annotation encoding="application/x-tex">x + y = 5</annotation>
                </math>
              </mjx-assistive-mml>
            </mjx-container>
          `;

        const result =
          window.LaTeXProcessorLegacy.convertMathJaxToLatex(testHTML);
        return result.includes("\\[x + y = 5\\]");
      },

      // Test 5: Legacy method produces consistent output
      legacyConsistentOutput: () => {
        const testHTML = `
    <mjx-container display="false">
      <mjx-assistive-mml>
        <math>
          <annotation encoding="application/x-tex">a + b</annotation>
        </math>
      </mjx-assistive-mml>
    </mjx-container>
  `;

        const result =
          window.LaTeXProcessorLegacy.convertMathJaxToLatex(testHTML);

        // Should convert to inline math
        return result.includes("\\(a + b\\)");
      },

      // Test 6: Error handling
      handlesInvalidContent: () => {
        try {
          const result =
            window.LaTeXProcessorLegacy.convertMathJaxToLatex(null);
          // Should return null or empty, not throw
          return true;
        } catch (error) {
          console.error("Legacy method threw error on null input:", error);
          return false;
        }
      },
    };

    return TestUtilities.runTestSuite("LaTeXProcessorLegacy", tests);
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testLaTeXProcessorLegacy,
  };
})();

// Make globally available
window.TestLaTeXProcessorLegacy = TestLaTeXProcessorLegacy;
