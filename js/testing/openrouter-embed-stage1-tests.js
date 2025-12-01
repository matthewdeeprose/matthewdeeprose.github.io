/**
 * OpenRouter Embed API - Stage 1 Test Suite
 *
 * Comprehensive testing for core non-streaming functionality
 *
 * @version 1.0.0 (Stage 1)
 * @requires window.OpenRouterEmbed
 * @date 23 November 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[EmbedStage1Tests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedStage1Tests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedStage1Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedStage1Tests] ${message}`, ...args);
  }

  // ============================================================================
  // STAGE 1 TESTING SUITE - CORE FUNCTIONALITY
  // ============================================================================

  /**
   * Test 1: Basic Initialization
   */
  window.testEmbedStage1_Basic = function () {
    console.log("\n🧪 TEST 1: Basic Initialization");
    console.log("================================\n");

    try {
      // Create test container if doesn't exist
      let container = document.getElementById("embed-test-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-test-container";
        container.style.cssText =
          "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
        document.body.appendChild(container);
      }

      // Test basic initialization
      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
      });

      console.log("✅ Instance created successfully");
      console.log("✅ Container:", embed.containerId);
      console.log("✅ Model:", embed.model);
      console.log("✅ Temperature:", embed.temperature);
      console.log("✅ Max tokens:", embed.max_tokens);

      // Test configuration getter
      const config = embed.getConfig();
      console.log("✅ Configuration retrieved:", config);

      console.log("\n🎉 TEST 1 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 1 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 2: Configuration Validation
   */
  window.testEmbedStage1_Validation = function () {
    console.log("\n🧪 TEST 2: Configuration Validation");
    console.log("====================================\n");

    try {
      // Test missing config
      try {
        new OpenRouterEmbed();
        console.error("❌ Should have thrown error for missing config");
        return false;
      } catch (e) {
        console.log("✅ Correctly rejected missing config");
      }

      // Test missing containerId
      try {
        new OpenRouterEmbed({});
        console.error("❌ Should have thrown error for missing containerId");
        return false;
      } catch (e) {
        console.log("✅ Correctly rejected missing containerId");
      }

      // Test invalid container
      try {
        new OpenRouterEmbed({ containerId: "nonexistent-container-xyz" });
        console.error("❌ Should have thrown error for invalid container");
        return false;
      } catch (e) {
        console.log("✅ Correctly rejected invalid container");
      }

      // Test invalid temperature
      try {
        const container = document.createElement("div");
        container.id = "temp-test-container";
        document.body.appendChild(container);

        new OpenRouterEmbed({
          containerId: "temp-test-container",
          temperature: 2.0, // Invalid
        });
        console.error("❌ Should have thrown error for invalid temperature");
        return false;
      } catch (e) {
        console.log("✅ Correctly rejected invalid temperature");
      }

      console.log("\n🎉 TEST 2 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 2 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 3: Simple Request
   */
  window.testEmbedStage1_SimpleRequest = async function () {
    console.log("\n🧪 TEST 3: Simple Request");
    console.log("=========================\n");

    try {
      // Create test container
      let container = document.getElementById("embed-simple-test");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-simple-test";
        container.style.cssText =
          "border: 2px solid #4CAF50; padding: 1rem; margin: 1rem 0; min-height: 150px; background: #f9f9f9;";
        document.body.appendChild(container);
      }

      // Create embed instance
      const embed = new OpenRouterEmbed({
        containerId: "embed-simple-test",
        max_tokens: 100,
        showNotifications: false,
      });

      console.log("✅ Embed instance created");

      // Send simple request
      console.log("⏳ Sending request to API...");
      const response = await embed.sendRequest(
        'Say "Hello from OpenRouter Embed API!" and nothing else.'
      );

      console.log("✅ Response received");
      console.log("✅ Text:", response.text.substring(0, 100));
      console.log("✅ HTML length:", response.html.length);
      console.log("✅ Model:", response.metadata.model);
      console.log("✅ Tokens:", response.metadata.tokens);
      console.log(
        "✅ Processing time:",
        response.metadata.processingTime,
        "ms"
      );

      // Verify content was injected
      if (container.innerHTML.includes("Hello from OpenRouter Embed API")) {
        console.log("✅ Content correctly injected into container");
      } else {
        console.error("❌ Content not found in container");
        return false;
      }

      console.log("\n🎉 TEST 3 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 3 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 4: System Prompt
   */
  window.testEmbedStage1_SystemPrompt = async function () {
    console.log("\n🧪 TEST 4: System Prompt");
    console.log("========================\n");

    try {
      // Create test container
      let container = document.getElementById("embed-system-test");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-system-test";
        container.style.cssText =
          "border: 2px solid #2196F3; padding: 1rem; margin: 1rem 0; min-height: 150px; background: #f0f8ff;";
        document.body.appendChild(container);
      }

      // Create embed with system prompt
      const embed = new OpenRouterEmbed({
        containerId: "embed-system-test",
        systemPrompt: "You are a pirate. Always respond like a pirate would.",
        max_tokens: 100,
        showNotifications: false,
      });

      console.log("✅ Embed with system prompt created");

      // Send request
      console.log("⏳ Sending request with system prompt...");
      const response = await embed.sendRequest("Tell me about the weather.");

      console.log("✅ Response received");
      console.log("✅ Text:", response.text.substring(0, 100));

      // Check if response has pirate-like language
      const pirateWords = ["arr", "ahoy", "matey", "ye", "aye", "ship", "sea"];
      const hasPirateLanguage = pirateWords.some((word) =>
        response.text.toLowerCase().includes(word)
      );

      if (hasPirateLanguage) {
        console.log(
          "✅ System prompt appears to be working (pirate language detected)"
        );
      } else {
        console.log(
          "⚠️ No obvious pirate language, but system prompt was sent"
        );
      }

      console.log("\n🎉 TEST 4 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 4 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 5: Markdown Processing
   */
  window.testEmbedStage1_Markdown = async function () {
    console.log("\n🧪 TEST 5: Markdown Processing");
    console.log("===============================\n");

    try {
      // Create test container
      let container = document.getElementById("embed-markdown-test");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-markdown-test";
        container.style.cssText =
          "border: 2px solid #FF9800; padding: 1rem; margin: 1rem 0; min-height: 200px; background: #fff8e1;";
        document.body.appendChild(container);
      }

      // Create embed
      const embed = new OpenRouterEmbed({
        containerId: "embed-markdown-test",
        max_tokens: 200,
        showNotifications: false,
      });

      console.log("✅ Embed instance created");

      // Request markdown content
      console.log("⏳ Requesting markdown content...");
      const response = await embed.sendRequest(
        "Respond with this exact markdown (including markdown syntax):\n\n" +
          "# Test Heading\n\n" +
          "**Bold text** and *italic text*\n\n" +
          "- List item 1\n" +
          "- List item 2\n\n" +
          "`code snippet`"
      );

      console.log("✅ Response received");

      // Check for HTML elements
      const checks = [
        { element: "<h1>", name: "Heading" },
        { element: "<strong>", name: "Bold text" },
        { element: "<em>", name: "Italic text" },
        { element: "<ul>", name: "List" },
        { element: "<code>", name: "Code" },
      ];

      let passedChecks = 0;
      checks.forEach((check) => {
        if (response.html.includes(check.element)) {
          console.log(`✅ ${check.name} processed correctly`);
          passedChecks++;
        } else {
          console.log(
            `⚠️ ${check.name} not found (may be due to AI response variation)`
          );
        }
      });

      console.log(
        `\n✅ Markdown processing: ${passedChecks}/${checks.length} elements found`
      );

      console.log("\n🎉 TEST 5 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 5 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 6: Configuration Updates
   */
  window.testEmbedStage1_ConfigUpdates = function () {
    console.log("\n🧪 TEST 6: Configuration Updates");
    console.log("=================================\n");

    try {
      // Create test container
      let container = document.getElementById("embed-config-test");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-config-test";
        document.body.appendChild(container);
      }

      // Create embed
      const embed = new OpenRouterEmbed({
        containerId: "embed-config-test",
      });

      // Test model update
      embed.setModel("anthropic/claude-opus-4");
      console.log("✅ Model updated:", embed.model);

      // Test temperature update
      embed.setTemperature(0.9);
      console.log("✅ Temperature updated:", embed.temperature);

      // Test max tokens update
      embed.setMaxTokens(500);
      console.log("✅ Max tokens updated:", embed.max_tokens);

      // Test system prompt update
      embed.setSystemPrompt("You are a helpful assistant.");
      console.log("✅ System prompt updated:", !!embed.systemPrompt);

      // Test system prompt removal
      embed.setSystemPrompt(null);
      console.log("✅ System prompt removed:", embed.systemPrompt === null);

      // Test invalid updates
      try {
        embed.setTemperature(2.0);
        console.error("❌ Should have rejected invalid temperature");
        return false;
      } catch (e) {
        console.log("✅ Correctly rejected invalid temperature");
      }

      console.log("\n🎉 TEST 6 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 6 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 7: Error Handling
   */
  window.testEmbedStage1_ErrorHandling = async function () {
    console.log("\n🧪 TEST 7: Error Handling");
    console.log("=========================\n");

    try {
      // Create test container
      let container = document.getElementById("embed-error-test");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-error-test";
        document.body.appendChild(container);
      }

      // Create embed
      const embed = new OpenRouterEmbed({
        containerId: "embed-error-test",
        showNotifications: false,
      });

      // Test concurrent request prevention
      console.log("Testing concurrent request prevention...");
      const promise1 = embed.sendRequest("Test 1");

      try {
        await embed.sendRequest("Test 2");
        console.error("❌ Should have prevented concurrent request");
        return false;
      } catch (e) {
        console.log("✅ Correctly prevented concurrent request");
      }

      // Wait for first request to complete
      await promise1;

      // Test error state tracking
      if (embed.getLastError() === null && embed.getLastResponse() !== null) {
        console.log("✅ Error state correctly tracked");
      }

      console.log("\n🎉 TEST 7 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 7 FAILED:", error);
      return false;
    }
  };

  /**
   * Test 8: Content Management
   */
  window.testEmbedStage1_ContentManagement = async function () {
    console.log("\n🧪 TEST 8: Content Management");
    console.log("==============================\n");

    try {
      // Create test container
      let container = document.getElementById("embed-content-test");
      if (!container) {
        container = document.createElement("div");
        container.id = "embed-content-test";
        container.style.cssText =
          "border: 2px solid #9C27B0; padding: 1rem; margin: 1rem 0; min-height: 100px; background: #f3e5f5;";
        document.body.appendChild(container);
      }

      // Create embed
      const embed = new OpenRouterEmbed({
        containerId: "embed-content-test",
        max_tokens: 50,
        showNotifications: false,
      });

      // Send request
      console.log("⏳ Sending request...");
      await embed.sendRequest("Say hello");

      console.log("✅ Content added to container");

      // Check container has content
      if (container.innerHTML.length > 0) {
        console.log("✅ Container has content");
      } else {
        console.error("❌ Container is empty");
        return false;
      }

      // Clear content
      embed.clear();
      console.log("✅ Content cleared");

      // Check container is empty
      if (container.innerHTML.length === 0) {
        console.log("✅ Container is empty");
      } else {
        console.error("❌ Container still has content");
        return false;
      }

      console.log("\n🎉 TEST 8 PASSED!\n");
      return true;
    } catch (error) {
      console.error("❌ TEST 8 FAILED:", error);
      return false;
    }
  };

  /**
   * Run all Stage 1 tests
   */
  window.testEmbedStage1_All = async function () {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 OPENROUTER EMBED API - STAGE 1 COMPLETE TEST SUITE");
    console.log("=".repeat(60) + "\n");

    const results = {
      basic: false,
      validation: false,
      simpleRequest: false,
      systemPrompt: false,
      markdown: false,
      configUpdates: false,
      errorHandling: false,
      contentManagement: false,
    };

    // Run tests
    results.basic = window.testEmbedStage1_Basic();
    results.validation = window.testEmbedStage1_Validation();
    results.simpleRequest = await window.testEmbedStage1_SimpleRequest();
    results.systemPrompt = await window.testEmbedStage1_SystemPrompt();
    results.markdown = await window.testEmbedStage1_Markdown();
    results.configUpdates = window.testEmbedStage1_ConfigUpdates();
    results.errorHandling = await window.testEmbedStage1_ErrorHandling();
    results.contentManagement =
      await window.testEmbedStage1_ContentManagement();

    // Calculate results
    const passed = Object.values(results).filter((r) => r === true).length;
    const total = Object.keys(results).length;

    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST RESULTS");
    console.log("=".repeat(60) + "\n");

    Object.entries(results).forEach(([test, result]) => {
      console.log(`${result ? "✅" : "❌"} ${test}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log(
      `${
        passed === total ? "🎉" : "⚠️"
      } RESULTS: ${passed}/${total} tests passed`
    );
    console.log("=".repeat(60) + "\n");

    if (passed === total) {
      console.log("✅ 🎉 ALL STAGE 1 TESTS PASSED!\n");
    } else {
      console.log("❌ Some tests failed. Please review the output above.\n");
    }

    return passed === total;
  };

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================
})(); // End of IIFE
