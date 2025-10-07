// error-message-generator.js
// Error Message Generator - User-friendly error message generation for different error types
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 6

const ErrorMessageGenerator = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("ERROR_MESSAGE_GEN", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[ERROR_MESSAGE_GEN]"),
    logWarn: console.warn.bind(console, "[ERROR_MESSAGE_GEN]"),
    logInfo: console.log.bind(console, "[ERROR_MESSAGE_GEN]"),
    logDebug: console.log.bind(console, "[ERROR_MESSAGE_GEN]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // ERROR MESSAGE GENERATION IMPLEMENTATION
  // ===========================================================================================

  /**
   * Generate user-friendly error messages for different error types
   * Converts technical error messages into helpful guidance for users
   * @param {Error} originalError - The original error object
   * @param {string} errorMessage - The error message string
   * @returns {string} - User-friendly error message
   */
  function generateUserFriendlyErrorMessage(originalError, errorMessage) {
    logDebug("Generating user-friendly error message for:", errorMessage);

    // Memory-related errors
    if (
      errorMessage.includes("out of memory") ||
      errorMessage.includes("Stack space overflow")
    ) {
      return "Document too complex for processing. Try reducing mathematical content or splitting into smaller sections.";
    }

    // WebAssembly errors
    if (errorMessage.includes("wasm") || errorMessage.includes("WebAssembly")) {
      return "Mathematical processing engine error. Please check LaTeX syntax and try again.";
    }

    // Timeout errors
    if (errorMessage.includes("timeout")) {
      return "Document processing timed out. Document may be too large or complex.";
    }

    // Syntax errors
    if (errorMessage.includes("syntax") || errorMessage.includes("parse")) {
      return "LaTeX syntax error detected. Please check mathematical expressions and commands.";
    }

    // Unknown command errors
    if (
      errorMessage.includes("Unknown command") ||
      errorMessage.includes("Undefined control sequence")
    ) {
      return "Unknown LaTeX command found. Please check mathematical expressions and package requirements.";
    }

    // Network or loading errors
    if (
      errorMessage.includes("network") ||
      errorMessage.includes("fetch") ||
      errorMessage.includes("load")
    ) {
      return "Network error occurred. Please check your internet connection and try again.";
    }

    // File or resource errors
    if (
      errorMessage.includes("file") ||
      errorMessage.includes("resource") ||
      errorMessage.includes("not found")
    ) {
      return "Required resource not found. Please ensure all referenced files are available.";
    }

    // Permission or security errors
    if (
      errorMessage.includes("permission") ||
      errorMessage.includes("security") ||
      errorMessage.includes("blocked")
    ) {
      return "Permission error. Please check browser security settings and try again.";
    }

    // Math-specific errors
    if (
      errorMessage.includes("math") ||
      errorMessage.includes("equation") ||
      errorMessage.includes("formula")
    ) {
      return "Mathematical expression error. Please check equation syntax and mathematical notation.";
    }

    // Generic fallback message
    logDebug("No specific error pattern matched, using generic message");
    return "Conversion failed. Please check LaTeX syntax and try again.";
  }

  /**
   * Generate contextual error suggestions based on error type
   * Provides specific recommendations for resolving different error types
   * @param {string} errorMessage - The error message to analyse
   * @returns {Array<string>} - Array of helpful suggestions
   */
  function generateErrorSuggestions(errorMessage) {
    const suggestions = [];

    // Memory error suggestions
    if (
      errorMessage.includes("out of memory") ||
      errorMessage.includes("Stack space overflow")
    ) {
      suggestions.push("Split your document into smaller sections");
      suggestions.push(
        "Reduce the number of mathematical expressions per section"
      );
      suggestions.push("Simplify complex mathematical notation");
      suggestions.push("Remove unnecessary LaTeX packages");
    }

    // Syntax error suggestions
    else if (
      errorMessage.includes("syntax") ||
      errorMessage.includes("parse")
    ) {
      suggestions.push("Check for unmatched braces { }");
      suggestions.push(
        "Verify mathematical expression delimiters ($ $, $$ $$)"
      );
      suggestions.push("Ensure all LaTeX commands are properly formatted");
      suggestions.push("Remove any unsupported LaTeX packages");
    }

    // Timeout error suggestions
    else if (errorMessage.includes("timeout")) {
      suggestions.push("Reduce document length");
      suggestions.push("Simplify mathematical expressions");
      suggestions.push("Split complex documents into multiple parts");
      suggestions.push("Remove large tables or figures");
    }

    // WebAssembly error suggestions
    else if (
      errorMessage.includes("wasm") ||
      errorMessage.includes("WebAssembly")
    ) {
      suggestions.push("Refresh the page to reload the mathematical engine");
      suggestions.push("Check LaTeX syntax for errors");
      suggestions.push("Try using simpler mathematical notation");
      suggestions.push("Ensure your browser supports WebAssembly");
    }

    // Unknown command suggestions
    else if (
      errorMessage.includes("Unknown command") ||
      errorMessage.includes("Undefined control sequence")
    ) {
      suggestions.push("Check spelling of LaTeX commands");
      suggestions.push("Ensure you're using standard LaTeX commands");
      suggestions.push("Remove custom macros or packages");
      suggestions.push("Use supported mathematical notation only");
    }

    // Generic suggestions if no specific match
    if (suggestions.length === 0) {
      suggestions.push("Check LaTeX syntax for errors");
      suggestions.push("Simplify complex mathematical expressions");
      suggestions.push("Try processing a smaller portion of the document");
      suggestions.push("Refresh the page and try again");
    }

    logDebug(`Generated ${suggestions.length} suggestions for error type`);
    return suggestions;
  }

  /**
   * Create comprehensive error report with message and suggestions
   * Combines user-friendly message with actionable suggestions
   * @param {Error} originalError - The original error object
   * @param {string} errorMessage - The error message string
   * @returns {Object} - Comprehensive error report
   */
  function createErrorReport(originalError, errorMessage) {
    const userMessage = generateUserFriendlyErrorMessage(
      originalError,
      errorMessage
    );
    const suggestions = generateErrorSuggestions(errorMessage);

    const report = {
      userMessage: userMessage,
      suggestions: suggestions,
      errorType: classifyErrorType(errorMessage),
      severity: assessErrorSeverity(errorMessage),
      recoverable: isErrorRecoverable(errorMessage),
      timestamp: new Date().toISOString(),
      originalMessage: errorMessage,
    };

    logInfo(
      `Created error report for ${report.errorType} error (severity: ${report.severity})`
    );
    return report;
  }

  /**
   * Classify error type based on error message patterns
   * @param {string} errorMessage - The error message to classify
   * @returns {string} - Error type classification
   */
  function classifyErrorType(errorMessage) {
    if (
      errorMessage.includes("out of memory") ||
      errorMessage.includes("Stack space")
    ) {
      return "memory";
    }
    if (errorMessage.includes("wasm") || errorMessage.includes("WebAssembly")) {
      return "webassembly";
    }
    if (errorMessage.includes("timeout")) {
      return "timeout";
    }
    if (errorMessage.includes("syntax") || errorMessage.includes("parse")) {
      return "syntax";
    }
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "network";
    }
    if (errorMessage.includes("Unknown command")) {
      return "unknown_command";
    }
    return "general";
  }

  /**
   * Assess error severity level
   * @param {string} errorMessage - The error message to assess
   * @returns {string} - Severity level (low, medium, high, critical)
   */
  function assessErrorSeverity(errorMessage) {
    // Critical errors that prevent any processing
    if (errorMessage.includes("wasm") || errorMessage.includes("WebAssembly")) {
      return "critical";
    }

    // High severity errors requiring significant intervention
    if (
      errorMessage.includes("out of memory") ||
      errorMessage.includes("Stack space")
    ) {
      return "high";
    }

    // Medium severity errors that can often be worked around
    if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
      return "medium";
    }

    // Low severity errors that users can typically fix themselves
    if (
      errorMessage.includes("syntax") ||
      errorMessage.includes("Unknown command")
    ) {
      return "low";
    }

    return "medium"; // Default to medium for unknown error types
  }

  /**
   * Determine if error is potentially recoverable
   * @param {string} errorMessage - The error message to assess
   * @returns {boolean} - Whether error might be recoverable
   */
  function isErrorRecoverable(errorMessage) {
    // Generally unrecoverable without user intervention
    if (
      errorMessage.includes("syntax") ||
      errorMessage.includes("Unknown command") ||
      errorMessage.includes("permission") ||
      errorMessage.includes("security")
    ) {
      return false;
    }

    // Generally recoverable with system intervention
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("out of memory") ||
      errorMessage.includes("network")
    ) {
      return true;
    }

    // WebAssembly errors might be recoverable with retry or simplified processing
    if (errorMessage.includes("wasm") || errorMessage.includes("WebAssembly")) {
      return true;
    }

    return true; // Default to recoverable for unknown error types
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testErrorMessageGenerator() {
    const tests = {
      moduleExists: () => !!window.ErrorMessageGenerator,

      hasMainFunction: () =>
        typeof generateUserFriendlyErrorMessage === "function",

      memoryErrorMessage: () => {
        const message = generateUserFriendlyErrorMessage(
          new Error("out of memory"),
          "out of memory"
        );
        return message.includes("too complex");
      },

      syntaxErrorMessage: () => {
        const message = generateUserFriendlyErrorMessage(
          new Error("syntax error"),
          "syntax error"
        );
        return message.includes("syntax error detected");
      },

      wasmErrorMessage: () => {
        const message = generateUserFriendlyErrorMessage(
          new Error("WebAssembly trap"),
          "WebAssembly trap"
        );
        return message.includes("processing engine error");
      },

      unknownCommandMessage: () => {
        const message = generateUserFriendlyErrorMessage(
          new Error("Unknown command"),
          "Unknown command \\badcommand"
        );
        return message.includes("Unknown LaTeX command");
      },

      errorSuggestions: () => {
        const suggestions = generateErrorSuggestions("syntax error");
        return Array.isArray(suggestions) && suggestions.length > 0;
      },

      errorReportCreation: () => {
        const report = createErrorReport(new Error("timeout"), "timeout error");
        return (
          report.userMessage &&
          report.suggestions &&
          report.errorType === "timeout" &&
          report.severity &&
          typeof report.recoverable === "boolean"
        );
      },

      errorClassification: () => {
        return (
          classifyErrorType("out of memory") === "memory" &&
          classifyErrorType("WebAssembly trap") === "webassembly" &&
          classifyErrorType("syntax error") === "syntax"
        );
      },

      severityAssessment: () => {
        return (
          assessErrorSeverity("WebAssembly trap") === "critical" &&
          assessErrorSeverity("out of memory") === "high" &&
          assessErrorSeverity("syntax error") === "low"
        );
      },

      recoverabilityAssessment: () => {
        return (
          !isErrorRecoverable("syntax error") &&
          isErrorRecoverable("timeout error") &&
          isErrorRecoverable("out of memory")
        );
      },

      integrationReadiness: () => {
        return (
          typeof generateUserFriendlyErrorMessage === "function" &&
          typeof generateErrorSuggestions === "function" &&
          typeof createErrorReport === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("ErrorMessageGenerator", tests) ||
      fallbackTesting("ErrorMessageGenerator", tests)
    );
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logInfo(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core error message functions
    generateUserFriendlyErrorMessage,
    generateErrorSuggestions,
    createErrorReport,

    // Utility functions
    classifyErrorType,
    assessErrorSeverity,
    isErrorRecoverable,

    // Testing
    testErrorMessageGenerator,
  };
})();

// Make globally available
window.ErrorMessageGenerator = ErrorMessageGenerator;
