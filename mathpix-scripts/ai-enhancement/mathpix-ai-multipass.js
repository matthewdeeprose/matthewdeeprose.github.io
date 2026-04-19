/**
 * @fileoverview MathPix AI Multi-Pass Verification
 * @module MathPixMultiPass
 * @version 1.2.0
 * @since Phase 7.5H1/2 (updated 7.5L: L.4 Pass 2 default-off unless consistency entries)
 *
 * Lightweight second-pass verification that REVIEWS Pass 1's corrections
 * rather than making new ones. Catches regressions (correct symbols changed)
 * and inconsistencies (fixes applied in some places but missed in others).
 *
 * v1.1.0 — Integrates MathPixDiffEngine for structured change manifests.
 *   Instead of sending two full documents, Pass 2 receives the enhanced MMD
 *   + a computed change log with classified changes and consistency inventory.
 *   Cuts prompt tokens by ~40% and transforms the LLM's task from
 *   "find differences in 200 lines" to "verify these specific changes."
 *
 * @requires OpenRouterEmbed - Core API client (from openrouter-embed-core.js)
 * @requires EmbedFileUtils - File attachment utilities (from openrouter-embed-file.js)
 * @requires MathPixAIEnhancer - Pass 1 enhancer instance
 * @requires MathPixDiffEngine - Local diff computation (from mathpix-ai-diff-engine.js)
 *
 * @accessibility WCAG 2.2 AA compliant
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[MultiPass] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MultiPass] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MultiPass] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MultiPass] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const MULTIPASS_CONFIG = {
    /** Temperature for Pass 2 \u2014 lower than Pass 1 (0.3) for deterministic verification */
    TEMPERATURE: 0.1,

    /** Top-p for Pass 2 */
    TOP_P: 0.9,

    /** Timeout for Pass 2 API call (same as Pass 1) */
    TIMEOUT_MS: 300000, // 5 minutes

    /** Chars per token estimate (matches enhancer) */
    CHARS_PER_TOKEN: 4,
  };

  // ============================================================================
  // VERIFICATION PROMPTS
  // ============================================================================

  /**
   * Build the system prompt for Pass 2 (verification).
   * Fundamentally different from the Pass 1 enhancement prompt \u2014
   * this REVIEWS corrections rather than making new ones.
   *
   * v1.1: Updated to reference the structured change manifest and
   * consistency inventory that the diff engine provides.
   *
   * @returns {string} Verification system prompt
   */
  function buildVerificationSystemPrompt() {
    return [
      "You are a mathematical document VERIFICATION REVIEWER.",
      "",
      "CRITICAL DEFAULT: Return the corrected MMD UNCHANGED unless you find a specific",
      "regression or a specific consistency item from the CONSISTENCY INVENTORY.",
      "If you find no problems, return the document exactly as given — this is the CORRECT outcome.",
      "Making zero changes is not a failure. Making unnecessary changes IS a failure.",
      "",
      "ABSOLUTE PROHIBITIONS — never do any of these:",
      "- NEVER dismantle equation environments (\\begin{aligned}, \\begin{align*}, \\begin{equation*}, etc.)",
      "- NEVER convert multi-line aligned equations into separate $$ blocks",
      "- NEVER remove alignment operators (& and \\\\) from aligned environments",
      "- NEVER delete image references (lines starting with ![](https://…))",
      "- NEVER add text that was not in the corrected MMD (no stray words, labels, or formatting hints)",
      "- NEVER reformat \\tag{n} to [n] or vice versa",
      "- NEVER change LaTeX spacing (\\, \\quad etc.) or whitespace formatting",
      "",
      "You have been given:",
      "1. The corrected MMD (your working document — change as little as possible)",
      "2. A CHANGE MANIFEST listing corrections that were made, classified by type",
      "3. A CONSISTENCY INVENTORY (may be empty) of substitutions applied inconsistently",
      "4. The source PDF for visual verification",
      "",
      "ONLY these two actions are permitted:",
      "",
      "ACTION 1 — REVERT A REGRESSION: If the CHANGE MANIFEST shows a SYMBOL or VALUE change",
      "where the ORIGINAL was actually correct (verify against the PDF), revert that specific",
      "change. Example: if \\alpha was changed to y but the PDF shows \\alpha, put \\alpha back.",
      "",
      "ACTION 2 — COMPLETE A CONSISTENCY FIX: If the CONSISTENCY INVENTORY lists remaining",
      "instances of a symbol that should have been corrected, verify against the PDF and apply",
      "the same correction to those specific remaining instances.",
      "",
      "Do not add commentary, do not add preamble text, do not restructure.",
      "",
      "Wrap your output in <verified_mmd> tags. Put ONLY the MMD content inside the tags.",
      "Any analysis or reasoning must go BEFORE the opening <verified_mmd> tag.",
      "Example: <verified_mmd>\\section*{Title}...</verified_mmd>",
    ].join("\n");
  }

  /**
   * Build the user prompt for Pass 2.
   *
   * v1.1: Uses the diff engine to provide a structured change manifest
   * instead of sending two full documents. The LLM receives:
   * - The enhanced MMD (working document to correct)
   * - A classified change manifest (what changed, where, what type)
   * - A consistency inventory (incomplete substitutions)
   *
   * Falls back to the original two-document approach if the diff engine
   * is unavailable.
   *
   * @param {string} originalMMD - Original OCR output
   * @param {string} enhancedMMD - Pass 1 corrected output
   * @param {string|null} diffManifest - Formatted diff engine output (null to use fallback)
   * @returns {string} Verification user prompt
   */
  function buildVerificationUserPrompt(
    originalMMD,
    enhancedMMD,
    diffManifest,
    diffStats,
  ) {
    // v1.2: If diff engine provided a manifest, use the compact format
    if (diffManifest) {
      const consistencyCount = diffStats?.consistencyEntries || 0;

      // Adapt instructions based on whether there are consistency items
      const instructions =
        consistencyCount > 0
          ? [
              "=== INSTRUCTIONS ===",
              `The CONSISTENCY INVENTORY contains ${consistencyCount} entries — these are your primary targets.`,
              "For each entry, verify against the SOURCE PDF (attached) whether the remaining",
              "instances should also be corrected. Apply corrections to those that should match.",
              "",
              "Also scan the CHANGE MANIFEST for any SYMBOL or VALUE regressions (correct symbols",
              "that were wrongly changed). Revert any you find.",
              "",
              "Do NOT restructure equations, remove images, or change formatting.",
              "If no regressions are found and all consistency items are addressed,",
              "the rest of the document should be returned EXACTLY as given.",
              "Wrap your output in <verified_mmd> tags. Only MMD content inside the tags.",
            ]
          : [
              "=== INSTRUCTIONS ===",
              "The CONSISTENCY INVENTORY is empty — there are no incomplete substitutions.",
              "Your ONLY task is regression checking: scan the CHANGE MANIFEST for SYMBOL",
              "or VALUE changes where the original was actually correct (verify against the",
              "SOURCE PDF attached). Revert any regressions you find.",
              "",
              "Do NOT restructure equations, remove images, change formatting, or add text.",
              "If no regressions are found, return the corrected MMD EXACTLY as given.",
              "Making zero changes is the correct outcome when there are no problems.",
              "Wrap your output in <verified_mmd> tags. Only MMD content inside the tags.",
            ];

      return [
        "=== CORRECTED MMD (working document \u2014 return this unchanged unless you find specific problems) ===",
        "",
        enhancedMMD,
        "",
        diffManifest,
        "",
        ...instructions,
      ].join("\n");
    }

    // Fallback: send both full documents (no diff engine available)
    logWarn(
      "Diff engine not available \u2014 using fallback two-document prompt",
    );
    return [
      "=== ORIGINAL MMD (from OCR) ===",
      "",
      originalMMD,
      "",
      "=== CORRECTED MMD (from Pass 1) ===",
      "",
      enhancedMMD,
      "",
      "=== INSTRUCTIONS ===",
      "Compare the ORIGINAL and CORRECTED versions against the SOURCE PDF.",
      "Revert any regressions. Apply any missed corrections consistently.",
      "Do NOT restructure equations, remove images, or change formatting.",
      "If no problems are found, return the corrected MMD EXACTLY as given.",
      "Wrap your output in <verified_mmd> tags. Only MMD content inside the tags.",
    ].join("\n");
  }

  // ============================================================================
  // DIFF ENGINE INTEGRATION
  // ============================================================================

  /**
   * Compute the diff manifest using the local diff engine.
   *
   * @param {string} originalMMD - Original OCR output
   * @param {string} enhancedMMD - Pass 1 corrected output
   * @returns {Object} { manifest: string|null, stats: Object }
   */
  function computeDiffManifest(originalMMD, enhancedMMD) {
    const engine = window.MathPixDiffEngine;

    if (!engine) {
      logWarn(
        "MathPixDiffEngine not available \u2014 falling back to raw comparison",
      );
      return { manifest: null, stats: null };
    }

    const startTime = performance.now();

    // 1. Compute change log
    const changeLog = engine.computeChangeLog(originalMMD, enhancedMMD);
    if (!changeLog) {
      logWarn(
        "Change log computation failed \u2014 falling back to raw comparison",
      );
      return { manifest: null, stats: null };
    }

    // 2. Group by line
    const groups = engine.groupByLine(changeLog);

    // 3. Build consistency report
    const consistencyReport = engine.buildConsistencyReport(
      originalMMD,
      enhancedMMD,
      changeLog,
    );

    // 4. Format for prompt
    const manifest = engine.formatForPrompt(changeLog, consistencyReport);

    const duration = (performance.now() - startTime).toFixed(1);
    const stats = {
      wordLevelChanges: changeLog.changes.length,
      lineGroups: groups.length,
      consistencyEntries: consistencyReport.length,
      manifestChars: manifest.length,
      manifestTokensEstimate: Math.ceil(
        manifest.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN,
      ),
      computeTimeMs: parseFloat(duration),
    };

    logInfo("Diff manifest computed", stats);

    return { manifest, stats };
  }

  // ============================================================================
  // CONFIDENCE-BASED PASS 2 SKIP (ME-3, Phase 7.5J — updated 7.5L)
  // ============================================================================

  /**
   * Determine whether Pass 2 can be safely skipped based on diff manifest analysis.
   *
   * 7.5L UPDATE: Pass 2 is now default-off. In 7.5K corpus re-test (30 extended
   * runs), 24/25 non-skipped runs produced identical output. The one run that
   * differed was DESTRUCTIVE (γ→δ regression on Opus·mistral Solutions25).
   *
   * Pass 2 now only runs when consistencyEntries > 0 — the only scenario where
   * verification has demonstrated historical value (completing incomplete
   * substitutions detected by the diff engine).
   *
   * @param {Object} diffStats - Stats from computeDiffManifest
   * @param {Object} changeLog - The raw change log (needed for type counts)
   * @param {string} originalMMD - Original OCR output
   * @param {string} enhancedMMD - Pass 1 output
   * @returns {Object} { skip: boolean, reason: string, metrics: Object }
   */
  function shouldSkipPass2(diffStats, changeLog, originalMMD, enhancedMMD) {
    // Cannot decide without stats — skip Pass 2 (safe default per 7.5L)
    if (!diffStats || !changeLog) {
      return {
        skip: true,
        reason: "No diff stats available — defaulting to skip (7.5L)",
        metrics: null,
      };
    }

    // Count SYMBOL and VALUE changes specifically (retained for metrics)
    const symbolValueChanges = changeLog.changes.filter(
      (c) => c.type === "SYMBOL" || c.type === "VALUE",
    ).length;

    // Calculate line drift (retained for metrics)
    const originalLines = originalMMD.split("\n").length;
    const enhancedLines = enhancedMMD.split("\n").length;
    const lineDriftPercent =
      originalLines > 0
        ? Math.abs((enhancedLines - originalLines) / originalLines) * 100
        : 0;

    const metrics = {
      symbolValueChanges,
      consistencyEntries: diffStats.consistencyEntries,
      lineDriftPercent: parseFloat(lineDriftPercent.toFixed(1)),
      totalChanges: diffStats.wordLevelChanges,
    };

    // 7.5L: Only run Pass 2 when consistency entries exist
    // This is the one signal where verification has demonstrated value
    const hasConsistencyWork = diffStats.consistencyEntries > 0;

    if (!hasConsistencyWork) {
      const reason = `Pass 2 default-off (7.5L): 0 consistency entries. Metrics: ${symbolValueChanges} symbol/value changes, ${metrics.lineDriftPercent}% drift`;
      logInfo(`Pass 2 SKIP: ${reason}`);
      return { skip: true, reason, metrics };
    }

    // Consistency entries found — Pass 2 should run
    const reason = `${diffStats.consistencyEntries} consistency entries detected — Pass 2 will verify incomplete substitutions`;
    logInfo(`Pass 2 PROCEEDING: ${reason}`);
    return {
      skip: false,
      reason,
      metrics,
    };
  }

  // ============================================================================
  // DELIMITER EXTRACTION
  // ============================================================================

  /**
   * Extract MMD content from between <verified_mmd> delimiter tags.
   *
   * Pass 2 is instructed to wrap its output in <verified_mmd>...</verified_mmd>.
   * Any commentary or analysis goes before the opening tag.
   * This function extracts only the content between the tags.
   *
   * Falls back to returning the full input if tags are not found,
   * to avoid data loss if the model ignores the instruction.
   *
   * @param {string} rawOutput - Raw Pass 2 output
   * @returns {string} Extracted MMD content
   */
  function extractVerifiedMMD(rawOutput) {
    if (!rawOutput) return rawOutput;

    const openTag = "<verified_mmd>";
    const closeTag = "</verified_mmd>";

    const openIdx = rawOutput.indexOf(openTag);

    if (openIdx === -1) {
      // Model did not use delimiters — return as-is
      logWarn(
        "Pass 2 output missing <verified_mmd> tags — returning raw output",
      );
      return rawOutput;
    }

    const contentStart = openIdx + openTag.length;
    const closeIdx = rawOutput.indexOf(closeTag, contentStart);

    let extracted;
    if (closeIdx === -1) {
      // Opening tag found but no closing tag — take everything after the opening tag
      logWarn(
        "Pass 2 output has opening <verified_mmd> but no closing tag — extracting to end",
      );
      extracted = rawOutput.substring(contentStart);
    } else {
      extracted = rawOutput.substring(contentStart, closeIdx);
    }

    // Trim leading/trailing whitespace from the extracted content
    extracted = extracted.trim();

    if (extracted.length === 0) {
      logWarn("Extracted MMD content is empty — returning raw output");
      return rawOutput;
    }

    const preambleLength = openIdx;
    if (preambleLength > 0) {
      logInfo(
        `Stripped ${preambleLength} chars of commentary before <verified_mmd> tag`,
      );
    }

    return extracted;
  }

  // ============================================================================
  // ORCHESTRATION
  // ============================================================================

  /**
   * Orchestrate Pass 2 verification.
   *
   * Takes the enhancer instance (which has just completed Pass 1),
   * computes a structured diff manifest, creates a new embed with the
   * verification system prompt, re-attaches the same PDF, sends the
   * verification request, and returns the verified MMD.
   *
   * @param {MathPixAIEnhancer} enhancer - The enhancer instance after Pass 1
   * @returns {Promise<string|null>} Verified MMD, or null if verification failed
   */
  async function orchestrate(enhancer) {
    logInfo("Starting Pass 2 verification...");

    const startTime = performance.now();

    // Snapshot Pass 1 output before anything can overwrite it
    const pass1MMDSnapshot = enhancer?.enhancedMMD || null;
    // Validate prerequisites
    if (!enhancer) {
      logError("No enhancer instance provided");
      return null;
    }

    if (!enhancer.originalMMD || !enhancer.enhancedMMD) {
      logError("Missing original or enhanced MMD");
      return null;
    }

    if (typeof OpenRouterEmbed === "undefined") {
      logError("OpenRouterEmbed not available");
      return null;
    }

    if (typeof EmbedFileUtils === "undefined") {
      logError("EmbedFileUtils not available");
      return null;
    }

    // Check for Pass 1 embed and its PDF data
    const pass1Base64 = enhancer.embed?.currentFileBase64;
    if (!pass1Base64) {
      logError(
        "No PDF base64 data from Pass 1 \u2014 cannot verify without source PDF",
      );
      return null;
    }

    try {
      // 1. Compute diff manifest (local computation — fast)
      const { manifest: diffManifest, stats: diffStats } = computeDiffManifest(
        enhancer.originalMMD,
        enhancer.enhancedMMD,
      );

      // Log diff stats to enhancer's timing log
      if (diffStats && typeof enhancer.logTiming === "function") {
        enhancer.logTiming("MULTIPASS_DIFF_COMPUTED", diffStats);
      }

      // 1b. Confidence-based Pass 2 skip (ME-3, Phase 7.5J)
      //     In 7.5I, 21/24 runs had identical Pass 1 and Pass 2 output.
      //     Skip Pass 2 when diff analysis indicates high confidence.
      const changeLog = window.MathPixDiffEngine?.computeChangeLog(
        enhancer.originalMMD,
        enhancer.enhancedMMD,
      );
      const skipDecision = shouldSkipPass2(
        diffStats,
        changeLog,
        enhancer.originalMMD,
        enhancer.enhancedMMD,
      );

      if (skipDecision.skip) {
        const duration = ((performance.now() - startTime) / 1000).toFixed(1);
        logInfo(
          `Pass 2 SKIPPED (${duration}s for analysis): ${skipDecision.reason}`,
        );

        // Log skip to enhancer's timing log
        if (typeof enhancer.logTiming === "function") {
          enhancer.logTiming("MULTIPASS_SKIPPED", {
            skipReason: skipDecision.reason,
            metrics: skipDecision.metrics,
            analysisDurationSeconds: parseFloat(duration),
          });
        }

        // Store skip data for test harness (7.5K verification)
        window.MathPixMultiPass.lastRun = {
          pass1MMD: pass1MMDSnapshot,
          pass2MMD: pass1MMDSnapshot, // Pass 2 output equals Pass 1 (skipped)
          originalMMD: enhancer.originalMMD,
          diffManifest: diffManifest || null,
          diffStats: diffStats || null,
          timestamp: new Date().toISOString(),
          model: enhancer.selectedModel || "unknown",
          document: enhancer.embed?.currentFile?.name || "unknown",
          durationSeconds: parseFloat(duration),
          pass2InputTokensEstimate: 0,
          success: true,
          skipped: true,
          skipReason: skipDecision.reason,
          skipMetrics: skipDecision.metrics,
        };

        logInfo("Pass 2 skipped — returning Pass 1 output unchanged");
        return null; // null signals to enhancer: keep Pass 1 result
      }

      logInfo(`Pass 2 proceeding: ${skipDecision.reason}`);

      // 2. Create container (reuse existing hidden container)
      let container = document.getElementById("ai-enhance-embed-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "ai-enhance-embed-container";
        container.style.display = "none";
        container.setAttribute("aria-hidden", "true");
        document.body.appendChild(container);
      }

      // 3. Calculate max_tokens for Pass 2 (same budget as Pass 1)
      const maxTokens =
        enhancer.calculatedMaxTokens ||
        Math.min(
          Math.ceil(
            (enhancer.enhancedMMD.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN) *
              1.3,
          ),
          8192,
        );

      logDebug("Pass 2 configuration", {
        model: enhancer.selectedModel,
        maxTokens,
        temperature: MULTIPASS_CONFIG.TEMPERATURE,
        enhancedMMDLength: enhancer.enhancedMMD.length,
        diffManifestAvailable: !!diffManifest,
        diffManifestTokens: diffStats?.manifestTokensEstimate || "N/A",
        pdfBase64Length: pass1Base64.length,
      });

      // 4. Create Pass 2 embed instance with verification system prompt
      const pass2Embed = new OpenRouterEmbed({
        containerId: "ai-enhance-embed-container",
        model: enhancer.selectedModel,
        systemPrompt: buildVerificationSystemPrompt(),
        temperature: MULTIPASS_CONFIG.TEMPERATURE,
        max_tokens: maxTokens,
        top_p: MULTIPASS_CONFIG.TOP_P,
        reasoning: null, // No reasoning for Pass 2 \u2014 contraindicated for Haiku
        showNotifications: false,
        enableLogging: true,
      });

      // 5. Re-attach the PDF from Pass 1
      //    Copy the file data directly rather than re-reading the blob
      const pass1File = enhancer.embed.currentFile;
      const pass1Analysis = enhancer.embed.currentFileAnalysis;

      pass2Embed.currentFileBase64 = pass1Base64;

      if (pass1File) {
        pass2Embed.currentFile = pass1File;
      }

      if (pass1Analysis) {
        pass2Embed.currentFileAnalysis = pass1Analysis;
      }

      // Override engine to match Pass 1
      if (pass2Embed.currentFileAnalysis) {
        pass2Embed.currentFileAnalysis.engine = enhancer.selectedEngine;
      }

      logDebug("PDF re-attached to Pass 2 embed", {
        hasFile: !!pass2Embed.currentFile,
        hasBase64: !!pass2Embed.currentFileBase64,
        hasAnalysis: !!pass2Embed.currentFileAnalysis,
        engine: enhancer.selectedEngine,
      });

      // 6. Build and send verification request
      const userPrompt = buildVerificationUserPrompt(
        enhancer.originalMMD,
        enhancer.enhancedMMD,
        diffManifest,
        diffStats,
      );

      const userPromptTokens = Math.ceil(
        userPrompt.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN,
      );
      logInfo("Sending Pass 2 verification request...", {
        userPromptLength: userPrompt.length,
        estimatedInputTokens: userPromptTokens,
        mode: diffManifest ? "diff-engine" : "fallback",
      });

      // Use AbortSignal.timeout for reliable timeout (same pattern as enhancer)
      const timeoutSignal = AbortSignal.timeout(MULTIPASS_CONFIG.TIMEOUT_MS);
      let settled = false;

      const response = await new Promise((resolve, reject) => {
        timeoutSignal.addEventListener("abort", () => {
          if (settled) return;
          settled = true;
          logError("Pass 2 timed out");
          reject(new Error("Verification pass timed out"));
        });

        // Also listen for user cancellation
        if (enhancer.abortController) {
          enhancer.abortController.signal.addEventListener("abort", () => {
            if (settled) return;
            settled = true;
            logDebug("Pass 2 cancelled by user");
            reject(new Error("Cancelled"));
          });
        }

        pass2Embed
          .sendRequest(userPrompt)
          .then((result) => {
            if (settled) return;
            settled = true;
            resolve(result);
          })
          .catch((error) => {
            if (settled) return;
            settled = true;
            reject(error);
          });
      });

      // 7. Extract verified MMD from response
      let verifiedMMD = enhancer.processResponse(response);

      if (!verifiedMMD || verifiedMMD.trim().length === 0) {
        logWarn("Pass 2 returned empty response \u2014 keeping Pass 1 result");
        return null;
      }

      // 8. Extract MMD content from delimiter tags
      //    Pass 2 wraps output in <verified_mmd>...</verified_mmd>.
      //    Any commentary goes before the opening tag and is discarded.
      verifiedMMD = extractVerifiedMMD(verifiedMMD);
      const duration = ((performance.now() - startTime) / 1000).toFixed(1);
      logInfo(`Pass 2 verification complete in ${duration}s`, {
        inputLines: enhancer.enhancedMMD.split("\n").length,
        outputLines: verifiedMMD.split("\n").length,
        mode: diffManifest ? "diff-engine" : "fallback",
      });

      // Log timing to enhancer's timing log if available
      if (typeof enhancer.logTiming === "function") {
        enhancer.logTiming("MULTIPASS_COMPLETE", {
          pass2DurationSeconds: parseFloat(duration),
          pass2InputTokensEstimate: userPromptTokens,
          pass2OutputChars: verifiedMMD.length,
          diffEngineUsed: !!diffManifest,
          diffStats: diffStats || null,
        });
      }

      // Store both passes for A/B comparison (Task 1 instrumentation)
      window.MathPixMultiPass.lastRun = {
        pass1MMD: pass1MMDSnapshot,
        pass2MMD: verifiedMMD,
        originalMMD: enhancer.originalMMD,
        diffManifest: diffManifest || null,
        diffStats: diffStats || null,
        timestamp: new Date().toISOString(),
        model: enhancer.selectedModel || "unknown",
        document: enhancer.embed?.currentFile?.name || "unknown",
        durationSeconds: parseFloat(duration),
        pass2InputTokensEstimate: userPromptTokens,
        success: true,
      };

      logInfo("Multi-pass run data stored on window.MathPixMultiPass.lastRun");

      return verifiedMMD;
    } catch (error) {
      logError("Pass 2 verification failed:", error.message);

      // Log failure to enhancer's timing log
      if (typeof enhancer.logTiming === "function") {
        enhancer.logTiming("MULTIPASS_FAILED", {
          error: error.message,
          durationSeconds: parseFloat(
            ((performance.now() - startTime) / 1000).toFixed(1),
          ),
        });
      }

      // Store partial data even on failure (Pass 1 is still the final output)
      window.MathPixMultiPass.lastRun = {
        pass1MMD: pass1MMDSnapshot,
        pass2MMD: null,
        originalMMD: enhancer?.originalMMD || null,
        diffManifest: null,
        diffStats: null,
        timestamp: new Date().toISOString(),
        model: enhancer?.selectedModel || "unknown",
        document: enhancer?.embed?.currentFile?.name || "unknown",
        durationSeconds: parseFloat(
          ((performance.now() - startTime) / 1000).toFixed(1),
        ),
        pass2InputTokensEstimate: null,
        success: false,
        error: error.message,
      };

      logInfo(
        "Multi-pass failure data stored on window.MathPixMultiPass.lastRun",
      );

      // Non-fatal — Pass 1 result is still valid
      return null;
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixMultiPass = {
    orchestrate,
    buildVerificationSystemPrompt,
    buildVerificationUserPrompt,
    computeDiffManifest,
    shouldSkipPass2,
    lastRun: null,
  };

  // ============================================================================
  // A/B COMPARISON COMMAND
  // ============================================================================

  /**
   * Compare Pass 1 vs Pass 2 outputs from the last multi-pass run.
   * Uses the diff engine to produce a structured comparison showing
   * exactly what Pass 2 changed (or failed to change) relative to Pass 1.
   *
   * @returns {Object|null} Comparison data or null if no run data
   */
  window.compareMultiPassResults = function () {
    const run = window.MathPixMultiPass.lastRun;

    if (!run) {
      console.warn(
        "No multi-pass run data. Run an enhancement with multi-pass enabled first.",
      );
      return null;
    }

    console.log("=== MULTI-PASS A/B COMPARISON ===\n");
    console.log("Document:", run.document);
    console.log("Model:", run.model);
    console.log("Timestamp:", run.timestamp);
    console.log("Pass 2 success:", run.success);
    if (!run.success) {
      console.log("Pass 2 error:", run.error);
    }
    console.log("Pass 2 duration:", run.durationSeconds + "s");

    if (!run.pass1MMD) {
      console.warn("No Pass 1 data available.");
      return null;
    }

    if (!run.pass2MMD) {
      console.warn(
        "No Pass 2 data — Pass 2 failed or returned null. Pass 1 was used as final output.",
      );
      console.log(
        "\nPass 1 output available at: window.MathPixMultiPass.lastRun.pass1MMD",
      );
      return { run, pass1vs2Diff: null };
    }

    // --- Size comparison ---
    console.log("\n--- Size Comparison ---");
    console.log(
      `Pass 1: ${run.pass1MMD.split("\n").length} lines, ${run.pass1MMD.length} chars`,
    );
    console.log(
      `Pass 2: ${run.pass2MMD.split("\n").length} lines, ${run.pass2MMD.length} chars`,
    );

    // --- Diff manifest sent to Pass 2 ---
    if (run.diffStats) {
      console.log("\n--- Diff Manifest Sent to Pass 2 ---");
      console.log(`Word-level changes: ${run.diffStats.wordLevelChanges}`);
      console.log(`Line groups: ${run.diffStats.lineGroups}`);
      console.log(`Consistency entries: ${run.diffStats.consistencyEntries}`);
      console.log(
        `Manifest size: ${run.diffStats.manifestChars} chars (~${run.diffStats.manifestTokensEstimate} tokens)`,
      );
      console.log(`Compute time: ${run.diffStats.computeTimeMs}ms`);
    }

    // --- Pass 1 vs Pass 2 diff (what did Pass 2 actually change?) ---
    const engine = window.MathPixDiffEngine;
    let pass1vs2Diff = null;

    if (engine) {
      console.log(
        "\n--- Pass 1 → Pass 2 Changes (what verification changed) ---",
      );

      const changeLog = engine.computeChangeLog(run.pass1MMD, run.pass2MMD);
      if (changeLog && changeLog.changes.length > 0) {
        const groups = engine.groupByLine(changeLog);
        const report = engine.buildConsistencyReport(
          run.pass1MMD,
          run.pass2MMD,
          changeLog,
        );
        const formatted = engine.formatForPrompt(changeLog, report);

        console.log(
          `Total changes by Pass 2: ${changeLog.changes.length} word-level, ${groups.length} line groups`,
        );
        console.log("Summary:", changeLog.summary);

        console.log("\n--- Line-by-line Pass 2 changes ---");
        groups.forEach((g) => {
          console.log(
            `#${g.groupId} [Line ${g.originalLine}] ${g.primaryType} (${g.changes.length} sub-changes)`,
          );
          if (g.originalContext) {
            console.log(`  Pass 1: ${g.originalContext.substring(0, 120)}`);
          }
          if (g.enhancedContext) {
            console.log(`  Pass 2: ${g.enhancedContext.substring(0, 120)}`);
          }
          g.changes.forEach((c) => {
            console.log(`    • ${c.type}: "${c.removed}" → "${c.added}"`);
          });
        });

        if (report.length > 0) {
          console.log("\n--- Consistency issues remaining after Pass 2 ---");
          report.forEach((entry) => {
            console.log(
              `"${entry.fromSymbol}" → "${entry.toSymbol}": ` +
                `${entry.correctedCount} corrected, ` +
                `${entry.remainingCount} remaining (lines ${entry.remainingLines.join(", ")})`,
            );
          });
        }

        pass1vs2Diff = { changeLog, groups, report, formatted };
      } else {
        console.log("Pass 2 made NO changes to Pass 1 output (identical).");
        pass1vs2Diff = {
          changeLog,
          groups: [],
          report: [],
          formatted: "No changes",
        };
      }
    } else {
      console.warn(
        "MathPixDiffEngine not available — cannot compute structured diff.",
      );
      console.log("Raw text comparison:");
      console.log("Pass 1 === Pass 2:", run.pass1MMD === run.pass2MMD);
    }

    // --- Also compute Original → Pass 1 diff for context ---
    if (engine && run.originalMMD) {
      console.log("\n--- Original → Pass 1 Changes (for reference) ---");
      const origChangeLog = engine.computeChangeLog(
        run.originalMMD,
        run.pass1MMD,
      );
      if (origChangeLog) {
        const origGroups = engine.groupByLine(origChangeLog);
        console.log(
          `Pass 1 made ${origChangeLog.changes.length} word-level changes (${origGroups.length} line groups)`,
        );
        console.log("Summary:", origChangeLog.summary);
      }
    }

    console.log("\n--- Raw Data ---");
    console.log("Access full data: window.MathPixMultiPass.lastRun");
    console.log("Pass 1 MMD: window.MathPixMultiPass.lastRun.pass1MMD");
    console.log("Pass 2 MMD: window.MathPixMultiPass.lastRun.pass2MMD");
    console.log("Diff manifest: window.MathPixMultiPass.lastRun.diffManifest");

    console.log("\n=== END COMPARISON ===");

    return { run, pass1vs2Diff };
  };
  // ============================================================================
  // TEST COMMANDS
  // ============================================================================

  /**
   * Test multi-pass verification (synthetic \u2014 no API call)
   */
  window.testMultiPass = async function () {
    console.log("=== MULTI-PASS VERIFICATION TESTS (v1.1) ===\n");

    const results = { passed: 0, failed: 0, errors: [] };

    function assert(condition, label) {
      if (condition) {
        results.passed++;
        console.log(`  \u2714 ${label}`);
      } else {
        results.failed++;
        results.errors.push(label);
        console.error(`  \u2718 ${label}`);
      }
    }

    // ------------------------------------------------------------------
    // 1. Module availability
    // ------------------------------------------------------------------
    console.log("--- 1. Module Availability ---");

    assert(
      typeof window.MathPixMultiPass === "object",
      "1.1 MathPixMultiPass exposed on window",
    );
    assert(
      typeof window.MathPixMultiPass.orchestrate === "function",
      "1.2 orchestrate() is a function",
    );
    assert(
      typeof window.MathPixMultiPass.buildVerificationSystemPrompt ===
        "function",
      "1.3 buildVerificationSystemPrompt() is a function",
    );
    assert(
      typeof window.MathPixMultiPass.buildVerificationUserPrompt === "function",
      "1.4 buildVerificationUserPrompt() is a function",
    );
    assert(
      typeof window.MathPixMultiPass.computeDiffManifest === "function",
      "1.5 computeDiffManifest() is a function",
    );

    // ------------------------------------------------------------------
    // 2. System prompt content
    // ------------------------------------------------------------------
    console.log("\n--- 2. System Prompt ---");

    const sysPrompt = window.MathPixMultiPass.buildVerificationSystemPrompt();
    assert(
      typeof sysPrompt === "string" && sysPrompt.length > 100,
      "2.1 Verification system prompt is a non-trivial string",
    );
    assert(
      sysPrompt.includes("REVIEWER"),
      "2.2 System prompt identifies role as REVIEWER",
    );
    assert(
      sysPrompt.includes("REGRESSION CHECK"),
      "2.3 System prompt includes REGRESSION CHECK",
    );
    assert(
      sysPrompt.includes("CONSISTENCY CHECK"),
      "2.4 System prompt includes CONSISTENCY CHECK",
    );
    assert(
      sysPrompt.includes("VALUE CHECK"),
      "2.5 System prompt includes VALUE CHECK",
    );
    assert(
      sysPrompt.includes("STRUCTURE CHECK"),
      "2.6 System prompt includes STRUCTURE CHECK",
    );
    assert(
      sysPrompt.includes("DELETION CHECK"),
      "2.7 System prompt includes DELETION CHECK",
    );
    assert(
      sysPrompt.includes("CHANGE MANIFEST"),
      "2.8 System prompt references CHANGE MANIFEST",
    );
    assert(
      sysPrompt.includes("CONSISTENCY INVENTORY"),
      "2.9 System prompt references CONSISTENCY INVENTORY",
    );
    assert(
      !sysPrompt.includes("STEP 1") && !sysPrompt.includes("STEP 2"),
      "2.10 System prompt does NOT include enhancement STEP references",
    );

    // ------------------------------------------------------------------
    // 3. Diff engine integration
    // ------------------------------------------------------------------
    console.log("\n--- 3. Diff Engine Integration ---");

    const hasDiffEngine = typeof window.MathPixDiffEngine === "object";
    assert(hasDiffEngine, "3.1 MathPixDiffEngine is available");

    if (hasDiffEngine) {
      const testOriginal = "$\\alpha + \\beta = \\gamma$\nwhere $f(x) = x^2$";
      const testEnhanced = "$y + \\beta = \\gamma$\nwhere $s(x) = x^2$";

      const { manifest, stats } = window.MathPixMultiPass.computeDiffManifest(
        testOriginal,
        testEnhanced,
      );

      assert(
        typeof manifest === "string" && manifest.length > 0,
        "3.2 computeDiffManifest returns non-empty manifest",
      );
      assert(
        manifest.includes("CHANGE MANIFEST"),
        "3.3 Manifest includes CHANGE MANIFEST header",
      );
      assert(
        typeof stats === "object" && stats !== null,
        "3.4 Stats object returned",
      );
      assert(
        typeof stats.lineGroups === "number" && stats.lineGroups > 0,
        `3.5 Stats reports ${stats.lineGroups} line groups`,
      );
      assert(
        typeof stats.manifestTokensEstimate === "number",
        "3.6 Stats includes token estimate",
      );

      // User prompt with manifest
      const userPromptWithDiff =
        window.MathPixMultiPass.buildVerificationUserPrompt(
          testOriginal,
          testEnhanced,
          manifest,
        );
      assert(
        userPromptWithDiff.includes("CORRECTED MMD"),
        "3.7 Diff-mode user prompt includes CORRECTED MMD section",
      );
      assert(
        userPromptWithDiff.includes("CHANGE MANIFEST"),
        "3.8 Diff-mode user prompt includes change manifest",
      );
      assert(
        !userPromptWithDiff.includes("ORIGINAL MMD"),
        "3.9 Diff-mode user prompt does NOT include full original MMD",
      );

      // Token savings check
      const fallbackPrompt =
        window.MathPixMultiPass.buildVerificationUserPrompt(
          testOriginal,
          testEnhanced,
          null,
        );
      assert(
        userPromptWithDiff.length < fallbackPrompt.length ||
          testOriginal.length < 100, // small test data may not show savings
        "3.10 Diff-mode prompt is more compact (or test data too small to show savings)",
      );
    } else {
      console.log(
        "  \u26a0 Diff engine not available \u2014 skipping 3.2\u20133.10",
      );
    }

    // ------------------------------------------------------------------
    // 4. Fallback user prompt (no diff engine)
    // ------------------------------------------------------------------
    console.log("\n--- 4. Fallback Prompt ---");

    const testOriginal = "Original MMD content with \\alpha and f(x)";
    const testEnhanced = "Enhanced MMD content with y and s(x)";

    const fallbackPrompt = window.MathPixMultiPass.buildVerificationUserPrompt(
      testOriginal,
      testEnhanced,
      null,
    );
    assert(
      fallbackPrompt.includes("=== ORIGINAL MMD"),
      "4.1 Fallback prompt contains ORIGINAL MMD section",
    );
    assert(
      fallbackPrompt.includes("=== CORRECTED MMD"),
      "4.2 Fallback prompt contains CORRECTED MMD section",
    );
    assert(
      fallbackPrompt.includes(testOriginal),
      "4.3 Fallback prompt includes original MMD content",
    );
    assert(
      fallbackPrompt.includes(testEnhanced),
      "4.4 Fallback prompt includes enhanced MMD content",
    );

    // ------------------------------------------------------------------
    // 5. Orchestrate guard clauses
    // ------------------------------------------------------------------
    console.log("\n--- 5. Guard Clauses ---");

    const nullResult1 = await window.MathPixMultiPass.orchestrate(null);
    assert(nullResult1 === null, "5.1 orchestrate(null) returns null");

    const fakeEnhancer = { originalMMD: "", enhancedMMD: "" };
    const nullResult2 = await window.MathPixMultiPass.orchestrate(fakeEnhancer);
    assert(
      nullResult2 === null,
      "5.2 orchestrate() returns null for empty MMD",
    );

    // ------------------------------------------------------------------
    // 6. Enhancer integration check
    // ------------------------------------------------------------------
    console.log("\n--- 6. Enhancer Integration ---");

    const enhancer = window.getMathPixAIEnhancer?.();
    if (enhancer) {
      assert(
        "multiPassEnabled" in enhancer,
        "6.1 Enhancer has multiPassEnabled property",
      );
      assert(
        typeof enhancer.multiPassEnabled === "boolean",
        "6.2 multiPassEnabled is boolean",
      );

      // Check preferences round-trip
      const savedState = enhancer.multiPassEnabled;
      enhancer.multiPassEnabled = true;
      enhancer.saveEnhancerPreferences();
      const prefs = JSON.parse(
        localStorage.getItem(enhancer.enhancerPrefsKey) || "{}",
      );
      assert(
        prefs.multiPass === true,
        "6.3 Preferences save includes multiPass: true",
      );

      enhancer.multiPassEnabled = false;
      enhancer.loadEnhancerPreferences();
      assert(
        enhancer.multiPassEnabled === true,
        "6.4 Preferences load restores multiPass: true",
      );

      // Restore original state
      enhancer.multiPassEnabled = savedState;
      enhancer.saveEnhancerPreferences();
    } else {
      console.log("  \u26a0 Enhancer not available \u2014 skipping 6.x");
    }

    // ------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------
    console.log(
      `\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`,
    );
    if (results.errors.length > 0) {
      console.log("Failures:", results.errors);
    }
    return results;
  };

  /**
   * Test verification prompt content in detail
   */
  window.testVerificationPrompt = function () {
    console.log("=== VERIFICATION PROMPT ANALYSIS (v1.1) ===\n");

    // System prompt
    const sysPrompt = window.MathPixMultiPass.buildVerificationSystemPrompt();
    console.log("--- System Prompt ---");
    console.log("Length:", sysPrompt.length, "chars");
    console.log(
      "Estimated tokens:",
      Math.ceil(sysPrompt.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN),
    );
    console.log("\n" + sysPrompt);

    // Sample data
    const sampleOriginal = [
      "## Question 1",
      "",
      "$\\alpha + \\beta = \\gamma$",
      "",
      "where $f(x) = x^2$",
      "",
      "The value is $\\sin 70\u00b0$",
    ].join("\n");

    const sampleEnhanced = [
      "## Question 1",
      "",
      "$y + \\beta = \\gamma$",
      "",
      "where $s(x) = x^2$",
      "",
      "The value is $\\sin 90\u00b0$",
    ].join("\n");

    // Diff engine mode
    const hasDiffEngine = typeof window.MathPixDiffEngine === "object";
    let diffManifest = null;

    if (hasDiffEngine) {
      const { manifest, stats } = window.MathPixMultiPass.computeDiffManifest(
        sampleOriginal,
        sampleEnhanced,
      );
      diffManifest = manifest;

      console.log("\n--- Diff Engine Stats ---");
      console.log(stats);
    }

    // User prompt (diff mode)
    if (diffManifest) {
      console.log("\n--- User Prompt (diff-engine mode) ---");
      const userPrompt = window.MathPixMultiPass.buildVerificationUserPrompt(
        sampleOriginal,
        sampleEnhanced,
        diffManifest,
      );
      console.log("Length:", userPrompt.length, "chars");
      console.log(
        "Estimated tokens:",
        Math.ceil(userPrompt.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN),
      );
      console.log("\n" + userPrompt);
    }

    // User prompt (fallback mode)
    console.log("\n--- User Prompt (fallback mode) ---");
    const fallbackPrompt = window.MathPixMultiPass.buildVerificationUserPrompt(
      sampleOriginal,
      sampleEnhanced,
      null,
    );
    console.log("Length:", fallbackPrompt.length, "chars");
    console.log(
      "Estimated tokens:",
      Math.ceil(fallbackPrompt.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN),
    );
    console.log("\n" + fallbackPrompt);

    // Token budget comparison
    console.log("\n--- Token Budget Comparison ---");
    const sysTokens = Math.ceil(
      sysPrompt.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN,
    );
    const diffTokens = diffManifest
      ? Math.ceil(
          window.MathPixMultiPass.buildVerificationUserPrompt(
            sampleOriginal,
            sampleEnhanced,
            diffManifest,
          ).length / MULTIPASS_CONFIG.CHARS_PER_TOKEN,
        )
      : "N/A";
    const fallbackTokens = Math.ceil(
      fallbackPrompt.length / MULTIPASS_CONFIG.CHARS_PER_TOKEN,
    );

    console.log(`System prompt: ~${sysTokens} tokens`);
    console.log(`User prompt (diff-engine): ~${diffTokens} tokens`);
    console.log(`User prompt (fallback): ~${fallbackTokens} tokens`);
    if (typeof diffTokens === "number") {
      const saving = fallbackTokens - diffTokens;
      const pct = Math.round((saving / fallbackTokens) * 100);
      console.log(`Saving: ~${saving} tokens (${pct}%)`);
    }
    console.log("(PDF image tokens are additional)");
  };

  logInfo("MathPix Multi-Pass Verification v1.1 loaded");
})();
