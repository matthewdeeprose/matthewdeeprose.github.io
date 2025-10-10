// js/testing/individual/test-mathjax-promise-utility.js
const TestMathJaxPromiseUtility = (function () {
  "use strict";

  function testMathJaxPromiseUtility() {
    const tests = {
      templateExists: () => {
        const hasJS = window.TemplateSystem?.GlobalTemplateCache?.hasTemplate(
          "mathJaxPromiseUtilityJS"
        );
        return hasJS;
      },

      jsTemplateLoads: async () => {
        if (!window.TemplateSystem) return false;
        try {
          const generator = window.TemplateSystem.createGenerator();
          const content = await generator.generateMathJaxPromiseUtilityJS();
          return content && content.length > 0;
        } catch (error) {
          console.error("Template loading failed:", error);
          return false;
        }
      },

      utilityAvailable: () => {
        return typeof window.MathJaxPromiseUtility === "object";
      },

      managerCreated: () => {
        return (
          window.MathJaxPromiseUtility &&
          typeof window.MathJaxPromiseUtility._manager === "object"
        );
      },

      convenienceFunctionsAvailable: () => {
        return (
          typeof window.safeTypeset === "function" &&
          typeof window.safeTypesetWithPreload === "function"
        );
      },

      configurationAccess: () => {
        if (!window.MathJaxPromiseUtility) return false;
        const config = window.MathJaxPromiseUtility.getConfig();
        return (
          config &&
          typeof config === "object" &&
          typeof config.MAX_RETRIES === "number"
        );
      },

      metricsAvailable: () => {
        if (!window.MathJaxPromiseUtility) return false;
        const metrics = window.MathJaxPromiseUtility.getMetrics();
        return (
          metrics &&
          typeof metrics === "object" &&
          typeof metrics.totalOperations === "number"
        );
      },

      initializationMethod: () => {
        return (
          window.MathJaxPromiseUtility &&
          typeof window.MathJaxPromiseUtility.initialize === "function"
        );
      },

      safeTypesetMethod: () => {
        return (
          window.MathJaxPromiseUtility &&
          typeof window.MathJaxPromiseUtility.safeTypeset === "function"
        );
      },

      fontPreloadMethod: () => {
        return (
          window.MathJaxPromiseUtility &&
          typeof window.MathJaxPromiseUtility.preloadCommonFonts === "function"
        );
      },

      errorHandlingSetup: () => {
        // Test that error handling doesn't break the system
        try {
          if (!window.MathJaxPromiseUtility) return false;
          const metrics = window.MathJaxPromiseUtility.getMetrics();
          return metrics.hasOwnProperty("failedOperations");
        } catch (error) {
          return false;
        }
      },
    };

    return TestUtilities.runTestSuite("MathJaxPromiseUtility", tests);
  }

  return { testMathJaxPromiseUtility };
})();

// Register test
if (typeof window !== "undefined") {
  window.testMathJaxPromiseUtility =
    TestMathJaxPromiseUtility.testMathJaxPromiseUtility;
}
