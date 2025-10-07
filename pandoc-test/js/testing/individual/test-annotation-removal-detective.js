// js/testing/individual/test-annotation-removal-detective.js
// Post-Injection Annotation Removal Investigation System
// Tracks when and how annotations are removed after successful injection

const TestAnnotationRemovalDetective = (function () {
  "use strict";

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

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[REMOVAL-DETECTIVE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[REMOVAL-DETECTIVE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[REMOVAL-DETECTIVE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[REMOVAL-DETECTIVE]", message, ...args);
  }

  /**
   * Post-Injection Annotation Removal Monitor
   * Tracks annotation removal events after successful injection
   */
  function annotationRemovalDetective(durationMs = 10000) {
    console.log("🕵️ ANNOTATION REMOVAL DETECTIVE STARTED");
    console.log("Load an example and watch for annotation removal...");

    let lastAnnotationCount = 0;
    let mathElementCount = 0;
    let removalEvents = [];
    const startTime = Date.now();

    const monitor = setInterval(() => {
      const currentAnnotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;
      const currentMath = document.querySelectorAll("mjx-container").length;
      const timestamp = Date.now() - startTime;

      // Detect annotation removal
      if (lastAnnotationCount > 0 && currentAnnotations < lastAnnotationCount) {
        const removal = {
          timestamp,
          before: lastAnnotationCount,
          after: currentAnnotations,
          mathElements: currentMath,
          lostAnnotations: lastAnnotationCount - currentAnnotations,
        };

        console.log(`🚨 ANNOTATION REMOVAL DETECTED at ${timestamp}ms:`);
        console.log(`   Before: ${removal.before} annotations`);
        console.log(`   After: ${removal.after} annotations`);
        console.log(`   Lost: ${removal.lostAnnotations} annotations`);
        console.log(`   Math elements: ${removal.mathElements}`);

        removalEvents.push(removal);
      }

      // Detect successful injection
      if (currentAnnotations > lastAnnotationCount) {
        console.log(
          `✅ ANNOTATIONS ADDED at ${timestamp}ms: ${lastAnnotationCount} → ${currentAnnotations}`
        );
      }

      lastAnnotationCount = currentAnnotations;
      mathElementCount = currentMath;
    }, 100);

    setTimeout(() => {
      clearInterval(monitor);
      const finalAnnotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;
      const finalMath = document.querySelectorAll("mjx-container").length;

      console.log(`\n📊 REMOVAL DETECTIVE REPORT:`);
      console.log(
        `   Final State: ${finalAnnotations}/${finalMath} annotations`
      );
      console.log(`   Removal Events: ${removalEvents.length}`);
      console.log(`   Investigation Duration: ${durationMs}ms`);

      if (removalEvents.length > 0) {
        console.log(
          `\n🎯 SMOKING GUN FOUND: ${removalEvents.length} annotation removal events detected!`
        );
        removalEvents.forEach((event, i) => {
          console.log(
            `   Event ${i + 1}: Lost ${event.lostAnnotations} annotations at ${
              event.timestamp
            }ms`
          );
        });
      } else {
        console.log(
          `\n🤔 NO REMOVAL DETECTED: Annotations may not have been injected successfully`
        );
      }

      return { finalAnnotations, finalMath, removalEvents };
    }, durationMs);
  }

  /**
   * Conversion Cycle Conflict Detector
   * Identifies multiple conversion cycles causing annotation conflicts
   */
  function conversionConflictDetector() {
    console.log("🔄 CONVERSION CYCLE CONFLICT DETECTOR ACTIVATED");

    let conversionCount = 0;
    let annotationInjectionCount = 0;
    let conflicts = [];

    // Hook into conversion start
    const originalConvertInput = window.ConversionEngine?.convertInput;
    if (originalConvertInput) {
      window.ConversionEngine.convertInput = function (...args) {
        conversionCount++;
        const timestamp = Date.now();

        console.log(
          `🔄 CONVERSION #${conversionCount} STARTED at ${timestamp}`
        );

        // Check if annotations exist before conversion
        const preAnnotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;
        if (preAnnotations > 0) {
          console.log(
            `⚠️ POTENTIAL CONFLICT: Starting conversion with ${preAnnotations} existing annotations`
          );
          conflicts.push({
            conversionNumber: conversionCount,
            timestamp,
            preAnnotations,
            type: "conversion_with_existing_annotations",
          });
        }

        return originalConvertInput.apply(this, args);
      };
    }

    // Hook into annotation injection
    const originalInject = window.injectMathJaxAnnotations;
    if (originalInject) {
      window.injectMathJaxAnnotations = function (...args) {
        annotationInjectionCount++;
        console.log(`💉 ANNOTATION INJECTION #${annotationInjectionCount}`);

        return originalInject.apply(this, args);
      };
    }

    // Status reporter
    window.reportConversionConflicts = function () {
      console.log(`\n📋 CONVERSION CONFLICT REPORT:`);
      console.log(`   Total Conversions: ${conversionCount}`);
      console.log(`   Total Injections: ${annotationInjectionCount}`);
      console.log(`   Conflicts Detected: ${conflicts.length}`);

      if (conflicts.length > 0) {
        console.log(`\n🚨 CONFLICTS FOUND:`);
        conflicts.forEach((conflict) => {
          console.log(
            `   ${conflict.type}: ${conflict.preAnnotations} annotations at risk`
          );
        });
      }

      return { conversionCount, annotationInjectionCount, conflicts };
    };

    console.log(
      "✅ Hooks installed. Use reportConversionConflicts() to get status"
    );
  }

  /**
   * Live LaTeX Editor DOM Interference Detector
   * Detects when Live LaTeX Editor DOM operations remove annotations
   */
  function liveEditorInterferenceDetector() {
    console.log("📝 LIVE LATEX EDITOR INTERFERENCE DETECTOR STARTED");

    let domReplacements = [];

    // Hook into Live LaTeX Editor content setting
    const originalSetContent = window.liveLaTeXEditor?.setContent;
    if (originalSetContent) {
      window.liveLaTeXEditor.setContent = function (content) {
        const preAnnotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;
        const timestamp = Date.now();

        console.log(
          `📝 LIVE EDITOR setContent() called with ${preAnnotations} existing annotations`
        );

        const result = originalSetContent.call(this, content);

        // Check after content setting
        setTimeout(() => {
          const postAnnotations = document.querySelectorAll(
            'annotation[encoding="application/x-tex"]'
          ).length;

          if (preAnnotations > 0 && postAnnotations < preAnnotations) {
            const replacement = {
              timestamp,
              preAnnotations,
              postAnnotations,
              lostAnnotations: preAnnotations - postAnnotations,
              contentLength: content.length,
            };

            console.log(`🚨 LIVE EDITOR REMOVED ANNOTATIONS:`);
            console.log(`   Before: ${replacement.preAnnotations} annotations`);
            console.log(`   After: ${replacement.postAnnotations} annotations`);
            console.log(`   Lost: ${replacement.lostAnnotations} annotations`);

            domReplacements.push(replacement);
          }
        }, 100);

        return result;
      };
    }

    // Status reporter
    window.reportLiveEditorInterference = function () {
      console.log(`\n📝 LIVE EDITOR INTERFERENCE REPORT:`);
      console.log(`   DOM Replacements: ${domReplacements.length}`);

      if (domReplacements.length > 0) {
        console.log(`\n🎯 INTERFERENCE DETECTED:`);
        domReplacements.forEach((replacement, i) => {
          console.log(
            `   Event ${i + 1}: Lost ${replacement.lostAnnotations} annotations`
          );
        });
      }

      return domReplacements;
    };

    console.log("✅ Live Editor hooks installed");
  }

  /**
   * Quick Investigation Sequence
   * Runs all detectives and provides consolidated report
   */
  async function quickInvestigation(durationMs = 15000) {
    console.log("🚀 STARTING QUICK INVESTIGATION SEQUENCE");
    console.log("This will monitor for annotation removal for 15 seconds");
    console.log("Please load a random example now!");

    // Start all detectors
    annotationRemovalDetective(durationMs);
    conversionConflictDetector();
    liveEditorInterferenceDetector();

    // Wait for investigation period
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("\n📋 CONSOLIDATED INVESTIGATION REPORT:");

        const conversionReport = window.reportConversionConflicts?.() || {
          conversionCount: 0,
          conflicts: [],
        };
        const editorReport = window.reportLiveEditorInterference?.() || [];
        const annotationState = window.checkAnnotationQuality?.() || {
          percentage: 0,
        };

        const results = {
          timestamp: new Date().toISOString(),
          conversionConflicts: conversionReport.conflicts.length,
          editorInterference: editorReport.length,
          finalAnnotationPercentage: annotationState.percentage || 0,
          totalConversions: conversionReport.conversionCount,
          investigationDuration: durationMs,
        };

        console.log("📊 SUMMARY:", results);

        if (results.conversionConflicts > 0) {
          console.log(
            "🎯 LIKELY CAUSE: Multiple conversion cycles removing annotations"
          );
        } else if (results.editorInterference > 0) {
          console.log(
            "🎯 LIKELY CAUSE: Live LaTeX Editor DOM operations removing annotations"
          );
        } else if (results.finalAnnotationPercentage === 0) {
          console.log(
            "🎯 LIKELY CAUSE: Annotations injected but removed by unknown cleanup process"
          );
        } else {
          console.log(
            "✅ NO ISSUES DETECTED: Annotations appear to be working correctly"
          );
        }

        resolve(results);
      }, durationMs + 1000);
    });
  }

  /**
   * Test suite for the detective system
   */
  function testAnnotationRemovalDetective() {
    logInfo("🧪 Testing Annotation Removal Detective System...");

    const tests = {
      detectiveToolsExist: () => {
        return !!(
          annotationRemovalDetective &&
          conversionConflictDetector &&
          liveEditorInterferenceDetector
        );
      },

      conversionEngineHookable: () => {
        return !!window.ConversionEngine?.convertInput;
      },

      annotationSystemExists: () => {
        return !!(
          window.injectMathJaxAnnotations && window.checkAnnotationQuality
        );
      },

      liveEditorDetectable: () => {
        // Check if Live LaTeX Editor exists and has setContent method
        return !!window.liveLaTeXEditor?.setContent;
      },

      quickInvestigationWorks: () => {
        try {
          quickInvestigation(1000); // 1 second test
          return true;
        } catch (error) {
          logError("Quick investigation failed:", error);
          return false;
        }
      },
    };

    return TestUtilities?.runTestSuite
      ? TestUtilities.runTestSuite("Annotation Removal Detective", tests)
      : { success: Object.values(tests).every((test) => test()), tests };
  }

  // Public API
  return {
    annotationRemovalDetective,
    conversionConflictDetector,
    liveEditorInterferenceDetector,
    quickInvestigation,
    testAnnotationRemovalDetective,
  };
})();

// Export for testing framework
window.TestAnnotationRemovalDetective = TestAnnotationRemovalDetective;
window.testAnnotationRemovalDetective =
  TestAnnotationRemovalDetective.testAnnotationRemovalDetective;

// Export individual detective functions globally for console access
window.annotationRemovalDetective =
  TestAnnotationRemovalDetective.annotationRemovalDetective;
window.conversionConflictDetector =
  TestAnnotationRemovalDetective.conversionConflictDetector;
window.liveEditorInterferenceDetector =
  TestAnnotationRemovalDetective.liveEditorInterferenceDetector;
window.quickInvestigation = TestAnnotationRemovalDetective.quickInvestigation;
