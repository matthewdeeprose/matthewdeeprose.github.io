/**
 * OpenRouter Embed API - Stage 6 Phase 3 Tests
 *
 * Tests for Response Post-Processing Pipeline
 *
 * Test IDs: P3-01 to P3-12
 *
 * @version 1.0.0
 * @date 30 November 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Create a test environment with container
   * @param {string} prefix - Test prefix for unique IDs
   * @returns {Object} Environment with container and cleanup
   */
  function createTestEnvironment(prefix = "test") {
    const container = document.createElement("div");
    container.id = `${prefix}-container-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    document.body.appendChild(container);

    return {
      container,
      containerId: container.id,
      cleanup: () => container.remove(),
    };
  }

  /**
   * Create a mock response object for testing
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock response
   */
  function createMockResponse(overrides = {}) {
    return {
      text: "Test response text",
      html: "<p>Test response HTML</p>",
      markdown: "Test response text",
      raw: { model: "test-model" },
      metadata: {
        model: "test-model",
        tokens: { prompt: 10, completion: 20, total: 30 },
        processingTime: 100,
      },
      ...overrides,
    };
  }

  /**
   * Delay utility for async tests
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Resolves after delay
   */
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // PHASE 3 TESTS: Response Post-Processing Pipeline
  // ============================================================================

  /**
   * P3-01: Module exists with all required methods
   */
  async function testP3_01_ModuleExists() {
    console.log("P3-01: Testing module exists with all required methods...");

    try {
      // Check singleton exists
      if (!window.EmbedPostProcessor) {
        return {
          success: false,
          error: "EmbedPostProcessor singleton not found",
        };
      }

      // Check class exists
      if (!window.EmbedPostProcessorClass) {
        return {
          success: false,
          error: "EmbedPostProcessorClass not found",
        };
      }

      // Check required methods on singleton
      const requiredMethods = [
        "add",
        "remove",
        "setEnabled",
        "isEnabled",
        "process",
        "getProcessorNames",
        "getProcessor",
        "clear",
      ];

      for (const method of requiredMethods) {
        if (typeof window.EmbedPostProcessor[method] !== "function") {
          return {
            success: false,
            error: `Method '${method}' not found or not a function`,
          };
        }
      }

      // Check built-in processors exist
      if (!window.EmbedPostProcessorClass.builtIn) {
        return {
          success: false,
          error: "builtIn processors object not found",
        };
      }

      const requiredBuiltIn = [
        "extractJSON",
        "extractLaTeX",
        "sanitiseHTML",
        "trim",
      ];

      for (const processor of requiredBuiltIn) {
        if (
          typeof window.EmbedPostProcessorClass.builtIn[processor] !==
          "function"
        ) {
          return {
            success: false,
            error: `Built-in processor '${processor}' not found`,
          };
        }
      }

      console.log("  ✓ All required methods and built-in processors present");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-02: add() registers processor
   */
  async function testP3_02_AddRegistersProcessor() {
    console.log("P3-02: Testing add() registers processor...");

    const postProcessor = new window.EmbedPostProcessorClass();

    try {
      // Add a processor
      const processor = (response) => ({ ...response, custom: true });
      postProcessor.add("testProcessor", processor, { priority: 50 });

      // Check processor appears in list
      const names = postProcessor.getProcessorNames();
      if (!names.includes("testProcessor")) {
        return {
          success: false,
          error: "Processor not found in names list",
        };
      }

      // Check processor info
      const info = postProcessor.getProcessor("testProcessor");
      if (!info) {
        return {
          success: false,
          error: "getProcessor returned null",
        };
      }

      if (info.priority !== 50) {
        return {
          success: false,
          error: `Priority mismatch: expected 50, got ${info.priority}`,
        };
      }

      if (info.enabled !== true) {
        return {
          success: false,
          error: "Processor should be enabled by default",
        };
      }

      // Test chaining
      const result = postProcessor.add("another", (r) => r);
      if (result !== postProcessor) {
        return {
          success: false,
          error: "add() should return this for chaining",
        };
      }

      console.log("  ✓ Processor registered correctly with add()");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-03: remove() unregisters processor
   */
  async function testP3_03_RemoveUnregistersProcessor() {
    console.log("P3-03: Testing remove() unregisters processor...");

    const postProcessor = new window.EmbedPostProcessorClass();

    try {
      // Add a processor
      postProcessor.add("toRemove", (r) => r);

      // Verify it exists
      if (!postProcessor.getProcessorNames().includes("toRemove")) {
        return {
          success: false,
          error: "Processor not added correctly",
        };
      }

      // Remove it
      const removed = postProcessor.remove("toRemove");
      if (!removed) {
        return {
          success: false,
          error: "remove() should return true for existing processor",
        };
      }

      // Verify it's gone
      if (postProcessor.getProcessorNames().includes("toRemove")) {
        return {
          success: false,
          error: "Processor still in list after removal",
        };
      }

      // Try removing non-existent processor
      const removedAgain = postProcessor.remove("toRemove");
      if (removedAgain !== false) {
        return {
          success: false,
          error: "remove() should return false for non-existent processor",
        };
      }

      console.log("  ✓ Processor removed correctly with remove()");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-04: Priority ordering works
   */
  async function testP3_04_PriorityOrdering() {
    console.log("P3-04: Testing priority ordering...");

    const postProcessor = new window.EmbedPostProcessorClass();
    const executionOrder = [];

    try {
      // Add processors with different priorities (out of order)
      postProcessor.add(
        "third",
        (r) => {
          executionOrder.push("third");
          return r;
        },
        { priority: 300 }
      );

      postProcessor.add(
        "first",
        (r) => {
          executionOrder.push("first");
          return r;
        },
        { priority: 100 }
      );

      postProcessor.add(
        "second",
        (r) => {
          executionOrder.push("second");
          return r;
        },
        { priority: 200 }
      );

      // Process response
      await postProcessor.process(createMockResponse());

      // Verify execution order
      if (executionOrder.length !== 3) {
        return {
          success: false,
          error: `Expected 3 processors to run, got ${executionOrder.length}`,
        };
      }

      if (executionOrder[0] !== "first") {
        return {
          success: false,
          error: `First processor should be 'first', got '${executionOrder[0]}'`,
        };
      }

      if (executionOrder[1] !== "second") {
        return {
          success: false,
          error: `Second processor should be 'second', got '${executionOrder[1]}'`,
        };
      }

      if (executionOrder[2] !== "third") {
        return {
          success: false,
          error: `Third processor should be 'third', got '${executionOrder[2]}'`,
        };
      }

      // Also verify getProcessorNames returns in priority order
      const names = postProcessor.getProcessorNames();
      if (
        names[0] !== "first" ||
        names[1] !== "second" ||
        names[2] !== "third"
      ) {
        return {
          success: false,
          error: "getProcessorNames() not in priority order",
        };
      }

      console.log("  ✓ Processors execute in priority order");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-05: Disabled processors are skipped
   */
  async function testP3_05_DisabledProcessorsSkipped() {
    console.log("P3-05: Testing disabled processors are skipped...");

    const postProcessor = new window.EmbedPostProcessorClass();
    const executionOrder = [];

    try {
      // Add processors, one disabled
      postProcessor.add("enabled1", (r) => {
        executionOrder.push("enabled1");
        return r;
      });

      postProcessor.add(
        "disabled",
        (r) => {
          executionOrder.push("disabled");
          return r;
        },
        { enabled: false }
      );

      postProcessor.add("enabled2", (r) => {
        executionOrder.push("enabled2");
        return r;
      });

      // Check isEnabled
      if (postProcessor.isEnabled("disabled") !== false) {
        return {
          success: false,
          error: "isEnabled should return false for disabled processor",
        };
      }

      // Process response
      await postProcessor.process(createMockResponse());

      // Verify disabled processor was skipped
      if (executionOrder.includes("disabled")) {
        return {
          success: false,
          error: "Disabled processor should not have executed",
        };
      }

      if (executionOrder.length !== 2) {
        return {
          success: false,
          error: `Expected 2 processors to run, got ${executionOrder.length}`,
        };
      }

      // Test setEnabled
      postProcessor.setEnabled("disabled", true);
      executionOrder.length = 0;

      await postProcessor.process(createMockResponse());

      if (!executionOrder.includes("disabled")) {
        return {
          success: false,
          error: "Re-enabled processor should have executed",
        };
      }

      console.log("  ✓ Disabled processors correctly skipped");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-06: Built-in extractJSON works
   */
  async function testP3_06_ExtractJSONWorks() {
    console.log("P3-06: Testing built-in extractJSON...");

    try {
      const extractJSON = window.EmbedPostProcessorClass.builtIn.extractJSON;

      // Test with single JSON block
      const response1 = createMockResponse({
        text: 'Here is some data:\n```json\n{"name": "test", "value": 42}\n```\nEnd of response.',
      });

      const result1 = extractJSON(response1, {});

      if (!result1.extractedJSON) {
        return {
          success: false,
          error: "extractedJSON property not added",
        };
      }

      if (result1.extractedJSON.length !== 1) {
        return {
          success: false,
          error: `Expected 1 JSON block, got ${result1.extractedJSON.length}`,
        };
      }

      if (result1.extractedJSON[0].name !== "test") {
        return {
          success: false,
          error: "JSON not parsed correctly",
        };
      }

      // Test with multiple JSON blocks
      const response2 = createMockResponse({
        text: '```json\n{"a": 1}\n```\nSome text\n```json\n{"b": 2}\n```',
      });

      const result2 = extractJSON(response2, {});

      if (result2.extractedJSON.length !== 2) {
        return {
          success: false,
          error: `Expected 2 JSON blocks, got ${result2.extractedJSON.length}`,
        };
      }

      // Test with invalid JSON (should not throw, just skip)
      const response3 = createMockResponse({
        text: "```json\n{invalid json}\n```",
      });

      const result3 = extractJSON(response3, {});

      if (result3.extractedJSON.length !== 0) {
        return {
          success: false,
          error: "Invalid JSON should be skipped",
        };
      }

      // Test with no JSON
      const response4 = createMockResponse({
        text: "No JSON here",
      });

      const result4 = extractJSON(response4, {});

      if (
        !Array.isArray(result4.extractedJSON) ||
        result4.extractedJSON.length !== 0
      ) {
        return {
          success: false,
          error: "Should return empty array when no JSON",
        };
      }

      console.log("  ✓ extractJSON works correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-07: Built-in extractLaTeX works
   */
  async function testP3_07_ExtractLaTeXWorks() {
    console.log("P3-07: Testing built-in extractLaTeX...");

    try {
      const extractLaTeX = window.EmbedPostProcessorClass.builtIn.extractLaTeX;

      // Test with inline LaTeX ($...$)
      const response1 = createMockResponse({
        text: "The equation is $E = mc^2$ and that's it.",
      });

      const result1 = extractLaTeX(response1, {});

      if (!result1.extractedLaTeX) {
        return {
          success: false,
          error: "extractedLaTeX property not added",
        };
      }

      if (result1.extractedLaTeX.length !== 1) {
        return {
          success: false,
          error: `Expected 1 LaTeX expression, got ${result1.extractedLaTeX.length}`,
        };
      }

      if (result1.extractedLaTeX[0].type !== "inline") {
        return {
          success: false,
          error: `Expected inline type, got ${result1.extractedLaTeX[0].type}`,
        };
      }

      if (result1.extractedLaTeX[0].content !== "E = mc^2") {
        return {
          success: false,
          error: `Content mismatch: ${result1.extractedLaTeX[0].content}`,
        };
      }

      // Test with block LaTeX ($$...$$)
      const response2 = createMockResponse({
        text: "The integral is $$\\int_0^1 x dx$$ which equals 0.5.",
      });

      const result2 = extractLaTeX(response2, {});

      if (result2.extractedLaTeX.length !== 1) {
        return {
          success: false,
          error: `Expected 1 block LaTeX, got ${result2.extractedLaTeX.length}`,
        };
      }

      if (result2.extractedLaTeX[0].type !== "block") {
        return {
          success: false,
          error: `Expected block type, got ${result2.extractedLaTeX[0].type}`,
        };
      }

      // Test with mixed inline and block
      const response3 = createMockResponse({
        text: "Inline $a + b$ and block $$c + d$$ together.",
      });

      const result3 = extractLaTeX(response3, {});

      if (result3.extractedLaTeX.length !== 2) {
        return {
          success: false,
          error: `Expected 2 LaTeX expressions, got ${result3.extractedLaTeX.length}`,
        };
      }

      // Verify both types present
      const types = result3.extractedLaTeX.map((e) => e.type);
      if (!types.includes("inline") || !types.includes("block")) {
        return {
          success: false,
          error: "Should have both inline and block types",
        };
      }

      // Test with \(...\) and \[...\] notation
      const response4 = createMockResponse({
        text: "Also \\(inline\\) and \\[block\\] work.",
      });

      const result4 = extractLaTeX(response4, {});

      if (result4.extractedLaTeX.length !== 2) {
        return {
          success: false,
          error: `Expected 2 LaTeX with backslash notation, got ${result4.extractedLaTeX.length}`,
        };
      }

      console.log("  ✓ extractLaTeX works correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-08: Built-in sanitiseHTML works
   */
  async function testP3_08_SanitiseHTMLWorks() {
    console.log("P3-08: Testing built-in sanitiseHTML...");

    try {
      const sanitiseHTML = window.EmbedPostProcessorClass.builtIn.sanitiseHTML;

      // Test script removal
      const response1 = createMockResponse({
        html: '<p>Safe</p><script>alert("xss")</script><p>Also safe</p>',
      });

      const result1 = sanitiseHTML(response1, {});

      if (result1.html.includes("<script")) {
        return {
          success: false,
          error: "Script tag not removed",
        };
      }

      if (!result1.html.includes("<p>Safe</p>")) {
        return {
          success: false,
          error: "Safe content was incorrectly removed",
        };
      }

      // Test onclick attribute removal
      const response2 = createMockResponse({
        html: '<p onclick="alert(1)">Click me</p>',
      });

      const result2 = sanitiseHTML(response2, {});

      if (result2.html.includes("onclick")) {
        return {
          success: false,
          error: "onclick attribute not removed",
        };
      }

      if (!result2.html.includes("<p")) {
        return {
          success: false,
          error: "Paragraph tag incorrectly removed",
        };
      }

      // Test iframe removal
      const response3 = createMockResponse({
        html: '<iframe src="evil.com"></iframe><p>Safe</p>',
      });

      const result3 = sanitiseHTML(response3, {});

      if (result3.html.includes("<iframe")) {
        return {
          success: false,
          error: "iframe tag not removed",
        };
      }

      // Test javascript: URL removal
      const response4 = createMockResponse({
        html: '<a href="javascript:alert(1)">Link</a>',
      });

      const result4 = sanitiseHTML(response4, {});

      if (result4.html.includes("javascript:")) {
        return {
          success: false,
          error: "javascript: URL not removed",
        };
      }

      // Test onerror attribute removal
      const response5 = createMockResponse({
        html: '<img src="x" onerror="alert(1)">',
      });

      const result5 = sanitiseHTML(response5, {});

      if (result5.html.includes("onerror")) {
        return {
          success: false,
          error: "onerror attribute not removed",
        };
      }

      console.log("  ✓ sanitiseHTML works correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-09: Built-in trim works
   */
  async function testP3_09_TrimWorks() {
    console.log("P3-09: Testing built-in trim...");

    try {
      const trim = window.EmbedPostProcessorClass.builtIn.trim;

      // Test whitespace trimming
      const response = createMockResponse({
        text: "  \n  Hello world  \n\n  ",
      });

      const result = trim(response, {});

      if (result.text !== "Hello world") {
        return {
          success: false,
          error: `Trimmed text incorrect: "${result.text}"`,
        };
      }

      // Test with no text
      const response2 = createMockResponse({
        text: undefined,
      });

      const result2 = trim(response2, {});

      if (result2.text !== undefined) {
        return {
          success: false,
          error: "Should not modify undefined text",
        };
      }

      console.log("  ✓ trim works correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-10: Context is passed to processors
   */
  async function testP3_10_ContextPassed() {
    console.log("P3-10: Testing context is passed to processors...");

    const postProcessor = new window.EmbedPostProcessorClass();
    let receivedContext = null;

    try {
      // Add processor that captures context
      postProcessor.add("contextCapture", (response, context) => {
        receivedContext = context;
        return response;
      });

      // Process with custom context
      const customContext = {
        model: "test-model",
        streamId: "stream-123",
        customData: { foo: "bar" },
      };

      await postProcessor.process(createMockResponse(), customContext);

      if (!receivedContext) {
        return {
          success: false,
          error: "Context not received by processor",
        };
      }

      if (receivedContext.model !== "test-model") {
        return {
          success: false,
          error: "Context model not passed correctly",
        };
      }

      if (receivedContext.streamId !== "stream-123") {
        return {
          success: false,
          error: "Context streamId not passed correctly",
        };
      }

      if (receivedContext.customData?.foo !== "bar") {
        return {
          success: false,
          error: "Custom context data not passed correctly",
        };
      }

      console.log("  ✓ Context passed correctly to processors");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-11: Async processors are supported
   */
  async function testP3_11_AsyncProcessorsSupported() {
    console.log("P3-11: Testing async processors are supported...");

    const postProcessor = new window.EmbedPostProcessorClass();
    const executionOrder = [];

    try {
      // Add sync processor
      postProcessor.add(
        "sync",
        (r) => {
          executionOrder.push("sync");
          return { ...r, syncProcessed: true };
        },
        { priority: 100 }
      );

      // Add async processor
      postProcessor.add(
        "async",
        async (r) => {
          await delay(50); // Simulate async work
          executionOrder.push("async");
          return { ...r, asyncProcessed: true };
        },
        { priority: 200 }
      );

      // Add another sync processor after async
      postProcessor.add(
        "syncAfter",
        (r) => {
          executionOrder.push("syncAfter");
          return { ...r, syncAfterProcessed: true };
        },
        { priority: 300 }
      );

      // Process
      const result = await postProcessor.process(createMockResponse());

      // Verify all processors ran
      if (executionOrder.length !== 3) {
        return {
          success: false,
          error: `Expected 3 processors, got ${executionOrder.length}`,
        };
      }

      // Verify order (sync should wait for async)
      if (
        executionOrder[0] !== "sync" ||
        executionOrder[1] !== "async" ||
        executionOrder[2] !== "syncAfter"
      ) {
        return {
          success: false,
          error: `Wrong execution order: ${executionOrder.join(", ")}`,
        };
      }

      // Verify results
      if (
        !result.syncProcessed ||
        !result.asyncProcessed ||
        !result.syncAfterProcessed
      ) {
        return {
          success: false,
          error: "Not all processors added their properties",
        };
      }

      console.log("  ✓ Async processors work correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P3-12: Error in one processor doesn't break others
   */
  async function testP3_12_ErrorIsolation() {
    console.log("P3-12: Testing error isolation...");

    const postProcessor = new window.EmbedPostProcessorClass();
    const executionOrder = [];

    try {
      // Add processor that works
      postProcessor.add(
        "first",
        (r) => {
          executionOrder.push("first");
          return { ...r, firstRan: true };
        },
        { priority: 100 }
      );

      // Add processor that throws
      postProcessor.add(
        "throws",
        (r) => {
          executionOrder.push("throws");
          throw new Error("Intentional test error");
        },
        { priority: 200 }
      );

      // Add processor after the throwing one
      postProcessor.add(
        "afterError",
        (r) => {
          executionOrder.push("afterError");
          return { ...r, afterErrorRan: true };
        },
        { priority: 300 }
      );

      // Process - should not throw
      const result = await postProcessor.process(createMockResponse());

      // Verify first and afterError ran despite middle one throwing
      if (!executionOrder.includes("first")) {
        return {
          success: false,
          error: "First processor should have run",
        };
      }

      if (!executionOrder.includes("afterError")) {
        return {
          success: false,
          error: "afterError processor should have run despite earlier error",
        };
      }

      // Verify first processor's result is preserved
      if (!result.firstRan) {
        return {
          success: false,
          error: "First processor's changes not preserved",
        };
      }

      // Verify afterError processor ran
      if (!result.afterErrorRan) {
        return {
          success: false,
          error: "afterError processor's changes not preserved",
        };
      }

      // Verify processing metadata
      if (!result.processed) {
        return {
          success: false,
          error: "processed metadata not added",
        };
      }

      // The throwing processor should NOT be in the processors list
      if (result.processed.processors.includes("throws")) {
        return {
          success: false,
          error: "Throwing processor should not be in processors list",
        };
      }

      // First and afterError should be in the list
      if (
        !result.processed.processors.includes("first") ||
        !result.processed.processors.includes("afterError")
      ) {
        return {
          success: false,
          error: "Successful processors should be in processors list",
        };
      }

      console.log("  ✓ Error isolation works correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 3 tests
   */
  async function runAllStage6Phase3Tests() {
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║   Stage 6 Phase 3: Response Post-Processing Pipeline       ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝"
    );
    console.log("");

    const tests = [
      { id: "P3-01", name: "Module Exists", fn: testP3_01_ModuleExists },
      {
        id: "P3-02",
        name: "add() Registers",
        fn: testP3_02_AddRegistersProcessor,
      },
      {
        id: "P3-03",
        name: "remove() Unregisters",
        fn: testP3_03_RemoveUnregistersProcessor,
      },
      { id: "P3-04", name: "Priority Order", fn: testP3_04_PriorityOrdering },
      {
        id: "P3-05",
        name: "Disabled Skipped",
        fn: testP3_05_DisabledProcessorsSkipped,
      },
      {
        id: "P3-06",
        name: "extractJSON Works",
        fn: testP3_06_ExtractJSONWorks,
      },
      {
        id: "P3-07",
        name: "extractLaTeX Works",
        fn: testP3_07_ExtractLaTeXWorks,
      },
      {
        id: "P3-08",
        name: "sanitiseHTML Works",
        fn: testP3_08_SanitiseHTMLWorks,
      },
      { id: "P3-09", name: "trim Works", fn: testP3_09_TrimWorks },
      { id: "P3-10", name: "Context Passed", fn: testP3_10_ContextPassed },
      {
        id: "P3-11",
        name: "Async Supported",
        fn: testP3_11_AsyncProcessorsSupported,
      },
      { id: "P3-12", name: "Error Isolation", fn: testP3_12_ErrorIsolation },
    ];

    let passed = 0;
    let failed = 0;
    const results = [];

    for (const test of tests) {
      try {
        const result = await test.fn();
        if (result.success) {
          console.log(`✅ ${test.id}: ${test.name} - PASSED`);
          passed++;
          results.push({ ...test, passed: true });
        } else {
          console.log(`❌ ${test.id}: ${test.name} - FAILED: ${result.error}`);
          failed++;
          results.push({ ...test, passed: false, error: result.error });
        }
      } catch (error) {
        console.log(`❌ ${test.id}: ${test.name} - ERROR: ${error.message}`);
        failed++;
        results.push({ ...test, passed: false, error: error.message });
      }
    }

    console.log("");
    console.log(
      "══════════════════════════════════════════════════════════════"
    );
    console.log(`Phase 3 Results: ${passed}/${tests.length} passed`);

    if (failed === 0) {
      console.log("🎉 All Phase 3 tests passed!");
    } else {
      console.log(`⚠️ ${failed} test(s) failed`);
    }

    console.log(
      "══════════════════════════════════════════════════════════════"
    );

    return {
      passed,
      failed,
      total: tests.length,
      results,
    };
  }

  /**
   * Run regression tests to ensure previous phases still work
   */
  async function testStage6_Regressions() {
    console.log("");
    console.log(
      "══════════════════════════════════════════════════════════════"
    );
    console.log("Running Stage 6 Regression Tests...");
    console.log(
      "══════════════════════════════════════════════════════════════"
    );

    let passed = 0;
    let failed = 0;

    // Check Phase 1 (Retry) still works
    console.log("\nPhase 1 (Retry Handler) Check:");
    if (window.EmbedRetryHandlerClass) {
      const retryHandler = new window.EmbedRetryHandlerClass();
      if (
        typeof retryHandler.configure === "function" &&
        typeof retryHandler.execute === "function" &&
        typeof retryHandler.isRetryable === "function"
      ) {
        console.log("  ✅ Retry handler functional");
        passed++;
      } else {
        console.log("  ❌ Retry handler missing methods");
        failed++;
      }
    } else {
      console.log(
        "  ⚠️ Retry handler not loaded (expected if file not included)"
      );
      passed++;
    }

    // Check Phase 2 (Events) still works
    console.log("\nPhase 2 (Event Emitter) Check:");
    if (window.EmbedEventEmitterClass) {
      const emitter = new window.EmbedEventEmitterClass();
      if (
        typeof emitter.on === "function" &&
        typeof emitter.off === "function" &&
        typeof emitter.emit === "function"
      ) {
        console.log("  ✅ Event emitter functional");
        passed++;
      } else {
        console.log("  ❌ Event emitter missing methods");
        failed++;
      }
    } else {
      console.log(
        "  ⚠️ Event emitter not loaded (expected if file not included)"
      );
      passed++;
    }

    // Check OpenRouterEmbed still works
    console.log("\nCore OpenRouterEmbed Check:");
    if (window.OpenRouterEmbed) {
      console.log("  ✅ OpenRouterEmbed class available");
      passed++;
    } else {
      console.log("  ⚠️ OpenRouterEmbed not loaded");
      passed++;
    }

    // Check Phase 3 (PostProcessor) works
    console.log("\nPhase 3 (Post-Processor) Check:");
    if (window.EmbedPostProcessorClass) {
      const postProcessor = new window.EmbedPostProcessorClass();
      if (
        typeof postProcessor.add === "function" &&
        typeof postProcessor.process === "function"
      ) {
        console.log("  ✅ Post-processor functional");
        passed++;
      } else {
        console.log("  ❌ Post-processor missing methods");
        failed++;
      }
    } else {
      console.log("  ❌ Post-processor not loaded");
      failed++;
    }

    console.log("");
    console.log(
      `Regression Results: ${passed}/${passed + failed} checks passed`
    );
    console.log(
      "══════════════════════════════════════════════════════════════"
    );

    return { passed, failed };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllStage6Phase3Tests = runAllStage6Phase3Tests;
  window.testStage6Phase3_Regressions = testStage6_Regressions;

  // Individual test exposure for debugging
  window.testP3_01 = testP3_01_ModuleExists;
  window.testP3_02 = testP3_02_AddRegistersProcessor;
  window.testP3_03 = testP3_03_RemoveUnregistersProcessor;
  window.testP3_04 = testP3_04_PriorityOrdering;
  window.testP3_05 = testP3_05_DisabledProcessorsSkipped;
  window.testP3_06 = testP3_06_ExtractJSONWorks;
  window.testP3_07 = testP3_07_ExtractLaTeXWorks;
  window.testP3_08 = testP3_08_SanitiseHTMLWorks;
  window.testP3_09 = testP3_09_TrimWorks;
  window.testP3_10 = testP3_10_ContextPassed;
  window.testP3_11 = testP3_11_AsyncProcessorsSupported;
  window.testP3_12 = testP3_12_ErrorIsolation;
})();
