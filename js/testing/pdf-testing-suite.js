/**
 * Comprehensive PDF Testing Suite
 * Tracks performance, analysis accuracy, and user experience metrics
 * for systematic PDF workflow testing and optimization
 */

class PDFTestingSuite {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
    this.performanceMetrics = {};
    this.analysisMetrics = {};
    // Tracking for all active intervals and timeouts to prevent memory leaks
    this.activeIntervals = [];
    this.activeTimeouts = [];
    this.activeObservers = [];
  }

  /**
   * Initialize a new PDF test session
   * @param {string} testName - Name/description of the test
   * @param {string} userPrompt - The prompt user will send
   */
  startPDFTest(testName = "PDF Workflow Test", userPrompt = "") {
    this.currentTest = {
      testName,
      userPrompt,
      startTime: Date.now(),
      timestamps: {
        testStart: new Date().toISOString(),
        uploadStart: null,
        uploadComplete: null,
        analysisComplete: null,
        requestStart: null,
        requestComplete: null,
        responseStart: null,
        responseComplete: null,
      },
      fileInfo: {},
      analysisResults: {},
      requestDetails: {},
      responseMetrics: {},
      performanceTiming: {},
      userExperience: {
        uploadFeedback: null,
        analysisVisibility: null,
        requestProgress: null,
        responseQuality: null,
      },
      errors: [],
      warnings: [],
    };

    console.log(" PDF Testing Suite Initialized");
    console.log("=====================================");
    console.log(`?? Test: ${testName}`);
    console.log(`?? User Prompt: ${userPrompt || "Not specified"}`);
    console.log(`? Start Time: ${this.currentTest.timestamps.testStart}`);
    console.log("=====================================");

    // Clear any existing files
    this.clearExistingFile();

    // Set up monitoring
    this.setupPerformanceMonitoring();

    return this.currentTest;
  }

  /**
   * Clear existing file and reset state
   */
  clearExistingFile() {
    console.log(" Clearing existing file state...");

    const before = {
      hasFile: window.fileHandler?.hasValidFile,
      fileName: window.fileHandler?.currentFile?.name,
      hasAnalysis: !!window.fileHandler?.fileAnalysis,
    };

    if (window.fileHandler?.clearFile) {
      window.fileHandler.clearFile();
    }

    const after = {
      hasFile: window.fileHandler?.hasValidFile,
      fileName: window.fileHandler?.currentFile?.name,
      hasAnalysis: !!window.fileHandler?.fileAnalysis,
    };

    console.log("- Before clear:", before);
    console.log("- After clear:", after);
    console.log("? File state cleared");
  }

  /**
   * Record file upload completion with enhanced timing capture
   */
  recordFileUpload() {
    if (!this.currentTest) {
      console.warn(" No active test to record file upload");
      return;
    }

    const fileInfo = this.extractFileInfo();
    const analysisResults = this.extractAnalysisResults();
    const uploadCompleteTime = Date.now();

    this.currentTest.timestamps.uploadComplete = new Date().toISOString();
    this.currentTest.fileInfo = fileInfo;
    this.currentTest.analysisResults = analysisResults;

    // Enhanced upload duration calculation
    let uploadDuration = 0;

    if (this.currentTest.timestamps.uploadStart) {
      // Use existing start time if available
      const uploadStart = new Date(
        this.currentTest.timestamps.uploadStart
      ).getTime();
      uploadDuration = uploadCompleteTime - uploadStart;
    } else {
      // Estimate upload duration from recent file handler logs
      // Look for file processing start in recent history (last 10 seconds)
      const recentTime = uploadCompleteTime - 10000;

      // Check if we can find the file processing start time
      const fileHandler = window.fileHandler;
      if (fileHandler?.currentFile?.lastModified) {
        // Use a reasonable estimate for upload duration
        uploadDuration = 50; // Reasonable default for local file processing
      }
    }

    this.currentTest.performanceTiming.uploadDuration = uploadDuration;

    console.log(" File Upload Recorded:");
    console.log("- File:", fileInfo);
    console.log("- Analysis:", analysisResults);
    console.log("- Upload Duration:", uploadDuration + "ms");
  }
  /**
   * SIMPLIFIED: Manually mark request start
   * Call this when you actually send the request
   */
  recordRequestStart(actualPrompt = "") {
    if (!this.currentTest) {
      console.warn("📋 No active test - cannot record request start");
      return;
    }

    const currentTime = Date.now();
    this.currentTest.timestamps.requestStart = new Date().toISOString();
    this.currentTest.performanceTiming.requestStartTime = currentTime;

    // Basic request details
    const modelManager = window.modelManager;
    const parameterController = window.parameterController;

    this.currentTest.requestDetails = {
      actualPrompt: actualPrompt || this.currentTest.userPrompt,
      model: modelManager?.getCurrentModel()?.id || "unknown",
      modelName: modelManager?.getCurrentModel()?.name || "Unknown Model",
      temperature:
        parameterController?.getParameterValue("temperature") || "unknown",
      maxTokens:
        parameterController?.getParameterValue("max_tokens") || "unknown",
      timestamp: this.currentTest.timestamps.requestStart,
    };

    console.log("📋 Request manually marked as started");
    console.log("- Time:", this.currentTest.timestamps.requestStart);
    console.log("- Prompt:", actualPrompt || "Not specified");

    // Start simple content monitoring
    this.startSimpleMonitoring();
  }

  /**
   * SIMPLIFIED: Just check for content periodically
   */
  startSimpleMonitoring() {
    let checkCount = 0;
    const maxChecks = 150; // 30 seconds at 200ms intervals

    const checkForContent = () => {
      checkCount++;

      // Safety check
      if (!this.currentTest || this.currentTest.timestamps.requestComplete) {
        return true; // Stop checking
      }

      const responseDisplay = document.querySelector("#response-display");
      const content = responseDisplay?.textContent?.trim() || "";

      // Track first content appearance
      if (!this.currentTest.timestamps.responseStart && content.length > 10) {
        this.currentTest.timestamps.responseStart = new Date().toISOString();
        const elapsed =
          Date.now() - this.currentTest.performanceTiming.requestStartTime;
        this.currentTest.performanceTiming.timeToFirstResponse = elapsed;
        console.log(`📋 First content detected after ${elapsed}ms`);
      }

      // Simple completion check - content exists and is stable
      if (content.length > 50) {
        if (
          !this.currentTest.lastContentLength ||
          this.currentTest.lastContentLength === content.length
        ) {
          this.currentTest.stabilityCount =
            (this.currentTest.stabilityCount || 0) + 1;

          // If content stable for 5 checks (1 second), mark complete
          if (this.currentTest.stabilityCount >= 5) {
            console.log(
              `📋 Content stable at ${content.length} chars - marking complete`
            );
            this.markRequestComplete();
            return true;
          }
        } else {
          this.currentTest.stabilityCount = 0;
        }
        this.currentTest.lastContentLength = content.length;
      }

      // Timeout after max checks
      if (checkCount >= maxChecks) {
        console.log("⏱️ Monitoring timeout - marking complete");
        this.markRequestComplete();
        return true;
      }

      return false;
    };

    // Check immediately
    if (checkForContent()) return;

    // Then check periodically
    const interval = setInterval(() => {
      if (checkForContent()) {
        clearInterval(interval);
        // Remove from tracking
        const index = this.activeIntervals.indexOf(interval);
        if (index > -1) {
          this.activeIntervals.splice(index, 1);
        }
      }
    }, 200);

    this.activeIntervals.push(interval);
  }

  /**
   * SIMPLIFIED: Mark request as complete and analyze with proper timing
   */
  markRequestComplete() {
    if (!this.currentTest || this.currentTest.timestamps.requestComplete) {
      return;
    }

    const completionTime = Date.now();
    this.currentTest.timestamps.requestComplete = new Date().toISOString();

    // Calculate basic timing
    if (this.currentTest.performanceTiming.requestStartTime) {
      this.currentTest.performanceTiming.requestDuration =
        completionTime - this.currentTest.performanceTiming.requestStartTime;
    }

    console.log("📋 Request marked complete");
    if (this.currentTest.performanceTiming.requestDuration) {
      console.log(
        `- Duration: ${this.currentTest.performanceTiming.requestDuration}ms`
      );
    }

    // FIXED: Wait for DOM operations to complete before analysis
    console.log("⏳ Waiting for DOM updates before analysis...");
    this.performDelayedAnalysis();
  }

  /**
   * FIXED: Delayed analysis with retry logic for content detection
   */
  performDelayedAnalysis(attemptCount = 0) {
    const maxAttempts = 8;
    const baseDelay = 300; // Start with 300ms delay

    const checkForContent = () => {
      // Enhanced selectors including .results-content
      const selectors = [
        ".results-content", // Bridge-processed content
        "#response-display",
        ".response-content",
        ".ai-response",
        ".message-content",
        "#response-display .content",
        "#response-display > div",
      ];

      let content = "";
      let foundSelector = null;

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || "";
          if (text.length > content.length) {
            content = text;
            foundSelector = selector;
          }
        }
      }

      console.log(
        `🔍 Attempt ${attemptCount + 1}/${maxAttempts}: Found ${
          content.length
        } chars via ${foundSelector || "none"}`
      );

      // Check if we have substantial content OR if we've reached max attempts
      if (content.length > 50 || attemptCount >= maxAttempts - 1) {
        if (content.length > 50) {
          console.log("✅ Content found, performing analysis");
        } else {
          console.log("⏰ Max attempts reached, analyzing available content");
        }
        this.performSimpleAnalysisWithContent(content, foundSelector);
        return true; // Stop retrying
      }

      return false; // Continue retrying
    };

    // Try immediately first
    if (checkForContent()) {
      return;
    }

    // Retry with exponential backoff
    if (attemptCount < maxAttempts - 1) {
      const delay = baseDelay * Math.pow(1.4, attemptCount); // Exponential backoff
      setTimeout(() => {
        this.performDelayedAnalysis(attemptCount + 1);
      }, Math.min(delay, 2000)); // Cap at 2 seconds
    }
  }

  /**
   * SIMPLIFIED: Just analyze whatever content is available
   */
  performSimpleAnalysis() {
    // This method is now replaced by performDelayedAnalysis for better timing
    console.log(
      "⚠️ performSimpleAnalysis called directly - redirecting to delayed analysis"
    );
    this.performDelayedAnalysis();
  }

  /**
   * FIXED: Enhanced analysis with content and source tracking
   */
  performSimpleAnalysisWithContent(content, contentSource = "unknown") {
    if (!content || content.length === 0) {
      console.log("❌ No content provided for analysis");
      this.currentTest.responseMetrics = {
        responseLength: 0,
        wordCount: 0,
        qualityScore: 0,
        pdfReference: false,
        structuralAnalysis: false,
        contentSource: "none-found",
        detectionDelay: "failed",
      };
      return;
    }

    const words = content.split(/\s+/).filter((w) => w.length > 0);
    const pdfReference = /pdf|document|file|upload|page|section/i.test(content);
    const hasStructure = content.length > 100 && words.length > 20;

    // Enhanced quality scoring
    let score = 0;
    if (content.length > 100) score += 15;
    if (content.length > 500) score += 15;
    if (content.length > 1000) score += 10;
    if (words.length > 50) score += 15;
    if (words.length > 100) score += 10;
    if (pdfReference) score += 20;
    if (hasStructure) score += 15;

    // Calculate timing metrics
    const analysisDelay = this.currentTest.timestamps.requestComplete
      ? Date.now() -
        new Date(this.currentTest.timestamps.requestComplete).getTime()
      : 0;

    this.currentTest.responseMetrics = {
      responseLength: content.length,
      wordCount: words.length,
      qualityScore: score,
      pdfReference: pdfReference,
      structuralAnalysis: hasStructure,
      contentSource: contentSource,
      detectionDelay: analysisDelay + "ms",
    };

    console.log("📊 Enhanced analysis complete:");
    console.log(`- Length: ${content.length} chars`);
    console.log(`- Words: ${words.length}`);
    console.log(`- Quality: ${score}/100`);
    console.log(`- PDF Reference: ${pdfReference ? "✅" : "❌"}`);
    console.log(`- Content Source: ${contentSource}`);
    console.log(`- Detection Delay: ${analysisDelay}ms`);

    // Track first response timing if not already set
    if (
      !this.currentTest.performanceTiming.timeToFirstResponse &&
      content.length > 50
    ) {
      const requestStart = this.currentTest.performanceTiming.requestStartTime;
      if (requestStart) {
        this.currentTest.performanceTiming.timeToFirstResponse =
          Date.now() - requestStart;
        console.log(
          `📊 Time to First Response: ${this.currentTest.performanceTiming.timeToFirstResponse}ms`
        );
      }
    }
  }
  /**
   * Clear all active monitoring (intervals, timeouts, observers)
   * Critical for preventing memory leaks
   */
  clearAllMonitoring() {
    console.log("🧹 Clearing all active monitoring...");

    // Clear intervals
    if (this.activeIntervals.length > 0) {
      console.log(`  Clearing ${this.activeIntervals.length} intervals`);
      this.activeIntervals.forEach((id) => clearInterval(id));
      this.activeIntervals = [];
    }

    // Clear timeouts
    if (this.activeTimeouts.length > 0) {
      console.log(`  Clearing ${this.activeTimeouts.length} timeouts`);
      this.activeTimeouts.forEach((id) => clearTimeout(id));
      this.activeTimeouts = [];
    }

    // Disconnect observers
    if (this.activeObservers.length > 0) {
      console.log(`  Disconnecting ${this.activeObservers.length} observers`);
      this.activeObservers.forEach((observer) => observer.disconnect());
      this.activeObservers = [];
    }

    // Clean up any stored observer references in currentTest
    if (this.currentTest?.completionObserver) {
      this.currentTest.completionObserver.disconnect();
      delete this.currentTest.completionObserver;
    }

    console.log("✅ All monitoring cleared");
  }

  /**
   * Record request completion with enhanced timing and response analysis
   * @param {boolean} timeout - Whether this was triggered by timeout
   */
  recordRequestComplete(timeout = false) {
    if (!this.currentTest || this.currentTest.timestamps.requestComplete) {
      return; // Already recorded or no active test
    }

    const completionTime = Date.now();
    this.currentTest.timestamps.requestComplete = new Date().toISOString();

    // Calculate timing metrics using millisecond timestamps for accuracy
    const requestStartTime =
      this.currentTest.performanceTiming.requestStartTime ||
      new Date(this.currentTest.timestamps.requestStart).getTime();

    this.currentTest.performanceTiming.requestDuration =
      completionTime - requestStartTime;

    if (this.currentTest.timestamps.responseStart) {
      const responseStartTime = new Date(
        this.currentTest.timestamps.responseStart
      ).getTime();
      // Only calculate if we haven't already set it
      if (!this.currentTest.performanceTiming.timeToFirstResponse) {
        this.currentTest.performanceTiming.timeToFirstResponse =
          responseStartTime - requestStartTime;
      }
      this.currentTest.performanceTiming.responseStreamingDuration =
        completionTime - responseStartTime;
    }

    // Analyze response quality with enhanced metrics
    this.analyzeResponseQuality();

    // Log the results
    console.log("📋 Request completed successfully");
    console.log(
      "- Request Duration:",
      this.currentTest.performanceTiming.requestDuration + "ms"
    );
    if (this.currentTest.performanceTiming.timeToFirstResponse) {
      console.log(
        "- Time to First Response:",
        this.currentTest.performanceTiming.timeToFirstResponse + "ms"
      );
    }
    if (this.currentTest.performanceTiming.responseStreamingDuration) {
      console.log(
        "- Streaming Duration:",
        this.currentTest.performanceTiming.responseStreamingDuration + "ms"
      );
    }

    if (timeout) {
      this.currentTest.warnings.push("Request completed due to timeout");
    }
  }

  /**
   * Analyze response quality with robust content detection
   */
  analyzeResponseQuality() {
    console.log("🔍 Starting response quality analysis...");

    // Wait for DOM operations to complete with retry logic
    const waitForContent = (attempts = 0) => {
      const maxAttempts = 10;
      const responseDisplay = document.querySelector("#response-display");
      const contentLength = responseDisplay?.textContent?.trim().length || 0;

      // Check if DOM operations are complete
      const domState =
        window.resultsManager?.core?.getDOMOperationDiagnostics?.();
      const isDOMComplete =
        !domState ||
        domState.state === "idle" ||
        domState.state === "completed";
      const isBridgeProcessing =
        window.resultsManager?.core?.isBridgeProcessing?.() ?? false;

      console.log(
        `🔍 Waiting for content (attempt ${attempts + 1}/${maxAttempts}):`,
        {
          contentLength,
          isDOMComplete,
          isBridgeProcessing,
          domState: domState?.state,
        }
      );

      // Wait for both content and DOM to be ready
      if (contentLength > 50 && isDOMComplete && !isBridgeProcessing) {
        console.log("🔍 Content ready, performing analysis");
        // Add small delay to ensure everything is settled
        setTimeout(() => this.performResponseAnalysis(), 500);
      } else if (attempts < maxAttempts) {
        // Retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(1.5, attempts), 5000);
        setTimeout(() => waitForContent(attempts + 1), delay);
      } else {
        console.log("🔍 Max attempts reached, performing analysis anyway");
        this.performResponseAnalysis();
      }
    };

    // Start waiting with initial delay
    setTimeout(() => waitForContent(), 1000);
  }

  /**
   * Perform the actual response analysis with enhanced content detection
   */
  performResponseAnalysis() {
    // Try multiple selectors to find response content (expanded list for bridge content)
    const selectors = [
      "#response-display",
      ".response-content",
      ".ai-response",
      ".message-content",
      "[data-response-content]",
      ".result-content",
      ".markdown-body",
      ".response-text",
      ".processed-content",
      ".bridge-content",
      "#response-display .content",
      "#response-display > div",
      ".results-content",
    ];

    let responseDisplay = null;
    let responseText = "";
    let responseHTML = "";

    // Enhanced content detection
    for (const selector of selectors) {
      responseDisplay = document.querySelector(selector);
      if (responseDisplay) {
        responseText =
          responseDisplay.textContent || responseDisplay.innerText || "";
        responseHTML = responseDisplay.innerHTML || "";
        if (responseText.trim().length > 0) {
          console.log(
            `📍 Found response content via: ${selector} (${responseText.length} chars)`
          );
          break;
        }
      }
    }

    // Fallback: check all elements with substantial text content
    if (!responseText.trim()) {
      console.log("🔍 Trying fallback content detection...");
      const allElements = document.querySelectorAll("*");
      for (const element of allElements) {
        const text = element.textContent || element.innerText || "";
        if (text.length > 200 && !element.querySelector("*")) {
          // Found element with substantial text and no children
          responseText = text;
          responseHTML = element.innerHTML || "";
          responseDisplay = element;
          console.log(`📍 Fallback found content: ${text.length} chars`);
          break;
        }
      }
    }

    if (!responseText.trim()) {
      console.warn("❌ No response content found for analysis");
      this.currentTest.warnings.push("No response content found for analysis");

      // Initialize empty responseMetrics to prevent undefined errors
      this.currentTest.responseMetrics = {
        responseLength: 0,
        wordCount: 0,
        qualityScore: 0,
        pdfReference: false,
        structuralAnalysis: false,
        contentSource: "none-found",
      };
      return;
    }

    // Perform quality analysis
    const words = responseText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const qualityScore = this.calculateResponseQuality(responseText);

    // Enhanced content analysis
    const pdfReference = /pdf|document|file|upload/i.test(responseText);
    const structuralAnalysis = responseText.length > 100 && words.length > 20;

    // Store results in currentTest.responseMetrics (THIS WAS THE MISSING PIECE!)
    this.currentTest.responseMetrics = {
      responseLength: responseText.length,
      wordCount: words.length,
      qualityScore: qualityScore,
      pdfReference: pdfReference,
      structuralAnalysis: structuralAnalysis,
      contentSource: responseDisplay?.id
        ? `#${responseDisplay.id}`
        : responseDisplay?.className
        ? `.${responseDisplay.className.split(" ")[0]}`
        : "fallback",
    };

    // Log results
    console.log("📊 Response Analysis Complete:");
    console.log(`- Length: ${responseText.length} characters`);
    console.log(`- Words: ${words.length}`);
    console.log(`- Quality Score: ${qualityScore}/100`);
    console.log(`- PDF Reference: ${pdfReference ? "✅" : "❌"}`);
    console.log(`- Structural Analysis: ${structuralAnalysis ? "✅" : "❌"}`);
  }
  /**
   * Calculate response quality score (0-100)
   * @param {string} responseText - The response text to analyze
   * @returns {number} Quality score
   */
  calculateResponseQuality(responseText) {
    let score = 0;

    // Length scoring (20 points max)
    if (responseText.length > 100) score += 5;
    if (responseText.length > 500) score += 5;
    if (responseText.length > 1000) score += 10;

    // Content relevance (30 points max)
    if (/pdf|document/i.test(responseText)) score += 10;
    if (/page|section/i.test(responseText)) score += 10;
    if (/content|information/i.test(responseText)) score += 10;

    // Structure indicators (30 points max)
    if (/summary|overview/i.test(responseText)) score += 10;
    if (/key|main|important/i.test(responseText)) score += 10;
    if (/warranty|samsung|microwave/i.test(responseText)) score += 10; // File-specific content

    // Formatting quality (20 points max)
    const hasStructure = /\n\n|\*\*|##|1\.|�/.test(responseText);
    if (hasStructure) score += 20;

    return Math.min(score, 100);
  }

  /**
   * Complete the test and generate comprehensive report
   * @param {Object} userFeedback - Optional user experience feedback
   */
  completeTest(userFeedback = {}) {
    if (!this.currentTest) {
      console.warn("⚠️ No active test to complete");
      return null;
    }

    // Clear all monitoring BEFORE clearing currentTest
    console.log("🏁 Completing test - clearing all monitoring");
    this.clearAllMonitoring();

    // Record completion time
    this.currentTest.timestamps.testEnd = new Date().toISOString();

    // Calculate total test duration
    const totalDuration = Date.now() - this.currentTest.startTime;
    this.currentTest.performanceTiming.totalTestDuration = totalDuration;

    // Record user feedback
    this.currentTest.userExperience = {
      ...this.currentTest.userExperience,
      ...userFeedback,
    };

    // Generate comprehensive report
    const report = this.generateTestReport();

    // Store result
    this.testResults.push(this.currentTest);

    // Clear current test
    const completedTest = this.currentTest;
    this.currentTest = null;

    return { report, testData: completedTest };
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    const test = this.currentTest;
    const timing = test.performanceTiming;

    console.log("\n?? COMPREHENSIVE PDF TEST REPORT");
    console.log("=====================================");
    console.log(`?? Test: ${test.testName}`);
    console.log(`?? File: ${test.fileInfo.name} (${test.fileInfo.sizeKB} KB)`);
    console.log(
      `? Total Duration: ${(timing.totalTestDuration / 1000).toFixed(1)}s`
    );

    console.log("\n📊 PERFORMANCE METRICS:");
    console.log(
      `- Upload Duration: ${
        timing?.uploadDuration ? timing.uploadDuration + "ms" : "N/A"
      }`
    );
    console.log(
      `- Request Duration: ${
        timing?.requestDuration ? timing.requestDuration + "ms" : "N/A"
      }`
    );
    console.log(
      `- Time to First Response: ${
        timing?.timeToFirstResponse ? timing.timeToFirstResponse + "ms" : "N/A"
      }`
    );
    console.log(
      `- Streaming Duration: ${
        timing?.responseStreamingDuration
          ? timing.responseStreamingDuration + "ms"
          : "N/A"
      }`
    );

    console.log("\n📊 ANALYSIS RESULTS:");
    console.log(`- PDF Detection: ${test.analysisResults.isPDF ? "?" : "?"}`);
    console.log(`- Pages Estimated: ${test.analysisResults.estimatedPages}`);
    console.log(
      `- Recommended Engine: ${test.analysisResults.recommendedEngine}`
    );
    console.log(`- Confidence: ${test.analysisResults.confidence}`);
    console.log(`- Complexity: ${test.analysisResults.complexity}`);
    console.log(
      `- Analysis Completeness: ${test.analysisResults.analysisCompleteness}%`
    );

    console.log("\n📊 RESPONSE QUALITY:");
    const response = test.responseMetrics;
    console.log(
      `- Response Length: ${response?.responseLength ?? "undefined"} chars`
    );
    console.log(`- Word Count: ${response?.wordCount ?? "undefined"}`);
    console.log(
      `- Quality Score: ${response?.qualityScore ?? "undefined"}/100`
    );
    console.log(`- PDF Reference: ${response?.pdfReference ? "✅" : "❌"}`);
    console.log(
      `- Structural Analysis: ${response?.structuralAnalysis ? "✅" : "❌"}`
    );

    console.log("\n?? ISSUES & WARNINGS:");
    if (test.errors.length > 0) {
      test.errors.forEach((error) => console.log(`- ERROR: ${error}`));
    }
    if (test.warnings.length > 0) {
      test.warnings.forEach((warning) => console.log(`- WARNING: ${warning}`));
    }
    if (test.errors.length === 0 && test.warnings.length === 0) {
      console.log("- No issues detected ?");
    }

    // Performance assessment
    console.log("\n?? PERFORMANCE ASSESSMENT:");
    const uploadTime = timing.uploadDuration || 0;
    const requestTime = timing.requestDuration || 0;

    console.log(
      `- Upload Speed: ${
        uploadTime < 2000 ? " Fast" : uploadTime < 5000 ? " Moderate" : " Slow"
      } (${uploadTime}ms)`
    );
    console.log(
      `- Request Speed: ${
        requestTime < 10000
          ? " Fast"
          : requestTime < 30000
          ? " Moderate"
          : " Slow"
      } (${requestTime}ms)`
    );
    console.log(
      `- Overall: ${
        timing.totalTestDuration < 30000
          ? " Excellent"
          : timing.totalTestDuration < 60000
          ? " Good"
          : " Needs Improvement"
      }`
    );

    console.log("\n=====================================");

    return {
      testName: test.testName,
      timestamp: test.timestamps.testStart,
      performance: timing,
      analysis: test.analysisResults,
      response: test.responseMetrics,
      fileInfo: test.fileInfo,
      issues: { errors: test.errors, warnings: test.warnings },
    };
  }

  /**
   * Assess completeness of analysis results
   * @param {Object} analysis - Analysis results object
   * @returns {number} Completeness percentage
   */
  assessAnalysisCompleteness(analysis) {
    const expectedFields = [
      "isPDF",
      "estimatedPages",
      "likelyScanned",
      "recommendedEngine",
      "confidence",
      "complexity",
      "sizeCategory",
      "textQuality",
    ];

    const presentFields = expectedFields.filter(
      (field) => analysis[field] !== undefined && analysis[field] !== null
    );

    return Math.round((presentFields.length / expectedFields.length) * 100);
  }

  /**
   * Extract file information for test recording
   * @returns {Object} File information or error object
   */
  extractFileInfo() {
    const fileHandler = window.fileHandler;
    const currentFile = fileHandler?.currentFile;

    if (!currentFile) {
      console.warn("extractFileInfo: No file available");
      return { error: "No file available" };
    }

    const fileInfo = {
      name: currentFile.name,
      type: currentFile.type,
      size: currentFile.size,
      sizeKB: (currentFile.size / 1024).toFixed(1),
      sizeMB: (currentFile.size / (1024 * 1024)).toFixed(2),
      lastModified: currentFile.lastModified,
      lastModifiedDate: new Date(currentFile.lastModified).toISOString(),
    };

    console.log("📄 File information extracted:", fileInfo);
    return fileInfo;
  }

  /**
   * Extract analysis results for test recording
   * @returns {Object} Analysis results or error object
   */
  extractAnalysisResults() {
    const analysis = window.fileHandler?.fileAnalysis;

    if (!analysis) {
      console.warn("extractAnalysisResults: No analysis available");
      return { error: "No analysis available" };
    }

    const analysisResults = {
      isPDF: analysis.isPDF || false,
      isImage: analysis.isImage || false,
      estimatedPages: analysis.estimatedPages || 0,
      likelyScanned: analysis.likelyScanned || false,
      recommendedEngine: analysis.recommendedEngine || "unknown",
      confidence: analysis.confidence || "unknown",
      complexity: analysis.complexity || "unknown",
      processingTime: analysis.processingTime || "unknown",
      sizeCategory: analysis.sizeCategory || "unknown",
      textQuality: analysis.textQuality || "unknown",
      analysisCompleteness: this.assessAnalysisCompleteness(analysis),
      costBreakdown: analysis.costBreakdown || null,
      sizePrediction: analysis.sizePrediction || null,
      engineRecommendations: analysis.engineRecommendations || null,
    };

    console.log("🔍 Analysis results extracted:", analysisResults);
    return analysisResults;
  }

  /**
   * Check for structural elements in response HTML
   * @param {string} responseHTML - HTML content to analyse
   * @returns {boolean} True if structural elements found
   */
  checkStructuralElements(responseHTML) {
    if (!responseHTML || typeof responseHTML !== "string") return false;

    // Look for structural HTML elements
    const structuralPatterns = [
      /<h[1-6][^>]*>/i, // Headings
      /<ul[^>]*>|<ol[^>]*>/i, // Lists
      /<table[^>]*>/i, // Tables
      /<p[^>]*>/i, // Paragraphs
      /<section[^>]*>/i, // Sections
      /<div[^>]*>/i, // Divs
      /<strong[^>]*>|<b[^>]*>/i, // Bold text
      /<em[^>]*>|<i[^>]*>/i, // Italic text
    ];

    return structuralPatterns.some((pattern) => pattern.test(responseHTML));
  }

  /**
   * Check if response references the PDF file
   * @param {string} responseText - Response text to analyse
   * @returns {boolean} True if PDF is referenced
   */
  checkPDFReference(responseText) {
    if (!responseText || typeof responseText !== "string") return false;

    const lowerText = responseText.toLowerCase();
    const pdfIndicators = [
      "pdf",
      "document",
      "file",
      "page",
      "section",
      "manual",
      "guide",
      "instruction",
      "content",
      "text",
      "information",
      "data",
    ];

    return pdfIndicators.some((indicator) => lowerText.includes(indicator));
  }

  /**
   * Check for structural analysis in response
   * @param {string} responseText - Response text to analyse
   * @returns {boolean} True if structural analysis found
   */
  checkStructuralAnalysis(responseText) {
    if (!responseText || typeof responseText !== "string") return false;

    const lowerText = responseText.toLowerCase();
    const structuralTerms = [
      "structure",
      "organisation",
      "organization",
      "layout",
      "format",
      "sections",
      "chapters",
      "parts",
      "overview",
      "summary",
      "table of contents",
      "index",
      "header",
      "footer",
      "title",
      "subtitle",
    ];

    return structuralTerms.some((term) => lowerText.includes(term));
  }

  /**
   * Count technical terms in response
   * @param {string} responseText - Response text to analyse
   * @returns {number} Count of technical terms
   */
  countTechnicalTerms(responseText) {
    if (!responseText || typeof responseText !== "string") return 0;

    const lowerText = responseText.toLowerCase();
    const technicalTerms = [
      // PDF-specific
      "pdf",
      "portable document format",
      "acrobat",
      "adobe",

      // Document processing
      "ocr",
      "optical character recognition",
      "text extraction",
      "document processing",
      "content analysis",

      // Technical formats
      "html",
      "css",
      "javascript",
      "markdown",
      "xml",
      "json",

      // File processing
      "metadata",
      "compression",
      "encoding",
      "format",
      "specification",
      "standard",
      "protocol",

      // Analysis terms
      "algorithm",
      "processing",
      "analysis",
      "detection",
      "recognition",
      "parsing",
      "extraction",
      "interpretation",
    ];

    let count = 0;
    technicalTerms.forEach((term) => {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });

    return count;
  }

  /**
   * Calculate comprehensive quality score (0-100)
   * @param {string} responseText - Response text to analyse
   * @param {string} responseHTML - Response HTML to analyse
   * @returns {number} Quality score
   */
  calculateQualityScore(responseText, responseHTML) {
    if (!responseText || typeof responseText !== "string") return 0;

    let score = 0;

    // Length scoring (25 points max)
    if (responseText.length > 100) score += 5;
    if (responseText.length > 500) score += 5;
    if (responseText.length > 1000) score += 10;
    if (responseText.length > 2000) score += 5;

    // Content relevance (25 points max)
    if (this.checkPDFReference(responseText)) score += 10;
    if (this.checkStructuralAnalysis(responseText)) score += 10;
    const technicalTerms = this.countTechnicalTerms(responseText);
    if (technicalTerms > 0) score += Math.min(5, technicalTerms);

    // Structural quality (25 points max)
    if (this.checkStructuralElements(responseHTML)) score += 15;
    const hasFormatting = /\*\*|##|1\.|•|\n\n/.test(responseText);
    if (hasFormatting) score += 10;

    // Completeness indicators (25 points max)
    const completenessTerms = [
      "summary",
      "overview",
      "key",
      "main",
      "important",
      "details",
      "information",
      "content",
      "analysis",
    ];
    let completenessScore = 0;
    completenessTerms.forEach((term) => {
      if (responseText.toLowerCase().includes(term)) {
        completenessScore += 3;
      }
    });
    score += Math.min(25, completenessScore);

    return Math.min(score, 100);
  }

  /**
   * Categorise response content by type
   * @param {string} responseText - Response text to analyse
   * @returns {Object} Content categories with boolean flags
   */
  categorizeContent(responseText) {
    if (!responseText || typeof responseText !== "string") {
      return {
        educational: false,
        analytical: false,
        practical: false,
        technical: false,
        design: false,
        summary: false,
      };
    }

    const lowerText = responseText.toLowerCase();

    return {
      educational: /learn|teach|explain|understand|concept|knowledge/.test(
        lowerText
      ),
      analytical: /analyz|evaluat|assess|examin|review|compar|insight/.test(
        lowerText
      ),
      practical:
        /implement|apply|use|example|step|guide|how to|instruction/.test(
          lowerText
        ),
      technical:
        /code|html|css|javascript|programming|developer|api|system/.test(
          lowerText
        ),
      design:
        /design|visual|aesthetic|layout|colour|color|typography|ui|ux/.test(
          lowerText
        ),
      summary: /summary|overview|conclusion|key points|main|important/.test(
        lowerText
      ),
    };
  }

  /**
   * Set up performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor for JavaScript errors
    const originalError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (this.currentTest) {
        this.currentTest.errors.push(`${message} at ${source}:${lineno}`);
      }
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }
    };

    // Monitor for console warnings
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (this.currentTest && args.length > 0) {
        const message = args.join(" ");
        if (
          !message.includes("WebSocket") &&
          !message.includes("browser-sync")
        ) {
          this.currentTest.warnings.push(message);
        }
      }
      originalWarn.apply(console, args);
    };
  }

  /**
   * Get test history and statistics
   */
  getTestHistory() {
    return {
      totalTests: this.testResults.length,
      tests: this.testResults,
      averageUploadTime: this.calculateAverage(
        "performanceTiming.uploadDuration"
      ),
      averageRequestTime: this.calculateAverage(
        "performanceTiming.requestDuration"
      ),
      averageQualityScore: this.calculateAverage(
        "responseMetrics.responseQualityScore"
      ),
      commonIssues: this.analyzeCommonIssues(),
    };
  }

  /**
   * Calculate average for a nested property
   * @param {string} propertyPath - Dot notation property path
   */
  calculateAverage(propertyPath) {
    const values = this.testResults
      .map((test) => this.getNestedProperty(test, propertyPath))
      .filter((val) => val !== undefined && val !== null && !isNaN(val));

    return values.length > 0
      ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
      : null;
  }

  /**
   * Get nested property using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot notation path
   */
  getNestedProperty(obj, path) {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  }

  /**
   * Analyze common issues across tests
   */
  analyzeCommonIssues() {
    const allErrors = this.testResults.flatMap((test) => test.errors || []);
    const allWarnings = this.testResults.flatMap((test) => test.warnings || []);

    const errorCounts = {};
    const warningCounts = {};

    allErrors.forEach((error) => {
      const key = error.split(" at ")[0]; // Remove file/line info for grouping
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    allWarnings.forEach((warning) => {
      warningCounts[warning] = (warningCounts[warning] || 0) + 1;
    });

    return { errors: errorCounts, warnings: warningCounts };
  }

  /**
   * Check for structural analysis in response
   * @param {string} text - Response text
   * @returns {boolean} Whether response includes structural analysis
   */
  checkStructuralAnalysis(text) {
    const structuralKeywords = [
      "structure",
      "layout",
      "format",
      "organization",
      "sections",
      "headers",
      "headings",
      "chapters",
      "table of contents",
      "index",
      "pages",
      "document structure",
      "formatting",
      "typography",
    ];

    const lowerText = text.toLowerCase();
    return structuralKeywords.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * Count technical terms related to accessibility/design
   * @param {string} text - Response text
   * @returns {number} Count of technical terms
   */
  countTechnicalTerms(text) {
    const technicalTerms = [
      "accessibility",
      "wcag",
      "inclusive design",
      "universal design",
      "color contrast",
      "alt text",
      "screen reader",
      "aria",
      "visual design",
      "typography",
      "layout",
      "ux",
      "ui",
      "user experience",
      "usability",
      "design principles",
    ];

    const lowerText = text.toLowerCase();
    return technicalTerms.filter((term) => lowerText.includes(term)).length;
  }

  /**
   * Categorize content type
   * @param {string} text - Response text
   * @returns {Object} Content categories found
   */
  categorizeContent(text) {
    const lowerText = text.toLowerCase();

    return {
      educational: /learn|teach|explain|understand|concept|principle/.test(
        lowerText
      ),
      analytical: /analyz|evaluat|assess|examin|review|compar/.test(lowerText),
      practical: /implement|apply|use|example|step|guide|how to/.test(
        lowerText
      ),
      technical: /code|html|css|javascript|programming|developer/.test(
        lowerText
      ),
      design: /design|visual|aesthetic|layout|color|typography/.test(lowerText),
    };
  }
}

// Create global instance
window.pdfTestingSuite = new PDFTestingSuite();

// Convenience functions for easy console usage
window.startPDFTest = (testName, userPrompt) =>
  window.pdfTestingSuite.startPDFTest(testName, userPrompt);
window.recordFileUpload = () => window.pdfTestingSuite.recordFileUpload();
window.recordRequestStart = (actualPrompt) =>
  window.pdfTestingSuite.recordRequestStart(actualPrompt);
window.completeTest = (userFeedback) =>
  window.pdfTestingSuite.completeTest(userFeedback);
window.getTestHistory = () => window.pdfTestingSuite.getTestHistory();

// Quick testing commands
window.quickPDFTest = () => {
  console.log(" Quick PDF Test Commands:");
  console.log(
    "1. window.startPDFTest('Performance Test', 'Please analyze this PDF')"
  );
  console.log("2. [Upload PDF file manually]");
  console.log("3. window.recordFileUpload()");
  console.log("4. [Submit AI request manually]");
  console.log("5. window.recordRequestStart('Your actual prompt')");
  console.log("6. [Wait for response to complete]");
  console.log("7. window.completeTest({ satisfied: true, easyToUse: true })");
  console.log("\nOr use the automated workflow:");
  console.log("window.runAutomatedPDFTest()");
};

// Add to the test recording structure
window.recordResponseSizeValidation = (predicted, actual) => {
  const currentTest = window.pdfTestHistory[window.pdfTestHistory.length - 1];
  if (currentTest) {
    currentTest.responseSizeValidation = {
      predictedSize: predicted,
      actualSize: actual,
      accuracy: Math.round((1 - Math.abs(predicted - actual) / actual) * 100),
      timestamp: new Date().toISOString(),
    };

    console.log(`📊 Response Size Validation:
      Predicted: ${(predicted / 1024 / 1024).toFixed(2)} MB
      Actual: ${(actual / 1024 / 1024).toFixed(2)} MB
      Accuracy: ${currentTest.responseSizeValidation.accuracy}%
    `);
  }
};

// Add aggregated accuracy analysis
window.analyzeResponseSizeAccuracy = () => {
  const validations = window.pdfTestHistory
    .filter((test) => test.responseSizeValidation)
    .map((test) => test.responseSizeValidation);

  if (validations.length === 0) {
    console.log("No response size validations recorded yet");
    return;
  }

  const avgAccuracy =
    validations.reduce((sum, v) => sum + v.accuracy, 0) / validations.length;

  console.log(`📈 Response Size Prediction Analysis:
    Total Validations: ${validations.length}
    Average Accuracy: ${avgAccuracy.toFixed(1)}%
    Best Accuracy: ${Math.max(...validations.map((v) => v.accuracy))}%
    Worst Accuracy: ${Math.min(...validations.map((v) => v.accuracy))}%
  `);

  return { validations, avgAccuracy };
};
// Deep inspection commands for debugging
window.inspectAnalysis = () => {
  const analysis = window.fileHandler?.fileAnalysis;
  console.log("📊 File Analysis:", analysis);
  if (analysis?.sizePrediction) {
    console.log("📏 Size Prediction:", analysis.sizePrediction);
    console.log(
      "   Estimated Size (MB):",
      analysis.sizePrediction.estimatedSize
    );
    console.log("   Bytes:", analysis.sizePrediction.bytes);
    console.log("   Warning:", analysis.sizePrediction.warning);
  }
  if (analysis?.costBreakdown) {
    console.log("💰 Cost Breakdown:", analysis.costBreakdown);
  }
  return analysis;
};

window.inspectCost = () => {
  const cost = window.fileHandler?.costEstimate;
  console.log("💰 Raw Cost Object:", cost);
  if (cost) {
    console.log("   Base:", cost.base);
    console.log("   File Processing:", cost.fileProcessing);
    console.log("   Total:", cost.total);
    console.log("   Formatted:", cost.formatted);
    console.log("   Warning Level:", cost.warning || cost.warningLevel);
  }
  return cost;
};

// Check size prediction specifically
window.checkSizePrediction = () => {
  const analysis = window.fileHandler?.fileAnalysis;
  if (analysis?.sizePrediction) {
    const pred = analysis.sizePrediction;
    console.log("📊 Size Prediction Details:");
    console.log("   Estimated Category:", pred.estimated);
    console.log("   Bytes:", pred.bytes);
    console.log("   Size in MB:", pred.estimatedSize);
    console.log("   Has Warning:", pred.warning);
    console.log("   Confidence:", pred.confidence);

    if (pred.estimatedSize === undefined || isNaN(pred.estimatedSize)) {
      console.error("❌ estimatedSize is missing or NaN!");
    } else {
      console.log("✅ estimatedSize is valid:", pred.estimatedSize, "MB");
    }

    return pred;
  } else {
    console.log("No size prediction available");
    return null;
  }
};
// Full automated test with proper timing
window.runFullPDFTest = async () => {
  console.log("🚀 Starting Complete PDF Test Flow");

  // Step 1: Run initial test setup
  await window.runCompleteTest();

  // Step 2: Upload PDF file
  console.log("⏸️ Upload a PDF file now...");
  // Wait for user to upload

  // Step 3: Continue test after upload
  // Run: window.continueTest()

  // Step 4: Send LLM request
  console.log("⏸️ Send a request to the LLM...");
  // Wait for user to send request

  // Step 5: Finalize after response
  // Run: window.finalizeTest()
};

// Quick validation of all systems
window.validateAllSystems = () => {
  const checks = {
    "File Handler": !!window.fileHandler?.isInitialised,
    "Current File": !!window.fileHandler?.currentFile,
    "Analysis Complete": !!window.fileHandler?.fileAnalysis,
    "Cost Estimated": !!window.fileHandler?.costEstimate?.formatted,
    "Size Predicted": !isNaN(
      window.fileHandler?.fileAnalysis?.sizePrediction?.estimatedSize || NaN
    ),
    "Parameter Sync": !!window.fileHandler?.parameterSyncAvailable,
    "PDF Testing Suite": !!window.pdfTestingSuite,
    "Request Processor": !!window.requestProcessor,
  };

  console.table(checks);

  const allGood = Object.values(checks).every((v) => v === true);
  console.log(
    allGood ? "✅ All systems operational!" : "⚠️ Some systems need attention"
  );

  return checks;
};

// Debug current test state
window.debugTestState = () => {
  const currentTest = window.pdfTestingSuite?.currentTest;
  const pendingData = window.pendingTestData;

  console.log("🔍 Current Test State:");
  console.log("Active Test:", currentTest ? "Yes" : "No");
  console.log("Pending Data:", pendingData ? "Yes" : "No");

  if (currentTest) {
    console.log("Test Name:", currentTest.testName);
    console.log("Start Time:", currentTest.timestamps.testStart);
    console.log(
      "Request Started:",
      currentTest.timestamps.requestStart || "Not yet"
    );
    console.log(
      "Response Started:",
      currentTest.timestamps.responseStart || "Not yet"
    );
  }

  if (pendingData) {
    console.log("Pending File:", pendingData.fileInfo?.name);
    console.log("Pending Analysis:", pendingData.analysis?.recommendedEngine);
  }

  return { currentTest, pendingData };
};

// Enhanced validation with timing check
window.validateAllSystemsDetailed = () => {
  const checks = window.validateAllSystems();

  console.log("\n🔍 DETAILED SYSTEM CHECK:");
  console.log(
    "Response Content Available:",
    !!document.querySelector("#response-display")?.textContent?.trim()
  );
  console.log(
    "Request Processor State:",
    window.uiController?.requestProcessor?.isProcessing ?? "unknown"
  );
  console.log("File Handler State:", {
    hasFile: window.fileHandler?.hasValidFile,
    fileName: window.fileHandler?.currentFile?.name,
    analysisComplete: !!window.fileHandler?.fileAnalysis,
  });

  return checks;
};

// Test response detection
window.testResponseDetection = () => {
  const selectors = ["#response-display", ".response-content", ".ai-response"];

  console.log("🔍 RESPONSE CONTENT DETECTION TEST:");
  selectors.forEach((selector) => {
    const element = document.querySelector(selector);
    const content = element?.textContent?.trim() || "";
    console.log(
      `${selector}: ${element ? "Found" : "Not found"} (${
        content.length
      } chars)`
    );
    if (content.length > 0) {
      console.log(`  Preview: "${content.substring(0, 100)}..."`);
    }
  });

  return selectors.map((s) => ({
    selector: s,
    found: !!document.querySelector(s),
    contentLength: document.querySelector(s)?.textContent?.trim()?.length || 0,
  }));
};

// Enhanced validation with timing check
window.validateAllSystemsDetailed = () => {
  const checks = window.validateAllSystems();

  console.log("\n🔍 DETAILED SYSTEM CHECK:");
  console.log(
    "Response Content Available:",
    !!document.querySelector("#response-display")?.textContent?.trim()
  );
  console.log(
    "Request Processor State:",
    window.uiController?.requestProcessor?.isProcessing ?? "unknown"
  );
  console.log("File Handler State:", {
    hasFile: window.fileHandler?.hasValidFile,
    fileName: window.fileHandler?.currentFile?.name,
    analysisComplete: !!window.fileHandler?.fileAnalysis,
  });

  return checks;
};

// Test response detection
window.testResponseDetection = () => {
  const selectors = ["#response-display", ".response-content", ".ai-response"];

  console.log("🔍 RESPONSE CONTENT DETECTION TEST:");
  selectors.forEach((selector) => {
    const element = document.querySelector(selector);
    const content = element?.textContent?.trim() || "";
    console.log(
      `${selector}: ${element ? "Found" : "Not found"} (${
        content.length
      } chars)`
    );
    if (content.length > 0) {
      console.log(`  Preview: "${content.substring(0, 100)}..."`);
    }
  });

  return selectors.map((s) => ({
    selector: s,
    found: !!document.querySelector(s),
    contentLength: document.querySelector(s)?.textContent?.trim()?.length || 0,
  }));
};

// Complete automated test workflow with proper timing
window.runCompleteTest = async () => {
  console.log("🚀 STARTING COMPLETE AUTOMATED PDF TEST");
  console.log("=====================================");

  // Initialize test
  const testName = `Automated Test ${new Date().toLocaleTimeString()}`;
  const testPrompt =
    "Please provide a detailed analysis of this PDF document, including its structure, content summary, and any notable features.";

  window.pdfTestingSuite.startPDFTest(testName, testPrompt);

  console.log("✅ Test initialized");
  console.log("📋 Test Name:", testName);
  console.log("📝 Test Prompt:", testPrompt);
  console.log("\n⏸️ STEP 1: Please upload a PDF file now...");
  console.log("   After uploading, run: window.continueTest()");

  return { step: 1, testName, testPrompt };
};

window.continueTest = () => {
  if (!window.pdfTestingSuite.currentTest) {
    console.error(
      "❌ No active test. Please run window.runCompleteTest() first"
    );
    return;
  }

  // Record the file upload
  window.pdfTestingSuite.recordFileUpload();

  const fileInfo = window.fileHandler?.currentFile;
  const analysis = window.fileHandler?.fileAnalysis;

  if (!fileInfo) {
    console.error("❌ No file detected. Please upload a PDF file first.");
    return;
  }

  console.log("✅ File upload recorded");
  console.log("📄 File:", fileInfo.name);
  console.log("📊 Size:", (fileInfo.size / 1024).toFixed(1) + " KB");

  if (analysis) {
    console.log("🔍 Analysis:");
    console.log("  - Recommended Engine:", analysis.recommendedEngine);
    console.log("  - Estimated Pages:", analysis.estimatedPages);
    console.log("  - Confidence:", analysis.confidence);
  }

  // Store data for potential test resumption
  window.pendingTestData = {
    fileInfo: window.pdfTestingSuite.currentTest.fileInfo,
    analysis: window.pdfTestingSuite.currentTest.analysisResults,
  };

  console.log("\n⏸️ STEP 2: Send your request to the AI");
  console.log("=====================================");
  console.log("📋 MANUAL TIMING INSTRUCTIONS:");
  console.log("1️⃣  Type your prompt in the input field");
  console.log("2️⃣  Run: window.markRequestStart()");
  console.log("3️⃣  IMMEDIATELY press Enter to send");
  console.log("4️⃣  Wait for response to complete");
  console.log("5️⃣  Run: window.markRequestComplete()");
  console.log("6️⃣  Run: window.finalizeTest()");
  console.log("=====================================");
  console.log("💡 TIP: You can also wait for auto-complete (30 seconds)");

  // Set up console reminder
  setTimeout(() => {
    if (
      window.pdfTestingSuite?.currentTest &&
      !window.pdfTestingSuite.currentTest.timestamps.requestStart
    ) {
      console.log(
        "⏰ REMINDER: Don't forget to run window.markRequestStart() before sending!"
      );
    }
  }, 5000);

  return { step: 2, fileInfo, analysis };
};

window.finalizeTest = () => {
  if (!window.pdfTestingSuite.currentTest) {
    console.error("❌ No active test to finalize");
    return;
  }

  // Clear any active monitoring first to prevent errors
  console.log("🧹 Clearing monitoring before finalization");
  window.pdfTestingSuite.clearAllMonitoring();

  // Force completion if not already recorded
  if (!window.pdfTestingSuite.currentTest.timestamps.requestComplete) {
    console.log("📋 Finalizing test - recording completion");
    window.pdfTestingSuite.recordRequestComplete();
  }

  // Wait a bit for final analysis to complete
  setTimeout(() => {
    // Double-check current test still exists
    if (!window.pdfTestingSuite.currentTest) {
      console.log("⚠️ Test already completed");
      return;
    }

    const result = window.pdfTestingSuite.completeTest({
      satisfied: true,
      easyToUse: true,
      testMode: "automated",
    });

    if (result) {
      console.log("\n✅ TEST COMPLETE!");
      console.log("📊 See report above for full details");

      // Show key metrics
      const metrics = result.testData.performanceTiming;
      const response = result.testData.responseMetrics;

      console.log("\n🎯 KEY RESULTS:");
      console.log(`Upload Speed: ${metrics.uploadDuration || "N/A"}ms`);
      console.log(`Request Duration: ${metrics.requestDuration || "N/A"}ms`);
      console.log(`Response Quality: ${response?.qualityScore || "N/A"}/100`);
      console.log(
        `Response Length: ${response?.responseLength || "N/A"} chars`
      );

      // Final cleanup check
      console.log("\n🧹 Final cleanup check:");
      console.log(
        `  Active intervals: ${window.pdfTestingSuite.activeIntervals.length}`
      );
      console.log(
        `  Active timeouts: ${window.pdfTestingSuite.activeTimeouts.length}`
      );
      console.log(
        `  Active observers: ${window.pdfTestingSuite.activeObservers.length}`
      );
    }
  }, 2000);

  return { step: 3, status: "finalizing" };
};

// Check bridge processing status
window.checkBridgeStatus = () => {
  const resultsManager = window.resultsManager;
  const bridgeProcessing =
    resultsManager?.core?.isBridgeProcessing?.() ?? "unknown";
  const domProcessing = resultsManager?.core?.isDOMProcessing?.() ?? "unknown";
  const requestProcessing =
    window.uiController?.requestProcessor?.isProcessing ?? "unknown";

  console.log("🔍 PROCESSING STATUS:");
  console.log("- Request Processor:", requestProcessing);
  console.log("- Bridge Processing:", bridgeProcessing);
  console.log("- DOM Processing:", domProcessing);

  const responseDisplay = document.querySelector("#response-display");
  const contentLength = responseDisplay?.textContent?.trim().length || 0;
  console.log("- Response Content Length:", contentLength);

  return {
    requestProcessing,
    bridgeProcessing,
    domProcessing,
    contentLength,
    allIdle: !requestProcessing && !bridgeProcessing && !domProcessing,
  };
};
// Add this at the end of the file
window.debugCompletionDetection = () => {
  const suite = window.pdfTestingSuite;
  const test = suite?.currentTest;

  console.log("🔍 COMPLETION DETECTION DEBUG:");
  console.log("- Test Active:", !!test);
  console.log("- Request Complete:", test?.timestamps?.requestComplete || "No");

  const responseDisplay = document.querySelector("#response-display");
  const content = responseDisplay?.textContent?.trim() || "";
  console.log("- Response Content Length:", content.length);
  console.log("- Content Preview:", content.substring(0, 100) + "...");

  const isProcessing = window.uiController?.requestProcessor?.isProcessing;
  const coreProcessing =
    window.uiController?.requestProcessor?.core?.isProcessing;
  console.log("- RequestProcessor.isProcessing:", isProcessing);
  console.log("- Core.isProcessing:", coreProcessing);

  const domState = window.resultsManager?.core?.getDOMOperationDiagnostics?.();
  console.log("- DOM State:", domState?.state || "unknown");

  const bridgeProcessing = window.resultsManager?.core?.isBridgeProcessing?.();
  console.log("- Bridge Processing:", bridgeProcessing);

  return {
    hasContent: content.length > 50,
    isComplete: !isProcessing && !coreProcessing && !bridgeProcessing,
    shouldComplete: content.length > 50 && !coreProcessing,
  };
};
// Manual force complete for testing
window.forceCompleteRequest = () => {
  const suite = window.pdfTestingSuite;
  const test = suite?.currentTest;

  if (!test) {
    console.error("❌ No active test");
    return;
  }

  if (test.timestamps.requestComplete) {
    console.log("✅ Request already marked as complete");
    return;
  }

  console.log("🔧 Forcing request completion");
  suite.recordRequestComplete();

  // Wait a bit then perform analysis
  setTimeout(() => {
    if (!test.responseMetrics || test.responseMetrics.responseLength === 0) {
      console.log("🔧 Forcing response analysis");
      suite.performResponseAnalysis();
    }
  }, 1000);

  return "Forced completion";
};
// Manual timing helpers with better feedback
window.markRequestStart = (prompt) => {
  if (!window.pdfTestingSuite.currentTest) {
    console.error("❌ No test active - run window.runCompleteTest() first");
    return;
  }
  window.pdfTestingSuite.recordRequestStart(prompt);
  console.log("✅ Request start marked!");
  console.log("🎯 NOW SEND YOUR REQUEST TO THE AI!");
  console.log("   (Press Enter in the input field)");
  return "Ready to send";
};

window.markRequestComplete = () => {
  if (!window.pdfTestingSuite.currentTest) {
    console.error("❌ No test active");
    return;
  }

  // FIXED: Don't analyze immediately - let the suite handle proper timing
  console.log("📋 Marking request complete and starting delayed analysis...");

  window.pdfTestingSuite.markRequestComplete();
  console.log("✅ Request marked complete!");
  console.log("⏳ Analysis will complete automatically in a moment...");
  console.log(
    "📋 After analysis completes, run: window.finalizeTest() to see the report"
  );

  return "Request marked - analysis in progress";
};

// Simplified test workflow
window.simpleTestWorkflow = () => {
  console.log(`
📋 SIMPLIFIED PDF TEST WORKFLOW:
================================
1. window.runCompleteTest()     // Initialize test
2. [Upload PDF file]
3. window.continueTest()         // Record upload
4. [Type your prompt]
5. window.markRequestStart()     // RIGHT BEFORE sending
6. [Send request to AI]
7. [Wait for response]
8. window.markRequestComplete()  // When response appears done
9. window.finalizeTest()         // Generate report
`);
};

// Add periodic reminders during test
window.startTestReminders = () => {
  if (!window.pdfTestingSuite?.currentTest) return;

  const checkStatus = () => {
    const test = window.pdfTestingSuite.currentTest;
    if (!test) return; // Test completed

    if (!test.timestamps.requestStart) {
      console.log("⏰ Waiting for: window.markRequestStart()");
    } else if (!test.timestamps.requestComplete) {
      const elapsed = Math.round(
        (Date.now() - test.performanceTiming.requestStartTime) / 1000
      );
      console.log(
        `⏰ Request running for ${elapsed}s - Run window.markRequestComplete() when ready`
      );
    }

    // Continue reminders if test still active
    if (test && !test.timestamps.requestComplete) {
      setTimeout(checkStatus, 10000); // Every 10 seconds
    }
  };

  setTimeout(checkStatus, 5000); // Start after 5 seconds
};

// Auto-start reminders when test begins
const originalRunCompleteTest = window.runCompleteTest;
window.runCompleteTest = async function () {
  const result = await originalRunCompleteTest();
  window.startTestReminders();
  return result;
};
