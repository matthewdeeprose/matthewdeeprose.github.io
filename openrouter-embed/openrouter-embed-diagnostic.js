/**
 * OpenRouter Embed - Diagnostic Testing Suite
 *
 * Run these tests in the browser console to verify component availability
 * and behaviour before implementing the embed API.
 *
 * Usage in console:
 * 1. await window.testEmbedDiagnostics()  // Run all tests
 * 2. await window.testEmbedComponent('client')  // Test specific component
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION (IIFE-scoped to avoid global conflicts)
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

  function shouldLog(level) {
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("❌ [DIAGNOSTIC]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("⚠️ [DIAGNOSTIC]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("ℹ️ [DIAGNOSTIC]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("🔍 [DIAGNOSTIC]", message, ...args);
  }

  function logSuccess(message, ...args) {
    console.log("✅ [DIAGNOSTIC]", message, ...args);
  }

  function logTest(testName) {
    console.log("\n" + "=".repeat(60));
    console.log(`🧪 Testing: ${testName}`);
    console.log("=".repeat(60));
  }

  // ============================================================================
  // TEST 1: Component Availability
  // ============================================================================

  async function test1_ComponentAvailability() {
    logTest("Component Availability");

    const components = {
      CONFIG: window.CONFIG,
      openRouterClient: window.openRouterClient,
      uiController: window.uiController,
      parameterController: window.parameterController,
      fileHandler: window.fileHandler,
      responseSizeManager: window.responseSizeManager,
      errorHandler: window.errorHandler,
      notifySuccess: window.notifySuccess,
      notifyError: window.notifyError,
      notifyWarning: window.notifyWarning,
      notifyInfo: window.notifyInfo,
      safeConfirm: window.safeConfirm,
      safeAlert: window.safeAlert,
      MarkdownEditor: window.MarkdownEditor,
      UniversalNotifications: window.UniversalNotifications,
      UniversalModal: window.UniversalModal,
    };

    const results = {
      available: [],
      unavailable: [],
      total: Object.keys(components).length,
    };

    Object.entries(components).forEach(([name, component]) => {
      if (component !== undefined && component !== null) {
        results.available.push(name);
        logSuccess(`${name} is available`);
      } else {
        results.unavailable.push(name);
        logError(`${name} is NOT available`);
      }
    });

    logInfo(
      `\nAvailability Summary: ${results.available.length}/${results.total} components available`
    );

    if (results.unavailable.length > 0) {
      logWarn("Missing components:", results.unavailable);
    }

    return results;
  }

  // ============================================================================
  // TEST 2: OpenRouter Client Interface
  // ============================================================================

  async function test2_OpenRouterClient() {
    logTest("OpenRouter Client Interface");

    if (!window.openRouterClient) {
      logError("openRouterClient not available - cannot test");
      return { error: "Component not available" };
    }

    const client = window.openRouterClient;

    // Test available methods
    const expectedMethods = [
      "sendRequest",
      "sendStreamingRequest",
      "setDebugMode",
      "clearCache",
      "getCacheStats",
      "getModelFamily",
      "updateDisplay",
      "isFreeModel",
      "calculateCost",
      "formatCost",
    ];

    const availableMethods = expectedMethods.filter(
      (method) => typeof client[method] === "function"
    );

    logInfo("Available methods:", availableMethods);
    logInfo(
      "Method count:",
      `${availableMethods.length}/${expectedMethods.length}`
    );

    // Test a simple request (non-streaming)
    try {
      logInfo("Testing simple request...");

      const testMessages = [
        {
          role: "user",
          content: 'Say "Hello Embed API test!" and nothing else.',
        },
      ];

      const testOptions = {
        model: "anthropic/claude-sonnet-4",
        temperature: 0.7,
        max_tokens: 50,
      };

      logInfo("Sending test request...");
      const result = await client.sendRequest(testMessages, testOptions);

      logSuccess("Request succeeded!");
      logInfo("Response structure:", {
        hasContent: !!result?.content,
        hasChoices: !!result?.choices,
        contentType: typeof result?.content,
        choicesType: typeof result?.choices,
      });

      // Try to extract the actual response text
      let responseText = "Unable to extract";
      if (result?.choices?.[0]?.message?.content) {
        responseText = result.choices[0].message.content;
      } else if (result?.content) {
        responseText = result.content;
      }

      logSuccess("Response text:", responseText);

      return {
        success: true,
        availableMethods,
        testResponse: result,
        responseText,
      };
    } catch (error) {
      logError("Request failed:", error);
      return {
        success: false,
        error: error.message,
        availableMethods,
      };
    }
  }

  // ============================================================================
  // TEST 3: Request Manager Independence
  // ============================================================================

  async function test3_RequestManager() {
    logTest("Request Manager - Standalone Usage");

    // Check if we can access RequestProcessor/RequestManager
    const requestProcessor = window.uiController?.requestProcessor;

    if (!requestProcessor) {
      logError("Cannot access RequestProcessor through uiController");

      // Try alternative access patterns
      logInfo("Attempting alternative access patterns...");

      if (window.RequestProcessor) {
        logSuccess("Found window.RequestProcessor");
        return { available: true, accessPath: "window.RequestProcessor" };
      }

      if (window.RequestManager) {
        logSuccess("Found window.RequestManager");
        return { available: true, accessPath: "window.RequestManager" };
      }

      return { available: false, error: "RequestManager not accessible" };
    }

    logSuccess("RequestProcessor accessible via uiController");

    // Check available methods
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(requestProcessor)
    ).filter(
      (name) =>
        typeof requestProcessor[name] === "function" && name !== "constructor"
    );

    logInfo("Available methods:", methods);

    return {
      available: true,
      accessPath: "uiController.requestProcessor",
      methods,
    };
  }

  // ============================================================================
  // TEST 4: Results Manager - Content Injection
  // ============================================================================

  async function test4_ResultsManager() {
    logTest("Results Manager - Content Processing & Injection");

    const resultsManager = window.uiController?.resultsManager;

    if (!resultsManager) {
      logError("Results Manager not accessible");
      return { available: false };
    }

    logSuccess("Results Manager accessible");

    // Check available methods
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(resultsManager)
    ).filter(
      (name) =>
        typeof resultsManager[name] === "function" && name !== "constructor"
    );

    logInfo("Available methods:", methods);

    // Test if we can create a temporary container and inject content
    try {
      logInfo("Testing content injection into custom container...");

      // Create a test container
      const testContainer = document.createElement("div");
      testContainer.id = "embed-diagnostic-test-container";
      testContainer.style.cssText = `
      border: 2px solid #0066cc;
      padding: 1rem;
      margin: 1rem;
      background: var(--background-color, #fff);
    `;
      document.body.appendChild(testContainer);

      const testMarkdown = `# Embed Test

This is a test of **markdown processing** for the embed API.

- Item 1
- Item 2
- Item 3

\`\`\`javascript
const test = 'code highlighting';
\`\`\`
`;

      logInfo("Test markdown length:", testMarkdown.length);

      // Try to process the content
      // Note: We might need to use the bridge or content processor directly
      if (resultsManager.contentProcessor) {
        logInfo("Content processor available");

        if (
          typeof resultsManager.contentProcessor.processContent === "function"
        ) {
          const processed =
            await resultsManager.contentProcessor.processContent(testMarkdown);
          testContainer.innerHTML = processed;
          logSuccess("Content processed and injected into test container!");
          logInfo("Check the page for a blue-bordered test container");

          return {
            available: true,
            methods,
            testSuccess: true,
            testContainer: testContainer.id,
          };
        }
      }

      // Fallback: try direct HTML injection
      testContainer.innerHTML = `<p>${testMarkdown}</p>`;
      logWarn("Injected raw content (markdown processing not tested)");

      return {
        available: true,
        methods,
        testSuccess: false,
        message: "Content processor not accessible for testing",
      };
    } catch (error) {
      logError("Content injection test failed:", error);
      return {
        available: true,
        methods,
        testSuccess: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // TEST 5: File Handler - Programmatic Usage
  // ============================================================================

  async function test5_FileHandler() {
    logTest("File Handler - Programmatic File Operations");

    if (!window.fileHandler) {
      logError("File Handler not available");
      return { available: false };
    }

    logSuccess("File Handler accessible");

    // Check available methods
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(window.fileHandler)
    ).filter(
      (name) =>
        typeof window.fileHandler[name] === "function" && name !== "constructor"
    );

    logInfo("Available methods:", methods);

    // Check if we can programmatically create a file
    try {
      logInfo("Testing programmatic file creation...");

      // Create a simple text file as Blob
      const testContent = "This is a test file for the embed API diagnostic.";
      const blob = new Blob([testContent], { type: "text/plain" });
      const file = new File([blob], "embed-test.txt", { type: "text/plain" });

      logSuccess("Test file created:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Check if we can analyse it
      if (typeof window.fileHandler.analyzeFile === "function") {
        logInfo("Testing file analysis...");
        const analysis = await window.fileHandler.analyzeFile(file);
        logSuccess("File analysis complete:", analysis);

        return {
          available: true,
          methods,
          fileCreationWorks: true,
          analysisWorks: true,
          testAnalysis: analysis,
        };
      } else {
        logWarn("analyzeFile method not available");
        return {
          available: true,
          methods,
          fileCreationWorks: true,
          analysisWorks: false,
        };
      }
    } catch (error) {
      logError("File handling test failed:", error);
      return {
        available: true,
        methods,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // TEST 6: Notification System
  // ============================================================================

  async function test6_NotificationSystem() {
    logTest("Notification System");

    const notificationFunctions = {
      notifySuccess: window.notifySuccess,
      notifyError: window.notifyError,
      notifyWarning: window.notifyWarning,
      notifyInfo: window.notifyInfo,
      UniversalNotifications: window.UniversalNotifications,
    };

    const available = Object.entries(notificationFunctions)
      .filter(([name, fn]) => fn !== undefined)
      .map(([name]) => name);

    logInfo("Available notification functions:", available);

    // Test each notification type
    if (window.notifyInfo) {
      try {
        logInfo("Testing notification display...");
        window.notifyInfo(
          "Embed API diagnostic test - this is an info notification",
          {
            duration: 3000,
          }
        );
        logSuccess("Info notification triggered");

        return {
          available: true,
          functions: available,
          testSuccess: true,
        };
      } catch (error) {
        logError("Notification test failed:", error);
        return {
          available: true,
          functions: available,
          testSuccess: false,
          error: error.message,
        };
      }
    }

    return {
      available: available.length > 0,
      functions: available,
      testSuccess: false,
      message: "No notification functions available to test",
    };
  }

  // ============================================================================
  // TEST 7: Parameter System
  // ============================================================================

  async function test7_ParameterSystem() {
    logTest("Parameter System - Programmatic Control");

    if (!window.parameterController) {
      logError("Parameter Controller not available");
      return { available: false };
    }

    logSuccess("Parameter Controller accessible");

    // Check available methods
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(window.parameterController)
    ).filter(
      (name) =>
        typeof window.parameterController[name] === "function" &&
        name !== "constructor"
    );

    logInfo("Available methods:", methods);

    // Test getting current parameters
    try {
      if (typeof window.parameterController.getParameters === "function") {
        logInfo("Testing parameter retrieval...");
        const params = window.parameterController.getParameters();
        logSuccess("Current parameters:", params);

        return {
          available: true,
          methods,
          currentParameters: params,
          canGetParameters: true,
        };
      } else {
        logWarn("getParameters method not available");
        return {
          available: true,
          methods,
          canGetParameters: false,
        };
      }
    } catch (error) {
      logError("Parameter retrieval failed:", error);
      return {
        available: true,
        methods,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // TEST 8: Markdown Processing Independence
  // ============================================================================

  async function test8_MarkdownProcessing() {
    logTest("Markdown Processing - Independent Usage");

    if (!window.MarkdownEditor) {
      logError("MarkdownEditor not available");
      return { available: false };
    }

    logSuccess("MarkdownEditor accessible");

    // Try to get the markdown-it instance
    try {
      logInfo("Testing markdown processing...");

      const testMarkdown = `# Test Heading

This is **bold** and this is *italic*.

## Code Block

\`\`\`javascript
const hello = 'world';
\`\`\`

## List

- Item 1
- Item 2
- Item 3
`;

      // Check if we can access the markdown-it instance
      if (window.MarkdownEditor.md) {
        logInfo("markdown-it instance accessible");
        const rendered = window.MarkdownEditor.md.render(testMarkdown);
        logSuccess("Markdown rendered successfully");
        logInfo("Rendered HTML length:", rendered.length);

        return {
          available: true,
          hasMarkdownIt: true,
          testSuccess: true,
          renderedLength: rendered.length,
        };
      } else {
        logWarn("markdown-it instance not directly accessible");
        return {
          available: true,
          hasMarkdownIt: false,
          message: "May need alternative access pattern",
        };
      }
    } catch (error) {
      logError("Markdown processing test failed:", error);
      return {
        available: true,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // TEST 9: Complete Integration Test
  // ============================================================================

  async function test9_CompleteIntegration() {
    logTest("Complete Integration - End-to-End Workflow");

    logInfo("This test simulates a complete embed workflow:");
    logInfo("1. Send request to OpenRouter");
    logInfo("2. Process the response");
    logInfo("3. Inject into custom container");
    logInfo("4. Show notification");

    try {
      // Create output container
      const outputContainer = document.createElement("div");
      outputContainer.id = "embed-integration-test-output";
      outputContainer.style.cssText = `
      border: 3px solid #00cc66;
      padding: 1.5rem;
      margin: 1rem;
      background: var(--background-color, #fff);
      border-radius: 8px;
    `;

      const header = document.createElement("h2");
      header.textContent = "🧪 Embed Integration Test Output";
      outputContainer.appendChild(header);

      const contentDiv = document.createElement("div");
      contentDiv.id = "embed-integration-test-content";
      outputContainer.appendChild(contentDiv);

      document.body.appendChild(outputContainer);

      logInfo("Output container created");

      // Step 1: Send request
      if (!window.openRouterClient) {
        throw new Error("OpenRouter Client not available");
      }

      const messages = [
        {
          role: "user",
          content:
            "Write a short markdown example with a heading, bold text, and a code block. Keep it brief (3-4 lines).",
        },
      ];

      const options = {
        model: "anthropic/claude-sonnet-4",
        temperature: 0.7,
        max_tokens: 200,
      };

      logInfo("Sending request to OpenRouter...");
      const response = await window.openRouterClient.sendRequest(
        messages,
        options
      );

      // Extract response text
      let responseText = "";
      if (response?.choices?.[0]?.message?.content) {
        responseText = response.choices[0].message.content;
      } else if (response?.content) {
        responseText = response.content;
      } else {
        throw new Error("Could not extract response text");
      }

      logSuccess("Response received:", responseText.substring(0, 100) + "...");

      // Step 2: Process the response
      let processedHTML = responseText; // Default to raw text

      if (window.MarkdownEditor?.md) {
        logInfo("Processing with markdown-it...");
        processedHTML = window.MarkdownEditor.md.render(responseText);
        logSuccess("Markdown processed");
      } else {
        logWarn("Markdown processing not available, using raw text");
        processedHTML = `<pre>${responseText}</pre>`;
      }

      // Step 3: Inject into container
      contentDiv.innerHTML = processedHTML;
      logSuccess("Content injected into container");

      // Step 4: Show notification
      if (window.notifySuccess) {
        window.notifySuccess(
          "Embed integration test complete! Check the green-bordered container on the page.",
          {
            duration: 5000,
          }
        );
      }

      logSuccess("✅ COMPLETE INTEGRATION TEST PASSED!");
      logInfo(
        "Check the page for a green-bordered container with the AI response"
      );

      return {
        success: true,
        containerCreated: true,
        requestSent: true,
        responseReceived: true,
        contentProcessed: true,
        contentInjected: true,
        notificationShown: !!window.notifySuccess,
        containerId: outputContainer.id,
      };
    } catch (error) {
      logError("Integration test failed:", error);

      if (window.notifyError) {
        window.notifyError(`Integration test failed: ${error.message}`);
      }

      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  // ============================================================================
  // MASTER TEST RUNNER
  // ============================================================================

  async function runAllDiagnostics() {
    console.clear();
    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log("║   OpenRouter Embed API - Pre-Implementation Diagnostics  ║");
    console.log(
      "╚═══════════════════════════════════════════════════════════╝\n"
    );

    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Run all tests
    results.tests.componentAvailability = await test1_ComponentAvailability();
    results.tests.openRouterClient = await test2_OpenRouterClient();
    results.tests.requestManager = await test3_RequestManager();
    results.tests.resultsManager = await test4_ResultsManager();
    results.tests.fileHandler = await test5_FileHandler();
    results.tests.notificationSystem = await test6_NotificationSystem();
    results.tests.parameterSystem = await test7_ParameterSystem();
    results.tests.markdownProcessing = await test8_MarkdownProcessing();
    results.tests.completeIntegration = await test9_CompleteIntegration();

    // Summary
    console.log("\n" + "═".repeat(60));
    console.log("📊 DIAGNOSTIC SUMMARY");
    console.log("═".repeat(60));

    const testNames = Object.keys(results.tests);
    const passedTests = testNames.filter((name) => {
      const test = results.tests[name];
      return test.available !== false && test.success !== false;
    });

    logInfo(`Tests run: ${testNames.length}`);
    logInfo(`Tests passed: ${passedTests.length}`);

    if (passedTests.length === testNames.length) {
      logSuccess("🎉 ALL DIAGNOSTICS PASSED - Ready to implement embed API!");
    } else {
      logWarn(
        `⚠️ ${
          testNames.length - passedTests.length
        } tests had issues - review results above`
      );
    }

    console.log("\n💾 Full results saved to window._embedDiagnosticResults");
    console.log("Access via: window._embedDiagnosticResults\n");

    window._embedDiagnosticResults = results;

    return results;
  }

  // ============================================================================
  // EXPOSE TO WINDOW FOR CONSOLE ACCESS
  // ============================================================================

  window.testEmbedDiagnostics = runAllDiagnostics;
  window.testEmbedComponent = async (componentName) => {
    const tests = {
      availability: test1_ComponentAvailability,
      client: test2_OpenRouterClient,
      request: test3_RequestManager,
      results: test4_ResultsManager,
      file: test5_FileHandler,
      notifications: test6_NotificationSystem,
      parameters: test7_ParameterSystem,
      markdown: test8_MarkdownProcessing,
      integration: test9_CompleteIntegration,
    };

    if (tests[componentName]) {
      return await tests[componentName]();
    } else {
      logError(`Unknown component: ${componentName}`);
      logInfo("Available components:", Object.keys(tests));
      return null;
    }
  };
})();

// ============================================================================
// STAGE 1 PROVIDER ABSTRACTION TESTS (Task 1.4)
// ============================================================================
//
// Named regression suite for the provider-registry / provider-lookup /
// dispatch-refactor work that landed in Stage 1 (Tasks 1.1, 1.2a, 1.2b,
// 1.3). Five sub-tests:
//
//   1. RegistryAndProvider — static infrastructure: registry methods,
//      OpenRouter provider registration, capabilities shape.
//   2. LookupRule — namespace convention (A2) across reserved + legacy +
//      defensive branches; no instance construction.
//   3. InstanceAPI — `embed.provider` getter resolves correctly and
//      re-resolves on `setModel()`.
//   4. MisconfigError — `sendStreamingRequest` fail-fast path: throws
//      with detail message, fires error notification.
//   5. RealDispatch — end-to-end OpenRouter round-trip through the
//      new per-request dispatch path. (Network call.)
//
// Run all: `await window.testStage1_ProviderAbstraction_All()`
// Run one: `await window.testStage1_ProviderAbstraction_<SubTestName>()`
//
// Sibling IIFE — does not touch the diagnostic IIFE above.
//
// @version 1.0.0 (Stage 1, Task 1.4)
// @date 9 May 2026

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
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
      console.error(`[Stage1ProviderAbsTests ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Stage1ProviderAbsTests WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Stage1ProviderAbsTests INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Stage1ProviderAbsTests DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Create a unique throwaway test container appended to body.
   * Caller is responsible for `.remove()` (typically in a finally block).
   */
  function createTestContainer(prefix) {
    const div = document.createElement("div");
    div.id =
      (prefix || "stage1-providerabs-test") +
      "-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 1e6);
    div.style.display = "none";
    document.body.appendChild(div);
    return div;
  }

  /**
   * Print one assertion in the project's test convention. Returns the
   * boolean unchanged so callers can ANDify results.
   */
  function check(name, condition) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      return true;
    }
    console.log(`  ❌ ${name}`);
    return false;
  }

  // ============================================================================
  // SUB-TEST 1: REGISTRY + PROVIDER STATIC INFRASTRUCTURE
  // ============================================================================

  window.testStage1_ProviderAbstraction_RegistryAndProvider =
    async function () {
      console.log("\n🧪 TEST 1: Registry + Provider Static Infrastructure");
      console.log("======================================================\n");
      try {
        let allOk = true;
        const reg = window.EmbedProviderRegistry;

        allOk =
          check(
            "EmbedProviderRegistry is a non-null object",
            reg !== null && typeof reg === "object"
          ) && allOk;

        const expectedRegMethods = [
          "register",
          "get",
          "has",
          "unregister",
          "list",
          "clear",
        ];
        for (const m of expectedRegMethods) {
          allOk =
            check(
              `Registry has method: ${m}`,
              typeof reg?.[m] === "function"
            ) && allOk;
        }

        allOk =
          check(
            "Registry has openrouter provider",
            reg?.has?.("openrouter") === true
          ) && allOk;

        const provider = reg?.get?.("openrouter");
        allOk =
          check(
            "get('openrouter') returns non-null object",
            provider !== null && typeof provider === "object"
          ) && allOk;
        allOk = check("provider.id === 'openrouter'", provider?.id === "openrouter") && allOk;

        const expectedWireMethods = [
          "buildRequest",
          "endpoint",
          "parseStreamChunk",
          "parseResponse",
        ];
        for (const m of expectedWireMethods) {
          allOk =
            check(
              `Provider has wire method: ${m}`,
              typeof provider?.[m] === "function"
            ) && allOk;
        }

        const caps = provider?.capabilities;
        allOk =
          check(
            "provider.capabilities is non-null, non-array object",
            caps !== null && typeof caps === "object" && !Array.isArray(caps)
          ) && allOk;

        const expectedCapFlags = [
          "streaming",
          "images",
          "pdf",
          "reasoning",
          "toolCalls",
        ];
        for (const f of expectedCapFlags) {
          allOk =
            check(`capabilities.${f} is boolean`, typeof caps?.[f] === "boolean") &&
            allOk;
        }

        console.log(allOk ? "\n🎉 TEST 1 PASSED!\n" : "\n❌ TEST 1 FAILED.\n");
        return allOk;
      } catch (error) {
        console.error(`❌ TEST 1 FAILED with error: ${error.message}`);
        return false;
      }
    };

  // ============================================================================
  // SUB-TEST 2: LOOKUP RULE ACROSS ALL BRANCHES
  // ============================================================================

  window.testStage1_ProviderAbstraction_LookupRule = async function () {
    console.log("\n🧪 TEST 2: Lookup Rule Across All Branches");
    console.log("============================================\n");
    try {
      let allOk = true;
      const lookup = window.EmbedProviderLookup;

      allOk =
        check(
          "EmbedProviderLookup is a non-null object",
          lookup !== null && typeof lookup === "object"
        ) && allOk;
      allOk =
        check(
          "EmbedProviderLookup.resolve is a function",
          typeof lookup?.resolve === "function"
        ) && allOk;

      const expectedReserved = new Set([
        "openrouter",
        "azure-openai",
        "azure-inference",
        "anthropic-foundry",
      ]);
      const actualReserved = new Set(lookup?.getReservedPrefixes?.() ?? []);
      const reservedMatches =
        expectedReserved.size === actualReserved.size &&
        [...expectedReserved].every((p) => actualReserved.has(p));
      allOk =
        check(
          "getReservedPrefixes() returns the four expected prefixes (set equality)",
          reservedMatches
        ) && allOk;

      const isOR = (p) => p !== null && typeof p === "object" && p.id === "openrouter";

      // Reserved prefixes — strict lookup
      allOk =
        check(
          "getProvider('openrouter/anthropic/claude-3.5-haiku') → openrouter",
          isOR(OpenRouterEmbed.getProvider("openrouter/anthropic/claude-3.5-haiku"))
        ) && allOk;
      // Was 'azure-openai/gpt-5.4-mini' until Stage 2.1 registered the adapter.
      // Switched to 'anthropic-foundry/...' which stays unregistered (Stage 4 deferred).
      allOk =
        check(
          "getProvider('anthropic-foundry/foo') → null",
          OpenRouterEmbed.getProvider("anthropic-foundry/foo") === null
        ) && allOk;
      allOk =
        check(
          "getProvider('azure-inference/foo') → null",
          OpenRouterEmbed.getProvider("azure-inference/foo") === null
        ) && allOk;
      allOk =
        check(
          "getProvider('anthropic-foundry/bar') → null",
          OpenRouterEmbed.getProvider("anthropic-foundry/bar") === null
        ) && allOk;

      // Legacy fallback
      allOk =
        check(
          "getProvider('anthropic/claude-3.5-haiku') → openrouter (legacy)",
          isOR(OpenRouterEmbed.getProvider("anthropic/claude-3.5-haiku"))
        ) && allOk;
      allOk =
        check(
          "getProvider('mistralai/mistral-large') → openrouter (legacy)",
          isOR(OpenRouterEmbed.getProvider("mistralai/mistral-large"))
        ) && allOk;
      allOk =
        check(
          "getProvider('some-bare-model-name') → openrouter (no slash)",
          isOR(OpenRouterEmbed.getProvider("some-bare-model-name"))
        ) && allOk;

      // Defensive
      allOk =
        check(
          "getProvider('') → openrouter (defensive)",
          isOR(OpenRouterEmbed.getProvider(""))
        ) && allOk;
      allOk =
        check(
          "getProvider(undefined) → openrouter (defensive)",
          isOR(OpenRouterEmbed.getProvider(undefined))
        ) && allOk;
      allOk =
        check(
          "getProvider(null) → openrouter (defensive)",
          isOR(OpenRouterEmbed.getProvider(null))
        ) && allOk;

      console.log(allOk ? "\n🎉 TEST 2 PASSED!\n" : "\n❌ TEST 2 FAILED.\n");
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 2 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ============================================================================
  // SUB-TEST 3: INSTANCE API — provider getter + setModel re-resolution
  // ============================================================================

  window.testStage1_ProviderAbstraction_InstanceAPI = async function () {
    console.log("\n🧪 TEST 3: Instance Provider Getter + setModel");
    console.log("================================================\n");
    const div = createTestContainer("stage1-providerabs-instance");
    try {
      let allOk = true;
      const embed = new OpenRouterEmbed({
        containerId: div.id,
        model: "anthropic/claude-haiku-4.5",
      });
      allOk = check("Embed constructed successfully", true) && allOk;
      allOk =
        check(
          "embed.provider returns openrouter (legacy fallback)",
          embed.provider?.id === "openrouter"
        ) && allOk;

      // Was 'azure-openai/gpt-5.4-mini' until Stage 2.1 registered the adapter.
      // Switched to 'anthropic-foundry/...' which stays unregistered (Stage 4 deferred).
      embed.setModel("anthropic-foundry/foo");
      allOk =
        check(
          "After setModel('anthropic-foundry/...'), embed.provider returns null",
          embed.provider === null
        ) && allOk;

      embed.setModel("openrouter/anthropic/claude-3.5-haiku");
      allOk =
        check(
          "After setModel('openrouter/...'), embed.provider returns openrouter",
          embed.provider?.id === "openrouter"
        ) && allOk;

      embed.setModel("anthropic/claude-haiku-4.5");
      allOk =
        check(
          "After setModel('anthropic/...'), embed.provider returns openrouter (legacy)",
          embed.provider?.id === "openrouter"
        ) && allOk;

      console.log(allOk ? "\n🎉 TEST 3 PASSED!\n" : "\n❌ TEST 3 FAILED.\n");
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 3 FAILED with error: ${error.message}`);
      return false;
    } finally {
      div.remove();
    }
  };

  // ============================================================================
  // SUB-TEST 4: MISCONFIG FAIL-FAST PATH
  // ============================================================================

  window.testStage1_ProviderAbstraction_MisconfigError = async function () {
    console.log("\n🧪 TEST 4: Misconfig Fail-Fast (no provider for model)");
    console.log("========================================================\n");
    const div = createTestContainer("stage1-providerabs-misconfig");
    let embed = null;
    let originalNotifyError = null;

    try {
      embed = new OpenRouterEmbed({
        containerId: div.id,
        model: "anthropic/claude-haiku-4.5",
      });

      // Spy on notifications.error (per-instance, restored in finally).
      const notificationCalls = [];
      originalNotifyError = embed.notifications.error;
      embed.notifications.error = (msg) => {
        notificationCalls.push(msg);
      };

      // Switch to a reserved-but-unregistered model.
      // Was 'azure-openai/gpt-5.4-mini' until Stage 2.1 registered the adapter.
      // Switched to 'anthropic-foundry/...' which stays unregistered (Stage 4 deferred).
      embed.setModel("anthropic-foundry/foo");

      let caughtError = null;
      try {
        await embed.sendStreamingRequest({ userPrompt: "hi" });
      } catch (err) {
        caughtError = err;
      }

      let allOk = true;
      allOk =
        check("sendStreamingRequest threw", caughtError !== null) && allOk;
      allOk =
        check(
          "Error message names the model",
          caughtError?.message?.includes("'anthropic-foundry/foo'") === true
        ) && allOk;
      allOk =
        check(
          "Error message contains 'Registered providers:'",
          caughtError?.message?.includes("Registered providers:") === true
        ) && allOk;
      allOk =
        check(
          "Error message contains 'Reserved but not loaded:'",
          caughtError?.message?.includes("Reserved but not loaded:") === true
        ) && allOk;
      allOk =
        check(
          "notifications.error was called exactly once",
          notificationCalls.length === 1
        ) && allOk;
      allOk =
        check(
          "Notification message contains 'No provider registered for model'",
          typeof notificationCalls[0] === "string" &&
            notificationCalls[0].includes("No provider registered for model")
        ) && allOk;

      console.log(allOk ? "\n🎉 TEST 4 PASSED!\n" : "\n❌ TEST 4 FAILED.\n");
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 4 FAILED with error: ${error.message}`);
      return false;
    } finally {
      if (embed && originalNotifyError !== null) {
        try {
          embed.notifications.error = originalNotifyError;
        } catch (_) {
          /* defensive — restore best-effort */
        }
      }
      div.remove();
    }
  };

  // ============================================================================
  // SUB-TEST 5: REAL OPENROUTER ROUND-TRIP
  // ============================================================================

  window.testStage1_ProviderAbstraction_RealDispatch = async function () {
    console.log("\n🧪 TEST 5: Real OpenRouter Round-Trip Through New Dispatch");
    console.log("=============================================================\n");
    const div = createTestContainer("stage1-providerabs-real");
    try {
      const embed = new OpenRouterEmbed({
        containerId: div.id,
        model: "anthropic/claude-haiku-4.5",
      });

      let response = null;
      let networkError = null;
      try {
        response = await embed.sendRequest(
          "Reply with exactly the two characters: OK"
        );
      } catch (err) {
        networkError = err;
      }

      if (networkError) {
        console.error(
          `❌ TEST 5 FAILED — network error: ${networkError.message}`
        );
        return false;
      }

      let allOk = true;
      allOk =
        check(
          "response.text is a non-empty string",
          typeof response?.text === "string" && response.text.length > 0
        ) && allOk;

      const trimmed = (response?.text ?? "").trim();
      allOk =
        check(
          "response.text starts with 'OK' (case-insensitive, trailing punctuation allowed)",
          /^ok\b/i.test(trimmed)
        ) && allOk;
      allOk =
        check("Container was populated", div.innerHTML.length > 0) && allOk;

      console.log(allOk ? "\n🎉 TEST 5 PASSED!\n" : "\n❌ TEST 5 FAILED.\n");
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 5 FAILED with error: ${error.message}`);
      return false;
    } finally {
      div.remove();
    }
  };

  // ============================================================================
  // MASTER RUNNER
  // ============================================================================

  window.testStage1_ProviderAbstraction_All = async function () {
    console.clear();
    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log("║   OpenRouter Embed - Stage 1 Provider Abstraction Tests  ║");
    console.log(
      "╚═══════════════════════════════════════════════════════════╝\n"
    );

    const results = {
      registryAndProvider:
        await window.testStage1_ProviderAbstraction_RegistryAndProvider(),
      lookupRule: await window.testStage1_ProviderAbstraction_LookupRule(),
      instanceAPI: await window.testStage1_ProviderAbstraction_InstanceAPI(),
      misconfigError:
        await window.testStage1_ProviderAbstraction_MisconfigError(),
      realDispatch:
        await window.testStage1_ProviderAbstraction_RealDispatch(),
    };

    console.log("\n" + "═".repeat(60));
    console.log("📊 TEST RESULTS");
    console.log("═".repeat(60));

    const order = [
      "registryAndProvider",
      "lookupRule",
      "instanceAPI",
      "misconfigError",
      "realDispatch",
    ];
    let passed = 0;
    for (const key of order) {
      console.log(results[key] ? `✅ ${key}` : `❌ ${key}`);
      if (results[key]) passed++;
    }

    console.log("\n" + "═".repeat(60));
    if (passed === order.length) {
      console.log(`🎉 RESULTS: ${passed}/${order.length} tests passed`);
    } else {
      console.log(`⚠️ RESULTS: ${passed}/${order.length} tests passed`);
    }
    console.log("═".repeat(60));

    if (passed === order.length) {
      console.log(
        "\n✅ 🎉 ALL STAGE 1 PROVIDER-ABSTRACTION TESTS PASSED!\n"
      );
    } else {
      console.log(
        "\n❌ Some tests failed. Please review the output above.\n"
      );
    }

    window._stage1ProviderAbstractionResults = {
      passed,
      total: order.length,
      results,
    };

    return { passed, total: order.length, results };
  };

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("Stage 1 Provider Abstraction Tests (Task 1.4) loaded");
  logInfo("Run all:    await window.testStage1_ProviderAbstraction_All()");
  logInfo("Run one:    await window.testStage1_ProviderAbstraction_<SubTestName>()");
})();
