// test-script-orchestrator.js
// Comprehensive test suite for ScriptOrchestrator module
// Tests script coordination, template loading, and JavaScript generation

const TestScriptOrchestrator = (function () {
  "use strict";

  /**
   * Main test function for ScriptOrchestrator module
   */
  function testScriptOrchestrator() {
    console.log("\n🧪 Testing ScriptOrchestrator Module...\n");

    const tests = {
      // Module availability tests
      moduleExists: () => {
        const exists = !!window.ScriptOrchestrator;
        if (!exists) {
          throw new Error("ScriptOrchestrator module not found");
        }
        return true;
      },

      hasRequiredMethods: () => {
        const required = [
          "generateEnhancedJavaScript",
          "generateMathJaxManagerJS",
          "generateMathJaxControlsJS",
          "generateReadingToolsSetupJS",
          "generateFocusTrackingJS",
          "generateThemeManagementJS",
          "generateFormInitializationJS",
          "generateReadingAccessibilityManagerClass",
          "generateDocumentSaveFunctionalityJS",
          "generateSaveVerificationJS",
          "generateContentStorageHandlerJS",
          "validateDependencies",
          "testScriptGeneration",
        ];

        const missing = required.filter(
          (method) => typeof window.ScriptOrchestrator[method] !== "function"
        );

        if (missing.length > 0) {
          throw new Error(`Missing methods: ${missing.join(", ")}`);
        }
        return true;
      },

      // Dependency validation tests
      dependenciesValidate: () => {
        const result = window.ScriptOrchestrator.validateDependencies();
        if (!result.success) {
          throw new Error(
            `Dependency validation failed. Missing: ${result.missing.join(
              ", "
            )}`
          );
        }
        return true;
      },

      // Template loader tests
      canGenerateMathJaxControls: async () => {
        const result =
          await window.ScriptOrchestrator.generateMathJaxControlsJS(2);
        if (!result || result.length < 100) {
          throw new Error("MathJax controls generation failed or too short");
        }
        return true;
      },

      canGenerateThemeManagement: async () => {
        const result =
          await window.ScriptOrchestrator.generateThemeManagementJS();
        if (!result || result.length < 100) {
          throw new Error("Theme management generation failed or too short");
        }
        return true;
      },

      canGenerateFocusTracking: async () => {
        const result = await window.ScriptOrchestrator.generateFocusTrackingJS({
          enableConsoleCommands: true,
        });
        if (!result || result.length < 100) {
          throw new Error("Focus tracking generation failed or too short");
        }
        return true;
      },

      canGenerateFormInitialization: async () => {
        const result =
          await window.ScriptOrchestrator.generateFormInitializationJS({
            defaultFontSize: "1.0",
            defaultReadingWidth: "narrow",
          });
        if (!result || result.length < 100) {
          throw new Error("Form initialization generation failed or too short");
        }
        return true;
      },

      canGenerateAccessibilityManager: async () => {
        const result =
          await window.ScriptOrchestrator.generateReadingAccessibilityManagerClass(
            {
              defaultFontSize: 1.0,
              defaultFontFamily: "Verdana, sans-serif",
              enableAdvancedControls: true,
            }
          );
        if (!result || result.length < 100) {
          throw new Error(
            "Reading accessibility manager generation failed or too short"
          );
        }
        return true;
      },

      canGenerateDocumentSaveFunctionality: async () => {
        const result =
          await window.ScriptOrchestrator.generateDocumentSaveFunctionalityJS();
        if (!result || result.length < 100) {
          throw new Error(
            "Document save functionality generation failed or too short"
          );
        }
        return true;
      },

      canGenerateSaveVerification: async () => {
        const result =
          await window.ScriptOrchestrator.generateSaveVerificationJS();
        if (!result || result.length < 100) {
          throw new Error("Save verification generation failed or too short");
        }
        return true;
      },

      canGenerateContentStorageHandler: async () => {
        const result =
          await window.ScriptOrchestrator.generateContentStorageHandlerJS();
        if (!result || result.length < 100) {
          throw new Error(
            "Content storage handler generation failed or too short"
          );
        }
        return true;
      },

      // MathJax Manager generation tests
      canGenerateMathJaxManager: async () => {
        const result =
          await window.ScriptOrchestrator.generateMathJaxManagerJS();
        if (!result || result.length < 100) {
          throw new Error("MathJax Manager generation failed or too short");
        }
        if (!result.includes("MathJaxManager")) {
          throw new Error(
            "MathJax Manager generation missing MathJaxManager reference"
          );
        }
        return true;
      },

      // Main orchestration tests
      canGenerateEnhancedJavaScript: async () => {
        const result =
          await window.ScriptOrchestrator.generateEnhancedJavaScript(2, null);
        if (!result || result.length < 1000) {
          throw new Error("Enhanced JavaScript generation failed or too short");
        }
        if (!result.includes("<script>")) {
          throw new Error("Enhanced JavaScript missing script tag");
        }
        if (!result.includes("ReadingAccessibilityManager")) {
          throw new Error(
            "Enhanced JavaScript missing ReadingAccessibilityManager"
          );
        }
        return true;
      },

      canGenerateEnhancedJavaScriptWithContent: async () => {
        const testHTML = "<h1>Test Document</h1><p>Test content</p>";
        const result =
          await window.ScriptOrchestrator.generateEnhancedJavaScript(
            2,
            testHTML
          );
        if (!result || result.length < 1000) {
          throw new Error(
            "Enhanced JavaScript with content generation failed or too short"
          );
        }
        if (!result.includes("original-content-data")) {
          throw new Error(
            "Enhanced JavaScript missing embedded content data script"
          );
        }
        return true;
      },

      // Integration tests
      scriptGenerationTest: async () => {
        const result = await window.ScriptOrchestrator.testScriptGeneration();
        if (!result.success) {
          throw new Error(
            `Script generation test failed: ${result.error || "Unknown error"}`
          );
        }
        if (!result.hasScriptTag) {
          throw new Error("Generated script missing script tag");
        }
        if (!result.hasAccessibilityManager) {
          throw new Error("Generated script missing accessibility manager");
        }
        if (!result.hasMathJaxManager) {
          throw new Error("Generated script missing MathJax manager");
        }
        return true;
      },

      // ExportManager integration tests
      exportManagerCanCallScriptOrchestrator: () => {
        if (!window.ExportManager) {
          throw new Error("ExportManager not available");
        }
        if (
          typeof window.ExportManager.generateEnhancedJavaScript !== "function"
        ) {
          throw new Error(
            "ExportManager.generateEnhancedJavaScript not a function"
          );
        }
        return true;
      },

      exportManagerDelegatesCorrectly: async () => {
        if (!window.ExportManager) {
          throw new Error("ExportManager not available");
        }

        // Test delegation by calling through ExportManager
        const result = await window.ExportManager.generateEnhancedJavaScript(
          2,
          null
        );
        if (!result || result.length < 1000) {
          throw new Error(
            "ExportManager delegation to ScriptOrchestrator failed"
          );
        }
        return true;
      },

      // Performance tests
      scriptGenerationPerformance: async () => {
        const startTime = performance.now();
        await window.ScriptOrchestrator.generateEnhancedJavaScript(2, null);
        const duration = performance.now() - startTime;

        if (duration > 5000) {
          // 5 second threshold
          throw new Error(
            `Script generation too slow: ${duration.toFixed(0)}ms`
          );
        }
        console.log(
          `   ℹ️ Script generation took ${duration.toFixed(
            0
          )}ms (target: <5000ms)`
        );
        return true;
      },
    };

    return TestUtilities.runTestSuite("ScriptOrchestrator", tests);
  }

  // Public API
  return {
    testScriptOrchestrator,
  };
})();

// Make available globally
window.TestScriptOrchestrator = TestScriptOrchestrator;

// ✅ CRITICAL: Expose test function globally for TestRegistry discovery
window.testScriptOrchestrator = TestScriptOrchestrator.testScriptOrchestrator;

// Register with test framework if available
if (window.TestRegistry) {
  window.TestRegistry.register(
    "script-orchestrator",
    TestScriptOrchestrator.testScriptOrchestrator,
    "individual"
  );
  console.log("✅ ScriptOrchestrator test registered with TestRegistry");
}
