/**
 * Door Panel Studio - the checks harness.
 *
 * Every canary, the reading reconstruction, the solver's both-directions
 * proof, and the exhaustive enumeration with its per-mode baselines. Split
 * out of door-panel-studio.html on 14 August 2026.
 *
 * It reads the app's INTERNALS rather than its public API, on purpose: this
 * is the instrument that measures the app, so it is allowed to see inside.
 * Loaded after the app, which is what makes the bridge available here.
 */
(function () {
  "use strict";

  const DPS = window.DoorPanelStudioInternals;
  if (!DPS) {
    console.error(
      "Door Panel Studio: the checks harness loaded without the app. Nothing here can run."
    );
    return;
  }
  const {
    BADGE_LOOKS,
    CHROMA_CEILING_SAMPLES,
    Engine,
    Model,
    SHORT_VIEWPORT_QUERY,
    announce,
    badgeCandidates,
    bindingModeFor,
    bindingSetLabel,
    clampCapForRole,
    cloneState,
    derive,
    escapeHtml,
    gateFor,
    logError,
    measureBox,
    paintPanel,
    readingDepartures,
    separationMatrix,
    state,
    surfaceElement,
    swatchHtml,
    verdictHtml,
    getLastDerived,
  } = DPS;

/* ==================================================================
   THE EXHAUSTIVE ENUMERATION

   The ten gallery cards are CURATED - a handful of configurations
   chosen to be worth looking at. This is the other thing: every cell
   of the space the tool already owns, badge style x chroma ceiling x
   set size, each one stating its pool, its gate, its best separation
   and the mode that binds it.

   Two rules it is built to obey:

   - A cell that produces no set says WHY, as a result. A blank would
     be indistinguishable from a cell nobody computed, and the count
     of stated-reason cells is printed beside the count of rendered
     ones so a silent cap cannot hide in the difference.
   - Its own figures are cross-checked against the recorded baselines
     BY SET MEMBERSHIP, not by count. Two different trios can share a
     delta E; only the names settle whether the pool moved.
   ================================================================== */

const ENUMERATION_MAX_N = 10;

/**
 * The recorded baselines, as data. Every one of these was measured in
 * an earlier iteration and written into the report; if the enumeration
 * disagrees with any of them, the pool has moved and that is a stop.
 */
/**
 * BASELINES ARE MODE-SCOPED, AND THAT IS THE WHOLE POINT.
 *
 * Every figure recorded in iterations 7 to 9 was measured with
 * greyscale in the binding set. Unbinding greyscale changes what the
 * solver optimises, so those figures are not the new answers - and
 * quietly overwriting them with the new ones would destroy the only
 * evidence that the change did what it was meant to do. So both sets
 * run, each under its own binding mode, and both are reported.
 *
 * The pool ladder is deliberately shared between them. Pools come from
 * the contrast gates and the chroma ceiling; the binding set steers
 * dispersion AMONG pool members and cannot touch membership. If a pool
 * count differs between the two modes, that is a bug, not a baseline.
 */
const ENUMERATION_BASELINE_MODES = [
  {
    id: "greyscale-binding",
    label: "Greyscale binding (as recorded in iterations 7 to 9)",
    designFor: Object.freeze({
      colourBlindness: true,
      greyscale: true,
    }),
    baselines: Object.freeze([
      Object.freeze({
        label:
          "Filled, ceiling off, n=3 is White / Digital Blue / Horizon 03 at delta E 16.95",
        style: Model.BADGE_STYLE_FILLED,
        ceiling: null,
        n: 3,
        set: Object.freeze(["White", "Digital Blue", "Horizon 03"]),
        deltaE: 16.95,
      }),
      Object.freeze({
        label: "Filled, ceiling 30, n=3 falls to delta E 14.43",
        style: Model.BADGE_STYLE_FILLED,
        ceiling: 30,
        n: 3,
        deltaE: 14.43,
      }),
    ]),
  },
  {
    id: "colour-blindness-only",
    label:
      "Colour blindness only (the iteration 10 default - greyscale measured, not binding)",
    designFor: Object.freeze({
      colourBlindness: true,
      greyscale: false,
    }),
    // Measured on 14 August 2026 and written down afterwards, per the
    // count-first rule. Predicting these would have made them a
    // tautology rather than a check.
    baselines: Object.freeze([
      Object.freeze({
        label:
          "Filled, ceiling off, n=3 is Mid Blue / Horizon 03 / Horizon 05 at delta E 41.72",
        style: Model.BADGE_STYLE_FILLED,
        ceiling: null,
        n: 3,
        set: Object.freeze(["Mid Blue", "Horizon 03", "Horizon 05"]),
        deltaE: 41.72,
      }),
      Object.freeze({
        label:
          "Filled, ceiling 30, n=3 is Sky Blue / Warm Neutral 03 / Horizon 05 at delta E 27.53",
        style: Model.BADGE_STYLE_FILLED,
        ceiling: 30,
        n: 3,
        set: Object.freeze([
          "Sky Blue",
          "Warm Neutral 03",
          "Horizon 05",
        ]),
        deltaE: 27.53,
      }),
    ]),
  },
];

// Pool at each ceiling, filled: the ladder recorded in iteration 7.
// Gate-based, so it must read identically under BOTH binding modes.
const ENUMERATION_POOL_LADDER = Object.freeze([
  Object.freeze({ ceiling: null, pool: 26 }),
  Object.freeze({ ceiling: 100, pool: 26 }),
  Object.freeze({ ceiling: 80, pool: 21 }),
  Object.freeze({ ceiling: 60, pool: 20 }),
  Object.freeze({ ceiling: 50, pool: 18 }),
  Object.freeze({ ceiling: 40, pool: 17 }),
  Object.freeze({ ceiling: 30, pool: 15 }),
]);

function enumerateSets(designFor) {
  const modeState = cloneState(state);
  if (designFor) modeState.designFor = Object.assign({}, designFor);
  const built = separationMatrix(modeState);
  const cells = [];

  Model.BADGE_STYLES.forEach((style) => {
    CHROMA_CEILING_SAMPLES.forEach((ceiling) => {
      // PINNED, not inherited. The recorded pool ladders are a
      // function of the gates and the chroma ceiling alone; anything
      // else arriving from whatever the preview happens to be set to
      // moves them silently, which is precisely the failure the
      // ladders exist to catch.
      //
      // The border is here because it MOVED THEM, and the move was
      // real rather than spurious: the edge-cue rule is a disjunction
      // - the fill clears 3:1 against the page OR the border does - so
      // turning the border on lets colours into the pool that could
      // never carry the edge themselves. Measured 14 August 2026, the
      // filled ladder goes 26/26/21/20/18/17/15 without a border and
      // 45/45/37/33/29/26/24 with one. Once the provisional default
      // turned the border on, the enumeration inherited it and nine of
      // twelve baselines reddened in BOTH modes - correctly, since
      // they were no longer measuring the thing they recorded.
      const probe = cloneState(modeState);
      probe.badge = Object.assign({}, state.badge, {
        style: style.id,
        borderMode: "never",
      });
      probe.chromaCeiling = ceiling;
      probe.lightnessFloor = null;
      const nodes = badgeCandidates(probe);
      const gate = gateFor(
        { id: "status-fill-probe", kind: "status-fill" },
        0,
        probe
      );

      for (let n = 2; n <= ENUMERATION_MAX_N; n += 1) {
        const cell = {
          styleId: style.id,
          styleLabel: style.label,
          ceiling: ceiling,
          n: n,
          poolSize: nodes.length,
          gate: gate,
        };

        if (n > nodes.length) {
          cell.reason =
            "the pool holds " +
            nodes.length +
            ", fewer than the " +
            n +
            " this row needs";
          cells.push(cell);
          continue;
        }

        let best = null;
        try {
          best = Engine.bestSeparationFor(nodes, built.matrix, n);
        } catch (error) {
          logError("Enumeration cell failed", error);
          cell.reason = "the search exceeded its step budget";
          cells.push(cell);
          continue;
        }

        if (!best || !best.possible) {
          cell.reason = best ? best.reason : "no set found";
          cells.push(cell);
          continue;
        }

        cell.deltaE = best.threshold;
        cell.set = best.set.map((index) => state.palette[index]);
        cell.bindingMode = bindingModeFor(cell.set, modeState);
        cells.push(cell);
      }
    });
  });

  return cells;
}

/** Cross-check one mode's enumeration against that mode's baselines. */
function checkEnumerationBaselines(cells, modeEntry) {
  const rows = [];
  const find = (styleId, ceiling, n) =>
    cells.filter(
      (cell) =>
        cell.styleId === styleId &&
        cell.ceiling === ceiling &&
        cell.n === n
    )[0];

  modeEntry.baselines.forEach((baseline) => {
    const cell = find(baseline.style, baseline.ceiling, baseline.n);
    const names = cell && cell.set ? cell.set.map((c) => c.name) : [];
    const setAgrees =
      !baseline.set ||
      (names.length === baseline.set.length &&
        baseline.set.every((name) => names.indexOf(name) >= 0));
    const deltaAgrees =
      baseline.deltaE === undefined ||
      (cell &&
        cell.deltaE !== undefined &&
        Math.abs(Engine.round(cell.deltaE, 2) - baseline.deltaE) < 0.005);
    rows.push({
      label: baseline.label,
      expected:
        (baseline.set ? baseline.set.join(", ") + " at " : "delta E ") +
        baseline.deltaE,
      actual: cell
        ? (names.length ? names.join(", ") + " at " : "delta E ") +
          Engine.round(cell.deltaE, 2)
        : "no such cell",
      agrees: Boolean(cell && setAgrees && deltaAgrees),
    });
  });

  ENUMERATION_POOL_LADDER.forEach((rung) => {
    const cell = find(Model.BADGE_STYLE_FILLED, rung.ceiling, 3);
    rows.push({
      label:
        "Filled pool at ceiling " +
        (rung.ceiling === null ? "off" : rung.ceiling),
      expected: String(rung.pool),
      actual: cell ? String(cell.poolSize) : "no such cell",
      agrees: Boolean(cell && cell.poolSize === rung.pool),
    });
  });

  // The styles must part. Two styles reading one pool twice is the
  // conflation this whole layer exists to make visible.
  const filled = find(Model.BADGE_STYLE_FILLED, null, 3);
  const outlined = find(Model.BADGE_STYLE_OUTLINED, null, 3);
  rows.push({
    label:
      "The two styles produce DIFFERENT pools at the same ceiling",
    expected: "different",
    actual:
      (filled ? filled.poolSize : "?") +
      " filled against " +
      (outlined ? outlined.poolSize : "?") +
      " outlined",
    agrees: Boolean(
      filled && outlined && filled.poolSize !== outlined.poolSize
    ),
  });

  const filledNames = filled && filled.set
    ? filled.set.map((c) => c.name).join(", ")
    : "";
  const outlinedNames = outlined && outlined.set
    ? outlined.set.map((c) => c.name).join(", ")
    : "";
  rows.push({
    label:
      "The two styles produce DIFFERENT winning sets somewhere in the enumeration",
    expected: "at least one cell differs",
    actual: differingCellCount(cells) + " cells differ",
    agrees: differingCellCount(cells) > 0,
  });

  // The binding-mode column must never name a mode this run was not
  // asked to separate for. A column that went on saying "greyscale"
  // after greyscale stopped steering anything would be the most
  // believable wrong number in the whole tool.
  const greyId = window.ContrastCardsCVD.MODES.GREYSCALE;
  const greyBound = Boolean(modeEntry.designFor.greyscale);
  const named = cells.filter(
    (cell) => cell.bindingMode === greyId
  ).length;
  rows.push({
    label: greyBound
      ? "Greyscale IS in this binding set, so it may appear in the binding-mode column"
      : "Greyscale is NOT in this binding set, so no cell may name it as binder",
    expected: greyBound ? "may appear" : "0 cells",
    actual: named + " cells name greyscale",
    agrees: greyBound || named === 0,
  });

  return rows;
}

/** How many (ceiling, n) cells the two styles disagree about. */
function differingCellCount(cells) {
  let differing = 0;
  CHROMA_CEILING_SAMPLES.forEach((ceiling) => {
    for (let n = 2; n <= ENUMERATION_MAX_N; n += 1) {
      const pick = (styleId) =>
        cells.filter(
          (cell) =>
            cell.styleId === styleId &&
            cell.ceiling === ceiling &&
            cell.n === n
        )[0];
      const a = pick(Model.BADGE_STYLE_FILLED);
      const b = pick(Model.BADGE_STYLE_OUTLINED);
      if (!a || !b) continue;
      const nameOf = (cell) =>
        cell.set ? cell.set.map((c) => c.name).sort().join("|") : cell.reason;
      if (nameOf(a) !== nameOf(b)) differing += 1;
    }
  });
  return differing;
}

/**
 * The enumeration for ONE binding mode: its tables, its own baseline
 * cross-check, and its counts.
 */
function renderEnumerationForMode(modeEntry) {
  const cells = enumerateSets(modeEntry.designFor);
  const rendered = cells.filter((cell) => cell.set).length;
  const stated = cells.filter((cell) => !cell.set).length;
  // Why the stated-reason count is what it is. Zero here is not
  // evidence the branch works - at this palette the smallest pool is
  // still larger than the largest set asked for, so no cell CAN run
  // out. Shrinking the palette to six colours turns all 126 into
  // stated reasons, which is how that branch is exercised.
  const smallestPool = Math.min.apply(
    null,
    cells.map((cell) => cell.poolSize)
  );

  const tables = Model.BADGE_STYLES.map((style) => {
    const rows = cells
      .filter((cell) => cell.styleId === style.id)
      .map(
        (cell) =>
          '<tr><th scope="row">' +
          (cell.ceiling === null ? "off" : cell.ceiling) +
          '</th><td class="dps-num">' +
          cell.n +
          '</td><td class="dps-num">' +
          cell.poolSize +
          "</td><td>" +
          cell.gate.wcag +
          ":1, Lc " +
          cell.gate.lc +
          "</td><td>" +
          (cell.set
            ? '<span class="dps-num">' +
              Engine.round(cell.deltaE, 2) +
              "</span>"
            : "&mdash;") +
          "</td><td>" +
          (cell.set ? escapeHtml(cell.bindingMode) : "&mdash;") +
          "</td><td>" +
          (cell.set
            ? cell.set
                .map(
                  (colour) =>
                    swatchHtml(colour.hex) + escapeHtml(colour.name)
                )
                .join(" ")
            : '<span class="dps-hint">' +
              escapeHtml(cell.reason) +
              "</span>") +
          "</td></tr>"
      )
      .join("");

    return (
      "<table><caption>" +
      escapeHtml(style.label) +
      ", designing for " +
      escapeHtml(bindingSetLabelFor(modeEntry.designFor)) +
      " &mdash; every chroma ceiling against every set size</caption>" +
      '<thead><tr><th scope="col">Ceiling</th><th scope="col">n</th><th scope="col">Pool</th><th scope="col">Gate</th><th scope="col">Best delta E</th><th scope="col">Binding mode</th><th scope="col">The set, or why not</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>"
    );
  }).join("");

  const checks = checkEnumerationBaselines(cells, modeEntry);
  const failed = checks.filter((row) => !row.agrees).length;

  return {
    cells: cells,
    checks: checks,
    failed: failed,
    html:
      "<h3>" +
      escapeHtml(modeEntry.label) +
      "</h3><p><strong>" +
      cells.length +
      " cells:</strong> " +
      rendered +
      " produced a set, " +
      stated +
      " stated why not, 0 left blank. " +
      Model.BADGE_STYLES.length +
      " styles &times; " +
      CHROMA_CEILING_SAMPLES.length +
      " ceilings &times; sizes 2 to " +
      ENUMERATION_MAX_N +
      ". The smallest pool anywhere here is " +
      smallestPool +
      ", larger than the largest set asked for, so no cell runs out at this palette &mdash; a stated-reason count of zero is that, not a branch that never fires.</p>" +
      renderVerificationRows(
        "Against the baselines recorded for THIS binding mode, by SET MEMBERSHIP",
        checks,
        ["Baseline", "Recorded", "This enumeration", "Verdict"]
      ) +
      (failed > 0
        ? '<p class="dps-verdict-fail"><strong>' +
          failed +
          " baseline(s) disagree. Treat every figure below as unverified until that is explained.</strong></p>"
        : "") +
      tables,
  };
}

/** The prose label for an arbitrary designFor object. */
function bindingSetLabelFor(designFor) {
  return bindingSetLabel({ designFor: designFor });
}

/**
 * Both binding modes, one after the other, plus the cross-mode checks
 * that only exist once both have run: the pool ladders must be
 * IDENTICAL, and the winning sets must DIFFER. Either failing means
 * the switches are wired to the wrong thing - a moved pool means the
 * binding set reached membership it has no business touching, and
 * identical sets mean it reached nothing at all.
 */
function renderEnumeration() {
  const host = document.getElementById("dpsEnumeration");
  const runs = ENUMERATION_BASELINE_MODES.map(renderEnumerationForMode);
  const cross = crossModeChecks(runs);
  const failed =
    runs.reduce((total, run) => total + run.failed, 0) +
    cross.filter((row) => !row.agrees).length;

  host.innerHTML =
    "<p>The enumeration runs TWICE, once per binding mode. Greyscale binding is the mode every figure in iterations 7 to 9 was measured under, kept so those baselines stay checkable; colour blindness only is the current default. Pools are gate-based and must not move between them; winning sets are dispersion-based and must.</p>" +
    renderVerificationRows(
      "Across the two binding modes",
      cross,
      ["Check", "Expected", "Measured", "Verdict"]
    ) +
    runs.map((run) => run.html).join("");

  announce(
    runs[0].cells.length * runs.length +
      " cells enumerated across " +
      runs.length +
      " binding modes. " +
      (failed === 0
        ? "All baselines and cross-mode checks agree."
        : failed + " disagree.")
  );
}

/**
 * The binding-change inversion, both directions, printed. Ticking
 * greyscale must return the recorded sets exactly; unticking must
 * return the new ones. A change that produced the same answer either
 * way would not be a change.
 */
function crossModeChecks(runs) {
  const rows = [];
  const grey = runs[0];
  const cvdOnly = runs[1];
  if (!grey || !cvdOnly) return rows;

  const nameOf = (cell) =>
    cell && cell.set
      ? cell.set.map((colour) => colour.name).sort().join("|")
      : "";
  const describe = (cell) =>
    cell && cell.set
      ? cell.set.map((c) => c.name).join(", ") +
        " at " +
        Engine.round(cell.deltaE, 2) +
        ", binding in " +
        cell.bindingMode
      : "no set";
  const trioOf = (run) =>
    run.cells.filter(
      (cell) =>
        cell.styleId === Model.BADGE_STYLE_FILLED &&
        cell.ceiling === null &&
        cell.n === 3
    )[0];

  let poolMismatch = 0;
  let setDiffer = 0;
  grey.cells.forEach((cell, index) => {
    if (cvdOnly.cells[index].poolSize !== cell.poolSize) {
      poolMismatch += 1;
    }
    if (nameOf(cvdOnly.cells[index]) !== nameOf(cell)) setDiffer += 1;
  });
  const total = " of " + grey.cells.length + " cells";
  rows.push({
    label:
      "Pools are IDENTICAL under both binding modes - they are gate-based, so a moved pool is a bug, not a baseline",
    expected: "0 differ",
    actual: poolMismatch + " differ" + total,
    agrees: poolMismatch === 0,
  });
  rows.push({
    label:
      "The two modes choose DIFFERENT sets somewhere - an inert switch would choose the same everywhere",
    expected: "at least 1 differs",
    actual: setDiffer + " differ" + total,
    agrees: setDiffer > 0,
  });

  // The inversion, both directions, at the cell every report quotes.
  const greyTrio = trioOf(grey);
  const cvdTrio = trioOf(cvdOnly);
  const recorded = ["White", "Digital Blue", "Horizon 03"];
  rows.push({
    label:
      "TICK greyscale: filled, ceiling off, n=3 returns the set recorded in iterations 7 to 9",
    expected: recorded.join(", "),
    actual: describe(greyTrio),
    agrees: nameOf(greyTrio) === recorded.slice().sort().join("|"),
  });
  rows.push({
    label:
      "UNTICK greyscale: the same cell returns a DIFFERENT set, and greyscale is not named as its binder",
    expected: "a different set, binder not greyscale",
    actual: describe(cvdTrio),
    agrees: Boolean(
      cvdTrio &&
        cvdTrio.set &&
        nameOf(cvdTrio) !== nameOf(greyTrio) &&
        cvdTrio.bindingMode !==
          window.ContrastCardsCVD.MODES.GREYSCALE
    ),
  });

  return rows;
}

/* --- Verification --------------------------------------------- */

/**
 * Hand arithmetic for the seeded inputs, computed OUTSIDE this page
 * and recorded here, so a units error in the engine is loud rather
 * than plausible. Measured 13 August 2026 with an independent Node
 * calculation over the guidance's own dimensions.
 *
 * The two millimetre rows are both here on purpose: the guidance
 * derives the millimetre from viewport HEIGHT, and the panel's stated
 * active area is not quite the same shape as its pixel grid, so the
 * width-derived figure differs in the fourth decimal.
 */
const GEOMETRY_CANARY = Object.freeze([
  Object.freeze({
    label: "1 px from height (mm)",
    expected: 0.11325,
    read: (geometry) => geometry.mmPerPx,
  }),
  Object.freeze({
    label: "1 px from width (mm)",
    expected: 0.11328125,
    read: (geometry) => geometry.mmPerPxWidth,
  }),
  Object.freeze({
    label: "1 rem (px)",
    expected: 19.2,
    read: (geometry) => geometry.rootFontPx,
  }),
  Object.freeze({
    label: "1 rem (mm)",
    expected: 2.1744,
    read: (geometry) => geometry.rootFontMm,
  }),
  Object.freeze({
    label: "One reference pixel at 600 mm (mm)",
    expected: 0.22305307840487532,
    read: (geometry) => geometry.referencePixelMm,
  }),
  Object.freeze({
    label: "Date cap height, 1.25rem at 0.727 (mm)",
    expected: 1.975986,
    read: (geometry) =>
      Engine.fontToCapMm(1.25 * geometry.rootFontMm, 0.727),
  }),
  Object.freeze({
    label: "Status word cap height, 2rem at 0.727 (mm)",
    expected: 3.1615776,
    read: (geometry) =>
      Engine.fontToCapMm(2 * geometry.rootFontMm, 0.727),
  }),
  Object.freeze({
    label: "Booking title cap height, 6rem at 0.727 (mm)",
    expected: 9.4847328,
    read: (geometry) =>
      Engine.fontToCapMm(6 * geometry.rootFontMm, 0.727),
  }),
  Object.freeze({
    label: "Divider, 2 panel px (mm)",
    expected: 0.2265,
    read: (geometry) => 2 * geometry.mmPerPx,
  }),
  Object.freeze({
    label: "Footer bar, 0.25rem (mm)",
    expected: 0.5436,
    read: (geometry) => 0.25 * geometry.rootFontMm,
  }),
  Object.freeze({
    label: "One budget line at the 6 mm floor (mm)",
    expected: 12.379642365887207,
    read: (geometry) =>
      Engine.computeLineBudget({
        usableHeightMm: 119.9,
        capFloorMm: 6,
        capRatio: 0.727,
        spacing: 1.5,
      }).lineHeightMm,
  }),
]);

const CANARY_TOLERANCE = 1e-9;

/**
 * THE RECONSTRUCTION, CHECKED AGAINST THE DOCUMENT.
 *
 * The ladder is now derived from four reading distances, so the one
 * assertion that matters is that the derivation reproduces section 2's
 * own table. If it does, the reconstruction is sound; if it drifts,
 * the stated figures are right and this page is wrong. The stated caps
 * are held in a separate frozen const for exactly this comparison -
 * derive both from one source and the check would agree with itself.
 *
 * The floor and departure rows run on synthetic states, so a canary
 * click never moves the live panel.
 */
function runReadingCanary() {
  const rows = [];

  rows.push({
    label:
      "The anchor: a cap read at " +
      Model.READING_ANCHOR.distanceMm +
      " mm",
    expected: Model.READING_ANCHOR.capMm + " mm",
    actual:
      Engine.round(
        Model.capForReadingDistance(Model.READING_ANCHOR.distanceMm),
        9
      ) + " mm",
    agrees:
      Math.abs(
        Model.capForReadingDistance(Model.READING_ANCHOR.distanceMm) -
          Model.READING_ANCHOR.capMm
      ) <= CANARY_TOLERANCE,
  });

  // Round-trip, in the direction the controls use it: type a distance,
  // read a cap, read the distance back.
  [600, 700, 1000, 1400, 2350].forEach((distance) => {
    const back = Model.readingDistanceForCap(
      Model.capForReadingDistance(distance)
    );
    rows.push({
      label: "Distance " + distance + " mm inverts through cap height",
      expected: distance + " mm",
      actual: Engine.round(back, 9) + " mm",
      agrees: Math.abs(back - distance) <= CANARY_TOLERANCE,
    });
  });

  // The check the whole model rests on.
  Object.keys(Model.GUIDANCE_READING_DISTANCES).forEach((key) => {
    const rung = Model.SIZE_LADDER[key];
    rows.push({
      label:
        "Guidance preset reproduces the stated cap for " +
        rung.name.toLowerCase() +
        " from " +
        rung.readMm +
        " mm",
      expected: rung.statedCapMm + " mm",
      actual: Engine.round(rung.capMm, 9) + " mm",
      agrees:
        Math.abs(rung.capMm - rung.statedCapMm) <= CANARY_TOLERANCE,
    });
  });

  // Floors, both roles that have one, asked for a distance well below
  // it. Refused by clamping, with the floor named.
  [
    { id: "date", floor: Model.GUIDANCE_STATED_CAPS.body },
    { id: "room", floor: Model.GUIDANCE_STATED_CAPS.room },
  ].forEach((probe) => {
    const role = Model.roleById(probe.id);
    const capMm = clampCapForRole(
      role,
      Model.capForReadingDistance(200)
    );
    rows.push({
      label:
        "A 200 mm reading distance for " +
        role.name.toLowerCase() +
        " is clamped at its stated floor",
      expected: probe.floor + " mm",
      actual: Engine.round(capMm, 9) + " mm",
      agrees: Math.abs(capMm - probe.floor) <= CANARY_TOLERANCE,
    });
  });

  // Departure flagging, both directions - a flag that only ever fires
  // and a flag that never fires are the same broken instrument.
  const guidanceCaps = {};
  Model.allRoles().forEach((role) => {
    if (role.sizeClass) {
      guidanceCaps[role.id] = Model.SIZE_LADDER[role.sizeClass].capMm;
    }
  });
  const clean = readingDepartures({ caps: guidanceCaps });
  rows.push({
    label: "The guidance assignment reports NO departure",
    expected: "0 reported",
    actual: clean.length + " reported",
    agrees: clean.length === 0,
  });

  const promoted = Object.assign({}, guidanceCaps);
  promoted.title = Model.capForReadingDistance(
    Model.APPROACH_DISTANCE_MM
  );
  promoted["status-text"] = Model.capForReadingDistance(
    Model.SECOND_TIER_DISTANCE_MM
  );
  const dirty = readingDepartures({ caps: promoted });
  const namesTitle = dirty.some((row) => row.role.id === "title");
  const namesStatus = dirty.some(
    (row) => row.role.id === "status-text"
  );
  rows.push({
    label:
      "Promoting the booking title reports a departure naming BOTH what rose and what fell",
    expected: "2 reported, naming the title and the status word",
    actual:
      dirty.length +
      " reported" +
      (namesTitle ? ", names the title" : ", MISSES the title") +
      (namesStatus ? ", names the status word" : ", MISSES the status word"),
    agrees: dirty.length === 2 && namesTitle && namesStatus,
  });

  return rows;
}

function runGeometryCanary() {
  // Deliberately run against the SEEDED inputs, whatever the controls
  // now say, so the canary keeps meaning after someone has been
  // experimenting.
  const geometry = Engine.computeGeometry(Model.PANEL_DEFAULTS);
  return GEOMETRY_CANARY.map((row) => {
    const actual = row.read(geometry);
    const difference = Math.abs(actual - row.expected);
    return {
      label: row.label,
      expected: row.expected,
      actual: actual,
      agrees: difference <= CANARY_TOLERANCE,
    };
  });
}

/**
 * The RENDER canaries: what the page actually draws, against what the
 * model says it should. Everything above measures the model against
 * arithmetic, which is why the em-inheritance bug survived a clean
 * canary run for three iterations - the model was right throughout
 * and the DOM was not being asked.
 *
 * Two assertions, and each catches a different half:
 *
 * 1. RENDERED PADDING equals padX times the status word's rendered
 *    font size. The character budget reads padding from state and
 *    multiplies by the word's em; the DOM resolved it against the
 *    page's 16 px. Iteration 3's padding canary exercised the state
 *    path on both sides and so agreed with itself.
 *
 * 2. SCALE INVARIANCE. Render at two frame heights and compare
 *    ratios - pill height to cap height, line pitch to cap height.
 *    Any absolute unit reintroduced anywhere in the panel breaks
 *    this immediately, whatever the model believes, which is the
 *    property that makes it worth having: this is the class of bug
 *    that comes back.
 */
const SCALE_CANARY_HEIGHTS = Object.freeze([320, 960]);

// Ratios are read from getBoundingClientRect, which is sub-pixel but
// not exact, so equality here is equality to a tolerance rather than
// to the bit. Set well below any real regression: reintroducing one
// absolute unit moves these ratios by tens of percent, not by 0.5%.
const SCALE_CANARY_TOLERANCE = 0.005;

/**
 * Paint a throwaway panel off-screen at one frame height and read it.
 *
 * NOT the live preview, deliberately, and this was learnt the hard
 * way: measuring the live one made the canary depend on which tab was
 * showing, and inside a hidden tab panel every box measures zero - so
 * the first run of this check reported "0 against 0, 0% apart" and
 * PASSED. A canary that passes because it measured nothing is worse
 * than no canary. Off-screen uses `visibility: hidden`, which still
 * lays out, and touches no state the reader can see.
 */
function measureRenderedPanel(derived, frameHeightPx) {
  const host = document.createElement("div");
  host.className = "dps-measurer";
  const panel = document.createElement("div");
  panel.className = "dps-panel";
  const surface = surfaceElement.cloneNode(true);
  surface.removeAttribute("id");
  surface
    .querySelectorAll("[id]")
    .forEach((node) => node.removeAttribute("id"));
  panel.appendChild(surface);
  host.appendChild(panel);
  document.body.appendChild(host);

  try {
    paintPanel(panel, surface, derived, {
      frameHeightPx: frameHeightPx,
      simulation: "none",
    });

    const badge = surface.querySelector(".dps-badge");
    const word = surface.querySelector('[data-role="status-text"]');
    const codeEl = surface.querySelector('[data-role="code"]');
    const codeLine = codeEl ? codeEl.closest(".dps-line") : null;
    const capRatio = (derived.state || state).geometry.capRatio;
    const wordFontPx = parseFloat(getComputedStyle(word).fontSize);
    const codeFontPx = parseFloat(getComputedStyle(codeEl).fontSize);

    // Through the shared guard, so this canary can no longer be the
    // thing that measures nothing and says it agrees.
    const pill = measureBox(badge);
    const pitch = measureBox(codeLine);
    const surfaceBox = measureBox(surface);
    const geometry = derived.geometry;
    return {
      // The rendered scale on BOTH axes, against the millimetre the
      // model wrote into the frame. A constant proportional error
      // cancels out of every ratio below, so nothing else here can
      // see it.
      surfaceWidthPx: surfaceBox.widthPx,
      surfaceHeightPx: surfaceBox.heightPx,
      modelMmPx: frameHeightPx / (derived.state || state).geometry.panelHmm,
      panelWmm: (derived.state || state).geometry.panelWmm,
      panelHmm: (derived.state || state).geometry.panelHmm,
      frameHeightPx: frameHeightPx,
      wordFontPx: wordFontPx,
      paddingLeftPx: parseFloat(getComputedStyle(badge).paddingLeft),
      pillHeightPx: pill.heightPx,
      // The badge's border, as the browser RENDERED it and as the
      // model ASKED for it. They differ, and the difference is not
      // proportional - see the border-rounding row below.
      borderRenderedPx:
        parseFloat(getComputedStyle(badge).borderTopWidth) || 0,
      borderWantedPx: (derived.state || state).badge.borderOn ||
        (derived.state || state).badge.style ===
          Model.BADGE_STYLE_OUTLINED
        ? (derived.state || state).badge.borderMm *
          (frameHeightPx / (derived.state || state).geometry.panelHmm)
        : 0,
      capPx: wordFontPx * capRatio,
      pitchPx: pitch.heightPx,
      codeCapPx: codeFontPx * capRatio,
      measured: pill.measured && pitch.measured,
      why: pill.measured ? pitch.why : pill.why,
      // Accounted on THIS off-screen sample, not on the live preview:
      // the canaries run from the Checks tab, where the preview is
      // hidden and every box measures zero. Pointing this row at the
      // live surface made it report "not measured" and fail - the
      // shared guard catching the author of the row that exists to
      // catch that class of mistake.
      bodyAccount: accountForBody(surface),
    };
  } finally {
    host.remove();
  }
}

// A pixel of slack for sub-pixel layout rounding. Set well below the
// 12 px this row exists to have caught.
const BODY_ACCOUNT_TOLERANCE = 1;

/**
 * The body's height as a sum of its named parts, and which child (if
 * any) is being cut off. Reported through the shared measure guard, so
 * a hidden panel says "not measured" rather than summing zeros.
 */
function accountForBody(surfaceEl) {
  const body = surfaceEl
    ? surfaceEl.querySelector(".dps-body")
    : null;
  const bodyMeasure = measureBox(body);
  if (!bodyMeasure.measured) return { measured: false };

  const bodyRect = body.getBoundingClientRect();
  const parts = [];
  let partsPx = 0;
  let clipped = "nothing";

  Array.prototype.forEach.call(body.children, (child) => {
    const style = getComputedStyle(child);
    const rect = child.getBoundingClientRect();
    const marginTop = parseFloat(style.marginTop) || 0;
    partsPx += marginTop + rect.height;
    parts.push({
      name: child.className || child.tagName.toLowerCase(),
      px: rect.height,
      marginTopPx: marginTop,
    });
    if (rect.bottom - bodyRect.bottom > BODY_ACCOUNT_TOLERANCE) {
      clipped = child.className || child.tagName.toLowerCase();
    }
  });

  return {
    measured: true,
    parts: parts,
    partsPx: partsPx,
    bodyPx: bodyRect.height,
    overflowPx: partsPx - bodyRect.height,
    clipped: clipped,
  };
}

/**
 * THE ELEVEN RENDER ROWS, NAMED ONCE so the count reconciles from
 * outside the tool. Reports have said "all 10 return to agreement"
 * where an earlier one said nine, and a bare count cannot settle which
 * was right - so the membership is written here and the report quotes
 * it rather than recounting. In order:
 *
 *   1. the measureBox DENY/ALLOW guard, both directions in one row
 *   2. the positive canary: a real panel was measured at both heights
 *   3. the badge's rendered side padding against padX x font size
 *   4-7. one rendered millimetre on each axis at each of two frames
 *   8. the body's children account for its height
 *   9. the badge border's integer-pixel rounding
 *   10. pill height NET of borders, to cap height, at both frames
 *   11. line pitch to cap height, at both frames
 *
 * The inversions partition them into disjoint families, which is what
 * makes them independent rather than eleven spellings of one
 * assertion. Measured 14 August 2026, at the default:
 *
 *   - reintroducing border-box reddens exactly 4, 5, 6, 7
 *   - pinning the status word's font size reddens exactly 3 and 10
 *   - pinning the badge's padding reddens exactly 3 and 10
 *
 * The two pins hit the SAME pair, and saying so matters: they are not
 * orthogonal to each other, because rows 3 and 10 are both about the
 * badge's box against its font size and either pin breaks that link.
 * What is orthogonal is the scale family {4,5,6,7} against the badge
 * family {3,10} - no inversion touches both. Rows 1, 2, 8, 9 and 11
 * are reddened by none of the three and carry their own inversions:
 * 1 is self-inverting, 2 fails when nothing rendered, 8 reddens under
 * border-box at padY 0.3 (it closes in both states at padY 0, which is
 * why iteration 9 pinned it to the live frame height), and 9 would
 * redden if the border ever stopped being derived from a millimetre.
 *
 * Row 9 was added on 14 August 2026 when turning the border on for the
 * provisional default reddened the old row 10 at 1.9%. Net of the
 * rendered borders that ratio is 0% apart, which is what separated a
 * browser rounding artefact from a model fault.
 */
function runRenderCanary() {
  const rows = [];
  const derived = getLastDerived() || derive(state);

  // The guard itself, in both directions. A guard that always says
  // "measured" and a guard that always says "not measured" are the
  // same broken instrument, and only the pair separates them.
  const probe = document.createElement("div");
  probe.style.width = "10px";
  probe.style.height = "10px";
  document.body.appendChild(probe);
  const visibleProbe = measureBox(probe);
  probe.hidden = true;
  const hiddenProbe = measureBox(probe);
  probe.remove();
  rows.push({
    label:
      "The hidden-element guard: a rendered 10x10 box reads MEASURED and the same box hidden reads NOT measured",
    outcome:
      "rendered " +
      (visibleProbe.measured ? "measured" : "NOT measured") +
      " at " +
      Engine.round(visibleProbe.heightPx, 1) +
      " px; hidden " +
      (hiddenProbe.measured ? "MEASURED" : "not measured") +
      " at " +
      Engine.round(hiddenProbe.heightPx, 1) +
      " px",
    agrees: visibleProbe.measured && !hiddenProbe.measured,
  });

  const samples = SCALE_CANARY_HEIGHTS.map((height) =>
    measureRenderedPanel(derived, height)
  );

  // The positive canary. Every ratio below is a quotient of measured
  // boxes, and zero over zero compares equal to itself - so the run
  // has to prove it measured something before any of them mean
  // anything.
  const measuredSomething = samples.every(
    (sample) => sample.measured && sample.capPx > 0
  );
  rows.push({
    label:
      "The canary measured a real rendered panel at both heights (without this, zero equals zero and every row below passes on nothing)",
    outcome: samples
      .map(
        (sample) =>
          sample.frameHeightPx +
          " px frame: cap " +
          Engine.round(sample.capPx, 2) +
          " px, pill " +
          Engine.round(sample.pillHeightPx, 2) +
          " px"
      )
      .join("; "),
    agrees: measuredSomething,
  });

  // --- 1. Rendered padding against state -----------------------
  const source = derived.state || state;
  const first = samples[0];
  const expectedPadX = source.badge.padX * first.wordFontPx;
  rows.push({
    label:
      "The badge's RENDERED side padding equals padX x the status word's rendered font size",
    outcome:
      Engine.round(first.paddingLeftPx, 2) +
      " px rendered against " +
      Engine.round(expectedPadX, 2) +
      " px expected (padX " +
      source.badge.padX +
      " x " +
      Engine.round(first.wordFontPx, 2) +
      " px)",
    agrees:
      measuredSomething &&
      Math.abs(first.paddingLeftPx - expectedPadX) <= 0.5,
  });

  // --- 1b. The rendered millimetre, on both axes ---------------
  // Ratios cannot catch a constant scale error; this can. It found a
  // 6.4% shrink and a 2.6% aspect error caused by the bezel being
  // subtracted from the frame under a global border-box.
  samples.forEach((sample) => {
    [
      {
        axis: "height",
        px: sample.surfaceHeightPx,
        mm: sample.panelHmm,
      },
      {
        axis: "width",
        px: sample.surfaceWidthPx,
        mm: sample.panelWmm,
      },
    ].forEach((axis) => {
      const rendered = axis.px / axis.mm;
      rows.push({
        label:
          "One millimetre RENDERED across the panel's " +
          axis.axis +
          " at a " +
          sample.frameHeightPx +
          " px frame equals the millimetre the model wrote",
        outcome:
          Engine.round(rendered, 4) +
          " px rendered against " +
          Engine.round(sample.modelMmPx, 4) +
          " px in the model",
        agrees:
          measuredSomething &&
          Math.abs(rendered - sample.modelMmPx) <=
            sample.modelMmPx * SCALE_CANARY_TOLERANCE,
      });
    });
  });

  // --- 1c. The body's height accounts for itself ---------------
  // Every child of the body, plus its margins, must sum to the body.
  // When it does not, the difference is content the body's
  // `overflow: hidden` is swallowing with no symptom of any kind.
  //
  // This is the row that would have named the missing 12 px. Before
  // the box-sizing fix the parts summed to 284.82 inside a 272.80 px
  // body and the divider rule was being cut off by 12.02 px; the fix
  // returned 24.02 px, of which 12.02 absorbed that clipping and 11.99
  // went to the title box. Nothing else moved by so much as a
  // hundredth of a pixel. It reddens under the same border-box
  // reintroduction, which is what makes it a real assertion rather
  // than a restatement of the layout.
  // At the LIVE frame height, not at one of the two canary heights.
  // Whether the body overflows depends on how the title line's
  // shrink floor lands against the room left over, and that is not the
  // same at every size: at the 320 px sample the parts closed in BOTH
  // states, so a row measured there would have reported the pre-fix
  // panel as sound. Measured off-screen so the row still works from
  // the Checks tab, where the live preview is hidden.
  const bodyAccount = measureRenderedPanel(
    derived,
    (derived.state || state).frameHeightPx
  ).bodyAccount;
  rows.push({
    label:
      "The body's children account for its height - nothing is being silently clipped",
    outcome: bodyAccount.measured
      ? Engine.round(bodyAccount.partsPx, 2) +
        " px of parts in a " +
        Engine.round(bodyAccount.bodyPx, 2) +
        " px body" +
        (bodyAccount.overflowPx > BODY_ACCOUNT_TOLERANCE
          ? ", overflowing by " +
            Engine.round(bodyAccount.overflowPx, 2) +
            " px at " +
            bodyAccount.clipped
          : "")
      : "not measured - the panel is not rendered",
    agrees:
      bodyAccount.measured &&
      Math.abs(bodyAccount.overflowPx) <= BODY_ACCOUNT_TOLERANCE,
  });

  // --- 1d. Border rounding, measured rather than excused --------
  // A BROWSER FACT, not a model fault, and it had to be separated
  // from one. Turning the badge border on for the provisional default
  // reddened the pill-height ratio row at 1.9%. The model asks for
  // 0.75 mm, which is 1.766 px at the 320 px frame and 5.298 px at
  // 960 px; the browser renders 1 px and 5 px. That is 56.6% of the
  // asked-for width at the small size and 94.4% at the large one, so
  // a bordered pill is genuinely NOT scale-proportional and the ratio
  // row was right to redden. What separates the two explanations is
  // arithmetic that closes: font x 1.5 + 2 x RENDERED border predicts
  // both pill heights exactly, which a model bug would not.
  //
  // So the ratio row below measures the pill NET of its rendered
  // borders - which is the quantity the model controls - and this row
  // carries the rounding itself, with its own figures, rather than
  // letting a corrected row quietly absorb it.
  const borderSamples = samples.map(
    (sample) =>
      Engine.round(sample.borderRenderedPx, 2) +
      " rendered against " +
      Engine.round(sample.borderWantedPx, 2) +
      " asked at " +
      sample.frameHeightPx +
      " px"
  );
  const rounding = samples.map((sample) =>
    sample.borderWantedPx > 0
      ? sample.borderRenderedPx / sample.borderWantedPx
      : 1
  );
  rows.push({
    label:
      "The badge border is rendered at an INTEGER pixel width, so it does not scale with the frame - a browser fact, recorded, not a defect to fix here",
    outcome:
      borderSamples.join("; ") +
      " - " +
      Engine.round(rounding[0] * 100, 1) +
      "% and " +
      Engine.round(rounding[1] * 100, 1) +
      "% of the asked-for width",
    // Not an assertion that they MATCH - they cannot. The assertion is
    // that the rendered width is within a pixel of the asked-for one,
    // which is what integer rounding means and what would break if the
    // border ever stopped being derived from the millimetre at all.
    agrees: samples.every(
      (sample) =>
        Math.abs(sample.borderRenderedPx - sample.borderWantedPx) < 1
    ),
  });

  // --- 2. Scale invariance -------------------------------------
  [
    {
      name: "Pill height NET of its rendered borders, to cap height",
      of: (sample) =>
        (sample.pillHeightPx - 2 * sample.borderRenderedPx) /
        sample.capPx,
    },
    {
      name: "Line pitch to cap height",
      of: (sample) => sample.pitchPx / sample.codeCapPx,
    },
  ].forEach((measure) => {
    const a = measure.of(samples[0]);
    const b = measure.of(samples[1]);
    const spread = Math.abs(a - b) / Math.max(Math.abs(a), 1e-9);
    rows.push({
      label:
        measure.name +
        " is the same at " +
        SCALE_CANARY_HEIGHTS[0] +
        " px and " +
        SCALE_CANARY_HEIGHTS[1] +
        " px of frame",
      outcome:
        Engine.round(a, 4) +
        " against " +
        Engine.round(b, 4) +
        " - " +
        Engine.round(spread * 100, 3) +
        "% apart",
      agrees: measuredSomething && spread <= SCALE_CANARY_TOLERANCE,
    });
  });

  return rows;
}

/**
 * The solver canary, both directions. A solver that only ever succeeds
 * proves nothing, so the run that must return NOTHING is the load
 * bearing half.
 */
function runSolverCanary() {
  const built = separationMatrix();
  const nodes = badgeCandidates();
  const rows = [];

  let largest = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const value = built.matrix[nodes[i]][nodes[j]];
      if (value > largest) largest = value;
    }
  }

  const unreachable = largest + 1;
  const impossible = Engine.findSeparatedSet(
    nodes,
    built.matrix,
    unreachable,
    2
  );
  rows.push({
    label:
      "A threshold above every pair in the matrix (delta E " +
      Engine.round(unreachable, 2) +
      ") must return NOTHING",
    outcome: impossible === null ? "returned nothing" : "returned a set",
    agrees: impossible === null,
  });

  const trivial = Engine.findSeparatedSet(nodes, built.matrix, 0, 2);
  rows.push({
    label: "A threshold of zero, which every pair clears, must return a set",
    outcome:
      trivial === null
        ? "returned nothing"
        : "returned " + trivial.length + " colours",
    agrees: trivial !== null && trivial.length === 2,
  });

  const tooMany = Engine.findSeparatedSet(
    nodes,
    built.matrix,
    0,
    nodes.length + 1
  );
  rows.push({
    label:
      "A set larger than the candidate list (" +
      (nodes.length + 1) +
      " from " +
      nodes.length +
      ") must return NOTHING",
    outcome: tooMany === null ? "returned nothing" : "returned a set",
    agrees: tooMany === null,
  });

  // The three looks, as a ROW rather than as a figure somebody
  // remembers to quote. It went unreported for the first time in
  // iteration 10, which is how a standing check stops standing.
  // Recorded 14 August 2026, ceiling and floor both off.
  const LOOK_BASELINES = { filled: 26, outlined: 20, "filled-border": 45 };
  const looksPools = BADGE_LOOKS.map((look) => {
    const probe = cloneState(state);
    probe.chromaCeiling = null;
    probe.lightnessFloor = null;
    probe.badge = Object.assign({}, state.badge, {
      style: look.style,
      borderMode: look.borderMode,
    });
    const gate = gateFor(
      { id: "status-fill-probe", kind: "status-fill" },
      0,
      probe
    );
    const size = badgeCandidates(probe).length;
    rows.push({
      label:
        look.label + " admits " + LOOK_BASELINES[look.id] +
        " of the palette" +
        (look.ruleIsGate ? " at its own gate" : " by the disjunction"),
      outcome:
        size + " of " + state.palette.length +
        ", fill gate reading " + gate.wcag + ":1, Lc " + gate.lc,
      agrees: size === LOOK_BASELINES[look.id],
    });
    return size;
  });

  // The three must PART. Two looks reading one pool is the conflation
  // the table exists to prevent, and a bordered look reading the plain
  // filled pool would mean the disjunction never fired.
  rows.push({
    label:
      "The three looks produce THREE DIFFERENT pools - if any two agree, a look is not reaching its own rule",
    outcome: looksPools.join(" / "),
    agrees: new Set(looksPools).size === BADGE_LOOKS.length,
  });

  const best = Engine.bestSeparationFor(nodes, built.matrix, 2);
  const holds =
    best.possible &&
    Engine.findSeparatedSet(
      nodes,
      built.matrix,
      best.threshold,
      2
    ) !== null &&
    Engine.findSeparatedSet(
      nodes,
      built.matrix,
      best.threshold + 1e-9,
      2
    ) === null;
  rows.push({
    label:
      "The best threshold the search found for a pair (" +
      (best.possible ? Engine.round(best.threshold, 2) : "none") +
      ") must be reachable, and a hair above it must not be",
    outcome: holds ? "both held" : "one of the two did not hold",
    agrees: holds,
  });

  // The short-viewport escape hatch is written twice - once as a
  // media query in the stylesheet, once as SHORT_VIEWPORT_QUERY for
  // the frame-sizing branch. Two copies of one number drift, and the
  // failure is silent: the lock comes off while the frame is still
  // measured against a pane whose height is now its own content.
  // So read the query back out of the CSSOM and compare.
  const declared = [];
  Array.prototype.forEach.call(document.styleSheets, (sheet) => {
    let rules = null;
    try {
      rules = sheet.cssRules;
    } catch (error) {
      return; // A cross-origin sheet cannot be read; none of ours are.
    }
    Array.prototype.forEach.call(rules, (rule) => {
      if (rule.media && /max-height/.test(rule.conditionText || "")) {
        declared.push(rule.conditionText.replace(/\s+/g, " ").trim());
      }
    });
  });
  const wanted = SHORT_VIEWPORT_QUERY.replace(/[()]/g, "").trim();
  const matched = declared.filter(
    (text) => text.replace(/[()]/g, "").trim() === wanted
  );
  rows.push({
    label:
      "The escape-hatch query in the stylesheet matches the one the " +
      "frame sizer reads (" +
      SHORT_VIEWPORT_QUERY +
      ")",
    outcome:
      matched.length === 1
        ? "one matching @media rule found"
        : matched.length +
          " matching rules against " +
          declared.length +
          " max-height rules in the sheet",
    agrees: matched.length === 1,
  });

  return rows;
}

function renderVerificationRows(title, rows, columns) {
  const failed = rows.filter((row) => !row.agrees).length;
  return (
    "<table><caption>" +
    escapeHtml(title) +
    " - " +
    (failed === 0
      ? '<span class="dps-verdict-pass">all ' +
        rows.length +
        " agree</span>"
      : '<span class="dps-verdict-fail">' +
        failed +
        " of " +
        rows.length +
        " disagree</span>") +
    "</caption><thead><tr>" +
    columns
      .map((column) => '<th scope="col">' + escapeHtml(column) + "</th>")
      .join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          "<tr><td>" +
          escapeHtml(row.label) +
          "</td><td>" +
          escapeHtml(
            row.expected === undefined ? row.outcome : row.expected
          ) +
          "</td>" +
          (row.actual === undefined
            ? ""
            : "<td>" + escapeHtml(row.actual) + "</td>") +
          "<td>" +
          verdictHtml(row.agrees) +
          "</td></tr>"
      )
      .join("") +
    "</tbody></table>"
  );
}

  window.DoorPanelStudioChecks = {
    ENUMERATION_BASELINE_MODES: ENUMERATION_BASELINE_MODES,
    checkEnumerationBaselines: checkEnumerationBaselines,
    crossModeChecks: crossModeChecks,
    enumerateSets: enumerateSets,
    renderEnumeration: renderEnumeration,
    renderVerificationRows: renderVerificationRows,
    runGeometryCanary: runGeometryCanary,
    runReadingCanary: runReadingCanary,
    runRenderCanary: runRenderCanary,
    runSolverCanary: runSolverCanary,
  };
})();
