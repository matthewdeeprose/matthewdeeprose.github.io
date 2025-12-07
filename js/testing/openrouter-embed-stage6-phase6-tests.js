/**
 * OpenRouter Embed API - Stage 6 Phase 6 Tests
 * Request Preprocessing Pipeline Tests
 *
 * Tests for EmbedPreProcessor module with 8 acceptance criteria.
 *
 * @version 1.1.0
 * @date 01 December 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  const testResults = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function logTest(id, description, passed, details = "") {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    const message = `${status} [${id}] ${description}`;

    if (passed) {
      console.log(message);
      testResults.passed++;
    } else {
      console.error(message);
      if (details) {
        console.error(`   Details: ${details}`);
      }
      testResults.failed++;
    }

    testResults.tests.push({ id, description, passed, details });
  }

  function logSection(title) {
    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log(` ${title}`);
    console.log("═══════════════════════════════════════════════════════");
  }

  function summariseResults() {
    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log(" PHASE 6 TEST SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    console.log(` Passed: ${testResults.passed}`);
    console.log(` Failed: ${testResults.failed}`);
    console.log(` Total:  ${testResults.passed + testResults.failed}`);
    console.log("");

    if (testResults.failed === 0) {
      console.log(" 🎉 ALL PHASE 6 TESTS PASSED!");
    } else {
      console.log(" ⚠️  Some tests failed - review errors above");
    }

    return testResults;
  }

  // ============================================================================
  // P6-01: Module Existence
  // ============================================================================

  function testP6_01_ModuleExists() {
    logSection("P6-01: Module Existence");

    // Test singleton instance exists
    const singletonExists = !!window.EmbedPreProcessor;
    logTest(
      "P6-01a",
      "Singleton instance (window.EmbedPreProcessor) exists",
      singletonExists
    );

    // Test class exists
    const classExists = !!window.EmbedPreProcessorClass;
    logTest(
      "P6-01b",
      "Class (window.EmbedPreProcessorClass) exists",
      classExists
    );

    // Test required methods exist on singleton
    const requiredMethods = [
      "add",
      "remove",
      "setEnabled",
      "process",
      "getProcessorNames",
      "clear",
    ];
    let allMethodsExist = true;
    const missingMethods = [];

    for (const method of requiredMethods) {
      if (typeof window.EmbedPreProcessor?.[method] !== "function") {
        allMethodsExist = false;
        missingMethods.push(method);
      }
    }

    logTest(
      "P6-01c",
      "All required methods exist",
      allMethodsExist,
      missingMethods.length > 0 ? `Missing: ${missingMethods.join(", ")}` : ""
    );

    // Test built-in processors exist
    const builtInExists = !!window.EmbedPreProcessorClass?.builtIn;
    logTest("P6-01d", "Built-in processors object exists", builtInExists);

    const requiredBuiltIns = ["sanitiseInput", "addTimestamp", "trim"];
    let allBuiltInsExist = true;
    const missingBuiltIns = [];

    for (const name of requiredBuiltIns) {
      if (
        typeof window.EmbedPreProcessorClass?.builtIn?.[name] !== "function"
      ) {
        allBuiltInsExist = false;
        missingBuiltIns.push(name);
      }
    }

    logTest(
      "P6-01e",
      "Required built-in processors exist",
      allBuiltInsExist,
      missingBuiltIns.length > 0 ? `Missing: ${missingBuiltIns.join(", ")}` : ""
    );

    return (
      singletonExists &&
      classExists &&
      allMethodsExist &&
      builtInExists &&
      allBuiltInsExist
    );
  }

  // ============================================================================
  // P6-02: add() Registers Processor
  // ============================================================================

  function testP6_02_AddRegistersProcessor() {
    logSection("P6-02: add() Registers Processor");

    // Create fresh instance for testing
    const preProcessor = new window.EmbedPreProcessorClass();

    // Test basic add
    const testProcessor = (req) => req;
    const result = preProcessor.add("testProcessor", testProcessor);

    const addReturnsThis = result === preProcessor;
    logTest("P6-02a", "add() returns this for chaining", addReturnsThis);

    const processorRegistered = preProcessor
      .getProcessorNames()
      .includes("testProcessor");
    logTest(
      "P6-02b",
      "Processor is registered after add()",
      processorRegistered
    );

    // Test add with options
    preProcessor.add("priorityProcessor", testProcessor, {
      priority: 5,
      enabled: false,
    });
    const info = preProcessor.getProcessor("priorityProcessor");

    const prioritySet = info?.priority === 5;
    logTest("P6-02c", "Priority option is respected", prioritySet);

    const enabledSet = info?.enabled === false;
    logTest("P6-02d", "Enabled option is respected", enabledSet);

    // Test add with invalid name throws
    let invalidNameThrows = false;
    try {
      preProcessor.add("", testProcessor);
    } catch (e) {
      invalidNameThrows = true;
    }
    logTest("P6-02e", "add() throws for empty name", invalidNameThrows);

    // Test add with invalid processor throws
    let invalidProcessorThrows = false;
    try {
      preProcessor.add("invalid", "not a function");
    } catch (e) {
      invalidProcessorThrows = true;
    }
    logTest(
      "P6-02f",
      "add() throws for non-function processor",
      invalidProcessorThrows
    );

    return (
      addReturnsThis &&
      processorRegistered &&
      prioritySet &&
      enabledSet &&
      invalidNameThrows &&
      invalidProcessorThrows
    );
  }

  // ============================================================================
  // P6-03: remove() Unregisters Processor
  // ============================================================================

  function testP6_03_RemoveUnregistersProcessor() {
    logSection("P6-03: remove() Unregisters Processor");

    const preProcessor = new window.EmbedPreProcessorClass();

    // Add then remove
    preProcessor.add("toRemove", (req) => req);
    const existsBefore = preProcessor.getProcessorNames().includes("toRemove");
    logTest("P6-03a", "Processor exists before removal", existsBefore);

    const removeResult = preProcessor.remove("toRemove");
    logTest(
      "P6-03b",
      "remove() returns true for existing processor",
      removeResult === true
    );

    const existsAfter = preProcessor.getProcessorNames().includes("toRemove");
    logTest("P6-03c", "Processor does not exist after removal", !existsAfter);

    // Test removing non-existent processor
    const removeNonExistent = preProcessor.remove("nonExistent");
    logTest(
      "P6-03d",
      "remove() returns false for non-existent processor",
      removeNonExistent === false
    );

    // Test removing with invalid name
    const removeInvalid = preProcessor.remove("");
    logTest(
      "P6-03e",
      "remove() returns false for invalid name",
      removeInvalid === false
    );

    return (
      existsBefore &&
      removeResult &&
      !existsAfter &&
      !removeNonExistent &&
      !removeInvalid
    );
  }

  // ============================================================================
  // P6-04: process() Calls Processors in Priority Order
  // ============================================================================

  async function testP6_04_ProcessPriorityOrder() {
    logSection("P6-04: process() Calls Processors in Priority Order");

    const preProcessor = new window.EmbedPreProcessorClass();
    const callOrder = [];

    // Add processors with different priorities
    preProcessor.add(
      "third",
      (req) => {
        callOrder.push("third");
        return req;
      },
      { priority: 300 }
    );

    preProcessor.add(
      "first",
      (req) => {
        callOrder.push("first");
        return req;
      },
      { priority: 100 }
    );

    preProcessor.add(
      "second",
      (req) => {
        callOrder.push("second");
        return req;
      },
      { priority: 200 }
    );

    // Process
    await preProcessor.process({ userPrompt: "test" });

    const correctOrder =
      callOrder[0] === "first" &&
      callOrder[1] === "second" &&
      callOrder[2] === "third";
    logTest(
      "P6-04a",
      "Processors called in priority order (lower first)",
      correctOrder,
      `Order: ${callOrder.join(" → ")}`
    );

    // Test getProcessorNames returns sorted order
    const names = preProcessor.getProcessorNames();
    const namesCorrectOrder =
      names[0] === "first" && names[1] === "second" && names[2] === "third";
    logTest(
      "P6-04b",
      "getProcessorNames() returns processors in priority order",
      namesCorrectOrder
    );

    return correctOrder && namesCorrectOrder;
  }

  // ============================================================================
  // P6-05: Disabled Processors Are Skipped
  // ============================================================================

  async function testP6_05_DisabledProcessorsSkipped() {
    logSection("P6-05: Disabled Processors Are Skipped");

    const preProcessor = new window.EmbedPreProcessorClass();
    const callOrder = [];

    preProcessor.add("enabled1", (req) => {
      callOrder.push("enabled1");
      return req;
    });

    preProcessor.add(
      "disabled",
      (req) => {
        callOrder.push("disabled");
        return req;
      },
      { enabled: false }
    );

    preProcessor.add("enabled2", (req) => {
      callOrder.push("enabled2");
      return req;
    });

    // Process
    await preProcessor.process({ userPrompt: "test" });

    const disabledSkipped = !callOrder.includes("disabled");
    logTest(
      "P6-05a",
      "Disabled processor is not called",
      disabledSkipped,
      `Called: ${callOrder.join(", ")}`
    );

    const enabledCalled =
      callOrder.includes("enabled1") && callOrder.includes("enabled2");
    logTest("P6-05b", "Enabled processors are called", enabledCalled);

    // Test setEnabled
    preProcessor.setEnabled("disabled", true);
    callOrder.length = 0; // Clear

    await preProcessor.process({ userPrompt: "test" });

    const nowEnabled = callOrder.includes("disabled");
    logTest("P6-05c", "Re-enabled processor is now called", nowEnabled);

    // Test isEnabled
    const isEnabledCheck = preProcessor.isEnabled("disabled") === true;
    logTest("P6-05d", "isEnabled() returns correct state", isEnabledCheck);

    return disabledSkipped && enabledCalled && nowEnabled && isEnabledCheck;
  }

  // ============================================================================
  // P6-06: Request Transformation Works
  // ============================================================================

  async function testP6_06_RequestTransformation() {
    logSection("P6-06: Request Transformation Works");

    const preProcessor = new window.EmbedPreProcessorClass();

    // Test trim built-in
    preProcessor.add("trim", window.EmbedPreProcessorClass.builtIn.trim);

    const trimResult = await preProcessor.process({
      userPrompt: "  hello world  ",
      systemPrompt: "  be helpful  ",
    });

    const trimWorks =
      trimResult.userPrompt === "hello world" &&
      trimResult.systemPrompt === "be helpful";
    logTest("P6-06a", "trim processor removes whitespace", trimWorks);

    // Test sanitiseInput built-in
    const sanitiseProcessor = new window.EmbedPreProcessorClass();
    sanitiseProcessor.add(
      "sanitise",
      window.EmbedPreProcessorClass.builtIn.sanitiseInput
    );

    const sanitiseResult = await sanitiseProcessor.process({
      userPrompt: "hello\0world\x00test",
    });

    const nullBytesRemoved =
      !sanitiseResult.userPrompt.includes("\0") &&
      !sanitiseResult.userPrompt.includes("\x00");
    logTest("P6-06b", "sanitiseInput removes null bytes", nullBytesRemoved);

    // Test addTimestamp built-in
    const timestampProcessor = new window.EmbedPreProcessorClass();
    timestampProcessor.add(
      "timestamp",
      window.EmbedPreProcessorClass.builtIn.addTimestamp
    );

    const timestampResult = await timestampProcessor.process({
      userPrompt: "test",
      systemPrompt: "You are helpful",
    });

    const hasTimestamp = timestampResult.systemPrompt.includes(
      "[Current date and time:"
    );
    logTest(
      "P6-06c",
      "addTimestamp adds timestamp to system prompt",
      hasTimestamp
    );

    // Test processing metadata
    const hasMetadata =
      !!trimResult.preprocessed &&
      Array.isArray(trimResult.preprocessed.processors);
    logTest("P6-06d", "process() adds preprocessed metadata", hasMetadata);

    const metadataCorrect =
      trimResult.preprocessed?.processors?.includes("trim");
    logTest("P6-06e", "Metadata includes processor names", metadataCorrect);

    return (
      trimWorks &&
      nullBytesRemoved &&
      hasTimestamp &&
      hasMetadata &&
      metadataCorrect
    );
  }

  // ============================================================================
  // P6-07: Context Passed to Processors
  // ============================================================================

  async function testP6_07_ContextPassed() {
    logSection("P6-07: Context Passed to Processors");

    const preProcessor = new window.EmbedPreProcessorClass();
    let receivedContext = null;

    preProcessor.add("contextCapture", (request, context) => {
      receivedContext = context;
      return request;
    });

    const testContext = {
      userId: "123",
      sessionId: "abc",
      extra: { key: "value" },
    };
    await preProcessor.process({ userPrompt: "test" }, testContext);

    const contextPassed = receivedContext !== null;
    logTest("P6-07a", "Context is passed to processor", contextPassed);

    const contextCorrect =
      receivedContext?.userId === "123" && receivedContext?.sessionId === "abc";
    logTest("P6-07b", "Context contains correct data", contextCorrect);

    const nestedDataCorrect = receivedContext?.extra?.key === "value";
    logTest("P6-07c", "Nested context data is accessible", nestedDataCorrect);

    // Test empty context default
    let emptyContextReceived = null;
    const emptyContextProcessor = new window.EmbedPreProcessorClass();
    emptyContextProcessor.add("emptyCheck", (req, ctx) => {
      emptyContextReceived = ctx;
      return req;
    });

    await emptyContextProcessor.process({ userPrompt: "test" });

    const defaultContextIsObject =
      typeof emptyContextReceived === "object" && emptyContextReceived !== null;
    logTest(
      "P6-07d",
      "Default context is empty object",
      defaultContextIsObject
    );

    return (
      contextPassed &&
      contextCorrect &&
      nestedDataCorrect &&
      defaultContextIsObject
    );
  }

  // ============================================================================
  // P6-08: Integration with OpenRouterEmbed
  // ============================================================================

  async function testP6_08_Integration() {
    logSection("P6-08: Integration with OpenRouterEmbed");

    // Test that modules can work together
    const preProcessor = window.EmbedPreProcessor;
    const postProcessor = window.EmbedPostProcessor;

    const preProcessorAvailable = !!preProcessor;
    logTest(
      "P6-08a",
      "EmbedPreProcessor singleton is available",
      preProcessorAvailable
    );

    const postProcessorAvailable = !!postProcessor;
    logTest(
      "P6-08b",
      "EmbedPostProcessor singleton is available (Phase 3)",
      postProcessorAvailable
    );

    // Test that preprocessing can prepare data for API
    const canAddProcessor = typeof preProcessor?.add === "function";
    logTest("P6-08c", "PreProcessor can register processors", canAddProcessor);

    // Test clear works
    const freshProcessor = new window.EmbedPreProcessorClass();
    freshProcessor.add("test1", (r) => r);
    freshProcessor.add("test2", (r) => r);
    freshProcessor.clear();

    const clearWorks = freshProcessor.getProcessorNames().length === 0;
    logTest("P6-08d", "clear() removes all processors", clearWorks);

    // Test error isolation
    const errorProcessor = new window.EmbedPreProcessorClass();

    errorProcessor.add("failing", () => {
      throw new Error("Intentional test failure");
    });

    errorProcessor.add("succeeding", (req) => {
      return { ...req, succeeded: true };
    });

    let errorIsolationWorks = false;
    try {
      const result = await errorProcessor.process({ userPrompt: "test" });
      errorIsolationWorks = result.succeeded === true;
    } catch (e) {
      errorIsolationWorks = false;
    }

    logTest(
      "P6-08e",
      "Error in one processor doesn't break pipeline",
      errorIsolationWorks
    );

    // Test core integration - check OpenRouterEmbed has preprocessor API
    let coreIntegrationWorks = false;

    if (window.OpenRouterEmbed) {
      // Check if the class has the preprocessor methods
      const embedPrototype = window.OpenRouterEmbed.prototype;
      const hasConfigureMethod =
        typeof embedPrototype?.configurePreprocessor === "function";
      const hasAddMethod =
        typeof embedPrototype?.addPreprocessor === "function";
      const hasRemoveMethod =
        typeof embedPrototype?.removePreprocessor === "function";
      const hasSetEnabledMethod =
        typeof embedPrototype?.setPreprocessorEnabled === "function";
      const hasGetNamesMethod =
        typeof embedPrototype?.getPreprocessorNames === "function";
      const hasIsEnabledMethod =
        typeof embedPrototype?.isPreprocessorEnabled === "function";

      coreIntegrationWorks =
        hasConfigureMethod &&
        hasAddMethod &&
        hasRemoveMethod &&
        hasSetEnabledMethod &&
        hasGetNamesMethod &&
        hasIsEnabledMethod;

      if (!coreIntegrationWorks) {
        const missing = [];
        if (!hasConfigureMethod) missing.push("configurePreprocessor");
        if (!hasAddMethod) missing.push("addPreprocessor");
        if (!hasRemoveMethod) missing.push("removePreprocessor");
        if (!hasSetEnabledMethod) missing.push("setPreprocessorEnabled");
        if (!hasGetNamesMethod) missing.push("getPreprocessorNames");
        if (!hasIsEnabledMethod) missing.push("isPreprocessorEnabled");
        logTest(
          "P6-08f",
          "OpenRouterEmbed has preprocessor API methods",
          false,
          `Missing: ${missing.join(", ")}`
        );
      } else {
        logTest("P6-08f", "OpenRouterEmbed has preprocessor API methods", true);
      }
    } else {
      logTest(
        "P6-08f",
        "OpenRouterEmbed has preprocessor API methods",
        false,
        "OpenRouterEmbed class not available"
      );
    }

    return (
      preProcessorAvailable &&
      postProcessorAvailable &&
      canAddProcessor &&
      clearWorks &&
      errorIsolationWorks &&
      coreIntegrationWorks
    );
  }

  // ============================================================================
  // RUN ALL TESTS
  // ============================================================================

  async function runAllStage6Phase6Tests() {
    console.clear();
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║  OPENROUTER EMBED - STAGE 6 PHASE 6 TESTS             ║");
    console.log("║  Request Preprocessing Pipeline                       ║");
    console.log("╚═══════════════════════════════════════════════════════╝");

    // Reset results
    testResults.passed = 0;
    testResults.failed = 0;
    testResults.tests = [];

    // Run all tests
    testP6_01_ModuleExists();
    testP6_02_AddRegistersProcessor();
    testP6_03_RemoveUnregistersProcessor();
    await testP6_04_ProcessPriorityOrder();
    await testP6_05_DisabledProcessorsSkipped();
    await testP6_06_RequestTransformation();
    await testP6_07_ContextPassed();
    await testP6_08_Integration();

    return summariseResults();
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllStage6Phase6Tests = runAllStage6Phase6Tests;

  // Individual test functions for debugging
  window.testP6_01 = testP6_01_ModuleExists;
  window.testP6_02 = testP6_02_AddRegistersProcessor;
  window.testP6_03 = testP6_03_RemoveUnregistersProcessor;
  window.testP6_04 = testP6_04_ProcessPriorityOrder;
  window.testP6_05 = testP6_05_DisabledProcessorsSkipped;
  window.testP6_06 = testP6_06_RequestTransformation;
  window.testP6_07 = testP6_07_ContextPassed;
  window.testP6_08 = testP6_08_Integration;
})();
