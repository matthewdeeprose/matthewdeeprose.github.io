/**
 * CHUNKED ANCHOR DIAGNOSTIC TEST
 *
 * This test analyzes the anchor generation problem identified in Phase 2 testing:
 * - Expected: 324 anchors (162 labels × 2)
 * - Actual: 239 anchors
 * - 85 labels with only 1 anchor (should have 2)
 * - 13 labels with 4+ anchors (appearing in multiple chunks)
 */

function runChunkedAnchorDiagnostic() {
  console.log("═".repeat(80));
  console.log("🔬 CHUNKED ANCHOR GENERATION DIAGNOSTIC");
  console.log("═".repeat(80));

  const output = document.getElementById("output");
  if (!output) {
    console.error("❌ Output element not found");
    return;
  }

  // 1. ANCHOR INVENTORY
  console.log("\n📊 ANCHOR INVENTORY:");
  const allAnchors = Array.from(output.querySelectorAll('[id^="content-"]'));
  const hyptertargetAnchors = allAnchors.filter((el) => {
    // Hypertarget anchors are typically SPANs with specific attributes
    return (
      el.tagName === "SPAN" &&
      !el.hasAttribute("data-original-label") &&
      el.innerHTML === ""
    );
  });
  const fixerAnchors = allAnchors.filter((el) => {
    // Fixer anchors have data-original-label attribute
    return el.hasAttribute("data-original-label");
  });

  console.log(`   Total anchors with content- prefix: ${allAnchors.length}`);
  console.log(
    `   Hypertarget anchors (from preprocessor): ${hyptertargetAnchors.length}`
  );
  console.log(
    `   Fixer anchors (from cross-reference-fixer): ${fixerAnchors.length}`
  );
  console.log(`   Expected: ~324 total (162 labels × 2)`);

  // 2. ANCHOR DUPLICATION ANALYSIS
  console.log("\n🔍 ANCHOR DUPLICATION PATTERNS:");
  const idCounts = {};
  allAnchors.forEach((anchor) => {
    idCounts[anchor.id] = (idCounts[anchor.id] || 0) + 1;
  });

  const singles = Object.entries(idCounts).filter(([id, count]) => count === 1);
  const doubles = Object.entries(idCounts).filter(([id, count]) => count === 2);
  const triples = Object.entries(idCounts).filter(([id, count]) => count === 3);
  const quads = Object.entries(idCounts).filter(([id, count]) => count >= 4);

  console.log(`   IDs appearing 1× (🚨 PROBLEM): ${singles.length}`);
  console.log(`   IDs appearing 2× (✅ CORRECT): ${doubles.length}`);
  console.log(`   IDs appearing 3× (⚠️ INVESTIGATE): ${triples.length}`);
  console.log(`   IDs appearing 4+× (🚨 CHUNK DUPLICATION): ${quads.length}`);

  // 3. CHUNK DUPLICATION VERIFICATION
  if (quads.length > 0) {
    console.log("\n🔬 INVESTIGATING 4+ ANCHOR LABELS:");
    quads.slice(0, 3).forEach(([id, count]) => {
      console.log(`\n   ${id} (${count} anchors):`);
      const instances = Array.from(
        document.querySelectorAll(`[id="${CSS.escape(id)}"]`)
      );
      instances.forEach((el, i) => {
        const chunkAttr = el.closest("[data-chunk-index]");
        const chunkNum = chunkAttr
          ? chunkAttr.getAttribute("data-chunk-index")
          : "unknown";
        const hasLabel = el.hasAttribute("data-original-label");
        const type = hasLabel ? "FIXER" : "HYPERTARGET";
        console.log(
          `      [${i + 1}] <${el.tagName}> (${type}) in chunk ${chunkNum}`
        );
      });
    });
  }

  // 4. SINGLE ANCHOR INVESTIGATION
  if (singles.length > 0) {
    console.log("\n🔬 INVESTIGATING SINGLE ANCHOR LABELS (sample of 5):");
    singles.slice(0, 5).forEach(([id, count]) => {
      const anchor = document.getElementById(id);
      if (anchor) {
        const hasLabel = anchor.hasAttribute("data-original-label");
        const type = hasLabel
          ? "FIXER (missing HYPERTARGET pair)"
          : "HYPERTARGET (missing FIXER pair)";
        const parent = anchor.parentElement;
        const context = parent ? parent.className || parent.tagName : "unknown";
        console.log(`   ${id}: ${type} in ${context}`);
      }
    });
  }

  // 5. CROSS-REFERENCE FIXER STATUS
  console.log("\n🛠️ CROSS-REFERENCE FIXER EXECUTION:");

  // Check if fixer ran during chunked processing
  const fixerRanDuringChunks = window._crossRefFixingInProgress !== undefined;
  console.log(`   Fixer flag exists: ${fixerRanDuringChunks}`);

  // Check output-cleaner logs for evidence
  console.log("   Check console above for:");
  console.log("     ✅ '[CROSS_REF_FIXER] Processing X cross-reference links'");
  console.log("     ⚠️ '[CROSS_REF_FIXER] No cross-reference links found'");
  console.log("     🚨 'Chunked processing detected - deferring'");

  // 6. REGISTRY INSPECTION
  console.log("\n📋 CROSS-REFERENCE REGISTRY STATUS:");
  if (window._crossReferenceRegistry) {
    const reg = window._crossReferenceRegistry;
    if (reg.labels && reg.references) {
      console.log(`   Labels in registry: ${reg.labels.size || 0}`);
      console.log(`   References in registry: ${reg.references.size || 0}`);
    } else if (reg.statistics) {
      console.log(`   Labels found: ${reg.statistics.labelsFound || 0}`);
      console.log(
        `   References found: ${reg.statistics.referencesFound || 0}`
      );
      console.log(
        `   Anchors injected: ${reg.statistics.anchorsInjected || 0}`
      );
    } else {
      console.log("   ⚠️ Registry exists but structure unknown");
    }
  } else {
    console.log("   ❌ Registry not found");
  }

  // 7. ROOT CAUSE ANALYSIS
  console.log("\n🎯 ROOT CAUSE ANALYSIS:");

  const missingAnchors = 324 - allAnchors.length;
  const percentMissing = ((missingAnchors / 324) * 100).toFixed(1);

  if (missingAnchors > 0) {
    console.log(`   ❌ Missing ${missingAnchors} anchors (${percentMissing}%)`);
  }

  if (singles.length > 50) {
    console.log(
      "   🔴 PRIMARY ISSUE: Cross-reference-fixer NOT creating second anchors"
    );
    console.log("   📝 Explanation: Preprocessor creates hypertarget anchors,");
    console.log("      but fixer is not creating the companion anchors");
    console.log(
      "   ⚠️ Likely cause: Fixer is being skipped during chunked processing"
    );
  }

  if (quads.length > 10) {
    console.log("   🔴 SECONDARY ISSUE: Labels appearing in multiple chunks");
    console.log("   📝 Explanation: When a label appears in >1 chunk,");
    console.log("      each chunk creates its own hypertarget anchor");
    console.log("   ⚠️ Result: Duplicate IDs in final HTML (invalid)");
  }

  // 8. RECOMMENDATIONS
  console.log("\n💡 RECOMMENDED FIXES:");

  if (singles.length > 50) {
    console.log(
      "   1️⃣ Fix output-cleaner.js to ensure cross-reference-fixer runs"
    );
    console.log(
      "      AFTER chunks are combined (not during individual chunks)"
    );
  }

  if (quads.length > 0) {
    console.log(
      "   2️⃣ Deduplicate hypertarget anchors during chunk combination"
    );
    console.log(
      "      Keep only FIRST occurrence of each ID, remove duplicates"
    );
  }

  console.log("\n═".repeat(80));
  console.log("✅ DIAGNOSTIC COMPLETE - See analysis above");
  console.log("═".repeat(80));

  // Return data for programmatic access
  return {
    totalAnchors: allAnchors.length,
    hypertargetAnchors: hyptertargetAnchors.length,
    fixerAnchors: fixerAnchors.length,
    expected: 324,
    missing: missingAnchors,
    singles: singles.length,
    doubles: doubles.length,
    triples: triples.length,
    quads: quads.length,
    primaryIssue: singles.length > 50 ? "fixer-not-running" : null,
    secondaryIssue: quads.length > 10 ? "chunk-duplication" : null,
  };
}

// Export for console use
window.runChunkedAnchorDiagnostic = runChunkedAnchorDiagnostic;

console.log("✅ Chunked Anchor Diagnostic loaded");
console.log("📝 Run with: runChunkedAnchorDiagnostic()");
