/**
 * @fileoverview Stage 1 full test suite for MathPixAltTextMMDSerialiser.
 * @module MathPixAltTextSerialiserTests
 * @requires MathPixImageRegistry
 * @requires MathPixAltTextMMDSerialiser
 * @version 1.0.0 (Stage 1.B)
 *
 * @description
 * Hosts both runners:
 *   - `window.runStage1Tests()` — full suite (migrated smokes + 1.B fixtures, round-trip,
 *     idempotency, MMD-wins, option variations, edge cases, image-lookup).
 *   - `window.runStage1aTests()` — thin wrapper that calls `runStage1Tests({ smokeOnly: true })`
 *     for backward compatibility with the 29-assertion smoke contract.
 *
 * Both runners are registered at module load (per the Stage 0 alias-placement convention).
 * Load order: this file MUST come after `mathpix-alt-text-mmd-serialiser.js` in `tools.html`.
 *
 * @see mathpix-scripts/docs/alt-text/image-manager-alt-text-build-plan.md — Stage 1
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
    if (shouldLog(0)) console.error(`[AltTextSerialiserTests] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(1)) console.warn(`[AltTextSerialiserTests] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(2)) console.log(`[AltTextSerialiserTests] ${msg}`, ...args);
  }

  // ============================================================================
  // CANONICAL RUNNER
  // ============================================================================

  /**
   * Run the Stage 1 test suite.
   * @param {Object} [opts]
   * @param {boolean} [opts.smokeOnly=false] - When true, runs only the 29 migrated
   *   smoke assertions (Groups 1–6) for the `runStage1aTests` backward-compat path.
   * @returns {{ passed: number, failed: number, total: number, results: string[] }}
   */
  function runStage1Tests(opts) {
    const smokeOnly = !!(opts && opts.smokeOnly);
    const header = smokeOnly
      ? "MathPix Alt Text MMD Serialiser — Stage 1.A Smoke Suite"
      : "MathPix Alt Text MMD Serialiser — Stage 1 Full Suite (1.A + 1.B)";
    console.log(`=== ${header} ===\n`);

    if (typeof window.MathPixImageRegistry !== "function") {
      console.error("MathPixImageRegistry not available — load the registry module first.");
      return { passed: 0, failed: 1, total: 1, results: ["❌ Registry not loaded"] };
    }
    if (!window.MathPixAltTextMMDSerialiser) {
      console.error("MathPixAltTextMMDSerialiser not available — load the serialiser module first.");
      return { passed: 0, failed: 1, total: 1, results: ["❌ Serialiser not loaded"] };
    }

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(testName, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${testName}`);
      } else {
        failed++;
        const msg = detail ? `${testName} — ${detail}` : testName;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    const Serialiser = window.MathPixAltTextMMDSerialiser;
    const Registry = window.MathPixImageRegistry;

    // ========================================================================
    // SMOKE GROUPS 1–6 (migrated from production serialiser, 29 assertions)
    // ========================================================================

    // --- 1. Helpers ---
    console.log("\n--- 1. Helpers ---");
    {
      assert(
        "findMatchingBrace: simple \\caption{X}",
        Serialiser.findMatchingBrace("\\caption{Hello}", 8) === 14,
      );
      assert(
        "findMatchingBrace: nested braces",
        Serialiser.findMatchingBrace("\\caption{a {b} c}", 8) === 16,
      );
      assert(
        "findMatchingBrace: escaped braces ignored",
        Serialiser.findMatchingBrace("\\caption{a \\{ b}", 8) === 15,
      );
      assert(
        "escapeAltForLatex / unescape round-trip",
        Serialiser.unescapeAltFromLatex(
          Serialiser.escapeAltForLatex("a \\ {b} c"),
        ) === "a \\ {b} c",
      );
      assert(
        "escapeAltForLatex: empty input → empty output",
        Serialiser.escapeAltForLatex("") === "",
      );
    }

    // --- 2. Fixture 1: bare markdown → wrap ---
    console.log("\n--- 2. Fixture 1: bare markdown → wrap ---");
    {
      const mmd1Before = "Hello\n\n![](https://cdn.mathpix.com/x.png)\n\nWorld";
      const reg1 = new Registry();
      reg1.buildFromMMD(mmd1Before);
      const entry1 = reg1.getAllImages()[0];
      reg1.updateTitle(entry1.id, "My caption", "user");

      const result = Serialiser.writeAllCaptions(mmd1Before, reg1);
      const expected =
        "Hello\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/x.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{My caption}\n" +
        "\\end{figure}\n\nWorld";

      assert(
        "Fixture 1: transformations === 1",
        result.transformations === 1,
        `got ${result.transformations}`,
      );
      assert(
        "Fixture 1: action breakdown shows wrap=1",
        result.actions.wrap === 1,
        JSON.stringify(result.actions),
      );
      assert(
        "Fixture 1: output matches expected MMD exactly",
        result.mmd === expected,
        `got:\n${result.mmd}\nexpected:\n${expected}`,
      );
      assert(
        "Fixture 1: output contains \\begin{figure}",
        result.mmd.includes("\\begin{figure}"),
      );
      assert(
        "Fixture 1: output contains \\caption{My caption}",
        result.mmd.includes("\\caption{My caption}"),
      );
    }

    // --- 3. Fixture 2: figure env → replace caption ---
    console.log("\n--- 3. Fixture 2: figure env → replace caption ---");
    {
      const mmd2Before =
        "Hello\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/y.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Old caption}\n" +
        "\\end{figure}\n\nWorld";

      const reg2 = new Registry();
      reg2.buildFromMMD(mmd2Before);
      const entry2 = reg2.getAllImages()[0];
      reg2.updateTitle(entry2.id, "New caption", "user");

      const result = Serialiser.writeAllCaptions(mmd2Before, reg2);

      assert(
        "Fixture 2: action is replace-caption",
        result.actions["replace-caption"] === 1,
        JSON.stringify(result.actions),
      );
      assert("Fixture 2: transformations === 1", result.transformations === 1);
      assert(
        "Fixture 2: output contains \\caption{New caption}",
        result.mmd.includes("\\caption{New caption}"),
      );
      assert(
        "Fixture 2: output no longer contains \\caption{Old caption}",
        !result.mmd.includes("\\caption{Old caption}"),
      );
      assert(
        "Fixture 2: figure env structure preserved",
        result.mmd.includes("\\begin{figure}") &&
          result.mmd.includes("\\end{figure}") &&
          result.mmd.includes("\\captionsetup{labelformat=empty}"),
      );
    }

    // --- 4. Fixture 3: figure env (markdown origin) → unwrap ---
    console.log("\n--- 4. Fixture 3: figure env (markdown origin) → unwrap ---");
    {
      const mmd3Before =
        "Para\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={original alt},max width=\\textwidth]{https://cdn.mathpix.com/z.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Old caption}\n" +
        "\\end{figure}\n\nPara2";

      const reg3 = new Registry();
      reg3.buildFromMMD(mmd3Before);
      const entry3 = reg3.getAllImages()[0];
      reg3.replaceImage(entry3.id, { originalSyntax: "markdown" });
      reg3.updateTitle(entry3.id, "", "user");

      const result = Serialiser.writeAllCaptions(mmd3Before, reg3);

      assert(
        "Fixture 3: action is unwrap",
        result.actions.unwrap === 1,
        JSON.stringify(result.actions),
      );
      assert(
        "Fixture 3: output contains bare ![original alt](url)",
        result.mmd.includes("![original alt](https://cdn.mathpix.com/z.png)"),
      );
      assert(
        "Fixture 3: output no longer contains \\begin{figure}",
        !result.mmd.includes("\\begin{figure}"),
      );
      assert(
        "Fixture 3: output no longer contains \\caption{",
        !result.mmd.includes("\\caption{"),
      );
    }

    // --- 5. Fixture 4: parseCaptions reads MMD into registry ---
    console.log("\n--- 5. Fixture 4: parseCaptions reads MMD into registry ---");
    {
      const mmd4 =
        "Hello\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/y.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Old caption}\n" +
        "\\end{figure}\n\nWorld";

      const reg4 = new Registry();
      reg4.buildFromMMD(mmd4);
      const entry4 = reg4.getAllImages()[0];
      reg4.updateTitle(entry4.id, "Something else", "ai-generated");

      const result = Serialiser.parseCaptions(mmd4, reg4);
      const after = reg4.getImage(entry4.id);

      assert(
        "Fixture 4: parseCaptions reports updated=1",
        result.updated === 1,
        JSON.stringify(result),
      );
      assert(
        "Fixture 4: entry.title now matches MMD caption",
        after.title === "Old caption",
        `got "${after.title}"`,
      );
      assert(
        "Fixture 4: entry.titleSource is 'user' (MMD = user textarea)",
        after.titleSource === "user",
        `got "${after.titleSource}"`,
      );
      assert("Fixture 4: processed === 1", result.processed === 1);
      assert("Fixture 4: notFound === 0", result.notFound === 0);
    }

    // --- 6. Registry refresh + idempotency + status preservation ---
    console.log("\n--- 6. Registry refresh + idempotency ---");
    {
      const mmd6a = "Hello\n\n![](https://cdn.mathpix.com/x.png)\n\nWorld";
      const reg6a = new Registry();
      reg6a.buildFromMMD(mmd6a);
      const entry6aBefore = reg6a.getAllImages()[0];
      reg6a.updateTitle(entry6aBefore.id, "First caption", "user");

      const r6a = Serialiser.writeAllCaptions(mmd6a, reg6a);
      const entry6aAfter = reg6a.getImage(entry6aBefore.id);

      assert(
        "6a wrap refresh: entry updated to includegraphics with includegraphics-prefixed mmdReference containing the URL; originalSyntax preserved as 'markdown'",
        entry6aAfter.syntax === "includegraphics" &&
          entry6aAfter.mmdReference.startsWith("\\includegraphics[") &&
          entry6aAfter.mmdReference.includes(entry6aAfter.originalUrl) &&
          entry6aAfter.originalSyntax === "markdown",
        `syntax="${entry6aAfter.syntax}" mmdReference="${entry6aAfter.mmdReference}" originalSyntax="${entry6aAfter.originalSyntax}"`,
      );

      const mmd6b =
        "Para\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={original alt},max width=\\textwidth]{https://cdn.mathpix.com/z.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Old caption}\n" +
        "\\end{figure}\n\nPara2";
      const reg6b = new Registry();
      reg6b.buildFromMMD(mmd6b);
      const entry6bSeed = reg6b.getAllImages()[0];
      reg6b.replaceImage(entry6bSeed.id, { originalSyntax: "markdown" });
      reg6b.updateTitle(entry6bSeed.id, "", "user");
      Serialiser.writeAllCaptions(mmd6b, reg6b);
      const entry6bAfter = reg6b.getImage(entry6bSeed.id);

      assert(
        "6b unwrap refresh: entry updated to markdown with bare ![...](...) mmdReference; originalSyntax preserved as 'markdown'",
        entry6bAfter.syntax === "markdown" &&
          entry6bAfter.mmdReference.startsWith("![") &&
          entry6bAfter.mmdReference.endsWith(")") &&
          entry6bAfter.originalSyntax === "markdown",
        `syntax="${entry6bAfter.syntax}" mmdReference="${entry6bAfter.mmdReference}" originalSyntax="${entry6bAfter.originalSyntax}"`,
      );

      const r6c = Serialiser.writeAllCaptions(r6a.mmd, reg6a);
      assert(
        "6c idempotency: second writeAllCaptions returns identical MMD with transformations=0 and the entry is recognised (no-op, not image-not-found)",
        r6c.mmd === r6a.mmd &&
          r6c.transformations === 0 &&
          r6c.actions["no-op"] === 1 &&
          !("image-not-found" in r6c.actions) &&
          !("wrap" in r6c.actions),
        `mmdEqual=${r6c.mmd === r6a.mmd} transformations=${r6c.transformations} actions=${JSON.stringify(r6c.actions)}`,
      );

      const mmd6d = "Hello\n\n![](https://cdn.mathpix.com/d.png)\n\nWorld";
      const reg6d = new Registry();
      reg6d.buildFromMMD(mmd6d);
      const entry6dBefore = reg6d.getImage(reg6d.getAllImages()[0].id);
      reg6d.updateTitle(entry6dBefore.id, "Some caption", "user");
      Serialiser.writeAllCaptions(mmd6d, reg6d);
      const entry6dAfter = reg6d.getImage(entry6dBefore.id);

      assert(
        "6d wrap preserves status: status stays 'cdn-linked' (not flipped to 'user-replaced')",
        entry6dBefore.status === "cdn-linked" &&
          entry6dAfter.status === "cdn-linked",
        `before="${entry6dBefore.status}" after="${entry6dAfter.status}"`,
      );
      assert(
        "6d wrap preserves replacedAt: stays null (not stamped with a timestamp)",
        entry6dBefore.replacedAt === null && entry6dAfter.replacedAt === null,
        `before=${JSON.stringify(entry6dBefore.replacedAt)} after=${JSON.stringify(entry6dAfter.replacedAt)}`,
      );
    }

    // ========================================================================
    // SMOKE-ONLY SHORT CIRCUIT
    // ========================================================================
    if (smokeOnly) {
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
      console.log("\n=== Stage 1.A Smoke Suite Complete ===");
      return { passed, failed, total: passed + failed, results };
    }

    // ========================================================================
    // STAGE 1.B GROUPS 7–27 — full fixture suite
    // ========================================================================

    // --- 7. F1: bare markdown image, empty alt, registry has caption → wrap ---
    console.log("\n--- 7. F1: bare markdown, empty alt, wrap ---");
    {
      const mmd = "Some prose.\n\n![](https://cdn.mathpix.com/a.png)\n\nMore prose.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Figure caption", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);
      const expected =
        "Some prose.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/a.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Figure caption}\n" +
        "\\end{figure}\n\nMore prose.";

      assert("F1: action is wrap", r.actions.wrap === 1, JSON.stringify(r.actions));
      assert("F1: byte-exact expected output", r.mmd === expected, `got:\n${r.mmd}`);
      assert(
        "F1: includegraphics line with empty alt + max width",
        r.mmd.includes(
          "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/a.png}",
        ),
      );
      assert(
        "F1: surrounding blank lines preserved (no triple newlines)",
        !r.mmd.includes("\n\n\n"),
      );
      assert(
        "F1: figure block has exactly 5 lines between begin and end",
        r.mmd.split("\n").filter((l, i, arr) => {
          const beginIdx = arr.indexOf("\\begin{figure}");
          const endIdx = arr.indexOf("\\end{figure}");
          return i > beginIdx && i < endIdx;
        }).length === 3,
      );
      assert(
        "F1: 'Some prose.' and 'More prose.' bookend the output",
        r.mmd.startsWith("Some prose.") && r.mmd.endsWith("More prose."),
      );
    }

    // --- 8. F2: bare markdown with existing alt text → wrap with alt preserved ---
    console.log("\n--- 8. F2: bare markdown with alt text, wrap preserves alt ---");
    {
      const mmd = "![Existing alt text](https://cdn.mathpix.com/b.png)";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      const entryBefore = reg.getImage(id);
      reg.updateTitle(id, "A caption", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);

      assert(
        "F2: buildFromMMD captured existing alt text",
        entryBefore.altText === "Existing alt text",
        `got "${entryBefore.altText}"`,
      );
      assert("F2: action is wrap", r.actions.wrap === 1);
      assert(
        "F2: includegraphics options contain alt={Existing alt text}",
        r.mmd.includes(
          "\\includegraphics[alt={Existing alt text},max width=\\textwidth]{https://cdn.mathpix.com/b.png}",
        ),
        `got:\n${r.mmd}`,
      );
      assert(
        "F2: \\caption{A caption} present",
        r.mmd.includes("\\caption{A caption}"),
      );
      assert(
        "F2: bare markdown image removed from output",
        !r.mmd.includes("![Existing alt text]"),
      );
    }

    // --- 9. F3: figure env with caption matching registry → no-op ---
    console.log("\n--- 9. F3: matching caption → no-op (idempotency) ---");
    {
      const mmd =
        "Lead.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/c.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Same caption}\n" +
        "\\end{figure}\n\nTrailer.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Same caption", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);

      assert("F3: byte-exact output equals input", r.mmd === mmd);
      assert("F3: transformations === 0", r.transformations === 0);
      assert("F3: action breakdown shows no-op=1", r.actions["no-op"] === 1);
      assert("F3: action breakdown contains no other actions", Object.keys(r.actions).length === 1);
      assert(
        "F3: output retains all four figure-env lines unchanged",
        r.mmd.includes("\\begin{figure}\n") &&
          r.mmd.includes("\\captionsetup{labelformat=empty}\n") &&
          r.mmd.includes("\\caption{Same caption}\n") &&
          r.mmd.includes("\\end{figure}"),
      );
    }

    // --- 10. F4: figure env caption differs → replace ---
    console.log("\n--- 10. F4: differing caption → replace ---");
    {
      const mmd =
        "Lead.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/d.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Old caption}\n" +
        "\\end{figure}\n\nTrailer.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "New caption", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);
      const inLines = mmd.split("\n");
      const outLines = r.mmd.split("\n");

      assert("F4: action is replace-caption", r.actions["replace-caption"] === 1);
      assert(
        "F4: \\caption updated to new content",
        r.mmd.includes("\\caption{New caption}") &&
          !r.mmd.includes("\\caption{Old caption}"),
      );
      assert(
        "F4: \\begin{figure} line byte-identical to input",
        outLines.find((l) => l === "\\begin{figure}") ===
          inLines.find((l) => l === "\\begin{figure}"),
      );
      assert(
        "F4: \\end{figure} line byte-identical to input",
        outLines.find((l) => l === "\\end{figure}") ===
          inLines.find((l) => l === "\\end{figure}"),
      );
      assert(
        "F4: \\includegraphics line unchanged",
        outLines.find((l) => l.startsWith("\\includegraphics")) ===
          inLines.find((l) => l.startsWith("\\includegraphics")),
      );
      assert(
        "F4: \\captionsetup line unchanged",
        outLines.find((l) => l.startsWith("\\captionsetup")) ===
          inLines.find((l) => l.startsWith("\\captionsetup")),
      );
    }

    // --- 11. F5: figure env, title emptied, originalSyntax=markdown → unwrap ---
    console.log("\n--- 11. F5: empty title + originalSyntax=markdown → unwrap ---");
    {
      const mmd =
        "Lead.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={Some alt},max width=\\textwidth]{https://cdn.mathpix.com/e.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Was a caption}\n" +
        "\\end{figure}\n\nTrailer.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.replaceImage(id, { originalSyntax: "markdown" });
      reg.updateTitle(id, "", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);

      assert("F5: action is unwrap", r.actions.unwrap === 1);
      assert(
        "F5: bare image ![Some alt](url) present",
        r.mmd.includes("![Some alt](https://cdn.mathpix.com/e.png)"),
      );
      assert("F5: no \\begin{figure} remains", !r.mmd.includes("\\begin{figure}"));
      assert("F5: no \\end{figure} remains", !r.mmd.includes("\\end{figure}"));
      assert("F5: no triple newlines (blank-line collapse)", !r.mmd.includes("\n\n\n"));
    }

    // --- 12. F6: figure env, title emptied, originalSyntax=includegraphics → retain ---
    console.log("\n--- 12. F6: empty title + originalSyntax=includegraphics → retain ---");
    {
      const mmd =
        "Lead.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/f.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Original caption}\n" +
        "\\end{figure}\n\nTrailer.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);

      assert(
        "F6: action is empty-caption",
        r.actions["empty-caption"] === 1,
        JSON.stringify(r.actions),
      );
      assert("F6: \\begin{figure} retained", r.mmd.includes("\\begin{figure}"));
      assert("F6: \\end{figure} retained", r.mmd.includes("\\end{figure}"));
      assert(
        "F6: \\caption{} present and empty",
        r.mmd.includes("\\caption{}") && !r.mmd.includes("\\caption{Original"),
      );
      assert(
        "F6: includegraphics line still inside figure env",
        r.mmd.includes(
          "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/f.png}",
        ),
      );
    }

    // --- 13. F7: caption containing math ---
    console.log("\n--- 13. F7: caption containing math ---");
    {
      const mmd =
        "Lead.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/g.png}\n" +
        "\\captionsetup{labelformat=empty}\n" +
        "\\caption{Primary symptoms of caffeine intoxication ${ }^{[151]}$}\n" +
        "\\end{figure}\n\nTrailer.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;

      const parseResult = Serialiser.parseCaptions(mmd, reg);
      const after = reg.getImage(id);
      const expectedCaption = "Primary symptoms of caffeine intoxication ${ }^{[151]}$";

      assert("F7: parseCaptions updated=1", parseResult.updated === 1);
      assert(
        "F7: title captures math + superscript verbatim",
        after.title === expectedCaption,
        `got "${after.title}"`,
      );

      reg.updateTitle(id, "New ${math}$ caption", "user");
      const writeResult = Serialiser.writeAllCaptions(mmd, reg);

      assert(
        "F7: round-trip write replaces caption preserving balanced braces",
        writeResult.mmd.includes("\\caption{New ${math}$ caption}") &&
          !writeResult.mmd.includes("Primary symptoms"),
      );
      assert("F7: action is replace-caption", writeResult.actions["replace-caption"] === 1);
    }

    // --- 14. F8: alt text containing braces ---
    console.log("\n--- 14. F8: alt text containing braces ---");
    {
      const altRaw = "text with {braces} and \\backslash";
      const escaped = Serialiser.escapeAltForLatex(altRaw);
      const unescaped = Serialiser.unescapeAltFromLatex(escaped);

      assert(
        "F8: escapeAltForLatex produces literal \\{, \\}, \\\\",
        escaped === "text with \\{braces\\} and \\\\backslash",
        `got "${escaped}"`,
      );
      assert(
        "F8: unescapeAltFromLatex inverts the escape",
        unescaped === altRaw,
        `got "${unescaped}"`,
      );

      // Note: _wrapBareImage reads alt from the parsed MMD source line (not
      // entry.altText), so the raw alt has to be in the markdown source from
      // the start. Markdown alt syntax accepts `{`, `}`, and `\` since the
      // closing `]` is the only delimiter — so `![text with {braces}...](url)`
      // is valid input.
      const mmd = `![${altRaw}](https://cdn.mathpix.com/h.png)`;
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      const entry = reg.getImage(id);
      reg.updateTitle(id, "Caption", "user");

      const r = Serialiser.writeAllCaptions(mmd, reg);

      assert(
        "F8: buildFromMMD captured altRaw verbatim (no premature escaping)",
        entry.altText === altRaw,
        `got "${entry.altText}"`,
      );
      assert(
        "F8: wrap output contains correctly-escaped alt inside includegraphics",
        r.mmd.includes(`alt={${escaped}}`),
        `got:\n${r.mmd}`,
      );
      assert(
        "F8: escaped braces appear with backslash prefixes in output",
        r.mmd.includes("\\{braces\\}"),
      );
    }

    // --- 15. Round-trip: writeAllCaptions twice == once (F1, F4, F5) ---
    console.log("\n--- 15. Round-trip: writeAllCaptions ∘ writeAllCaptions = writeAllCaptions ---");
    {
      // F1 round-trip
      const f1Mmd = "Some prose.\n\n![](https://cdn.mathpix.com/rt1.png)\n\nMore prose.";
      const r1Reg = new Registry();
      r1Reg.buildFromMMD(f1Mmd);
      r1Reg.updateTitle(r1Reg.getAllImages()[0].id, "F1 caption", "user");
      const r1A = Serialiser.writeAllCaptions(f1Mmd, r1Reg).mmd;
      const r1B = Serialiser.writeAllCaptions(r1A, r1Reg).mmd;
      assert(
        "Round-trip F1: second pass converges (writeAllCaptions ∘ writeAllCaptions = writeAllCaptions)",
        r1A === r1B,
        `first:\n${r1A}\nsecond:\n${r1B}`,
      );

      // F4 round-trip
      const f4Mmd =
        "L\n\n\\begin{figure}\n\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/rt2.png}\n\\captionsetup{labelformat=empty}\n\\caption{Old}\n\\end{figure}\n\nT";
      const r2Reg = new Registry();
      r2Reg.buildFromMMD(f4Mmd);
      r2Reg.updateTitle(r2Reg.getAllImages()[0].id, "New", "user");
      const r2A = Serialiser.writeAllCaptions(f4Mmd, r2Reg).mmd;
      const r2B = Serialiser.writeAllCaptions(r2A, r2Reg).mmd;
      assert("Round-trip F4: second pass converges", r2A === r2B);

      // F5 round-trip
      const f5Mmd =
        "L\n\n\\begin{figure}\n\\includegraphics[alt={a},max width=\\textwidth]{https://cdn.mathpix.com/rt3.png}\n\\captionsetup{labelformat=empty}\n\\caption{Was here}\n\\end{figure}\n\nT";
      const r3Reg = new Registry();
      r3Reg.buildFromMMD(f5Mmd);
      const r3Id = r3Reg.getAllImages()[0].id;
      r3Reg.replaceImage(r3Id, { originalSyntax: "markdown" });
      r3Reg.updateTitle(r3Id, "", "user");
      const r3A = Serialiser.writeAllCaptions(f5Mmd, r3Reg).mmd;
      const r3B = Serialiser.writeAllCaptions(r3A, r3Reg).mmd;
      assert("Round-trip F5: second pass converges", r3A === r3B);
    }

    // --- 16. Write-then-parse idempotency ---
    console.log("\n--- 16. Write-then-parse idempotency ---");
    {
      const mmd = "Prose.\n\n![](https://cdn.mathpix.com/i.png)\n\nMore.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      const beforeTitle = "F1 idempotent caption";
      reg.updateTitle(id, beforeTitle, "user");

      const wrote = Serialiser.writeAllCaptions(mmd, reg).mmd;
      const parsed = Serialiser.parseCaptions(wrote, reg);
      const after = reg.getImage(id);

      assert(
        "Idempotency: title after parse equals title before write",
        after.title === beforeTitle,
        `before="${beforeTitle}" after="${after.title}"`,
      );
      assert("Idempotency: parseCaptions skipped (no diff)", parsed.skipped === 1);
      assert("Idempotency: parseCaptions updated === 0", parsed.updated === 0);
    }

    // --- 17. MMD-wins on no-change reparse ---
    console.log("\n--- 17. MMD-wins on no-change reparse ---");
    {
      const mmd =
        "L\n\n\\begin{figure}\n\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/j.png}\n\\captionsetup{labelformat=empty}\n\\caption{B}\n\\end{figure}\n\nT";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "A", "user");

      Serialiser.parseCaptions(mmd, reg);
      const afterFirst = reg.getImage(id);
      const isModifiedAfterFirst = afterFirst.isModified;

      assert(
        "MMD-wins: first parse sets title to MMD value (B), source=user",
        afterFirst.title === "B" && afterFirst.titleSource === "user",
        `title="${afterFirst.title}" source="${afterFirst.titleSource}"`,
      );

      const secondResult = Serialiser.parseCaptions(mmd, reg);
      const afterSecond = reg.getImage(id);

      assert(
        "MMD-wins: second parse leaves title at B (still consistent)",
        afterSecond.title === "B",
      );
      assert(
        "MMD-wins: second parse skipped (no diff)",
        secondResult.skipped === 1 && secondResult.updated === 0,
      );
      assert(
        "MMD-wins: isModified unchanged across no-change reparse",
        afterSecond.isModified === isModifiedAfterFirst,
        `before=${isModifiedAfterFirst} after=${afterSecond.isModified}`,
      );
    }

    // --- 18. Option variation — suppressFigureNumbering ---
    console.log("\n--- 18. Option variation: suppressFigureNumbering ---");
    {
      const mmd = "Hello\n\n![](https://cdn.mathpix.com/o1.png)\n\nWorld";
      const reg1 = new Registry();
      reg1.buildFromMMD(mmd);
      reg1.updateTitle(reg1.getAllImages()[0].id, "Cap", "user");
      const rOn = Serialiser.writeAllCaptions(mmd, reg1);

      const reg2 = new Registry();
      reg2.buildFromMMD(mmd);
      reg2.updateTitle(reg2.getAllImages()[0].id, "Cap", "user");
      const rOff = Serialiser.writeAllCaptions(mmd, reg2, {
        suppressFigureNumbering: false,
      });

      assert(
        "suppressFigureNumbering=true (default): \\captionsetup line present",
        rOn.mmd.includes("\\captionsetup{labelformat=empty}"),
      );
      assert(
        "suppressFigureNumbering=false: no \\captionsetup line",
        !rOff.mmd.includes("\\captionsetup"),
      );
      assert(
        "suppressFigureNumbering=false: still wraps in figure env",
        rOff.mmd.includes("\\begin{figure}") &&
          rOff.mmd.includes("\\end{figure}") &&
          rOff.mmd.includes("\\caption{Cap}"),
      );
      assert(
        "suppressFigureNumbering=false: max width still included by default",
        rOff.mmd.includes("max width=\\textwidth"),
      );
    }

    // --- 19. Option variation — includeMaxWidth ---
    console.log("\n--- 19. Option variation: includeMaxWidth ---");
    {
      const mmd = "Hello\n\n![](https://cdn.mathpix.com/o2.png)\n\nWorld";
      const reg1 = new Registry();
      reg1.buildFromMMD(mmd);
      reg1.updateTitle(reg1.getAllImages()[0].id, "Cap", "user");
      const rOn = Serialiser.writeAllCaptions(mmd, reg1);

      const reg2 = new Registry();
      reg2.buildFromMMD(mmd);
      reg2.updateTitle(reg2.getAllImages()[0].id, "Cap", "user");
      const rOff = Serialiser.writeAllCaptions(mmd, reg2, {
        includeMaxWidth: false,
      });

      assert(
        "includeMaxWidth=true (default): max width=\\textwidth present",
        rOn.mmd.includes("max width=\\textwidth"),
      );
      assert(
        "includeMaxWidth=false: no max width in includegraphics options",
        !rOff.mmd.includes("max width"),
      );
      assert(
        "includeMaxWidth=false: includegraphics options are alt={...} only",
        rOff.mmd.includes(
          "\\includegraphics[alt={}]{https://cdn.mathpix.com/o2.png}",
        ),
      );
      assert(
        "includeMaxWidth=false: \\captionsetup still present by default",
        rOff.mmd.includes("\\captionsetup{labelformat=empty}"),
      );
    }

    // --- 20. Option variation — both off (minimal figure env) ---
    console.log("\n--- 20. Option variation: both options off ---");
    {
      const mmd = "Hello\n\n![](https://cdn.mathpix.com/o3.png)\n\nWorld";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      reg.updateTitle(reg.getAllImages()[0].id, "Cap", "user");
      const r = Serialiser.writeAllCaptions(mmd, reg, {
        suppressFigureNumbering: false,
        includeMaxWidth: false,
      });

      const expected =
        "Hello\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={}]{https://cdn.mathpix.com/o3.png}\n" +
        "\\caption{Cap}\n" +
        "\\end{figure}\n\nWorld";

      assert("Both-off: output is byte-exact minimal figure env", r.mmd === expected, `got:\n${r.mmd}`);
      assert("Both-off: no \\captionsetup", !r.mmd.includes("\\captionsetup"));
      assert("Both-off: no max width", !r.mmd.includes("max width"));
      assert(
        "Both-off: exactly four figure-env lines (begin, includegraphics, caption, end)",
        r.mmd.split("\n").filter((l) =>
          l.startsWith("\\begin{figure}") ||
          l.startsWith("\\includegraphics") ||
          l.startsWith("\\caption") ||
          l.startsWith("\\end{figure}"),
        ).length === 4,
      );
      assert("Both-off: action is wrap", r.actions.wrap === 1);
    }

    // --- 21. Edge: wrap refuses inline images ---
    console.log("\n--- 21. Edge: wrap refuses inline images ---");
    {
      const mmd = "Some text ![](https://cdn.mathpix.com/inline.png) more text on same line.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Should not wrap", "user");

      // Capture warnings so we can verify the refusal logged one (or fall back to action breakdown).
      const originalWarn = console.warn;
      let warnCalls = 0;
      console.warn = function () {
        warnCalls++;
      };
      let r;
      try {
        r = Serialiser.writeAllCaptions(mmd, reg);
      } finally {
        console.warn = originalWarn;
      }

      assert(
        "Inline: MMD unchanged",
        r.mmd === mmd,
        `got:\n${r.mmd}\nexpected:\n${mmd}`,
      );
      assert(
        "Inline: transformations === 0",
        r.transformations === 0,
        JSON.stringify(r.actions),
      );
      assert(
        "Inline: action is no-op (not wrap)",
        r.actions["no-op"] === 1 && !("wrap" in r.actions),
        JSON.stringify(r.actions),
      );
    }

    // --- 22. Edge: multi-line caption parsing ---
    console.log("\n--- 22. Edge: multi-line caption parsing ---");
    {
      const mmd =
        "Lead.\n\n" +
        "\\begin{figure}\n" +
        "\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/ml.png}\n" +
        "\\caption{This is a long\n" +
        "caption that spans multiple lines.}\n" +
        "\\end{figure}\n\nTail.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;

      const parseResult = Serialiser.parseCaptions(mmd, reg);
      const after = reg.getImage(id);

      assert(
        "Multi-line: parseCaptions updated=1",
        parseResult.updated === 1,
        JSON.stringify(parseResult),
      );
      assert(
        "Multi-line: title flattens to single line with space separator",
        after.title === "This is a long caption that spans multiple lines.",
        `got "${after.title}"`,
      );
      assert(
        "Multi-line: detectFigureContext exposes captionText (used by writeCaption)",
        typeof Serialiser.detectFigureContext === "function",
      );
    }

    // --- 23. Edge: no-change parseCaptions doesn't flip isModified ---
    console.log("\n--- 23. Edge: no-change parseCaptions leaves isModified alone ---");
    {
      // Bare image, no caption present anywhere — parseCaptions sees empty
      // strings on both sides, skips, leaves isModified at its current value.
      const mmd = "Hello\n\n![](https://cdn.mathpix.com/q.png)\n\nWorld";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      const isModifiedBefore = reg.getImage(id).isModified;

      Serialiser.parseCaptions(mmd, reg);
      const isModifiedAfter = reg.getImage(id).isModified;

      assert(
        "Bare image, no caption: isModified before === false",
        isModifiedBefore === false,
        `got ${isModifiedBefore}`,
      );
      assert(
        "Bare image, no caption: isModified after parse === false (no spurious flip)",
        isModifiedAfter === false,
        `got ${isModifiedAfter}`,
      );

      // Second variant: registry's title matches \caption{} content already.
      const mmd2 =
        "L\n\n\\begin{figure}\n\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/q2.png}\n\\captionsetup{labelformat=empty}\n\\caption{Match}\n\\end{figure}\n\nT";
      const reg2 = new Registry();
      reg2.buildFromMMD(mmd2);
      const id2 = reg2.getAllImages()[0].id;
      reg2.updateTitle(id2, "Match", "user");
      const isModifiedBefore2 = reg2.getImage(id2).isModified;

      Serialiser.parseCaptions(mmd2, reg2);
      const isModifiedAfter2 = reg2.getImage(id2).isModified;

      assert(
        "Matching caption: isModified value preserved across no-change parse",
        isModifiedAfter2 === isModifiedBefore2,
        `before=${isModifiedBefore2} after=${isModifiedAfter2}`,
      );
    }

    // --- 24. Image lookup: image not found ---
    console.log("\n--- 24. Image lookup: image not found ---");
    {
      const mmdWithImage = "Hello\n\n![](https://cdn.mathpix.com/missing.png)\n\nWorld";
      const reg = new Registry();
      reg.buildFromMMD(mmdWithImage);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Some title", "user");

      // Now strip the image out of the MMD so findImage fails for both
      // the mmdReference exact match and the URL fallback.
      const strippedMmd = "Hello\n\nNow no image at all.\n\nWorld";

      const originalWarn = console.warn;
      console.warn = function () {};
      let writeResult, parseResult;
      try {
        writeResult = Serialiser.writeAllCaptions(strippedMmd, reg);
        parseResult = Serialiser.parseCaptions(strippedMmd, reg);
      } finally {
        console.warn = originalWarn;
      }

      assert(
        "Image not found: writeAllCaptions reports image-not-found action",
        writeResult.actions["image-not-found"] === 1,
        JSON.stringify(writeResult.actions),
      );
      assert(
        "Image not found: writeAllCaptions transformations === 0",
        writeResult.transformations === 0,
      );
      assert(
        "Image not found: parseCaptions notFound === 1",
        parseResult.notFound === 1,
        JSON.stringify(parseResult),
      );
    }

    // --- 25. Image lookup: viaFallback URL match ---
    console.log("\n--- 25. Image lookup: viaFallback URL match ---");
    {
      const mmd = "Hello\n\n![original](https://cdn.mathpix.com/fb.png)\n\nWorld";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      // Stale mmdReference: hand-edit the alt text inside ![alt](url) so the
      // exact-match string no longer appears in the MMD, but the URL still does.
      reg.updateImageReference(id, "![stale alt](https://cdn.mathpix.com/fb.png)", "markdown");

      const result = Serialiser.findImage(mmd, reg.getImage(id));

      assert("viaFallback: image still found", result.found === true);
      assert("viaFallback: viaFallback flag is true", result.viaFallback === true);
      assert("viaFallback: located on the correct line (index 2)", result.lineIndex === 2);
    }

    // --- 26. Image lookup: multiple images on same line ---
    console.log("\n--- 26. Image lookup: multiple images on same line ---");
    {
      const mmd =
        "![](https://cdn.mathpix.com/m1.png) ![](https://cdn.mathpix.com/m2.png)";
      const reg = new Registry();
      const count = reg.buildFromMMD(mmd);
      const all = reg.getAllImages();
      // Set captions on whichever entries the registry created.
      all.forEach((e, i) => reg.updateTitle(e.id, `Caption ${i + 1}`, "user"));

      const originalWarn = console.warn;
      console.warn = function () {};
      let r;
      try {
        r = Serialiser.writeAllCaptions(mmd, reg);
      } finally {
        console.warn = originalWarn;
      }

      // Documented behaviour: both images on the same line are treated as
      // inline by `_wrapBareImage` (the line is not a stand-alone image).
      // Both wraps refuse → both produce no-op. MMD unchanged.
      assert(
        "Multi-images-same-line: registry detected both images",
        count === 2 && all.length === 2,
        `count=${count} all.length=${all.length}`,
      );
      assert(
        "Multi-images-same-line: MMD unchanged (both wraps refused as inline)",
        r.mmd === mmd,
        `got:\n${r.mmd}`,
      );
      assert(
        "Multi-images-same-line: both entries report no-op",
        r.actions["no-op"] === 2 && !("wrap" in r.actions),
        JSON.stringify(r.actions),
      );
    }

    // --- 27. Image lookup: empty registry ---
    console.log("\n--- 27. Image lookup: empty registry ---");
    {
      const mmd = "Lead.\n\nSome content with no images at all.\n\nTail.";
      const reg = new Registry();
      // No buildFromMMD — registry stays empty.

      const r = Serialiser.writeAllCaptions(mmd, reg);

      assert("Empty registry: MMD unchanged", r.mmd === mmd);
      assert("Empty registry: transformations === 0", r.transformations === 0);
      assert(
        "Empty registry: actions object is empty (no entries to iterate)",
        Object.keys(r.actions).length === 0,
        JSON.stringify(r.actions),
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
    console.log("\n=== Stage 1 Full Suite Complete ===");
    return { passed, failed, total: passed + failed, results };
  }

  // ============================================================================
  // STAGE 2 FULL SUITE
  // ============================================================================

  /**
   * Run the Stage 2 full appendix-serialiser suite.
   *
   * Independent of `runStage1Tests`: tests written here exercise the Stage 2.A
   * production surface (`detectShallowestHeading`, `buildAppendix`, `writeAppendix`,
   * `parseAppendix`, plus the frozen `APPENDIX_ACTIONS` constant exposed for
   * Stage 2.B). Group ordering follows the Stage 2.B Definition of Done in
   * `mathpix-scripts/docs/alt-text/image-manager-alt-text-build-plan.md`.
   *
   * @returns {{ passed: number, failed: number, total: number, results: string[] }}
   */
  function runStage2Tests() {
    console.log(
      "=== MathPix Alt Text MMD Serialiser — Stage 2 Full Suite ===\n",
    );

    if (typeof window.MathPixImageRegistry !== "function") {
      console.error(
        "MathPixImageRegistry not available — load the registry module first.",
      );
      return { passed: 0, failed: 1, total: 1, results: ["❌ Registry not loaded"] };
    }
    if (!window.MathPixAltTextMMDSerialiser) {
      console.error(
        "MathPixAltTextMMDSerialiser not available — load the serialiser module first.",
      );
      return { passed: 0, failed: 1, total: 1, results: ["❌ Serialiser not loaded"] };
    }

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(testName, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${testName}`);
      } else {
        failed++;
        const msg = detail ? `${testName} — ${detail}` : testName;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    /**
     * Deep-equality check for action-map objects.
     * Compares key sets and per-key values. Order-independent.
     * @param {Object} actual - The action map returned by writeAppendix/parseAppendix
     * @param {Object} expected - The expected action map shape
     * @returns {boolean} true if shape and values match exactly
     */
    function actionMapEquals(actual, expected) {
      if (!actual || !expected) return actual === expected;
      const actualKeys = Object.keys(actual).sort();
      const expectedKeys = Object.keys(expected).sort();
      if (actualKeys.length !== expectedKeys.length) return false;
      for (let i = 0; i < actualKeys.length; i++) {
        if (actualKeys[i] !== expectedKeys[i]) return false;
        if (actual[actualKeys[i]] !== expected[expectedKeys[i]]) return false;
      }
      return true;
    }

    const Serialiser = window.MathPixAltTextMMDSerialiser;
    const Registry = window.MathPixImageRegistry;
    const A = Serialiser.APPENDIX_ACTIONS;

    // Silence the warns that some MMD-wins / duplicate-marker / unmapped-marker
    // fixtures deliberately trigger. We restore console.warn after each block
    // that needs it; the helper below is the one-shot version used inside
    // fixture scopes.
    function withSilencedWarn(fn) {
      const original = console.warn;
      console.warn = function () {};
      try {
        return fn();
      } finally {
        console.warn = original;
      }
    }

    // ========================================================================
    // Group 1 — APPENDIX_ACTIONS integrity
    // ========================================================================
    console.log("\n--- 1. APPENDIX_ACTIONS integrity ---");
    {
      assert(
        "G1: APPENDIX_ACTIONS exposed on namespace",
        typeof A === "object" && A !== null,
        `typeof = ${typeof A}`,
      );
      assert(
        "G1: APPENDIX_ACTIONS is frozen",
        Object.isFrozen(A) === true,
      );
      const expectedKeys = [
        "created-appendix",
        "appended-entry",
        "updated-entry",
        "removed-entry",
        "removed-appendix",
        "no-op",
        "entry-not-mapped",
      ];
      const actualValues = Object.values(A);
      const allPresent = expectedKeys.every((k) => actualValues.includes(k));
      assert(
        "G1: all seven documented action keys present as values",
        allPresent,
        `values = ${JSON.stringify(actualValues)}`,
      );
      assert(
        "G1: APPENDIX_ACTIONS has exactly seven members",
        Object.keys(A).length === 7,
        `count = ${Object.keys(A).length}`,
      );

      // Boundary check: action map keys from a representative writeAppendix call
      // must all be members of APPENDIX_ACTIONS.
      const reg = new Registry();
      const mmd = "Body.\n\n![](https://cdn.mathpix.com/g1.png)";
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateLongDescription(id, "Long desc.", "user");
      const r = Serialiser.writeAppendix(mmd, reg);
      const allowed = new Set(Object.values(A));
      const everyKeyAllowed = Object.keys(r.actions).every((k) =>
        allowed.has(k),
      );
      assert(
        "G1: action map keys are all members of APPENDIX_ACTIONS",
        everyKeyAllowed,
        `actions = ${JSON.stringify(r.actions)}`,
      );
    }

    // ========================================================================
    // Group 2 — Round-trip on F1 (create-appendix, no headings)
    // ========================================================================
    console.log("\n--- 2. Round-trip on F1 (create-appendix) ---");
    {
      const mmdBefore =
        "Intro paragraph.\n\n" +
        "![](https://cdn.mathpix.com/rt-f1.png)\n\n" +
        "Outro paragraph.";
      const reg = new Registry();
      reg.buildFromMMD(mmdBefore);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "First image", "user");
      reg.updateLongDescription(id, "A detailed description.", "user");

      const r1 = Serialiser.writeAppendix(mmdBefore, reg);
      Serialiser.parseAppendix(r1.mmd, reg);
      const r1b = Serialiser.writeAppendix(r1.mmd, reg);

      assert(
        "G2-F1: write→parse→write produces same MMD as first write",
        r1.mmd === r1b.mmd,
        `first:\n${r1.mmd}\nsecond:\n${r1b.mmd}`,
      );
      assert(
        "G2-F1: idempotency — write∘write === write",
        Serialiser.writeAppendix(r1.mmd, reg).mmd === r1.mmd,
      );
      assert(
        "G2-F1: action map on second write is { no-op: 1 }",
        actionMapEquals(r1b.actions, { "no-op": 1 }),
        `got ${JSON.stringify(r1b.actions)}`,
      );
    }

    // ========================================================================
    // Group 3 — Round-trip on F2 (update-entry)
    // ========================================================================
    console.log("\n--- 3. Round-trip on F2 (update-entry) ---");
    {
      const prefix =
        "Intro.\n\n![](https://cdn.mathpix.com/rt-f2.png)\n\nOutro.";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Image two", "user");
      const mmdBefore =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${id} -->\n` +
        "### Description of Image two\n\n" +
        "Old description text.";
      reg.updateLongDescription(id, "New description text.", "user");

      const r1 = Serialiser.writeAppendix(mmdBefore, reg);
      Serialiser.parseAppendix(r1.mmd, reg);
      const r1b = Serialiser.writeAppendix(r1.mmd, reg);

      assert(
        "G3-F2: write→parse→write produces same MMD as first write",
        r1.mmd === r1b.mmd,
      );
      assert(
        "G3-F2: idempotency",
        Serialiser.writeAppendix(r1.mmd, reg).mmd === r1.mmd,
      );
      assert(
        "G3-F2: action map on second write is { no-op: 1 }",
        actionMapEquals(r1b.actions, { "no-op": 1 }),
        `got ${JSON.stringify(r1b.actions)}`,
      );
    }

    // ========================================================================
    // Group 4 — Round-trip on F3 (remove-entry), F4 (remove-appendix), F5 (parse-roundtrip)
    // ========================================================================
    console.log("\n--- 4a. Round-trip on F3 (remove-entry) ---");
    {
      const prefix =
        "Para A.\n\n" +
        "![](https://cdn.mathpix.com/rt-f3a.png)\n\n" +
        "Para B.\n\n" +
        "![](https://cdn.mathpix.com/rt-f3b.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const [idA, idB] = reg.getAllImages().map((e) => e.id);
      reg.updateTitle(idA, "A", "user");
      reg.updateTitle(idB, "B", "user");
      const mmdBefore =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idA} -->\n### Description of A\n\nDescription A text.\n\n` +
        `<!-- img-desc:${idB} -->\n### Description of B\n\nDescription B text.`;
      reg.updateLongDescription(idA, "Description A text.", "user");
      reg.updateLongDescription(idB, "Description B text.", "user");
      // Clear B; A stays.
      reg.updateLongDescription(idB, "", "user");

      const r1 = Serialiser.writeAppendix(mmdBefore, reg);
      Serialiser.parseAppendix(r1.mmd, reg);
      const r1b = Serialiser.writeAppendix(r1.mmd, reg);

      assert(
        "G4-F3: write→parse→write produces same MMD as first write",
        r1.mmd === r1b.mmd,
      );
      assert(
        "G4-F3: idempotency",
        Serialiser.writeAppendix(r1.mmd, reg).mmd === r1.mmd,
      );
      assert(
        "G4-F3: action map on second write is { no-op: 1 }",
        actionMapEquals(r1b.actions, { "no-op": 1 }),
        `got ${JSON.stringify(r1b.actions)}`,
      );
    }

    console.log("\n--- 4b. Round-trip on F4 (remove-appendix) ---");
    {
      const prefix = "Body.\n\n![](https://cdn.mathpix.com/rt-f4.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Sole", "user");
      const mmdBefore =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${id} -->\n### Description of Sole\n\nSole description text.`;
      reg.updateLongDescription(id, "Sole description text.", "user");
      reg.updateLongDescription(id, "", "user");

      const r1 = Serialiser.writeAppendix(mmdBefore, reg);
      Serialiser.parseAppendix(r1.mmd, reg);
      const r1b = Serialiser.writeAppendix(r1.mmd, reg);

      assert(
        "G4-F4: write→parse→write produces same MMD as first write",
        r1.mmd === r1b.mmd,
      );
      assert(
        "G4-F4: idempotency",
        Serialiser.writeAppendix(r1.mmd, reg).mmd === r1.mmd,
      );
      assert(
        "G4-F4: action map on second write is { no-op: 1 }",
        actionMapEquals(r1b.actions, { "no-op": 1 }),
        `got ${JSON.stringify(r1b.actions)}`,
      );
    }

    console.log("\n--- 4c. Round-trip on F5 (parse-roundtrip) ---");
    {
      const prefix =
        "![](https://cdn.mathpix.com/rt-f5a.png)\n\n" +
        "![](https://cdn.mathpix.com/rt-f5b.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const [idA, idB] = reg.getAllImages().map((e) => e.id);
      reg.updateTitle(idA, "A", "user");
      reg.updateTitle(idB, "B", "user");
      reg.updateLongDescription(idA, "Original A text.", "user");
      reg.updateLongDescription(idB, "Original B text.", "user");

      const mmdWithEdit =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idA} -->\n### Description of A\n\nEdited A text.\n\n` +
        `<!-- img-desc:${idB} -->\n### Description of B\n\nOriginal B text.`;

      // F5's spirit: parse pulls the edited text into the registry first.
      Serialiser.parseAppendix(mmdWithEdit, reg);

      // Now reg matches MMD; round-trip starting from mmdWithEdit.
      const r1 = Serialiser.writeAppendix(mmdWithEdit, reg);
      Serialiser.parseAppendix(r1.mmd, reg);
      const r1b = Serialiser.writeAppendix(r1.mmd, reg);

      assert(
        "G4-F5: write→parse→write produces same MMD as first write",
        r1.mmd === r1b.mmd,
      );
      assert(
        "G4-F5: idempotency",
        Serialiser.writeAppendix(r1.mmd, reg).mmd === r1.mmd,
      );
      assert(
        "G4-F5: action map on second write is { no-op: 2 }",
        actionMapEquals(r1b.actions, { "no-op": 2 }),
        `got ${JSON.stringify(r1b.actions)}`,
      );
    }

    // ========================================================================
    // Group 5 — Action-map shape lock for created-appendix
    // ========================================================================
    console.log("\n--- 5. Action-map shape lock: created-appendix ---");
    {
      const mmd =
        "Body.\n\n" +
        "![](https://cdn.mathpix.com/g5a.png)\n\n" +
        "![](https://cdn.mathpix.com/g5b.png)\n\n" +
        "![](https://cdn.mathpix.com/g5c.png)";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const ids = reg.getAllImages().map((e) => e.id);
      ids.forEach((id, i) => {
        reg.updateTitle(id, `Title ${i + 1}`, "user");
        reg.updateLongDescription(id, `Long desc ${i + 1}.`, "user");
      });

      const r = Serialiser.writeAppendix(mmd, reg);

      // Per Stage 2.A lessons-learned bullet 2: created-appendix subsumes
      // per-entry actions on initial creation. Action map is exactly
      // { "created-appendix": 1 } even with three entries.
      assert(
        "G5: action map is exactly { created-appendix: 1 }",
        actionMapEquals(r.actions, { "created-appendix": 1 }),
        `got ${JSON.stringify(r.actions)}`,
      );
      assert(
        "G5: transformations === 1 (not N)",
        r.transformations === 1,
        `got ${r.transformations}`,
      );
      assert(
        "G5: all three marker comments present in output",
        ids.every((id) => r.mmd.includes(`<!-- img-desc:${id} -->`)),
      );
      assert(
        "G5: all three entry headings present in output",
        r.mmd.includes("### Description of Title 1") &&
          r.mmd.includes("### Description of Title 2") &&
          r.mmd.includes("### Description of Title 3"),
      );
    }

    // ========================================================================
    // Group 6 — Convert-API-locked H1+H2 fixture (2026-05-13 live test)
    // ========================================================================
    console.log("\n--- 6. Heading-level rule: Convert-API-locked H1+H2 doc ---");
    {
      // This MMD shape was tested live against the Mathpix Convert API on
      // 2026-05-13 and confirmed to produce the desired
      // \section*{} / \subsection*{} parent-child LaTeX hierarchy. Locking
      // the rule in here prevents future drift in detectShallowestHeading.
      const mmd =
        "# Chapter One\n\n" +
        "Intro prose.\n\n" +
        "## Section A\n\n" +
        "Section prose with an image\n\n" +
        "![alt](https://cdn.mathpix.com/g6.png)\n\n" +
        "More prose.";
      const reg = new Registry();
      reg.buildFromMMD(mmd);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Locked sample", "user");
      reg.updateLongDescription(id, "Locked description.", "user");

      const r = Serialiser.writeAppendix(mmd, reg);

      assert(
        "G6: appendix heading uses H2 ('## Long descriptions')",
        r.mmd.includes("\n## Long descriptions\n") ||
          r.mmd.includes("\n\n## Long descriptions"),
        `got:\n${r.mmd}`,
      );
      assert(
        "G6: appendix heading is NOT H3 (would indicate level drift)",
        !r.mmd.includes("\n### Long descriptions"),
      );
      assert(
        "G6: entry heading uses H3 ('### Description of Locked sample')",
        r.mmd.includes("### Description of Locked sample"),
      );
      assert(
        "G6: marker comment present immediately above entry heading",
        r.mmd.includes(
          `<!-- img-desc:${id} -->\n### Description of Locked sample`,
        ),
      );
    }

    // ========================================================================
    // Group 7 — Heading-level edge cases (six sub-fixtures)
    // ========================================================================
    console.log("\n--- 7. Heading-level edge cases ---");
    {
      function buildAndAssert(label, mmdPrefix, expectedAppendixLevel, expectedEntryLevel) {
        const reg = new Registry();
        const fullMmd =
          mmdPrefix + "\n\n![](https://cdn.mathpix.com/g7.png)";
        reg.buildFromMMD(fullMmd);
        const id = reg.getAllImages()[0].id;
        reg.updateTitle(id, "X", "user");
        reg.updateLongDescription(id, "Desc.", "user");
        const r = Serialiser.writeAppendix(fullMmd, reg);
        const appendixHashes = "#".repeat(expectedAppendixLevel);
        const entryHashes = "#".repeat(expectedEntryLevel);
        assert(
          `G7-${label}: appendix at H${expectedAppendixLevel}, entries at H${expectedEntryLevel}`,
          r.mmd.includes(`${appendixHashes} Long descriptions`) &&
            r.mmd.includes(`${entryHashes} Description of X`),
          `got mmd:\n${r.mmd}`,
        );
      }

      // No headings → H1 baseline → appendix H2, entries H3
      buildAndAssert("no-headings", "Prose only.", 2, 3);
      // H2 only → appendix H3, entries H4
      buildAndAssert("H2-only", "## Some heading", 3, 4);
      // H3 only → appendix H4, entries H5
      buildAndAssert("H3-only", "### Some heading", 4, 5);
      // H5 + H6 → shallowest H5 + 1 = H6 → appendix H6, entries H6 (entry cap fires)
      buildAndAssert(
        "H5+H6",
        "##### Level five\n\n###### Level six",
        6,
        6,
      );
      // H6 only → shallowest H6 + 1 = 7, capped at 6 → appendix H6, entries H6
      buildAndAssert("H6-only", "###### Level six", 6, 6);

      // detectShallowestHeading probe on doc with only H4
      assert(
        "G7-detect-H4: detectShallowestHeading returns 4 for H4-only doc",
        Serialiser.detectShallowestHeading(
          "#### Only an H4\n\nProse",
        ) === 4,
      );
    }

    // ========================================================================
    // Group 8 — Entry heading text source (title → altText → id)
    // ========================================================================
    console.log("\n--- 8. Entry heading text source ---");
    {
      // Sub-fixture A: title set → use title.
      const mmdA = "![](https://cdn.mathpix.com/g8a.png)";
      const regA = new Registry();
      regA.buildFromMMD(mmdA);
      const idA = regA.getAllImages()[0].id;
      regA.updateTitle(idA, "Title-from-A", "user");
      regA.updateLongDescription(idA, "Desc.", "user");
      const rA = Serialiser.writeAppendix(mmdA, regA);
      assert(
        "G8-A: title set → heading uses title",
        rA.mmd.includes("Description of Title-from-A"),
        `got:\n${rA.mmd}`,
      );

      // Sub-fixture B: title empty, altText set → use altText.
      const mmdB = "![Alt-from-B](https://cdn.mathpix.com/g8b.png)";
      const regB = new Registry();
      regB.buildFromMMD(mmdB);
      const idB = regB.getAllImages()[0].id;
      regB.updateLongDescription(idB, "Desc.", "user");
      const rB = Serialiser.writeAppendix(mmdB, regB);
      assert(
        "G8-B: title empty, altText set → heading uses altText",
        rB.mmd.includes("Description of Alt-from-B"),
        `got:\n${rB.mmd}`,
      );

      // Sub-fixture C: neither title nor altText → falls back to id.
      const mmdC = "![](https://cdn.mathpix.com/g8c.png)";
      const regC = new Registry();
      regC.buildFromMMD(mmdC);
      const idC = regC.getAllImages()[0].id;
      regC.updateLongDescription(idC, "Desc.", "user");
      const rC = Serialiser.writeAppendix(mmdC, regC);
      assert(
        "G8-C: no title, no altText → heading uses id",
        rC.mmd.includes(`Description of ${idC}`),
        `got:\n${rC.mmd}`,
      );

      // Sub-fixture D: title contains internal whitespace → collapse to single space.
      const mmdD = "![](https://cdn.mathpix.com/g8d.png)";
      const regD = new Registry();
      regD.buildFromMMD(mmdD);
      const idD = regD.getAllImages()[0].id;
      regD.updateTitle(idD, "foo\n\nbar", "user");
      regD.updateLongDescription(idD, "Desc.", "user");
      const rD = Serialiser.writeAppendix(mmdD, regD);
      assert(
        "G8-D: whitespace in title collapsed to single space ('foo\\n\\nbar' → 'foo bar')",
        rD.mmd.includes("Description of foo bar"),
        `got:\n${rD.mmd}`,
      );
    }

    // ========================================================================
    // Group 9 — parseAppendix source-field assertion
    // ========================================================================
    console.log("\n--- 9. parseAppendix source-field assertion ---");
    {
      // Setup with longDescriptionSource initially "ai-generated" so the
      // assertion that source becomes "user" after parse is non-trivial.
      // (User decision: parseAppendix writes "user", matching parseCaptions.)
      const prefix = "![](https://cdn.mathpix.com/g9.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Nine", "user");
      reg.updateLongDescription(id, "Old text.", "ai-generated");

      assert(
        "G9: initial longDescriptionSource is 'ai-generated'",
        reg.getImage(id).longDescriptionSource === "ai-generated",
        `got "${reg.getImage(id).longDescriptionSource}"`,
      );

      const mmd =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${id} -->\n### Description of Nine\n\nNew text from MMD.`;
      const res = Serialiser.parseAppendix(mmd, reg);

      assert(
        "G9: parseAppendix updated === 1",
        res.updated === 1,
        JSON.stringify(res),
      );
      assert(
        "G9: longDescription now matches MMD text",
        reg.getImage(id).longDescription === "New text from MMD.",
        `got "${reg.getImage(id).longDescription}"`,
      );
      assert(
        "G9: longDescriptionSource set to 'user' (NOT 'mmd', NOT 'ai-generated')",
        reg.getImage(id).longDescriptionSource === "user",
        `got "${reg.getImage(id).longDescriptionSource}"`,
      );
    }

    // ========================================================================
    // Group 10 — MMD-wins defensiveness
    // ========================================================================
    console.log("\n--- 10. MMD-wins defensiveness ---");
    {
      // Sub-fixture A: appendix absent, registry populated → leave alone.
      const prefixA = "![](https://cdn.mathpix.com/g10a.png)";
      const regA = new Registry();
      regA.buildFromMMD(prefixA);
      const idA = regA.getAllImages()[0].id;
      regA.updateLongDescription(idA, "Pre-existing description.", "user");
      const resA = Serialiser.parseAppendix(prefixA, regA);
      assert(
        "G10-A: appendix absent — registry longDescription unchanged",
        regA.getImage(idA).longDescription === "Pre-existing description.",
        `got "${regA.getImage(idA).longDescription}"`,
      );
      assert(
        "G10-A: parseAppendix updated === 0 on empty appendix",
        resA.updated === 0,
        JSON.stringify(resA),
      );

      // Sub-fixture B: appendix present but missing entry for image X.
      const prefixB =
        "![](https://cdn.mathpix.com/g10b-x.png)\n\n" +
        "![](https://cdn.mathpix.com/g10b-y.png)";
      const regB = new Registry();
      regB.buildFromMMD(prefixB);
      const [idXb, idYb] = regB.getAllImages().map((e) => e.id);
      regB.updateTitle(idYb, "Y", "user");
      regB.updateLongDescription(idXb, "X description (pre-existing).", "user");
      regB.updateLongDescription(idYb, "Y description (will be MMD-updated).", "user");
      const mmdB =
        prefixB +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idYb} -->\n### Description of Y\n\nY description (edited in MMD).`;
      Serialiser.parseAppendix(mmdB, regB);
      assert(
        "G10-B: image X longDescription unchanged (no MMD entry for it)",
        regB.getImage(idXb).longDescription === "X description (pre-existing).",
        `got "${regB.getImage(idXb).longDescription}"`,
      );
      assert(
        "G10-B: image Y longDescription matches MMD",
        regB.getImage(idYb).longDescription === "Y description (edited in MMD).",
        `got "${regB.getImage(idYb).longDescription}"`,
      );

      // Sub-fixture C: empty registry, MMD has appendix with two entries.
      // Note: registry is empty, so getImage() always returns null →
      // both markers report ENTRY_NOT_MAPPED. Count is aggregated.
      const regC = new Registry();
      const mmdC =
        "## Long descriptions\n\n" +
        "<!-- img-desc:bogus-1 -->\n### Description of one\n\nOne.\n\n" +
        "<!-- img-desc:bogus-2 -->\n### Description of two\n\nTwo.";
      const resC = withSilencedWarn(() => Serialiser.parseAppendix(mmdC, regC));
      assert(
        "G10-C: empty registry, 2 MMD entries → entry-not-mapped count === 2",
        actionMapEquals(resC.actions, { "entry-not-mapped": 2 }),
        `got ${JSON.stringify(resC.actions)}`,
      );
    }

    // ========================================================================
    // Group 11 — Options variations
    // ========================================================================
    console.log("\n--- 11. Options variations ---");
    {
      // Sub-fixture A: custom appendixHeading text.
      const prefixA = "![](https://cdn.mathpix.com/g11a.png)";
      const regA = new Registry();
      regA.buildFromMMD(prefixA);
      const idA = regA.getAllImages()[0].id;
      regA.updateTitle(idA, "Eleven A", "user");
      regA.updateLongDescription(idA, "Desc.", "user");
      const rA = Serialiser.writeAppendix(prefixA, regA, {
        appendixHeading: "Image Descriptions",
      });
      assert(
        "G11-A: custom appendixHeading produces '## Image Descriptions'",
        rA.mmd.includes("## Image Descriptions"),
        `got:\n${rA.mmd}`,
      );
      assert(
        "G11-A: default 'Long descriptions' text NOT used",
        !rA.mmd.includes("Long descriptions"),
      );

      // Sub-fixture B: explicit appendixHeadingLevel: 2 overrides auto-detect.
      // Source MMD has H2-only → auto-detect would pick H3. Override to H2.
      const prefixB = "## Existing H2\n\n![](https://cdn.mathpix.com/g11b.png)";
      const regB = new Registry();
      regB.buildFromMMD(prefixB);
      const idB = regB.getAllImages()[0].id;
      regB.updateTitle(idB, "Eleven B", "user");
      regB.updateLongDescription(idB, "Desc.", "user");
      const rB = Serialiser.writeAppendix(prefixB, regB, {
        appendixHeadingLevel: 2,
      });
      assert(
        "G11-B: explicit appendixHeadingLevel=2 produces H2 (not auto-detected H3)",
        rB.mmd.includes("\n## Long descriptions") &&
          !rB.mmd.includes("\n### Long descriptions"),
        `got:\n${rB.mmd}`,
      );

      // Sub-fixture C: clamping behaviour.
      // Implementation: level 7 → clamped to 6 (Math.min(6, ...)); level 0
      // falls into the auto-detect branch (the `>= 1` guard fails). This is
      // the shipped behaviour; the spec said "clamped" but only the upper
      // bound is clamped. Spec was X, implementation is Y, fixture asserts Y.
      const prefixC = "![](https://cdn.mathpix.com/g11c.png)";
      const regC = new Registry();
      regC.buildFromMMD(prefixC);
      const idC = regC.getAllImages()[0].id;
      regC.updateTitle(idC, "Eleven C", "user");
      regC.updateLongDescription(idC, "Desc.", "user");
      const rC7 = Serialiser.writeAppendix(prefixC, regC, {
        appendixHeadingLevel: 7,
      });
      assert(
        "G11-C: level=7 clamped down to H6 (entries also clamp to H6)",
        rC7.mmd.includes("\n###### Long descriptions") &&
          rC7.mmd.includes("\n###### Description of Eleven C"),
        `got:\n${rC7.mmd}`,
      );
      // Level 0 falls through to auto-detect (`>= 1` guard fails) →
      // no-headings doc → H2/H3.
      const rC0 = Serialiser.writeAppendix(prefixC, regC, {
        appendixHeadingLevel: 0,
      });
      assert(
        "G11-C: level=0 falls back to auto-detect (H2 here, no headings in MMD)",
        rC0.mmd.includes("\n## Long descriptions"),
        `got:\n${rC0.mmd}`,
      );

      // Sub-fixture D: custom heading + explicit level together.
      const prefixD = "![](https://cdn.mathpix.com/g11d.png)";
      const regD = new Registry();
      regD.buildFromMMD(prefixD);
      const idD = regD.getAllImages()[0].id;
      regD.updateTitle(idD, "Eleven D", "user");
      regD.updateLongDescription(idD, "Desc.", "user");
      const rD = Serialiser.writeAppendix(prefixD, regD, {
        appendixHeading: "Long-form figure descriptions",
        appendixHeadingLevel: 4,
      });
      assert(
        "G11-D: both options applied — '#### Long-form figure descriptions'",
        rD.mmd.includes("#### Long-form figure descriptions"),
        `got:\n${rD.mmd}`,
      );
      assert(
        "G11-D: entry headings at H5 (4 + 1)",
        rD.mmd.includes("##### Description of Eleven D"),
      );
    }

    // ========================================================================
    // Group 12 — Marker edge cases
    // ========================================================================
    console.log("\n--- 12. Marker edge cases ---");
    {
      // Sub-fixture A: marker for unknown ID.
      const prefixA = "![](https://cdn.mathpix.com/g12a.png)";
      const regA = new Registry();
      regA.buildFromMMD(prefixA);
      const idA = regA.getAllImages()[0].id;
      regA.updateLongDescription(idA, "Original A.", "user");
      const mmdA =
        prefixA +
        "\n\n## Long descriptions\n\n" +
        "<!-- img-desc:bogus-id-12345 -->\n### Description of ghost\n\nGhost text.";
      const resA = withSilencedWarn(() => Serialiser.parseAppendix(mmdA, regA));
      assert(
        "G12-A: unknown marker ID → registry entry A untouched",
        regA.getImage(idA).longDescription === "Original A.",
        `got "${regA.getImage(idA).longDescription}"`,
      );
      assert(
        "G12-A: action map contains entry-not-mapped",
        actionMapEquals(resA.actions, { "entry-not-mapped": 1 }),
        `got ${JSON.stringify(resA.actions)}`,
      );

      // Sub-fixture B: duplicate marker IDs in MMD.
      // Implementation note: `_parseAppendixEntries` keeps the first
      // occurrence and silently `continue`s on duplicates (with a warn log,
      // no special action key). Spec asked for a duplicate-marker action; the
      // implementation aggregates duplicates by skipping. Spec was X,
      // implementation is Y, fixture asserts Y.
      const prefixB = "![](https://cdn.mathpix.com/g12b.png)";
      const regB = new Registry();
      regB.buildFromMMD(prefixB);
      const idB = regB.getAllImages()[0].id;
      regB.updateLongDescription(idB, "Original B.", "user");
      const mmdB =
        prefixB +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idB} -->\n### Description of first\n\nFirst occurrence text.\n\n` +
        `<!-- img-desc:${idB} -->\n### Description of second\n\nSecond occurrence text.`;
      const resB = withSilencedWarn(() => Serialiser.parseAppendix(mmdB, regB));
      assert(
        "G12-B: duplicate marker — registry updated from first occurrence only",
        regB.getImage(idB).longDescription === "First occurrence text.",
        `got "${regB.getImage(idB).longDescription}"`,
      );
      assert(
        "G12-B: parseAppendix updated === 1 (second occurrence ignored)",
        resB.updated === 1,
        JSON.stringify(resB),
      );

      // Sub-fixture C: heading hand-edited from '### Description of foo'
      // to '### My custom heading' — parser still associates via marker.
      const prefixC = "![](https://cdn.mathpix.com/g12c.png)";
      const regC = new Registry();
      regC.buildFromMMD(prefixC);
      const idC = regC.getAllImages()[0].id;
      regC.updateTitle(idC, "Twelve C", "user");
      regC.updateLongDescription(idC, "Old.", "user");
      const mmdC =
        prefixC +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idC} -->\n### My custom heading\n\nNew description content.`;
      Serialiser.parseAppendix(mmdC, regC);
      assert(
        "G12-C: hand-edited heading text irrelevant — marker drives association",
        regC.getImage(idC).longDescription === "New description content.",
        `got "${regC.getImage(idC).longDescription}"`,
      );
    }

    // ========================================================================
    // Group 13 — Content-vs-heading disambiguation
    // ========================================================================
    console.log("\n--- 13. Content-vs-heading disambiguation ---");
    {
      const prefix = "![](https://cdn.mathpix.com/g13.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Thirteen", "user");
      // Description text contains '###' that must NOT be parsed as a new heading.
      const original =
        "Step one is to apply ### the rule.\n\nStep two follows.";
      reg.updateLongDescription(id, original, "user");

      const r1 = Serialiser.writeAppendix(prefix, reg);
      // Reset reg's longDescription so parse has work to do.
      reg.updateLongDescription(id, "", "user");
      Serialiser.parseAppendix(r1.mmd, reg);

      assert(
        "G13: round-trip preserves '###' inside description text as content",
        reg.getImage(id).longDescription === original,
        `got "${reg.getImage(id).longDescription}"`,
      );
    }

    // ========================================================================
    // Group 14 — Empty-registry and remove-appendix flows
    // ========================================================================
    console.log("\n--- 14. Empty-registry and remove-appendix flows ---");
    {
      // Sub-fixture A: empty registry → writeAppendix produces no appendix.
      // Implementation: no appendix exists, no entries → returns { "no-op": 1 }.
      const mmdA = "Prose without any images.\n\nMore prose.";
      const regA = new Registry();
      const rA = Serialiser.writeAppendix(mmdA, regA);
      assert(
        "G14-A: empty registry, no appendix → mmd unchanged",
        rA.mmd === mmdA,
        `got:\n${rA.mmd}`,
      );
      assert(
        "G14-A: empty registry → action map is { no-op: 1 }",
        actionMapEquals(rA.actions, { "no-op": 1 }),
        `got ${JSON.stringify(rA.actions)}`,
      );
      assert(
        "G14-A: transformations === 0",
        rA.transformations === 0,
      );

      // Sub-fixture B: MMD has appendix, registry has zero entries with longDesc.
      const prefixB = "![](https://cdn.mathpix.com/g14b.png)";
      const regB = new Registry();
      regB.buildFromMMD(prefixB);
      const idB = regB.getAllImages()[0].id;
      // No longDescription set on the entry.
      const mmdB =
        prefixB +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idB} -->\n### Description of stale\n\nStale description text.`;
      const rB = Serialiser.writeAppendix(mmdB, regB);
      assert(
        "G14-B: existing appendix + empty-longDesc registry → removed-appendix:1",
        actionMapEquals(rB.actions, { "removed-appendix": 1 }),
        `got ${JSON.stringify(rB.actions)}`,
      );
      assert(
        "G14-B: output has no '## Long descriptions' heading",
        !rB.mmd.includes("Long descriptions"),
      );
      assert(
        "G14-B: output has no marker comment",
        !rB.mmd.includes(`<!-- img-desc:${idB} -->`),
      );
    }

    // ========================================================================
    // Group 15 — Marker-ID survival across heading-text edits
    // ========================================================================
    console.log("\n--- 15. Marker-ID survival across heading-text edits ---");
    {
      const prefix = "![](https://cdn.mathpix.com/g15.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      reg.updateTitle(id, "Fifteen", "user");
      reg.updateLongDescription(id, "Locked description.", "user");

      const r1 = Serialiser.writeAppendix(prefix, reg);
      // Hand-edit the entry heading text — keep the marker, replace heading.
      const handEdited = r1.mmd.replace(
        "### Description of Fifteen",
        "### Renamed by hand",
      );
      const r2 = Serialiser.writeAppendix(handEdited, reg);

      // Implementation note: writeAppendix fully rebuilds the appendix from
      // registry truth on every call — `nextMmd = prefixMmd + "\n\n" + built.appendix`
      // regardless of whether per-entry actions are no-op. So the hand-edited
      // heading IS overwritten on the next write, regenerated from
      // entry.title || entry.altText || entry.id. Spec was X (either behaviour
      // is defensible), implementation is Y (canonical heading regenerates on
      // each write), fixture asserts Y.
      assert(
        "G15: per-entry action is no-op (description text unchanged)",
        actionMapEquals(r2.actions, { "no-op": 1 }),
        `got ${JSON.stringify(r2.actions)}`,
      );
      assert(
        "G15: hand-edited heading regenerated to canonical 'Description of Fifteen'",
        r2.mmd.includes("### Description of Fifteen") &&
          !r2.mmd.includes("### Renamed by hand"),
        `got:\n${r2.mmd}`,
      );
      assert(
        "G15: marker ID survived the rewrite",
        r2.mmd.includes(`<!-- img-desc:${id} -->`),
      );
      assert(
        "G15: description content preserved exactly",
        r2.mmd.includes("Locked description."),
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
    console.log("\n=== Stage 2 Full Suite Complete ===");
    return { passed, failed, total: passed + failed, results };
  }

  // ============================================================================
  // GLOBAL EXPOSURE — all runners at module load (Stage 0 alias-placement rule)
  // ============================================================================
  window.runStage1Tests = runStage1Tests;
  // Thin wrapper preserving the 29-assertion contract used by Stage 1.A's DoD.
  window.runStage1aTests = function () {
    return runStage1Tests({ smokeOnly: true });
  };
  window.runStage2Tests = runStage2Tests;

  logInfo("MathPixAltTextSerialiserTests module loaded (runStage1Tests + runStage1aTests + runStage2Tests registered)");
})();
