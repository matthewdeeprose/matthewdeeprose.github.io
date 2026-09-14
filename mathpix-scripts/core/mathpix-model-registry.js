/**
 * @file mathpix-model-registry.js
 * @module MathPixModelRegistry
 * @description
 * Parcel I5-1 — the recommended-by-purpose model registry, first increment.
 *
 * ONE map recording which model is recommended for which PURPOSE on which
 * PROVIDER, carrying the measuring round and the date beside each choice.
 *
 * WHY A PURPOSE DIMENSION AND NOT A SINGLE SHARED DEFAULT. Three AI workflows
 * each carried their own frozen map — `AI_ENHANCER_CONFIG.DEFAULT_BY_PROVIDER`
 * in mathpix-ai-enhancer.js, `DEFAULT_BY_PROVIDER` in mathpix-context-ai.js,
 * and `PREFERRED_BY_PROVIDER` in alt-text-cloud-adapter.js — and TWO OF THE
 * THREE DIVERGENCES ARE CORRECT. Alt text prefers `anthropic/claude-sonnet-5`
 * on OpenRouter where the other two prefer `anthropic/claude-fable-5`, because
 * they are different tasks measured in different rounds and they have different
 * winners. Collapsing the three to one value would erase a measured result; the
 * purpose dimension is what makes the divergence EXPRESSIBLE rather than
 * accidental. The case for folding them is single-sourcing, not disagreement.
 *
 * WHY THE ROUND AND THE DATE ARE STORED BESIDE THE ID. A bare id cannot be
 * compared against anything. A later parcel assessing a new model version needs
 * to know what the incumbent was measured against and when, so the two are
 * fields of the entry rather than prose in a comment that a re-point would
 * leave behind.
 *
 * THE UNRECOGNISED-PROVIDER CONTRACT IS INHERITED, NOT DECIDED HERE. All three
 * seams already refuse — return null, log a warning, never borrow another
 * provider's id (AW-36 for the enhancer; the other two always did). This module
 * refuses on the same terms, and refuses an unrecognised PURPOSE identically,
 * so there is one refusal shape rather than two.
 *
 * NO DOM, NO network, NO globals consulted. Pure data and one pure lookup, so
 * this file takes no load-order dependency in either direction beyond loading
 * BEFORE the consumers that read it. Its script tag sits immediately after
 * mathpix-model-capability.js and therefore ahead of mathpix-ai-enhancer.js,
 * mathpix-context-ai.js and alt-text-cloud-adapter.js.
 *
 * WHAT CONSUMES IT TODAY — ONE OF THREE. The AI enhancer's
 * `_defaultModelForProvider` reads the `mmd-correction` purpose and its own map
 * is deleted. The Context tab and the alt-text cloud adapter still carry their
 * own maps and are pointed here in their own parcels; their entries are already
 * recorded below so the two cannot drift while they wait.
 *
 * THE TWO OUT-OF-LANE DEFAULTS, RECORDED AND DELIBERATELY NOT CONSUMED. There
 * are FIVE model-default declarations in the tree, not three, and the other two
 * belong to other lanes:
 *
 *   - `isDefault: true` on `anthropic/claude-haiku-4.5` in js/model-definitions.js
 *     (~:27017), which is the model-registry picker's own default.
 *   - `DEFAULT_CONFIG.model`, also `anthropic/claude-haiku-4.5`, in
 *     openrouter-embed/openrouter-embed-core.js (~:61), which is the embed's
 *     fallback when a caller names no model.
 *
 * They are written here so they cannot be rediscovered as a new finding, and
 * NEITHER IS CONSUMED BY THIS MODULE. Absorbing them would pull two other
 * lanes' surfaces into a MathPix parcel; that is scope creep, not completeness.
 * Neither file is edited by this parcel.
 *
 * @see mathpix-scripts/core/mathpix-model-capability.js (the shape this follows)
 * @see mathpix-scripts/docs/alt-text/phase-4-roadmap-decisions.md (item 5)
 */

const MathPixModelRegistry = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per CLAUDE.md § Logging Standards — IIFE pattern)
  // ---------------------------------------------------------------------------

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error(`[MathPixModelRegistry] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MathPixModelRegistry] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MathPixModelRegistry] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MathPixModelRegistry] ${message}`, ...args);
  }

  // ===========================================================================
  // PURPOSES
  // ===========================================================================

  /**
   * The three AI workflows, as a frozen enum rather than free-form strings.
   *
   * A closed set, because an unrecognised purpose must be REFUSABLE. Free-form
   * keys would make a typo resolve to "no entry", which is indistinguishable
   * from "this purpose has no recommendation yet" — and the first is a defect
   * while the second is a legitimate state.
   */
  const PURPOSES = Object.freeze({
    ALT_TEXT: "alt-text",
    MMD_CORRECTION: "mmd-correction",
    CONTEXT: "context",
  });

  /**
   * The provider keys, spelled EXACTLY as all three consumer maps already spell
   * them and as `ProviderSwitcher.getActive()` returns them.
   *
   * Verified identical across the three maps on 14 September 2026 before this
   * file was written: `openrouter` and `azure-openai` in every one. A registry
   * keyed on a spelling one consumer does not use fails silently AT THAT
   * CONSUMER, which is the worst place for it to fail.
   */
  const PROVIDERS = Object.freeze({
    OPENROUTER: "openrouter",
    AZURE_OPENAI: "azure-openai",
  });

  // ===========================================================================
  // THE REGISTRY
  // ===========================================================================

  /**
   * Build one frozen entry. Kept as a helper so every entry has the same three
   * fields and no entry can be written with a field missing.
   *
   * @param {string} modelId the recommended model id
   * @param {string} round the measuring round that settled this choice
   * @param {string} measured ISO date of that round, YYYY-MM-DD
   * @returns {Readonly<{modelId: string, round: string, measured: string}>}
   */
  function entry(modelId, round, measured) {
    return Object.freeze({ modelId, round, measured });
  }

  /**
   * THE RECOMMENDED MODEL PER PURPOSE PER PROVIDER — measured, not preferred.
   *
   * Frozen at every level: the outer map, each purpose's provider map, and each
   * entry. So a consumer cannot re-point a recommendation at run time, which is
   * how a single source becomes a second copy.
   *
   * THE ROUND AND THE DATE NAME THE ROUND THAT SETTLED THE CHOICE, not every
   * round that touched it. Where a later round re-verified the same id against
   * a changed prompt, the later round is named too and the date is the LATER
   * one — because the question a future reader asks is "when was this last
   * confirmed against what we actually ship", not "when was it first picked".
   */
  const RECOMMENDED_BY_PURPOSE = Object.freeze({
    /**
     * ALT TEXT — the image-description cloud adapter.
     *
     * AW-4r ranked eight models on three images, AW-5 held the model still and
     * varied the configuration, AW-6x widened to six models with a fresh judge,
     * and AW-7ck settled it on 3 September 2026: three survivors over all
     * eleven capacitors images, on the shipped configuration, judged blind by a
     * judge sharing a vendor with none of them. `azure-openai/gpt-5.6-sol` came
     * first outright at 18.91 of 20.
     *
     * THE OPENROUTER ENTRY IS sonnet-5 AND NOT opus-5 ON PURPOSE. That round
     * did not separate second from third, and where the evidence does not
     * separate two models it is not this registry's job to invent a separation;
     * sonnet is the cheaper and markedly faster of the pair.
     *
     * THIS IS THE DIVERGENCE THE PURPOSE DIMENSION EXISTS FOR — the other two
     * purposes recommend fable-5 on the same provider, and that is correct.
     */
    [PURPOSES.ALT_TEXT]: Object.freeze({
      [PROVIDERS.OPENROUTER]: entry(
        "anthropic/claude-sonnet-5",
        "AW-4r to AW-7ck",
        "2026-09-03"
      ),
      [PROVIDERS.AZURE_OPENAI]: entry(
        "azure-openai/gpt-5.6-sol",
        "AW-4r to AW-7ck",
        "2026-09-03"
      ),
    }),

    /**
     * MMD CORRECTION — the AI enhancer.
     *
     * AW-19 (7 September 2026) was the first MMD-correction round that could be
     * ranked, and it ranked the then-shipped default LAST. AW-21 (8 September
     * 2026) settled it: five documents x five models x three runs.
     * `claude-fable-5` and `gpt-5.6-sol` lead on mean weighted score, on mean
     * net improvement and on the side-assist's blind reading, and they lead by
     * more than the within-model spread on most documents.
     */
    [PURPOSES.MMD_CORRECTION]: Object.freeze({
      [PROVIDERS.OPENROUTER]: entry(
        "anthropic/claude-fable-5",
        "AW-19 and AW-21",
        "2026-09-08"
      ),
      [PROVIDERS.AZURE_OPENAI]: entry(
        "azure-openai/gpt-5.6-sol",
        "AW-19 and AW-21",
        "2026-09-08"
      ),
    }),

    /**
     * CONTEXT — the Context tab's field auto-fill.
     *
     * AW-27 (10 September 2026) measured it: six documents x five models x
     * three runs, blinded. Against the previous value `claude-haiku-4.5`, both
     * winners record ZERO unstable fields in 24 checks where haiku records
     * three; both read `solution-sheet` on the handwritten class test whose own
     * face prints "Solutions"; both leave `audienceLevel` empty on the sheet
     * that states no level; neither ever put a topic in `moduleName`.
     *
     * AW-34 (11 September 2026) re-verified both ids against the prompt that
     * results once the page-range clause moved into the user prompt, so the
     * date below is AW-34's rather than AW-27's.
     */
    [PURPOSES.CONTEXT]: Object.freeze({
      [PROVIDERS.OPENROUTER]: entry(
        "anthropic/claude-fable-5",
        "AW-27, re-verified AW-34",
        "2026-09-11"
      ),
      [PROVIDERS.AZURE_OPENAI]: entry(
        "azure-openai/gpt-5.6-sol",
        "AW-27, re-verified AW-34",
        "2026-09-11"
      ),
    }),
  });

  // ===========================================================================
  // THE LOOKUP
  // ===========================================================================

  /**
   * The recommended entry for one purpose on one provider.
   *
   * THE ONE READ POINT. Consumers take the whole entry rather than a bare id,
   * so a caller that wants to report which round chose a model can, without a
   * second lookup that could disagree with the first.
   *
   * REFUSES ON BOTH AXES, IDENTICALLY. An unrecognised purpose and an
   * unrecognised provider both return null and warn — the shape all three seams
   * already use for an unrecognised provider, extended to the new dimension so
   * there is one refusal to reason about rather than two.
   *
   * NO CROSS-PROVIDER FALLBACK, and none may be added. Borrowing another
   * provider's entry is precisely the defect AW-35 measured live on the
   * enhancer and AW-36 removed: `getActive()` returns any stored string
   * verbatim, so an unrecognised provider IS reachable, and the borrow sent an
   * OpenRouter id on Foundry's behalf. A fallback here would reinstate it one
   * indirection further from the seam and therefore harder to find.
   *
   * NO CROSS-PURPOSE FALLBACK EITHER, for the stronger reason: the purposes
   * disagree deliberately, so borrowing across them would hand alt text the
   * MMD-correction winner and read as a working answer.
   *
   * @param {string} purpose one of PURPOSES
   * @param {string} providerId one of PROVIDERS
   * @returns {Readonly<{modelId: string, round: string, measured: string}>|null}
   */
  function recommendedModel(purpose, providerId) {
    const byProvider = RECOMMENDED_BY_PURPOSE[purpose];
    if (!byProvider) {
      logWarn(
        `recommendedModel: no recommendations registered for purpose '${purpose}'; returning null rather than borrowing another purpose's entry.`
      );
      return null;
    }

    const found = byProvider[providerId];
    if (!found) {
      logWarn(
        `recommendedModel: no default registered for provider '${providerId}' under purpose '${purpose}'; returning null rather than borrowing another provider's id.`
      );
      return null;
    }

    logDebug(
      `recommendedModel: ${purpose} on ${providerId} resolves ${found.modelId} (${found.round}, ${found.measured}).`
    );
    return found;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  logInfo(
    `MathPixModelRegistry ready (${Object.keys(RECOMMENDED_BY_PURPOSE).length} purposes).`
  );

  return {
    PURPOSES,
    PROVIDERS,
    RECOMMENDED_BY_PURPOSE,
    recommendedModel,
  };
})();

window.MathPixModelRegistry = MathPixModelRegistry;
