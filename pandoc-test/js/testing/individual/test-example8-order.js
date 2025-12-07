// test-example8-order.js
// Persistent tests for Example 8 LaTeX expression order bug
// Tests survive browser refresh
// Enhanced with diagnostic tests to pinpoint where order scrambles

const TestExample8Order = (function () {
  "use strict";

  // Test configuration
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

  function shouldLog(level) {
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TEST-EXAMPLE8]", message, ...args);
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[TEST-EXAMPLE8]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TEST-EXAMPLE8-DEBUG]", message, ...args);
  }

  // Target expressions for Example 8
  const TARGET_LATEX = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
  ];

  // =========================================================================================
  // TEST 1: Check Live DOM Order
  // =========================================================================================

  function testLiveDOMOrder() {
    logInfo("TEST 1: Checking live DOM order...");

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      logError("❌ Output div not found");
      return { success: false, error: "No output div" };
    }

    const containers = outputDiv.querySelectorAll("mjx-container");
    const example8 = [];

    containers.forEach((container, idx) => {
      const annotation = container.querySelector(
        'annotation[encoding="application/x-tex"]'
      );
      if (annotation) {
        const latex = annotation.textContent.trim();
        if (
          latex.includes("A=B") ||
          latex.includes("f(x)=x^2") ||
          latex.includes("g(x)=x^3") ||
          latex.includes("h(x)") ||
          latex.includes("k(x)")
        ) {
          example8.push({ index: idx, latex: latex });
        }
      }
    });

    logInfo(`Found ${example8.length} Example 8 expressions in live DOM`);
    logInfo("Example 8 expressions at indices 74-78:");
    const target = example8.filter((e) => e.index >= 74 && e.index <= 78);
    target.forEach((e) => logInfo(`  Index ${e.index}: ${e.latex}`));

    const correctOrder =
      target.length === 5 &&
      target[0].latex.includes("A=B") &&
      target[1].latex.includes("f(x)=x^2") &&
      target[2].latex.includes("g(x)=x^3");

    return {
      success: correctOrder,
      data: target,
      message: correctOrder
        ? "✅ Live DOM order is CORRECT"
        : "❌ Live DOM order is WRONG",
    };
  }

  // =========================================================================================
  // TEST 2: Trace Export and Capture Result
  // =========================================================================================

  let traceInstalled = false;
  let capturedResult = null;

  function installExportTrace() {
    logInfo("TEST 2: Installing export trace...");

    if (traceInstalled) {
      logInfo("⚠️ Trace already installed");
      return { success: true, message: "Trace already active" };
    }

    // Try coordinator first (most common path)
    if (
      window.LaTeXProcessorCoordinator &&
      window.LaTeXProcessorCoordinator.process
    ) {
      const originalProcess = window.LaTeXProcessorCoordinator.process;

      window.LaTeXProcessorCoordinator.process = async function (options) {
        logInfo("🔔 LaTeXProcessorCoordinator.process() INTERCEPTED");

        const result = await originalProcess.call(this, options);

        // Coordinator returns { content, metadata }
        capturedResult = result.content || result;

        logInfo(
          `📦 Captured result: ${
            capturedResult ? capturedResult.length : 0
          } characters`
        );
        logInfo(`   Method used: ${result.metadata?.method || "unknown"}`);

        return result;
      };

      traceInstalled = true;
      logInfo("✅ Export trace installed on COORDINATOR");
      logInfo("💡 Now click 'Download HTML' to capture the export");

      return { success: true, message: "Trace installed - ready to export" };
    }

    // Fallback to legacy if coordinator not found
    if (window.LaTeXProcessorLegacy && window.LaTeXProcessorLegacy.process) {
      const originalProcess = window.LaTeXProcessorLegacy.process;

      window.LaTeXProcessorLegacy.process = async function (options) {
        logInfo("🔔 LaTeXProcessorLegacy.process() INTERCEPTED");

        const result = await originalProcess.call(this, options);
        capturedResult = result;

        logInfo(`📦 Captured result: ${result ? result.length : 0} characters`);

        return result;
      };

      traceInstalled = true;
      logInfo("✅ Export trace installed on LEGACY");
      logInfo("💡 Now click 'Download HTML' to capture the export");

      return { success: true, message: "Trace installed - ready to export" };
    }

    logError("❌ Neither coordinator nor legacy processor found");
    return { success: false, error: "No processor modules loaded" };
  }

  function analyzeExportResult() {
    logInfo("TEST 2: Analyzing captured export result...");

    if (!capturedResult) {
      logError(
        "❌ No result captured - did you export after installing trace?"
      );
      logInfo("💡 Run: installExportTrace(), then export, then try again");
      return { success: false, error: "No captured result" };
    }

    logInfo(`Analyzing ${capturedResult.length} character result...`);

    // Find Example 8 in result
    const example8Pattern =
      /<div class="example"[^>]*id="content-theorem-8"[^>]*>(.*?)<\/div>/s;
    const match = example8Pattern.exec(capturedResult);

    if (!match) {
      logError("❌ Example 8 not found in result!");
      return { success: false, error: "Example 8 not found" };
    }

    const example8HTML = match[1];
    logInfo("\n🎯 Example 8 HTML:");
    logInfo(example8HTML);

    // Extract math expressions
    const mathPattern = /<span class="math inline">\\?\(([^)]+)\)\\?<\/span>/g;
    const mathExpressions = [];
    let mathMatch;

    while ((mathMatch = mathPattern.exec(example8HTML)) !== null) {
      mathExpressions.push(mathMatch[1]);
    }

    logInfo("\n📐 Math expressions found:");
    mathExpressions.forEach((expr, idx) => logInfo(`  ${idx + 1}. ${expr}`));

    // Check if order is correct
    const expectedFirst3 = ["A=B=\\R", "f(x)=x^2", "g(x)=x^3"];
    const actualFirst3 = mathExpressions.slice(0, 3);
    const orderCorrect =
      JSON.stringify(actualFirst3) === JSON.stringify(expectedFirst3);

    logInfo(`\n${orderCorrect ? "✅" : "❌"} Order Check:`);
    logInfo(`  Expected: ${expectedFirst3.join(", ")}`);
    logInfo(`  Actual:   ${actualFirst3.join(", ")}`);

    return {
      success: orderCorrect,
      data: { example8HTML, mathExpressions, actualFirst3 },
      message: orderCorrect
        ? "✅ Export order is CORRECT!"
        : "❌ Export order is WRONG",
    };
  }

  // =========================================================================================
  // DIAGNOSTIC TEST 1: Clone Order (Before Processing)
  // =========================================================================================

  function testCloneOrder() {
    logInfo("=".repeat(60));
    logInfo("DIAGNOSTIC TEST 1: Clone Order (Before Processing)");
    logInfo("=".repeat(60));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      logError("❌ Output div not found");
      return { success: false, error: "No output div" };
    }

    // Clone exactly as latex-processor-legacy.js does
    const clone = outputDiv.cloneNode(true);
    const containers = clone.querySelectorAll("mjx-container");

    logInfo(`Found ${containers.length} containers in clone`);

    // Find Example 8 containers and their order
    const example8Data = [];
    containers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation) {
          const latex = annotation.textContent.trim();
          if (TARGET_LATEX.includes(latex)) {
            example8Data.push({
              index,
              latex,
              display: container.getAttribute("display") === "true",
            });
          }
        }
      }
    });

    logInfo("Example 8 expressions in clone (before any processing):");
    example8Data.forEach((item) => {
      logInfo(`  Index ${item.index}: ${item.latex}`);
    });

    // Check if order is correct
    const expectedOrder = ["A=B=\\R", "f(x)=x^2", "g(x)=x^3"];
    const actualOrder = example8Data.slice(0, 3).map((item) => item.latex);
    const orderCorrect =
      JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

    logInfo(`\n${orderCorrect ? "✅" : "❌"} Clone Order Check:`);
    logInfo(`  Expected: ${expectedOrder.join(", ")}`);
    logInfo(`  Actual:   ${actualOrder.join(", ")}`);

    return {
      success: orderCorrect,
      data: example8Data,
      message: orderCorrect
        ? "✅ Clone order is CORRECT"
        : "❌ Clone order is WRONG - Bug is in cloning step!",
    };
  }

  // =========================================================================================
  // DIAGNOSTIC TEST 2: Marking and Query Order
  // =========================================================================================

  function testMarkingOrder() {
    logInfo("=".repeat(60));
    logInfo("DIAGNOSTIC TEST 2: Marking and Query Order");
    logInfo("=".repeat(60));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      logError("❌ Output div not found");
      return { success: false, error: "No output div" };
    }

    const clone = outputDiv.cloneNode(true);
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(clone);
    document.body.appendChild(tempDiv);
    tempDiv.style.display = "none";

    const containers = tempDiv.querySelectorAll("mjx-container");
    const containersArray = Array.from(containers);

    logInfo(`Processing ${containersArray.length} containers`);

    const markerId = `test-mark-${Date.now()}`;
    let markerCount = 0;
    const markedData = [];

    // PASS 1: Mark containers (simulate latex-processor-legacy.js marking)
    logInfo("\n--- PASS 1: Marking Containers ---");
    containersArray.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation && annotation.textContent.trim()) {
          const latex = annotation.textContent.trim();

          if (TARGET_LATEX.includes(latex)) {
            const uniqueId = `${markerId}-${markerCount}`;
            container.setAttribute("data-replacement-id", uniqueId);
            container.setAttribute("data-test-latex", latex);

            markedData.push({
              arrayIndex: index,
              markerId: uniqueId,
              markerCount,
              latex,
            });

            logDebug(
              `  Marked #${markerCount} at array index ${index}: ${latex}`
            );
            markerCount++;
          }
        }
      }
    });

    logInfo(`\nMarked ${markerCount} Example 8 expressions`);

    // PASS 2: Query marked containers
    logInfo("\n--- PASS 2: Querying Marked Containers ---");
    const markedContainers = tempDiv.querySelectorAll(
      `[data-replacement-id^="${markerId}"]`
    );
    logInfo(`querySelectorAll found ${markedContainers.length} containers`);

    const queriedData = [];
    markedContainers.forEach((container, queryIndex) => {
      const latex = container.getAttribute("data-test-latex");
      const id = container.getAttribute("data-replacement-id");
      queriedData.push({
        queryIndex,
        markerId: id,
        latex,
      });
      logDebug(`  Query index ${queryIndex}: ${latex} (${id})`);
    });

    // Compare orders
    const markedOrder = markedData.map((d) => d.latex);
    const queriedOrder = queriedData.map((d) => d.latex);
    const orderMatch =
      JSON.stringify(markedOrder) === JSON.stringify(queriedOrder);

    logInfo(`\n${orderMatch ? "✅" : "❌"} Order Comparison:`);
    logInfo(`  Marked order:  ${markedOrder.join(", ")}`);
    logInfo(`  Queried order: ${queriedOrder.join(", ")}`);

    // Cleanup
    document.body.removeChild(tempDiv);

    return {
      success: orderMatch,
      data: { marked: markedData, queried: queriedData },
      message: orderMatch
        ? "✅ Marking and query order MATCH"
        : "❌ Query returns DIFFERENT order - Bug is in querySelectorAll!",
    };
  }

  // =========================================================================================
  // DIAGNOSTIC TEST 3: Live DOM vs DOMParser
  // =========================================================================================

  function testLiveDOMvsDOMParser() {
    logInfo("=".repeat(60));
    logInfo("DIAGNOSTIC TEST 3: Live DOM vs DOMParser");
    logInfo("=".repeat(60));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      logError("❌ Output div not found");
      return { success: false, error: "No output div" };
    }

    // Method 1: Live DOM clone
    logInfo("--- Method 1: Live DOM Clone ---");
    const liveClone = outputDiv.cloneNode(true);
    const liveContainers = liveClone.querySelectorAll("mjx-container");

    const liveExample8 = [];
    liveContainers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation) {
          const latex = annotation.textContent.trim();
          if (TARGET_LATEX.includes(latex)) {
            liveExample8.push({ index, latex });
          }
        }
      }
    });

    logInfo("Live DOM Example 8 order:");
    liveExample8.forEach((item) =>
      logInfo(`  Index ${item.index}: ${item.latex}`)
    );

    // Method 2: DOMParser
    logInfo("\n--- Method 2: DOMParser ---");
    const html = outputDiv.innerHTML;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const parsedContainers = doc.querySelectorAll("mjx-container");

    const parsedExample8 = [];
    parsedContainers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation) {
          const latex = annotation.textContent.trim();
          if (TARGET_LATEX.includes(latex)) {
            parsedExample8.push({ index, latex });
          }
        }
      }
    });

    logInfo("DOMParser Example 8 order:");
    parsedExample8.forEach((item) =>
      logInfo(`  Index ${item.index}: ${item.latex}`)
    );

    // Compare
    const orderMatch =
      JSON.stringify(liveExample8) === JSON.stringify(parsedExample8);

    logInfo(`\n${orderMatch ? "✅" : "❌"} Order Match:`);
    logInfo(
      `  Live DOM order:  ${liveExample8.map((i) => i.latex).join(", ")}`
    );
    logInfo(
      `  DOMParser order: ${parsedExample8.map((i) => i.latex).join(", ")}`
    );

    return {
      success: orderMatch,
      data: { liveExample8, parsedExample8 },
      message: orderMatch
        ? "✅ Live DOM and DOMParser produce SAME order"
        : "❌ DOMParser scrambles order - Bug is in DOMParser!",
    };
  }

  // =========================================================================================
  // DIAGNOSTIC TEST 4: innerHTML Extraction Order
  // =========================================================================================

  function testInnerHTMLOrder() {
    logInfo("=".repeat(60));
    logInfo("DIAGNOSTIC TEST 4: innerHTML Extraction Order");
    logInfo("=".repeat(60));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      logError("❌ Output div not found");
      return { success: false, error: "No output div" };
    }

    const clone = outputDiv.cloneNode(true);
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(clone);
    document.body.appendChild(tempDiv);
    tempDiv.style.display = "none";

    // Mark containers with their original position
    const containers = tempDiv.querySelectorAll("mjx-container");
    containers.forEach((container, index) => {
      container.setAttribute("data-original-index", index);
    });

    logInfo(`Marked ${containers.length} containers with original indices`);

    // Extract innerHTML
    const html = tempDiv.innerHTML;

    // Parse it back
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const extractedContainers = doc.querySelectorAll("mjx-container");

    logInfo(
      `After innerHTML extraction: ${extractedContainers.length} containers`
    );

    // Check if order preserved for Example 8
    const example8Check = [];
    extractedContainers.forEach((container, newIndex) => {
      const originalIndex = container.getAttribute("data-original-index");
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation) {
          const latex = annotation.textContent.trim();
          if (TARGET_LATEX.includes(latex)) {
            example8Check.push({
              originalIndex: parseInt(originalIndex),
              newIndex,
              latex,
              indexMatch: parseInt(originalIndex) === newIndex,
            });
          }
        }
      }
    });

    logInfo("\nExample 8 after innerHTML extraction:");
    example8Check.forEach((item) => {
      const status = item.indexMatch ? "✅" : "❌";
      logInfo(
        `  ${status} Original[${item.originalIndex}] → New[${item.newIndex}]: ${item.latex}`
      );
    });

    // Check if all indices match
    const allMatch = example8Check.every((item) => item.indexMatch);

    logInfo(
      `\n${allMatch ? "✅" : "❌"} innerHTML preserves order: ${
        allMatch ? "YES" : "NO"
      }`
    );

    document.body.removeChild(tempDiv);

    return {
      success: allMatch,
      data: example8Check,
      message: allMatch
        ? "✅ innerHTML preserves order correctly"
        : "❌ innerHTML scrambles order - Bug is in innerHTML serialisation!",
    };
  }

  // =========================================================================================
  // RUN ALL DIAGNOSTIC TESTS
  // =========================================================================================

  function runDiagnostics() {
    logInfo("\n" + "=".repeat(60));
    logInfo("RUNNING ALL DIAGNOSTIC TESTS");
    logInfo("=".repeat(60) + "\n");

    const results = {
      test1_clone: testCloneOrder(),
      test2_marking: testMarkingOrder(),
      test3_parser: testLiveDOMvsDOMParser(),
      test4_innerHTML: testInnerHTMLOrder(),
    };

    logInfo("\n" + "=".repeat(60));
    logInfo("DIAGNOSTIC SUMMARY");
    logInfo("=".repeat(60));
    logInfo(
      `Test 1 (Clone):     ${
        results.test1_clone.success ? "✅ PASS" : "❌ FAIL"
      }`
    );
    logInfo(
      `Test 2 (Marking):   ${
        results.test2_marking.success ? "✅ PASS" : "❌ FAIL"
      }`
    );
    logInfo(
      `Test 3 (Parser):    ${
        results.test3_parser.success ? "✅ PASS" : "❌ FAIL"
      }`
    );
    logInfo(
      `Test 4 (innerHTML): ${
        results.test4_innerHTML.success ? "✅ PASS" : "❌ FAIL"
      }`
    );
    logInfo("=".repeat(60));

    // Provide diagnosis
    logInfo("\n🔍 DIAGNOSIS:");
    if (!results.test1_clone.success) {
      logInfo(
        "❌ Bug is in the CLONING step - clone has wrong order from the start"
      );
    } else if (!results.test2_marking.success) {
      logInfo(
        "❌ Bug is in querySelectorAll - returns different order than marked"
      );
    } else if (!results.test3_parser.success) {
      logInfo("❌ Bug is in DOMParser - scrambles element order");
    } else if (!results.test4_innerHTML.success) {
      logInfo("❌ Bug is in innerHTML serialisation - changes element order");
    } else {
      logInfo("✅ All diagnostic tests pass - bug must be elsewhere!");
      logInfo("💡 Try running the export test to see where order breaks");
    }

    return results;
  }

  // =========================================================================================
  // TEST 3: Full Test Suite
  // =========================================================================================

  function runFullTest() {
    logInfo("=".repeat(60));
    logInfo("FULL EXAMPLE 8 ORDER TEST SUITE");
    logInfo("=".repeat(60));

    const results = {};

    // Test 1: Live DOM
    results.liveDOM = testLiveDOMOrder();
    logInfo("\n" + results.liveDOM.message);

    // Test 2: Trace status
    if (!traceInstalled) {
      logInfo("\n⚠️ Export trace not installed yet");
      logInfo("💡 Run: TestExample8Order.installExportTrace()");
      logInfo(
        "💡 Then export, then run: TestExample8Order.analyzeExportResult()"
      );
    } else if (!capturedResult) {
      logInfo("\n⚠️ Export trace installed but no export captured yet");
      logInfo("💡 Click 'Download HTML' to capture the export");
    } else {
      results.export = analyzeExportResult();
      logInfo("\n" + results.export.message);
    }

    logInfo("\n" + "=".repeat(60));
    logInfo("TEST SUMMARY:");
    logInfo(`  Live DOM: ${results.liveDOM.success ? "✅ PASS" : "❌ FAIL"}`);
    if (results.export) {
      logInfo(`  Export:   ${results.export.success ? "✅ PASS" : "❌ FAIL"}`);
    }
    logInfo("=".repeat(60));

    return results;
  }

  // =========================================================================================
  // PUBLIC API
  // =========================================================================================

  return {
    // Individual tests
    testLiveDOMOrder,
    installExportTrace,
    analyzeExportResult,

    // Diagnostic tests
    testCloneOrder,
    testMarkingOrder,
    testLiveDOMvsDOMParser,
    testInnerHTMLOrder,
    runDiagnostics,

    // Full suite
    runFullTest,

    // Status check
    getStatus: () => ({
      traceInstalled,
      resultCaptured: !!capturedResult,
      resultLength: capturedResult ? capturedResult.length : 0,
    }),

    // Reset
    reset: () => {
      traceInstalled = false;
      capturedResult = null;
      logInfo("🔄 Test state reset");
    },
  };
})();

// Make globally available
window.TestExample8Order = TestExample8Order;

// Convenience shortcuts
window.testExample8 = TestExample8Order.runFullTest;
window.traceExample8 = TestExample8Order.installExportTrace;
window.checkExample8Export = TestExample8Order.analyzeExportResult;

// New diagnostic shortcuts
window.diagExample8 = TestExample8Order.runDiagnostics;
window.testClone = TestExample8Order.testCloneOrder;
window.testMarking = TestExample8Order.testMarkingOrder;
window.testParser = TestExample8Order.testLiveDOMvsDOMParser;
window.testInnerHTML = TestExample8Order.testInnerHTMLOrder;

console.log("✅ TestExample8Order loaded with diagnostics");
console.log("Quick commands:");
console.log("  testExample8()     - Run basic tests");
console.log("  diagExample8()     - Run ALL diagnostic tests");
console.log("  testClone()        - Test clone order");
console.log("  testMarking()      - Test marking/query order");
console.log("  testParser()       - Test Live DOM vs DOMParser");
console.log("  testInnerHTML()    - Test innerHTML preservation");
