/**
 * @fileoverview Convert-size-indicator P0 characterisation harness
 * @module mathpix-convert-size-tests
 * @version 1.0.0
 *
 * @description
 * Characterisation harness for proto.getMMDForAPI (session-restorer-images.js).
 * Most fixtures drive ONE branch/rung of the live method; the P1a "Ordering"
 * fixtures deliberately activate MULTIPLE branches in one MMD so the harness can
 * catch a cross-stage ordering regression in the three sequential steps. Every
 * fixture asserts TWO arms:
 *
 *   1. Behavioural — proves the branch actually ran (encode paths assert the
 *      target URL is gone and a "data:" URI is present; encode-free rungs assert
 *      the exact deterministic output string).
 *   2. Estimate — the cheap projection _estimateConvertSize, which measures the
 *      replayed manifest, equals the gate's own measurement of the embedded
 *      output (new Blob([liveOut]).size) byte for byte, including the cascade
 *      case where a later step's URL exists only after an earlier step runs.
 *
 * The live method runs first and the estimator second on the SAME stand-in, with
 * no teardown between them, so both observe the same live Blob and the same stub.
 *
 * @usage
 * Include after mathpix-session-restorer.js (and the images mixin) in tools.html.
 *   - window.runConvertSizeTests()  - run the whole harness
 */

(function () {
  "use strict";

  // =========================================================================
  // LOGGING (IIFE-scoped, suite tracing only)
  // =========================================================================

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
      console.error(`[ConvertSizeTests] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ConvertSizeTests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ConvertSizeTests] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ConvertSizeTests] ${message}`, ...args);
  }

  // =========================================================================
  // FIXTURE HELPERS
  // =========================================================================

  /**
   * Build a genuine, decodable PNG Blob via canvas.toBlob so that
   * encodeBestDataURI can decode it (createImageBitmap path).
   * @returns {Promise<Blob>}
   */
  function makeRealImageBlob(size = 4, fill = "#3366cc") {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, size, size);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("makeRealImageBlob: canvas.toBlob produced null"));
      }, "image/png");
    });
  }

  /**
   * Minimal stand-in for the image registry — getMMDForAPI only calls
   * getAllImages() off it.
   * @param {Array<Object>} entries
   * @returns {{ getAllImages: function(): Array<Object> }}
   */
  function makeRegistry(entries) {
    return { getAllImages: () => entries };
  }

  /**
   * Build a prototype-backed stand-in `this`. After the P1b refactor,
   * getMMDForAPI dispatches to this.buildManifest / this.applyManifest, both of
   * which live on MathPixSessionRestorer.prototype — a bare object literal would
   * throw "this.buildManifest is not a function". Object.create gives the
   * stand-in those sibling methods
   * while it still owns ONLY the two fixture fields the branches read.
   * @param {{ imageBlobUrlMap: Map, imageRegistry: (Object|null) }} own
   * @returns {Object} prototype-backed stand-in
   */
  function makeStandIn(own) {
    const standIn = Object.create(MathPixSessionRestorer.prototype);
    standIn.imageBlobUrlMap = own.imageBlobUrlMap;
    standIn.imageRegistry = own.imageRegistry;
    return standIn;
  }

  // A no-op teardown for fixtures that install nothing.
  const NOOP = () => {};

  // =========================================================================
  // FIXTURE DEFINITIONS
  //
  // Each fixture's setup() returns { standIn, mmd, formats, teardown, expected }.
  // expected is one of:
  //   { kind: "encoded", absent: <url that must be gone> }
  //   { kind: "exact",   value: <full deterministic output string> }
  // =========================================================================

  const FIXTURES = [
    // ---------------------------------------------------------------------
    // OCR branch (imageBlobUrlMap → registry by originalUrl)
    // ---------------------------------------------------------------------
    {
      name: "ocr-blob-present",
      branch: "OCR",
      rung: "blob present, size>0 → encodes",
      async setup() {
        const cdn = "https://cdn.mathpix.com/ocr-happy.jpg";
        const blobUrl = "blob:http://localhost/ocr-happy";
        const blob = await makeRealImageBlob();
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdn, blobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: cdn, blob, dataUri: null, id: "o1" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "encoded", absent: blobUrl },
        };
      },
    },
    {
      name: "ocr-datauri-passthrough",
      branch: "OCR",
      rung: "no blob, dataUri present → dataUri pass-through",
      async setup() {
        const cdn = "https://cdn.mathpix.com/ocr-datauri.jpg";
        const blobUrl = "blob:http://localhost/ocr-datauri";
        const dataUri = "data:image/png;base64,QUJD";
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdn, blobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: cdn, blob: null, dataUri, id: "o2" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: `![](${dataUri})` },
        };
      },
    },
    {
      name: "ocr-cdn-fallback",
      branch: "OCR",
      rung: "neither blob nor dataUri → CDN fallback",
      async setup() {
        const cdn = "https://cdn.mathpix.com/ocr-cdn.jpg";
        const blobUrl = "blob:http://localhost/ocr-cdn";
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdn, blobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: cdn, blob: null, dataUri: null, id: "o3" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: `![](${cdn})` },
        };
      },
    },
    {
      name: "ocr-undefined-bloburl",
      branch: "OCR",
      rung: "map entry with undefined blobUrl → skipped",
      async setup() {
        const cdn = "https://cdn.mathpix.com/ocr-undef.jpg";
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdn, undefined]]),
          imageRegistry: makeRegistry([]),
        });
        return {
          standIn,
          mmd: `![](${cdn})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: `![](${cdn})` },
        };
      },
    },
    {
      name: "ocr-undecodable-blob",
      branch: "OCR",
      rung: "undecodable blob → encode throws → CDN",
      async setup() {
        const cdn = "https://cdn.mathpix.com/ocr-bad.jpg";
        const blobUrl = "blob:http://localhost/ocr-bad";
        const badBlob = new Blob(["x"], { type: "image/png" });
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdn, blobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: cdn, blob: badBlob, dataUri: null, id: "o5" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: `![](${cdn})` },
        };
      },
    },

    // ---------------------------------------------------------------------
    // Chemistry branch (window.getMathPixMMDPreview().chemistryBlobUrlMap,
    // value shape { blobUrl })
    // ---------------------------------------------------------------------
    {
      name: "chem-cdn-in-mmd-live-bloburl",
      branch: "Chemistry",
      rung: "cdnUrl in MMD, LIVE blobUrl → fetch+encode",
      async setup() {
        const cdn = "https://cdn.mathpix.com/chem-happy.png";
        const blob = await makeRealImageBlob();
        const objectUrl = URL.createObjectURL(blob);
        const chemMap = new Map([[cdn, { blobUrl: objectUrl }]]);
        const orig = window.getMathPixMMDPreview;
        window.getMathPixMMDPreview = () => ({ chemistryBlobUrlMap: chemMap });
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: null,
        });
        return {
          standIn,
          mmd: `![](${cdn})`,
          formats: undefined,
          teardown: () => {
            URL.revokeObjectURL(objectUrl);
            window.getMathPixMMDPreview = orig;
          },
          expected: { kind: "encoded", absent: cdn },
        };
      },
    },
    {
      name: "chem-cdn-not-in-mmd",
      branch: "Chemistry",
      rung: "cdnUrl NOT in MMD → skipped",
      async setup() {
        const cdn = "https://cdn.mathpix.com/chem-absent.png";
        const chemMap = new Map([
          [cdn, { blobUrl: "blob:http://localhost/chem-absent" }],
        ]);
        const orig = window.getMathPixMMDPreview;
        window.getMathPixMMDPreview = () => ({ chemistryBlobUrlMap: chemMap });
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: null,
        });
        const mmd = "no chemistry here";
        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: () => {
            window.getMathPixMMDPreview = orig;
          },
          expected: { kind: "exact", value: mmd },
        };
      },
    },
    {
      name: "chem-entry-without-bloburl",
      branch: "Chemistry",
      rung: "chemEntry without blobUrl → skipped",
      async setup() {
        const cdn = "https://cdn.mathpix.com/chem-noblob.png";
        const chemMap = new Map([[cdn, {}]]);
        const orig = window.getMathPixMMDPreview;
        window.getMathPixMMDPreview = () => ({ chemistryBlobUrlMap: chemMap });
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: null,
        });
        const mmd = `![](${cdn})`;
        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: () => {
            window.getMathPixMMDPreview = orig;
          },
          expected: { kind: "exact", value: mmd },
        };
      },
    },
    {
      name: "chem-fake-bloburl-fetch-rejects",
      branch: "Chemistry",
      rung: "fake/never-created blob: URL → fetch rejects → CDN preserved",
      async setup() {
        const cdn = "https://cdn.mathpix.com/chem-fakeblob.png";
        const chemMap = new Map([
          [cdn, { blobUrl: "blob:http://localhost/never-created-xyz" }],
        ]);
        const orig = window.getMathPixMMDPreview;
        window.getMathPixMMDPreview = () => ({ chemistryBlobUrlMap: chemMap });
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: null,
        });
        const mmd = `![](${cdn})`;
        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: () => {
            window.getMathPixMMDPreview = orig;
          },
          expected: { kind: "exact", value: mmd },
        };
      },
    },

    // ---------------------------------------------------------------------
    // User-added branch (blob: regex scan, registry by originalUrl === blobUrl)
    // ---------------------------------------------------------------------
    {
      name: "user-blob-present",
      branch: "User-added",
      rung: "blob present → encodes",
      async setup() {
        const blobUrl = "blob:http://localhost/user-happy";
        const blob = await makeRealImageBlob();
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: makeRegistry([
            { originalUrl: blobUrl, blob, dataUri: null, id: "u1" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "encoded", absent: blobUrl },
        };
      },
    },
    {
      name: "user-datauri-passthrough",
      branch: "User-added",
      rung: "no blob, dataUri present → dataUri pass-through",
      async setup() {
        const blobUrl = "blob:http://localhost/user-datauri";
        const dataUri = "data:image/png;base64,WFla";
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: makeRegistry([
            { originalUrl: blobUrl, blob: null, dataUri, id: "u2" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: `![](${dataUri})` },
        };
      },
    },
    {
      name: "user-no-registry-match",
      branch: "User-added",
      rung: "blob: URL with no registry match → unresolvable, skipped",
      async setup() {
        const blobUrl = "blob:http://localhost/user-nomatch";
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: makeRegistry([]),
        });
        const mmd = `![](${blobUrl})`;
        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: mmd },
        };
      },
    },
    {
      name: "user-neither-blob-nor-datauri",
      branch: "User-added",
      rung: "neither blob nor dataUri → skipped",
      async setup() {
        const blobUrl = "blob:http://localhost/user-empty";
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: makeRegistry([
            { originalUrl: blobUrl, blob: null, dataUri: null, id: "u4" },
          ]),
        });
        const mmd = `![](${blobUrl})`;
        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: mmd },
        };
      },
    },

    // ---------------------------------------------------------------------
    // Cross-stage ordering (P1a) — these fixtures activate MORE THAN ONE
    // branch in a single MMD so the harness can detect a regression in the
    // ORDER of getMMDForAPI's three sequential steps (OCR → Chemistry →
    // User-added). The single-branch P0 fixtures above cannot see such a
    // regression because each isolates one step.
    //
    // Behavioural arm uses kind: "encoded-multi" — structural checks (every
    // target URL absent, "data:" present) because these are all encode paths.
    // ---------------------------------------------------------------------
    {
      name: "combined-all-three-branches",
      branch: "Ordering",
      rung: "OCR + Chemistry + User-added in one MMD → all three embed",
      async setup() {
        // OCR branch: CDN-keyed map → registry entry with a real blob.
        const ocrCdnUrl = "https://cdn.mathpix.com/combined-ocr.jpg";
        const ocrBlobUrl = "blob:http://localhost/combined-ocr";
        const ocrBlob = await makeRealImageBlob();

        // Chemistry branch: CDN-keyed stub map → LIVE object URL (fetched).
        const chemCdnUrl = "https://cdn.mathpix.com/combined-chem.png";
        const chemBlob = await makeRealImageBlob();
        const chemObjectUrl = URL.createObjectURL(chemBlob);
        const chemMap = new Map([[chemCdnUrl, { blobUrl: chemObjectUrl }]]);

        // User-added branch: registry entry keyed by its own blob: URL.
        const userBlobUrl = "blob:http://localhost/combined-user";
        const userBlob = await makeRealImageBlob();

        const orig = window.getMathPixMMDPreview;
        window.getMathPixMMDPreview = () => ({ chemistryBlobUrlMap: chemMap });

        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[ocrCdnUrl, ocrBlobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: ocrCdnUrl, blob: ocrBlob, dataUri: null, id: "c1-ocr" },
            { originalUrl: userBlobUrl, blob: userBlob, dataUri: null, id: "c1-user" },
          ]),
        });

        // MMD carries all three distinct URLs: the OCR blob URL, the chem CDN
        // URL, and the user-added blob URL.
        const mmd = `![](${ocrBlobUrl})\n\n![](${chemCdnUrl})\n\n![](${userBlobUrl})`;

        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: () => {
            URL.revokeObjectURL(chemObjectUrl);
            window.getMathPixMMDPreview = orig;
          },
          expected: {
            kind: "encoded-multi",
            absent: [ocrBlobUrl, chemCdnUrl, userBlobUrl],
          },
        };
      },
    },
    {
      name: "ordering-step2-gate-sees-step1-cdn",
      branch: "Ordering",
      rung: "Step 2 includes-gate reads Step 1 output, not the original MMD",
      async setup() {
        // OCR entry that FALLS BACK to its CDN URL: blob null + dataUri null,
        // so Step 1 sets replacement = originalUrl (cdnX) and rewrites
        // ocrBlobUrl → cdnX inside apiSafe.
        const cdnX = "https://cdn.mathpix.com/ordering-shared.png";
        const ocrBlobUrl = "blob:http://localhost/ordering-ocr";

        // Chemistry entry keyed by the SAME string (cdnX) with a LIVE object
        // URL. Step 2's gate only matches because Step 1 introduced cdnX.
        const chemBlob = await makeRealImageBlob();
        const chemObjectUrl = URL.createObjectURL(chemBlob);
        const chemMap = new Map([[cdnX, { blobUrl: chemObjectUrl }]]);

        const orig = window.getMathPixMMDPreview;
        window.getMathPixMMDPreview = () => ({ chemistryBlobUrlMap: chemMap });

        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdnX, ocrBlobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: cdnX, blob: null, dataUri: null, id: "c2-ocr" },
          ]),
        });

        // MMD contains ONLY ocrBlobUrl — cdnX appears solely after Step 1 runs.
        const mmd = `![](${ocrBlobUrl})`;

        return {
          standIn,
          mmd,
          formats: undefined,
          teardown: () => {
            URL.revokeObjectURL(chemObjectUrl);
            window.getMathPixMMDPreview = orig;
          },
          // cdnX-absent is the ordering proof: if Step 2 read the original MMD
          // it would never see cdnX, skip the chem embed, and cdnX would remain.
          expected: {
            kind: "encoded-multi",
            absent: [ocrBlobUrl, cdnX],
          },
        };
      },
    },

    // ---------------------------------------------------------------------
    // Early return (line 548)
    // ---------------------------------------------------------------------
    {
      name: "empty-input",
      branch: "Guard",
      rung: 'mmd = "" → early return',
      async setup() {
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map(),
          imageRegistry: null,
        });
        return {
          standIn,
          mmd: "",
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "exact", value: "" },
        };
      },
    },

    // ---------------------------------------------------------------------
    // Occurrence edge case (P2) — one image URL embedded TWICE in the MMD.
    // The single manifest entry must rewrite both occurrences, so the embedded
    // output carries the dataURI twice and the estimate must count occurrences
    // (2), not images (1). A per-image size would fail the estimate arm here by
    // exactly one dataURI delta.
    // ---------------------------------------------------------------------
    {
      name: "occurrence-ocr-blob-embedded-twice",
      branch: "OCR",
      rung: "same blob URL twice → both rewritten, occurrences counted",
      async setup() {
        const cdn = "https://cdn.mathpix.com/ocr-twice.jpg";
        const blobUrl = "blob:http://localhost/ocr-twice";
        const blob = await makeRealImageBlob();
        const standIn = makeStandIn({
          imageBlobUrlMap: new Map([[cdn, blobUrl]]),
          imageRegistry: makeRegistry([
            { originalUrl: cdn, blob, dataUri: null, id: "o-twice" },
          ]),
        });
        return {
          standIn,
          mmd: `![](${blobUrl})\n\nProse between the two copies.\n\n![](${blobUrl})`,
          formats: undefined,
          teardown: NOOP,
          expected: { kind: "encoded", absent: blobUrl },
        };
      },
    },
  ];

  // =========================================================================
  // RUNNER
  // =========================================================================

  function evaluateBehavioural(expected, liveOut) {
    if (expected.kind === "encoded") {
      const ok =
        typeof liveOut === "string" &&
        !liveOut.includes(expected.absent) &&
        liveOut.includes("data:");
      return {
        ok,
        detail: `expected target "${expected.absent}" absent and "data:" present`,
      };
    }
    if (expected.kind === "encoded-multi") {
      // Each target URL must be absent individually — we do NOT assume the
      // produced "data:" URIs differ from one another, so a single
      // includes("data:") cannot stand in for "every target was rewritten".
      const allAbsent =
        typeof liveOut === "string" &&
        expected.absent.every((url) => !liveOut.includes(url));
      const ok = allAbsent && liveOut.includes("data:");
      return {
        ok,
        detail: `expected all of [${expected.absent.join(", ")}] absent and "data:" present`,
      };
    }
    // exact
    const ok = liveOut === expected.value;
    return {
      ok,
      detail: `expected exact output ${JSON.stringify(expected.value)}, got ${JSON.stringify(liveOut)}`,
    };
  }

  /**
   * Run the convert-size characterisation harness.
   * @returns {Promise<{passed:number, failed:number, total:number, failures:Array<string>}>}
   */
  async function runConvertSizeTests() {
    logInfo("Starting convert-size characterisation harness");
    console.log("🧪 Convert-size P0 characterisation harness\n");

    let passed = 0;
    let failed = 0;
    let total = 0;
    const failures = [];

    function assert(label, condition) {
      total++;
      if (condition) {
        passed++;
      } else {
        failed++;
        failures.push(label);
      }
    }

    if (typeof MathPixSessionRestorer !== "function") {
      logError("MathPixSessionRestorer class not found");
      console.error(
        "❌ MathPixSessionRestorer not loaded — cannot run harness.",
      );
      return { passed: 0, failed: 1, total: 1, failures: ["class-not-loaded"] };
    }

    const proto = MathPixSessionRestorer.prototype;

    if (
      typeof proto.getMMDForAPI !== "function" ||
      typeof proto._estimateConvertSize !== "function"
    ) {
      logError(
        "getMMDForAPI / _estimateConvertSize missing from prototype",
      );
      console.error(
        "❌ getMMDForAPI or _estimateConvertSize missing — cannot run harness.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        failures: ["methods-missing"],
      };
    }

    for (const fixture of FIXTURES) {
      const { name, branch, rung } = fixture;
      let ctx;
      try {
        ctx = await fixture.setup();
      } catch (setupErr) {
        logError(`${name}: setup threw`, setupErr);
        assert(`${name} :: setup`, false);
        console.log(`❌ [${branch}] ${name} — ${rung} (setup threw)`);
        continue;
      }

      let liveOut;
      let estSize;
      let runErr = null;
      try {
        liveOut = await proto.getMMDForAPI.call(
          ctx.standIn,
          ctx.mmd,
          ctx.formats,
        );
        // Estimate arm (P2): computed inside the live window so chemistry
        // fixtures' stub and object URLs are still alive (teardown runs in the
        // finally below, after this call).
        estSize = await proto._estimateConvertSize.call(
          ctx.standIn,
          ctx.mmd,
          ctx.formats,
        );
      } catch (err) {
        runErr = err;
        logError(`${name}: invocation threw`, err);
      } finally {
        try {
          ctx.teardown();
        } catch (tdErr) {
          logWarn(`${name}: teardown threw`, tdErr);
        }
      }

      if (runErr) {
        assert(`${name} :: behavioural`, false);
        assert(`${name} :: estimate === embed size`, false);
        console.log(`❌ [${branch}] ${name} — ${rung} (invocation threw)`);
        continue;
      }

      // ---- Behavioural arm (proves the branch ran) ----
      const behav = evaluateBehavioural(ctx.expected, liveOut);
      assert(`${name} :: behavioural`, behav.ok);

      // ---- ESTIMATE ARM (P2) — the cheap projection must equal the gate's own
      //      measurement of the embedded output, byte for byte. Measuring the
      //      replayed manifest makes this exact, including the cascade case
      //      where a later step's URL exists only after an earlier step runs.
      const embedSize = new Blob([liveOut]).size;
      const estOk = estSize === embedSize;
      assert(`${name} :: estimate === embed size`, estOk);
      // ---- end estimate arm ----

      const ok = behav.ok && estOk;
      console.log(`${ok ? "✅" : "❌"} [${branch}] ${name} — ${rung}`);
      if (!behav.ok) {
        console.log(`    ↳ behavioural failed: ${behav.detail}`);
      }
      if (!estOk) {
        console.log(
          `    ↳ estimate failed: _estimateConvertSize=${estSize} !== embed ${embedSize}`,
        );
      }
    }

    // =====================================================================
    // P3 — encode cache + invalidation. Multi-call assertions the single-
    // estimate fixture shape cannot express, so they live here, not in
    // FIXTURES. Driven through buildManifest / _invalidateEncode / the memo
    // directly — not the real mutators (whose side effects span localStorage,
    // Cache-API and DOM).
    // =====================================================================
    try {
      const cacheCdn = "https://cdn.mathpix.com/cache-test.jpg";
      const cacheBlobUrl = "blob:http://localhost/cache-test";
      const cacheEntry = {
        originalUrl: cacheCdn,
        blob: await makeRealImageBlob(),
        dataUri: null,
        id: "cache-1",
      };
      const cacheStandIn = makeStandIn({
        imageBlobUrlMap: new Map([[cacheCdn, cacheBlobUrl]]),
        imageRegistry: makeRegistry([cacheEntry]),
      });
      const cacheMmd = `![](${cacheBlobUrl})`;

      // 1) First build encodes and populates the memo by id.
      const m1 = await cacheStandIn.buildManifest(cacheMmd);
      const realDataUri = m1[0]?.replacement;
      assert(
        "cache :: first build produced a dataURI",
        typeof realDataUri === "string" && realDataUri.startsWith("data:"),
      );
      assert(
        "cache :: memo populated by id after first build",
        cacheStandIn._encodeMemo?.get("cache-1") === realDataUri,
      );

      // 2) Poison the memo and rebuild — a HIT must return the poisoned value,
      //    proving the encode was skipped.
      const SENTINEL = "data:image/png;base64,SENTINELHIT";
      cacheStandIn._encodeMemo.set("cache-1", SENTINEL);
      const m2 = await cacheStandIn.buildManifest(cacheMmd);
      assert(
        "cache :: hit returns the memoised value (encode skipped)",
        m2[0]?.replacement === SENTINEL,
      );

      // 3) Invalidate by id and rebuild — the encode runs again, real dataURI.
      cacheStandIn._invalidateEncode("cache-1");
      assert(
        "cache :: invalidate drops the id",
        !cacheStandIn._encodeMemo.has("cache-1"),
      );
      const m3 = await cacheStandIn.buildManifest(cacheMmd);
      assert(
        "cache :: re-encode after invalidation returns the real dataURI",
        m3[0]?.replacement === realDataUri,
      );

      // 4) Swap mimic — change the bytes AND invalidate, as swapImage does.
      //    The estimate reports the NEW size and still equals the embed size.
      cacheEntry.blob = await makeRealImageBlob(64, "#cc3366");
      cacheStandIn._invalidateEncode("cache-1");
      const swappedEst = await cacheStandIn._estimateConvertSize(cacheMmd);
      const swappedEmbed = new Blob([
        await cacheStandIn.getMMDForAPI(cacheMmd),
      ]).size;
      assert(
        "cache :: estimate == embed size after swap+invalidate",
        swappedEst === swappedEmbed,
      );
      assert(
        "cache :: swapped estimate differs from the original size",
        swappedEst !== new Blob([`![](${realDataUri})`]).size,
      );

      // 5) Stale control — change the bytes WITHOUT invalidating; the memo must
      //    serve the prior encode, proving invalidation is what keeps it fresh.
      const beforeStale = cacheStandIn._encodeMemo.get("cache-1");
      cacheEntry.blob = await makeRealImageBlob(80, "#33cc66");
      const m5 = await cacheStandIn.buildManifest(cacheMmd);
      assert(
        "cache :: no invalidation → memo serves the prior encode (stale)",
        m5[0]?.replacement === beforeStale,
      );

      // 6) Delete mimic — drop the entry and invalidate; no substitution remains.
      cacheStandIn.imageRegistry = makeRegistry([]);
      cacheStandIn.imageBlobUrlMap = new Map();
      cacheStandIn._invalidateEncode("cache-1");
      const m6 = await cacheStandIn.buildManifest(cacheMmd);
      assert(
        "cache :: delete+invalidate → no substitution for the removed image",
        m6.length === 0,
      );
    } catch (cacheErr) {
      logError("cache tests threw", cacheErr);
      assert("cache :: block threw without completing", false);
    }

    // =====================================================================
    // P4a — shared limit-reader + over-limit message builder.
    // =====================================================================
    try {
      const probe = makeStandIn({
        imageBlobUrlMap: new Map(),
        imageRegistry: makeRegistry([]),
      });
      const expectedLimit =
        window.MATHPIX_CONFIG?.CONVERT?.EMBEDDING?.MAX_EMBEDDED_MMD_SIZE_BYTES ??
        window.MATHPIX_CONFIG?.CONVERT?.MAX_MMD_SIZE_BYTES ??
        10 * 1024 * 1024;
      assert(
        "limit :: reader equals the gate's three-tier fallback",
        probe._getConvertSizeLimit() === expectedLimit,
      );
      const tenMB = 10 * 1024 * 1024;
      const elevenMB = 11 * 1024 * 1024;
      const expectedMsg =
        "This document is too large to convert via the API after embedding image data — about 1.00 MB over the 10 MB limit (11.00 MB total). Try converting fewer formats at once, or contact support if this is a persistent issue with this document.";
      assert(
        "limit :: over-limit message matches the P8b wording",
        probe._buildOverLimitMessage(elevenMB, tenMB) === expectedMsg,
      );
    } catch (limitErr) {
      logError("P4a limit/message tests threw", limitErr);
      assert("limit :: block threw without completing", false);
    }

    // =====================================================================
    // P4b — size breakdown (counting replay) + band classifier.
    // =====================================================================
    try {
      const bCdn = "https://cdn.mathpix.com/bd.jpg";
      const bBlobUrl = "blob:http://localhost/bd";
      const bEntry = {
        originalUrl: bCdn,
        blob: await makeRealImageBlob(),
        dataUri: null,
        id: "bd-1",
      };
      const bStand = makeStandIn({
        imageBlobUrlMap: new Map([[bCdn, bBlobUrl]]),
        imageRegistry: makeRegistry([bEntry]),
      });
      const bMmd = `![](${bBlobUrl})`;
      const bd = await bStand._estimateConvertSizeBreakdown(bMmd);
      const bEst = await bStand._estimateConvertSize(bMmd);
      const bEmbed = new Blob([await bStand.getMMDForAPI(bMmd)]).size;
      const bDataUri = (await bStand.buildManifest(bMmd))[0]?.replacement;
      assert("breakdown :: total equals _estimateConvertSize", bd.total === bEst);
      assert("breakdown :: total equals the gate embed size", bd.total === bEmbed);
      assert(
        "breakdown :: image + text equals total",
        bd.imageBytes + bd.textBytes === bd.total,
      );
      assert(
        "breakdown :: imageBytes equals the embedded dataURI length",
        bd.imageBytes === bDataUri.length,
      );

      const b2Mmd = `![](${bBlobUrl})\n\ntext\n\n![](${bBlobUrl})`;
      const bd2 = await bStand._estimateConvertSizeBreakdown(b2Mmd);
      assert(
        "breakdown :: imageBytes counts both occurrences",
        bd2.imageBytes === bDataUri.length * 2,
      );
      assert(
        "breakdown :: two-image total equals the gate",
        bd2.total === new Blob([await bStand.getMMDForAPI(b2Mmd)]).size,
      );

      const fbCdn = "https://cdn.mathpix.com/fb.jpg";
      const fbStand = makeStandIn({
        imageBlobUrlMap: new Map([[fbCdn, "blob:http://localhost/fb"]]),
        imageRegistry: makeRegistry([
          { originalUrl: fbCdn, blob: null, dataUri: null, id: "fb-1" },
        ]),
      });
      const fbBd = await fbStand._estimateConvertSizeBreakdown(
        `![](blob:http://localhost/fb)`,
      );
      assert("breakdown :: CDN fallback adds no image bytes", fbBd.imageBytes === 0);
      assert(
        "breakdown :: fallback total is all text",
        fbBd.textBytes === fbBd.total,
      );

      const L = 1000;
      assert("band :: 0 is under", bStand._convertSizeBand(0, L) === "under");
      assert(
        "band :: just below close is under",
        bStand._convertSizeBand(899, L) === "under",
      );
      assert("band :: at 90% is close", bStand._convertSizeBand(900, L) === "close");
      assert(
        "band :: just below the limit is close",
        bStand._convertSizeBand(999, L) === "close",
      );
      assert("band :: at the limit is over", bStand._convertSizeBand(1000, L) === "over");
      assert(
        "band :: above the limit is over",
        bStand._convertSizeBand(1001, L) === "over",
      );
    } catch (bdErr) {
      logError("P4b breakdown/band tests threw", bdErr);
      assert("breakdown :: block threw without completing", false);
    }

    // =====================================================================
    // P4c — pure presentation logic: readout composition, band transition,
    // and offline (size-unavailable) inference.
    // =====================================================================
    try {
      const probe = makeStandIn({
        imageBlobUrlMap: new Map(),
        imageRegistry: makeRegistry([]),
      });
      const L = 10 * 1024 * 1024;

      const under = probe._composeConvertSizeReadout(
        { total: 300 * 1024, imageBytes: 200 * 1024, textBytes: 100 * 1024 },
        "under",
        L,
        false,
      );
      assert(
        "compose :: under readout shows the projected size",
        under.readout === `Projected size: ${probe._formatBytes(300 * 1024)}`,
      );
      assert("compose :: under has no detail", under.detail === "");

      const closeBd = {
        total: 9.5 * 1024 * 1024,
        imageBytes: 8 * 1024 * 1024,
        textBytes: 1.5 * 1024 * 1024,
      };
      const close = probe._composeConvertSizeReadout(closeBd, "close", L, false);
      assert(
        "compose :: close readout names the limit",
        close.readout.includes("close to the 10 MB limit"),
      );
      assert(
        "compose :: close detail reports the image bytes",
        close.detail.includes(`Images ${probe._formatBytes(closeBd.imageBytes)}`),
      );

      const overBd = {
        total: 11 * 1024 * 1024,
        imageBytes: 10 * 1024 * 1024,
        textBytes: 1 * 1024 * 1024,
      };
      const over = probe._composeConvertSizeReadout(overBd, "over", L, false);
      assert(
        "compose :: over readout names the limit",
        over.readout.includes("over the 10 MB limit"),
      );
      assert(
        "compose :: over detail equals the P8b message",
        over.detail === probe._buildOverLimitMessage(overBd.total, L),
      );

      const na = probe._composeConvertSizeReadout(overBd, "over", L, true);
      assert(
        "compose :: unavailable readout",
        na.readout === "Projected size: unavailable",
      );
      assert(
        "compose :: unavailable detail mentions connection",
        na.detail.includes("connection"),
      );

      assert(
        "transition :: first compute under is silent",
        probe._convertSizeTransition(null, "under") === null,
      );
      assert(
        "transition :: first compute over is silent (no startle)",
        probe._convertSizeTransition(null, "over") === null,
      );
      assert(
        "transition :: no change is silent",
        probe._convertSizeTransition("close", "close") === null,
      );
      assert(
        "transition :: entering close speaks",
        probe._convertSizeTransition("under", "close") ===
          "Projected convert size is close to the limit.",
      );
      assert(
        "transition :: entering over speaks",
        probe._convertSizeTransition("close", "over") ===
          "Projected convert size is over the limit.",
      );
      assert(
        "transition :: dropping over to close speaks close",
        probe._convertSizeTransition("over", "close") ===
          "Projected convert size is close to the limit.",
      );
      assert(
        "transition :: returning under speaks",
        probe._convertSizeTransition("close", "under") ===
          "Projected convert size is back under the limit.",
      );

      const realPreview = window.getMathPixMMDPreview;
      try {
        const chemCdn = "https://cdn.mathpix.com/chem-na.png";
        window.getMathPixMMDPreview = () => ({
          chemistryBlobUrlMap: new Map([
            [chemCdn, { blobUrl: "blob:http://localhost/chem-na" }],
          ]),
        });
        const mmdWithChem = `![](${chemCdn})`;
        assert(
          "unavailable :: chem in MMD but missing from manifest → unavailable",
          probe._convertSizeUnavailable(mmdWithChem, []) === true,
        );
        assert(
          "unavailable :: chem present in manifest → available",
          probe._convertSizeUnavailable(mmdWithChem, [
            { url: chemCdn, replacement: "data:x" },
          ]) === false,
        );
        assert(
          "unavailable :: chem not in MMD → available",
          probe._convertSizeUnavailable("no chem here", []) === false,
        );
        window.getMathPixMMDPreview = () => ({
          chemistryBlobUrlMap: new Map(),
        });
        assert(
          "unavailable :: empty chem map → available",
          probe._convertSizeUnavailable("anything", []) === false,
        );
      } finally {
        window.getMathPixMMDPreview = realPreview;
      }
    } catch (p4cErr) {
      logError("P4c presentation-logic tests threw", p4cErr);
      assert("compose :: block threw without completing", false);
    }

    // =====================================================================
    // P4d — orchestrator + announcer: presence and enhancement-absent safety.
    // =====================================================================
    try {
      const noDom = makeStandIn({
        imageBlobUrlMap: new Map(),
        imageRegistry: makeRegistry([]),
      });
      assert(
        "orchestrator :: _refreshConvertSizeIndicator exists",
        typeof noDom._refreshConvertSizeIndicator === "function",
      );
      assert(
        "orchestrator :: _announceConvertSize exists",
        typeof noDom._announceConvertSize === "function",
      );
      // With no this.elements, both must no-op rather than throw — the
      // indicator is an enhancement and must degrade silently.
      noDom._announceConvertSize("test");
      await noDom._refreshConvertSizeIndicator();
      assert(
        "orchestrator :: no-ops safely when the indicator markup is absent",
        true,
      );
    } catch (p4dErr) {
      logError("P4d smoke threw", p4dErr);
      assert("orchestrator :: smoke threw without completing", false);
    }

    console.log(
      `\n📊 Convert-size harness: ${passed}/${total} assertions passed` +
        (failed === 0 ? " — ALL CLEAR ✅" : ` (${failed} FAILED ❌)`),
    );
    if (failures.length > 0) {
      console.log("Failed assertions:");
      for (const f of failures) console.log(`  - ${f}`);
    }

    return { passed, failed, total, failures };
  }

  // =========================================================================
  // GLOBAL EXPOSURE
  // =========================================================================

  window.runConvertSizeTests = runConvertSizeTests;

  logInfo("Convert-size characterisation harness loaded");
  console.log(
    "💡 Type runConvertSizeTests() to run the convert-size P0 harness",
  );
})();
