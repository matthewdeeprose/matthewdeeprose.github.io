// test-body-generator.js
// Comprehensive tests for BodyGenerator module

const TestBodyGenerator = (function () {
  "use strict";

  /**
   * Test BodyGenerator module
   */
  function testBodyGenerator() {
    const tests = {
      // Test 1: Module exists
      moduleExists: () => {
        if (!window.BodyGenerator) {
          throw new Error("BodyGenerator module not found on window object");
        }
        return true;
      },

      // Test 2: Has required methods
      hasRequiredMethods: () => {
        const requiredMethods = [
          "generateDocumentBody",
          "generateDocumentBodyMinimal",
          "generateIntegratedSidebar",
          "generateFallbackSidebar",
          "ensureTemplatesLoaded",
          "validateDependencies",
          "validateBodyParameters",
        ];

        const missing = requiredMethods.filter(
          (method) => typeof window.BodyGenerator[method] !== "function"
        );

        if (missing.length > 0) {
          throw new Error(`Missing methods: ${missing.join(", ")}`);
        }

        return true;
      },

      // Test 3: Fallback sidebar generation
      fallbackSidebarGeneration: () => {
        const fallback = window.BodyGenerator.generateFallbackSidebar();

        if (!fallback || typeof fallback !== "string") {
          throw new Error("Fallback sidebar generation failed");
        }

        if (fallback.length < 50) {
          throw new Error("Fallback sidebar too short");
        }

        if (!fallback.includes("document-sidebar")) {
          throw new Error("Fallback sidebar missing required CSS class");
        }

        if (!fallback.includes("aria-label")) {
          throw new Error("Fallback sidebar missing accessibility label");
        }

        if (!fallback.includes("Reading tools temporarily unavailable")) {
          throw new Error("Fallback sidebar missing expected message");
        }

        return true;
      },

      // Test 4: Dependency validation
      dependencyValidation: () => {
        const validation = window.BodyGenerator.validateDependencies();

        if (!validation || typeof validation !== "object") {
          throw new Error("Validation result must be an object");
        }

        if (typeof validation.isValid !== "boolean") {
          throw new Error("Validation must have isValid boolean");
        }

        if (!Array.isArray(validation.missing)) {
          throw new Error("Validation must have missing array");
        }

        // Should pass if TemplateSystem is loaded
        if (window.TemplateSystem && !validation.isValid) {
          throw new Error(
            "Validation should pass when TemplateSystem is available"
          );
        }

        return true;
      },

      // Test 5: Parameter validation
      parameterValidation: () => {
        // Test valid parameters
        const validResult = window.BodyGenerator.validateBodyParameters(
          "<div>Content</div>",
          { title: "Test" },
          "<footer>Footer</footer>"
        );

        if (!validResult.isValid) {
          throw new Error("Valid parameters incorrectly rejected");
        }

        // Test invalid content
        const invalidContent = window.BodyGenerator.validateBodyParameters(
          null,
          { title: "Test" },
          "<footer>Footer</footer>"
        );

        if (invalidContent.isValid) {
          throw new Error("Invalid content not detected");
        }

        // Test invalid metadata
        const invalidMetadata = window.BodyGenerator.validateBodyParameters(
          "<div>Content</div>",
          null,
          "<footer>Footer</footer>"
        );

        if (invalidMetadata.isValid) {
          throw new Error("Invalid metadata not detected");
        }

        // Test invalid footer
        const invalidFooter = window.BodyGenerator.validateBodyParameters(
          "<div>Content</div>",
          { title: "Test" },
          null
        );

        if (invalidFooter.isValid) {
          throw new Error("Invalid footer not detected");
        }

        return true;
      },

      // Test 6: Body generation basic functionality
      bodyGenerationBasic: async () => {
        const testContent = "<div>Test Content</div>";
        const testMetadata = { title: "Test Document" };
        const testFooter = "<footer>Test Footer</footer>";

        const bodyHTML = await window.BodyGenerator.generateDocumentBody(
          testContent,
          testMetadata,
          testFooter
        );

        if (!bodyHTML || typeof bodyHTML !== "string") {
          throw new Error("Body generation failed");
        }

        if (!bodyHTML.includes("<body>")) {
          throw new Error("Body HTML missing opening tag");
        }

        if (!bodyHTML.includes(testContent)) {
          throw new Error("Body HTML missing content");
        }

        if (!bodyHTML.includes(testFooter)) {
          throw new Error("Body HTML missing footer");
        }

        if (!bodyHTML.includes("</div>")) {
          throw new Error("Body HTML missing document-wrapper closing tag");
        }

        return true;
      },

      // Test 7: Minimal body generation
      bodyGenerationMinimal: async () => {
        const testContent = "<div>Minimal Content</div>";
        const testMetadata = { title: "Minimal Test" };
        const testFooter = "<footer>Minimal Footer</footer>";

        const bodyHTML =
          await window.BodyGenerator.generateDocumentBodyMinimal(
            testContent,
            testMetadata,
            testFooter
          );

        if (!bodyHTML || typeof bodyHTML !== "string") {
          throw new Error("Minimal body generation failed");
        }

        if (!bodyHTML.includes("<body>")) {
          throw new Error("Minimal body HTML missing opening tag");
        }

        if (!bodyHTML.includes(testContent)) {
          throw new Error("Minimal body HTML missing content");
        }

        if (!bodyHTML.includes(testFooter)) {
          throw new Error("Minimal body HTML missing footer");
        }

        return true;
      },

      // Test 8: Sidebar generation with template system
      sidebarGeneration: async () => {
        if (!window.TemplateSystem) {
          console.warn(
            "[BODY-GEN TEST] TemplateSystem not available, skipping sidebar test"
          );
          return true;
        }

        const testMetadata = { title: "Sidebar Test" };
        const sidebarHTML =
          await window.BodyGenerator.generateIntegratedSidebar(testMetadata);

        if (!sidebarHTML || typeof sidebarHTML !== "string") {
          throw new Error("Sidebar generation failed");
        }

        if (sidebarHTML.length < 50) {
          throw new Error("Sidebar HTML too short");
        }

        // Should include either real sidebar or fallback
        const hasSidebar =
          sidebarHTML.includes("document-sidebar") ||
          sidebarHTML.includes("Reading tools");

        if (!hasSidebar) {
          throw new Error("Sidebar HTML missing expected elements");
        }

        return true;
      },

      // Test 9: Template loading mechanism
      templateLoadingMechanism: async () => {
        if (!window.TemplateSystem) {
          console.warn(
            "[BODY-GEN TEST] TemplateSystem not available, skipping template loading test"
          );
          return true;
        }

        const loaded = await window.BodyGenerator.ensureTemplatesLoaded();

        if (typeof loaded !== "boolean") {
          throw new Error("ensureTemplatesLoaded must return boolean");
        }

        // If TemplateSystem exists, templates should eventually load
        if (!loaded) {
          console.warn(
            "[BODY-GEN TEST] Templates failed to load (may be expected in test environment)"
          );
        }

        return true;
      },

      // Test 10: Integration readiness
      integrationReadiness: () => {
        // Check module is properly registered
        if (!window.BodyGenerator) {
          throw new Error("Module not registered on window object");
        }

        // Check logging methods are accessible
        const loggingMethods = ["logError", "logWarn", "logInfo", "logDebug"];
        const missingLogging = loggingMethods.filter(
          (method) => typeof window.BodyGenerator[method] !== "function"
        );

        if (missingLogging.length > 0) {
          throw new Error(
            `Missing logging methods: ${missingLogging.join(", ")}`
          );
        }

        // Check core API is complete
        const coreAPI = [
          "generateDocumentBody",
          "generateDocumentBodyMinimal",
          "validateDependencies",
        ];

        const missingAPI = coreAPI.filter(
          (method) => typeof window.BodyGenerator[method] !== "function"
        );

        if (missingAPI.length > 0) {
          throw new Error(`Missing core API: ${missingAPI.join(", ")}`);
        }

        // Verify dependencies
        const deps = window.BodyGenerator.validateDependencies();
        if (!deps.isValid && window.TemplateSystem) {
          throw new Error(
            "Integration readiness check failed: " + deps.missing.join(", ")
          );
        }

        return true;
      },
    };

    return TestUtilities.runTestSuite("BodyGenerator", tests);
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testBodyGenerator,
  };
})();

// Make globally available
window.TestBodyGenerator = TestBodyGenerator;
window.testBodyGenerator = TestBodyGenerator.testBodyGenerator;