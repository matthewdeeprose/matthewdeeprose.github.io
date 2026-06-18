# Claude Code Prompt: Graph Builder Phase 3 Task 3.1.d — Bubble Visual Polish

**Original Phase 3.1 prompt:** @md-scripts/charts/docs/prompt-phase3-1.md
**Predecessor (3.1.c data layer):** @md-scripts/charts/docs/prompt-phase3-1c-bubble.md
**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md (Phase 3.1 Implementation Results — covers 3.1.a/b/c, including the visual issues that 3.1.d fixes)
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + 4-level logger, 500-line max, WCAG 2.2 AA, British spelling, never-use-`title`-attribute, icons via `icon-library.js`)

---

## State at handoff

**Phase 3.1.a (Stacked) shipped — commit `b3f628b` on `main`** (2026-04-24).
**Phase 3.1.b (Combo) shipped — commit `f34257b` on `main`** (2026-04-25).
**Phase 3.1.c (Bubble — data layer) shipped — commit `33eb272` on `main`** (2026-04-25). New `"radius"` column role; `processBubbleData` sibling produces `{x, y, r}` point objects with single dataset; `buildBubbleConfig` branch in `buildConfig` renders linear x + linear y with type-aware tooltip and tick formatters; Stage 2 Bubble button gated on `valueCols >= 2 && radiusCols >= 1`; basic-mode unaffected. Test 8 numerics all PASS. **Phase 2.5 regression Tests 2/3/4 NOT re-run before commit `33eb272`** — the first action in 3.1.d is to run them.

**Still pending: 3.1.d visual polish.** Two issues surfaced during 3.1.c Test 8 visual review and were judged out of strict 3.1.c scope:

1. **Bubble radius interpreted in canvas pixels, not data units.** Headcount values 30/50/80/120 produce 30–120px-radius bubbles that dominate a typical preview canvas. Relative ordering correct; absolute scale wrong.
2. **Bubble fill rendered yellow/gold rather than `#005c84`.** `processBubbleData` sets `backgroundColor: getSeriesColours(1)[0]` (`"#005c84"` accessible blue) but Chart.js renders gold bubbles. Basic-scaffold or theme override suspected; not investigated.

A lighter third issue ("Chart Title" placeholder shown when user supplied no title) is shared by all chart types and is best treated as Phase 3.2 UX polish — out of scope here unless trivial to bundle.

Current line counts (after 3.1.c, commit `33eb272`):

| File | Lines | 3.1.d expected impact |
|---|---|---|
| [js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js) | 496 | Likely +5–15 if radius scaling lives in `processBubbleData`; watch the 500 cap. May need to compress comments. |
| [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) | 495 | Likely +5–15 if colour-override investigation lands new defensive code in `buildBubbleConfig`. Already absorbed Phase 2/2.5 comment compression in 3.1.c — less headroom. |
| [js/graph-builder-column-manager.js](../../../js/graph-builder-column-manager.js) | 235 | No expected change. |
| [js/graph-builder-enhanced.js](../../../js/graph-builder-enhanced.js) | 500 (at cap) | No expected change. If anything, leave alone. |
| [md-scripts/charts/graph-builder-ui.js](../graph-builder-ui.js) | 1125 | No expected change. |
| [md-scripts/charts/graph-builder-charts.js](../graph-builder-charts.js) | 1523 | No expected change. Still under 1600 mandatory-refactor threshold. |

---

## Working protocol — read carefully

These rules were set during 3.1.a, refined in 3.1.b, observed in 3.1.c, and **must continue**:

1. **One test at a time.** Never paste multiple acceptance tests into a single message. Send one, wait, assess, send the next.
2. **Lead the user through testing.** For each test, give: the Stage 1 setup IIFE → click sequence → Stage 4 verification IIFE → expected numeric table + visual description.
3. **Make the test setup IIFE fully self-contained.** Paste-and-go (`GBE.setColumnConfiguration`, `GBRS.onColumnsChanged`, populate inputs by dispatching `input` events). The user clicks through the wizard and pastes the verification IIFE at Stage 4. **No multi-step manual data entry.**
4. **Assess each result before proceeding.** Read returned `console.table` output. Don't skip.
5. **Keep message bodies short.** The user is on Windows over OneDrive with rendering preferences for compact output.
6. **Never bulk-prompt.** No "here are all the tests" mega-messages.
7. **Commit only on explicit approval.** After all acceptance + regression tests pass, ask "ready to commit?" and hold until they say yes.
8. **Regression tests after every sub-task.** Phase 2.5 Tests 2/3/4 must pass before commit. **Run them first thing** since 3.1.c skipped them.

### Regression test reference (use exactly these — known-passing as of `f34257b`)

**Test 2 — advanced multi-series currency bar:**
- 3 cols (`Month`/text-label, `Sales`/currency-value, `Returns`/currency-value), 4 rows Jan/Feb/Mar/Apr, **bar** chart.
- Expected: `datasets count: 2`, `y-axis title: "Amount (£)"`, y tick `500 → "£500"`, `x scale type: "category"`, `first bar value: 1200`, `dataset[0].type: undefined` (NO combo or bubble leak).

**Test 3 — advanced date-axis line:**
- 3 cols (`Date`/date-label, `Revenue`/number-value, `Profit`/number-value), 4 rows out-of-order (Mar/Jan/Apr/Feb 2024), **line** chart.
- Expected: `x scale type: "time"`, chronological sort (`first data y: 1000`, `last data y: 1800`), `labels[0] month: 0`, `labels[0] year: 2024`, `maxTicksLimit: 12`, `autoSkip: true`, `dataset[0].type: undefined`, `dataset[0].fill: false`.

**Test 4 — basic mode byte-identity (the non-negotiable):**
- Advanced mode **OFF**, basic 2-column apples=10/oranges=20 bar chart. Inputs use `document.getElementById("gb-row-1-col1")` (no hyphen between "col" and the digit).
- Expected: `datasets count: 1`, `dataset[0].data: [10,20]`, `y-axis title: "count"`, `config._gbEnhanced: undefined`, toolbar present under `.chart-controls`.

---

## Sub-task 3.1.d — Bubble visual polish

### Objective

Make the 3.1.c bubble chart render at a sensible visual scale with the colour palette `processBubbleData` actually requested, while preserving Test 8's data-layer numeric expectations (the raw `{x, y, r}` values stay in the dataset; only the rendering changes).

### Scope (in priority order)

1. **Radius pixel-vs-data scaling** — pre-scale or post-scale bubble radii to a sensible visual range bounded by canvas size, while preserving relative proportionality (square-root scaling so bubble *area* ∝ data value, matching the visual description in 3.1.c's prompt: "Bubble areas (∝ r²) reflect Headcount roughly").
2. **Colour override diagnosis + fix** — find why `"#005c84"` becomes yellow/gold and either preserve our colour or document why the scaffold's choice is correct (and update the colour we set so the diagnostic stops being misleading).

### Files and likely changes

| File | Likely change |
|---|---|
| [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) | **Preferred location for radius scaling.** Add a post-scale pass in `buildBubbleConfig` that maps each point's raw `r` to a visual radius using `visualR = MIN_PX + (MAX_PX - MIN_PX) * sqrt((r - rMin) / (rMax - rMin))`. Defaults: `MIN_PX = 6`, `MAX_PX = 40`. Preserves the raw value as `_rRaw` on each point so the tooltip still shows the original Headcount (e.g. "Headcount: 80" not "Headcount: 22.7"). Also: fix the colour override after diagnosis — likely setting `point.backgroundColor` per-point (Chart.js `Colors` plugin tends to leave per-point overrides alone) or registering a defensive Chart.js plugin. **Watch the 500-line cap** — file at 495 lines after 3.1.c. |
| [js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js) | **Likely no change.** Keep `processBubbleData` returning raw `r` values so Test 8's `data[0].r === 80` expectation continues to hold. The visual scaling is a chart-rendering concern, not a data-shape concern. If diagnosis pushes the scaling into the processor anyway, also store `_rRaw` on each point and update Test 8's expected `data[0].r` to the scaled value. |

### Non-goals

- Logarithmic bubble axes — Phase 4.
- Negative-radius semantic handling (e.g. red bubbles for losses) — Phase 4.
- Animated bubble transitions — Phase 4.
- Multi-dataset bubble charts (one dataset per `grouping` column value) — Phase 4.
- "Chart Title" placeholder UX — Phase 3.2 unless the colour-override fix touches the same scaffold path and bundling is trivial.
- Auto-resize of bubble radii on canvas resize — Phase 4 unless the scaling formula naturally handles it.

### Acceptance test 9 — bubble visual polish (radius scaling)

Reuse the 3.1.c Test 8 setup IIFE (4 rows, Headcount 30/50/80/120), then at Stage 4:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  const dp = chart.data.datasets[0].data;
  const radii = dp.map(p => p.r);
  const rawRadii = dp.map(p => p._rRaw);
  console.table({
    "chart.config.type":   chart.config.type,
    "datasets count":      chart.data.datasets.length,
    "data length":         dp.length,
    "min visual r (px)":   Math.min(...radii),
    "max visual r (px)":   Math.max(...radii),
    "min visual r >= 6":   Math.min(...radii) >= 6,
    "max visual r <= 40":  Math.max(...radii) <= 40,
    "raw r preserved":     JSON.stringify(rawRadii),
    "ordering preserved":  rawRadii[0] === 80 && rawRadii[2] === 120 && rawRadii[3] === 30,
    "fill colour":         chart.data.datasets[0].backgroundColor,
  });
})();
```

**Expected:**

| Key | Value |
|---|---|
| `chart.config.type` | `"bubble"` |
| `datasets count` | `1` |
| `data length` | `4` |
| `min visual r (px)` | `>= 6` (smallest scaled bubble) |
| `max visual r (px)` | `<= 40` (largest scaled bubble, East) |
| `min visual r >= 6` | `true` |
| `max visual r <= 40` | `true` |
| `raw r preserved` | `[80, 50, 120, 30]` (original Headcount values) |
| `ordering preserved` | `true` (East still largest, West still smallest in `_rRaw`) |
| `fill colour` | the colour we actually want — see Test 10 |

**Visual:** Four bubbles plotted at distinct (Revenue, Growth %) coordinates, sized 6–40 px in radius. East (`_rRaw=120`) the largest, West (`_rRaw=30`) the smallest. West below the y=0 axis line. Bubbles do not overlap the chart area.

### Acceptance test 10 — bubble colour fix

After diagnosis, the bubble fill colour should match the requested SERIES_PALETTE entry (or whatever colour the diagnosis determines is correct and accessible). Test 10 verifies whatever colour `buildBubbleConfig` sets actually reaches the rendered chart:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  const ds = chart.data.datasets[0];
  console.table({
    "config bg colour":    ds.backgroundColor,
    "config border colour": ds.borderColor,
    "matches palette":     ds.backgroundColor === "#005c84",  // or the agreed value
    "is yellow/gold":      /^#?[a-f0-9]{6}$/i.test(ds.backgroundColor)
                            && /^(ffd|ffc|fb|f9|fa|fb|fc|fd|fe|ff[0-9a-f][0-9a-f])/i
                              .test(ds.backgroundColor.replace("#","")),
  });
})();
```

**Expected:**
- `matches palette` → `true` for whatever colour was agreed.
- `is yellow/gold` → `false` (regression check: the original bug must not recur).

### Tooltip behaviour after scaling

After scaling, the tooltip's `r:` line should read the **raw** Headcount value, not the scaled visual radius. The bubble tooltip callback in `buildBubbleConfig` reads `raw.r` — change it to read `raw._rRaw` (or `raw.r` if scaling lives elsewhere) so users see the actual datum, not a derived display unit. Verify visually by hovering each bubble during Test 9.

---

## What to avoid

- **Do not change Phase 2's core `processData` return shape for bar/line/pie.** Bubble's `processBubbleData` continues to be a sibling — the visual-scaling pass goes in `buildBubbleConfig`, not in the shared data processor.
- **Do not change Test 8's data-layer expectations.** The 3.1.c acceptance criteria stay valid: `data[0].r === 80` continues to hold for the raw datum. If you push scaling into the processor instead, *also* update Test 8's expectations and document the change.
- **Do not refactor `graph-builder-charts.js` in-phase** unless it crosses 1600 lines (still at 1523).
- **Do not undo 3.1.c.** Bubble compatibility rule, `"radius"` role enum, Stage 2 button gating, `processBubbleData` sibling — all stay.
- **Do not break basic mode.** Test 4 byte-identity is non-negotiable.
- **Do not break combo / stacked / bubble-data-layer from 3.1.a/b/c.** All four regression tests (2/3/4 + Test 8) must pass after 3.1.d.
- **Do not commit proactively.** Await explicit approval each time.
- **Do not skip regression tests at the start of 3.1.d.** They were not run before commit `33eb272` per the user's direction. Re-run them first, document results in the masterplan update.
- **Do not add icons inline** — use `icon-library.js` per CLAUDE.md.
- **Do not widen scope to 3.2+** (UX polish, transform tools, templates, export). Strictly bubble visual polish here.

---

## Diagnostic starting points

For the colour override (Issue #7 in masterplan Phase 3.1 Issues Encountered):

1. After `buildBubbleConfig` returns, log `config.data.datasets[0].backgroundColor` — should be `"#005c84"`.
2. After `new Chart(canvas, config)` constructs (in `_createEnhancedChartDirect`), log `chart.data.datasets[0].backgroundColor` — if this is yellow/gold, Chart.js's `Colors` plugin or similar replaced it during construction.
3. If Chart.js's `Colors` plugin is the culprit, options: (a) `Chart.unregister(Colors)` globally — likely too broad; (b) set `options.plugins.colors.enabled = false` per-config — preserves our explicit colours; (c) attach `backgroundColor` per-point as an array on the dataset (`[c, c, c, c]`) — Chart.js leaves per-point overrides alone.
4. If a downstream accessibility-theme processor is mutating colours, look in `FinalChartCreator.initializeAccessibilityFeatures` and `chart-builder-state.js`.

For radius scaling — square-root scaling preserves area-proportionality (the bubble area ∝ data value, which is what users intuitively expect). Linear scaling would make the largest bubble's *radius* twice the smallest's when the data ratio is 2:1, which over-emphasises differences. Use:

```javascript
const rawValues = dp.map(p => p.r);
const rMin = Math.min(...rawValues);
const rMax = Math.max(...rawValues);
const MIN_PX = 6;
const MAX_PX = 40;
const range = rMax - rMin;
dp.forEach(p => {
  p._rRaw = p.r;
  if (range === 0) {
    p.r = (MIN_PX + MAX_PX) / 2;
  } else {
    const t = (p.r - rMin) / range;
    p.r = MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt(t);
  }
});
```

Edge cases: single-point dataset (range = 0 → use midpoint); all-equal radii (range = 0 → same midpoint); negative raw values (already clamped to ≥ 1 by `processBubbleData` — pass through unchanged after sqrt).

---

## Starting message

When you begin, do **not** dump the whole plan. Instead:

1. Confirm you've re-read: this document, [prompt-phase3-1c-bubble.md](./prompt-phase3-1c-bubble.md), and the masterplan's Phase 3.1 Implementation Results block (especially "Notes for Phase 3.1.d (Bubble visual polish)" and Issues #6/#7/#8).
2. Ask the user: "Ready to apply Phase 3.1.d (Bubble visual polish — radius scaling 6–40 px with sqrt area-proportionality, plus colour-override diagnosis and fix)? Per the protocol I'll re-run Phase 2.5 regression Tests 2/3/4 first thing (skipped before commit `33eb272`), then diagnose the colour override, then add radius scaling, then run Tests 9 + 10 + the regressions one at a time before asking to commit."

After they confirm, proceed in this order:

1. **Run regression Tests 2, 3, 4 first.** Send one at a time. If any fail, stop and investigate — do not start the polish work on a broken baseline.
2. **Diagnose the colour override** before writing any fix. Send the user a small diagnostic IIFE (Test 8 setup → Stage 4 → log `chart.data.datasets[0].backgroundColor`) to confirm what Chart.js is rendering vs what we set. Decide on a fix path based on the result.
3. **Apply colour fix** in `buildBubbleConfig`. Run Test 10.
4. **Apply radius scaling** in `buildBubbleConfig` (post-scaffold, before tooltip callback wiring). Run Test 9.
5. **Re-run Test 8 from 3.1.c** to confirm the data-layer numerics are still PASS — note that `data[0].r` may now be the *scaled* radius (~13.5px for Headcount=80 with the formula above) rather than the raw 80. If so, the test expectations carry forward but with `_rRaw` standing in for the raw datum check; update the masterplan accordingly.
6. **Re-run regressions 2, 3, 4** after the polish lands to catch any unintended interaction.

Only after all of 3.1.d's acceptance tests + regressions pass with user confirmation, ask to commit. Commit message prefix: `Phase 3.1.d:`.

After 3.1.d is committed, propose a **final masterplan update commit** extending the Phase 3.1 Implementation Results block to cover 3.1.d (completion date, files modified, test results, issues encountered, architecture decisions, notes for Phase 3.2). Commit prefix: `Phase 3.1 docs:`.

**Do not start 3.1.d until the user confirms.**
