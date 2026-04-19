/**
 * @fileoverview Image Describer Test Harness
 * @module ImageDescriberTestHarness
 * @version 1.0.0
 *
 * Automates evaluation of AI-generated image descriptions across multiple
 * model combinations. Drives description generation, runs ground truth
 * checklist evaluation, and optionally sends results to an AI evaluator
 * for structured scoring.
 *
 * Architecture:
 * - Uses controller methods for prompt building (tests actual prompts)
 * - Calls OpenRouter API directly via fetch (skips UI/streaming for speed)
 * - Temporarily sets form context from test image data, then restores
 *
 * Usage:
 *   1. Load test images: window.listTestImages()
 *   2. Dry run first:    window.dryRun("piston-cylinder", "anthropic/claude-haiku-4.5")
 *   3. Single test:      window.runTest("piston-cylinder", "anthropic/claude-haiku-4.5")
 *   4. Full matrix:      window.runMatrix()
 *   5. View results:     window.showTestMatrix()
 *   6. AI evaluation:    window.evaluateResult("result-key")
 *
 * @requires ImageDescriberController - Controller with prompt building methods
 * @requires OpenRouter API key in localStorage
 *
 * @accessibility WCAG 2.2 AA compliant (console tool — no UI)
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ImgDescTestHarness] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImgDescTestHarness] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImgDescTestHarness] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImgDescTestHarness] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const HARNESS_CONFIG = {
    /** Model used for AI evaluation (Tier 2). Opus for highest quality. */
    EVALUATOR_MODEL: "anthropic/claude-opus-4-6",

    /** OpenRouter API endpoint */
    API_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",

    /** Max tokens for description generation */
    MAX_TOKENS_DESCRIPTION: 8000,

/** Max tokens for verification pass */
    MAX_TOKENS_VERIFICATION: 8000,

    /** Max tokens for AI evaluator response */
    MAX_TOKENS_EVALUATOR: 8000,

    /** Temperature for description generation (matches controller) */
    TEMPERATURE_DESCRIPTION: 0.3,

    /** Temperature for verification (matches controller) */
    TEMPERATURE_VERIFICATION: 0.3,

    /** Temperature for evaluator (low for consistency) */
    TEMPERATURE_EVALUATOR: 0.2,

    /** localStorage key for persisting results */
    STORAGE_KEY: "imgdesc-test-harness-v1",

    /** Auto-download JSON after each evaluation */
    AUTO_DOWNLOAD: true,

    /** Delay between matrix runs (ms) to avoid rate limiting */
    MATRIX_DELAY_MS: 2000,

    /** Path to test images JSON file */
    TEST_IMAGES_PATH:
      "image-describer/testing/image-describer-test-images.json",

    /** Max tokens for description with reasoning (must accommodate thinking + output) */
    MAX_TOKENS_DESCRIPTION_REASONING: 16000,

    /** Max tokens for verification with reasoning */
    MAX_TOKENS_VERIFICATION_REASONING: 8000,

    /** Prompt repetition modes: 'none', 'full', 'verbose', 'context-echo' */
    PROMPT_REPETITION_MODE: "none",
  };

  // ============================================================================
  // DEFAULT TEST MATRIX
  // ============================================================================

  /**
   * Default test combinations.
   * Format: [imageKey, descriptionModel, verificationModel|null, verifyEnabled]
   */
  const DEFAULT_MATRIX = [
    // Haiku descriptions — no verification
    ["piston-cylinder", "anthropic/claude-haiku-4.5", null, false],
    ["pv-diagram", "anthropic/claude-haiku-4.5", null, false],

    // Haiku descriptions — haiku verification (cheapest two-pass)
    [
      "piston-cylinder",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-haiku-4.5",
      true,
    ],
    [
      "pv-diagram",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-haiku-4.5",
      true,
    ],

    // Haiku descriptions — opus verification (cheap desc, smart verify)
    [
      "piston-cylinder",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-opus-4-6",
      true,
    ],
    [
      "pv-diagram",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-opus-4-6",
      true,
    ],

    // Opus descriptions — haiku verification (smart desc, cheap verify)
    [
      "piston-cylinder",
      "anthropic/claude-opus-4-6",
      "anthropic/claude-haiku-4.5",
      true,
    ],
    [
      "pv-diagram",
      "anthropic/claude-opus-4-6",
      "anthropic/claude-haiku-4.5",
      true,
    ],
  ];

  /** Cheap matrix — haiku only for fast iteration */
  const CHEAP_MATRIX = [
    ["piston-cylinder", "anthropic/claude-haiku-4.5", null, false],
    ["pv-diagram", "anthropic/claude-haiku-4.5", null, false],
    [
      "piston-cylinder",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-haiku-4.5",
      true,
    ],
    [
      "pv-diagram",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-haiku-4.5",
      true,
    ],
  ];

  // ============================================================================
  // STATE
  // ============================================================================

  /** Loaded test images from JSON */
  let testImages = {};

  /** Whether test images have been loaded */
  let imagesLoaded = false;

  /** All stored results (in-memory + localStorage) */
  let allResults = {};

  /** Saved form state for restoration after test runs */
  let savedFormState = null;

  // ============================================================================
  // TEST IMAGE LOADING
  // ============================================================================

  /**
   * Load test images from the JSON registry file.
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async function loadTestImages() {
    if (imagesLoaded && Object.keys(testImages).length > 0) {
      logDebug("Test images already loaded");
      return true;
    }

    try {
      const response = await fetch(HARNESS_CONFIG.TEST_IMAGES_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load test images: ${response.status}`);
      }

      const data = await response.json();
      testImages = data.images || {};
      imagesLoaded = true;

      const imageCount = Object.keys(testImages).length;
      const withBase64 = Object.values(testImages).filter(
        (img) => img.base64 && img.base64.length > 0,
      ).length;

      logInfo(
        `Loaded ${imageCount} test images (${withBase64} with base64 data)`,
      );
      return true;
    } catch (error) {
      logError("Failed to load test images:", error);
      return false;
    }
  }

  /**
   * Get a test image by key, loading from JSON if needed.
   * @param {string} key - Image key (e.g. "piston-cylinder")
   * @returns {Promise<object|null>} Image data or null
   */
  async function getTestImage(key) {
    if (!imagesLoaded) {
      await loadTestImages();
    }

    const image = testImages[key];
    if (!image) {
      logError(`Test image not found: "${key}"`);
      logInfo("Available images:", Object.keys(testImages));
      return null;
    }

    if (!image.base64 || image.base64.length === 0) {
      logWarn(
        `Test image "${key}" has no base64 data. Use addTestImage() to provide it.`,
      );
      return null;
    }

return image;
  }

  // ============================================================================
  // ANALYSIS INTEGRATION (Phase 3)
  // ============================================================================

  /**
   * Run the image analyser on a test image and return the result.
   * Constructs a data URL from the test image's base64 data and passes
   * it to ImageDescriberAnalyser.analyse().
   *
   * @param {string} imageKey - Test image key (e.g. "piston-cylinder")
   * @param {string} [profileName='default'] - Analysis profile name
   * @returns {Promise<object|null>} Analysis result, or null if analyser unavailable
   */
  async function runAnalysisForTestImage(imageKey, profileName) {
    const analyser = window.ImageDescriberAnalyser;
    if (!analyser || !analyser.isAvailable()) {
      logWarn("ImageDescriberAnalyser not available — skipping analysis");
      return null;
    }

    const image = await getTestImage(imageKey);
    if (!image) {
      logError(`Cannot run analysis: test image "${imageKey}" not found`);
      return null;
    }

    if (!image.base64 || !image.mimeType) {
      logError(`Cannot run analysis: test image "${imageKey}" has no base64 data`);
      return null;
    }

    const dataUrl = "data:" + image.mimeType + ";base64," + image.base64;

    logInfo(`Running analysis on "${imageKey}" (profile: ${profileName || "default"})...`);
    const startTime = performance.now();

    try {
      const result = await analyser.analyse(dataUrl, profileName || "default");
      const elapsed = Math.round(performance.now() - startTime);

      logInfo(
        `Analysis complete for "${imageKey}": ` +
        `${result.ocr?.items?.length || 0} OCR items, ` +
        `${result.colour?.regions?.length || 0} colour regions, ` +
        `${elapsed}ms`
      );

      return result;
    } catch (error) {
      logError(`Analysis failed for "${imageKey}":`, error);
      return null;
    }
  }

  // ============================================================================
  // FORM CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Save the current form state so we can restore it after a test run.
   * @returns {object} Saved state
   */
  function saveFormState() {
    const state = {
      subject: document.getElementById("imgdesc-subject")?.value || "",
      topic: document.getElementById("imgdesc-topic")?.value || "",
      objective: document.getElementById("imgdesc-objective")?.value || "",
      module: document.getElementById("imgdesc-module")?.value || "",
      context: document.getElementById("imgdesc-context")?.value || "",
      audience: document.getElementById("imgdesc-audience")?.value || "",
      style:
        document.querySelector('input[name="imgdesc-style"]:checked')?.value ||
        "",
      checkboxes: {},
    };

    // Save checkbox states
    const config = window.imageDescriberConfig;
    if (config?.checkboxOptions) {
      config.checkboxOptions.forEach((opt) => {
        const cb = document.getElementById(`imgdesc-${opt.id}`);
        if (cb) {
          state.checkboxes[opt.id] = cb.checked;
        }
      });
    }

    logDebug("Form state saved");
    return state;
  }

  /**
   * Restore form state from a previously saved snapshot.
   * @param {object} state - Saved form state
   */
  function restoreFormState(state) {
    if (!state) return;

    const mappings = {
      subject: "imgdesc-subject",
      topic: "imgdesc-topic",
      objective: "imgdesc-objective",
      module: "imgdesc-module",
      context: "imgdesc-context",
    };

    for (const [key, elementId] of Object.entries(mappings)) {
      const el = document.getElementById(elementId);
      if (el && state[key] !== undefined) {
        el.value = state[key];
      }
    }

    // Restore audience
    const audienceEl = document.getElementById("imgdesc-audience");
    if (audienceEl && state.audience) {
      audienceEl.value = state.audience;
    }

    // Restore style radio
    if (state.style) {
      const radio = document.querySelector(
        `input[name="imgdesc-style"][value="${state.style}"]`,
      );
      if (radio) radio.checked = true;
    }

    // Restore checkboxes
    if (state.checkboxes) {
      for (const [id, checked] of Object.entries(state.checkboxes)) {
        const cb = document.getElementById(`imgdesc-${id}`);
        if (cb) cb.checked = checked;
      }
    }

    logDebug("Form state restored");
  }

  /**
   * Set form context from a test image's context object.
   * @param {object} context - Test image context fields
   */
  function setFormContext(context) {
    const mappings = {
      subject: "imgdesc-subject",
      topic: "imgdesc-topic",
      objective: "imgdesc-objective",
      module: "imgdesc-module",
      additionalContext: "imgdesc-context",
    };

    // Set text inputs
    for (const [key, elementId] of Object.entries(mappings)) {
      const el = document.getElementById(elementId);
      if (el && context[key] !== undefined) {
        el.value = context[key];
      }
    }

    // Set audience dropdown
    const audienceEl = document.getElementById("imgdesc-audience");
    if (audienceEl && context.audience) {
      audienceEl.value = context.audience;
    }

    // Set style radio
    if (context.style) {
      const radio = document.querySelector(
        `input[name="imgdesc-style"][value="${context.style}"]`,
      );
      if (radio) radio.checked = true;
    }

    // Set checkboxes to defaults from config (reset to known state)
    const config = window.imageDescriberConfig;
    if (config?.checkboxOptions) {
      config.checkboxOptions.forEach((opt) => {
        const cb = document.getElementById(`imgdesc-${opt.id}`);
        if (cb) {
          cb.checked = opt.default || false;
        }
      });
    }

    logDebug("Form context set from test image");
  }

  // ============================================================================
  // REASONING CONFIGURATION
  // ============================================================================

  /**
   * Build reasoning config for a given model ID.
   * Opus uses adaptive mode (no effort parameter).
   * Sonnet and Haiku use effort-based mode with "high".
   *
   * @param {string} modelId - Full model ID (e.g. "anthropic/claude-haiku-4.5")
   * @returns {object} Reasoning config: { enabled: true, effort?: "high" }
   */
  function buildTestReasoningConfig(modelId) {
    // Opus 4.6: adaptive mode (no effort, no max_tokens constraint)
    if (modelId.includes("opus")) {
      return { enabled: true };
    }

    // Sonnet 4.5: effort-based
    if (modelId.includes("sonnet")) {
      return { enabled: true, effort: "high" };
    }

    // Haiku 4.5: effort-based
    if (modelId.includes("haiku")) {
      return { enabled: true, effort: "high" };
    }

    // Unknown model — send enabled, let API decide
    return { enabled: true };
  }

  // ============================================================================
  // PROMPT REPETITION
  // ============================================================================

  /**
   * Apply prompt repetition to a user prompt.
   * Based on research by Leviathan, Kalman & Matias (Google Research, 2025)
   * showing that repeating the user prompt improves non-reasoning LLM accuracy.
   *
   * Modes:
   * - "none": No repetition (returns original)
   * - "full": Appends the full prompt a second time
   * - "verbose": Appends with a "Let me repeat that:" separator
   * - "context-echo": Appends only the context fields as a summary
   *
   * @param {string} userPrompt - Original user prompt
   * @param {string} mode - Repetition mode
   * @param {object} [context] - Form context fields (required for "context-echo" mode)
   * @returns {string} Modified user prompt
   */
  function applyPromptRepetition(userPrompt, mode, context) {
    if (!mode || mode === "none") {
      return userPrompt;
    }

    switch (mode) {
      case "full":
        return userPrompt + "\n\n" + userPrompt;

      case "verbose":
        return userPrompt + "\n\nLet me repeat that:\n\n" + userPrompt;

      case "context-echo": {
        if (!context) {
          logWarn(
            "context-echo mode requires context object; falling back to no repetition",
          );
          return userPrompt;
        }

        const echoLines = [
          "",
          "---",
          "To confirm, the key context for this description:",
        ];

        if (context.subject) {
          echoLines.push(`**Subject Area:** ${context.subject}`);
        }
        if (context.topic) {
          echoLines.push(`**Topic:** ${context.topic}`);
        }
        if (context.objective) {
          echoLines.push(`**Learning Objective:** ${context.objective}`);
        }
        if (context.module) {
          echoLines.push(`**Module:** ${context.module}`);
        }

        // Include audience label if set
        const audienceEl = document.getElementById("imgdesc-audience");
        if (audienceEl?.value) {
          const selectedOption =
            audienceEl.options[audienceEl.selectedIndex]?.text ||
            audienceEl.value;
          echoLines.push(`**Audience:** ${selectedOption}`);
        }

        // Only append if we have at least one context field
        if (echoLines.length <= 3) {
          logWarn(
            "context-echo: no context fields found; falling back to no repetition",
          );
          return userPrompt;
        }

        return userPrompt + "\n" + echoLines.join("\n");
      }

      default:
        logWarn(
          `Unknown prompt repetition mode: "${mode}"; using no repetition`,
        );
        return userPrompt;
    }
  }

  // ============================================================================
  // OPENROUTER API CALL
  // ============================================================================

  /**
   * Send a request directly to the OpenRouter API.
   * Bypasses OpenRouterEmbed for speed — no UI, streaming, or progress.
   *
   * @param {object} options
   * @param {string} options.model - Model ID
   * @param {string} options.systemPrompt - System prompt
   * @param {string} options.userPrompt - User prompt text
   * @param {string} [options.imageBase64] - Base64 image data (optional)
   * @param {string} [options.imageMimeType] - MIME type for image
   * @param {number} [options.maxTokens] - Max tokens (default: 4000)
   * @param {number} [options.temperature] - Temperature (default: 0.3)
   * @param {object|null} [options.reasoning] - Reasoning config: { enabled, effort? } or null
   * @returns {Promise<object>} Response with text, model, token counts, reasoningTokens
   */
  async function callOpenRouter({
    model,
    systemPrompt,
    userPrompt,
    imageBase64,
    imageMimeType,
    maxTokens = HARNESS_CONFIG.MAX_TOKENS_DESCRIPTION,
    temperature = HARNESS_CONFIG.TEMPERATURE_DESCRIPTION,
    reasoning = null,
  }) {
    const apiKey = localStorage.getItem("openrouter_api_key");
    if (!apiKey) {
      throw new Error(
        "No OpenRouter API key found in localStorage. Set it with: localStorage.setItem('openrouter_api_key', 'your-key')",
      );
    }

    // Build user content — text only or text + image
    let userContent;
    if (imageBase64 && imageMimeType) {
      userContent = [
        {
          type: "image_url",
          image_url: {
            url: `data:${imageMimeType};base64,${imageBase64}`,
          },
        },
        { type: "text", text: userPrompt },
      ];
    } else {
      userContent = userPrompt;
    }

    // When reasoning is enabled, Anthropic requires temperature = 1
    const effectiveTemperature = temperature;

    if (reasoning?.enabled) {
      logInfo(
        `Reasoning enabled for ${model} (effort: ${reasoning.effort || "adaptive"}, temp: ${temperature})`,
      );
    }

    // Build request body
    const requestBody = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: effectiveTemperature,
    };

    // Add reasoning parameter when enabled
    if (reasoning?.enabled) {
      requestBody.reasoning = {};
      if (reasoning.effort) {
        requestBody.reasoning.effort = reasoning.effort;
      }
    }

    const startTime = performance.now();

    const response = await fetch(HARNESS_CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "Image Describer Test Harness",
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};

    // Extract reasoning tokens if present (OpenRouter returns these separately)
    const reasoningTokens =
      usage.reasoning_tokens ||
      usage.completion_tokens_details?.reasoning_tokens ||
      0;

    return {
      text,
      model: data.model || model,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      reasoningTokens,
      elapsedMs: elapsed,
      reasoningEnabled: !!reasoning?.enabled,
    };
  }

  // ============================================================================
  // GROUND TRUTH CHECKLIST EVALUATOR (Tier 1 — Free, Instant)
  // ============================================================================

  /**
   * Evaluate a description against a ground truth checklist.
   * Checks mustContain, mustNotContain, and visualFacts.
   *
   * @param {string} descriptionText - The generated description
   * @param {object} groundTruth - Ground truth object from test image
   * @returns {object} Checklist results with overall pass/fail
   */
  function evaluateChecklist(descriptionText, groundTruth) {
    const text = descriptionText.toLowerCase();

    const results = {
      mustContainHits: 0,
      mustContainTotal: groundTruth.mustContain?.length || 0,
      mustContainDetails: [],
      mustNotContainViolations: 0,
      mustNotContainTotal: groundTruth.mustNotContain?.length || 0,
      mustNotContainDetails: [],
      visualFactsPassed: 0,
      visualFactsFailed: 0,
      visualFactsTotal: groundTruth.visualFacts?.length || 0,
      visualFactsDetails: [],
    };

    // Check mustContain
    if (groundTruth.mustContain) {
      for (const term of groundTruth.mustContain) {
        const found = text.includes(term.toLowerCase());
        if (found) results.mustContainHits++;
        results.mustContainDetails.push({ term, found });
      }
    }

    // Check mustNotContain — supports regex prefixed with /
    if (groundTruth.mustNotContain) {
      for (const term of groundTruth.mustNotContain) {
        let found = false;

        if (term.startsWith("/") && term.lastIndexOf("/") > 0) {
          // Regex pattern: extract pattern and flags
          const lastSlash = term.lastIndexOf("/");
          const pattern = term.substring(1, lastSlash);
          const flags = term.substring(lastSlash + 1) || "i";
          try {
            const regex = new RegExp(pattern, flags);
            found = regex.test(descriptionText);
          } catch (e) {
            logWarn(`Invalid regex in mustNotContain: ${term}`);
            found = text.includes(term.toLowerCase());
          }
        } else {
          found = text.includes(term.toLowerCase());
        }

        if (found) results.mustNotContainViolations++;
        results.mustNotContainDetails.push({ term, found, violation: found });
      }
    }

    // Check visualFacts
    if (groundTruth.visualFacts) {
      for (const fact of groundTruth.visualFacts) {
        let passed = true;
        let failReason = null;

        // If failPattern defined, check it doesn't match
        if (fact.failPattern) {
          const regex = new RegExp(fact.failPattern, "i");
          if (regex.test(descriptionText)) {
            passed = false;
            const match = descriptionText.match(regex);
            failReason = `failPattern matched: "${match?.[0]}"`;
          }
        }

        if (passed) {
          results.visualFactsPassed++;
        } else {
          results.visualFactsFailed++;
        }

        results.visualFactsDetails.push({
          id: fact.id,
          claim: fact.claim,
          required: fact.required,
          passed,
          failReason,
        });
      }
    }

    // Overall pass: no mustNotContain violations + all required facts pass
    const requiredFactsAllPass = (groundTruth.visualFacts || [])
      .filter((f) => f.required)
      .every((f) => {
        const detail = results.visualFactsDetails.find((d) => d.id === f.id);
        return detail?.passed;
      });

    results.overallPass =
      results.mustNotContainViolations === 0 && requiredFactsAllPass;

    return results;
  }

  // ============================================================================
  // RESULT KEY & STORAGE
  // ============================================================================

  /**
   * Build a unique key for a test result.
   * Includes optional suffixes for prompt repetition, reasoning, and reliability runs.
   *
   * Examples:
   *   "piston-cylinder|haiku-4.5"
   *   "pv-diagram|haiku-4.5|rep:full"
   *   "piston-cylinder|haiku-4.5|reason:desc"
   *   "piston-cylinder|haiku-4.5|rep:full|reason:both|run:2of5"
   *
   * @param {string} imageKey
   * @param {string} descModel
   * @param {string|null} verifyModel
   * @param {boolean} verifyEnabled
   * @param {object} [options] - Additional key dimensions
   * @param {string} [options.promptRepetition] - Repetition mode
   * @param {object} [options.reasoning] - Reasoning config { desc, verify }
   * @param {object} [options.reliabilityRun] - { runNumber, totalRuns }
   * @returns {string} Result key
   */
  function buildResultKey(
    imageKey,
    descModel,
    verifyModel,
    verifyEnabled,
    options,
  ) {
    const descShort = descModel.replace("anthropic/claude-", "");
    const verifyPart =
      verifyEnabled && verifyModel
        ? `+${verifyModel.replace("anthropic/claude-", "")}`
        : "";

    let key = `${imageKey}|${descShort}${verifyPart}`;

    // Append repetition mode suffix
    if (options?.promptRepetition && options.promptRepetition !== "none") {
      const repShort =
        options.promptRepetition === "context-echo"
          ? "echo"
          : options.promptRepetition;
      key += `|rep:${repShort}`;
    }

    // Append reasoning suffix
    if (options?.reasoning) {
      const descR = options.reasoning.desc;
      const verifyR = options.reasoning.verify;
      if (descR && verifyR) {
        key += "|reason:both";
      } else if (descR) {
        key += "|reason:desc";
      } else if (verifyR) {
        key += "|reason:verify";
      }
    }

// Append config label suffix (for external test runners)
    if (options?.configLabel) {
      key += `|cfg:${options.configLabel}`;
    }

    // Append reliability run suffix
    if (options?.reliabilityRun) {
      const { runNumber, totalRuns } = options.reliabilityRun;
      key += `|run:${runNumber}of${totalRuns}`;
    }

    return key;
  }

  /**
   * Store a result in memory and localStorage.
   * @param {object} result - Test result object
   */
  function storeResult(result) {
    allResults[result.key] = result;
    saveToLocalStorage();

    if (HARNESS_CONFIG.AUTO_DOWNLOAD) {
      downloadJSON(
        result,
        `imgdesc-${result.key.replace(/\|/g, "-").replace(/\+/g, "-")}-${Date.now()}.json`,
      );
    }

    logInfo(`Result stored: ${result.key}`);
  }

  /**
   * Save all results to localStorage.
   */
  function saveToLocalStorage() {
    try {
      const data = JSON.stringify(allResults);
      localStorage.setItem(HARNESS_CONFIG.STORAGE_KEY, data);
      logDebug(
        `Saved ${Object.keys(allResults).length} results to localStorage`,
      );
    } catch (error) {
      logWarn("Failed to save to localStorage:", error.message);
    }
  }

  /**
   * Load results from localStorage.
   */
  function loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(HARNESS_CONFIG.STORAGE_KEY);
      if (data) {
        allResults = JSON.parse(data);
        logInfo(
          `Loaded ${Object.keys(allResults).length} results from localStorage`,
        );
      }
    } catch (error) {
      logWarn("Failed to load from localStorage:", error.message);
      allResults = {};
    }
  }

  // ============================================================================
  // JSON DOWNLOAD UTILITY
  // ============================================================================

  /**
   * Download a JSON object as a file.
   * @param {object} data - Data to download
   * @param {string} filename - Filename
   */
  function downloadJSON(data, filename) {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Cleanup after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);

      logInfo(`Downloaded: ${filename}`);
    } catch (error) {
      logError("Download failed:", error);
    }
  }

  // ============================================================================
  // PHASE 2: RUNNER
  // ============================================================================

  /**
   * Run a single test — description + optional verification + checklist.
   *
   * @param {string} imageKey - Test image key
   * @param {string} descModel - Description model ID
   * @param {string|null} [verifyModel=null] - Verification model ID (null to skip)
   * @param {boolean} [verifyEnabled=false] - Whether to run verification
   * @param {object} [options={}] - Additional test options
   * @param {string} [options.promptRepetition="none"] - Repetition mode: "none"|"full"|"verbose"|"context-echo"
   * @param {object} [options.reasoning] - Reasoning config: { desc: boolean, verify: boolean }
   * @param {object} [options.reliabilityRun] - Reliability run info: { runNumber, totalRuns, batchId }
   * @returns {Promise<object>} Test result
   */
  async function runSingleTest(
    imageKey,
    descModel,
    verifyModel = null,
    verifyEnabled = false,
    options = {},
  ) {
    const ctrl = window.ImageDescriberController;
    if (!ctrl) {
      throw new Error(
        "ImageDescriberController not available. Is the tool initialised?",
      );
    }

    // Resolve options with defaults
    const promptRepetition =
      options.promptRepetition ||
      HARNESS_CONFIG.PROMPT_REPETITION_MODE ||
      "none";
    const reasoning = options.reasoning || null;

    // Ensure prompts are loaded
    if (!ctrl.arePromptsReady || ctrl.arePromptsReady()) {
      // Prompts not ready — wait
      if (ctrl.waitForPrompts) {
        const ready = await ctrl.waitForPrompts();
        if (!ready) {
          throw new Error("Prompts failed to load");
        }
      }
    }

    // Load test image
    const image = await getTestImage(imageKey);
    if (!image) {
      throw new Error(`Test image "${imageKey}" not available`);
    }

    const repLabel =
      promptRepetition !== "none" ? ` | rep=${promptRepetition}` : "";
    const reasonLabel = reasoning
      ? ` | reasoning=${reasoning.desc && reasoning.verify ? "both" : reasoning.desc ? "desc" : reasoning.verify ? "verify" : "none"}`
      : "";
    const runLabel = options.reliabilityRun
      ? ` | run ${options.reliabilityRun.runNumber}/${options.reliabilityRun.totalRuns}`
      : "";

    logInfo(
      `Running test: ${imageKey} | desc=${descModel} | verify=${verifyModel || "none"}${repLabel}${reasonLabel}${runLabel}`,
    );

// Save current form state and analysis state
    savedFormState = saveFormState();
    const savedAnalysis = ctrl.lastAnalysis;

    try {
      // 0. Pre-flight: verify tool is visible and form elements are in DOM
      const toolArticle = document.getElementById("image-describe-app");
      if (
        !toolArticle ||
        getComputedStyle(toolArticle).display === "none" ||
        toolArticle.getAttribute("aria-hidden") === "true"
      ) {
        logWarn(
          "⚠️  Image Describer tool is not visible. Form context will not be applied.",
        );
        logWarn("    Switch to the Image Describer tool before running tests.");
        throw new Error(
          "Image Describer tool is not visible. Switch to it first, then re-run.",
        );
      }

// 1. Set form context from test image
      setFormContext(image.context);

      // 1b. Handle analysis inclusion (Phase 3)
      let analysisResult = null;
      if (options.includeAnalysis === true) {
        analysisResult = await runAnalysisForTestImage(imageKey);
        ctrl.lastAnalysis = analysisResult;
        if (analysisResult) {
          logInfo("Analysis data injected into controller for prompt building");
        } else {
          logWarn("Analysis requested but returned null — prompt will have no analysis data");
        }
      } else if (options.includeAnalysis === false) {
        // Explicitly exclude analysis (baseline mode)
        ctrl.lastAnalysis = null;
      }
      // If options.includeAnalysis is undefined, leave ctrl.lastAnalysis as-is
      // (backward compatible — usually null in harness context)

      // 2. Build prompts using controller's actual methods
      const systemPrompt = ctrl.buildSystemPrompt();
      const originalUserPrompt = ctrl.buildUserPrompt();

      // 3. Apply prompt repetition
      const userPrompt = applyPromptRepetition(
        originalUserPrompt,
        promptRepetition,
        image.context,
      );

      if (promptRepetition !== "none") {
        logInfo(
          `Prompt repetition (${promptRepetition}): ${originalUserPrompt.length} → ${userPrompt.length} chars`,
        );
      }

      // 4. Pre-flight: verify context was applied to user prompt
      const contextFields = ["subject", "topic", "objective", "module"];
      const appliedFields = contextFields.filter((field) => {
        const value = image.context[field];
        return value && originalUserPrompt.includes(value);
      });

      const expectedFields = contextFields.filter(
        (field) => image.context[field],
      );

      if (expectedFields.length > 0 && appliedFields.length === 0) {
        logError(
          "⚠️  CONTEXT NOT APPLIED — user prompt contains none of the expected fields.",
        );
        logError(`    Expected: ${expectedFields.join(", ")}`);
        logError(
          `    User prompt length: ${originalUserPrompt.length} chars (suspiciously short if < 200)`,
        );
        logError(
          "    This usually means the form elements are not in the DOM.",
        );
        throw new Error(
          `Form context not applied to user prompt (${originalUserPrompt.length} chars, expected ~950+). ` +
            "Ensure the Image Describer tool is visible and initialised.",
        );
      }

      if (appliedFields.length < expectedFields.length) {
        const missing = expectedFields.filter(
          (f) => !appliedFields.includes(f),
        );
        logWarn(
          `Partial context: ${appliedFields.length}/${expectedFields.length} fields applied. Missing: ${missing.join(", ")}`,
        );
      }

      logDebug("System prompt length:", systemPrompt.length);
      logDebug("User prompt length:", userPrompt.length);
      logDebug(
        `Context fields applied: ${appliedFields.length}/${expectedFields.length}`,
      );

      // 5. Build reasoning config for description pass
      let descReasoning = null;
      if (reasoning?.desc) {
        descReasoning = buildTestReasoningConfig(descModel);
      }

      // 6. Send description request
      logInfo("Sending description request...");
      const descResult = await callOpenRouter({
        model: descModel,
        systemPrompt,
        userPrompt,
        imageBase64: image.base64,
        imageMimeType: image.mimeType,
        maxTokens: descReasoning
          ? HARNESS_CONFIG.MAX_TOKENS_DESCRIPTION_REASONING
          : HARNESS_CONFIG.MAX_TOKENS_DESCRIPTION,
        temperature: HARNESS_CONFIG.TEMPERATURE_DESCRIPTION,
        reasoning: descReasoning,
      });

      logInfo(
        `Description received: ${descResult.text.length} chars, ${descResult.totalTokens} tokens` +
          (descResult.reasoningTokens
            ? `, ${descResult.reasoningTokens} reasoning tokens`
            : "") +
          `, ${descResult.elapsedMs}ms`,
      );

      // 7. Run ground truth checklist (free, instant)
      const checklist = evaluateChecklist(descResult.text, image.groundTruth);

      logInfo(
        `Checklist: mustContain ${checklist.mustContainHits}/${checklist.mustContainTotal}, ` +
          `violations ${checklist.mustNotContainViolations}/${checklist.mustNotContainTotal}, ` +
          `visualFacts ${checklist.visualFactsPassed}/${checklist.visualFactsTotal}, ` +
          `overall: ${checklist.overallPass ? "PASS" : "FAIL"}`,
      );

      // 8. Optionally run verification pass
      let verifyResult = null;
      if (verifyEnabled && verifyModel) {
        logInfo("Sending verification request...");

        const verifySysPrompt = ctrl.buildVerificationSystemPrompt();
        const verifyUserPrompt = ctrl.buildVerificationUserPrompt(
          descResult.text,
        );

        // Build reasoning config for verification pass
        let verifyReasoning = null;
        if (reasoning?.verify) {
          verifyReasoning = buildTestReasoningConfig(verifyModel);
        }

        verifyResult = await callOpenRouter({
          model: verifyModel,
          systemPrompt: verifySysPrompt,
          userPrompt: verifyUserPrompt,
          imageBase64: image.base64,
          imageMimeType: image.mimeType,
          maxTokens: verifyReasoning
            ? HARNESS_CONFIG.MAX_TOKENS_VERIFICATION_REASONING
            : HARNESS_CONFIG.MAX_TOKENS_VERIFICATION,
          temperature: HARNESS_CONFIG.TEMPERATURE_VERIFICATION,
          reasoning: verifyReasoning,
        });

        logInfo(
          `Verification received: ${verifyResult.text.length} chars, ${verifyResult.totalTokens} tokens` +
            (verifyResult.reasoningTokens
              ? `, ${verifyResult.reasoningTokens} reasoning tokens`
              : "") +
            `, ${verifyResult.elapsedMs}ms`,
        );
      }

      // 9. Build and store result
      const resultKey = buildResultKey(
        imageKey,
        descModel,
        verifyModel,
        verifyEnabled,
        {
          promptRepetition,
          reasoning,
          reliabilityRun: options.reliabilityRun || null,
        },
      );

      const result = {
        key: resultKey,
        imageKey,
        imageName: image.name,
        descModel,
        verifyModel,
        verifyEnabled,
        timestamp: new Date().toISOString(),

// Config label (from comparison batches or external test runners)
        configLabel: options.configLabel || null,

// Phase 2F: prompt repetition
        promptRepetition,

        // Phase 3: analysis inclusion
        includeAnalysis: options.includeAnalysis === true,
        analysisAvailable: !!analysisResult,
        analysisOCRCount: analysisResult?.ocr?.items?.length || 0,
        analysisColourRegions: analysisResult?.colour?.regions?.length || 0,
        analysisDuration: analysisResult?.totalDuration || null,

        // Phase 2F: reasoning config
        reasoning: reasoning
          ? {
              descEnabled: !!reasoning.desc,
              verifyEnabled: !!reasoning.verify,
              descEffort: descReasoning?.effort || null,
              verifyEffort: reasoning.verify
                ? buildTestReasoningConfig(verifyModel || descModel).effort ||
                  null
                : null,
            }
          : null,

        // Phase 2F: reliability run tracking
        reliabilityRun: options.reliabilityRun || null,

        description: descResult,
        verification: verifyResult,
        checklist,
        prompts: {
          systemPromptLength: systemPrompt.length,
          userPromptOriginalLength: originalUserPrompt.length,
          userPromptFinalLength: userPrompt.length,
          repetitionMode: promptRepetition,
          systemPrompt,
          userPrompt,
        },
        aiEvaluation: null, // Populated later by evaluateResult()
      };

      storeResult(result);

      // Print summary
      console.log(`\n=== TEST RESULT: ${resultKey} ===`);
      console.log(
        `Description: ${descResult.totalTokens} tokens, ${descResult.elapsedMs}ms` +
          (descResult.reasoningTokens
            ? ` (${descResult.reasoningTokens} reasoning)`
            : ""),
      );
      if (verifyResult) {
        console.log(
          `Verification: ${verifyResult.totalTokens} tokens, ${verifyResult.elapsedMs}ms` +
            (verifyResult.reasoningTokens
              ? ` (${verifyResult.reasoningTokens} reasoning)`
              : ""),
        );
      }
      if (promptRepetition !== "none") {
        console.log(`Prompt repetition: ${promptRepetition}`);
      }
      console.log(
        `Checklist: ${checklist.overallPass ? "✅ PASS" : "❌ FAIL"}`,
      );
      printChecklistSummary(checklist);
      console.log("=== END ===\n");

      return result;
} finally {
      // Always restore form state and analysis state
      restoreFormState(savedFormState);
      savedFormState = null;
      ctrl.lastAnalysis = savedAnalysis;
    }
  }

  /**
   * Run a full test matrix.
   * Supports both old 4-element format and new extended format:
   *   [imageKey, descModel, verifyModel|null, verifyEnabled]
   *   [imageKey, descModel, verifyModel|null, verifyEnabled, promptRepetition, reasoningConfig]
   *
   * @param {Array} [matrix] - Custom matrix, or DEFAULT_MATRIX
   * @returns {Promise<Array>} All results
   */
  async function runMatrix(matrix) {
    const testMatrix = matrix || DEFAULT_MATRIX;
    const results = [];

    logInfo(`Starting matrix run: ${testMatrix.length} combinations`);

    for (let i = 0; i < testMatrix.length; i++) {
      const entry = testMatrix[i];
      const imageKey = entry[0];
      const descModel = entry[1];
      const verifyModel = entry[2] || null;
      const verifyEnabled = entry[3] || false;

      // Extended format: elements 4 and 5 are promptRepetition and reasoning
      const promptRepetition = entry[4] || "none";
      const reasoning = entry[5] || null;

      const entryOptions = { promptRepetition, reasoning };

      console.log(`\n─── Matrix ${i + 1}/${testMatrix.length} ───`);

      try {
        const result = await runSingleTest(
          imageKey,
          descModel,
          verifyModel,
          verifyEnabled,
          entryOptions,
        );
        results.push(result);
      } catch (error) {
        logError(`Matrix item ${i + 1} failed:`, error.message);
        results.push({
          key: buildResultKey(
            imageKey,
            descModel,
            verifyModel,
            verifyEnabled,
            entryOptions,
          ),
          error: error.message,
        });
      }

      // Delay between runs (skip after last)
      if (i < testMatrix.length - 1) {
        logDebug(
          `Waiting ${HARNESS_CONFIG.MATRIX_DELAY_MS}ms before next run...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, HARNESS_CONFIG.MATRIX_DELAY_MS),
        );
      }
    }

    logInfo(`Matrix complete: ${results.length} results`);
    showTestMatrix();
    return results;
  }

  /**
   * Run the cheap (haiku-only) matrix.
   * @returns {Promise<Array>}
   */
  async function runCheapMatrix() {
    logInfo("Running cheap (haiku-only) matrix...");
    return runMatrix(CHEAP_MATRIX);
  }

  // ============================================================================
  // PHASE 2F: RELIABILITY TESTING
  // ============================================================================

  /**
   * Run the same test configuration N times to measure reliability.
   * Results are stored with unique keys using |run:NofM suffix.
   *
   * @param {string} imageKey - Test image key
   * @param {string} descModel - Description model ID
   * @param {number} [runs=5] - Number of iterations
   * @param {object} [options={}] - Test options (promptRepetition, reasoning, verifyModel, verifyEnabled)
   * @returns {Promise<object>} Summary with individual results and aggregate stats
   */
  async function runReliability(imageKey, descModel, runs = 5, options = {}) {
    if (runs < 1 || runs > 50) {
      throw new Error("Runs must be between 1 and 50");
    }

    const verifyModel = options.verifyModel || null;
    const verifyEnabled = options.verifyEnabled || false;
    const batchId = `rel-${Date.now()}`;

    const repLabel =
      options.promptRepetition && options.promptRepetition !== "none"
        ? ` | rep=${options.promptRepetition}`
        : "";
    const reasonLabel = options.reasoning
      ? ` | reasoning=${options.reasoning.desc && options.reasoning.verify ? "both" : options.reasoning.desc ? "desc" : options.reasoning.verify ? "verify" : "none"}`
      : "";

    console.log(`\n${"═".repeat(60)}`);
    console.log(`RELIABILITY TEST: ${runs} runs`);
    console.log(
      `Image: ${imageKey} | Model: ${descModel}${repLabel}${reasonLabel}`,
    );
    console.log(`Batch: ${batchId}`);
    console.log(`${"═".repeat(60)}\n`);

    const results = [];
    const startTime = performance.now();

    for (let i = 0; i < runs; i++) {
      const runNumber = i + 1;

      console.log(`\n─── Run ${runNumber}/${runs} ───`);

      const runOptions = {
        ...options,
        reliabilityRun: {
          runNumber,
          totalRuns: runs,
          batchId,
        },
      };

      try {
        const result = await runSingleTest(
          imageKey,
          descModel,
          verifyModel,
          verifyEnabled,
          runOptions,
        );
        results.push(result);
      } catch (error) {
        logError(`Run ${runNumber} failed:`, error.message);
        results.push({ error: error.message, runNumber });
      }

      // Delay between runs (skip after last)
      if (i < runs - 1) {
        logDebug(
          `Waiting ${HARNESS_CONFIG.MATRIX_DELAY_MS}ms before next run...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, HARNESS_CONFIG.MATRIX_DELAY_MS),
        );
      }
    }

    const totalElapsed = Math.round(performance.now() - startTime);

    // Compute aggregate statistics
    const validResults = results.filter((r) => !r.error);
    const passedResults = validResults.filter((r) => r.checklist?.overallPass);

    // Identify which facts failed and how often
    const factFailCounts = {};
    validResults.forEach((r) => {
      r.checklist?.visualFactsDetails?.forEach((fact) => {
        if (!fact.passed) {
          factFailCounts[fact.id] = (factFailCounts[fact.id] || 0) + 1;
        }
      });
    });

    // Token and timing averages
    const avgTokens =
      validResults.length > 0
        ? Math.round(
            validResults.reduce(
              (sum, r) => sum + (r.description?.totalTokens || 0),
              0,
            ) / validResults.length,
          )
        : 0;

    const avgMs =
      validResults.length > 0
        ? Math.round(
            validResults.reduce(
              (sum, r) => sum + (r.description?.elapsedMs || 0),
              0,
            ) / validResults.length,
          )
        : 0;

    const avgReasoningTokens =
      validResults.length > 0
        ? Math.round(
            validResults.reduce(
              (sum, r) => sum + (r.description?.reasoningTokens || 0),
              0,
            ) / validResults.length,
          )
        : 0;

    // Print summary
    console.log(`\n${"═".repeat(60)}`);
    console.log(
      `RELIABILITY SUMMARY: ${imageKey} + ${descModel.replace("anthropic/claude-", "")}`,
    );
    console.log(`${"═".repeat(60)}`);
    console.log(
      `Pass rate: ${passedResults.length}/${validResults.length} (${validResults.length > 0 ? Math.round((passedResults.length / validResults.length) * 100) : 0}%)`,
    );
    console.log(`Errors: ${results.length - validResults.length}`);

    if (Object.keys(factFailCounts).length > 0) {
      console.log("Failing facts:");
      for (const [factId, count] of Object.entries(factFailCounts)) {
        console.log(
          `  ❌ ${factId}: failed ${count}/${validResults.length} runs`,
        );
      }
    } else {
      console.log("Failing facts: none ✅");
    }

    console.log(
      `Avg tokens: ${avgTokens}  Avg time: ${(avgMs / 1000).toFixed(1)}s`,
    );
    if (avgReasoningTokens > 0) {
      console.log(`Avg reasoning tokens: ${avgReasoningTokens}`);
    }
    console.log(`Total elapsed: ${(totalElapsed / 1000).toFixed(1)}s`);
    console.log(`${"═".repeat(60)}\n`);

    const summary = {
      imageKey,
      descModel,
      runs,
      batchId,
      options,
      passRate: `${passedResults.length}/${validResults.length}`,
      passPercent:
        validResults.length > 0
          ? Math.round((passedResults.length / validResults.length) * 100)
          : 0,
      failingFacts: factFailCounts,
      avgTokens,
      avgMs,
      avgReasoningTokens,
      totalElapsedMs: totalElapsed,
      results,
    };

    return summary;
  }

  /**
   * Analyse reliability results for a given image + model combination.
   * Filters stored results by image key and optional model fragment,
   * looking for results with reliabilityRun data.
   *
   * @param {string} imageKey - Test image key
   * @param {string} [modelFragment] - Partial model name to filter (e.g. "haiku")
   */
  function showReliability(imageKey, modelFragment) {
    const matches = Object.values(allResults).filter((r) => {
      if (r.imageKey !== imageKey) return false;
      if (!r.reliabilityRun) return false;
      if (modelFragment && !r.descModel?.includes(modelFragment)) return false;
      return true;
    });

    if (matches.length === 0) {
      logWarn(
        `No reliability results found for "${imageKey}"` +
          (modelFragment ? ` + "${modelFragment}"` : ""),
      );
      logInfo(
        "Run reliability tests first: window.runReliability(imageKey, model, runs)",
      );
      return;
    }

    // Group by batchId for separate reporting
    const batches = {};
    matches.forEach((r) => {
      const batchId = r.reliabilityRun.batchId;
      if (!batches[batchId]) {
        batches[batchId] = [];
      }
      batches[batchId].push(r);
    });

    for (const [batchId, batchResults] of Object.entries(batches)) {
      const modelShort =
        batchResults[0]?.descModel?.replace("anthropic/claude-", "") || "?";
      const repMode = batchResults[0]?.promptRepetition || "none";
      const reasonDesc = batchResults[0]?.reasoning?.descEnabled || false;
      const reasonVerify = batchResults[0]?.reasoning?.verifyEnabled || false;

      const validResults = batchResults.filter((r) => !r.error);
      const passedResults = validResults.filter(
        (r) => r.checklist?.overallPass,
      );

      // Per-fact failure counts
      const factFailCounts = {};
      validResults.forEach((r) => {
        r.checklist?.visualFactsDetails?.forEach((fact) => {
          if (!fact.passed) {
            factFailCounts[fact.id] = (factFailCounts[fact.id] || 0) + 1;
          }
        });
      });

      // Averages
      const avgTokens =
        validResults.length > 0
          ? Math.round(
              validResults.reduce(
                (sum, r) => sum + (r.description?.totalTokens || 0),
                0,
              ) / validResults.length,
            )
          : 0;

      const avgMs =
        validResults.length > 0
          ? Math.round(
              validResults.reduce(
                (sum, r) => sum + (r.description?.elapsedMs || 0),
                0,
              ) / validResults.length,
            )
          : 0;

      // Config label
      const configParts = [modelShort];
      if (repMode !== "none") configParts.push(`rep:${repMode}`);
      if (reasonDesc && reasonVerify) {
        configParts.push("reason:both");
      } else if (reasonDesc) {
        configParts.push("reason:desc");
      } else if (reasonVerify) {
        configParts.push("reason:verify");
      }
      const configLabel = configParts.join(" | ");

      console.log(`\n${"═".repeat(60)}`);
      console.log(
        `RELIABILITY: ${imageKey} + ${configLabel} (${validResults.length} runs)`,
      );
      console.log(`${"═".repeat(60)}`);
      console.log(
        `Pass rate: ${passedResults.length}/${validResults.length} (${validResults.length > 0 ? Math.round((passedResults.length / validResults.length) * 100) : 0}%)`,
      );

      if (Object.keys(factFailCounts).length > 0) {
        console.log("Failing facts:");
        for (const [factId, count] of Object.entries(factFailCounts)) {
          console.log(
            `  ❌ ${factId}: failed ${count}/${validResults.length} runs (${Math.round((count / validResults.length) * 100)}%)`,
          );
        }
      } else {
        console.log("Failing facts: none ✅");
      }

      console.log(
        `Avg tokens: ${avgTokens}  Avg time: ${(avgMs / 1000).toFixed(1)}s`,
      );
      console.log(`Batch: ${batchId}`);
      console.log(`${"═".repeat(60)}\n`);
    }
  }

  /**
   * Run multiple configurations N times each for side-by-side comparison.
   * Each config is run sequentially as a reliability batch.
   *
   * @param {string} imageKey - Test image key
   * @param {Array<object>} configs - Array of config objects:
   *   { descModel, label, promptRepetition?, reasoning?, verifyModel?, verifyEnabled? }
   * @param {number} [runs=5] - Runs per config
   * @returns {Promise<object>} Comparison data with per-config summaries
   */
  async function runComparisonBatch(imageKey, configs, runs = 5) {
    if (!configs || configs.length === 0) {
      throw new Error("configs array is required and must not be empty");
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`COMPARISON BATCH: ${imageKey}`);
    console.log(
      `${configs.length} configs × ${runs} runs = ${configs.length * runs} total tests`,
    );
    console.log(`${"═".repeat(60)}\n`);

    const summaries = [];

    for (let c = 0; c < configs.length; c++) {
      const cfg = configs[c];
      const label = cfg.label || `config-${c + 1}`;
      const descModel = cfg.descModel || "anthropic/claude-haiku-4.5";

      console.log(`\n${"─".repeat(40)}`);
      console.log(`Config ${c + 1}/${configs.length}: "${label}"`);
      console.log(`${"─".repeat(40)}`);

const options = {
        promptRepetition: cfg.promptRepetition || "none",
        reasoning: cfg.reasoning || null,
        verifyModel: cfg.verifyModel || null,
        verifyEnabled: cfg.verifyEnabled || false,
        configLabel: label,
        includeAnalysis: cfg.includeAnalysis,
      };

      try {
        const summary = await runReliability(
          imageKey,
          descModel,
          runs,
          options,
        );
        summary.label = label;
        summaries.push(summary);
      } catch (error) {
        logError(`Config "${label}" failed:`, error.message);
        summaries.push({ label, error: error.message });
      }

      // Extra delay between configs
      if (c < configs.length - 1) {
        logDebug("Waiting between configs...");
        await new Promise((resolve) =>
          setTimeout(resolve, HARNESS_CONFIG.MATRIX_DELAY_MS),
        );
      }
    }

    // Print comparison table
    printComparisonTable(imageKey, summaries);

    return { imageKey, runs, summaries };
  }

  /**
   * Print a formatted comparison table from batch summaries.
   * @param {string} imageKey - Image key
   * @param {Array<object>} summaries - Array of reliability summaries
   */
  function printComparisonTable(imageKey, summaries) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`COMPARISON REPORT: ${imageKey}`);
    console.log(`${"═".repeat(60)}\n`);

    const rows = summaries.map((s) => {
      if (s.error) {
        return {
          Label: s.label,
          PassRate: "ERROR",
          AvgTokens: "-",
          AvgTime: "-",
          FailingFacts: s.error,
        };
      }

      const failList = Object.entries(s.failingFacts || {})
        .map(
          ([id, count]) =>
            `${id}(${count}/${s.results?.filter((r) => !r.error).length || "?"})`,
        )
        .join(", ");

      return {
        Label: s.label,
        PassRate: `${s.passRate} (${s.passPercent}%)`,
        AvgTokens: s.avgTokens,
        AvgTime: `${(s.avgMs / 1000).toFixed(1)}s`,
        AvgReasoningTok: s.avgReasoningTokens || "-",
        FailingFacts: failList || "none ✅",
      };
    });

    console.table(rows);

    // Identify winner
    const validSummaries = summaries.filter((s) => !s.error);
    if (validSummaries.length > 1) {
      const sorted = [...validSummaries].sort((a, b) => {
        // Primary: highest pass percent
        if (b.passPercent !== a.passPercent)
          return b.passPercent - a.passPercent;
        // Secondary: fewest total fact failures
        const aFails = Object.values(a.failingFacts || {}).reduce(
          (s, v) => s + v,
          0,
        );
        const bFails = Object.values(b.failingFacts || {}).reduce(
          (s, v) => s + v,
          0,
        );
        if (aFails !== bFails) return aFails - bFails;
        // Tertiary: fewer tokens (cheaper)
        return a.avgTokens - b.avgTokens;
      });

      console.log(
        `\nBest config: "${sorted[0].label}" (${sorted[0].passPercent}% pass rate)`,
      );
    }

    console.log(`\n${"═".repeat(60)}\n`);
  }

  /**
   * Run the same test both with and without analysis data for comparison.
   * Convenience wrapper around runComparisonBatch().
   *
   * @param {string} imageKey - Test image key
   * @param {string} [model="anthropic/claude-haiku-4.5"] - Model to use
   * @param {number} [runs=3] - Runs per configuration
   * @param {object} [extraOptions={}] - Additional options passed to both configs
   * @returns {Promise<object>} Comparison batch result
   */
  async function runAnalysisComparison(imageKey, model, runs, extraOptions) {
    const descModel = model || "anthropic/claude-haiku-4.5";
    const numRuns = runs || 3;
    const extra = extraOptions || {};

    const modelShort = descModel.replace("anthropic/claude-", "");

    const configs = [
      {
        descModel,
        label: `${modelShort}-no-analysis`,
        includeAnalysis: false,
        ...extra,
      },
      {
        descModel,
        label: `${modelShort}-with-analysis`,
        includeAnalysis: true,
        ...extra,
      },
    ];

    console.log(`\n${"═".repeat(60)}`);
    console.log(`ANALYSIS COMPARISON: ${imageKey}`);
    console.log(`Model: ${descModel} | ${numRuns} runs per config`);
    console.log(`${"═".repeat(60)}\n`);

    return runComparisonBatch(imageKey, configs, numRuns);
  }

  /**
   * Show comparison report from previously stored reliability results.
   * Groups all reliability results for the given image by their config.
   *
   * @param {string} [imageKey] - Image key to filter (omit for all images)
   */
  function showComparisonReport(imageKey) {
    const reliabilityResults = Object.values(allResults).filter((r) => {
      if (!r.reliabilityRun) return false;
      if (imageKey && r.imageKey !== imageKey) return false;
      return true;
    });

    if (reliabilityResults.length === 0) {
      logWarn(
        "No reliability results found" + (imageKey ? ` for "${imageKey}"` : ""),
      );
      return;
    }

    // Group by imageKey + batchId
    const groups = {};
    reliabilityResults.forEach((r) => {
      const groupKey = `${r.imageKey}|${r.reliabilityRun.batchId}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          imageKey: r.imageKey,
          batchId: r.reliabilityRun.batchId,
          results: [],
        };
      }
      groups[groupKey].results.push(r);
    });

    // For each group, build a summary and print
    for (const group of Object.values(groups)) {
      const validResults = group.results.filter((r) => !r.error);
      const passedResults = validResults.filter(
        (r) => r.checklist?.overallPass,
      );

      const factFailCounts = {};
      validResults.forEach((r) => {
        r.checklist?.visualFactsDetails?.forEach((fact) => {
          if (!fact.passed) {
            factFailCounts[fact.id] = (factFailCounts[fact.id] || 0) + 1;
          }
        });
      });

      const avgTokens =
        validResults.length > 0
          ? Math.round(
              validResults.reduce(
                (sum, r) => sum + (r.description?.totalTokens || 0),
                0,
              ) / validResults.length,
            )
          : 0;

      const avgMs =
        validResults.length > 0
          ? Math.round(
              validResults.reduce(
                (sum, r) => sum + (r.description?.elapsedMs || 0),
                0,
              ) / validResults.length,
            )
          : 0;

      const modelShort =
        validResults[0]?.descModel?.replace("anthropic/claude-", "") || "?";
      const repMode = validResults[0]?.promptRepetition || "none";

      const configParts = [modelShort];
      if (repMode !== "none") configParts.push(`rep:${repMode}`);
      if (validResults[0]?.reasoning?.descEnabled)
        configParts.push("reason:desc");
      if (validResults[0]?.reasoning?.verifyEnabled)
        configParts.push("reason:verify");

      console.log(
        `${group.imageKey} | ${configParts.join(" | ")} | ` +
          `${passedResults.length}/${validResults.length} pass | ` +
          `avg ${avgTokens} tok / ${(avgMs / 1000).toFixed(1)}s | ` +
          `fails: ${
            Object.keys(factFailCounts).length > 0
              ? Object.entries(factFailCounts)
                  .map(([id, n]) => `${id}(${n})`)
                  .join(", ")
              : "none ✅"
          }`,
      );
    }
  }

  // ============================================================================
  // PHASE 2F: PREDEFINED EXPERIMENTS
  // ============================================================================

  /**
   * Prompt repetition A/B test.
   * Runs baseline, full-repeat, verbose-repeat, and context-echo
   * on both images with Haiku (cheapest model).
   * Total: 4 configs × 2 images × N runs = 8N runs (default 40).
   *
   * @param {number} [runs=5] - Runs per config per image
   * @returns {Promise<object>} Results from both images
   */
  async function runRepetitionTest(runs = 5) {
    const configs = [
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "baseline",
        promptRepetition: "none",
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "full-repeat",
        promptRepetition: "full",
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "verbose-repeat",
        promptRepetition: "verbose",
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "context-echo",
        promptRepetition: "context-echo",
      },
    ];

    const images = Object.keys(testImages);
    if (images.length === 0) {
      await loadTestImages();
    }
    const imageKeys = Object.keys(testImages);

    console.log(`\n${"═".repeat(60)}`);
    console.log("EXPERIMENT: Prompt Repetition A/B Test");
    console.log(
      `${configs.length} configs × ${imageKeys.length} images × ${runs} runs = ${configs.length * imageKeys.length * runs} total`,
    );
    console.log(`${"═".repeat(60)}\n`);

    const allBatchResults = {};

    for (const imageKey of imageKeys) {
      console.log(`\n${"▓".repeat(60)}`);
      console.log(`IMAGE: ${imageKey}`);
      console.log(`${"▓".repeat(60)}`);

      allBatchResults[imageKey] = await runComparisonBatch(
        imageKey,
        configs,
        runs,
      );
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("EXPERIMENT COMPLETE: Prompt Repetition A/B Test");
    console.log(`${"═".repeat(60)}\n`);

    return allBatchResults;
  }

  /**
   * Reasoning A/B test.
   * Runs baseline, desc-reasoning, verify-reasoning, and both-reasoning
   * on both images with Haiku.
   * Total: 4 configs × 2 images × N runs = 8N runs (default 40).
   *
   * Note: verify-reasoning and both-reasoning require a verify model,
   * so those configs include Haiku self-verification.
   *
   * @param {number} [runs=5] - Runs per config per image
   * @returns {Promise<object>} Results from both images
   */
  async function runReasoningTest(runs = 5) {
    const configs = [
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "baseline",
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "reason-desc",
        reasoning: { desc: true, verify: false },
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "reason-verify",
        reasoning: { desc: false, verify: true },
        verifyModel: "anthropic/claude-haiku-4.5",
        verifyEnabled: true,
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "reason-both",
        reasoning: { desc: true, verify: true },
        verifyModel: "anthropic/claude-haiku-4.5",
        verifyEnabled: true,
      },
    ];

    const images = Object.keys(testImages);
    if (images.length === 0) {
      await loadTestImages();
    }
    const imageKeys = Object.keys(testImages);

    console.log(`\n${"═".repeat(60)}`);
    console.log("EXPERIMENT: Reasoning A/B Test");
    console.log(
      `${configs.length} configs × ${imageKeys.length} images × ${runs} runs = ${configs.length * imageKeys.length * runs} total`,
    );
    console.log(`${"═".repeat(60)}\n`);

    const allBatchResults = {};

    for (const imageKey of imageKeys) {
      console.log(`\n${"▓".repeat(60)}`);
      console.log(`IMAGE: ${imageKey}`);
      console.log(`${"▓".repeat(60)}`);

      allBatchResults[imageKey] = await runComparisonBatch(
        imageKey,
        configs,
        runs,
      );
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("EXPERIMENT COMPLETE: Reasoning A/B Test");
    console.log(`${"═".repeat(60)}\n`);

    return allBatchResults;
  }

  /**
   * Combined best-config test.
   * Intended to be customised after identifying winners from
   * runRepetitionTest() and runReasoningTest().
   * Default: tests prompt repetition modes with reasoning on Haiku.
   *
   * @param {number} [runs=5] - Runs per config per image
   * @returns {Promise<object>} Results from both images
   */
  async function runBestConfigTest(runs = 5) {
    const configs = [
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "baseline",
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "full-repeat+reason",
        promptRepetition: "full",
        reasoning: { desc: true, verify: false },
      },
      {
        descModel: "anthropic/claude-haiku-4.5",
        label: "echo+reason",
        promptRepetition: "context-echo",
        reasoning: { desc: true, verify: false },
      },
    ];

    const images = Object.keys(testImages);
    if (images.length === 0) {
      await loadTestImages();
    }
    const imageKeys = Object.keys(testImages);

    console.log(`\n${"═".repeat(60)}`);
    console.log("EXPERIMENT: Best Config Test");
    console.log(
      `${configs.length} configs × ${imageKeys.length} images × ${runs} runs = ${configs.length * imageKeys.length * runs} total`,
    );
    console.log(`${"═".repeat(60)}\n`);

    const allBatchResults = {};

    for (const imageKey of imageKeys) {
      console.log(`\n${"▓".repeat(60)}`);
      console.log(`IMAGE: ${imageKey}`);
      console.log(`${"▓".repeat(60)}`);

      allBatchResults[imageKey] = await runComparisonBatch(
        imageKey,
        configs,
        runs,
      );
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("EXPERIMENT COMPLETE: Best Config Test");
    console.log(`${"═".repeat(60)}\n`);

    return allBatchResults;
  }

  /**
   * Dry run — build prompts and log them, no API call.
   * @param {string} imageKey - Test image key
   * @param {string} descModel - Description model ID
   * @param {object} [options={}] - Options to preview (promptRepetition, reasoning)
   */
  async function dryRun(imageKey, descModel, options = {}) {
    const ctrl = window.ImageDescriberController;
    if (!ctrl) {
      throw new Error("ImageDescriberController not available");
    }

    // Ensure prompts loaded
    if (ctrl.waitForPrompts) {
      await ctrl.waitForPrompts();
    }

    const image = await getTestImage(imageKey);
    if (!image) {
      logWarn(
        `Image "${imageKey}" not available (or has no base64). Proceeding with prompt build only.`,
      );
    }

    const promptRepetition =
      options.promptRepetition ||
      HARNESS_CONFIG.PROMPT_REPETITION_MODE ||
      "none";
    const reasoning = options.reasoning || null;

// Save and set form context and analysis state
    savedFormState = saveFormState();
    const savedAnalysis = ctrl.lastAnalysis;

    try {
      if (image) {
        setFormContext(image.context);
      }

      // Handle analysis inclusion (Phase 3)
      let analysisResult = null;
      if (options.includeAnalysis === true) {
        analysisResult = await runAnalysisForTestImage(imageKey);
        ctrl.lastAnalysis = analysisResult;
        if (analysisResult) {
          logInfo("Analysis data injected for dry run prompt building");
        } else {
          logWarn("Analysis requested but returned null — prompt will have no analysis data");
        }
      } else if (options.includeAnalysis === false) {
        ctrl.lastAnalysis = null;
      }

      const systemPrompt = ctrl.buildSystemPrompt();
      const originalUserPrompt = ctrl.buildUserPrompt();
      const userPrompt = applyPromptRepetition(
        originalUserPrompt,
        promptRepetition,
        image?.context,
      );

      console.log("\n=== DRY RUN ===");
      console.log(`Image: ${imageKey} (${image?.name || "not loaded"})`);
      console.log(`Model: ${descModel}`);
      console.log(
        `Base64 available: ${image?.base64 ? `${image.base64.length} chars` : "No"}`,
      );

      // Show Phase 2F options
      if (promptRepetition !== "none") {
        console.log(`Prompt repetition: ${promptRepetition}`);
        console.log(
          `  Original: ${originalUserPrompt.length} chars → Final: ${userPrompt.length} chars (${(userPrompt.length / originalUserPrompt.length).toFixed(1)}×)`,
        );
      }
      if (reasoning) {
        const descR = reasoning.desc
          ? buildTestReasoningConfig(descModel)
          : null;
        console.log(
          `Reasoning: desc=${reasoning.desc ? descR.effort || "adaptive" : "off"}, verify=${reasoning.verify ? "on" : "off"}`,
        );
        if (reasoning.desc) {
          console.log(
            `  Temperature: ${HARNESS_CONFIG.TEMPERATURE_DESCRIPTION} (reasoning does not change this)`,
          );
        }
      }

      console.log("");
      console.log("─── SYSTEM PROMPT ───");
      console.log(
        `Length: ${systemPrompt.length} chars (~${Math.round(systemPrompt.length / 4)} tokens)`,
      );
      console.log(systemPrompt.substring(0, 500) + "...");
      console.log("");
      console.log("─── USER PROMPT ───");
      console.log(
        `Length: ${userPrompt.length} chars (~${Math.round(userPrompt.length / 4)} tokens)`,
      );
      console.log(userPrompt);
      console.log("");

      if (ctrl.buildVerificationSystemPrompt) {
        const verifySys = ctrl.buildVerificationSystemPrompt();
        console.log("─── VERIFICATION SYSTEM PROMPT ───");
        console.log(
          `Length: ${verifySys.length} chars (~${Math.round(verifySys.length / 4)} tokens)`,
        );
        console.log(verifySys.substring(0, 300) + "...");
      }

      if (image?.groundTruth) {
        console.log("");
        console.log("─── GROUND TRUTH ───");
        console.log(
          `mustContain: ${image.groundTruth.mustContain?.join(", ")}`,
        );
        console.log(
          `mustNotContain: ${image.groundTruth.mustNotContain?.join(", ")}`,
        );
        console.log(
          `visualFacts: ${image.groundTruth.visualFacts?.length || 0} items`,
        );
      }

      console.log("\n=== END DRY RUN (no API calls made) ===\n");
} finally {
      restoreFormState(savedFormState);
      savedFormState = null;
      ctrl.lastAnalysis = savedAnalysis;
    }
  }

  /**
   * Run a test and immediately evaluate with AI.
   * @param {string} imageKey
   * @param {string} descModel
   * @param {string|null} verifyModel
   * @param {boolean} verifyEnabled
   * @returns {Promise<object>} Result with AI evaluation
   */
  async function runAndEvaluate(
    imageKey,
    descModel,
    verifyModel,
    verifyEnabled,
  ) {
    const result = await runSingleTest(
      imageKey,
      descModel,
      verifyModel,
      verifyEnabled,
    );
    if (result && !result.error) {
      await evaluateResult(result.key);
    }
    return result;
  }

  // ============================================================================
  // PHASE 3: DISPLAY & COMPARISON
  // ============================================================================

  /**
   * Print a quick checklist summary to console.
   * @param {object} checklist - Checklist result
   */
  function printChecklistSummary(checklist) {
    // mustContain
    checklist.mustContainDetails?.forEach((d) => {
      console.log(`  ${d.found ? "✅" : "❌"} contains "${d.term}"`);
    });

    // mustNotContain
    checklist.mustNotContainDetails?.forEach((d) => {
      console.log(`  ${d.violation ? "❌ VIOLATION" : "✅ NO"} "${d.term}"`);
    });

    // visualFacts
    checklist.visualFactsDetails?.forEach((d) => {
      const req = d.required ? "[REQ]" : "[OPT]";
      if (d.passed) {
        console.log(`  ✅ ${req} ${d.id}: ${d.claim}`);
      } else {
        console.log(`  ❌ ${req} ${d.id}: ${d.claim}`);
        if (d.failReason) {
          console.log(`     → ${d.failReason}`);
        }
      }
    });
  }

  /**
   * Show a console.table summary of all stored results.
   * Includes Phase 2F columns for prompt repetition, reasoning, and reliability runs.
   */
  function showTestMatrix() {
    const results = Object.values(allResults);
    if (results.length === 0) {
      logInfo("No results stored. Run some tests first.");
      return;
    }

    console.log(
      `\n=== IMAGE DESCRIBER TEST MATRIX (${results.length} results) ===\n`,
    );

    const rows = results.map((r) => {
      // Build reasoning label
      let reasonLabel = "-";
      if (r.reasoning) {
        if (r.reasoning.descEnabled && r.reasoning.verifyEnabled) {
          reasonLabel = "both";
        } else if (r.reasoning.descEnabled) {
          reasonLabel = "desc";
        } else if (r.reasoning.verifyEnabled) {
          reasonLabel = "verify";
        }
      }

      // Build run label
      const runLabel = r.reliabilityRun
        ? `${r.reliabilityRun.runNumber}/${r.reliabilityRun.totalRuns}`
        : "-";

      return {
        Key: r.key,
        Image: r.imageKey,
        DescModel: r.descModel?.replace("anthropic/claude-", "") || "?",
        VerifyModel: r.verifyModel?.replace("anthropic/claude-", "") || "-",
        Rep: r.promptRepetition || "-",
        Reason: reasonLabel,
        Run: runLabel,
        DescTok: r.description?.totalTokens || "?",
        DescMs: r.description?.elapsedMs || "?",
        ReasonTok: r.description?.reasoningTokens || "-",
        FactsOK: `${r.checklist?.visualFactsPassed || 0}/${r.checklist?.visualFactsTotal || 0}`,
        Pass: r.checklist?.overallPass ? "✅" : "❌",
        AIScore: r.aiEvaluation?.overallScore?.weighted?.toFixed(2) || "-",
      };
    });

    console.table(rows);
    console.log("\n=== END TEST MATRIX ===\n");
  }

  /**
   * Compare models side-by-side for one image.
   * @param {string} imageKey - Image key to filter by
   */
  function compareModels(imageKey) {
    const matches = Object.values(allResults).filter(
      (r) => r.imageKey === imageKey,
    );

    if (matches.length === 0) {
      logWarn(`No results found for image "${imageKey}"`);
      logInfo("Available images:", [
        ...new Set(Object.values(allResults).map((r) => r.imageKey)),
      ]);
      return;
    }

    console.log(
      `\n=== MODEL COMPARISON: ${imageKey} (${matches.length} results) ===\n`,
    );

    const rows = matches.map((r) => ({
      DescModel: r.descModel?.replace("anthropic/claude-", ""),
      VerifyModel: r.verifyModel?.replace("anthropic/claude-", "") || "-",
      DescTokens: r.description?.totalTokens || "?",
      VerifyTokens: r.verification?.totalTokens || "-",
      Violations: r.checklist?.mustNotContainViolations || 0,
      FactsOK: `${r.checklist?.visualFactsPassed || 0}/${r.checklist?.visualFactsTotal || 0}`,
      Pass: r.checklist?.overallPass ? "✅" : "❌",
      AIScore: r.aiEvaluation?.overallScore?.weighted?.toFixed(2) || "-",
    }));

    console.table(rows);

    // Show description excerpts
    matches.forEach((r) => {
      console.log(`\n─── ${r.descModel?.replace("anthropic/claude-", "")} ───`);
      console.log(r.description?.text?.substring(0, 300) + "...");

      if (r.verification?.text) {
        console.log("\nVerification output:");
        console.log(r.verification.text.substring(0, 200) + "...");
      }
    });

    console.log(`\n=== END COMPARISON ===\n`);
  }

  /**
   * Compare how the same model performs across all images.
   * @param {string} modelFragment - Partial model ID to match
   */
  function compareImages(modelFragment) {
    const matches = Object.values(allResults).filter((r) =>
      r.descModel?.includes(modelFragment),
    );

    if (matches.length === 0) {
      logWarn(`No results found for model containing "${modelFragment}"`);
      return;
    }

    console.log(
      `\n=== IMAGE COMPARISON: ${modelFragment} (${matches.length} results) ===\n`,
    );

    const rows = matches.map((r) => ({
      Image: r.imageKey,
      VerifyModel: r.verifyModel?.replace("anthropic/claude-", "") || "-",
      MustHit: `${r.checklist?.mustContainHits || 0}/${r.checklist?.mustContainTotal || 0}`,
      Violations: r.checklist?.mustNotContainViolations || 0,
      FactsOK: `${r.checklist?.visualFactsPassed || 0}/${r.checklist?.visualFactsTotal || 0}`,
      Pass: r.checklist?.overallPass ? "✅" : "❌",
      AIScore: r.aiEvaluation?.overallScore?.weighted?.toFixed(2) || "-",
    }));

    console.table(rows);
    console.log(`\n=== END IMAGE COMPARISON ===\n`);
  }

  /**
   * Show detailed checklist results for a specific test result.
   * @param {string} resultKey - Result key
   */
  function showChecklist(resultKey) {
    const result = allResults[resultKey];
    if (!result) {
      logWarn(`Result not found: "${resultKey}"`);
      logInfo("Available keys:", Object.keys(allResults));
      return;
    }

    console.log(`\n=== CHECKLIST: ${resultKey} ===\n`);
    console.log(
      `Overall: ${result.checklist?.overallPass ? "✅ PASS" : "❌ FAIL"}`,
    );
    console.log("");

    printChecklistSummary(result.checklist);

    console.log(`\n=== END CHECKLIST ===\n`);
  }

  // ============================================================================
  // PHASE 4: AI EVALUATION (Tier 2 — Optional, Costs Money)
  // ============================================================================

  /**
   * Build the evaluation system prompt for the AI evaluator.
   * @returns {string}
   */
  function buildEvalSystemPrompt() {
    return [
      "You are an expert evaluator assessing the quality of AI-generated accessible image descriptions for UK higher education.",
      "",
      "You will receive:",
      "- The original image (as base64)",
      "- The generated description (markdown text)",
      "- Ground truth information about what is actually in the image",
      "- The verification output (if a second-pass check was performed)",
      "",
      "## Evaluation Criteria",
      "",
      "Score each dimension 0–10 using these anchors:",
      "",
      "### Visual Accuracy (weight: 0.40)",
      "How accurately does the description represent what is visually present?",
      "- 10: Every visual claim verified correct",
      "- 7–9: Minor inaccuracies that don't mislead",
      "- 4–6: Some incorrect visual claims",
      "- 1–3: Significant hallucinations or misidentifications",
      "- 0: Fundamentally wrong description",
      "",
      "### Completeness (weight: 0.20)",
      "Does the description cover all important visual elements?",
      "- 10: All key elements described",
      "- 7–9: Most elements covered, minor omissions",
      "- 4–6: Important elements missing",
      "- 1–3: Very incomplete",
      "- 0: Essentially empty",
      "",
      "### Hallucination Penalty (weight: 0.25)",
      "Are there fabricated elements not present in the image?",
      "- 10: Zero hallucinations",
      "- 7–9: Minor embellishments that don't mislead",
      "- 4–6: Some fabricated details",
      "- 1–3: Multiple significant hallucinations",
      "- 0: Largely fabricated",
      "",
      "### Format Compliance (weight: 0.15)",
      "Does the output follow the required structure (Title, Alt Text, Long Description, Text Content)?",
      "- 10: Perfect structure and formatting",
      "- 7–9: Minor formatting issues",
      "- 4–6: Missing sections or structural problems",
      "- 1–3: Largely non-compliant",
      "- 0: No recognisable structure",
      "",
      "## Output Format",
      "",
      "You MUST output ONLY valid JSON matching the schema provided in the user message.",
      "No markdown fences, no preamble, no explanation outside the JSON.",
      "Use British spelling throughout all text fields.",
    ].join("\n");
  }

  /**
   * Build the evaluation user prompt for a specific result.
   * @param {object} result - Test result
   * @param {object} image - Test image data
   * @returns {string}
   */
  function buildEvalUserPrompt(result, image) {
    const verificationSection = result.verification?.text
      ? [
          "",
          "## Verification Output (from second-pass check)",
          "",
          result.verification.text,
        ].join("\n")
      : "\n## Verification Output\n\nNo verification was performed.";

    const groundTruthSection = [
      "## Ground Truth",
      "",
      `Must contain: ${image.groundTruth.mustContain?.join(", ")}`,
      `Must NOT contain: ${image.groundTruth.mustNotContain?.join(", ")}`,
      "",
      "Visual facts:",
      ...(image.groundTruth.visualFacts || []).map(
        (f) =>
          `- [${f.required ? "REQUIRED" : "OPTIONAL"}] ${f.id}: ${f.claim}`,
      ),
    ].join("\n");

    const checklistSection = [
      "## Automated Checklist Results",
      "",
      `Overall: ${result.checklist?.overallPass ? "PASS" : "FAIL"}`,
      `mustContain hits: ${result.checklist?.mustContainHits}/${result.checklist?.mustContainTotal}`,
      `mustNotContain violations: ${result.checklist?.mustNotContainViolations}/${result.checklist?.mustNotContainTotal}`,
      `visualFacts passed: ${result.checklist?.visualFactsPassed}/${result.checklist?.visualFactsTotal}`,
    ].join("\n");

    const jsonSchema = JSON.stringify(
      {
        visualAccuracy: { score: "0-10", weight: 0.4, rationale: "string" },
        completeness: { score: "0-10", weight: 0.2, rationale: "string" },
        hallucinations: { score: "0-10", weight: 0.25, rationale: "string" },
        formatCompliance: { score: "0-10", weight: 0.15, rationale: "string" },
        overallScore: { weighted: "0.00 (computed)" },
        corrections: [
          {
            element: "string",
            described: "what the description says",
            actual: "what the image actually shows",
            severity: "critical|moderate|minor",
          },
        ],
        summary: "Brief overall assessment using British spelling",
      },
      null,
      2,
    );

    return [
      "## Test Configuration",
      "",
      `Image: ${result.imageName} (${result.imageKey})`,
      `Description model: ${result.descModel}`,
      `Verification model: ${result.verifyModel || "none"}`,
      "",
      "## Generated Description",
      "",
      result.description?.text || "(empty)",
      "",
      verificationSection,
      "",
      groundTruthSection,
      "",
      checklistSection,
      "",
      "## Required JSON Output Schema",
      "",
      "Produce ONLY a JSON object matching this schema:",
      "",
      "```json",
      jsonSchema,
      "```",
      "",
      "Compute overallScore.weighted as: (visualAccuracy.score × 0.40) + (completeness.score × 0.20) + (hallucinations.score × 0.25) + (formatCompliance.score × 0.15)",
    ].join("\n");
  }

  /**
   * Evaluate a stored result using the AI evaluator (Tier 2).
   * @param {string} resultKey - Result key
   * @returns {Promise<object|null>} AI evaluation or null
   */
  async function evaluateResult(resultKey) {
    const result = allResults[resultKey];
    if (!result) {
      logWarn(`Result not found: "${resultKey}"`);
      logInfo("Available keys:", Object.keys(allResults));
      return null;
    }

    // Load the test image for ground truth and image data
    const image = await getTestImage(result.imageKey);
    if (!image) {
      logError(
        `Cannot evaluate: test image "${result.imageKey}" not available`,
      );
      return null;
    }

    logInfo(
      `Evaluating result: ${resultKey} with ${HARNESS_CONFIG.EVALUATOR_MODEL}...`,
    );

    try {
      const systemPrompt = buildEvalSystemPrompt();
      const userPrompt = buildEvalUserPrompt(result, image);

      const evalResponse = await callOpenRouter({
        model: HARNESS_CONFIG.EVALUATOR_MODEL,
        systemPrompt,
        userPrompt,
        imageBase64: image.base64,
        imageMimeType: image.mimeType,
        maxTokens: HARNESS_CONFIG.MAX_TOKENS_EVALUATOR,
        temperature: HARNESS_CONFIG.TEMPERATURE_EVALUATOR,
      });

      // Parse JSON from response (strip markdown fences if present)
      let evaluation = null;
      let rawText = evalResponse.text.trim();

      // Strip markdown code fences
      if (rawText.startsWith("```json")) {
        rawText = rawText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      try {
        evaluation = JSON.parse(rawText);
      } catch (parseError) {
        logError("Failed to parse AI evaluation as JSON:", parseError);
        logDebug("Raw response:", rawText);
        evaluation = { parseError: true, rawText };
      }

      // Verify weighted score if parsed successfully
      if (evaluation && !evaluation.parseError) {
        const verification = verifyWeightedScore(evaluation);
        if (!verification.match) {
          logWarn(
            `Score discrepancy: computed ${verification.computed} vs stated ${verification.stated}`,
          );
          evaluation._scoreVerification = verification;
        }
      }

      // Store evaluation on the result
      result.aiEvaluation = evaluation;
      result.aiEvaluationMeta = {
        model: HARNESS_CONFIG.EVALUATOR_MODEL,
        tokens: evalResponse.totalTokens,
        elapsedMs: evalResponse.elapsedMs,
        timestamp: new Date().toISOString(),
      };

      // Persist
      allResults[resultKey] = result;
      saveToLocalStorage();

      // Print summary
      if (evaluation && !evaluation.parseError) {
        console.log(`\n=== AI EVALUATION: ${resultKey} ===`);
        console.log(
          `Visual Accuracy:   ${evaluation.visualAccuracy?.score}/10 — ${evaluation.visualAccuracy?.rationale}`,
        );
        console.log(
          `Completeness:      ${evaluation.completeness?.score}/10 — ${evaluation.completeness?.rationale}`,
        );
        console.log(
          `Hallucinations:    ${evaluation.hallucinations?.score}/10 — ${evaluation.hallucinations?.rationale}`,
        );
        console.log(
          `Format Compliance: ${evaluation.formatCompliance?.score}/10 — ${evaluation.formatCompliance?.rationale}`,
        );
        console.log(`Overall (weighted): ${evaluation.overallScore?.weighted}`);
        if (evaluation.corrections?.length) {
          console.log(`\nCorrections (${evaluation.corrections.length}):`);
          evaluation.corrections.forEach((c, i) => {
            console.log(
              `  ${i + 1}. [${c.severity}] ${c.element}: described "${c.described}" → actual "${c.actual}"`,
            );
          });
        }
        console.log(`Summary: ${evaluation.summary}`);
        console.log(`=== END EVALUATION ===\n`);
      }

      // Auto-download updated result
      if (HARNESS_CONFIG.AUTO_DOWNLOAD) {
        downloadJSON(
          result,
          `imgdesc-eval-${resultKey.replace(/\|/g, "-").replace(/\+/g, "-")}-${Date.now()}.json`,
        );
      }

      return evaluation;
    } catch (error) {
      logError("AI evaluation failed:", error);
      return null;
    }
  }

  /**
   * Evaluate all unevaluated results.
   * @returns {Promise<number>} Number of evaluations completed
   */
  async function evaluateAll() {
    const unevaluated = Object.values(allResults).filter(
      (r) => !r.aiEvaluation && !r.error,
    );

    if (unevaluated.length === 0) {
      logInfo("All results already have AI evaluations.");
      return 0;
    }

    logInfo(`Evaluating ${unevaluated.length} unevaluated results...`);

    let completed = 0;
    for (const result of unevaluated) {
      try {
        await evaluateResult(result.key);
        completed++;

        // Rate limit delay
        if (completed < unevaluated.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, HARNESS_CONFIG.MATRIX_DELAY_MS),
          );
        }
      } catch (error) {
        logError(`Evaluation failed for ${result.key}:`, error.message);
      }
    }

    logInfo(
      `Evaluation complete: ${completed}/${unevaluated.length} evaluated`,
    );
    return completed;
  }

  /**
   * Verify a weighted score calculation.
   * @param {object} evaluation - AI evaluation object
   * @returns {object} Verification result
   */
  function verifyWeightedScore(evaluation) {
    const va = evaluation.visualAccuracy?.score ?? 0;
    const co = evaluation.completeness?.score ?? 0;
    const ha = evaluation.hallucinations?.score ?? 0;
    const fc = evaluation.formatCompliance?.score ?? 0;

    const computed = va * 0.4 + co * 0.2 + ha * 0.25 + fc * 0.15;
    const stated = parseFloat(evaluation.overallScore?.weighted) || 0;
    const discrepancy = Math.abs(computed - stated);

    return {
      computed: parseFloat(computed.toFixed(2)),
      stated: parseFloat(stated.toFixed(2)),
      discrepancy: parseFloat(discrepancy.toFixed(2)),
      match: discrepancy <= 0.15,
    };
  }

  /**
   * Generate a final analysis report using Opus.
   * Analyses all stored results and produces a comprehensive summary.
   * @returns {Promise<string|null>} Report text or null
   */
  async function generateFinalReport() {
    const results = Object.values(allResults).filter((r) => !r.error);
    if (results.length < 2) {
      logWarn("Need at least 2 results for a meaningful report.");
      return null;
    }

    const apiKey = localStorage.getItem("openrouter_api_key");
    if (!apiKey) {
      throw new Error("No API key found in localStorage");
    }

    // Build compact summary (no full description text — just metrics)
    const compact = results.map((r) => ({
      key: r.key,
      image: r.imageKey,
      descModel: r.descModel,
      verifyModel: r.verifyModel || null,
      descTokens: r.description?.totalTokens,
      descMs: r.description?.elapsedMs,
      verifyTokens: r.verification?.totalTokens || null,
      verifyMs: r.verification?.elapsedMs || null,
      checklistPass: r.checklist?.overallPass,
      mustContainHits: `${r.checklist?.mustContainHits}/${r.checklist?.mustContainTotal}`,
      violations: r.checklist?.mustNotContainViolations,
      visualFactsPass: `${r.checklist?.visualFactsPassed}/${r.checklist?.visualFactsTotal}`,
      aiWeighted: r.aiEvaluation?.overallScore?.weighted || null,
      aiVisualAccuracy: r.aiEvaluation?.visualAccuracy?.score || null,
      aiHallucinations: r.aiEvaluation?.hallucinations?.score || null,
      corrections: r.aiEvaluation?.corrections?.length || 0,
      summary: r.aiEvaluation?.summary || null,
    }));

    logInfo(`Generating final report from ${results.length} results...`);

    const response = await fetch(HARNESS_CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "Image Describer Test Harness - Final Report",
      },
      body: JSON.stringify({
        model: HARNESS_CONFIG.EVALUATOR_MODEL,
        messages: [
          {
            role: "user",
            content: [
              "You are analysing results from a model comparison test for an AI-powered accessible image description tool.",
              "The tool generates structured descriptions (Title, Alt Text, Long Description, Text Content) for UK higher education.",
              "",
              "Results data:",
              "",
              "```json",
              JSON.stringify(compact, null, 2),
              "```",
              "",
              "Please produce a comprehensive analysis report:",
              "",
              "1. Which model combination achieves the best visual accuracy?",
              "2. Does verification (two-pass) meaningfully reduce hallucinations?",
              "3. Is the cost of verification justified by the quality improvement?",
              "4. Which model combination would you recommend as the default?",
              "5. Are there images where specific combinations clearly win or lose?",
              "6. What hallucination patterns persist across models?",
              "",
              "Structure: Executive summary, results table, per-question analysis, recommendations.",
              "Use British spelling throughout. Be data-driven — cite specific scores.",
            ].join("\n"),
          },
        ],
        max_tokens: HARNESS_CONFIG.MAX_TOKENS_EVALUATOR,
        temperature: HARNESS_CONFIG.TEMPERATURE_EVALUATOR,
      }),
    });

    if (!response.ok) {
      throw new Error(`Report API error ${response.status}`);
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content;

    if (report) {
      console.log("\n=== FINAL ANALYSIS REPORT ===\n");
      console.log(report);
      console.log("\n=== END REPORT ===\n");

      downloadJSON(
        {
          generatedAt: new Date().toISOString(),
          resultCount: results.length,
          report,
          rawData: compact,
        },
        `imgdesc-final-report-${Date.now()}.json`,
      );
    }

    return report;
  }

  // ============================================================================
  // PHASE 5: IMAGE MANAGEMENT
  // ============================================================================

  /**
   * Add or update a test image at runtime.
   * @param {string} key - Image key
   * @param {string} base64 - Base64-encoded image data
   * @param {object} context - Form context fields
   * @param {object} groundTruth - Ground truth checklist
   */
  function addTestImage(key, base64, context, groundTruth) {
    testImages[key] = {
      name: key,
      filename: `${key}.png`,
      base64,
      mimeType: "image/png",
      context: context || {},
      groundTruth: groundTruth || {
        mustContain: [],
        mustNotContain: [],
        visualFacts: [],
      },
    };

    logInfo(`Test image added: "${key}" (${base64.length} chars base64)`);
  }

  /**
   * List all registered test images.
   */
  function listTestImages() {
    if (!imagesLoaded) {
      logInfo("Loading test images...");
      loadTestImages().then(() => listTestImages());
      return;
    }

    const images = Object.entries(testImages);
    if (images.length === 0) {
      logInfo("No test images registered.");
      return;
    }

    console.log(`\n=== TEST IMAGES (${images.length}) ===\n`);

    const rows = images.map(([key, img]) => ({
      Key: key,
      Name: img.name,
      HasBase64:
        img.base64 && img.base64.length > 0
          ? `✅ (${img.base64.length} chars)`
          : "❌",
      MimeType: img.mimeType,
      Subject: img.context?.subject || "-",
      MustContain: img.groundTruth?.mustContain?.length || 0,
      MustNotContain: img.groundTruth?.mustNotContain?.length || 0,
      VisualFacts: img.groundTruth?.visualFacts?.length || 0,
    }));

    console.table(rows);
    console.log("\n=== END TEST IMAGES ===\n");
  }

  /**
   * Open a file picker, read an image, and add it to the registry.
   * Convenience function for populating the test image JSON.
   *
   * @param {string} key - Image key (must match a key in the JSON registry)
   * @returns {Promise<string>} Base64 data
   */
  function captureTestImage(key) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.style.display = "none";

      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("No file selected"));
          input.remove();
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(",")[1];
          const mimeType = file.type;

          // Update existing entry or create new
          if (testImages[key]) {
            testImages[key].base64 = base64;
            testImages[key].mimeType = mimeType;
            testImages[key].filename = file.name;
            logInfo(
              `Updated test image "${key}" with ${base64.length} chars base64`,
            );
          } else {
            addTestImage(key, base64, {}, {});
            testImages[key].mimeType = mimeType;
            testImages[key].filename = file.name;
          }

          console.log(`\nImage "${key}" captured: ${base64.length} chars`);
          console.log(
            `To persist, copy the base64 into image-describer-test-images.json`,
          );
          console.log(
            `Or download it: window.ImageDescriberTestHarness.downloadImageRegistry()`,
          );

          input.remove();
          resolve(base64);
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
          input.remove();
        };

        reader.readAsDataURL(file);
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Download the current test image registry as JSON.
   * Useful after adding images with captureTestImage().
   */
  function downloadImageRegistry() {
    const registry = {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      description: "Test image registry for Image Describer Test Harness.",
      images: testImages,
    };

    downloadJSON(registry, `image-describer-test-images-${Date.now()}.json`);
  }

  // ============================================================================
  // DATA MANAGEMENT
  // ============================================================================

  /**
   * Export all results as a downloadable JSON file.
   */
  function exportAllResults() {
    const results = Object.values(allResults);
    if (results.length === 0) {
      logInfo("No results to export.");
      return;
    }

    downloadJSON(
      {
        exportedAt: new Date().toISOString(),
        resultCount: results.length,
        results: allResults,
      },
      `imgdesc-all-results-${Date.now()}.json`,
    );
  }

  /**
   * Import results from a JSON object or string.
   * @param {object|string} json - Results data
   */
  function importTestResults(json) {
    try {
      const data = typeof json === "string" ? JSON.parse(json) : json;

      // Support both { results: {...} } wrapper and direct { key: result } format
      const imported = data.results || data;

      let count = 0;
      for (const [key, result] of Object.entries(imported)) {
        if (result.key && result.imageKey) {
          allResults[key] = result;
          count++;
        }
      }

      saveToLocalStorage();
      logInfo(`Imported ${count} results`);
    } catch (error) {
      logError("Import failed:", error);
    }
  }

  /**
   * Clear all stored results.
   */
  function clearResults() {
    const count = Object.keys(allResults).length;
    allResults = {};
    localStorage.removeItem(HARNESS_CONFIG.STORAGE_KEY);
    logInfo(`Cleared ${count} results`);
  }

  // ============================================================================
  // HELP
  // ============================================================================

  /**
   * Show all available commands and current state.
   */
  function showHelp() {
    console.log("\n=== Image Describer Test Harness v2.0.0 (Phase 2F) ===\n");
    console.log("WORKFLOW:");
    console.log(
      "  1. window.listTestImages()          — Check available test images",
    );
    console.log(
      "  2. window.dryRun(key, model, opts?) — Build prompts, no API call",
    );
    console.log(
      "  3. window.runTest(key, desc, verify?, enabled?, opts?) — Single test",
    );
    console.log("  4. window.runMatrix()               — Full default matrix");
    console.log("  5. window.showTestMatrix()          — View all results");
    console.log("");
    console.log("CORE COMMANDS:");
    console.log(
      "  runTest(imageKey, descModel, verifyModel?, verifyEnabled?, options?)",
    );
    console.log("  runMatrix(matrixArray?)              — Run test matrix");
    console.log("  runCheapMatrix()                     — Haiku-only matrix");
    console.log(
      "  runAndEvaluate(key, desc, verify?, enabled?)  — Test + AI eval",
    );
    console.log(
      "  dryRun(imageKey, descModel, options?) — Prompts only, no API",
    );
    console.log("");
    console.log("RELIABILITY & COMPARISON (Phase 2F):");
    console.log(
      "  runReliability(imageKey, model, runs?, opts?)  — N runs, same config",
    );
    console.log(
      "  showReliability(imageKey, modelFragment?)      — Analyse reliability",
    );
    console.log(
      "  runComparisonBatch(imageKey, configs, runs?)   — Compare configs",
    );
    console.log(
      "  showComparisonReport(imageKey?)                — Report from stored data",
    );
console.log("");
    console.log("PREDEFINED EXPERIMENTS (Phase 2F):");
    console.log(
      "  runRepetitionTest(runs?)             — A/B: baseline vs repetition modes",
    );
    console.log(
      "  runReasoningTest(runs?)              — A/B: baseline vs reasoning modes",
    );
    console.log(
      "  runBestConfigTest(runs?)             — Combined best configs",
    );
    console.log("");
    console.log("ANALYSIS COMPARISON (Phase 3):");
    console.log(
      "  runAnalysisComparison(key, model?, runs?)  — A/B: with vs without analysis",
    );
    console.log(
      "  runAnalysisForTestImage(key, profile?)      — Run analyser on test image",
    );
    console.log("");
    console.log("OPTIONS OBJECT (for runTest, dryRun, runReliability):");
    console.log(
      "  { promptRepetition: 'none'|'full'|'verbose'|'context-echo',",
    );
    console.log("    reasoning: { desc: true/false, verify: true/false },");
    console.log("    includeAnalysis: true/false,");
    console.log(
      "    verifyModel: 'anthropic/claude-...', verifyEnabled: true }",
    );
    console.log("");
    console.log("RESULTS:");
    console.log(
      "  showTestMatrix()                     — console.table of all results",
    );
    console.log(
      "  compareModels(imageKey)              — Side-by-side for one image",
    );
    console.log(
      "  compareImages(modelFragment)         — Same model across images",
    );
    console.log(
      "  showChecklist(resultKey)             — Detailed checklist output",
    );
    console.log("");
    console.log("AI EVALUATION (costs money):");
    console.log(
      "  evaluateResult(resultKey)            — AI-evaluate one result",
    );
    console.log(
      "  evaluateAll()                        — Evaluate all unevaluated",
    );
    console.log(
      "  generateFinalReport()                — Opus analysis of all results",
    );
    console.log("");
    console.log("DATA:");
    console.log(
      "  exportAllResults()                   — Download all as JSON",
    );
    console.log("  importTestResults(json)              — Import from JSON");
    console.log("  clearResults()                       — Clear localStorage");
    console.log("");
    console.log("IMAGES:");
    console.log(
      "  listTestImages()                     — Show registered images",
    );
    console.log(
      "  addTestImage(key, base64, ctx, gt)   — Add image at runtime",
    );
    console.log(
      "  captureTestImage(key)                — File picker → base64",
    );
    console.log(
      "  downloadImageRegistry()              — Download images JSON",
    );
    console.log("");
    console.log(`Results stored: ${Object.keys(allResults).length}`);
    console.log(`Test images: ${Object.keys(testImages).length}`);
    console.log("\n=== END HELP ===\n");
  }
  // ============================================================================
  // INITIALISATION
  // ============================================================================

  // Load previously saved results from localStorage
  loadFromLocalStorage();

  // Attempt to load test images (non-blocking)
  loadTestImages().catch((err) => {
    logWarn(
      "Test images not loaded on init (may need manual loading):",
      err.message,
    );
  });

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberTestHarness = {
    config: HARNESS_CONFIG,
    get results() {
      return allResults;
    },
    get testImages() {
      return testImages;
    },

    // Core workflow
    runTest: runSingleTest,
    runMatrix,
    runCheapMatrix,
    runAndEvaluate,
    runReliability,
    showReliability,
runComparisonBatch,
    showComparisonReport,
    runAnalysisComparison,
    runAnalysisForTestImage,
    runRepetitionTest,
    runReasoningTest,
    runBestConfigTest,
    dryRun,

    // Results
    showTestMatrix,
    compareModels,
    compareImages,
    showChecklist,

    // AI evaluation
    evaluateResult,
    evaluateAll,
    generateFinalReport,

    // Data management
    exportAllResults,
    importTestResults,
    clearResults,

    // Image management
    addTestImage,
    listTestImages,
    captureTestImage,
    downloadImageRegistry,

    // Help
    showHelp,

    // Internal utilities (exposed for debugging)
    evaluateChecklist,
    callOpenRouter,
    verifyWeightedScore,
    loadTestImages,
  };

  // Convenience shortcuts (matching spec)
  window.runTest = runSingleTest;
  window.runMatrix = runMatrix;
  window.runCheapMatrix = runCheapMatrix;
  window.runAndEvaluate = runAndEvaluate;
  window.runReliability = runReliability;
  window.showReliability = showReliability;
  window.runComparisonBatch = runComparisonBatch;
  window.showComparisonReport = showComparisonReport;
window.runRepetitionTest = runRepetitionTest;
  window.runReasoningTest = runReasoningTest;
  window.runBestConfigTest = runBestConfigTest;
  window.runAnalysisComparison = runAnalysisComparison;
  window.runAnalysisForTestImage = runAnalysisForTestImage;
  window.dryRun = dryRun;
  window.showTestMatrix = showTestMatrix;
  window.compareModels = compareModels;
  window.compareImages = compareImages;
  window.showChecklist = showChecklist;
  window.evaluateResult = evaluateResult;
  window.evaluateAll = evaluateAll;
  window.generateFinalReport = generateFinalReport;
  window.exportAllResults = exportAllResults;
  window.importTestResults = importTestResults;
  window.clearResults = clearResults;
  window.addTestImage = addTestImage;
  window.listTestImages = listTestImages;
  window.captureTestImage = captureTestImage;
  window.imgDescTestHelp = showHelp;

  logInfo(
    "Test Harness v2.0.0 loaded. Type window.imgDescTestHelp() for commands.",
  );
  logInfo(
    `${Object.keys(allResults).length} previous results loaded from storage.`,
  );
})();
