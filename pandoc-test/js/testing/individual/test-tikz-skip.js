// Test to verify TikZ math is being properly skipped during export

const TestTikzSkip = (function () {
  "use strict";

  function testTikzSkip() {
    console.log("\n=== Testing TikZ Skip Condition ===\n");

    // Get the output div
    const output = document.getElementById("output");
    if (!output) {
      console.error("❌ No output div found");
      return;
    }

    // Find all mjx-container elements
    const allContainers = output.querySelectorAll("mjx-container");
    console.log(`Found ${allContainers.length} total mjx-container elements`);

    // Check which ones are inside figures
    let insideFigure = 0;
    let outsideFigure = 0;
    const figureContainers = [];

    allContainers.forEach((container, index) => {
      const inFigure = container.closest("figure");
      const inTikz = container.closest(".tikzpicture");

      if (inFigure || inTikz) {
        insideFigure++;
        const latex = extractLatex(container);
        figureContainers.push({
          index,
          latex,
          inFigure: !!inFigure,
          inTikz: !!inTikz,
        });
        console.log(
          `📊 Index ${index}: "${latex}" - Inside ${inFigure ? "figure" : ""}${inTikz ? " tikzpicture" : ""}`
        );
      } else {
        outsideFigure++;
      }
    });

    console.log(`\n✅ Inside figure/tikz: ${insideFigure}`);
    console.log(`✅ Outside figure/tikz: ${outsideFigure}`);

    // Now check Example 8 specifically
    console.log("\n=== Example 8 Area ===\n");
    const example8 = document.querySelector(".example#content-theorem-8");
    if (example8) {
      const example8Containers = example8.querySelectorAll("mjx-container");
      console.log(`Example 8 has ${example8Containers.length} containers`);

      example8Containers.forEach((container, i) => {
        const latex = extractLatex(container);
        const globalIndex = Array.from(allContainers).indexOf(container);
        console.log(`  [${i}] Global index ${globalIndex}: "${latex}"`);
      });
    } else {
      console.error("❌ Example 8 not found");
    }

    // Check for duplicates
    console.log("\n=== Checking for Duplicates ===\n");
    const latexMap = new Map();

    allContainers.forEach((container, index) => {
      const latex = extractLatex(container);
      if (!latexMap.has(latex)) {
        latexMap.set(latex, []);
      }
      latexMap.get(latex).push({
        index,
        inFigure: !!container.closest("figure"),
        inTikz: !!container.closest(".tikzpicture"),
        inExample8: !!container.closest(".example#content-theorem-8"),
      });
    });

    // Show duplicates
    latexMap.forEach((locations, latex) => {
      if (locations.length > 1) {
        console.log(`\n"${latex}" appears ${locations.length} times:`);
        locations.forEach((loc) => {
          const context = [];
          if (loc.inFigure) context.push("figure");
          if (loc.inTikz) context.push("tikz");
          if (loc.inExample8) context.push("Example 8");
          console.log(
            `  Index ${loc.index}: ${context.length > 0 ? context.join(", ") : "main text"}`
          );
        });
      }
    });

    return {
      total: allContainers.length,
      insideFigure,
      outsideFigure,
      figureContainers,
      duplicates: Array.from(latexMap.entries()).filter(
        ([latex, locs]) => locs.length > 1
      ),
    };
  }

  function extractLatex(container) {
    const mathML = container.querySelector("mjx-assistive-mml math");
    if (!mathML) return "no-mathml";

    const annotation = mathML.querySelector('annotation[encoding="application/x-tex"]');
    if (!annotation) return "no-annotation";

    return annotation.textContent.trim();
  }

  // Test the skip condition in the actual code
  function testSkipCondition() {
    console.log("\n=== Testing Skip Condition Logic ===\n");

    const output = document.getElementById("output");
    if (!output) {
      console.error("❌ No output div found");
      return;
    }

    const allContainers = output.querySelectorAll("mjx-container");
    let wouldBeSkipped = 0;
    let wouldBeProcessed = 0;

    allContainers.forEach((container, index) => {
      // This is the EXACT condition from the code
      if (container.closest("figure, .tikzpicture")) {
        wouldBeSkipped++;
        const latex = extractLatex(container);
        console.log(`⏭️ Would skip index ${index}: "${latex}"`);
      } else {
        wouldBeProcessed++;
      }
    });

    console.log(`\n✅ Would skip: ${wouldBeSkipped}`);
    console.log(`✅ Would process: ${wouldBeProcessed}`);

    return { wouldBeSkipped, wouldBeProcessed };
  }

  return {
    testTikzSkip,
    testSkipCondition,
  };
})();

// Make available in console
window.testTikzSkip = TestTikzSkip.testTikzSkip;
window.testSkipCondition = TestTikzSkip.testSkipCondition;

console.log("✅ TikZ skip diagnostics loaded");
console.log("Run: testTikzSkip() or testSkipCondition()");
