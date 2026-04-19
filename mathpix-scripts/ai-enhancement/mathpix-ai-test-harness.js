/**
 * @fileoverview MathPix AI Test Harness
 * @module MathPixTestHarness
 * @version 1.2.0
 * @since Phase 7.5I (updated 7.5L: L.1 download timing, L.2 evaluator formula, L.5 drift filter)
 *
 * Automates the evaluation workflow for model/engine comparison testing.
 * After each enhancement run, a single console command captures all data,
 * sends it to Opus for evaluation via OpenRouter API, stores results
 * with auto-download, and provides analysis/comparison tools.
 *
 * Usage:
 *   1. Load PDF, run MathPix OCR
 *   2. Select model + engine in enhance modal, click Enhance
 *   3. Run: window.captureAndEvaluate()
 *   4. After all runs: window.showTestMatrix(), window.compareModels("FEEG1050")
 *
 * @requires MathPixAIEnhancer - Enhancement instance with test data
 * @requires MathPixMultiPass - Multi-pass data (optional)
 * @requires OpenRouter API key in localStorage
 *
 * @accessibility WCAG 2.2 AA compliant (console tool -- no UI)
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
      console.error(`[TestHarness] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestHarness] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestHarness] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestHarness] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const HARNESS_CONFIG = {
    /** Model used for evaluation (scoring). Opus for highest quality. */
    EVALUATOR_MODEL: "anthropic/claude-opus-4-6",

    /** OpenRouter API endpoint */
    API_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",

    /** Max tokens for evaluator response (JSON report is ~3000-5000 tokens) */
    MAX_TOKENS: 12000,

    /** Low temperature for consistent evaluation */
    TEMPERATURE: 0.2,

    /** localStorage key for persisting results */
    STORAGE_KEY: "mathpix-test-harness-7.5L",

    /** Auto-download JSON after each evaluation */
    AUTO_DOWNLOAD: true,

    /** Enhancement prompt version being tested */
    PROMPT_VERSION: "2.4.1",
  };

  // ============================================================================
  // EVALUATION PROMPT
  // ============================================================================

  /**
   * Build the system prompt for the Opus evaluator.
   * Adapted from the Phase 7.5A evaluation prompt v1.1 for API use.
   */
  function buildEvalSystemPrompt() {
    return [
      "You are an expert evaluator assessing the quality of AI-enhanced OCR output.",
      "You have deep knowledge of mathematics, LaTeX, and Mathpix Markdown (MMD) formatting.",
      "",
      "You will be given three artefacts for a single document:",
      "- Source PDF: The ground truth",
      "- Original MMD: OCR output from MathPix (contains recognition errors)",
      "- Enhanced MMD: The result of sending the original MMD + source PDF to an LLM for correction",
      "",
      "## Evaluation Process",
      "",
      "1. Study the source PDF carefully -- note all symbols, equations, structure, formatting",
      "2. Audit the original MMD against the PDF to establish the error inventory",
      "3. Audit the enhanced MMD against both PDF and original MMD:",
      "   - For each OCR error: was it fixed correctly, missed, or made worse?",
      "   - Scan for NEW problems the enhancement introduced",
      "   - Check for notation normalisation (equivalent substitutions that are not corrections)",
      "4. Check prompt compliance (line preservation, uncertainty marking, no explanations, table format, no normalisation)",
      "5. Score each category using the anchors below",
      "6. Produce the JSON evaluation report",
      "",
      "## Scoring Categories and Weights",
      "",
      "| Priority | Category | Weight | What to Assess |",
      "|----------|----------|--------|----------------|",
      "| 1 | mathSymbolAccuracy | 40% | Greek letters, operators, delimiters, sub/superscripts, equation structure |",
      "| 2 | structuralPreservation | 25% | Headings, numbering, section hierarchy, line structure, whitespace, bold/italic |",
      "| 3 | domainContentHandling | 20% | Crossings-out, mark allocations, annotations, handwritten content |",
      "| 4 | diagramHandling | 15% | Alt text, missing image references, spatial layout, figure labels |",
      "",
      "IMPORTANT: If the document contains NO diagrams or images, redistribute the 15% diagram weight proportionally across the other three categories. The adjusted weights become: mathSymbolAccuracy 47%, structuralPreservation 29%, domainContentHandling 24%. Score diagramHandling as N/A and use the adjusted weights for the overall weighted calculation.",
      "",
      "## Scoring Anchors",
      "",
      "| Score | Level | Description |",
      "|-------|-------|-------------|",
      "| 0 | Harmful | Enhancement made things significantly worse |",
      "| 2.5 | No improvement | Neither helped nor harmed, or mixed results |",
      "| 5 | Modest improvement | Some correct fixes, but significant errors remain or regressions |",
      "| 7.5 | Good improvement | Most errors fixed, few regressions, only minor issues |",
      "| 10 | Excellent | Near-perfect correction, no regressions, all structure preserved |",
      "",
      "You may score at any value (e.g. 6, 8.5).",
      "",
      "## Severity Definitions",
      "",
      "| Severity | Definition |",
      "|----------|------------|",
      "| critical | Changes mathematical meaning or loses significant content |",
      "| moderate | Structural damage or misleading change |",
      "| minor | Cosmetic or equivalent notation |",
      "",
      "## Verdict Definitions",
      "",
      "| Verdict | Definition |",
      "|---------|------------|",
      "| correct_fix | LLM correctly fixed an OCR error (matches the PDF) |",
      "| missed_error | OCR error present in original, not addressed |",
      "| new_error | LLM introduced an error not in original |",
      "| normalisation | LLM replaced valid notation with equivalent alternative |",
      "| format_change | LLM changed formatting without improving accuracy |",
      "| content_loss | LLM removed content present in original |",
      "| content_added | LLM added content not in original |",
      "| uncertain | Ambiguous case requiring human judgement |",
      "",
      "## Net Score Formula",
      "",
      "netScore = correctFixes - (newErrorsCritical x 3) - (newErrorsModerate x 1.5) - (newErrorsMinor x 0.5) - (formatChanges x 0.5) - (normalisations x 0.25)",
      "",
      "CRITICAL: Apply the net score formula EXACTLY as specified above. The ONLY deductions are: newErrorsCritical ×3, newErrorsModerate ×1.5, newErrorsMinor ×0.5, formatChanges ×0.5, normalisations ×0.25. Do NOT apply penalties for contentLoss, contentAdded, or any other categories not listed in the formula. These categories should be recorded in the netAssessment object for informational purposes but MUST NOT affect the netScore calculation.",
      "",
      "## Important Evaluation Notes",
      "",
      "- Check for notation normalisation: if original uses \\Longrightarrow and enhanced uses \\Rightarrow, that is normalisation, not a fix",
      "- Bold/italic formatting: check if PDF has bold/italic that MMD lacks",
      "- Mark allocations like [3] or (1/2) near equations are grade annotations, not maths",
      "- (c) after question numbers should NOT become the copyright symbol",
      "- If enhanced MMD is >20% shorter or >30% longer than original, flag content length",
      "- Check delimiter balance: matched $...$ and $$...$$ pairs, matched \\begin/\\end pairs",
      "- Check that image references (lines starting with ![]) are preserved",
      "",
      "## Output Format",
      "",
      "You MUST output ONLY valid JSON matching the schema below. No markdown, no preamble, no explanation outside the JSON.",
      "If you need to include analysis, put it in the 'summary' and 'rationale' fields within the JSON.",
      "",
      "The JSON schema is provided in the user message.",
    ].join("\n");
  }

  /**
   * Build the user prompt with test data for evaluation.
   */
  function buildEvalUserPrompt(testData) {
    const schema = buildOutputSchema();

    const pass1EqualPass2 = testData.pass1MMD === testData.enhancedMMD;
    const multiPassInfo = testData.multiPassEnabled
      ? [
          `Multi-pass: ON (Pass 2 verification active)`,
          `Pass 1 output chars: ${testData.pass1MMD?.length || "N/A"}`,
          `Pass 2 output chars: ${testData.enhancedMMD?.length || "N/A"}`,
          `Pass 1 vs Pass 2: ${pass1EqualPass2 ? "IDENTICAL" : "DIFFERENT"}`,
        ].join("\n")
      : "Multi-pass: OFF";

    // If Pass 1 differs from Pass 2, include both so evaluator can assess value
    const multiPassComparison =
      testData.multiPassEnabled && testData.pass1MMD && !pass1EqualPass2
        ? [
            "",
            "## Pass 1 MMD (before verification pass)",
            "",
            "```",
            testData.pass1MMD,
            "```",
            "",
            "NOTE: The Enhanced MMD below is the Pass 2 output. Compare with Pass 1 above to assess multi-pass value.",
            "Fill in the multiPassAnalysis field in your JSON output.",
          ].join("\n")
        : "";

    return [
      "## Enhancement Context",
      "",
      `Document: ${testData.documentName}`,
      `Enhancement model: ${testData.model}`,
      `PDF engine: ${testData.engine}`,
      `Enhancement prompt: v${HARNESS_CONFIG.PROMPT_VERSION} (chain-of-thought with structural inventory + semantic context)`,
      `Temperature: 0.3, Top-p: 0.9`,
      multiPassInfo,
      `Total enhancement time: ${testData.totalTimeMs}ms`,
      "",
      "The enhancement prompt uses a 4-step chain-of-thought structure:",
      "Step 1: Document Understanding, Step 2: Structural Inventory (from MMD Analyser),",
      "Step 3: Semantic Context (from Lines.json Mapper), Step 4: Correction.",
      "It includes anti-guessing directives, consistency checking, and 11 few-shot examples.",
      "",
      multiPassComparison,
      "## Source PDF",
      "",
      "Attached as document above.",
      "",
      "## Original MMD (OCR output from MathPix)",
      "",
      "```",
      testData.originalMMD,
      "```",
      "",
      "## Enhanced MMD (output from AI enhancement)",
      "",
      "```",
      testData.enhancedMMD,
      "```",
      "",
      "## Required JSON Output Schema",
      "",
      "Produce ONLY a JSON object matching this schema. Every field is required unless marked optional.",
      "",
      "```json",
      schema,
      "```",
      "",
      "Please evaluate this enhancement now. Output ONLY the JSON report.",
    ].join("\n");
  }

  /**
   * Build the JSON output schema for the evaluator.
   */
  function buildOutputSchema() {
    return JSON.stringify(
      {
        evaluationVersion: "1.1",
        metadata: {
          documentFilename: "string",
          documentType: "string",
          pageCount: 0,
          evaluator: "Claude [model]",
          evaluationDate: "YYYY-MM-DD",
          enhancementModel: "string",
          enhancementEngine: "string",
          promptVersion: "string",
          temperature: 0.3,
          multiPassEnabled: false,
          notes: "string (optional)",
        },
        errorInventory: {
          totalOCRErrors: 0,
          bySeverity: { critical: 0, moderate: 0, minor: 0 },
          byCategory: {
            mathSymbol: 0,
            structural: 0,
            domainContent: 0,
            diagram: 0,
          },
        },
        scores: {
          mathSymbolAccuracy: {
            score: 0.0,
            weight: 0.4,
            rationale: "string",
            errors: [
              {
                location: "string",
                original: "string",
                enhanced: "string",
                correct: "string",
                verdict:
                  "correct_fix|missed_error|new_error|normalisation|format_change|content_loss|content_added|uncertain",
                severity: "critical|moderate|minor",
                note: "string (optional)",
              },
            ],
          },
          structuralPreservation: {
            score: 0.0,
            weight: 0.25,
            rationale: "string (must mention bold/italic)",
            issues: [
              {
                type: "string",
                location: "string",
                description: "string",
                verdict: "string",
                severity: "string",
              },
            ],
          },
          domainContentHandling: {
            score: 0.0,
            weight: 0.2,
            rationale: "string",
            issues: [
              {
                type: "string",
                location: "string",
                description: "string",
                verdict: "string",
                severity: "string",
              },
            ],
          },
          diagramHandling: {
            score: 0.0,
            weight: 0.15,
            rationale: "string",
            issues: [
              {
                type: "string",
                location: "string",
                description: "string",
                verdict: "string",
                severity: "string",
              },
            ],
          },
        },
        overallScore: {
          weighted: 0.0,
          calculation:
            "(mathSymbol x 0.40) + (structural x 0.25) + (domain x 0.20) + (diagram x 0.15)",
        },
        netAssessment: {
          correctFixes: 0,
          missedErrors: 0,
          newErrorsCritical: 0,
          newErrorsModerate: 0,
          newErrorsMinor: 0,
          normalisations: 0,
          formatChanges: 0,
          contentLoss: 0,
          contentAdded: 0,
          uncertainCases: 0,
          netScore: 0.0,
          netScoreFormula:
            "correctFixes - (critical x 3) - (moderate x 1.5) - (minor x 0.5) - (formatChanges x 0.5) - (normalisations x 0.25)",
        },
        promptCompliance: {
          linePreservation: true,
          uncertaintyMarking: true,
          noExplanations: true,
          tableFormatPreserved: true,
          noNotationNormalisation: true,
          notes: "string (optional)",
        },
        lineDrift: {
          originalLines: 0,
          enhancedLines: 0,
          driftPercent: 0.0,
          driftDirection: "expanded|contracted|stable",
        },
        multiPassAnalysis: {
          applicable: false,
          pass1VsPass2: "identical|improved|degraded|not_applicable",
          changesInPass2: "string (describe what Pass 2 changed, if anything)",
          pass2Value: "positive|neutral|negative|not_applicable",
          notes: "string (optional)",
        },
        topRegressions: ["string (max 5)"],
        topImprovements: ["string (max 5)"],
        errorPatterns: [
          {
            pattern: "string",
            frequency: 0,
            examples: ["string"],
            promptImplication: "string",
          },
        ],
        validationFlags: {
          mmdRendersCleanly: true,
          delimiterBalance: true,
          imageReferencesPreserved: true,
          contentLengthReasonable: true,
          boldFormattingAssessed: true,
        },
        summary: "string (3-5 sentence narrative)",
      },
      null,
      2,
    );
  }

  // ============================================================================
  // DATA CAPTURE
  // ============================================================================

  /**
   * Capture all test data from the current enhancement state.
   * Call this immediately after enhancement completes.
   */
  function captureTestData() {
    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      throw new Error(
        "MathPixAIEnhancer not available. Has enhancement completed?",
      );
    }

    if (!enhancer.originalMMD || !enhancer.enhancedMMD) {
      throw new Error("No enhancement data found. Run enhancement first.");
    }

    // Document name from the PDF file
    const documentName =
      enhancer.embed?.currentFile?.name ||
      enhancer.timingLog?.find((e) => e.filename)?.filename ||
      enhancer.getSourceFilename?.() ||
      "unknown";

    // Clean document name for use as key (remove extension and common suffixes)
    const docKey = documentName.replace(/\.pdf$/i, "").replace(/[-_\s]+/g, "-");

    // Multi-pass data
    const lastRun = window.MathPixMultiPass?.lastRun;
    const multiPassActive = enhancer.multiPassEnabled && lastRun?.success;

    const testData = {
      // Identification
      documentName,
      docKey,
      model: enhancer.selectedModel,
      engine: enhancer.selectedEngine,
      multiPassEnabled: enhancer.multiPassEnabled,
      timestamp: new Date().toISOString(),

      // Content
      originalMMD: enhancer.originalMMD,
      enhancedMMD: enhancer.enhancedMMD,

      // Multi-pass specifics
      pass1MMD: multiPassActive ? lastRun.pass1MMD : null,
      pass2MMD: multiPassActive ? lastRun.pass2MMD : null,
      pass1EqualsPass2: multiPassActive
        ? lastRun.pass1MMD === lastRun.pass2MMD
        : null,
      diffStats: multiPassActive ? lastRun.diffStats : null,

      // Timing
      timingLog: enhancer.timingLog || [],
      totalTimeMs:
        enhancer.timingLog?.find((e) => e.stage === "COMPLETE")?.totalTimeMs ||
        0,
      pass1TimeMs:
        enhancer.timingLog?.find((e) => e.stage === "API_CALL_END")?.elapsed ||
        0,
      pass2TimeMs: multiPassActive ? lastRun.durationSeconds * 1000 : 0,

      // PDF reference (base64 stored separately to avoid bloating storage)
      pdfBase64Available: !!(
        enhancer.embed?.currentFileBase64 || enhancer.getSourcePDF?.()
      ),
      pdfSizeMB:
        enhancer.timingLog?.find((e) => e.pdfSizeMB)?.pdfSizeMB || "unknown",

      // Line counts — filter out %% AI: comment lines from enhanced count
      // to prevent uncertainty annotations from inflating drift figures (L.5)
      originalLines: enhancer.originalMMD.split("\n").length,
      enhancedLines: enhancer.enhancedMMD
        .split("\n")
        .filter((line) => !/^%%\s*AI:/.test(line)).length,
    };

    // Build result key
    testData.resultKey = buildResultKey(testData);

    logInfo(`Captured test data: ${testData.resultKey}`);
    logInfo(
      `Original: ${testData.originalLines} lines, ${testData.originalMMD.length} chars`,
    );
    logInfo(
      `Enhanced: ${testData.enhancedLines} lines, ${testData.enhancedMMD.length} chars`,
    );

    if (multiPassActive) {
      logInfo(`Multi-pass: Pass 1 = Pass 2: ${testData.pass1EqualsPass2}`);
    }

    return testData;
  }

  /**
   * Build a unique result key for storage.
   */
  function buildResultKey(testData) {
    const modelShort = testData.model
      .replace("anthropic/claude-", "")
      .replace(/-\d+$/, "");
    const mp = testData.multiPassEnabled ? "+mp" : "";
    return `${testData.docKey}|${modelShort}|${testData.engine}${mp}`;
  }

  // ============================================================================
  // API CALL TO EVALUATOR
  // ============================================================================

  /**
   * Send test data to Opus for evaluation.
   * Returns the parsed JSON evaluation report.
   */
  async function callEvaluator(testData) {
    const apiKey = localStorage.getItem("openrouter_api_key");
    if (!apiKey) {
      throw new Error(
        "No OpenRouter API key found. Configure it in the API settings.",
      );
    }

    // Try embed first (available during enhancement), fall back to session restorer
    let pdfBase64 = window.getMathPixAIEnhancer()?.embed?.currentFileBase64;

    if (!pdfBase64) {
      logInfo(
        "PDF base64 not on embed (cleaned up). Reading from session restorer...",
      );
      const pdfBlob = window.getMathPixAIEnhancer()?.getSourcePDF();
      if (!pdfBlob) {
        throw new Error(
          "PDF not available from either embed or session restorer. Is the session still open?",
        );
      }
      pdfBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Failed to read PDF file"));
        reader.readAsDataURL(pdfBlob);
      });
      logInfo(
        `PDF read from session restorer: ${(pdfBase64.length / (1024 * 1024)).toFixed(2)} MB base64`,
      );
    }

    const systemPrompt = buildEvalSystemPrompt();
    const userPrompt = buildEvalUserPrompt(testData);

    logInfo(`Sending evaluation to ${HARNESS_CONFIG.EVALUATOR_MODEL}...`);
    logInfo(
      `User prompt: ${userPrompt.length} chars (~${Math.round(userPrompt.length / 4)} tokens)`,
    );

    const startTime = performance.now();

    const response = await fetch(HARNESS_CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "MathPix AI Test Harness 7.5I",
      },
      body: JSON.stringify({
        model: HARNESS_CONFIG.EVALUATOR_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
        max_tokens: HARNESS_CONFIG.MAX_TOKENS,
        temperature: HARNESS_CONFIG.TEMPERATURE,
      }),
    });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Evaluator API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    logInfo(`Evaluator responded in ${elapsed}s`);

    // Extract text content from response
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from evaluator");
    }

    // Parse JSON from response (may have markdown fences)
    const evalReport = parseEvalResponse(content);

    // Add API cost info if available
    evalReport._evaluationMeta = {
      evaluatorModel: HARNESS_CONFIG.EVALUATOR_MODEL,
      evaluationTimeSeconds: parseFloat(elapsed),
      promptTokens: data.usage?.prompt_tokens || null,
      completionTokens: data.usage?.completion_tokens || null,
      totalCost: data.usage?.total_cost || null,
    };

    return evalReport;
  }

  /**
   * Parse the evaluator's JSON response, stripping any markdown fences.
   */
  function parseEvalResponse(content) {
    // Strip markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      logError("Failed to parse evaluator JSON response:", parseError.message);
      logError("Raw response (first 500 chars):", cleaned.substring(0, 500));
      // Store raw response so it's not lost
      return {
        _parseError: true,
        _rawResponse: content,
        overallScore: { weighted: null },
        netAssessment: { netScore: null },
        summary:
          "PARSE ERROR: Evaluator response was not valid JSON. Raw response stored in _rawResponse.",
      };
    }
  }

  // ============================================================================
  // SCORE VERIFICATION (ME-1, Phase 7.5J)
  // ============================================================================

  /**
   * Recompute the weighted score from sub-scores and flag discrepancies.
   * Called automatically after evaluation to catch evaluator arithmetic errors.
   *
   * @param {Object} evalReport - The parsed evaluation report
   * @returns {Object} Verification result with computed score and any discrepancy
   */
  function verifyScores(evalReport) {
    const scores = evalReport?.scores;
    const stated = evalReport?.overallScore?.weighted;

    if (!scores || stated == null) {
      logWarn(
        "Score verification: missing scores or weighted total — skipping",
      );
      return { verified: false, reason: "missing data" };
    }

    const math = scores.mathSymbolAccuracy?.score ?? 0;
    const structural = scores.structuralPreservation?.score ?? 0;
    const domain = scores.domainContentHandling?.score ?? 0;
    const diagram = scores.diagramHandling?.score;

    // Check if diagram weight redistribution applies (ME-5)
    const diagramNA =
      diagram == null ||
      scores.diagramHandling?.rationale?.toLowerCase().includes("n/a") === true;

    let computed;
    if (diagramNA) {
      // Redistributed weights: 47%, 29%, 24%
      computed = math * 0.47 + structural * 0.29 + domain * 0.24;
    } else {
      // Standard weights: 40%, 25%, 20%, 15%
      computed = math * 0.4 + structural * 0.25 + domain * 0.2 + diagram * 0.15;
    }

    const discrepancy = Math.abs(computed - stated);
    const result = {
      verified: true,
      computed: parseFloat(computed.toFixed(2)),
      stated: parseFloat(stated.toFixed(2)),
      discrepancy: parseFloat(discrepancy.toFixed(2)),
      diagramWeightRedistributed: diagramNA,
      match: discrepancy <= 0.15,
    };

    if (!result.match) {
      logWarn(
        `Score discrepancy detected: computed ${result.computed} vs stated ${result.stated} (diff: ${result.discrepancy})`,
      );
    } else {
      logDebug(
        `Score verification passed: computed ${result.computed} ≈ stated ${result.stated}`,
      );
    }

    return result;
  }

  // ============================================================================
  // STORAGE & PERSISTENCE
  // ============================================================================

  /** In-memory results store */
  let allResults = {};

  /**
   * Store a test result (evaluation report + test data).
   */
  function storeResult(testData, evalReport) {
    const key = testData.resultKey;

    const result = {
      key,
      testData: {
        documentName: testData.documentName,
        docKey: testData.docKey,
        model: testData.model,
        engine: testData.engine,
        multiPassEnabled: testData.multiPassEnabled,
        timestamp: testData.timestamp,
        totalTimeMs: testData.totalTimeMs,
        pass1TimeMs: testData.pass1TimeMs,
        pass2TimeMs: testData.pass2TimeMs,
        originalLines: testData.originalLines,
        enhancedLines: testData.enhancedLines,
        originalChars: testData.originalMMD.length,
        enhancedChars: testData.enhancedMMD.length,
        pass1EqualsPass2: testData.pass1EqualsPass2,
        diffStats: testData.diffStats,
        pdfSizeMB: testData.pdfSizeMB,
      },
      evaluation: evalReport,
    };

    allResults[key] = result;

    // Persist to localStorage
    saveToLocalStorage();

    // Auto-download individual result
    if (HARNESS_CONFIG.AUTO_DOWNLOAD) {
      downloadJSON(
        result,
        `eval-${key.replace(/\|/g, "-")}-${Date.now()}.json`,
      );
    }

    logInfo(`Result stored: ${key}`);
    return result;
  }

  /**
   * Save all results to localStorage.
   */
  function saveToLocalStorage() {
    try {
      localStorage.setItem(
        HARNESS_CONFIG.STORAGE_KEY,
        JSON.stringify(allResults),
      );
      logDebug(
        `Saved ${Object.keys(allResults).length} results to localStorage`,
      );
    } catch (error) {
      logError("Failed to save to localStorage:", error.message);
      logWarn(
        "Results are still in memory. Use window.exportAllResults() to download.",
      );
    }
  }

  /**
   * Load results from localStorage.
   */
  function loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(HARNESS_CONFIG.STORAGE_KEY);
      if (stored) {
        allResults = JSON.parse(stored);
        logInfo(
          `Loaded ${Object.keys(allResults).length} results from localStorage`,
        );
      }
    } catch (error) {
      logError("Failed to load from localStorage:", error.message);
    }
  }

  /**
   * Import results from a JSON file (paste or programmatic).
   */
  function importResults(jsonData) {
    const data = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

    if (data.key && data.evaluation) {
      // Single result
      allResults[data.key] = data;
      logInfo(`Imported single result: ${data.key}`);
    } else {
      // Multiple results (export format)
      let count = 0;
      for (const [key, value] of Object.entries(data)) {
        allResults[key] = value;
        count++;
      }
      logInfo(`Imported ${count} results`);
    }

    saveToLocalStorage();
  }

  /**
   * Trigger a JSON file download.
   * Uses two strategies: first tries the standard anchor click approach
   * appended to documentElement (outside modal context), then falls
   * back to window.open if that fails.
   */
  function downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Strategy 1: anchor click appended to documentElement (avoids modal interception)
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.documentElement.appendChild(link);
      // Delay click to escape any modal event handlers
      setTimeout(() => {
        link.click();
        document.documentElement.removeChild(link);
        // Keep URL alive briefly for the download to start
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 100);
      logInfo(`Downloaded: ${filename}`);
    } catch (e) {
      // Strategy 2: open in new tab (user can Save As)
      logWarn(`Standard download failed, opening in new tab: ${e.message}`);
      window.open(url, "_blank");
      logInfo(`Opened in new tab: ${filename} (use Save As to save)`);
    }
  }

  /**
   * Export all results as a single JSON file.
   */
  function exportAllResults() {
    const count = Object.keys(allResults).length;
    if (count === 0) {
      logWarn("No results to export");
      return;
    }
    downloadJSON(allResults, `test-harness-all-results-${Date.now()}.json`);
    logInfo(`Exported ${count} results`);
  }

  // ============================================================================
  // MAIN ORCHESTRATION
  // ============================================================================

  /**
   * The one command to rule them all.
   * Captures test data, sends to evaluator, stores result.
   */
  async function captureAndEvaluate() {
    console.log("\n=== CAPTURE AND EVALUATE ===\n");

    try {
      // 1. Capture test data
      logInfo("Step 1: Capturing test data...");
      const testData = captureTestData();
      console.log(`Document: ${testData.documentName}`);
      console.log(`Model: ${testData.model}`);
      console.log(`Engine: ${testData.engine}`);
      console.log(`Multi-pass: ${testData.multiPassEnabled}`);
      console.log(`Key: ${testData.resultKey}`);

      // 2. Check for existing result
      if (allResults[testData.resultKey]) {
        logWarn(
          `Existing result for ${testData.resultKey} will be overwritten`,
        );
      }

      // 3. Call evaluator
      logInfo("Step 2: Sending to evaluator (this takes 30-60 seconds)...");
      const evalReport = await callEvaluator(testData);

      // 4. Verify scores BEFORE storing (L.1 fix — was previously after store/download)
      const scoreCheck = verifyScores(evalReport);
      // Always inject verification data so it is present in the auto-downloaded JSON
      evalReport._scoreVerification = scoreCheck;
      if (scoreCheck.verified && !scoreCheck.match) {
        logWarn(
          `⚠️ Evaluator arithmetic error: stated ${scoreCheck.stated}, computed ${scoreCheck.computed}`,
        );
      }

      // 5. Store result (triggers auto-download — now includes _scoreVerification)
      logInfo("Step 3: Storing result...");
      const result = storeResult(testData, evalReport);

      // 6. Display summary
      console.log("\n--- EVALUATION SUMMARY ---");
      console.log(
        `Weighted score: ${evalReport.overallScore?.weighted ?? "N/A"}${scoreCheck.verified && !scoreCheck.match ? ` (⚠️ computed: ${scoreCheck.computed})` : ""}`,
      );
      console.log(`Net score: ${evalReport.netAssessment?.netScore ?? "N/A"}`);
      console.log(
        `Correct fixes: ${evalReport.netAssessment?.correctFixes ?? "N/A"}`,
      );
      console.log(
        `Critical new errors: ${evalReport.netAssessment?.newErrorsCritical ?? "N/A"}`,
      );

      if (evalReport.scores) {
        console.log(
          `  Math: ${evalReport.scores.mathSymbolAccuracy?.score ?? "?"}/10`,
        );
        console.log(
          `  Structural: ${evalReport.scores.structuralPreservation?.score ?? "?"}/10`,
        );
        console.log(
          `  Domain: ${evalReport.scores.domainContentHandling?.score ?? "?"}/10`,
        );
        console.log(
          `  Diagram: ${evalReport.scores.diagramHandling?.score ?? "?"}/10`,
        );
      }

      if (evalReport.summary) {
        console.log(`\nSummary: ${evalReport.summary}`);
      }

      if (evalReport._parseError) {
        logError(
          "Evaluator response was not valid JSON. Check the downloaded file for raw response.",
        );
      }

      console.log(`\nResult saved as: ${testData.resultKey}`);
      console.log("Auto-downloaded to your Downloads folder.");
      console.log("\n=== DONE ===\n");

      return result;
    } catch (error) {
      logError("Capture and evaluate failed:", error.message);
      console.error(error);
      logWarn(
        "If the enhancement data is still available, you can retry with: window.captureAndEvaluate()",
      );
      return null;
    }
  }

  /**
   * Capture test data only (no evaluation). Useful for saving raw data.
   */
  function captureOnly() {
    try {
      const testData = captureTestData();
      const filename = `capture-${testData.resultKey.replace(/\|/g, "-")}-${Date.now()}.json`;

      // Include the MMD content in the download
      downloadJSON(
        {
          key: testData.resultKey,
          testData: testData,
        },
        filename,
      );

      logInfo(`Captured and downloaded: ${filename}`);
      return testData;
    } catch (error) {
      logError("Capture failed:", error.message);
      return null;
    }
  }

  // ============================================================================
  // ANALYSIS & COMPARISON
  // ============================================================================

  /**
   * Display the full test matrix as a console table.
   */
  function showTestMatrix() {
    const results = Object.values(allResults);
    if (results.length === 0) {
      logWarn("No results available. Run some evaluations first.");
      return;
    }

    console.log("\n=== TEST MATRIX (7.5I) ===\n");

    // Build table data
    const rows = results.map((r) => ({
      Key: r.key,
      Document: r.testData.docKey,
      Model: r.testData.model.replace("anthropic/claude-", ""),
      Engine: r.testData.engine,
      MP: r.testData.multiPassEnabled ? "ON" : "OFF",
      Weighted: r.evaluation?.overallScore?.weighted?.toFixed(2) ?? "ERR",
      Net: r.evaluation?.netAssessment?.netScore?.toFixed(1) ?? "ERR",
      Math: r.evaluation?.scores?.mathSymbolAccuracy?.score ?? "?",
      Struct: r.evaluation?.scores?.structuralPreservation?.score ?? "?",
      Domain: r.evaluation?.scores?.domainContentHandling?.score ?? "?",
      Diag: r.evaluation?.scores?.diagramHandling?.score ?? "?",
      Fixes: r.evaluation?.netAssessment?.correctFixes ?? "?",
      CritErr: r.evaluation?.netAssessment?.newErrorsCritical ?? "?",
      Drift:
        r.evaluation?.lineDrift?.driftPercent != null
          ? `${r.evaluation.lineDrift.driftPercent.toFixed(1)}%`
          : `${(Math.abs((r.testData.enhancedLines - r.testData.originalLines) / r.testData.originalLines) * 100).toFixed(1)}%`,
      TimeMs: r.testData.totalTimeMs,
    }));

    console.table(rows);

    // Summary stats
    const scores = results
      .map((r) => r.evaluation?.overallScore?.weighted)
      .filter((s) => s != null);

    if (scores.length > 0) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const max = Math.max(...scores);
      const min = Math.min(...scores);
      console.log(
        `\nScores: mean=${mean.toFixed(2)}, min=${min.toFixed(2)}, max=${max.toFixed(2)}, n=${scores.length}`,
      );
    }

    console.log(`\nTotal results: ${results.length}`);
    console.log("\n=== END TEST MATRIX ===\n");
  }

  /**
   * Compare models side-by-side for a specific document.
   */
  function compareModels(docNameFragment) {
    const matches = Object.values(allResults).filter(
      (r) =>
        r.testData.docKey
          .toLowerCase()
          .includes(docNameFragment.toLowerCase()) ||
        r.testData.documentName
          .toLowerCase()
          .includes(docNameFragment.toLowerCase()),
    );

    if (matches.length === 0) {
      logWarn(`No results found matching "${docNameFragment}"`);
      logInfo("Available documents:", [
        ...new Set(Object.values(allResults).map((r) => r.testData.docKey)),
      ]);
      return;
    }

    console.log(
      `\n=== MODEL COMPARISON: ${docNameFragment} (${matches.length} results) ===\n`,
    );

    const rows = matches.map((r) => ({
      Model: r.testData.model.replace("anthropic/claude-", ""),
      Engine: r.testData.engine,
      MP: r.testData.multiPassEnabled ? "ON" : "OFF",
      Weighted: r.evaluation?.overallScore?.weighted?.toFixed(2) ?? "ERR",
      Net: r.evaluation?.netAssessment?.netScore?.toFixed(1) ?? "ERR",
      Math: r.evaluation?.scores?.mathSymbolAccuracy?.score ?? "?",
      Struct: r.evaluation?.scores?.structuralPreservation?.score ?? "?",
      Domain: r.evaluation?.scores?.domainContentHandling?.score ?? "?",
      Diag: r.evaluation?.scores?.diagramHandling?.score ?? "?",
      Fixes: r.evaluation?.netAssessment?.correctFixes ?? "?",
      CritErr: r.evaluation?.netAssessment?.newErrorsCritical ?? "?",
    }));

    console.table(rows);

    // Show top regressions and improvements for each
    matches.forEach((r) => {
      const model = r.testData.model.replace("anthropic/claude-", "");
      console.log(`\n${model} (${r.testData.engine}):`);
      if (r.evaluation?.topImprovements?.length) {
        console.log(
          "  Top improvements:",
          r.evaluation.topImprovements.slice(0, 3).join("; "),
        );
      }
      if (r.evaluation?.topRegressions?.length) {
        console.log(
          "  Top regressions:",
          r.evaluation.topRegressions.slice(0, 3).join("; "),
        );
      }
    });

    console.log("\n=== END COMPARISON ===\n");
  }

  /**
   * Send all results to Opus for a comprehensive analysis report.
   */
  async function generateFinalReport() {
    const results = Object.values(allResults);
    if (results.length < 2) {
      logWarn("Need at least 2 results for a meaningful report.");
      return;
    }

    const apiKey = localStorage.getItem("openrouter_api_key");
    if (!apiKey) {
      throw new Error("No API key found.");
    }

    // Build a compact summary of all results (no MMD content -- just scores)
    const compact = results.map((r) => ({
      key: r.key,
      document: r.testData.docKey,
      model: r.testData.model,
      engine: r.testData.engine,
      multiPass: r.testData.multiPassEnabled,
      weighted: r.evaluation?.overallScore?.weighted,
      net: r.evaluation?.netAssessment?.netScore,
      math: r.evaluation?.scores?.mathSymbolAccuracy?.score,
      structural: r.evaluation?.scores?.structuralPreservation?.score,
      domain: r.evaluation?.scores?.domainContentHandling?.score,
      diagram: r.evaluation?.scores?.diagramHandling?.score,
      fixes: r.evaluation?.netAssessment?.correctFixes,
      critErrors: r.evaluation?.netAssessment?.newErrorsCritical,
      modErrors: r.evaluation?.netAssessment?.newErrorsModerate,
      normalisations: r.evaluation?.netAssessment?.normalisations,
      formatChanges: r.evaluation?.netAssessment?.formatChanges,
      driftPercent: r.evaluation?.lineDrift?.driftPercent,
      totalTimeMs: r.testData.totalTimeMs,
      pass1EqualsPass2: r.testData.pass1EqualsPass2,
      summary: r.evaluation?.summary,
      topRegressions: r.evaluation?.topRegressions,
      topImprovements: r.evaluation?.topImprovements,
      errorPatterns: r.evaluation?.errorPatterns,
    }));

    logInfo(`Generating final report from ${results.length} results...`);

    const response = await fetch(HARNESS_CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "MathPix AI Test Harness - Final Report",
      },
      body: JSON.stringify({
        model: HARNESS_CONFIG.EVALUATOR_MODEL,
        messages: [
          {
            role: "user",
            content: [
              "You are analysing results from a model/engine comparison test for an AI-powered OCR enhancement system.",
              "The system enhances MathPix OCR output of mathematical documents using different LLM models and PDF engines.",
              "",
              "Here are the evaluation results from all test runs:",
              "",
              "```json",
              JSON.stringify(compact, null, 2),
              "```",
              "",
              "Please produce a comprehensive analysis report answering these questions:",
              "",
              "1. Which model achieves the best overall quality? (weighted score)",
              "2. Does the improvement from Haiku to Sonnet/Opus justify 3-5x cost?",
              "3. Does mistral-ocr engine produce meaningfully different results from native?",
              "4. Are there document types where a specific model/engine combination clearly wins?",
              "5. What is the recommended default combination?",
              "6. Do more capable models show better prompt compliance (fewer normalisations, less drift)?",
              "7. Does value substitution persist with more capable models?",
              "8. Do more capable models achieve lower line drift on handwritten documents?",
              "9. What is the role of multi-pass? Does Pass 2 make meaningful changes with better models?",
              "",
              "Structure your report with:",
              "- Executive summary (3 sentences)",
              "- Results matrix (table format)",
              "- Per-question analysis",
              "- Recommendations (default model, when to use alternatives, multi-pass guidance)",
              "- Error patterns that persist across models",
              "",
              "Use British spelling throughout. Be data-driven -- cite specific scores.",
            ].join("\n"),
          },
        ],
        max_tokens: HARNESS_CONFIG.MAX_TOKENS,
        temperature: HARNESS_CONFIG.TEMPERATURE,
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

      // Download the report
      downloadJSON(
        {
          generatedAt: new Date().toISOString(),
          resultCount: results.length,
          report,
          rawData: compact,
        },
        `final-report-7.5I-${Date.now()}.json`,
      );
    }

    return report;
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Show available commands and current state.
   */
  function showHelp() {
    console.log("\n=== MathPix AI Test Harness (7.5I) ===\n");
    console.log("WORKFLOW:");
    console.log("  1. Load PDF, run OCR, enhance with chosen model/engine");
    console.log(
      "  2. window.captureAndEvaluate()  -- captures + sends to Opus + saves",
    );
    console.log("  3. Repeat for each model/engine combination");
    console.log("");
    console.log("COMMANDS:");
    console.log(
      "  window.captureAndEvaluate()      -- Full capture + evaluation + save",
    );
    console.log(
      "  window.captureOnly()             -- Save raw data without evaluation",
    );
    console.log(
      "  window.showTestMatrix()           -- Display all results as table",
    );
    console.log(
      "  window.compareModels('FEEG1050')  -- Side-by-side for one document",
    );
    console.log(
      "  window.generateFinalReport()      -- Opus analyses all results",
    );
    console.log(
      "  window.exportAllResults()         -- Download all results as JSON",
    );
    console.log(
      "  window.importTestResults(json)    -- Import results from JSON",
    );
    console.log("  window.testHarnessHelp()          -- Show this help");
    console.log("");
    console.log(`CONFIGURATION:`);
    console.log(`  Evaluator model: ${HARNESS_CONFIG.EVALUATOR_MODEL}`);
    console.log(`  Auto-download: ${HARNESS_CONFIG.AUTO_DOWNLOAD}`);
    console.log(`  Results in memory: ${Object.keys(allResults).length}`);
    console.log(`  Storage key: ${HARNESS_CONFIG.STORAGE_KEY}`);
    console.log("");
    console.log("To change evaluator model:");
    console.log(
      '  window.MathPixTestHarness.config.EVALUATOR_MODEL = "anthropic/claude-sonnet-4-5-20250929"',
    );
    console.log("\n=== END HELP ===\n");
  }

  /**
   * List all stored result keys.
   */
  function listResults() {
    const keys = Object.keys(allResults);
    if (keys.length === 0) {
      logInfo("No results stored.");
      return [];
    }
    console.log(`\nStored results (${keys.length}):`);
    keys.forEach((key) => {
      const r = allResults[key];
      const score = r.evaluation?.overallScore?.weighted;
      console.log(
        `  ${key} => ${score != null ? score.toFixed(2) : "no score"}`,
      );
    });
    return keys;
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  // Load any previously saved results
  loadFromLocalStorage();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixTestHarness = {
    config: HARNESS_CONFIG,
    results: allResults,
    captureAndEvaluate,
    captureOnly,
    showTestMatrix,
    compareModels,
    generateFinalReport,
    exportAllResults,
    importResults,
    listResults,
    showHelp,
    verifyScores,
  };

  // Convenience shortcuts
  window.captureAndEvaluate = captureAndEvaluate;
  window.captureOnly = captureOnly;
  window.showTestMatrix = showTestMatrix;
  window.compareModels = compareModels;
  window.generateFinalReport = generateFinalReport;
  window.exportAllResults = exportAllResults;
  window.importTestResults = importResults;
  window.testHarnessHelp = showHelp;

  logInfo(
    "Test Harness v1.0.0 loaded. Type window.testHarnessHelp() for commands.",
  );
  logInfo(
    `${Object.keys(allResults).length} previous results loaded from storage.`,
  );
})();
