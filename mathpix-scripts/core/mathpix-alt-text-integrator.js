/**
 * @fileoverview MathPix Alt Text Integrator — Stage 3 alt-text primitives,
 *   orchestrators, and (in 3.B) integrated pipelines.
 * @module MathPixAltTextIntegrator
 * @requires MathPixImageRegistry (consumed at call time; not imported)
 * @requires MathPixAltTextMMDSerialiser (helpers read lazily via window namespace)
 * @version 1.0.0 (Stage 3.A — primitives + inline smoke suite)
 * @since Image Manager Alt Text plan, Stage 3
 *
 * @description
 * Stage 3.A surface: writeAltText, writeAltTextForAll, parseAltText. Stage 3.B
 * will extend this file with applyRegistryToMMD and reconcileMMDIntoRegistry;
 * Stage 3.C will extract the test suite to a sibling file.
 *
 * Q-locks (see stage-3-planning-decisions.md for full rationale):
 *   - Q2: empty alt for entries flagged with the decorative metadata; alt is
 *     rewritten in whichever syntax shape (markdown vs includegraphics) is
 *     currently present. No structural changes (no wrap, no unwrap).
 *   - Q3: clone-discipline — orchestrators fetch registry.getAllImages() fresh
 *     inside their bodies; no `entries` parameter on the public surface.
 *   - Q4: parseAltText is defensive; empty MMD does not blank populated stored
 *     altText. Source string is "user".
 *   - Q5: parseAltText must not read or touch entry.decorative. The function
 *     body and any helper it calls intentionally do not contain the substring
 *     "decorative".
 *   - Q6: Choice C — new file, helpers consumed lazily from the serialiser.
 *
 * The decorative metadata flag is mentioned in this file-level JSDoc and read
 * once inside writeAltText() (computing the targetAlt). It is intentionally
 * absent from parseAltText() and from every private helper, per Q5.
 *
 * @see mathpix-scripts/docs/alt-text/image-manager-alt-text-build-plan.md — Stage 3 spec
 * @see mathpix-scripts/docs/alt-text/stage-3-planning-decisions.md — Q1–Q7 locks
 * @see mathpix-alt-text-mmd-serialiser.js — Stage 1+2 captions/appendix; helpers consumed here
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
      console.error(`[AltTextIntegrator] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextIntegrator] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextIntegrator] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextIntegrator] ${message}`, ...args);
  }

  // ============================================================================
  // SERIALISER NAMESPACE ACCESS
  // ============================================================================

  // Lazy read so module load order is forgiving. Callers in 3.A always run
  // after `tools.html` has registered the serialiser namespace; this accessor
  // exists so a misordered load fails loudly at first call rather than at
  // module-load with a confusing "undefined is not an object" trace.
  const S = () => window.MathPixAltTextMMDSerialiser;

  // ============================================================================
  // ENUM
  // ============================================================================

  /**
   * Frozen set of action keys emitted by `parseAltText`. UPPER_SNAKE keys
   * with kebab-case values, mirroring `APPENDIX_ACTIONS` (Stage 2.B precedent).
   * Exposed on the public namespace so callers (and tests) can switch on
   * action keys without stringly-typed drift.
   */
  const PARSE_ALT_TEXT_ACTIONS = Object.freeze({
    UPDATED: "updated",
    NO_OP: "no-op",
    DEFENSIVE_SKIP: "defensive-skip",
    IMAGE_NOT_FOUND: "image-not-found",
  });

  // ============================================================================
  // PRIVATE HELPERS — SYNTAX-AWARE ALT EXTRACTION + REWRITE
  // ============================================================================

  /**
   * Extract the current alt text from `line`, given the figure-env context.
   *
   * - `ctx.inFigure === true`: parse the `alt={...}` slot inside the
   *   `\includegraphics` command's options. LaTeX-escapes are decoded via
   *   `unescapeAltFromLatex`. Returns `""` when the includegraphics command
   *   has no alt slot; returns `null` only when the line has no
   *   `\includegraphics` at all (malformed).
   * - `ctx.inFigure === false`: parse the alt portion of a markdown
   *   `![alt](url)`. Markdown alt is not LaTeX-escaped, so it is returned
   *   verbatim. Returns `null` when no markdown image matches.
   *
   * Matches the first image on the line. This helper intentionally does not
   * reference any metadata flag on a registry entry.
   *
   * @private
   * @param {string} line
   * @param {Object} ctx - Output of `S().detectFigureContext`.
   * @returns {string|null}
   */
  function _extractCurrentAlt(line, ctx) {
    if (typeof line !== "string") return null;
    if (ctx && ctx.inFigure) {
      const igRe = /\\includegraphics\s*(\[([^\]]*)\])?\s*\{([^}]+)\}/;
      const m = igRe.exec(line);
      if (!m) return null;
      const optionsStr = m[2] || "";
      const altRe = /(?:^|,)\s*alt\s*=\s*\{/;
      const altMatch = altRe.exec(optionsStr);
      if (!altMatch) return "";
      const braceStart = altMatch.index + altMatch[0].length - 1;
      const braceEnd = S().findMatchingBrace(optionsStr, braceStart);
      if (braceEnd === -1) {
        logWarn(
          "_extractCurrentAlt(): unbalanced braces in alt={...} options — treating as malformed",
        );
        return null;
      }
      const altRaw = optionsStr.substring(braceStart + 1, braceEnd);
      return S().unescapeAltFromLatex(altRaw);
    }

    const mdRe = /!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)/;
    const m = mdRe.exec(line);
    if (!m) return null;
    return m[1];
  }

  /**
   * Rewrite the alt portion of `line` to `targetAlt`, preserving everything
   * else (figure env, url, max-width option, surrounding prose).
   *
   * For `\includegraphics`: locate `alt={...}` inside the options string,
   * escape `targetAlt` via `escapeAltForLatex`, splice it in. When the
   * includegraphics command has no alt slot AND `targetAlt` is non-empty,
   * return `{ ok: false }` — Stage 3.A scope limit (we do not synthesise an
   * options block; that is downstream work).
   *
   * For bare markdown `![X](url)`: regex-replace the first image on the line.
   *
   * @private
   * @param {string} line
   * @param {Object} ctx
   * @param {string} targetAlt
   * @returns {{ ok: boolean, newLine?: string }}
   */
  function _rewriteAlt(line, ctx, targetAlt) {
    if (ctx && ctx.inFigure) {
      const igRe = /\\includegraphics\s*(\[([^\]]*)\])?\s*\{([^}]+)\}/;
      const m = igRe.exec(line);
      if (!m) return { ok: false };
      const optionsStr = m[2] || "";
      const url = m[3];
      const altRe = /(?:^|,)\s*alt\s*=\s*\{/;
      const altMatch = altRe.exec(optionsStr);
      if (!altMatch) {
        if (targetAlt === "") {
          // No alt slot and target empty → already empty; leave untouched.
          return { ok: true, newLine: line, newReference: null };
        }
        logWarn(
          "_rewriteAlt(): includegraphics has no alt={} slot — Stage 3.A does not synthesise one",
        );
        return { ok: false };
      }
      const braceStart = altMatch.index + altMatch[0].length - 1;
      const braceEnd = S().findMatchingBrace(optionsStr, braceStart);
      if (braceEnd === -1) {
        logWarn("_rewriteAlt(): unbalanced braces in alt={...} options — refusing rewrite");
        return { ok: false };
      }
      const escapedTarget = S().escapeAltForLatex(targetAlt);
      const newOptionsStr =
        optionsStr.substring(0, braceStart + 1) +
        escapedTarget +
        optionsStr.substring(braceEnd);
      const newCommand = `\\includegraphics[${newOptionsStr}]{${url}}`;
      const before = line.substring(0, m.index);
      const after = line.substring(m.index + m[0].length);
      return {
        ok: true,
        newLine: before + newCommand + after,
        newReference: newCommand,
        newSyntax: "includegraphics",
      };
    }

    const mdRe = /!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)/;
    const m = mdRe.exec(line);
    if (!m) return { ok: false };
    const url = m[2];
    const replacement = `![${targetAlt}](${url})`;
    const before = line.substring(0, m.index);
    const after = line.substring(m.index + m[0].length);
    return {
      ok: true,
      newLine: before + replacement + after,
      newReference: replacement,
      newSyntax: "markdown",
    };
  }

  // ============================================================================
  // PUBLIC: writeAltText
  // ============================================================================

  /**
   * Apply a single entry's alt-text state to the MMD. The target alt is
   * computed from registry truth: when the entry is flagged decorative, the
   * target is empty; otherwise it is the entry's stored altText. The chosen
   * target is then written into whichever syntax shape (markdown or
   * includegraphics) currently surrounds the image. Structure (figure env,
   * caption, captionsetup, max-width) is preserved verbatim.
   *
   * `opts` is accepted for symmetry with `writeCaption`; in Stage 3.B it is
   * still unused. `registry` (also reserved at 3.A) is now consumed (Stage 3.B):
   * after a successful rewrite, `entry.mmdReference` and `entry.syntax` are
   * refreshed via `registry.updateImageReference`. Without this, a subsequent
   * `findImage` cannot match: the original mmdReference no longer appears in
   * the MMD, and the URL fallback consults `entry.originalSyntax` — which
   * disagrees with the post-wrap shape for markdown-origin entries that
   * `writeAllCaptions` wrapped earlier in the same pipeline.
   *
   * @param {string} mmd
   * @param {Object} entry - Registry entry (read-only).
   * @param {Object} [opts] - Reserved.
   * @param {Object} [registry] - When provided, mmdReference + syntax are
   *   refreshed after a transforming rewrite.
   * @returns {{ mmd: string, transformed: boolean, action: string }}
   */
  function writeAltText(mmd, entry, opts, registry) {
    if (typeof mmd !== "string" || !entry) {
      return { mmd: mmd || "", transformed: false, action: "no-op" };
    }

    // Q2 lock — decorative entries always emit empty alt.
    const targetAlt = entry.decorative
      ? ""
      : typeof entry.altText === "string"
        ? entry.altText
        : "";

    const loc = S().findImage(mmd, entry);
    if (!loc.found) {
      logWarn(`writeAltText(): image not found for entry ${entry.id || "?"}`);
      return { mmd, transformed: false, action: "image-not-found" };
    }

    const lines = mmd.split("\n");
    const ctx = S().detectFigureContext(lines, loc.lineIndex);
    const currentAlt = _extractCurrentAlt(lines[loc.lineIndex], ctx);
    if (currentAlt === null) {
      logWarn(
        `writeAltText(): could not parse current alt for entry ${entry.id || "?"} — line malformed`,
      );
      return { mmd, transformed: false, action: "no-op" };
    }

    if (currentAlt === targetAlt) {
      return { mmd, transformed: false, action: "no-op" };
    }

    const r = _rewriteAlt(lines[loc.lineIndex], ctx, targetAlt);
    if (!r.ok) {
      return { mmd, transformed: false, action: "no-op" };
    }

    lines[loc.lineIndex] = r.newLine;
    if (
      registry &&
      typeof registry.updateImageReference === "function" &&
      entry.id &&
      r.newReference
    ) {
      registry.updateImageReference(entry.id, r.newReference, r.newSyntax);
    }
    return { mmd: lines.join("\n"), transformed: true, action: "updated" };
  }

  // ============================================================================
  // PUBLIC: writeAltTextForAll
  // ============================================================================

  /**
   * Apply every registry entry's alt-text state to the MMD in turn. Mirrors
   * `writeAllCaptions`. Fetches `registry.getAllImages()` fresh inside the
   * function (Q3 clone-discipline lock — no `entries` parameter).
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @returns {{ mmd: string, transformations: number, actions: Object }}
   */
  function writeAltTextForAll(mmd, registry) {
    if (typeof mmd !== "string") {
      return { mmd: mmd || "", transformations: 0, actions: {} };
    }
    if (!registry || typeof registry.getAllImages !== "function") {
      logError("writeAltTextForAll(): registry is missing getAllImages()");
      return { mmd, transformations: 0, actions: {} };
    }

    let current = mmd;
    let transformations = 0;
    const actions = {};
    for (const entry of registry.getAllImages()) {
      const r = writeAltText(current, entry, undefined, registry);
      current = r.mmd;
      if (r.transformed) transformations++;
      actions[r.action] = (actions[r.action] || 0) + 1;
    }
    logInfo(
      `writeAltTextForAll(): ${transformations} transformations across ${Object.values(
        actions,
      ).reduce((a, b) => a + b, 0)} entries`,
    );
    return { mmd: current, transformations, actions };
  }

  // ============================================================================
  // PUBLIC: parseAltText
  // ============================================================================

  /**
   * Read alt text from the MMD and update each matching registry entry's
   * altText field. MMD wins on content, except when the MMD's alt portion is
   * empty AND the stored altText is non-empty — that combination is treated
   * as a defensive skip rather than a deletion (Q4 lock; mirrors
   * `parseAppendix` defensiveness).
   *
   * This function intentionally does not read the entry's metadata flag for
   * marking-as-not-meaningful imagery (Q5 lock). Such state is set via the UI
   * only; the MMD has zero influence over it.
   *
   * Fetches `registry.getAllImages()` fresh (Q3). Source string is "user"
   * (Q4 — consistent with `parseCaptions` / `parseAppendix`).
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @returns {{ updated: number, actions: Object }}
   */
  function parseAltText(mmd, registry) {
    let updated = 0;
    const actions = {};

    if (typeof mmd !== "string") {
      logError("parseAltText(): mmd must be a string");
      return { updated, actions };
    }
    if (
      !registry ||
      typeof registry.updateAltText !== "function" ||
      typeof registry.getAllImages !== "function"
    ) {
      logError(
        "parseAltText(): registry is missing updateAltText/getAllImages",
      );
      return { updated, actions };
    }

    const entries = registry.getAllImages();
    const lines = mmd.split("\n");

    for (const entry of entries) {
      const loc = S().findImage(mmd, entry);
      if (!loc.found) {
        actions[PARSE_ALT_TEXT_ACTIONS.IMAGE_NOT_FOUND] =
          (actions[PARSE_ALT_TEXT_ACTIONS.IMAGE_NOT_FOUND] || 0) + 1;
        continue;
      }
      const ctx = S().detectFigureContext(lines, loc.lineIndex);
      const currentAlt = _extractCurrentAlt(lines[loc.lineIndex], ctx);
      if (currentAlt === null) {
        logWarn(
          `parseAltText(): could not parse current alt for entry ${entry.id || "?"} — line malformed`,
        );
        actions[PARSE_ALT_TEXT_ACTIONS.IMAGE_NOT_FOUND] =
          (actions[PARSE_ALT_TEXT_ACTIONS.IMAGE_NOT_FOUND] || 0) + 1;
        continue;
      }
      const storedAlt = typeof entry.altText === "string" ? entry.altText : "";

      if (currentAlt === "" && storedAlt !== "") {
        actions[PARSE_ALT_TEXT_ACTIONS.DEFENSIVE_SKIP] =
          (actions[PARSE_ALT_TEXT_ACTIONS.DEFENSIVE_SKIP] || 0) + 1;
        continue;
      }
      if (currentAlt === storedAlt) {
        actions[PARSE_ALT_TEXT_ACTIONS.NO_OP] =
          (actions[PARSE_ALT_TEXT_ACTIONS.NO_OP] || 0) + 1;
        continue;
      }
      const ok = registry.updateAltText(entry.id, currentAlt, "user");
      if (ok) {
        updated++;
        actions[PARSE_ALT_TEXT_ACTIONS.UPDATED] =
          (actions[PARSE_ALT_TEXT_ACTIONS.UPDATED] || 0) + 1;
      } else {
        logWarn(
          `parseAltText(): updateAltText returned false for entry ${entry.id || "?"}`,
        );
      }
    }
    logInfo(
      `parseAltText(): updated=${updated} entries=${entries.length}`,
    );
    return { updated, actions };
  }

  // ============================================================================
  // PUBLIC: applyRegistryToMMD (Stage 3.B forward pipeline)
  // ============================================================================

  /**
   * Apply every registry entry's state to the MMD in a single integrated pass.
   * Composes the three forward primitives in Q3 order: captions (structural
   * wrap/unwrap) → alt text (writes into final structure) → appendix (long
   * descriptions at the trailing end).
   *
   * Critical discipline (Q3 lock): this function does NOT call
   * `registry.getAllImages()` itself, nor does it thread a shared `entries`
   * array between sub-writers. Each sub-writer fetches fresh from the registry
   * — so a structural mutation by `writeAllCaptions` (refreshed `mmdReference`
   * and `syntax`) is observed by `writeAltTextForAll` on its very next read.
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @returns {{
   *   mmd: string,
   *   captions: { mmd: string, transformations: number, actions: Object },
   *   altText: { mmd: string, transformations: number, actions: Object },
   *   appendix: { mmd: string, transformations: number, actions: Object }
   * }}
   */
  function applyRegistryToMMD(mmd, registry) {
    if (typeof mmd !== "string") {
      logError("applyRegistryToMMD(): mmd must be a string");
      return {
        mmd: mmd || "",
        captions: null,
        altText: null,
        appendix: null,
      };
    }
    if (!registry || typeof registry.getAllImages !== "function") {
      logError("applyRegistryToMMD(): registry is missing getAllImages()");
      return { mmd, captions: null, altText: null, appendix: null };
    }

    const r1 = S().writeAllCaptions(mmd, registry);
    const r2 = writeAltTextForAll(r1.mmd, registry);
    const r3 = S().writeAppendix(r2.mmd, registry);

    logInfo(
      `applyRegistryToMMD(): captions=${r1.transformations} altText=${r2.transformations} appendix=${r3.transformations}`,
    );
    return {
      mmd: r3.mmd,
      captions: r1,
      altText: r2,
      appendix: r3,
    };
  }

  // ============================================================================
  // PUBLIC: reconcileMMDIntoRegistry (Stage 3.B reverse pipeline)
  // ============================================================================

  /**
   * Read every supported edit out of the MMD and update the registry in place.
   * Mirror of `applyRegistryToMMD` — composes the three reverse primitives in
   * symmetric order: captions → alt text → appendix. No `mmd` field on the
   * return, because the input MMD is consulted only as a source; the registry
   * is the sink.
   *
   * Q4 defensiveness rules and Q5 decorative-flag preservation are enforced by
   * the primitives themselves; this composition layer adds no further policy.
   * Q4 conflict scenarios (decorative=true + populated alt in MMD) leave both
   * values on the entry for Stage 5 UI to resolve — Option A.
   *
   * Same Q3 discipline applies: no shared `entries` array, no
   * `getAllImages()` call in this function body. Each sub-parser fetches the
   * registry fresh.
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @returns {{
   *   captions: { processed: number, updated: number, skipped: number, notFound: number },
   *   altText: { updated: number, actions: Object },
   *   appendix: { updated: number, actions: Object }
   * }}
   */
  function reconcileMMDIntoRegistry(mmd, registry) {
    if (typeof mmd !== "string") {
      logError("reconcileMMDIntoRegistry(): mmd must be a string");
      return { captions: null, altText: null, appendix: null };
    }
    if (!registry || typeof registry.getAllImages !== "function") {
      logError(
        "reconcileMMDIntoRegistry(): registry is missing getAllImages()",
      );
      return { captions: null, altText: null, appendix: null };
    }

    const r1 = S().parseCaptions(mmd, registry);
    const r2 = parseAltText(mmd, registry);
    const r3 = S().parseAppendix(mmd, registry);

    logInfo(
      `reconcileMMDIntoRegistry(): captions={updated:${r1.updated}, skipped:${r1.skipped}} altText=${r2.updated} appendix=${r3.updated}`,
    );
    return {
      captions: r1,
      altText: r2,
      appendix: r3,
    };
  }

  // ============================================================================
  // STAGE 3.A — INLINE SMOKE TESTS
  // ============================================================================

  /**
   * Stage 3.A smoke suite. Mirrors `runStage2aSmokeTests` structure verbatim —
   * preconditions check, inline `assert`, group headers, summary block.
   *
   * @returns {{ passed: number, failed: number, total: number, results: string[] }}
   */
  function runStage3aTests() {
    console.log(
      "=== MathPix Alt Text Integrator — Stage 3.A Smoke Suite ===\n",
    );

    if (typeof window.MathPixImageRegistry !== "function") {
      console.error(
        "MathPixImageRegistry not available — load the registry module first.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Registry not loaded"],
      };
    }
    if (!window.MathPixAltTextMMDSerialiser) {
      console.error(
        "MathPixAltTextMMDSerialiser not available — load the serialiser module first.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Serialiser not loaded"],
      };
    }
    if (!window.MathPixAltTextIntegrator) {
      console.error(
        "MathPixAltTextIntegrator not available — this module failed to register.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Integrator not loaded"],
      };
    }

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(name, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${name}`);
      } else {
        failed++;
        const msg = detail ? `${name} — ${detail}` : name;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    const Registry = window.MathPixImageRegistry;
    const I = window.MathPixAltTextIntegrator;

    // Helper: build a Stage-1-shaped figure env line block as a string.
    function figureBlock(url, altInside, captionText) {
      return (
        "\\begin{figure}\n" +
        `\\includegraphics[alt={${altInside}},max width=\\textwidth]{${url}}\n` +
        "\\captionsetup{labelformat=empty}\n" +
        `\\caption{${captionText}}\n` +
        "\\end{figure}"
      );
    }

    // ------------------------------------------------------------------------
    // 1. Module surface
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Module surface ---");
    {
      assert(
        "1: exposes writeAltText",
        typeof I.writeAltText === "function",
      );
      assert(
        "1: exposes writeAltTextForAll",
        typeof I.writeAltTextForAll === "function",
      );
      assert(
        "1: exposes parseAltText",
        typeof I.parseAltText === "function",
      );
      assert(
        "1: exposes PARSE_ALT_TEXT_ACTIONS",
        I.PARSE_ALT_TEXT_ACTIONS && typeof I.PARSE_ALT_TEXT_ACTIONS === "object",
      );
      assert(
        "1: PARSE_ALT_TEXT_ACTIONS is frozen",
        Object.isFrozen(I.PARSE_ALT_TEXT_ACTIONS),
      );
      assert(
        '1: PARSE_ALT_TEXT_ACTIONS.UPDATED === "updated"',
        I.PARSE_ALT_TEXT_ACTIONS.UPDATED === "updated",
      );
      assert(
        '1: PARSE_ALT_TEXT_ACTIONS.NO_OP === "no-op"',
        I.PARSE_ALT_TEXT_ACTIONS.NO_OP === "no-op",
      );
      assert(
        '1: PARSE_ALT_TEXT_ACTIONS.DEFENSIVE_SKIP === "defensive-skip"',
        I.PARSE_ALT_TEXT_ACTIONS.DEFENSIVE_SKIP === "defensive-skip",
      );
      assert(
        '1: PARSE_ALT_TEXT_ACTIONS.IMAGE_NOT_FOUND === "image-not-found"',
        I.PARSE_ALT_TEXT_ACTIONS.IMAGE_NOT_FOUND === "image-not-found",
      );
    }

    // ------------------------------------------------------------------------
    // 2. writeAltText — bare markdown — set alt
    // ------------------------------------------------------------------------
    console.log("\n--- 2. writeAltText — bare markdown — set alt ---");
    {
      const mmd =
        "Lead\n\n![Old](https://cdn.mathpix.com/a.png)\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "New", "user");
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("2: transformed === true", r.transformed === true);
      assert(
        '2: action === "updated"',
        r.action === "updated",
        `got "${r.action}"`,
      );
      assert(
        "2: output contains ![New](url)",
        r.mmd.includes("![New](https://cdn.mathpix.com/a.png)"),
      );
      assert(
        "2: output no longer contains ![Old]",
        !r.mmd.includes("![Old]"),
      );
    }

    // ------------------------------------------------------------------------
    // 3. writeAltText — bare markdown — clear alt
    // ------------------------------------------------------------------------
    console.log("\n--- 3. writeAltText — bare markdown — clear alt ---");
    {
      const mmd =
        "Body\n\n![Photo](https://cdn.mathpix.com/b.png)\n\nMore";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "", "user");
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("3: transformed === true", r.transformed === true);
      assert(
        "3: output contains ![](url)",
        r.mmd.includes("![](https://cdn.mathpix.com/b.png)"),
      );
    }

    // ------------------------------------------------------------------------
    // 4. writeAltText — bare markdown — decorative wins (Q2 edge case)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 4. writeAltText — bare markdown — decorative wins (Q2 edge) ---",
    );
    {
      const mmd =
        "Body\n\n![Photo](https://cdn.mathpix.com/c.png)\n\nMore";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "Photo", "user");
      reg.updateDecorative(id, true);
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("4: transformed === true", r.transformed === true);
      assert(
        "4: output contains ![](url) (empty alt, decorative wins)",
        r.mmd.includes("![](https://cdn.mathpix.com/c.png)"),
      );
      assert(
        '4: registry altText preserved as "Photo" (writeAltText is MMD-only)',
        reg.getImage(id).altText === "Photo",
      );
    }

    // ------------------------------------------------------------------------
    // 5. writeAltText — figure env — set alt
    // ------------------------------------------------------------------------
    console.log("\n--- 5. writeAltText — figure env — set alt ---");
    {
      const url = "https://cdn.mathpix.com/d.png";
      const mmd =
        "Lead\n\n" + figureBlock(url, "Old", "C") + "\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "New", "user");
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("5: transformed === true", r.transformed === true);
      assert(
        "5: output contains alt={New}",
        r.mmd.includes("alt={New}"),
      );
      assert(
        "5: captionsetup line preserved",
        r.mmd.includes("\\captionsetup{labelformat=empty}"),
      );
      assert(
        "5: caption line preserved",
        r.mmd.includes("\\caption{C}"),
      );
    }

    // ------------------------------------------------------------------------
    // 6. writeAltText — figure env — clear alt
    // ------------------------------------------------------------------------
    console.log("\n--- 6. writeAltText — figure env — clear alt ---");
    {
      const url = "https://cdn.mathpix.com/e.png";
      const mmd = "Lead\n\n" + figureBlock(url, "Photo", "C") + "\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "", "user");
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("6: transformed === true", r.transformed === true);
      assert(
        "6: output contains alt={}",
        r.mmd.includes("alt={}"),
      );
      assert(
        "6: caption line preserved",
        r.mmd.includes("\\caption{C}"),
      );
    }

    // ------------------------------------------------------------------------
    // 7. writeAltText — figure env — decorative wins
    // ------------------------------------------------------------------------
    console.log("\n--- 7. writeAltText — figure env — decorative wins ---");
    {
      const url = "https://cdn.mathpix.com/f.png";
      const mmd = "Lead\n\n" + figureBlock(url, "Photo", "C") + "\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "Photo", "user");
      reg.updateDecorative(id, true);
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("7: transformed === true", r.transformed === true);
      assert(
        "7: output contains alt={} (empty alt)",
        r.mmd.includes("alt={}"),
      );
      assert(
        "7: caption line preserved",
        r.mmd.includes("\\caption{C}"),
      );
    }

    // ------------------------------------------------------------------------
    // 8. writeAltText — no-op on match
    // ------------------------------------------------------------------------
    console.log("\n--- 8. writeAltText — no-op on match ---");
    {
      const mmd = "Body\n\n![Match](https://cdn.mathpix.com/g.png)\n\nMore";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "Match", "user");
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("8: transformed === false", r.transformed === false);
      assert(
        '8: action === "no-op"',
        r.action === "no-op",
        `got "${r.action}"`,
      );
      assert("8: output byte-identical to input", r.mmd === mmd);
    }

    // ------------------------------------------------------------------------
    // 9. writeAltText — image not found
    // ------------------------------------------------------------------------
    console.log("\n--- 9. writeAltText — image not found ---");
    {
      const mmd = "Body\n\n![X](https://cdn.mathpix.com/h.png)\n\nMore";
      const reg = new Registry();
      reg.buildFromMMD(
        "![X](https://cdn.mathpix.com/elsewhere.png)",
      );
      const id = reg.getAllImages()[0].id;
      const entry = reg.getImage(id);
      const r = I.writeAltText(mmd, entry);
      assert("9: transformed === false", r.transformed === false);
      assert(
        '9: action === "image-not-found"',
        r.action === "image-not-found",
        `got "${r.action}"`,
      );
      assert("9: output unchanged", r.mmd === mmd);
    }

    // ------------------------------------------------------------------------
    // 10. writeAltTextForAll — multi-image
    // ------------------------------------------------------------------------
    console.log("\n--- 10. writeAltTextForAll — multi-image ---");
    {
      const url1 = "https://cdn.mathpix.com/m1.png";
      const url2 = "https://cdn.mathpix.com/m2.png";
      const url3 = "https://cdn.mathpix.com/m3.png";
      const mmd =
        "Intro\n\n" +
        `![Initial1](${url1})\n\n` +
        figureBlock(url2, "Initial2", "Cap2") +
        "\n\n" +
        figureBlock(url3, "Initial3", "Cap3");
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const ids = reg.getAllImages().map((e) => e.id);
      reg.updateAltText(ids[0], "Updated", "user");
      reg.updateAltText(ids[1], "", "user");
      reg.updateAltText(ids[2], "ignored", "user");
      reg.updateDecorative(ids[2], true);

      const r = I.writeAltTextForAll(mmd, reg);
      assert(
        "10: transformations === 3",
        r.transformations === 3,
        `got ${r.transformations} (actions=${JSON.stringify(r.actions)})`,
      );
      assert(
        "10: actions.updated === 3",
        r.actions.updated === 3,
        JSON.stringify(r.actions),
      );
      assert(
        "10: output has ![Updated](url1)",
        r.mmd.includes(`![Updated](${url1})`),
      );
      assert(
        "10: output has alt={} for url2 (cleared)",
        new RegExp(
          `\\\\includegraphics\\[alt=\\{\\},max width=\\\\textwidth\\]\\{${url2.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\}`,
        ).test(r.mmd),
      );
      assert(
        "10: output has alt={} for url3 (decorative)",
        new RegExp(
          `\\\\includegraphics\\[alt=\\{\\},max width=\\\\textwidth\\]\\{${url3.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\}`,
        ).test(r.mmd),
      );
    }

    // ------------------------------------------------------------------------
    // 11. parseAltText — bare markdown pulls alt
    // ------------------------------------------------------------------------
    console.log("\n--- 11. parseAltText — bare markdown pulls alt ---");
    {
      const mmd =
        "Body\n\n![From MMD](https://cdn.mathpix.com/p1.png)\n\nEnd";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "", "user");
      const r = I.parseAltText(mmd, reg);
      assert(
        '11: registry altText is now "From MMD"',
        reg.getImage(id).altText === "From MMD",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "11: actions.updated === 1",
        r.actions.updated === 1,
        JSON.stringify(r.actions),
      );
      assert("11: updated === 1", r.updated === 1);
    }

    // ------------------------------------------------------------------------
    // 12. parseAltText — figure env decodes LaTeX escapes
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 12. parseAltText — figure env decodes LaTeX escapes ---",
    );
    {
      const url = "https://cdn.mathpix.com/p2.png";
      // Hand-build line with `alt={A \{ braces \}}` — note: the JS string
      // literal `"\\{"` produces the 2-char sequence `\{` in the MMD.
      const ig =
        `\\includegraphics[alt={A \\{ braces \\}},max width=\\textwidth]{${url}}`;
      const mmd =
        "\\begin{figure}\n" +
        ig +
        "\n\\captionsetup{labelformat=empty}\n\\caption{Cap}\n\\end{figure}";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "", "user");
      const r = I.parseAltText(mmd, reg);
      assert(
        '12: registry altText decoded to "A { braces }"',
        reg.getImage(id).altText === "A { braces }",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "12: actions.updated === 1",
        r.actions.updated === 1,
        JSON.stringify(r.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 13. parseAltText — defensive skip (Q4)
    // ------------------------------------------------------------------------
    console.log("\n--- 13. parseAltText — defensive skip (Q4) ---");
    {
      const mmd = "Body\n\n![](https://cdn.mathpix.com/p3.png)\n\nEnd";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "Existing", "user");
      const isModifiedBefore = reg.getImage(id).isModified;
      const r = I.parseAltText(mmd, reg);
      assert(
        '13: registry altText still "Existing" (not blanked)',
        reg.getImage(id).altText === "Existing",
      );
      assert(
        '13: actions["defensive-skip"] === 1',
        r.actions["defensive-skip"] === 1,
        JSON.stringify(r.actions),
      );
      assert(
        "13: actions.updated is undefined",
        r.actions.updated === undefined,
      );
      assert(
        "13: entry.isModified unchanged across parse",
        reg.getImage(id).isModified === isModifiedBefore,
      );
    }

    // ------------------------------------------------------------------------
    // 14. parseAltText — no-op when matched
    // ------------------------------------------------------------------------
    console.log("\n--- 14. parseAltText — no-op when matched ---");
    {
      const mmd = "Body\n\n![Match](https://cdn.mathpix.com/p4.png)\n\nEnd";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      // buildFromMMD already set altText = "Match" from the alt portion,
      // and isModified = false. Don't call updateAltText — that would flip
      // isModified to true.
      const isModifiedBefore = reg.getImage(id).isModified;
      const r = I.parseAltText(mmd, reg);
      assert("14: updated === 0", r.updated === 0);
      assert(
        '14: actions["no-op"] === 1',
        r.actions["no-op"] === 1,
        JSON.stringify(r.actions),
      );
      assert(
        "14: entry.isModified unchanged (no spurious flip)",
        reg.getImage(id).isModified === isModifiedBefore,
      );
    }

    // ------------------------------------------------------------------------
    // 15. parseAltText — image not found
    // ------------------------------------------------------------------------
    console.log("\n--- 15. parseAltText — image not found ---");
    {
      const mmd = "Body\n\n![X](https://cdn.mathpix.com/p5.png)\n\nEnd";
      const reg = new Registry();
      reg.buildFromMMD(
        "![X](https://cdn.mathpix.com/elsewhere.png)",
      );
      const id = reg.getAllImages()[0].id;
      const altBefore = reg.getImage(id).altText;
      const r = I.parseAltText(mmd, reg);
      assert(
        '15: actions["image-not-found"] === 1',
        r.actions["image-not-found"] === 1,
        JSON.stringify(r.actions),
      );
      assert(
        "15: registry altText unchanged",
        reg.getImage(id).altText === altBefore,
      );
    }

    // ------------------------------------------------------------------------
    // 16. Q5 lock — parseAltText preserves the decorative metadata
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 16. Q5 lock — parseAltText preserves decorative flag ---",
    );
    {
      // 16a — F-Q5-1 partial: flag=true, altText="", MMD ![](url)
      const mmd16a = "![](https://cdn.mathpix.com/q5a.png)";
      const reg16a = new Registry();
      reg16a.buildFromMMD(mmd16a);
      const id16a = reg16a.getAllImages()[0].id;
      reg16a.updateDecorative(id16a, true);
      I.parseAltText(mmd16a, reg16a);
      assert(
        "16a: decorative flag remains true",
        reg16a.getImage(id16a).decorative === true,
      );

      // 16b — F-Q5-2: flag=false, altText="Photo", MMD ![](url)
      const mmd16b = "![](https://cdn.mathpix.com/q5b.png)";
      const reg16b = new Registry();
      reg16b.buildFromMMD(mmd16b);
      const id16b = reg16b.getAllImages()[0].id;
      reg16b.updateAltText(id16b, "Photo", "user");
      I.parseAltText(mmd16b, reg16b);
      assert(
        "16b: decorative flag remains false",
        reg16b.getImage(id16b).decorative === false,
      );
      assert(
        '16b: altText preserved as "Photo" (defensive-skip)',
        reg16b.getImage(id16b).altText === "Photo",
      );
    }

    // ------------------------------------------------------------------------
    // 17. Round-trip — writeAltText then parseAltText
    // ------------------------------------------------------------------------
    console.log("\n--- 17. Round-trip — writeAltText then parseAltText ---");
    {
      // 17a — markdown, non-decorative
      {
        const url = "https://cdn.mathpix.com/rt1.png";
        const mmd = `Body\n\n![Old](${url})\n\nEnd`;
        const reg = new Registry();
        reg.buildFromMMD(mmd);
        const id = reg.getAllImages()[0].id;
        reg.updateAltText(id, "A", "user");
        const r1 = I.writeAltText(mmd, reg.getImage(id));
        const isModifiedBefore = reg.getImage(id).isModified;
        assert(
          `17a: write produced ![A](${url})`,
          r1.mmd.includes(`![A](${url})`),
        );
        const r2 = I.parseAltText(r1.mmd, reg);
        assert(
          '17a: parse altText still "A"',
          reg.getImage(id).altText === "A",
        );
        assert(
          '17a: actions["no-op"] === 1',
          r2.actions["no-op"] === 1,
          JSON.stringify(r2.actions),
        );
        assert(
          "17a: isModified unchanged across parse step",
          reg.getImage(id).isModified === isModifiedBefore,
        );
      }

      // 17b — figure env, non-decorative
      {
        const url = "https://cdn.mathpix.com/rt2.png";
        const mmd =
          "\\begin{figure}\n" +
          `\\includegraphics[alt={Old},max width=\\textwidth]{${url}}\n` +
          "\\captionsetup{labelformat=empty}\n\\caption{C}\n\\end{figure}";
        const reg = new Registry();
        reg.buildFromMMD(mmd);
        const id = reg.getAllImages()[0].id;
        reg.updateAltText(id, "A", "user");
        const r1 = I.writeAltText(mmd, reg.getImage(id));
        const isModifiedBefore = reg.getImage(id).isModified;
        assert(
          "17b: write produced alt={A}",
          r1.mmd.includes("alt={A}"),
        );
        const r2 = I.parseAltText(r1.mmd, reg);
        assert(
          '17b: parse altText still "A"',
          reg.getImage(id).altText === "A",
        );
        assert(
          '17b: actions["no-op"] === 1',
          r2.actions["no-op"] === 1,
          JSON.stringify(r2.actions),
        );
        assert(
          "17b: isModified unchanged across parse step",
          reg.getImage(id).isModified === isModifiedBefore,
        );
      }

      // 17c — F-Q5-3: figure env with flag=true, altText="A"
      {
        const url = "https://cdn.mathpix.com/rt3.png";
        const mmd =
          "\\begin{figure}\n" +
          `\\includegraphics[alt={A},max width=\\textwidth]{${url}}\n` +
          "\\captionsetup{labelformat=empty}\n\\caption{C}\n\\end{figure}";
        const reg = new Registry();
        reg.buildFromMMD(mmd);
        const id = reg.getAllImages()[0].id;
        reg.updateAltText(id, "A", "user");
        reg.updateDecorative(id, true);
        const r1 = I.writeAltText(mmd, reg.getImage(id));
        assert(
          "17c: write produced alt={} (flag wins)",
          r1.mmd.includes("alt={}"),
        );
        const r2 = I.parseAltText(r1.mmd, reg);
        assert(
          '17c: parse altText still "A" (defensive-skip)',
          reg.getImage(id).altText === "A",
        );
        assert(
          "17c: decorative flag still true",
          reg.getImage(id).decorative === true,
        );
        assert(
          '17c: actions["defensive-skip"] === 1',
          r2.actions["defensive-skip"] === 1,
          JSON.stringify(r2.actions),
        );
      }
    }

    // ------------------------------------------------------------------------
    console.log("\n" + "=".repeat(60));
    console.log(
      `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`,
    );
    if (failed > 0) {
      console.log("Failed tests:");
      results
        .filter((r) => r.startsWith("❌"))
        .forEach((r) => console.log(`  ${r}`));
    }
    console.log("\n=== Stage 3.A Smoke Suite Complete ===");
    return { passed, failed, total: passed + failed, results };
  }

  window.runStage3aTests = runStage3aTests;

  // ============================================================================
  // STAGE 3.B — INLINE SMOKE TESTS
  // ============================================================================

  /**
   * Stage 3.B smoke suite. Exercises the integrated forward/reverse pipelines
   * (`applyRegistryToMMD` and `reconcileMMDIntoRegistry`). Mirrors the
   * `runStage3aTests` shape — preconditions, inline `assert`, group headers,
   * summary block. The 3.A function body is not edited.
   *
   * @returns {{ passed: number, failed: number, total: number, results: string[] }}
   */
  function runStage3bTests() {
    console.log(
      "=== MathPix Alt Text Integrator — Stage 3.B Smoke Suite ===\n",
    );

    if (typeof window.MathPixImageRegistry !== "function") {
      console.error(
        "MathPixImageRegistry not available — load the registry module first.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Registry not loaded"],
      };
    }
    if (!window.MathPixAltTextMMDSerialiser) {
      console.error(
        "MathPixAltTextMMDSerialiser not available — load the serialiser module first.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Serialiser not loaded"],
      };
    }
    if (!window.MathPixAltTextIntegrator) {
      console.error(
        "MathPixAltTextIntegrator not available — this module failed to register.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Integrator not loaded"],
      };
    }

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(name, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${name}`);
      } else {
        failed++;
        const msg = detail ? `${name} — ${detail}` : name;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    const Registry = window.MathPixImageRegistry;
    const I = window.MathPixAltTextIntegrator;

    // The canonical three-image fixture. Built fresh per group so prior
    // mutations don't bleed between groups.
    function buildThreeImageFixture() {
      const url1 = "https://cdn.mathpix.com/three-1.png";
      const url2 = "https://cdn.mathpix.com/three-2.png";
      const url3 = "https://cdn.mathpix.com/three-3.png";
      const mmd =
        "Intro paragraph.\n\n" +
        `![](${url1})\n\n` +
        `![](${url2})\n\n` +
        `![](${url3})\n\n` +
        "Trailing paragraph.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const ids = reg.getAllImages().map((e) => e.id);
      // Image 1 — fully described.
      reg.updateTitle(ids[0], "Photo of cat", "user");
      reg.updateAltText(ids[0], "Tabby in armchair", "user");
      reg.updateLongDescription(
        ids[0],
        "A ginger tabby sleeps in a green armchair, curled beside a folded tartan blanket.",
        "user",
      );
      // Image 2 — decorative.
      reg.updateDecorative(ids[1], true);
      // Image 3 — alt-only.
      reg.updateAltText(ids[2], "Diagram of a flowchart", "user");
      return { mmd, reg, ids, url1, url2, url3 };
    }

    // ------------------------------------------------------------------------
    // 1. Module surface for 3.B
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Module surface for 3.B ---");
    {
      assert(
        "1: exposes applyRegistryToMMD",
        typeof I.applyRegistryToMMD === "function",
      );
      assert(
        "1: exposes reconcileMMDIntoRegistry",
        typeof I.reconcileMMDIntoRegistry === "function",
      );
      assert(
        "1: window.runStage3bTests is registered",
        typeof window.runStage3bTests === "function",
      );
    }

    // ------------------------------------------------------------------------
    // 2. applyRegistryToMMD — three-image fixture
    // ------------------------------------------------------------------------
    console.log("\n--- 2. applyRegistryToMMD — three-image fixture ---");
    {
      const f = buildThreeImageFixture();
      const result = I.applyRegistryToMMD(f.mmd, f.reg);
      assert(
        "2: output contains figure-wrapped image 1 with caption",
        result.mmd.includes("\\begin{figure}") &&
          result.mmd.includes("\\caption{Photo of cat}") &&
          result.mmd.includes("alt={Tabby in armchair}"),
      );
      assert(
        "2: output preserves bare ![](url2) for decorative image 2",
        result.mmd.includes(`![](${f.url2})`),
      );
      assert(
        "2: exactly one \\begin{figure} block in output (only image 1 wrapped)",
        (result.mmd.match(/\\begin\{figure\}/g) || []).length === 1,
        `got ${(result.mmd.match(/\\begin\{figure\}/g) || []).length} blocks`,
      );
      assert(
        "2: output has ![Diagram of a flowchart](url3) for alt-only image 3",
        result.mmd.includes(`![Diagram of a flowchart](${f.url3})`),
      );
      assert(
        "2: output contains appendix heading for long descriptions",
        result.mmd.includes("Long descriptions") &&
          result.mmd.includes(
            "A ginger tabby sleeps in a green armchair",
          ),
      );
      assert(
        "2: captions.transformations === 1 (one wrap)",
        result.captions.transformations === 1,
        `got ${result.captions.transformations}`,
      );
      assert(
        "2: altText.transformations === 2 (image 1 + image 3 alt writes)",
        result.altText.transformations === 2,
        `got ${result.altText.transformations} (actions=${JSON.stringify(result.altText.actions)})`,
      );
    }

    // ------------------------------------------------------------------------
    // 3. applyRegistryToMMD — return-shape verification
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 3. applyRegistryToMMD — return-shape verification ---",
    );
    {
      const f = buildThreeImageFixture();
      const result = I.applyRegistryToMMD(f.mmd, f.reg);
      assert(
        "3: result.mmd is a string",
        typeof result.mmd === "string",
      );
      assert(
        "3: result.captions/altText/appendix are objects",
        result.captions &&
          typeof result.captions === "object" &&
          result.altText &&
          typeof result.altText === "object" &&
          result.appendix &&
          typeof result.appendix === "object",
      );
      assert(
        "3: each sub-result has transformations + actions keys",
        typeof result.captions.transformations === "number" &&
          typeof result.captions.actions === "object" &&
          typeof result.altText.transformations === "number" &&
          typeof result.altText.actions === "object" &&
          typeof result.appendix.transformations === "number" &&
          typeof result.appendix.actions === "object",
      );
    }

    // ------------------------------------------------------------------------
    // 4. applyRegistryToMMD — idempotency
    // ------------------------------------------------------------------------
    console.log("\n--- 4. applyRegistryToMMD — idempotency ---");
    {
      const f = buildThreeImageFixture();
      const first = I.applyRegistryToMMD(f.mmd, f.reg);
      const second = I.applyRegistryToMMD(first.mmd, f.reg);
      assert(
        "4: second output byte-identical to first output",
        second.mmd === first.mmd,
      );
      assert(
        "4: second.captions.transformations === 0",
        second.captions.transformations === 0,
        `got ${second.captions.transformations}`,
      );
      assert(
        "4: second.altText.transformations === 0",
        second.altText.transformations === 0,
        `got ${second.altText.transformations} (actions=${JSON.stringify(second.altText.actions)})`,
      );
      assert(
        '4: second.appendix.actions has only "no-op" keys',
        Object.keys(second.appendix.actions).every((k) => k === "no-op"),
        JSON.stringify(second.appendix.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 5. reconcileMMDIntoRegistry — basic round-trip
    // ------------------------------------------------------------------------
    console.log("\n--- 5. reconcileMMDIntoRegistry — basic round-trip ---");
    {
      const f = buildThreeImageFixture();
      const longDesc =
        "A ginger tabby sleeps in a green armchair, curled beside a folded tartan blanket.";
      const forward = I.applyRegistryToMMD(f.mmd, f.reg);
      // Reset all three entries' user-editable fields to defaults.
      for (const id of f.ids) {
        f.reg.updateTitle(id, "", "user");
        f.reg.updateAltText(id, "", "user");
        f.reg.updateLongDescription(id, "", "user");
      }
      I.reconcileMMDIntoRegistry(forward.mmd, f.reg);
      assert(
        '5: image 1 title restored to "Photo of cat"',
        f.reg.getImage(f.ids[0]).title === "Photo of cat",
        `got "${f.reg.getImage(f.ids[0]).title}"`,
      );
      assert(
        '5: image 1 altText restored to "Tabby in armchair"',
        f.reg.getImage(f.ids[0]).altText === "Tabby in armchair",
        `got "${f.reg.getImage(f.ids[0]).altText}"`,
      );
      assert(
        "5: image 1 longDescription restored from appendix",
        f.reg.getImage(f.ids[0]).longDescription === longDesc,
        `got "${f.reg.getImage(f.ids[0]).longDescription}"`,
      );
      assert(
        '5: image 3 altText restored to "Diagram of a flowchart"',
        f.reg.getImage(f.ids[2]).altText === "Diagram of a flowchart",
        `got "${f.reg.getImage(f.ids[2]).altText}"`,
      );
    }

    // ------------------------------------------------------------------------
    // 6. reconcileMMDIntoRegistry — Q4 conflict A (decorative + user adds alt)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 6. reconcileMMDIntoRegistry — Q4 conflict A (decorative + user alt) ---",
    );
    {
      const url = "https://cdn.mathpix.com/q4a.png";
      const initialMmd = `![](${url})`;
      const reg = new Registry();
      reg.buildFromMMD(initialMmd);
      const id = reg.getAllImages()[0].id;
      reg.updateDecorative(id, true);
      const editedMmd = `![New description](${url})`;
      const result = I.reconcileMMDIntoRegistry(editedMmd, reg);
      assert(
        '6: entry.altText === "New description" (MMD wins for content)',
        reg.getImage(id).altText === "New description",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "6: entry retains its decorative flag (registry wins for flag)",
        reg.getImage(id).decorative === true,
      );
      assert(
        "6: result.altText.actions.updated === 1",
        result.altText.actions.updated === 1,
        JSON.stringify(result.altText.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 7. reconcileMMDIntoRegistry — Q4 defensive direction B
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 7. reconcileMMDIntoRegistry — Q4 defensive direction B ---",
    );
    {
      const url = "https://cdn.mathpix.com/q4b.png";
      const initialMmd = `![Existing](${url})`;
      const reg = new Registry();
      reg.buildFromMMD(initialMmd);
      const id = reg.getAllImages()[0].id;
      // buildFromMMD already set altText="Existing"; assert preconditions.
      const editedMmd = `![](${url})`;
      const result = I.reconcileMMDIntoRegistry(editedMmd, reg);
      assert(
        '7: entry.altText preserved as "Existing" (defensive-skip)',
        reg.getImage(id).altText === "Existing",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "7: entry.decorative still false (untouched)",
        reg.getImage(id).decorative === false,
      );
      assert(
        '7: result.altText.actions["defensive-skip"] === 1',
        result.altText.actions["defensive-skip"] === 1,
        JSON.stringify(result.altText.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 8. reconcileMMDIntoRegistry — return-shape verification
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 8. reconcileMMDIntoRegistry — return-shape verification ---",
    );
    {
      const f = buildThreeImageFixture();
      const forward = I.applyRegistryToMMD(f.mmd, f.reg);
      const result = I.reconcileMMDIntoRegistry(forward.mmd, f.reg);
      assert(
        "8: result has captions/altText/appendix keys; no mmd key",
        result.captions &&
          result.altText &&
          result.appendix &&
          typeof result.mmd === "undefined",
      );
      assert(
        "8: captions has parseCaptions shape (processed/updated/skipped/notFound)",
        typeof result.captions.processed === "number" &&
          typeof result.captions.updated === "number" &&
          typeof result.captions.skipped === "number" &&
          typeof result.captions.notFound === "number",
      );
      assert(
        "8: altText has parseAltText shape (updated/actions)",
        typeof result.altText.updated === "number" &&
          typeof result.altText.actions === "object",
      );
      assert(
        "8: appendix has parseAppendix shape (updated/actions)",
        typeof result.appendix.updated === "number" &&
          typeof result.appendix.actions === "object",
      );
    }

    // ------------------------------------------------------------------------
    // 9. reconcileMMDIntoRegistry — idempotency
    // ------------------------------------------------------------------------
    console.log("\n--- 9. reconcileMMDIntoRegistry — idempotency ---");
    {
      const f = buildThreeImageFixture();
      const forward = I.applyRegistryToMMD(f.mmd, f.reg);
      // Reset so the first reconcile does the restoration work.
      for (const id of f.ids) {
        f.reg.updateTitle(id, "", "user");
        f.reg.updateAltText(id, "", "user");
        f.reg.updateLongDescription(id, "", "user");
      }
      I.reconcileMMDIntoRegistry(forward.mmd, f.reg);
      const snapshot = f.ids.map((id) => {
        const e = f.reg.getImage(id);
        return {
          title: e.title,
          altText: e.altText,
          longDescription: e.longDescription,
          decorative: e.decorative,
        };
      });
      const second = I.reconcileMMDIntoRegistry(forward.mmd, f.reg);
      assert(
        "9: second.altText.actions['no-op'] === 3 (all three entries in sync)",
        second.altText.actions["no-op"] === 3,
        JSON.stringify(second.altText.actions),
      );
      const snapshotAfter = f.ids.map((id) => {
        const e = f.reg.getImage(id);
        return {
          title: e.title,
          altText: e.altText,
          longDescription: e.longDescription,
          decorative: e.decorative,
        };
      });
      assert(
        "9: critical registry fields byte-identical between calls",
        JSON.stringify(snapshot) === JSON.stringify(snapshotAfter),
      );
    }

    // ------------------------------------------------------------------------
    // 10. Clone-discipline verification
    // ------------------------------------------------------------------------
    console.log("\n--- 10. Clone-discipline verification ---");
    {
      const url = "https://cdn.mathpix.com/clone-d.png";
      const mmd = `Body\n\n![](${url})\n\nEnd`;
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Cap", "user");
      reg.updateAltText(id, "AltVal", "user");
      const result = I.applyRegistryToMMD(mmd, reg);
      const entryAfter = reg.getImage(id);
      assert(
        '10: entry.syntax refreshed to "includegraphics" after wrap',
        entryAfter.syntax === "includegraphics",
        `got "${entryAfter.syntax}"`,
      );
      assert(
        "10: entry.mmdReference contains \\includegraphics",
        typeof entryAfter.mmdReference === "string" &&
          entryAfter.mmdReference.includes("\\includegraphics"),
      );
      assert(
        "10: captions.transformations === 1 (one wrap)",
        result.captions.transformations === 1,
      );
      assert(
        "10: altText observed post-wrap entry — actions.updated === 1 and output has alt={AltVal}",
        result.altText.actions.updated === 1 &&
          result.mmd.includes("alt={AltVal}"),
        `actions=${JSON.stringify(result.altText.actions)}`,
      );
    }

    // ------------------------------------------------------------------------
    console.log("\n" + "=".repeat(60));
    console.log(
      `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`,
    );
    if (failed > 0) {
      console.log("Failed tests:");
      results
        .filter((r) => r.startsWith("❌"))
        .forEach((r) => console.log(`  ${r}`));
    }
    console.log("\n=== Stage 3.B Smoke Suite Complete ===");
    return { passed, failed, total: passed + failed, results };
  }

  window.runStage3bTests = runStage3bTests;

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixAltTextIntegrator = {
    writeAltText,
    writeAltTextForAll,
    parseAltText,
    applyRegistryToMMD,
    reconcileMMDIntoRegistry,
    PARSE_ALT_TEXT_ACTIONS,
  };

  logInfo(
    "MathPixAltTextIntegrator loaded (Stage 3.A primitives + 3.B pipelines)",
  );
})();
