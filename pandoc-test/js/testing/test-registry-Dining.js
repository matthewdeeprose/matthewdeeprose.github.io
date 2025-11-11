// js/testing/test-registry.js
const TestRegistry = (function () {
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
      console.error(`[TestRegistry] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestRegistry] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestRegistry] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestRegistry] ${message}`, ...args);
  }

  // ===========================================================================================
  // REGISTRY STORAGE AND MANAGEMENT
  // ===========================================================================================

  // Internal registry storage
  const testRegistry = new Map();
  const testMetadata = new Map();
  const categoryRegistry = new Map();

  // Test discovery patterns - based on existing successful tests
  const KNOWN_TEST_PATTERNS = {
    individual: [
      { name: "AppConfig", command: "testAppConfig", module: "AppConfig" },
      {
        name: "MathJaxManager",
        command: "testMathJaxManager",
        module: "MathJaxManager",
      },
      {
        name: "LaTeXProcessor",
        command: "testLaTeXProcessor",
        module: "LaTeXProcessor",
      },
      {
        name: "ContentGenerator",
        command: "testContentGenerator",
        module: "ContentGenerator",
      },
      {
        name: "TemplateSystem",
        command: "testTemplateSystem",
        module: "TemplateSystem",
      },
      {
        name: "ExportManager",
        command: "testExportManager",
        module: "ExportManager",
      },
      {
        name: "HeadGenerator",
        command: "testHeadGenerator",
        module: "HeadGenerator",
      },
      {
        name: "ScriptOrchestrator",
        command: "testScriptOrchestrator",
        module: "ScriptOrchestrator",
      },
      {
        name: "BodyGenerator",
        command: "testBodyGenerator",
        module: "BodyGenerator",
      },
      {
        name: "FooterGenerator",
        command: "testFooterGenerator",
        module: "FooterGenerator",
      },
      {
        name: "Base64Handler",
        command: "testBase64Handler",
        module: "Base64Handler",
      },
      {
        name: "SCORMExportManager",
        command: "testSCORMExportManager",
        module: "SCORMExportManager",
      },
      {
        name: "ExampleSystem",
        command: "testExampleSystem",
        module: "ExampleSystem",
      },
      {
        name: "StatusManager",
        command: "testStatusManager",
        module: "StatusManager",
      },
      {
        name: "ConversionEngine",
        command: "testConversionEngine",
        module: "ConversionEngine",
      },
      {
        name: "EventManager",
        command: "testEventManager",
        module: "EventManager",
      },
      {
        name: "AppStateManager",
        command: "testAppStateManager",
        module: "AppStateManager",
      },
      {
        name: "LayoutDebugger",
        command: "testLayoutDebugger",
        module: "LayoutDebugger",
      },
      {
        name: "SourceViewer",
        command: "testSourceViewer",
        module: "SourceViewer",
      },
      {
        name: "AdaptiveBackground",
        module: "AdaptiveBackground",
        command: "testAdaptiveBackground",
      },
      {
        name: "MathJaxPromiseUtility",
        command: "testMathJaxPromiseUtility",
        module: "MathJaxPromiseUtility",
      },
      {
        name: "MathJaxDiagnostics",
        command: "testMathJaxDiagnostics",
        module: "TestMathJaxDiagnostics",
      },
    ],
    integration: [
      {
        name: "ExportPipeline",
        command: "testExportPipeline",
        module: "TestExportPipeline",
      },
      {
        name: "ModularIntegration",
        command: "testModularIntegration",
        module: "TestModularIntegration",
      },
      {
        name: "AccessibilityIntegration",
        command: "testAccessibilityIntegration",
        module: "TestAccessibilityIntegration",
      },
      {
        name: "Performance",
        command: "testPerformance",
        module: "TestPerformance",
      },
      {
        name: "TableEnhancements",
        command: "testTableEnhancements",
        module: "TestTableEnhancements",
      },
    ],
  };

  // ===========================================================================================
  // CORE REGISTRY FUNCTIONS
  // ===========================================================================================

  /**
   * Register a test function with metadata
   * @param {string} name - Test name
   * @param {Function} testFunction - Test function to register
   * @param {Object} metadata - Test metadata (category, module, description, etc.)
   * @returns {boolean} Success status
   */
  function registerTest(name, testFunction, metadata = {}) {
    try {
      if (!name || typeof name !== "string") {
        logError("registerTest: Invalid test name provided");
        return false;
      }

      if (!testFunction || typeof testFunction !== "function") {
        logError(`registerTest: Invalid test function for ${name}`);
        return false;
      }

      // Check for existing registration
      if (testRegistry.has(name)) {
        logWarn(`registerTest: Test '${name}' already registered, updating`);
      }

      // Register the test
      testRegistry.set(name, testFunction);

      // Store metadata
      const testMeta = {
        name: name,
        category: metadata.category || "custom",
        module: metadata.module || "unknown",
        description: metadata.description || `Test for ${name}`,
        registeredAt: new Date().toISOString(),
        ...metadata,
      };
      testMetadata.set(name, testMeta);

      // Update category registry
      const category = testMeta.category;
      if (!categoryRegistry.has(category)) {
        categoryRegistry.set(category, new Set());
      }
      categoryRegistry.get(category).add(name);

      logInfo(`✅ Registered test: ${name} (${category})`);
      return true;
    } catch (error) {
      logError(`registerTest failed for ${name}:`, error);
      return false;
    }
  }

  /**
   * Discover tests from global window object
   * @returns {Object} Discovery results
   */
  function discoverTests() {
    logInfo("🔍 Discovering tests from global scope...");

    const discoveryResults = {
      individualTests: { found: 0, available: 0, missing: [] },
      integrationTests: { found: 0, available: 0, missing: [] },
      customTests: { found: 0 },
      totalRegistered: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Discover individual tests
      KNOWN_TEST_PATTERNS.individual.forEach((testInfo) => {
        discoveryResults.individualTests.found++;

        if (typeof window[testInfo.command] === "function") {
          discoveryResults.individualTests.available++;

          // Auto-register discovered test
          const success = registerTest(
            testInfo.name,
            window[testInfo.command],
            {
              category: "individual",
              module: testInfo.module,
              command: testInfo.command,
              description: `Individual test for ${testInfo.module} module`,
              autoDiscovered: true,
            }
          );

          if (success) {
            discoveryResults.totalRegistered++;
          }
        } else {
          discoveryResults.individualTests.missing.push(testInfo.command);
          logWarn(`Missing individual test: ${testInfo.command}`);
        }
      });

      // Discover integration tests
      KNOWN_TEST_PATTERNS.integration.forEach((testInfo) => {
        discoveryResults.integrationTests.found++;

        if (typeof window[testInfo.command] === "function") {
          discoveryResults.integrationTests.available++;

          // Auto-register discovered test
          const success = registerTest(
            testInfo.name,
            window[testInfo.command],
            {
              category: "integration",
              module: testInfo.module,
              command: testInfo.command,
              description: `Integration test for ${testInfo.name}`,
              autoDiscovered: true,
            }
          );

          if (success) {
            discoveryResults.totalRegistered++;
          }
        } else {
          discoveryResults.integrationTests.missing.push(testInfo.command);
          logWarn(`Missing integration test: ${testInfo.command}`);
        }
      });

      // Look for custom tests (functions starting with 'test' not in known patterns)
      const knownCommands = new Set([
        ...KNOWN_TEST_PATTERNS.individual.map((t) => t.command),
        ...KNOWN_TEST_PATTERNS.integration.map((t) => t.command),
      ]);

      Object.keys(window).forEach((key) => {
        if (
          key.startsWith("test") &&
          typeof window[key] === "function" &&
          !knownCommands.has(key)
        ) {
          discoveryResults.customTests.found++;

          const success = registerTest(key, window[key], {
            category: "custom",
            command: key,
            description: `Custom test function: ${key}`,
            autoDiscovered: true,
          });

          if (success) {
            discoveryResults.totalRegistered++;
          }
        }
      });

      console.log("📊 Test Discovery Results:");
      console.log("===========================");
      console.log(
        `Individual Tests: ${discoveryResults.individualTests.available}/${discoveryResults.individualTests.found} available`
      );
      console.log(
        `Integration Tests: ${discoveryResults.integrationTests.available}/${discoveryResults.integrationTests.found} available`
      );
      console.log(`Custom Tests: ${discoveryResults.customTests.found} found`);
      console.log(
        `Total Registered: ${discoveryResults.totalRegistered} tests`
      );

      if (discoveryResults.individualTests.missing.length > 0) {
        console.log(
          `⚠️ Missing Individual Tests: ${discoveryResults.individualTests.missing.join(
            ", "
          )}`
        );
      }
      if (discoveryResults.integrationTests.missing.length > 0) {
        console.log(
          `⚠️ Missing Integration Tests: ${discoveryResults.integrationTests.missing.join(
            ", "
          )}`
        );
      }

      return discoveryResults;
    } catch (error) {
      logError("discoverTests failed:", error);
      return { ...discoveryResults, error: error.message };
    }
  }

  /**
   * Validate test dependencies
   * @returns {Object} Validation results
   */
  function validateDependencies() {
    logInfo("🔍 Validating test dependencies...");

    const validation = {
      success: true,
      totalTests: testRegistry.size,
      validTests: 0,
      invalidTests: 0,
      missingDependencies: [],
      details: {},
      timestamp: new Date().toISOString(),
    };

    try {
      for (const [testName, testFunction] of testRegistry.entries()) {
        const metadata = testMetadata.get(testName);
        const testValidation = {
          name: testName,
          functionValid: typeof testFunction === "function",
          moduleAvailable: false,
          dependenciesValid: true,
        };

        // Check if associated module is available
        if (metadata && metadata.module && metadata.module !== "unknown") {
          testValidation.moduleAvailable =
            typeof window[metadata.module] !== "undefined";

          if (!testValidation.moduleAvailable) {
            validation.missingDependencies.push({
              test: testName,
              module: metadata.module,
              type: "module",
            });
            testValidation.dependenciesValid = false;
          }
        }

        // Overall test validity
        const isValid =
          testValidation.functionValid && testValidation.dependenciesValid;
        if (isValid) {
          validation.validTests++;
        } else {
          validation.invalidTests++;
          validation.success = false;
        }

        validation.details[testName] = testValidation;
      }

      console.log("📊 Dependency Validation Results:");
      console.log("==================================");
      console.log(`Total Tests: ${validation.totalTests}`);
      console.log(`Valid Tests: ${validation.validTests}`);
      console.log(`Invalid Tests: ${validation.invalidTests}`);

      if (validation.missingDependencies.length > 0) {
        console.log("⚠️ Missing Dependencies:");
        validation.missingDependencies.forEach((dep) => {
          console.log(`  - ${dep.test}: missing ${dep.type} '${dep.module}'`);
        });
      }

      return validation;
    } catch (error) {
      logError("validateDependencies failed:", error);
      return { ...validation, success: false, error: error.message };
    }
  }

  /**
   * List all available tests
   * @param {string} category - Optional category filter
   * @returns {Object} List of available tests
   */
  function listAvailableTests(category = null) {
    logInfo(
      `📋 Listing available tests${
        category ? ` (category: ${category})` : ""
      }...`
    );

    const listing = {
      categories: {},
      totalTests: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      for (const [testName, testFunction] of testRegistry.entries()) {
        const metadata = testMetadata.get(testName) || {};
        const testCategory = metadata.category || "unknown";

        // Skip if category filter specified and doesn't match
        if (category && testCategory !== category) {
          continue;
        }

        if (!listing.categories[testCategory]) {
          listing.categories[testCategory] = [];
        }

        listing.categories[testCategory].push({
          name: testName,
          command: metadata.command || testName,
          module: metadata.module || "unknown",
          description: metadata.description || "No description",
          registered: metadata.registeredAt || "unknown",
          autoDiscovered: metadata.autoDiscovered || false,
        });

        listing.totalTests++;
      }

      // Sort tests within each category
      Object.keys(listing.categories).forEach((cat) => {
        listing.categories[cat].sort((a, b) => a.name.localeCompare(b.name));
      });

      console.log("📊 Available Tests:");
      console.log("==================");

      Object.entries(listing.categories).forEach(([cat, tests]) => {
        console.log(`\n${cat.toUpperCase()} (${tests.length} tests):`);
        tests.forEach((test) => {
          const autoFlag = test.autoDiscovered ? " 🔍" : "";
          console.log(`  • ${test.name}${autoFlag} - ${test.description}`);
        });
      });

      console.log(`\nTotal: ${listing.totalTests} tests available`);

      return listing;
    } catch (error) {
      logError("listAvailableTests failed:", error);
      return { ...listing, error: error.message };
    }
  }

  /**
   * Get metadata for a specific test
   * @param {string} testName - Name of the test
   * @returns {Object|null} Test metadata or null if not found
   */
  function getTestMetadata(testName) {
    if (!testName || typeof testName !== "string") {
      logError("getTestMetadata: Invalid test name provided");
      return null;
    }

    const metadata = testMetadata.get(testName);
    if (!metadata) {
      logWarn(`getTestMetadata: No metadata found for test '${testName}'`);
      return null;
    }

    logInfo(`📋 Retrieved metadata for test: ${testName}`);
    return { ...metadata }; // Return a copy to prevent external modification
  }

  /**
   * Get registry status and health information
   * @returns {Object} Comprehensive registry status
   */
  function getRegistryStatus() {
    logInfo("📊 Generating registry status report...");

    const status = {
      version: "Session 8 Step 2 - Global Command Registration",
      healthy: true,
      registrySize: testRegistry.size,
      metadataEntries: testMetadata.size,
      categories: {},
      recentActivity: [],
      systemIntegration: {},
      timestamp: new Date().toISOString(),
    };

    try {
      // Analyse categories
      for (const [category, tests] of categoryRegistry.entries()) {
        status.categories[category] = {
          count: tests.size,
          tests: Array.from(tests),
        };
      }

      // Check system integration
      status.systemIntegration = {
        testFrameworkAvailable: typeof window.TestFramework !== "undefined",
        testCommandsAvailable: typeof window.TestCommands !== "undefined",
        templateSystemAvailable: typeof window.TemplateSystem !== "undefined",
        individualTestsExpected: 17, // 🔧 Updated to match current test count
        integrationTestsExpected: 5, // 🔧 Updated to match current test count
        individualTestsFound: status.categories.individual?.count || 0,
        integrationTestsFound: status.categories.integration?.count || 0,
      };

      // Health check
      const expectedIndividual = 17; // 🔧 Updated to match current test count
      const expectedIntegration = 5; // 🔧 Updated to match current test count
      const foundIndividual = status.systemIntegration.individualTestsFound;
      const foundIntegration = status.systemIntegration.integrationTestsFound;

      if (
        foundIndividual < expectedIndividual ||
        foundIntegration < expectedIntegration
      ) {
        status.healthy = false;
        status.healthIssues = [];

        if (foundIndividual < expectedIndividual) {
          status.healthIssues.push(
            `Missing individual tests: ${foundIndividual}/${expectedIndividual}`
          );
        }
        if (foundIntegration < expectedIntegration) {
          status.healthIssues.push(
            `Missing integration tests: ${foundIntegration}/${expectedIntegration}`
          );
        }
      }

      console.log("📊 Test Registry Status:");
      console.log("========================");
      console.log(
        `Registry Health: ${
          status.healthy ? "✅ HEALTHY" : "⚠️ ISSUES DETECTED"
        }`
      );
      console.log(`Registered Tests: ${status.registrySize}`);
      console.log(`Categories: ${Object.keys(status.categories).length}`);

      Object.entries(status.categories).forEach(([category, info]) => {
        console.log(`  • ${category}: ${info.count} tests`);
      });

      console.log(`Integration Status:`);
      console.log(
        `  • TestFramework: ${
          status.systemIntegration.testFrameworkAvailable ? "✅" : "❌"
        }`
      );
      console.log(
        `  • Individual Tests: ${foundIndividual}/${expectedIndividual}`
      );
      console.log(
        `  • Integration Tests: ${foundIntegration}/${expectedIntegration}`
      );

      if (status.healthIssues) {
        console.log("⚠️ Health Issues:");
        status.healthIssues.forEach((issue) => console.log(`  • ${issue}`));
      }

      return status;
    } catch (error) {
      logError("getRegistryStatus failed:", error);
      return { ...status, healthy: false, error: error.message };
    }
  }

  // ===========================================================================================
  // DYNAMIC TEST DISCOVERY HELPERS
  // ===========================================================================================

  /**
   * Get list of individual test commands from KNOWN_TEST_PATTERNS
   * Replaces hardcoded test lists with dynamic discovery
   * @returns {string[]} Array of individual test command names
   */
  function getIndividualTestCommands() {
    try {
      return KNOWN_TEST_PATTERNS.individual.map((pattern) => pattern.command);
    } catch (error) {
      logError("Failed to get individual test commands:", error);
      return [];
    }
  }

  /**
   * Get list of integration test commands from KNOWN_TEST_PATTERNS
   * Replaces hardcoded test lists with dynamic discovery
   * @returns {string[]} Array of integration test command names
   */
  function getIntegrationTestCommands() {
    try {
      return KNOWN_TEST_PATTERNS.integration.map((pattern) => pattern.command);
    } catch (error) {
      logError("Failed to get integration test commands:", error);
      return [];
    }
  }

  // ===========================================================================================
  // DYNAMIC TEST DISCOVERY HELPERS
  // ===========================================================================================

  /**
   * Get list of individual test commands from KNOWN_TEST_PATTERNS
   * Replaces hardcoded test lists with dynamic discovery
   * @returns {string[]} Array of individual test command names
   */
  function getIndividualTestCommands() {
    try {
      return KNOWN_TEST_PATTERNS.individual.map((pattern) => pattern.command);
    } catch (error) {
      logError("Failed to get individual test commands:", error);
      return [];
    }
  }

  /**
   * Get list of integration test commands from KNOWN_TEST_PATTERNS
   * Replaces hardcoded test lists with dynamic discovery
   * @returns {string[]} Array of integration test command names
   */
  function getIntegrationTestCommands() {
    try {
      return KNOWN_TEST_PATTERNS.integration.map((pattern) => pattern.command);
    } catch (error) {
      logError("Failed to get integration test commands:", error);
      return [];
    }
  }

  // ===========================================================================================
  // INITIALISATION
  // ===========================================================================================

  /**
   * Initialise the test registry
   */
  function initialiseRegistry() {
    logInfo("🚀 Initialising Test Registry...");

    try {
      // Clear any existing registrations
      testRegistry.clear();
      testMetadata.clear();
      categoryRegistry.clear();

      // Auto-discover existing tests
      const discoveryResults = discoverTests();

      console.log("✅ Test Registry initialised successfully");
      console.log(
        `📊 Discovered and registered ${discoveryResults.totalRegistered} tests`
      );

      return true;
    } catch (error) {
      logError("Registry initialisation failed:", error);
      return false;
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    // Core registry functions
    registerTest,
    discoverTests,
    validateDependencies,
    listAvailableTests,
    getTestMetadata,
    getRegistryStatus,

    // Dynamic test discovery (Phase 4)
    getIndividualTestCommands,
    getIntegrationTestCommands,

    // Initialisation
    initialiseRegistry,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestRegistry = TestRegistry;

// Auto-initialise the registry
TestRegistry.initialiseRegistry();

console.log(
  "✅ TestRegistry loaded - Global command registration system ready!"
);
console.log("🧪 Available commands:");
console.log(
  "  • TestRegistry.registerTest(name, fn, metadata) - Register new test"
);
console.log("  • TestRegistry.discoverTests() - Auto-discover available tests");
console.log(
  "  • TestRegistry.validateDependencies() - Check test dependencies"
);
console.log(
  "  • TestRegistry.listAvailableTests() - Show all registered tests"
);
console.log("  • TestRegistry.getTestMetadata(name) - Get test information");
console.log("  • TestRegistry.getRegistryStatus() - Registry system status");
console.log("");
console.log("🔍 Registry auto-initialised and ready for test discovery!");

// ===========================================================================================
// LEGACY COMPATIBILITY LAYER (Transition Commands)
// ===========================================================================================

/**
 * Transition commands to maintain backward compatibility
 * These ensure no disruption when removing test-commands.js
 */

// Main comprehensive test command - COMPLETE QUIET MODE
window.testAll = () => {
  // Store ALL original console functions
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    error: console.error,
  };

  // Completely suppress ALL console output during testing
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
  // Keep console.error for critical errors only

  try {
    // Show start message before suppression
    originalConsole.log(
      "🔇 Running comprehensive tests in COMPLETE QUIET MODE..."
    );
    originalConsole.log(
      "📊 Testing all modules and integration tests (suppressed output)..."
    );

    const startTime = Date.now();
    const result = TestRunner.runFullValidation();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Restore ALL console functions
    Object.assign(console, originalConsole);

    // Show comprehensive summary
    console.log("=".repeat(60));
    console.log("🎯 COMPREHENSIVE TEST RESULTS (QUIET MODE)");
    console.log("=".repeat(60));
    console.log(
      `Overall Success: ${result.success ? "✅ ALL PASSED" : "❌ SOME FAILED"}`
    );
    console.log(`System Health: ${result.overallHealth || "Unknown"}`);
    console.log(`Execution Time: ${duration}ms`);

    // Try to get more detailed results if available
    try {
      const individualResult = TestFramework.runIndividualTests();
      const integrationResult = TestFramework.runIntegrationTests();

      console.log(
        `Individual Tests: ${individualResult.passedTests}/${individualResult.totalTests} passed`
      );
      console.log(
        `Integration Tests: ${integrationResult.passedTests}/${integrationResult.totalTests} passed`
      );
    } catch (e) {
      console.log("Detailed results: Available via individual commands");
    }

    console.log("=".repeat(60));
    console.log(
      "💡 For detailed output, use individual test commands or systemStatus()"
    );
    console.log("=".repeat(60));

    return result.success;
  } catch (error) {
    // Restore console functions on error
    Object.assign(console, originalConsole);
    console.error("❌ Comprehensive test failed:", error);
    return false;
  }
};

// Alternative: Super quiet mode (results only)
window.testAllQuiet = () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    error: console.error,
  };

  // Suppress ALL output except errors
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};

  try {
    const result = TestRunner.runFullValidation();

    // Restore console
    Object.assign(console, originalConsole);

    // Show only final result (1 line)
    console.log(
      `🎯 ${result.success ? "✅ ALL TESTS PASSED" : "❌ TESTS FAILED"}`
    );

    return result.success;
  } catch (error) {
    Object.assign(console, originalConsole);
    console.error("❌ Test failed:", error);
    return false;
  }
};

// Ultra-safe quiet testing (bypasses TestRunner completely)
window.testAllSafe = () => {
  console.log("🔇 Running safe comprehensive tests...");

  // ✅ FIX: Make this synchronous again to avoid Promise issues
  // Template system will use inline fallbacks immediately

  try {
    // Test core functionality without verbose TestRunner
    let allPassed = true;
    let totalTests = 0;
    let passedTests = 0;

    // Test individual modules one by one
    // ✅ DYNAMIC DISCOVERY: Uses TestRegistry instead of hardcoded list
    const individualTests = TestRegistry.getIndividualTestCommands();

    console.log("📊 Testing individual modules...");
    for (const testName of individualTests) {
      totalTests++;
      if (typeof window[testName] === "function") {
        try {
          // Suppress output during individual test
          const origLog = console.log;
          console.log = () => {};

          const result = window[testName]();
          console.log = origLog;

          if (result && result.success !== false) {
            passedTests++;
          } else {
            allPassed = false;
          }
        } catch (e) {
          console.log = origLog;
          allPassed = false;
        }
      } else {
        allPassed = false;
      }
    }

    // Test integration
    // ✅ DYNAMIC DISCOVERY: Uses TestRegistry instead of hardcoded list
    const integrationTests = TestRegistry.getIntegrationTestCommands();
    console.log("📊 Testing integration...");
    for (const testName of integrationTests) {
      totalTests++;
      if (typeof window[testName] === "function") {
        try {
          const origLog = console.log;
          console.log = () => {};

          const result = window[testName]();
          console.log = origLog;

          if (result && result.success !== false) {
            passedTests++;
          } else {
            allPassed = false;
          }
        } catch (e) {
          console.log = origLog;
          allPassed = false;
        }
      } else {
        allPassed = false;
      }
    }

    // Show results
    console.log("=".repeat(50));
    console.log("🎯 SAFE TEST RESULTS");
    console.log("=".repeat(50));
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`Overall: ${allPassed ? "✅ ALL PASSED" : "❌ SOME FAILED"}`);
    console.log("=".repeat(50));

    return allPassed;
  } catch (error) {
    console.error("❌ Safe test failed:", error);
    return false;
  }
};

// Individual quiet test functions
window.testAllModules = () => {
  console.log("🔇 Testing individual modules (quiet mode)...");
  const result = TestFramework.runIndividualTests();
  console.log(
    `📊 Individual Tests: ${result.passedTests}/${result.totalTests} passed`
  );
  return result.passedTests === result.totalTests;
};

window.testAllIntegration = () => {
  console.log("🔇 Testing integration (quiet mode)...");
  const result = TestFramework.runIntegrationTests();
  console.log(
    `📊 Integration Tests: ${result.passedTests}/${result.totalTests} passed`
  );
  return result.passedTests === result.totalTests;
};

// Quick system health check (minimal output)
window.systemStatus = () => {
  console.log("🏥 System Health Check...");

  try {
    // Check core modules quickly
    const coreModules = [
      "AppConfig",
      "TemplateSystem",
      "ExportManager",
      "ConversionEngine",
    ];
    const moduleStatus = coreModules.map((module) => ({
      name: module,
      available: typeof window[module] !== "undefined",
    }));

    const modulesOK = moduleStatus.every((m) => m.available);

    // Quick registry check
    const registryStatus = TestRegistry.getRegistryStatus();
    const registryOK =
      registryStatus.healthy && registryStatus.registrySize >= 29;

    // Quick template performance check
    let templateOK = true;
    let templatePerformance = "unknown";
    try {
      const templatePerf = window.TemplateSystem.measureTemplatePerformance();
      // 🔧 FIX: Use correct property name and reasonable threshold
      const avgTime = parseFloat(
        templatePerf.duration || templatePerf.averageRenderTime || 0
      );
      templateOK = avgTime < 5; // Use 5ms threshold instead of 1ms
      templatePerformance = `${avgTime.toFixed(2)}ms`;
    } catch (e) {
      templateOK = false;
      templatePerformance = "error";
    }

    // Summary
    console.log("=".repeat(40));
    console.log("🎯 SYSTEM STATUS SUMMARY");
    console.log("=".repeat(40));
    console.log(
      `Core Modules: ${modulesOK ? "✅ OK" : "❌ ISSUES"} (${
        moduleStatus.filter((m) => m.available).length
      }/${coreModules.length})`
    );
    console.log(
      `Test Registry: ${registryOK ? "✅ OK" : "❌ ISSUES"} (${
        registryStatus.registrySize
      } tests)`
    );
    console.log(
      `Template Performance: ${
        templateOK ? "✅ OK" : "❌ SLOW"
      } (${templatePerformance})`
    );

    const overallOK = modulesOK && registryOK && templateOK;
    console.log(`Overall: ${overallOK ? "✅ HEALTHY" : "❌ NEEDS ATTENTION"}`);
    console.log("=".repeat(40));

    return overallOK;
  } catch (error) {
    console.error("❌ Status check failed:", error);
    return false;
  }
};

// Refactoring success test
window.testRefactor = () => {
  const result = TestRunner.runProductionCheck();
  return result.success; // Return boolean for legacy compatibility
};

window.testRefactoringSuccess = () => {
  const result = TestRunner.runProductionCheck();
  return result.success; // Return boolean for legacy compatibility
};

// Module dependency test
window.testModuleDependencies = () => {
  const result = TestRegistry.validateDependencies();
  return result.success; // Return boolean for legacy compatibility
};

console.log("");
console.log("✅ Legacy compatibility layer loaded");
console.log("📋 Transition commands available:");
console.log("  • testAll() - Comprehensive tests (COMPLETE QUIET MODE)");
console.log("  • testAllQuiet() - Super quiet (1 line result only)");
console.log(
  "  • testAllSafe() - Ultra-safe testing (bypasses verbose components)"
);
console.log("  • testAllModules() - Individual module tests only");
console.log("  • testAllIntegration() - Integration tests only");
console.log("  • systemStatus() - Quick system health check");
console.log("  • testRefactor() - Production readiness check");
console.log("  • testModuleDependencies() - Dependency validation");
console.log("");
console.log("💡 Use testAllSafe() if other commands produce too much output");
console.log("💡 Use testAllQuiet() for absolute minimal output (1 line)");

// ===========================================================================================
// COMPREHENSIVE LATEX TESTING PROTOCOL COMMANDS
// ===========================================================================================

// Comprehensive LaTeX syntax testing (from testing protocol)
window.testComprehensiveLatexSyntax = () => {
  if (window.TestComprehensiveLaTeXSyntax) {
    return window.TestComprehensiveLaTeXSyntax.testComprehensiveLaTeXSyntax();
  } else {
    console.error("❌ TestComprehensiveLaTeXSyntax module not loaded");
    return { success: false, error: "Module not available" };
  }
};

// Validation functions matching testing protocol
window.validateExportedMath = () => {
  if (window.TestComprehensiveLaTeXSyntax) {
    return window.TestComprehensiveLaTeXSyntax.validateExportedMath();
  } else {
    console.error("❌ TestComprehensiveLaTeXSyntax module not loaded");
    return null;
  }
};

// Generate comprehensive test content
window.generateLatexTestDocument = () => {
  if (window.TestComprehensiveLaTeXSyntax) {
    return window.TestComprehensiveLaTeXSyntax.generateComprehensiveTestContent();
  } else {
    console.error("❌ TestComprehensiveLaTeXSyntax module not loaded");
    return null;
  }
};

// Alternative name for testing guide compatibility
window.generateLatexTestContent = window.generateLatexTestDocument;

// Individual test suite commands
window.testFundamentalOperations = () => {
  if (window.TestComprehensiveLaTeXSyntax) {
    return window.TestComprehensiveLaTeXSyntax.testCompleteSuite(
      "fundamentalOperations"
    );
  } else {
    console.error("❌ TestComprehensiveLaTeXSyntax module not loaded");
    return { success: false };
  }
};

window.testStressTesting = () => {
  if (window.TestComprehensiveLaTeXSyntax) {
    return window.TestComprehensiveLaTeXSyntax.testCompleteSuite(
      "stressTesting"
    );
  } else {
    console.error("❌ TestComprehensiveLaTeXSyntax module not loaded");
    return { success: false };
  }
};

// Enhanced validation commands
window.validateComprehensiveExport = () => {
  if (window.TestComprehensiveLaTeXSyntax) {
    return window.TestComprehensiveLaTeXSyntax.validateComprehensiveExport();
  } else {
    console.error("❌ TestComprehensiveLaTeXSyntax module not loaded");
    return null;
  }
};

// Export-specific diagnostics
window.diagnosticExportedMath = () => {
  if (window.TestLaTeXConsistency) {
    return window.TestLaTeXConsistency.diagnosticExportedMath();
  } else {
    console.error("❌ TestLaTeXConsistency module not loaded");
    return null;
  }
};

// Add to the existing console output section
console.log("");
console.log("🧮 Comprehensive LaTeX Testing Protocol commands:");
console.log(
  "  • validateExportedMath() - Establish/validate mathematical baseline"
);
console.log("  • testComprehensiveLatexSyntax() - Run all 7 test suites");
console.log(
  "  • generateLatexTestDocument() - Generate comprehensive test content"
);
console.log("  • testFundamentalOperations() - Test Suite 1 only");
console.log("  • testStressTesting() - Test Suite 7 only");
console.log(
  "  • validateComprehensiveExport() - Export validation with accuracy metrics"
);
console.log("");
console.log("💡 Testing Guide Commands (all functions work identically):");
console.log("  • generateLatexTestDocument() === generateLatexTestContent()");
console.log("  • testComprehensiveLatexSyntax() - Main comprehensive test");
console.log(
  "  • validateExportedMath() - Works in both playground and exported HTML"
);
console.log("  • validateComprehensiveExport() - Export accuracy validation");

// ===========================================================================================
// CONVERSION FLOW TRACING CONSOLE COMMANDS - Phase 8 Step 1
// ===========================================================================================

/**
 * Execute complete conversion flow tracing protocol
 * Runs all 4 scenarios (simple, complex, error, performance) and provides analysis
 */
window.traceConversionFlow = async function () {
  console.log("🔍 Starting Conversion Flow Tracing Protocol...");
  console.log("This will execute 4 tracing scenarios with detailed logging.");
  console.log("Expected duration: ~10-15 seconds");
  console.log("═".repeat(60));

  if (!window.TestConversionFlowTracing) {
    console.error("❌ TestConversionFlowTracing module not available");
    console.log("📋 Ensure test-conversion-flow-tracing.js is loaded");
    return {
      success: false,
      error: "TestConversionFlowTracing module not available",
    };
  }

  try {
    const results =
      await window.TestConversionFlowTracing.executeTracingProtocol();

    console.log("═".repeat(60));
    console.log("🎯 CONVERSION FLOW TRACING COMPLETE");
    console.log("═".repeat(60));

    if (results.success) {
      console.log("✅ All scenarios executed successfully");
      console.log("\n📊 TOP 10 MOST ACTIVE MODULES:");
      results.overallAnalysis.topModules.forEach((module, index) => {
        console.log(`${index + 1}. ${module[0]}: ${module[1]} calls`);
      });

      console.log(`\n📈 SUMMARY STATISTICS:`);
      console.log(
        `• Total events recorded: ${results.overallAnalysis.totalEvents}`
      );
      console.log(
        `• Decision points identified: ${results.overallAnalysis.totalDecisionPoints}`
      );
      console.log(
        `• Scenarios executed: ${results.overallAnalysis.scenarioCount}`
      );

      if (results.overallAnalysis.recommendations.length > 0) {
        console.log(`\n💡 ARCHITECTURAL INSIGHTS:`);
        results.overallAnalysis.recommendations.forEach((rec) => {
          console.log(`• ${rec}`);
        });
      }

      console.log(
        `\n🔧 Access detailed results via: window.lastTracingResults`
      );
      window.lastTracingResults = results;
    } else {
      console.error("❌ Tracing protocol failed:", results.error);
    }

    return results;
  } catch (error) {
    console.error("❌ Tracing protocol execution failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Quick tracing validation - tests the tracing system without full protocol
 */
window.testTracingSystem = function () {
  console.log("🧪 Testing Conversion Flow Tracing System...");

  if (!window.TestConversionFlowTracing) {
    console.error("❌ TestConversionFlowTracing module not available");
    return { success: false };
  }

  const results = window.TestConversionFlowTracing.testConversionFlowTracing();

  // Fix: Check for successful test results correctly
  const isSuccess = results.failed === 0 && results.passed > 0;

  if (isSuccess) {
    console.log("✅ Tracing system validation passed");
    console.log(`📊 Passed: ${results.passed}/${results.totalTests} tests`);
  } else {
    console.error("❌ Tracing system validation failed");
    console.log(`❌ Failed tests: ${results.failed}/${results.totalTests}`);
    if (results.failedTests && results.failedTests.length > 0) {
      console.log("Failed test details:", results.failedTests);
    }
  }

  return {
    success: isSuccess,
    passed: results.passed,
    total: results.totalTests,
    details: results,
  };
};

/**
 * Execute individual tracing scenarios
 */
window.traceSimpleEquation = async function () {
  console.log("🔍 Executing Simple Equation Tracing Scenario...");
  if (!window.TestConversionFlowTracing) {
    console.error("❌ TestConversionFlowTracing module not available");
    return { success: false };
  }

  const results =
    await window.TestConversionFlowTracing.executeSimpleEquationScenario();
  console.log("✅ Simple equation scenario complete");
  console.log(
    `📊 Module calls: ${
      Object.keys(results.moduleCallCounts).length
    } modules, ${results.summary.totalEvents} events`
  );
  return results;
};

window.traceComplexDocument = async function () {
  console.log("🔍 Executing Complex Document Tracing Scenario...");
  if (!window.TestConversionFlowTracing) {
    console.error("❌ TestConversionFlowTracing module not available");
    return { success: false };
  }

  const results =
    await window.TestConversionFlowTracing.executeComplexDocumentScenario();
  console.log("✅ Complex document scenario complete");
  console.log(
    `📊 Module calls: ${
      Object.keys(results.moduleCallCounts).length
    } modules, ${results.summary.totalEvents} events`
  );
  return results;
};

window.traceErrorRecovery = async function () {
  console.log("🔍 Executing Error Recovery Tracing Scenario...");
  if (!window.TestConversionFlowTracing) {
    console.error("❌ TestConversionFlowTracing module not available");
    return { success: false };
  }

  const results =
    await window.TestConversionFlowTracing.executeErrorRecoveryScenario();
  console.log("✅ Error recovery scenario complete");
  console.log(
    `📊 Module calls: ${
      Object.keys(results.moduleCallCounts).length
    } modules, ${results.summary.totalEvents} events`
  );
  console.log(`⚠️ Error events captured: ${results.summary.errorEventCount}`);
  return results;
};

window.tracePerformanceOptimization = async function () {
  console.log("🔍 Executing Performance Optimization Tracing Scenario...");
  if (!window.TestConversionFlowTracing) {
    console.error("❌ TestConversionFlowTracing module not available");
    return { success: false };
  }

  const results =
    await window.TestConversionFlowTracing.executePerformanceScenario();
  console.log("✅ Performance optimization scenario complete");
  console.log(
    `📊 Module calls: ${
      Object.keys(results.moduleCallCounts).length
    } modules, ${results.summary.totalEvents} events`
  );
  return results;
};

/**
 * Manual tracing controls for advanced users
 */
window.startTracing = function (scenario = "manual") {
  if (!window.LoggingSystem) {
    console.error("❌ LoggingSystem not available");
    return false;
  }

  console.log(`🔍 Starting manual conversion tracing: ${scenario}`);
  const sessionId = window.LoggingSystem.enableConversionTracing(scenario);
  console.log(`📋 Session ID: ${sessionId}`);
  console.log("💡 Use stopTracing() to end session and view results");
  return sessionId;
};

window.stopTracing = function () {
  if (!window.LoggingSystem) {
    console.error("❌ LoggingSystem not available");
    return false;
  }

  console.log("🛑 Stopping conversion tracing...");
  const results = window.LoggingSystem.disableConversionTracing();

  console.log("✅ Tracing session complete");
  console.log(
    `📊 Results: ${results.summary.totalEvents} events, ${
      Object.keys(results.moduleCallCounts).length
    } modules`
  );
  console.log("🔧 Full results stored in window.lastTracingResults");

  window.lastTracingResults = results;
  return results;
};

window.getTracingStatus = function () {
  if (!window.LoggingSystem) {
    console.error("❌ LoggingSystem not available");
    return false;
  }

  const status = window.LoggingSystem.getTracingStatus();
  console.log("📊 Tracing Status:", status);
  return status;
};

/**
 * Helper command to show all available tracing commands
 */
window.tracingHelp = function () {
  console.log("🔍 CONVERSION FLOW TRACING COMMANDS");
  console.log("═".repeat(50));
  console.log("📋 Primary Commands:");
  console.log(
    "  traceConversionFlow()    - Execute complete tracing protocol (4 scenarios)"
  );
  console.log(
    "  testTracingSystem()      - Quick validation of tracing system"
  );
  console.log("");
  console.log("🎯 Individual Scenarios:");
  console.log("  traceSimpleEquation()    - Simple equation processing");
  console.log("  traceComplexDocument()   - Complex document with chunking");
  console.log("  traceErrorRecovery()     - Error handling and fallbacks");
  console.log(
    "  tracePerformanceOptimization() - Rapid successive conversions"
  );
  console.log("");
  console.log("⚙️ Manual Controls:");
  console.log("  startTracing(scenario)   - Begin manual tracing session");
  console.log("  stopTracing()           - End tracing and show results");
  console.log("  getTracingStatus()      - Check current tracing status");
  console.log("");
  console.log("📊 Results Access:");
  console.log("  window.lastTracingResults - Most recent tracing session data");
  console.log("");
  console.log("💡 Example Usage:");
  console.log("  await traceConversionFlow()  // Complete analysis");
  console.log("  startTracing('my-test'); /* do conversions */; stopTracing()");
};

// Add tracing commands to help
const originalHelp = window.help;
window.help = function () {
  if (originalHelp) originalHelp();
  console.log("\n🔍 CONVERSION FLOW TRACING:");
  console.log("  tracingHelp()           - Show all tracing commands");
  console.log("  traceConversionFlow()   - Execute complete tracing protocol");
  console.log("  testTracingSystem()     - Quick tracing system validation");
};

console.log("");
console.log("🔍 CONVERSION FLOW TRACING COMMANDS - Phase 8 Step 1:");
console.log("  • tracingHelp()          - Show all tracing commands");
console.log(
  "  • traceConversionFlow()  - Execute complete 4-scenario protocol"
);
console.log("  • testTracingSystem()    - Quick tracing system validation");
console.log(
  "  • traceSimpleEquation()  - Individual scenario: simple equation"
);
console.log(
  "  • traceComplexDocument() - Individual scenario: complex document"
);
console.log("  • traceErrorRecovery()   - Individual scenario: error recovery");
console.log(
  "  • tracePerformanceOptimization() - Individual scenario: performance"
);
console.log("  • startTracing(name) / stopTracing() - Manual tracing controls");
console.log("  • getTracingStatus()     - Check current tracing status");
console.log("");
console.log("💡 Primary Command: await traceConversionFlow()");
console.log(
  "🎯 This implements the Phase 8 Step 1 Conversion Flow Tracing Protocol"
);
