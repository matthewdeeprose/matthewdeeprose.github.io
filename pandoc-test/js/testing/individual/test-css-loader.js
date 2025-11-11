// test-css-loader.js
// Test suite for CSSLoader module

const TestCSSLoader = (function () {
  "use strict";

  /**
   * Test CSSLoader module functionality
   */
  function testCSSLoader() {
    const tests = {
      // Test 1: Module exists
      moduleExists: () => {
        if (!window.CSSLoader) {
          throw new Error("CSSLoader module not found");
        }
        return true;
      },

      // Test 2: Has required methods
      hasRequiredMethods: () => {
        const requiredMethods = [
          "getBaseCSS",
          "loadBaseCSS",
          "preloadAllCSS",
          "minifyCSS",
          "getCacheStatus",
        ];

        const missingMethods = requiredMethods.filter(
          (method) => typeof window.CSSLoader[method] !== "function"
        );

        if (missingMethods.length > 0) {
          throw new Error(`Missing methods: ${missingMethods.join(", ")}`);
        }

        return true;
      },

      // Test 3: Load base CSS
      loadBaseCSS: async () => {
        const css = await window.CSSLoader.loadBaseCSS();

        if (!css || typeof css !== "string") {
          throw new Error("Failed to load base CSS");
        }

        if (css.length < 100) {
          throw new Error("Base CSS too short - may not have loaded correctly");
        }

        // Check for expected content
        if (!css.includes("--body-bg")) {
          throw new Error("Base CSS missing custom properties");
        }

        if (!css.includes("skip-link")) {
          throw new Error("Base CSS missing skip links");
        }

        if (!css.includes("box-sizing")) {
          throw new Error("Base CSS missing base styles");
        }

        if (!css.includes("focus-visible")) {
          throw new Error("Base CSS missing focus management");
        }

        return true;
      },

      // Test 4: CSS minification
      minifyCSS: () => {
        const testCSS = `
            /* Comment */
            body {
              margin: 0;
              padding: 0;
            }
          `;

        const minified = window.CSSLoader.minifyCSS(testCSS);

        if (!minified || typeof minified !== "string") {
          throw new Error("Minification failed");
        }

        if (minified.length >= testCSS.length) {
          throw new Error("Minified CSS not smaller than original");
        }

        if (minified.includes("Comment")) {
          throw new Error("Comments not removed");
        }

        return true;
      },

      // Test 5: Cache status
      cacheStatus: () => {
        const status = window.CSSLoader.getCacheStatus();

        if (!status || typeof status !== "object") {
          throw new Error("Failed to get cache status");
        }

        if (typeof status.loaded !== "boolean") {
          throw new Error("Cache status missing 'loaded' property");
        }

        if (typeof status.size !== "number") {
          throw new Error("Cache status missing 'size' property");
        }

        return true;
      },

      // Test 6: Fallback CSS
      fallbackCSS: () => {
        const fallback = window.CSSLoader.getFallbackBaseCSS();

        if (!fallback || typeof fallback !== "string") {
          throw new Error("Failed to get fallback CSS");
        }

        if (fallback.length < 50) {
          throw new Error("Fallback CSS too short");
        }

        if (!fallback.includes("--body-bg")) {
          throw new Error("Fallback CSS missing custom properties");
        }

        return true;
      },

      // Test 7: Preload all CSS
      preloadAll: async () => {
        const result = await window.CSSLoader.preloadAllCSS();

        if (!result || typeof result !== "object") {
          throw new Error("Preload failed");
        }

        if (!result.success) {
          throw new Error(`Preload failed: ${result.error || "Unknown error"}`);
        }

        return true;
      },

      // Test 8: Get base CSS with options
      getBaseCSSWithOptions: async () => {
        // Test without minification
        const css = await window.CSSLoader.getBaseCSS({ minify: false });
        if (!css || css.length < 100) {
          throw new Error("Failed to get base CSS");
        }

        // Test with minification
        const minifiedCSS = await window.CSSLoader.getBaseCSS({ minify: true });
        if (!minifiedCSS || minifiedCSS.length >= css.length) {
          throw new Error("Minification option not working");
        }

        return true;
      },
    };

    return TestUtilities.runTestSuite("CSSLoader", tests);
  }

  return { testCSSLoader };
})();

// Make test available globally
window.TestCSSLoader = TestCSSLoader;

// ✅ CRITICAL: Expose test function globally for TestRegistry discovery
window.testCSSLoader = TestCSSLoader.testCSSLoader;

// Auto-run test if TestUtilities available
if (window.TestUtilities) {
  console.log("CSSLoader test module loaded");
}
