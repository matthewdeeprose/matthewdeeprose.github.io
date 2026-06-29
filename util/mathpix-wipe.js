/**
 * mathpix-wipe.js
 *
 * A no-build, dev-only console helper to wipe MathPix local-storage data to a
 * genuinely clean slate during testing. Paste into DevTools and call
 * `mathpixWipe()`. It is NOT wired into tools.html and is NOT a production
 * module — it is a testing aid, the same shape as the workflow tracer.
 *
 * It clears three independent storage families that the app keeps separate:
 *   1. The live editor draft        — the single "mathpix-mmd-session" key.
 *   2. The saved resume snapshots    — every "mathpix-resume-session-*" key.
 *   3. The Context-tab settings      — "mathpix-context-current" and
 *                                      "mathpix-context-current-source".
 *
 * By default it wipes all three and reports exactly what it removed. You can
 * scope it to one or more families, do a dry run, or include EVERY mathpix-*
 * key for a total reset.
 *
 * Usage:
 *   mathpixWipe();                              // wipe the three families, report
 *   mathpixWipe({ dryRun: true });              // list what WOULD be removed, remove nothing
 *   mathpixWipe({ families: ['resume'] });      // only the resume snapshots
 *   mathpixWipe({ keepContext: true });         // wipe draft + resume, keep Context settings
 *   mathpixWipe({ allMathpix: true });          // every localStorage key starting "mathpix"
 *   mathpixWipe.inspect();                       // show current mathpix-* keys + sizes, remove nothing
 *
 * Reload the page after wiping for a clean session.
 *
 * NOTE ON LOGGING: follows the IIFE level/flag shape from the project Logging
 * Standards (ERROR, WARN, INFO, DEBUG; default WARN; ENABLE_ALL_LOGGING /
 * DISABLE_ALL_LOGGING), British spelling throughout.
 */
const mathpixWipe = (function () {
  "use strict";

  // --- Logging (CLAUDE.md IIFE pattern) ------------------------------------
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[mathpixWipe]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[mathpixWipe]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[mathpixWipe]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[mathpixWipe]", message, ...args);
  }

  // --- Key families (grounded from the storage survey) ---------------------
  // The live editor draft: one shared key, holds the current document plus
  // undo/redo history. (mathpix-mmd-editor-persistence.js STORAGE_KEY.)
  const DRAFT_KEY = "mathpix-mmd-session";

  // The saved resume snapshots: one key per save, per ZIP. Recovery reads these
  // on a ZIP reload. (session-restorer-confidence.js writes them; the prefix is
  // matched, not a single literal.)
  const RESUME_PREFIX = "mathpix-resume-session";

  // The Context-tab settings: audience/subject metadata used to improve AI
  // descriptions. (Stage 9 mathpix-context-current + its companion source key.)
  const CONTEXT_KEYS = ["mathpix-context-current", "mathpix-context-current-source"];

  const FAMILY_NAMES = ["draft", "resume", "context"];

  // --- Helpers -------------------------------------------------------------
  function safeKeys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      logError("localStorage is not accessible", error);
      return null;
    }
  }

  function sizeOf(key) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? 0 : value.length;
    } catch (error) {
      return 0;
    }
  }

  // Decide which keys belong to which family, from the live localStorage.
  function classify(allMathpix) {
    const keys = safeKeys();
    if (keys === null) return null;

    const buckets = { draft: [], resume: [], context: [], other: [] };

    keys.forEach((key) => {
      if (key === DRAFT_KEY) {
        buckets.draft.push(key);
      } else if (key.indexOf(RESUME_PREFIX) === 0) {
        buckets.resume.push(key);
      } else if (CONTEXT_KEYS.indexOf(key) !== -1) {
        buckets.context.push(key);
      } else if (allMathpix && key.indexOf("mathpix") === 0) {
        // Only swept when the caller explicitly opts into allMathpix.
        buckets.other.push(key);
      }
    });

    return buckets;
  }

  // --- Public: inspect (read-only) -----------------------------------------
  function inspect() {
    const buckets = classify(true);
    if (buckets === null) return null;

    const rows = [];
    FAMILY_NAMES.concat(["other"]).forEach((family) => {
      buckets[family].forEach((key) => {
        rows.push({ family, key, chars: sizeOf(key) });
      });
    });

    if (rows.length === 0) {
      logWarn("No MathPix keys found in localStorage — already clean.");
    } else {
      // console.table is a console method, fine in a dev helper.
      console.table(rows);
    }
    logInfo(`inspect: ${rows.length} mathpix-related key(s) present.`);
    return rows;
  }

  // --- Public: wipe --------------------------------------------------------
  function wipe(options) {
    const opts = options || {};
    const dryRun = opts.dryRun === true;
    const allMathpix = opts.allMathpix === true;
    const keepContext = opts.keepContext === true;

    // Resolve which families to act on.
    let families;
    if (Array.isArray(opts.families) && opts.families.length > 0) {
      families = opts.families.filter((f) => FAMILY_NAMES.indexOf(f) !== -1);
      const unknown = opts.families.filter((f) => FAMILY_NAMES.indexOf(f) === -1);
      if (unknown.length) {
        logWarn(`Ignoring unknown family name(s): ${unknown.join(", ")}. Valid: ${FAMILY_NAMES.join(", ")}.`);
      }
    } else {
      families = FAMILY_NAMES.slice();
    }
    if (keepContext) {
      families = families.filter((f) => f !== "context");
    }
    // allMathpix adds the catch-all "other" bucket on top of the chosen families.
    if (allMathpix) {
      families = families.concat(["other"]);
    }

    const buckets = classify(allMathpix);
    if (buckets === null) {
      logError("Aborting: localStorage unavailable.");
      return null;
    }

    // Gather the target keys, de-duplicated, in a stable family order.
    const targets = [];
    families.forEach((family) => {
      (buckets[family] || []).forEach((key) => {
        if (targets.indexOf(key) === -1) targets.push(key);
      });
    });

    if (targets.length === 0) {
      logWarn("Nothing to wipe — no matching keys present. Already clean.");
      return { removed: [], dryRun, total: 0 };
    }

    const report = targets.map((key) => ({
      key,
      family: families.find((f) => (buckets[f] || []).indexOf(key) !== -1),
      chars: sizeOf(key),
    }));

    if (dryRun) {
      logWarn(`DRY RUN — would remove ${targets.length} key(s). Nothing was deleted.`);
      console.table(report);
      return { removed: [], wouldRemove: report, dryRun: true, total: targets.length };
    }

    const removed = [];
    const failed = [];
    targets.forEach((key) => {
      try {
        localStorage.removeItem(key);
        removed.push(key);
      } catch (error) {
        failed.push(key);
        logError(`Failed to remove "${key}"`, error);
      }
    });

    console.table(report);
    if (failed.length) {
      logWarn(`Removed ${removed.length} key(s); ${failed.length} failed (see errors above).`);
    } else {
      logWarn(`Removed ${removed.length} key(s). Reload the page for a clean session.`);
    }

    return { removed, failed, dryRun: false, total: removed.length };
  }

  logInfo("mathpixWipe ready. Call mathpixWipe() to clear, or mathpixWipe.inspect() to look first.");

  // The callable default is wipe(); attach inspect as a property.
  wipe.inspect = inspect;
  return wipe;
})();

// Expose for console use.
window.mathpixWipe = mathpixWipe;
