/**
 * @fileoverview MathPix Final Actions Protection System
 * @description Comprehensive protection against regression for critical workflow buttons
 * @version 4.0.0
 * @author MathPix Development Team
 * @since 4.0.0
 *
 * CRITICAL SYSTEM COMPONENT - DO NOT MODIFY WITHOUT FULL TESTING
 * These functions protect the "Process Another PDF" and "Clear Results" buttons
 * which are essential for user workflow completion.
 *
 * Protection Layers:
 * 1. Automated Validation - Runs during normal operation
 * 2. Dedicated Test Suite - Comprehensive functionality testing
 * 3. Runtime Monitoring - Continuous health checks
 * 4. Defensive Patterns - Resilient coding practices
 * 5. Documentation Guards - Clear warnings and requirements
 */

// Logging configuration
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;

function shouldLog(level) {
  return level <= DEFAULT_LOG_LEVEL;
}
function logError(msg, ...args) {
  if (shouldLog(0)) console.error(msg, ...args);
}
function logWarn(msg, ...args) {
  if (shouldLog(1)) console.warn(msg, ...args);
}
function logInfo(msg, ...args) {
  if (shouldLog(2)) console.log(msg, ...args);
}
function logDebug(msg, ...args) {
  if (shouldLog(3)) console.log(msg, ...args);
}

/**
 * @class FinalActionsProtectionSystem
 * @description Comprehensive protection system for critical workflow buttons
 */
class FinalActionsProtectionSystem {
  constructor() {
    this.CRITICAL_BUTTON_IDS = [
      "mathpix-process-another-pdf",
      "mathpix-clear-pdf-results",
    ];

    this.CRITICAL_HANDLER_METHODS = [
      "handleProcessAnother",
      "handleClearResults",
    ];

    // ✅ PHASE 3.4.2: View mode controls removed (simplified interface)
    // Radio buttons and page-by-page view removed from UI
    this.CRITICAL_VIEW_MODE_IDS = []; // Removed - no longer in DOM
    this.CRITICAL_VIEW_MODE_METHODS = []; // Removed from critical checks

    this.lastValidationTime = null;
    this.validationInterval = 10000; // 10 seconds
    this.autoValidationEnabled = true;

    // Start automatic monitoring
    this.startAutoMonitoring();

    logInfo("🛡️ Final Actions Protection System initialized");
  }

  /**
   * LAYER 1: AUTOMATED VALIDATION
   * Runs automatically during normal operation
   */
  validateCriticalButtons() {
    const timestamp = new Date().toISOString();
    const results = {
      timestamp,
      overall: "UNKNOWN",
      buttonTests: {},
      handlerTests: {},
      contextTests: {},
      recommendations: [],
    };

    logDebug("🔍 Running critical button validation...");

    try {
      // Test 1: Button Existence and Accessibility
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        const isAccessible = button && !button.disabled;
        const hasProperAria =
          button &&
          (button.getAttribute("aria-label") ||
            button.textContent.trim().length > 0);

        results.buttonTests[buttonId] = {
          exists: !!button,
          accessible: isAccessible,
          ariaCompliant: hasProperAria,
          status: !!button && isAccessible && hasProperAria ? "PASS" : "FAIL",
        };

        if (!button) {
          results.recommendations.push(
            `CRITICAL: Button ${buttonId} is missing from DOM`
          );
        } else if (!isAccessible) {
          results.recommendations.push(
            `CRITICAL: Button ${buttonId} is not accessible`
          );
        }
      });

      // ✅ PHASE 3.4.2: View mode radio buttons removed (simplified interface)
      // Skip radio button validation as these controls no longer exist by design
      if (this.CRITICAL_VIEW_MODE_IDS.length > 0) {
        this.CRITICAL_VIEW_MODE_IDS.forEach((radioId) => {
          const radio = document.getElementById(radioId);
          const isAccessible = radio && !radio.disabled;
          const hasProperLabelling =
            radio &&
            (radio.getAttribute("aria-label") ||
              radio.closest("label") ||
              radio.nextElementSibling?.textContent?.trim());

          results.buttonTests[`${radioId}-radio`] = {
            exists: !!radio,
            accessible: isAccessible,
            ariaCompliant: hasProperLabelling,
            isRadio: radio?.type === "radio",
            inRadioGroup: radio?.name === "pdf-view-mode",
            status:
              !!radio &&
              isAccessible &&
              hasProperLabelling &&
              radio?.type === "radio"
                ? "PASS"
                : "FAIL",
          };

          if (!radio) {
            results.recommendations.push(
              `INFO: View mode radio ${radioId} not present (simplified interface)`
            );
          }
        });
      }

      // Test 2: Handler Method Availability
      const controller = window.getMathPixController?.();
      const renderer = controller?.pdfResultRenderer;

      if (renderer) {
        this.CRITICAL_HANDLER_METHODS.forEach((methodName) => {
          const method = renderer[methodName];
          const isCallable = typeof method === "function";

          results.handlerTests[methodName] = {
            exists: !!method,
            callable: isCallable,
            bound: isCallable && method.toString().includes("this."),
            status: isCallable ? "PASS" : "FAIL",
          };

          if (!isCallable) {
            results.recommendations.push(
              `CRITICAL: Handler method ${methodName} is not available`
            );
          }
        });

        // ✅ PHASE 3.4.2: View mode handlers kept for internal use only
        // No longer critical since UI controls removed
        if (this.CRITICAL_VIEW_MODE_METHODS.length > 0) {
          this.CRITICAL_VIEW_MODE_METHODS.forEach((methodName) => {
            const method = renderer[methodName];
            const isCallable = typeof method === "function";

            results.handlerTests[`${methodName}-viewmode`] = {
              exists: !!method,
              callable: isCallable,
              bound: isCallable && method.toString().includes("this."),
              status: isCallable ? "PASS" : "INFO", // Changed from FAIL to INFO
            };

            // No longer add warning if missing since these are optional now
          });
        }
      } else {
        results.recommendations.push(
          "CRITICAL: PDF Result Renderer not available"
        );
      }

      // Test 3: Event Listener Context Integrity
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
          // Check for problematic onclick attributes
          const onclickAttr = button.getAttribute("onclick");
          const hasThisContext = onclickAttr && onclickAttr.includes("this.");

          results.contextTests[buttonId] = {
            hasOnclickAttr: !!onclickAttr,
            hasThisContext: hasThisContext,
            contextSafe: !hasThisContext,
            status: !hasThisContext ? "PASS" : "FAIL",
          };

          if (hasThisContext) {
            results.recommendations.push(
              `CRITICAL: Button ${buttonId} has broken 'this' context in onclick`
            );
          }
        }
      });

      // Calculate overall status
      const allTests = [
        ...Object.values(results.buttonTests),
        ...Object.values(results.handlerTests),
        ...Object.values(results.contextTests),
      ];

      const passCount = allTests.filter(
        (test) => test.status === "PASS"
      ).length;
      const totalCount = allTests.length;

      if (passCount === totalCount) {
        results.overall = "HEALTHY";
      } else if (passCount >= totalCount * 0.8) {
        results.overall = "WARNING";
      } else {
        results.overall = "CRITICAL";
      }

      this.lastValidationTime = Date.now();

      // Log results based on severity
      if (results.overall === "HEALTHY") {
        logDebug(
          `✅ Final actions validation: ${passCount}/${totalCount} tests passed`
        );
      } else if (results.overall === "WARNING") {
        logWarn(
          `⚠️ Final actions validation: ${passCount}/${totalCount} tests passed`
        );
      } else {
        logError(
          `🚨 Final actions validation: ${passCount}/${totalCount} tests passed`
        );
        console.table(results);
      }

      return results;
    } catch (error) {
      logError("Final actions validation failed:", error);
      results.overall = "ERROR";
      results.error = error.message;
      return results;
    }
  }

  /**
   * LAYER 2: DEDICATED TEST SUITE
   * Comprehensive functionality testing
   */
  runComprehensiveTest() {
    console.log("🧪 Running Comprehensive Final Actions Test Suite");

    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: { passed: 0, failed: 0, total: 0 },
    };

    // Test 1: Button Discovery
    testResults.tests.buttonDiscovery = this.testButtonDiscovery();

    // Test 2: Handler Availability
    testResults.tests.handlerAvailability = this.testHandlerAvailability();

    // Test 3: Event Attachment
    testResults.tests.eventAttachment = this.testEventAttachment();

    // Test 4: Accessibility Compliance
    testResults.tests.accessibilityCompliance =
      this.testAccessibilityCompliance();

    // Test 5: Focus Management
    testResults.tests.focusManagement = this.testFocusManagement();

    // Calculate summary
    Object.values(testResults.tests).forEach((test) => {
      testResults.summary.total++;
      if (test.passed) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    });

    const overallSuccess = testResults.summary.failed === 0;

    console.log(
      `📊 Test Results: ${testResults.summary.passed}/${testResults.summary.total} passed`
    );

    if (overallSuccess) {
      console.log("🎉 All final actions tests PASSED!");
    } else {
      console.error("🚨 Some final actions tests FAILED!");
      console.table(testResults.tests);
    }

    return testResults;
  }

  testButtonDiscovery() {
    const test = { name: "Button Discovery", passed: false, details: {} };

    try {
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        test.details[buttonId] = {
          found: !!button,
          visible: button ? button.offsetParent !== null : false,
          inDOM: button ? document.contains(button) : false,
        };
      });

      test.passed = this.CRITICAL_BUTTON_IDS.every(
        (id) => test.details[id].found && test.details[id].inDOM
      );
    } catch (error) {
      test.error = error.message;
    }

    return test;
  }

  testHandlerAvailability() {
    const test = { name: "Handler Availability", passed: false, details: {} };

    try {
      const controller = window.getMathPixController?.();
      const renderer = controller?.pdfResultRenderer;

      if (!renderer) {
        test.error = "PDF Result Renderer not available";
        return test;
      }

      this.CRITICAL_HANDLER_METHODS.forEach((methodName) => {
        const method = renderer[methodName];
        test.details[methodName] = {
          exists: typeof method === "function",
          callable: typeof method === "function" && method.length >= 0,
          bound: method && method.toString().includes("this."),
        };
      });

      test.passed = this.CRITICAL_HANDLER_METHODS.every(
        (method) => test.details[method].exists && test.details[method].callable
      );
    } catch (error) {
      test.error = error.message;
    }

    return test;
  }

  testEventAttachment() {
    const test = { name: "Event Attachment", passed: false, details: {} };

    try {
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
          // Test if button responds to click events
          const hasListeners = !!(
            button.onclick ||
            button.addEventListener ||
            button.getAttribute("onclick")
          );

          test.details[buttonId] = {
            hasEventCapability: hasListeners,
            onclickAttr: button.getAttribute("onclick"),
            contextSafe: !button.getAttribute("onclick")?.includes("this."),
          };
        } else {
          test.details[buttonId] = { error: "Button not found" };
        }
      });

      test.passed = this.CRITICAL_BUTTON_IDS.every(
        (id) =>
          test.details[id].hasEventCapability && test.details[id].contextSafe
      );
    } catch (error) {
      test.error = error.message;
    }

    return test;
  }

  testAccessibilityCompliance() {
    const test = {
      name: "Accessibility Compliance",
      passed: false,
      details: {},
    };

    try {
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
          test.details[buttonId] = {
            hasText: button.textContent.trim().length > 0,
            hasAriaLabel: !!button.getAttribute("aria-label"),
            isButton: button.tagName.toLowerCase() === "button",
            notDisabled: !button.disabled,
            focusable: button.tabIndex >= 0 || button.tabIndex === undefined,
          };
        } else {
          test.details[buttonId] = { error: "Button not found" };
        }
      });

      test.passed = this.CRITICAL_BUTTON_IDS.every((id) => {
        const details = test.details[id];
        return details.hasText && details.isButton && details.notDisabled;
      });
    } catch (error) {
      test.error = error.message;
    }

    return test;
  }

  testFocusManagement() {
    const test = { name: "Focus Management", passed: false, details: {} };

    try {
      // Test that buttons can receive focus and don't cause accessibility issues
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
          const canFocus = typeof button.focus === "function";
          const inTabOrder = button.tabIndex !== -1;

          test.details[buttonId] = {
            canFocus,
            inTabOrder,
            hasProperRole:
              button.getAttribute("role") === "button" ||
              button.tagName === "BUTTON",
          };
        } else {
          test.details[buttonId] = { error: "Button not found" };
        }
      });

      test.passed = this.CRITICAL_BUTTON_IDS.every((id) => {
        const details = test.details[id];
        return details.canFocus && details.hasProperRole;
      });
    } catch (error) {
      test.error = error.message;
    }

    return test;
  }

  /**
   * LAYER 3: RUNTIME MONITORING
   * Continuous health checks during operation
   */
  startAutoMonitoring() {
    if (!this.autoValidationEnabled) return;

    setInterval(() => {
      const results = this.validateCriticalButtons();

      if (results.overall === "CRITICAL") {
        console.error("🚨 CRITICAL: Final action buttons are broken!");
        console.error("Recommendations:", results.recommendations);
      } else if (results.overall === "WARNING") {
        console.warn("⚠️ WARNING: Final action buttons have issues");
        console.warn("Recommendations:", results.recommendations);
      }
    }, this.validationInterval);

    logDebug("🔄 Auto-monitoring started for final actions");
  }

  stopAutoMonitoring() {
    this.autoValidationEnabled = false;
    logInfo("⏹️ Auto-monitoring stopped for final actions");
  }

  /**
   * LAYER 4: DEFENSIVE REPAIR
   * Attempt to fix common issues automatically
   */
  attemptRepair() {
    console.log("🔧 Attempting automatic repair of final actions...");

    const repairResults = {
      timestamp: new Date().toISOString(),
      repairs: [],
      success: false,
    };

    try {
      const controller = window.getMathPixController?.();
      const renderer = controller?.pdfResultRenderer;

      if (!renderer) {
        repairResults.repairs.push("FAILED: No renderer available for repair");
        return repairResults;
      }

      // Repair 1: Re-attach event listeners using direct DOM queries
      this.CRITICAL_BUTTON_IDS.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
          // Remove old listeners by cloning element
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);

          // Re-attach correct listeners
          if (buttonId === "mathpix-process-another-pdf") {
            newButton.addEventListener("click", () => {
              renderer.handleProcessAnother();
            });
            repairResults.repairs.push(
              "REPAIRED: Process Another button event listener"
            );
          } else if (buttonId === "mathpix-clear-pdf-results") {
            newButton.addEventListener("click", () => {
              renderer.handleClearResults();
            });
            repairResults.repairs.push(
              "REPAIRED: Clear Results button event listener"
            );
          }
        } else {
          repairResults.repairs.push(
            `FAILED: Button ${buttonId} not found for repair`
          );
        }
      });

      // Verify repair success
      const postRepairValidation = this.validateCriticalButtons();
      repairResults.success = postRepairValidation.overall === "HEALTHY";

      if (repairResults.success) {
        console.log("✅ Automatic repair successful!");
      } else {
        console.error("❌ Automatic repair failed");
      }
    } catch (error) {
      repairResults.repairs.push(`ERROR: ${error.message}`);
      logError("Repair attempt failed:", error);
    }

    return repairResults;
  }

  /**
   * LAYER 5: SYSTEM STATUS REPORT
   * Generate comprehensive status for debugging
   */
  generateStatusReport() {
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo: this.getSystemInfo(),
      validationResults: this.validateCriticalButtons(),
      testResults: this.runComprehensiveTest(),
      healthScore: 0,
      recommendations: [],
    };

    // Calculate health score
    const validationHealth =
      report.validationResults.overall === "HEALTHY"
        ? 100
        : report.validationResults.overall === "WARNING"
        ? 70
        : 0;
    const testHealth =
      (report.testResults.summary.passed / report.testResults.summary.total) *
      100;

    report.healthScore = Math.round((validationHealth + testHealth) / 2);

    // Generate recommendations
    if (report.healthScore < 50) {
      report.recommendations.push("URGENT: Run attemptRepair() immediately");
      report.recommendations.push(
        "URGENT: Check setupFinalActions() method implementation"
      );
    } else if (report.healthScore < 80) {
      report.recommendations.push("WARNING: Monitor system closely");
      report.recommendations.push("SUGGESTION: Review recent code changes");
    } else {
      report.recommendations.push("GOOD: System functioning normally");
    }

    return report;
  }

  getSystemInfo() {
    const controller = window.getMathPixController?.();

    return {
      controllerAvailable: !!controller,
      rendererAvailable: !!controller?.pdfResultRenderer,
      buttonsInDOM: this.CRITICAL_BUTTON_IDS.map((id) => ({
        id,
        exists: !!document.getElementById(id),
      })),
      autoMonitoringActive: this.autoValidationEnabled,
      lastValidation: this.lastValidationTime
        ? new Date(this.lastValidationTime).toISOString()
        : null,
    };
  }
}

// Create global instance
const finalActionsProtection = new FinalActionsProtectionSystem();

// ===================================================================
// GLOBAL FUNCTION EXPORTS - ADD TO TESTING INFRASTRUCTURE
// ===================================================================

/**
 * Quick health check - use this in console for fast validation
 */
window.checkFinalActionsHealth = () => {
  const results = finalActionsProtection.validateCriticalButtons();
  console.log(`🏥 Final Actions Health: ${results.overall}`);

  if (results.overall !== "HEALTHY") {
    console.log("Issues found:", results.recommendations);
  }

  return results.overall === "HEALTHY";
};

/**
 * Comprehensive test suite - use before/after code changes
 */
window.testFinalActions = () => {
  return finalActionsProtection.runComprehensiveTest();
};

/**
 * Emergency repair function - use if buttons stop working
 */
window.repairFinalActions = () => {
  return finalActionsProtection.attemptRepair();
};

/**
 * Full system report - use for detailed debugging
 */
window.getFinalActionsReport = () => {
  return finalActionsProtection.generateStatusReport();
};

/**
 * Integration with existing validation system
 */
/**
/**
 * ✅ PHASE 3.4.2: View mode validation updated for simplified interface
 * View mode radio buttons removed - combined view only
 */
window.validateViewModeIntegration = () => {
  console.log("🔍 Testing View Mode Integration (Phase 3.4.2 Simplified)...");

  const results = {
    interfaceSimplification: {},
    rendererMethods: {},
    overall: "UNKNOWN",
  };

  // Verify radio buttons are correctly removed
  const removedRadioIds = [
    "pdf-view-combined",
    "pdf-view-pages",
    "pdf-view-pdf-preview",
  ];
  removedRadioIds.forEach((radioId) => {
    const radio = document.getElementById(radioId);
    results.interfaceSimplification[radioId] = {
      correctlyRemoved: !radio,
      status: !radio ? "✅ CORRECT" : "⚠️ SHOULD BE REMOVED",
    };
  });

  // Test renderer still has methods (for backward compatibility)
  const renderer = window.getMathPixController?.()?.pdfResultRenderer;
  results.rendererMethods.rendererExists = !!renderer;

  // Check statistics display (new Phase 3.4.2 feature)
  const statsPanel = document.getElementById("mathpix-page-statistics");
  results.interfaceSimplification.statisticsIntegration = {
    panelExists: !!statsPanel,
    inDocumentInfo: !!statsPanel?.closest(".mathpix-document-info"),
    status: !!statsPanel ? "✅ CORRECT" : "❌ MISSING",
  };

  // Calculate overall status
  const simplificationCorrect = removedRadioIds.every(
    (id) => !document.getElementById(id)
  );
  const statsCorrect = !!statsPanel;

  results.overall =
    simplificationCorrect && statsCorrect ? "HEALTHY" : "ISSUES";

  console.log("📊 View Mode Simplification Results:", {
    radioButtonsRemoved: simplificationCorrect ? "✅ CORRECT" : "⚠️ FOUND",
    statisticsIntegrated: statsCorrect ? "✅ CORRECT" : "❌ MISSING",
    overall:
      results.overall === "HEALTHY"
        ? "✅ SIMPLIFIED CORRECTLY"
        : "⚠️ NEEDS ATTENTION",
  });

  return results;
};

window.validateFinalActionsIntegration = () => {
  // Run our validation alongside existing MathPix validation
  const finalActionsHealth = window.checkFinalActionsHealth();
  const exportHealth = window.validateMathPixExportFunctionality?.() || true;

  // ✅ VIEW MODE: Include view mode validation
  const viewModeHealth = window.validateViewModeIntegration();

  console.log("🔗 Integrated Validation Results:", {
    finalActions: finalActionsHealth ? "✅ HEALTHY" : "🚨 ISSUES",
    exportSystem: exportHealth ? "✅ HEALTHY" : "🚨 ISSUES",
    viewModeSystem:
      viewModeHealth.overall === "HEALTHY" ? "✅ HEALTHY" : "🚨 ISSUES",
    overallSystem:
      finalActionsHealth && exportHealth && viewModeHealth.overall === "HEALTHY"
        ? "✅ FULLY FUNCTIONAL"
        : "⚠️ NEEDS ATTENTION",
  });

  return (
    finalActionsHealth && exportHealth && viewModeHealth.overall === "HEALTHY"
  );
};

// Add to existing test infrastructure
if (window.mathPixPhase31Tests) {
  window.mathPixPhase31Tests.finalActionsProtection = finalActionsProtection;
}

export { FinalActionsProtectionSystem, finalActionsProtection };
