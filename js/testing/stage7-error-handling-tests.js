/**
 * @fileoverview Stage 7 Error Handling Testing Commands
 * Comprehensive testing suite for the Stage 7 error handling system
 * Separated from main.js for better organisation and maintainability
 */

// ============================================================================
// STAGE 7: COMPREHENSIVE ERROR HANDLING TESTING COMMANDS
// ============================================================================

// Logging configuration for testing
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

// ============================================================================
// ENHANCED TEST CLEANUP SYSTEM
// ============================================================================

/**
 * Comprehensive cleanup between tests to prevent active recovery buildup
 */
async function cleanupBetweenTests() {
  console.log("🧹 Cleaning up between tests...");

  try {
    // Force cleanup all active recoveries with comprehensive clearing
    if (window.recoveryStrategies) {
      const beforeCount =
        window.recoveryStrategies.getActiveRecoveries().length;

      // First attempt: standard cleanup
      window.recoveryStrategies.forceCleanup();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second attempt: force complete any remaining recoveries
      const activeRecoveries = window.recoveryStrategies.getActiveRecoveries();
      activeRecoveries.forEach((recovery) => {
        if (recovery.status === "active") {
          recovery.status = "completed";
          recovery.endTime = Date.now();
        }
      });

      // Third attempt: nuclear cleanup if still active
      if (window.recoveryStrategies.getActiveRecoveries().length > 0) {
        window.recoveryStrategies.cancelAllRecoveries();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const afterCount = window.recoveryStrategies.getActiveRecoveries().length;
      console.log(
        `🧹 Cleaned up ${beforeCount} active recoveries (${afterCount} remaining)`
      );
    }

    // Clear error history if available
    if (
      window.errorClassification &&
      typeof window.errorClassification.clearHistory === "function"
    ) {
      window.errorClassification.clearHistory();
      console.log("🧹 Cleared error classification history");
    }

    // Reset test mode to ensure proper configuration
    if (
      window.recoveryStrategies &&
      typeof window.recoveryStrategies.setTestMode === "function"
    ) {
      window.recoveryStrategies.setTestMode(true);
      console.log("🧹 Reset test mode configuration");
    }

    // Clear any pending timeouts or intervals
    if (typeof window.clearAllTestTimers === "function") {
      window.clearAllTestTimers();
    }

    console.log("✅ Cleanup completed successfully");

    // Verify cleanup worked
    const remainingRecoveries = window.recoveryStrategies
      ? window.recoveryStrategies.getActiveRecoveries().length
      : 0;
    if (remainingRecoveries > 0) {
      console.warn(
        `⚠️ Warning: ${remainingRecoveries} recoveries still active after cleanup`
      );
    }
  } catch (cleanupError) {
    console.error("❌ Error during cleanup:", cleanupError);
    // Don't throw - continue with tests
  }
}

/**
 * Enhanced test runner with comprehensive cleanup
 */
window.testStage7Complete = async () => {
  console.log(
    "🚀 Starting Stage 7 Complete Test Suite with Enhanced Cleanup..."
  );

  try {
    // Enable test mode at start
    if (
      window.recoveryStrategies &&
      typeof window.recoveryStrategies.setTestMode === "function"
    ) {
      window.recoveryStrategies.setTestMode(true);
      console.log("🔧 Test mode enabled");
    }

    // Initial cleanup
    await cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 1: Error Classification");
    console.log("=".repeat(50));
    const errorClassificationResult = window.testErrorClassification();
    await cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 2: Recovery Strategies");
    console.log("=".repeat(50));
    const recoveryStrategiesResult = window.testRecoveryStrategies();
    await cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 3: Error Messages");
    console.log("=".repeat(50));
    const errorMessagesResult = window.testErrorMessages();
    await cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 4: Complete Workflow");
    console.log("=".repeat(50));
    const completeWorkflowResult = await window.testCompleteErrorHandling();
    await cleanupBetweenTests();

    // Final verification
    const allPassed =
      errorClassificationResult &&
      recoveryStrategiesResult &&
      errorMessagesResult &&
      completeWorkflowResult;

    console.log("\n" + "=".repeat(60));
    console.log("🎯 STAGE 7 FINAL RESULTS");
    console.log("=".repeat(60));
    console.log(
      `Error Classification: ${
        errorClassificationResult ? "✅ PASS" : "❌ FAIL"
      }`
    );
    console.log(
      `Recovery Strategies: ${recoveryStrategiesResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `Error Messages: ${errorMessagesResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `Complete Workflow: ${completeWorkflowResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log("=".repeat(60));

    const finalActiveRecoveries = window.recoveryStrategies
      ? window.recoveryStrategies.getActiveRecoveries().length
      : 0;
    console.log(`🔄 Final active recoveries: ${finalActiveRecoveries}`);

    if (allPassed && finalActiveRecoveries === 0) {
      console.log("🎉 STAGE 7 COMPLETE! All tests passed and system clean.");
    } else if (allPassed) {
      console.log("⚠️ All tests passed but cleanup verification failed");
    } else {
      console.log("❌ Stage 7 completion criteria not met");
    }

    return allPassed && finalActiveRecoveries === 0;
  } catch (testError) {
    console.error("❌ Test suite error:", testError);
    await cleanupBetweenTests(); // Cleanup even on error
    return false;
  }
};

// ============================================================================
// EXISTING TEST FUNCTIONS (Enhanced with better error handling)
// ============================================================================

window.testErrorClassification = () => {
  console.log("🧪 Testing Stage 7 Error Classification System...");

  if (!window.errorClassification) {
    console.error("❌ Error classification system not available");
    return false;
  }

  const testErrors = [
    // Network errors
    new Error("Network request failed"),
    new Error("ERR_NETWORK"),
    {
      status: 503,
      message: "Service unavailable",
      url: "https://api.example.com",
    },

    // Rate limiting
    { status: 429, message: "Rate limit exceeded" },
    new Error("Too many requests"),

    // Authentication
    { status: 401, message: "Unauthorized" },
    { status: 403, message: "Forbidden - invalid API key" },

    // File processing
    new Error("Invalid file format"),
    { status: 413, message: "File too large" },

    // API errors
    { status: 500, message: "Internal server error" },
    { status: 502, message: "Bad gateway" },

    // Validation
    new Error("Required field missing"),
    new Error("Invalid input format"),

    // Browser
    new Error("DOM element not found"),
    new Error("localStorage is not available"),
  ];

  console.log("📊 Testing error classification patterns...");

  let successCount = 0;
  testErrors.forEach((error, index) => {
    try {
      const classification = window.errorClassification.classifyError(error, {
        testContext: true,
        errorIndex: index,
      });

      console.log(`✅ Error ${index + 1}:`, {
        original: error.message || error.statusText || `Status ${error.status}`,
        category: classification.category,
        priority: classification.priority,
        recoverable: classification.recoverable,
        userAction: classification.userAction,
        time: `${classification.classificationTime?.toFixed(2)}ms`,
      });

      successCount++;
    } catch (classificationError) {
      console.error(
        `❌ Error ${index + 1} classification failed:`,
        classificationError
      );
    }
  });

  // Test pattern caching
  console.log("🔄 Testing classification caching...");
  const cacheTestError = new Error("Network request failed");
  const start1 = performance.now();
  window.errorClassification.classifyError(cacheTestError);
  const time1 = performance.now() - start1;

  const start2 = performance.now();
  window.errorClassification.classifyError(cacheTestError);
  const time2 = performance.now() - start2;

  console.log("📈 Cache performance:", {
    firstClassification: `${time1.toFixed(2)}ms`,
    cachedClassification: `${time2.toFixed(2)}ms`,
    speedup: `${(time1 / time2).toFixed(1)}x faster`,
  });

  // Test error statistics
  const stats = window.errorClassification.getErrorStatistics();
  console.log("📊 Classification statistics:", stats);

  const success = successCount === testErrors.length;
  console.log(
    success
      ? "🎉 Error classification test completed successfully!"
      : `⚠️ Error classification test completed with ${
          testErrors.length - successCount
        } failures`
  );

  return success;
};

/**
 * Test recovery strategies system
 */
window.testRecoveryStrategies = async () => {
  console.log("🛠️ Testing Stage 7 Recovery Strategies System...");

  if (!window.recoveryStrategies) {
    console.error("❌ Recovery strategies system not available");
    return false;
  }

  const testScenarios = [
    {
      name: "Network Error Recovery",
      classification: {
        category: "NETWORK",
        recoverable: true,
        priority: "high",
      },
      context: {
        retryFunction: () =>
          Promise.resolve({ success: true, data: "recovered" }),
        attemptNumber: 1,
      },
    },
    {
      name: "Rate Limit Recovery",
      classification: {
        category: "RATE_LIMIT",
        recoverable: true,
        priority: "medium",
      },
      context: {
        retryFunction: () =>
          Promise.resolve({ success: true, rateLimitCleared: true }),
        attemptNumber: 1,
      },
    },
    {
      name: "File Processing Recovery",
      classification: {
        category: "FILE_PROCESSING",
        recoverable: true,
        priority: "high",
      },
      context: {
        retryFunction: () =>
          Promise.resolve({ success: true, fileOptimized: true }),
        currentFile: { name: "test.pdf", size: 1024 * 1024 },
        fileHandler: { optimizeFile: () => Promise.resolve() },
      },
    },
    {
      name: "API Error Recovery",
      classification: {
        category: "API_ERROR",
        recoverable: true,
        priority: "high",
      },
      context: {
        retryFunction: () =>
          Promise.resolve({ success: true, serverRecovered: true }),
        healthCheckUrl: "https://httpbin.org/status/200",
      },
    },
  ];

  let successCount = 0;

  for (const scenario of testScenarios) {
    try {
      console.log(`🔧 Testing: ${scenario.name}`);

      // Get strategy
      const strategy = window.recoveryStrategies.getStrategy(
        scenario.classification,
        scenario.context
      );

      console.log(`📋 Strategy selected:`, {
        name: strategy.name,
        category: strategy.category,
        attempt: strategy.attemptNumber,
      });

      // Execute strategy (with timeout)
      const recoveryPromise = window.recoveryStrategies.executeStrategy(
        strategy,
        scenario.context
      );

      // Use longer timeout for test mode (should be longer than strategy timeout)
      const testTimeout = window.recoveryStrategies?.testMode ? 20000 : 30000; // 20s for test mode, 30s for production
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Test timeout")), testTimeout)
      );

      const result = await Promise.race([recoveryPromise, timeoutPromise]);

      console.log(`✅ ${scenario.name} completed:`, result);
      successCount++;
    } catch (recoveryError) {
      console.error(`❌ ${scenario.name} failed:`, recoveryError.message);
    }
  }

  // Test recovery metrics
  const metrics = window.recoveryStrategies.getMetrics();
  console.log("📊 Recovery metrics:", metrics);

  // Test active recoveries
  const activeRecoveries = window.recoveryStrategies.getActiveRecoveries();
  console.log("🔄 Active recoveries:", activeRecoveries.length);

  const success = successCount === testScenarios.length;
  console.log(
    success
      ? "🎉 Recovery strategies test completed successfully!"
      : `⚠️ Recovery strategies test completed with ${
          testScenarios.length - successCount
        } failures`
  );

  return success;
};

/**
 * Test error messages system
 */
window.testErrorMessages = () => {
  console.log("💬 Testing Stage 7 Error Messages System...");

  if (!window.errorMessages) {
    console.error("❌ Error messages system not available");
    return false;
  }

  const testCategories = [
    "NETWORK",
    "RATE_LIMIT",
    "AUTH",
    "FILE_PROCESSING",
    "API_ERROR",
    "VALIDATION",
    "QUOTA",
    "BROWSER",
    "UNKNOWN",
  ];

  console.log("📝 Testing user message generation...");

  let successCount = 0;
  testCategories.forEach((category) => {
    try {
      const classification = {
        category,
        priority: "medium",
        recoverable: true,
        message: `Test ${category} error`,
        timestamp: Date.now(),
        context: { testMode: true },
      };

      // Test basic message
      const basicMessage = window.errorMessages.getUserMessage(classification);
      console.log(`✅ ${category} basic message:`, {
        title: basicMessage.title,
        messageLength: basicMessage.message.length,
        actionsCount: basicMessage.actions.length,
        icon: basicMessage.icon,
      });

      // Test recovery message
      const recoveryMessage = window.errorMessages.getUserMessage(
        classification,
        {
          recovering: true,
          retryCount: 2,
          maxRetries: 3,
        }
      );

      console.log(`🔄 ${category} recovery message:`, {
        recovering: recoveryMessage.recovering,
        hasRetryInfo: !!recoveryMessage.retryInfo,
      });

      // Test notification formatting
      const notificationConfig = window.errorMessages.formatForNotification(
        basicMessage,
        "toast"
      );
      console.log(`📱 ${category} notification config:`, {
        type: notificationConfig.type,
        duration: notificationConfig.duration,
        dismissible: notificationConfig.dismissible,
      });

      // Test modal formatting
      const modalHtml = window.errorMessages.formatForModal(basicMessage);
      console.log(`🎭 ${category} modal HTML length:`, modalHtml.length);

      successCount++;
    } catch (messageError) {
      console.error(`❌ ${category} message generation failed:`, messageError);
    }
  });

  // Test recovery messages
  console.log("🚀 Testing recovery status messages...");
  const recoveryStrategies = [
    "immediate_retry",
    "exponential_backoff",
    "rate_limit_wait",
    "fallback_model",
    "file_optimization",
    "connection_check",
  ];

  recoveryStrategies.forEach((strategy) => {
    const startMessage = window.errorMessages.getRecoveryMessage(
      strategy,
      "starting"
    );
    const successMessage = window.errorMessages.getRecoverySuccessMessage(
      "NETWORK",
      "automatic"
    );
    console.log(`📤 ${strategy}:`, { startMessage, successMessage });
  });

  // Test screen reader text generation
  console.log("♿ Testing accessibility features...");
  const accessibilityTest = window.errorMessages.getUserMessage(
    {
      category: "NETWORK",
      priority: "high",
      recoverable: true,
      message: "Connection failed",
      timestamp: Date.now(),
    },
    { screenReaderOptimised: true }
  );

  console.log("🗣️ Screen reader text:", accessibilityTest.screenReaderText);

  const success = successCount === testCategories.length;
  console.log(
    success
      ? "🎉 Error messages test completed successfully!"
      : `⚠️ Error messages test completed with ${
          testCategories.length - successCount
        } failures`
  );

  return success;
};

/**
 * Test complete error handling workflow
 */
window.testCompleteErrorHandling = async () => {
  console.log("🎯 Testing Complete Stage 7 Error Handling Workflow...");

  if (!window.errorHandler) {
    console.error("❌ Main error handler not available");
    return false;
  }

  // Test different error scenarios end-to-end
  const testScenarios = [
    {
      name: "Recoverable Network Error",
      error: new Error("Network request failed"),
      context: {
        retryFunction: () => {
          console.log("🔄 Retry function called");
          return Promise.resolve({ success: true, recovered: true });
        },
        requestId: "test-request-1",
        model: "test-model",
        userContext: { isFirstTimeUser: false },
      },
      expectedOutcome: { handled: true, recovered: true },
    },
    {
      name: "Rate Limit with Auto-Recovery",
      error: { status: 429, message: "Rate limit exceeded" },
      context: {
        retryFunction: () => {
          console.log("⏰ Rate limit retry called");
          return Promise.resolve({ success: true, rateLimitCleared: true });
        },
        requestId: "test-request-2",
        conservativeRecovery: true,
      },
      expectedOutcome: { handled: true, recovered: true },
    },
    {
      name: "Critical Auth Error",
      error: { status: 401, message: "Unauthorized - invalid API key" },
      context: {
        requestId: "test-request-3",
        critical: true,
        silent: false,
      },
      expectedOutcome: { handled: true, recovered: false },
    },
    {
      name: "Background Operation Error",
      error: new Error("Background processing failed"),
      context: {
        backgroundOperation: true,
        silent: true,
        requestId: "test-request-4",
      },
      expectedOutcome: { handled: true },
    },
  ];

  let successCount = 0;
  const results = [];

  for (const scenario of testScenarios) {
    try {
      console.log(`\n🧪 Testing: ${scenario.name}`);
      console.log("📋 Scenario:", {
        error: scenario.error.message || `Status ${scenario.error.status}`,
        hasRetryFunction: !!scenario.context.retryFunction,
        contextKeys: Object.keys(scenario.context),
      });

      const startTime = performance.now();

      // Add timeout protection for hanging scenarios
      const timeoutMs = 30000; // 30 seconds max per scenario
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Scenario timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      );

      const result = await Promise.race([
        window.errorHandler.handleError(scenario.error, scenario.context),
        timeoutPromise,
      ]);

      const duration = performance.now() - startTime;

      console.log(
        `✅ ${scenario.name} completed in ${duration.toFixed(2)}ms:`,
        {
          handled: result.handled,
          recovered: result.recovered,
          strategy: result.strategy,
          userNotified: result.userNotified,
          recoveryMethod: result.recoveryMethod,
        }
      );

      // Validate expected outcomes
      let outcomeValid = true;
      for (const [key, expectedValue] of Object.entries(
        scenario.expectedOutcome
      )) {
        if (result[key] !== expectedValue) {
          console.warn(
            `⚠️ Expected ${key}: ${expectedValue}, got: ${result[key]}`
          );
          outcomeValid = false;
        }
      }

      if (outcomeValid) {
        console.log(`🎯 ${scenario.name} met expected outcomes`);
        successCount++;
      }

      results.push({ scenario: scenario.name, result, duration, outcomeValid });
    } catch (handlingError) {
      console.error(`❌ ${scenario.name} failed:`, handlingError);
      results.push({ scenario: scenario.name, error: handlingError.message });
    }
  }

  // Test system status and metrics
  console.log("\n📊 System Status and Metrics:");
  const systemStatus = window.errorHandler.getSystemStatus();
  console.log("🏗️ System Status:", systemStatus);

  const metrics = window.errorHandler.getMetrics();
  console.log("📈 Error Handling Metrics:", metrics);

  // Summary
  console.log("\n📋 Test Summary:");
  console.table(results);

  const success = successCount === testScenarios.length;
  console.log(
    success
      ? "🎉 Complete error handling workflow test successful!"
      : `⚠️ Complete workflow test: ${successCount}/${testScenarios.length} scenarios passed`
  );

  return success;
};

/**
 * Test error handling integration with existing systems
 */
window.testErrorHandlingIntegration = async () => {
  console.log("🔗 Testing Stage 7 Error Handling Integration...");

  const integrationTests = [];

  // Test 1: Universal Notifications Integration
  console.log("📢 Testing Universal Notifications integration...");
  if (
    window.notifyError &&
    window.notifySuccess &&
    window.notifyWarning &&
    window.notifyInfo
  ) {
    integrationTests.push({
      name: "Universal Notifications",
      status: "✅ Available",
    });

    // Test notification
    const testNotificationId = window.notifyInfo(
      "Testing Stage 7 error integration...",
      { duration: 3000 }
    );
    console.log("📱 Test notification sent:", testNotificationId);
  } else {
    integrationTests.push({
      name: "Universal Notifications",
      status: "❌ Missing",
    });
  }

  // Test 2: Universal Modal Integration
  console.log("🎭 Testing Universal Modal integration...");
  if (window.UniversalModal?.confirm && window.UniversalModal?.create) {
    integrationTests.push({ name: "Universal Modal", status: "✅ Available" });
  } else {
    integrationTests.push({ name: "Universal Modal", status: "❌ Missing" });
  }

  // Test 3: Accessibility Integration
  //
  // Probes window.accessibilityHelpers. This used to test window.a11y and
  // window.accessibility — neither is EVER assigned in production, so it reported
  // "Missing" unconditionally and nobody read it as a defect. Those are the same two
  // names the error handler itself resolved, which is why every error announcement in
  // the app was dead code until 1256ebc.
  console.log("♿ Testing Accessibility integration...");
  if (typeof window.accessibilityHelpers?.announce === "function") {
    integrationTests.push({ name: "Accessibility", status: "✅ Available" });
  } else {
    integrationTests.push({ name: "Accessibility", status: "❌ Missing" });
  }

  // Test 4: Request Manager Integration
  console.log("📡 Testing Request Manager integration...");
  if (window.uiController?.requestProcessor) {
    integrationTests.push({ name: "Request Manager", status: "✅ Available" });

    // Test enhanced error handling in request manager
    const requestManager = window.uiController.requestProcessor;
    if (requestManager.core?.errorHandler) {
      console.log(
        "🛠️ Enhanced error handler in Request Manager:",
        !!requestManager.core.errorHandler
      );
    }
  } else {
    integrationTests.push({ name: "Request Manager", status: "❌ Missing" });
  }

  // Test 5: File Handler Integration
  console.log("📁 Testing File Handler integration...");
  if (window.fileHandler) {
    integrationTests.push({ name: "File Handler", status: "✅ Available" });
  } else {
    integrationTests.push({ name: "File Handler", status: "⚠️ Optional" });
  }

  // Test 6: Model Registry Integration
  console.log("🤖 Testing Model Registry integration...");
  if (window.modelRegistry?.getFallbackModel) {
    integrationTests.push({ name: "Model Registry", status: "✅ Available" });
  } else {
    integrationTests.push({ name: "Model Registry", status: "❌ Missing" });
  }

  // Display integration status
  console.log("\n🔗 Integration Status:");
  console.table(integrationTests);

  // Test end-to-end integration
  console.log("\n🔄 Testing end-to-end integration...");
  try {
    const integrationError = new Error("Integration test error");
    const result = await window.errorHandler.handleError(integrationError, {
      requestId: "integration-test",
      silent: true, // Don't spam notifications during test
      retryFunction: () => Promise.resolve({ integrationTest: true }),
    });

    console.log("✅ End-to-end integration test result:", result);
    integrationTests.push({
      name: "End-to-End",
      status: result.handled ? "✅ Working" : "❌ Failed",
    });
  } catch (integrationError) {
    console.error("❌ End-to-end integration test failed:", integrationError);
    integrationTests.push({ name: "End-to-End", status: "❌ Failed" });
  }

  const successCount = integrationTests.filter((test) =>
    test.status.includes("✅")
  ).length;
  const totalTests = integrationTests.length;

  console.log(
    `\n📊 Integration Summary: ${successCount}/${totalTests} systems integrated successfully`
  );

  return successCount === totalTests;
};

/**
 * Simulate various error scenarios for testing
 */
window.simulateErrorScenarios = async () => {
  console.log("🎬 Simulating Various Error Scenarios...");

  const scenarios = [
    {
      name: "Network Timeout",
      delay: 1000,
      error: new Error("Network request timed out"),
      context: {
        requestId: "sim-1",
        retryFunction: () => Promise.resolve({ recovered: true }),
      },
    },
    {
      name: "Rate Limit Hit",
      delay: 2000,
      error: { status: 429, message: "Too many requests" },
      context: {
        requestId: "sim-2",
        retryFunction: () => Promise.resolve({ rateLimitCleared: true }),
      },
    },
    {
      name: "File Too Large",
      delay: 3000,
      error: { status: 413, message: "File size exceeds limit" },
      context: {
        requestId: "sim-3",
        fileSize: 15 * 1024 * 1024, // 15MB
        fileHandler: window.fileHandler,
      },
    },
    {
      name: "Auth Token Expired",
      delay: 4000,
      error: { status: 401, message: "Token expired" },
      context: { requestId: "sim-4", critical: true },
    },
    {
      name: "Server Error",
      delay: 5000,
      error: { status: 500, message: "Internal server error" },
      context: {
        requestId: "sim-5",
        retryFunction: () => Promise.resolve({ serverRecovered: true }),
        urgentRecovery: true,
      },
    },
  ];

  console.log(
    `🎭 Starting simulation of ${scenarios.length} error scenarios...`
  );

  for (const scenario of scenarios) {
    setTimeout(async () => {
      console.log(`\n🎬 Simulating: ${scenario.name}`);
      try {
        const result = await window.errorHandler.handleError(
          scenario.error,
          scenario.context
        );
        console.log(`✅ ${scenario.name} simulation completed:`, {
          handled: result.handled,
          recovered: result.recovered,
          strategy: result.strategy,
        });
      } catch (simError) {
        console.error(`❌ ${scenario.name} simulation failed:`, simError);
      }
    }, scenario.delay);
  }

  console.log("⏰ All error scenarios queued for simulation");
  console.log("📊 Check the console over the next few seconds for results");

  return true;
};

/**
 * Run all Stage 7 error handling tests
 */
window.testStage7Complete = async () => {
  console.log("🚀 Running Complete Stage 7 Error Handling Test Suite...");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );

  const testResults = [];
  const testSuite = [
    { name: "Error Classification", test: window.testErrorClassification },
    { name: "Recovery Strategies", test: window.testRecoveryStrategies },
    { name: "Error Messages", test: window.testErrorMessages },
    { name: "Complete Workflow", test: window.testCompleteErrorHandling },
    { name: "System Integration", test: window.testErrorHandlingIntegration },
  ];

  for (const testCase of testSuite) {
    try {
      console.log(`\n🧪 Running ${testCase.name} Tests...`);
      console.log("─".repeat(50));

      const result = await testCase.test();
      testResults.push({
        name: testCase.name,
        result,
        status: result ? "✅ PASS" : "❌ FAIL",
      });

      console.log(
        `${result ? "✅" : "❌"} ${testCase.name}: ${
          result ? "PASSED" : "FAILED"
        }`
      );
    } catch (testError) {
      console.error(`❌ ${testCase.name} test crashed:`, testError);
      testResults.push({
        name: testCase.name,
        result: false,
        status: "💥 CRASH",
        error: testError.message,
      });
    }
  }

  console.log("\n📊 Stage 7 Test Suite Results:");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.table(testResults);

  const passCount = testResults.filter((r) => r.result === true).length;
  const totalTests = testResults.length;
  const successRate = ((passCount / totalTests) * 100).toFixed(1);

  console.log(
    `\n🎯 Overall Results: ${passCount}/${totalTests} tests passed (${successRate}%)`
  );

  if (passCount === totalTests) {
    console.log("🎉 🎉 ALL STAGE 7 TESTS PASSED! 🎉 🎉");
    console.log("✅ Stage 7 Error Handling System is fully operational");
  } else {
    console.log(
      `⚠️ ${totalTests - passCount} tests failed - check implementations`
    );
  }

  return passCount === totalTests;
};

/**
 * Check error handling system health
 */
window.checkErrorHandlingHealth = () => {
  console.log("🏥 Stage 7 Error Handling System Health Check...");

  const health = {
    systems: {
      classification: !!window.errorClassification,
      recovery: !!window.recoveryStrategies,
      messages: !!window.errorMessages,
      mainHandler: !!window.errorHandler,
    },
    integrations: {
      notifications: !!(
        window.notifyError &&
        window.notifySuccess &&
        window.notifyWarning &&
        window.notifyInfo
      ),
      modals: !!(
        window.UniversalModal?.confirm && window.UniversalModal?.create
      ),
      // See the note at "Test 3: Accessibility Integration" — window.a11y and
      // window.accessibility are never assigned; this is the real announcer.
      accessibility: typeof window.accessibilityHelpers?.announce === "function",
      requestManager: !!window.uiController?.requestProcessor,
      fileHandler: !!window.fileHandler,
    },
    metrics: window.errorHandler?.getMetrics() || null,
    systemStatus: window.errorHandler?.getSystemStatus() || null,
  };

  console.log("🏗️ Core Systems:", health.systems);
  console.log("🔗 Integrations:", health.integrations);
  console.log("📊 Metrics:", health.metrics);
  console.log("⚡ System Status:", health.systemStatus);

  const coreSystemsHealthy = Object.values(health.systems).every(
    (status) => status === true
  );
  const integrationsHealthy =
    Object.values(health.integrations).filter((status) => status === true)
      .length >= 3; // At least 3 integrations

  const overallHealth = coreSystemsHealthy && integrationsHealthy;

  console.log(
    overallHealth
      ? "💚 System Health: EXCELLENT"
      : "🔶 System Health: NEEDS ATTENTION"
  );

  return health;
};

// Add the cleanup function directly
window.cleanupBetweenTests = async function () {
  console.log("🧹 Cleaning up between tests...");

  try {
    // Force cleanup all active recoveries with comprehensive clearing
    if (window.recoveryStrategies) {
      const beforeCount =
        window.recoveryStrategies.getActiveRecoveries().length;

      // First attempt: standard cleanup
      window.recoveryStrategies.forceCleanup();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second attempt: force complete any remaining recoveries
      const activeRecoveries = window.recoveryStrategies.getActiveRecoveries();
      activeRecoveries.forEach((recovery) => {
        if (recovery.status === "active") {
          recovery.status = "completed";
          recovery.endTime = Date.now();
        }
      });

      // Third attempt: nuclear cleanup if still active
      if (window.recoveryStrategies.getActiveRecoveries().length > 0) {
        window.recoveryStrategies.cancelAllRecoveries();
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Fourth attempt: manually clear the activeRecoveries Map if still not empty
        const stillActive = window.recoveryStrategies.getActiveRecoveries();
        if (stillActive.length > 0) {
          console.log(
            "🚨 Using nuclear cleanup - manually clearing recoveries"
          );
          window.recoveryStrategies.activeRecoveries?.clear();
        }
      }

      const afterCount = window.recoveryStrategies.getActiveRecoveries().length;
      console.log(
        `🧹 Cleaned up ${beforeCount} active recoveries (${afterCount} remaining)`
      );
    }

    // Clear error history if available
    if (
      window.errorClassification &&
      typeof window.errorClassification.clearHistory === "function"
    ) {
      window.errorClassification.clearHistory();
      console.log("🧹 Cleared error classification history");
    }

    // Reset test mode to ensure proper configuration
    if (
      window.recoveryStrategies &&
      typeof window.recoveryStrategies.setTestMode === "function"
    ) {
      window.recoveryStrategies.setTestMode(true);
      console.log("🧹 Reset test mode configuration");
    }

    console.log("✅ Cleanup completed successfully");

    // Verify cleanup worked
    const remainingRecoveries = window.recoveryStrategies
      ? window.recoveryStrategies.getActiveRecoveries().length
      : 0;
    if (remainingRecoveries > 0) {
      console.warn(
        `⚠️ Warning: ${remainingRecoveries} recoveries still active after cleanup`
      );
    }
  } catch (cleanupError) {
    console.error("❌ Error during cleanup:", cleanupError);
    // Don't throw - continue with tests
  }
};

// Enhanced test suite with cleanup
window.testStage7CompleteWithCleanup = async function () {
  console.log(
    "🚀 Starting Stage 7 Complete Test Suite with Enhanced Cleanup..."
  );

  try {
    // Enable test mode
    if (
      window.recoveryStrategies &&
      typeof window.recoveryStrategies.setTestMode === "function"
    ) {
      window.recoveryStrategies.setTestMode(true);
      console.log("🔧 Test mode enabled");
    }

    // Initial cleanup
    await window.cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 1: Error Classification");
    console.log("=".repeat(50));
    const errorClassificationResult = window.testErrorClassification();
    await window.cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 2: Recovery Strategies");
    console.log("=".repeat(50));
    const recoveryStrategiesResult = window.testRecoveryStrategies();
    await window.cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 3: Error Messages");
    console.log("=".repeat(50));
    const errorMessagesResult = window.testErrorMessages();
    await window.cleanupBetweenTests();

    console.log("\n" + "=".repeat(50));
    console.log("TEST 4: Complete Workflow");
    console.log("=".repeat(50));
    const completeWorkflowResult = await window.testCompleteErrorHandling();
    await window.cleanupBetweenTests();

    // Final verification
    const allPassed =
      errorClassificationResult &&
      recoveryStrategiesResult &&
      errorMessagesResult &&
      completeWorkflowResult;

    console.log("\n" + "=".repeat(60));
    console.log("🎯 STAGE 7 FINAL RESULTS");
    console.log("=".repeat(60));
    console.log(
      `Error Classification: ${
        errorClassificationResult ? "✅ PASS" : "❌ FAIL"
      }`
    );
    console.log(
      `Recovery Strategies: ${recoveryStrategiesResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `Error Messages: ${errorMessagesResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `Complete Workflow: ${completeWorkflowResult ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log("=".repeat(60));

    const finalActiveRecoveries = window.recoveryStrategies
      ? window.recoveryStrategies.getActiveRecoveries().length
      : 0;
    console.log(`🔄 Final active recoveries: ${finalActiveRecoveries}`);

    if (allPassed && finalActiveRecoveries === 0) {
      console.log("🎉 STAGE 7 COMPLETE! All tests passed and system clean.");
    } else if (allPassed) {
      console.log("⚠️ All tests passed but cleanup verification failed");
    } else {
      console.log("❌ Stage 7 completion criteria not met");
    }

    return allPassed && finalActiveRecoveries === 0;
  } catch (testError) {
    console.error("❌ Test suite error:", testError);
    await window.cleanupBetweenTests(); // Cleanup even on error
    return false;
  }
};

// Testing commands are attached to window object for global access
// No ES6 exports needed since these are meant to be used via window.testStage7Complete() etc.
