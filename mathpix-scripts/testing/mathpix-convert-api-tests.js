/**
 * @fileoverview MathPix Convert API Client Test Suite
 * @module MathPixConvertAPITests
 * @requires mathpix-convert-api-client.js
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 6.1.0
 *
 * @description
 * Comprehensive testing suite for the MathPix Convert API Client.
 * Provides unit tests, integration tests, and live API validation.
 *
 * Test Categories:
 * - Module availability and configuration
 * - Client instantiation and singleton pattern
 * - Method availability
 * - Validation logic
 * - Format helpers
 * - Error classes and types
 * - Active conversion tracking
 * - Live API integration (requires credentials)
 *
 * Usage:
 * ```javascript
 * // Quick validation
 * validatePhase61()
 *
 * // Comprehensive tests
 * testConvertAPIClient()
 *
 * // Live API test (requires credentials)
 * testConvertAPILive()
 *
 * // Full workflow test
 * testConvertFullWorkflow()
 * ```
 */

// ============================================================================
// Logging Configuration
// ============================================================================
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
    console.error(`[ConvertAPITests] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ConvertAPITests] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ConvertAPITests] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ConvertAPITests] ${message}`, ...args);
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a test helper function for consistent test output
 * @param {Object} counters - Object with passed, failed, errors properties
 * @returns {Function} Test function
 */
function createTestHelper(counters) {
  return function test(name, condition) {
    if (condition) {
      console.log(`✅ ${name}`);
      counters.passed++;
    } else {
      console.log(`❌ ${name}`);
      counters.failed++;
      counters.errors.push(name);
    }
  };
}

/**
 * Checks if required dependencies are available
 * @returns {boolean} True if all dependencies available
 */
function checkDependencies() {
  const required = [
    {
      name: "MATHPIX_CONFIG",
      check: () => typeof MATHPIX_CONFIG !== "undefined",
    },
    { name: "MATHPIX_CONFIG.CONVERT", check: () => !!MATHPIX_CONFIG?.CONVERT },
    {
      name: "getMathPixConvertClient",
      check: () => typeof getMathPixConvertClient === "function",
    },
    { name: "ConvertError", check: () => typeof ConvertError === "function" },
    { name: "CONVERT_ERRORS", check: () => typeof CONVERT_ERRORS === "object" },
  ];

  let allAvailable = true;
  required.forEach(({ name, check }) => {
    try {
      if (!check()) {
        logError(`Missing dependency: ${name}`);
        allAvailable = false;
      }
    } catch (e) {
      logError(`Error checking dependency ${name}:`, e.message);
      allAvailable = false;
    }
  });

  return allAvailable;
}

// ============================================================================
// Main Test Suite
// ============================================================================

/**
 * Main test suite for Convert API Client
 * @function testConvertAPIClient
 * @returns {Promise<{total: number, passed: number, failed: number, errors: string[]}>}
 *
 * @example
 * const results = await testConvertAPIClient();
 * console.log(`${results.passed}/${results.total} tests passed`);
 */
window.testConvertAPIClient = async function () {
  console.log("🧪 Convert API Client Test Suite");
  console.log("================================\n");

  const counters = { passed: 0, failed: 0, errors: [] };
  const test = createTestHelper(counters);

  // Pre-flight check
  if (!checkDependencies()) {
    console.log(
      "❌ Dependencies not available. Ensure mathpix-convert-api-client.js is loaded."
    );
    return {
      total: 0,
      passed: 0,
      failed: 1,
      errors: ["Dependencies not loaded"],
    };
  }

  // 1. Module Availability
  console.log("\n📦 1. Module Availability:");
  test(
    "MathPixConvertAPIClient class exists",
    typeof MathPixConvertAPIClient === "function"
  );
  test(
    "getMathPixConvertClient function exists",
    typeof window.getMathPixConvertClient === "function"
  );
  test("ConvertError class exists", typeof ConvertError === "function");
  test("CONVERT_ERRORS defined", typeof CONVERT_ERRORS === "object");

  // 2. Configuration
  console.log("\n📦 2. Configuration:");
  test(
    "CONVERT config exists in MATHPIX_CONFIG",
    typeof MATHPIX_CONFIG !== "undefined" && !!MATHPIX_CONFIG?.CONVERT
  );
  test("ENDPOINT defined", !!MATHPIX_CONFIG?.CONVERT?.ENDPOINT);
  test(
    "FORMATS has 7 entries",
    Object.keys(MATHPIX_CONFIG?.CONVERT?.FORMATS || {}).length === 7
  );
  test(
    "POLL_INTERVAL_MS defined",
    typeof MATHPIX_CONFIG?.CONVERT?.POLL_INTERVAL_MS === "number"
  );
  test(
    "MAX_POLL_ATTEMPTS defined",
    typeof MATHPIX_CONFIG?.CONVERT?.MAX_POLL_ATTEMPTS === "number"
  );
  test(
    "MAX_MMD_SIZE_BYTES is 10MB",
    MATHPIX_CONFIG?.CONVERT?.MAX_MMD_SIZE_BYTES === 10 * 1024 * 1024
  );
  test("DEFAULT_OPTIONS defined", !!MATHPIX_CONFIG?.CONVERT?.DEFAULT_OPTIONS);
  test("MESSAGES defined", !!MATHPIX_CONFIG?.CONVERT?.MESSAGES);

  // 3. Client Instantiation
  console.log("\n📦 3. Client Instantiation:");
  let client;
  try {
    client = window.getMathPixConvertClient();
    test("Client instantiates without error", !!client);
  } catch (e) {
    test("Client instantiates without error", false);
    console.error("   Error:", e.message);
  }

  test("activeConversions is a Map", client?.activeConversions instanceof Map);
  test(
    "Singleton returns same instance",
    window.getMathPixConvertClient() === client
  );

  // 4. Method Availability
  console.log("\n📦 4. Method Availability:");
  test(
    "startConversion method exists",
    typeof client?.startConversion === "function"
  );
  test("checkStatus method exists", typeof client?.checkStatus === "function");
  test(
    "pollUntilComplete method exists",
    typeof client?.pollUntilComplete === "function"
  );
  test(
    "downloadResult method exists",
    typeof client?.downloadResult === "function"
  );
  test(
    "convertAndDownload method exists",
    typeof client?.convertAndDownload === "function"
  );
  test(
    "cancelConversion method exists",
    typeof client?.cancelConversion === "function"
  );
  test("validateMMD method exists", typeof client?.validateMMD === "function");
  test(
    "getSupportedFormats method exists",
    typeof client?.getSupportedFormats === "function"
  );
  test(
    "getActiveConversionCount method exists",
    typeof client?.getActiveConversionCount === "function"
  );
  test(
    "clearActiveConversions method exists",
    typeof client?.clearActiveConversions === "function"
  );

  // 5. Validation Logic
  console.log("\n📦 5. Validation Logic:");
  const emptyResult = client?.validateMMD?.("");
  test("Empty string fails validation", emptyResult?.valid === false);

  const nullResult = client?.validateMMD?.(null);
  test("Null fails validation", nullResult?.valid === false);

  const whitespaceResult = client?.validateMMD?.("   \n\t  ");
  test("Whitespace-only fails validation", whitespaceResult?.valid === false);

  const validResult = client?.validateMMD?.("Hello **world**");
  test("Valid MMD passes validation", validResult?.valid === true);
  test(
    "Validation returns size in bytes",
    typeof validResult?.sizeBytes === "number"
  );
  test("Size is correct for UTF-8", validResult?.sizeBytes === 15);

  // Test size limit
  const largeContent = "x".repeat(11 * 1024 * 1024); // 11MB
  const largeResult = client?.validateMMD?.(largeContent);
  test("Large content (11MB) fails validation", largeResult?.valid === false);

  // Test Unicode handling
  const unicodeContent = "Hello 世界 🌍";
  const unicodeResult = client?.validateMMD?.(unicodeContent);
  test("Unicode content passes validation", unicodeResult?.valid === true);
  test(
    "Unicode size calculated correctly",
    unicodeResult?.sizeBytes > unicodeContent.length
  ); // UTF-8 encodes multi-byte

  // 6. Format Helpers
  console.log("\n📦 6. Format Helpers:");
  const formats = client?.getSupportedFormats?.();
  test("getSupportedFormats returns array", Array.isArray(formats));
  test("Formats array has 7 items", formats?.length === 7);
  test("First format is docx (priority 1)", formats?.[0]?.key === "docx");
  test("Last format is pptx (priority 7)", formats?.[6]?.key === "pptx");
  test(
    "Format objects have required properties",
    formats?.[0]?.label &&
      formats?.[0]?.extension &&
      formats?.[0]?.mimeType !== undefined &&
      formats?.[0]?.binary !== undefined
  );

  // Check specific format properties
  const docxFormat = formats?.find((f) => f.key === "docx");
  test(
    "DOCX has correct MIME type",
    docxFormat?.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  test("DOCX is marked as binary", docxFormat?.binary === true);

  const htmlFormat = formats?.find((f) => f.key === "html");
  test("HTML is marked as non-binary", htmlFormat?.binary === false);

  // 7. Error Classes
  console.log("\n📦 7. Error Classes:");
  const testError = new ConvertError(CONVERT_ERRORS.MMD_TOO_LARGE, {
    sizeBytes: 15000000,
  });
  test("ConvertError has correct name", testError.name === "ConvertError");
  test("ConvertError has code property", testError.code === "MMD_TOO_LARGE");
  test(
    "ConvertError has recoverable property",
    testError.recoverable === false
  );
  test(
    "ConvertError message includes substitution",
    testError.message.includes("15000000")
  );

  const paramError = new ConvertError(CONVERT_ERRORS.FORMAT_ERROR, {
    format: "xyz",
    error: "test",
  });
  test(
    "ConvertError substitutes multiple parameters",
    paramError.message.includes("xyz") && paramError.message.includes("test")
  );

  // Test error inheritance
  test("ConvertError extends Error", testError instanceof Error);
  test(
    "ConvertError has substitutions property",
    testError.substitutions?.sizeBytes === 15000000
  );

  // 8. Error Type Coverage
  console.log("\n📦 8. Error Types:");
  const expectedErrors = [
    "INVALID_MMD",
    "MMD_TOO_LARGE",
    "INVALID_FORMAT",
    "NO_FORMATS",
    "API_ERROR",
    "TIMEOUT",
    "FORMAT_ERROR",
    "NETWORK_ERROR",
    "AUTH_ERROR",
    "DOWNLOAD_ERROR",
    "CANCELLED",
    "INVALID_CONVERSION_ID",
    "UNKNOWN_STATUS",
  ];
  expectedErrors.forEach((errorKey) => {
    test(`${errorKey} error defined`, !!CONVERT_ERRORS[errorKey]);
  });

  // Check error structure
  const apiError = CONVERT_ERRORS.API_ERROR;
  test("API_ERROR is recoverable", apiError?.recoverable === true);
  test(
    "AUTH_ERROR is not recoverable",
    CONVERT_ERRORS.AUTH_ERROR?.recoverable === false
  );

  // 9. Active Conversion Tracking
  console.log("\n📦 9. Active Conversion Tracking:");
  client?.clearActiveConversions?.();
  test(
    "clearActiveConversions works",
    client?.getActiveConversionCount?.() === 0
  );
  test(
    "cancelConversion returns false for unknown ID",
    client?.cancelConversion?.("fake-id") === false
  );

  // 10. Configuration Values
  console.log("\n📦 10. Configuration Values:");
  const config = MATHPIX_CONFIG?.CONVERT;
  test("Poll interval is 2000ms", config?.POLL_INTERVAL_MS === 2000);
  test("Max poll attempts is 60", config?.MAX_POLL_ATTEMPTS === 60);
  test(
    "Endpoint is correct",
    config?.ENDPOINT === "https://api.mathpix.com/v3/converter"
  );
  test(
    "DOCX default font is Georgia",
    config?.DEFAULT_OPTIONS?.docx?.font === "Georgia"
  );
  test(
    "DOCX default language is English (UK)",
    config?.DEFAULT_OPTIONS?.docx?.language === "English (UK)"
  );

  // Results
  console.log("\n================================");
  console.log(
    `📊 Results: ${counters.passed}/${
      counters.passed + counters.failed
    } tests passed`
  );
  if (counters.failed > 0) {
    console.log(`❌ ${counters.failed} tests failed:`);
    counters.errors.forEach((e) => console.log(`   - ${e}`));
  } else {
    console.log("🎉 All tests passed!");
  }

  return {
    total: counters.passed + counters.failed,
    passed: counters.passed,
    failed: counters.failed,
    errors: counters.errors,
  };
};

// ============================================================================
// Quick Validation
// ============================================================================

/**
 * Quick validation for Phase 6.1
 * @function validatePhase61
 * @returns {boolean} True if all checks pass
 *
 * @example
 * if (validatePhase61()) {
 *   console.log('Ready for Phase 6.2!');
 * }
 */
window.validatePhase61 = function () {
  console.log("🔍 Phase 6.1 Quick Validation");
  console.log("─".repeat(30));

  const checks = [
    [
      "Config loaded",
      typeof MATHPIX_CONFIG !== "undefined" && !!MATHPIX_CONFIG?.CONVERT,
    ],
    ["Endpoint defined", !!MATHPIX_CONFIG?.CONVERT?.ENDPOINT],
    [
      "7 formats defined",
      Object.keys(MATHPIX_CONFIG?.CONVERT?.FORMATS || {}).length === 7,
    ],
    ["Client available", !!window.getMathPixConvertClient?.()],
    [
      "Has startConversion",
      typeof window.getMathPixConvertClient?.()?.startConversion === "function",
    ],
    [
      "Has pollUntilComplete",
      typeof window.getMathPixConvertClient?.()?.pollUntilComplete ===
        "function",
    ],
    [
      "Has downloadResult",
      typeof window.getMathPixConvertClient?.()?.downloadResult === "function",
    ],
    [
      "Has validateMMD",
      typeof window.getMathPixConvertClient?.()?.validateMMD === "function",
    ],
    [
      "Has convertAndDownload",
      typeof window.getMathPixConvertClient?.()?.convertAndDownload ===
        "function",
    ],
    ["ConvertError available", typeof ConvertError === "function"],
    ["CONVERT_ERRORS available", typeof CONVERT_ERRORS === "object"],
  ];

  let allPassed = true;
  checks.forEach(([name, passed]) => {
    console.log(`${passed ? "✅" : "❌"} ${name}`);
    if (!passed) allPassed = false;
  });

  console.log("─".repeat(30));
  console.log(allPassed ? "✅ Phase 6.1 validated!" : "❌ Validation failed");
  return allPassed;
};

// ============================================================================
// Live API Tests
// ============================================================================

/**
 * Live API test (requires credentials configured)
 * @function testConvertAPILive
 * @param {string} [testMMD] - Optional MMD content to test
 * @returns {Promise<boolean>} True if test passes
 *
 * @example
 * // Basic test
 * await testConvertAPILive();
 *
 * // Custom content
 * await testConvertAPILive('# Custom Document\n\n$E = mc^2$');
 */
window.testConvertAPILive = async function (
  testMMD = "Hello **world** with $x^2$ mathematics"
) {
  console.log("🌐 Live API Test");
  console.log("================\n");

  const client = window.getMathPixConvertClient?.();
  if (!client) {
    console.log("❌ Client not available");
    return false;
  }

  try {
    console.log("1. Validating MMD...");
    const validation = client.validateMMD(testMMD);
    console.log(
      `   Valid: ${validation.valid}, Size: ${validation.sizeBytes} bytes`
    );

    if (!validation.valid) {
      console.log("❌ Validation failed:", validation.error);
      return false;
    }

    console.log("2. Starting conversion (md format for speed)...");
    const { conversionId } = await client.startConversion(testMMD, ["md"]);
    console.log(`   Conversion ID: ${conversionId}`);

    console.log("3. Polling for completion...");
    const pollResult = await client.pollUntilComplete(
      conversionId,
      (status) => {
        const completed = status.completed?.length || 0;
        const total = Object.keys(status.formatStatuses || {}).length;
        console.log(
          `   Progress: ${completed}/${total} formats, attempt ${status.attempts}`
        );
      }
    );
    console.log(`   Completed: [${pollResult.completed.join(", ")}]`);
    console.log(`   Failed: [${pollResult.failed.join(", ")}]`);

    if (pollResult.completed.includes("md")) {
      console.log("4. Downloading result...");
      const blob = await client.downloadResult(conversionId, "md");
      console.log(`   Downloaded: ${blob.size} bytes, type: ${blob.type}`);

      // Read content for verification
      const text = await blob.text();
      console.log(`   Content preview: "${text.substring(0, 100)}..."`);
    }

    console.log("\n✅ Live API test passed!");
    return true;
  } catch (error) {
    console.error("❌ Live API test failed:", error.message);
    console.error("   Error code:", error.code);
    console.error("   Recoverable:", error.recoverable);
    return false;
  }
};

/**
 * Test full workflow with multiple formats
 * @function testConvertFullWorkflow
 * @returns {Promise<boolean>}
 *
 * @example
 * await testConvertFullWorkflow();
 */
window.testConvertFullWorkflow = async function () {
  console.log("🔄 Full Workflow Test (Multiple Formats)");
  console.log("========================================\n");

  const client = window.getMathPixConvertClient?.();
  if (!client) {
    console.log("❌ Client not available");
    return false;
  }

  const testMMD = `# Test Document

This is a test with **bold** and *italic* text.

## Mathematics

Inline maths: $E = mc^2$

Display maths:

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

## Table

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |
`;

  try {
    console.log("Starting conversion for: md, html");
    const results = await client.convertAndDownload(testMMD, ["md", "html"], {
      onStart: (id) => console.log(`   Started: ${id}`),
      onProgress: (s) =>
        console.log(`   Progress: ${s.completed?.length || 0} complete`),
      onFormatComplete: (f, b) => console.log(`   ${f}: ${b.size} bytes`),
      onComplete: (r) =>
        console.log(`   Complete: ${r.completed.length} formats`),
      onError: (e) => console.error(`   Error: ${e.message}`),
    });

    console.log("\nResults:");
    for (const [format, blob] of results) {
      console.log(`   ${format}: ${blob.size} bytes`);
    }

    console.log("\n✅ Full workflow test passed!");
    return true;
  } catch (error) {
    console.error("❌ Full workflow test failed:", error.message);
    return false;
  }
};

/**
 * Test conversion with all available formats
 * @function testConvertAllFormats
 * @returns {Promise<boolean>}
 *
 * @example
 * await testConvertAllFormats();
 */
window.testConvertAllFormats = async function () {
  console.log("📋 All Formats Test");
  console.log("==================\n");

  const client = window.getMathPixConvertClient?.();
  if (!client) {
    console.log("❌ Client not available");
    return false;
  }

  const formats = client.getSupportedFormats();
  const formatKeys = formats.map((f) => f.key);

  console.log("Available formats:", formatKeys.join(", "));
  console.log("\nNote: latex.pdf may not be available on EU endpoint.\n");

  const testMMD = "# Test\n\nSimple $x^2$ maths.";

  try {
    console.log("Starting conversion for all formats...");
    const results = await client.convertAndDownload(testMMD, formatKeys, {
      onProgress: (s) => {
        const completed = s.completed?.length || 0;
        const failed = s.failed?.length || 0;
        console.log(
          `   Progress: ${completed} complete, ${failed} failed, attempt ${s.attempts}`
        );
      },
    });

    console.log("\n📊 Results:");
    let successCount = 0;
    for (const [format, blob] of results) {
      console.log(`   ✅ ${format}: ${blob.size} bytes`);
      successCount++;
    }

    console.log(`\n${successCount}/${formatKeys.length} formats converted.`);
    return successCount > 0;
  } catch (error) {
    console.error("❌ All formats test failed:", error.message);
    return false;
  }
};

/**
 * Test error handling scenarios
 * @function testConvertErrorHandling
 * @returns {Promise<boolean>}
 */
window.testConvertErrorHandling = async function () {
  console.log("⚠️ Error Handling Test");
  console.log("=====================\n");

  const client = window.getMathPixConvertClient?.();
  if (!client) {
    console.log("❌ Client not available");
    return false;
  }

  let passed = 0;
  let failed = 0;

  // Test 1: Empty MMD
  console.log("1. Testing empty MMD validation...");
  try {
    await client.startConversion("", ["md"]);
    console.log("   ❌ Should have thrown INVALID_MMD");
    failed++;
  } catch (e) {
    if (e.code === "INVALID_MMD") {
      console.log("   ✅ Correctly threw INVALID_MMD");
      passed++;
    } else {
      console.log(`   ❌ Wrong error: ${e.code}`);
      failed++;
    }
  }

  // Test 2: Invalid format
  console.log("2. Testing invalid format...");
  try {
    await client.startConversion("test", ["invalid_format"]);
    console.log("   ❌ Should have thrown INVALID_FORMAT");
    failed++;
  } catch (e) {
    if (e.code === "INVALID_FORMAT") {
      console.log("   ✅ Correctly threw INVALID_FORMAT");
      passed++;
    } else {
      console.log(`   ❌ Wrong error: ${e.code}`);
      failed++;
    }
  }

  // Test 3: No formats
  console.log("3. Testing no formats...");
  try {
    await client.startConversion("test", []);
    console.log("   ❌ Should have thrown NO_FORMATS");
    failed++;
  } catch (e) {
    if (e.code === "NO_FORMATS") {
      console.log("   ✅ Correctly threw NO_FORMATS");
      passed++;
    } else {
      console.log(`   ❌ Wrong error: ${e.code}`);
      failed++;
    }
  }

  // Test 4: Invalid conversion ID
  console.log("4. Testing invalid conversion ID...");
  try {
    await client.checkStatus("");
    console.log("   ❌ Should have thrown INVALID_CONVERSION_ID");
    failed++;
  } catch (e) {
    if (e.code === "INVALID_CONVERSION_ID") {
      console.log("   ✅ Correctly threw INVALID_CONVERSION_ID");
      passed++;
    } else {
      console.log(`   ❌ Wrong error: ${e.code}`);
      failed++;
    }
  }

  // Test 5: Download invalid format
  console.log("5. Testing download with invalid format...");
  try {
    await client.downloadResult("test-id", "invalid_format");
    console.log("   ❌ Should have thrown INVALID_FORMAT");
    failed++;
  } catch (e) {
    if (e.code === "INVALID_FORMAT") {
      console.log("   ✅ Correctly threw INVALID_FORMAT");
      passed++;
    } else {
      console.log(`   ❌ Wrong error: ${e.code}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed}/${passed + failed} tests passed`);
  return failed === 0;
};

// ============================================================================
// Test Suite Runner
// ============================================================================

/**
 * Run all Convert API tests
 * @function runAllConvertTests
 * @returns {Promise<{unit: Object, live: boolean, errors: boolean}>}
 */
window.runAllConvertTests = async function () {
  console.log("🚀 Running All Convert API Tests");
  console.log("================================\n");

  const results = {
    unit: null,
    live: false,
    errors: false,
  };

  // Unit tests
  console.log("--- Unit Tests ---\n");
  results.unit = await window.testConvertAPIClient();

  // Error handling tests
  console.log("\n--- Error Handling Tests ---\n");
  results.errors = await window.testConvertErrorHandling();

  // Live tests (optional, requires credentials)
  console.log("\n--- Live API Test ---\n");
  console.log("Note: This test requires API credentials to be configured.");
  console.log(
    "Run testConvertAPILive() manually if credentials are available.\n"
  );

  // Summary
  console.log("\n================================");
  console.log("📊 Test Suite Summary:");
  console.log(
    `   Unit tests: ${results.unit.passed}/${results.unit.total} passed`
  );
  console.log(`   Error handling: ${results.errors ? "✅" : "❌"}`);
  console.log("   Live tests: Run manually with testConvertAPILive()");

  return results;
};
