const TestSCORMExportManager = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[TestSCORMExportManager] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestSCORMExportManager] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestSCORMExportManager] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestSCORMExportManager] ${message}`, ...args);
  }

  // ===========================================================================================
  // SCORM EXPORT MANAGER TESTING
  // ===========================================================================================

  /**
   * Test SCORMExportManager module functionality
   * @returns {Object} Test results following project testing patterns
   */
  function testSCORMExportManager() {
    logInfo("Starting SCORMExportManager module tests");

    try {
      if (!window.SCORMExportManager) {
        throw new Error("SCORMExportManager module not available");
      }

      const tests = {
        moduleExists: () => !!window.SCORMExportManager,

        hasRequiredMethods: () => {
          const requiredMethods = [
            "exportEnhancedSCORM",
            "generateSCORMManifest",
            "generateSCORMMetadata",
            "generateSCORMAPIWrapper",
            "validateSCORMDependencies",
            "testSCORMExport",
          ];
          return requiredMethods.every(
            (method) => typeof window.SCORMExportManager[method] === "function"
          );
        },

        configurationAvailable: () => {
          const config = window.SCORMExportManager.SCORM_CONFIG;
          return (
            config &&
            config.VERSION === "2004 3rd Edition" &&
            config.MATHJAX_MODE === "cdn" &&
            config.CONTENT_FILENAME === "content.html"
          );
        },

        dependencyValidation: () => {
          const validation =
            window.SCORMExportManager.validateSCORMDependencies();
          return (
            validation &&
            typeof validation.success === "boolean" &&
            Array.isArray(validation.missing) &&
            validation.jsZipVersion !== undefined
          );
        },

        manifestGeneration: () => {
          const testMetadata = {
            title: "Test Mathematical Document",
            author: "Test Author",
            sections: [{ title: "Test Section" }],
          };

          const manifest =
            window.SCORMExportManager.generateSCORMManifest(testMetadata);
          return (
            manifest &&
            manifest.includes('<?xml version="1.0"') &&
            manifest.includes("ADL SCORM") &&
            manifest.includes("2004 3rd Edition") &&
            manifest.includes("content.html") &&
            manifest.includes("mathematical_content")
          );
        },

        metadataGeneration: () => {
          const testMetadata = {
            title: "Test Mathematical Document",
            contentSize: 50000,
          };

          const metadata =
            window.SCORMExportManager.generateSCORMMetadata(testMetadata);
          return (
            metadata &&
            metadata.includes('<?xml version="1.0"') &&
            metadata.includes("<lom xmlns") &&
            metadata.includes("mathematics</string>") &&
            metadata.includes("accessibility</string>") &&
            metadata.includes("higher education")
          );
        },

        apiWrapperGeneration: () => {
          const apiWrapper =
            window.SCORMExportManager.generateSCORMAPIWrapper();
          return (
            apiWrapper &&
            apiWrapper.includes("findSCORMAPI") &&
            apiWrapper.includes("API_1484_11") &&
            apiWrapper.includes("Initialize") &&
            apiWrapper.includes("Mathematical content") &&
            apiWrapper.includes("window.SCORM")
          );
        },

        xmlEscaping: () => {
          const testText = "Test & \"quotes\" <tags> 'apostrophes'";
          const escaped = window.SCORMExportManager.escapeXML(testText);
          return (
            escaped.includes("&amp;") &&
            escaped.includes("&quot;") &&
            escaped.includes("&lt;") &&
            escaped.includes("&gt;") &&
            escaped.includes("&#39;")
          );
        },

        filenameGeneration: () => {
          const testMetadata = { title: "Test Mathematical Document" };
          const filename =
            window.SCORMExportManager.generateSCORMFilename(testMetadata);
          return (
            filename && filename.includes("_SCORM.zip") && filename.length > 10
          );
        },

        instructorDocumentation: () => {
          const testMetadata = { title: "Test Document" };
          const readme =
            window.SCORMExportManager.generateInstructorReadme(testMetadata);
          return (
            readme &&
            readme.includes("SCORM Package:") &&
            readme.includes("ACCESSIBILITY FEATURES") &&
            readme.includes("WCAG 2.2 AA") &&
            readme.includes("MathJax") &&
            readme.includes("LMS UPLOAD INSTRUCTIONS")
          );
        },

        builtInTesting: () => {
          // Test the module's own test function
          const testResult = window.SCORMExportManager.testSCORMExport();
          return (
            testResult &&
            typeof testResult.success === "boolean" &&
            testResult.hasOwnProperty("dependencies") &&
            testResult.hasOwnProperty("manifestGeneration") &&
            testResult.hasOwnProperty("mathjaxMode")
          );
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runTestSuite (proven working pattern)
      return TestUtilities.runTestSuite("SCORMExportManager", tests);
    } catch (error) {
      logError("Test failed:", error);
      return { success: false, error: error.message };
    }
  }

  return { testSCORMExportManager };
})();

// Export to global scope
window.TestSCORMExportManager = TestSCORMExportManager;
window.testSCORMExportManager = TestSCORMExportManager.testSCORMExportManager;
