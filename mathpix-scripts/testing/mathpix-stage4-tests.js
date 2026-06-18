/**
 * @fileoverview Stage 4 test runner — verifies the metadata cluster, key
 *   row, coverage counter, and Alt button placeholder added in Stage 4.B
 *   Chunks 1-2.
 * @module MathPixStage4Tests
 * @requires MathPixImageRegistry, MathPixImageManagerUI
 * @version 1.0.0 (Stage 4.B Chunk 3)
 *
 * Per stage-4-planning-decisions.md Q6: two-group layered runner.
 *
 * Group 2 (always runs) — renderer unit tests against synthetic registry
 *   entries invoked through MathPixImageManagerUI._buildImageCard. Asserts
 *   on cluster presence, role="group", dynamic aria-label, slot icon
 *   mapping per state (caption / alt / longDesc / decorative override),
 *   and Alt button --needs-attention variant.
 *
 * Group 3 (preconditioned) — integration consistency between the loaded
 *   registry and the rendered DOM. Reports as skipped (not failed) when
 *   preconditions (MathPix mode active, manager open, registry loaded,
 *   registry non-empty) are not all met.
 *
 * Usage: `window.runStage4Tests()` from the console. Returns
 *   { passed, failed, skipped, results }.
 *
 * @see mathpix-scripts/docs/alt-text/stage-4-planning-decisions.md — Q6
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
    if (shouldLog(0)) console.error(`[Stage4Tests] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(1)) console.warn(`[Stage4Tests] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(2)) console.log(`[Stage4Tests] ${msg}`, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(3)) console.log(`[Stage4Tests] ${msg}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  // Mirrors the module-private COUNTER_DESCRIPTION in mathpix-image-manager-ui.js.
  // If that copy changes, this snapshot test will flag the divergence.
  const COUNTER_DESCRIPTION =
    "Counts images with alt text or marked decorative.";

  // Group 3 assertion count — used for skip bookkeeping when preconditions
  // are not all met. Keep in sync with the assertions in runGroup3().
  const GROUP_3_ASSERTION_COUNT = 10;

  // ============================================================================
  // RESULTS ACCUMULATOR
  // ============================================================================

  function makeResults() {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];

    function assert(label, condition, detail) {
      if (condition) {
        passed++;
        results.push({ label, passed: true, error: null });
        console.log(`  ✓ ${label}`);
        return true;
      }
      failed++;
      const errMsg = detail || null;
      results.push({ label, passed: false, error: errMsg });
      console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
      return false;
    }

    function skip(count) {
      skipped += count;
    }

    return {
      get passed() {
        return passed;
      },
      get failed() {
        return failed;
      },
      get skipped() {
        return skipped;
      },
      results,
      assert,
      skip,
    };
  }

  // ============================================================================
  // STUB MANAGER FOR RENDERER UNIT TESTS
  // ============================================================================

  /**
   * Resolve the MathPixImageManagerUI class. The IIFE at the bottom of
   * mathpix-image-manager-ui.js exposes a namespace object
   * `{ MathPixImageManagerUI, getInstance }` on window — so the class itself
   * is at `window.MathPixImageManagerUI.MathPixImageManagerUI`. A
   * defensive fallback handles the (unlikely) future case where the class
   * is exposed directly on window.
   *
   * @returns {Function|null}
   */
  function resolveManagerClass() {
    const ns = window.MathPixImageManagerUI;
    if (!ns) return null;
    if (typeof ns === "function") return ns;
    if (typeof ns.MathPixImageManagerUI === "function") {
      return ns.MathPixImageManagerUI;
    }
    return null;
  }

  /**
   * Build a minimal MathPixImageManagerUI stub for invoking _buildImageCard
   * outside of a live manager session.
   *
   * _buildImageCard reads only:
   *   - this.restorer.imageFilenameMap (defaulted to {} inside the method)
   *   - this.restorer.imageBlobUrlMap (defaulted to null — safe in _getImageSrc)
   *   - this._escapeAttr / this._escapeHTML (pure helpers on the prototype)
   *
   * Using Object.create avoids invoking the constructor, which would refuse
   * an absent restorer with logError.
   *
   * @returns {Object|null} Stub instance with prototype methods, or null if
   *   the class is not exposed.
   */
  function makeStubManager() {
    const Cls = resolveManagerClass();
    if (!Cls) return null;
    const stub = Object.create(Cls.prototype);
    stub.restorer = { imageFilenameMap: {}, imageBlobUrlMap: null };
    return stub;
  }

  /**
   * Parse an _buildImageCard HTML string into a DOM card element.
   * @param {string} html
   * @returns {HTMLLIElement|null}
   */
  function parseCard(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<ul>${html}</ul>`, "text/html");
    return doc.querySelector("li.image-manager-card");
  }

  /**
   * Build a baseline entry — caller mixes in overrides.
   * @param {Object} overrides
   * @returns {Object}
   */
  function baseEntry(overrides) {
    return {
      id: "img-test",
      altText: "",
      title: "",
      longDescription: "",
      decorative: false,
      status: "downloaded",
      fileSize: 100,
      mimeType: "image/png",
      ...overrides,
    };
  }

  // ============================================================================
  // GROUP 2 — RENDERER UNIT TESTS
  // ============================================================================

  function runGroup2(r) {
    console.log(
      "\n--- Group 2: Renderer unit tests (8 synthetic entries) ---",
    );

    const mgr = makeStubManager();
    if (!mgr) {
      r.assert(
        "MathPixImageManagerUI exposed on window",
        false,
        "class not on window — load order issue",
      );
      return;
    }
    r.assert("MathPixImageManagerUI exposed on window", true);

    // --------------------------------------------------------------------
    // Case 1: Empty entry (no caption, no alt, no longDesc, not decorative)
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({ id: "img-test-1" });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");

      r.assert(
        "Empty entry — cluster present with role=\"group\"",
        !!cluster && cluster.getAttribute("role") === "group",
      );
      r.assert(
        "Empty entry — aria-label exact match",
        cluster?.getAttribute("aria-label") ===
          "Accessibility metadata: Caption missing, alt text missing, long description missing",
      );
      r.assert("Empty entry — cluster contains 0 slots", slots?.length === 0);
      r.assert("Empty entry — Alt button present", !!altBtn);
      r.assert(
        "Empty entry — Alt button has --needs-attention modifier",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          true,
      );
    }

    // --------------------------------------------------------------------
    // Case 2: Caption only
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({ id: "img-test-2", title: "Test caption" });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");

      r.assert("Caption only — cluster has 1 slot", slots?.length === 1);
      r.assert(
        "Caption only — slot data-icon=\"message\"",
        slots?.[0]?.getAttribute("data-icon") === "message",
      );
      r.assert(
        "Caption only — aria-label includes \"Caption set\"",
        (cluster?.getAttribute("aria-label") || "").includes("Caption set"),
      );
      r.assert(
        "Caption only — Alt button has --needs-attention (altState still no-alt)",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          true,
      );
    }

    // --------------------------------------------------------------------
    // Case 3: Alt only
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({ id: "img-test-3", altText: "Test alt" });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");

      r.assert("Alt only — cluster has 1 slot", slots?.length === 1);
      r.assert(
        "Alt only — slot data-icon=\"missingAlt\"",
        slots?.[0]?.getAttribute("data-icon") === "missingAlt",
      );
      r.assert(
        "Alt only — aria-label includes \"alt text set\"",
        (cluster?.getAttribute("aria-label") || "").includes("alt text set"),
      );
      r.assert(
        "Alt only — Alt button does NOT have --needs-attention",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          false,
      );
    }

    // --------------------------------------------------------------------
    // Case 4: Long description only
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({
        id: "img-test-4",
        longDescription: "Test long description",
      });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");

      r.assert("LongDesc only — cluster has 1 slot", slots?.length === 1);
      r.assert(
        "LongDesc only — slot data-icon=\"document\"",
        slots?.[0]?.getAttribute("data-icon") === "document",
      );
      r.assert(
        "LongDesc only — aria-label includes \"long description set\"",
        (cluster?.getAttribute("aria-label") || "").includes(
          "long description set",
        ),
      );
      r.assert(
        "LongDesc only — Alt button has --needs-attention (altState still no-alt)",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          true,
      );
    }

    // --------------------------------------------------------------------
    // Case 5: All three set, not decorative
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({
        id: "img-test-5",
        title: "C",
        altText: "A",
        longDescription: "L",
      });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");
      const ariaLabel = cluster?.getAttribute("aria-label") || "";

      r.assert("All three — cluster has 3 slots", slots?.length === 3);
      r.assert(
        "All three — slot 0 data-icon=\"message\"",
        slots?.[0]?.getAttribute("data-icon") === "message",
      );
      r.assert(
        "All three — slot 1 data-icon=\"missingAlt\"",
        slots?.[1]?.getAttribute("data-icon") === "missingAlt",
      );
      r.assert(
        "All three — slot 2 data-icon=\"document\"",
        slots?.[2]?.getAttribute("data-icon") === "document",
      );
      r.assert(
        "All three — aria-label mentions caption + alt + longDesc set",
        ariaLabel.includes("Caption set") &&
          ariaLabel.includes("alt text set") &&
          ariaLabel.includes("long description set"),
      );
      r.assert(
        "All three — Alt button does NOT have --needs-attention",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          false,
      );
    }

    // --------------------------------------------------------------------
    // Case 6: Decorative, all empty (alt + longDesc collapse to a SINGLE
    //   eyeOff slot — the dimensions always travel together when
    //   decorative is on, so the cluster emits one icon, not two)
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({ id: "img-test-6", decorative: true });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");
      const ariaLabel = cluster?.getAttribute("aria-label") || "";

      r.assert("Decorative empty — cluster has 1 slot", slots?.length === 1);
      r.assert(
        "Decorative empty — single slot data-icon=\"eyeOff\"",
        slots?.[0]?.getAttribute("data-icon") === "eyeOff",
      );
      r.assert(
        "Decorative empty — aria-label includes \"decorative\" wording",
        ariaLabel.includes("decorative"),
      );
      r.assert(
        "Decorative empty — Alt button does NOT have --needs-attention",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          false,
      );
    }

    // --------------------------------------------------------------------
    // Case 7: Decorative with caption (caption slot plus a SINGLE
    //   decorative slot — two total, not three)
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({
        id: "img-test-7",
        title: "C",
        decorative: true,
      });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const ariaLabel = cluster?.getAttribute("aria-label") || "";

      r.assert(
        "Decorative + caption — cluster has 2 slots",
        slots?.length === 2,
      );
      r.assert(
        "Decorative + caption — slot 0 data-icon=\"message\"",
        slots?.[0]?.getAttribute("data-icon") === "message",
      );
      r.assert(
        "Decorative + caption — slot 1 data-icon=\"eyeOff\"",
        slots?.[1]?.getAttribute("data-icon") === "eyeOff",
      );
      r.assert(
        "Decorative + caption — aria-label reflects caption set + collapsed skip wording",
        ariaLabel.includes("Caption set") &&
          ariaLabel.includes(
            "alt text and long description skipped (decorative)",
          ),
      );
    }

    // --------------------------------------------------------------------
    // Case 8: Decorative + stored altText (legacy conflict — Q2: decorative
    //   wins; stored altText is invisible at the grid layer). Single
    //   decorative slot, mirroring Case 6.
    // --------------------------------------------------------------------
    {
      const entry = baseEntry({
        id: "img-test-8",
        altText: "should be invisible",
        decorative: true,
      });
      const card = parseCard(mgr._buildImageCard(entry, 0, 1));
      const cluster = card?.querySelector(
        ".mmd-image-manager-metadata-cluster",
      );
      const slots = cluster?.querySelectorAll(
        ".mmd-image-manager-metadata-slot",
      );
      const altBtn = card?.querySelector(".image-manager-alt-btn");

      r.assert(
        "Decorative + altText (Q2 conflict) — cluster has 1 slot",
        slots?.length === 1,
      );
      r.assert(
        "Decorative + altText (Q2 conflict) — single slot data-icon=\"eyeOff\"",
        slots?.[0]?.getAttribute("data-icon") === "eyeOff",
      );
      r.assert(
        "Decorative + altText (Q2 conflict) — Alt button does NOT have --needs-attention",
        altBtn?.classList.contains("image-manager-alt-btn--needs-attention") ===
          false,
      );
    }
  }

  // ============================================================================
  // GROUP 3 — INTEGRATION CONSISTENCY TESTS (preconditioned)
  // ============================================================================

  /**
   * Reach into the session restorer for the live registry instance.
   * Returns null when the restorer or its registry is not yet available.
   */
  function getRegistry() {
    try {
      if (typeof window.getMathPixSessionRestorer !== "function") return null;
      const restorer = window.getMathPixSessionRestorer();
      return restorer ? restorer.imageRegistry || null : null;
    } catch (e) {
      logWarn("getRegistry threw:", e);
      return null;
    }
  }

  function checkPreconditions() {
    const mathpixRadio = document.getElementById("MathPix");
    const counter = document.getElementById(
      "mmd-image-manager-coverage-counter",
    );
    const registry = getRegistry();

    return {
      mathpixModeActive: !!(mathpixRadio && mathpixRadio.checked),
      managerOpen: !!counter,
      registryAvailable: !!registry,
      registryNonEmpty:
        !!registry &&
        typeof registry.getCount === "function" &&
        registry.getCount() > 0,
    };
  }

  function runGroup3(r) {
    const registry = getRegistry();
    const counter = document.getElementById(
      "mmd-image-manager-coverage-counter",
    );

    // 1. Counter element exists
    r.assert("Counter element exists in DOM", !!counter);

    // 2. Counter text format
    const counterText = (counter?.textContent || "").trim();
    r.assert(
      `Counter text matches /^\\d+\\/\\d+ covered$/ (got "${counterText}")`,
      /^\d+\/\d+ covered$/.test(counterText),
    );

    // 3. aria-live === "polite"
    r.assert(
      "Counter aria-live === \"polite\"",
      counter?.getAttribute("aria-live") === "polite",
    );

    // 4. aria-describedby resolves to .visually-hidden element with COUNTER_DESCRIPTION
    const describedById = counter?.getAttribute("aria-describedby");
    const descEl = describedById
      ? document.getElementById(describedById)
      : null;
    r.assert(
      "Counter aria-describedby points to .visually-hidden span with description text",
      !!descEl &&
        descEl.classList.contains("visually-hidden") &&
        descEl.textContent.trim() === COUNTER_DESCRIPTION,
    );

    // 5. --complete modifier rule: present iff M === N AND N > 0
    const allImages = registry.getAllImages();
    const N = registry.getCount();
    const M = allImages.filter(
      (e) =>
        window.MathPixImageRegistry.getAltCompletionStatus(e) !== "no-alt",
    ).length;
    const hasComplete = !!counter?.classList.contains(
      "mmd-image-manager-coverage-counter--complete",
    );
    const shouldComplete = M === N && N > 0;
    r.assert(
      `Counter --complete modifier rule (M=${M}, N=${N}, expected ${shouldComplete}, got ${hasComplete})`,
      hasComplete === shouldComplete,
    );

    // 6 & 7: M / N values match registry-derived numbers
    const parsed = counterText.match(/^(\d+)\/(\d+) covered$/);
    r.assert(
      `Counter M value matches registry-derived count (expected ${M})`,
      !!parsed && parseInt(parsed[1], 10) === M,
    );
    r.assert(
      `Counter N value matches registry.getCount() (expected ${N})`,
      !!parsed && parseInt(parsed[2], 10) === N,
    );

    // 8. Key row with 5 items (caption / alt / longDesc / decorative /
    //    needs-attention — the last added so the in-button warning
    //    icon is explained alongside the metadata-cluster icons)
    const keyRow = document.querySelector(".mmd-image-manager-icon-key");
    const keyItems = keyRow?.querySelectorAll(
      ".mmd-image-manager-icon-key-item",
    );
    r.assert(
      "Key row exists with role=\"group\" and 5 child items",
      !!keyRow &&
        keyRow.getAttribute("role") === "group" &&
        keyItems?.length === 5,
    );

    // 9 & 10: Every rendered card has a valid cluster and an Alt button
    const cards = document.querySelectorAll(".image-manager-card");
    let allCardsHaveCluster = cards.length > 0;
    let allCardsHaveAltBtn = cards.length > 0;
    cards.forEach((card) => {
      const c = card.querySelector(".mmd-image-manager-metadata-cluster");
      if (
        !c ||
        c.getAttribute("role") !== "group" ||
        !c.getAttribute("aria-label")
      ) {
        allCardsHaveCluster = false;
      }
      if (!card.querySelector(".image-manager-alt-btn")) {
        allCardsHaveAltBtn = false;
      }
    });
    r.assert(
      `Every card (${cards.length}) has a valid metadata cluster`,
      allCardsHaveCluster,
    );
    r.assert(
      `Every card (${cards.length}) has an Alt button`,
      allCardsHaveAltBtn,
    );
  }

  // ============================================================================
  // TOP-LEVEL RUNNER
  // ============================================================================

  function runStage4Tests() {
    console.log("=== Stage 4 Tests ===");
    const r = makeResults();

    const pre = checkPreconditions();
    console.log("Preconditions:");
    console.log(`  ${pre.mathpixModeActive ? "✓" : "✗"} mathpixModeActive`);
    console.log(`  ${pre.managerOpen ? "✓" : "✗"} managerOpen`);
    console.log(`  ${pre.registryAvailable ? "✓" : "✗"} registryAvailable`);
    console.log(`  ${pre.registryNonEmpty ? "✓" : "✗"} registryNonEmpty`);

    // Group 2 — always runs
    runGroup2(r);

    // Group 3 — preconditioned
    const allMet =
      pre.mathpixModeActive &&
      pre.managerOpen &&
      pre.registryAvailable &&
      pre.registryNonEmpty;

    if (allMet) {
      console.log("\n--- Group 3: Integration consistency tests ---");
      runGroup3(r);
    } else {
      const failing = Object.entries(pre)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ");
      const plural = failing.includes(",") ? "s" : "";
      console.log(
        `\n--- Group 3: SKIPPED (${failing} precondition${plural} missing) ---`,
      );
      r.skip(GROUP_3_ASSERTION_COUNT);
    }

    console.log(
      `\nResults: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped`,
    );

    return {
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      results: r.results,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runStage4Tests = runStage4Tests;

  logInfo("Stage 4 test runner registered: window.runStage4Tests()");
})();
