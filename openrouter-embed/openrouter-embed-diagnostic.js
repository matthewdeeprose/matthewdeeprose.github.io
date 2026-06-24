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

  async function runAllDiagnostics(options) {
    // clearConsole defaults OFF so a chained run (or a preceding console.table)
    // is not wiped. Pass { clearConsole: true } for the old clean-slate banner.
    const { clearConsole = false } = options || {};
    if (clearConsole) console.clear();
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
        "azure-responses",
        "azure-inference",
        "anthropic-foundry",
        "local",
      ]);
      const actualReserved = new Set(lookup?.getReservedPrefixes?.() ?? []);
      const reservedMatches =
        expectedReserved.size === actualReserved.size &&
        [...expectedReserved].every((p) => actualReserved.has(p));
      allOk =
        check(
          "getReservedPrefixes() returns the six expected prefixes (set equality)",
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
      allOk =
        check(
          "local/ prefix resolves to null (local backend pre-empts dispatch in core.js)",
          lookup.resolve("local/foo") === null
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

  window.testStage1_ProviderAbstraction_All = async function (options) {
    // clearConsole defaults OFF (see runAllDiagnostics). Pass
    // { clearConsole: true } to restore the clean-slate banner behaviour.
    const { clearConsole = false } = options || {};
    if (clearConsole) console.clear();
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

// ============================================================================
// STAGE 2 FOUNDRY PROVIDER TESTS (Task 2.5)
// ============================================================================
//
// Named regression suite for the Foundry provider integration that landed
// across Stage 2 Tasks 2.1–2.4. Five sub-tests:
//
//   1. ProviderRegistration — adapter is registered with the correct id,
//      capability shape, and method surface (4 wire + 2 transport methods).
//   2. ConfigRoundTrip — `configureProvider` strict validation and
//      `getProviderConfig` / `isProviderConfigured` round-trip.
//   3. SelectorVisibility — `getEligibleProviders` / `getEligibleModels`
//      reflect Foundry availability before/after `configureProvider`.
//   4. ParameterTranslation — `buildRequest` unit assertions: prefix strip,
//      max_tokens rename, reasoning-model sampling-parameter drop, plus
//      regression guards for the Task 2.5b `max_completion_tokens`
//      pass-through and streaming wire-body completeness fix.
//   5. RealRoundTrip — end-to-end streaming chat request through the
//      Cloudflare Worker proxy to azure-openai/gpt-5.4-mini. (Network call.)
//
// Run all: `await window.testEmbedFoundry_All()`
// Run one: `await window.testEmbedFoundry_<SubTestName>()`
//
// Post-Task-2.5b expected state: 5/5 sub-tests pass when the Worker is
// reachable and modelRegistry contains at least one `azure-openai/*` model.
// If no Foundry models are registered, TEST 3 (SelectorVisibility) fails
// with a printed environment hint — that's the only remaining state-
// dependent failure mode after 2.5b.
//
// Sibling IIFE — does not touch the diagnostic IIFE or the Stage 1 Provider
// Abstraction IIFE above.
//
// @version 1.0.0 (Stage 2, Task 2.5)
// @date 15 May 2026

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
      console.error(`[Stage2FoundryTests ERROR] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Stage2FoundryTests WARN] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Stage2FoundryTests INFO] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Stage2FoundryTests DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  // Worker proxy URL for the RealRoundTrip sub-test. Sourced from
  // foundry-integration-staged-plan.md Reference cheat sheet.
  const WORKER_URL =
    "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev";

  // Test deployment used for RealRoundTrip. The staged plan's test endpoint.
  const TEST_MODEL = "azure-openai/gpt-5.4-mini";

  // Benign prompt to avoid the content-filter jailbreak trip Task 2.2 hit.
  // Avoid "verbatim" / "say X word-for-word" framings.
  const TEST_PROMPT = "What is 2 plus 2? Answer in one short sentence.";

  /**
   * Create a unique throwaway test container appended to body.
   * Caller is responsible for `.remove()` (typically in a finally block).
   */
  function createTestContainer(prefix) {
    const div = document.createElement("div");
    div.id =
      (prefix || "stage2-foundry-test") +
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
  // SUB-TEST 1: PROVIDER REGISTRATION
  // ============================================================================

  window.testEmbedFoundry_ProviderRegistration = async function () {
    console.log("\n🧪 TEST 1: Foundry Provider Registration");
    console.log("==========================================\n");
    try {
      let allOk = true;
      const reg = window.EmbedProviderRegistry;

      allOk =
        check(
          "EmbedProviderRegistry is available",
          reg !== null && typeof reg === "object"
        ) && allOk;
      allOk =
        check(
          "Registry has 'azure-openai' provider",
          reg?.has?.("azure-openai") === true
        ) && allOk;

      const provider = reg?.get?.("azure-openai");
      allOk =
        check(
          "get('azure-openai') returns non-null object",
          provider !== null && typeof provider === "object"
        ) && allOk;
      allOk =
        check(
          "provider.id === 'azure-openai'",
          provider?.id === "azure-openai"
        ) && allOk;

      // Four wire methods (contract — required for registration)
      const wireMethods = [
        "buildRequest",
        "endpoint",
        "parseStreamChunk",
        "parseResponse",
      ];
      for (const m of wireMethods) {
        allOk =
          check(
            `Provider has wire method: ${m}`,
            typeof provider?.[m] === "function"
          ) && allOk;
      }

      // Two transport methods (Foundry owns its own transport — A3 extension)
      const transportMethods = ["streamRequest", "request"];
      for (const m of transportMethods) {
        allOk =
          check(
            `Provider has transport method: ${m}`,
            typeof provider?.[m] === "function"
          ) && allOk;
      }

      // Capability shape
      const caps = provider?.capabilities;
      allOk =
        check(
          "capabilities is an object",
          caps !== null && typeof caps === "object" && !Array.isArray(caps)
        ) && allOk;
      allOk =
        check("capabilities.streaming === true", caps?.streaming === true) &&
        allOk;
      allOk =
        check("capabilities.images === true", caps?.images === true) && allOk;
      allOk = check("capabilities.pdf === false", caps?.pdf === false) && allOk;
      allOk =
        check("capabilities.reasoning === true", caps?.reasoning === true) &&
        allOk;
      allOk =
        check("capabilities.toolCalls === true", caps?.toolCalls === true) &&
        allOk;

      console.log(allOk ? "\n🎉 TEST 1 PASSED!\n" : "\n❌ TEST 1 FAILED.\n");
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 1 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ============================================================================
  // SUB-TEST 2: CONFIG ROUND-TRIP
  // ============================================================================

  window.testEmbedFoundry_ConfigRoundTrip = async function () {
    console.log("\n🧪 TEST 2: Provider Config Round-Trip");
    console.log("========================================\n");
    const div = createTestContainer("stage2-foundry-config");
    let embed = null;

    try {
      embed = new OpenRouterEmbed({
        containerId: div.id,
        model: "azure-openai/gpt-5.4-mini",
      });

      let allOk = true;

      // Pre-config state
      allOk =
        check(
          "isProviderConfigured('azure-openai') === false before configure",
          embed.isProviderConfigured("azure-openai") === false
        ) && allOk;
      allOk =
        check(
          "getProviderConfig('azure-openai') === null before configure",
          embed.getProviderConfig("azure-openai") === null
        ) && allOk;

      // Strict-validation reject cases
      const rejectCases = [
        [
          "unknown provider id",
          () =>
            embed.configureProvider("not-a-provider", {
              proxyUrl: "https://example.test",
            }),
        ],
        [
          "openrouter (no transport methods)",
          () =>
            embed.configureProvider("openrouter", {
              proxyUrl: "https://example.test",
            }),
        ],
        [
          "missing proxyUrl",
          () => embed.configureProvider("azure-openai", {}),
        ],
        [
          "malformed proxyUrl",
          () =>
            embed.configureProvider("azure-openai", { proxyUrl: "not-a-url" }),
        ],
        [
          "non-string userToken",
          () =>
            embed.configureProvider("azure-openai", {
              proxyUrl: "https://example.test",
              userToken: 42,
            }),
        ],
      ];

      for (const [label, fn] of rejectCases) {
        let threw = false;
        try {
          fn();
        } catch (_) {
          threw = true;
        }
        allOk = check(`configureProvider rejects: ${label}`, threw) && allOk;
      }

      // Happy-path round-trip with trailing slash and whitespace
      embed.configureProvider("azure-openai", {
        proxyUrl:
          "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev/",
        userToken: "  test-token  ",
      });

      allOk =
        check(
          "isProviderConfigured('azure-openai') === true after configure",
          embed.isProviderConfigured("azure-openai") === true
        ) && allOk;

      const cfg = embed.getProviderConfig("azure-openai");
      allOk =
        check(
          "getProviderConfig returns object",
          cfg !== null && typeof cfg === "object"
        ) && allOk;
      allOk =
        check(
          "proxyUrl trailing slash stripped",
          cfg?.proxyUrl ===
            "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev"
        ) && allOk;
      allOk =
        check(
          "userToken whitespace trimmed",
          cfg?.userToken === "test-token"
        ) && allOk;

      // isProviderConfigured for unknown id returns false (no throw)
      allOk =
        check(
          "isProviderConfigured('unknown') === false (no throw)",
          embed.isProviderConfigured("unknown") === false
        ) && allOk;

      console.log(allOk ? "\n🎉 TEST 2 PASSED!\n" : "\n❌ TEST 2 FAILED.\n");
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 2 FAILED with error: ${error.message}`);
      return false;
    } finally {
      div.remove();
    }
  };

  // ============================================================================
  // SUB-TEST 3: SELECTOR VISIBILITY
  // ============================================================================
  //
  // Depends on the consumer-side model registry having at least one
  // `azure-openai/*` model registered. The check is `azure-openai/gpt-5.4-mini`
  // (the test deployment per the cheat sheet). If `window.modelRegistry` does
  // not list it, the downstream assertions fail — this is an environment
  // dependency, not a code bug. A clear hint is printed in that case.

  window.testEmbedFoundry_SelectorVisibility = async function () {
    console.log("\n🧪 TEST 3: Model Selector Visibility");
    console.log("======================================\n");
    const div = createTestContainer("stage2-foundry-selector");
    let embed = null;

    try {
      let allOk = true;
      const sel = window.EmbedModelSelector;

      allOk =
        check(
          "EmbedModelSelector is available",
          sel !== null && typeof sel === "object"
        ) && allOk;
      allOk =
        check(
          "getEligibleProviders is a function",
          typeof sel?.getEligibleProviders === "function"
        ) && allOk;
      allOk =
        check(
          "getEligibleModels is a function",
          typeof sel?.getEligibleModels === "function"
        ) && allOk;

      // Confirm model registry has at least one azure-openai/* entry
      const registry = window.modelRegistry;
      const allModels =
        registry && typeof registry.getAllModels === "function"
          ? registry.getAllModels()
          : [];
      const foundryModels = allModels.filter(
        (m) => m && typeof m.id === "string" && m.id.startsWith("azure-openai/")
      );
      if (foundryModels.length === 0) {
        console.log(
          "  ⚠️  modelRegistry has no 'azure-openai/*' models registered. " +
            "Sub-test 3 will fail downstream assertions until the consumer registers " +
            "azure-openai/gpt-5.4-mini in js/model-definitions.js or equivalent."
        );
      }
      allOk =
        check(
          "modelRegistry contains at least one azure-openai/* model",
          foundryModels.length > 0
        ) && allOk;

      // Fresh embed, unconfigured Foundry
      embed = new OpenRouterEmbed({
        containerId: div.id,
        model: "anthropic/claude-3.5-haiku",
      });

      // Before configureProvider
      const providersBefore = sel.getEligibleProviders({ embed });
      const foundryBefore = providersBefore.find(
        (p) => p.id === "azure-openai"
      );
      allOk =
        check(
          "getEligibleProviders includes azure-openai entry",
          foundryBefore !== undefined
        ) && allOk;
      allOk =
        check(
          "azure-openai.configured === false before configureProvider",
          foundryBefore?.configured === false
        ) && allOk;

      const modelsBefore = sel.getEligibleModels({
        providerId: "azure-openai",
        embed,
      });
      allOk =
        check(
          "getEligibleModels for unconfigured azure-openai returns []",
          Array.isArray(modelsBefore) && modelsBefore.length === 0
        ) && allOk;

      // Configure Foundry
      embed.configureProvider("azure-openai", { proxyUrl: WORKER_URL });

      const providersAfter = sel.getEligibleProviders({ embed });
      const foundryAfter = providersAfter.find((p) => p.id === "azure-openai");
      allOk =
        check(
          "azure-openai.configured === true after configureProvider",
          foundryAfter?.configured === true
        ) && allOk;

      const modelsAfter = sel.getEligibleModels({
        providerId: "azure-openai",
        embed,
      });
      allOk =
        check(
          "getEligibleModels for configured azure-openai returns non-empty list",
          Array.isArray(modelsAfter) && modelsAfter.length > 0
        ) && allOk;
      allOk =
        check(
          "OpenRouter models always visible (configured === true)",
          providersAfter.find((p) => p.id === "openrouter")?.configured === true
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
  // SUB-TEST 4: PARAMETER TRANSLATION
  // ============================================================================
  //
  // Pure unit-level assertions against `buildRequest`. Includes regression
  // guards for Task 2.5b's `max_completion_tokens` pass-through fix —
  // exercises the second-pass scenario where buildRequest receives an
  // options object that already has `max_completion_tokens` set (the
  // rename happened on a first pass and the result feeds back in for the
  // streaming second pass).

  window.testEmbedFoundry_ParameterTranslation = async function () {
    console.log("\n🧪 TEST 4: Parameter Translation (buildRequest)");
    console.log("================================================\n");

    try {
      const provider = window.EmbedProviderRegistry.get("azure-openai");
      const messages = [{ role: "user", content: "hi" }];
      let allOk = true;

      // Prefix strip
      const body1 = provider.buildRequest(messages, {
        model: "azure-openai/gpt-4o-mini",
        max_tokens: 100,
      });
      allOk =
        check(
          "Prefix stripped: body.model === 'gpt-4o-mini'",
          body1.model === "gpt-4o-mini"
        ) && allOk;

      // max_tokens → max_completion_tokens rename
      allOk =
        check(
          "max_tokens renamed to max_completion_tokens",
          body1.max_completion_tokens === 100 && !("max_tokens" in body1)
        ) && allOk;

      // Task 2.5b regression #1: max_completion_tokens pass-through when input
      // has it directly. This is the second-pass scenario Task 2.4 Step 6
      // surfaced — buildRequest is called once with max_tokens (renamed) and
      // the result feeds back in with max_completion_tokens already set; the
      // second call must preserve it.
      const body2 = provider.buildRequest(messages, {
        model: "azure-openai/gpt-4o-mini",
        max_completion_tokens: 256,
      });
      allOk =
        check(
          "max_completion_tokens preserved when input has it directly (Task 2.5b)",
          body2.max_completion_tokens === 256
        ) && allOk;

      // Task 2.5b regression #2: streaming wire body has max_completion_tokens
      // AND stream:true together.
      const body3 = provider.buildRequest(messages, {
        model: "azure-openai/gpt-4o-mini",
        max_completion_tokens: 256,
        stream: true,
      });
      allOk =
        check(
          "Streaming body has max_completion_tokens AND stream:true (Task 2.5b)",
          body3.max_completion_tokens === 256 && body3.stream === true
        ) && allOk;

      // Reasoning-model temperature/top_p drop (regression guard for Task 2.4)
      const body4 = provider.buildRequest(messages, {
        model: "azure-openai/gpt-5.4-mini",
        max_tokens: 100,
        temperature: 0.7,
        top_p: 0.9,
      });
      allOk =
        check("Reasoning model drops temperature", !("temperature" in body4)) &&
        allOk;
      allOk =
        check("Reasoning model drops top_p", !("top_p" in body4)) && allOk;

      // Non-reasoning model keeps both
      const body5 = provider.buildRequest(messages, {
        model: "azure-openai/gpt-4o-mini",
        max_tokens: 100,
        temperature: 0.7,
        top_p: 0.9,
      });
      allOk =
        check(
          "Non-reasoning model keeps temperature",
          body5.temperature === 0.7
        ) && allOk;
      allOk =
        check("Non-reasoning model keeps top_p", body5.top_p === 0.9) && allOk;

      // (a) Strict-MaaS token field: Mistral-Large-3 rejects
      // max_completion_tokens (422 extra_forbidden, 19 June 2026) and needs
      // plain max_tokens. buildRequest must emit max_tokens, NOT
      // max_completion_tokens.
      const body6 = provider.buildRequest(messages, {
        model: "azure-openai/Mistral-Large-3",
        max_tokens: 2000,
      });
      allOk =
        check(
          "Mistral-Large-3 uses plain max_tokens",
          body6.max_tokens === 2000
        ) && allOk;
      allOk =
        check(
          "Mistral-Large-3 omits max_completion_tokens",
          !("max_completion_tokens" in body6)
        ) && allOk;

      // (b) Regression guard: standard reasoning model (gpt-5.4-mini) still
      // uses max_completion_tokens, NOT plain max_tokens.
      const body7 = provider.buildRequest(messages, {
        model: "azure-openai/gpt-5.4-mini",
        max_tokens: 2000,
      });
      allOk =
        check(
          "gpt-5.4-mini uses max_completion_tokens",
          body7.max_completion_tokens === 2000
        ) && allOk;
      allOk =
        check(
          "gpt-5.4-mini omits plain max_tokens",
          !("max_tokens" in body7)
        ) && allOk;

      // (c) Regression guard: Kimi-K2.5 accepts temperature/top_p (19 June
      // 2026) — it must NOT be treated as a sampling-drop reasoning model.
      const body8 = provider.buildRequest(messages, {
        model: "azure-openai/Kimi-K2.5",
        max_tokens: 2000,
        temperature: 0.5,
      });
      allOk =
        check(
          "Kimi-K2.5 keeps temperature (not dropped)",
          body8.temperature === 0.5
        ) && allOk;

      // (d) Reasoning-budget floor: Kimi-K2.5 spends hidden reasoning budget,
      // so a sub-floor cap (60) is raised to REASONING_BUDGET_FLOOR (1024).
      const body9 = provider.buildRequest(messages, {
        model: "azure-openai/Kimi-K2.5",
        max_tokens: 60,
      });
      allOk =
        check(
          "Kimi-K2.5 max_tokens 60 floored to 1024",
          body9.max_completion_tokens === 1024
        ) && allOk;

      // (e) Floor does NOT apply to Mistral-Large-3 — it is not in
      // REASONING_BUDGET_FLOOR_PATTERNS, so a small cap passes through unchanged
      // (and on the plain max_tokens field).
      const body10 = provider.buildRequest(messages, {
        model: "azure-openai/Mistral-Large-3",
        max_tokens: 60,
      });
      allOk =
        check(
          "Mistral-Large-3 max_tokens 60 NOT floored",
          body10.max_tokens === 60
        ) && allOk;

      // (f) Reasoning surfacing: a Kimi SSE chunk carrying
      // delta.reasoning_content must fire onReasoning({ type:"summary", text })
      // while the answer buffer (delta.content) stays clean. Mirrors the
      // Responses summary-delta harness (RESPONSES TEST 13) with a fetch mock.
      const origFetch = window.fetch;
      try {
        const sse =
          'data: {"choices":[{"index":0,"delta":{"reasoning_content":"thinking..."}}]}\n\n' +
          'data: {"choices":[{"index":0,"delta":{"content":"answer"}}]}\n\n' +
          'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}\n\n' +
          "data: [DONE]\n\n";
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(sse));
            c.close();
          },
        });
        const fake = new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
        window.fetch = async () => fake;

        const summaryPayloads = [];
        let completeText = null;
        await provider.streamRequest(messages, {
          model: "azure-openai/Kimi-K2.5",
          providerConfig: { proxyUrl: "http://test.invalid" },
          onReasoning: (info) => {
            if (info && info.type === "summary") summaryPayloads.push(info);
          },
          onComplete: (full) => {
            completeText = full;
          },
        });

        allOk =
          check(
            "Kimi reasoning_content fires onReasoning once with { type:'summary' }",
            summaryPayloads.length === 1
          ) && allOk;
        allOk =
          check(
            "Kimi onReasoning summary text === 'thinking...'",
            summaryPayloads[0] && summaryPayloads[0].text === "thinking..."
          ) && allOk;
        allOk =
          check(
            "Kimi answer text contains 'answer'",
            typeof completeText === "string" && completeText.includes("answer")
          ) && allOk;
        allOk =
          check(
            "Kimi answer text does NOT contain reasoning_content",
            typeof completeText === "string" &&
              !completeText.includes("thinking...")
          ) && allOk;
      } finally {
        window.fetch = origFetch;
      }

      console.log(
        allOk
          ? "\n🎉 TEST 4 PASSED!\n"
          : "\n❌ TEST 4 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ TEST 4 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ============================================================================
  // SUB-TEST 5: REAL STREAMING ROUND-TRIP (NETWORK)
  // ============================================================================

  window.testEmbedFoundry_RealRoundTrip = async function () {
    console.log("\n🧪 TEST 5: Real Streaming Round-Trip");
    console.log("=======================================\n");
    console.log(`Worker: ${WORKER_URL}`);
    console.log(`Model:  ${TEST_MODEL}`);
    console.log(`Prompt: ${TEST_PROMPT}\n`);

    const div = createTestContainer("stage2-foundry-roundtrip");
    let embed = null;
    let allOk = true;

    try {
      embed = new OpenRouterEmbed({
        containerId: div.id,
        model: TEST_MODEL,
        providers: {
          "azure-openai": { proxyUrl: WORKER_URL },
        },
      });

      let response = null;
      let caughtError = null;
      try {
        response = await embed.sendRequest(TEST_PROMPT);
      } catch (err) {
        caughtError = err;
      }

      allOk = check("Request did not throw", caughtError === null) && allOk;
      if (caughtError) {
        console.log(`    ↳ Error: ${caughtError.message}`);
      }
      allOk =
        check(
          "Response object present",
          response !== null && typeof response === "object"
        ) && allOk;
      allOk =
        check(
          "Response has text field with content",
          typeof response?.text === "string" && response.text.length > 0
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

  window.testEmbedFoundry_All = async function (options) {
    // clearConsole defaults OFF (see runAllDiagnostics). Pass
    // { clearConsole: true } to restore the clean-slate banner behaviour.
    const { clearConsole = false } = options || {};
    if (clearConsole) console.clear();
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║  OpenRouter Embed - Stage 2 Foundry Provider Tests       ║");
    console.log("║                                                           ║");
    console.log("║  Expected: 5/5 sub-tests pass (assumes Worker reachable   ║");
    console.log("║  and at least one azure-openai/* model registered)        ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");

    const t0 = performance.now();

    const results = {
      providerRegistration: await window.testEmbedFoundry_ProviderRegistration(),
      configRoundTrip: await window.testEmbedFoundry_ConfigRoundTrip(),
      selectorVisibility: await window.testEmbedFoundry_SelectorVisibility(),
      parameterTranslation: await window.testEmbedFoundry_ParameterTranslation(),
      realRoundTrip: await window.testEmbedFoundry_RealRoundTrip(),
    };

    const elapsedMs = performance.now() - t0;
    const elapsedSec = (elapsedMs / 1000).toFixed(2);

    console.log("\n" + "═".repeat(60));
    console.log("📊 TEST RESULTS");
    console.log("═".repeat(60));

    const order = [
      "providerRegistration",
      "configRoundTrip",
      "selectorVisibility",
      "parameterTranslation",
      "realRoundTrip",
    ];
    let passed = 0;
    for (const key of order) {
      console.log(results[key] ? `✅ ${key}` : `❌ ${key}`);
      if (results[key]) passed++;
    }

    console.log("\n" + "═".repeat(60));
    const allPassed = passed === order.length;
    const status = allPassed ? "PASS" : "FAIL";
    const icon = allPassed ? "🎉" : "⚠️";
    console.log(
      `${icon} TASK 2.5 FOUNDRY SUITE: ${status} (${passed}/${order.length} in ${elapsedSec}s)`
    );
    if (!allPassed && !results.selectorVisibility) {
      console.log(
        "    ↳ TEST 3 (SelectorVisibility) is environment-dependent — " +
          "requires at least one `azure-openai/*` model registered in " +
          "window.modelRegistry (consumer-side, see js/model-definitions.js)."
      );
    }
    console.log("═".repeat(60) + "\n");

    window._stage2FoundryResults = {
      passed,
      total: order.length,
      results,
      elapsedMs,
    };

    return { passed, total: order.length, results, elapsedMs };
  };

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("Stage 2 Foundry Provider Tests (Task 2.5) loaded");
  logInfo("Run all:    await window.testEmbedFoundry_All()");
  logInfo("Run one:    await window.testEmbedFoundry_<SubTestName>()");
})();

// ============================================================================
// RESPONSES-API PROVIDER TESTS (Task 4) — offline, deterministic
// ============================================================================
//
// window.testEmbedResponses_All() exercises the azure-responses adapter's
// contract behaviour with SYNTHETIC payloads only — no network, no
// OpenRouterEmbed instance, no DOM container. The streaming sub-test stubs
// window.fetch with a ReadableStream of synthetic SSE (restored in a finally).
// The live round-trip is covered by the Task 2 smoke and is deliberately NOT
// here, so runAllEmbedSuites() stays deterministic and network-free.
//
// Returns { passed, total, results, elapsedMs } (Shape 1 for the aggregator's
// summarise()), where passed/total count the ten sub-tests.
//
// Sibling IIFE — references the adapter only via window.EmbedProviderRegistry /
// window.EmbedProviderLookup globals; touches no other IIFE's scope.

(function () {
  "use strict";

  /**
   * Print one assertion in the project's test convention. Returns the boolean
   * unchanged so callers can ANDify results.
   */
  function check(name, condition) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      return true;
    }
    console.log(`  ❌ ${name}`);
    return false;
  }

  function getResponsesProvider() {
    const reg = window.EmbedProviderRegistry;
    return reg && typeof reg.get === "function"
      ? reg.get("azure-responses")
      : null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 1: REGISTRATION + LOOKUP
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_RegistrationLookup = async function () {
    console.log("\n🧪 RESPONSES TEST 1: Registration + Lookup");
    console.log("==========================================\n");
    try {
      let allOk = true;
      const reg = window.EmbedProviderRegistry;
      const lookup = window.EmbedProviderLookup;

      allOk =
        check(
          "registry.get('azure-responses') is truthy",
          !!(reg && reg.get && reg.get("azure-responses"))
        ) && allOk;

      const resolved =
        lookup && lookup.resolve
          ? lookup.resolve("azure-responses/gpt-5-codex")
          : null;
      allOk =
        check(
          "resolve('azure-responses/gpt-5-codex').id === 'azure-responses'",
          resolved && resolved.id === "azure-responses"
        ) && allOk;

      // anthropic-foundry is still deferred (unregistered) — the canonical
      // stays-null example. NEVER azure-responses here (it resolves now).
      allOk =
        check(
          "resolve('anthropic-foundry/x') === null (still deferred)",
          lookup && lookup.resolve && lookup.resolve("anthropic-foundry/x") === null
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 1 PASSED!\n" : "\n❌ RESPONSES TEST 1 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 1 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 2: buildRequest — REJECT model (gpt-5-codex strips temperature/top_p)
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_BuildRequestReject = async function () {
    console.log("\n🧪 RESPONSES TEST 2: buildRequest — reject model (gpt-5-codex)");
    console.log("==============================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const msgs = [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Hi" },
      ];
      // max_tokens 20000 is ABOVE REASONING_OUTPUT_FLOOR (16000) on purpose:
      // gpt-5-codex IS a reasoning model, so the floor would bump a smaller cap.
      // Picking a value above the floor keeps this rename assertion meaningful
      // and green whether or not the model registry (the floor's signal) is
      // loaded — the dedicated floor behaviour is asserted in RESPONSES TEST 8.
      const body = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5-codex",
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 20000,
      });

      allOk =
        check(
          "instructions is a non-empty string",
          typeof body.instructions === "string" && body.instructions.length > 0
        ) && allOk;
      allOk = check("input present", body.input !== undefined) && allOk;
      allOk =
        check("max_output_tokens === 20000", body.max_output_tokens === 20000) &&
        allOk;
      allOk = check("no max_tokens key", !("max_tokens" in body)) && allOk;
      allOk = check("temperature stripped", !("temperature" in body)) && allOk;
      allOk = check("top_p stripped", !("top_p" in body)) && allOk;
      allOk =
        check(
          "deployment reduced to bare 'gpt-5-codex'",
          body.model === "gpt-5-codex"
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 2 PASSED!\n" : "\n❌ RESPONSES TEST 2 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 2 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 3: buildRequest — ACCEPT model (gpt-5.3-codex retains temperature/top_p)
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_BuildRequestAccept = async function () {
    console.log("\n🧪 RESPONSES TEST 3: buildRequest — accept model (gpt-5.3-codex)");
    console.log("================================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const msgs = [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Hi" },
      ];
      const body = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5.3-codex",
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 256,
      });

      allOk =
        check("temperature retained === 0.7", body.temperature === 0.7) && allOk;
      allOk = check("top_p retained === 0.9", body.top_p === 0.9) && allOk;
      allOk =
        check(
          "deployment reduced to bare 'gpt-5.3-codex'",
          body.model === "gpt-5.3-codex"
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 3 PASSED!\n" : "\n❌ RESPONSES TEST 3 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 3 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 4: parseResponse — output[] walk past reasoning + usage key swap
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_ParseResponse = async function () {
    console.log("\n🧪 RESPONSES TEST 4: parseResponse — output[] walk + usage");
    console.log("==========================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const json = {
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Hello world" }],
          },
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 7,
          total_tokens: 16,
          output_tokens_details: { reasoning_tokens: 3 },
        },
      };
      const r = p.parseResponse(json);

      // parseResponse returns the OpenAI-chat shape (Task 2): text on
      // choices[0].message.content, usage with prompt_tokens/completion_tokens/
      // total_tokens. canonical metadata.tokens is core's job, NOT asserted here.
      allOk =
        check(
          "choices[0].message.content === 'Hello world' (reasoning item walked past)",
          r &&
            r.choices &&
            r.choices[0] &&
            r.choices[0].message &&
            r.choices[0].message.content === "Hello world"
        ) && allOk;
      allOk =
        check(
          "usage.prompt_tokens === 12 (from input_tokens)",
          r && r.usage && r.usage.prompt_tokens === 12
        ) && allOk;
      allOk =
        check(
          "usage.completion_tokens === 7 (from output_tokens)",
          r && r.usage && r.usage.completion_tokens === 7
        ) && allOk;
      allOk =
        check(
          "usage.total_tokens === 16",
          r && r.usage && r.usage.total_tokens === 16
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 4 PASSED!\n" : "\n❌ RESPONSES TEST 4 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 4 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 5: parseStreamChunk — delta event vs structural event
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_ParseStreamChunk = async function () {
    console.log("\n🧪 RESPONSES TEST 5: parseStreamChunk — delta vs structural");
    console.log("===========================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      // parseStreamChunk takes a raw SSE `data:` line (the adapter owns its
      // transport and receives raw strings).
      const delta = p.parseStreamChunk(
        'data: {"type":"response.output_text.delta","delta":"abc","obfuscation":"zzz"}'
      );
      allOk =
        check(
          "delta event -> { text: 'abc' } (obfuscation ignored)",
          delta && delta.text === "abc"
        ) && allOk;

      const structural = p.parseStreamChunk(
        'data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}'
      );
      allOk =
        check(
          "response.completed (structural) -> null",
          structural === null
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 5 PASSED!\n" : "\n❌ RESPONSES TEST 5 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 5 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 6: streamRequest — mocked SSE transport + canonical usage guard
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_StreamRequestMocked = async function () {
    console.log("\n🧪 RESPONSES TEST 6: streamRequest — mocked SSE transport + usage");
    console.log("=================================================================\n");
    const origFetch = window.fetch;
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const sse =
        'data: {"type":"response.output_text.delta","delta":"po","obfuscation":"x"}\n\n' +
        'data: {"type":"response.output_text.delta","delta":"ng","obfuscation":"y"}\n\n' +
        'data: {"type":"response.completed","response":{"usage":{"input_tokens":14,"output_tokens":2,"total_tokens":16,"output_tokens_details":{"reasoning_tokens":0}}}}\n\n' +
        "data: [DONE]\n\n";
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(sse));
          c.close();
        },
      });
      const fake = new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
      window.fetch = async () => fake;

      let acc = "";
      let rd = null;
      await p.streamRequest(
        [{ role: "user", content: "hi" }],
        {
          model: "azure-responses/gpt-5-codex",
          providerConfig: { proxyUrl: "http://test.invalid" },
          onChunk: (c) => {
            acc += typeof c === "string" ? c : (c && c.text) || "";
          },
          onComplete: (full, responseData) => {
            rd = responseData;
          },
        }
      );

      allOk = check("accumulated streamed text === 'pong'", acc === "pong") && allOk;
      // responseData.usage is the CANONICAL {prompt, completion, total} shape
      // buildFinalResponse assigns verbatim to metadata.tokens.
      allOk =
        check(
          "responseData.usage.prompt === 14 (canonical key, from input_tokens)",
          rd && rd.usage && rd.usage.prompt === 14
        ) && allOk;
      allOk =
        check(
          "responseData.usage.completion === 2 (from output_tokens)",
          rd && rd.usage && rd.usage.completion === 2
        ) && allOk;
      allOk =
        check(
          "responseData.usage.total === 16",
          rd && rd.usage && rd.usage.total === 16
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 6 PASSED!\n" : "\n❌ RESPONSES TEST 6 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 6 FAILED with error: ${error.message}`);
      return false;
    } finally {
      // ALWAYS restore fetch so later suites are not poisoned.
      window.fetch = origFetch;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 7: buildRequest — vision translation (image_url → input_image item)
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_BuildRequestVision = async function () {
    console.log("\n🧪 RESPONSES TEST 7: buildRequest — vision translation");
    console.log("=====================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      // Canonical chat-completions multimodal content (as openrouter-embed-file.js
      // prepareImageContent produces): nested image_url + a text part.
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const imgMsg = {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: "Describe this image." },
        ],
      };
      const body = p.buildRequest([imgMsg], {
        model: "azure-responses/gpt-5-pro",
        max_tokens: 512,
      });

      // input must be an item-array (NOT a flattened string) carrying the
      // translated parts. Parts found by type, order-independent.
      const content =
        Array.isArray(body.input) && body.input[0] ? body.input[0].content : null;
      const imgPart =
        content && content.find((part) => part.type === "input_image");
      const txtPart =
        content && content.find((part) => part.type === "input_text");

      allOk =
        check("body.input is an item-array", Array.isArray(body.input)) && allOk;
      allOk =
        check(
          "input[0].content carries an input_image part with the bare data-URL",
          !!imgPart && imgPart.image_url === dataUrl
        ) && allOk;
      allOk =
        check(
          "input[0].content carries the input_text part",
          !!txtPart && txtPart.text === "Describe this image."
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 7 PASSED!\n" : "\n❌ RESPONSES TEST 7 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 7 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 22: buildRequest — PDF file translation (file → input_file item)
  //   Sibling of the vision test (TEST 7). A PDF file part must map to a single
  //   input_file item carrying the unchanged file_data data-URL and the
  //   filename. Two negative guards: an image array still yields input_image and
  //   NO input_file, and a text-only array yields neither. Offline — tiny fake
  //   base64, no real PDF, no network.
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_BuildRequestPdf = async function () {
    console.log("\n🧪 RESPONSES TEST 22: buildRequest — PDF file → input_file");
    console.log("========================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      // Canonical content as openrouter-embed-file.js preparePDFContent produces:
      // a PDF file part followed by a text part.
      const pdfDataUrl = "data:application/pdf;base64,QUJD";
      const pdfMsg = {
        role: "user",
        content: [
          { type: "file", file: { filename: "x.pdf", file_data: pdfDataUrl } },
          { type: "text", text: "summarise" },
        ],
      };
      const body = p.buildRequest([pdfMsg], {
        model: "azure-responses/gpt-5-pro",
        max_tokens: 512,
      });
      const content =
        Array.isArray(body.input) && body.input[0] ? body.input[0].content : null;
      const fileParts = content
        ? content.filter((part) => part.type === "input_file")
        : [];
      const filePart = fileParts[0];
      const txtPart =
        content && content.find((part) => part.type === "input_text");

      allOk =
        check("body.input is an item-array", Array.isArray(body.input)) && allOk;
      allOk = check("exactly one input_file part", fileParts.length === 1) && allOk;
      allOk =
        check(
          "input_file.filename === 'x.pdf'",
          !!filePart && filePart.filename === "x.pdf"
        ) && allOk;
      allOk =
        check(
          "input_file.file_data passed through unchanged",
          !!filePart && filePart.file_data === pdfDataUrl
        ) && allOk;
      allOk =
        check(
          "input_text part carries the prompt",
          !!txtPart && txtPart.text === "summarise"
        ) && allOk;

      // Negative guard 1: an image array still maps to input_image, never input_file.
      const imgDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const imgBody = p.buildRequest(
        [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imgDataUrl } },
              { type: "text", text: "describe" },
            ],
          },
        ],
        { model: "azure-responses/gpt-5-pro", max_tokens: 512 }
      );
      const imgContent =
        Array.isArray(imgBody.input) && imgBody.input[0]
          ? imgBody.input[0].content
          : [];
      allOk =
        check(
          "image array → input_image present",
          imgContent.some((part) => part.type === "input_image")
        ) && allOk;
      allOk =
        check(
          "image array → NO input_file",
          !imgContent.some((part) => part.type === "input_file")
        ) && allOk;

      // Negative guard 2: a text-only array yields neither input_file nor input_image.
      const txtBody = p.buildRequest([{ role: "user", content: "just text" }], {
        model: "azure-responses/gpt-5-pro",
        max_tokens: 512,
      });
      const txtContent =
        Array.isArray(txtBody.input) && txtBody.input[0]
          ? txtBody.input[0].content
          : [];
      allOk =
        check(
          "text-only → neither input_file nor input_image",
          !txtContent.some(
            (part) => part.type === "input_file" || part.type === "input_image"
          )
        ) && allOk;

      console.log(
        allOk
          ? "\n🎉 RESPONSES TEST 22 PASSED!\n"
          : "\n❌ RESPONSES TEST 22 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 22 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 8: buildRequest — reasoning-aware max_output_tokens floor
  // ──────────────────────────────────────────────────────────────────────────
  // A reasoning Responses model with a SMALL max_tokens must floor
  // max_output_tokens to ≥ REASONING_OUTPUT_FLOOR (16000) so hidden reasoning
  // has headroom; a NON-reasoning model keeps the caller's value untouched.
  // The signal is the model registry "reasoning" capability — so this sub-test
  // requires the registry to be loaded (it is on the full page). When the
  // registry is unavailable the floor cannot fire, so the test reports that
  // explicitly rather than asserting a value it cannot reach.
  window.testEmbedResponses_BuildRequestFloor = async function () {
    console.log("\n🧪 RESPONSES TEST 8: buildRequest — reasoning output floor");
    console.log("==========================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const reg = window.modelRegistry;
      const registryReady =
        !!reg &&
        typeof reg.getModel === "function" &&
        Array.isArray(reg.getModel("azure-responses/gpt-5-pro", true)?.capabilities);
      if (
        !check(
          "model registry loaded (floor signal available)",
          registryReady
        )
      ) {
        // Without the registry the floor's single source of truth is absent;
        // surface that and bail rather than asserting an unreachable value.
        console.log(
          "\n⚠️ RESPONSES TEST 8 SKIPPED — model registry not loaded.\n"
        );
        return false;
      }

      const msgs = [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Hi" },
      ];

      // Reasoning model (gpt-5-pro), small cap → floored to ≥ 16000.
      const reasoningBody = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5-pro",
        max_tokens: 256,
      });
      allOk =
        check(
          "reasoning model floors max_output_tokens to ≥ 16000 (was 256)",
          reasoningBody.max_output_tokens >= 16000
        ) && allOk;

      // Reasoning model with NO cap → still floored (starves otherwise).
      const reasoningNoCap = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5-pro",
      });
      allOk =
        check(
          "reasoning model with no cap still floored to ≥ 16000",
          reasoningNoCap.max_output_tokens >= 16000
        ) && allOk;

      // Non-reasoning model (gpt-5.3-codex) → caller's value untouched.
      const nonReasoningBody = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5.3-codex",
        max_tokens: 256,
      });
      allOk =
        check(
          "non-reasoning model keeps caller's max_output_tokens === 256",
          nonReasoningBody.max_output_tokens === 256
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 8 PASSED!\n" : "\n❌ RESPONSES TEST 8 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 8 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 9: parseResponse — throw on empty / incomplete response
  // ──────────────────────────────────────────────────────────────────────────
  // A completed-but-empty response, or one with status:"incomplete", must throw
  // an Error naming the budget cause — never silently return empty text.
  window.testEmbedResponses_ParseResponseEmpty = async function () {
    console.log("\n🧪 RESPONSES TEST 9: parseResponse — throw on empty/incomplete");
    console.log("=============================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      // Incomplete + empty output (reasoning exhausted the budget): the live
      // failure shape — output[] carries only a reasoning item, no message.
      const incompleteJson = {
        model: "gpt-5-pro",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [{ type: "reasoning", summary: [] }],
        usage: {
          input_tokens: 50,
          output_tokens: 4000,
          total_tokens: 4050,
          output_tokens_details: { reasoning_tokens: 4000 },
        },
      };
      let threw = false;
      let message = "";
      try {
        p.parseResponse(incompleteJson);
      } catch (e) {
        threw = true;
        message = e && e.message ? e.message : "";
      }
      allOk = check("incomplete response throws", threw) && allOk;
      allOk =
        check(
          "error message names the budget / max output tokens",
          /budget|max output tokens/i.test(message)
        ) && allOk;
      allOk =
        check(
          "error message reports the incomplete reason",
          /max_output_tokens/.test(message)
        ) && allOk;

      // Completed but empty (no message text, no incomplete status): still throws.
      const emptyJson = {
        model: "gpt-5-pro",
        status: "completed",
        output: [{ type: "reasoning", summary: [] }],
        usage: { input_tokens: 10, output_tokens: 0, total_tokens: 10 },
      };
      let threwEmpty = false;
      try {
        p.parseResponse(emptyJson);
      } catch (e) {
        threwEmpty = true;
      }
      allOk = check("completed-but-empty response throws", threwEmpty) && allOk;

      // Sanity: a normal response with text still parses (no false positive).
      const okJson = {
        model: "gpt-5-pro",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "A grounded description." }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };
      let okText = null;
      try {
        okText = p.parseResponse(okJson).choices[0].message.content;
      } catch (e) {
        okText = null;
      }
      allOk =
        check(
          "non-empty response still parses (no false positive)",
          okText === "A grounded description."
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 9 PASSED!\n" : "\n❌ RESPONSES TEST 9 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 9 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 10: reasoning heartbeat — structural events surface liveness
  // ──────────────────────────────────────────────────────────────────────────
  // While a reasoning model thinks, only structural SSE events arrive (no
  // output_text). parseStreamChunk must return a contentless progress marker
  // for them (NOT null, NOT text), and streamRequest must fire onReasoning for
  // each — without polluting the text buffer. response.completed stays terminal
  // (null from parseStreamChunk), and output_text.delta stays text.
  window.testEmbedResponses_StreamHeartbeat = async function () {
    console.log("\n🧪 RESPONSES TEST 10: reasoning heartbeat (liveness)");
    console.log("===================================================\n");
    const origFetch = window.fetch;
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      // parseStreamChunk: structural events → progress marker.
      const inProgress = p.parseStreamChunk(
        'data: {"type":"response.in_progress"}'
      );
      allOk =
        check(
          "response.in_progress -> { progress:true, phase:'reasoning' }",
          inProgress &&
            inProgress.progress === true &&
            inProgress.phase === "reasoning" &&
            inProgress.text === undefined
        ) && allOk;

      const reasoningPart = p.parseStreamChunk(
        'data: {"type":"response.reasoning_summary_part.added","part":{}}'
      );
      allOk =
        check(
          "response.reasoning_summary_part.added -> progress marker",
          reasoningPart && reasoningPart.progress === true
        ) && allOk;

      // Terminal + text events keep their existing contract (regression guard).
      allOk =
        check(
          "response.completed -> null (terminal, not a heartbeat)",
          p.parseStreamChunk(
            'data: {"type":"response.completed","response":{"usage":{}}}'
          ) === null
        ) && allOk;
      const delta = p.parseStreamChunk(
        'data: {"type":"response.output_text.delta","delta":"hi"}'
      );
      allOk =
        check(
          "output_text.delta -> { text } (not a marker)",
          delta && delta.text === "hi" && delta.progress === undefined
        ) && allOk;

      // streamRequest: structural events fire onReasoning; text buffer is clean.
      const sse =
        'data: {"type":"response.created"}\n\n' +
        'data: {"type":"response.in_progress"}\n\n' +
        'data: {"type":"response.reasoning_summary_part.added","part":{}}\n\n' +
        'data: {"type":"response.output_text.delta","delta":"Done","obfuscation":"z"}\n\n' +
        'data: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":1,"total_tokens":6}}}\n\n' +
        "data: [DONE]\n\n";
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(sse));
          c.close();
        },
      });
      const fake = new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
      window.fetch = async () => fake;

      let heartbeats = 0;
      let lastPhase = null;
      let acc = "";
      let completed = false;
      await p.streamRequest([{ role: "user", content: "hi" }], {
        model: "azure-responses/gpt-5-pro",
        providerConfig: { proxyUrl: "http://test.invalid" },
        onReasoning: (info) => {
          heartbeats++;
          lastPhase = info && info.phase;
        },
        onChunk: (c) => {
          acc += typeof c === "string" ? c : (c && c.text) || "";
        },
        onComplete: () => {
          completed = true;
        },
      });

      allOk =
        check(
          "onReasoning fired for the 3 structural events (created/in_progress/reasoning)",
          heartbeats === 3
        ) && allOk;
      allOk =
        check("heartbeat phase === 'reasoning'", lastPhase === "reasoning") &&
        allOk;
      allOk =
        check("text buffer contains only the real text ('Done')", acc === "Done") &&
        allOk;
      allOk = check("onComplete still fired", completed === true) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 10 PASSED!\n" : "\n❌ RESPONSES TEST 10 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 10 FAILED with error: ${error.message}`);
      return false;
    } finally {
      window.fetch = origFetch;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 11: buildRequest — reasoning model requests reasoning.summary
  // ──────────────────────────────────────────────────────────────────────────
  // A reasoning-capable Responses model (gpt-5-pro) must carry
  // body.reasoning.summary === "auto" (Reasoning Disclosure, decision D1) so the
  // model returns a summary of its own thinking. The signal is the registry
  // "reasoning" capability (same source as the floor in TEST 8), so this test
  // requires the registry to be loaded.
  window.testEmbedResponses_BuildRequestSummaryReasoning = async function () {
    console.log("\n🧪 RESPONSES TEST 11: buildRequest — reasoning.summary requested");
    console.log("================================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const reg = window.modelRegistry;
      const registryReady =
        !!reg &&
        typeof reg.getModel === "function" &&
        Array.isArray(reg.getModel("azure-responses/gpt-5-pro", true)?.capabilities);
      if (
        !check(
          "model registry loaded (reasoning signal available)",
          registryReady
        )
      ) {
        console.log(
          "\n⚠️ RESPONSES TEST 11 SKIPPED — model registry not loaded.\n"
        );
        return false;
      }

      const msgs = [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Hi" },
      ];
      const body = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5-pro",
        max_tokens: 256,
      });

      allOk =
        check(
          "reasoning model sets body.reasoning.summary === 'auto'",
          body.reasoning && body.reasoning.summary === "auto"
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 11 PASSED!\n" : "\n❌ RESPONSES TEST 11 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 11 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 12: buildRequest — non-reasoning model omits reasoning.summary
  // ──────────────────────────────────────────────────────────────────────────
  // A non-reasoning Responses deployment (gpt-5.3-codex) must NOT receive the
  // summary key — it would be meaningless and could be rejected. Holds whether
  // or not the registry is loaded (no registry → treated as non-reasoning → no
  // summary), so this assertion is robust either way.
  window.testEmbedResponses_BuildRequestSummaryNonReasoning = async function () {
    console.log("\n🧪 RESPONSES TEST 12: buildRequest — summary omitted (non-reasoning)");
    console.log("===================================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const msgs = [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Hi" },
      ];
      const body = p.buildRequest(msgs, {
        model: "azure-responses/gpt-5.3-codex",
        max_tokens: 256,
      });

      allOk =
        check(
          "non-reasoning model leaves reasoning.summary off",
          !body.reasoning || body.reasoning.summary === undefined
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 12 PASSED!\n" : "\n❌ RESPONSES TEST 12 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 12 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 13: streamRequest — reasoning_summary_text.delta → onReasoning text
  // ──────────────────────────────────────────────────────────────────────────
  // A summary-delta event must forward its TEXT through onReasoning with a typed
  // { type:"summary", text } payload, while the answer buffer (output_text.delta)
  // stays clean — the summary must never leak into the description.
  window.testEmbedResponses_StreamSummaryDelta = async function () {
    console.log("\n🧪 RESPONSES TEST 13: streamRequest — summary delta → onReasoning");
    console.log("================================================================\n");
    const origFetch = window.fetch;
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const sse =
        'data: {"type":"response.reasoning_summary_text.delta","delta":"summary text"}\n\n' +
        'data: {"type":"response.output_text.delta","delta":"answer","obfuscation":"z"}\n\n' +
        'data: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":1,"total_tokens":6}}}\n\n' +
        "data: [DONE]\n\n";
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(sse));
          c.close();
        },
      });
      const fake = new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
      window.fetch = async () => fake;

      const summaryPayloads = [];
      let completeText = null;
      await p.streamRequest([{ role: "user", content: "hi" }], {
        model: "azure-responses/gpt-5-pro",
        providerConfig: { proxyUrl: "http://test.invalid" },
        onReasoning: (info) => {
          if (info && info.type === "summary") summaryPayloads.push(info);
        },
        onComplete: (full) => {
          completeText = full;
        },
      });

      allOk =
        check(
          "onReasoning fired once with { type:'summary' }",
          summaryPayloads.length === 1
        ) && allOk;
      allOk =
        check(
          "summary payload text === 'summary text'",
          summaryPayloads[0] && summaryPayloads[0].text === "summary text"
        ) && allOk;
      allOk =
        check(
          "onComplete answer text contains 'answer'",
          typeof completeText === "string" && completeText.includes("answer")
        ) && allOk;
      allOk =
        check(
          "onComplete answer text does NOT contain 'summary text'",
          typeof completeText === "string" &&
            !completeText.includes("summary text")
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 13 PASSED!\n" : "\n❌ RESPONSES TEST 13 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 13 FAILED with error: ${error.message}`);
      return false;
    } finally {
      window.fetch = origFetch;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 14: parseResponse — non-streaming reasoning summary on result.reasoning
  // ──────────────────────────────────────────────────────────────────────────
  // The non-streaming path reads the summary from the output[] "reasoning" item's
  // summary[] entries. A wire object with a summary attaches result.reasoning; a
  // wire object with no reasoning summary leaves the field absent (fail safe).
  window.testEmbedResponses_ParseResponseSummary = async function () {
    console.log("\n🧪 RESPONSES TEST 14: parseResponse — reasoning summary attached");
    console.log("===============================================================\n");
    try {
      let allOk = true;
      const p = getResponsesProvider();
      if (!p) return check("azure-responses provider available", false);

      const withSummary = {
        model: "gpt-5-pro",
        status: "completed",
        output: [
          { type: "reasoning", summary: [{ text: "S" }] },
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "The answer." }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };
      const r1 = p.parseResponse(withSummary);
      allOk =
        check(
          "result.reasoning === 'S' when a reasoning summary is present",
          r1 && r1.reasoning === "S"
        ) && allOk;

      const noSummary = {
        model: "gpt-5-pro",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "The answer." }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };
      const r2 = p.parseResponse(noSummary);
      allOk =
        check(
          "no reasoning field when the wire carries no reasoning item",
          r2 && !("reasoning" in r2)
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 14 PASSED!\n" : "\n❌ RESPONSES TEST 14 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 14 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 15: streamRequest THROUGH CORE — summary accumulates to response.reasoning
  // ──────────────────────────────────────────────────────────────────────────
  // The first test that drives the azure-responses provider end-to-end THROUGH
  // an OpenRouterEmbed instance (not the provider in isolation) with a mocked
  // fetch — proving Task 1 (adapter capture) and Task 2 (core accumulation)
  // land together. A mixed SSE stream (heartbeat + two summary deltas + answer
  // + completed) must: forward a typed summary payload AND a content-free
  // heartbeat through onReasoning, keep the answer buffer clean, and expose the
  // assembled summary as response.reasoning on the onComplete response.
  window.testEmbedResponses_StreamReasoningThroughCore = async function () {
    console.log("\n🧪 RESPONSES TEST 15: streamRequest through core → response.reasoning");
    console.log("====================================================================\n");
    const origFetch = window.fetch;
    const containerId = "embed-test-responses-throughcore";
    let container = document.getElementById(containerId);
    let createdContainer = false;
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      document.body.appendChild(container);
      createdContainer = true;
    }
    try {
      let allOk = true;

      if (typeof window.OpenRouterEmbed !== "function") {
        return check("window.OpenRouterEmbed available", false);
      }

      const sse =
        'data: {"type":"response.in_progress","response":{"id":"r1","status":"in_progress"}}\n\n' +
        'data: {"type":"response.reasoning_summary_text.delta","delta":"Summary part one. "}\n\n' +
        'data: {"type":"response.reasoning_summary_text.delta","delta":"Summary part two."}\n\n' +
        'data: {"type":"response.output_text.delta","delta":"The answer."}\n\n' +
        'data: {"type":"response.completed","response":{"id":"r1","status":"completed","model":"gpt-5-pro","output":[],"usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15,"output_tokens_details":{"reasoning_tokens":3}}}}\n\n' +
        "data: [DONE]\n\n";
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(sse));
          c.close();
        },
      });
      const fake = new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
      window.fetch = async () => fake;

      const embed = new window.OpenRouterEmbed({
        containerId,
        model: "azure-responses/gpt-5-pro",
        showNotifications: false,
      });
      embed.configureProvider("azure-responses", {
        proxyUrl: "http://test.invalid",
      });

      const reasoningCalls = [];
      let completeResponse = null;
      await embed.sendStreamingRequest({
        userPrompt: "hi",
        onChunk: () => {},
        onReasoning: (info) => {
          reasoningCalls.push(info);
        },
        onComplete: (response) => {
          completeResponse = response;
        },
      });

      const summaryCalls = reasoningCalls.filter(
        (i) => i && i.type === "summary" && typeof i.text === "string"
      );
      const heartbeatCalls = reasoningCalls.filter(
        (i) => i && i.phase === "reasoning" && i.text === undefined
      );

      allOk =
        check(
          "onReasoning fired with a typed summary payload (type:'summary', string text)",
          summaryCalls.length >= 1
        ) && allOk;
      allOk =
        check(
          "in_progress heartbeat fired (phase:'reasoning', no text) and coexists",
          heartbeatCalls.length >= 1
        ) && allOk;
      allOk =
        check(
          "onComplete response.text === 'The answer.' (summary did not leak)",
          completeResponse &&
            completeResponse.text === "The answer." &&
            !completeResponse.text.includes("Summary")
        ) && allOk;
      allOk =
        check(
          "response.reasoning === assembled summary deltas",
          completeResponse &&
            completeResponse.reasoning === "Summary part one. Summary part two."
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 15 PASSED!\n" : "\n❌ RESPONSES TEST 15 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 15 FAILED with error: ${error.message}`);
      return false;
    } finally {
      window.fetch = origFetch;
      if (createdContainer && container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 16: NON-streaming THROUGH CORE — summary copies to response.reasoning
  // ──────────────────────────────────────────────────────────────────────────
  // The non-streaming counterpart of TEST 15. Drives azure-responses end-to-end
  // through an OpenRouterEmbed instance on the NON-streaming path with a mocked
  // JSON (not SSE) fetch, proving Task 1's parseResponse summary capture reaches
  // the caller through Task 2 Edit 4's copy-through in processResponse.
  //
  // The public sendRequest() uses streaming internally; the genuine
  // non-streaming dispatch (provider.request -> processResponse) is core's
  // reduced-motion fallback. We force prefersReducedMotion() so sendRequest
  // routes through that path deterministically (no media-query emulation).
  window.testEmbedResponses_NonStreamReasoningThroughCore = async function () {
    console.log("\n🧪 RESPONSES TEST 16: non-streaming through core → response.reasoning");
    console.log("====================================================================\n");
    const origFetch = window.fetch;
    const containerId = "embed-test-responses-nonstream-throughcore";
    let container = document.getElementById(containerId);
    let createdContainer = false;
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      document.body.appendChild(container);
      createdContainer = true;
    }
    try {
      let allOk = true;

      if (typeof window.OpenRouterEmbed !== "function") {
        return check("window.OpenRouterEmbed available", false);
      }

      const BODY = {
        id: "r1",
        status: "completed",
        model: "gpt-5-pro",
        output: [
          {
            type: "reasoning",
            summary: [
              { type: "summary_text", text: "NS summary one. " },
              { type: "summary_text", text: "NS summary two." },
            ],
          },
          {
            type: "message",
            content: [{ type: "output_text", text: "The answer." }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };
      // Fresh Response per call so a re-read can never hit a consumed body.
      window.fetch = async () =>
        new Response(JSON.stringify(BODY), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      const embed = new window.OpenRouterEmbed({
        containerId,
        model: "azure-responses/gpt-5-pro",
        showNotifications: false,
      });
      embed.configureProvider("azure-responses", {
        proxyUrl: "http://test.invalid",
      });
      // Force the genuine non-streaming path (provider.request -> processResponse,
      // Task 2 Edit 4). respectReducedMotion defaults true; this stub makes the
      // reduced-motion gate fire without emulating the media query.
      embed.prefersReducedMotion = () => true;

      const response = await embed.sendRequest("hi");

      allOk =
        check(
          "response.text === 'The answer.' (summary did not leak)",
          response &&
            response.text === "The answer." &&
            !response.text.includes("NS summary")
        ) && allOk;
      allOk =
        check(
          "response.reasoning === assembled non-streaming summary deltas",
          response &&
            response.reasoning === "NS summary one. NS summary two."
        ) && allOk;

      console.log(
        allOk ? "\n🎉 RESPONSES TEST 16 PASSED!\n" : "\n❌ RESPONSES TEST 16 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 16 FAILED with error: ${error.message}`);
      return false;
    } finally {
      window.fetch = origFetch;
      if (createdContainer && container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 17: EmbedReasoningDisclosure — renders markdown, collapsed by default
  // ──────────────────────────────────────────────────────────────────────────
  // Reasoning Disclosure Task 3. These four tests exercise the reusable
  // EmbedReasoningDisclosure component (openrouter-embed-reasoning-disclosure.js)
  // in pure DOM, no network, no OpenRouterEmbed instance. Each uses a FRESH
  // instance (new window.EmbedReasoningDisclosureClass()) mounted into a unique
  // container appended to body and removed in finally — the shared singleton
  // window.EmbedReasoningDisclosure is NEVER mutated.
  window.testEmbedResponses_DisclosureRendersMarkdownCollapsed =
    async function () {
      console.log(
        "\n🧪 RESPONSES TEST 17: disclosure renders markdown, collapsed by default"
      );
      console.log(
        "======================================================================\n"
      );
      const containerId = "embed-test-disclosure-renders-collapsed";
      let container = document.getElementById(containerId);
      let createdContainer = false;
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        document.body.appendChild(container);
        createdContainer = true;
      }
      try {
        let allOk = true;

        if (typeof window.EmbedReasoningDisclosureClass !== "function") {
          return check("window.EmbedReasoningDisclosureClass available", false);
        }

        const d = new window.EmbedReasoningDisclosureClass();
        d.mount(container);
        d.setReasoning("**bold** text");

        allOk =
          check(
            "detailsEl.hidden === false (text present → visible)",
            d.detailsEl.hidden === false
          ) && allOk;
        allOk =
          check(
            "bodyEl.innerHTML contains '<strong>bold</strong>'",
            d.bodyEl.innerHTML.includes("<strong>bold</strong>")
          ) && allOk;
        allOk =
          check(
            "detailsEl.open === false (collapsed by default)",
            d.detailsEl.open === false
          ) && allOk;

        console.log(
          allOk
            ? "\n🎉 RESPONSES TEST 17 PASSED!\n"
            : "\n❌ RESPONSES TEST 17 FAILED.\n"
        );
        return allOk;
      } catch (error) {
        console.error(`❌ RESPONSES TEST 17 FAILED with error: ${error.message}`);
        return false;
      } finally {
        if (createdContainer && container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 18: EmbedReasoningDisclosure — appendReasoning accumulates
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_DisclosureAppendAccumulates = async function () {
    console.log(
      "\n🧪 RESPONSES TEST 18: disclosure appendReasoning accumulates (not replaces)"
    );
    console.log(
      "===========================================================================\n"
    );
    const containerId = "embed-test-disclosure-append-accumulates";
    let container = document.getElementById(containerId);
    let createdContainer = false;
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      document.body.appendChild(container);
      createdContainer = true;
    }
    try {
      let allOk = true;

      if (typeof window.EmbedReasoningDisclosureClass !== "function") {
        return check("window.EmbedReasoningDisclosureClass available", false);
      }

      const d = new window.EmbedReasoningDisclosureClass();
      d.mount(container);
      d.setReasoning("A ");
      d.appendReasoning("B");

      const bodyText = d.bodyEl.textContent;
      allOk =
        check(
          "rendered body text contains 'A' (retained)",
          bodyText.includes("A")
        ) && allOk;
      allOk =
        check(
          "rendered body text contains 'B' (appended, not replaced)",
          bodyText.includes("B")
        ) && allOk;

      console.log(
        allOk
          ? "\n🎉 RESPONSES TEST 18 PASSED!\n"
          : "\n❌ RESPONSES TEST 18 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 18 FAILED with error: ${error.message}`);
      return false;
    } finally {
      if (createdContainer && container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 19: EmbedReasoningDisclosure — headings demoted out of the outline
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_DisclosureHeadingDemotion = async function () {
    console.log(
      "\n🧪 RESPONSES TEST 19: disclosure demotes headings out of the outline"
    );
    console.log(
      "====================================================================\n"
    );
    const containerId = "embed-test-disclosure-heading-demotion";
    let container = document.getElementById(containerId);
    let createdContainer = false;
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      document.body.appendChild(container);
      createdContainer = true;
    }
    try {
      let allOk = true;

      if (typeof window.EmbedReasoningDisclosureClass !== "function") {
        return check("window.EmbedReasoningDisclosureClass available", false);
      }

      const d = new window.EmbedReasoningDisclosureClass();
      d.mount(container);
      d.setReasoning("# Heading\n\nbody");

      allOk =
        check(
          "bodyEl.querySelector('h1') === null (no heading in outline)",
          d.bodyEl.querySelector("h1") === null
        ) && allOk;
      allOk =
        check(
          "text 'Heading' still present in body (preserved, e.g. in strong/p)",
          d.bodyEl.textContent.includes("Heading")
        ) && allOk;

      console.log(
        allOk
          ? "\n🎉 RESPONSES TEST 19 PASSED!\n"
          : "\n❌ RESPONSES TEST 19 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 19 FAILED with error: ${error.message}`);
      return false;
    } finally {
      if (createdContainer && container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 20: EmbedReasoningDisclosure — reset empties and hides
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_DisclosureResetEmptiesAndHides = async function () {
    console.log(
      "\n🧪 RESPONSES TEST 20: disclosure reset empties body and re-hides"
    );
    console.log(
      "================================================================\n"
    );
    const containerId = "embed-test-disclosure-reset-empties";
    let container = document.getElementById(containerId);
    let createdContainer = false;
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      document.body.appendChild(container);
      createdContainer = true;
    }
    try {
      let allOk = true;

      if (typeof window.EmbedReasoningDisclosureClass !== "function") {
        return check("window.EmbedReasoningDisclosureClass available", false);
      }

      const d = new window.EmbedReasoningDisclosureClass();
      d.mount(container);
      d.setReasoning("something");
      d.reset();

      allOk =
        check("detailsEl.hidden === true (re-hidden)", d.detailsEl.hidden === true) &&
        allOk;
      allOk =
        check('bodyEl.innerHTML === "" (emptied)', d.bodyEl.innerHTML === "") &&
        allOk;
      allOk =
        check("detailsEl.open === false (collapsed)", d.detailsEl.open === false) &&
        allOk;

      console.log(
        allOk
          ? "\n🎉 RESPONSES TEST 20 PASSED!\n"
          : "\n❌ RESPONSES TEST 20 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 20 FAILED with error: ${error.message}`);
      return false;
    } finally {
      if (createdContainer && container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TEST 21: Foundry umbrella group — getEligibleModels({azure-openai})
  //   surfaces BOTH the azure-openai (chat) and azure-responses (Responses)
  //   surfaces under one "Microsoft Foundry" provider (Task 5d, option B).
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_FoundryUmbrellaGroup = async function () {
    console.log("\n🧪 RESPONSES TEST 21: Foundry umbrella group");
    console.log("==========================================\n");
    try {
      let allOk = true;
      const selector = window.EmbedModelSelector;
      const eligible =
        selector && typeof selector.getEligibleModels === "function"
          ? selector.getEligibleModels({ providerId: "azure-openai" })
          : [];
      const prefixes = new Set(eligible.map((m) => String(m.id).split("/")[0]));

      allOk =
        check(
          "azure-openai group includes an azure-openai/ model",
          prefixes.has("azure-openai")
        ) && allOk;
      allOk =
        check(
          "azure-openai group includes an azure-responses/ model",
          prefixes.has("azure-responses")
        ) && allOk;

      console.log(
        allOk
          ? "\n🎉 RESPONSES TEST 21 PASSED!\n"
          : "\n❌ RESPONSES TEST 21 FAILED.\n"
      );
      return allOk;
    } catch (error) {
      console.error(`❌ RESPONSES TEST 21 FAILED with error: ${error.message}`);
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MASTER RUNNER
  // ──────────────────────────────────────────────────────────────────────────
  window.testEmbedResponses_All = async function (options) {
    const { clearConsole = false } = options || {};
    if (clearConsole) console.clear();
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║  OpenRouter Embed - Responses-API Provider Tests (Task 4) ║");
    console.log("║                                                           ║");
    console.log("║  Offline / deterministic — synthetic payloads, no network ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");

    const t0 = performance.now();

    const results = {
      registrationLookup: await window.testEmbedResponses_RegistrationLookup(),
      buildRequestReject: await window.testEmbedResponses_BuildRequestReject(),
      buildRequestAccept: await window.testEmbedResponses_BuildRequestAccept(),
      parseResponse: await window.testEmbedResponses_ParseResponse(),
      parseStreamChunk: await window.testEmbedResponses_ParseStreamChunk(),
      streamRequestMocked: await window.testEmbedResponses_StreamRequestMocked(),
      buildRequestVision: await window.testEmbedResponses_BuildRequestVision(),
      buildRequestPdf: await window.testEmbedResponses_BuildRequestPdf(),
      buildRequestFloor: await window.testEmbedResponses_BuildRequestFloor(),
      parseResponseEmpty: await window.testEmbedResponses_ParseResponseEmpty(),
      streamHeartbeat: await window.testEmbedResponses_StreamHeartbeat(),
      buildRequestSummaryReasoning:
        await window.testEmbedResponses_BuildRequestSummaryReasoning(),
      buildRequestSummaryNonReasoning:
        await window.testEmbedResponses_BuildRequestSummaryNonReasoning(),
      streamSummaryDelta: await window.testEmbedResponses_StreamSummaryDelta(),
      parseResponseSummary:
        await window.testEmbedResponses_ParseResponseSummary(),
      streamReasoningThroughCore:
        await window.testEmbedResponses_StreamReasoningThroughCore(),
      nonStreamReasoningThroughCore:
        await window.testEmbedResponses_NonStreamReasoningThroughCore(),
      disclosureRendersMarkdownCollapsed:
        await window.testEmbedResponses_DisclosureRendersMarkdownCollapsed(),
      disclosureAppendAccumulates:
        await window.testEmbedResponses_DisclosureAppendAccumulates(),
      disclosureHeadingDemotion:
        await window.testEmbedResponses_DisclosureHeadingDemotion(),
      disclosureResetEmptiesAndHides:
        await window.testEmbedResponses_DisclosureResetEmptiesAndHides(),
      foundryUmbrellaGroup:
        await window.testEmbedResponses_FoundryUmbrellaGroup(),
    };

    const elapsedMs = performance.now() - t0;
    const elapsedSec = (elapsedMs / 1000).toFixed(2);

    console.log("\n" + "═".repeat(60));
    console.log("📊 TEST RESULTS");
    console.log("═".repeat(60));

    const order = [
      "registrationLookup",
      "buildRequestReject",
      "buildRequestAccept",
      "parseResponse",
      "parseStreamChunk",
      "streamRequestMocked",
      "buildRequestVision",
      "buildRequestPdf",
      "buildRequestFloor",
      "parseResponseEmpty",
      "streamHeartbeat",
      "buildRequestSummaryReasoning",
      "buildRequestSummaryNonReasoning",
      "streamSummaryDelta",
      "parseResponseSummary",
      "streamReasoningThroughCore",
      "nonStreamReasoningThroughCore",
      "disclosureRendersMarkdownCollapsed",
      "disclosureAppendAccumulates",
      "disclosureHeadingDemotion",
      "disclosureResetEmptiesAndHides",
      "foundryUmbrellaGroup",
    ];
    let passed = 0;
    for (const key of order) {
      console.log(results[key] ? `✅ ${key}` : `❌ ${key}`);
      if (results[key]) passed++;
    }

    console.log("\n" + "═".repeat(60));
    const allPassed = passed === order.length;
    const status = allPassed ? "PASS" : "FAIL";
    const icon = allPassed ? "🎉" : "⚠️";
    console.log(
      `${icon} RESPONSES-API SUITE: ${status} (${passed}/${order.length} in ${elapsedSec}s)`
    );
    console.log("═".repeat(60) + "\n");

    window._embedResponsesResults = {
      passed,
      total: order.length,
      results,
      elapsedMs,
    };

    return { passed, total: order.length, results, elapsedMs };
  };

  if (console && console.log) {
    console.log(
      "[testEmbedResponses_All] loaded — run: await window.testEmbedResponses_All()"
    );
  }
})();

// ============================================================================
// CONSOLIDATED MULTI-SUITE RUNNER (results-recording aid)
// ============================================================================
//
// window.runAllEmbedSuites() awaits the six named regression suites in their
// documented order, captures each suite's STRUCTURED RETURN VALUE, and prints
// ONE consolidated console.table at the very end. Because the per-suite tally
// is taken from the return value (not scraped from the scroll-back), the final
// table survives even though some suites call console.clear() at their start.
//
// Each suite is invoked with { clearConsole: false } (the post-flag default)
// EXCEPT the first, which is given { clearConsole: true } for a clean banner.
// Suites that predate the flag simply ignore the unknown options argument.
// Every call is wrapped so one suite throwing does not abort the sweep.
//
// The six suites return heterogeneous shapes; summarise() normalises them:
//   - { passed, total, ... }            → used directly (ProviderAbstraction, Foundry)
//   - boolean                           → enriched from window._embedStage1Results
//                                         when present, else 1/1 (testEmbedStage1_All)
//   - { name: { success, ... }, ... }   → counted by .success (Stage 3, Stage 4)
//
// Run: await window.runAllEmbedSuites()
//
// Sibling IIFE — references the suites only as window globals; touches no other
// IIFE's scope.

(function () {
  "use strict";

  const SUITES = [
    { name: "testStage1_ProviderAbstraction_All", clearConsole: true },
    { name: "testEmbedStage1_All" },
    { name: "testEmbedStage3_All" },
    { name: "testEmbedStage4_Phase2_All" },
    { name: "testEmbedFoundry_All" },
    { name: "testEmbedResponses_All" },
  ];

  function summarise(name, ret) {
    // Shape 1: explicit { passed, total } (check BEFORE the generic object
    // branch, since these returns are also objects).
    if (
      ret &&
      typeof ret.passed === "number" &&
      typeof ret.total === "number"
    ) {
      return {
        status: ret.passed === ret.total ? "PASS" : "FAIL",
        passed: ret.passed,
        total: ret.total,
      };
    }
    // Shape 2: bare boolean (testEmbedStage1_All). Enrich with the stored
    // count when available so the grand total stays faithful (e.g. 8/8).
    if (typeof ret === "boolean") {
      const stored =
        name === "testEmbedStage1_All" ? window._embedStage1Results : null;
      if (stored && typeof stored.passed === "number") {
        return {
          status: ret ? "PASS" : "FAIL",
          passed: stored.passed,
          total: stored.total,
        };
      }
      return { status: ret ? "PASS" : "FAIL", passed: ret ? 1 : 0, total: 1 };
    }
    // Shape 3: object of { success } sub-results (Stage 3, Stage 4).
    if (ret && typeof ret === "object") {
      const vals = Object.values(ret);
      const total = vals.length;
      const passed = vals.filter((v) => v && v.success).length;
      return {
        status: passed === total ? "PASS" : "FAIL",
        passed,
        total,
      };
    }
    return { status: "UNKNOWN", passed: 0, total: 0 };
  }

  window.runAllEmbedSuites = async function () {
    const t0 = performance.now();
    const table = {};
    let grandPassed = 0;
    let grandTotal = 0;
    let suitesGreen = 0;

    for (const { name, clearConsole } of SUITES) {
      const fn = window[name];
      if (typeof fn !== "function") {
        table[name] = { status: "NOT FOUND", passed: "—", total: "—" };
        continue;
      }
      try {
        const ret = await fn({ clearConsole: !!clearConsole });
        const s = summarise(name, ret);
        table[name] = s;
        if (typeof s.passed === "number") grandPassed += s.passed;
        if (typeof s.total === "number") grandTotal += s.total;
        if (s.status === "PASS") suitesGreen += 1;
      } catch (err) {
        table[name] = { status: "ERROR", passed: "—", total: "—" };
        console.error(`[runAllEmbedSuites] ${name} threw:`, err);
      }
    }

    const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);

    console.log("\n" + "═".repeat(60));
    console.log("📊 CONSOLIDATED EMBED SUITE RESULTS");
    console.log("═".repeat(60));
    console.table(table);
    console.log(
      `Suites green: ${suitesGreen}/${SUITES.length}  |  ` +
        `Assertions: ${grandPassed}/${grandTotal}  |  ${elapsedSec}s`
    );
    console.log("═".repeat(60) + "\n");

    window._embedAllSuitesResults = {
      table,
      suitesGreen,
      suiteCount: SUITES.length,
      grandPassed,
      grandTotal,
      elapsedSec,
    };
    return window._embedAllSuitesResults;
  };

  if (console && console.log) {
    console.log(
      "[runAllEmbedSuites] loaded — run: await window.runAllEmbedSuites()"
    );
  }
})();
