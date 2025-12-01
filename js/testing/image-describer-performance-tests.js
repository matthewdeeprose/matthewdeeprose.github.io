/**
 * Image Describer Performance Diagnostics
 * Tests to identify latency sources in image description generation
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_PREFIX = "[ImgDesc-Perf]";

  function logInfo(msg, ...args) {
    console.log(`${LOG_PREFIX} ${msg}`, ...args);
  }

  function logTime(label, startTime) {
    const elapsed = Date.now() - startTime;
    console.log(`${LOG_PREFIX} ⏱️ ${label}: ${elapsed}ms`);
    return elapsed;
  }

  // ============================================================================
  // TEST SYSTEM PROMPTS (varying sizes)
  // ============================================================================

  const PROMPTS = {
    // Minimal prompt - just the essentials
    minimal: `You are an accessibility expert. Generate image descriptions with:
1. A concise alt text (1-2 sentences)
2. A detailed long description
3. Any visible text content

Use British English spelling. Format with markdown headings.`,

    // Short prompt - core instructions only
    short: `You are an accessibility expert creating image descriptions for educational content.

## Output Format
Use these exact headings:
# Title
## Alt Text
## Long Description
### Visual Content
### Educational Significance
## Text Content

## Guidelines
- Use British English spelling throughout
- Be descriptive but concise
- Focus on educational value
- Note colours where meaningful
- Describe spatial relationships clearly`,

    // Medium prompt - with some formatting guidance
    medium: `You are an accessibility expert creating image descriptions for UK higher education.

## Output Structure
# Title (brief, descriptive)
---
## Alt Text
Concise 1-2 sentence description suitable for screen readers.
---
## Long Description
### Visual Content
Detailed description of what the image shows.
### Educational Significance  
How this image supports learning objectives.
---
## Text Content
Transcribe any visible text, or state "No text content in image."

## Style Guidelines
- Use British English (colour, centre, organise)
- Be objective and descriptive
- Include colours where they convey meaning
- Describe spatial relationships
- Focus on educational relevance`,
  };

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  /**
   * Test 1: Measure system prompt token estimation
   */
  async function testPromptSizes() {
    logInfo("📊 Testing prompt sizes...");

    const results = {};

    for (const [name, prompt] of Object.entries(PROMPTS)) {
      // Rough token estimate (chars / 4)
      const estimatedTokens = Math.ceil(prompt.length / 4);
      results[name] = {
        chars: prompt.length,
        estimatedTokens: estimatedTokens,
        prompt: prompt.substring(0, 100) + "...",
      };
      logInfo(`  ${name}: ${prompt.length} chars (~${estimatedTokens} tokens)`);
    }

    // Get current full prompt size
    if (window.ImageDescriberController?.buildSystemPrompt) {
      try {
        const fullPrompt = window.ImageDescriberController.buildSystemPrompt();
        const fullTokens = Math.ceil(fullPrompt.length / 4);
        results.current_full = {
          chars: fullPrompt.length,
          estimatedTokens: fullTokens,
        };
        logInfo(
          `  CURRENT FULL: ${fullPrompt.length} chars (~${fullTokens} tokens)`
        );
      } catch (e) {
        logInfo("  Could not get current full prompt:", e.message);
      }
    }

    return results;
  }

  /**
   * Test 2: API request with minimal prompt (no image)
   */
  async function testMinimalRequest() {
    logInfo("🧪 Test: Minimal text request (no image, minimal prompt)...");

    const startTime = Date.now();

    try {
      // Create minimal embed instance
      const embed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt: PROMPTS.minimal,
        temperature: 0.3,
        max_tokens: 500,
      });

      logTime("Embed initialised", startTime);

      const requestStart = Date.now();
      const response = await embed.sendRequest(
        "Describe a simple red circle on a white background."
      );

      const totalTime = logTime("Total request time", requestStart);

      return {
        success: true,
        totalTime,
        responseLength: response?.text?.length || 0,
      };
    } catch (error) {
      logInfo("❌ Test failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 3: API request with different prompt sizes
   */
  async function testPromptSizeImpact() {
    logInfo("🧪 Test: Prompt size impact on latency...");

    const results = {};
    const testMessage = "Describe a simple blue square.";

    for (const [name, prompt] of Object.entries(PROMPTS)) {
      logInfo(`  Testing "${name}" prompt...`);

      const startTime = Date.now();

      try {
        const embed = new window.OpenRouterEmbed({
          containerId: "imgdesc-output",
          model: "anthropic/claude-haiku-4.5",
          systemPrompt: prompt,
          temperature: 0.3,
          max_tokens: 500,
        });

        const response = await embed.sendRequest(testMessage);
        const elapsed = Date.now() - startTime;

        results[name] = {
          time: elapsed,
          promptTokens: Math.ceil(prompt.length / 4),
          success: true,
        };

        logInfo(`    ✅ ${name}: ${elapsed}ms`);

        // Small delay between tests
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        results[name] = { success: false, error: error.message };
        logInfo(`    ❌ ${name}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Test 4: Image request with minimal prompt
   */
  async function testImageWithMinimalPrompt(imageFile) {
    logInfo("🧪 Test: Image request with MINIMAL prompt...");

    if (!imageFile) {
      // Create a tiny test image
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(25, 25, 50, 50);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      imageFile = new File([blob], "test-red-square.png", {
        type: "image/png",
      });
      logInfo("  Created test image (100x100 red square)");
    }

    const startTime = Date.now();

    try {
      const embed = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: "anthropic/claude-haiku-4.5",
        systemPrompt: PROMPTS.minimal,
        temperature: 0.3,
        max_tokens: 1000,
      });

      logTime("Embed initialised", startTime);

      // Attach file
      const attachStart = Date.now();
      await embed.attachFile(imageFile);
      logTime("File attached", attachStart);

      // Send streaming request
      const requestStart = Date.now();
      let firstChunkTime = null;

      const response = await embed.sendStreamingRequest({
        userPrompt: "Describe this image for accessibility purposes.",
        onChunk: (chunk) => {
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            logTime("Time to first chunk", requestStart);
          }
        },
        onComplete: () => {
          logTime("Stream complete", requestStart);
        },
      });

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        totalTime,
        timeToFirstChunk: firstChunkTime ? firstChunkTime - requestStart : null,
        responseLength: response?.text?.length || 0,
        promptSize: PROMPTS.minimal.length,
      };
    } catch (error) {
      logInfo("❌ Test failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 5: Compare current vs minimal prompt with same image
   */
  async function testCurrentVsMinimal() {
    logInfo("🧪 Test: Current prompt vs Minimal prompt comparison...");

    // Create test image
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3498db";
    ctx.beginPath();
    ctx.arc(100, 100, 80, 0, Math.PI * 2);
    ctx.fill();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    const testFile = new File([blob], "test-circle.png", { type: "image/png" });

    const results = {};

    // Test with minimal prompt
    logInfo("  Testing with MINIMAL prompt...");
    results.minimal = await testImageWithMinimalPrompt(testFile);

    await new Promise((r) => setTimeout(r, 2000)); // Wait between tests

    // Test with current controller (if available)
    if (window.ImageDescriberController) {
      logInfo("  Testing with CURRENT (full) prompt...");

      const startTime = Date.now();

      try {
        // Store original file
        window.ImageDescriberController.currentFile = testFile;

        // Convert to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
        });
        reader.readAsDataURL(testFile);
        window.ImageDescriberController.currentBase64 = await base64Promise;

        // Get timing for full generation
        let firstChunkTime = null;
        const originalOnChunk =
          window.ImageDescriberController.embedInstance?.streamingCallbacks
            ?.onChunk;

        // Trigger generation
        await window.ImageDescriberController.generate();

        results.current = {
          success: true,
          totalTime: Date.now() - startTime,
          note: "Used full controller flow",
        };
      } catch (error) {
        results.current = { success: false, error: error.message };
      }
    }

    // Summary
    logInfo("📊 COMPARISON RESULTS:");
    if (results.minimal?.success) {
      logInfo(
        `  Minimal prompt: ${results.minimal.totalTime}ms (TTFC: ${results.minimal.timeToFirstChunk}ms)`
      );
    }
    if (results.current?.success) {
      logInfo(`  Current prompt: ${results.current.totalTime}ms`);
    }

    return results;
  }

  /**
   * Run all diagnostics
   */
  async function runAllDiagnostics() {
    logInfo("🔬 STARTING PERFORMANCE DIAGNOSTICS");
    logInfo("=====================================");

    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Test 1: Prompt sizes
    results.tests.promptSizes = await testPromptSizes();

    // Test 2: Minimal request
    results.tests.minimalRequest = await testMinimalRequest();

    await new Promise((r) => setTimeout(r, 1000));

    // Test 3: Prompt size impact
    results.tests.promptSizeImpact = await testPromptSizeImpact();

    await new Promise((r) => setTimeout(r, 1000));

    // Test 4: Image with minimal prompt
    results.tests.imageMinimal = await testImageWithMinimalPrompt();

    logInfo("=====================================");
    logInfo("🔬 DIAGNOSTICS COMPLETE");
    logInfo("Results:", results);

    return results;
  }

  // ============================================================================
  // EXPOSE TO WINDOW
  // ============================================================================

  window.imgDescPerf = {
    PROMPTS,
    testPromptSizes,
    testMinimalRequest,
    testPromptSizeImpact,
    testImageWithMinimalPrompt,
    testCurrentVsMinimal,
    runAllDiagnostics,
  };
})();
