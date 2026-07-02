/**
 * @fileoverview Registry reload-survival mirror suite — WRITE + HYDRATE guards
 * @module mathpix-registry-mirror-tests
 * @version 1.0.0
 *
 * @description
 * Console harness for the MathPixImageRegistry reload-survival mirror — the
 * quota-safe `mathpix-registry-current` localStorage snapshot that lets
 * user/AI provenance (alt text, long descriptions, titles, text-in-image)
 * survive a page reload and re-hydrate onto a freshly-rebuilt registry.
 *
 * Two synchronous arms, neither of which needs a real OCR session, a ZIP or a
 * network round-trip. Both drive the LIVE window.MathPixImageRegistry
 * constructor and both restore the real `mathpix-registry-current` key in a
 * finally block, so they are safe to run on a live page.
 *
 *   1. WRITE (runRegistryMirrorWriteTests) — exercises the debounced mirror
 *      writer: the write/cancel/schedule surface exists, a provenance edit
 *      schedules a write, _cancelMirrorWrite clears the pending timer,
 *      _writeMirrorNow flushes a valid JSON snapshot carrying altText +
 *      altTextSource, the snapshot is quota-safe (no base64 — dataUri null with
 *      an hadDataUri flag), every provenance updater schedules a write, and a
 *      re-schedule replaces rather than stacks the pending timer.
 *   2. HYDRATE (runRegistryMirrorHydrateTests) — exercises hydrateFromMirror:
 *      a fresh registry starts at the empty-alt baseline (source null), a round
 *      trip restores both alt and long provenance by CDN originalUrl match, a
 *      human ("user") field is never clobbered while an empty companion field IS
 *      filled, a URL mismatch applies nothing, malformed mirror shapes are safe
 *      (null / {} / non-array images / empty images), and the source allow-list
 *      rejects a garbage or null altTextSource.
 *
 * REGRESSION BASELINE — emitted-check floor: runRegistryMirrorWriteTests()
 * reports a `total` of 21 checks and runRegistryMirrorHydrateTests() reports a
 * `total` of 24 checks. These are the counts of every assert() EMITTED, pass or
 * fail. Treat the emitted totals (not pass counts) as the floor so they stay
 * honest as the suites grow: a change to an emitted total means a check was
 * added or removed, whereas a RED on today's code means the mirror
 * write/hydrate contract drifted from what these arms assert.
 *
 * NOTE: both runners are SYNCHRONOUS named functions. Each returns its results
 * object directly ({ passed, failed, total }) and prints a PASS/FAIL line list
 * plus a summary to the console as it goes. The { passed, failed, total } return
 * shape lets the pair join runFloorSummary in a later parcel.
 *
 * @usage
 * Include after the registry module in tools.html (alongside the other MathPix
 * testing harnesses).
 *   - window.runRegistryMirrorWriteTests()   — run the mirror WRITE suite
 *   - window.runRegistryMirrorHydrateTests()  — run the mirror HYDRATE suite
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
      console.error(`[RegistryMirrorTests] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[RegistryMirrorTests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[RegistryMirrorTests] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[RegistryMirrorTests] ${message}`, ...args);
  }

  // =========================================================================
  // RUNNER — mirror WRITE
  // =========================================================================

  function runRegistryMirrorWriteTests() {
    const KEY = "mathpix-registry-current";
    let pass = 0, fail = 0;
    const results = [];
    const assert = (name, cond) => {
      if (cond) { pass++; results.push(["PASS", name]); }
      else { fail++; results.push(["FAIL", name]); }
    };
    const regs = [];
    let original = null;
    try { original = localStorage.getItem(KEY); } catch (e) {}
    try {
      if (typeof window.MathPixImageRegistry !== "function") {
        console.log("ABORT: window.MathPixImageRegistry is not available on this page.");
        return { passed: 0, failed: 0, total: 0 };
      }
      assert("window.MathPixImageRegistry is a constructor", typeof window.MathPixImageRegistry === "function");
      const reg = new window.MathPixImageRegistry();
      regs.push(reg);
      assert("_writeMirrorNow is a function", typeof reg._writeMirrorNow === "function");
      assert("_cancelMirrorWrite is a function", typeof reg._cancelMirrorWrite === "function");
      assert("_scheduleMirrorWrite is a function", typeof reg._scheduleMirrorWrite === "function");
      assert("_pendingMirrorTimer starts null", reg._pendingMirrorTimer === null);
      const added = reg.addImage({ syntax: "markdown" });
      const id = added && added.id;
      assert("addImage returned an entry with an id", typeof id === "string" && id.length > 0);
      reg.updateAltText(id, "Aspirin test alt", "ai-generated");
      assert("updateAltText schedules a write (timer set)", reg._pendingMirrorTimer !== null);
      reg._cancelMirrorWrite();
      assert("_cancelMirrorWrite clears the timer", reg._pendingMirrorTimer === null);
      reg._writeMirrorNow();
      let raw = null, parsed = null;
      try { raw = localStorage.getItem(KEY); } catch (e) {}
      assert("_writeMirrorNow wrote the mirror key", typeof raw === "string" && raw.length > 0);
      try { parsed = JSON.parse(raw); } catch (e) {}
      assert("mirror is valid JSON", parsed !== null && typeof parsed === "object");
      assert("mirror has an images array", !!parsed && Array.isArray(parsed.images));
      const mImg = parsed && parsed.images && parsed.images[0];
      assert("mirror image carries altTextSource ai-generated", !!mImg && mImg.altTextSource === "ai-generated");
      assert("mirror image carries the alt text", !!mImg && mImg.altText === "Aspirin test alt");
      const noBase64 = !!parsed && parsed.images.every((im) => im.dataUri === null && typeof im.hadDataUri === "boolean");
      assert("quota safety: no base64 in mirror (dataUri null, hadDataUri flag present)", noBase64 === true);
      const reg2 = new window.MathPixImageRegistry();
      regs.push(reg2);
      const a2 = reg2.addImage({ syntax: "markdown" });
      const id2 = a2 && a2.id;
      assert("second registry has an id", typeof id2 === "string" && id2.length > 0);
      for (const m of ["updateAltText", "updateLongDescription", "updateTitle", "updateTextInImage"]) {
        reg2._cancelMirrorWrite();
        reg2[m](id2, "x", "user");
        assert(`${m} schedules a mirror write`, reg2._pendingMirrorTimer !== null);
      }
      const h1 = reg2._pendingMirrorTimer;
      reg2._scheduleMirrorWrite();
      const h2 = reg2._pendingMirrorTimer;
      assert("re-schedule replaces the pending timer", h2 !== null && h2 !== h1);
      reg2._cancelMirrorWrite();
      assert("cancel after re-schedule leaves no pending timer", reg2._pendingMirrorTimer === null);
    } finally {
      for (const r of regs) { try { r._cancelMirrorWrite(); } catch (e) {} }
      try {
        if (original === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, original);
      } catch (e) {}
    }
    console.log("\n=== Registry mirror WRITE tests ===");
    for (const [status, name] of results) console.log(`${status}  ${name}`);
    console.log(`\nPASS ${pass}  FAIL ${fail}  TOTAL ${pass + fail}`);
    return { passed: pass, failed: fail, total: pass + fail };
  }

  // =========================================================================
  // RUNNER — mirror HYDRATE
  // =========================================================================

  function runRegistryMirrorHydrateTests() {
    const KEY = "mathpix-registry-current";
    let pass = 0, fail = 0;
    const results = [];
    const assert = (name, cond) => {
      if (cond) { pass++; results.push(["PASS", name]); }
      else { fail++; results.push(["FAIL", name]); }
    };
    const regs = [];
    let original = null;
    try { original = localStorage.getItem(KEY); } catch (e) {}
    try {
      if (typeof window.MathPixImageRegistry !== "function") {
        console.log("ABORT: window.MathPixImageRegistry is not available on this page.");
        return { passed: 0, failed: 0, total: 0 };
      }
      const URL1 = "https://cdn.mathpix.com/cropped/hydrate-test-1.jpg";
      const URL2 = "https://cdn.mathpix.com/cropped/hydrate-test-2.jpg";
      const mmd1 = "Some text\n![](" + URL1 + ")\nMore text";
      const mmd2 = "Other\n![](" + URL2 + ")\n";
      const mk = (m) => { const r = new window.MathPixImageRegistry(); regs.push(r); if (m) r.buildFromMMD(m); return r; };
      const firstId = (r) => (r.getAllImages()[0] || {}).id;
      const probe = mk(null);
      assert("hydrateFromMirror is a function", typeof probe.hydrateFromMirror === "function");
      const reg1 = mk(mmd1);
      const id1 = firstId(reg1);
      assert("fixture: reg1 has one image with id", typeof id1 === "string" && id1.length > 0);
      assert("fixture: fresh alt source is null (empty-alt baseline)", reg1.getImage(id1).altTextSource === null);
      reg1.updateAltText(id1, "Aspirin desc", "ai-generated");
      reg1.updateLongDescription(id1, "Aspirin long", "ai-generated");
      const mirror = reg1.toJSON();
      assert("fixture: mirror image carries CDN originalUrl", mirror.images[0] && mirror.images[0].originalUrl === URL1);
      const reg2 = mk(mmd1);
      const res2 = reg2.hydrateFromMirror(mirror);
      assert("round trip: matched === 1", res2.matched === 1);
      assert("round trip: applied === 2", res2.applied === 2);
      const e2 = reg2.getImage(firstId(reg2));
      assert("round trip: altTextSource restored to ai-generated", e2.altTextSource === "ai-generated");
      assert("round trip: altText restored", e2.altText === "Aspirin desc");
      assert("round trip: longDescriptionSource restored", e2.longDescriptionSource === "ai-generated");
      assert("round trip: longDescription restored", e2.longDescription === "Aspirin long");
      const reg3 = mk(mmd1);
      const id3 = firstId(reg3);
      reg3.updateAltText(id3, "Human alt", "user");
      const res3 = reg3.hydrateFromMirror(mirror);
      const e3 = reg3.getImage(id3);
      assert("no-clobber: alt stays user", e3.altTextSource === "user" && e3.altText === "Human alt");
      assert("no-clobber: empty long IS filled from mirror", e3.longDescriptionSource === "ai-generated");
      assert("no-clobber: only the empty field applied (applied === 1)", res3.applied === 1);
      const reg4 = mk(mmd2);
      const res4 = reg4.hydrateFromMirror(mirror);
      const e4 = reg4.getImage(firstId(reg4));
      assert("mismatch: matched === 0", res4.matched === 0);
      assert("mismatch: nothing applied", res4.applied === 0);
      assert("mismatch: source still null", e4.altTextSource === null);
      const safe = (m) => { try { const r = probe.hydrateFromMirror(m); return r && r.matched === 0 && r.applied === 0; } catch (e) { return false; } };
      assert("malformed: null is safe", safe(null));
      assert("malformed: {} is safe", safe({}));
      assert("malformed: images not an array is safe", safe({ images: "nope" }));
      assert("malformed: empty images is safe", safe({ images: [] }));
      const reg5 = mk(mmd1);
      const res5 = reg5.hydrateFromMirror({ images: [{ originalUrl: URL1, altText: "x", altTextSource: "garbage" }] });
      const e5 = reg5.getImage(firstId(reg5));
      assert("allow-list: garbage source rejected (still null)", e5.altTextSource === null);
      assert("allow-list: matched the URL but applied nothing", res5.matched === 1 && res5.applied === 0);
      const reg6 = mk(mmd1);
      const res6 = reg6.hydrateFromMirror({ images: [{ originalUrl: URL1, altText: "x", altTextSource: null }] });
      const e6 = reg6.getImage(firstId(reg6));
      assert("null source: not applied (still null)", e6.altTextSource === null);
      assert("null source: applied === 0", res6.applied === 0);
    } finally {
      for (const r of regs) { try { r._cancelMirrorWrite(); } catch (e) {} }
      try {
        if (original === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, original);
      } catch (e) {}
    }
    console.log("\n=== Registry mirror HYDRATE tests ===");
    for (const [status, name] of results) console.log(`${status}  ${name}`);
    console.log(`\nPASS ${pass}  FAIL ${fail}  TOTAL ${pass + fail}`);
    return { passed: pass, failed: fail, total: pass + fail };
  }

  // =========================================================================
  // GLOBAL EXPOSURE
  // =========================================================================

  window.runRegistryMirrorWriteTests = runRegistryMirrorWriteTests;
  window.runRegistryMirrorHydrateTests = runRegistryMirrorHydrateTests;

  logInfo("Registry reload-survival mirror harness loaded");
  console.log(
    "💡 Type runRegistryMirrorWriteTests() or runRegistryMirrorHydrateTests() to run the mirror suites",
  );
})();
