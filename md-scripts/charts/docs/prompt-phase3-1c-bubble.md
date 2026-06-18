# Claude Code Prompt: Graph Builder Phase 3 Task 3.1.c — Bubble Charts

**Original Phase 3.1 prompt:** @md-scripts/charts/docs/prompt-phase3-1.md
**Predecessor (mid-phase):** @md-scripts/charts/docs/prompt-phase3-1-continuation.md
**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md (Phase 3.1 Implementation Results — covers 3.1.a/b)
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + 4-level logger, 500-line max, WCAG 2.2 AA, British spelling, never-use-`title`-attribute, icons via `icon-library.js`)

---

## State at handoff

**Phase 3.1.a (Stacked) shipped — commit `b3f628b` on `main`** (2026-04-24). Stage 3 "Stack series" checkbox toggles `scales.{x,y}.stacked: true` for bar/line; stacked line uses `fill: true` for visible area-style banding; gating is on advanced mode + cartesian chart type.

**Phase 3.1.b (Combo) shipped — commit `f34257b` on `main`** (2026-04-25). Per-value-column "Chart Type" `<select>` in Advanced Column Options (gated on `valueCols >= 2`); Stage 2 "Combo (mixed)" button (gated identically); chart generator uses `"bar"` scaffold and writes per-dataset `.type` from `_columnChartType` carried through the data processor; combo line gets `borderWidth: 2` + `fill: false` for legibility on bar fills. **Masterplan update committed at `570fd66`** capturing 3.1.a + 3.1.b results.

**Still pending: 3.1.c (Bubble — `{x, y, r}` with new `"radius"` column role).** Defined in full in the original prompt's section "Sub-task 3.1.c". This is the largest of the three sub-tasks because it's the **first Phase 3 change to data shape**.

Current line counts (after 3.1.b):

| File | Lines | Notes |
|---|---|---|
| [js/graph-builder-column-manager.js](../../../js/graph-builder-column-manager.js) | 234 | Will gain `"radius"` role enum + bubble compatibility rule |
| [js/graph-builder-enhanced.js](../../../js/graph-builder-enhanced.js) | **500** (at limit) | If 3.1.c needs new role-related rendering, watch the line count |
| [js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js) | 353 | New sibling `processBubbleData` lives here |
| [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) | 470 | Bubble branch in `buildConfig` |
| [md-scripts/charts/graph-builder-ui.js](../graph-builder-ui.js) | 1121 | Bubble extends the `refreshAvailability()` chokepoint |
| [md-scripts/charts/graph-builder-core.js](../graph-builder-core.js) | 2240 | Pre-existing 500-line violation, deferred — do not touch unless 3.1.c forces it |
| [md-scripts/charts/graph-builder-charts.js](../graph-builder-charts.js) | 1521 | Still under the 1600 mandatory-refactor threshold |

---

## Working protocol — read carefully

These rules were set by the user during 3.1.a, refined during 3.1.b, and **must continue**:

1. **One test at a time.** Never paste multiple acceptance tests into a single message. Send one, wait for results, assess, then send the next.
2. **Lead the user through testing.** For each test, give: the Stage 1 setup IIFE → the click sequence → the Stage 4 verification IIFE → the expected numeric table and visual description.
3. **Make the test setup IIFE fully self-contained.** Paste-and-go: pre-fills column config (via `GBE.setColumnConfiguration`), toggles advanced mode, syncs rows (via `GBRS.onColumnsChanged`), populates inputs by dispatching `input` events. The user clicks through the wizard and pastes the verification IIFE at Stage 4. **No multi-step manual data entry.**
4. **Assess each result before proceeding.** Read the returned `console.table` output carefully. Don't skip to the next test until you have explicit confirmation (numeric values + visual confirmation).
5. **Keep message bodies short.** The user is on Windows over OneDrive with rendering preferences for compact output. A test message should fit in one screen.
6. **Never bulk-prompt.** No "here are all the acceptance tests you need to run" mega-messages. One test at a time.
7. **Commit only on explicit approval.** After all acceptance + regression tests pass for the sub-task, ask the user "ready to commit?" and hold until they say yes.
8. **Regression tests after every sub-task.** Phase 2.5 Tests 2/3/4 must pass before commit. Test setup IIFEs are captured below for reference (3.1.b refined them — basic-mode row IDs are `gb-row-N-col1` / `gb-row-N-col2`, NOT `gb-row-N-col-1`).

### Regression test reference (use exactly these — they're known-passing as of `f34257b`)

**Test 2 — advanced multi-series currency bar:**
- 3 cols (`Month`/text-label, `Sales`/currency-value, `Returns`/currency-value), 4 rows Jan/Feb/Mar/Apr, **bar** chart.
- Expected: `datasets count: 2`, `y-axis title: "Amount (£)"`, y tick `500 → "£500"`, `x scale type: "category"`, `first bar value: 1200`, `dataset[0].type: undefined` (NO combo leak).

**Test 3 — advanced date-axis line:**
- 3 cols (`Date`/date-label, `Revenue`/number-value, `Profit`/number-value), 4 rows deliberately out-of-order (Mar/Jan/Apr/Feb 2024), **line** chart.
- Expected: `x scale type: "time"`, chronological sort (`first data y: 1000`, `last data y: 1800`), `labels[0] month: 0` (Jan), `labels[0] year: 2024`, `maxTicksLimit: 12`, `autoSkip: true`, `dataset[0].type: undefined`, `dataset[0].fill: false`.

**Test 4 — basic mode byte-identity (the non-negotiable):**
- Advanced mode **OFF**, basic 2-column apples=10/oranges=20 bar chart. Inputs use `document.getElementById("gb-row-1-col1")` (note: no hyphen between "col" and the digit).
- Expected: `datasets count: 1`, `dataset[0].data: [10,20]`, `y-axis title: "count"` (basic mode uses column-2 header name as y-title), `config._gbEnhanced: undefined` (THE critical assertion — bypass marker absent), toolbar present under `.chart-controls`.

---

## Sub-task 3.1.c — Bubble (x, y, radius)

### Objective

A chart type where each data point has three dimensions: x position, y position, bubble radius. Graph Builder maps three columns (2 value + 1 radius role) onto those dimensions. **First Phase 3 change to data shape** — Phase 2's "datasets parallel to a shared labels array" assumption no longer applies.

### Files and changes

| File | Change |
|---|---|
| [js/graph-builder-column-manager.js](../../../js/graph-builder-column-manager.js) | Add `"radius"` to the valid role enum. `getCompatibleChartTypes()`: bubble requires `valueCols >= 2 && radiusCols >= 1`. The existing `if (valueCols >= 3) compatible.push("bubble")` check (line 188 in current file) needs replacing — bubble is no longer just "≥3 value columns", it now requires the explicit radius role. Also: when role is changed away from `"radius"`, drop any radius-only metadata cleanly. |
| [js/graph-builder-enhanced.js](../../../js/graph-builder-enhanced.js) | Add `"radius"` to the `roleOpts` / `roleLabels` arrays. **Watch the line count — file is at exactly 500.** May need to compress existing comments to absorb new code without violating the 500-line cap. The Chart Type select introduced in 3.1.b is value-only and gated on `valueCount >= 2`; radius-role columns should not show that select. |
| [js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js) | New `processBubbleData(rawData, columnConfig)` returning `{ datasets: [{ label, data: [{x, y, r}, ...], backgroundColor, borderColor }], meta }`. **No shared `labels` array** (bubble has linear x, no category axis). Radius values clamped to `>= 1`; log a warning if input was negative. **Do not mutate the existing `processData` return shape for non-bubble charts** — the bubble path is a sibling function or an internal branch keyed on chart type. |
| [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) | Branch `buildConfig(processedData, "bubble", options)` into a bubble-specific builder: linear x-scale, linear y-scale, no category labels, tooltip formatter showing `(x, y, r=r)` with column-type-aware formatting. Reuse the existing `applyDatasets` / `applyLegend` patterns where they fit; bypass `applyXAxisScale` / `applyYAxisFormatter` if they assume cartesian-with-categories. |
| [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) (router) | The `buildConfig` entry point currently routes by `chartType`. For bubble, it must call `processBubbleData` instead of consuming the standard `processData` output. Decide: branch in `buildConfig`, or have the upstream caller (the router in `graph-builder-charts.js`) choose which processor to call. Either works; prefer the branch in `buildConfig` so the data-shape contract is encapsulated in one place. |
| [md-scripts/charts/graph-builder-ui.js](../graph-builder-ui.js) | Extend `ChartTypeSelector.refreshAvailability()` to gate the existing Stage 2 Bubble button (already present in tools.html from Phase 1) on the new bubble compatibility rule (`valueCols >= 2 && radiusCols >= 1`). The chokepoint is already wired through `ScreenManager.switchTo("chart-type")` — just add the bubble check alongside the combo check. |
| [tools.html](../../../tools.html) | **Bubble button already exists** at Stage 2 (data-chart-type="bubble", left over from Phase 1). No HTML changes needed unless you want to add a Stage 1 hint when bubble is selected ("needs 2 value columns (x, y) + 1 radius column"). |

### Acceptance test 8 — bubble render

Setup IIFE (paste into DevTools console, Graph Builder mode, after page reload):

```javascript
(async () => {
  const GBE = window.GraphBuilderEnhanced;
  const GBRS = window.GraphBuilderRowSync;
  if (!GBE || !GBRS) { console.error("Enhanced / RowSync modules not loaded"); return; }

  const cb = document.getElementById("gb-advanced-checkbox");
  if (cb && !cb.checked) {
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Test 8 — bubble: 2 value (x, y) + 1 radius column
  GBE.setColumnConfiguration([
    { name: "Region",    type: "text",       role: "label" },
    { name: "Revenue",   type: "number",     role: "value" },
    { name: "Growth %",  type: "percentage", role: "value" },
    { name: "Headcount", type: "number",     role: "radius" },
  ], true);
  GBRS.onColumnsChanged(GBE.getColumnConfiguration());

  const container = document.getElementById("gb-data-rows");
  while (container.querySelectorAll(".gb-data-row").length < 4) GBRS.addEnhancedRow();

  // West row has negative growth — radius clamping case
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

  console.log("✅ Test 8 prefilled. Click sequence:");
  console.log("  1. Click Next → Bubble tile → Next → Generate Chart");
  console.log("  2. Paste the verification IIFE at Step 4.");
})();
```

Verification IIFE (paste at Stage 4):

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  const dp = chart.data.datasets[0].data;
  console.table({
    "chart.config.type":   chart.config.type,
    "datasets count":      chart.data.datasets.length,
    "data length":         dp.length,
    "data[0] shape ok":    "x" in dp[0] && "y" in dp[0] && "r" in dp[0],
    "data[0] x":           dp[0].x,
    "data[0] y":           dp[0].y,
    "data[0] r":           dp[0].r,
    "x scale type":        chart.scales.x.type,
    "y scale type":        chart.scales.y.type,
    "negative growth y":   dp.find(p => p.y < 0)?.y,
    "min radius":          Math.min(...dp.map(p => p.r)),
    "labels":              JSON.stringify(chart.data.labels || []),
  });
})();
```

**Expected:**
- `chart.config.type` → `"bubble"`
- `datasets count` → `1` (single dataset; rows become points)
- `data length` → `4`
- `data[0] shape ok` → `true`
- `data[0] x` → `1200` (Revenue from row 0)
- `data[0] y` → `15` (Growth % from row 0)
- `data[0] r` → `80` (Headcount from row 0)
- `x scale type` → `"linear"` (NOT category, NOT time)
- `y scale type` → `"linear"`
- `negative growth y` → `-3` (West row's growth is preserved on y; only radius is clamped)
- `min radius` → `>= 1`
- `labels` → `"[]"` (no shared labels array for bubble)

**Visual:** Four bubbles plotted at distinct `(Revenue, Growth %)` coordinates. Bubble areas (∝ r²) reflect Headcount roughly: East (120) largest → North (80) → South (50) → West (30) smallest. West's bubble sits below the y=0 axis line.

### Non-goals

- Logarithmic bubble axes — Phase 4.
- Negative-radius semantic handling (e.g. red bubbles for losses) — Phase 4.
- Animated bubble transitions when rows are added post-render.
- Multi-dataset bubble charts (e.g. one dataset per `grouping` column value). The label column is optional in bubble mode but does not split into multiple datasets in 3.1.c — keep it simple, single dataset.

---

## What to avoid (re-affirms the original prompt)

- **Do not change Phase 2's core `processData` return shape for bar/line/pie.** Bubble gets a sibling function (`processBubbleData`) or an internal branch.
- **Do not change the ChartBuilderState bypass introduced by Phase 2.5** (`_createEnhancedChartDirect`).
- **Do not refactor `graph-builder-charts.js` in-phase** unless it crosses 1600 lines (still at 1521).
- **Do not add radius-role logic to scalar chart types.** Reject at column-manager validation OR warn + ignore at chart generation time.
- **Do not widen scope to 3.2+** (UX polish, transform tools, templates, export).
- **Do not commit proactively.** Await explicit approval each time.
- **Do not undo Phase 2.5 fixes** (`applyYAxisTitle`, `displayFormats`+`autoSkip`, chronological sort, `_createEnhancedChartDirect`).
- **Do not break basic mode.** Test 4 byte-identity is non-negotiable. `_gbEnhanced === undefined` for basic mode.
- **Do not break combo / stacked from 3.1.a/b.** All three regression tests (2/3/4) must pass after 3.1.c, AND Test 7 (combo) plus a stack-series spot-check should still work — re-run them mentally before committing.
- **Do not undo the per-column Chart Type gating from 3.1.b.** The select hides for non-value roles AND when `valueCount < 2`. A bubble column with role `"radius"` must NOT show the select. The `updateAllChartTypeVisibility()` rule must continue to work.
- **Do not add icons inline** — use `icon-library.js` per CLAUDE.md.

---

## Known unresolved items (Phase 3.2 backlog, not in scope here)

- **Data-row overflow at 4+ value columns at ~1200px viewport.** Pre-existing Stage 1 issue, surfaced during 3.1.a testing. The inline `grid-template-columns: 1fr 1fr 1fr 1fr auto` from `graph-builder-row-sync.js` doesn't reserve enough horizontal room for the "Remove" button.
- **Per-column currency symbol selector** (`col.symbol`).
- **Auto-insert thousand separators on numeric input blur.**
- **Preview-table stats text auto-refresh on row change.**
- **`graph-builder-core.js` at 2240 lines** (pre-existing 500-line violation).
- **`graph-builder-enhanced.js` at exactly 500 lines** — any 3.1.c additions here need to absorb compression of the existing code rather than purely adding.

---

## Starting message

When you begin, do **not** dump the whole plan. Instead:

1. Confirm you've re-read: this document, the original Phase 3.1 prompt's section 3.1.c, and the masterplan's Phase 3.1 Implementation Results block (especially "Notes for Phase 3.1.c").
2. Ask the user: "Ready to apply Phase 3.1.c (Bubble — three-dimensional `{x, y, r}` data with new `"radius"` column role)? I'll edit one file at a time per the incremental protocol — column-manager (radius role + bubble compatibility) → data-enhanced (`processBubbleData`) → charts-enhanced (bubble branch in `buildConfig`) → enhanced.js + ui.js (radius role surfaces + Stage 2 gating). Then I'll lead you through Test 8 + regressions 2/3/4 one at a time before asking to commit."

After they confirm, edit files **one at a time, smallest blast radius first**:

1. **column-manager** — add `"radius"` enum, replace bubble compatibility rule
2. **data-enhanced** — `processBubbleData` sibling function (or branch in `processData`)
3. **charts-enhanced** — bubble branch in `buildConfig` (linear scales, point-shape datasets, custom tooltip)
4. **enhanced.js** — `"radius"` in `roleOpts` / `roleLabels` (watch 500-line cap)
5. **ui.js** — extend `refreshAvailability()` to gate the existing Bubble button

After each edit, `node --check` and report line counts. When all edits land, **send Test 8 only** with setup IIFE + click sequence + verification IIFE + expected result. Wait for the user's output. Assess. Confirm visually. Proceed to regression Test 2, then 3, then 4 — one at a time, with confirmation between.

Only after all of 3.1.c's acceptance test (Test 8) + regressions (2/3/4) pass with user confirmation, ask to commit. Commit message prefix: `Phase 3.1.c:`.

After 3.1.c is committed, propose a **final masterplan update commit** extending the existing Phase 3.1 Implementation Results block to cover 3.1.c (completion date, files modified, test results, issues encountered, architecture decisions, notes for Phase 3.2). Commit prefix: `Phase 3.1 docs:`.

**Do not start 3.1.c until the user confirms.**
