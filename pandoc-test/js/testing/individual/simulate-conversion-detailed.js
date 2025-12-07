// simulate-conversion-detailed.js
// Manually simulates the exact conversion process with detailed logging
// This file survives browser refresh

const SimulateConversionDetailed = (function () {
  "use strict";

  const TARGET_LATEX = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
  ];

  function log(msg, data = "") {
    console.log(`[SIMULATE] ${msg}`, data);
  }

  // Check specific indices in containers
  // Handles BOTH mjx-container and span.math formats
  function checkIndices74to78(containers, label) {
    log(`\n--- ${label} ---`);
    for (let i = 74; i <= 78; i++) {
      if (i < containers.length) {
        const container = containers[i];
        let latex = null;

        // Method 1: Check if it's an mjx-container with annotation
        const mathML = container.querySelector("mjx-assistive-mml math");
        if (mathML) {
          const annotation = mathML.querySelector(
            'annotation[encoding="application/x-tex"]'
          );
          if (annotation) {
            latex = annotation.textContent.trim();
          }
        }

        // Method 2: Check if it's a span.math with inline LaTeX
        if (
          !latex &&
          container.classList &&
          container.classList.contains("math")
        ) {
          // Extract LaTeX from \(...\) or \[...\] format
          const text = container.textContent || container.innerHTML;
          const inlineMatch = text.match(/\\?\(([^)]+)\)\\?/);
          const displayMatch = text.match(/\\?\[([^\]]+)\]\\?/);
          if (inlineMatch) {
            latex = inlineMatch[1];
          } else if (displayMatch) {
            latex = displayMatch[1];
          }
        }

        if (latex) {
          log(`  Index ${i}: ${latex}`);
        } else {
          log(`  Index ${i}: (no LaTeX found)`);
        }
      }
    }
  }

  // Main simulation function
  function runSimulation() {
    console.log("=".repeat(60));
    console.log("SIMULATING CONVERSION WITH DETAILED LOGGING");
    console.log("=".repeat(60));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      log("❌ Output div not found");
      return;
    }

    // STEP 1: Clone (as latex-processor-legacy.js does)
    log("\n🔷 STEP 1: Cloning output div");
    const clone = outputDiv.cloneNode(true);
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(clone);
    document.body.appendChild(tempDiv);
    tempDiv.style.display = "none";

    const containers = tempDiv.querySelectorAll("mjx-container");
    const containersArray = Array.from(containers);

    log(`Total containers: ${containersArray.length}`);
    checkIndices74to78(containersArray, "AFTER CLONE");

    // STEP 2: Mark containers (PASS 1)
    log("\n🔷 STEP 2: Marking containers (PASS 1)");
    const markerId = `sim-mark-${Date.now()}`;
    let markerCount = 0;

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
            container.setAttribute("data-sim-latex", latex);
            container.setAttribute("data-sim-marker-count", markerCount);

            log(
              `  Marked #${markerCount} at index ${index}: ${latex.substring(
                0,
                30
              )}`
            );
            markerCount++;
          }
        }
      }
    });

    log(`\nMarked ${markerCount} containers`);

    // STEP 2.5: Check marked containers in document order
    log("\n🔷 STEP 2.5: Verifying marked containers still in order");
    checkIndices74to78(containersArray, "AFTER MARKING");

    // STEP 3: Query marked containers
    log("\n🔷 STEP 3: Querying marked containers");
    const markedContainers = tempDiv.querySelectorAll(
      `[data-replacement-id^="${markerId}"]`
    );

    log(`querySelectorAll found ${markedContainers.length} marked containers`);

    const markedArray = Array.from(markedContainers);
    log("\nMarked containers in query order:");
    markedArray.forEach((container, queryIndex) => {
      const latex = container.getAttribute("data-sim-latex");
      const markerCount = container.getAttribute("data-sim-marker-count");
      log(`  Query[${queryIndex}] = Marker#${markerCount}: ${latex}`);
    });

    // STEP 4: Replace in FORWARD order (original buggy approach)
    log("\n🔷 STEP 4A: Testing FORWARD replacement (should break)");
    const testTempDiv1 = tempDiv.cloneNode(true);
    document.body.appendChild(testTempDiv1);
    testTempDiv1.style.display = "none";

    const testMarked1 = testTempDiv1.querySelectorAll(
      `[data-replacement-id^="${markerId}"]`
    );

    log("Replacing in FORWARD order...");
    testMarked1.forEach((container, idx) => {
      const latex = container.getAttribute("data-sim-latex");
      const replacement = `<span class="math inline">\\(${latex}\\)</span>`;

      if (idx === 0 || idx === 1 || idx === 2) {
        log(`  Forward[${idx}]: Replacing ${latex}`);
      }

      container.outerHTML = replacement;
    });

    const testContainers1 = testTempDiv1.querySelectorAll(
      "mjx-container, span.math"
    );
    checkIndices74to78(
      Array.from(testContainers1),
      "AFTER FORWARD REPLACEMENT"
    );

    // Save HTML before cleanup
    const forwardHTML = testTempDiv1.innerHTML;
    document.body.removeChild(testTempDiv1);

    // STEP 5: Replace in REVERSE order (fixed approach)
    log("\n🔷 STEP 4B: Testing REVERSE replacement (should work)");
    const testTempDiv2 = tempDiv.cloneNode(true);
    document.body.appendChild(testTempDiv2);
    testTempDiv2.style.display = "none";

    const testMarked2 = testTempDiv2.querySelectorAll(
      `[data-replacement-id^="${markerId}"]`
    );
    const testMarked2Array = Array.from(testMarked2).reverse();

    log("Replacing in REVERSE order...");
    testMarked2Array.forEach((container, idx) => {
      const latex = container.getAttribute("data-sim-latex");
      const replacement = `<span class="math inline">\\(${latex}\\)</span>`;

      if (idx === 0 || idx === 1 || idx === 2) {
        log(`  Reverse[${idx}]: Replacing ${latex}`);
      }

      container.outerHTML = replacement;
    });

    const testContainers2 = testTempDiv2.querySelectorAll(
      "mjx-container, span.math"
    );
    checkIndices74to78(
      Array.from(testContainers2),
      "AFTER REVERSE REPLACEMENT"
    );

    // Save HTML before cleanup
    const reverseHTML = testTempDiv2.innerHTML;
    document.body.removeChild(testTempDiv2);

    // STEP 6: Compare final results
    log("\n🔷 STEP 5: Comparing Forward vs Reverse Results");

    // Check forward result
    const forwardDoc = new DOMParser().parseFromString(
      forwardHTML,
      "text/html"
    );
    const forwardContainers = forwardDoc.querySelectorAll(
      "mjx-container, span.math"
    );
    checkIndices74to78(Array.from(forwardContainers), "FORWARD FINAL HTML");

    // Check reverse result
    const reverseDoc = new DOMParser().parseFromString(
      reverseHTML,
      "text/html"
    );
    const reverseContainers = reverseDoc.querySelectorAll(
      "mjx-container, span.math"
    );
    checkIndices74to78(Array.from(reverseContainers), "REVERSE FINAL HTML");

    // Also check the untouched original
    log("\n🔷 STEP 6: Checking Original (Untouched)");
    const originalContainers = tempDiv.querySelectorAll("mjx-container");
    checkIndices74to78(
      Array.from(originalContainers),
      "ORIGINAL (NO REPLACEMENT)"
    );

    // Cleanup
    document.body.removeChild(tempDiv);

    console.log("\n" + "=".repeat(60));
    console.log("SIMULATION COMPLETE");
    console.log("=".repeat(60));
    console.log("Review the logs above to see where order changes");

    return { success: true };
  }

  return {
    runSimulation,
  };
})();

// Make globally available
window.SimulateConversionDetailed = SimulateConversionDetailed;
window.simulateConversion = SimulateConversionDetailed.runSimulation;

console.log("✅ SimulateConversionDetailed loaded");
console.log("Run: simulateConversion()");
console.log("This will show EXACTLY where order breaks during replacement");
