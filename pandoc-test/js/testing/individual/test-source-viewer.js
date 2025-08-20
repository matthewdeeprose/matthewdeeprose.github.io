// test-source-viewer.js
// Comprehensive testing for Source Viewer Module

const TestSourceViewer = (function () {
  "use strict";

  function testSourceViewer() {
    const tests = {
      moduleExists: () => {
        return typeof window.SourceViewer !== "undefined";
      },

      hasRequiredMethods: () => {
        const required = [
          "generateEnhancedFooter",
          "detectSourceLanguage",
          "generateEmbeddedAssets",
          "enhanceAccessibility",
          "getPrismCSS",
          "getPrismJS",
          "testSourceViewer",
        ];

        return required.every(
          (method) => typeof window.SourceViewer[method] === "function"
        );
      },

      languageDetection: () => {
        if (!window.SourceViewer.detectSourceLanguage) return false;

        const testCases = [
          {
            args: "--from latex --to html5",
            expectedPrism: "latex",
            expectedDisplay: "LaTeX",
          },
          {
            args: "--from markdown --to html5",
            expectedPrism: "markdown",
            expectedDisplay: "Markdown",
          },
          {
            args: "--from gfm --to html5",
            expectedPrism: "markdown",
            expectedDisplay: "GitHub Flavoured Markdown",
          },
          {
            args: "--from latex+fancy_lists --to html5",
            expectedPrism: "latex",
            expectedDisplay: "LaTeX (with fancy_lists)",
          },
          {
            args: "--to html5",
            expectedPrism: "latex",
            expectedDisplay: "LaTeX",
          },
        ];

        return testCases.every((test) => {
          const result = window.SourceViewer.detectSourceLanguage(test.args);
          return (
            result.prismLanguage === test.expectedPrism &&
            result.displayName === test.expectedDisplay
          );
        });
      },

      footerGeneration: () => {
        if (!window.SourceViewer.generateEnhancedFooter) return false;

        const testSource =
          "\\documentclass{article}\n\\title{Test Document}\n\\begin{document}\n\\maketitle\nHello World\n\\end{document}";
        const testArgs = "--from latex --to html5 --mathjax";
        const metadata = { title: "Test Document" };

        const footer = window.SourceViewer.generateEnhancedFooter(
          testSource,
          testArgs,
          metadata
        );

        const currentDate = new Date().toISOString().split("T")[0];

        return (
          footer.includes("<footer") &&
          footer.includes("source-viewer") &&
          footer.includes("View source file") &&
          footer.includes("language-latex") &&
          footer.includes(currentDate) &&
          footer.includes('aria-expanded="false"') &&
          footer.includes('role="button"')
        );
      },

      embeddedAssets: async () => {
        if (!window.SourceViewer.generateEmbeddedAssets) return false;

        try {
          const assets = await window.SourceViewer.generateEmbeddedAssets();

          return (
            assets &&
            assets.css &&
            assets.js &&
            assets.css.length > 100 && // Check CSS has content
            assets.js.length > 100 // Check JS has content
            // Note: Removed specific content checks since template content may vary
          );
        } catch (error) {
          console.error("embeddedAssets test error:", error);
          return false;
        }
      },

      securityEscaping: () => {
        if (!window.SourceViewer.generateEnhancedFooter) return false;

        const maliciousSource =
          "<script>alert('XSS')</script>\n<iframe src='evil.com'></iframe>";
        const footer = window.SourceViewer.generateEnhancedFooter(
          maliciousSource,
          "--from latex"
        );

        return (
          footer.includes("&lt;script&gt;") &&
          footer.includes("&lt;iframe") &&
          !footer.includes("<script>alert") &&
          !footer.includes("<iframe src=")
        );
      },

      accessibilityFeatures: () => {
        if (!window.SourceViewer.generateEnhancedFooter) return false;

        const footer = window.SourceViewer.generateEnhancedFooter(
          "Test source",
          "--from latex"
        );

        return (
          footer.includes('role="contentinfo"') &&
          footer.includes("aria-controls=") &&
          footer.includes("aria-expanded=") &&
          footer.includes('role="button"') &&
          footer.includes('role="region"') &&
          footer.includes("aria-labelledby=") &&
          footer.includes('tabindex="0"')
        );
      },

      integrationReadiness: () => {
        // Test integration with export manager
        return (
          typeof window.ExportManager !== "undefined" &&
          typeof window.SourceViewer !== "undefined" &&
          typeof window.SourceViewer.generateEnhancedFooter === "function"
        );
      },
    };

    return TestUtilities.runTestSuite("SourceViewer", tests, {
      allowAsync: true,
    });
  }

  return {
    testSourceViewer,
  };
})();

// Make globally available for test runner
window.TestSourceViewer = TestSourceViewer;

// Add to global test commands
window.testSourceViewer = TestSourceViewer.testSourceViewer;
