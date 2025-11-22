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

  // Log initialisation
  console.log("✅ OpenRouter Embed Diagnostics loaded");
  console.log("Run: await window.testEmbedDiagnostics()");
  console.log(
    'Or test specific component: await window.testEmbedComponent("client")'
  );
  console.log(
    "Available components: availability, client, request, results, file, notifications, parameters, markdown, integration"
  );
})();
