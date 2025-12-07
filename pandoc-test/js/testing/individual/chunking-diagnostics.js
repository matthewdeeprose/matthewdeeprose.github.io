// ===================================================================
// CHUNKED PROCESSING DIAGNOSTICS - LaTeX Expression Order Bug
// ===================================================================
// Monitors automatic conversions and stores results for inspection

const ChunkingDiagnostics = (function () {
  "use strict";

  // Storage for diagnostic results
  let diagnosticResults = {
    conversionStarted: false,
    conversionCompleted: false,
    forcedChunking: false,
    originalThreshold: null,
    chunks: null,
    processedChunks: null,
    combinedOutput: null,
    registrySnapshot: null,
    testResult: null,
    timestamp: null,
  };

  /**
   * Prepare environment for diagnostic monitoring
   * Call this BEFORE pasting LaTeX
   */
  function prepareForDiagnosticTest() {
    console.log("\n".repeat(2));
    console.log("=".repeat(70));
    console.log(" CHUNKED PROCESSING DIAGNOSTICS - MONITORING ENABLED");
    console.log("=".repeat(70));
    console.log("\n");

    // Store original threshold
    if (window.ProcessingStrategyManager) {
      diagnosticResults.originalThreshold =
        window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD || 100000;

      // Force chunked processing (very low threshold)
      window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD = 100;
      diagnosticResults.forcedChunking = true;

      console.log("✅ Forced chunked processing (threshold = 100 chars)");
      console.log(
        `   Original threshold: ${diagnosticResults.originalThreshold}`
      );
    } else {
      console.error("❌ ProcessingStrategyManager not found");
      return false;
    }

    // Hook into ChunkedProcessingEngine if available
    if (window.ChunkedProcessingEngine) {
      console.log("✅ ChunkedProcessingEngine monitoring ready");

      // Store original functions to restore later
      if (!window._originalSplitDocumentIntoChunks) {
        window._originalSplitDocumentIntoChunks =
          window.ChunkedProcessingEngine.splitDocumentIntoChunks;
      }
      if (!window._originalCombineProcessedChunks) {
        window._originalCombineProcessedChunks =
          window.ChunkedProcessingEngine.combineProcessedChunks;
      }

      // Wrap splitDocumentIntoChunks to capture chunks
      window.ChunkedProcessingEngine.splitDocumentIntoChunks = function (
        content
      ) {
        console.log("\n🔍 DIAGNOSTIC: Document splitting detected");
        const chunks = window._originalSplitDocumentIntoChunks.call(
          this,
          content
        );
        diagnosticResults.chunks = chunks;
        console.log(`   Split into ${chunks.length} chunks`);
        return chunks;
      };

      // Wrap combineProcessedChunks to capture combination
      window.ChunkedProcessingEngine.combineProcessedChunks = function (
        processedChunks,
        argumentsText,
        originalLatexInput
      ) {
        console.log("\n🔍 DIAGNOSTIC: Chunk combination detected");
        diagnosticResults.processedChunks = processedChunks;

        const result = window._originalCombineProcessedChunks.call(
          this,
          processedChunks,
          argumentsText,
          originalLatexInput
        );

        diagnosticResults.combinedOutput = result;
        console.log(`   Combined ${processedChunks.length} chunks`);
        return result;
      };
    }

    // Hook into conversion completion
    if (window.StatusManager) {
      // Monitor for conversion completion via status changes
      const originalSetComplete = window.StatusManager.setComplete;
      window.StatusManager.setComplete = function (message) {
        console.log("\n🔍 DIAGNOSTIC: Conversion completed");
        diagnosticResults.conversionCompleted = true;
        diagnosticResults.timestamp = new Date();

        // Capture registry snapshot
        if (window.originalLatexByPosition) {
          diagnosticResults.registrySnapshot = {
            length: window.originalLatexByPosition.length,
            first10: window.originalLatexByPosition.slice(0, 10),
            sample72to78: window.originalLatexByPosition.slice(72, 79),
          };
          console.log(
            `   Registry captured: ${diagnosticResults.registrySnapshot.length} expressions`
          );
        }

        // Run automatic analysis
        setTimeout(() => {
          analyzeConversionResults();
        }, 1000);

        return originalSetComplete.call(this, message);
      };
    }

    console.log("\n📋 INSTRUCTIONS:");
    console.log("   1. Paste your LaTeX document into the textarea");
    console.log("   2. Conversion will happen automatically with monitoring");
    console.log("   3. Results will be analyzed and stored automatically");
    console.log("   4. Use showDiagnosticResults() to view full report\n");
    console.log("=".repeat(70));
    console.log("\n");

    return true;
  }

  /**
   * Automatically analyze conversion results after completion
   */
  function analyzeConversionResults() {
    console.log("\n".repeat(2));
    console.log("=".repeat(70));
    console.log(" AUTOMATIC DIAGNOSTIC ANALYSIS");
    console.log("=".repeat(70));
    console.log("\n");

    // Check if we have output to analyze
    const output = document.querySelector("#output");
    if (!output) {
      console.error("❌ Output area not found");
      return;
    }

    const outputText = output.textContent;

    console.log("📊 CONVERSION STATISTICS:");
    console.log(`   Output length: ${outputText.length} characters`);
    console.log(
      `   Chunks processed: ${diagnosticResults.processedChunks?.length || 0}`
    );
    console.log(
      `   Registry size: ${diagnosticResults.registrySnapshot?.length || 0}`
    );

    // Test for text-shuffling bug
    console.log("\n🔬 BUG DETECTION TESTS:\n");

    // Test 1: Check for "Let x." pattern (indicates bug)
    const hasLetXBug = /Let\s+x\s*\./i.test(outputText);
    console.log(
      `   Test 1 - "Let x" pattern: ${
        hasLetXBug ? "❌ DETECTED (BUG)" : "✅ NOT FOUND (GOOD)"
      }`
    );

    // Test 2: Check for correct "Let A=B=" pattern
    const hasCorrectLetPattern = /Let.*A.*=.*B.*=/i.test(outputText);
    console.log(
      `   Test 2 - Correct "Let A=B=" pattern: ${
        hasCorrectLetPattern ? "✅ FOUND (GOOD)" : "❌ NOT FOUND (BUG)"
      }`
    );

    // Test 3: Check math expression pairing
    const hasCorrectPairing =
      /formula.*f\(x\).*=.*x.*².*even.*g\(x\).*=.*x.*³.*odd/is.test(outputText);
    console.log(
      `   Test 3 - Correct math pairing: ${
        hasCorrectPairing ? "✅ FOUND (GOOD)" : "❌ NOT FOUND (BUG)"
      }`
    );

    // Test 4: Check for wrong math pairing
    const hasWrongPairing =
      /formula.*f\(x\).*even.*A.*=.*B/is.test(outputText) ||
      /Let.*x.*formula.*f\(x\).*even/is.test(outputText);
    console.log(
      `   Test 4 - Wrong math pairing: ${
        hasWrongPairing ? "❌ DETECTED (BUG)" : "✅ NOT FOUND (GOOD)"
      }`
    );

    // Overall verdict
    const bugDetected =
      hasLetXBug ||
      !hasCorrectLetPattern ||
      !hasCorrectPairing ||
      hasWrongPairing;

    console.log("\n" + "=".repeat(70));
    if (bugDetected) {
      console.log("🚨 VERDICT: TEXT-SHUFFLING BUG DETECTED");
      console.log("   Math expressions appear in wrong positions");
      console.log("   Surrounding text is misaligned with math");
      diagnosticResults.testResult = "BUG_DETECTED";
    } else {
      console.log("✅ VERDICT: NO BUG DETECTED");
      console.log("   Text and math expressions appear correctly paired");
      diagnosticResults.testResult = "PASS";
    }
    console.log("=".repeat(70));

    console.log("\n💡 Use these commands to investigate further:");
    console.log("   - ChunkingDiagnostics.showDiagnosticResults()");
    console.log("   - ChunkingDiagnostics.showChunkBreakdown()");
    console.log("   - ChunkingDiagnostics.showRegistryComparison()");
    console.log("   - ChunkingDiagnostics.showOutputSample()");
    console.log("\n");
  }

  /**
   * Show comprehensive diagnostic results
   */
  function showDiagnosticResults() {
    console.log("\n".repeat(2));
    console.log("=".repeat(70));
    console.log(" COMPREHENSIVE DIAGNOSTIC REPORT");
    console.log("=".repeat(70));
    console.log("\n");

    console.log("📋 CONVERSION INFO:");
    console.log(`   Completed: ${diagnosticResults.conversionCompleted}`);
    console.log(`   Forced chunking: ${diagnosticResults.forcedChunking}`);
    console.log(
      `   Threshold used: ${
        diagnosticResults.originalThreshold === 100000
          ? "100 (forced)"
          : diagnosticResults.originalThreshold
      }`
    );
    console.log(`   Timestamp: ${diagnosticResults.timestamp}`);

    console.log("\n📦 CHUNK INFO:");
    if (diagnosticResults.chunks) {
      console.log(`   Total chunks: ${diagnosticResults.chunks.length}`);
      diagnosticResults.chunks.forEach((chunk, i) => {
        console.log(
          `   Chunk ${i + 1}: ${chunk.type} - ${chunk.title} (${
            chunk.content?.length || 0
          } chars)`
        );
      });
    } else {
      console.log("   No chunk data captured");
    }

    console.log("\n📚 REGISTRY INFO:");
    if (diagnosticResults.registrySnapshot) {
      console.log(
        `   Total expressions: ${diagnosticResults.registrySnapshot.length}`
      );
      console.log(`   Sample (positions 72-78):`);
      diagnosticResults.registrySnapshot.sample72to78.forEach((expr, i) => {
        console.log(`      [${72 + i}]: ${expr}`);
      });
    } else {
      console.log("   No registry data captured");
    }

    console.log("\n🎯 TEST RESULT:");
    console.log(`   ${diagnosticResults.testResult || "NOT RUN"}`);

    console.log("\n" + "=".repeat(70));
    console.log("\n");

    return diagnosticResults;
  }

  /**
   * Show detailed chunk breakdown
   */
  function showChunkBreakdown() {
    console.log("\n=== DETAILED CHUNK BREAKDOWN ===\n");

    if (!diagnosticResults.chunks) {
      console.log("❌ No chunk data available");
      return;
    }

    diagnosticResults.chunks.forEach((chunk, index) => {
      console.log(`\n--- CHUNK ${index + 1} ---`);
      console.log(`Type: ${chunk.type}`);
      console.log(`Title: ${chunk.title}`);
      console.log(`Content length: ${chunk.content?.length || 0} chars`);

      // Count math expressions
      const mathPatterns = [
        /\$\$[\s\S]*?\$\$/g,
        /\\\[[\s\S]*?\\\]/g,
        /\$[^$]+?\$/g,
        /\\\([\s\S]*?\\\)/g,
      ];

      let totalMath = 0;
      const mathExamples = [];
      mathPatterns.forEach((pattern) => {
        const matches = chunk.content?.match(pattern) || [];
        totalMath += matches.length;
        mathExamples.push(...matches.slice(0, 3));
      });

      console.log(`Math expressions: ${totalMath}`);
      if (mathExamples.length > 0) {
        console.log(`Examples: ${mathExamples.slice(0, 3).join(", ")}`);
      }

      console.log(`First 100 chars: ${chunk.content?.substring(0, 100)}...`);
    });
  }

  /**
   * Show registry comparison (expected vs actual)
   */
  function showRegistryComparison() {
    console.log("\n=== REGISTRY COMPARISON ===\n");

    if (!diagnosticResults.registrySnapshot) {
      console.log("❌ No registry snapshot available");
      return;
    }

    console.log("Expected order for Example 8 (positions 72-78):");
    console.log("  [72]: Should be something like 'A=B=\\R' or similar");
    console.log("  [73]: Should be 'f(x)=x^2'");
    console.log("  [74]: Should be 'g(x)=x^3'");
    console.log("  [75]: Should be 'h(x) = x^2 + x^3'");
    console.log("  [76]: Should be 'k(x)=0'");

    console.log("\nActual registry values:");
    diagnosticResults.registrySnapshot.sample72to78.forEach((expr, i) => {
      console.log(`  [${72 + i}]: ${expr}`);
    });
  }

  /**
   * Show output sample around Example 8
   */
  function showOutputSample() {
    console.log("\n=== OUTPUT SAMPLE ===\n");

    const output = document.querySelector("#output");
    if (!output) {
      console.log("❌ Output not found");
      return;
    }

    const outputText = output.textContent;

    // Find "Example" text
    const exampleIndex = outputText.indexOf("Example");
    if (exampleIndex === -1) {
      console.log("❌ Example not found in output");
      return;
    }

    // Show 500 characters around it
    const start = Math.max(0, exampleIndex - 100);
    const end = Math.min(outputText.length, exampleIndex + 400);
    const sample = outputText.substring(start, end);

    console.log("Output text around 'Example':");
    console.log("-".repeat(70));
    console.log(sample);
    console.log("-".repeat(70));
  }

  /**
   * Reset diagnostics and restore original functions
   */
  function resetDiagnostics() {
    console.log("\n🔄 Resetting diagnostics...");

    // Restore original threshold
    if (
      window.ProcessingStrategyManager &&
      diagnosticResults.originalThreshold
    ) {
      window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD =
        diagnosticResults.originalThreshold;
      console.log(
        `✅ Restored threshold to ${diagnosticResults.originalThreshold}`
      );
    }

    // Restore original functions
    if (window._originalSplitDocumentIntoChunks) {
      window.ChunkedProcessingEngine.splitDocumentIntoChunks =
        window._originalSplitDocumentIntoChunks;
      console.log("✅ Restored original splitDocumentIntoChunks");
    }

    if (window._originalCombineProcessedChunks) {
      window.ChunkedProcessingEngine.combineProcessedChunks =
        window._originalCombineProcessedChunks;
      console.log("✅ Restored original combineProcessedChunks");
    }

    // Clear results
    diagnosticResults = {
      conversionStarted: false,
      conversionCompleted: false,
      forcedChunking: false,
      originalThreshold: null,
      chunks: null,
      processedChunks: null,
      combinedOutput: null,
      registrySnapshot: null,
      testResult: null,
      timestamp: null,
    };

    console.log("✅ Diagnostics reset complete\n");
  }

  /**
   * Get current diagnostic status
   */
  function getStatus() {
    return {
      prepared: diagnosticResults.forcedChunking,
      completed: diagnosticResults.conversionCompleted,
      testResult: diagnosticResults.testResult,
      hasData: !!diagnosticResults.chunks,
    };
  }

  /**
   * Run comparative test: standard vs chunked processing
   * This definitively shows if the bug is chunking-specific
   */
  async function runComparativeTest(latexDocument) {
    console.log("\n".repeat(3));
    console.log("=".repeat(70));
    console.log(" COMPARATIVE TEST: STANDARD vs CHUNKED PROCESSING");
    console.log("=".repeat(70));
    console.log("\n");

    const testDoc =
      latexDocument ||
      `\\documentclass{article}
\\usepackage{amsmath,amssymb}
\\newcommand{\\R}{\\mathbb{R}}
\\newtheorem{example}{Example}

\\begin{document}
\\begin{example}
Let $A=B=\\R$. The function given by the formula
$f(x)=x^2$ is even while $g(x)=x^3$ is odd. 

The function given by $h(x) = x^2 + x^3$ is neither even nor odd.

The trivial function given by $k(x)=0$ is both even and odd. 
\\end{example}
\\end{document}`;

    const comparisonResults = {
      standard: null,
      chunked: null,
      differences: [],
      bugConfirmed: false,
    };

    const textarea = document.querySelector("textarea");
    const output = document.querySelector("#output");

    if (!textarea || !output) {
      console.error("❌ Required elements not found");
      return null;
    }

    try {
      // ================================================================
      // TEST 1: STANDARD PROCESSING (Non-chunked)
      // ================================================================
      console.log("🔵 TEST 1: STANDARD (NON-CHUNKED) PROCESSING");
      console.log("-".repeat(70));

      // Store original threshold
      const originalThreshold =
        window.ProcessingStrategyManager?.CHUNK_SIZE_THRESHOLD || 100000;

      // Force standard processing (very high threshold to prevent chunking)
      if (window.ProcessingStrategyManager) {
        window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD = 999999;
        console.log("✅ Set threshold to 999999 (forces standard processing)");
      }

      // Clear output
      output.innerHTML = "";

      // Load document
      textarea.value = testDoc;
      console.log("✅ Document loaded into textarea");

      // Trigger conversion by dispatching input event
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      // Wait for conversion
      console.log("⏳ Waiting for standard conversion to complete...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Capture results
      const standardOutput = output.innerHTML;
      const standardText = output.textContent;
      const standardRegistry = window.originalLatexByPosition
        ? [...window.originalLatexByPosition]
        : [];

      comparisonResults.standard = {
        outputHTML: standardOutput,
        outputText: standardText,
        registry: standardRegistry,
        registrySize: standardRegistry.length,
        hasLetX: /Let\s+x\s*\./i.test(standardText),
        hasCorrectPattern:
          /Let.*A.*=.*B.*=.*formula.*f\(x\).*=.*x.*².*even.*g\(x\).*=.*x.*³.*odd/is.test(
            standardText
          ),
      };

      console.log("✅ Standard processing complete");
      console.log(`   Output length: ${standardText.length} chars`);
      console.log(`   Registry size: ${standardRegistry.length} expressions`);
      console.log(
        `   Has "Let x" bug: ${
          comparisonResults.standard.hasLetX ? "YES ❌" : "NO ✅"
        }`
      );
      console.log(
        `   Has correct pattern: ${
          comparisonResults.standard.hasCorrectPattern ? "YES ✅" : "NO ❌"
        }`
      );

      // ================================================================
      // TEST 2: CHUNKED PROCESSING (Forced)
      // ================================================================
      console.log("\n🟠 TEST 2: CHUNKED PROCESSING (FORCED)");
      console.log("-".repeat(70));

      // Force chunked processing (very low threshold)
      if (window.ProcessingStrategyManager) {
        window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD = 100;
        console.log("✅ Set threshold to 100 (forces chunked processing)");
      }

      // Clear output and registry
      output.innerHTML = "";
      if (window.originalLatexByPosition) {
        window.originalLatexByPosition = [];
      }

      // Load document again
      textarea.value = testDoc;
      console.log("✅ Document loaded into textarea");

      // Trigger conversion
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      // Wait for conversion
      console.log("⏳ Waiting for chunked conversion to complete...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Capture results
      const chunkedOutput = output.innerHTML;
      const chunkedText = output.textContent;
      const chunkedRegistry = window.originalLatexByPosition
        ? [...window.originalLatexByPosition]
        : [];

      comparisonResults.chunked = {
        outputHTML: chunkedOutput,
        outputText: chunkedText,
        registry: chunkedRegistry,
        registrySize: chunkedRegistry.length,
        hasLetX: /Let\s+x\s*\./i.test(chunkedText),
        hasCorrectPattern:
          /Let.*A.*=.*B.*=.*formula.*f\(x\).*=.*x.*².*even.*g\(x\).*=.*x.*³.*odd/is.test(
            chunkedText
          ),
      };

      console.log("✅ Chunked processing complete");
      console.log(`   Output length: ${chunkedText.length} chars`);
      console.log(`   Registry size: ${chunkedRegistry.length} expressions`);
      console.log(
        `   Has "Let x" bug: ${
          comparisonResults.chunked.hasLetX ? "YES ❌" : "NO ✅"
        }`
      );
      console.log(
        `   Has correct pattern: ${
          comparisonResults.chunked.hasCorrectPattern ? "YES ✅" : "NO ❌"
        }`
      );

      // ================================================================
      // COMPARISON ANALYSIS
      // ================================================================
      console.log("\n📊 COMPARISON ANALYSIS");
      console.log("=".repeat(70));

      // Compare registry sizes
      console.log("\n1️⃣ REGISTRY COMPARISON:");
      console.log(
        `   Standard registry: ${comparisonResults.standard.registrySize} expressions`
      );
      console.log(
        `   Chunked registry:  ${comparisonResults.chunked.registrySize} expressions`
      );
      if (
        comparisonResults.standard.registrySize ===
        comparisonResults.chunked.registrySize
      ) {
        console.log("   ✅ Registry sizes match");
      } else {
        console.log("   ❌ Registry sizes differ!");
        comparisonResults.differences.push("Registry size mismatch");
      }

      // Compare first 10 expressions
      console.log("\n2️⃣ FIRST 10 EXPRESSIONS:");
      for (
        let i = 0;
        i < Math.min(10, comparisonResults.standard.registrySize);
        i++
      ) {
        const std = comparisonResults.standard.registry[i] || "(missing)";
        const chu = comparisonResults.chunked.registry[i] || "(missing)";
        const match = std === chu;
        console.log(`   [${i}] ${match ? "✅" : "❌"}`);
        console.log(`      Standard: ${std}`);
        console.log(`      Chunked:  ${chu}`);
        if (!match) {
          comparisonResults.differences.push(`Expression ${i} differs`);
        }
      }

      // Compare bug patterns
      console.log("\n3️⃣ BUG PATTERN DETECTION:");
      console.log(
        `   Standard has "Let x" bug:    ${
          comparisonResults.standard.hasLetX ? "YES ❌" : "NO ✅"
        }`
      );
      console.log(
        `   Chunked has "Let x" bug:     ${
          comparisonResults.chunked.hasLetX ? "YES ❌" : "NO ✅"
        }`
      );
      console.log(
        `   Standard has correct pattern: ${
          comparisonResults.standard.hasCorrectPattern ? "YES ✅" : "NO ❌"
        }`
      );
      console.log(
        `   Chunked has correct pattern:  ${
          comparisonResults.chunked.hasCorrectPattern ? "YES ✅" : "NO ❌"
        }`
      );

      // Determine if bug is chunking-specific
      const bugOnlyInChunked =
        !comparisonResults.standard.hasLetX &&
        comparisonResults.chunked.hasLetX &&
        comparisonResults.standard.hasCorrectPattern &&
        !comparisonResults.chunked.hasCorrectPattern;

      comparisonResults.bugConfirmed = bugOnlyInChunked;

      // ================================================================
      // VERDICT
      // ================================================================
      console.log("\n" + "=".repeat(70));
      console.log("🎯 FINAL VERDICT:");
      console.log("=".repeat(70));

      if (bugOnlyInChunked) {
        console.log("\n🚨 BUG CONFIRMED: CHUNKING-SPECIFIC ISSUE");
        console.log(
          "\n   The text-shuffling bug ONLY occurs with chunked processing."
        );
        console.log("   Standard processing produces correct output.");
        console.log(
          "   This definitively proves the bug is in chunked-processing-engine.js"
        );
        console.log("\n   Differences found:");
        comparisonResults.differences.forEach((diff, i) => {
          console.log(`      ${i + 1}. ${diff}`);
        });
      } else if (
        comparisonResults.standard.hasLetX &&
        comparisonResults.chunked.hasLetX
      ) {
        console.log("\n⚠️ BUG PRESENT IN BOTH METHODS");
        console.log("   This suggests the bug is NOT chunking-specific.");
        console.log(
          "   Issue may be in latex-preservation-engine.js or earlier."
        );
      } else if (
        !comparisonResults.standard.hasLetX &&
        !comparisonResults.chunked.hasLetX
      ) {
        console.log("\n✅ NO BUG DETECTED IN EITHER METHOD");
        console.log(
          "   Both standard and chunked processing produce correct output."
        );
      } else {
        console.log("\n❓ INCONCLUSIVE RESULTS");
        console.log("   Unable to determine if bug is chunking-specific.");
      }

      console.log("\n=".repeat(70));

      // Restore original threshold
      if (window.ProcessingStrategyManager) {
        window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD =
          originalThreshold;
        console.log(`\n✅ Restored threshold to ${originalThreshold}`);
      }

      console.log("\n💡 Use these commands for more details:");
      console.log("   - ChunkingDiagnostics.showComparisonDetails()");
      console.log("   - ChunkingDiagnostics.getComparisonResults()");
      console.log("\n");

      // Store for later access
      diagnosticResults.comparison = comparisonResults;

      return comparisonResults;
    } catch (error) {
      console.error("❌ Comparative test failed:", error);

      // Restore threshold on error
      if (window.ProcessingStrategyManager) {
        window.ProcessingStrategyManager.CHUNK_SIZE_THRESHOLD =
          originalThreshold;
      }

      return null;
    }
  }

  /**
   * Show detailed comparison results
   */
  function showComparisonDetails() {
    if (!diagnosticResults.comparison) {
      console.log(
        "❌ No comparison data available. Run runComparativeTest() first."
      );
      return;
    }

    const comp = diagnosticResults.comparison;

    console.log("\n".repeat(2));
    console.log("=".repeat(70));
    console.log(" DETAILED COMPARISON REPORT");
    console.log("=".repeat(70));

    console.log("\n📄 STANDARD PROCESSING OUTPUT (first 500 chars):");
    console.log("-".repeat(70));
    console.log(comp.standard.outputText.substring(0, 500));
    console.log("-".repeat(70));

    console.log("\n📄 CHUNKED PROCESSING OUTPUT (first 500 chars):");
    console.log("-".repeat(70));
    console.log(comp.chunked.outputText.substring(0, 500));
    console.log("-".repeat(70));

    console.log("\n📊 STATISTICS:");
    console.log(
      `   Standard output length: ${comp.standard.outputText.length}`
    );
    console.log(`   Chunked output length:  ${comp.chunked.outputText.length}`);
    console.log(
      `   Difference: ${Math.abs(
        comp.standard.outputText.length - comp.chunked.outputText.length
      )} characters`
    );

    console.log("\n🔬 DETECTED DIFFERENCES:");
    if (comp.differences.length === 0) {
      console.log("   None - outputs are equivalent");
    } else {
      comp.differences.forEach((diff, i) => {
        console.log(`   ${i + 1}. ${diff}`);
      });
    }

    console.log("\n");
  }

  /**
   * Get comparison results for programmatic access
   */
  function getComparisonResults() {
    return diagnosticResults.comparison || null;
  }

  // ===================================================================
  // PUBLIC API
  // ===================================================================

  return {
    // Main workflow
    prepareForDiagnosticTest,
    showDiagnosticResults,
    resetDiagnostics,
    getStatus,

    // Detailed inspection
    showChunkBreakdown,
    showRegistryComparison,
    showOutputSample,

    // NEW: Comparative testing
    runComparativeTest,
    showComparisonDetails,
    getComparisonResults,

    // Direct access to results
    getResults: () => diagnosticResults,
  };
})();

// Make globally available
window.ChunkingDiagnostics = ChunkingDiagnostics;

console.log("✅ Chunking Diagnostics loaded (Monitoring Mode)");
console.log("\n📋 WORKFLOW:");
console.log("   1. ChunkingDiagnostics.prepareForDiagnosticTest()");
console.log(
  "   2. Paste LaTeX into textarea (conversion happens automatically)"
);
console.log("   3. Results analyzed automatically");
console.log("   4. ChunkingDiagnostics.showDiagnosticResults()");
console.log("\n🔄 RESET:");
console.log("   - ChunkingDiagnostics.resetDiagnostics()");
