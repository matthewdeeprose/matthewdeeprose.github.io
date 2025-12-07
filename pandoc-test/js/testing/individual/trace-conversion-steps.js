// trace-conversion-steps.js
// Traces convertMathJaxToLatex step-by-step to find where order scrambles
// This file survives browser refresh

const TraceConversionSteps = (function () {
  "use strict";

  const TARGET_LATEX = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
  ];

  let interceptInstalled = false;
  let traceLog = [];

  function log(phase, data) {
    const entry = { phase, timestamp: Date.now(), data };
    traceLog.push(entry);
    console.log(`[TRACE:${phase}]`, data);
  }

  // Check Example 8 order in a given DOM/document
  function checkExample8Order(containers, label) {
    const example8 = [];

    containers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation) {
          const latex = annotation.textContent.trim();
          if (TARGET_LATEX.includes(latex)) {
            example8.push({ index, latex });
          }
        }
      }
    });

    log(label, {
      totalContainers: containers.length,
      example8Count: example8.length,
      indices74to78: example8
        .filter((e) => e.index >= 74 && e.index <= 78)
        .map((e) => `${e.index}:${e.latex}`),
    });

    return example8;
  }

  // Install intercept on convertMathJaxToLatex
  function installIntercept() {
    console.log("=".repeat(60));
    console.log("INSTALLING STEP-BY-STEP TRACER");
    console.log("=".repeat(60));

    if (interceptInstalled) {
      console.log("⚠️ Intercept already installed");
      return;
    }

    if (
      !window.LaTeXProcessorLegacy ||
      !window.LaTeXProcessorLegacy.convertMathJaxToLatex
    ) {
      console.error("❌ LaTeXProcessorLegacy not found");
      return { success: false, error: "Module not loaded" };
    }

    // Save original function
    const originalConvert = window.LaTeXProcessorLegacy.convertMathJaxToLatex;

    // Replace with traced version
    window.LaTeXProcessorLegacy.convertMathJaxToLatex = function (
      content,
      useLiveDOM = false
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("🔍 TRACING convertMathJaxToLatex() EXECUTION");
      console.log("=".repeat(60));

      traceLog = []; // Reset log

      log("START", {
        contentLength: content ? content.length : 0,
        useLiveDOM,
      });

      // CHECKPOINT 1: After clone
      if (useLiveDOM && document.getElementById("output")) {
        const outputDiv = document.getElementById("output");
        const clone = outputDiv.cloneNode(true);
        const containers = clone.querySelectorAll("mjx-container");

        checkExample8Order(Array.from(containers), "CHECKPOINT_1_AFTER_CLONE");
      }

      // Call original function
      const result = originalConvert.call(this, content, useLiveDOM);

      log("COMPLETE", { resultLength: result ? result.length : 0 });

      // CHECKPOINT 2: Check result HTML
      const parser = new DOMParser();
      const resultDoc = parser.parseFromString(result, "text/html");
      const resultContainers = resultDoc.querySelectorAll(
        "mjx-container, span.math"
      );

      checkExample8Order(
        Array.from(resultContainers),
        "CHECKPOINT_2_RESULT_HTML"
      );

      // Check specifically Example 8 in result
      const example8Pattern =
        /<div class="example"[^>]*id="content-theorem-8"[^>]*>(.*?)<\/div>/s;
      const match = example8Pattern.exec(result);

      if (match) {
        const example8HTML = match[1];
        const mathPattern =
          /<span class="math inline">\\?\(([^)]+)\)\\?<\/span>/g;
        const mathExpressions = [];
        let mathMatch;

        while ((mathMatch = mathPattern.exec(example8HTML)) !== null) {
          mathExpressions.push(mathMatch[1]);
        }

        log("EXAMPLE_8_IN_RESULT", {
          expressionsFound: mathExpressions.length,
          expressions: mathExpressions,
        });
      }

      console.log("\n" + "=".repeat(60));
      console.log("📊 TRACE SUMMARY");
      console.log("=".repeat(60));
      traceLog.forEach((entry) => {
        console.log(`${entry.phase}:`, entry.data);
      });
      console.log("=".repeat(60));

      return result;
    };

    interceptInstalled = true;
    console.log("✅ Intercept installed on convertMathJaxToLatex");
    console.log("💡 Now export a document to see step-by-step trace");

    return { success: true };
  }

  // More granular intercept - patch the actual replacement loop
  function installDetailedIntercept() {
    console.log("=".repeat(60));
    console.log("INSTALLING DETAILED REPLACEMENT TRACER");
    console.log("=".repeat(60));

    // This is more complex - we need to monkey-patch querySelectorAll
    // to track what happens during the replacement phase

    console.log(
      "💡 This will require modifying latex-processor-legacy.js directly"
    );
    console.log("💡 Add console.log statements in the replacement loops");
    console.log("💡 Suggested locations:");
    console.log("   - Line 334: Before markedContainers.forEach");
    console.log("   - Line 337: Inside forEach, before outerHTML =");
    console.log("   - Line 338: After outerHTML =");

    return {
      success: false,
      message: "Requires code modification for detailed trace",
    };
  }

  // Get trace log
  function getLog() {
    return traceLog;
  }

  // Reset
  function reset() {
    traceLog = [];
    console.log("🔄 Trace log cleared");
  }

  return {
    installIntercept,
    installDetailedIntercept,
    getLog,
    reset,
  };
})();

// Make globally available
window.TraceConversionSteps = TraceConversionSteps;
window.traceConversion = TraceConversionSteps.installIntercept;

console.log("✅ TraceConversionSteps loaded");
console.log("Commands:");
console.log("  traceConversion()  - Install step-by-step tracer");
console.log("  Then export document to see trace");
