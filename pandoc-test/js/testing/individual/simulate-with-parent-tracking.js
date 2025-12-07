// simulate-with-parent-tracking.js
// Tests if parent element tracking solves the index shifting problem
// This file survives browser refresh

const SimulateWithParentTracking = (function () {
  "use strict";

  const TARGET_LATEX = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
  ];

  function log(msg, data = "") {
    console.log(`[PARENT-TRACK] ${msg}`, data);
  }

  function runSimulation() {
    console.log("=".repeat(70));
    console.log("SIMULATING WITH PARENT ELEMENT TRACKING");
    console.log("=".repeat(70));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      log("❌ Output div not found");
      return;
    }

    // STEP 1: Clone
    log("\n🔷 STEP 1: Cloning and setting up parent tracking");
    const clone = outputDiv.cloneNode(true);
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(clone);
    document.body.appendChild(tempDiv);
    tempDiv.style.display = "none";

    const containers = tempDiv.querySelectorAll("mjx-container");
    const containersArray = Array.from(containers);

    log(`Total containers: ${containersArray.length}`);

    // STEP 2: Mark Example 8 positions with parent tracking
    log("\n🔷 STEP 2: Marking Example 8 positions (74-78)");

    const example8Positions = [];
    for (let i = 74; i <= 78; i++) {
      if (i < containersArray.length) {
        const container = containersArray[i];
        const parent = container.parentElement;

        if (parent) {
          // Give parent a unique ID
          const parentId = `parent-${i}-${Date.now()}`;
          parent.setAttribute("data-parent-id", parentId);

          // Mark the container
          container.setAttribute("data-is-example8", "true");
          container.setAttribute("data-original-index", i);

          // Get LaTeX
          const mathML = container.querySelector("mjx-assistive-mml math");
          let latex = "(unknown)";
          if (mathML) {
            const annotation = mathML.querySelector(
              'annotation[encoding="application/x-tex"]'
            );
            if (annotation) {
              latex = annotation.textContent.trim();
            }
          }

          example8Positions.push({
            originalIndex: i,
            parentId,
            latex,
          });

          log(`  Marked position ${i}: ${latex} (parent: ${parentId})`);
        }
      }
    }

    // STEP 3: Mark ALL target expressions for replacement
    log("\n🔷 STEP 3: Marking ALL target expressions for replacement");
    const markerId = `replace-${Date.now()}`;
    let markerCount = 0;

    const markedInfo = [];

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
            container.setAttribute("data-latex", latex);

            markedInfo.push({
              index,
              markerId: uniqueId,
              latex,
              isExample8: index >= 74 && index <= 78,
            });

            if (index <= 30 || (index >= 70 && index <= 80)) {
              log(
                `  Marked #${markerCount} at index ${index}: ${latex}${
                  index >= 74 && index <= 78 ? " ⭐ EXAMPLE 8" : ""
                }`
              );
            }
            markerCount++;
          }
        }
      }
    });

    log(`\nTotal marked: ${markerCount} expressions`);
    const example8Marked = markedInfo.filter((m) => m.isExample8);
    log(`Example 8 marked: ${example8Marked.length} expressions`);

    // STEP 4: Replace in REVERSE order
    log("\n🔷 STEP 4: Replacing in REVERSE order");
    const marked = tempDiv.querySelectorAll(
      `[data-replacement-id^="${markerId}"]`
    );
    const markedArray = Array.from(marked).reverse();

    log(`Replacing ${markedArray.length} expressions in reverse order...`);

    markedArray.forEach((container, reverseIdx) => {
      const latex = container.getAttribute("data-latex");
      const replacement = `<span class="math inline">\\(${latex}\\)</span>`;

      if (reverseIdx < 3) {
        log(`  Reverse[${reverseIdx}]: Replacing ${latex}`);
      }

      container.outerHTML = replacement;
    });

    log("✅ Replacement complete");

    // STEP 5: Check Example 8 using parent tracking
    log("\n🔷 STEP 5: Checking Example 8 using PARENT TRACKING");

    const results = [];

    example8Positions.forEach((pos) => {
      // Find by parent ID
      const parent = tempDiv.querySelector(
        `[data-parent-id="${pos.parentId}"]`
      );

      let currentLatex = "(not found)";
      let found = false;

      if (parent) {
        // Look for math element in this parent
        const mathElement = parent.querySelector(
          "span.math, mjx-container, .math"
        );

        if (mathElement) {
          found = true;

          // Try to extract LaTeX
          if (mathElement.classList.contains("math")) {
            const text = mathElement.textContent || mathElement.innerHTML;

            // DEBUG: Log what we're extracting from
            if (pos.originalIndex >= 74 && pos.originalIndex <= 78) {
              log(
                `    [DEBUG] Position ${
                  pos.originalIndex
                } text content: "${text.substring(0, 50)}"`
              );
            }

            // FIXED: Better extraction that handles parentheses in LaTeX
            // Format is: \(latex\) or \[latex\]
            // Need to match everything between delimiters, including parentheses

            // Try inline format: \(...\)
            let match = text.match(/\\\((.+?)\\\)/s);
            if (match) {
              currentLatex = match[1];
            } else {
              // Try display format: \[...\]
              match = text.match(/\\\[(.+?)\\\]/s);
              if (match) {
                currentLatex = match[1];
              } else {
                // Fallback: just strip common delimiters
                currentLatex = text
                  .replace(/^\\\(/, "")
                  .replace(/\\\)$/, "")
                  .trim();
              }
            }

            // DEBUG: Log what we extracted
            if (pos.originalIndex >= 74 && pos.originalIndex <= 78) {
              log(
                `    [DEBUG] Position ${pos.originalIndex} extracted: "${currentLatex}"`
              );
            }
          } else {
            // Try mjx-container
            const mathML = mathElement.querySelector("mjx-assistive-mml math");
            if (mathML) {
              const annotation = mathML.querySelector(
                'annotation[encoding="application/x-tex"]'
              );
              if (annotation) {
                currentLatex = annotation.textContent.trim();
              }
            }
          }
        }
      }

      const match = pos.latex === currentLatex;
      results.push({
        originalIndex: pos.originalIndex,
        originalLatex: pos.latex,
        currentLatex,
        found,
        match,
      });

      const status = match ? "✅" : "❌";
      log(
        `  ${status} Position ${pos.originalIndex}: "${currentLatex}" (was: "${pos.latex}")`
      );
    });

    // Cleanup
    document.body.removeChild(tempDiv);

    // SUMMARY
    console.log("\n" + "=".repeat(70));
    console.log("📊 RESULTS SUMMARY");
    console.log("=".repeat(70));

    const allCorrect = results.every((r) => r.match);
    const allFound = results.every((r) => r.found);

    log(`All positions found: ${allFound ? "✅ YES" : "❌ NO"}`);
    log(`All LaTeX correct: ${allCorrect ? "✅ YES" : "❌ NO"}`);

    if (allCorrect) {
      log("\n🎉 SUCCESS! Parent tracking works!");
      log("💡 This approach solves the index shifting problem");
      log("💡 We can now implement this in latex-processor-legacy.js");
    } else {
      log("\n❌ Parent tracking didn't solve it");
      log("💡 Need to investigate further");

      // Show what went wrong
      const wrong = results.filter((r) => !r.match);
      if (wrong.length > 0) {
        log("\n🔍 Wrong results:");
        wrong.forEach((w) => {
          log(
            `  Position ${w.originalIndex}: got "${w.currentLatex}", expected "${w.originalLatex}"`
          );
        });
      }
    }

    console.log("=".repeat(70));

    return { results, allCorrect, allFound };
  }

  return {
    runSimulation,
  };
})();

// Make globally available
window.SimulateWithParentTracking = SimulateWithParentTracking;
window.testParentTracking = SimulateWithParentTracking.runSimulation;

console.log("✅ SimulateWithParentTracking loaded");
console.log("Run: testParentTracking()");
console.log("This tests if parent element tracking solves the problem");
