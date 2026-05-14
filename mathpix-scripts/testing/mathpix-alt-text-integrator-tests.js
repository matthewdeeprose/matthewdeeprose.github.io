/**
 * @fileoverview Full test suite for MathPix Alt Text Integrator (Stage 3.C).
 *   Migrates the Stage 3.A and 3.B inline smoke groups into this file and
 *   adds the formal Q5 fixture coverage, Q4 conflict direction tests,
 *   three-image byte-exact integration fixture, edge cases, and
 *   cross-module dependency verification.
 * @module MathPixAltTextIntegratorTests
 * @requires MathPixImageRegistry, MathPixAltTextMMDSerialiser, MathPixAltTextIntegrator
 * @version 1.0.0 (Stage 3.C)
 *
 * Load order: this file MUST come after `mathpix-alt-text-integrator.js`
 * in `tools.html`. It exposes `window.testAltTextIntegrator` (canonical
 * runner) and `window.runStage3Tests` (alias) at module load.
 *
 * The Stage 3.A and 3.B inline runners (`runStage3aTests`, `runStage3bTests`)
 * remain in the integrator file as fast-iteration smoke suites. The full
 * suite here is additive — it migrates those groups verbatim (Groups 1–27)
 * and extends with formal Q5 coverage, byte-exact integration fixture,
 * edge cases, and cross-module dependency verification (Groups 28–37).
 *
 * @see mathpix-scripts/docs/alt-text/image-manager-alt-text-build-plan.md — Stage 3.C
 * @see mathpix-scripts/docs/alt-text/stage-3-planning-decisions.md — Q5 fixture table
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(msg, ...args) {
    if (shouldLog(0)) console.error(`[AltTextIntegratorTests] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(1)) console.warn(`[AltTextIntegratorTests] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(2)) console.log(`[AltTextIntegratorTests] ${msg}`, ...args);
  }

  // ============================================================================
  // CANONICAL RUNNER
  // ============================================================================

  /**
   * Run the Stage 3 full test suite.
   * @returns {{ passed: number, failed: number, total: number, results: string[] }}
   */
  function testAltTextIntegrator() {
    console.log(
      "=== MathPix Alt Text Integrator — Stage 3 Full Suite (3.A + 3.B + 3.C) ===\n",
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
        "MathPixAltTextIntegrator not available — load the integrator module first.",
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
    const Serialiser = window.MathPixAltTextMMDSerialiser;
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

    // The canonical three-image fixture used by 3.B Group 19+ (and Group 33).
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

    // ========================================================================
    // GROUPS 1–17 — MIGRATED FROM Stage 3.A INLINE SMOKES (verbatim)
    // ========================================================================

    // ------------------------------------------------------------------------
    // 1. Module surface (full integrator)
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Module surface (full integrator) ---");
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
      // Stage 3.B additions exposed by the integrator namespace.
      assert(
        "1: exposes applyRegistryToMMD",
        typeof I.applyRegistryToMMD === "function",
      );
      assert(
        "1: exposes reconcileMMDIntoRegistry",
        typeof I.reconcileMMDIntoRegistry === "function",
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

    // ========================================================================
    // GROUPS 18–27 — MIGRATED FROM Stage 3.B INLINE SMOKES (verbatim)
    // ========================================================================

    // ------------------------------------------------------------------------
    // 18. Module surface — pipeline functions detail
    // ------------------------------------------------------------------------
    console.log("\n--- 18. Module surface — pipeline functions detail ---");
    {
      assert(
        "18: exposes applyRegistryToMMD",
        typeof I.applyRegistryToMMD === "function",
      );
      assert(
        "18: exposes reconcileMMDIntoRegistry",
        typeof I.reconcileMMDIntoRegistry === "function",
      );
      assert(
        "18: window.runStage3bTests is registered",
        typeof window.runStage3bTests === "function",
      );
    }

    // ------------------------------------------------------------------------
    // 19. applyRegistryToMMD — three-image fixture
    // ------------------------------------------------------------------------
    console.log("\n--- 19. applyRegistryToMMD — three-image fixture ---");
    {
      const f = buildThreeImageFixture();
      const result = I.applyRegistryToMMD(f.mmd, f.reg);
      assert(
        "19: output contains figure-wrapped image 1 with caption",
        result.mmd.includes("\\begin{figure}") &&
          result.mmd.includes("\\caption{Photo of cat}") &&
          result.mmd.includes("alt={Tabby in armchair}"),
      );
      assert(
        "19: output preserves bare ![](url2) for decorative image 2",
        result.mmd.includes(`![](${f.url2})`),
      );
      assert(
        "19: exactly one \\begin{figure} block in output (only image 1 wrapped)",
        (result.mmd.match(/\\begin\{figure\}/g) || []).length === 1,
        `got ${(result.mmd.match(/\\begin\{figure\}/g) || []).length} blocks`,
      );
      assert(
        "19: output has ![Diagram of a flowchart](url3) for alt-only image 3",
        result.mmd.includes(`![Diagram of a flowchart](${f.url3})`),
      );
      assert(
        "19: output contains appendix heading for long descriptions",
        result.mmd.includes("Long descriptions") &&
          result.mmd.includes(
            "A ginger tabby sleeps in a green armchair",
          ),
      );
      assert(
        "19: captions.transformations === 1 (one wrap)",
        result.captions.transformations === 1,
        `got ${result.captions.transformations}`,
      );
      assert(
        "19: altText.transformations === 2 (image 1 + image 3 alt writes)",
        result.altText.transformations === 2,
        `got ${result.altText.transformations} (actions=${JSON.stringify(result.altText.actions)})`,
      );
    }

    // ------------------------------------------------------------------------
    // 20. applyRegistryToMMD — return-shape verification
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 20. applyRegistryToMMD — return-shape verification ---",
    );
    {
      const f = buildThreeImageFixture();
      const result = I.applyRegistryToMMD(f.mmd, f.reg);
      assert(
        "20: result.mmd is a string",
        typeof result.mmd === "string",
      );
      assert(
        "20: result.captions/altText/appendix are objects",
        result.captions &&
          typeof result.captions === "object" &&
          result.altText &&
          typeof result.altText === "object" &&
          result.appendix &&
          typeof result.appendix === "object",
      );
      assert(
        "20: each sub-result has transformations + actions keys",
        typeof result.captions.transformations === "number" &&
          typeof result.captions.actions === "object" &&
          typeof result.altText.transformations === "number" &&
          typeof result.altText.actions === "object" &&
          typeof result.appendix.transformations === "number" &&
          typeof result.appendix.actions === "object",
      );
    }

    // ------------------------------------------------------------------------
    // 21. applyRegistryToMMD — idempotency
    // ------------------------------------------------------------------------
    console.log("\n--- 21. applyRegistryToMMD — idempotency ---");
    {
      const f = buildThreeImageFixture();
      const first = I.applyRegistryToMMD(f.mmd, f.reg);
      const second = I.applyRegistryToMMD(first.mmd, f.reg);
      assert(
        "21: second output byte-identical to first output",
        second.mmd === first.mmd,
      );
      assert(
        "21: second.captions.transformations === 0",
        second.captions.transformations === 0,
        `got ${second.captions.transformations}`,
      );
      assert(
        "21: second.altText.transformations === 0",
        second.altText.transformations === 0,
        `got ${second.altText.transformations} (actions=${JSON.stringify(second.altText.actions)})`,
      );
      assert(
        '21: second.appendix.actions has only "no-op" keys',
        Object.keys(second.appendix.actions).every((k) => k === "no-op"),
        JSON.stringify(second.appendix.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 22. reconcileMMDIntoRegistry — basic round-trip
    // ------------------------------------------------------------------------
    console.log("\n--- 22. reconcileMMDIntoRegistry — basic round-trip ---");
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
        '22: image 1 title restored to "Photo of cat"',
        f.reg.getImage(f.ids[0]).title === "Photo of cat",
        `got "${f.reg.getImage(f.ids[0]).title}"`,
      );
      assert(
        '22: image 1 altText restored to "Tabby in armchair"',
        f.reg.getImage(f.ids[0]).altText === "Tabby in armchair",
        `got "${f.reg.getImage(f.ids[0]).altText}"`,
      );
      assert(
        "22: image 1 longDescription restored from appendix",
        f.reg.getImage(f.ids[0]).longDescription === longDesc,
        `got "${f.reg.getImage(f.ids[0]).longDescription}"`,
      );
      assert(
        '22: image 3 altText restored to "Diagram of a flowchart"',
        f.reg.getImage(f.ids[2]).altText === "Diagram of a flowchart",
        `got "${f.reg.getImage(f.ids[2]).altText}"`,
      );
    }

    // ------------------------------------------------------------------------
    // 23. reconcileMMDIntoRegistry — Q4 conflict A (decorative + user adds alt)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 23. reconcileMMDIntoRegistry — Q4 conflict A (decorative + user alt) ---",
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
        '23: entry.altText === "New description" (MMD wins for content)',
        reg.getImage(id).altText === "New description",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "23: entry retains its decorative flag (registry wins for flag)",
        reg.getImage(id).decorative === true,
      );
      assert(
        "23: result.altText.actions.updated === 1",
        result.altText.actions.updated === 1,
        JSON.stringify(result.altText.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 24. reconcileMMDIntoRegistry — Q4 defensive direction B
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 24. reconcileMMDIntoRegistry — Q4 defensive direction B ---",
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
        '24: entry.altText preserved as "Existing" (defensive-skip)',
        reg.getImage(id).altText === "Existing",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "24: entry.decorative still false (untouched)",
        reg.getImage(id).decorative === false,
      );
      assert(
        '24: result.altText.actions["defensive-skip"] === 1',
        result.altText.actions["defensive-skip"] === 1,
        JSON.stringify(result.altText.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 25. reconcileMMDIntoRegistry — return-shape verification
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 25. reconcileMMDIntoRegistry — return-shape verification ---",
    );
    {
      const f = buildThreeImageFixture();
      const forward = I.applyRegistryToMMD(f.mmd, f.reg);
      const result = I.reconcileMMDIntoRegistry(forward.mmd, f.reg);
      assert(
        "25: result has captions/altText/appendix keys; no mmd key",
        result.captions &&
          result.altText &&
          result.appendix &&
          typeof result.mmd === "undefined",
      );
      assert(
        "25: captions has parseCaptions shape (processed/updated/skipped/notFound)",
        typeof result.captions.processed === "number" &&
          typeof result.captions.updated === "number" &&
          typeof result.captions.skipped === "number" &&
          typeof result.captions.notFound === "number",
      );
      assert(
        "25: altText has parseAltText shape (updated/actions)",
        typeof result.altText.updated === "number" &&
          typeof result.altText.actions === "object",
      );
      assert(
        "25: appendix has parseAppendix shape (updated/actions)",
        typeof result.appendix.updated === "number" &&
          typeof result.appendix.actions === "object",
      );
    }

    // ------------------------------------------------------------------------
    // 26. reconcileMMDIntoRegistry — idempotency
    // ------------------------------------------------------------------------
    console.log("\n--- 26. reconcileMMDIntoRegistry — idempotency ---");
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
        "26: second.altText.actions['no-op'] === 3 (all three entries in sync)",
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
        "26: critical registry fields byte-identical between calls",
        JSON.stringify(snapshot) === JSON.stringify(snapshotAfter),
      );
    }

    // ------------------------------------------------------------------------
    // 27. Clone-discipline verification
    // ------------------------------------------------------------------------
    console.log("\n--- 27. Clone-discipline verification ---");
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
        '27: entry.syntax refreshed to "includegraphics" after wrap',
        entryAfter.syntax === "includegraphics",
        `got "${entryAfter.syntax}"`,
      );
      assert(
        "27: entry.mmdReference contains \\includegraphics",
        typeof entryAfter.mmdReference === "string" &&
          entryAfter.mmdReference.includes("\\includegraphics"),
      );
      assert(
        "27: captions.transformations === 1 (one wrap)",
        result.captions.transformations === 1,
      );
      assert(
        "27: altText observed post-wrap entry — actions.updated === 1 and output has alt={AltVal}",
        result.altText.actions.updated === 1 &&
          result.mmd.includes("alt={AltVal}"),
        `actions=${JSON.stringify(result.altText.actions)}`,
      );
    }

    // ========================================================================
    // GROUPS 28–37 — STAGE 3.C FULL-SUITE-ONLY COVERAGE
    // ========================================================================

    // ------------------------------------------------------------------------
    // 28. F-Q5-1 explicit (decorative=true, altText="", figure env)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 28. F-Q5-1: decorative=true, altText=\"\", figure env ---",
    );
    {
      const url = "https://cdn.mathpix.com/q5-1.png";
      // Figure-env-shaped MMD with `alt={}` already.
      const mmd = "Lead\n\n" + figureBlock(url, "", "C") + "\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateDecorative(id, true);
      // altText is "" already (buildFromMMD seeds includegraphics with "").

      const r1 = I.writeAltText(mmd, reg.getImage(id));
      assert(
        "28: after writeAltText, MMD still contains alt={}",
        r1.mmd.includes("alt={}"),
      );
      assert(
        '28: writeAltText action === "no-op" (currentAlt and targetAlt both "")',
        r1.action === "no-op",
        `got "${r1.action}"`,
      );

      const r2 = I.parseAltText(r1.mmd, reg);
      assert(
        "28: after parseAltText, decorative still true",
        reg.getImage(id).decorative === true,
      );
      assert(
        '28: after parseAltText, altText still ""',
        reg.getImage(id).altText === "",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        '28: parseAltText actions["no-op"] === 1 (currentAlt and registry both empty)',
        r2.actions["no-op"] === 1,
        JSON.stringify(r2.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 29. F-Q5-2 explicit (decorative=false, altText="Photo", hand-edit to alt={})
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 29. F-Q5-2: decorative=false, altText=\"Photo\", hand-edit to alt={} ---",
    );
    {
      const url = "https://cdn.mathpix.com/q5-2.png";
      // Initial MMD has alt={Photo}; seed registry's altText to "Photo"
      // (buildFromMMD records "" for includegraphics, per Stage 3.A lesson).
      const initialMmd = "Lead\n\n" + figureBlock(url, "Photo", "C") + "\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(initialMmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "Photo", "user");
      const isModifiedBefore = reg.getImage(id).isModified;

      // User hand-edits MMD: alt={Photo} → alt={}
      const editedMmd = initialMmd.replace("alt={Photo}", "alt={}");
      const r = I.parseAltText(editedMmd, reg);

      assert(
        "29: registry decorative still false (no inference from empty alt)",
        reg.getImage(id).decorative === false,
      );
      assert(
        '29: registry altText preserved as "Photo" (defensive-skip)',
        reg.getImage(id).altText === "Photo",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        '29: parseAltText actions["defensive-skip"] === 1',
        r.actions["defensive-skip"] === 1,
        JSON.stringify(r.actions),
      );
      assert(
        "29: entry.isModified unchanged across the parse step",
        reg.getImage(id).isModified === isModifiedBefore,
      );
    }

    // ------------------------------------------------------------------------
    // 30. F-Q5-3 explicit (decorative=true, altText="Photo", figure env — Q2 edge)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 30. F-Q5-3: decorative=true, altText=\"Photo\", figure env (Q2 edge) ---",
    );
    {
      const url = "https://cdn.mathpix.com/q5-3.png";
      const initialMmd = "Lead\n\n" + figureBlock(url, "Photo", "C") + "\n\nTail";
      const reg = new Registry();
      reg.buildFromMMD(initialMmd);
      const id = reg.getAllImages()[0].id;
      reg.updateAltText(id, "Photo", "user");
      reg.updateDecorative(id, true);

      const r1 = I.writeAltText(initialMmd, reg.getImage(id));
      assert(
        "30: after writeAltText, MMD contains alt={} (decorative wins over altText)",
        r1.mmd.includes("alt={}"),
      );
      assert(
        '30: writeAltText action === "updated"',
        r1.action === "updated",
        `got "${r1.action}"`,
      );

      const r2 = I.parseAltText(r1.mmd, reg);
      assert(
        '30: registry altText preserved as "Photo" (defensive-skip)',
        reg.getImage(id).altText === "Photo",
        `got "${reg.getImage(id).altText}"`,
      );
      assert(
        "30: registry decorative still true (no inference)",
        reg.getImage(id).decorative === true,
      );
      assert(
        '30: parseAltText actions["defensive-skip"] === 1',
        r2.actions["defensive-skip"] === 1,
        JSON.stringify(r2.actions),
      );
    }

    // ------------------------------------------------------------------------
    // 31. F-Q5-4 explicit (decorative=true, altText="", bare markdown)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 31. F-Q5-4: decorative=true, altText=\"\", bare markdown ---",
    );
    {
      const url = "https://cdn.mathpix.com/q5-4.png";
      const mmd = `Body\n\n![](${url})\n\nEnd`;
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateDecorative(id, true);

      const r1 = I.writeAltText(mmd, reg.getImage(id));
      assert(
        '31: writeAltText is a no-op (currentAlt and targetAlt both "")',
        r1.action === "no-op",
        `got "${r1.action}"`,
      );

      I.parseAltText(r1.mmd, reg);
      assert(
        "31: registry decorative still true after round-trip",
        reg.getImage(id).decorative === true,
      );
      assert(
        '31: registry altText still "" after round-trip',
        reg.getImage(id).altText === "",
        `got "${reg.getImage(id).altText}"`,
      );
    }

    // ------------------------------------------------------------------------
    // 32. F-Q5-5 explicit (decorative=false, altText="", trivial empty)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 32. F-Q5-5: decorative=false, altText=\"\", trivial empty baseline ---",
    );
    {
      const url = "https://cdn.mathpix.com/q5-5.png";
      const mmd = `Body\n\n![](${url})\n\nEnd`;
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      // Neither decorative nor altText set; buildFromMMD seeds altText="" for
      // markdown with empty alt, decorative=false by default.

      const r1 = I.writeAltText(mmd, reg.getImage(id));
      assert(
        '32: writeAltText action === "no-op"',
        r1.action === "no-op",
        `got "${r1.action}"`,
      );

      const r2 = I.parseAltText(r1.mmd, reg);
      assert(
        '32: parseAltText actions["no-op"] === 1',
        r2.actions["no-op"] === 1,
        JSON.stringify(r2.actions),
      );
      assert(
        "32: registry state unchanged (decorative=false, altText=\"\")",
        reg.getImage(id).decorative === false &&
          reg.getImage(id).altText === "",
      );
    }

    // ------------------------------------------------------------------------
    // 33. Three-image integration fixture, byte-exact MMD assertion
    // ------------------------------------------------------------------------
    console.log(
      "\n--- 33. Three-image fixture, byte-exact MMD assertion ---",
    );
    {
      // EXPECTED_MMD is the canonical output of applyRegistryToMMD on the
      // three-image fixture as locked at Stage 3.C completion. If
      // writeAllCaptions/writeAltTextForAll/writeAppendix later change format,
      // this test will fail intentionally — that is the regression detector.
      // The image-ID `img-582dcefa` is deterministic (URL-derived hash), so
      // it stays stable across runs of this fixture.
      const EXPECTED_MMD =
        "Intro paragraph.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={Tabby in armchair},max width=\\textwidth]{https://cdn.mathpix.com/three-1.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Photo of cat}\n" +
        "\\end{figure}\n\n" +
        "![](https://cdn.mathpix.com/three-2.png)\n\n" +
        "![Diagram of a flowchart](https://cdn.mathpix.com/three-3.png)\n\n" +
        "Trailing paragraph.\n\n" +
        "## Long descriptions\n\n" +
        "<!-- img-desc:img-582dcefa -->\n" +
        "### Description of Photo of cat\n\n" +
        "A ginger tabby sleeps in a green armchair, curled beside a folded tartan blanket.";

      const f = buildThreeImageFixture();
      const result = I.applyRegistryToMMD(f.mmd, f.reg);

      assert(
        "33: result.mmd byte-exactly matches EXPECTED_MMD",
        result.mmd === EXPECTED_MMD,
        `bytes=${result.mmd.length} (expected ${EXPECTED_MMD.length})`,
      );
      assert(
        "33: result.captions.transformations === 1",
        result.captions.transformations === 1,
        `got ${result.captions.transformations}`,
      );
      assert(
        "33: result.altText.transformations === 2",
        result.altText.transformations === 2,
        `got ${result.altText.transformations}`,
      );
      assert(
        "33: result.appendix.transformations === 1 (one entry has long description)",
        result.appendix.transformations === 1,
        `got ${result.appendix.transformations} (actions=${JSON.stringify(result.appendix.actions)})`,
      );
      assert(
        "33: exactly one \\begin{figure} block in output",
        (result.mmd.match(/\\begin\{figure\}/g) || []).length === 1,
        `got ${(result.mmd.match(/\\begin\{figure\}/g) || []).length} blocks`,
      );
      assert(
        "33: output contains '## Long descriptions' appendix heading",
        result.mmd.includes("## Long descriptions"),
      );
    }

    // ------------------------------------------------------------------------
    // 34. Edge cases: empty registry
    // ------------------------------------------------------------------------
    console.log("\n--- 34. Edge cases: empty registry ---");
    {
      const url = "https://cdn.mathpix.com/empty-reg.png";
      const mmd = `Body\n\n![Alt](${url})\n\nEnd`;
      const reg = new Registry();
      // Do NOT buildFromMMD; registry stays empty.

      let threw = false;
      let forward, reverse;
      try {
        forward = I.applyRegistryToMMD(mmd, reg);
        reverse = I.reconcileMMDIntoRegistry(mmd, reg);
      } catch (e) {
        threw = true;
      }
      assert("34: no exception thrown", !threw);
      assert(
        "34: applyRegistryToMMD returns mmd byte-identical to input",
        forward.mmd === mmd,
      );
      assert(
        "34: forward sub-results all have transformations === 0",
        forward.captions.transformations === 0 &&
          forward.altText.transformations === 0 &&
          forward.appendix.transformations === 0,
      );
      assert(
        "34: reverse sub-results all have updated === 0",
        reverse.captions.updated === 0 &&
          reverse.altText.updated === 0 &&
          reverse.appendix.updated === 0,
      );
    }

    // ------------------------------------------------------------------------
    // 35. Edge cases: registry with images not in MMD
    // ------------------------------------------------------------------------
    console.log("\n--- 35. Edge cases: registry with images not in MMD ---");
    {
      // Registry built from a different MMD with three URLs.
      const seedMmd =
        "![A](https://cdn.mathpix.com/missing-1.png)\n\n" +
        "![B](https://cdn.mathpix.com/missing-2.png)\n\n" +
        "![C](https://cdn.mathpix.com/missing-3.png)";
      const reg = new Registry();
      reg.buildFromMMD(seedMmd);
      const ids = reg.getAllImages().map((e) => e.id);
      reg.updateAltText(ids[0], "AltA", "user");
      reg.updateAltText(ids[1], "AltB", "user");
      reg.updateAltText(ids[2], "AltC", "user");

      // Target MMD has no image references.
      const targetMmd = "Just some prose with no images.\n\nMore prose.";

      const forward = I.applyRegistryToMMD(targetMmd, reg);
      assert(
        '35: forward.altText.actions["image-not-found"] === 3',
        forward.altText.actions["image-not-found"] === 3,
        JSON.stringify(forward.altText.actions),
      );
      assert(
        "35: forward.mmd unchanged byte-exact (no image transforms applied)",
        forward.mmd === targetMmd,
      );

      const reverse = I.reconcileMMDIntoRegistry(targetMmd, reg);
      assert(
        '35: reverse.altText.actions["image-not-found"] === 3',
        reverse.altText.actions["image-not-found"] === 3,
        JSON.stringify(reverse.altText.actions),
      );
      assert(
        "35: registry altText fields preserved (AltA/AltB/AltC)",
        reg.getImage(ids[0]).altText === "AltA" &&
          reg.getImage(ids[1]).altText === "AltB" &&
          reg.getImage(ids[2]).altText === "AltC",
      );
    }

    // ------------------------------------------------------------------------
    // 36. Edge cases: malformed MMD
    // ------------------------------------------------------------------------
    console.log("\n--- 36. Edge cases: malformed MMD ---");
    {
      // 36a — empty string MMD
      {
        const reg = new Registry();
        const url = "https://cdn.mathpix.com/empty-mmd.png";
        // Seed one entry so registry is non-empty.
        reg.buildFromMMD(`![X](${url})`);
        let threw36a = false;
        let forward, reverse;
        try {
          forward = I.applyRegistryToMMD("", reg);
          reverse = I.reconcileMMDIntoRegistry("", reg);
        } catch (e) {
          threw36a = true;
        }
        assert("36a: empty-string MMD does not throw", !threw36a);
        assert(
          "36a: forward transformations all === 0",
          forward.captions.transformations === 0 &&
            forward.altText.transformations === 0 &&
            forward.appendix.transformations === 0,
        );
      }

      // 36b — null MMD
      {
        const reg = new Registry();
        let threw36b = false;
        let forward, reverse;
        try {
          forward = I.applyRegistryToMMD(null, reg);
          reverse = I.reconcileMMDIntoRegistry(null, reg);
        } catch (e) {
          threw36b = true;
        }
        assert("36b: null MMD does not throw", !threw36b);
        assert(
          '36b: applyRegistryToMMD returns mmd === "" for null input',
          forward.mmd === "",
          `got "${forward.mmd}"`,
        );
      }

      // 36c — garbage MMD with no image references
      {
        const reg = new Registry();
        reg.buildFromMMD("![X](https://cdn.mathpix.com/garbage.png)");
        const garbage = "garbage with no markdown images or includegraphics";
        let threw36c = false;
        let forward, reverse;
        try {
          forward = I.applyRegistryToMMD(garbage, reg);
          reverse = I.reconcileMMDIntoRegistry(garbage, reg);
        } catch (e) {
          threw36c = true;
        }
        assert("36c: garbage MMD does not throw", !threw36c);
        assert(
          "36c: forward.mmd byte-exact equals garbage input (no transforms)",
          forward.mmd === garbage,
        );
      }
    }

    // ------------------------------------------------------------------------
    // 37. Cross-module dependency verification
    // ------------------------------------------------------------------------
    console.log("\n--- 37. Cross-module dependency verification ---");
    {
      assert(
        "37: Serialiser.findImage is a function",
        typeof Serialiser.findImage === "function",
      );
      assert(
        "37: Serialiser.detectFigureContext is a function",
        typeof Serialiser.detectFigureContext === "function",
      );
      assert(
        "37: Serialiser.findMatchingBrace is a function",
        typeof Serialiser.findMatchingBrace === "function",
      );
      assert(
        "37: Serialiser.escapeAltForLatex is a function",
        typeof Serialiser.escapeAltForLatex === "function",
      );
      assert(
        "37: Serialiser.unescapeAltFromLatex is a function",
        typeof Serialiser.unescapeAltFromLatex === "function",
      );
      assert(
        "37: Serialiser.writeAllCaptions is a function",
        typeof Serialiser.writeAllCaptions === "function",
      );
      assert(
        "37: Serialiser.writeAppendix is a function",
        typeof Serialiser.writeAppendix === "function",
      );
      assert(
        "37: Serialiser.parseCaptions is a function",
        typeof Serialiser.parseCaptions === "function",
      );
      assert(
        "37: Serialiser.parseAppendix is a function",
        typeof Serialiser.parseAppendix === "function",
      );
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
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
    console.log("\n=== Stage 3 Full Suite Complete ===");
    return { passed, failed, total: passed + failed, results };
  }

  // ============================================================================
  // GLOBAL EXPOSURE — canonical name + Stage alias at module load
  // ============================================================================
  window.testAltTextIntegrator = testAltTextIntegrator;
  window.runStage3Tests = window.testAltTextIntegrator;

  logInfo(
    "MathPixAltTextIntegratorTests module loaded (testAltTextIntegrator + runStage3Tests registered)",
  );
})();
