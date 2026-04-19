/**
 * @fileoverview Test Results Summary Extractor & Helpers
 * @description Loaded alongside the test harness. Provides:
 *              - extractSummary() — compact JSON export for analysis
 *              - waitForImages() — reliable polling for async image loading
 *
 * Usage:
 *   1. Run your test batches (runRepetitionTest, runReasoningTest, etc.)
 *   2. Call: extractSummary("baseline")
 *   3. A JSON file downloads automatically
 *   4. Copy the JSON content into your analysis conversation
 *
 * The summary strips out full prompt text and description text (which are
 * large) and keeps only the metrics needed for analysis.
 *
 * @version 1.1.0
 */

/**
 * Return the known test image keys.
 *
 * The harness exports testImages as a reference to the initial empty
 * object, then loadTestImages() reassigns the internal variable —
 * breaking the exported reference. Polling harness.testImages therefore
 * always sees 0 keys.
 *
 * Since runReliability() and runSingleTest() handle image loading
 * internally via getTestImage(), we don't need to pre-load. We just
 * need the list of keys, which is fixed.
 *
 * @returns {string[]} Array of 7 test image keys
 */
function getTestImageKeys() {
  return [
    "piston-cylinder",
    "pv-diagram",
    "ga-mechanism",
    "siege-rouen",
    "agar-plate-inhibition",
    "tsunami-deaths-map",
    "exceedance-nomograph",
  ];
}

function extractSummary(label) {
  "use strict";

  const harness = window.ImageDescriberTestHarness;
  if (!harness || !harness.results) {
    console.error("[Summary] Test harness not found or no results.");
    return null;
  }

  const results = Object.values(harness.results);
  if (results.length === 0) {
    console.error("[Summary] No results to summarise.");
    return null;
  }

  // ── Per-result compact extraction ──────────────────────────────────────

  const compactResults = results.map((r) => {
    const entry = {
      key: r.key,
      imageKey: r.imageKey,
      descModel: r.descModel?.replace("anthropic/claude-", "") || "?",
      verifyModel: r.verifyModel?.replace("anthropic/claude-", "") || null,
      verifyEnabled: r.verifyEnabled || false,
      promptRepetition: r.promptRepetition || "none",
      timestamp: r.timestamp,
    };

    // Reasoning config
    if (r.reasoning) {
      entry.reasoning = {
        desc: r.reasoning.descEnabled || false,
        verify: r.reasoning.verifyEnabled || false,
      };
    }

    // Reliability run info
    if (r.reliabilityRun) {
      entry.run = {
        number: r.reliabilityRun.runNumber,
        total: r.reliabilityRun.totalRuns,
        batchId: r.reliabilityRun.batchId,
      };
    }

    // Description metrics (no text)
    if (r.description) {
      entry.desc = {
        promptTokens: r.description.promptTokens,
        completionTokens: r.description.completionTokens,
        totalTokens: r.description.totalTokens,
        reasoningTokens: r.description.reasoningTokens || 0,
        elapsedMs: r.description.elapsedMs,
      };
    }

    // Verification metrics (no text)
    if (r.verification) {
      entry.verify = {
        promptTokens: r.verification.promptTokens,
        completionTokens: r.verification.completionTokens,
        totalTokens: r.verification.totalTokens,
        reasoningTokens: r.verification.reasoningTokens || 0,
        elapsedMs: r.verification.elapsedMs,
      };
    }

    // Checklist results
    if (r.checklist) {
      entry.checklist = {
        overallPass: r.checklist.overallPass,
        mustContainHits: r.checklist.mustContainHits,
        mustContainTotal: r.checklist.mustContainTotal,
        mustNotContainViolations: r.checklist.mustNotContainViolations,
        mustNotContainTotal: r.checklist.mustNotContainTotal,
        visualFactsPassed: r.checklist.visualFactsPassed,
        visualFactsTotal: r.checklist.visualFactsTotal,
        // Per-fact detail (compact: only failed facts)
        failedFacts: (r.checklist.visualFactsDetails || [])
          .filter((f) => !f.passed)
          .map((f) => ({
            id: f.id,
            required: f.required,
            reason: f.failReason || "AI evaluator judged fail",
          })),
      };
    }

    // AI evaluation score (if present)
    if (r.aiEvaluation?.overallScore?.weighted) {
      entry.aiScore = r.aiEvaluation.overallScore.weighted;
    }

    // Prompt lengths (not content)
    if (r.prompts) {
      entry.promptLengths = {
        system: r.prompts.systemPromptLength,
        userOriginal: r.prompts.userPromptOriginalLength,
        userFinal: r.prompts.userPromptFinalLength,
        repetitionMode: r.prompts.repetitionMode,
      };
    }

    return entry;
  });

  // ── Aggregate statistics ───────────────────────────────────────────────

  // Group by image
  const byImage = {};
  for (const r of compactResults) {
    if (!byImage[r.imageKey]) byImage[r.imageKey] = [];
    byImage[r.imageKey].push(r);
  }

  const imageStats = {};
  for (const [imageKey, imageResults] of Object.entries(byImage)) {
    const passed = imageResults.filter((r) => r.checklist?.overallPass).length;
    const total = imageResults.length;

    // Collect all failed fact IDs with counts
    const factFailCounts = {};
    for (const r of imageResults) {
      for (const f of r.checklist?.failedFacts || []) {
        if (!factFailCounts[f.id]) {
          factFailCounts[f.id] = {
            count: 0,
            required: f.required,
            reasons: [],
          };
        }
        factFailCounts[f.id].count++;
        if (f.reason && !factFailCounts[f.id].reasons.includes(f.reason)) {
          factFailCounts[f.id].reasons.push(f.reason);
        }
      }
    }

    // Average tokens
    const avgDescTokens = Math.round(
      imageResults.reduce((s, r) => s + (r.desc?.totalTokens || 0), 0) / total,
    );
    const avgDescMs = Math.round(
      imageResults.reduce((s, r) => s + (r.desc?.elapsedMs || 0), 0) / total,
    );

    imageStats[imageKey] = {
      passRate: `${passed}/${total} (${Math.round((passed / total) * 100)}%)`,
      avgDescTokens,
      avgDescMs,
      factFailures: factFailCounts,
    };
  }

  // Group by config (image + model + repetition + reasoning)
  const byConfig = {};
  for (const r of compactResults) {
    const reasonLabel = r.reasoning
      ? r.reasoning.desc && r.reasoning.verify
        ? "both"
        : r.reasoning.desc
          ? "desc"
          : r.reasoning.verify
            ? "verify"
            : "none"
      : "none";

    const configKey = `${r.descModel}|rep:${r.promptRepetition}|reason:${reasonLabel}`;

    if (!byConfig[configKey]) byConfig[configKey] = [];
    byConfig[configKey].push(r);
  }

  const configStats = {};
  for (const [configKey, configResults] of Object.entries(byConfig)) {
    const passed = configResults.filter((r) => r.checklist?.overallPass).length;
    const total = configResults.length;
    const avgTokens = Math.round(
      configResults.reduce((s, r) => s + (r.desc?.totalTokens || 0), 0) / total,
    );

    configStats[configKey] = {
      passRate: `${passed}/${total} (${Math.round((passed / total) * 100)}%)`,
      avgTokens,
      images: [...new Set(configResults.map((r) => r.imageKey))],
    };
  }

  // ── Build summary ──────────────────────────────────────────────────────

  const summary = {
    meta: {
      label: label || "unlabelled",
      extractedAt: new Date().toISOString(),
      totalResults: compactResults.length,
      totalImages: Object.keys(byImage).length,
      totalConfigs: Object.keys(byConfig).length,
    },
    imageStats,
    configStats,
    results: compactResults,
  };

  // ── Download ───────────────────────────────────────────────────────────

  const filename = `test-summary-${label || "batch"}-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(summary, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`\n=== SUMMARY EXTRACTED ===`);
  console.log(`Label: ${summary.meta.label}`);
  console.log(`Results: ${summary.meta.totalResults}`);
  console.log(`Images: ${summary.meta.totalImages}`);
  console.log(`Configs: ${summary.meta.totalConfigs}`);
  console.log(`Downloaded: ${filename}`);
  console.log(`\nImage stats:`);
  console.table(imageStats);
  console.log(`\nConfig stats:`);
  console.table(configStats);
  console.log(`\n=== END SUMMARY ===\n`);

  return summary;
}

// Confirmation
console.log("[TestHelpers] Loaded: extractSummary(), getTestImageKeys()");
