// find-all-occurrences.js
// Finds ALL occurrences of Example 8 expressions in the document
// This will show if TikZ or other sections have duplicate expressions

const FindAllOccurrences = (function () {
  "use strict";

  const TARGET_LATEX = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
    "x", // Simple x
    "f(x)", // Simple f(x)
    "A", // Simple A
    "B", // Simple B
  ];

  function log(msg, data = "") {
    console.log(`[FIND-ALL] ${msg}`, data);
  }

  function findAllOccurrences() {
    console.log("=".repeat(60));
    console.log("FINDING ALL OCCURRENCES OF EXAMPLE 8 EXPRESSIONS");
    console.log("=".repeat(60));

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      log("❌ Output div not found");
      return;
    }

    const containers = outputDiv.querySelectorAll("mjx-container");
    log(`\nTotal containers in document: ${containers.length}`);

    // Find all occurrences of each target expression
    const occurrences = {};

    TARGET_LATEX.forEach((target) => {
      occurrences[target] = [];
    });

    containers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (annotation) {
          const latex = annotation.textContent.trim();

          TARGET_LATEX.forEach((target) => {
            if (latex === target) {
              // Get context: what's the parent structure?
              let context = "unknown";
              let parentEl = container.parentElement;

              // Climb up to find context
              for (let i = 0; i < 5 && parentEl; i++) {
                if (parentEl.classList) {
                  if (parentEl.classList.contains("definition")) {
                    context = "Definition";
                    break;
                  }
                  if (parentEl.classList.contains("example")) {
                    context = "Example";
                    break;
                  }
                  if (parentEl.classList.contains("theorem")) {
                    context = "Theorem";
                    break;
                  }
                  if (parentEl.tagName === "FIGURE") {
                    context = "Figure/TikZ";
                    break;
                  }
                }
                parentEl = parentEl.parentElement;
              }

              // Get some surrounding text for context
              let textBefore = "";
              let textAfter = "";
              const parent = container.parentElement;
              if (parent) {
                const text = parent.textContent || "";
                const containerText =
                  container.textContent || container.getAttribute("aria-label") || "";
                const pos = text.indexOf(containerText);
                if (pos !== -1) {
                  textBefore = text.substring(Math.max(0, pos - 30), pos);
                  textAfter = text.substring(
                    pos + containerText.length,
                    Math.min(text.length, pos + containerText.length + 30)
                  );
                }
              }

              occurrences[target].push({
                index,
                context,
                textBefore: textBefore.trim(),
                textAfter: textAfter.trim(),
              });
            }
          });
        }
      }
    });

    // Report findings
    log("\n" + "=".repeat(60));
    log("OCCURRENCES REPORT");
    log("=".repeat(60));

    TARGET_LATEX.forEach((target) => {
      const count = occurrences[target].length;
      if (count > 0) {
        log(`\n"${target}": ${count} occurrence(s)`);

        occurrences[target].forEach((occ, i) => {
          log(
            `  [${i + 1}] Index ${occ.index} in ${occ.context}`
          );
          if (occ.textBefore || occ.textAfter) {
            log(`      Context: ...${occ.textBefore} [MATH] ${occ.textAfter}...`);
          }
        });

        // Highlight Example 8 occurrences
        const example8Occs = occurrences[target].filter(
          (occ) => occ.context === "Example" && occ.index >= 70 && occ.index <= 80
        );
        if (example8Occs.length > 0) {
          log(`  ⭐ Example 8 occurrence(s):`);
          example8Occs.forEach((occ) => {
            log(`     Index ${occ.index}`);
          });
        }
      }
    });

    // Check for duplicates that might cause scrambling
    log("\n" + "=".repeat(60));
    log("DUPLICATE ANALYSIS");
    log("=".repeat(60));

    const problematicExpressions = [];

    TARGET_LATEX.forEach((target) => {
      if (occurrences[target].length > 1) {
        // Check if any are in TikZ/Figure
        const tikzOccs = occurrences[target].filter(
          (occ) => occ.context === "Figure/TikZ"
        );
        const exampleOccs = occurrences[target].filter(
          (occ) => occ.context === "Example"
        );

        if (tikzOccs.length > 0 && exampleOccs.length > 0) {
          problematicExpressions.push({
            expression: target,
            tikzCount: tikzOccs.length,
            exampleCount: exampleOccs.length,
            tikzIndices: tikzOccs.map((o) => o.index),
            exampleIndices: exampleOccs.map((o) => o.index),
          });
        }
      }
    });

    if (problematicExpressions.length > 0) {
      log("\n🚨 FOUND PROBLEMATIC DUPLICATES:");
      problematicExpressions.forEach((prob) => {
        log(`\n"${prob.expression}":`);
        log(`  - ${prob.tikzCount} in TikZ at indices: ${prob.tikzIndices.join(", ")}`);
        log(`  - ${prob.exampleCount} in Example 8 at indices: ${prob.exampleIndices.join(", ")}`);
        log(`  💡 Replacing TikZ first would shift Example 8 indices!`);
      });
    } else {
      log("\n✅ No problematic duplicates found between TikZ and Example 8");
    }

    // Check indices 74-78 specifically
    log("\n" + "=".repeat(60));
    log("INDICES 74-78 ANALYSIS");
    log("=".repeat(60));

    for (let i = 74; i <= 78; i++) {
      if (i < containers.length) {
        const container = containers[i];
        const mathML = container.querySelector("mjx-assistive-mml math");
        if (mathML) {
          const annotation = mathML.querySelector(
            'annotation[encoding="application/x-tex"]'
          );
          if (annotation) {
            const latex = annotation.textContent.trim();

            // Find this in our occurrences
            let occList = occurrences[latex] || [];
            const thisOcc = occList.find((o) => o.index === i);

            if (thisOcc) {
              log(`Index ${i}: "${latex}" in ${thisOcc.context}`);
            } else {
              log(`Index ${i}: "${latex}" (context unknown)`);
            }
          }
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("ANALYSIS COMPLETE");
    console.log("=".repeat(60));

    return occurrences;
  }

  return {
    findAllOccurrences,
  };
})();

// Make globally available
window.FindAllOccurrences = FindAllOccurrences;
window.findOccurrences = FindAllOccurrences.findAllOccurrences;

console.log("✅ FindAllOccurrences loaded");
console.log("Run: findOccurrences()");
console.log("This will show ALL occurrences of Example 8 expressions");
console.log("and identify if TikZ is causing duplicates");
