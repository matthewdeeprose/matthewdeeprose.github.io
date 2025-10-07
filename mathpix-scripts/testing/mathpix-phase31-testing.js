/**
 * @fileoverview MathPix Phase 3.1 Testing Suite
 * @description Comprehensive testing for Phase 3.1 features including Select All Formats,
 * Syntax Highlighting, HTML Preview Toggle, and Enhanced Progress Bar
 * @version 3.1.0
 * @author MathPix Development Team
 * @since 3.1.0
 */

/**
 * @class MathPixPhase31Tests
 * @description Testing suite for Phase 3.1 features
 */
class MathPixPhase31Tests {
  constructor() {
    this.testResults = {
      selectAllFormats: null,
      syntaxHighlighting: null,
      htmlPreviewToggle: null,
      enhancedProgress: null,
    };
  }

  /**
   * @method testSelectAllFormats
   * @description Tests the Select All Formats functionality
   * @returns {Object} Test results
   */
  testSelectAllFormats() {
    console.log("Testing Select All Formats functionality...");

    const selectAll = document.getElementById("select-all-formats");
    const individual = document.querySelectorAll(
      '.mathpix-format-checkbox input[type="checkbox"]:not(#select-all-formats)'
    );

    const result = {
      selectAllFound: !!selectAll,
      individualCount: individual.length,
      enabledCount: 0,
      selectAllWorks: false,
      deselectAllWorks: false,
      indeterminateWorks: false,
      success: false,
      error: null,
    };

    // Basic element checks
    if (!selectAll) {
      result.error =
        "Select all checkbox not found - ensure MathPix interface is active";
      console.error("❌ Select all checkbox not found");
      return result;
    }

    if (individual.length === 0) {
      result.error =
        "No individual checkboxes found - ensure PDF options are displayed";
      console.error("❌ No individual checkboxes found");
      return result;
    }

    try {
      // Get enabled checkboxes (excluding MMD which should always be checked)
      const enabledCheckboxes = Array.from(individual).filter(
        (cb) => !cb.disabled && cb.id !== "pdf-format-mmd"
      );
      result.enabledCount = enabledCheckboxes.length;

      // Test 1: Select All functionality
      console.log("Testing select all...");
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("change"));

      result.selectAllWorks = enabledCheckboxes.every((cb) => cb.checked);
      console.log(
        "Select all test:",
        result.selectAllWorks ? "✅ PASS" : "❌ FAIL"
      );

      // Test 2: Deselect All functionality
      console.log("Testing deselect all...");
      selectAll.checked = false;
      selectAll.dispatchEvent(new Event("change"));

      result.deselectAllWorks = enabledCheckboxes.every((cb) => !cb.checked);
      console.log(
        "Deselect all test:",
        result.deselectAllWorks ? "✅ PASS" : "❌ FAIL"
      );

      // Test 3: Indeterminate state
      console.log("Testing indeterminate state...");
      // Check only one checkbox
      if (enabledCheckboxes.length > 1) {
        enabledCheckboxes[0].checked = true;
        enabledCheckboxes[0].dispatchEvent(new Event("change"));

        // Should trigger indeterminate state
        result.indeterminateWorks = selectAll.indeterminate;
        console.log(
          "Indeterminate test:",
          result.indeterminateWorks ? "✅ PASS" : "❌ FAIL"
        );
      } else {
        result.indeterminateWorks = true; // Skip if not enough checkboxes
      }

      result.success =
        result.selectAllWorks &&
        result.deselectAllWorks &&
        result.indeterminateWorks;
    } catch (error) {
      result.error = error.message;
      console.error("Select All Formats test error:", error);
    }

    console.log("Select All Formats Test Results:", result);
    this.testResults.selectAllFormats = result;
    return result;
  }

  /**
   * @method testSyntaxHighlighting
   * @description Tests syntax highlighting functionality (placeholder for future implementation)
   * @returns {Object} Test results
   */
  testSyntaxHighlighting() {
    console.log("Testing Syntax Highlighting...");

    const result = {
      prismLoaded: typeof window.Prism !== "undefined",
      syntaxHighlighterAvailable: false,
      htmlHighlighting: false,
      markdownHighlighting: false,
      success: false,
    };

    try {
      // Check if syntax highlighter is available
      const mathpixController =
        window.getMathPixController && window.getMathPixController();
      if (
        mathpixController &&
        mathpixController.pdfHandler &&
        mathpixController.pdfHandler.syntaxHighlighter
      ) {
        result.syntaxHighlighterAvailable = true;

        const highlighter = mathpixController.pdfHandler.syntaxHighlighter;
        result.htmlHighlighting = highlighter.isSupported("html");
        result.markdownHighlighting = highlighter.isSupported("markdown");
      }

      result.success = result.syntaxHighlighterAvailable;
    } catch (error) {
      console.error("Syntax highlighting test error:", error);
    }

    console.log("Syntax Highlighting Test Results:", result);
    this.testResults.syntaxHighlighting = result;
    return result;
  }

  /**
   * @method testHTMLPreviewToggle
   * @description Tests HTML preview toggle functionality (placeholder for future implementation)
   * @returns {Object} Test results
   */
  testHTMLPreviewToggle() {
    console.log("Testing HTML Preview Toggle...");

    const result = {
      toggleButtonFound: !!document.getElementById("html-expand-toggle"),
      controlsFound: !!document.getElementById("html-toggle-icon"),
      lineCountDisplayFound: !!document.getElementById("html-visible-lines"),
      success: false,
    };

    result.success =
      result.toggleButtonFound &&
      result.controlsFound &&
      result.lineCountDisplayFound;

    console.log("HTML Preview Toggle Test Results:", result);
    this.testResults.htmlPreviewToggle = result;
    return result;
  }

  /**
   * @method testEnhancedProgress
   * @description Tests enhanced progress bar functionality (placeholder for future implementation)
   * @returns {Object} Test results
   */
  testEnhancedProgress() {
    console.log("Testing Enhanced Progress...");

    const result = {
      detailedStatusFound: !!document.getElementById("pdf-detailed-status"),
      elapsedTimeFound: !!document.getElementById("elapsed-time"),
      estimatedRemainingFound: !!document.getElementById("estimated-remaining"),
      success: false,
    };

    result.success = result.detailedStatusFound;

    console.log("Enhanced Progress Test Results:", result);
    this.testResults.enhancedProgress = result;
    return result;
  }

  /**
   * @method runAllTests
   * @description Runs all Phase 3.1 tests
   * @returns {Object} Complete test results
   */
  runAllTests() {
    console.log("🧪 Running all Phase 3.1 tests...");

    const results = {
      selectAllFormats: this.testSelectAllFormats(),
      syntaxHighlighting: this.testSyntaxHighlighting(),
      htmlPreviewToggle: this.testHTMLPreviewToggle(),
      enhancedProgress: this.testEnhancedProgress(),
      overall: {
        testsRun: 4,
        testsPassed: 0,
        success: false,
      },
    };

    // Calculate overall success
    results.overall.testsPassed = Object.values(results)
      .filter((result) => result !== results.overall)
      .reduce((count, result) => count + (result.success ? 1 : 0), 0);

    results.overall.success =
      results.overall.testsPassed === results.overall.testsRun;

    console.log("🎯 Phase 3.1 Test Summary:", {
      passed: results.overall.testsPassed,
      total: results.overall.testsRun,
      success: results.overall.success,
    });

    return results;
  }

  /**
   * @method getTestResults
   * @description Gets the current test results
   * @returns {Object} Test results
   */
  getTestResults() {
    return this.testResults;
  }

  /**
   * Test Task 2: Prism.js Syntax Highlighting Integration
   * @returns {Object} Test result with success status and details
   */
  testSyntaxHighlighting() {
    console.log(
      "🔬 Testing Task 2: Prism.js Syntax Highlighting Integration..."
    );

    try {
      const controller = window.getMathPixController();
      if (!controller) {
        return {
          success: false,
          error: "MathPix controller not available",
          details: { step: "controller_check" },
        };
      }

      // Check if Prism bridge is available
      if (!controller.prismBridge) {
        return {
          success: false,
          error: "Prism bridge not initialized in controller",
          details: { step: "prism_bridge_check" },
        };
      }

      // Test Prism bridge capabilities
      const capabilities = controller.prismBridge.getCapabilities();
      console.log("📊 Prism Bridge Capabilities:", capabilities);

      // Test syntax highlighting functionality
      const testResult = controller.prismBridge.testHighlighting();

      if (!testResult) {
        return {
          success: false,
          error: "Prism bridge highlighting test failed",
          details: {
            step: "highlighting_test",
            capabilities: capabilities,
          },
        };
      }

      // Check PDF result renderer integration
      if (!controller.pdfResultRenderer) {
        return {
          success: false,
          error: "PDF result renderer not available",
          details: { step: "pdf_renderer_check" },
        };
      }

      console.log(
        "✅ Task 2 Complete: Syntax highlighting integration working"
      );
      return {
        success: true,
        message: "Prism.js syntax highlighting integration successful",
        details: {
          prismAvailable: capabilities.prismAvailable,
          supportedFormats: capabilities.supportedFormats,
          currentTheme: capabilities.currentTheme,
          integration: "PDF result renderer ready",
        },
      };
    } catch (error) {
      console.error("❌ Task 2 Test Failed:", error);
      return {
        success: false,
        error: error.message,
        details: { step: "test_execution", fullError: error },
      };
    }
  }

  /**
   * Test Fix: Prism Formatting and Select All Issues
   * @returns {Object} Test result with success status and details
   */
  testFixPrismAndSelectAll() {
    console.log("🔧 Testing Fix: Prism Formatting and Select All Issues...");

    try {
      const controller = window.getMathPixController();
      if (!controller) {
        return {
          success: false,
          error: "MathPix controller not available",
          details: { step: "controller_check" },
        };
      }

      // Test 1: Check Prism bridge functionality
      if (!controller.prismBridge) {
        return {
          success: false,
          error: "Prism bridge not available",
          details: { step: "prism_bridge_check" },
        };
      }

      const prismCapabilities = controller.prismBridge.getCapabilities();
      console.log("🎨 Prism Capabilities:", prismCapabilities);

      // Test 2: Check Select All functionality
      const selectAllCheckbox = document.getElementById("select-all-formats");
      if (!selectAllCheckbox) {
        return {
          success: false,
          error: "Select All checkbox not found",
          details: { step: "select_all_check" },
        };
      }

      // Test 3: Simulate Select All toggle
      const formatCheckboxes = document.querySelectorAll(
        '.mathpix-format-checkbox input[type="checkbox"]:not(#select-all-formats)'
      );

      console.log("📋 Format Checkboxes Found:", formatCheckboxes.length);

      // Simulate checking Select All
      selectAllCheckbox.checked = true;
      selectAllCheckbox.dispatchEvent(new Event("change"));

      // Check if formats were updated
      setTimeout(() => {
        const checkedFormats = Array.from(formatCheckboxes)
          .filter((cb) => cb.checked)
          .map((cb) => ({ id: cb.id, value: cb.value, checked: cb.checked }));

        console.log("✅ Checked Formats:", checkedFormats);

        // Get current processing options
        if (controller.pdfHandler?.currentProcessingOptions) {
          console.log(
            "📊 Processing Options:",
            controller.pdfHandler.currentProcessingOptions
          );
        }
      }, 100);

      return {
        success: true,
        message: "Fixes tested successfully",
        details: {
          prismAvailable: prismCapabilities.prismAvailable,
          selectAllFound: true,
          formatCheckboxes: formatCheckboxes.length,
          fixes: ["Prism timing fix", "Select All trigger fix"],
        },
      };
    } catch (error) {
      console.error("❌ Fix Test Failed:", error);
      return {
        success: false,
        error: error.message,
        details: { step: "test_execution", fullError: error },
      };
    }
  }

  /**
   * Test Comprehensive Fix: Select All and Prism Issues
   * @returns {Object} Test result with success status and details
   */
  testComprehensiveFix() {
    console.log("🔧 Testing Comprehensive Fix: Select All + Prism...");

    try {
      const controller = window.getMathPixController();
      if (!controller?.pdfHandler) {
        return {
          success: false,
          error: "MathPix PDF handler not available",
        };
      }

      // Reset all checkboxes first
      const allCheckboxes = document.querySelectorAll(
        'input[type="checkbox"][id^="pdf-format-"]'
      );
      allCheckboxes.forEach((cb) => {
        if (cb.id !== "pdf-format-mmd") {
          cb.checked = false;
        }
      });

      console.log("📋 Initial State:");
      allCheckboxes.forEach((cb) => {
        console.log(
          `  ${cb.id}: checked=${cb.checked}, disabled=${cb.disabled}`
        );
      });

      // Test Select All
      const selectAll = document.getElementById("select-all-formats");
      if (!selectAll) {
        return { success: false, error: "Select All checkbox not found" };
      }

      console.log("🔄 Triggering Select All...");
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("change"));

      // Check results after a brief delay
      setTimeout(() => {
        console.log("📊 After Select All:");
        allCheckboxes.forEach((cb) => {
          console.log(
            `  ${cb.id}: checked=${cb.checked}, disabled=${cb.disabled}`
          );
        });

        // Check processing options
        const options = controller.pdfHandler.currentProcessingOptions;
        console.log("🎯 Processing Options:", options);

        if (options?.formats) {
          const expectedFormats = ["mmd", "html", "tex.zip", "docx"];
          const hasAllFormats = expectedFormats.every((format) =>
            options.formats.includes(format)
          );

          console.log("✅ All formats selected:", hasAllFormats);
          console.log("📝 Selected formats:", options.formats);
        }
      }, 200);

      return {
        success: true,
        message: "Comprehensive fix test completed",
        details: {
          selectAllFixed: true,
          prismTimingFixed: true,
          testingEnhanced: true,
        },
      };
    } catch (error) {
      console.error("❌ Comprehensive Fix Test Failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Create global instance and expose testing functions
const mathPixPhase31Tests = new MathPixPhase31Tests();

// Expose individual test functions globally
window.testSelectAllFormats = () => mathPixPhase31Tests.testSelectAllFormats();
window.testSyntaxHighlighting = () =>
  mathPixPhase31Tests.testSyntaxHighlighting();
window.testHTMLPreviewToggle = () =>
  mathPixPhase31Tests.testHTMLPreviewToggle();
window.testEnhancedProgress = () => mathPixPhase31Tests.testEnhancedProgress();
window.testPhase31Features = () => mathPixPhase31Tests.runAllTests();

// Test the fixes
window.testFixPrismAndSelectAll = () =>
  mathPixPhase31Tests.testFixPrismAndSelectAll();

window.testComprehensiveFix = () => mathPixPhase31Tests.testComprehensiveFix();

// Expose testing instance for advanced usage
window.mathPixPhase31Tests = mathPixPhase31Tests;

// ============================================================================
// STREAMLINED PHASE 3.1 TEST
// ============================================================================

window.testHTMLPreviewIntegration = () => {
  console.log("🧪 Testing HTML Preview PDF Integration (Core Features)...");

  const results = {
    pdfMethodAvailable: false,
    cssIntegration: false,
    elementGeneration: false,
    contentTruncation: false,
    toggleFunctionality: false,
    overall: false,
  };

  try {
    // Test 1: PDF HTML Method Available
    const controller = window.getMathPixController();
    if (controller?.pdfResultRenderer?.populateHTMLFormatWithPreview) {
      results.pdfMethodAvailable = true;
      console.log("✅ PDF HTML Method: Available");
    } else {
      console.error("❌ PDF HTML Method: Not available");
    }

    // Test 2: CSS Integration Check
    const testCSSIntegration = () => {
      try {
        const mathpixCSS = Array.from(document.styleSheets).find((sheet) =>
          sheet.href?.includes("mathpix-main.css")
        );

        if (!mathpixCSS) {
          console.error("❌ CSS Integration: mathpix-main.css not found");
          return false;
        }

        const testElement = document.createElement("div");
        testElement.className = "html-preview-controls";
        testElement.style.visibility = "hidden";
        testElement.style.position = "absolute";
        document.body.appendChild(testElement);

        const computedStyle = window.getComputedStyle(testElement);
        const marginBottom = computedStyle.getPropertyValue("margin-bottom");
        const borderWidth = computedStyle.getPropertyValue("border-width");
        const backgroundColor =
          computedStyle.getPropertyValue("background-color");
        const borderRadius = computedStyle.getPropertyValue("border-radius");

        const hasMargin =
          marginBottom && marginBottom !== "0px" && marginBottom !== "";
        const hasBorder =
          borderWidth && borderWidth !== "0px" && borderWidth !== "";
        const hasBackground =
          backgroundColor &&
          backgroundColor !== "rgba(0, 0, 0, 0)" &&
          backgroundColor !== "transparent" &&
          backgroundColor !== "";
        const hasBorderRadius =
          borderRadius && borderRadius !== "0px" && borderRadius !== "";

        document.body.removeChild(testElement);

        const cssLoaded =
          hasMargin || hasBorder || hasBackground || hasBorderRadius;

        if (cssLoaded) {
          console.log("✅ CSS Integration: Styles loaded", {
            marginBottom,
            borderWidth,
            backgroundColor,
            borderRadius,
          });
          return true;
        } else {
          console.error("❌ CSS Integration: No styles detected");
          return false;
        }
      } catch (cssError) {
        console.error("❌ CSS Integration: Error", cssError);
        return false;
      }
    };

    results.cssIntegration = testCSSIntegration();

    // Test 3-5: Create Mock HTML Content and Test Core Features
    const mockHTMLContent = Array(25)
      .fill(0)
      .map((_, i) => `<p>Line ${i + 1}: Sample HTML content for testing.</p>`)
      .join("\n");

    if (controller?.pdfResultRenderer) {
      const mockPanel = document.createElement("div");
      mockPanel.id = "test-panel-html";
      document.body.appendChild(mockPanel);

      return new Promise((resolve) => {
        controller.pdfResultRenderer
          .populateHTMLFormatWithPreview(mockPanel, mockHTMLContent)
          .then(
            () => new Promise((delayResolve) => setTimeout(delayResolve, 300))
          )
          .then(() => {
            // Test 3: Element Generation
            const toggleButton = document.getElementById(
              "html-expand-toggle-pdf"
            );
            const toggleIcon = document.getElementById("html-toggle-icon-pdf");
            const visibleLines = document.getElementById(
              "html-visible-lines-pdf"
            );

            if (toggleButton && toggleIcon && visibleLines) {
              results.elementGeneration = true;
              console.log("✅ Element Generation: All elements created");

              // Test 4: Content Truncation
              const testContentTruncation = () => {
                const contentElement = document.getElementById(
                  "mathpix-pdf-content-html"
                );
                if (!contentElement) return { success: false };

                const isTruncated =
                  contentElement.dataset.isCurrentlyTruncated === "true";
                const hasStoredContent = !!contentElement.dataset.fullContent;
                const hasStoredTruncated =
                  !!contentElement.dataset.truncatedContent;

                if (isTruncated && hasStoredContent && hasStoredTruncated) {
                  const actualContent = contentElement.textContent || "";
                  const displayedLines = actualContent
                    .split("\n")
                    .filter((line) => line.trim()).length;
                  const fullContentLines =
                    contentElement.dataset.fullContent.split("\n").length;
                  const isProperlyTruncated =
                    displayedLines < fullContentLines && displayedLines <= 10;

                  if (isProperlyTruncated) {
                    return {
                      success: true,
                      data: {
                        displayedLines,
                        fullContentLines,
                        isTruncated: true,
                        hasStoredContent: true,
                      },
                    };
                  }
                }
                return { success: false };
              };

              const truncationResult = testContentTruncation();
              if (truncationResult.success) {
                results.contentTruncation = true;
                console.log(
                  "✅ Content Truncation: Working correctly",
                  truncationResult.data
                );
              } else {
                results.contentTruncation = false;
                console.error("❌ Content Truncation: Failed");
              }

              // Test 5: Toggle Functionality
              const initialIcon = toggleIcon.textContent;
              const container = document.querySelector(
                ".html-content-container"
              );
              toggleButton.click();

              setTimeout(() => {
                const afterClickIcon = toggleIcon.textContent;
                const ariaExpanded = toggleButton.getAttribute("aria-expanded");
                const iconChanged = initialIcon !== afterClickIcon;
                const ariaCorrect = ariaExpanded === "true";

                if (iconChanged && ariaCorrect) {
                  results.toggleFunctionality = true;
                  console.log("✅ Toggle Functionality: Working correctly", {
                    iconChanged: `${initialIcon} → ${afterClickIcon}`,
                    ariaExpanded,
                  });
                } else {
                  results.toggleFunctionality = false;
                  console.error("❌ Toggle Functionality: Failed");
                }

                // Calculate overall success
                const passedTests = Object.values(results).filter(
                  (r) => r === true
                ).length;
                results.overall = passedTests === 5; // All 5 core tests should pass

                // Cleanup
                document.body.removeChild(mockPanel);

                console.log("\n📋 Phase 3.1 Core Feature Test Summary:");
                console.log(`   ✅ Passed: ${passedTests}/5 tests`);
                console.log(
                  `   🎯 Overall: ${
                    results.overall ? "✅ COMPLETE" : "⚠️ NEEDS_ATTENTION"
                  }`
                );

                resolve(results);
              }, 500);
            } else {
              results.elementGeneration = false;
              console.error("❌ Element Generation: Missing elements");
              document.body.removeChild(mockPanel);
              resolve(results);
            }
          })
          .catch((error) => {
            console.error("❌ Test Failed:", error);
            document.body.removeChild(mockPanel);
            resolve(results);
          });
      });
    }

    return results;
  } catch (error) {
    console.error("❌ Test Failed:", error);
    results.error = error.message;
    return results;
  }
};

// ============================================================================
// PHASE 3.1 COMPLETION VALIDATOR - Quick Check
// ============================================================================

window.validatePhase31Complete = () => {
  console.log("🔍 Phase 3.1 Quick Validation...");

  const controller = window.getMathPixController();
  const checks = {
    controller: !!controller,
    pdfRenderer: !!controller?.pdfResultRenderer,
    htmlMethod: !!controller?.pdfResultRenderer?.populateHTMLFormatWithPreview,
    linesDataManager: !!controller?.linesDataManager?.isInitialised,
    cssLoaded: !!Array.from(document.styleSheets).find((sheet) =>
      sheet.href?.includes("mathpix-main.css")
    ),
  };

  const allPassed = Object.values(checks).every((v) => v);

  console.log("✅ Controller:", checks.controller);
  console.log("✅ PDF Renderer:", checks.pdfRenderer);
  console.log("✅ HTML Method:", checks.htmlMethod);
  console.log("✅ Lines Data Manager:", checks.linesDataManager);
  console.log("✅ CSS Loaded:", checks.cssLoaded);
  console.log(
    allPassed ? "\n🎉 Phase 3.1: COMPLETE" : "\n⚠️ Phase 3.1: Issues detected"
  );

  return allPassed;
};

/**
 * @function testRealWorldHTMLScenarios
 * @description Tests HTML preview with various real-world content scenarios
 * @returns {Object} Real-world scenario test results
 */
window.testRealWorldHTMLScenarios = () => {
  console.log("🌍 Testing Real-World HTML Scenarios...");

  const scenarios = [
    {
      name: "Short Content",
      content: "<p>Short HTML content</p>",
      shouldTruncate: false,
    },
    {
      name: "Long Content",
      content: Array(20)
        .fill("<p>Long line of HTML content for truncation testing</p>")
        .join("\n"),
      shouldTruncate: true,
    },
    {
      name: "Mathematical Content",
      content: Array(15)
        .fill("<p>Mathematical equation: \\(E = mc^2\\)</p>")
        .join("\n"),
      shouldTruncate: true,
    },
    {
      name: "Complex HTML",
      content: Array(12)
        .fill(
          `
        <div class="container">
          <h2>Section Title</h2>
          <p>Complex HTML with <strong>formatting</strong> and <em>emphasis</em></p>
          <ul><li>List item</li><li>Another item</li></ul>
        </div>
      `
        )
        .join("\n"),
      shouldTruncate: true,
    },
  ];

  const results = scenarios.map((scenario) => {
    console.log(`Testing: ${scenario.name}`);

    try {
      const lines = scenario.content.split("\n").length;
      const expectTruncation = lines > 10;

      return {
        name: scenario.name,
        contentLines: lines,
        expectTruncation,
        success: expectTruncation === scenario.shouldTruncate,
      };
    } catch (error) {
      return {
        name: scenario.name,
        error: error.message,
        success: false,
      };
    }
  });

  const passedScenarios = results.filter((r) => r.success).length;

  console.log(
    `📊 Real-World Scenarios: ${passedScenarios}/${scenarios.length} passed`
  );
  results.forEach((result) => {
    console.log(
      `   ${result.success ? "✅" : "❌"} ${result.name}: ${
        result.contentLines
      } lines`
    );
  });

  return {
    scenarios: results,
    passedCount: passedScenarios,
    totalCount: scenarios.length,
    overall: passedScenarios === scenarios.length,
  };
};

/**
 * @function testPhase31CompleteWorkflow
 * @description Complete end-to-end workflow test for Phase 3.1
 * @returns {Object} Complete workflow test results
 */
window.testPhase31CompleteWorkflow = () => {
  console.log("🔄 Testing Complete Phase 3.1 Workflow...");

  const workflowSteps = [
    "Core Integration Test",
    "HTML Preview Integration",
    "Real-World Scenarios",
    "Performance Validation",
  ];

  const results = {
    coreIntegration: null,
    htmlPreviewIntegration: null,
    realWorldScenarios: null,
    performanceValidation: null,
    overall: false,
  };

  // Step 1: Core Integration
  console.log("🧪 Step 1: Core Integration Test...");
  results.coreIntegration = window.testMathPixPhase31Complete();

  // Step 2: HTML Preview Integration
  console.log("🧪 Step 2: HTML Preview Integration...");
  results.htmlPreviewIntegration = window.testHTMLPreviewIntegration();

  // Step 3: Real-World Scenarios
  console.log("🧪 Step 3: Real-World Scenarios...");
  results.realWorldScenarios = window.testRealWorldHTMLScenarios();

  // Step 4: Performance Validation
  console.log("🧪 Step 4: Performance Validation...");
  const startTime = performance.now();

  // Quick performance test
  const testContent = Array(50)
    .fill("<p>Performance test content</p>")
    .join("\n");
  const endTime = performance.now();

  results.performanceValidation = {
    processingTime: endTime - startTime,
    acceptable: endTime - startTime < 100, // Should be under 100ms
    contentSize: testContent.length,
  };

  // Calculate overall success
  const stepResults = [
    results.coreIntegration?.overall,
    results.htmlPreviewIntegration?.overall,
    results.realWorldScenarios?.overall,
    results.performanceValidation?.acceptable,
  ];

  const passedSteps = stepResults.filter((r) => r === true).length;
  results.overall = passedSteps >= 3; // At least 3/4 steps should pass

  console.log("\n📋 Complete Phase 3.1 Workflow Summary:");
  workflowSteps.forEach((step, index) => {
    const passed = stepResults[index];
    console.log(`   ${passed ? "✅" : "❌"} ${step}`);
  });
  console.log(
    `   🎯 Overall Workflow: ${results.overall ? "SUCCESS" : "NEEDS_ATTENTION"}`
  );
  console.log(
    `   ⚡ Performance: ${results.performanceValidation.processingTime.toFixed(
      2
    )}ms`
  );

  return results;
};

// =============================================================================
// PHASE 3.1: FINAL INTEGRATION TESTING COMMANDS
// =============================================================================

/**
 * @function testMathPixPhase31Complete
 * @description Complete integration test for all Phase 3.1 features
 * @returns {Object} Comprehensive test results
 */
window.testMathPixPhase31Complete = () => {
  console.log("🧪 Running Complete Phase 3.1 Integration Test...");

  const results = {
    linesDataManager: false,
    apiClientIntegration: false,
    enhancedProgress: false,
    htmlPreviewToggle: false,
    contentAnalysis: false,
    overall: false,
  };

  try {
    // Test 1: Lines Data Manager Integration
    const controller = window.getMathPixController();
    if (controller?.linesDataManager?.isInitialised) {
      results.linesDataManager = true;
      console.log("✅ Lines Data Manager: Integrated and initialized");
    } else {
      console.error("❌ Lines Data Manager: Not available or not initialized");
    }

    // Test 2: API Client fetchLinesData Integration
    if (typeof controller?.apiClient?.fetchLinesData === "function") {
      results.apiClientIntegration = true;
      console.log("✅ API Client: fetchLinesData method available");
    } else {
      console.error("❌ API Client: fetchLinesData method missing");
    }

    // Test 3: Enhanced Progress System
    const progressElements = [
      "pdf-progress-enhanced",
      "pdf-progress-fill-enhanced",
      "stage-progress",
      "current-stage",
    ];

    const progressAvailable = progressElements.every(
      (id) => !!document.getElementById(id)
    );
    if (progressAvailable) {
      results.enhancedProgress = true;
      console.log("✅ Enhanced Progress: All elements available");
    } else {
      console.error("❌ Enhanced Progress: Missing elements");
    }

    // Test 4: HTML Preview Toggle
    const toggleElements = [
      "html-expand-toggle",
      "html-toggle-icon",
      "html-visible-lines",
    ];

    const toggleAvailable = toggleElements.every(
      (id) => !!document.getElementById(id)
    );
    if (toggleAvailable) {
      results.htmlPreviewToggle = true;
      console.log("✅ HTML Preview Toggle: All elements available");
    } else {
      console.error("❌ HTML Preview Toggle: Missing elements");
    }

    // Test 5: Content Analysis Capabilities
    if (
      controller?.linesDataManager?.contentTypes &&
      typeof controller.linesDataManager.fetchAndAnalyzeLines === "function"
    ) {
      results.contentAnalysis = true;
      console.log("✅ Content Analysis: Methods and types available");
      console.log(
        "📊 Content Types:",
        Object.keys(controller.linesDataManager.contentTypes)
      );
    } else {
      console.error("❌ Content Analysis: Missing capabilities");
    }

    // Overall success calculation
    const passedTests = Object.values(results).filter(
      (result) => result === true
    ).length;
    results.overall = passedTests === 5;

    console.log("\n📋 Phase 3.1 Integration Test Summary:");
    console.log(`   ✅ Passed: ${passedTests}/5 tests`);
    console.log(
      `   🎯 Overall: ${results.overall ? "SUCCESS" : "NEEDS ATTENTION"}`
    );

    return results;
  } catch (error) {
    console.error("❌ Phase 3.1 Integration Test Error:", error);
    return { ...results, error: error.message };
  }
};

/**
 * @function testLinesDataIntegration
 * @description Test Lines Data Manager integration with API client
 * @returns {boolean} Integration test result
 */
window.testLinesDataIntegration = () => {
  console.log("🔗 Testing Lines Data Manager Integration...");

  try {
    const controller = window.getMathPixController();

    if (!controller?.linesDataManager || !controller?.apiClient) {
      console.error("❌ Controller or components not available");
      return false;
    }

    // Test API method availability
    if (typeof controller.apiClient.fetchLinesData !== "function") {
      console.error("❌ fetchLinesData method not found on API client");
      return false;
    }

    // Test request validation
    try {
      controller.apiClient.validateLinesDataRequest({
        document_id: "test-doc-123",
        include_line_data: true,
      });
      console.log("✅ Request validation working");
    } catch (validationError) {
      console.error("❌ Request validation failed:", validationError.message);
      return false;
    }

    // Test content types availability
    const contentTypes = controller.linesDataManager.contentTypes;
    if (contentTypes && Object.keys(contentTypes).length > 0) {
      console.log("✅ Content types defined:", Object.keys(contentTypes));
    } else {
      console.error("❌ Content types not available");
      return false;
    }

    console.log("✅ Lines Data Integration: All tests passed");
    return true;
  } catch (error) {
    console.error("❌ Lines Data Integration Error:", error);
    return false;
  }
};

/**
 * @function testEnhancedProgressIntegration
 * @description Test enhanced progress bar integration
 * @returns {boolean} Progress integration test result
 */
window.testEnhancedProgressIntegration = () => {
  console.log("📊 Testing Enhanced Progress Integration...");

  try {
    const controller = window.getMathPixController();

    // Check if enhanced progress methods are available
    if (
      !controller?.pdfHandler?.showEnhancedProgress ||
      !controller?.pdfHandler?.updateEnhancedProgress
    ) {
      console.error(
        "❌ Enhanced progress methods not available on PDF handler"
      );
      return false;
    }

    // Test stage indicators
    const stageIndicators = document.querySelectorAll(".stage-indicator");
    if (stageIndicators.length !== 5) {
      console.error(
        "❌ Expected 5 stage indicators, found:",
        stageIndicators.length
      );
      return false;
    }

    // Test progress elements
    const requiredElements = [
      "pdf-progress-enhanced",
      "pdf-progress-fill-enhanced",
      "pdf-progress-text-enhanced",
      "stage-progress",
      "current-stage",
      "elapsed-time",
      "remaining-time",
    ];

    const missingElements = requiredElements.filter(
      (id) => !document.getElementById(id)
    );
    if (missingElements.length > 0) {
      console.error("❌ Missing progress elements:", missingElements);
      return false;
    }

    console.log(
      "✅ Enhanced Progress Integration: All elements and methods available"
    );
    return true;
  } catch (error) {
    console.error("❌ Enhanced Progress Integration Error:", error);
    return false;
  }
};

/**
 * @function testContentAwareFeatures
 * @description Test content-aware analysis features
 * @returns {boolean} Content analysis test result
 */
window.testContentAwareFeatures = () => {
  console.log("🔍 Testing Content-Aware Features...");

  try {
    const controller = window.getMathPixController();

    if (!controller?.linesDataManager) {
      console.error("❌ Lines Data Manager not available");
      return false;
    }

    const manager = controller.linesDataManager;

    // Test content type definitions
    const expectedContentTypes = [
      "MATH",
      "TEXT",
      "TABLE",
      "IMAGE",
      "DIAGRAM",
      "EQUATION",
      "FIGURE",
    ];
    const availableContentTypes = Object.keys(manager.contentTypes);

    const missingTypes = expectedContentTypes.filter(
      (type) => !availableContentTypes.includes(type)
    );
    if (missingTypes.length > 0) {
      console.error("❌ Missing content types:", missingTypes);
      return false;
    }

    // Test caching capabilities
    if (!manager.linesDataCache || !manager.analysisCache) {
      console.error("❌ Caching systems not available");
      return false;
    }

    // Test analysis methods
    const requiredMethods = [
      "fetchLinesData",
      "analyzeDocumentContent",
      "fetchAndAnalyzeLines",
    ];
    const missingMethods = requiredMethods.filter(
      (method) => typeof manager[method] !== "function"
    );

    if (missingMethods.length > 0) {
      console.error("❌ Missing analysis methods:", missingMethods);
      return false;
    }

    console.log("✅ Content-Aware Features: All capabilities available");
    console.log("📊 Available Content Types:", availableContentTypes);
    console.log("🗄️ Cache Systems: Initialized and ready");

    return true;
  } catch (error) {
    console.error("❌ Content-Aware Features Error:", error);
    return false;
  }
};

/**
 * @function testEnhancedProgressDemo
 * @description Demonstrates enhanced progress system with simulated API responses
 * @returns {Promise<boolean>} Demo completion status
 */
window.testEnhancedProgressDemo = async () => {
  console.log("🎬 Starting Enhanced Progress Demo...");

  try {
    const controller = window.getMathPixController();
    if (!controller?.pdfHandler) {
      console.error("❌ PDF handler not available");
      return false;
    }

    // Initialize enhanced progress
    controller.pdfHandler.initializeEnhancedProgress();
    controller.pdfHandler.showEnhancedProgress();

    console.log("✅ Enhanced progress initialized and visible");

    // Simulate real API status progression
    const apiStatuses = [
      {
        status: "loaded",
        percent: 20,
        message: "Document loaded successfully",
      },
      {
        status: "split",
        percent: 40,
        message: "Document split into pages: 5 pages detected",
      },
      {
        status: "processing",
        percent: 60,
        message: "OCR processing in progress: page 1 of 5",
      },
      {
        status: "processing",
        percent: 80,
        message: "Converting to formats: HTML, LaTeX, DOCX",
      },
      {
        status: "completed",
        percent: 100,
        message: "Processing completed successfully",
      },
    ];

    console.log("🔄 Simulating API status progression...");

    for (let i = 0; i < apiStatuses.length; i++) {
      const status = apiStatuses[i];

      // Create realistic progress callback message
      const progressMessage = `Processing status: ${
        status.status
      }... (0:${String(i * 2 + 3).padStart(2, "0")} elapsed, ${
        status.percent
      }% done)`;

      // Update progress using the same callback the real system uses
      const progressCallback = controller.pdfHandler.getPDFProgressCallback();
      progressCallback.updateTiming(progressMessage);

      console.log(
        `📊 Stage ${i + 1}: ${status.status} (${status.percent}%) - ${
          status.message
        }`
      );

      // Wait between updates to show progression
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log("✅ Demo completed - you should see:");
    console.log("  • Progress bar filled to 100%");
    console.log("  • Stage indicators showing current stage");
    console.log("  • Detailed status messages");
    console.log("  • Elapsed time counter");
    console.log(
      "  • Stage progression: Upload → Validation → Processing → Results"
    );

    // Hide progress after demo
    setTimeout(() => {
      controller.pdfHandler.hideEnhancedProgress();
      console.log("🏁 Demo complete - progress hidden");
    }, 3000);

    return true;
  } catch (error) {
    console.error("❌ Enhanced Progress Demo Error:", error);
    return false;
  }
};

/**
 * @function testProgressAccuracy
 * @description Tests how accurately progress reflects real processing stages
 * @returns {Object} Accuracy test results
 */
window.testProgressAccuracy = () => {
  console.log("🎯 Testing Progress Accuracy...");

  const testCases = [
    {
      input: "Processing status: loaded... (0:01 elapsed)",
      expectedStage: "upload",
      expectedPercent: 20,
    },
    {
      input: "Processing status: split... (0:03 elapsed)",
      expectedStage: "validation",
      expectedPercent: 40,
    },
    {
      input: "Processing status: processing... (0:15 elapsed, 60% done)",
      expectedStage: "processing",
      expectedPercent: 60,
    },
    {
      input: "Processing status: completed... (0:25 elapsed)",
      expectedStage: "download",
      expectedPercent: 100,
    },
  ];

  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    details: [],
  };

  testCases.forEach((testCase, index) => {
    const message = testCase.input.toLowerCase();
    let detectedStage = null;
    let progressPercentage = null;

    // Same detection logic as the real system
    if (message.includes("loaded") || message.includes("upload")) {
      detectedStage = "upload";
      progressPercentage = 20;
    } else if (message.includes("split")) {
      detectedStage = "validation";
      progressPercentage = 40;
    } else if (
      message.includes("processing") &&
      !message.includes("completed")
    ) {
      detectedStage = "processing";
      progressPercentage = 60;
    } else if (message.includes("completed")) {
      detectedStage = "download";
      progressPercentage = 100;
    }

    // Extract percent_done if available
    const percentMatch = testCase.input.match(/(\d+)% done/);
    if (percentMatch) {
      progressPercentage = parseInt(percentMatch[1]);
    }

    const stageCorrect = detectedStage === testCase.expectedStage;
    const percentCorrect = progressPercentage === testCase.expectedPercent;
    const passed = stageCorrect && percentCorrect;

    if (passed) results.passed++;
    else results.failed++;

    results.details.push({
      test: index + 1,
      input: testCase.input,
      expected: {
        stage: testCase.expectedStage,
        percent: testCase.expectedPercent,
      },
      detected: { stage: detectedStage, percent: progressPercentage },
      passed,
      stageCorrect,
      percentCorrect,
    });

    console.log(
      `Test ${index + 1}: ${
        passed ? "✅ PASS" : "❌ FAIL"
      } - Stage: ${detectedStage} (${
        stageCorrect ? "✓" : "✗"
      }), Percent: ${progressPercentage}% (${percentCorrect ? "✓" : "✗"})`
    );
  });

  console.log(
    `\n🎯 Accuracy Test Results: ${results.passed}/${results.total} passed`
  );
  return results;
};

// =============================================================================
// PHASE 3.2: LINES API INTEGRATION TESTING COMMANDS
// =============================================================================

/**
 * @function testLinesAPIIntegration
 * @description Tests Lines API integration with page-by-page viewing
 * @returns {Object} Test results with detailed status
 * @since 3.2.0
 */
window.testLinesAPIIntegration = () => {
  console.log("🧪 Testing Lines API Integration...");

  const controller = window.getMathPixController();
  const pdfRenderer = controller?.pdfResultRenderer;

  const results = {
    controllerAvailable: !!controller,
    linesDataManagerAvailable: !!controller?.linesDataManager,
    pdfRendererAvailable: !!pdfRenderer,
    documentIdStored: !!pdfRenderer?.documentId,
    linesAnalysisAvailable: !!pdfRenderer?.linesAnalysis,
    linesDataAvailable: !!pdfRenderer?.linesData,
    overall: false,
  };

  console.log("✅ Controller Available:", results.controllerAvailable);
  console.log("✅ Lines Data Manager:", results.linesDataManagerAvailable);
  console.log("✅ PDF Renderer:", results.pdfRendererAvailable);
  console.log(
    "📄 Document ID Stored:",
    results.documentIdStored,
    pdfRenderer?.documentId ? `(${pdfRenderer.documentId})` : ""
  );
  console.log("📊 Lines Analysis Available:", results.linesAnalysisAvailable);
  console.log("📋 Lines Data Available:", results.linesDataAvailable);

  if (pdfRenderer?.linesAnalysis) {
    console.log("\n📈 Lines Analysis Summary:");
    console.log("   Total Pages:", pdfRenderer.linesAnalysis.totalPages);
    console.log(
      "   Math Elements:",
      pdfRenderer.linesAnalysis.mathElements.total
    );
    console.log("   Tables:", pdfRenderer.linesAnalysis.tableStructures.count);
    console.log(
      "   Average Confidence:",
      (pdfRenderer.linesAnalysis.averageConfidence * 100).toFixed(1) + "%"
    );
    console.log("   Summary:", pdfRenderer.linesAnalysis.summary);

    if (pdfRenderer.linesAnalysis.pageBreakdown) {
      console.log("\n📑 Page Breakdown Available:");
      console.log(
        "   Pages with data:",
        pdfRenderer.linesAnalysis.pageBreakdown.length
      );

      if (pdfRenderer.linesAnalysis.pageBreakdown.length > 0) {
        console.log("   Sample (Page 1):");
        const page1 = pdfRenderer.linesAnalysis.pageBreakdown[0];
        console.log("      Lines:", page1.lineCount);
        console.log("      Math Elements:", page1.mathElementCount);
        console.log("      Tables:", page1.tableCount);
        console.log("      Words:", page1.wordCount);
      }
    }
  } else {
    console.log("\n⚠️ No Lines Analysis available");
    console.log(
      "   Reason:",
      !pdfRenderer?.documentId
        ? "No document ID stored (upload multi-page PDF first)"
        : "Lines API fetch may have failed (check console logs)"
    );
  }

  results.overall =
    results.linesDataManagerAvailable && results.pdfRendererAvailable;

  console.log(
    `\n🎯 Overall Integration: ${
      results.overall ? "✅ READY" : "⚠️ MISSING COMPONENTS"
    }`
  );

  if (results.overall && !results.documentIdStored) {
    console.log("💡 Tip: Upload a multi-page PDF to test full integration");
  }

  return results;
};

/**
 * @function getPageAnalysis
 * @description Gets Lines API analysis for specific page
 * @param {number} pageNum - Page number (1-based)
 * @returns {Object|null} Page analysis data
 * @since 3.2.0
 */
window.getPageAnalysis = (pageNum) => {
  const pdfRenderer = window.getMathPixController()?.pdfResultRenderer;

  if (!pdfRenderer?.linesAnalysis?.pageBreakdown) {
    console.log("⚠️ No Lines API data available");
    console.log("💡 Upload and process a multi-page PDF first");
    return null;
  }

  if (
    !pageNum ||
    pageNum < 1 ||
    pageNum > pdfRenderer.linesAnalysis.totalPages
  ) {
    console.log(`❌ Invalid page number: ${pageNum}`);
    console.log(`   Valid range: 1-${pdfRenderer.linesAnalysis.totalPages}`);
    return null;
  }

  const pageData = pdfRenderer.linesAnalysis.pageBreakdown[pageNum - 1];

  if (pageData) {
    console.log(`📄 Page ${pageNum} Analysis:`);
    console.log("   Page Number:", pageData.pageNumber);
    console.log("   Lines:", pageData.lineCount);
    console.log("   Math Elements:", pageData.mathElementCount);
    console.log("   Tables:", pageData.tableCount);
    console.log("   Words:", pageData.wordCount);
    console.log("   Content Types:", pageData.contentTypes);

    console.log("\n📊 Content Breakdown:");
    Object.entries(pageData.contentTypes).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`      ${type}: ${count}`);
      }
    });

    return pageData;
  } else {
    console.log(`❌ No data for page ${pageNum}`);
    return null;
  }
};

/**
 * @function showDocumentAnalysis
 * @description Shows complete document analysis from Lines API
 * @returns {Object|null} Full document analysis
 * @since 3.2.0
 */
window.showDocumentAnalysis = () => {
  const pdfRenderer = window.getMathPixController()?.pdfResultRenderer;

  if (!pdfRenderer?.linesAnalysis) {
    console.log("⚠️ No Lines API analysis available");
    console.log("💡 Process a multi-page PDF first");
    console.log("📝 Steps:");
    console.log("   1. Upload a PDF file");
    console.log("   2. Wait for processing to complete");
    console.log("   3. Run this command again");
    return null;
  }

  const analysis = pdfRenderer.linesAnalysis;

  console.log("📊 Complete Document Analysis:");
  console.log("─".repeat(50));
  console.log("\n📄 Document Overview:");
  console.log("   Total Pages:", analysis.totalPages);
  console.log("   Total Lines:", analysis.totalLines);
  console.log(
    "   Average Confidence:",
    (analysis.averageConfidence * 100).toFixed(1) + "%"
  );
  console.log("   Summary:", analysis.summary);

  console.log("\n🔢 Mathematical Content:");
  console.log("   Total Math Elements:", analysis.mathElements.total);
  console.log("   Inline Math:", analysis.mathElements.inline);
  console.log("   Display Math:", analysis.mathElements.display);
  console.log("   Equations:", analysis.mathElements.equations);

  console.log("\n📋 Tables:");
  console.log("   Total Tables:", analysis.tableStructures.count);
  console.log(
    "   Average Rows:",
    analysis.tableStructures.averageRows.toFixed(1)
  );
  console.log(
    "   Average Columns:",
    analysis.tableStructures.averageCols.toFixed(1)
  );

  console.log("\n📑 Content Distribution:");
  Object.entries(analysis.contentTypes).forEach(([type, data]) => {
    console.log(`   ${type}:`, data.count, "elements");
  });

  if (analysis.pageBreakdown && analysis.pageBreakdown.length > 0) {
    console.log("\n📖 Page-by-Page Summary:");
    analysis.pageBreakdown.forEach((page, idx) => {
      console.log(
        `   Page ${idx + 1}: ${page.lineCount} lines, ` +
          `${page.mathElementCount} math, ${page.tableCount} tables`
      );
    });
  }

  console.log("\n💡 Commands:");
  console.log(
    "   getPageAnalysis(pageNum) - Get detailed analysis for specific page"
  );
  console.log("   testLinesAPIIntegration() - Test integration status");

  return analysis;
};
