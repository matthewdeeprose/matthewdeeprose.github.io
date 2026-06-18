# Claude Code Prompt: Graph Builder Phase 3 Task 3.1 — Advanced Chart Types

**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md
**Phase 2.5 implementation record:** Inside the masterplan under "Phase 2.5 Implementation Results" (code commit `6cd0a4f`; masterplan commit `14692b3`)
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + logging pattern, 500-line max, WCAG 2.2 AA, British spelling)
**Predecessor:** Phase 2.5 shipped 2026-04-24. Multi-series rendering with currency/percentage tick formatters, tooltips, TimeScale chronological ordering, and multi-series y-axis titles all work end-to-end. Basic mode remains byte-identical. Advanced mode uses the `_createEnhancedChartDirect` bypass introduced by fix #1.

---

## What Phase 3 Task 3.1 delivers

Three advanced chart types building on Phase 2's multi-series data pipeline:

| Sub-task | Chart type | Complexity | Data path change |
|---|---|---|---|
| 3.1.a | Stacked bar / stacked line | Small | None — same multi-series datasets, new scales flag |
| 3.1.b | Combo (bar + line mixed) | Medium | None — per-dataset `type` override driven by new column field |
| 3.1.c | Bubble (x, y, radius) | Large | New — `{x, y, r}` point objects instead of scalar arrays; new column role `radius` |

**Out of scope for 3.1:**

- Phase 3 UX polish (per-column currency symbol selector, thousand-separator auto-insert, preview-stats refresh) — these are Phase 3 Task 3.2.
- Data transformation tools (aggregate, pivot, filter) — Phase 3 Task 3.3.
- Chart template system (save/load configurations) — Phase 3 Task 3.4.
- Enhanced export options — Phase 3 Task 3.5.
- Refactoring `graph-builder-charts.js` (still 1521 lines; under the 1600 mandatory-refactor threshold). Only revisit if Phase 3.1 edits push it past 1600.

---

## Why three sub-tasks and why in this order

**3.1.a (Stacked) first** — smallest. No data-path change, no new column roles, no new Stage 2 chart gallery entry. Just a `stacked: true` flag on both scales when the user opts in at Stage 3 (Configure Chart). Proves the Phase 3 scaffolding slots cleanly into the Phase 2 pipeline.

**3.1.b (Combo) second** — introduces a new concept (per-value-column chart type) without changing data shape. Phase 2's multi-series datasets work unchanged; only dataset construction gains a `type` property mapping from a new `col.chartType` column field.

**3.1.c (Bubble) last** — first Phase 3 change to data shape. The data processor gets a new path producing `{x, y, r}` point objects; column roles extend with a `"radius"` role. This is where Phase 2's "datasets parallel to a shared labels array" assumption no longer applies.

Each sub-task is commitable independently. Stop after any sub-task if scope shifts. No sub-task blocks the others, though 3.1.c benefits from 3.1.a's and 3.1.b's UI patterns being in place first.

---

## Before you start — read these in order

1. **[graphbuilder-masterplan.md](./graphbuilder-masterplan.md) Phase 2 and Phase 2.5 Implementation Results.** The former explains the data pipeline Phase 3 builds on (Architecture Decisions → "Delegation over duplication"). The latter explains the construction path ending in `_createEnhancedChartDirect` — the bypass that both Phase 2.5 and Phase 3 rely on.
2. **[js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js)** — 347 lines. `processData` is the entry point. Study how it produces `{ labels, datasets, xAxisType, formatters, meta }` from `(rawData, columnConfig)`. 3.1.c adds a new sibling function (or a branch keyed on chart type) that returns a bubble-shaped result instead.
3. **[js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js)** — 411 lines. `buildConfig(processedData, chartType, options)` is the main builder. 3.1.a adds `stacked` scale flags here; 3.1.b maps `col.chartType` → `dataset.type` here; 3.1.c adds a bubble branch that takes the new processed shape.
4. **[js/graph-builder-column-manager.js](../../../js/graph-builder-column-manager.js)** — 223 lines. Column definition API. 3.1.b adds a `chartType` field to value columns; 3.1.c adds a `"radius"` role and updates chart-compatibility logic.
5. **[md-scripts/charts/graph-builder-ui.js](../graph-builder-ui.js)** — Stage 2 chart-type gallery and Stage 3 "Configure Chart" options. 3.1.a adds Stage 3 "Stack series" checkbox; 3.1.b adds "Combo (mixed)" to Stage 2; 3.1.c adds "Bubble" to Stage 2.
6. **CLAUDE.md** § "Graph Builder — CRITICAL LOAD ORDER" (no changes expected), § "Incremental Development Protocol" (one file per iteration), § "Logging Standards" (all new code gets the 4-level logger).

**Do not** re-read `md-scripts/charts/graph-builder-charts.js` cover-to-cover. The bypass path set up in Phase 2.5 is stable; you'll touch `buildConfigRouted` only if Phase 3 introduces a new construction concern, which it should not.

---

## Sub-task 3.1.a — Stacked bar / line

### Objective

Give users a "Stack series" option at Stage 3 (Configure Chart). When ticked, both x and y scales get `stacked: true` and multi-series bar/line charts render with datasets stacked cumulatively rather than grouped side-by-side.

### Files

| File | Change |
|---|---|
| `md-scripts/charts/graph-builder-ui.js` | Add "Stack series" checkbox to Stage 3, visible only for `bar` and `line` chart types in advanced mode. Checkbox state persists across `goToNext` / `goToPrev`. |
| `md-scripts/charts/graph-builder-core.js` | Read checkbox state into the options object passed to `buildConfig`. |
| `js/graph-builder-charts-enhanced.js` | In `buildConfig`, when `options.stacked === true` and chart type is `bar` or `line`: set `config.options.scales.x.stacked = true` and `config.options.scales.y.stacked = true`. |

### Non-goals

- Stacked percentage (normalised to 100%) — future Phase 3.1 extension.
- Stacked horizontal bar — achievable with existing `indexAxis: "y"`; not a new UI surface.
- Basic-mode stacking — leave the basic 2-column path unchanged.

### Acceptance test 5 — stacked bar

Setup IIFE (paste into DevTools console, Graph Builder mode):

```javascript
// Test 5: 3 value columns so stacking is visually obvious
(async () => {
  const GBE = window.GraphBuilderEnhanced;
  const GBRS = window.GraphBuilderRowSync;
  if (!GBE || !GBRS) { console.error("Enhanced / RowSync modules not loaded"); return; }

  const cb = document.getElementById("gb-advanced-checkbox");
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }

  GBE.setColumnConfiguration([
    { name: "Region",    type: "text",   role: "label" },
    { name: "Online",    type: "number", role: "value" },
    { name: "Retail",    type: "number", role: "value" },
    { name: "Wholesale", type: "number", role: "value" },
  ], true);
  GBRS.onColumnsChanged(GBE.getColumnConfiguration());

  const container = document.getElementById("gb-data-rows");
  while (container.querySelectorAll(".gb-data-row").length < 4) GBRS.addEnhancedRow();

  const data = [
    ["North", "300", "200", "100"],
    ["South", "250", "300", "150"],
    ["East",  "400", "150",  "80"],
    ["West",  "200", "250", "120"],
  ];
  const rows = container.querySelectorAll(".gb-data-row");
  data.forEach((row, r) => {
    const inputs = rows[r].querySelectorAll("input");
    row.forEach((val, c) => {
      inputs[c].value = val;
      inputs[c].dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
  console.log("Test 5 populated. Next → Bar → Next → tick 'Stack series' → Generate.");
})();
```

Click Next → **Bar** → Next → **tick "Stack series"** → Generate. At Stage 4 paste:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  console.table({
    "scales.x.stacked": chart.options.scales.x.stacked,
    "scales.y.stacked": chart.options.scales.y.stacked,
    "datasets count":   chart.data.datasets.length,
    "scales.y.max":     chart.scales.y.max,
  });
})();
```

**Expected:** both `scales.*.stacked === true`, `datasets count === 3`, `scales.y.max ~700` (largest row sum: `400+150+80 = 630`). Visually: each bar split into three stacked coloured segments totalling the row sum.

### Acceptance test 6 — stacked line

Repeat Test 5 with **Line** chart type instead of Bar. Expected: stacked area-style line chart; each dataset's line drawn above the previous one cumulatively.

### Acceptance test 5b — regression: unstacked still works

Repeat Test 5 **without** ticking "Stack series". Bars should group side-by-side (Phase 2 behaviour). Confirm `scales.x.stacked === false` (or `undefined`) and bars are adjacent, not stacked.

---

## Sub-task 3.1.b — Combo (bar + line mixed)

### Objective

In advanced mode, each value column can declare its chart type (`bar` or `line`). The rendered chart combines them: some series as bars, others as lines, on shared axes.

### Files

| File | Change |
|---|---|
| `js/graph-builder-column-manager.js` | Add optional `chartType: "bar" \| "line"` field to value column definitions. Default: `undefined` (dataset inherits overall chart type). |
| `js/graph-builder-enhanced.js` | In Advanced Column Options, each value column gets a chart-type `<select>` with options `(default)`, `bar`, `line`. Hidden for non-value roles. |
| `js/graph-builder-charts-enhanced.js` | In `buildConfig`, when chart type is `"combo"`: set overall `config.type = "bar"` (Chart.js's documented combo container), then set each `dataset.type` to its column's `chartType || "bar"`. |
| `md-scripts/charts/graph-builder-ui.js` | Add "Combo (mixed)" chart option to Stage 2. Enabled only when at least two value columns exist. |

### Non-goals

- Per-series dual y-axis — future Phase 3 extension.
- Combo combined with stacked — treat as a Phase 4 consideration; if a user ticks both, prefer combo and log a warning (don't silently drop one).

### Acceptance test 7 — combo render

Setup:

```javascript
// Test 7: one bar series + one line series on shared axes
(async () => {
  const GBE = window.GraphBuilderEnhanced;
  const GBRS = window.GraphBuilderRowSync;
  if (!GBE || !GBRS) return console.error("modules missing");
  const cb = document.getElementById("gb-advanced-checkbox");
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }

  GBE.setColumnConfiguration([
    { name: "Month",  type: "text",     role: "label" },
    { name: "Sales",  type: "currency", role: "value", chartType: "bar" },
    { name: "Target", type: "currency", role: "value", chartType: "line" },
  ], true);
  GBRS.onColumnsChanged(GBE.getColumnConfiguration());

  const container = document.getElementById("gb-data-rows");
  while (container.querySelectorAll(".gb-data-row").length < 4) GBRS.addEnhancedRow();
  const data = [
    ["Jan", "£1,200", "£1,500"],
    ["Feb", "£1,500", "£1,500"],
    ["Mar", "£1,800", "£2,000"],
    ["Apr", "£2,400", "£2,000"],
  ];
  const rows = container.querySelectorAll(".gb-data-row");
  data.forEach((row, r) => {
    const inputs = rows[r].querySelectorAll("input");
    row.forEach((val, c) => {
      inputs[c].value = val;
      inputs[c].dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
  console.log("Test 7 populated. Next → Combo (mixed) → Next → Generate.");
})();
```

Click Next → **Combo (mixed)** → Next → Generate. Paste:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  console.table({
    "chart.config.type": chart.config.type,
    "dataset[0].type":   chart.data.datasets[0].type,
    "dataset[1].type":   chart.data.datasets[1].type,
    "datasets count":    chart.data.datasets.length,
    "y-axis title":      chart.options.scales.y.title?.text,
  });
})();
```

**Expected:** `chart.config.type === "bar"`, `dataset[0].type === "bar"`, `dataset[1].type === "line"`, `datasets count === 2`, `y-axis title === "Amount (£)"` (Phase 2.5's `applyYAxisTitle` should still engage — uniform currency across both series). Visually: currency bars for Sales with a line overlay for Target on the shared y-axis, £ tick formatter + tooltip.

---

## Sub-task 3.1.c — Bubble (x, y, radius)

### Objective

A chart type where each data point has three dimensions: x position, y position, and bubble radius. Graph Builder maps three value columns onto those dimensions.

### Files

| File | Change |
|---|---|
| `js/graph-builder-column-manager.js` | Add `"radius"` to the valid role enum. Extend chart-compatibility map so bubble requires 2 value columns + 1 radius column (label column optional — becomes dataset grouping). |
| `js/graph-builder-data-enhanced.js` | New `processBubbleData(rawData, columnConfig)` returning `{ datasets: [{ label, data: [{x, y, r}, ...], backgroundColor, borderColor }], meta }`. No shared `labels` array (bubble has linear x, no category axis). Radius values clamped to min `1`; log a warning if the input was negative. |
| `js/graph-builder-charts-enhanced.js` | Branch `buildConfig(processedData, "bubble", options)` into a bubble-specific builder: linear x-scale, linear y-scale, tooltip formatter showing `(x, y, r=r)` values with column-type aware formatting. |
| `md-scripts/charts/graph-builder-ui.js` | Add "Bubble" to Stage 2 chart gallery. Column-config hint at Stage 1 when bubble is selected: "needs 2 value columns (x, y) + 1 radius column". |

### Non-goals

- Logarithmic bubble axes — Phase 4.
- Negative-radius semantic handling (e.g. red bubbles for losses) — Phase 4.
- Animated bubble transitions when rows are added post-render.

### Acceptance test 8 — bubble render

Setup:

```javascript
// Test 8: 4 bubbles with distinct x / y / radius
(async () => {
  const GBE = window.GraphBuilderEnhanced;
  const GBRS = window.GraphBuilderRowSync;
  if (!GBE || !GBRS) return console.error("modules missing");
  const cb = document.getElementById("gb-advanced-checkbox");
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }

  GBE.setColumnConfiguration([
    { name: "Region",    type: "text",       role: "label" },
    { name: "Revenue",   type: "number",     role: "value" },
    { name: "Growth %",  type: "percentage", role: "value" },
    { name: "Headcount", type: "number",     role: "radius" },
  ], true);
  GBRS.onColumnsChanged(GBE.getColumnConfiguration());

  const container = document.getElementById("gb-data-rows");
  while (container.querySelectorAll(".gb-data-row").length < 4) GBRS.addEnhancedRow();
  const data = [
    ["North", "1200", "15",  "80"],
    ["South",  "900",  "8",  "50"],
    ["East",  "1500", "22", "120"],
    ["West",   "700",  "-3", "30"],
  ];
  const rows = container.querySelectorAll(".gb-data-row");
  data.forEach((row, r) => {
    const inputs = rows[r].querySelectorAll("input");
    row.forEach((val, c) => {
      inputs[c].value = val;
      inputs[c].dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
  console.log("Test 8 populated. Next → Bubble → Next → Generate.");
})();
```

Click Next → **Bubble** → Next → Generate. Paste:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  const dp = chart.data.datasets[0].data;
  console.table({
    "chart.config.type":   chart.config.type,
    "data length":         dp.length,
    "data[0] shape ok":    "x" in dp[0] && "y" in dp[0] && "r" in dp[0],
    "x scale type":        chart.scales.x.type,
    "y scale type":        chart.scales.y.type,
    "datasets count":      chart.data.datasets.length,
  });
})();
```

**Expected:** `chart.config.type === "bubble"`, `data length === 4`, `data[0] shape ok === true`, both scales `"linear"`. Visually: four bubbles at distinct `(Revenue, Growth %)` coordinates, areas proportional to Headcount. The "West" row's negative growth should render as a bubble at `y = -3` with radius clamped to `>= 1`.

---

## Regression tests (must pass after every sub-task)

- **Test 2** (Phase 2.5, advanced currency multi-series bar): `£` y-axis ticks, `Amount (£)` y-title, two grouped bars per month. Byte-identical.
- **Test 3** (Phase 2.5, advanced date-axis line): TimeScale engaged, 12 tick labels across Jan–Apr 2024, smooth monotonic lines with no zig-zag.
- **Test 4** (basic mode): `apples`/`oranges` heights 10/20 via the ChartBuilderState path. Byte-identical to pre-3.1 basic-mode behaviour.

Never commit a sub-task without re-running Tests 2, 3, and 4.

---

## Acceptance criteria

**Per sub-task:**

- [ ] **3.1.a** — "Stack series" checkbox at Stage 3 toggles stacking for bar + line. Test 5 and Test 6 pass. Unticked path (Test 5b) is byte-identical to Phase 2 grouping.
- [ ] **3.1.b** — Per-value-column `chartType` field in Advanced Column Options produces combo chart. Test 7 passes. `applyYAxisTitle` still sets the currency title.
- [ ] **3.1.c** — New `"radius"` column role + bubble chart type renders three-dimensional data. Test 8 passes. Negative radii clamped with a warning log.

**Overall:**

- [ ] `node --check` passes on all touched files after every edit.
- [ ] Tests 2, 3, 4 pass after each sub-task (regression, human-confirmed).
- [ ] WCAG 2.2 AA unchanged — run axe-core on a rendered advanced-mode chart; keyboard-reach all new form controls; visible focus on new `<select>` + checkbox; accessible names on every new input.
- [ ] British spelling throughout (`colour`, `initialise`, `behaviour`).
- [ ] New code follows CLAUDE.md logging standards (IIFE + 4-level logger).
- [ ] No NEW file exceeds 500 lines. `graph-builder-charts.js` must not cross 1600 (would force the 2.5.3 refactor mid-phase).
- [ ] One commit per sub-task. Masterplan update held for a final separate commit after all committed sub-tasks (scope may be 1, 2, or all 3).

---

## What to avoid

- **Do not change Phase 2's core data pipeline.** `processData`'s return shape for bar / line / pie stays. 3.1.c adds a new sibling function (or an internal branch gated on chart type) — it does not mutate existing return values for non-bubble charts.
- **Do not change the ChartBuilderState bypass.** Phase 2.5 established that advanced-mode final charts go through `_createEnhancedChartDirect` and basic mode goes through ChartBuilderState. That gate stays; Phase 3 chart types flow through the bypass unchanged.
- **Do not refactor `graph-builder-charts.js` in-phase.** Task 2.5.3 is deferred to Phase 3 ONLY as a conditional trigger at 1600 lines. If your edits push it past 1600, stop and refactor before continuing. If they don't, leave it alone.
- **Do not add radius-role logic to scalar chart types.** Bubble's `role: "radius"` is bubble-only. A bar chart with a radius column should either ignore the role (with a console warning) or column-manager's compatibility check should reject the combination at validation time.
- **Do not widen scope to Phase 3 Tasks 3.2+.** UX polish, transform tools, templates, enhanced export — all future tasks. Strictly stacked / combo / bubble here.
- **Do not commit proactively.** Hold each sub-task until (a) `node --check` passes, (b) the new sub-task test passes, (c) Tests 2/3/4 regressions pass, (d) human explicit approval.
- **Do not undo Phase 2.5 fixes.** `applyYAxisTitle`, `displayFormats`+`autoSkip`, the processor's chronological sort, and `_createEnhancedChartDirect` bypass — all four are load-bearing for advanced mode. If bubble needs different display-format handling, gate it on chart type; don't remove the existing logic.
- **Do not break basic mode.** `_gbEnhanced` marker gating is the tripwire. Test 4 byte-identity is non-negotiable.
- **Do not add icons inline.** Any new toolbar buttons or form icons use the central SVG library (`icon-library.js`) per CLAUDE.md § "Icons". If a needed icon is missing, stop and ask.

---

## Starting message

When you begin the conversation, confirm you've read:

1. [graphbuilder-masterplan.md](./graphbuilder-masterplan.md) — Phase 2 and Phase 2.5 Implementation Results blocks.
2. [js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js) in full (347 lines).
3. [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) in full (411 lines).
4. [js/graph-builder-column-manager.js](../../../js/graph-builder-column-manager.js) in full (223 lines).
5. CLAUDE.md § "Graph Builder CRITICAL LOAD ORDER", § "Incremental Development Protocol", § "Logging Standards", § "Icons".

Then ask:

> Ready to apply Phase 3 Task 3.1 as three sub-tasks (3.1.a stacked, 3.1.b combo, 3.1.c bubble), ordered by increasing complexity. Want to tackle all three in one session, or stop after 3.1.a to commit + review before continuing? 3.1.a is smallest (scales flag only, no data-path change); 3.1.b introduces per-column chartType; 3.1.c adds a new role ("radius") and a new data shape ({x, y, r}). All commits held until you approve each acceptance test. Regression tests (Phase 2.5 Tests 2/3/4) must pass after every sub-task; basic mode stays byte-identical throughout.

Proceed based on the human's answer.
