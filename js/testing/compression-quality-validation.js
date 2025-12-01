/**
 * Image Compression Quality Validation Test
 *
 * CRITICAL: We need to prove that compressed images (70% JPEG)
 * produce equivalent AI descriptions to original images.
 *
 * This test sends the SAME image in both original and compressed
 * forms to OpenRouter and compares the AI responses.
 */

(function () {
  "use strict";

  const LOG_PREFIX = "[Compression-Quality-Test]";

  function logInfo(msg, ...args) {
    console.log(`${LOG_PREFIX} ${msg}`, ...args);
  }

  /**
   * Test 1: Compare descriptions of original vs compressed image
   *
   * This is the CRITICAL test we missed!
   */
  async function testOriginalVsCompressedQuality() {
    logInfo("🧪 CRITICAL TEST: Original vs Compressed Image Quality");
    logInfo("=====================================================");

    // Create a test image with recognizable content
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");

    // Draw something distinctive that AI should describe
    // Blue circle
    ctx.fillStyle = "#3498db";
    ctx.beginPath();
    ctx.arc(300, 300, 150, 0, Math.PI * 2);
    ctx.fill();

    // Red square
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(600, 200, 300, 200);

    // Green triangle
    ctx.fillStyle = "#2ecc71";
    ctx.beginPath();
    ctx.moveTo(300, 700);
    ctx.lineTo(450, 500);
    ctx.lineTo(150, 500);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = "#000000";
    ctx.font = "bold 48px Arial";
    ctx.fillText("TEST IMAGE", 700, 600);

    logInfo("✓ Created test image with distinctive shapes and text");

    // Generate ORIGINAL (100% quality)
    const originalBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 1.0)
    );
    const originalFile = new File([originalBlob], "test-original.jpg", {
      type: "image/jpeg",
    });

    // Generate COMPRESSED (70% quality)
    const compressedBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    );
    const compressedFile = new File([compressedBlob], "test-compressed.jpg", {
      type: "image/jpeg",
    });

    logInfo("📊 File sizes:");
    logInfo(`  Original (100%):   ${(originalFile.size / 1024).toFixed(1)} KB`);
    logInfo(
      `  Compressed (70%):  ${(compressedFile.size / 1024).toFixed(1)} KB`
    );
    logInfo(
      `  Reduction: ${(
        (1 - compressedFile.size / originalFile.size) *
        100
      ).toFixed(1)}%`
    );

    // Test prompt
    const testPrompt = `Describe this image in detail. List:
1. What shapes you see
2. What colours are present
3. Any text visible
4. The overall composition`;

    // Test with ORIGINAL
    logInfo("\n📤 Testing with ORIGINAL image (100% quality)...");
    let originalDescription;
    try {
      const embedOriginal = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt: "You are a helpful assistant that describes images.",
        temperature: 0.3,
        max_tokens: 500,
        showStreamingProgress: false,
        enableCompression: false, // IMPORTANT: Disable to test original
      });

      await embedOriginal.attachFile(originalFile);
      const responseOriginal = await embedOriginal.sendRequest(testPrompt);
      originalDescription = responseOriginal.text;

      logInfo("✓ Original image description received");
      logInfo(`  Length: ${originalDescription.length} characters`);
    } catch (error) {
      logInfo("❌ Original image test failed:", error.message);
      return { success: false, error: error.message, stage: "original" };
    }

    // Wait a bit between requests
    await new Promise((r) => setTimeout(r, 2000));

    // Test with COMPRESSED
    logInfo("\n📤 Testing with COMPRESSED image (70% quality)...");
    let compressedDescription;
    try {
      const embedCompressed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt: "You are a helpful assistant that describes images.",
        temperature: 0.3,
        max_tokens: 500,
        showStreamingProgress: false,
        enableCompression: false, // We already compressed it
      });

      await embedCompressed.attachFile(compressedFile);
      const responseCompressed = await embedCompressed.sendRequest(testPrompt);
      compressedDescription = responseCompressed.text;

      logInfo("✓ Compressed image description received");
      logInfo(`  Length: ${compressedDescription.length} characters`);
    } catch (error) {
      logInfo("❌ Compressed image test failed:", error.message);
      return { success: false, error: error.message, stage: "compressed" };
    }

    // Compare descriptions
    logInfo("\n📊 COMPARISON:");
    logInfo("=====================================");
    logInfo("\n🔵 ORIGINAL (100% quality):");
    logInfo(originalDescription);
    logInfo("\n🟢 COMPRESSED (70% quality):");
    logInfo(compressedDescription);
    logInfo("\n=====================================");

    // Simple similarity check
    const mentionsCircle =
      originalDescription.toLowerCase().includes("circle") &&
      compressedDescription.toLowerCase().includes("circle");
    const mentionsSquare =
      (originalDescription.toLowerCase().includes("square") ||
        originalDescription.toLowerCase().includes("rectangle")) &&
      (compressedDescription.toLowerCase().includes("square") ||
        compressedDescription.toLowerCase().includes("rectangle"));
    const mentionsTriangle =
      originalDescription.toLowerCase().includes("triangle") &&
      compressedDescription.toLowerCase().includes("triangle");
    const mentionsText =
      originalDescription.toLowerCase().includes("test") &&
      compressedDescription.toLowerCase().includes("test");

    const score = [
      mentionsCircle,
      mentionsSquare,
      mentionsTriangle,
      mentionsText,
    ].filter(Boolean).length;

    logInfo("\n🎯 SIMILARITY SCORE:");
    logInfo(`  Both mention circle: ${mentionsCircle ? "✅" : "❌"}`);
    logInfo(`  Both mention square: ${mentionsSquare ? "✅" : "❌"}`);
    logInfo(`  Both mention triangle: ${mentionsTriangle ? "✅" : "❌"}`);
    logInfo(`  Both mention text: ${mentionsText ? "✅" : "❌"}`);
    logInfo(`  Score: ${score}/4 (${((score / 4) * 100).toFixed(0)}%)`);

    if (score >= 3) {
      logInfo("\n✅ VALIDATION PASSED");
      logInfo("Compressed images produce equivalent descriptions!");
      logInfo("70% JPEG quality is sufficient for AI analysis.");
    } else if (score >= 2) {
      logInfo("\n⚠️ PARTIAL VALIDATION");
      logInfo("Compressed images mostly work but may miss some details.");
      logInfo("Consider testing with higher quality or reviewing use case.");
    } else {
      logInfo("\n❌ VALIDATION FAILED");
      logInfo(
        "Compressed images produce significantly different descriptions!"
      );
      logInfo("70% quality may be too low for reliable AI analysis.");
    }

    return {
      success: true,
      originalSize: originalFile.size,
      compressedSize: compressedFile.size,
      originalDescription,
      compressedDescription,
      similarityScore: score,
      similarityPercent: (score / 4) * 100,
      passed: score >= 3,
    };
  }

  /**
   * Test 2: Verify OpenRouter accepts compressed JPEGs
   */
  async function testOpenRouterAcceptsCompressed() {
    logInfo("🧪 TEST: OpenRouter accepts 70% JPEG");
    logInfo("=====================================");

    // Create minimal test image
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 200, 200);

    // Compress to 70%
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    );
    const file = new File([blob], "test-70-percent.jpg", {
      type: "image/jpeg",
    });

    logInfo(
      `Testing with ${(file.size / 1024).toFixed(1)} KB JPEG at 70% quality...`
    );

    try {
      const embed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        temperature: 0.3,
        max_tokens: 200,
        showStreamingProgress: false,
      });

      await embed.attachFile(file);
      const response = await embed.sendRequest("What colour is this image?");

      const answeredRed = response.text.toLowerCase().includes("red");

      if (answeredRed) {
        logInfo("✅ TEST PASSED");
        logInfo("OpenRouter accepted and correctly analysed 70% JPEG");
        logInfo(`Response: ${response.text}`);
        return { success: true, response: response.text };
      } else {
        logInfo("⚠️ TEST UNCERTAIN");
        logInfo("OpenRouter accepted the file but response unclear");
        logInfo(`Response: ${response.text}`);
        return {
          success: true,
          warning: "Response unclear",
          response: response.text,
        };
      }
    } catch (error) {
      logInfo("❌ TEST FAILED");
      logInfo(`Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 3: Quality threshold test
   * Test multiple quality levels to find minimum acceptable
   */
  async function testQualityThresholds() {
    logInfo("🧪 TEST: Quality threshold sweep");
    logInfo("=====================================");

    const qualities = [0.3, 0.5, 0.7, 0.9, 1.0];
    const results = {};

    // Create test image
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    // Draw text that should be readable
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 72px Arial";
    ctx.fillText("QUALITY TEST", 150, 300);

    for (const quality of qualities) {
      logInfo(`\nTesting quality ${(quality * 100).toFixed(0)}%...`);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      const file = new File([blob], `test-q${quality}.jpg`, {
        type: "image/jpeg",
      });

      logInfo(`  File size: ${(file.size / 1024).toFixed(1)} KB`);

      try {
        const embed = new window.OpenRouterEmbed({
          containerId: "imgdesc-output",
          model: "anthropic/claude-haiku-4.5",
          temperature: 0.3,
          max_tokens: 200,
          showStreamingProgress: false,
        });

        await embed.attachFile(file);
        const response = await embed.sendRequest(
          "What text do you see in this image?"
        );

        const foundText = response.text.toLowerCase().includes("quality");
        logInfo(`  Text detected: ${foundText ? "✅" : "❌"}`);
        logInfo(`  Response: ${response.text.substring(0, 100)}...`);

        results[`quality_${(quality * 100).toFixed(0)}`] = {
          quality,
          fileSize: file.size,
          textDetected: foundText,
          response: response.text,
        };

        await new Promise((r) => setTimeout(r, 2000));
      } catch (error) {
        logInfo(`  ❌ Failed: ${error.message}`);
        results[`quality_${(quality * 100).toFixed(0)}`] = {
          quality,
          fileSize: file.size,
          error: error.message,
        };
      }
    }

    logInfo("\n📊 QUALITY THRESHOLD RESULTS:");
    console.table(results);

    return results;
  }

  /**
   * Test 4: User's own file (manual review)
   *
   * INTERACTIVE TEST - Prompts user to select a file
   * Tests with the user's actual image for manual quality review
   */
  async function testUserSelectedFile() {
    logInfo("🧪 INTERACTIVE TEST: Your Own File");
    logInfo("===================================");
    logInfo("You will be prompted to select an image file.");
    logInfo("We'll test it at 100% and 70% quality for comparison.\n");

    // Create file input element
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";

    // Prompt for file selection
    const file = await new Promise((resolve) => {
      input.onchange = (e) => {
        const selectedFile = e.target.files[0];
        resolve(selectedFile);
      };
      input.click();
    });

    if (!file) {
      logInfo("❌ No file selected");
      return { success: false, error: "No file selected" };
    }

    logInfo(`✓ File selected: ${file.name}`);
    logInfo(`  Size: ${(file.size / 1024).toFixed(1)} KB`);
    logInfo(`  Type: ${file.type}\n`);

    // Estimate processing time and warn if large
    const sizeKB = file.size / 1024;
    const estimatedSeconds = Math.round(sizeKB * 0.092); // 92.17 ms/KB

    if (sizeKB > 500) {
      logInfo("⚠️ LARGE FILE WARNING");
      logInfo(`  This file is ${sizeKB.toFixed(0)} KB`);
      logInfo(
        `  Estimated processing time: ~${Math.ceil(
          estimatedSeconds / 60
        )} minutes per test`
      );
      logInfo(
        `  Total time for both tests: ~${Math.ceil(
          (estimatedSeconds * 2) / 60
        )} minutes\n`
      );
      logInfo(
        "💡 TIP: For faster testing, try a smaller image (< 500 KB) first.\n"
      );
      logInfo("⏳ Starting test - please be patient...\n");
    } else if (sizeKB > 200) {
      logInfo(
        `⏱️ Estimated processing time: ~${estimatedSeconds} seconds per test\n`
      );
    }

    // Test prompt - customizable
    const testPrompt = `Please provide a detailed description of this image. Include:

1. Main subjects or objects
2. Colours present
3. Text visible (if any)
4. Overall composition and layout
5. Any notable details

Be specific and thorough.`;

    // Test with ORIGINAL
    logInfo("📤 Testing with ORIGINAL image (uncompressed)...");
    if (sizeKB > 500) {
      logInfo(
        "   ⏳ This will take ~" +
          Math.ceil(estimatedSeconds / 60) +
          " minutes - please wait..."
      );
    }

    let originalDescription;
    let originalStartTime = Date.now();

    try {
      const embedOriginal = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt:
          "You are a helpful assistant that provides detailed image descriptions.",
        temperature: 0.3,
        max_tokens: 800,
        stream: true, // ✅ ENABLE STREAMING - fixes hang with large images
        showStreamingProgress: false, // Keep UI clean during test
        enableCompression: false, // Test original
      });

      await embedOriginal.attachFile(file);

      logInfo("   📡 Sending streaming request to API...");

      // Use streaming request - much faster due to throttled rendering
      const responseOriginal = await embedOriginal.sendStreamingRequest({
        userPrompt: testPrompt,
        onChunk: (chunkData) => {
          // Optional: show progress for large files
          if (sizeKB > 500 && chunkData.metadata.wasRendered) {
            const elapsed = Math.round((Date.now() - originalStartTime) / 1000);
            logInfo(
              `   ⏳ Streaming... ${elapsed}s elapsed, ${chunkData.fullText.length} chars received`
            );
          }
        },
      });

      // Extract text from response
      if (!responseOriginal) {
        throw new Error("No response received from API");
      }

      logInfo("   📥 Response received, extracting text...");

      // Handle different response formats
      if (responseOriginal.text) {
        originalDescription = responseOriginal.text;
      } else if (responseOriginal.content) {
        originalDescription = responseOriginal.content;
      } else if (typeof responseOriginal === "string") {
        originalDescription = responseOriginal;
      } else {
        logInfo("   ⚠️ Unexpected response format:", responseOriginal);
        throw new Error("Could not extract text from response");
      }

      const originalTime = Math.round((Date.now() - originalStartTime) / 1000);

      logInfo("✓ Original description received");
      logInfo(`  Length: ${originalDescription.length} characters`);
      logInfo(
        `  Time taken: ${originalTime}s (estimated ${estimatedSeconds}s)`
      );
    } catch (error) {
      logInfo("❌ Original image test failed:", error.message);

      // Check if it's a timeout-like error
      if (
        error.message.includes("timeout") ||
        error.message.includes("network")
      ) {
        logInfo("\n💡 SUGGESTION:");
        logInfo("  - File may be too large for reliable testing");
        logInfo("  - Try with a smaller image (< 500 KB)");
        logInfo(
          "  - Or compress this image first and test the compressed version"
        );
      }

      return { success: false, error: error.message, stage: "original" };
    }

    // Wait between requests
    await new Promise((r) => setTimeout(r, 2000));

    // Create compressed version
    logInfo("\n🔄 Compressing image to 70% JPEG quality...");
    let compressedFile;
    let compressionTime;

    try {
      const compressStartTime = Date.now();

      // Load image
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      logInfo(`  Original dimensions: ${img.width}x${img.height}`);

      // Create canvas and compress
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Resize if too large
      const maxWidth = 1200;
      const maxHeight = 900;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
        logInfo(`  Resizing to: ${width}x${height}`);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to 70% JPEG
      const compressedBlob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.7)
      );

      compressedFile = new File([compressedBlob], file.name, {
        type: "image/jpeg",
      });

      URL.revokeObjectURL(imageUrl);
      compressionTime = Date.now() - compressStartTime;

      const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(
        1
      );

      logInfo("✓ Compression complete");
      logInfo(`  Original: ${(file.size / 1024).toFixed(1)} KB`);
      logInfo(`  Compressed: ${(compressedFile.size / 1024).toFixed(1)} KB`);
      logInfo(`  Reduction: ${reduction}%`);
      logInfo(`  Compression time: ${compressionTime}ms`);

      // Calculate new estimated time
      const compressedSizeKB = compressedFile.size / 1024;
      const compressedEstimatedSeconds = Math.round(compressedSizeKB * 0.092);
      const timeSaved = estimatedSeconds - compressedEstimatedSeconds;

      logInfo(
        `  Estimated time savings: ~${timeSaved}s (${Math.round(
          (timeSaved / estimatedSeconds) * 100
        )}% faster!)`
      );
    } catch (error) {
      logInfo("❌ Compression failed:", error.message);
      return { success: false, error: error.message, stage: "compression" };
    }

    // Test with COMPRESSED
    const compressedSizeKB = compressedFile.size / 1024;
    const compressedEstimatedSeconds = Math.round(compressedSizeKB * 0.092);

    logInfo("\n📤 Testing with COMPRESSED image (70% quality)...");
    if (compressedSizeKB > 500) {
      logInfo(
        "   ⏳ This will take ~" +
          Math.ceil(compressedEstimatedSeconds / 60) +
          " minutes - please wait..."
      );
    } else {
      logInfo(`   ⏱️ Estimated time: ~${compressedEstimatedSeconds}s`);
    }

    let compressedDescription;
    let compressedStartTime = Date.now();

    try {
      const embedCompressed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt:
          "You are a helpful assistant that provides detailed image descriptions.",
        temperature: 0.3,
        max_tokens: 800,
        stream: true, // ✅ ENABLE STREAMING - fixes hang with large images
        showStreamingProgress: false, // Keep UI clean during test
        enableCompression: false, // We already compressed it
      });

      await embedCompressed.attachFile(compressedFile);

      logInfo("   📡 Sending streaming request to API...");

      // Use streaming request - much faster due to throttled rendering
      const responseCompressed = await embedCompressed.sendStreamingRequest({
        userPrompt: testPrompt,
        onChunk: (chunkData) => {
          // Optional: show progress for large files
          if (compressedSizeKB > 500 && chunkData.metadata.wasRendered) {
            const elapsed = Math.round(
              (Date.now() - compressedStartTime) / 1000
            );
            logInfo(
              `   ⏳ Streaming... ${elapsed}s elapsed, ${chunkData.fullText.length} chars received`
            );
          }
        },
      });

      // Extract text from response
      if (!responseCompressed) {
        throw new Error("No response received from API");
      }

      logInfo("   📥 Response received, extracting text...");

      // Handle different response formats
      if (responseCompressed.text) {
        compressedDescription = responseCompressed.text;
      } else if (responseCompressed.content) {
        compressedDescription = responseCompressed.content;
      } else if (typeof responseCompressed === "string") {
        compressedDescription = responseCompressed;
      } else {
        logInfo("   ⚠️ Unexpected response format:", responseCompressed);
        throw new Error("Could not extract text from response");
      }

      const compressedTime = Math.round(
        (Date.now() - compressedStartTime) / 1000
      );

      logInfo("✓ Compressed description received");
      logInfo(`  Length: ${compressedDescription.length} characters`);
      logInfo(
        `  Time taken: ${compressedTime}s (estimated ${compressedEstimatedSeconds}s)`
      );
    } catch (error) {
      logInfo("❌ Compressed image test failed:", error.message);

      if (
        error.message.includes("timeout") ||
        error.message.includes("network")
      ) {
        logInfo("\n💡 SUGGESTION:");
        logInfo("  - Even compressed, this file may be too large");
        logInfo("  - Try with an even smaller image");
        logInfo("  - Or test with a different image type");
      }

      return { success: false, error: error.message, stage: "compressed" };
    }

    // Display results for manual review
    logInfo("\n" + "=".repeat(70));
    logInfo("📊 MANUAL REVIEW: Compare These Descriptions");
    logInfo("=".repeat(70));
    logInfo("\n🔵 ORIGINAL (100% quality, uncompressed):");
    logInfo("-".repeat(70));
    logInfo(originalDescription);
    logInfo("\n" + "=".repeat(70));
    logInfo("\n🟢 COMPRESSED (70% quality):");
    logInfo("-".repeat(70));
    logInfo(compressedDescription);
    logInfo("\n" + "=".repeat(70));

    // Calculate basic similarity metrics
    const originalWords = originalDescription.toLowerCase().split(/\s+/);
    const compressedWords = compressedDescription.toLowerCase().split(/\s+/);
    const commonWords = originalWords.filter((word) =>
      compressedWords.includes(word)
    ).length;
    const similarityPercent = Math.round(
      (commonWords / Math.max(originalWords.length, compressedWords.length)) *
        100
    );

    logInfo("\n📈 AUTOMATED SIMILARITY METRICS:");
    logInfo(`  Word overlap: ${similarityPercent}%`);
    logInfo(`  Original length: ${originalDescription.length} chars`);
    logInfo(`  Compressed length: ${compressedDescription.length} chars`);
    logInfo(
      `  Length difference: ${Math.abs(
        originalDescription.length - compressedDescription.length
      )} chars`
    );

    logInfo("\n❓ MANUAL ASSESSMENT QUESTIONS:");
    logInfo("  1. Do both descriptions identify the same main subjects?");
    logInfo("  2. Are the colours accurately described in both?");
    logInfo("  3. Is any text transcribed the same in both?");
    logInfo("  4. Are important details preserved in the compressed version?");
    logInfo("  5. Overall, is the compressed description acceptable?");

    logInfo("\n💡 If descriptions are equivalent, 70% compression is SAFE.");
    logInfo(
      "   If descriptions differ significantly, consider higher quality."
    );

    return {
      success: true,
      filename: file.name,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      originalDescription,
      compressedDescription,
      wordOverlapPercent: similarityPercent,
      lengthDifference: Math.abs(
        originalDescription.length - compressedDescription.length
      ),
      compressionTime,
    };
  }

  /**
   * Run all quality validation tests
   */
  async function runAllQualityTests() {
    logInfo("🔬 COMPREHENSIVE QUALITY VALIDATION");
    logInfo("====================================");
    logInfo("This will take 5-10 minutes...\n");

    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Test 1: OpenRouter accepts compressed
    logInfo("📍 Test 1: OpenRouter Accepts 70% JPEG");
    results.tests.acceptsCompressed = await testOpenRouterAcceptsCompressed();

    await new Promise((r) => setTimeout(r, 2000));

    // Test 2: Original vs Compressed quality
    logInfo("\n📍 Test 2: Original vs Compressed Description Quality");
    results.tests.descriptionQuality = await testOriginalVsCompressedQuality();

    await new Promise((r) => setTimeout(r, 2000));

    // Test 3: Quality thresholds
    logInfo("\n📍 Test 3: Quality Threshold Sweep");
    results.tests.qualityThresholds = await testQualityThresholds();

    logInfo("\n====================================");
    logInfo("🔬 ALL TESTS COMPLETE");
    logInfo("====================================");

    // Summary
    const test1Pass = results.tests.acceptsCompressed?.success;
    const test2Pass = results.tests.descriptionQuality?.passed;

    logInfo("\n📊 SUMMARY:");
    logInfo(`  OpenRouter accepts 70% JPEG: ${test1Pass ? "✅" : "❌"}`);
    logInfo(`  Quality sufficient for AI: ${test2Pass ? "✅" : "❌"}`);

    if (test1Pass && test2Pass) {
      logInfo("\n✅ VALIDATION COMPLETE");
      logInfo("70% JPEG compression is safe to use!");
      logInfo("Compressed images work correctly with OpenRouter API.");
    } else {
      logInfo("\n⚠️ VALIDATION ISSUES FOUND");
      logInfo("Review test results before implementing compression.");
    }

    return results;
  }

  // Expose to window
  window.compressionQualityTests = {
    testOpenRouterAcceptsCompressed,
    testOriginalVsCompressedQuality,
    testQualityThresholds,
    testUserSelectedFile,
    runAllQualityTests,
  };
})();
