/**
 * @file alt-text-generation-contract.js
 * @module MathPixAltTextGenerationContract
 * @description
 * Phase 2 Stage 2, Parcel 2.1 — the ONE generation-source result contract
 * (S2F-D4) and the single `finalise` boundary function that normalises a raw
 * cloud / local / human generation result into it.
 *
 * ── The contract (S2F-D4) ──────────────────────────────────────────────────
 * Every generation source satisfies a single result shape:
 *
 *   { text, status, duration, model, source, reasoning?, error? }
 *
 *   • status  — exactly "success" or "error"  (see STATUS)
 *   • source  — the generation origin: "cloud-llm" | "local-vlm" | "human"
 *               (see SOURCE). Distinct from the registry provenance *Source
 *               that records field ownership.
 *   • error   — present IFF status === "error", carrying the failure reason;
 *               ABSENT on success. This is the F1 hardening: without the slot
 *               the finalise path would drop the reason both real paths
 *               produce (the local path returns an `error` field on its catch;
 *               the cloud adapter sets it from the caught error's message),
 *               leaving the error UI nothing to show.
 *
 * Each adapter normalises into this shape at the boundary:
 *   • cloud ("cloud-llm") — raw { text, reasoning }; the adapter derives
 *     `status` from its own try/catch and passes `reasoning` through, plus
 *     `text`/`duration`/`model` (and `error` on failure) from the caller.
 *   • local ("local-vlm") — raw { text, status, duration, model }; `status`,
 *     `duration`, `model` pass through and `reasoning` is set to null.
 *   • human ("human") — raw { text }; a human entry is always a success, with
 *     `reasoning` null and `duration`/`model` at their null defaults.
 *
 * ── One path, not three ────────────────────────────────────────────────────
 * A single `finalise(source, raw)` serves cloud, local, and human, replacing
 * the two duplicated after-the-fact normalisation sites in Image Describer's
 * controller. The per-source differences (reasoning passthrough vs null,
 * status origin, defaults) are small branches inside the one path; the
 * invariants — status vocabulary, source vocabulary, and error-present-iff-
 * error — are enforced once, in the shared tail.
 *
 * ── Scope boundary (per the plan's §2 residual) ────────────────────────────
 * finalise takes NORMALISED inputs and enforces the contract. Parcel 2.3
 * wires WHERE the cloud adapter's `duration`, `model`, and `error` come from
 * (and the local path's `error`), binding to the real adapter internals. This
 * file does not read `azure-openai-responses.js`, `openrouter-embed`, or any
 * local-generation internals.
 *
 * Pure: no DOM, no network, no global reached at runtime. Attaches to
 * `window` at definition time only, matching the 1.1 sibling.
 *
 * @see mathpix-scripts/ai-alt-text/alt-text-progress.js (1.1 sibling — IIFE-global shape)
 * @see mathpix-scripts/docs/alt-text/phase-2-stage-2-feature-replan-planning-decisions.md (S2F-D4, F1)
 */

const MathPixAltTextGenerationContract = (function () {
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
      console.error(`[AltTextContract] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextContract] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextContract] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextContract] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Frozen vocabulary — callers and the (2.2) guard rows reference these
  // constants rather than string literals.
  // ---------------------------------------------------------------------------

  /** The two allowed `status` values. */
  const STATUS = Object.freeze({
    SUCCESS: "success",
    ERROR: "error",
  });

  /** The three allowed `source` values (generation origin). */
  const SOURCE = Object.freeze({
    CLOUD: "cloud-llm",
    LOCAL: "local-vlm",
    HUMAN: "human",
  });

  /** Value lists for membership checks (frozen, order not significant). */
  const STATUS_VALUES = Object.freeze([STATUS.SUCCESS, STATUS.ERROR]);
  const SOURCE_VALUES = Object.freeze([SOURCE.CLOUD, SOURCE.LOCAL, SOURCE.HUMAN]);

  /** Fallback error text when status is "error" but no reason was supplied. */
  const DEFAULT_ERROR_MESSAGE = "Unknown generation error";

  /**
   * @typedef {Object} GenerationResult
   * @property {string|null} text — the raw generation text (may be null/empty on error).
   * @property {"success"|"error"} status — terminal status of the generation.
   * @property {number|null} duration — elapsed generation time, or null when unknown.
   * @property {string|null} model — the model id that produced the result, or null.
   * @property {"cloud-llm"|"local-vlm"|"human"} source — generation origin.
   * @property {string|null} reasoning — reasoning trace (cloud passthrough), else null.
   * @property {string} [error] — failure reason; PRESENT IFF status === "error", ABSENT on success.
   */

  // ---------------------------------------------------------------------------
  // FINALISE — the one boundary function (S2F-D4)
  // ---------------------------------------------------------------------------

  /**
   * Normalise a raw cloud / local / human generation result into the single
   * {@link GenerationResult} contract, enforcing every invariant. One path
   * serves all three sources; it keys on `source` only for the fields that
   * genuinely differ (reasoning handling, status origin, defaults) and
   * enforces the shared invariants once.
   *
   * Lossless: every raw field that belongs in the contract survives unchanged.
   * `undefined`/absent numeric or model fields default to `null` (via `??`,
   * so a genuine `0` duration is preserved).
   *
   * @param {"cloud-llm"|"local-vlm"|"human"} source — generation origin (see SOURCE).
   * @param {Object} [raw] — the source's raw shape:
   *   cloud  { text, reasoning, status, duration, model, error? }
   *   local  { text, status, duration, model, error? }
   *   human  { text }
   * @returns {GenerationResult}
   */
  function finalise(source, raw) {
    const input = raw || {};

    // -- source guard: must be one of the three named values ------------------
    if (!SOURCE_VALUES.includes(source)) {
      logWarn(
        `Unrecognised generation source '${String(source)}' — expected one of ${SOURCE_VALUES.join(
          ", ",
        )}`,
      );
    }

    // -- status: a human entry is always a success; cloud/local supply theirs -
    let status = source === SOURCE.HUMAN ? STATUS.SUCCESS : input.status;
    if (status !== STATUS.SUCCESS && status !== STATUS.ERROR) {
      // Coerce loudly rather than pass an unrecognised status through. An
      // error-coercion keeps the F1 invariant meaningful: an unclassifiable
      // result is treated as a failure and carries a reason.
      logWarn(
        `Unrecognised status '${String(status)}' for source '${String(
          source,
        )}' — coercing to '${STATUS.ERROR}'`,
      );
      status = STATUS.ERROR;
    }

    // -- reasoning: cloud passes it through; every other source is null -------
    const reasoning =
      source === SOURCE.CLOUD ? input.reasoning ?? null : null;

    // -- assemble the always-present contract fields (lossless) ---------------
    /** @type {GenerationResult} */
    const result = {
      text: input.text ?? null,
      status,
      duration: input.duration ?? null,
      model: input.model ?? null,
      source,
      reasoning,
    };

    // -- error present IFF status === "error" (F1) ----------------------------
    if (status === STATUS.ERROR) {
      const reason = input.error;
      result.error =
        reason != null && reason !== "" ? reason : DEFAULT_ERROR_MESSAGE;
    }
    // On success `error` is never assigned — absent, never a stale/empty slot.

    logDebug("finalised generation result", {
      source: result.source,
      status: result.status,
      hasError: Object.prototype.hasOwnProperty.call(result, "error"),
    });

    return result;
  }

  logInfo("MathPixAltTextGenerationContract ready (one finalise path)");

  return {
    finalise,
    STATUS,
    SOURCE,
    STATUS_VALUES,
    SOURCE_VALUES,
    DEFAULT_ERROR_MESSAGE,
  };
})();

window.MathPixAltTextGenerationContract = MathPixAltTextGenerationContract;
