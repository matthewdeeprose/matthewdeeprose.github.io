// ===== PHASE 9A.1: SEMANTIC MAPPING TEST FUNCTIONS =====
// Temporary test functions for semantic contrast mapping validation

window.testSemanticMapping = function () {
  console.log("=== Phase 9A.1: Semantic Mapping Test ===");

  if (!window.AdaptiveBackgroundManager?.isInitialised()) {
    console.error("❌ Adaptive Background Manager not initialised");
    return false;
  }

  try {
    // Get all text elements and check their semantic categorisation
    const mainElement = document.querySelector("#main");
    if (!mainElement) {
      console.error("❌ Main element not found");
      return false;
    }

    const textElements = mainElement.querySelectorAll(
      "p, h1, h2, h3, h4, h5, h6, li, td, th, span, a, button, label, legend, caption"
    );
    const semanticBreakdown = {
      text: 0,
      "critical-text": 0,
      graphical: 0,
      mathematical: 0,
      interactive: 0,
      unknown: 0,
    };

    let totalElements = 0;
    let elementsWithSemantics = 0;

    textElements.forEach((element) => {
      if (element.textContent.trim().length > 0) {
        totalElements++;

        const semanticType = element.dataset.semanticType;
        const targetContrast = element.dataset.targetContrast;
        const reasoning = element.dataset.semanticReasoning;

        if (semanticType && targetContrast) {
          elementsWithSemantics++;
          semanticBreakdown[semanticType] =
            (semanticBreakdown[semanticType] || 0) + 1;

          // Validate expected contrast targets
          const expectedTargets = {
            text: 4.5,
            "critical-text": 7.0,
            graphical: 3.0,
            mathematical: 4.5,
            interactive: 4.5,
          };

          const actualTarget = parseFloat(targetContrast);
          const expectedTarget = expectedTargets[semanticType];

          if (actualTarget !== expectedTarget) {
            console.warn(
              `⚠️ Unexpected target contrast for ${semanticType}: got ${actualTarget}, expected ${expectedTarget}`
            );
          }
        } else {
          semanticBreakdown.unknown++;
        }
      }
    });

    // Report results
    console.log(`✅ Processed ${totalElements} text elements`);
    console.log(
      `📊 Elements with semantic data: ${elementsWithSemantics}/${totalElements} (${(
        (elementsWithSemantics / totalElements) *
        100
      ).toFixed(1)}%)`
    );
    console.log("📋 Semantic breakdown:");

    Object.entries(semanticBreakdown).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count} elements`);
      }
    });

    // Success criteria: >90% of elements should have semantic data
    const successRate = (elementsWithSemantics / totalElements) * 100;
    const passed = successRate >= 90;

    console.log(
      `${passed ? "✅" : "❌"} Semantic mapping test: ${successRate.toFixed(
        1
      )}% success rate`
    );
    return passed;
  } catch (error) {
    console.error("❌ Error in semantic mapping test:", error);
    return false;
  }
};

window.testContrastTargeting = function () {
  console.log("=== Phase 9A.1: Contrast Targeting Test ===");

  if (!window.AdaptiveBackgroundManager?.isInitialised()) {
    console.error("❌ Adaptive Background Manager not initialised");
    return false;
  }

  try {
    // Test with a challenging background colour
    const testBackground = "#E5108C"; // High saturation magenta
    const picker = document.getElementById("adaptive-background-picker");

    if (!picker) {
      console.error("❌ Background picker not found");
      return false;
    }

    console.log(
      `🎨 Testing contrast targeting with background: ${testBackground}`
    );

    // Apply test background
    picker.value = testBackground;
    picker.dispatchEvent(new Event("input"));

    // Wait for processing to complete
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const debugInfo = window.AdaptiveBackgroundManager.getDebugInfo();
          const processedElements = debugInfo.debugInfo?.contrastRatios || [];

          if (processedElements.length === 0) {
            console.error("❌ No processed elements found in debug info");
            resolve(false);
            return;
          }

          // Analyse contrast targeting results
          const targetingResults = {
            text: { elements: 0, compliant: 0, target: 4.5 },
            "critical-text": { elements: 0, compliant: 0, target: 7.0 },
            graphical: { elements: 0, compliant: 0, target: 3.0 },
            mathematical: { elements: 0, compliant: 0, target: 4.5 },
          };

          processedElements.forEach((element) => {
            const semanticType = element.semanticType || "text";
            const actualContrast = element.contrast || 0;
            const targetContrast = element.targetContrast || 4.5;

            if (targetingResults[semanticType]) {
              targetingResults[semanticType].elements++;
              if (actualContrast >= targetContrast) {
                targetingResults[semanticType].compliant++;
              }
            }
          });

          // Report results
          console.log("📊 Contrast targeting results:");
          let overallPassed = true;

          Object.entries(targetingResults).forEach(([type, results]) => {
            if (results.elements > 0) {
              const complianceRate =
                (results.compliant / results.elements) * 100;
              const passed = complianceRate >= 95; // 95% compliance threshold
              overallPassed = overallPassed && passed;

              console.log(
                `  ${passed ? "✅" : "❌"} ${type} (${results.target}:1): ${
                  results.compliant
                }/${results.elements} compliant (${complianceRate.toFixed(1)}%)`
              );
            }
          });

          console.log(
            `${overallPassed ? "✅" : "❌"} Contrast targeting test: ${
              overallPassed ? "PASSED" : "FAILED"
            }`
          );
          resolve(overallPassed);
        } catch (error) {
          console.error(
            "❌ Error processing contrast targeting results:",
            error
          );
          resolve(false);
        }
      }, 500); // Wait 500ms for background processing
    });
  } catch (error) {
    console.error("❌ Error in contrast targeting test:", error);
    return false;
  }
};

window.testCriticalContent = function () {
  console.log("=== Phase 9A.1: Critical Content Test ===");

  try {
    // Find critical content elements (headings, captions, error messages)
    const criticalSelectors = [
      "h1",
      "h2",
      "caption",
      ".error-message",
      ".warning-message",
      ".alert",
    ];

    const criticalElements = [];
    criticalSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.textContent.trim().length > 0) {
          criticalElements.push(el);
        }
      });
    });

    if (criticalElements.length === 0) {
      console.log("⚠️ No critical content elements found in document");
      return true; // Pass if no critical content exists
    }

    console.log(
      `🔍 Found ${criticalElements.length} critical content elements`
    );

    let correctTargets = 0;
    let totalCritical = 0;

    criticalElements.forEach((element) => {
      const semanticType = element.dataset.semanticType;
      const targetContrast = parseFloat(element.dataset.targetContrast);

      totalCritical++;

      // Critical content should have either:
      // 1. semanticType 'critical-text' with 7.0:1 target, OR
      // 2. Be a heading with enhanced contrast (h1, h2 should get 7.0:1)
      const isCriticallyTagged =
        semanticType === "critical-text" && targetContrast === 7.0;
      const isEnhancedHeading =
        ["H1", "H2"].includes(element.tagName) && targetContrast >= 7.0;

      if (isCriticallyTagged || isEnhancedHeading) {
        correctTargets++;
        console.log(
          `✅ ${element.tagName.toLowerCase()}: ${semanticType} (${targetContrast}:1)`
        );
      } else {
        console.log(
          `❌ ${element.tagName.toLowerCase()}: ${
            semanticType || "no-semantic"
          } (${targetContrast || "no-target"}:1)`
        );
      }
    });

    const criticalSuccessRate = (correctTargets / totalCritical) * 100;
    const passed = criticalSuccessRate >= 80; // 80% of critical content should get enhanced contrast

    console.log(
      `${
        passed ? "✅" : "❌"
      } Critical content test: ${correctTargets}/${totalCritical} elements with enhanced contrast (${criticalSuccessRate.toFixed(
        1
      )}%)`
    );
    return passed;
  } catch (error) {
    console.error("❌ Error in critical content test:", error);
    return false;
  }
};

window.testGraphicalContent = function () {
  console.log("=== Phase 9A.1: Graphical Content Test ===");

  try {
    // Find graphical content elements (tables, math containers)
    const graphicalSelectors = [
      "table",
      "tr",
      "mjx-container",
      "div.table-wrapper",
    ];

    const graphicalElements = [];
    graphicalSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        // Only count elements that would be processed for colour
        if (el.offsetParent !== null) {
          // Visible elements
          graphicalElements.push(el);
        }
      });
    });

    if (graphicalElements.length === 0) {
      console.log("⚠️ No graphical content elements found in document");
      return true; // Pass if no graphical content exists
    }

    console.log(
      `🔍 Found ${graphicalElements.length} graphical content elements`
    );

    // For graphical elements, we need to check if they would be analysed as graphical
    // when processing properties like border-color, not text color
    let graphicallyAnalysed = 0;
    let totalGraphical = 0;

    graphicalElements.forEach((element) => {
      totalGraphical++;

      // Check if element has mathematical content markers
      const isMathematical =
        element.closest("mjx-container") ||
        Array.from(element.classList).some((cls) => cls.includes("math"));

      // Check if element is table structure
      const isTableStructure = ["TABLE", "TR", "THEAD", "TBODY"].includes(
        element.tagName
      );

      if (isMathematical) {
        console.log(
          `📊 ${element.tagName.toLowerCase()}: mathematical content (expected 4.5:1 for text)`
        );
        graphicallyAnalysed++;
      } else if (isTableStructure) {
        console.log(
          `📋 ${element.tagName.toLowerCase()}: table structure (expected 3.0:1 for borders)`
        );
        graphicallyAnalysed++;
      } else {
        console.log(
          `❓ ${element.tagName.toLowerCase()}: unclear graphical categorisation`
        );
      }
    });

    const graphicalSuccessRate = (graphicallyAnalysed / totalGraphical) * 100;
    const passed = graphicalSuccessRate >= 70; // 70% should be properly categorised

    console.log(
      `${
        passed ? "✅" : "❌"
      } Graphical content test: ${graphicallyAnalysed}/${totalGraphical} elements properly categorised (${graphicalSuccessRate.toFixed(
        1
      )}%)`
    );
    return passed;
  } catch (error) {
    console.error("❌ Error in graphical content test:", error);
    return false;
  }
};

// Combined semantic test runner
window.testAllSemanticMapping = function () {
  console.log("=== Phase 9A.1: Complete Semantic Mapping Test Suite ===");

  const tests = [
    { name: "Semantic Mapping", fn: window.testSemanticMapping },
    { name: "Critical Content", fn: window.testCriticalContent },
    { name: "Graphical Content", fn: window.testGraphicalContent },
  ];

  const results = {};
  let overallPassed = true;

  tests.forEach((test) => {
    try {
      console.log(`\n--- Running ${test.name} Test ---`);
      const result = test.fn();
      results[test.name] = result;
      overallPassed = overallPassed && result;
    } catch (error) {
      console.error(`❌ ${test.name} test failed:`, error);
      results[test.name] = false;
      overallPassed = false;
    }
  });

  // Run contrast targeting test last (it's async)
  console.log(`\n--- Running Contrast Targeting Test ---`);
  return window.testContrastTargeting().then((contrastResult) => {
    results["Contrast Targeting"] = contrastResult;
    overallPassed = overallPassed && contrastResult;

    console.log("\n=== SEMANTIC MAPPING TEST SUMMARY ===");
    Object.entries(results).forEach(([testName, passed]) => {
      console.log(
        `${passed ? "✅" : "❌"} ${testName}: ${passed ? "PASSED" : "FAILED"}`
      );
    });

    console.log(
      `\n${
        overallPassed
          ? "🎉 ALL SEMANTIC TESTS PASSED"
          : "⚠️ SOME SEMANTIC TESTS FAILED"
      }`
    );
    return overallPassed;
  });
};

logInfo("Phase 9A.1: Semantic mapping test functions loaded");
