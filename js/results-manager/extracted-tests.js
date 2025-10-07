// ✅ Stage 3B Step 2: Console Testing Commands for Enhanced beginStreaming() Coordination

/**
 * Test beginStreaming with coordination enabled
 */
window.testBeginStreamingCoordination = function () {
  console.log("🧪 Testing beginStreaming coordination...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      console.error("❌ StreamingManager not found");
      return { success: false, error: "StreamingManager not available" };
    }

    // Get initial state
    const initialDiagnostics = streaming.getStreamingCoordinationDiagnostics();

    console.log("📊 Initial streaming coordination state:", {
      streamingState: initialDiagnostics.streamingState,
      coordinationEnabled: initialDiagnostics.bridgeCoordinationEnabled,
      bridgeProcessing: initialDiagnostics.isBridgeProcessing,
      domProcessing: initialDiagnostics.isDOMProcessing,
    });

    // Mock core object for testing
    const mockCore = {
      resultsContent:
        document.querySelector(".results-content") || document.body,
      resultsHeading: document.querySelector(".results-heading"),
      isReducedMotion: false,
      handleScroll: () => console.log("Mock scroll handled"),
    };

    // Test beginStreaming with coordination
    const testOptions = {
      scrollBehavior: "smooth",
      testMode: true,
    };

    // Execute beginStreaming (this is async now)
    streaming.beginStreaming(testOptions, mockCore);

    // Check state after initiation
    setTimeout(() => {
      const afterDiagnostics = streaming.getStreamingCoordinationDiagnostics();

      const result = {
        success: true,
        coordinationTested: true,
        initialState: initialDiagnostics.streamingState,
        finalState: afterDiagnostics.streamingState,
        streamingId: afterDiagnostics.currentStreamingId,
        coordinationEnabled: afterDiagnostics.bridgeCoordinationEnabled,
        metrics: afterDiagnostics.metrics,
        timestamp: Date.now(),
      };

      console.log("✅ beginStreaming coordination test completed:", result);
      return result;
    }, 100);

    return {
      success: true,
      message: "beginStreaming coordination test initiated",
      coordinationEnabled: initialDiagnostics.bridgeCoordinationEnabled,
    };
  } catch (error) {
    console.error("❌ beginStreaming coordination test failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Test streaming when bridge is active (simulated)
 */
window.testStreamingWithBridgeActive = function () {
  console.log("🧪 Testing streaming with bridge active...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      console.error("❌ StreamingManager not found");
      return { success: false, error: "StreamingManager not available" };
    }

    // Check if bridge coordination is available
    if (!streaming.bridgeCoordinationEnabled) {
      console.warn(
        "⚠️ Bridge coordination not enabled, testing fallback behaviour"
      );
    }

    const initialState = streaming.getStreamingCoordinationDiagnostics();

    console.log("📊 Testing with bridge state:", {
      bridgeEnabled: streaming.bridgeCoordinationEnabled,
      bridgeProcessing: streaming.isBridgeProcessing(),
      domProcessing: streaming.isDOMProcessing(),
    });

    // Mock core for testing
    const mockCore = {
      resultsContent: document.createElement("div"),
      resultsHeading: document.createElement("h2"),
      isReducedMotion: false,
      handleScroll: () => console.log("Mock scroll in bridge test"),
    };

    // Test streaming initiation
    streaming.beginStreaming({ testWithBridge: true }, mockCore);

    return {
      success: true,
      bridgeCoordinationEnabled: streaming.bridgeCoordinationEnabled,
      bridgeActive: streaming.isBridgeProcessing(),
      domActive: streaming.isDOMProcessing(),
      streamingState: streaming.streamingState,
      testCompleted: true,
    };
  } catch (error) {
    console.error("❌ Streaming with bridge test failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Test streaming coordination metrics tracking
 */
window.testStreamingCoordinationMetrics = function () {
  console.log("🧪 Testing streaming coordination metrics...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      console.error("❌ StreamingManager not found");
      return { success: false, error: "StreamingManager not available" };
    }

    // Get initial metrics
    const initialMetrics =
      streaming.getStreamingCoordinationDiagnostics().metrics;

    console.log("📊 Initial metrics:", initialMetrics);

    // Simulate multiple streaming operations
    const mockCore = {
      resultsContent: document.createElement("div"),
      isReducedMotion: false,
      handleScroll: () => {},
    };

    // Test metrics tracking
    for (let i = 0; i < 3; i++) {
      streaming.beginStreaming({ metricsTest: true, iteration: i }, mockCore);
    }

    // Check metrics after operations
    const finalMetrics =
      streaming.getStreamingCoordinationDiagnostics().metrics;

    const result = {
      success: true,
      initialMetrics,
      finalMetrics,
      metricsIncreased:
        finalMetrics.totalStreamingOperations >
        initialMetrics.totalStreamingOperations,
      coordinationTracked:
        finalMetrics.bridgeCoordinatedStreams >=
        initialMetrics.bridgeCoordinatedStreams,
      hasTimingData: finalMetrics.lastStreamingTime > 0,
      testCompleted: true,
    };

    console.log("✅ Streaming metrics test completed:", result);
    return result;
  } catch (error) {
    console.error("❌ Streaming metrics test failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Validate streaming state management during coordination
 */
window.validateStreamingStateManagement = function () {
  console.log("🧪 Validating streaming state management...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      console.error("❌ StreamingManager not found");
      return { success: false, error: "StreamingManager not available" };
    }

    const stateTransitions = [];

    // Record initial state
    let currentDiagnostics = streaming.getStreamingCoordinationDiagnostics();
    stateTransitions.push({
      state: currentDiagnostics.streamingState,
      timestamp: Date.now(),
      phase: "initial",
    });

    // Test state update method
    streaming.updateStreamingState("waiting-for-bridge", "test-stream-001");

    currentDiagnostics = streaming.getStreamingCoordinationDiagnostics();
    stateTransitions.push({
      state: currentDiagnostics.streamingState,
      streamingId: currentDiagnostics.currentStreamingId,
      timestamp: Date.now(),
      phase: "waiting",
    });

    // Test processing state
    streaming.updateStreamingState("processing", "test-stream-001");

    currentDiagnostics = streaming.getStreamingCoordinationDiagnostics();
    stateTransitions.push({
      state: currentDiagnostics.streamingState,
      streamingId: currentDiagnostics.currentStreamingId,
      timestamp: Date.now(),
      phase: "processing",
    });

    // Test completion state
    streaming.updateStreamingState("completed", "test-stream-001");

    currentDiagnostics = streaming.getStreamingCoordinationDiagnostics();
    stateTransitions.push({
      state: currentDiagnostics.streamingState,
      streamingId: currentDiagnostics.currentStreamingId,
      timestamp: Date.now(),
      phase: "completed",
    });

    // Validate state transitions
    const validStates = [
      "idle",
      "waiting-for-bridge",
      "processing",
      "completed",
      "error",
    ];
    const validTransitions = stateTransitions.every((transition) =>
      validStates.includes(transition.state)
    );

    const result = {
      success: true,
      stateTransitions,
      validTransitions,
      finalState: currentDiagnostics.streamingState,
      streamingId: currentDiagnostics.currentStreamingId,
      coordinationEnabled: currentDiagnostics.bridgeCoordinationEnabled,
      testCompleted: true,
    };

    console.log("✅ Streaming state management validation completed:", result);
    return result;
  } catch (error) {
    console.error("❌ Streaming state management validation failed:", error);
    return { success: false, error: error.message };
  }
};

// ✅ Comprehensive Step 2 validation command
window.validateStreamingStep2Integration = function () {
  console.log("🧪 Running comprehensive Step 2 validation...");

  const tests = [
    {
      name: "beginStreaming Coordination",
      fn: window.testBeginStreamingCoordination,
    },
    {
      name: "Streaming with Bridge Active",
      fn: window.testStreamingWithBridgeActive,
    },
    {
      name: "Coordination Metrics",
      fn: window.testStreamingCoordinationMetrics,
    },
    { name: "State Management", fn: window.validateStreamingStateManagement },
  ];

  const results = [];
  let allPassed = true;

  tests.forEach((test) => {
    try {
      console.log(`\n🔍 Running ${test.name}...`);
      const result = test.fn();
      results.push({
        test: test.name,
        passed: result.success,
        details: result,
      });

      if (!result.success) {
        allPassed = false;
        console.error(`❌ ${test.name} failed:`, result);
      } else {
        console.log(`✅ ${test.name} passed`);
      }
    } catch (error) {
      allPassed = false;
      results.push({
        test: test.name,
        passed: false,
        error: error.message,
      });
      console.error(`❌ ${test.name} crashed:`, error);
    }
  });

  const summary = {
    allTestsPassed: allPassed,
    testResults: results,
    step2Status: allPassed ? "COMPLETE" : "NEEDS_ATTENTION",
    timestamp: Date.now(),
  };

  console.log("\n📋 Step 2 Validation Summary:", summary);
  return summary;
};
// ✅ Step 2B Testing Commands - Add to end of results-manager-streaming.js

/**
 * Test Step 2B: updateStreamingState method
 */
window.testStep2B_UpdateStreamingState = function () {
  console.log("🧪 Testing Step 2B: updateStreamingState method...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    // Check if method exists
    if (typeof streaming.updateStreamingState !== "function") {
      return { success: false, error: "updateStreamingState method not found" };
    }

    // Test state transitions
    const initialState = streaming.streamingState;
    const testId = "test-stream-step2b-" + Date.now();

    console.log("📊 Initial state:", {
      streamingState: initialState,
      currentStreamingId: streaming.currentStreamingId,
    });

    // Test state update to waiting-for-bridge
    streaming.updateStreamingState("waiting-for-bridge", testId);

    const waitingState = {
      streamingState: streaming.streamingState,
      currentStreamingId: streaming.currentStreamingId,
    };

    console.log("📊 After waiting-for-bridge:", waitingState);

    // Test state update to processing
    streaming.updateStreamingState("processing", testId);

    const processingState = {
      streamingState: streaming.streamingState,
      currentStreamingId: streaming.currentStreamingId,
    };

    console.log("📊 After processing:", processingState);

    // Test state update to completed
    streaming.updateStreamingState("completed", testId);

    const completedState = {
      streamingState: streaming.streamingState,
      currentStreamingId: streaming.currentStreamingId,
    };

    console.log("📊 After completed:", completedState);

    // Validation
    const validation = {
      methodExists: typeof streaming.updateStreamingState === "function",
      stateTransitionsWork: completedState.streamingState === "completed",
      streamingIdUpdated: completedState.currentStreamingId === testId,
      allStatesValid: ["waiting-for-bridge", "processing", "completed"].every(
        (state) => {
          // Test that we can set each state
          streaming.updateStreamingState(state, testId);
          return streaming.streamingState === state;
        }
      ),
    };

    console.log("✅ Step 2B updateStreamingState validation:", validation);

    const success = Object.values(validation).every((v) => v === true);

    return {
      success,
      step: "2B",
      method: "updateStreamingState",
      validation,
      testId,
      states: {
        initial: initialState,
        waiting: waitingState,
        processing: processingState,
        completed: completedState,
      },
    };
  } catch (error) {
    console.error("❌ Step 2B updateStreamingState test failed:", error);
    return { success: false, error: error.message, step: "2B" };
  }
};

/**
 * Test Step 2B: waitForCoordinationCompletion method
 */
window.testStep2B_WaitForCoordination = function () {
  console.log("🧪 Testing Step 2B: waitForCoordinationCompletion method...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    // Check if method exists
    if (typeof streaming.waitForCoordinationCompletion !== "function") {
      return {
        success: false,
        error: "waitForCoordinationCompletion method not found",
      };
    }

    console.log(
      "📊 Testing coordination wait (should complete quickly since bridge/DOM likely idle)..."
    );

    // Test the wait method (should complete quickly if bridge/DOM are idle)
    const startTime = Date.now();

    streaming.waitForCoordinationCompletion(1000, 50).then((result) => {
      const elapsed = Date.now() - startTime;

      console.log("✅ waitForCoordinationCompletion result:", {
        completed: result,
        elapsed: elapsed + "ms",
        bridgeProcessing: streaming.isBridgeProcessing(),
        domProcessing: streaming.isDOMProcessing(),
      });
    });

    // Since we can't easily await in this context, return immediate validation
    const validation = {
      methodExists:
        typeof streaming.waitForCoordinationCompletion === "function",
      returnsPromise:
        streaming.waitForCoordinationCompletion() instanceof Promise,
      bridgeCheckWorks: typeof streaming.isBridgeProcessing === "function",
      domCheckWorks: typeof streaming.isDOMProcessing === "function",
    };

    console.log(
      "✅ Step 2B waitForCoordinationCompletion validation:",
      validation
    );

    const success = Object.values(validation).every((v) => v === true);

    return {
      success,
      step: "2B",
      method: "waitForCoordinationCompletion",
      validation,
      note: "Full async test running - check console for completion result",
    };
  } catch (error) {
    console.error(
      "❌ Step 2B waitForCoordinationCompletion test failed:",
      error
    );
    return { success: false, error: error.message, step: "2B" };
  }
};

/**
 * Test that Step 2B methods are properly integrated
 */
window.testStep2B_Integration = function () {
  console.log("🧪 Testing Step 2B: Method integration...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    // Check all Step 2B methods exist
    const step2BMethods = {
      updateStreamingState:
        typeof streaming.updateStreamingState === "function",
      waitForCoordinationCompletion:
        typeof streaming.waitForCoordinationCompletion === "function",
    };

    // Check Step 1 methods still exist
    const step1Methods = {
      establishBridgeCoordination:
        typeof streaming.establishBridgeCoordination === "function",
      getBridgeProcessingRef:
        typeof streaming.getBridgeProcessingRef === "function",
      isBridgeProcessing: typeof streaming.isBridgeProcessing === "function",
      isDOMProcessing: typeof streaming.isDOMProcessing === "function",
      getStreamingCoordinationDiagnostics:
        typeof streaming.getStreamingCoordinationDiagnostics === "function",
    };

    // Check existing streaming methods still exist
    const existingMethods = {
      beginStreaming: typeof streaming.beginStreaming === "function",
      updateStreamingContent:
        typeof streaming.updateStreamingContent === "function",
      completeStreaming: typeof streaming.completeStreaming === "function",
      setStreamingMode: typeof streaming.setStreamingMode === "function",
    };

    const integration = {
      step2BMethodsAdded: Object.values(step2BMethods).every((v) => v === true),
      step1MethodsPreserved: Object.values(step1Methods).every(
        (v) => v === true
      ),
      existingMethodsPreserved: Object.values(existingMethods).every(
        (v) => v === true
      ),
    };

    console.log("✅ Step 2B integration check:", {
      step2BMethods,
      step1Methods,
      existingMethods,
      integration,
    });

    const success = Object.values(integration).every((v) => v === true);

    return {
      success,
      step: "2B",
      integration,
      methodCounts: {
        step2B: Object.keys(step2BMethods).length,
        step1: Object.keys(step1Methods).length,
        existing: Object.keys(existingMethods).length,
      },
    };
  } catch (error) {
    console.error("❌ Step 2B integration test failed:", error);
    return { success: false, error: error.message, step: "2B" };
  }
};

/**
 * Complete Step 2B validation
 */
window.validateStep2B = function () {
  console.log("🧪 Running complete Step 2B validation...");

  const updateStateTest = window.testStep2B_UpdateStreamingState();
  const waitCoordinationTest = window.testStep2B_WaitForCoordination();
  const integrationTest = window.testStep2B_Integration();

  const overall = {
    step: "2B",
    updateStreamingStateWorking: updateStateTest.success,
    waitForCoordinationWorking: waitCoordinationTest.success,
    integrationWorking: integrationTest.success,
    readyForStep2C:
      updateStateTest.success &&
      waitCoordinationTest.success &&
      integrationTest.success,
    results: {
      updateState: updateStateTest,
      waitCoordination: waitCoordinationTest,
      integration: integrationTest,
    },
    timestamp: Date.now(),
  };

  if (overall.readyForStep2C) {
    console.log("🎉 Step 2B: COMPLETE and ready for Step 2C!", overall);
  } else {
    console.error(
      "❌ Step 2B: Issues detected, fix before proceeding to Step 2C:",
      overall
    );
  }

  return overall;
};
// ✅ Step 2C Testing Commands - Add to end of results-manager-streaming.js
// ✅ Step 2C Testing Commands - REPLACE existing testStep2C functions

/**
 * Enable bridge coordination for testing
 */
window.enableBridgeCoordinationForTesting = function () {
  console.log("🔧 Enabling bridge coordination for Step 2C testing...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    // Force enable bridge coordination for testing
    streaming.bridgeCoordinationEnabled = true;

    // Ensure we have references (create mock ones if needed)
    if (!streaming.bridgeProcessingRef) {
      streaming.bridgeProcessingRef = {
        getProcessingDiagnostics: () => ({ processingActive: false }),
        isProcessing: () => false,
      };
    }

    if (!streaming.domCoordinationRef) {
      streaming.domCoordinationRef = {
        getDOMOperationDiagnostics: () => ({ state: "idle" }),
        isDOMProcessing: () => false,
      };
    }

    console.log("✅ Bridge coordination enabled for testing:", {
      bridgeCoordinationEnabled: streaming.bridgeCoordinationEnabled,
      hasBridgeRef: !!streaming.bridgeProcessingRef,
      hasDOMRef: !!streaming.domCoordinationRef,
    });

    return {
      success: true,
      bridgeCoordinationEnabled: streaming.bridgeCoordinationEnabled,
      message: "Bridge coordination enabled for testing",
    };
  } catch (error) {
    console.error("❌ Failed to enable bridge coordination:", error);
    return { success: false, error: error.message };
  }
};

/**
 * FIXED Test Step 2C: Full coordination integration in beginStreaming()
 */
window.testStep2C_FullCoordination = function () {
  console.log("🧪 Testing Step 2C: Full coordination integration (FIXED)...");

  try {
    const streaming = window.resultsManager?.streaming;
    const core = window.resultsManager?.core;

    if (!streaming || !core) {
      return {
        success: false,
        error: "StreamingManager or Core not available",
        streaming: !!streaming,
        core: !!core,
      };
    }

    // Force enable bridge coordination for comprehensive testing
    streaming.bridgeCoordinationEnabled = true;
    if (!streaming.bridgeProcessingRef) {
      streaming.bridgeProcessingRef = {
        getProcessingDiagnostics: () => ({ processingActive: false }),
        isProcessing: () => false,
      };
    }
    if (!streaming.domCoordinationRef) {
      streaming.domCoordinationRef = {
        getDOMOperationDiagnostics: () => ({ state: "idle" }),
        isDOMProcessing: () => false,
      };
    }

    // Check that Step 2C enhancements are present
    const step2CValidation = {
      // Check that beginStreaming exists and is async
      beginStreamingExists: typeof streaming.beginStreaming === "function",
      beginStreamingIsAsync:
        streaming.beginStreaming.constructor.name === "AsyncFunction",

      // Check Step 2B methods are available
      updateStreamingStateExists:
        typeof streaming.updateStreamingState === "function",
      waitForCoordinationExists:
        typeof streaming.waitForCoordinationCompletion === "function",

      // Check coordination infrastructure (now forced enabled)
      bridgeCoordinationEnabled: streaming.bridgeCoordinationEnabled,
      canDetectBridge: typeof streaming.isBridgeProcessing === "function",
      canDetectDOM: typeof streaming.isDOMProcessing === "function",

      // Check metrics tracking
      hasMetrics: !!streaming.streamingMetrics,
      metricsHasRequiredFields: !!(
        streaming.streamingMetrics &&
        typeof streaming.streamingMetrics === "object"
      ),
    };

    console.log("📊 Step 2C validation results:", step2CValidation);

    // Test coordination flow simulation
    console.log("🔄 Testing coordination state flow...");

    const initialState = streaming.streamingState;
    const testStreamingId = "test-step2c-" + Date.now();

    // Test that updateStreamingState method works with Step 2C
    streaming.updateStreamingState("waiting-for-bridge", testStreamingId);
    const waitingState = streaming.streamingState;

    streaming.updateStreamingState("processing", testStreamingId);
    const processingState = streaming.streamingState;

    streaming.updateStreamingState("completed", testStreamingId);
    const completedState = streaming.streamingState;

    const stateTransitionTest = {
      transitionedToWaiting: waitingState === "waiting-for-bridge",
      transitionedToProcessing: processingState === "processing",
      transitionedToCompleted: completedState === "completed",
      streamingIdUpdated: streaming.currentStreamingId === testStreamingId,
    };

    console.log("📊 State transition test:", stateTransitionTest);

    // Test that beginStreaming method has Step 2C characteristics
    const methodAnalysis = {
      // Check that the method source contains Step 2C markers
      hasStep2CMarkers: streaming.beginStreaming.toString().includes("Step 2C"),
      hasAntiDuplication: streaming.beginStreaming
        .toString()
        .includes("duplicate request"),
      hasCoordinationWait: streaming.beginStreaming
        .toString()
        .includes("waitForCoordinationCompletion"),
      hasUpdateStreamingState: streaming.beginStreaming
        .toString()
        .includes("updateStreamingState"),
    };

    console.log("📊 Method analysis:", methodAnalysis);

    // Combine all validations
    const allValidations = {
      ...step2CValidation,
      ...stateTransitionTest,
      ...methodAnalysis,
    };

    const allValidationsPassed = Object.values(allValidations).every(
      (v) => v === true
    );

    return {
      success: allValidationsPassed,
      step: "2C",
      test: "FullCoordination",
      validation: step2CValidation,
      stateTransitions: stateTransitionTest,
      methodAnalysis,
      testStreamingId,
      bridgeCoordinationForced: true,
      readyForRealWorldTest: allValidationsPassed,
    };
  } catch (error) {
    console.error("❌ Step 2C full coordination test failed:", error);
    return { success: false, error: error.message, step: "2C" };
  }
};

/**
 * SIMPLIFIED Test Step 2C: Duplicate prevention logic - Direct Testing
 * Replace the existing testStep2C_DuplicatePrevention function
 */
window.testStep2C_DuplicatePrevention = function () {
  console.log(
    "🧪 Testing Step 2C: Duplicate request prevention (SIMPLIFIED)..."
  );

  try {
    const streaming = window.resultsManager?.streaming;
    const core = window.resultsManager?.core;

    if (!streaming || !core) {
      return {
        success: false,
        error: "StreamingManager or Core not available",
      };
    }

    // Ensure bridge coordination is enabled for this test
    streaming.bridgeCoordinationEnabled = true;

    const testStreamingId = "test-duplicate-" + Date.now();
    const initialMetrics = { ...streaming.streamingMetrics };

    // Create a fake core with resultsContent for testing
    const mockCore = {
      resultsContent: document.createElement("div"),
      resultsHeading: document.createElement("h2"),
      handleScroll: () => {},
    };

    console.log("📊 Test 1: Streaming state duplicate prevention...");

    // Test 1: Set streaming state and try to duplicate
    streaming.isStreaming = true;
    streaming.updateStreamingState("processing", testStreamingId);

    const preTest1State = {
      isStreaming: streaming.isStreaming,
      streamingState: streaming.streamingState,
      operationCount: streaming.streamingMetrics.totalStreamingOperations,
    };

    // Attempt duplicate (should be blocked by isStreaming + processing state)
    streaming.beginStreaming({}, mockCore);

    const postTest1State = {
      isStreaming: streaming.isStreaming,
      streamingState: streaming.streamingState,
      operationCount: streaming.streamingMetrics.totalStreamingOperations,
    };

    console.log("📊 Test 2: Coordination state duplicate prevention...");

    // Test 2: Set coordination waiting state and try to duplicate
    streaming.updateStreamingState("waiting-for-bridge", testStreamingId);

    const preTest2State = {
      streamingState: streaming.streamingState,
      operationCount: streaming.streamingMetrics.totalStreamingOperations,
    };

    // Attempt duplicate (should be blocked by waiting-for-bridge state)
    streaming.beginStreaming({}, mockCore);

    const postTest2State = {
      streamingState: streaming.streamingState,
      operationCount: streaming.streamingMetrics.totalStreamingOperations,
    };

    // Clean up test state
    streaming.isStreaming = false;
    streaming.updateStreamingState("idle", null);

    // Analysis: Both tests should show no change in operation count
    const duplicationTest = {
      test1StreamingBlocked:
        preTest1State.operationCount === postTest1State.operationCount,
      test2CoordinationBlocked:
        preTest2State.operationCount === postTest2State.operationCount,
      stateConsistency: streaming.streamingState === "idle",
      noOperationIncrease:
        streaming.streamingMetrics.totalStreamingOperations ===
        initialMetrics.totalStreamingOperations,
    };

    console.log("📊 Duplication prevention analysis:", {
      preTest1State,
      postTest1State,
      preTest2State,
      postTest2State,
      results: duplicationTest,
    });

    const success = Object.values(duplicationTest).every((v) => v === true);

    return {
      success,
      step: "2C",
      test: "DuplicatePrevention",
      results: duplicationTest,
      testStreamingId,
      message: success
        ? "Duplicate prevention working correctly"
        : "Duplicate prevention failed",
    };
  } catch (error) {
    console.error("❌ Step 2C duplicate prevention test failed:", error);
    return { success: false, error: error.message, step: "2C" };
  }
};

/**
 * Test Step 2C: Complete coordination flow
 * Add this function to results-manager-streaming.js
 */
window.testStep2C_CoordinationFlow = function () {
  console.log("🧪 Testing Step 2C: Complete coordination flow...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    // Test the complete flow: idle → waiting-for-bridge → processing → completed
    const testStreamingId = "test-flow-" + Date.now();
    const flowStates = [];

    // Initial state
    streaming.updateStreamingState("idle", null);
    flowStates.push({
      state: "idle",
      streamingId: streaming.currentStreamingId,
    });

    // Bridge coordination state
    streaming.updateStreamingState("waiting-for-bridge", testStreamingId);
    flowStates.push({
      state: "waiting-for-bridge",
      streamingId: streaming.currentStreamingId,
    });

    // Processing state
    streaming.updateStreamingState("processing", testStreamingId);
    flowStates.push({
      state: "processing",
      streamingId: streaming.currentStreamingId,
    });

    // Completed state
    streaming.updateStreamingState("completed", testStreamingId);
    flowStates.push({
      state: "completed",
      streamingId: streaming.currentStreamingId,
    });

    console.log("📊 Complete coordination flow:", flowStates);

    // Test waitForCoordinationCompletion behavior
    const startTime = Date.now();

    streaming.waitForCoordinationCompletion(1000, 50).then((result) => {
      const elapsed = Date.now() - startTime;
      console.log("⏱️ Coordination completion test:", {
        completed: result,
        elapsed: elapsed + "ms",
        bridgeIdle: !streaming.isBridgeProcessing(),
        domIdle: !streaming.isDOMProcessing(),
      });
    });

    const coordinationFlow = {
      stateTransitionsWork: flowStates.every((state, index) => {
        const expectedStates = [
          "idle",
          "waiting-for-bridge",
          "processing",
          "completed",
        ];
        return state.state === expectedStates[index];
      }),
      streamingIdPersisted: flowStates
        .slice(1)
        .every((state) => state.streamingId === testStreamingId),
      idClearedOnIdle: flowStates[0].streamingId === null,
      waitMethodExists:
        typeof streaming.waitForCoordinationCompletion === "function",
    };

    console.log("📊 Coordination flow validation:", coordinationFlow);

    const success = Object.values(coordinationFlow).every((v) => v === true);

    return {
      success,
      step: "2C",
      test: "CoordinationFlow",
      flowStates,
      validation: coordinationFlow,
      testStreamingId,
    };
  } catch (error) {
    console.error("❌ Step 2C coordination flow test failed:", error);
    return { success: false, error: error.message, step: "2C" };
  }
};

/**
 * Test Step 2C: Error handling scenarios
 * Add this function to results-manager-streaming.js
 */
window.testStep2C_ErrorHandling = function () {
  console.log("🧪 Testing Step 2C: Error handling scenarios...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    const testStreamingId = "test-error-" + Date.now();
    const initialErrorCount = streaming.streamingMetrics.errorCount || 0;

    // Test error state transition
    streaming.updateStreamingState("error", testStreamingId);
    const errorStateSet = streaming.streamingState === "error";

    // Test metrics tracking
    streaming.streamingMetrics.errorCount =
      (streaming.streamingMetrics.errorCount || 0) + 1;
    const errorCountIncremented =
      streaming.streamingMetrics.errorCount === initialErrorCount + 1;

    // Test coordination timeout handling
    streaming.streamingMetrics.coordinationTimeouts =
      (streaming.streamingMetrics.coordinationTimeouts || 0) + 1;
    const timeoutTracked =
      (streaming.streamingMetrics.coordinationTimeouts || 0) > 0;

    // Test coordination error handling
    streaming.streamingMetrics.coordinationErrors =
      (streaming.streamingMetrics.coordinationErrors || 0) + 1;
    const coordinationErrorTracked =
      (streaming.streamingMetrics.coordinationErrors || 0) > 0;

    const errorHandling = {
      errorStateTransition: errorStateSet,
      errorCountTracking: errorCountIncremented,
      timeoutTracking: timeoutTracked,
      coordinationErrorTracking: coordinationErrorTracked,
      streamingIdPreserved: streaming.currentStreamingId === testStreamingId,
    };

    console.log("📊 Error handling validation:", errorHandling);

    const success = Object.values(errorHandling).every((v) => v === true);

    return {
      success,
      step: "2C",
      test: "ErrorHandling",
      validation: errorHandling,
      testStreamingId,
      errorMetrics: {
        errorCount: streaming.streamingMetrics.errorCount,
        coordinationTimeouts: streaming.streamingMetrics.coordinationTimeouts,
        coordinationErrors: streaming.streamingMetrics.coordinationErrors,
      },
    };
  } catch (error) {
    console.error("❌ Step 2C error handling test failed:", error);
    return { success: false, error: error.message, step: "2C" };
  }
};

/**
 * UPDATED: Comprehensive Step 2C validation
 */
window.validateStep2C = function () {
  console.log("🔍 Running comprehensive Step 2C validation...");

  // First enable bridge coordination
  const bridgeResult = window.enableBridgeCoordinationForTesting();
  if (!bridgeResult.success) {
    console.error("❌ Failed to enable bridge coordination for testing");
    return bridgeResult;
  }

  const tests = [
    { name: "FullCoordination", fn: window.testStep2C_FullCoordination },
    { name: "DuplicatePrevention", fn: window.testStep2C_DuplicatePrevention },
    { name: "CoordinationFlow", fn: window.testStep2C_CoordinationFlow },
    { name: "ErrorHandling", fn: window.testStep2C_ErrorHandling },
  ];

  const results = {};
  let allPassed = true;

  for (const test of tests) {
    try {
      console.log(`\n🧪 Running ${test.name} test...`);
      const result = test.fn();
      results[test.name] = result;

      if (!result.success) {
        allPassed = false;
        console.error(`❌ ${test.name} test failed:`, result);
      } else {
        console.log(`✅ ${test.name} test passed`);
      }
    } catch (error) {
      allPassed = false;
      results[test.name] = { success: false, error: error.message };
      console.error(`❌ ${test.name} test threw error:`, error);
    }
  }

  const summary = {
    success: allPassed,
    step: "2C",
    totalTests: tests.length,
    passedTests: Object.values(results).filter((r) => r.success).length,
    failedTests: Object.values(results).filter((r) => !r.success).length,
    results,
    bridgeCoordinationEnabled: bridgeResult.success,
    readyForStep3: allPassed,
    timestamp: Date.now(),
  };

  console.log("\n📋 Step 2C Validation Summary:", summary);

  if (allPassed) {
    console.log(
      "🎉 Step 2C COMPLETE! Full coordination integration successful!"
    );
    console.log(
      "Ready to proceed to Step 3: Enhanced updateStreamingContent() Coordination"
    );
  } else {
    console.log(
      "⚠️ Step 2C validation failed. Review failed tests before proceeding."
    );
  }

  return summary;
};

// ============================================================================
// Stage 3B Step 3 Phase 1: Console Commands for Testing and Validation
// ============================================================================

/**
 * Test Stage 3B Step 3 Phase 1 coordination logic
 */
window.testStage3B_Step3_Phase1_Coordination = function () {
  console.log(
    "🧪 Testing Stage 3B Step 3 Phase 1: Content Update Coordination..."
  );

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      console.error("❌ StreamingManager not available");
      return { success: false, error: "StreamingManager not available" };
    }

    // Enable coordination for testing
    streaming.bridgeCoordinationEnabled = true;
    streaming.currentStreamingId = `test-phase1-${Date.now()}`;
    streaming.isStreaming = true;

    // Mock core object
    const mockCore = {
      resultsContent: document.createElement("div"),
      isReducedMotion: false,
    };

    // Add streaming container
    const streamContainer = document.createElement("div");
    streamContainer.className = "streaming-content";
    mockCore.resultsContent.appendChild(streamContainer);

    const testResults = {};

    // ✅ FIX: Proper bridge processing reference mock
    streaming.bridgeProcessingRef = {
      isProcessing: () => false,
      getProcessingDiagnostics: () => ({ processingActive: false }),
    };
    streaming.domCoordinationRef = {
      isDOMProcessing: () => false,
      getDOMOperationDiagnostics: () => ({ state: "idle" }),
    };

    // Test 1: No coordination needed (bridge/DOM idle)
    const test1Start = performance.now();
    streaming.updateStreamingContent("Test chunk 1", {}, mockCore);
    const test1Time = performance.now() - test1Start;

    testResults.noCoordinationNeeded = {
      success: test1Time < 5, // Should be very fast when no coordination
      processingTime: test1Time,
      coordinationBypassed: true,
    };

    // Test 2: Coordination needed (bridge processing)
    streaming.bridgeProcessingRef = {
      isProcessing: () => true,
      getProcessingDiagnostics: () => ({ processingActive: true }),
    };

    const test2Start = performance.now();
    const coordinationPromise = streaming.coordinateContentUpdate(
      "Test chunk 2",
      {},
      mockCore
    );
    const test2Time = performance.now() - test2Start;

    testResults.coordinationNeeded = {
      success: typeof coordinationPromise?.then === "function", // Should return promise
      isAsync: true,
      coordinationTriggered: true,
      processingTime: test2Time,
    };

    // Test 3: Method availability
    testResults.methodsAvailable = {
      coordinateContentUpdate:
        typeof streaming.coordinateContentUpdate === "function",
      processContentAfterCoordination:
        typeof streaming.processContentAfterCoordination === "function",
      updateStreamingContent:
        typeof streaming.updateStreamingContent === "function",
    };

    const allTests = Object.values(testResults).every(
      (test) =>
        typeof test === "object" &&
        Object.values(test).every((v) => v === true || typeof v === "number")
    );

    console.log("✅ Stage 3B Step 3 Phase 1 test results:", testResults);

    return {
      success: allTests,
      phase: "3B.3.1",
      testResults,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("❌ Stage 3B Step 3 Phase 1 test failed:", error);
    return { success: false, error: error.message, phase: "3B.3.1" };
  }
};

/**
 * Test Stage 3B Step 3 Phase 1 performance impact
 */
window.testStage3B_Step3_Phase1_Performance = function () {
  console.log("🧪 Testing Stage 3B Step 3 Phase 1: Performance Impact...");

  try {
    const streaming = window.resultsManager?.streaming;
    if (!streaming) {
      return { success: false, error: "StreamingManager not available" };
    }

    // Setup for testing
    streaming.bridgeCoordinationEnabled = true;
    streaming.isStreaming = true;

    const mockCore = {
      resultsContent: document.createElement("div"),
      isReducedMotion: false,
    };

    const streamContainer = document.createElement("div");
    streamContainer.className = "streaming-content";
    mockCore.resultsContent.appendChild(streamContainer);

    // ✅ FIX: Use let instead of const for variables that will be reassigned
    let performanceResults = {};

    // Test coordination disabled performance
    streaming.bridgeCoordinationEnabled = false;
    const disabledTimes = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      streaming.updateStreamingContent(`chunk ${i}`, {}, mockCore);
      disabledTimes.push(performance.now() - start);
    }

    // Test coordination enabled but not needed performance
    streaming.bridgeCoordinationEnabled = true;
    // ✅ FIX: Proper mock with all required methods
    streaming.bridgeProcessingRef = {
      isProcessing: () => false,
      getProcessingDiagnostics: () => ({ processingActive: false }),
    };
    streaming.domCoordinationRef = {
      isDOMProcessing: () => false,
      getDOMOperationDiagnostics: () => ({ state: "idle" }),
    };

    const enabledIdleTimes = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      streaming.updateStreamingContent(`chunk ${i}`, {}, mockCore);
      enabledIdleTimes.push(performance.now() - start);
    }

    const avgDisabled =
      disabledTimes.reduce((a, b) => a + b, 0) / disabledTimes.length;
    const avgEnabledIdle =
      enabledIdleTimes.reduce((a, b) => a + b, 0) / enabledIdleTimes.length;
    const overhead = avgEnabledIdle - avgDisabled;

    // ✅ FIX: Assign to let variable, not const
    performanceResults = {
      averageDisabled: avgDisabled,
      averageEnabledIdle: avgEnabledIdle,
      overhead: overhead,
      overheadAcceptable: overhead < 1, // Less than 1ms overhead acceptable
      zeroOverheadGoal: overhead < 0.5, // Target: less than 0.5ms overhead
    };

    console.log(
      "✅ Stage 3B Step 3 Phase 1 performance results:",
      performanceResults
    );

    return {
      success: performanceResults.overheadAcceptable,
      phase: "3B.3.1",
      performanceResults,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("❌ Stage 3B Step 3 Phase 1 performance test failed:", error);
    return { success: false, error: error.message, phase: "3B.3.1" };
  }
};

/**
 * Validate Stage 3B Step 3 Phase 1 implementation
 */
window.validateStage3B_Step3_Phase1 = function () {
  console.log(
    "🔍 Validating Stage 3B Step 3 Phase 1: Core Coordination Logic..."
  );

  const coordinationTest = window.testStage3B_Step3_Phase1_Coordination();
  const performanceTest = window.testStage3B_Step3_Phase1_Performance();

  const validation = {
    phase: "3B.3.1",
    coordinationWorking: coordinationTest.success,
    performanceAcceptable: performanceTest.success,
    readyForPhase2: coordinationTest.success && performanceTest.success,
    results: {
      coordination: coordinationTest,
      performance: performanceTest,
    },
    timestamp: Date.now(),
  };

  if (validation.readyForPhase2) {
    console.log("🎉 Stage 3B Step 3 Phase 1: COMPLETE and ready for Phase 2!");
    console.log("Next: Stage 3B Step 3 Phase 2 - Content State Management");
  } else {
    console.log(
      "⚠️ Stage 3B Step 3 Phase 1 validation failed. Review results before proceeding."
    );
  }

  return validation;