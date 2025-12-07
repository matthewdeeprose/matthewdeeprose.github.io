// VALIDATION TEST: Check if Example 8 at indices 74-78 is correct in clone
// Paste this in console after loading the page

function validateCloneIndices74to78() {
  console.log("=".repeat(60));
  console.log("VALIDATION: Checking indices 74-78 specifically in clone");
  console.log("=".repeat(60));

  const outputDiv = document.getElementById("output");
  if (!outputDiv) {
    console.error("❌ Output div not found");
    return;
  }

  // Clone exactly as latex-processor-legacy.js does
  const clone = outputDiv.cloneNode(true);
  const containers = clone.querySelectorAll("mjx-container");

  console.log(`Total containers in clone: ${containers.length}`);
  console.log("\nExpressions at indices 74-78:");

  const indices74to78 = [];
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
          indices74to78.push({ index: i, latex });
          console.log(`  Index ${i}: ${latex}`);
        } else {
          console.log(`  Index ${i}: NO ANNOTATION`);
        }
      } else {
        console.log(`  Index ${i}: NO MATHML`);
      }
    }
  }

  // Check expected order
  const expected = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
  ];

  const actual = indices74to78.map((item) => item.latex);

  console.log("\n" + "=".repeat(60));
  console.log("ORDER CHECK:");
  console.log("Expected:", expected);
  console.log("Actual:  ", actual);

  const orderMatch = JSON.stringify(actual) === JSON.stringify(expected);

  if (orderMatch) {
    console.log("\n✅ CLONE IS CORRECT - Indices 74-78 have RIGHT order!");
    console.log("💡 This means Test 1 was checking wrong indices");
    console.log("💡 Bug must be AFTER cloning, during processing");
  } else {
    console.log("\n❌ CLONE IS WRONG - Indices 74-78 have WRONG order!");
    console.log("💡 Bug is in the cloning step itself");
  }

  console.log("=".repeat(60));

  return { indices74to78, expected, actual, orderMatch };
}

// Also check the LIVE DOM at indices 74-78
function validateLiveDOMIndices74to78() {
  console.log("=".repeat(60));
  console.log("VALIDATION: Checking indices 74-78 in LIVE DOM");
  console.log("=".repeat(60));

  const outputDiv = document.getElementById("output");
  if (!outputDiv) {
    console.error("❌ Output div not found");
    return;
  }

  const containers = outputDiv.querySelectorAll("mjx-container");

  console.log(`Total containers in live DOM: ${containers.length}`);
  console.log("\nExpressions at indices 74-78:");

  const indices74to78 = [];
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
          indices74to78.push({ index: i, latex });
          console.log(`  Index ${i}: ${latex}`);
        }
      }
    }
  }

  const expected = [
    "A=B=\\R",
    "f(x)=x^2",
    "g(x)=x^3",
    "h(x) = x^2 + x^3",
    "k(x)=0",
  ];

  const actual = indices74to78.map((item) => item.latex);

  console.log("\n" + "=".repeat(60));
  console.log("ORDER CHECK:");
  console.log("Expected:", expected);
  console.log("Actual:  ", actual);

  const orderMatch = JSON.stringify(actual) === JSON.stringify(expected);

  console.log(
    orderMatch ? "\n✅ LIVE DOM is CORRECT" : "\n❌ LIVE DOM is WRONG"
  );
  console.log("=".repeat(60));

  return { indices74to78, expected, actual, orderMatch };
}

// Run both validations
function validateBoth() {
  console.log("\n\n" + "=".repeat(60));
  console.log("RUNNING BOTH VALIDATIONS");
  console.log("=".repeat(60) + "\n");

  const liveResult = validateLiveDOMIndices74to78();
  console.log("\n");
  const cloneResult = validateCloneIndices74to78();

  console.log("\n\n" + "=".repeat(60));
  console.log("VALIDATION SUMMARY:");
  console.log("=".repeat(60));
  console.log(
    `Live DOM (indices 74-78):  ${
      liveResult.orderMatch ? "✅ CORRECT" : "❌ WRONG"
    }`
  );
  console.log(
    `Clone (indices 74-78):     ${
      cloneResult.orderMatch ? "✅ CORRECT" : "❌ WRONG"
    }`
  );
  console.log("=".repeat(60));

  if (liveResult.orderMatch && cloneResult.orderMatch) {
    console.log("\n🎯 CRITICAL FINDING:");
    console.log(
      "✅ Both live DOM and clone have CORRECT order at indices 74-78"
    );
    console.log(
      "💡 This means bug happens DURING PROCESSING, not during cloning"
    );
    console.log("💡 Need to trace convertMathJaxToLatex() step by step");
  } else if (liveResult.orderMatch && !cloneResult.orderMatch) {
    console.log("\n🎯 CRITICAL FINDING:");
    console.log("❌ Clone has WRONG order but live DOM is correct");
    console.log("💡 Bug is in the CLONING operation itself");
  } else if (!liveResult.orderMatch) {
    console.log("\n🎯 CRITICAL FINDING:");
    console.log("❌ Live DOM already has wrong order!");
    console.log("💡 Bug is BEFORE export, in the rendering phase");
  }

  return { liveResult, cloneResult };
}

// Make available globally
window.validateClone = validateCloneIndices74to78;
window.validateLiveDOM = validateLiveDOMIndices74to78;
window.validateBoth = validateBoth;

console.log("✅ Validation tests loaded");
console.log("Run: validateBoth()");
console.log("Or individually:");
console.log("  validateLiveDOM() - Check live DOM at indices 74-78");
console.log("  validateClone()   - Check clone at indices 74-78");
