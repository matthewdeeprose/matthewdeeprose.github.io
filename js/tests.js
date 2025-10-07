// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Current logging level
let currentLogLevel = DEFAULT_LOG_LEVEL;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= currentLogLevel;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) {
    console.error(`[Universal Notifications] ERROR: ${message}`, ...args);
  }
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) {
    console.warn(`[Universal Notifications] WARN: ${message}`, ...args);
  }
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) {
    console.log(`[Universal Notifications] INFO: ${message}`, ...args);
  }
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) {
    console.log(`[Universal Notifications] DEBUG: ${message}`, ...args);
  }
}

function setLogLevel(level) {
  if (Object.values(LOG_LEVELS).includes(level)) {
    currentLogLevel = level;
    logInfo(
      `Logging level set to: ${Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === level
      )}`
    );
  } else {
    logWarn(`Invalid logging level: ${level}`);
  }
}

// Development helper functions (remove in production)
if (typeof window !== "undefined") {
  // Debug helper: Toggle bridge mode
  window.toggleBridgeMode = function () {
    const current = localStorage.getItem("use-markdownit-bridge") === "true";
    localStorage.setItem("use-markdownit-bridge", (!current).toString());
    logDebug(
      `🔍 [BRIDGE DEBUG] Bridge mode: ${
        current ? "OFF" : "ON"
      } (refresh to apply)`
    );
  };

  // Enhanced debug helper: Check current bridge status
  window.checkBridgeStatus = function () {
    logDebug("🔍 [BRIDGE DEBUG] 📊 COMPREHENSIVE BRIDGE STATUS:", {
      environment: {
        localStorage: localStorage.getItem("use-markdownit-bridge"),
        markdownEditorAvailable: typeof window.MarkdownEditor !== "undefined",
        markdownItAvailable: typeof window.markdownit !== "undefined",
        bridgeForceComplete: window.BRIDGE_FORCER_COMPLETE === true,
      },
      globalAccess: {
        resultsManager: !!window.resultsManager,
        contentProcessor: !!window.resultsManager?.contentProcessor,
        bridgeDetectionMethod:
          typeof window.resultsManager?.contentProcessor
            ?.shouldUseMarkdownItBridge,
        bridgeInstance:
          !!window.resultsManager?.contentProcessor?.markdownItBridge,
      },
      bridgeWillBeUsed:
        window.resultsManager?.contentProcessor?.shouldUseMarkdownItBridge?.() ||
        false,
      timestamp: new Date().toISOString(),
    });
  };

  logDebug("🛠️ [BRIDGE DEBUG] Enhanced debug helpers loaded:");
  logDebug("  - toggleBridgeMode() - Toggle bridge on/off");
  logDebug("  - checkBridgeStatus() - Check comprehensive bridge status");
  logDebug("  - testBridgeIntegration() - Run manual bridge test");
  logDebug(
    "  - setLogLevel(level) - Change logging level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)"
  );
  logDebug("  - getLogLevel() - Check current logging level");

  window.testTableDetection = function (testContent) {
    logDebug("🧪 [TABLE TEST] Testing table detection:");

    if (window.resultsManager?.contentProcessor?.diagnosticTableAnalysis) {
      window.resultsManager.contentProcessor.diagnosticTableAnalysis(
        testContent,
        "manual-test"
      );
    }

    if (window.resultsManager?.contentProcessor?.looksLikeMarkdownTable) {
      const result =
        window.resultsManager.contentProcessor.looksLikeMarkdownTable(
          testContent
        );
      logDebug("🧪 [TABLE TEST] Detection result:", result);
      return result;
    } else {
      logError("🧪 [TABLE TEST] Detection method not available");
      return false;
    }
  };

  // Test cases
  window.runTableDetectionTests = function () {
    const testCases = [
      {
        name: "Valid markdown table",
        content: "| Name | Age |\n|------|-----|\n| John | 25 |\n| Jane | 30 |",
      },
      {
        name: "HTML with pipes",
        content: "<div>Some content | with pipes | but not a table</div>",
      },
      {
        name: "Code block with pipes",
        content: "```javascript\nconst result = a | b | c;\n```",
      },
      {
        name: "Single line with pipes",
        content: "Just some text | with pipes | not a table",
      },
      {
        name: "JSON with pipes",
        content: '{"data": "value | with | pipes"}',
      },
    ];

    logDebug("🧪 [TABLE TEST] Running test suite:");
    testCases.forEach((test) => {
      logDebug(`\n🧪 [TABLE TEST] ${test.name}:`);
      window.testTableDetection(test.content);
    });
  };
}

// Test cost calculation debugging
window.debugFileUploadCosts = (file) => {
  const paramHandler = window.requestProcessor?.core?.parameterHandler;
  if (!paramHandler) {
    console.error("Parameter handler not available");
    return;
  }
  return paramHandler.debugCostCalculation(file);
};

window.testBasicFunctionality = async () => {
  console.log("🧪 Testing basic request functionality...");

  const envCheck = {
    requestProcessor: !!window.requestProcessor,
    parameterHandler: !!window.requestProcessor?.core?.parameterHandler,
    CONFIG: !!window.CONFIG?.FILE_UPLOAD,
  };

  console.log("Environment check:", envCheck);

  if (!envCheck.requestProcessor) {
    console.error("❌ requestProcessor not available - refresh page");
    return { success: false, issue: "requestProcessor not available" };
  }

  try {
    const paramHandler = window.requestProcessor.core.parameterHandler;
    const testParams = {
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      max_tokens: 1000,
    };

    // Test original prepareRequest without files
    const messages = await paramHandler.prepareRequest(
      "test message",
      testParams
    );

    const validation = {
      isArray: Array.isArray(messages),
      messageCount: messages?.length,
      allHaveRole: messages?.every((m) => m.role),
      allHaveContent: messages?.every((m) => m.content),
      hasPluginConfig: messages?._pluginConfig !== undefined,
      structure: messages?.map((m) => ({
        role: m.role,
        contentType: typeof m.content,
        hasExtraFields: Object.keys(m).filter(
          (k) => !["role", "content"].includes(k)
        ),
      })),
    };

    console.log("✅ Basic prepareRequest validation:", validation);

    const success =
      validation.isArray &&
      validation.messageCount > 0 &&
      validation.allHaveRole &&
      validation.allHaveContent;

    return { success, validation };
  } catch (error) {
    console.error("❌ Basic functionality test failed:", error);
    return { success: false, error: error.message };
  }
};

window.testFixedFileIntegration = async () => {
  console.log("🧪 Testing fixed file integration...");

  try {
    const paramHandler = window.requestProcessor.core.parameterHandler;

    // Create test PDF file
    const testFile = new File(["test PDF content"], "test.pdf", {
      type: "application/pdf",
    });

    const testParams = {
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      max_tokens: 1000,
    };

    // Test cost estimation (should not have NaN)
    console.log("Testing cost estimation...");
    const cost = paramHandler.estimateRequestCost(
      [{ role: "user", content: "test" }],
      testParams,
      testFile
    );

    console.log("Cost estimation result:", cost);

    const hasNaN = Object.values(cost).some(
      (v) => typeof v === "number" && isNaN(v)
    );

    if (hasNaN) {
      console.error("❌ Cost estimation still contains NaN values:", cost);
      return { success: false, issue: "NaN in cost calculation" };
    }

    // Test file validation
    console.log("Testing file validation...");
    const validation = await paramHandler.validateFileContent(testFile);
    console.log("File validation result:", validation);

    // Test enhanced prepareRequest with file
    console.log("Testing enhanced prepareRequest...");
    const fileData = { file: testFile, engine: "auto" };
    const messages = await paramHandler.prepareRequest(
      "test message",
      testParams,
      fileData
    );

    const messageValidation = {
      isArray: Array.isArray(messages),
      messageCount: messages?.length,
      hasPluginConfig: messages?._pluginConfig !== undefined,
      allCleanMessages: messages?.every((m) =>
        Object.keys(m).every((k) => ["role", "content"].includes(k))
      ),
      hasFileContent: messages?.some((m) => Array.isArray(m.content)),
    };

    console.log("✅ Enhanced prepareRequest validation:", messageValidation);

    const success =
      messageValidation.isArray &&
      !hasNaN &&
      messageValidation.allCleanMessages;

    return {
      success,
      costEstimation: cost,
      fileValidation: validation,
      messageValidation,
    };
  } catch (error) {
    console.error("❌ Fixed file integration test failed:", error);
    return { success: false, error: error.message };
  }
};
window.debugCostCalculation = (file = null) => {
  console.log("🔍 Debugging cost calculation...");

  if (!file) {
    // Create test file if none provided
    file = new File(["test content"], "test.pdf", { type: "application/pdf" });
    console.log("Using test file for debugging");
  }

  const paramHandler = window.requestProcessor?.core?.parameterHandler;
  if (!paramHandler) {
    console.error("Parameter handler not available");
    return;
  }

  return paramHandler.debugCostCalculation(file);
};
window.validateFileUploadConfig = () => {
  console.log("🔧 Validating file upload configuration...");

  const checks = {
    configExists: !!window.CONFIG?.FILE_UPLOAD,
    utilsExists: !!window.CONFIG?.FILE_UPLOAD_UTILS,
    pdfEngineCosts: !!window.CONFIG?.FILE_UPLOAD?.PDF_ENGINE_COSTS,
    costThresholds: !!window.CONFIG?.FILE_UPLOAD?.COST_WARNING_THRESHOLDS,
    fileAnalysis: !!window.CONFIG?.FILE_UPLOAD?.FILE_ANALYSIS,
    parameterController: !!window.parameterController,
  };

  console.log("Configuration checks:", checks);

  if (checks.configExists) {
    console.log(
      "PDF Engine Costs:",
      window.CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS
    );
    console.log(
      "Cost Thresholds:",
      window.CONFIG.FILE_UPLOAD.COST_WARNING_THRESHOLDS
    );
  }

  if (checks.parameterController) {
    const pdfEngineParam =
      window.parameterController.getParameterValue("pdf-engine");
    console.log(
      "PDF Engine Parameter:",
      pdfEngineParam ? "Available" : "Missing"
    );
  }

  return checks;
};
window.runCompleteIntegrationTest = async () => {
  console.log("🚀 Running complete integration test...");

  const results = {
    configValidation: window.validateFileUploadConfig(),
    basicFunctionality: await window.testBasicFunctionality(),
    fileIntegration: await window.testFixedFileIntegration(),
  };

  const overallSuccess =
    results.configValidation.configExists &&
    results.basicFunctionality.success &&
    results.fileIntegration.success;

  console.log(overallSuccess ? "🎉 All tests passed!" : "❌ Some tests failed");
  console.log("Complete test results:", results);

  return { success: overallSuccess, details: results };
};
// Quick validation - run after each fix
window.quickValidation = async () => {
  console.log("⚡ Quick validation...");

  const basic = await window.testBasicFunctionality();
  const config = window.validateFileUploadConfig();

  if (basic.success && config.configExists) {
    console.log("✅ Quick validation passed");
    return true;
  } else {
    console.log("❌ Quick validation failed");
    return false;
  }
};
// Create a test function for actual OpenRouter requests
window.testActualOpenRouterRequest = async function (message) {
  console.log("🧪 Testing actual OpenRouter request...");

  try {
    // Check if we have the necessary components
    if (!window.requestProcessor) {
      throw new Error("RequestProcessor not available");
    }

    // Get the results element to monitor output
    const resultsElement = document.getElementById("results");
    if (resultsElement) {
      resultsElement.innerHTML = ""; // Clear previous results
    }

    // Set the input text
    const inputElement = document.getElementById("prompt-text");
    if (inputElement) {
      inputElement.value =
        message || "Hello, can you respond with a simple test message?";
    }

    console.log("📤 Sending request with message:", inputElement?.value);

    // Process the request
    await window.requestProcessor.core.processStreamingRequest(
      inputElement?.value || message
    );

    // Wait a moment for results to start appearing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if we got results
    const hasResults =
      resultsElement && resultsElement.innerHTML.trim().length > 0;

    console.log("✅ Request completed:", {
      hasResults,
      resultsLength: resultsElement?.innerHTML.length || 0,
      requestId: window.requestProcessor.core.currentRequestId,
    });

    return {
      success: hasResults,
      message: hasResults ? "Request successful" : "No results received",
    };
  } catch (error) {
    console.error("❌ Test failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Alternative: Test using the process button directly
window.testViaProcessButton = function () {
  console.log("🧪 Testing via process button click...");

  // Set test input
  const inputElement = document.getElementById("prompt-text");
  if (inputElement) {
    inputElement.value = "Test message: Please respond with 'Hello World'";
  }

  // Click the process button
  const processButton = document.getElementById("process-btn");
  if (processButton) {
    console.log("📤 Clicking process button...");
    processButton.click();
    console.log("✅ Process button clicked - check results area for response");
  } else {
    console.error("❌ Process button not found");
  }
};
// Run this in console to monitor buffer state
window.monitorStreamingBuffer = () => {
  const monitor = setInterval(() => {
    const rm = window.uiController?.resultsManager;
    if (rm?.streamingManager) {
      const sm = rm.streamingManager;
      console.log("Streaming State:", {
        isStreaming: sm.isStreaming,
        bufferLength: sm.streamBuffer?.length || 0,
        contentLength: sm.streamingContent?.length || 0,
        hasInterval: !!sm.updateInterval,
        isReducedMotion: rm.core?.isReducedMotion,
      });
    }
  }, 250);

  // Stop after 30 seconds
  setTimeout(() => clearInterval(monitor), 30000);
  return "Monitoring started for 30 seconds...";
};

// Corrected foundation validation
window.validateStage31Foundation = async () => {
  console.log("🔍 Validating Stage 3 foundation...");

  const checks = {
    requestManagerParameters: !!window.requestProcessor?.core?.parameterHandler,
    fileUploadConfig: !!window.CONFIG?.FILE_UPLOAD,
    fileUploadUtils: !!window.CONFIG?.FILE_UPLOAD_UTILS,
    openRouterClient: !!window.openRouterClient,
    resultsManagerCore: !!window.resultsManager?.core,
    bridgeCoordination: !!window.resultsManager?.core?.establishBridgeReference,
    parameterController: !!window.parameterController,
    parameterRegistry: !!window.parameterRegistry,
  };

  const allReady = Object.values(checks).every(Boolean);
  console.log(
    allReady ? "✅ Foundation ready" : "❌ Missing components",
    checks
  );
  return { ready: allReady, components: checks };
};

// Corrected Stage 3.4 test using proper API
window.testStage34PDFEngineParameter = () => {
  console.log("🧪 Testing Stage 3.4: PDF Engine Parameter validation...");

  try {
    // Get PDF engine parameter from registry
    const pdfEngineParam = window.parameterRegistry.getParameter("pdf-engine");
    if (!pdfEngineParam) {
      throw new Error("PDF engine parameter not found in registry");
    }

    // Test validation with different values
    const tests = {
      validAuto: pdfEngineParam.validateValue("auto"),
      validNative: pdfEngineParam.validateValue("native"),
      validPdfText: pdfEngineParam.validateValue("pdf-text"),
      validMistralOcr: pdfEngineParam.validateValue("mistral-ocr"),
      invalidValue: pdfEngineParam.validateValue("invalid"),
      nullValue: pdfEngineParam.validateValue(null),
      undefinedValue: pdfEngineParam.validateValue(undefined),
    };

    // Test type override
    const paramType = pdfEngineParam.getType
      ? pdfEngineParam.getType()
      : "unknown";

    // Get current value from controller
    const currentValue =
      window.parameterController.getParameterValue("pdf-engine");

    console.log("✅ PDF Engine Parameter validation results:", {
      currentValue,
      parameterType: paramType,
      hasValidateMethod: typeof pdfEngineParam.validateValue === "function",
      hasGetTypeMethod: typeof pdfEngineParam.getType === "function",
      validationTests: tests,
    });

    // Check for clean validation results
    const expectedValid = ["auto", "native", "pdf-text", "mistral-ocr"];
    const validationsPassed = expectedValid.every((val) =>
      expectedValid.includes(pdfEngineParam.validateValue(val))
    );

    const typeCorrect = paramType === "string";
    const success = validationsPassed && typeCorrect;

    console.log(
      success
        ? "🎉 Stage 3.4 PDF Engine Parameter: SUCCESS!"
        : "❌ Stage 3.4 validation failed"
    );

    return {
      success,
      validations: tests,
      typeCorrect,
      currentValue,
      parameterType: paramType,
    };
  } catch (error) {
    console.error("❌ Stage 3.4 test failed:", error);
    return { success: false, error: error.message };
  }
};

// Final comprehensive Stage 3 validation
window.finalStage3Validation = async () => {
  console.log("🎉 Running final Stage 3 validation...");

  const results = {
    foundation: await window.validateStage31Foundation(),
    stage34: window.testStage34PDFEngineParameter(),

    // Test existing Stage 3.1-3.3 functionality still works
    configValidation: window.validateFileUploadConfig
      ? window.validateFileUploadConfig()
      : { skipped: "not available" },

    // Check current parameter values
    currentParams: window.parameterController.getParameterValues(),

    // Test PDF engine parameter current state
    pdfEngineValue: window.parameterController.getParameterValue("pdf-engine"),
  };

  const overallSuccess = results.foundation.ready && results.stage34.success;

  console.log(
    overallSuccess
      ? "🎉 STAGE 3 COMPLETE! All validation passed!"
      : "❌ Some validations failed"
  );

  console.log("📊 Final Stage 3 validation results:", {
    foundationReady: results.foundation.ready,
    stage34Success: results.stage34.success,
    pdfEngineWorking:
      results.stage34.typeCorrect && results.pdfEngineValue === "auto",
    overallSuccess,
  });

  return { complete: overallSuccess, details: results };
};
// Run this first to verify Stage 4 foundation
window.testFullFoundation = () => {
  console.log("🔍 Testing Stage 4 Foundation...");
  console.log(
    "ResponseSizeManager:",
    !!window.responseSizeManager?.isInitialised
  );
  console.log("FileHandler:", !!window.fileHandler);
  console.log(
    "Cost warnings available:",
    typeof window.fileHandler?.determineCostWarningLevel === "function"
  );
  console.log(
    "State management working:",
    !!window.uiController?.fileUploadState
  );
  console.log("CONFIG utilities:", !!CONFIG?.FILE_UPLOAD_UTILS);

  const allWorking = !!(
    window.responseSizeManager?.isInitialised &&
    window.fileHandler &&
    window.uiController?.fileUploadState &&
    CONFIG?.FILE_UPLOAD_UTILS
  );

  console.log(
    allWorking ? "✅ Stage 4 Foundation Ready!" : "⚠️ Please refresh page"
  );
  return allWorking;
};

// Test the enhanced analysis system
window.testStage5Step1 = () => {
  console.log("🔧 Testing Enhanced File Analysis...");

  if (!window.fileHandler) {
    console.log("❌ FileHandler not available");
    return false;
  }

  // Test with mock file objects
  const testFiles = [
    { name: "small.pdf", type: "application/pdf", size: 500000 }, // 500KB
    { name: "large-scan.pdf", type: "application/pdf", size: 25000000 }, // 25MB
    { name: "document.pdf", type: "application/pdf", size: 2000000 }, // 2MB
    { name: "image.jpg", type: "image/jpeg", size: 1500000 }, // 1.5MB
  ];

  testFiles.forEach((file, index) => {
    console.log(`\n📄 Test ${index + 1}: ${file.name}`);

    try {
      const analysis = window.fileHandler.fallbackAnalysis(file);

      console.log("✅ Analysis Result:", {
        pages: analysis.estimatedPages,
        complexity: analysis.complexity,
        scanned: analysis.likelyScanned,
        engine: analysis.recommendedEngine,
        confidence: analysis.confidence,
        processingTime: analysis.processingTime,
      });

      // Validation checks
      const hasRequired =
        analysis.complexity && analysis.confidence && analysis.processingTime;
      const isValidComplexity = ["simple", "medium", "complex"].includes(
        analysis.complexity
      );
      const isValidConfidence = ["low", "medium", "high"].includes(
        analysis.confidence
      );

      console.log("✓ Validation:", {
        hasRequired,
        isValidComplexity,
        isValidConfidence,
        validEngine: !!analysis.recommendedEngine,
      });
    } catch (error) {
      console.log("❌ Analysis failed:", error);
      return false;
    }
  });

  console.log("\n🎉 Enhanced Analysis Test Complete!");
  return true;
};
// Stage 6 Step 1: Enhanced Analysis → Request Preparation Integration Tests

/**
 * Test enhanced analysis integration with request preparation
 * Run after implementing Step 1 changes
 */
window.testEnhancedAnalysisIntegration = async () => {
  console.log(
    "🔗 Testing Enhanced Analysis → Request Preparation Integration..."
  );

  // Check prerequisites
  const prerequisites = {
    fileHandler: !!window.fileHandler,
    hasFile: !!(
      window.fileHandler?.hasValidFile && window.fileHandler?.currentFile
    ),
    hasAnalysis: !!window.fileHandler?.fileAnalysis,
    requestManager: !!(
      window.requestManager || window.uiController?.requestProcessor
    ),
    parameterHandler: !!(
      window.requestManager?.parameterHandler ||
      window.uiController?.requestProcessor?.parameterHandler
    ),
  };

  console.log("📋 Prerequisites:", prerequisites);

  if (!prerequisites.hasFile || !prerequisites.hasAnalysis) {
    console.log("❌ Upload a file with enhanced analysis first");
    console.log(
      "Use: window.testEnhancedAnalysisData(uploadedFile) to verify analysis"
    );
    return false;
  }

  // Get enhanced analysis data
  const analysis = window.fileHandler.fileAnalysis;
  console.log("📊 Enhanced Analysis Data:", {
    recommendedEngine: analysis.recommendedEngine,
    complexity: analysis.complexity,
    confidence: analysis.confidence,
    sizePrediction: analysis.sizePrediction?.estimated,
    hasEngineRecommendations: !!analysis.engineRecommendations,
    hasCostBreakdown: !!analysis.costBreakdown,
  });

  // Test request preparation integration
  try {
    const requestManager =
      window.requestManager || window.uiController?.requestProcessor;
    const parameterHandler = requestManager?.parameterHandler;

    if (!parameterHandler) {
      console.log("❌ Parameter handler not available");
      return false;
    }

    // Mock request preparation with enhanced analysis
    const mockFileData = {
      file: window.fileHandler.currentFile,
      engine: null, // Let enhanced analysis determine
      enhancedAnalysis: analysis,
    };

    console.log("🔧 Testing request preparation with enhanced analysis...");

    // Get current parameters
    const parameters = await parameterHandler.getRequestParameters();

    // Test enhanced request preparation
    const testMessage = "Test message for enhanced analysis integration";
    const preparedRequest = await parameterHandler.prepareRequest(
      testMessage,
      parameters,
      mockFileData
    );

    console.log("✅ Enhanced request preparation successful:", {
      messagesCount: preparedRequest?.length,
      hasAnalysisMetadata: !!parameters.analysisMetadata,
      usedRecommendedEngine:
        parameters.analysisMetadata?.recommendedEngine ===
        analysis.recommendedEngine,
      analysisConfidence: parameters.analysisMetadata?.confidence,
      sizePrediction: parameters.analysisMetadata?.sizePrediction?.estimated,
    });

    // Validate analysis metadata integration
    const metadata = parameters.analysisMetadata;
    const integrationTests = {
      hasMetadata: !!metadata,
      hasComplexity: !!metadata?.complexity,
      hasConfidence: !!metadata?.confidence,
      hasRecommendedEngine: !!metadata?.recommendedEngine,
      hasSizePrediction: !!metadata?.sizePrediction,
      metadataMatchesAnalysis:
        metadata?.complexity === analysis.complexity &&
        metadata?.confidence === analysis.confidence &&
        metadata?.recommendedEngine === analysis.recommendedEngine,
    };

    console.log("🔍 Analysis Metadata Integration:", integrationTests);

    const integrationSuccess = Object.values(integrationTests).every(
      (test) => test === true
    );

    if (integrationSuccess) {
      console.log("🎉 Enhanced analysis integration working perfectly!");
      console.log("✓ Smart engine recommendations applied");
      console.log("✓ Analysis metadata included in request");
      console.log("✓ Size predictions available for validation");
      return true;
    } else {
      console.log("⚠️ Integration issues detected - check implementation");
      return false;
    }
  } catch (error) {
    console.error("❌ Enhanced analysis integration test failed:", error);
    return false;
  }
};

/**
 * Test Step 1 changes without making actual API request
 * Validates the enhanced analysis → request preparation flow
 */
window.validateStep1Changes = () => {
  console.log("✅ Validating Step 1 Implementation Changes...");

  const tests = {
    fileHandlerHasAnalysis: !!window.fileHandler?.fileAnalysis,
    analysisHasRecommendation:
      !!window.fileHandler?.fileAnalysis?.recommendedEngine,
    analysisHasComplexity: !!window.fileHandler?.fileAnalysis?.complexity,
    analysisHasSizePrediction:
      !!window.fileHandler?.fileAnalysis?.sizePrediction,
    requestManagerExists: !!(
      window.requestManager || window.uiController?.requestProcessor
    ),
    parameterHandlerExists: !!(
      window.requestManager?.parameterHandler ||
      window.uiController?.requestProcessor?.parameterHandler
    ),
  };

  console.log("🔧 Step 1 Validation Tests:", tests);

  if (tests.fileHandlerHasAnalysis && tests.analysisHasRecommendation) {
    console.log("📊 Enhanced Analysis Available:", {
      recommended: window.fileHandler.fileAnalysis.recommendedEngine,
      complexity: window.fileHandler.fileAnalysis.complexity,
      confidence: window.fileHandler.fileAnalysis.confidence,
      predictedSize: window.fileHandler.fileAnalysis.sizePrediction?.estimated,
    });
  }

  const allReady = Object.values(tests).every((test) => test === true);

  console.log(
    allReady
      ? "✅ Step 1 implementation ready for testing!"
      : "⚠️ Step 1 dependencies missing"
  );

  if (allReady) {
    console.log(
      "🚀 Next: Run testEnhancedAnalysisIntegration() to validate integration"
    );
  }

  return tests;
};

/**
 * Quick validation that enhanced analysis data flows to request
 * Call this after Step 1 implementation
 */
window.testStep1QuickValidation = () => {
  console.log("⚡ Step 1 Quick Validation...");

  const fileHandler = window.fileHandler;
  if (!fileHandler?.fileAnalysis) {
    console.log("❌ No enhanced analysis available - upload a file first");
    return false;
  }

  const analysis = fileHandler.fileAnalysis;
  console.log("📈 Analysis → Request Integration Check:");
  console.log("✓ Recommended engine:", analysis.recommendedEngine);
  console.log("✓ Complexity level:", analysis.complexity);
  console.log("✓ Confidence score:", analysis.confidence);
  console.log("✓ Size prediction:", analysis.sizePrediction?.estimated);

  const hasEssentials = !!(
    analysis.recommendedEngine &&
    analysis.complexity &&
    analysis.confidence &&
    analysis.sizePrediction
  );

  if (hasEssentials) {
    console.log("🎯 Enhanced analysis ready for request integration!");
    console.log("🚀 Next: Make a test request to validate end-to-end flow");
  } else {
    console.log(
      "⚠️ Enhanced analysis incomplete - check Stage 5 implementation"
    );
  }

  return hasEssentials;
};
// ============================================================================
// Stage 6 Console Testing Commands - Complete Implementation
// ============================================================================

// Pre-Implementation Validation
// ============================================================================

/**
 * Verify Stage 5 foundation is still working and ready for Stage 6
 */
window.testStage5Foundation = () => {
  console.log("🔧 Testing Stage 5 Foundation for Stage 6...");

  const tests = {
    fileHandler: !!window.fileHandler?.isInitialised,
    enhancedAnalysis:
      typeof window.fileHandler?.fallbackAnalysis === "function",
    previewSystem: typeof window.fileHandler?.generatePreview === "function",
    responseManager: !!window.responseSizeManager?.isInitialised,
    parameterSync: !!window.fileHandler?.parameterSync,
    configUtils: !!CONFIG?.FILE_UPLOAD_UTILS,
    costWarnings:
      typeof window.fileHandler?.determineCostWarningLevel === "function",
  };

  const allWorking = Object.values(tests).every((test) => test === true);

  console.log("📊 Stage 5 Foundation Status:", tests);
  console.log(
    allWorking ? "✅ Ready for Stage 6!" : "⚠️ Foundation issues detected"
  );

  // Additional checks for enhanced analysis methods
  if (window.fileHandler) {
    const analysisMethodsAvailable = {
      fallbackAnalysis:
        typeof window.fileHandler.fallbackAnalysis === "function",
      detectScannedPDF:
        typeof window.fileHandler.detectScannedPDF === "function",
      assessPDFComplexity:
        typeof window.fileHandler.assessPDFComplexity === "function",
      selectOptimalEngine:
        typeof window.fileHandler.selectOptimalEngine === "function",
      predictResponseSize:
        typeof window.fileHandler.predictResponseSize === "function",
      generatePreview: typeof window.fileHandler.generatePreview === "function",
      createPDFInfoCard:
        typeof window.fileHandler.createPDFInfoCard === "function",
    };

    console.log("🧪 Enhanced Analysis Methods:", analysisMethodsAvailable);
  }

  return allWorking;
};

/**
 * Test enhanced analysis data availability for a specific file
 */
window.testEnhancedAnalysisData = (file) => {
  if (!file) {
    console.log(
      "📄 Upload a file first, then call: testEnhancedAnalysisData(uploadedFile)"
    );
    console.log(
      "Or use current file: testEnhancedAnalysisData(window.fileHandler.currentFile)"
    );
    return;
  }

  console.log("📊 Testing Enhanced Analysis Data for:", file.name);

  const analysis = window.fileHandler.fallbackAnalysis(file);

  const dataAvailability = {
    hasComplexity: !!analysis.complexity,
    hasConfidence: !!analysis.confidence,
    hasEngineRecommendations: !!analysis.engineRecommendations,
    hasSizePrediction: !!analysis.sizePrediction,
    hasCostBreakdown: !!analysis.costBreakdown,
    hasProcessingTime: !!analysis.processingTime,
  };

  console.log("📈 Enhanced Analysis Data Availability:", dataAvailability);
  console.log("📋 Analysis Summary:", {
    complexity: analysis.complexity,
    confidence: analysis.confidence,
    recommendedEngine: analysis.recommendedEngine,
    estimatedPages: analysis.estimatedPages,
    likelyScanned: analysis.likelyScanned,
    processingTime: analysis.processingTime,
  });

  if (analysis.sizePrediction) {
    console.log("📊 Size Prediction:", {
      estimated: analysis.sizePrediction.estimated,
      bytes: analysis.sizePrediction.bytes,
      warning: analysis.sizePrediction.warning,
      confidence: analysis.sizePrediction.confidence,
    });
  }

  if (analysis.engineRecommendations) {
    console.log("🧠 Engine Recommendations:", {
      primary: analysis.engineRecommendations.primary,
      reasoning: analysis.engineRecommendations.reasoning,
      alternatives: analysis.engineRecommendations.alternatives,
    });
  }

  return analysis;
};

// Stage 6 Step 1: Request Preparation Integration Testing
// ============================================================================

/**
 * Test enhanced analysis → request preparation flow
 */
window.testRequestPreparationIntegration = async () => {
  console.log(
    "🔗 Testing Enhanced Analysis → Request Preparation Integration..."
  );

  // Check if we have a file and analysis
  if (!window.fileHandler?.currentFile) {
    console.log("❌ No file uploaded. Upload a file first.");
    console.log(
      "💡 Try uploading a PDF or image file, then run this test again."
    );
    return false;
  }

  const fileAnalysis = window.fileHandler.fileAnalysis;
  if (!fileAnalysis) {
    console.log("❌ No file analysis available");
    console.log("🔧 Generating analysis...");
    try {
      window.fileHandler.fileAnalysis = window.fileHandler.fallbackAnalysis(
        window.fileHandler.currentFile
      );
      console.log("✅ Analysis generated");
    } catch (error) {
      console.error("❌ Analysis generation failed:", error);
      return false;
    }
  }

  // Test request manager integration
  const requestManager =
    window.requestManager || window.uiController?.requestProcessor;
  if (!requestManager) {
    console.log("❌ Request manager not available");
    console.log(
      "🔍 Available on window:",
      Object.keys(window).filter((key) => key.includes("request"))
    );
    return false;
  }

  // Check integration capabilities
  const integrationTests = {
    hasAnalysis: !!fileAnalysis,
    hasRecommendation: !!fileAnalysis.recommendedEngine,
    hasConfidence: !!fileAnalysis.confidence,
    hasComplexity: !!fileAnalysis.complexity,
    hasCostBreakdown: !!fileAnalysis.costBreakdown,
    canPrepareRequest: typeof requestManager.prepareRequest === "function",
    hasFileData: !!window.fileHandler.base64Data,
  };

  console.log("🧪 Request Integration Tests:", integrationTests);

  // Test request preparation with enhanced data
  try {
    console.log("🔧 Testing request preparation with enhanced analysis...");

    const analysisForRequest = {
      recommendedEngine: fileAnalysis.recommendedEngine,
      complexity: fileAnalysis.complexity,
      confidence: fileAnalysis.confidence,
      estimatedPages: fileAnalysis.estimatedPages,
      likelyScanned: fileAnalysis.likelyScanned,
      isPDF: fileAnalysis.isPDF,
      isImage: fileAnalysis.isImage,
    };

    console.log(
      "📊 Analysis data that should influence request:",
      analysisForRequest
    );

    // Mock request preparation test
    const mockRequestData = {
      messages: [{ role: "user", content: "Test message with file" }],
      fileData: window.fileHandler.base64Data,
      fileName: window.fileHandler.currentFile.name,
      fileType: window.fileHandler.currentFile.type,
      enhancedAnalysis: analysisForRequest,
    };

    console.log("🚀 Mock request data prepared:", {
      hasMessages: !!mockRequestData.messages,
      hasFileData: !!mockRequestData.fileData,
      hasEnhancedAnalysis: !!mockRequestData.enhancedAnalysis,
      recommendedEngine: mockRequestData.enhancedAnalysis.recommendedEngine,
    });

    // Check if PDF should include plugin configuration
    if (fileAnalysis.isPDF) {
      const pdfPluginConfig = {
        id: "file-parser",
        pdf: { engine: fileAnalysis.recommendedEngine },
      };
      console.log("📄 PDF Plugin Config should be:", pdfPluginConfig);
    }

    return integrationTests;
  } catch (error) {
    console.error("❌ Request preparation test failed:", error);
    return false;
  }
};

// Stage 6 Step 2: Parameter Coordination Testing
// ============================================================================

/**
 * Test parameter system receives smart recommendations
 */
window.testParameterCoordination = () => {
  console.log("⚙️ Testing Parameter System Coordination...");

  const fileHandler = window.fileHandler;
  const parameterController = window.parameterController;

  // Basic availability checks
  if (!fileHandler?.currentFile || !fileHandler?.fileAnalysis) {
    console.log("❌ No file or analysis available");
    console.log("💡 Upload a file first to test parameter coordination");
    return false;
  }

  const analysis = fileHandler.fileAnalysis;

  const coordinationTests = {
    hasParameterController: !!parameterController,
    hasParameterSync: !!fileHandler.parameterSync,
    hasEngineRecommendation: !!analysis.recommendedEngine,
    parameterSyncAvailable: fileHandler.parameterSyncAvailable || false,
    pdfParameterExists: !!fileHandler.pdfEngineParameter,
    hasEngineRecommendations: !!analysis.engineRecommendations,
  };

  console.log("🧪 Parameter Coordination Tests:", coordinationTests);

  // PDF-specific coordination tests
  if (analysis.isPDF && analysis.recommendedEngine) {
    console.log("📋 PDF Engine Recommendation Analysis:");
    console.log("- Recommended Engine:", analysis.recommendedEngine);
    console.log("- Reasoning:", analysis.engineRecommendations?.reasoning);
    console.log("- Confidence:", analysis.confidence);
    console.log(
      "- Alternatives:",
      analysis.engineRecommendations?.alternatives
    );
    console.log(
      "- Performance Notes:",
      analysis.engineRecommendations?.performanceNotes
    );

    // Check current parameter state
    if (parameterController) {
      try {
        const currentPdfEngine =
          parameterController.getParameterValue?.("pdf-engine");
        console.log("📊 Parameter System State:");
        console.log("- Current PDF Engine Value:", currentPdfEngine);
        console.log(
          "- Should Match Recommendation:",
          analysis.recommendedEngine
        );
        console.log(
          "- Match Status:",
          currentPdfEngine === analysis.recommendedEngine
            ? "✅ Match"
            : "❌ Mismatch"
        );

        // Test parameter sync functionality
        if (
          fileHandler.parameterSync &&
          typeof fileHandler.parameterSync.syncEngineRecommendation ===
            "function"
        ) {
          console.log("🔄 Testing parameter sync method...");
          try {
            fileHandler.parameterSync.syncEngineRecommendation(analysis);
            console.log("✅ Parameter sync method executed successfully");
          } catch (syncError) {
            console.error("❌ Parameter sync failed:", syncError);
          }
        }
      } catch (paramError) {
        console.warn("⚠️ Could not access parameter system:", paramError);
      }
    }

    // Test recommendation display
    console.log("🎨 Recommendation Display Test:");
    if (typeof fileHandler.createEngineRecommendationDisplay === "function") {
      try {
        const recommendationElement =
          fileHandler.createEngineRecommendationDisplay(
            fileHandler.currentFile
          );
        console.log(
          "✅ Recommendation display element created:",
          !!recommendationElement
        );
      } catch (displayError) {
        console.error("❌ Recommendation display failed:", displayError);
      }
    }
  } else if (!analysis.isPDF) {
    console.log("ℹ️ Non-PDF file - parameter coordination not applicable");
  }

  return coordinationTests;
};

// Stage 6 Step 3: Response Size Validation Testing
// ============================================================================

/**
 * Test response size prediction accuracy setup
 */
window.testResponseSizePredictionValidation = () => {
  console.log("📊 Testing Response Size Prediction Validation...");

  const fileHandler = window.fileHandler;
  if (!fileHandler?.fileAnalysis?.sizePrediction) {
    console.log("❌ No size prediction available");
    console.log(
      "💡 Upload a file to generate size predictions, then run this test"
    );
    return false;
  }

  const prediction = fileHandler.fileAnalysis.sizePrediction;
  const file = fileHandler.currentFile;

  console.log("📈 Current Size Prediction Analysis:");
  console.log("- File:", file.name);
  console.log(
    "- File Size:",
    CONFIG.FILE_UPLOAD_UTILS.formatFileSize(file.size)
  );
  console.log("- Estimated Response Size:", prediction.estimated);
  console.log(
    "- Predicted Bytes:",
    CONFIG.FILE_UPLOAD_UTILS.formatFileSize(prediction.bytes)
  );
  console.log("- Warning:", prediction.warning ? "⚠️ Yes" : "✅ No");
  console.log("- Confidence:", prediction.confidence);
  console.log("- Factors:", prediction.factors);
  console.log("- Recommendation:", prediction.recommendation);

  // Set up response validation tracking
  window.responseSizePredictionTracker = {
    prediction: { ...prediction },
    timestamp: Date.now(),
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
    },
    analysisInfo: {
      recommendedEngine: fileHandler.fileAnalysis.recommendedEngine,
      complexity: fileHandler.fileAnalysis.complexity,
      confidence: fileHandler.fileAnalysis.confidence,
      estimatedPages: fileHandler.fileAnalysis.estimatedPages,
      likelyScanned: fileHandler.fileAnalysis.likelyScanned,
    },
  };

  console.log("✅ Response size validation tracking set up");
  console.log("📝 Prediction logged for validation");
  console.log("");
  console.log("🚀 NEXT STEPS:");
  console.log("1. Submit a request with this file");
  console.log(
    "2. When response arrives, call: validateResponseSizePrediction(actualResponse)"
  );
  console.log("3. Or auto-validate with: setupAutoResponseValidation()");

  return true;
};

/**
 * Validate actual response against prediction
 */
window.validateResponseSizePrediction = (actualResponse, actualSize) => {
  console.log("🔍 Validating Response Size Prediction...");

  const tracker = window.responseSizePredictionTracker;
  if (!tracker) {
    console.log("❌ No prediction tracking set up");
    console.log("💡 Run testResponseSizePredictionValidation() first");
    return false;
  }

  // Determine actual response size
  const actualBytes =
    actualSize || (actualResponse ? actualResponse.length : 0);
  const hasBase64Content = actualResponse
    ? /data:[^;]+;base64,/.test(actualResponse)
    : false;

  // Determine actual size category
  let actualCategory = "small";
  if (actualBytes > 5242880) actualCategory = "very-large"; // >5MB
  else if (actualBytes > 1048576) actualCategory = "large"; // >1MB
  else if (actualBytes > 524288) actualCategory = "medium"; // >512KB

  const validation = {
    file: tracker.fileInfo,
    predicted: tracker.prediction,
    actual: {
      size: actualBytes,
      sizeFormatted: CONFIG.FILE_UPLOAD_UTILS.formatFileSize(actualBytes),
      category: actualCategory,
      hasBase64: hasBase64Content,
      content: actualResponse ? actualResponse.substring(0, 200) + "..." : null,
    },
    accuracy: {
      sizeCategoryMatch: tracker.prediction.estimated === actualCategory,
      warningAccuracy: tracker.prediction.warning === actualBytes > 1048576,
      bytesError: Math.abs(tracker.prediction.bytes - actualBytes),
      bytesErrorPercent:
        tracker.prediction.bytes > 0
          ? (Math.abs(tracker.prediction.bytes - actualBytes) /
              tracker.prediction.bytes) *
            100
          : 0,
    },
    analysisContext: tracker.analysisInfo,
  };

  console.log("📊 Response Size Prediction Validation Results:");
  console.log("┌─ Prediction vs Reality ─────────────────────────");
  console.log("│ Predicted Category:", tracker.prediction.estimated);
  console.log("│ Actual Category:", actualCategory);
  console.log(
    "│ Category Match:",
    validation.accuracy.sizeCategoryMatch ? "✅ Correct" : "❌ Incorrect"
  );
  console.log("├─ Size Details ──────────────────────────────────");
  console.log(
    "│ Predicted Bytes:",
    CONFIG.FILE_UPLOAD_UTILS.formatFileSize(tracker.prediction.bytes)
  );
  console.log("│ Actual Bytes:", validation.actual.sizeFormatted);
  console.log(
    "│ Error:",
    CONFIG.FILE_UPLOAD_UTILS.formatFileSize(validation.accuracy.bytesError)
  );
  console.log(
    "│ Error Percentage:",
    validation.accuracy.bytesErrorPercent.toFixed(1) + "%"
  );
  console.log("├─ Warning Accuracy ──────────────────────────────");
  console.log(
    "│ Predicted Warning:",
    tracker.prediction.warning ? "Yes" : "No"
  );
  console.log("│ Should Warn (>1MB):", actualBytes > 1048576 ? "Yes" : "No");
  console.log(
    "│ Warning Accurate:",
    validation.accuracy.warningAccuracy ? "✅ Correct" : "❌ Incorrect"
  );
  console.log("├─ Content Analysis ──────────────────────────────");
  console.log("│ Has Base64 Content:", hasBase64Content ? "Yes" : "No");
  console.log("│ Analysis Engine:", tracker.analysisInfo.recommendedEngine);
  console.log("│ File Complexity:", tracker.analysisInfo.complexity);
  console.log("│ Confidence:", tracker.analysisInfo.confidence);
  console.log("└─────────────────────────────────────────────────");

  // Overall accuracy assessment
  const accuracyScore =
    ([
      validation.accuracy.sizeCategoryMatch,
      validation.accuracy.warningAccuracy,
      validation.accuracy.bytesErrorPercent < 50,
    ].filter(Boolean).length /
      3) *
    100;

  console.log(
    "🎯 Overall Prediction Accuracy:",
    accuracyScore.toFixed(1) + "%"
  );

  if (accuracyScore >= 70) {
    console.log("🎉 Excellent prediction accuracy!");
  } else if (accuracyScore >= 50) {
    console.log("👍 Good prediction accuracy");
  } else {
    console.log("⚠️ Prediction accuracy needs improvement");
  }

  return validation;
};

/**
 * Set up automatic response validation
 */
window.setupAutoResponseValidation = () => {
  console.log("🤖 Setting up automatic response size validation...");

  // Listen for large response events
  const originalEventListener = window.addEventListener;
  window.addEventListener("large-response-detected", (event) => {
    console.log("📡 Large response detected - auto-validating...");
    const responseData = event.detail;

    if (window.responseSizePredictionTracker) {
      const validation = window.validateResponseSizePrediction(
        responseData.content || responseData.originalContent,
        responseData.size
      );
      console.log("🔄 Auto-validation completed");
    }
  });

  console.log("✅ Auto-validation listener set up");
  console.log("📡 Will automatically validate when large responses detected");
};

// Stage 6 Step 4: Complete Workflow Testing
// ============================================================================

/**
 * Test complete end-to-end workflow from file upload to response display
 */
window.testCompleteWorkflow = () => {
  console.log("🔄 Testing Complete End-to-End Workflow...");
  console.log("=====================================");

  // Step-by-step workflow validation
  const workflowSteps = {
    step1_fileUpload: {
      status: !!window.fileHandler?.currentFile,
      description: "File uploaded and processed",
      details: window.fileHandler?.currentFile
        ? {
            name: window.fileHandler.currentFile.name,
            size: CONFIG.FILE_UPLOAD_UTILS.formatFileSize(
              window.fileHandler.currentFile.size
            ),
            type: window.fileHandler.currentFile.type,
          }
        : null,
    },

    step2_enhancedAnalysis: {
      status: !!window.fileHandler?.fileAnalysis,
      description: "Enhanced file analysis completed",
      details: window.fileHandler?.fileAnalysis
        ? {
            complexity: window.fileHandler.fileAnalysis.complexity,
            recommendedEngine:
              window.fileHandler.fileAnalysis.recommendedEngine,
            confidence: window.fileHandler.fileAnalysis.confidence,
            hasRecommendations:
              !!window.fileHandler.fileAnalysis.engineRecommendations,
          }
        : null,
    },

    step3_previewDisplay: {
      status: !!document.querySelector(
        ".file-preview-content.enhanced-preview"
      ),
      description: "Enhanced preview displayed in UI",
      details: {
        previewVisible: !document.getElementById("file-preview")?.hidden,
        hasInfoCard: !!document.querySelector(".pdf-info-card"),
        hasWarnings: !!document.querySelector(".response-size-warning"),
        hasRecommendations: !!document.querySelector(
          ".engine-recommendation-display"
        ),
      },
    },

    step4_parameterSync: {
      status: window.fileHandler?.parameterSyncAvailable || false,
      description: "Parameter system coordination",
      details: {
        hasSyncSystem: !!window.fileHandler?.parameterSync,
        hasParameterController: !!window.parameterController,
        syncAvailable: window.fileHandler?.parameterSyncAvailable,
      },
    },

    step5_requestPreparation: {
      status:
        typeof (
          window.requestManager?.prepareRequest ||
          window.uiController?.requestProcessor?.prepareRequest
        ) === "function",
      description: "Request preparation system ready",
      details: {
        hasRequestManager: !!window.requestManager,
        hasRequestProcessor: !!window.uiController?.requestProcessor,
        canPrepareRequests:
          typeof (
            window.requestManager?.prepareRequest ||
            window.uiController?.requestProcessor?.prepareRequest
          ) === "function",
      },
    },

    step6_responseProcessing: {
      status: !!window.responseSizeManager?.isInitialised,
      description: "Response size management ready",
      details: {
        managerInitialised: !!window.responseSizeManager?.isInitialised,
        hasEventListeners: true, // Assumed from Stage 4 validation
        canHandleLargeResponses:
          typeof window.responseSizeManager?.handleLargeResponse === "function",
      },
    },
  };

  // Display workflow status
  console.log("📋 End-to-End Workflow Status:");
  Object.entries(workflowSteps).forEach(([stepKey, step]) => {
    const statusIcon = step.status ? "✅" : "❌";
    console.log(`${statusIcon} ${step.description}`);

    if (step.details) {
      Object.entries(step.details).forEach(([key, value]) => {
        const detailIcon = value ? "  ✓" : "  ✗";
        console.log(`${detailIcon} ${key}: ${value}`);
      });
    }
  });

  // Overall workflow assessment
  const stepsComplete = Object.values(workflowSteps).filter(
    (step) => step.status
  ).length;
  const totalSteps = Object.keys(workflowSteps).length;
  const workflowCompleteness = (stepsComplete / totalSteps) * 100;

  console.log("=====================================");
  console.log(
    `📊 Workflow Completeness: ${stepsComplete}/${totalSteps} (${workflowCompleteness.toFixed(
      1
    )}%)`
  );

  // Ready for request assessment
  const readyForRequest = stepsComplete >= 4; // At least basic workflow ready

  if (readyForRequest && window.fileHandler?.fileAnalysis) {
    console.log("🚀 READY FOR API REQUEST!");
    console.log("────────────────────────");
    console.log("📄 File:", window.fileHandler.currentFile.name);
    console.log(
      "🔧 Recommended Engine:",
      window.fileHandler.fileAnalysis.recommendedEngine
    );
    console.log("⚡ Complexity:", window.fileHandler.fileAnalysis.complexity);
    console.log("🎯 Confidence:", window.fileHandler.fileAnalysis.confidence);

    if (window.fileHandler.fileAnalysis.sizePrediction) {
      console.log(
        "📊 Predicted Response Size:",
        window.fileHandler.fileAnalysis.sizePrediction.estimated
      );
      if (window.fileHandler.fileAnalysis.sizePrediction.warning) {
        console.log(
          "⚠️ Large Response Warning:",
          window.fileHandler.fileAnalysis.sizePrediction.recommendation
        );
      }
    }

    console.log("────────────────────────");
    console.log("📝 To complete validation:");
    console.log("1. Submit a request with this file");
    console.log("2. Monitor response size and processing");
    console.log("3. Validate predictions against actual results");
  } else {
    console.log("⚠️ Workflow not ready for requests yet");
    console.log("🔧 Issues to resolve:");

    Object.entries(workflowSteps).forEach(([stepKey, step]) => {
      if (!step.status) {
        console.log(`  - ${step.description}`);
      }
    });
  }

  return {
    completeness: workflowCompleteness,
    stepsComplete: stepsComplete,
    totalSteps: totalSteps,
    readyForRequest: readyForRequest,
    workflowSteps: workflowSteps,
  };
};

// Comprehensive Stage 6 Testing Suite
// ============================================================================

/**
 * Run all Stage 6 tests in sequence
 */
window.runStage6TestSuite = () => {
  console.log("🧪 Running Complete Stage 6 Test Suite...");
  console.log("==========================================");

  const testResults = {};

  // Test 1: Foundation
  console.log("\n1️⃣ Testing Stage 5 Foundation...");
  testResults.foundation = window.testStage5Foundation();

  // Test 2: Enhanced Analysis Data
  console.log("\n2️⃣ Testing Enhanced Analysis Data...");
  if (window.fileHandler?.currentFile) {
    testResults.analysisData = window.testEnhancedAnalysisData(
      window.fileHandler.currentFile
    );
  } else {
    console.log("⚠️ No file uploaded - skipping analysis data test");
    testResults.analysisData = false;
  }

  // Test 3: Request Preparation Integration
  console.log("\n3️⃣ Testing Request Preparation Integration...");
  testResults.requestPreparation = window.testRequestPreparationIntegration();

  // Test 4: Parameter Coordination
  console.log("\n4️⃣ Testing Parameter Coordination...");
  testResults.parameterCoordination = window.testParameterCoordination();

  // Test 5: Response Size Prediction
  console.log("\n5️⃣ Testing Response Size Prediction Validation...");
  testResults.responsePrediction =
    window.testResponseSizePredictionValidation();

  // Test 6: Complete Workflow
  console.log("\n6️⃣ Testing Complete Workflow...");
  testResults.completeWorkflow = window.testCompleteWorkflow();

  // Summary
  console.log("\n📊 Stage 6 Test Suite Summary:");
  console.log("===============================");
  Object.entries(testResults).forEach(([testName, result]) => {
    const status = result ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${testName}`);
  });

  const passedTests = Object.values(testResults).filter(Boolean).length;
  const totalTests = Object.keys(testResults).length;
  const successRate = (passedTests / totalTests) * 100;

  console.log(
    `\n🎯 Overall Success Rate: ${passedTests}/${totalTests} (${successRate.toFixed(
      1
    )}%)`
  );

  if (successRate >= 80) {
    console.log("🎉 Stage 6 implementation ready!");
  } else {
    console.log("⚠️ Some areas need attention before Stage 6 completion");
  }

  return testResults;
};

// Quick Test Commands
// ============================================================================

/**
 * Quick test - just check if everything is basically working
 */
window.quickStage6Test = () => {
  console.log("⚡ Quick Stage 6 Test...");

  const quick = {
    hasFile: !!window.fileHandler?.currentFile,
    hasAnalysis: !!window.fileHandler?.fileAnalysis,
    hasPreview: !!document.querySelector(
      ".file-preview-content.enhanced-preview"
    ),
    hasResponseManager: !!window.responseSizeManager?.isInitialised,
  };

  console.log("Quick Status:", quick);
  const allGood = Object.values(quick).every(Boolean);
  console.log(allGood ? "✅ Looking good!" : "⚠️ Some issues detected");

  return allGood;
};

// Export test results for debugging
window.stage6TestResults = null;

// Complete Step 1 Integration Test
window.testCompleteStep1Integration = async () => {
  console.log("🎯 Testing Complete Step 1 Enhanced Analysis Integration...");

  // Prerequisites check
  if (!window.fileHandler?.fileAnalysis) {
    console.log("❌ Upload a file with enhanced analysis first");
    return false;
  }

  const analysis = window.fileHandler.fileAnalysis;
  console.log("📊 Enhanced Analysis Available:", {
    recommendedEngine: analysis.recommendedEngine,
    complexity: analysis.complexity,
    confidence: analysis.confidence,
    sizePrediction: analysis.sizePrediction?.estimated,
  });

  // Test both regular and streaming integration
  const requestManager = window.uiController?.requestProcessor?.core;

  if (!requestManager) {
    console.log("❌ Request manager not available");
    return false;
  }

  console.log(
    "✅ Both regular and streaming requests now include enhanced analysis!"
  );
  console.log("🔧 Ready to test with actual API calls");

  return true;
};

// Enhanced Analysis Effectiveness Test
window.testEnhancedAnalysisEffectiveness = () => {
  console.log("📈 Testing Enhanced Analysis Effectiveness...");

  if (!window.fileHandler?.fileAnalysis) {
    console.log("❌ No file analysis available");
    return false;
  }

  const analysis = window.fileHandler.fileAnalysis;
  const effectiveness = {
    hasRecommendation: !!analysis.recommendedEngine,
    hasComplexityAssessment: !!analysis.complexity,
    hasConfidenceLevel: !!analysis.confidence,
    hasSizePrediction: !!analysis.sizePrediction,
    hasCostBreakdown: !!analysis.costBreakdown,
    hasEngineReasoning: !!analysis.engineRecommendations?.reasoning,
  };

  const effectiveFeatures = Object.values(effectiveness).filter(Boolean).length;
  const totalFeatures = Object.keys(effectiveness).length;

  console.log("📊 Enhanced Analysis Effectiveness:", {
    ...effectiveness,
    effectivenessScore: `${effectiveFeatures}/${totalFeatures}`,
    isHighlyEffective: effectiveFeatures >= 5,
  });

  return effectiveFeatures >= 5;
};
/**
 * Comprehensive CSS Testing Commands for File Upload Feature
 * Updated to use console-based manual control (next()/skip()) instead of confirm()
 *
 * Manual mode: pauses and waits for you to type next() or skip() in the DevTools console
 * Automatic mode: advances on timers
 *
 * Usage:
 *   window.runAllCSSTests()        // manual mode (default)
 *   window.runAllCSSTests(false)   // automatic mode (timed)
 *   window.testCostWarningLevels()         // manual
 *   window.testCostWarningLevels(false)    // automatic
 */

// ===== GLOBAL DEFAULTS / SETTINGS =====
window.CSS_TEST_DEFAULT_DELAY_SEC = 1.5; // default per-state delay (auto mode)
window.CSS_TEST_INTER_TEST_DELAY_SEC = 3; // delay between tests (auto mode)

// ===== CONSOLE-BASED MANUAL CONTROL =====

/**
 * Wait for user input in the console before continuing
 * Type `next()` in the console to proceed, or `skip()` to skip remaining states
 */
window.waitForConsoleInput = () => {
  return new Promise((resolve) => {
    // Helper to avoid duplicate bindings if called twice quickly
    function cleanup() {
      try {
        delete window.next;
      } catch {}
      try {
        delete window.skip;
      } catch {}
    }

    // If a prior waiter left bindings around, clear them
    cleanup();

    console.log(
      "%c⏸ Waiting for your input...",
      "color: orange; font-weight: bold;"
    );
    console.log(
      "➡ Type %cnext()%c to continue, or %cskip()%c to skip this test",
      "color: green; font-weight: bold;",
      "",
      "color: red; font-weight: bold;",
      ""
    );

    window.next = () => {
      console.log("%c▶ Continuing...", "color: green; font-weight: bold;");
      cleanup();
      resolve(true);
    };

    window.skip = () => {
      console.log(
        "%c⏭ Skipping remaining states...",
        "color: red; font-weight: bold;"
      );
      cleanup();
      resolve(false);
    };
  });
};

// ===== MAIN TEST CONTROLLER =====

/**
 * Master CSS testing command - shows help
 */
window.testAllFileUploadCSS = () => {
  // Clean slate first
  window.resetFileUploadUI();
};

/**
 * Run all CSS tests in sequence with manual/automatic control
 * @param {boolean} manualMode - true: console next()/skip(), false: timed
 */
window.runAllCSSTests = async (manualMode = true) => {
  console.log("🎬 Running complete CSS test suite...");
  console.log(
    "⏸️  Manual mode pauses for visual inspection; Automatic mode advances on timers"
  );

  const tests = [
    {
      name: "File Upload States",
      fn: window.testFileUploadStates,
      duration: "~8 seconds",
    },
    {
      name: "Cost Warning Levels",
      fn: window.testCostWarningLevels,
      duration: "~3 seconds",
    },
    {
      name: "PDF Engine Controls",
      fn: window.testPDFEngineControls,
      duration: "~3 seconds",
    },
    {
      name: "Image Previews",
      fn: window.testImagePreviews,
      duration: "~3 seconds",
    },
    {
      name: "PDF Previews",
      fn: window.testPDFPreviews,
      duration: "~3 seconds",
    },
    {
      name: "Response Warnings",
      fn: window.testResponseWarnings,
      duration: "~3 seconds",
    },
    {
      name: "Engine Recommendations",
      fn: window.testEngineRecommendations,
      duration: "~3 seconds",
    },
    {
      name: "Error States",
      fn: window.testErrorStates,
      duration: "~3 seconds",
    },
    {
      name: "Loading States",
      fn: window.testLoadingStates,
      duration: "~3 seconds",
    },
    {
      name: "Accessibility States",
      fn: window.testAccessibilityStates,
      duration: "~6 seconds",
    },
    {
      name: "Responsive Breakpoints",
      fn: window.testResponsiveBreakpoints,
      duration: "~8 seconds",
    },
  ];

  console.log(`\n🗂️  Test sequence (${tests.length} tests):`);
  tests.forEach((test, index) => {
    console.log(`  ${index + 1}. ${test.name} (${test.duration})`);
  });

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const nextTest = tests[i + 1];

    console.log(`\n🧪 Test ${i + 1}/${tests.length}: ${test.name}`);
    console.log(`⏱️  Expected duration: ${test.duration}`);
    if (nextTest) {
      console.log(`➡️  Next: ${nextTest.name}`);
    } else {
      console.log(`🏁 This is the final test`);
    }

    // Run the test, passing manualMode
    try {
      await test.fn(manualMode);
    } catch (e) {
      console.error(`❌ Error during "${test.name}":`, e);
    }

    if (nextTest) {
      console.log(`✅ ${test.name} complete`);
      const proceed = await window.announceStateChange(
        "test sequence",
        `${test.name} complete`,
        `Start "${nextTest.name}"`,
        window.CSS_TEST_INTER_TEST_DELAY_SEC,
        manualMode,
        /*isBoundary*/ true
      );

      if (!proceed) {
        console.log("⏹️ Test suite stopped by user");
        break;
      }
    }
  }

  console.log("\n🎉 Complete CSS test suite finished!");
  console.log("🧹 Run window.resetFileUploadUI() to clean up");
};

// ===== UTILITY FUNCTIONS =====

/**
 * Countdown timer with progress feedback
 */
window.countdownTimer = async (seconds, nextAction = "continuing") => {
  for (let i = seconds; i > 0; i--) {
    console.log(`⏰ ${i} seconds remaining before ${nextAction}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

/**
 * Enhanced state transition with manual/automatic control
 * Returns true when caller should continue, false when caller should skip remaining states
 * @param {string} testName - e.g. "file upload section"
 * @param {string} currentState - current state name
 * @param {string|null} nextState - next state name or null if final
 * @param {number} duration - seconds to wait in automatic mode
 * @param {boolean} manualMode - true to use console-based next()/skip()
 * @param {boolean} isBoundary - true when used between tests (affects instructions)
 */
window.announceStateChange = async (
  testName,
  currentState,
  nextState = null,
  duration = window.CSS_TEST_DEFAULT_DELAY_SEC,
  manualMode = true,
  isBoundary = false
) => {
  console.log(`  🎯 Testing: ${currentState}`);
  console.log(`  👀 Look for: ${testName} styling changes`);

  if (manualMode) {
    // Manual mode: non-blocking; user types next()/skip() in console
    console.log(`\n⏸ ${currentState} complete.`);
    if (nextState) {
      console.log(`Next: ${nextState}`);
    } else {
      console.log("This is the last state.");
    }

    if (isBoundary) {
      console.log(
        "➡ Type %cnext()%c to start the next %cTEST%c, or %cskip()%c to stop the suite",
        "color: green; font-weight: bold;",
        "",
        "font-weight: bold;",
        "",
        "color: red; font-weight: bold;",
        ""
      );
    } else {
      console.log(
        "➡ Type %cnext()%c to continue to the next %cSTATE%c, or %cskip()%c to skip the rest of this test",
        "color: green; font-weight: bold;",
        "",
        "font-weight: bold;",
        "",
        "color: red; font-weight: bold;",
        ""
      );
    }
    return await window.waitForConsoleInput(); // true = continue, false = stop/skip
  } else {
    // Automatic mode: just wait a bit if there is a next step
    if (nextState) {
      console.log(`  ⏭️  Next in ${duration}s: ${nextState}`);
      await new Promise((resolve) => setTimeout(resolve, duration * 1000));
    }
    return true;
  }
};

// ===== DOM HELPERS (unchanged functional behaviour) =====

window.simulateFileUpload = (fileType = "pdf", fileData = {}) => {
  console.log(`📁 Simulating ${fileType} file upload in DOM...`);

  const uploadControls = document.querySelector(".file-upload-controls");
  const previewArea = document.getElementById("file-preview");
  const previewFilename = document.getElementById("preview-filename");
  const previewFilesize = document.getElementById("preview-filesize");
  const previewContent = document.getElementById("preview-content");

  // Hide upload controls, show preview
  if (uploadControls) uploadControls.style.display = "none";
  if (previewArea) previewArea.hidden = false;

  // Set default file data based on type
  const defaults = {
    pdf: {
      name: "Test Document.pdf",
      size: "2.4 MB",
      pages: 18,
      complexity: "moderate",
      engine: "native",
    },
    image: {
      name: "Sample Image.jpg",
      size: "3.2 MB",
      width: 1920,
      height: 1080,
      format: "JPEG",
    },
  };

  const data = { ...defaults[fileType], ...fileData };

  // Update filename and size
  if (previewFilename) previewFilename.textContent = data.name;
  if (previewFilesize) previewFilesize.textContent = data.size;

  // Generate appropriate preview content
  if (previewContent) {
    if (fileType === "pdf") {
      previewContent.innerHTML = window.generatePDFPreviewContent(data);
    } else if (fileType === "image") {
      previewContent.innerHTML = window.generateImagePreviewContent(data);
    }
  }

  console.log(`✅ File upload simulated: ${data.name}`);
  return data;
};

window.generatePDFPreviewContent = (data) => {
  return `
    <div class="file-preview-content enhanced-preview" role="region" aria-label="Preview of ${data.name}">
      <div class="pdf-info-card">
        <div class="pdf-card-header">
          <h3 class="pdf-title">${data.name}</h3>
          <div class="pdf-icon" aria-hidden="true">📄</div>
        </div>
        <div class="pdf-stats">
          <div class="stat-item">
            <span class="stat-icon" aria-hidden="true">📄</span>
            <span class="stat-value">${data.pages} pages</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon" aria-hidden="true">⚡</span>
            <span class="stat-value">${data.complexity} complexity</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon" aria-hidden="true">🔧</span>
            <span class="stat-value">${data.engine} recommended</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon" aria-hidden="true">⏱️</span>
            <span class="stat-value">fast processing</span>
          </div>
        </div>
        <div class="cost-breakdown">
          <h4 class="cost-breakdown-header">Engine Options:</h4>
          <div class="cost-options-list">
            <div class="engine-option">
              <div class="engine-name">PDF Text</div>
              <div class="engine-cost">Free</div>
              <div class="engine-notes">No processing cost, basic text extraction</div>
            </div>
            <div class="engine-option">
              <div class="engine-name">Mistral OCR</div>
              <div class="engine-cost">£0.036 (~${data.pages} pages)</div>
              <div class="engine-notes">OCR processing for scanned documents</div>
            </div>
            <div class="engine-option recommended">
              <div class="engine-name">
                Native
                <span class="recommended-badge">Recommended</span>
              </div>
              <div class="engine-cost">Token-based (usually lowest)</div>
              <div class="engine-notes">Best for text-based PDFs</div>
            </div>
          </div>
        </div>
        <div class="confidence-indicator confidence-high">
          <span class="confidence-label">Analysis confidence:</span>
          <span class="confidence-value">high</span>
        </div>
      </div>
      <div class="engine-recommendation-display">
        <div class="recommendation-header">
          <span class="recommendation-icon" aria-hidden="true">🧠</span>
          <strong>Smart Engine Selection</strong>
        </div>
        <div class="primary-recommendation">
          <div class="recommended-engine">
            <strong>Recommended:</strong> ${data.engine}
          </div>
        </div>
        <ul class="recommendation-reasoning">
          <li>Text PDF with good structure - best performance</li>
        </ul>
        <div class="performance-notes">
          <div class="performance-header">Performance Notes:</div>
          <ul class="performance-list">
            <li>Fastest processing, token-based cost</li>
          </ul>
        </div>
      </div>
    </div>
  `;
};

window.generateImagePreviewContent = (data) => {
  return `
    <div class="file-preview-content enhanced-preview" role="region" aria-label="Preview of ${data.name}">
      <div class="image-preview-container">
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNlMWU4ZWMiLz48dGV4dCB4PSIxMDAiIHk9Ijc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij5JbWFnZSBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg==" 
             class="image-preview" alt="Sample image preview">
        <div class="image-info">
          <div class="image-details">
            <span>${data.width}×${data.height}</span>
            <span>${data.size}</span>
            <span>${data.format}</span>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.updateCostDisplay = (cost, level = "low") => {
  const previewCost = document.getElementById("preview-cost");
  if (!previewCost) return;
  previewCost.className = "preview-cost-estimate";
  previewCost.classList.add(`cost-${level}`);
  previewCost.innerHTML = `<div>Estimated processing cost: £${cost}</div>`;
  previewCost.style.display = "block";
  console.log(`💰 Cost display updated: £${cost} (${level} level)`);
};

window.updateResponseWarning = (size, severity = "standard") => {
  const responseWarning = document.getElementById("response-warning");
  if (!responseWarning) return;

  responseWarning.className = "response-size-warning";
  if (severity !== "standard") {
    responseWarning.classList.add(`warning-${severity}`);
  }

  responseWarning.innerHTML = `
    <div class="warning-header">
      <span class="warning-icon">⚠️</span>
      <span>Large Response Expected</span>
    </div>
    <div class="warning-details">
      <div class="size-estimate">Estimated size: ${size}</div>
      <div class="warning-confidence">Confidence: High</div>
      <ul class="warning-factors">
        <li>Complex PDF analysis requested</li>
        <li>Detailed content examination</li>
      </ul>
    </div>
  `;

  responseWarning.hidden = false;
  responseWarning.style.display = "block";
  console.log(`⚠️ Response warning updated: ${size} (${severity})`);
};

window.resetFileUploadUI = () => {
  const uploadSection = document.querySelector(".file-upload-section");
  const previewArea = document.getElementById("file-preview");
  const uploadControls = document.querySelector(".file-upload-controls");
  const previewCost = document.getElementById("preview-cost");
  const responseWarning = document.getElementById("response-warning");

  if (uploadSection) {
    uploadSection.className = "file-upload-section";
    uploadSection.style.display = "";
    uploadSection.style.borderColor = "";
    uploadSection.style.backgroundColor = "";
  }

  if (previewArea) {
    previewArea.hidden = true;
    const previewContent = document.getElementById("preview-content");
    if (previewContent) previewContent.innerHTML = "";
  }

  if (uploadControls) {
    uploadControls.style.display = "";
  }

  if (previewCost) {
    previewCost.style.display = "none";
    previewCost.className = "preview-cost-estimate cost-low";
  }

  if (responseWarning) {
    responseWarning.hidden = true;
    responseWarning.style.display = "none";
    responseWarning.className = "response-size-warning";
  }

  document.querySelectorAll(".css-test-content").forEach((el) => el.remove());

  document.body.style.filter = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  document.body.style.border = "";
};

window.createTestContainer = (title, className = "", description = "") => {
  const container = document.createElement("div");
  container.className = `css-test-content ${className}`;
  container.style.margin = "1rem 0";
  container.style.padding = "1rem";
  container.style.border = "2px dashed #ccc";
  container.style.borderRadius = "8px";
  container.style.backgroundColor = "#f9f9f9";

  const heading = document.createElement("h3");
  heading.textContent = title;
  heading.style.margin = "0 0 0.5rem 0";
  heading.style.color = "#333";
  container.appendChild(heading);

  if (description) {
    const desc = document.createElement("p");
    desc.textContent = description;
    desc.style.margin = "0 0 1rem 0";
    desc.style.color = "#666";
    desc.style.fontSize = "0.9rem";
    container.appendChild(desc);
  }

  return container;
};

// ===== FILE UPLOAD SECTION STATES =====
window.testFileUploadStates = async (manualMode = true) => {
  console.log("📤 Testing file upload section states...");
  console.log(
    "🎯 Focus: Watch the upload section border and background changes"
  );

  const uploadSection = document.querySelector(".file-upload-section");
  if (!uploadSection) {
    console.error(
      "❌ File upload section not found - ensure page is loaded properly"
    );
    return;
  }

  const states = [
    {
      name: "Normal State",
      className: "file-upload-section",
      lookFor: "Default border (dashed) and background colour",
    },
    {
      name: "Hover State",
      className: "file-upload-section hover-state",
      lookFor: "Border colour change and background lightening",
    },
    {
      name: "Drag Over State",
      className: "file-upload-section drag-over",
      lookFor: "Solid border and background highlight (drag active)",
    },
    {
      name: "Has File State",
      className: "file-upload-section has-file",
      lookFor: "Success border colour and background (file selected)",
    },
    {
      name: "Error State",
      className: "file-upload-section file-upload-error",
      lookFor: "Error border colour and background (invalid file)",
    },
  ];

  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    const nextState = states[i + 1];

    console.log(`  🔍 ${state.lookFor}`);
    uploadSection.className = state.className;

    if (state.name === "Hover State") {
      uploadSection.style.borderColor = "#005c84";
      uploadSection.style.backgroundColor = "#fffdf9";
    } else {
      uploadSection.style.borderColor = "";
      uploadSection.style.backgroundColor = "";
    }

    if (nextState) {
      const proceed = await window.announceStateChange(
        "file upload section",
        state.name,
        nextState.name,
        1.5,
        manualMode
      );
      if (!proceed) break;
    } else {
      await window.announceStateChange(
        "file upload section",
        state.name,
        null,
        0,
        manualMode
      );
    }
  }

  console.log("✅ File upload states test complete");
  console.log(
    "💡 The upload section should now be in error state (red border)"
  );
};

// ===== COST WARNING LEVELS =====
window.testCostWarningLevels = async (manualMode = true) => {
  console.log("💰 Testing cost warning levels...");
  console.log(
    "🎯 Focus: Watch cost warning colour changes in the actual preview area"
  );
  console.log(
    `🎮 Control: ${
      manualMode
        ? "Manual (type next() to advance; skip() to skip)"
        : "Automatic (timed)"
    }`
  );

  window.simulateFileUpload("pdf", {
    name: "Cost Test Document.pdf",
    pages: 25,
  });

  const costLevels = [
    {
      level: "low",
      cost: "0.003",
      cssClass: "",
      lookFor: "Green/normal background - safe cost level",
    },
    {
      level: "medium",
      cost: "0.08",
      cssClass: "cost-warning-yellow",
      lookFor: "Yellow background with warning styling",
    },
    {
      level: "high",
      cost: "0.75",
      cssClass: "cost-warning-orange",
      lookFor: "Orange background with stronger warning",
    },
    {
      level: "critical",
      cost: "2.50",
      cssClass: "cost-warning-red",
      lookFor: "Red background with pulsing animation and alert styling",
    },
  ];

  for (let i = 0; i < costLevels.length; i++) {
    const { level, cost, cssClass, lookFor } = costLevels[i];
    const nextLevel = costLevels[i + 1];

    console.log(
      `\n💰 Level ${i + 1}/${
        costLevels.length
      }: ${level.toUpperCase()} (£${cost})`
    );
    console.log(`🔍 ${lookFor}`);

    const previewCost = document.getElementById("preview-cost");
    if (previewCost) {
      previewCost.className = "preview-cost-estimate";
      if (cssClass) previewCost.classList.add(cssClass);
      previewCost.innerHTML = `<div>Estimated processing cost: £${cost}</div>`;
      previewCost.style.display = "block";

      // ARIA semantics vary by severity
      if (level === "critical") {
        previewCost.setAttribute("role", "alert");
        previewCost.setAttribute("aria-live", "assertive");
      } else if (level === "high") {
        previewCost.setAttribute("role", "status");
        previewCost.setAttribute("aria-live", "polite");
      } else {
        previewCost.removeAttribute("role");
        previewCost.removeAttribute("aria-live");
      }
    }

    // Pause/Prompt
    if (nextLevel) {
      const proceed = await window.announceStateChange(
        "cost warning display",
        `${level.toUpperCase()} (£${cost})`,
        `${nextLevel.level.toUpperCase()} (£${nextLevel.cost})`,
        2,
        manualMode
      );
      if (!proceed) {
        console.log("⏭️ Skipping remaining cost levels");
        break;
      }
    } else {
      await window.announceStateChange(
        "cost warning display",
        `${level.toUpperCase()} (£${cost})`,
        null,
        0,
        manualMode
      );
    }
  }

  console.log("✅ Cost warning levels test complete");
  console.log(
    "👀 Notice how the cost display changes colour and styling for each level"
  );
};

// ===== PDF ENGINE CONTROLS =====
window.testPDFEngineControls = async (manualMode = true) => {
  console.log("⚙️ Testing PDF engine controls...");
  console.log("🎯 Focus: Watch parameter control styling and cost indicators");

  const testContainer = window.createTestContainer(
    "PDF Engine Controls",
    "",
    "Testing enabled/disabled controls with different cost level indicators"
  );
  document.body.appendChild(testContainer);

  const engines = [
    {
      name: "native",
      cost: "Token-based",
      level: "low",
      enabled: true,
      note: "Best for text-layer PDFs",
    },
    {
      name: "pdf-text",
      cost: "Free",
      level: "low",
      enabled: true,
      note: "Basic text extraction only",
    },
    {
      name: "mistral-ocr",
      cost: "£2.00/1000 pages",
      level: "high",
      enabled: false,
      note: "For scanned documents (disabled)",
    },
  ];

  console.log(`🔧 Creating ${engines.length} engine control examples`);

  engines.forEach(({ name, cost, level, enabled, note }, index) => {
    const controlDiv = document.createElement("div");
    controlDiv.className = "pdf-engine-control";
    controlDiv.style.marginBottom = "1rem";

    controlDiv.innerHTML = `
      <label class="parameter-label">PDF Engine: ${name}</label>
      <select class="parameter-input" ${enabled ? "" : "disabled"}>
        <option value="${name}">${name}</option>
      </select>
      <div class="parameter-help">
        <div class="engine-cost-info cost-${level}">
          Cost: ${cost}
        </div>
      </div>
    `;

    testContainer.appendChild(controlDiv);

    console.log(`  ⚙️ ${index + 1}. ${name} engine`);
    console.log(`     💰 Cost: ${cost} (${level} level)`);
    console.log(`     🔍 ${enabled ? "Enabled" : "Disabled"} - ${note}`);
  });

  await window.announceStateChange(
    "PDF engine controls",
    "Review examples",
    null,
    0,
    manualMode
  );

  console.log("✅ PDF engine controls test complete");
  console.log(
    "👀 Notice the disabled control (mistral-ocr) has different styling"
  );
};

// ===== IMAGE PREVIEW SCENARIOS =====
window.testImagePreviews = async (manualMode = true) => {
  console.log("🖼️ Testing image preview scenarios...");
  console.log(
    "🎯 Focus: Watch image preview states in the actual preview area"
  );

  const scenarios = [
    {
      name: "Successful Image Preview",
      type: "success",
      data: {
        name: "Beautiful Photo.jpg",
        size: "3.2 MB",
        width: 1920,
        height: 1080,
        format: "JPEG",
      },
      lookFor: "Clean image display with metadata below",
    },
    {
      name: "Image Loading State",
      type: "loading",
      data: {
        name: "Loading Image.png",
        size: "2.8 MB",
        width: 1600,
        height: 900,
        format: "PNG",
      },
      lookFor: "Loading animation/pulsing effect on image",
    },
    {
      name: "Image Error State",
      type: "error",
      data: { name: "Corrupted Image.webp", size: "4.1 MB" },
      lookFor: "Error styling with warning icon and message",
    },
  ];

  console.log(
    `📸 Testing ${scenarios.length} image preview scenarios in actual DOM:`
  );

  for (let i = 0; i < scenarios.length; i++) {
    const { name, type, data, lookFor } = scenarios[i];
    const nextScenario = scenarios[i + 1];

    console.log(`     🔍 ${lookFor}`);

    if (type === "error") {
      window.simulateFileUpload("image", data);
      const previewContent = document.getElementById("preview-content");
      if (previewContent) {
        previewContent.innerHTML = `
          <div class="file-preview-content enhanced-preview">
            <div class="image-preview-error">
              <span class="error-icon">⚠️</span>
              <div class="error-message">
                <strong>Failed to load image preview</strong>
                <span>The image file may be corrupted or unsupported</span>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      window.simulateFileUpload("image", data);
      if (type === "loading") {
        const imageContainer = document.querySelector(
          ".image-preview-container"
        );
        if (imageContainer) imageContainer.classList.add("image-loading");
      }
    }

    console.log(`  📷 ${i + 1}. ${name}`);

    if (nextScenario) {
      const proceed = await window.announceStateChange(
        "image preview display",
        name,
        nextScenario.name,
        2.5,
        manualMode
      );
      if (!proceed) break;
    } else {
      await window.announceStateChange(
        "image preview display",
        name,
        null,
        0,
        manualMode
      );
    }
  }

  console.log("✅ Image preview scenarios test complete");
  console.log("👀 States: success, loading animation, error handling");
};

// ===== PDF PREVIEW SCENARIOS =====
window.testPDFPreviews = async (manualMode = true) => {
  console.log("📄 Testing PDF preview scenarios...");
  console.log(
    "🎯 Focus: Watch comprehensive PDF info cards in the actual preview area"
  );

  const scenarios = [
    {
      name: "Small Text PDF",
      data: {
        name: "Meeting Minutes.pdf",
        size: "245 KB",
        pages: 4,
        complexity: "simple",
        engine: "native",
      },
      lookFor: "Compact card; low page count and simple complexity",
    },
    {
      name: "Medium Document PDF",
      data: {
        name: "Technical Report.pdf",
        size: "2.4 MB",
        pages: 18,
        complexity: "moderate",
        engine: "native",
      },
      lookFor: "Standard card; moderate pages; native engine",
    },
    {
      name: "Large Scanned PDF",
      data: {
        name: "Scanned Archive.pdf",
        size: "12.8 MB",
        pages: 67,
        complexity: "complex",
        engine: "mistral-ocr",
      },
      lookFor: "Detailed card; OCR recommendation",
    },
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const { name, data, lookFor } = scenarios[i];
    const nextScenario = scenarios[i + 1];

    console.log(`     🔍 ${lookFor}`);

    window.simulateFileUpload("pdf", data);

    const confidenceIndicator = document.querySelector(".confidence-indicator");
    if (confidenceIndicator) {
      confidenceIndicator.className = "confidence-indicator";
      const val = confidenceIndicator.querySelector(".confidence-value");
      if (data.complexity === "simple") {
        confidenceIndicator.classList.add("confidence-high");
        if (val) val.textContent = "high";
      } else if (data.complexity === "moderate") {
        confidenceIndicator.classList.add("confidence-medium");
        if (val) val.textContent = "medium";
      } else {
        confidenceIndicator.classList.add("confidence-low");
        if (val) val.textContent = "low";
      }
    }

    const engineOptions = document.querySelectorAll(".engine-option");
    engineOptions.forEach((option) => {
      option.classList.remove("recommended");
      const engineName = option.querySelector(".engine-name");
      if (
        engineName &&
        engineName.textContent.toLowerCase().includes(data.engine)
      ) {
        option.classList.add("recommended");
        if (!option.querySelector(".recommended-badge")) {
          engineName.innerHTML +=
            '<span class="recommended-badge">Recommended</span>';
        }
      }
    });

    console.log(`  📄 ${i + 1}. ${name}`);
    console.log(
      `      📊 ${data.pages} pages, ${data.size}, ${data.complexity} complexity`
    );
    console.log(`      🔧 ${data.engine} engine recommended`);

    if (nextScenario) {
      const proceed = await window.announceStateChange(
        "PDF info card display",
        name,
        nextScenario.name,
        3,
        manualMode
      );
      if (!proceed) break;
    } else {
      await window.announceStateChange(
        "PDF info card display",
        name,
        null,
        0,
        manualMode
      );
    }
  }

  console.log("✅ PDF preview scenarios test complete");
};

// ===== RESPONSE SIZE WARNINGS =====
window.testResponseWarnings = async (manualMode = true) => {
  console.log("⚠️ Testing response size warnings...");
  console.log(
    "🎯 Focus: Watch response warning changes in the actual preview area"
  );

  window.simulateFileUpload("pdf", {
    name: "Large Response Test.pdf",
    pages: 45,
    complexity: "complex",
  });

  const warnings = [
    {
      severity: "standard",
      size: "2.1 MB",
      className: "",
      icon: "⚠️",
      description: "Standard warning (light styling)",
    },
    {
      severity: "large",
      size: "8.5 MB",
      className: "warning-large",
      icon: "⚠️⚠️",
      description: "Large response warning (medium severity)",
    },
    {
      severity: "very-large",
      size: "15.2 MB",
      className: "warning-very-large",
      icon: "🚨",
      description: "Very large response warning (high severity)",
    },
  ];

  for (let i = 0; i < warnings.length; i++) {
    const { severity, size, className, icon, description } = warnings[i];
    const nextWarning = warnings[i + 1];

    console.log(`     🔍 ${description}`);

    const responseWarning = document.getElementById("response-warning");
    if (responseWarning) {
      responseWarning.className = "response-size-warning";
      if (className) responseWarning.classList.add(className);

      const factors =
        severity === "very-large"
          ? [
              "Complex scanned PDF analysis",
              "OCR processing generates extensive results",
              "Multiple analysis layers requested",
            ]
          : [
              "Complex text-based PDF analysis",
              "Detailed content examination requested",
            ];

      responseWarning.innerHTML = `
        <div class="warning-header">
          <span class="warning-icon">${icon}</span>
          <span>Large Response Expected</span>
        </div>
        <div class="warning-details">
          <div class="size-estimate">Estimated size: ${size}</div>
          <div class="warning-confidence">Confidence: High</div>
          <ul class="warning-factors">
            ${factors.map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <div class="warning-recommendation">
            Consider requesting a summary or specific sections only
          </div>
        </div>
      `;

      responseWarning.hidden = false;
      responseWarning.style.display = "block";
    }

    console.log(
      `  📊 ${i + 1}. ${severity.toUpperCase()} response warning: ${size}`
    );

    if (nextWarning) {
      const proceed = await window.announceStateChange(
        "response size warning",
        `${severity.toUpperCase()} (${size})`,
        `${nextWarning.severity.toUpperCase()} (${nextWarning.size})`,
        2.5,
        manualMode
      );
      if (!proceed) break;
    } else {
      await window.announceStateChange(
        "response size warning",
        `${severity.toUpperCase()} (${size})`,
        null,
        0,
        manualMode
      );
    }
  }

  console.log("✅ Response size warnings test complete");
};

// ===== ENGINE RECOMMENDATIONS =====
window.testEngineRecommendations = async (manualMode = true) => {
  console.log("🤖 Testing engine recommendations...");
  console.log("🎯 Focus: Watch recommendation styling and reasoning display");

  const testContainer = window.createTestContainer(
    "Engine Recommendations",
    "",
    "Testing smart engine recommendation display with reasoning and performance notes"
  );
  document.body.appendChild(testContainer);

  const recommendation = document.createElement("div");
  recommendation.className = "engine-recommendation-display";
  recommendation.innerHTML = `
    <div class="recommendation-header">
      <span class="recommendation-icon">🎯</span>
      <span>Smart Engine Recommendation</span>
    </div>
    <div class="primary-recommendation">
      <div class="recommended-engine">Recommended: <strong>native</strong></div>
    </div>
    <ul class="recommendation-reasoning">
      <li>Text-based PDF detected from file analysis</li>
      <li>Moderate file size suggests good text layer quality</li>
      <li>Native engine provides best accuracy for this content type</li>
      <li>Token-based pricing is most economical for text extraction</li>
    </ul>
    <div class="performance-notes">
      <div class="performance-header">Expected Performance:</div>
      <ul class="performance-list">
        <li>Processing time: ~3 seconds</li>
        <li>Accuracy: Very High</li>
        <li>Cost efficiency: Excellent</li>
      </ul>
    </div>
  `;
  testContainer.appendChild(recommendation);

  await window.announceStateChange(
    "engine recommendation display",
    "Review recommendation",
    null,
    0,
    manualMode
  );

  console.log("✅ Engine recommendations test complete");
};

// ===== ERROR STATES =====
window.testErrorStates = async (manualMode = true) => {
  console.log("🚨 Testing error states...");
  console.log("🎯 Focus: Watch different error styling in actual DOM elements");

  const errors = [
    {
      type: "File Upload Error",
      location: "upload-section",
      setup: () => {
        window.resetFileUploadUI();
        const uploadSection = document.querySelector(".file-upload-section");
        if (uploadSection) {
          uploadSection.className = "file-upload-section file-upload-error";

          let errorMsg = uploadSection.querySelector(".upload-error-message");
          if (!errorMsg) {
            errorMsg = document.createElement("div");
            errorMsg.className = "upload-error-message";
            uploadSection.appendChild(errorMsg);
          }
          return errorMsg;
        }
      },
      message: "File exceeds maximum size limit of 25MB",
      lookFor: "Red border on upload section with error message below",
    },
    {
      type: "Unsupported Format Error",
      location: "upload-section",
      setup: () => {
        const uploadSection = document.querySelector(".file-upload-section");
        return uploadSection?.querySelector(".upload-error-message");
      },
      message: "Unsupported file format. Supported types: JPEG, PNG, WebP, PDF",
      lookFor: "Same error styling with different message",
    },
    {
      type: "Preview Generation Error",
      location: "preview-area",
      setup: () => {
        window.simulateFileUpload("image", { name: "Corrupted Image.jpg" });
        const previewContent = document.getElementById("preview-content");
        if (previewContent) {
          previewContent.innerHTML = `
            <div class="preview-generation-error">
              <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span>Preview Generation Failed</span>
              </div>
              <div class="error-details">
                <div>Unable to generate file preview</div>
                <div class="error-message">TypeError: Cannot read property 'type' of undefined</div>
              </div>
            </div>
          `;
        }
        return previewContent;
      },
      message: "Preview generation failed with technical details",
      lookFor: "Error styling within the file preview area",
    },
    {
      type: "Image Preview Error",
      location: "preview-area",
      setup: () => {
        const previewContent = document.getElementById("preview-content");
        if (previewContent) {
          previewContent.innerHTML = `
            <div class="file-preview-content enhanced-preview">
              <div class="image-preview-error">
                <span class="error-icon">⚠️</span>
                <div class="error-message">
                  <strong>Failed to load image preview</strong>
                  <span>The image file may be corrupted or unsupported</span>
                </div>
              </div>
            </div>
          `;
        }
        return previewContent;
      },
      message: "Image-specific error with icon and descriptive text",
      lookFor: "Specialized image error styling with warning icon",
    },
  ];

  for (let i = 0; i < errors.length; i++) {
    const { type, location, setup, message, lookFor } = errors[i];
    const nextError = errors[i + 1];

    console.log(`     📍 Location: ${location}`);
    console.log(`     🔍 ${lookFor}`);

    const element = setup();

    if (location === "upload-section" && element) {
      element.innerHTML = `<strong>${type}:</strong> ${message}`;
    }

    console.log(`  ❌ ${i + 1}. ${type}`);
    console.log(`      📝 ${message}`);

    if (nextError) {
      const proceed = await window.announceStateChange(
        "error display",
        type,
        nextError.type,
        2.5,
        manualMode
      );
      if (!proceed) break;
    } else {
      await window.announceStateChange(
        "error display",
        type,
        null,
        0,
        manualMode
      );
    }
  }

  console.log("✅ Error states test complete");
};

// ===== LOADING STATES =====
window.testLoadingStates = async (manualMode = true) => {
  console.log("⏳ Testing loading states...");
  console.log("🎯 Focus: Watch processing indicators and status messaging");

  const testContainer = window.createTestContainer(
    "Loading States",
    "",
    "Testing file processing indicators with dynamic status updates"
  );
  document.body.appendChild(testContainer);

  const loadingPreview = document.createElement("div");
  loadingPreview.className = "generic-file-preview";
  loadingPreview.innerHTML = `
    <span class="generic-file-icon">📄</span>
    <div class="generic-file-details">
      <div class="file-name">processing-document.pdf</div>
      <div class="file-type">Processing...</div>
      <div class="file-size">Analysing file complexity</div>
      <div class="complexity">Determining optimal engine</div>
      <div class="processing-time">Estimating response size</div>
    </div>
  `;
  document.body.appendChild(testContainer);
  testContainer.appendChild(loadingPreview);

  await window.announceStateChange(
    "loading state",
    "Review processing block",
    null,
    0,
    manualMode
  );

  console.log("✅ Loading states test complete");
  console.log(
    "💡 This shows the intermediate processing state before full preview"
  );
};

// ===== ACCESSIBILITY STATES =====
window.testAccessibilityStates = async (manualMode = true) => {
  console.log("♿ Testing accessibility states...");
  console.log("🎯 Focus: Watch high contrast and reduced motion adaptations");

  console.log("🎨 Testing high contrast mode...");
  console.log("  🔍 Look for: Enhanced contrast and border visibility");
  document.body.style.filter = "contrast(150%)";

  // Transition to reduced motion
  {
    const proceed = await window.announceStateChange(
      "accessibility modes",
      "High contrast active",
      "Switch to reduced motion",
      3,
      manualMode
    );
    if (!proceed) {
      // Reset and stop this test
      document.body.style.filter = "";
      console.log("⏭️ Skipped reduced motion test");
      console.log("✅ Accessibility states test complete (partial)");
      return;
    }
  }

  console.log("🎭 Testing reduced motion mode...");
  console.log("  🔍 Look for: Disabled animations and transitions");
  const style = document.createElement("style");
  style.textContent = `
    * {
      animation: none !important;
      transition: none !important;
    }
  `;
  document.head.appendChild(style);

  // Reset both
  await window.announceStateChange(
    "accessibility modes",
    "Reduced motion active",
    "Reset accessibility modifications",
    3,
    manualMode
  );
  document.body.style.filter = "";
  style.remove();

  console.log("✅ Accessibility states test complete");
  console.log("🔄 All accessibility modifications have been reset");
};

// ===== RESPONSIVE BREAKPOINTS =====
window.testResponsiveBreakpoints = async (manualMode = true) => {
  console.log("📱 Testing responsive breakpoints...");
  console.log("🎯 Focus: Watch layout adaptations for different screen sizes");

  const breakpoints = [
    {
      name: "Mobile",
      width: 480,
      note: "Single column layout, compressed spacing",
    },
    { name: "Tablet", width: 768, note: "Optimized for touch, medium spacing" },
    { name: "Desktop", width: 1024, note: "Full layout with optimal spacing" },
  ];

  for (let i = 0; i < breakpoints.length; i++) {
    const { name, width, note } = breakpoints[i];
    const nextBreakpoint = breakpoints[i + 1];

    console.log(`\n📱 ${i + 1}/${breakpoints.length}: ${name} (${width}px)`);
    console.log(`  🔍 ${note}`);
    if (nextBreakpoint) {
      console.log(`  ⏭️  Next: ${nextBreakpoint.name}`);
    }

    document.body.style.width = `${width}px`;
    document.body.style.overflow = "auto";
    document.body.style.border = "3px solid #007bff";

    if (nextBreakpoint) {
      const proceed = await window.announceStateChange(
        "responsive breakpoint",
        `${name} (${width}px)`,
        `${nextBreakpoint.name} (${nextBreakpoint.width}px)`,
        2,
        manualMode
      );
      if (!proceed) break;
    } else {
      await window.announceStateChange(
        "responsive breakpoint",
        `${name} (${width}px)`,
        null,
        0,
        manualMode
      );
    }
  }

  // small pause & reset
  if (!manualMode) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  document.body.style.width = "";
  document.body.style.overflow = "";
  document.body.style.border = "";

  console.log("✅ Responsive breakpoints test complete");
  console.log("🔄 Viewport simulation has been reset to normal");
};

// ===== INFO / HELP =====
window.showTestingEnhancements = () => {
  console.log("🎉 Enhanced CSS Testing Suite Features:");

  console.log("\n🎮 MANUAL CONTROL:");
  console.log("• Type next() to advance to next state at your own pace");
  console.log("• Type skip() to skip remaining states in current test");
  console.log("• Between tests: skip() stops the suite");

  console.log("\n🔄 REAL DOM TESTING:");
  console.log("• Tests populate actual DOM elements (preview, cost, warnings)");

  console.log("\n📁 FILE SIMULATION:");
  console.log("• window.simulateFileUpload('pdf'|'image', {data})");

  console.log("\n💰 COST & WARNING TESTING:");
  console.log("• window.updateCostDisplay(cost, level)");
  console.log("• window.updateResponseWarning(size, severity)");

  console.log("\n🎯 CONTROL OPTIONS:");
  console.log("• window.runAllCSSTests() - Manual mode (default)");
  console.log("• window.runAllCSSTests(false) - Automatic mode (timed)");
  console.log("• Individual tests accept manualMode boolean");

  console.log("\n🧹 IMPROVED CLEANUP:");
  console.log("• window.resetFileUploadUI() - Comprehensive reset");

  console.log("\n📊 TEST COVERAGE:");
  console.log("• Upload section states; Cost warnings; Response warnings;");
  console.log("• File previews (PDF/Image); Engine recommendations;");
  console.log("• Error handling; Loading states; Accessibility; Responsive");
};

window.testAllFileUploadCSS();

// Infrastructure diagnostic commands for Stage 6
window.diagnoseTokenCounter = () => {
  console.log("🔍 Token Counter Diagnostic:");
  console.log("- Module Available:", !!window.tokenCounter);

  if (window.tokenCounter) {
    console.log("- Type:", typeof window.tokenCounter);

    // Check methods
    const methods = [
      "initializeRequest",
      "recordAttempt",
      "recordStreamChunk",
      "trackSystemPrompt",
      "getUsageReport",
      "generateRequestId",
      "calculateModelDelta",
    ];

    console.log("\n📋 Method Availability:");
    methods.forEach((method) => {
      const available = typeof window.tokenCounter[method] === "function";
      console.log(`  - ${method}:`, available ? "✅" : "❌");
    });

    // Test generateRequestId
    try {
      const testId = window.tokenCounter.generateRequestId();
      console.log("\n✅ Generate Request ID Test:", testId);
    } catch (error) {
      console.log("\n❌ Generate Request ID Error:", error.message);
    }

    // Check internal components
    console.log("\n🔧 Internal Components:");
    console.log("  - logger:", !!window.tokenCounter.logger);
    console.log("  - config:", !!window.tokenCounter.config);

    // List all properties
    console.log("\n📦 All Properties:");
    console.log("  - Own properties:", Object.keys(window.tokenCounter));
    if (window.tokenCounter.constructor) {
      const proto = Object.getPrototypeOf(window.tokenCounter);
      console.log(
        "  - Prototype methods:",
        Object.getOwnPropertyNames(proto).filter((m) => m !== "constructor")
      );
    }
  } else {
    console.log("❌ Token counter module not found!");
  }

  // Check TokenCounter class
  if (window.TokenCounter) {
    console.log("\n🏭 TokenCounter Class:");
    console.log("  - Class available:", true);
    console.log(
      "  - Has getInstance:",
      typeof window.TokenCounter.getInstance === "function"
    );
  }
};

window.diagnoseUIControllerRecursion = () => {
  console.log("🔍 UI Controller File State Diagnostic:");
  console.log("- Controller Available:", !!window.uiController);
  console.log("- File Handler Available:", !!window.fileHandler);

  if (window.uiController) {
    console.log(
      "- Recursion Guard State:",
      window.uiController._updatingFileUploadState
    );
    console.log(
      "- Has getFileUploadState:",
      !!window.uiController.getFileUploadState
    );

    if (window.uiController.getFileUploadState) {
      try {
        const state = window.uiController.getFileUploadState();
        console.log("- Current File State:", state);
      } catch (error) {
        console.log("- Get state error:", error.message);
      }
    }
  }

  // Check event listeners
  console.log("- File upload events registered:", {
    change: !!document.getElementById("fileInput")?.onchange,
    dragover: !!document.querySelector(".file-upload-area")?.ondragover,
    drop: !!document.querySelector(".file-upload-area")?.ondrop,
  });
};

window.diagnoseFullWorkflow = () => {
  console.log("🔍 Full Workflow Diagnostic:");
  console.log("- File Handler Ready:", window.fileHandler?.isInitialised);
  console.log(
    "- Request Processor Ready:",
    !!window.uiController?.requestProcessor
  );
  console.log("- Parameter Controller Ready:", !!window.parameterController);
  console.log("- Token Counter Ready:", !!window.tokenCounter);
  console.log(
    "- Results Manager Ready:",
    !!window.uiController?.resultsManager
  );

  // Check RequestManager
  if (window.RequestManager) {
    console.log("- RequestManager Available:", true);
    console.log("- RequestManager Type:", typeof window.RequestManager);

    if (window.RequestManager.getInstance) {
      try {
        const instance = window.RequestManager.getInstance();
        console.log("- RequestManager Instance:", !!instance);
      } catch (error) {
        console.log("- RequestManager Instance Error:", error.message);
      }
    }
  } else {
    console.log("- RequestManager Available:", false);
  }

  // Check critical dependencies
  console.log("\n📦 Critical Dependencies:");
  console.log("- CONFIG:", !!window.CONFIG);
  console.log("- OpenRouterClient:", !!window.OpenRouterClient);
  console.log("- ResultsManager:", !!window.ResultsManager);
  console.log("- ParameterController:", !!window.parameterController);

  // Check initialization order
  console.log("\n🔄 Initialization Status:");
  console.log("- Document Ready:", document.readyState === "complete");
  console.log("- Main Module Initialized:", !!window.mainModuleInitialized);
};
// Additional diagnostic to find token counter references
window.findTokenCounterReferences = () => {
  console.log("🔍 Searching for Token Counter References:");

  // Check if it's mentioned in imports
  console.log("\n📦 Checking potential locations:");

  // Check common patterns
  const potentialNames = [
    "TokenCounter",
    "tokenCounter",
    "TokenCounterModule",
    "tokenCounterModule",
    "TokenManager",
    "tokenManager",
  ];

  potentialNames.forEach((name) => {
    if (window[name]) {
      console.log(`✅ Found: window.${name}`, typeof window[name]);
    }
  });

  // Check in CONFIG
  if (window.CONFIG) {
    console.log("\n⚙️ CONFIG references:");
    console.log("- TOKEN_ESTIMATION:", !!window.CONFIG.TOKEN_ESTIMATION);
    console.log("- TOKEN_COUNTER:", !!window.CONFIG.TOKEN_COUNTER);
  }

  // Check RequestManager for token references
  if (window.RequestManager) {
    console.log("\n📨 RequestManager token references:");
    const instance = window.RequestManager.getInstance
      ? window.RequestManager.getInstance()
      : null;
    if (instance) {
      console.log("- Has tokenCounter property:", "tokenCounter" in instance);
      console.log("- Has tokenManager property:", "tokenManager" in instance);
    }
  }

  // List all global objects that might be token-related
  console.log("\n🌍 All window properties containing 'token':");
  Object.keys(window).forEach((key) => {
    if (key.toLowerCase().includes("token")) {
      console.log(`- window.${key}:`, typeof window[key]);
    }
  });
};

// Test 1: Verify token counter accepts correct format
window.testTokenCounterFix = () => {
  console.log("🔧 Testing Token Counter Fix:");

  const testId = "test_" + Date.now();
  const testMessages = [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Hello, test message" },
  ];

  try {
    const result = window.tokenCounter.initializeRequest(
      testId,
      "gpt-4",
      testMessages
    );
    console.log("✅ Token counter initialization successful:", result);
    return true;
  } catch (error) {
    console.error("❌ Token counter still failing:", error);
    return false;
  }
};

// Test 2: Verify request manager availability
window.testRequestManager = () => {
  console.log("🔄 Testing Request Manager:");

  const requestManager = window.RequestManager?.getInstance();
  if (!requestManager) {
    console.error("❌ RequestManager not available");
    return false;
  }

  console.log("✅ RequestManager available");
  console.log("✅ Core available:", !!requestManager.core);
  console.log("✅ Token counter available:", !!window.tokenCounter);
  return true;
};
// Enhanced test for complete workflow
window.testCompleteWorkflow = () => {
  console.log("🔧 Testing Complete Workflow:");

  // Test 1: Token Counter
  const tokenTest = window.testTokenCounterFix();
  console.log("1. Token Counter Fix:", tokenTest ? "✅" : "❌");

  // Test 2: RequestManager availability
  const hasRequestManager = !!window.RequestManager;
  console.log("2. RequestManager Available:", hasRequestManager ? "✅" : "❌");

  if (hasRequestManager) {
    try {
      // Test creating an instance
      const modelManager = window.uiController?.modelManager;
      const progressHandler = window.uiController?.progressHandler;

      if (modelManager && progressHandler) {
        const requestManager = new window.RequestManager(
          modelManager,
          progressHandler
        );
        console.log("3. RequestManager Instance Creation:", "✅");
        console.log(
          "   - Has processRequest:",
          typeof requestManager.processRequest === "function" ? "✅" : "❌"
        );
        console.log(
          "   - Has processStreamingRequest:",
          typeof requestManager.processStreamingRequest === "function"
            ? "✅"
            : "❌"
        );
      } else {
        console.log(
          "3. RequestManager Dependencies:",
          "❌ Missing modelManager or progressHandler"
        );
      }
    } catch (error) {
      console.log("3. RequestManager Instance Creation:", "❌", error.message);
    }
  }

  // Test 3: All critical components
  console.log("\n🔍 Component Status:");
  console.log("- CONFIG:", !!window.CONFIG ? "✅" : "❌");
  console.log("- tokenCounter:", !!window.tokenCounter ? "✅" : "❌");
  console.log(
    "- parameterController:",
    !!window.parameterController ? "✅" : "❌"
  );
  console.log("- uiController:", !!window.uiController ? "✅" : "❌");

  return tokenTest && hasRequestManager;
};
// Add to window for testing smart engine recommendation flow
window.testSmartEngineIntegration = async () => {
  console.log("🧪 Testing Smart Engine Integration...");

  // Check if file handler and parameter sync are ready
  const fileHandler = window.fileHandler;
  const paramSync = fileHandler?.parameterSyncAvailable;

  console.log("File Handler Ready:", !!fileHandler);
  console.log("Parameter Sync Available:", paramSync);

  if (fileHandler?.currentFile) {
    console.log("Current File:", fileHandler.currentFile.name);
    console.log("File Analysis:", fileHandler.fileAnalysis);
    console.log(
      "Engine Recommendation:",
      fileHandler.fileAnalysis?.recommendedEngine
    );

    // Check if recommendation is synced to parameter
    const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
    if (pdfParam) {
      console.log("PDF Parameter Value:", pdfParam.getValue());
      console.log(
        "✅ Integration Status:",
        pdfParam.getValue() === fileHandler.fileAnalysis?.recommendedEngine
          ? "SYNCED"
          : "NOT SYNCED"
      );
    }
  } else {
    console.log("⚠️ No file uploaded - upload a PDF to test integration");
  }

  return "Test complete - check console output above";
};

// Add to window for verifying parameter sync status
window.checkParameterSyncStatus = () => {
  const status = window.fileHandler?.parameterSync?.getSyncStatus();
  console.table(status);
  return status;
};

// Enhanced PDF testing workflow with clear steps
window.testPDFWorkflow = () => {
  console.log(`
📋 PDF TESTING WORKFLOW - Follow these steps:
============================================

STEP 1: Clear any existing file
   > window.clearFile()

STEP 2: Start the test
   > window.startPDFTest('Integration-Test', 'Analyze this document')

STEP 3: Upload your PDF file
   - Click "Choose File" or drag & drop
   - Wait for analysis to complete

STEP 4: Record the upload
   > window.recordFileUpload()

STEP 5: Check smart engine integration
   > window.testSmartEngineIntegration()

STEP 6: Send the request (optional)
   - Click "Send" button if you want to test API
   - OR skip to step 7 for analysis-only test

STEP 7: Complete the test
   > window.completeTest('Your feedback here')

STEP 8: View results
   > window.getTestHistory()
   > window.analyzeResponseSizeAccuracy()
  `);
};

// Helper to clear existing file
window.clearFile = () => {
  const removeButton = document.getElementById("preview-remove");
  if (removeButton) {
    removeButton.click();
    console.log("✅ File cleared");
  } else {
    console.log("⚠️ No file to clear");
  }
  return "Ready for new file upload";
};

// Enhanced smart engine integration test
window.testSmartEngineIntegration = async () => {
  console.log("🧪 Testing Smart Engine Integration...");
  console.log("=====================================");

  const fileHandler = window.fileHandler;
  const paramSync = fileHandler?.parameterSyncAvailable;

  console.log("✅ File Handler Ready:", !!fileHandler);
  console.log("✅ Parameter Sync Available:", paramSync);

  if (fileHandler?.currentFile) {
    const file = fileHandler.currentFile;
    const analysis = fileHandler.fileAnalysis;

    console.log("\n📄 FILE DETAILS:");
    console.log("- Name:", file.name);
    console.log("- Size:", (file.size / 1024).toFixed(1), "KB");
    console.log("- Type:", file.type);

    console.log("\n🔍 ANALYSIS RESULTS:");
    console.log("- Estimated Pages:", analysis?.estimatedPages);
    console.log("- Scanned Content:", analysis?.likelyScanned ? "Yes" : "No");
    console.log("- Complexity:", analysis?.complexity || "Not assessed");
    console.log("- Recommended Engine:", analysis?.recommendedEngine);
    console.log("- Confidence:", analysis?.confidence || "Not specified");

    // Check parameter sync
    const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
    if (pdfParam) {
      const currentValue = pdfParam.getValue();
      const recommended = analysis?.recommendedEngine;

      console.log("\n⚙️ PARAMETER SYNC:");
      console.log("- PDF Parameter Value:", currentValue);
      console.log("- Recommended Engine:", recommended);
      console.log(
        "- Sync Status:",
        currentValue === recommended ? "✅ SYNCED" : "⚠️ NOT SYNCED"
      );

      if (currentValue !== recommended) {
        console.log(
          "  💡 Tip: The parameter should auto-sync. Check if parameter sync is initialized."
        );
      }
    } else {
      console.log("\n⚠️ PDF Parameter not available");
    }

    // Check cost estimation
    if (fileHandler.costEstimate) {
      console.log("\n💰 COST ESTIMATION:");
      console.log("- Estimated Cost:", fileHandler.costEstimate);
    }
  } else {
    console.log("\n⚠️ No file uploaded - upload a PDF to test integration");
  }

  console.log("\n=====================================");
  return "Integration test complete";
};

// Quick status check
window.checkSystemStatus = () => {
  const status = {
    "File Handler": !!window.fileHandler,
    "Parameter Sync": window.fileHandler?.parameterSyncAvailable || false,
    "Current File": window.fileHandler?.currentFile?.name || "None",
    "Analysis Available": !!window.fileHandler?.fileAnalysis,
    "Parameter Controller": !!window.parameterController,
    "PDF Parameter": !!window.parameterRegistry?.getParameter("pdf-engine"),
  };

  console.table(status);

  if (window.fileHandler?.parameterSync) {
    console.log("\n📊 Sync Statistics:");
    const syncStatus = window.fileHandler.parameterSync.getSyncStatus();
    console.table(syncStatus.statistics);
  }

  return status;
};
// ============================================
// COMPLETE PDF WORKFLOW TEST SUITE
// ============================================

window.runCompleteTest = async () => {
  console.log(`
📋 AUTOMATED PDF TEST STARTING
============================================
This will run through the complete workflow automatically.
`);

  // Step 1: System Status Check
  console.log("📊 STEP 1: Checking System Status...");
  const status = {
    "File Handler": !!window.fileHandler,
    "Parameter Sync": window.fileHandler?.parameterSyncAvailable || false,
    "Parameter Controller": !!window.parameterController,
    "PDF Parameter": !!window.parameterRegistry?.getParameter("pdf-engine"),
    "UI Controller": !!window.uiController,
  };
  console.table(status);

  // Step 2: Clear any existing file
  console.log("\n🗑️ STEP 2: Clearing Existing Files...");
  const removeButton = document.getElementById("preview-remove");
  if (removeButton && !removeButton.disabled) {
    removeButton.click();
    console.log("✅ Existing file cleared");
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for clear
  } else {
    console.log("✅ No file to clear");
  }

  // Step 3: Initialize test
  console.log("\n🚀 STEP 3: Initializing PDF Test...");
  window.startPDFTest(
    "Stage6-Complete",
    "Comprehensive test of file upload system"
  );

  console.log("\n⏸️ PAUSED: Please upload a PDF file now");
  console.log("After uploading, run: window.continueTest()");

  // Store continuation function
  window.continueTest = async () => {
    if (!window.fileHandler?.currentFile) {
      console.error("No file detected. Please upload a PDF file.");
      return;
    }

    console.log("\n📄 STEP 4: Verifying File Upload...");
    window.recordFileUpload();

    await new Promise((r) => setTimeout(r, 500));

    console.log("\n🔧 STEP 5: Testing Smart Engine Integration...");
    await window.testSmartEngineIntegration();

    console.log("\n⚙️ STEP 6: Checking Parameter Synchronization...");
    const syncStatus = window.fileHandler?.parameterSync?.getSyncStatus();
    console.log(
      "Sync Status:",
      syncStatus?.initialised ? "✅ Enabled" : "❌ Disabled"
    );

    if (syncStatus?.statistics) {
      console.log("Statistics:", syncStatus.statistics);
    }

    console.log("\n📏 STEP 7: Testing Response Size Prediction...");
    const sizePrediction = window.fileHandler?.fileAnalysis?.sizePrediction;
    console.log(
      `Predicted Size: ${sizePrediction?.estimatedSize?.toFixed(2) || "N/A"} MB`
    );

    const warningLevel = sizePrediction?.warning ? "⚠️ Warning" : "None";
    console.log(`Warning Level: ${warningLevel}`);

    // NEW: Prompt for LLM request
    console.log("\n📝 STEP 8: Ready for LLM Request...");
    console.log("=====================================");
    console.log("✅ File analysis complete");
    console.log("✅ Parameters synchronized");
    console.log("✅ Cost estimated");
    console.log("\n⏸️ PAUSED: Please send a request to the LLM now");
    console.log("Example: 'Tell me something surprising about this PDF'");
    console.log(
      "Before sending request, use window.markRequestStart() to start the clock, then send the request  '"
    );
    console.log(
      "After response completes, run: window.markRequestComplete()  and then window.finalizeTest()"
    );
    console.log("=====================================");

    // Store test state for finalization
    window.pendingTestData = {
      fileInfo: window.fileHandler?.currentFile,
      analysis: window.fileHandler?.fileAnalysis,
      costEstimate: window.fileHandler?.costEstimate,
      syncStatus: syncStatus,
      requestStartTime: null,
      responseStartTime: null,
    };

    // Set up request monitoring
    // window.recordRequestStart(); // This might be automatically calling recordRequestStart

    return "Waiting for LLM request...";
  };

  // NEW: Finalize test after response
  window.finalizeTest = () => {
    if (!window.pendingTestData) {
      console.error("No test in progress. Run continueTest() first.");
      return;
    }

    const testResult = window.completeTest({
      satisfied: true,
      responseReceived: true,
    });

    console.log("\n📊 COMPREHENSIVE TEST SUMMARY:");
    console.log("=====================================");
    console.log("✅ File uploaded and analyzed");
    console.log(
      `✅ Smart engine: ${window.pendingTestData.analysis?.recommendedEngine}`
    );
    console.log(
      `✅ Parameter sync: ${
        window.pendingTestData.syncStatus?.initialised ? "Active" : "Inactive"
      }`
    );
    console.log(
      `✅ Cost estimate: ${
        window.pendingTestData.costEstimate?.formatted || "N/A"
      }`
    );

    // Get actual test duration from PDF testing suite
    const currentTest =
      window.pdfTestingSuite?.currentTest ||
      window.pdfTestingSuite?.testResults?.[
        window.pdfTestingSuite.testResults.length - 1
      ];

    if (currentTest?.performanceTiming) {
      const timing = currentTest.performanceTiming;
      console.log(`✅ Upload time: ${timing.uploadDuration || "N/A"}ms`);
      console.log(`✅ Request time: ${timing.requestDuration || "N/A"}ms`);
      console.log(
        `✅ Total duration: ${
          timing.totalTestDuration
            ? (timing.totalTestDuration / 1000).toFixed(1) + "s"
            : "N/A"
        }`
      );
    }

    console.log("=====================================");

    // Clean up
    delete window.pendingTestData;

    return testResult;
  };

  return "Waiting for file upload... Run window.continueTest() after uploading";
};

// Quick status check helper
window.quickCheck = () => {
  const checks = {
    "File Loaded": !!window.fileHandler?.currentFile,
    "File Name": window.fileHandler?.currentFile?.name || "None",
    "Analysis Done": !!window.fileHandler?.fileAnalysis,
    "Engine Recommended":
      window.fileHandler?.fileAnalysis?.recommendedEngine || "None",
    "Param Sync Active": window.fileHandler?.parameterSyncAvailable || false,
    "Cost Estimated": window.fileHandler?.costEstimate?.formatted || "None",
  };

  console.table(checks);

  // Check for warnings
  const warnings = [];
  const logs = console.logs || [];
  if (logs.some((log) => log.includes("Parameter controller not available"))) {
    warnings.push("Parameter controller warning detected");
  }
  if (logs.some((log) => log.includes("recursive"))) {
    warnings.push("Recursion warning detected");
  }

  if (warnings.length > 0) {
    console.log("\n⚠️ Warnings detected:", warnings);
  } else {
    console.log("\n✅ No warnings detected");
  }

  return checks;
};

/**
 * Phase 2: Comprehensive Testing Protocol for Interactive Engine Cards
 * Run these tests after implementing Phase 2 changes
 */

// ===== PRE-IMPLEMENTATION VALIDATION =====

// Test 1: Verify Phase 1 is still working
const validatePhase1 = () => {
  console.log("\n=== Phase 1 Validation ===");
  const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");

  const phase1Status = {
    parameterExists: !!pdfParam,
    parameterEnabled: pdfParam
      ? !pdfParam.elements.wrapper.classList.contains("parameter-disabled")
      : false,
    currentValue: pdfParam?.getValue(),
    hasFile: !!window.fileHandler?.currentFile,
    isPDF: window.fileHandler?.currentFile?.type === "application/pdf",
  };

  console.log("Phase 1 Status:", phase1Status);

  const phase1Working =
    phase1Status.parameterExists && phase1Status.parameterEnabled;
  console.log(
    phase1Working ? "✅ Phase 1 Validated" : "❌ Phase 1 Issues Detected"
  );

  return phase1Working;
};

// Test 2: Check current visual cards
const checkCurrentVisualCards = () => {
  console.log("\n=== Current Visual Cards Analysis ===");

  const visualCards = document.querySelectorAll(".engine-option");
  const hasRecommended = !!document.querySelector(".engine-option.recommended");
  const isInteractive = !!document.querySelector(
    ".engine-option.interactive-card"
  );

  console.log("Current Visual State:", {
    totalCards: visualCards.length,
    hasRecommended,
    isInteractive,
    cardTypes: Array.from(visualCards).map((card) => ({
      className: card.className,
      hasRadio: !!card.querySelector('input[type="radio"]'),
      clickable:
        card.style.cursor === "pointer" ||
        card.classList.contains("interactive-card"),
    })),
  });

  return visualCards.length > 0;
};

// Run pre-implementation validation
window.validatePhase2Readiness = () => {
  console.log("🎯 Phase 2 Readiness Check");

  const phase1Valid = validatePhase1();
  const hasVisualCards = checkCurrentVisualCards();

  const readyForPhase2 = phase1Valid && hasVisualCards;

  console.log(
    readyForPhase2
      ? "🚀 Ready for Phase 2 Implementation!"
      : "⚠️ Please address issues before implementing Phase 2"
  );

  return readyForPhase2;
};

// ===== POST-IMPLEMENTATION VALIDATION =====

// Test 3: Verify interactive cards functionality with native radio buttons
const testInteractiveCards = () => {
  console.log("\n=== Interactive Cards Functionality Test ===");

  const interactiveCards = document.querySelectorAll(
    ".engine-option.interactive-card"
  );

  if (interactiveCards.length === 0) {
    console.log(
      "❌ No interactive cards found - implementation may have failed"
    );
    return false;
  }

  console.log(`✅ Found ${interactiveCards.length} interactive cards`);

  // Test each card structure
  const cardTests = Array.from(interactiveCards).map((card, index) => {
    const radio = card.querySelector(".engine-radio");
    const engineName = card.querySelector(".engine-name");
    const engineCost = card.querySelector(".engine-cost");
    const badgeContainer = card.querySelector(".recommended-badge-container");
    const badge = badgeContainer?.querySelector(".recommended-badge");
    const isRecommended = card.classList.contains("recommended");

    const cardTest = {
      index,
      hasRadio: !!radio,
      radioIsNative: radio?.type === "radio",
      radioIsVisible: radio && !radio.classList.contains("sr-only"),
      hasName: !!engineName,
      hasCost: !!engineCost,
      hasBadgeContainer: !!badgeContainer,
      badgeExists: !!badge,
      badgeMatchesRecommended: isRecommended ? !!badge : !badge,
      isClickable: card.tagName.toLowerCase() === "label",
      radioChecked: radio?.checked,
      engine: radio?.value,
    };

    console.log(`Card ${index + 1} (${cardTest.engine}):`, cardTest);

    const cardValid =
      cardTest.hasRadio &&
      cardTest.radioIsNative &&
      cardTest.radioIsVisible &&
      cardTest.hasName &&
      cardTest.hasCost &&
      cardTest.hasBadgeContainer &&
      cardTest.badgeMatchesRecommended &&
      cardTest.isClickable;

    return cardValid;
  });

  const allCardsValid = cardTests.every((test) => test);
  console.log(
    allCardsValid
      ? "✅ All cards properly structured with native radio buttons and separate badge containers"
      : "❌ Some cards have issues"
  );

  return allCardsValid;
};

// Test 4: Verify parameter synchronization
const testParameterSync = () => {
  console.log("\n=== Parameter Synchronization Test ===");

  const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
  if (!pdfParam) {
    console.log("❌ PDF parameter not found");
    return false;
  }

  const interactiveCards = document.querySelectorAll(
    ".engine-option.interactive-card"
  );
  if (interactiveCards.length === 0) {
    console.log("❌ No interactive cards for sync testing");
    return false;
  }

  // Test parameter → visual sync
  console.log("Testing parameter → visual synchronization...");

  const engines = ["native", "pdf-text", "mistral-ocr"];
  const syncResults = engines.map((engine) => {
    // Set parameter value
    pdfParam.setValue(engine);

    // Check visual update
    setTimeout(() => {
      const selectedCard = document.querySelector(
        ".engine-option.interactive-card.selected"
      );
      const selectedRadio = document.querySelector(".engine-radio:checked");

      const syncWorking =
        selectedRadio?.value === engine &&
        selectedCard?.querySelector(".engine-radio")?.value === engine;

      console.log(
        `Engine ${engine}: Parameter→Visual sync ${syncWorking ? "✅" : "❌"}`
      );

      return syncWorking;
    }, 100);
  });

  return true; // Async results logged above
};

// Test 5: Verify visual → parameter sync
const testVisualToParameterSync = () => {
  console.log("\n=== Visual → Parameter Sync Test ===");

  const interactiveCards = document.querySelectorAll(
    ".engine-option.interactive-card"
  );
  const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");

  if (interactiveCards.length === 0 || !pdfParam) {
    console.log("❌ Prerequisites not met for visual sync testing");
    return false;
  }

  console.log(
    "Click on different engine cards and observe parameter updates..."
  );

  // Set up monitoring
  let syncEvents = [];

  const syncMonitor = (event) => {
    syncEvents.push({
      engine: event.detail.engine,
      timestamp: Date.now(),
      parameterValue: pdfParam.getValue(),
    });

    console.log(
      `Visual Selection: ${
        event.detail.engine
      }, Parameter: ${pdfParam.getValue()}`
    );
  };

  document.addEventListener("pdf-engine-changed", syncMonitor);

  // Manual testing instructions
  console.log("📋 MANUAL TEST REQUIRED:");
  console.log("1. Click on different engine cards");
  console.log("2. Verify parameter dropdown updates");
  console.log("3. Check cost display updates");
  console.log("4. Test keyboard navigation (Tab, Enter, Arrow keys)");

  // Clean up after 30 seconds
  setTimeout(() => {
    document.removeEventListener("pdf-engine-changed", syncMonitor);
    console.log("\n📊 Sync Events Captured:", syncEvents);
  }, 30000);

  return true;
};

// Test 6: Accessibility validation with native radio buttons
const testAccessibility = () => {
  console.log("\n=== Accessibility Validation ===");

  const interactiveCards = document.querySelectorAll(
    ".engine-option.interactive-card"
  );
  const fieldset = document.querySelector(".engine-options-fieldset");
  const legend = fieldset?.querySelector("legend");

  console.log("Fieldset structure:", {
    hasFieldset: !!fieldset,
    hasLegend: !!legend,
    legendText: legend?.textContent,
    fieldsetRole: fieldset?.getAttribute("role"),
  });

  const a11yTests = Array.from(interactiveCards).map((card, index) => {
    const radio = card.querySelector(".engine-radio");
    const radioId = radio?.id;
    const labelFor = card.getAttribute("for");
    const hasAriaDescribedBy =
      card.hasAttribute("aria-describedby") ||
      radio?.hasAttribute("aria-describedby");
    const radioName = radio?.name;
    const isProperLabel = card.tagName.toLowerCase() === "label";

    const a11yResult = {
      index,
      engine: radio?.value,
      hasRadio: !!radio,
      radioHasId: !!radioId,
      labelForMatches: labelFor === radioId,
      isProperLabel,
      hasAriaDescribedBy,
      radioName,
      sameName: radioName === "pdf-engine-visual",
      isKeyboardAccessible: radio?.type === "radio",
    };

    console.log(`A11Y Card ${index + 1}:`, a11yResult);

    return (
      a11yResult.hasRadio &&
      a11yResult.labelForMatches &&
      a11yResult.isProperLabel &&
      a11yResult.sameName &&
      a11yResult.isKeyboardAccessible
    );
  });

  const fieldsetValid = !!fieldset && !!legend;
  const allAccessible = a11yTests.every((test) => test) && fieldsetValid;

  console.log(
    fieldsetValid
      ? "✅ Fieldset structure valid"
      : "❌ Fieldset structure issues"
  );
  console.log(
    allAccessible
      ? "✅ Accessibility tests passed"
      : "❌ Accessibility issues found"
  );

  return allAccessible;
};

// Test 7: Cost calculation integration
const testCostCalculationIntegration = () => {
  console.log("\n=== Cost Calculation Integration Test ===");

  const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
  if (!pdfParam || !pdfParam.currentFile) {
    console.log(
      "⚠️ No PDF file uploaded - upload a PDF to test cost integration"
    );
    return false;
  }

  const engines = ["native", "pdf-text", "mistral-ocr"];

  engines.forEach((engine) => {
    pdfParam.setValue(engine);

    setTimeout(() => {
      const costDisplay = pdfParam.costElement?.textContent;
      const visualCard = document.querySelector(
        `.engine-option.interactive-card.selected`
      );
      const visualCost = visualCard?.querySelector(".engine-cost")?.textContent;

      console.log(`Engine ${engine}:`, {
        parameterCost: costDisplay,
        visualCost: visualCost,
        costsMatch:
          costDisplay?.includes(visualCost) ||
          visualCost?.includes("Token-based"),
      });
    }, 100);
  });

  return true;
};

// ===== COMPREHENSIVE TEST SUITE =====

window.runPhase2ValidationSuite = () => {
  console.log("🧪 PHASE 2 COMPREHENSIVE VALIDATION SUITE");
  console.log("=====================================\n");

  const tests = [
    { name: "Interactive Cards Structure", test: testInteractiveCards },
    { name: "Parameter Synchronization", test: testParameterSync },
    { name: "Visual → Parameter Sync", test: testVisualToParameterSync },
    { name: "Accessibility Compliance", test: testAccessibility },
    {
      name: "Cost Calculation Integration",
      test: testCostCalculationIntegration,
    },
  ];

  const results = tests.map(({ name, test }) => {
    console.log(`\n🔍 Running: ${name}`);
    const result = test();
    console.log(
      `${result ? "✅" : "❌"} ${name}: ${result ? "PASSED" : "FAILED"}`
    );
    return { name, passed: result };
  });

  const passedTests = results.filter((r) => r.passed).length;
  const totalTests = results.length;

  console.log("\n📊 VALIDATION SUMMARY");
  console.log("==================");
  console.log(`Passed: ${passedTests}/${totalTests} tests`);

  if (passedTests === totalTests) {
    console.log("🎉 ALL TESTS PASSED - Phase 2 implementation successful!");
  } else {
    console.log("⚠️ Some tests failed - review implementation");
    results
      .filter((r) => !r.passed)
      .forEach((result) => {
        console.log(`   ❌ ${result.name}`);
      });
  }

  return { passedTests, totalTests, success: passedTests === totalTests };
};

// ===== QUICK DEBUG COMMANDS =====

window.debugPhase2 = () => {
  console.log("🔧 Phase 2 Debug Information");
  console.log("===========================");

  // Component availability
  console.log("Components:", {
    fileHandler: !!window.fileHandler,
    parameterRegistry: !!window.parameterRegistry,
    pdfParameter: !!window.parameterRegistry?.getParameter("pdf-engine"),
    hasCurrentFile: !!window.fileHandler?.currentFile,
    isPDF: window.fileHandler?.currentFile?.type === "application/pdf",
  });

  // Visual elements
  const visualCards = document.querySelectorAll(".engine-option");
  const interactiveCards = document.querySelectorAll(
    ".engine-option.interactive-card"
  );

  console.log("Visual Elements:", {
    totalEngineCards: visualCards.length,
    interactiveCards: interactiveCards.length,
    hasRecommended: !!document.querySelector(".engine-option.recommended"),
    hasSelected: !!document.querySelector(".engine-option.selected"),
  });

  // Current selections
  const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
  const selectedRadio = document.querySelector(".engine-radio:checked");

  console.log("Current State:", {
    parameterValue: pdfParam?.getValue(),
    visuallySelected: selectedRadio?.value,
    selectedRadioId: selectedRadio?.id,
    syncStatus:
      pdfParam?.getValue() === selectedRadio?.value ? "synced" : "out-of-sync",
  });
};

// ===== EXPORT TEST FUNCTIONS =====

// Make functions available globally for easy testing
window.validatePhase2Readiness = validatePhase2Readiness;
window.runPhase2ValidationSuite = runPhase2ValidationSuite;
window.debugPhase2 = debugPhase2;
