/**
 * @fileoverview Stage 10 test runner — the permanent end-to-end alt-text
 *   integration suite. Composes the live lifecycle end to end: seed a
 *   five-image registry, serialise it to MMD, assert the figure block + long-
 *   description appendix + alt survival, snapshot the document context, build
 *   an in-memory ZIP, reload it, and confirm the five-image round-trip — then
 *   prove a hand-edit to the serialised MMD is read back into the registry.
 * @module MathPixStage10Tests
 * @requires MathPixImageRegistry, MathPixAltTextIntegrator, MathPixAltTextMMDSerialiser,
 *   MathPixContextManager, MathPixTotalDownloader, MathPixZIPParser, JSZip
 * @version 1.0.0
 *
 * Decisions implemented: Q1 (the five-image integration round-trip), H-1 (named
 * lifecycle sub-phases H1a–H1l so a mid-lifecycle break localises to the first
 * red), H-3 (each anchor phase guards that its artifact is substantive BEFORE
 * asserting positive presence — a phase that produced nothing FAILS its guard,
 * never vacuously passes), H-5 (skip-count reported in the summary line).
 *
 * Bare-page runnable: the lifecycle core is pure data + the serialiser/
 * integrator/context-manager/total-downloader-statics/zip-parser — all callable
 * on a fresh tools.html console with no OCR session. Three rows are guarded
 * graceful skips on a bare page (counted, never failed), per the Stage 4/5/9
 * skip convention:
 *   - H1b open-manager-badges — runs only when a live session restorer holds a
 *     populated registry (e.g. under Playwright with MathPix resume active);
 *     skips on the bare console page. Coded WITH its badges/counter assertions.
 *   - the UI half of H1c (_performSave) and the UI half of H1j (restoreSession)
 *     — permanently skipped: the MMD/registry round-trip is exercised through
 *     the programmatic core those UI paths wrap, which is the same code.
 *
 * Usage: `window.runStage10Tests()` from the console. Returns
 *   { passed, failed, skipped, results }.
 *
 * @see mathpix-scripts/testing/mathpix-stage9-tests.js — runner/skip conventions
 * @see mathpix-scripts/core/mathpix-alt-text-integrator.js — applyRegistryToMMD / reconcileMMDIntoRegistry
 * @see mathpix-scripts/core/mathpix-alt-text-mmd-serialiser.js — figure block + appendix shapes
 */

(function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(msg, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(msg, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(msg, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(msg, ...args);
  }

  // ==========================================================================
  // CONSTANTS / HELPERS
  // ==========================================================================

  const CAPTION_SETUP_LINE = "\\captionsetup{labelformat=empty}";
  const FIGURE_BEGIN = "\\begin{figure}";
  const FIGURE_END = "\\end{figure}";

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  /**
   * Results recorder. `test(label, fn)` runs an (async) check and records a
   * pass/fail; `skip(label, reason)` records a counted skip (never a failure).
   * Mirrors the Stage 9 accumulator shape so the outcome strings and the
   * { passed, failed, skipped, results } return are byte-compatible.
   */
  function makeAccumulator() {
    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    return {
      async test(label, fn) {
        try {
          await fn();
          passed++;
          results.push({ label, outcome: "passed", error: null });
        } catch (err) {
          failed++;
          const errMsg = err && err.message ? err.message : String(err);
          logError(`FAIL — ${label}: ${errMsg}`);
          results.push({ label, outcome: "failed", error: errMsg });
        }
      },
      skip(label, reason) {
        skipped++;
        logInfo(`SKIP — ${label} (${reason})`);
        results.push({ label, outcome: "skipped", error: null });
      },
      get passed() {
        return passed;
      },
      get failed() {
        return failed;
      },
      get skipped() {
        return skipped;
      },
      get results() {
        return results;
      },
    };
  }

  // ==========================================================================
  // RUNNER
  // ==========================================================================

  async function runFullIntegrationTests() {
    const r = makeAccumulator();

    const Registry = window.MathPixImageRegistry;
    const I = window.MathPixAltTextIntegrator;
    const Ctx = window.MathPixContextManager;

    // Prerequisite: the pure lifecycle core must be present. Abort like Stage 9
    // rather than emit a wall of misleading failures on a page that never
    // loaded the modules.
    if (
      typeof Registry !== "function" ||
      !I ||
      typeof I.applyRegistryToMMD !== "function" ||
      typeof I.reconcileMMDIntoRegistry !== "function" ||
      !Ctx ||
      typeof Ctx.getContext !== "function"
    ) {
      logError(
        "Stage 10 prerequisites missing (registry/integrator/context manager) — aborting.",
      );
      console.log("Results: 0 passed, 0 failed, 0 skipped");
      return { passed: 0, failed: 0, skipped: 0, results: [] };
    }

    // Live-session probe — gates the three guarded rows. On a bare console page
    // the restorer holds no registry, so this is false and the rows skip; under
    // Playwright with a MathPix resume session active it flips true and H1b runs.
    const liveRestorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    const liveReg = liveRestorer ? liveRestorer.imageRegistry : null;
    const liveSessionActive = !!(
      liveReg &&
      typeof liveReg.getCount === "function" &&
      liveReg.getCount() > 0 &&
      typeof window.openImageManager === "function"
    );

    // Gate hygiene: snapshot the document context and restore it in the finally
    // so H1g's edits never leak into the surrounding page (Stage 9 convention).
    const ctxSnapshot = Ctx.getContext();

    // Shared lifecycle state, threaded across the named sub-phases.
    const s = {};

    try {
      // ── H1a load-fixture ───────────────────────────────────────────────
      await r.test(
        "H1a load-fixture — build 5-image registry (a-d MMD-referenced + e user-added)",
        () => {
          const urls = {
            a: "https://cdn.mathpix.com/s10-a.png",
            b: "https://cdn.mathpix.com/s10-b.png",
            c: "https://cdn.mathpix.com/s10-c.png",
            d: "https://cdn.mathpix.com/s10-d.png",
            e: "https://cdn.mathpix.com/s10-e.png",
          };
          // (a) alt present, (b) no alt, (c) decorative are bare markdown.
          // (d) is authored as an includegraphics-origin figure with an empty
          // alt/caption — so its originalSyntax is "includegraphics", which the
          // serialiser's URL fallback needs to relocate it after the H1l hand
          // edit changes its alt slot (a markdown-origin entry would miss).
          const fixtureMMD =
            "Intro paragraph.\n\n" +
            `![Cat](${urls.a})\n\n` +
            `![](${urls.b})\n\n` +
            `![](${urls.c})\n\n` +
            FIGURE_BEGIN +
            "\n" +
            `\\includegraphics[alt={},max width=\\textwidth]{${urls.d}}\n` +
            CAPTION_SETUP_LINE +
            "\n" +
            "\\caption{}\n" +
            FIGURE_END +
            "\n\n" +
            "Trailing paragraph.";

          const reg = new Registry();
          reg.buildFromMMD(fixtureMMD);
          const mmdIds = reg.getAllImages().map((e) => e.id);
          assert(
            mmdIds.length === 4,
            `expected 4 MMD-referenced images, got ${mmdIds.length}`,
          );
          const [idA, idB, idC, idD] = mmdIds;

          // (a) — buildFromMMD lifts the markdown alt verbatim.
          assert(
            reg.getImage(idA).altText === "Cat",
            `image (a) alt not captured — got "${reg.getImage(idA).altText}"`,
          );
          // (c) — decorative.
          reg.updateDecorative(idC, true);
          // (d) — caption + alt + long description.
          const d = {
            alt: "Leaf cross-section under a microscope",
            title: "Figure 1: Leaf anatomy",
            long:
              "A detailed cross-section of a dicot leaf showing the cuticle, " +
              "upper epidermis, palisade mesophyll, spongy mesophyll, and lower " +
              "epidermis with stomata.",
          };
          reg.updateTitle(idD, d.title, "user");
          reg.updateAltText(idD, d.alt, "user");
          reg.updateLongDescription(idD, d.long, "user");
          // (e) — user-added, alt-only, deliberately NOT in the MMD.
          const eClone = reg.addImage({
            originalUrl: urls.e,
            altText: "User-added schematic",
            mmdReference: `![User-added schematic](${urls.e})`,
            syntax: "markdown",
            originalSyntax: "markdown",
          });
          assert(eClone && eClone.id, "addImage did not return an entry");
          assert(
            reg.getCount() === 5,
            `expected 5 images after addImage, got ${reg.getCount()}`,
          );

          s.reg = reg;
          s.mmd = fixtureMMD;
          s.urls = urls;
          s.d = d;
          s.ids = { a: idA, b: idB, c: idC, d: idD, e: eClone.id };
        },
      );

      // ── H1b open-manager-badges (guarded — runs only with a live session) ─
      const ROW_H1B = "H1b open-manager-badges";
      if (!liveSessionActive) {
        r.skip(
          ROW_H1B,
          "no live session restorer with a populated registry on a bare console page (runs under Playwright with MathPix resume active)",
        );
      } else {
        await r.test(ROW_H1B, () => {
          window.openImageManager();
          const countEl = document.getElementById("image-manager-count");
          const coverageEl = document.getElementById(
            "mmd-image-manager-coverage-counter",
          );
          assert(countEl, "#image-manager-count not present after open()");
          assert(
            coverageEl,
            "#mmd-image-manager-coverage-counter not present after open()",
          );
          assert(
            /\d/.test(countEl.textContent || ""),
            `count badge has no number — got "${countEl.textContent}"`,
          );
          if (typeof window.closeImageManager === "function") {
            window.closeImageManager();
          }
        });
      }

      // ── H1c edit+save (programmatic core) ──────────────────────────────
      await r.test(
        "H1c edit+save — applyRegistryToMMD serialises registry edits into MMD",
        () => {
          const result = I.applyRegistryToMMD(s.mmd, s.reg);
          assert(
            result &&
              typeof result.mmd === "string" &&
              result.mmd.length > 0,
            "applyRegistryToMMD returned no MMD string",
          );
          // Registry is the sink for references only — never gains/loses entries.
          assert(
            s.reg.getCount() === 5,
            `registry no longer holds 5 images after serialise — got ${s.reg.getCount()}`,
          );
          s.serialised = result.mmd;
        },
      );

      // ── H1c UI half (_performSave) — guarded permanent skip ─────────────
      {
        const driveable =
          liveSessionActive &&
          typeof window.openImageManager === "function";
        r.skip(
          "H1c edit+save (UI _performSave)",
          driveable
            ? "UI _performSave wraps applyRegistryToMMD (asserted programmatically above); UI drive not exercised by this suite"
            : "UI _performSave needs a live manager modal/restorer — not driveable on a bare console page; serialised programmatically instead",
        );
      }

      // ── H1d assert-MMD-figure-block (anchor; H-3 guard) ────────────────
      await r.test(
        "H1d assert-MMD-figure-block — figure wraps image (d) in canonical order",
        () => {
          const m = s.serialised;
          const figStart = m.indexOf(FIGURE_BEGIN);
          // H-3 guard: a figure block must actually exist before any ordering
          // claim — a phase that produced no figure FAILS here, not vacuously.
          assert(figStart !== -1, "no \\begin{figure} block in serialised MMD");
          const figEnd = m.indexOf(FIGURE_END, figStart);
          assert(figEnd !== -1, "no \\end{figure} after \\begin{figure}");
          const block = m.slice(figStart, figEnd + FIGURE_END.length);

          const igLine = `\\includegraphics[alt={${s.d.alt}},max width=\\textwidth]{${s.urls.d}}`;
          const iIg = block.indexOf(igLine);
          const iSetup = block.indexOf(CAPTION_SETUP_LINE);
          const iCap = block.indexOf(`\\caption{${s.d.title}}`);
          assert(
            iIg !== -1,
            "includegraphics line missing or mismatched inside figure block",
          );
          assert(iSetup !== -1, "\\captionsetup{labelformat=empty} line missing");
          assert(iCap !== -1, "\\caption{<title>} line missing or mismatched");
          assert(
            iIg < iSetup && iSetup < iCap,
            "figure block lines out of canonical order (includegraphics -> captionsetup -> caption)",
          );
        },
      );

      // ── H1e assert-appendix (anchor; H-3 guard) ────────────────────────
      await r.test(
        "H1e assert-appendix — long-description appendix carries image (d)",
        () => {
          const m = s.serialised;
          const headingIdx = m.indexOf("## Long descriptions");
          // H-3 guard: the appendix heading must exist before the marker/text
          // checks — no appendix means this phase FAILS, not silently passes.
          assert(
            headingIdx !== -1,
            "appendix heading '## Long descriptions' absent",
          );

          const marker = `<!-- img-desc:${s.ids.d} -->`;
          const markerIdx = m.indexOf(marker);
          assert(markerIdx !== -1, "own-line marker for image (d) absent");
          // Own-line: the marker is bounded by newlines (or document edges).
          const charBefore = markerIdx === 0 ? "\n" : m[markerIdx - 1];
          const afterIdx = markerIdx + marker.length;
          const charAfter = afterIdx >= m.length ? "\n" : m[afterIdx];
          assert(charBefore === "\n", "appendix marker is not at the line start");
          assert(charAfter === "\n", "appendix marker is not at the line end");

          assert(
            m.indexOf(s.d.long) > headingIdx,
            "image (d) long-description text not present in the appendix region",
          );
        },
      );

      // ── H1f assert-alt-survival (anchor; H-3 guard) ────────────────────
      await r.test(
        "H1f assert-alt-survival — image (d) alt survives inside the figure includegraphics",
        () => {
          const m = s.serialised;
          const figStart = m.indexOf(FIGURE_BEGIN);
          const figEnd = m.indexOf(FIGURE_END, figStart);
          // H-3 guard: assert the figure exists before claiming alt survived it.
          assert(
            figStart !== -1 && figEnd !== -1,
            "figure block absent — cannot assert alt survival",
          );
          const block = m.slice(figStart, figEnd);
          assert(
            block.includes("\\includegraphics"),
            "no includegraphics inside the figure block",
          );
          assert(
            block.includes(`alt={${s.d.alt}}`),
            `alt={${s.d.alt}} not found inside the figure's includegraphics (stripped or relocated)`,
          );
        },
      );

      // ── H1g edit-context ───────────────────────────────────────────────
      await r.test(
        "H1g edit-context — updateField persists into the in-memory context",
        () => {
          s.ctx = {
            subjectArea: "Biology — Plant Cells",
            specificTopic: "Leaf cross-section anatomy",
          };
          Ctx.updateField("subjectArea", s.ctx.subjectArea);
          Ctx.updateField("specificTopic", s.ctx.specificTopic);
          const live = Ctx.getContext();
          assert(
            live.subjectArea === s.ctx.subjectArea,
            `subjectArea not persisted — got "${live.subjectArea}"`,
          );
          assert(
            live.specificTopic === s.ctx.specificTopic,
            `specificTopic not persisted — got "${live.specificTopic}"`,
          );
        },
      );

      // ── H1h zip-download (in-memory JSZip; real createArchive skipped) ──
      await r.test(
        "H1h zip-download — assemble archive (results MMD + registry + context)",
        async () => {
          assert(
            typeof JSZip !== "undefined",
            "JSZip not loaded — cannot assemble the archive",
          );
          assert(
            typeof window.MathPixTotalDownloader === "function",
            "MathPixTotalDownloader not loaded — addContextToArchive unavailable",
          );
          const zip = new JSZip();
          // A source placeholder is required: the ZIP parser's structure
          // validation rejects any archive lacking a file under /source/, so
          // H1j's parse(blob) would otherwise fail. Real archives always carry
          // a source file.
          zip.folder("source").file("source.txt", "Stage 10 fixture source placeholder");
          zip.folder("results").file("doc.mmd", s.serialised);
          zip
            .folder("metadata")
            .file(
              "image-registry.json",
              JSON.stringify(s.reg.toJSON(), null, 2),
            );
          // addContextToArchive is deliberately this-free — drive it as a static
          // against the fresh JSZip, exactly as its JSDoc prescribes.
          window.MathPixTotalDownloader.prototype.addContextToArchive.call(
            null,
            zip,
          );
          s.zip = zip;
          assert(
            zip.file("results/doc.mmd") !== null,
            "results/doc.mmd missing from assembled archive",
          );
          assert(
            zip.file("metadata/image-registry.json") !== null,
            "metadata/image-registry.json missing from assembled archive",
          );
          assert(
            zip.file("metadata/context.json") !== null,
            "metadata/context.json missing from assembled archive",
          );
        },
      );

      // ── H1i assert-zip-contents (anchor; H-3 guard) ────────────────────
      await r.test(
        "H1i assert-zip-contents — three paths present, non-empty, parseable",
        async () => {
          const mmdStr = await s.zip.file("results/doc.mmd").async("string");
          const regStr = await s.zip
            .file("metadata/image-registry.json")
            .async("string");
          const ctxStr = await s.zip
            .file("metadata/context.json")
            .async("string");

          // H-3 guard: each artifact must be substantive before its content
          // claim — an empty/absent member FAILS rather than passing silently.
          assert(mmdStr && mmdStr.length > 0, "results/doc.mmd is empty");
          assert(regStr && regStr.length > 0, "image-registry.json is empty");
          assert(ctxStr && ctxStr.length > 0, "context.json is empty");

          assert(
            mmdStr.includes(FIGURE_BEGIN),
            "archived MMD lost the figure block",
          );
          const regJson = JSON.parse(regStr);
          assert(
            Array.isArray(regJson.images) && regJson.images.length === 5,
            `archived registry images.length !== 5 — got ${regJson.images && regJson.images.length}`,
          );
          const ctxJson = JSON.parse(ctxStr);
          assert(
            ctxJson.subjectArea === s.ctx.subjectArea,
            "archived context.json did not capture the H1g subjectArea edit",
          );
          s.parsed = { mmdStr, regJson, ctxJson };
        },
      );

      // ── H1j reload-from-zip (programmatic; UI restoreSession skipped) ──
      await r.test(
        "H1j reload-from-zip — parser reads MMD; registry + context rebuilt from the blob",
        async () => {
          const blob = await s.zip.generateAsync({ type: "blob" });

          // The wired parser entry — proves the archive round-trips through the
          // real ZIP reader, not just our in-memory JSZip handle.
          assert(
            typeof window.getMathPixZIPParser === "function",
            "getMathPixZIPParser not available",
          );
          const parseResult = await window.getMathPixZIPParser().parse(blob);
          assert(
            parseResult &&
              parseResult.results &&
              typeof parseResult.results.mmd === "string" &&
              parseResult.results.mmd.length > 0,
            `parser did not surface results.mmd (errors=${JSON.stringify(parseResult && parseResult.errors)})`,
          );

          // Faithful reload of the JSON members from the serialised blob.
          const reloaded = await JSZip.loadAsync(blob);
          const regStr = await reloaded
            .file("metadata/image-registry.json")
            .async("string");
          const ctxStr = await reloaded
            .file("metadata/context.json")
            .async("string");

          const restoredReg = new Registry();
          const ok = restoredReg.fromJSON(JSON.parse(regStr));
          assert(ok === true, "registry.fromJSON returned false on reload");
          Ctx.setContext(JSON.parse(ctxStr));

          s.restoredReg = restoredReg;
          s.parsedMmd = parseResult.results.mmd;
        },
      );

      // ── H1j UI half (restoreSession) — guarded permanent skip ──────────
      {
        const driveable =
          liveSessionActive &&
          typeof window.MathPixSessionRestorer === "function";
        r.skip(
          "H1j reload-from-zip (UI restoreSession)",
          driveable
            ? "UI restoreSession wraps parse + fromJSON + setContext (asserted programmatically above); UI drive not exercised by this suite"
            : "UI restoreSession needs a live controller + ZIP handle + DOM — not driveable on a bare console page; reloaded programmatically instead",
        );
      }

      // ── H1k assert-restored (anchor; H-3 guard) ────────────────────────
      await r.test(
        "H1k assert-restored — 5-image round-trip; image (d) metadata + context survive",
        () => {
          const reg = s.restoredReg;
          // H-3 guard: the restored registry must hold the five images before
          // any per-entry claim — a hollow reload FAILS here.
          assert(
            reg && typeof reg.getCount === "function" && reg.getCount() === 5,
            `restored registry does not hold 5 images — got ${reg && reg.getCount && reg.getCount()}`,
          );
          const d = reg.getImage(s.ids.d);
          assert(d, "image (d) absent from restored registry");
          assert(
            d.altText === s.d.alt,
            `restored image (d) alt mismatch — got "${d.altText}"`,
          );
          assert(
            d.title === s.d.title,
            `restored image (d) title mismatch — got "${d.title}"`,
          );
          assert(
            d.longDescription === s.d.long,
            "restored image (d) longDescription mismatch",
          );
          const live = Ctx.getContext();
          assert(
            live.subjectArea === s.ctx.subjectArea,
            `restored context subjectArea mismatch — got "${live.subjectArea}"`,
          );
          assert(
            live.specificTopic === s.ctx.specificTopic,
            `restored context specificTopic mismatch — got "${live.specificTopic}"`,
          );
        },
      );

      // ── H1l hand-edit-MMD-reopen (anchor; H-3 guard) ───────────────────
      await r.test(
        "H1l hand-edit-MMD-reopen — reconcileMMDIntoRegistry catches a hand-edited alt",
        () => {
          const edited = "Hand-edited leaf micrograph";
          const mutated = s.serialised.replace(
            `alt={${s.d.alt}}`,
            `alt={${edited}}`,
          );
          // H-3 guard: the substitution must have actually changed the MMD —
          // a no-op replace would make the reconcile assertion meaningless.
          assert(
            mutated !== s.serialised,
            "hand-edit did not change the serialised MMD (alt token not found)",
          );
          I.reconcileMMDIntoRegistry(mutated, s.reg);
          const d = s.reg.getImage(s.ids.d);
          assert(
            d.altText === edited,
            `reconcile did not catch the hand-edited alt — registry holds "${d.altText}"`,
          );
        },
      );
    } finally {
      // Restore the document context exactly as snapshotted (Stage 9 hygiene).
      Ctx.setContext(ctxSnapshot);
    }

    console.log(
      `Results: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped`,
    );
    return {
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      results: r.results,
    };
  }

  /**
   * Public entry. Wraps runFullIntegrationTests so the suite name matches its
   * siblings (window.runStageNTests).
   * @returns {Promise<{passed:number, failed:number, skipped:number, results:Array}>}
   */
  async function runStage10Tests() {
    return runFullIntegrationTests();
  }

  window.runStage10Tests = runStage10Tests;
  logInfo("Stage 10 test runner registered: window.runStage10Tests()");
})();
