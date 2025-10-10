// test-example-annotation-timing.js
// Diagnoses annotation timing during example loading

const TestExampleAnnotationTiming = (function () {
  "use strict";

  function logInfo(message, ...args) {
    console.log("[EXAMPLE-ANNOTATION]", message, ...args);
  }

  /**
   * Monitor the complete example loading → annotation process
   */
  async function monitorExampleLoadingProcess(exampleKey = "statistics") {
    logInfo("🔍 Monitoring example loading process for:", exampleKey);

    const timeline = {
      startTime: Date.now(),
      events: [],
      finalState: null,
    };

    function addEvent(event, data = {}) {
      timeline.events.push({
        timestamp: Date.now() - timeline.startTime,
        event: event,
        ...data,
      });
    }

    // Store original functions - declare all at top level for proper scoping
    const originalLoadExample = window.ExampleSystem?.loadExample;
    const originalSetContent = window.liveLaTeXEditor?.setContent;
    const originalConvertInput = window.ConversionEngine?.convertInput;
    const originalTypeset = window.MathJax?.typesetPromise;
    const originalInject = window.injectMathJaxAnnotations;

    try {
      // Hook into example loading
      if (originalLoadExample) {
        window.ExampleSystem.loadExample = function (key) {
          addEvent("example_load_start", { key });
          const result = originalLoadExample.call(this, key);
          addEvent("example_load_complete", { key, result });
          return result;
        };
      }

      // Hook into Live LaTeX Editor if present
      if (originalSetContent) {
        window.liveLaTeXEditor.setContent = function (content) {
          addEvent("live_editor_set_content_start", {
            contentLength: content.length,
          });
          const result = originalSetContent.call(this, content);
          addEvent("live_editor_set_content_complete");
          return result;
        };
      }

      // Hook into conversion engine
      if (originalConvertInput) {
        window.ConversionEngine.convertInput = function () {
          addEvent("conversion_start");
          const result = originalConvertInput.call(this);
          addEvent("conversion_initiated");
          return result;
        };
      }

      // Hook into MathJax rendering
      if (originalTypeset) {
        window.MathJax.typesetPromise = function (...args) {
          addEvent("mathjax_typeset_start");
          return originalTypeset.apply(this, args).then((result) => {
            addEvent("mathjax_typeset_complete");
            return result;
          });
        };
      }

      // Hook into annotation injection
      if (originalInject) {
        window.injectMathJaxAnnotations = function (...args) {
          addEvent("annotation_injection_start", { args: args.length });
          const result = originalInject.apply(this, args);
          addEvent("annotation_injection_complete");
          return result;
        };
      }

      // Start the process
      addEvent("test_start");
      window.ExampleSystem.loadExample(exampleKey);

      // Monitor for completion
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;

        const mathElements = document.querySelectorAll("mjx-container").length;
        const annotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;

        addEvent("check_state", {
          attempt: attempts,
          mathElements,
          annotations,
        });

        if (mathElements > 0 && annotations > 0) {
          addEvent("success", { mathElements, annotations });
          break;
        }

        if (attempts === maxAttempts) {
          addEvent("timeout", { mathElements, annotations });
        }
      }
    } catch (error) {
      addEvent("error", { error: error.message });
    } finally {
      // Restore original functions - now all variables are properly scoped
      if (originalLoadExample) {
        window.ExampleSystem.loadExample = originalLoadExample;
      }
      if (originalSetContent) {
        window.liveLaTeXEditor.setContent = originalSetContent;
      }
      if (originalConvertInput) {
        window.ConversionEngine.convertInput = originalConvertInput;
      }
      if (originalTypeset) {
        window.MathJax.typesetPromise = originalTypeset;
      }
      if (originalInject) {
        window.injectMathJaxAnnotations = originalInject;
      }
    }

    timeline.finalState = {
      mathElements: document.querySelectorAll("mjx-container").length,
      annotations: document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length,
      totalTime: Date.now() - timeline.startTime,
    };

    return timeline;
  }

  /**
   * Test example loading with different approaches
   */
  async function testExampleLoadingMethods() {
    logInfo("🧪 Testing different example loading approaches...");

    const results = {};

    // Method 1: Standard loading
    logInfo("Testing standard loading...");
    window.ExampleSystem.loadExample("comprehensive-latex-syntax");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    results.standard = {
      mathElements: document.querySelectorAll("mjx-container").length,
      annotations: document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length,
    };

    // Clear for next test
    const input = document.getElementById("input");
    if (input) input.value = "";

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Method 2: Manual step-by-step loading
    logInfo("Testing manual step-by-step loading...");

    // Step 1: Load content without triggering conversion
    const exampleContent = window.ExampleSystem.getExample(
      "comprehensive-latex-syntax"
    );
    if (input) {
      input.value = exampleContent;
    }

    // Step 2: Wait, then trigger conversion manually
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (window.ConversionEngine) {
      window.ConversionEngine.convertInput();
    }

    // Step 3: Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 3000));

    results.manual = {
      mathElements: document.querySelectorAll("mjx-container").length,
      annotations: document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length,
    };

    return results;
  }

  /**
   * Main test function
   */
  function testExampleAnnotationTiming() {
    logInfo("🧪 Testing Example-Annotation Timing...");

    const tests = {
      exampleSystemExists: () => !!window.ExampleSystem,

      annotationSystemExists: () =>
        !!(window.injectMathJaxAnnotations && window.checkAnnotationQuality),

      canLoadExampleContent: () => {
        const content = window.ExampleSystem.getExample("statistics");
        return !!(content && content.length > 0);
      },

      exampleLoadingProcess: () =>
        monitorExampleLoadingProcess("comprehensive-latex-syntax"),

      differentLoadingMethods: () => testExampleLoadingMethods(),
    };

    return TestUtilities.runTestSuite("Example-Annotation Timing", tests);
  }

  return {
    testExampleAnnotationTiming,
    monitorExampleLoadingProcess,
    testExampleLoadingMethods,
  };
})();

window.TestExampleAnnotationTiming = TestExampleAnnotationTiming;
window.testExampleAnnotationTiming =
  TestExampleAnnotationTiming.testExampleAnnotationTiming;
