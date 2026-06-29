/**
 * Lane C tests — C-P2a converter + freeze predicate.
 *
 * Exercises window.MathPixChemistryRegistryWriter.internals:
 *   - comprehensiveHtmlToAppendixMarkdown(html)
 *   - isRefreshable(source)
 *
 * Run from the console: `window.runLaneCTests()`.
 * House runner shape mirrors mathpix-chemistry-tests.js — push { name, pass }
 * objects, log PASS/FAIL per line, log "<passed>/<total> passed", and return
 * { passed, total }.
 *
 * @author Matthew Deeprose, University of Southampton
 */
(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[LaneCTests]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[LaneCTests]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[LaneCTests]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[LaneCTests]", message, ...args);
  }

  // Shared fidelity probes — a converted appendix body must carry no ATX
  // heading, no residual structural tag, and no residual HTML entity.
  const HAS_ATX_HEADING = /^#{1,6}\s/m;
  const HAS_STRUCTURAL_TAG = /<\/?(p|ol|li)\b/i;
  const HAS_ENTITY = /&(amp|lt|gt|quot|#39);/;

  window.runLaneCTests = async function () {
    const allTests = [];

    const writer = window.MathPixChemistryRegistryWriter;
    const W = writer && writer.internals;

    allTests.push({
      name: "writer facade present (window.MathPixChemistryRegistryWriter.internals)",
      pass:
        !!W &&
        typeof W.comprehensiveHtmlToAppendixMarkdown === "function" &&
        typeof W.isRefreshable === "function",
    });

    if (!W) {
      // Cannot proceed without the module — report and bail with the partial
      // tally so the failure is loud rather than a thrown stack.
      let passedEarly = 0;
      allTests.forEach((t) => {
        console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
        if (t.pass) passedEarly++;
      });
      console.log("\n" + passedEarly + "/" + allTests.length + " passed");
      return { passed: passedEarly, total: allTests.length };
    }

    const convert = W.comprehensiveHtmlToAppendixMarkdown;

    // --- 1. Converter: single paragraph ------------------------------------
    {
      const out = convert("<p>The structure is a two-carbon chain.</p>");
      allTests.push({
        name: "converter single paragraph: text only, no tags, no blank lines",
        pass:
          out === "The structure is a two-carbon chain." &&
          !HAS_STRUCTURAL_TAG.test(out) &&
          !/^\s|\s$/.test(out) &&
          !out.includes("\n\n"),
      });
    }

    // --- 2. Converter: entity decode ---------------------------------------
    {
      const out = convert("<p>A &amp; B &lt;x&gt; &quot;q&quot; &#39;a&#39;</p>");
      allTests.push({
        name: "converter entity decode: &amp; &lt; &gt; &quot; &#39; -> & < > \" '",
        pass: out === "A & B <x> \"q\" 'a'" && !HAS_ENTITY.test(out),
      });
    }

    // --- 3. Converter: intro + list + tail ---------------------------------
    {
      const out = convert(
        "<p>Intro.</p><ol><li>First.</li><li>Second.</li></ol><p>Tail.</p>",
      );
      const expected = "Intro.\n\n1. First.\n2. Second.\n\nTail.";
      allTests.push({
        name: "converter intro+list+tail: three blocks blank-separated with 1./2. list",
        pass: out === expected,
      });

      // --- 4. Fidelity on the list case ------------------------------------
      allTests.push({
        name: "fidelity (list case): no ATX heading, no residual tags, no residual entities",
        pass:
          !HAS_ATX_HEADING.test(out) &&
          !HAS_STRUCTURAL_TAG.test(out) &&
          !HAS_ENTITY.test(out),
      });
    }

    // The comprehensive engine reads a SmilesDrawer-shaped graph from the
    // chemistry-utils graph cache, which RDKit populates asynchronously. On a
    // cold page analyseStructure() returns null until the graph is warmed, so
    // tests 5 and 6 (the real-engine paths) await awaitGraphCached("CCO")
    // first — mirroring how the migration harness primes the cache.
    try {
      const utils = window.MathPixChemistryUtils;
      if (utils && typeof utils.awaitGraphCached === "function") {
        await utils.awaitGraphCached("CCO");
      }
    } catch (err) {
      logWarn("graph warm-up for CCO threw", err);
    }

    // --- 5. Real-engine fidelity -------------------------------------------
    {
      let pass = false;
      try {
        const utils = window.MathPixChemistryUtils;
        if (!utils || typeof utils.generateComprehensiveDescriptionHTML !== "function") {
          allTests.push({
            name: "real-engine fidelity: MathPixChemistryUtils.generateComprehensiveDescriptionHTML available",
            pass: false,
          });
        } else {
          const html = utils.generateComprehensiveDescriptionHTML("CCO", null);
          // Loud guard: the engine must actually have produced HTML.
          const startsWithP = typeof html === "string" && /^<p>/.test(html);
          allTests.push({
            name: "real-engine fidelity: generateComprehensiveDescriptionHTML('CCO', null) starts with <p>",
            pass: startsWithP,
          });
          if (startsWithP) {
            const body = convert(html);
            pass =
              typeof body === "string" &&
              body.length > 0 &&
              !HAS_STRUCTURAL_TAG.test(body) &&
              !HAS_ENTITY.test(body) &&
              !HAS_ATX_HEADING.test(body);
            allTests.push({
              name: "real-engine fidelity: converted ethanol body has no tags, no entities, no heading",
              pass,
            });
          }
        }
      } catch (err) {
        logError("real-engine fidelity threw", err);
        allTests.push({
          name: "real-engine fidelity: did not throw",
          pass: false,
        });
      }
    }

    // --- 6. Round-trip through the real serialiser -------------------------
    {
      try {
        const utils = window.MathPixChemistryUtils;
        const S = window.MathPixAltTextMMDSerialiser;
        const Registry = window.MathPixImageRegistry;
        const provenanceReady =
          window.MathPixAltTextProvenance &&
          typeof window.MathPixAltTextProvenance.nextSource === "function";
        const ready =
          utils &&
          typeof utils.generateComprehensiveDescriptionHTML === "function" &&
          S &&
          typeof S.writeAppendix === "function" &&
          typeof S.parseAppendix === "function" &&
          typeof Registry === "function" &&
          provenanceReady;

        if (!ready) {
          allTests.push({
            name: "round-trip: serialiser + registry + provenance dependencies available",
            pass: false,
          });
        } else {
          const mmd = "![](https://cdn.mathpix.com/g9.png)";
          const html = utils.generateComprehensiveDescriptionHTML("CCO", null);
          const body = convert(html);

          const reg = new Registry();
          reg.buildFromMMD(mmd);
          const id = reg.getAllImages()[0] && reg.getAllImages()[0].id;
          reg.updateLongDescription(id, body, "ai-generated");

          const written = S.writeAppendix(mmd, reg);

          const reg2 = new Registry();
          reg2.buildFromMMD(written.mmd);
          S.parseAppendix(written.mmd, reg2);

          const readBack = reg2.getImage(id) && reg2.getImage(id).longDescription;
          allTests.push({
            name: "round-trip: read-back long description equals the converted body written",
            pass: typeof readBack === "string" && readBack === body && body.length > 0,
          });
        }
      } catch (err) {
        logError("round-trip threw", err);
        allTests.push({ name: "round-trip: did not throw", pass: false });
      }
    }

    // --- 7. Freeze table ---------------------------------------------------
    {
      const r = W.isRefreshable;
      allTests.push({ name: "isRefreshable(null) === true", pass: r(null) === true });
      allTests.push({
        name: "isRefreshable('ai-generated') === true",
        pass: r("ai-generated") === true,
      });
      allTests.push({ name: "isRefreshable('user') === false", pass: r("user") === false });
      allTests.push({
        name: "isRefreshable('ai-reviewed') === false",
        pass: r("ai-reviewed") === false,
      });
      allTests.push({
        name: "isRefreshable('original') === false",
        pass: r("original") === false,
      });
    }

    // --- 8. C-P2b: chemistry generation routine ----------------------------
    //
    // Builds throwaway registries from \includegraphics[alt={<smiles>S</smiles>}]
    // {URL} fixtures and feeds the SAME fixture string as pristineMmd so the
    // URL→SMILES map keys line up with the registry entries' originalUrl. Real
    // engine throughout (except the deliberately-stubbed fallback case), so the
    // group warms the RDKit graph cache up front.
    {
      const writerNs = window.MathPixChemistryRegistryWriter;
      const utils = window.MathPixChemistryUtils;
      const Registry = window.MathPixImageRegistry;
      const ready =
        writerNs &&
        typeof writerNs.writeChemistryDescriptions === "function" &&
        writerNs.internals &&
        typeof writerNs.internals.buildUrlToSmilesMap === "function" &&
        utils &&
        typeof utils.generateShortDescription === "function" &&
        typeof utils.generateComprehensiveDescriptionHTML === "function" &&
        typeof utils.renderStructureToBlob === "function" &&
        typeof Registry === "function";

      if (!ready) {
        // Loud guard — without the routine + its dependencies the whole group
        // is meaningless, so report one hard failure rather than skipping.
        allTests.push({
          name: "C-P2b: writeChemistryDescriptions + registry + utils available",
          pass: false,
        });
      } else {
        // Warm RDKit deterministically for both fixture SMILES so the
        // synchronous generators return non-empty prose on the first prime.
        // Bounded loop: render then confirm the graph cache is actually ready
        // before any case runs, recording a loud failure if it never warms.
        async function ensureWarm(smiles, tries = 30) {
          for (let i = 0; i < tries; i++) {
            await utils.renderStructureToBlob(smiles);
            if (typeof utils.awaitGraphCached === "function") {
              if (await utils.awaitGraphCached(smiles)) return true;
            } else if (utils.generateShortDescription(smiles, null)) {
              return true;
            }
            await new Promise((r) => setTimeout(r, 50));
          }
          return false;
        }
        const warmCCO = await ensureWarm("CCO");
        const warmBenzene = await ensureWarm("c1ccccc1");
        allTests.push({
          name: "C-P2b warm-up: RDKit ready for CCO and benzene",
          pass: warmCCO && warmBenzene,
        });

        const writeChem = writerNs.writeChemistryDescriptions;
        const U1 = "https://cdn.mathpix.com/c1.png";
        const U2 = "https://cdn.mathpix.com/c2.png";
        const mkLine = (smiles, url) =>
          "\\includegraphics[alt={<smiles>" + smiles + "</smiles>}]{" + url + "}";
        const buildReg = (lines) => {
          const reg = new Registry();
          reg.buildFromMMD(lines.join("\n"));
          return reg;
        };
        const entryByUrl = (reg, url) =>
          reg.getAllImages().find((e) => e.id && e.originalUrl === url);

        // Tracks that the group actually performed at least one write, so a
        // broken fixture fails loudly rather than passing on zero writes.
        let anyWrite = false;

        // -- Keying: two distinct structures, not crossed ------------------
        try {
          const lines = [mkLine("CCO", U1), mkLine("c1ccccc1", U2)];
          const reg = buildReg(lines);
          const out = await writeChem({
            registry: reg,
            pristineMmd: lines.join("\n"),
            workingMmd: lines.join("\n"),
            chemistryData: [],
          });
          anyWrite =
            anyWrite ||
            out.results.some((r) => r.altWritten || r.longWritten || r.textWritten);
          const e1 = entryByUrl(reg, U1);
          const e2 = entryByUrl(reg, U2);
          allTests.push({
            name: "C-P2b keying: c1 textInImage 'CCO', c2 textInImage 'c1ccccc1' (not crossed); both alt ai-generated",
            pass:
              !!e1 &&
              !!e2 &&
              e1.textInImage === "CCO" &&
              e2.textInImage === "c1ccccc1" &&
              e1.altTextSource === "ai-generated" &&
              e2.altTextSource === "ai-generated" &&
              e1.altText &&
              e1.altText !== "Chemical structure diagram" &&
              e2.altText &&
              e2.altText !== "Chemical structure diagram",
          });
        } catch (err) {
          logError("C-P2b keying threw", err);
          allTests.push({ name: "C-P2b keying: did not throw", pass: false });
        }

        // -- Graph-only: no PubChem → non-empty degradation ----------------
        try {
          const lines = [mkLine("CCO", U1)];
          const reg = buildReg(lines);
          const out = await writeChem({
            registry: reg,
            pristineMmd: lines.join("\n"),
            workingMmd: lines.join("\n"),
            chemistryData: [],
          });
          anyWrite =
            anyWrite ||
            out.results.some((r) => r.altWritten || r.longWritten || r.textWritten);
          const e = entryByUrl(reg, U1);
          allTests.push({
            name: "C-P2b graph-only: alt + long non-empty; long carries no PubChem name (/ethanol/i absent)",
            pass:
              !!e &&
              typeof e.altText === "string" &&
              e.altText.length > 0 &&
              typeof e.longDescription === "string" &&
              e.longDescription.length > 0 &&
              !/ethanol/i.test(e.longDescription),
          });
        } catch (err) {
          logError("C-P2b graph-only threw", err);
          allTests.push({ name: "C-P2b graph-only: did not throw", pass: false });
        }

        // -- PubChem reuse + converter-ran ---------------------------------
        try {
          const lines = [mkLine("CCO", U1)];
          const reg = buildReg(lines);
          const out = await writeChem({
            registry: reg,
            pristineMmd: lines.join("\n"),
            workingMmd: lines.join("\n"),
            chemistryData: [
              {
                notation: "CCO",
                commonNames: ["ethanol"],
                iupacName: "ethanol",
                molecularWeight: 46.07,
                molecularFormula: "C2H6O",
              },
            ],
          });
          anyWrite =
            anyWrite ||
            out.results.some((r) => r.altWritten || r.longWritten || r.textWritten);
          const e = entryByUrl(reg, U1);
          allTests.push({
            name: "C-P2b PubChem reuse: long description matches /ethanol/i (opener from reused data)",
            pass:
              !!e &&
              typeof e.longDescription === "string" &&
              /ethanol/i.test(e.longDescription),
          });
          allTests.push({
            name: "C-P2b converter ran: written long description carries no <p>/<ol>/<li> tag",
            pass:
              !!e &&
              typeof e.longDescription === "string" &&
              e.longDescription.length > 0 &&
              !/<\/?(p|ol|li)>/i.test(e.longDescription),
          });
        } catch (err) {
          logError("C-P2b PubChem reuse threw", err);
          allTests.push({ name: "C-P2b PubChem reuse: did not throw", pass: false });
        }

        // -- Freeze skip: user-frozen A preserved, control B refreshed -----
        try {
          const lines = [mkLine("CCO", U1), mkLine("c1ccccc1", U2)];
          const reg = buildReg(lines);
          const idA = entryByUrl(reg, U1).id;
          reg.updateAltText(idA, "Human alt", "user");
          const out = await writeChem({
            registry: reg,
            pristineMmd: lines.join("\n"),
            workingMmd: lines.join("\n"),
            chemistryData: [],
          });
          anyWrite =
            anyWrite ||
            out.results.some((r) => r.altWritten || r.longWritten || r.textWritten);
          const eA = entryByUrl(reg, U1);
          const eB = entryByUrl(reg, U2);
          allTests.push({
            name: "C-P2b freeze skip: user-frozen alt A preserved; control B refreshed to ai-generated",
            pass:
              !!eA &&
              !!eB &&
              eA.altText === "Human alt" &&
              eA.altTextSource === "user" &&
              eB.altTextSource === "ai-generated",
          });
        } catch (err) {
          logError("C-P2b freeze skip threw", err);
          allTests.push({ name: "C-P2b freeze skip: did not throw", pass: false });
        }

        // -- Dedup: identical SMILES at two URLs → identical alt -----------
        try {
          const lines = [mkLine("CCO", U1), mkLine("CCO", U2)];
          const reg = buildReg(lines);
          const out = await writeChem({
            registry: reg,
            pristineMmd: lines.join("\n"),
            workingMmd: lines.join("\n"),
            chemistryData: [],
          });
          anyWrite =
            anyWrite ||
            out.results.some((r) => r.altWritten || r.longWritten || r.textWritten);
          const eA = entryByUrl(reg, U1);
          const eB = entryByUrl(reg, U2);
          allTests.push({
            name: "C-P2b dedup: identical SMILES → identical alt text, both ai-generated",
            pass:
              !!eA &&
              !!eB &&
              eA.altText === eB.altText &&
              eA.altText.length > 0 &&
              eA.altText !== "Chemical structure diagram" &&
              eA.altTextSource === "ai-generated" &&
              eB.altTextSource === "ai-generated",
          });
        } catch (err) {
          logError("C-P2b dedup threw", err);
          allTests.push({ name: "C-P2b dedup: did not throw", pass: false });
        }

        // -- Fallback (deterministic, stubbed undrawable) ------------------
        {
          const saveShort = utils.generateShortDescription;
          const saveComp = utils.generateComprehensiveDescriptionHTML;
          const savePrimer = utils.renderStructureToBlob;
          try {
            utils.generateShortDescription = function () {
              return "";
            };
            utils.generateComprehensiveDescriptionHTML = function () {
              return "";
            };
            utils.renderStructureToBlob = async function () {
              return null;
            };

            const lines = [mkLine("CCO", U1)];
            const reg = buildReg(lines);
            const out = await writeChem({
              registry: reg,
              pristineMmd: lines.join("\n"),
              workingMmd: lines.join("\n"),
              chemistryData: [],
            });
            anyWrite =
              anyWrite ||
              out.results.some((r) => r.altWritten || r.longWritten || r.textWritten);
            const e = entryByUrl(reg, U1);
            allTests.push({
              name: "C-P2b fallback (stubbed undrawable): generic alt, ai-generated, long not written",
              pass:
                !!e &&
                e.altText === "Chemical structure diagram" &&
                e.altTextSource === "ai-generated" &&
                (!e.longDescription || e.longDescription.length === 0),
            });
          } catch (err) {
            logError("C-P2b fallback threw", err);
            allTests.push({ name: "C-P2b fallback: did not throw", pass: false });
          } finally {
            utils.generateShortDescription = saveShort;
            utils.generateComprehensiveDescriptionHTML = saveComp;
            utils.renderStructureToBlob = savePrimer;
          }
        }

        // -- Wrote-guard ---------------------------------------------------
        allTests.push({
          name: "C-P2b wrote-guard: at least one field written across the group",
          pass: anyWrite === true,
        });
      }
    }

    // --- 9. C-P4: reload-protection content-aware gate ---------------------
    //
    // Models a localStorage-autosave reload: the registry is rebuilt by
    // buildFromMMD over an \includegraphics[alt={<smiles>…</smiles>}]{URL}
    // fixture (which resets altText to "" and altTextSource to null), and a
    // SEPARATE workingMmd string carries the current slot state per case.
    // pristineMmd keeps the <smiles> for URL→SMILES keying; workingMmd is what
    // the content-aware gate actually reads.
    {
      const writerNs = window.MathPixChemistryRegistryWriter;
      const W2 = writerNs && writerNs.internals;
      const utils = window.MathPixChemistryUtils;
      const Registry = window.MathPixImageRegistry;
      const ready =
        writerNs &&
        typeof writerNs.writeChemistryDescriptions === "function" &&
        W2 &&
        typeof W2.extractWorkingAltByUrl === "function" &&
        typeof W2.extractWorkingLongById === "function" &&
        typeof W2.isRawSmilesSlot === "function" &&
        utils &&
        typeof utils.generateShortDescription === "function" &&
        typeof Registry === "function";

      allTests.push({
        name: "C-P4: writeChemistryDescriptions + new slot-reader internals available",
        pass: !!ready,
      });

      if (ready) {
        const writeChem = writerNs.writeChemistryDescriptions;
        const U = "https://cdn.mathpix.com/p4.png";
        const smilesLine = (smiles, url) =>
          "\\includegraphics[alt={<smiles>" + smiles + "</smiles>}]{" + url + "}";
        const proseLine = (alt, url) =>
          "\\includegraphics[alt={" + alt + "}]{" + url + "}";
        // Verbatim copy of mathpix-image-manager-ui.js _translateBlobUrlsToCdn (pure; no instance available in the suite).
        const translateBlobUrlsToCdn = (mmd, blobMap) => {
          if (!mmd || !blobMap || blobMap.size === 0) return mmd;

          let result = mmd;
          for (const [cdnUrl, blobUrl] of blobMap) {
            if (!cdnUrl || !blobUrl) continue;
            // Escape regex metacharacters in the blob URL for a literal match.
            const escaped = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            result = result.replace(new RegExp(escaped, "g"), cdnUrl);
          }
          return result;
        };
        const buildReg = (mmd) => {
          const reg = new Registry();
          reg.buildFromMMD(mmd);
          return reg;
        };
        const only = (reg) => reg.getAllImages()[0];
        const resFor = (out, id) => out.results.find((r) => r.id === id) || {};

        // Warm RDKit for CCO so the refresh cases produce real prose. Bounded
        // loop; records a loud failure if it never warms.
        let warm = false;
        for (let i = 0; i < 30 && !warm; i++) {
          await utils.renderStructureToBlob("CCO");
          if (typeof utils.awaitGraphCached === "function") {
            warm = await utils.awaitGraphCached("CCO");
          } else {
            warm = !!utils.generateShortDescription("CCO", null);
          }
          if (!warm) await new Promise((r) => setTimeout(r, 50));
        }
        allTests.push({ name: "C-P4 warm-up: RDKit ready for CCO", pass: warm });

        // Positive control — the reload-adopt rows below assert the human prose
        // won over a REAL, different machine candidate. A silent generation
        // failure (empty machine prose) must therefore NOT be allowed to green
        // them: if this control is red the adopt proofs are inconclusive. CCO is
        // the adopt-case SMILES, so the same baseline backs both adopt rows.
        const machineShort = utils.generateShortDescription("CCO", null);
        const machineHtml = utils.generateComprehensiveDescriptionHTML("CCO", null);
        const machineLong = convert(machineHtml);
        allTests.push({
          name: "C-P4 baseline: machine prose available for adopt SMILES (control)",
          pass:
            !!machineShort &&
            machineShort.length > 0 &&
            !!machineHtml &&
            machineHtml.length > 0,
        });

        // Collected for the cross-case no-erase guard.
        const nonEmptyAfter = [];

        // -- Case 1: reload adopt (alt) — the headline bug fixed -----------
        try {
          const pristine = smilesLine("CCO", U);
          const reg = buildReg(pristine); // altText "", altTextSource null
          const working = proseLine("Human aspirin description", U);
          const id = only(reg).id;
          const out = await writeChem({
            registry: reg,
            pristineMmd: pristine,
            workingMmd: working,
            chemistryData: [],
          });
          const e = only(reg);
          const r = resFor(out, id);
          nonEmptyAfter.push(["C1 alt", e.altText]);
          allTests.push({
            name: "C-P4 reload adopt (alt): slot prose adopted as ai-reviewed; machine short NOT written",
            pass:
              e.altText === "Human aspirin description" &&
              e.altTextSource === "ai-reviewed" &&
              e.altText !== machineShort &&
              r.altAdopted === true,
          });
        } catch (err) {
          logError("C-P4 reload adopt threw", err);
          allTests.push({ name: "C-P4 reload adopt: did not throw", pass: false });
        }

        // -- Case 2: fresh generate (alt) — null + raw smiles -> refresh ---
        try {
          const fixture = smilesLine("CCO", U);
          const reg = buildReg(fixture);
          const id = only(reg).id;
          const out = await writeChem({
            registry: reg,
            pristineMmd: fixture,
            workingMmd: fixture, // slot holds <smiles>CCO</smiles>
            chemistryData: [],
          });
          const e = only(reg);
          const r = resFor(out, id);
          allTests.push({
            name: "C-P4 fresh generate (alt): null + raw <smiles> -> machine prose, ai-generated, != smiles",
            pass:
              e.altTextSource === "ai-generated" &&
              typeof e.altText === "string" &&
              e.altText.length > 0 &&
              e.altText !== "CCO" &&
              e.altText !== "<smiles>CCO</smiles>" &&
              e.altText !== "Chemical structure diagram" &&
              r.altAdopted === false,
          });
        } catch (err) {
          logError("C-P4 fresh generate threw", err);
          allTests.push({ name: "C-P4 fresh generate: did not throw", pass: false });
        }

        // -- Case 3: reliable freeze (alt) — ai-reviewed source ------------
        try {
          const fixture = smilesLine("CCO", U);
          const reg = buildReg(fixture);
          const id = only(reg).id;
          reg.updateAltText(id, "Kept by human", "ai-reviewed");
          const out = await writeChem({
            registry: reg,
            pristineMmd: fixture,
            workingMmd: fixture,
            chemistryData: [],
          });
          const e = only(reg);
          const r = resFor(out, id);
          nonEmptyAfter.push(["C3 alt", e.altText]);
          allTests.push({
            name: "C-P4 reliable freeze (alt): ai-reviewed preserved, no alt write",
            pass:
              e.altText === "Kept by human" &&
              e.altTextSource === "ai-reviewed" &&
              r.altWritten === false,
          });
        } catch (err) {
          logError("C-P4 reliable freeze threw", err);
          allTests.push({ name: "C-P4 reliable freeze: did not throw", pass: false });
        }

        // -- Case 4: ai-generated refresh (alt) — upgrade path not frozen --
        try {
          const fixture = smilesLine("CCO", U);
          const reg = buildReg(fixture);
          const id = only(reg).id;
          reg.updateAltText(id, "Old machine prose", "ai-generated");
          // Working slot still shows the old machine prose; the source is
          // reliable, so it must refresh anyway — slot prose must NOT freeze it.
          const working = proseLine("Old machine prose", U);
          const out = await writeChem({
            registry: reg,
            pristineMmd: fixture,
            workingMmd: working,
            chemistryData: [],
          });
          const e = only(reg);
          const r = resFor(out, id);
          allTests.push({
            name: "C-P4 ai-generated refresh (alt): re-stamped ai-generated, != old prose, not adopted",
            pass:
              e.altTextSource === "ai-generated" &&
              typeof e.altText === "string" &&
              e.altText.length > 0 &&
              e.altText !== "Old machine prose" &&
              r.altAdopted === false,
          });
        } catch (err) {
          logError("C-P4 ai-generated refresh threw", err);
          allTests.push({
            name: "C-P4 ai-generated refresh: did not throw",
            pass: false,
          });
        }

        // -- Case 5: long-desc reload adopt --------------------------------
        try {
          const fixture = smilesLine("CCO", U);
          const reg = buildReg(fixture);
          const id = only(reg).id; // longDescription "", longDescriptionSource null
          const working =
            fixture +
            "\n\n## Long descriptions\n\n<!-- img-desc:" +
            id +
            " -->\n\n### Description\n\nHuman long description\n";
          const out = await writeChem({
            registry: reg,
            pristineMmd: fixture,
            workingMmd: working,
            chemistryData: [],
          });
          const e = only(reg);
          const r = resFor(out, id);
          nonEmptyAfter.push(["C5 long", e.longDescription]);
          allTests.push({
            name: "C-P4 long-desc reload adopt: appendix prose adopted as ai-reviewed (won over real machine long)",
            pass:
              e.longDescription === "Human long description" &&
              e.longDescription !== machineLong &&
              e.longDescriptionSource === "ai-reviewed" &&
              r.longAdopted === true,
          });
        } catch (err) {
          logError("C-P4 long-desc reload adopt threw", err);
          allTests.push({
            name: "C-P4 long-desc reload adopt: did not throw",
            pass: false,
          });
        }

        // -- Case 6: recovered-session keying (alt) — guards the cdnMMD fix ---
        // First fixture where working-MMD URL form (blob) and registry
        // originalUrl form (CDN) diverge — the dimension every prior C-P4
        // fixture was blind to (all URL-matched). Alt-only: long is id-keyed
        // via the appendix marker, so it has no URL-form mismatch to guard.
        try {
          const human = "Recovered human alt prose";
          const cdnUrl = U; // registry originalUrl form (CDN)
          const blobUrl = "blob:https://tools.local/p4-recovered"; // working/preview form
          const pristine = smilesLine("CCO", cdnUrl); // CDN registry seed
          const blobWorking = proseLine(human, blobUrl); // human prose in a BLOB-form slot

          // Guard A — the fixture must actually diverge (no accidental URL-match)
          const formsDiverge = blobUrl !== cdnUrl;

          // Bug condition — untranslated divergent forms: lookup misses, NO adopt
          const regU = buildReg(pristine);
          const idU = only(regU).id;
          const outU = await writeChem({
            registry: regU,
            pristineMmd: pristine,
            workingMmd: blobWorking,
            chemistryData: [],
          });
          const eU = only(regU);
          const rU = resFor(outU, idU);
          const notAdoptedUntranslated =
            eU.altText !== human &&
            eU.altTextSource === "ai-generated" &&
            rU.altAdopted !== true;

          // Fix condition — apply the host's blob->CDN translation, then adopt wins
          const blobMap = new Map([[cdnUrl, blobUrl]]); // host imageBlobUrlMap shape: cdn -> blob
          const cdnWorking = translateBlobUrlsToCdn(blobWorking, blobMap);

          // Guard B — translation must actually rewrite the string to CDN form
          const translationApplied =
            cdnWorking !== blobWorking && cdnWorking.includes(cdnUrl);

          const regT = buildReg(pristine);
          const idT = only(regT).id;
          const outT = await writeChem({
            registry: regT,
            pristineMmd: pristine,
            workingMmd: cdnWorking,
            chemistryData: [],
          });
          const eT = only(regT);
          const rT = resFor(outT, idT);
          const adoptedAfterTranslation =
            eT.altText === human &&
            eT.altTextSource === "ai-reviewed" &&
            eT.altText !== machineShort &&
            rT.altAdopted === true;

          allTests.push({
            name: "C-P4 recovered-session keying (alt, blob-form slot): untranslated mismatch does NOT adopt; cdnMMD translation restores adopt as ai-reviewed",
            pass:
              formsDiverge &&
              translationApplied &&
              notAdoptedUntranslated &&
              adoptedAfterTranslation,
          });
        } catch (err) {
          logError("C-P4 recovered-session keying threw", err);
          allTests.push({
            name: "C-P4 recovered-session keying (alt, blob-form slot): did not throw",
            pass: false,
          });
        }

        // -- No-erase guard: every adopt/freeze field is non-empty after ---
        // it runs, so the forward writer would no-op on propagation rather
        // than erase the slot (the buildFromMMD-reset "" hazard).
        allTests.push({
          name: "C-P4 no-erase guard: adopted/frozen fields non-empty after the routine (propagation no-ops)",
          pass:
            nonEmptyAfter.length === 3 &&
            nonEmptyAfter.every(
              ([, v]) => typeof v === "string" && v.length > 0,
            ),
        });
      }
    }

    // --- Report ------------------------------------------------------------
    console.log(
      "\nLane C C-P2a + C-P2b + C-P4: converter, freeze predicate, chemistry write routine, reload-protection gate\n",
    );
    let passed = 0;
    allTests.forEach((t) => {
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
      if (t.pass) passed++;
    });
    console.log("\n" + passed + "/" + allTests.length + " passed");
    return { passed, total: allTests.length };
  };

  logInfo("Lane C tests loaded — run window.runLaneCTests()");
})();
