/**
 * Image Describer - Image Size Performance Tests
 *
 * Comprehensive testing suite to identify the relationship between
 * image size and response latency in the Image Describer tool.
 *
 * HYPOTHESIS: Large image files (~500KB+) cause significant latency
 * compared to small test images (~5KB).
 *
 * This suite tests:
 * - Multiple image sizes (5KB → 1MB)
 * - Detailed timing breakdowns
 * - Compression strategies
 * - Real-world performance scenarios
 */

(function () {
  "use strict";

  const LOG_PREFIX = "[ImgSize-Perf]";

  function logInfo(msg, ...args) {
    console.log(`${LOG_PREFIX} ${msg}`, ...args);
  }

  function logTime(label, startTime) {
    const elapsed = Date.now() - startTime;
    console.log(`${LOG_PREFIX} ⏱️  ${label}: ${elapsed}ms`);
    return elapsed;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ============================================================================
  // IMAGE GENERATION UTILITIES
  // ============================================================================

  /**
   * Generate a test image of specified dimensions
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {string} content - Visual content type ('solid', 'gradient', 'complex')
   * @returns {Promise<{file: File, base64Size: number, imageSize: number}>}
   */
  async function generateTestImage(width, height, content = "gradient") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    switch (content) {
      case "solid":
        // Simple solid colour
        ctx.fillStyle = "#3498db";
        ctx.fillRect(0, 0, width, height);
        break;

      case "gradient":
        // Gradient with some detail
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#3498db");
        gradient.addColorStop(0.5, "#e74c3c");
        gradient.addColorStop(1, "#2ecc71");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        break;

      case "complex":
        // Complex pattern with lots of detail
        for (let x = 0; x < width; x += 10) {
          for (let y = 0; y < height; y += 10) {
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 10, 10);
          }
        }
        break;
    }

    // Convert to blob and file
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    const file = new File([blob], `test-${width}x${height}.jpg`, {
      type: "image/jpeg",
    });

    // Calculate base64 size (approximately 133% of original)
    const base64Size = Math.ceil((file.size * 4) / 3);

    return {
      file,
      imageSize: file.size,
      base64Size,
      dimensions: `${width}x${height}`,
    };
  }

  /**
   * Generate images of specific target sizes
   */
  const IMAGE_SIZE_CONFIGS = {
    tiny: { width: 100, height: 100, content: "solid" }, // ~5KB
    small: { width: 400, height: 300, content: "gradient" }, // ~50KB
    medium: { width: 800, height: 600, content: "complex" }, // ~250KB
    large: { width: 1200, height: 900, content: "complex" }, // ~500KB
    xlarge: { width: 1600, height: 1200, content: "complex" }, // ~1MB
  };

  // ============================================================================
  // PERFORMANCE TEST FUNCTIONS
  // ============================================================================

  /**
   * Test 1: Generate test images and measure their sizes
   */
  async function testImageGeneration() {
    logInfo("🎨 Test: Generating test images...");

    const results = {};

    for (const [name, config] of Object.entries(IMAGE_SIZE_CONFIGS)) {
      logInfo(`  Generating ${name} image...`);

      const startTime = Date.now();
      const imageData = await generateTestImage(
        config.width,
        config.height,
        config.content
      );
      const generationTime = logTime(`    ${name} generation`, startTime);

      results[name] = {
        ...imageData,
        generationTime,
        imageSizeFormatted: formatBytes(imageData.imageSize),
        base64SizeFormatted: formatBytes(imageData.base64Size),
      };

      logInfo(
        `    ✓ ${name}: ${imageData.dimensions} = ${results[name].imageSizeFormatted} (${results[name].base64SizeFormatted} base64)`
      );
    }

    logInfo("📊 Image generation summary:");
    console.table(
      Object.entries(results).map(([name, data]) => ({
        Size: name,
        Dimensions: data.dimensions,
        "Image Size": data.imageSizeFormatted,
        "Base64 Size": data.base64SizeFormatted,
      }))
    );

    return results;
  }

  /**
   * Test 2: Measure latency for different image sizes with minimal prompt
   */
  async function testImageSizeLatency() {
    logInfo("🧪 Test: Image size vs latency (minimal prompt)...");

    const results = {};
    const minimalPrompt = `You are an accessibility expert. Generate:
1. Alt text (1 sentence)
2. Long description (2-3 sentences)
Format with markdown headings.`;

    for (const [name, config] of Object.entries(IMAGE_SIZE_CONFIGS)) {
      logInfo(`  Testing ${name} image...`);

      try {
        // Generate test image
        const imageData = await generateTestImage(
          config.width,
          config.height,
          config.content
        );

        // Create embed instance
        const startTime = Date.now();
        const embed = new window.OpenRouterEmbed({
          containerId: "imgdesc-output",
          model: "anthropic/claude-haiku-4.5",
          systemPrompt: minimalPrompt,
          temperature: 0.3,
          max_tokens: 1000,
          showStreamingProgress: false,
        });

        const embedInitTime = logTime(`    ${name} embed init`, startTime);

        // Attach file
        const attachStart = Date.now();
        await embed.attachFile(imageData.file);
        const attachTime = logTime(`    ${name} file attach`, attachStart);

        // Send request with timing for first chunk
        const requestStart = Date.now();
        let firstChunkTime = null;
        let chunkCount = 0;

        const response = await embed.sendStreamingRequest({
          userPrompt: "Describe this image for accessibility.",
          onChunk: (chunk) => {
            chunkCount++;
            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              logTime(`    ${name} TTFC`, requestStart);
            }
          },
          onComplete: () => {
            logTime(`    ${name} stream complete`, requestStart);
          },
        });

        const totalTime = Date.now() - startTime;
        const timeToFirstChunk = firstChunkTime
          ? firstChunkTime - requestStart
          : null;

        results[name] = {
          success: true,
          imageSize: imageData.imageSize,
          base64Size: imageData.base64Size,
          embedInitTime,
          attachTime,
          timeToFirstChunk,
          totalTime,
          chunkCount,
          responseLength: response?.text?.length || 0,
        };

        logInfo(
          `    ✓ ${name}: Total ${totalTime}ms (TTFC: ${timeToFirstChunk}ms)`
        );

        // Cleanup
        embed.clearFile();

        // Wait between tests
        await new Promise((r) => setTimeout(r, 2000));
      } catch (error) {
        logInfo(`    ✗ ${name}: ${error.message}`);
        results[name] = { success: false, error: error.message };
      }
    }

    // Summary table
    logInfo("📊 Image size latency results:");
    console.table(
      Object.entries(results)
        .filter(([_, data]) => data.success)
        .map(([name, data]) => ({
          Size: name,
          "Image KB": (data.imageSize / 1024).toFixed(1),
          "Base64 KB": (data.base64Size / 1024).toFixed(1),
          "Init (ms)": data.embedInitTime,
          "Attach (ms)": data.attachTime,
          "TTFC (ms)": data.timeToFirstChunk,
          "Total (ms)": data.totalTime,
        }))
    );

    return results;
  }

  /**
   * Test 3: Compare compression quality vs latency
   */
  async function testCompressionImpact() {
    logInfo("🧪 Test: JPEG compression quality vs latency...");

    const results = {};
    const dimensions = { width: 1200, height: 900 };
    const qualities = [0.3, 0.5, 0.7, 0.9];

    const minimalPrompt = `Describe this image in 2 sentences.`;

    for (const quality of qualities) {
      const qualityLabel = `quality_${(quality * 100).toFixed(0)}`;
      logInfo(`  Testing JPEG quality ${quality * 100}%...`);

      try {
        // Generate image with specific quality
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const ctx = canvas.getContext("2d");

        // Complex pattern
        for (let x = 0; x < dimensions.width; x += 20) {
          for (let y = 0; y < dimensions.height; y += 20) {
            ctx.fillStyle = `hsl(${(x + y) % 360}, 70%, 60%)`;
            ctx.fillRect(x, y, 20, 20);
          }
        }

        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality)
        );

        const file = new File([blob], `test-q${quality}.jpg`, {
          type: "image/jpeg",
        });

        // Test with this quality
        const startTime = Date.now();
        const embed = new window.OpenRouterEmbed({
          containerId: "imgdesc-output",
          model: "anthropic/claude-haiku-4.5",
          systemPrompt: minimalPrompt,
          temperature: 0.3,
          max_tokens: 500,
          showStreamingProgress: false,
        });

        await embed.attachFile(file);

        let firstChunkTime = null;
        const requestStart = Date.now();

        await embed.sendStreamingRequest({
          userPrompt: "Describe this.",
          onChunk: () => {
            if (!firstChunkTime) firstChunkTime = Date.now();
          },
        });

        const totalTime = Date.now() - startTime;

        results[qualityLabel] = {
          quality: quality * 100,
          fileSize: file.size,
          fileSizeKB: (file.size / 1024).toFixed(1),
          timeToFirstChunk: firstChunkTime
            ? firstChunkTime - requestStart
            : null,
          totalTime,
        };

        logInfo(
          `    ✓ Q${quality * 100}: ${(file.size / 1024).toFixed(
            1
          )}KB → ${totalTime}ms`
        );

        embed.clearFile();
        await new Promise((r) => setTimeout(r, 2000));
      } catch (error) {
        logInfo(`    ✗ Q${quality * 100}: ${error.message}`);
        results[qualityLabel] = { success: false, error: error.message };
      }
    }

    logInfo("📊 Compression quality results:");
    console.table(results);

    return results;
  }

  /**
   * Test 4: Upload a real user image (if provided)
   */
  async function testRealWorldImage(imageFile) {
    if (!imageFile) {
      logInfo("ℹ️  No real-world image provided - skipping test");
      return null;
    }

    logInfo("🧪 Test: Real-world image performance...");
    logInfo(
      `  Testing file: ${imageFile.name} (${formatBytes(imageFile.size)})`
    );

    const minimalPrompt = `Generate alt text and long description. Be concise.`;

    try {
      const startTime = Date.now();

      const embed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt: minimalPrompt,
        temperature: 0.3,
        max_tokens: 1000,
        showStreamingProgress: false,
      });

      const embedInitTime = logTime("  Embed init", startTime);

      const attachStart = Date.now();
      await embed.attachFile(imageFile);
      const attachTime = logTime("  File attach", attachStart);

      let firstChunkTime = null;
      const requestStart = Date.now();

      const response = await embed.sendStreamingRequest({
        userPrompt: "Describe this image for accessibility.",
        onChunk: () => {
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            logTime("  TTFC", requestStart);
          }
        },
        onComplete: () => {
          logTime("  Stream complete", requestStart);
        },
      });

      const totalTime = Date.now() - startTime;

      const result = {
        success: true,
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileSizeFormatted: formatBytes(imageFile.size),
        embedInitTime,
        attachTime,
        timeToFirstChunk: firstChunkTime ? firstChunkTime - requestStart : null,
        totalTime,
        responseLength: response?.text?.length || 0,
      };

      logInfo("📊 Real-world image results:");
      console.table({
        File: result.fileName,
        Size: result.fileSizeFormatted,
        "Init (ms)": result.embedInitTime,
        "Attach (ms)": result.attachTime,
        "TTFC (ms)": result.timeToFirstChunk,
        "Total (ms)": result.totalTime,
      });

      return result;
    } catch (error) {
      logInfo(`  ✗ Real-world test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 5: Measure base64 conversion overhead
   */
  async function testBase64ConversionOverhead() {
    logInfo("🧪 Test: Base64 conversion overhead...");

    const results = {};

    for (const [name, config] of Object.entries(IMAGE_SIZE_CONFIGS)) {
      logInfo(`  Testing ${name} image conversion...`);

      try {
        const imageData = await generateTestImage(
          config.width,
          config.height,
          config.content
        );

        // Measure FileReader conversion time
        const startTime = Date.now();

        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = reader.result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageData.file);
        });

        const conversionTime = logTime(`    ${name} conversion`, startTime);

        results[name] = {
          imageSize: imageData.imageSize,
          base64Length: base64.length,
          conversionTime,
          overhead:
            (
              ((base64.length - imageData.imageSize) / imageData.imageSize) *
              100
            ).toFixed(1) + "%",
        };

        logInfo(
          `    ✓ ${name}: ${conversionTime}ms (${results[name].overhead} overhead)`
        );
      } catch (error) {
        logInfo(`    ✗ ${name}: ${error.message}`);
        results[name] = { success: false, error: error.message };
      }
    }

    logInfo("📊 Base64 conversion results:");
    console.table(
      Object.entries(results).map(([name, data]) => ({
        Size: name,
        "Image KB": (data.imageSize / 1024).toFixed(1),
        "Base64 KB": (data.base64Length / 1024).toFixed(1),
        "Time (ms)": data.conversionTime,
        Overhead: data.overhead,
      }))
    );

    return results;
  }

  /**
   * Comprehensive diagnostics - runs all tests
   */
  async function runComprehensiveDiagnostics(realWorldImage = null) {
    logInfo("🔬 COMPREHENSIVE IMAGE SIZE DIAGNOSTICS");
    logInfo("==========================================");

    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Test 1: Image generation
    logInfo("\n📍 Test 1: Image Generation");
    results.tests.imageGeneration = await testImageGeneration();

    await new Promise((r) => setTimeout(r, 1000));

    // Test 2: Image size latency
    logInfo("\n📍 Test 2: Image Size vs Latency");
    results.tests.imageSizeLatency = await testImageSizeLatency();

    await new Promise((r) => setTimeout(r, 1000));

    // Test 3: Compression impact
    logInfo("\n📍 Test 3: Compression Quality Impact");
    results.tests.compressionImpact = await testCompressionImpact();

    await new Promise((r) => setTimeout(r, 1000));

    // Test 4: Real-world image (if provided)
    if (realWorldImage) {
      logInfo("\n📍 Test 4: Real-World Image");
      results.tests.realWorldImage = await testRealWorldImage(realWorldImage);
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Test 5: Base64 conversion
    logInfo("\n📍 Test 5: Base64 Conversion Overhead");
    results.tests.base64Conversion = await testBase64ConversionOverhead();

    // Analysis summary
    logInfo("\n==========================================");
    logInfo("🔬 DIAGNOSTICS COMPLETE");
    logInfo("==========================================");

    // Calculate insights
    const latencyResults = results.tests.imageSizeLatency;
    if (latencyResults) {
      const successful = Object.entries(latencyResults).filter(
        ([_, data]) => data.success
      );

      if (successful.length > 1) {
        const smallest = successful[0];
        const largest = successful[successful.length - 1];

        const sizeRatio = (
          largest[1].imageSize / smallest[1].imageSize
        ).toFixed(1);
        const latencyRatio = (
          largest[1].totalTime / smallest[1].totalTime
        ).toFixed(1);

        logInfo("\n📊 KEY INSIGHTS:");
        logInfo(
          `   Image size increased ${sizeRatio}x (${formatBytes(
            smallest[1].imageSize
          )} → ${formatBytes(largest[1].imageSize)})`
        );
        logInfo(
          `   Latency increased ${latencyRatio}x (${smallest[1].totalTime}ms → ${largest[1].totalTime}ms)`
        );
        logInfo(
          `   Latency per KB: ${(
            largest[1].totalTime /
            (largest[1].imageSize / 1024)
          ).toFixed(2)}ms/KB`
        );
      }
    }

    return results;
  }

  /**
   * Quick test with a single large image
   */
  async function testSingleLargeImage() {
    logInfo("🧪 Quick Test: Single Large Image (~500KB)");

    const config = IMAGE_SIZE_CONFIGS.large;
    const imageData = await generateTestImage(
      config.width,
      config.height,
      config.content
    );

    logInfo(
      `📸 Generated test image: ${formatBytes(imageData.imageSize)} (${
        imageData.dimensions
      })`
    );

    const minimalPrompt = `Describe this image concisely.`;

    try {
      const startTime = Date.now();

      const embed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt: minimalPrompt,
        temperature: 0.3,
        max_tokens: 500,
        showStreamingProgress: true,
      });

      const embedInitTime = logTime("Embed init", startTime);

      const attachStart = Date.now();
      await embed.attachFile(imageData.file);
      const attachTime = logTime("File attach", attachStart);

      let firstChunkTime = null;
      const requestStart = Date.now();

      await embed.sendStreamingRequest({
        userPrompt: "Describe this image.",
        onChunk: () => {
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            logTime("TTFC", requestStart);
          }
        },
        onComplete: () => {
          logTime("Stream complete", requestStart);
        },
      });

      const totalTime = Date.now() - startTime;

      logInfo("\n✅ Test Complete:");
      logInfo(`   Total time: ${totalTime}ms`);
      logInfo(`   Image size: ${formatBytes(imageData.imageSize)}`);
      logInfo(`   Init: ${embedInitTime}ms`);
      logInfo(`   Attach: ${attachTime}ms`);
      logInfo(`   TTFC: ${firstChunkTime - requestStart}ms`);

      return {
        success: true,
        totalTime,
        imageSize: imageData.imageSize,
        embedInitTime,
        attachTime,
        timeToFirstChunk: firstChunkTime - requestStart,
      };
    } catch (error) {
      logInfo(`\n❌ Test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // EXPOSE TO WINDOW
  // ============================================================================

  window.imgSizeTests = {
    // Image generation
    generateTestImage,
    testImageGeneration,

    // Performance tests
    testImageSizeLatency,
    testCompressionImpact,
    testRealWorldImage,
    testBase64ConversionOverhead,

    // Convenience tests
    testSingleLargeImage,
    runComprehensiveDiagnostics,

    // Utilities
    IMAGE_SIZE_CONFIGS,
    formatBytes,
  };
})();
