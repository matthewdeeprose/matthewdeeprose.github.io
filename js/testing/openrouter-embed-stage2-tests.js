/**
 * OpenRouter Embed API - Stage 2 Complete Testing Suite
 *
 * Comprehensive tests for file attachment support including:
 * - File validation (automated)
 * - File clearing (automated)
 * - File analysis (automated)
 * - Image requests (interactive)
 * - PDF requests (interactive)
 * - Stage 1 regression (automated)
 *
 * @version 1.0.0 (Stage 2)
 * @date 22 November 2025
 */

// ============================================================================
// TEST 1: FILE VALIDATION
// ============================================================================

window.testEmbedStage2_FileValidation = async function () {
  console.log("\n🧪 STAGE 2 TEST 1: File Validation");
  console.log("====================================\n");

  const tests = [
    {
      name: "Valid JPEG image",
      file: new File(["test"], "test.jpg", { type: "image/jpeg" }),
      shouldPass: true,
    },
    {
      name: "Valid PNG image",
      file: new File(["test"], "test.png", { type: "image/png" }),
      shouldPass: true,
    },
    {
      name: "Valid WebP image",
      file: new File(["test"], "test.webp", { type: "image/webp" }),
      shouldPass: true,
    },
    {
      name: "Valid PDF",
      file: new File(["test"], "test.pdf", { type: "application/pdf" }),
      shouldPass: true,
    },
    {
      name: "Invalid TXT file",
      file: new File(["test"], "test.txt", { type: "text/plain" }),
      shouldPass: false,
    },
    {
      name: "Invalid file object",
      file: { notAFile: true },
      shouldPass: false,
    },
    {
      name: "Oversized image (11MB)",
      file: new File([new ArrayBuffer(11 * 1024 * 1024)], "huge.jpg", {
        type: "image/jpeg",
      }),
      shouldPass: false,
    },
  ];

  // Create test container if doesn't exist (like Stage 1 tests)
  let container = document.getElementById("embed-test-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "embed-test-container";
    container.style.cssText =
      "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
    document.body.appendChild(container);
  }

  const embed = new OpenRouterEmbed({
    containerId: "embed-test-container",
    showNotifications: false,
  });

  const results = [];

  for (const test of tests) {
    try {
      await embed.attachFile(test.file);
      embed.clearFile();

      if (test.shouldPass) {
        console.log(`✅ ${test.name}: Passed validation correctly`);
        results.push({ name: test.name, result: "PASS" });
      } else {
        console.error(`❌ ${test.name}: Should have failed validation`);
        results.push({ name: test.name, result: "FAIL" });
      }
    } catch (error) {
      if (!test.shouldPass) {
        console.log(`✅ ${test.name}: Failed as expected (${error.message})`);
        results.push({ name: test.name, result: "PASS" });
      } else {
        console.error(`❌ ${test.name}: Unexpected failure (${error.message})`);
        results.push({ name: test.name, result: "FAIL" });
      }
    }
  }

  const passed = results.filter((r) => r.result === "PASS").length;
  const total = tests.length;

  console.log(`\n📊 Results: ${passed}/${total} validation tests passed`);

  if (passed === total) {
    console.log("\n🎉 TEST 1 PASSED!\n");
    return { success: true, passed, total, results };
  } else {
    console.log("\n❌ TEST 1 FAILED!\n");
    return { success: false, passed, total, results };
  }
};

// ============================================================================
// TEST 2: FILE CLEARING
// ============================================================================

window.testEmbedStage2_FileCleaning = async function () {
  console.log("\n🧪 STAGE 2 TEST 2: File Clearing");
  console.log("===================================\n");

  // Create test container if doesn't exist
  let container = document.getElementById("embed-test-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "embed-test-container";
    container.style.cssText =
      "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
    document.body.appendChild(container);
  }

  const embed = new OpenRouterEmbed({
    containerId: "embed-test-container",
    showNotifications: false,
  });

  try {
    // Check initially no file
    console.log(
      "Initial state:",
      embed.currentFile === null ? "✅ No file" : "❌ Has file"
    );

    // Attach test file
    const testFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    await embed.attachFile(testFile);

    console.log(
      "After attach:",
      embed.currentFile !== null
        ? `✅ File attached (${embed.currentFile.name})`
        : "❌ No file"
    );

    // Clear file
    embed.clearFile();

    console.log(
      "After clear:",
      embed.currentFile === null ? "✅ File cleared" : "❌ Still has file"
    );

    // Verify all file state cleared
    const allCleared =
      embed.currentFile === null &&
      embed.currentFileBase64 === null &&
      embed.currentFileAnalysis === null;

    console.log("All state cleared:", allCleared ? "✅ Yes" : "❌ No");

    if (allCleared) {
      console.log("\n🎉 TEST 2 PASSED!\n");
      return { success: true };
    } else {
      console.error("\n❌ TEST 2 FAILED: State not fully cleared\n");
      return { success: false };
    }
  } catch (error) {
    console.error("❌ TEST 2 FAILED:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// TEST 3: FILE ANALYSIS
// ============================================================================

window.testEmbedStage2_FileAnalysis = async function () {
  console.log("\n🧪 STAGE 2 TEST 3: File Analysis");
  console.log("===================================\n");

  // Create test container if doesn't exist
  let container = document.getElementById("embed-test-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "embed-test-container";
    container.style.cssText =
      "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
    document.body.appendChild(container);
  }

  const embed = new OpenRouterEmbed({
    containerId: "embed-test-container",
    showNotifications: false,
  });

  try {
    // Test small PDF
    const smallPDF = new File([new ArrayBuffer(100 * 1024)], "small.pdf", {
      type: "application/pdf",
    });

    console.log("Analysing small PDF (100KB)...");
    const smallAnalysis = await embed.analyzeFile(smallPDF);

    console.log("✅ Small PDF analysis:", {
      pages: smallAnalysis.pages,
      engine: smallAnalysis.engine,
      cost: smallAnalysis.cost,
      source: smallAnalysis.source,
    });

    // Test larger PDF
    const largePDF = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.pdf", {
      type: "application/pdf",
    });

    console.log("\nAnalysing large PDF (5MB)...");
    const largeAnalysis = await embed.analyzeFile(largePDF);

    console.log("✅ Large PDF analysis:", {
      pages: largeAnalysis.pages,
      engine: largeAnalysis.engine,
      cost: largeAnalysis.cost,
      source: largeAnalysis.source,
    });

    // Test image
    const image = new File([new ArrayBuffer(2 * 1024 * 1024)], "image.jpg", {
      type: "image/jpeg",
    });

    console.log("\nAnalysing image (2MB)...");
    const imageAnalysis = await embed.analyzeFile(image);

    console.log("✅ Image analysis:", {
      pages: imageAnalysis.pages,
      engine: imageAnalysis.engine,
      cost: imageAnalysis.cost,
      source: imageAnalysis.source,
    });

    // Verify analysis structure
    const hasRequiredFields =
      smallAnalysis.pages !== undefined &&
      smallAnalysis.engine !== undefined &&
      smallAnalysis.cost !== undefined;

    if (hasRequiredFields) {
      console.log("\n✅ Analysis structure correct");
      console.log("\n🎉 TEST 3 PASSED!\n");
      return { success: true, smallAnalysis, largeAnalysis, imageAnalysis };
    } else {
      console.error("\n❌ TEST 3 FAILED: Missing required analysis fields\n");
      return { success: false };
    }
  } catch (error) {
    console.error("❌ TEST 3 FAILED:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// TEST 4: IMAGE REQUEST (INTERACTIVE)
// ============================================================================

window.testEmbedStage2_ImageRequest = async function () {
  console.log("\n🧪 STAGE 2 TEST 4: Image Request (Interactive)");
  console.log("===============================================\n");
  console.log("ℹ️  This test requires you to select an image file");
  console.log("    Supported formats: JPEG, PNG, WebP");
  console.log("    Maximum size: 10MB\n");

  // Create file input
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";

  return new Promise((resolve) => {
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];

        if (!file) {
          console.warn("⚠️  No file selected");
          resolve({ success: false, reason: "No file selected" });
          return;
        }

        console.log(
          `📎 File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
        );

        // Create test container if doesn't exist
        let container = document.getElementById("embed-test-container");
        if (!container) {
          container = document.createElement("div");
          container.id = "embed-test-container";
          container.style.cssText =
            "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
          document.body.appendChild(container);
        }

        const embed = new OpenRouterEmbed({
          containerId: "embed-test-container",
        });
        // Analyse file
        console.log("\n📊 Analysing file...");
        const analysis = await embed.analyzeFile(file);
        console.log("✅ Analysis:", analysis);

        // Attach file
        console.log("\n📎 Attaching file...");
        await embed.attachFile(file);
        console.log("✅ File attached");

        // Send request
        console.log("\n📤 Sending request with image...");
        const response = await embed.sendRequest({
          userPrompt: "Describe this image briefly in 2-3 sentences.",
        });

        console.log("\n✅ Response received:");
        console.log("  Text length:", response.text.length);
        console.log("  Text preview:", response.text.substring(0, 100) + "...");
        console.log("  Tokens:", response.metadata.tokens);
        console.log("  Model:", response.metadata.model);
        console.log(
          "  Processing time:",
          response.metadata.processingTime + "ms"
        );

        console.log("\n🎉 TEST 4 PASSED!\n");
        resolve({ success: true, response, file: file.name, analysis });
      } catch (error) {
        console.error("\n❌ TEST 4 FAILED:", error);
        resolve({ success: false, error: error.message });
      }
    };

    // Trigger file selection
    input.click();
  });
};

// ============================================================================
// TEST 5: PDF REQUEST (INTERACTIVE)
// ============================================================================

window.testEmbedStage2_PDFRequest = async function () {
  console.log("\n🧪 STAGE 2 TEST 5: PDF Request (Interactive)");
  console.log("=============================================\n");
  console.log("ℹ️  This test requires you to select a PDF file");
  console.log("    Maximum size: 25MB\n");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";

  return new Promise((resolve) => {
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];

        if (!file) {
          console.warn("⚠️  No file selected");
          resolve({ success: false, reason: "No file selected" });
          return;
        }

        console.log(
          `📎 PDF selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
        );

        // Create test container if doesn't exist
        let container = document.getElementById("embed-test-container");
        if (!container) {
          container = document.createElement("div");
          container.id = "embed-test-container";
          container.style.cssText =
            "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
          document.body.appendChild(container);
        }

        const embed = new OpenRouterEmbed({
          containerId: "embed-test-container",
        });

        // Analyse PDF
        console.log("\n📊 Analysing PDF...");
        const analysis = await embed.analyzeFile(file);
        console.log("✅ Analysis:");
        console.log("  Estimated pages:", analysis.pages);
        console.log("  Recommended engine:", analysis.engine);
        console.log("  Estimated cost:", analysis.cost);
        console.log("  Source:", analysis.source);

        // Attach PDF
        console.log("\n📎 Attaching PDF...");
        await embed.attachFile(file);
        console.log("✅ PDF attached");

        // Send request
        console.log("\n📤 Sending request with PDF...");
        const response = await embed.sendRequest({
          userPrompt: "Summarize this PDF in 2-3 sentences.",
        });

        console.log("\n✅ Response received:");
        console.log("  Text length:", response.text.length);
        console.log("  Text preview:", response.text.substring(0, 100) + "...");
        console.log("  Tokens:", response.metadata.tokens);
        console.log("  Model:", response.metadata.model);
        console.log(
          "  Processing time:",
          response.metadata.processingTime + "ms"
        );

        console.log("\n🎉 TEST 5 PASSED!\n");
        resolve({ success: true, response, file: file.name, analysis });
      } catch (error) {
        console.error("\n❌ TEST 5 FAILED:", error);
        resolve({ success: false, error: error.message });
      }
    };

    input.click();
  });
};

// ============================================================================
// TEST 6: STAGE 1 REGRESSION CHECK
// ============================================================================

window.testEmbedStage2_Stage1Regression = async function () {
  console.log("\n🧪 STAGE 2 TEST 6: Stage 1 Regression Check");
  console.log("===========================================\n");
  console.log("ℹ️  Running Stage 1 tests to verify no regressions...\n");

  try {
    // Run Stage 1 test suite
    const stage1Results = await window.testEmbedStage1_All();

    // Check if all Stage 1 tests passed
    const allPassed = Object.values(stage1Results).every(
      (result) => result.success !== false
    );

    if (allPassed) {
      console.log("\n✅ All Stage 1 tests still passing");
      console.log("\n🎉 TEST 6 PASSED - No regressions!\n");
      return { success: true, stage1Results };
    } else {
      console.error("\n❌ TEST 6 FAILED - Stage 1 regressions detected!\n");
      return { success: false, stage1Results };
    }
  } catch (error) {
    console.error("\n❌ TEST 6 FAILED:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// MASTER TEST RUNNER (STAGE 2)
// ============================================================================

window.testEmbedStage2_All = async function () {
  console.clear();
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║     OpenRouter Embed API - Stage 2 Complete Tests        ║");
  console.log("║            File Attachment Support Testing               ║");
  console.log(
    "╚═══════════════════════════════════════════════════════════╝\n"
  );

  const results = {};

  // Automated tests
  console.log("🤖 RUNNING AUTOMATED TESTS...\n");

  results.fileValidation = await window.testEmbedStage2_FileValidation();
  await new Promise((resolve) => setTimeout(resolve, 500));

  results.fileCleaning = await window.testEmbedStage2_FileCleaning();
  await new Promise((resolve) => setTimeout(resolve, 500));

  results.fileAnalysis = await window.testEmbedStage2_FileAnalysis();
  await new Promise((resolve) => setTimeout(resolve, 500));

  results.stage1Regression = await window.testEmbedStage2_Stage1Regression();
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 AUTOMATED TEST RESULTS");
  console.log("═".repeat(60) + "\n");

  const testNames = Object.keys(results);
  const passedTests = testNames.filter(
    (name) => results[name].success !== false
  );

  testNames.forEach((name) => {
    const result = results[name];
    console.log(`${result.success ? "✅" : "❌"} ${name}`);
  });

  console.log("\n" + "═".repeat(60));
  console.log(
    `Results: ${passedTests.length}/${testNames.length} automated tests passed`
  );
  console.log("═".repeat(60) + "\n");

  // Interactive tests
  console.log("👤 INTERACTIVE TESTS (Run manually):");
  console.log("  - window.testEmbedStage2_ImageRequest()");
  console.log("  - window.testEmbedStage2_PDFRequest()");
  console.log(
    "\nℹ️  Interactive tests require file selection and cannot be automated\n"
  );

  if (passedTests.length === testNames.length) {
    console.log("✅ 🎉 ALL STAGE 2 AUTOMATED TESTS PASSED!");
    console.log("\n💾 Full results saved to window._embedStage2Results");
  } else {
    console.warn(`⚠️  ${testNames.length - passedTests.length} tests failed`);
  }

  window._embedStage2Results = results;

  return results;
};

// ============================================================================
// QUICK TEST HELPERS
// ============================================================================

/**
 * Quick validation check for development
 */
window.quickEmbedStage2Check = function () {
  console.log("\n🔍 Quick Stage 2 Component Check");
  console.log("==================================\n");

  const checks = {
    "EmbedFileUtils class": !!window.EmbedFileUtils,
    "OpenRouterEmbed class": !!window.OpenRouterEmbed,
    "Stage 1 tests available": !!window.testEmbedStage1_All,
    "Stage 2 tests available": !!window.testEmbedStage2_All,
  };

  Object.entries(checks).forEach(([name, available]) => {
    console.log(`${available ? "✅" : "❌"} ${name}`);
  });

  const allAvailable = Object.values(checks).every((v) => v);

  console.log(
    `\n${allAvailable ? "✅ Ready to test!" : "⚠️  Some components missing"}\n`
  );

  return allAvailable;
};
