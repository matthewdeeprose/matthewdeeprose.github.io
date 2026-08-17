/**
 * @fileoverview MathPix Alt Text Provenance — source-stamp transition helper
 * @module MathPixAltTextProvenance
 * @version 1.0.0 (Lane C, parcel C-P1a — production helper)
 * @since Lane C alt-text provenance work
 *
 * @description
 * A dependency-free leaf module exposing the provenance-transition rules shared
 * by the alt-text write-sites. Each used to hard-code a `"user"` provenance
 * stamp; they now route the current stamp through a transition, so an
 * AI-authored value a human then touches is recorded as a reviewed or edited
 * source rather than being flattened to `"user"`.
 *
 * `nextSource` has THREE consumers, all round-trip parser sites: `parseAltText`,
 * `parseCaptions` and `parseAppendix`. [CORRECTED 11 August 2026 — this header
 * named four, including `_applyValuesToRegistry`, which has called
 * `editedSource` since Phase 3 parcel 4a. The edit-view save has not been a
 * `nextSource` consumer for some time.]
 *
 * Two write paths deliberately do NOT come through this module, and a reader
 * counting stamp sites from here alone will miss them:
 *   - the edit-view save (`_applyValuesToRegistry`) uses `editedSource`, which
 *     lands `"ai-edited"`;
 *   - the per-field accept control (`_acceptField`, Phase 3 parcel 8e) writes
 *     `"ai-reviewed"` as a literal after its own predicate, consulting neither
 *     function. That is the only route to `"ai-reviewed"` from the edit view.
 *
 * The transition (PF4 / LC-D4):
 *   - "ai-generated" -> "ai-reviewed"   (an AI draft edited by a human)
 *   - "ai-reviewed"  -> "ai-reviewed"   (already human-reviewed; stays put)
 *   - "user"         -> "user"          (human-authored; unchanged)
 *   - "original"     -> "user"          (original-from-source, now hand-edited)
 *   - null           -> "user"          (no prior stamp; a human edit)
 *   - anything else, including undefined -> "user"  (defensive default)
 *
 * This module references NO other window global and reads ONLY its argument.
 *
 * @see mathpix-scripts/docs/alt-text/lane-c-implementation-plan.md — PF4 / LC-D4
 * @see mathpix-image-registry.js — VALID_*_SOURCES allow-lists (accept the AI sources)
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
      console.error(`[AltTextProvenance] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextProvenance] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextProvenance] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextProvenance] ${message}`, ...args);
  }

  // ============================================================================
  // PUBLIC: nextSource
  // ============================================================================

  /**
   * Map a field's current provenance stamp to the stamp that should be written
   * when a human edit lands on that field. Implements the PF4 / LC-D4 rule.
   *
   * An AI-generated value that a human edits becomes "ai-reviewed"; an already
   * reviewed value stays "ai-reviewed"; every other state (user, original,
   * null, or anything unexpected) resolves to "user". The function reads only
   * its argument and NEVER returns undefined.
   *
   * @param {string|null|undefined} currentSource - The field's existing source
   *   stamp (e.g. `entry.altTextSource`), or null/undefined when unset.
   * @returns {string} The provenance stamp to write — one of "ai-reviewed" or
   *   "user".
   */
  function nextSource(currentSource) {
    let result;
    switch (currentSource) {
      case "ai-generated":
        result = "ai-reviewed";
        break;
      case "ai-reviewed":
        result = "ai-reviewed";
        break;
      default:
        // "user", "original", null, undefined, and any unexpected value all
        // resolve to a human-authored stamp. Defensive default — never undefined.
        result = "user";
        break;
    }
    logDebug(`nextSource("${currentSource}") -> "${result}"`);
    return result;
  }

  // ============================================================================
  // PUBLIC: editedSource
  // ============================================================================

  /**
   * Map a field's current provenance stamp to the stamp written when a human
   * edits that field in the edit-view save (Phase 3 parcel 4a). This differs
   * from `nextSource`: a human edit of a machine value (ai-generated or
   * algo-generated) or of an already-reviewed value now records "ai-edited" —
   * an explicit human edit — rather than "ai-reviewed". The "ai-reviewed" stamp
   * is reserved for the future accept-unchanged review checkbox, and is still
   * produced by the three round-trip parser sites via `nextSource`.
   *
   * Every other state (user, original, null, or anything unexpected) resolves
   * to "user", matching `nextSource`'s default. Reads only its argument and
   * NEVER returns undefined.
   *
   * @param {string|null|undefined} currentSource - The field's existing source
   *   stamp (e.g. `entry.altTextSource`), or null/undefined when unset.
   * @returns {string} The provenance stamp to write — one of "ai-edited" or
   *   "user".
   */
  function editedSource(currentSource) {
    let result;
    switch (currentSource) {
      case "ai-generated":
      case "algo-generated":
      case "ai-reviewed":
      case "ai-edited":
        // A human edit of a machine or reviewed value is a human edit.
        result = "ai-edited";
        break;
      default:
        // "user", "original", null, undefined, and anything unexpected: a
        // plain human-authored stamp, matching nextSource's default.
        result = "user";
        break;
    }
    logDebug(`editedSource("${currentSource}") -> "${result}"`);
    return result;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixAltTextProvenance = {
    nextSource,
    editedSource,
  };
})();
