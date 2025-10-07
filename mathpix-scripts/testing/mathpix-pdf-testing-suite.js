/**
 * @fileoverview MathPix PDF Testing Suite - Comprehensive PDF processing testing framework
 * @module MathPixPDFTestingSuite
 * @author MathPix Development Team
 * @version 2.1.0
 * @since 2.1.0
 *
 * @description
 * Comprehensive testing framework for Phase 2.1 PDF processing functionality.
 * Provides systematic validation of PDF components, configuration, validation logic,
 * workflow management, and integration points.
 *
 * This file is temporary and designed for development/validation purposes.
 * It can be removed once Phase 2.1 is fully validated and stable.
 *
 * Key Features:
 * - Component availability and initialization testing
 * - Configuration validation and completeness checking
 * - PDF file validation logic testing with edge cases
 * - Processing workflow and state management validation
 * - API integration and method availability testing
 * - Error handling and recovery mechanism testing
 * - UI element presence and accessibility validation
 *
 * Usage:
 * - Include this file during development/testing phases
 * - Access via window.MathPixPDFTestingSuite global object
 * - Run comprehensive tests via window.runAllPDFTests()
 * - Individual test suites available as separate methods
 *
 * Integration:
 * - Requires MathPixController to be initialized
 * - Uses existing MATHPIX_CONFIG for configuration testing
 * - Integrates with notification system for user feedback
 * - Compatible with existing logging infrastructure
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if logging should occur based on configuration
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should proceed
 * @private
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error-level messages when appropriate
 * @param {string} message - Primary error message
 * @param {...*} args - Additional arguments for detailed error context
 * @private
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning-level messages when appropriate
 * @param {string} message - Primary warning message
 * @param {...*} args - Additional arguments for warning context
 * @private
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages when appropriate
 * @param {string} message - Primary information message
 * @param {...*} args - Additional arguments for information context
 * @private
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug-level messages when appropriate
 * @param {string} message - Primary debug message
 * @param {...*} args - Additional arguments for debug context
 * @private
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * @class MathPixPDFTestingSuite
 * @description Comprehensive testing framework for PDF processing functionality
 *
 * Provides systematic testing of all PDF processing components including
 * initialization validation, configuration verification, file validation logic,
 * workflow management, and integration testing.
 *
 * @example
 * const testSuite = new MathPixPDFTestingSuite();
 * const results = await testSuite.runAllTests();
 * console.log('Overall result:', results.overall);
 *
 * @since 2.1.0
 */
class MathPixPDFTestingSuite {
  /**
   * @constructor
   * @description Creates new PDF testing suite instance
   *
   * Initializes the testing framework with access to the MathPix controller
   * and establishes testing configuration and state tracking.
   *
   * @throws {Error} If MathPix controller is not available
   *
   * @since 2.1.0
   */
  constructor() {
    this.controller = window.getMathPixController
      ? window.getMathPixController()
      : null;

    if (!this.controller) {
      throw new Error(
        "MathPix controller not available - ensure MathPix mode is initialized"
      );
    }

    this.testResults = {
      suites: {},
      overall: {
        passed: 0,
        failed: 0,
        warnings: 0,
        errors: 0,
      },
    };

    logInfo("MathPix PDF Testing Suite initialized");
  }

  /**
   * @method testPDFComponents
   * @description Tests PDF component initialization and availability
   * @returns {Object} Comprehensive PDF component test results
   * @since 2.1.0
   */
  testPDFComponents() {
    logInfo("Running PDF component tests...");

    const results = {
      testName: "PDF Components Test",
      timestamp: new Date().toISOString(),
      passed: 0,
      failed: 0,
      warnings: 0,
      details: {},
    };

    // Test core PDF components
    const components = [
      {
        name: "pdfHandler",
        instance: this.controller.pdfHandler,
        required: true,
      },
      {
        name: "pdfProcessor",
        instance: this.controller.pdfProcessor,
        required: true,
      },
      {
        name: "pdfResultRenderer",
        instance: this.controller.pdfResultRenderer,
        required: true,
      },
      {
        name: "apiClient",
        instance: this.controller.apiClient,
        required: true,
      },
    ];

    components.forEach((component) => {
      const exists = !!component.instance;
      const hasValidate =
        exists && typeof component.instance.validate === "function";
      const hasGetDebugInfo =
        exists && typeof component.instance.getDebugInfo === "function";

      if (exists) {
        results.passed++;
        results.details[component.name] = {
          status: "✅ available",
          hasValidate,
          hasGetDebugInfo,
          isInitialised: component.instance.isInitialised || false,
        };

        // Test component validation if available
        if (hasValidate) {
          try {
            const validationResult = component.instance.validate();
            results.details[component.name].validation = validationResult
              ? "✅ passed"
              : "⚠️ failed";
            if (!validationResult) results.warnings++;
          } catch (error) {
            results.details[component.name].validation = "❌ error";
            results.details[component.name].validationError = error.message;
            results.warnings++;
          }
        }
      } else {
        results.failed++;
        results.details[component.name] = {
          status: "❌ missing",
          required: component.required,
        };
      }
    });

    // Test PDF configuration availability
    const configTests = {
      PDF_PROCESSING: !!window.MATHPIX_CONFIG?.PDF_PROCESSING,
      PDF_MESSAGES: !!window.MATHPIX_CONFIG?.PDF_MESSAGES,
      supportedFormats:
        !!window.MATHPIX_CONFIG?.PDF_PROCESSING?.SUPPORTED_PDF_FORMATS,
      maxFileSize:
        window.MATHPIX_CONFIG?.PDF_PROCESSING?.MAX_PDF_SIZE !== undefined,
      timeout: window.MATHPIX_CONFIG?.PDF_PROCESSING?.PDF_TIMEOUT !== undefined,
    };

    results.details.configuration = {};
    Object.entries(configTests).forEach(([key, passed]) => {
      results.details.configuration[key] = passed
        ? "✅ available"
        : "❌ missing";
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    });

    // Overall result
    results.overall =
      results.failed === 0
        ? "✅ PASSED"
        : results.passed > 0
        ? "⚠️ PARTIAL"
        : "❌ FAILED";

    logInfo("PDF component tests completed", results);
    return results;
  }

  /**
   * @method testPDFValidation
   * @description Tests PDF file validation functionality
   * @returns {Object} PDF validation test results
   * @since 2.1.0
   */
  testPDFValidation() {
    logInfo("Running PDF validation tests...");

    const results = {
      testName: "PDF Validation Test",
      timestamp: new Date().toISOString(),
      passed: 0,
      failed: 0,
      details: {},
    };

    if (!this.controller.pdfHandler) {
      results.failed++;
      results.details.error = "❌ PDF Handler not available for testing";
      results.overall = "❌ FAILED";
      return results;
    }

    // Test cases
    const testCases = [
      {
        name: "nullFile",
        file: null,
        expectedValid: false,
        description: "Null file handling",
      },
      {
        name: "validPDF",
        file: new File(["%PDF-1.4"], "test.pdf", { type: "application/pdf" }),
        expectedValid: true,
        description: "Valid PDF file",
      },
      {
        name: "invalidType",
        file: new File(["content"], "test.txt", { type: "text/plain" }),
        expectedValid: false,
        description: "Invalid file type rejection",
      },
      {
        name: "emptyPDF",
        file: new File([""], "empty.pdf", { type: "application/pdf" }),
        expectedValid: true,
        description: "Empty PDF file (size check)",
      },
    ];

    // Create oversized file test
    const oversizedFile = new File(["x".repeat(1000)], "huge.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(oversizedFile, "size", { value: 600 * 1024 * 1024 }); // 600MB
    testCases.push({
      name: "oversizedFile",
      file: oversizedFile,
      expectedValid: false,
      description: "Oversized file rejection",
    });

    // Run validation tests
    testCases.forEach((testCase) => {
      try {
        const result = this.controller.pdfHandler.validatePDFFile(
          testCase.file
        );
        const passed = result.valid === testCase.expectedValid;

        results.details[testCase.name] = {
          description: testCase.description,
          expected: testCase.expectedValid,
          actual: result.valid,
          message: result.message || null,
          status: passed ? "✅ passed" : "❌ failed",
        };

        if (passed) {
          results.passed++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.details[testCase.name] = {
          description: testCase.description,
          error: error.message,
          status: "❌ error",
        };
      }
    });

    results.overall = results.failed === 0 ? "✅ PASSED" : "❌ FAILED";

    logInfo("PDF validation tests completed", results);
    return results;
  }

  /**
   * @method testPDFWorkflow
   * @description Tests PDF processing workflow components and state management
   * @returns {Promise<Object>} PDF workflow test results
   * @since 2.1.0
   */
  async testPDFWorkflow() {
    logInfo("Running PDF workflow tests...");

    const results = {
      testName: "PDF Workflow Test",
      timestamp: new Date().toISOString(),
      passed: 0,
      failed: 0,
      details: {},
    };

    // Test processor state management
    if (this.controller.pdfProcessor) {
      try {
        const initialStatus =
          this.controller.pdfProcessor.getProcessingStatus();

        const stateValidation = {
          hasValidState: ["IDLE", "PROCESSING", "COMPLETED", "ERROR"].includes(
            initialStatus.state
          ),
          initialStateCorrect: initialStatus.state === "IDLE",
          nullPdfId: initialStatus.pdfId === null,
          zeroPollCount: initialStatus.pollCount === 0,
          noElapsedTime: initialStatus.elapsedTime === 0,
        };

        const allValidationsPass = Object.values(stateValidation).every(
          (v) => v === true
        );

        results.details.processingState = {
          currentState: initialStatus.state,
          validations: stateValidation,
          allValidationsPass,
          status: allValidationsPass
            ? "✅ perfect initial state"
            : "⚠️ state issues detected",
          statusObject: initialStatus,
        };

        if (allValidationsPass) {
          results.passed++;
        } else {
          results.failed++;
        }

        // Test cancellation mechanism robustness
        // RATIONALE: The cancellation method should safely handle being called
        // when no processing is active (IDLE state). This is expected user behavior
        // and the method should gracefully handle it without changing system state.
        // The warning message is correct behavior, not an error.
        try {
          // Store initial state for comparison
          const preCallStatus =
            this.controller.pdfProcessor.getProcessingStatus();

          // Test that cancellation doesn't crash when no processing is active
          this.controller.pdfProcessor.cancelProcessing();

          // Check that the processor is still in IDLE state after cancellation call
          const postCancelStatus =
            this.controller.pdfProcessor.getProcessingStatus();
          const stillIdle = postCancelStatus.state === "IDLE";
          const stateConsistent =
            preCallStatus.state === postCancelStatus.state;

          results.details.cancellation = {
            status:
              stillIdle && stateConsistent
                ? "✅ correct behavior"
                : "⚠️ unexpected state change",
            description:
              "Processing cancellation mechanism properly handles IDLE state",
            preCallState: preCallStatus.state,
            postCancelState: postCancelStatus.state,
            behaviorCorrect: stillIdle && stateConsistent,
            testRationale:
              "Calling cancelProcessing() on IDLE processor should be safe no-op",
          };

          if (stillIdle && stateConsistent) {
            results.passed++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.details.cancellation = {
            status: "❌ error",
            error: error.message,
            description: "Processing cancellation failed unexpectedly",
          };
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.details.processorError = {
          status: "❌ error",
          message: error.message,
        };
      }
    } else {
      results.failed++;
      results.details.processor = {
        status: "❌ missing",
        description: "PDF processor component not available",
      };
    }

    // Test result renderer state
    if (this.controller.pdfResultRenderer) {
      try {
        const debugInfo = this.controller.pdfResultRenderer.getDebugInfo();
        results.details.resultRenderer = {
          hasResults: !!debugInfo.currentResults,
          activeFormat: debugInfo.activeFormat,
          status: "✅ available",
          description: "PDF result renderer initialized correctly",
        };
        results.passed++;
      } catch (error) {
        results.failed++;
        results.details.resultRenderer = {
          status: "❌ error",
          error: error.message,
          description: "PDF result renderer error",
        };
      }
    } else {
      results.failed++;
      results.details.resultRenderer = {
        status: "❌ missing",
        description: "PDF result renderer not available",
      };
    }

    // Test API client PDF methods
    if (this.controller.apiClient) {
      const pdfMethods = [
        "processPDF",
        "checkPDFStatus",
        "pollPDFStatus",
        "downloadPDFFormat",
      ];
      const availableMethods = pdfMethods.filter(
        (method) => typeof this.controller.apiClient[method] === "function"
      );

      results.details.apiMethods = {
        required: pdfMethods,
        available: availableMethods,
        missing: pdfMethods.filter(
          (method) => !availableMethods.includes(method)
        ),
        status:
          availableMethods.length === pdfMethods.length
            ? "✅ all available"
            : "⚠️ some missing",
        description: `${availableMethods.length}/${pdfMethods.length} PDF API methods available`,
      };

      if (availableMethods.length === pdfMethods.length) {
        results.passed++;
      } else {
        results.failed++;
      }
    } else {
      results.failed++;
      results.details.apiClient = {
        status: "❌ missing",
        description: "API client not available",
      };
    }

    results.overall = results.failed === 0 ? "✅ PASSED" : "⚠️ PARTIAL";

    logInfo("PDF workflow tests completed", results);
    return results;
  }

  /**
   * @method testPDFConfiguration
   * @description Tests PDF configuration completeness and validity
   * @returns {Object} Configuration test results
   * @since 2.1.0
   */
  testPDFConfiguration() {
    logInfo("Running PDF configuration tests...");

    const results = {
      testName: "PDF Configuration Test",
      timestamp: new Date().toISOString(),
      passed: 0,
      failed: 0,
      details: {},
    };

    // Test main PDF processing config
    const pdfConfig = window.MATHPIX_CONFIG?.PDF_PROCESSING;
    if (pdfConfig) {
      results.details.PDF_PROCESSING = { status: "✅ available" };
      results.passed++;

      // Test individual config properties
      const configProps = [
        { key: "SUPPORTED_PDF_FORMATS", expected: "object" },
        { key: "MAX_PDF_SIZE", expected: "number" },
        { key: "PDF_TIMEOUT", expected: "number" },
        { key: "MAX_STATUS_POLLS", expected: "number" },
        { key: "STATUS_POLL_INTERVAL", expected: "number" },
      ];

      configProps.forEach((prop) => {
        const value = pdfConfig[prop.key];
        const hasValue = value !== undefined && value !== null;
        const correctType = hasValue && typeof value === prop.expected;

        results.details[prop.key] = {
          present: hasValue,
          type: typeof value,
          expectedType: prop.expected,
          status: hasValue && correctType ? "✅ valid" : "❌ invalid",
        };

        if (hasValue && correctType) {
          results.passed++;
        } else {
          results.failed++;
        }
      });
    } else {
      results.details.PDF_PROCESSING = { status: "❌ missing" };
      results.failed++;
    }

    // Test PDF messages config
    const pdfMessages = window.MATHPIX_CONFIG?.PDF_MESSAGES;
    if (pdfMessages) {
      results.details.PDF_MESSAGES = {
        status: "✅ available",
        messageCount: Object.keys(pdfMessages).length,
      };
      results.passed++;
    } else {
      results.details.PDF_MESSAGES = { status: "❌ missing" };
      results.failed++;
    }

    results.overall = results.failed === 0 ? "✅ PASSED" : "❌ FAILED";

    logInfo("PDF configuration tests completed", results);
    return results;
  }

  /**
   * @method testPDFUIElements
   * @description Tests PDF-specific UI elements presence and accessibility
   * @returns {Object} UI elements test results
   * @since 2.1.0
   */
  testPDFUIElements() {
    logInfo("Running PDF UI elements tests...");

    const results = {
      testName: "PDF UI Elements Test",
      timestamp: new Date().toISOString(),
      passed: 0,
      failed: 0,
      details: {},
    };

    // Essential PDF UI elements
    const requiredElements = [
      "mathpix-pdf-options",
      "mathpix-pdf-results",
      "mathpix-doc-name",
      "mathpix-doc-pages",
    ];

    // Format-specific elements
    const formatElements = [
      "tab-mmd",
      "tab-html",
      "tab-latex",
      "tab-docx",
      "panel-mmd",
      "panel-html",
      "panel-latex",
      "panel-docx",
    ];

    const allElements = [...requiredElements, ...formatElements];

    allElements.forEach((elementId) => {
      const element = document.getElementById(elementId);
      const exists = !!element;

      results.details[elementId] = {
        present: exists,
        status: exists ? "✅ found" : "❌ missing",
        type: exists ? element.tagName.toLowerCase() : "n/a",
        required: requiredElements.includes(elementId),
      };

      if (exists) {
        results.passed++;
      } else {
        results.failed++;
      }
    });

    results.overall = results.failed === 0 ? "✅ PASSED" : "⚠️ PARTIAL";

    logInfo("PDF UI elements tests completed", results);
    return results;
  }

  /**
   * @method runAllTests
   * @description Runs comprehensive test suite for all PDF functionality
   * @returns {Promise<Object>} Complete test results
   * @since 2.1.0
   */
  async runAllTests() {
    logInfo("Running comprehensive PDF test suite...");

    const overallResults = {
      testSuite: "Complete PDF Processing Test Suite",
      timestamp: new Date().toISOString(),
      suites: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        total: 0,
      },
    };

    try {
      // Run all test suites
      overallResults.suites.components = this.testPDFComponents();
      overallResults.suites.validation = this.testPDFValidation();
      overallResults.suites.workflow = await this.testPDFWorkflow();
      overallResults.suites.configuration = this.testPDFConfiguration();
      overallResults.suites.uiElements = this.testPDFUIElements();

      // Calculate summary
      Object.values(overallResults.suites).forEach((suite) => {
        overallResults.summary.passed += suite.passed || 0;
        overallResults.summary.failed += suite.failed || 0;
        overallResults.summary.warnings += suite.warnings || 0;
      });

      overallResults.summary.total =
        overallResults.summary.passed + overallResults.summary.failed;

      // Determine overall status
      if (overallResults.summary.failed === 0) {
        overallResults.overall = "🎉 ALL TESTS PASSED";
      } else if (
        overallResults.summary.passed > overallResults.summary.failed
      ) {
        overallResults.overall = "⚠️ PARTIAL SUCCESS";
      } else {
        overallResults.overall = "❌ TESTS FAILED";
      }

      // Log summary
      console.log("=== PDF TEST SUITE RESULTS ===");
      console.log(`Overall: ${overallResults.overall}`);
      console.log(`Passed: ${overallResults.summary.passed}`);
      console.log(`Failed: ${overallResults.summary.failed}`);
      console.log(`Warnings: ${overallResults.summary.warnings}`);
      console.log(`Total: ${overallResults.summary.total}`);
      console.log("==============================");
    } catch (error) {
      logError("Error running comprehensive test suite", error);
      overallResults.error = error.message;
      overallResults.overall = "❌ TEST SUITE ERROR";
    }

    this.testResults = overallResults;
    return overallResults;
  }

  /**
   * @method getLastResults
   * @description Gets the last test results
   * @returns {Object} Last test results
   * @since 2.1.0
   */
  getLastResults() {
    return this.testResults;
  }
}

// =============================================================================
// GLOBAL WINDOW INTEGRATION
// =============================================================================

// Create global testing suite instance
let globalTestingSuite = null;

/**
 * @function getPDFTestingSuite
 * @description Gets or creates the global PDF testing suite instance
 * @returns {MathPixPDFTestingSuite} Testing suite instance
 * @global
 * @since 2.1.0
 */
window.getPDFTestingSuite = function () {
  if (!globalTestingSuite) {
    try {
      globalTestingSuite = new MathPixPDFTestingSuite();
    } catch (error) {
      console.error("Failed to create PDF testing suite:", error.message);
      return null;
    }
  }
  return globalTestingSuite;
};

/**
 * @function runAllPDFTests
 * @description Runs comprehensive PDF test suite
 * @returns {Promise<Object>} Complete test results
 * @global
 * @since 2.1.0
 */
window.runAllPDFTests = async function () {
  const suite = window.getPDFTestingSuite();
  if (!suite) {
    console.error("PDF testing suite not available");
    return { error: "Testing suite initialization failed" };
  }
  return await suite.runAllTests();
};

// Individual test functions for backwards compatibility
window.testPDFComponents = function () {
  const suite = window.getPDFTestingSuite();
  return suite
    ? suite.testPDFComponents()
    : { error: "Testing suite not available" };
};

window.testPDFValidation = function () {
  const suite = window.getPDFTestingSuite();
  return suite
    ? suite.testPDFValidation()
    : { error: "Testing suite not available" };
};

window.testPDFWorkflow = async function () {
  const suite = window.getPDFTestingSuite();
  return suite
    ? await suite.testPDFWorkflow()
    : { error: "Testing suite not available" };
};

window.testPDFConfiguration = function () {
  const suite = window.getPDFTestingSuite();
  return suite
    ? suite.testPDFConfiguration()
    : { error: "Testing suite not available" };
};

window.testPDFUIElements = function () {
  const suite = window.getPDFTestingSuite();
  return suite
    ? suite.testPDFUIElements()
    : { error: "Testing suite not available" };
};

// Export the class for module use
export default MathPixPDFTestingSuite;
