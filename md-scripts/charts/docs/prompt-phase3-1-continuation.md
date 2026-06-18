# Claude Code Prompt: Graph Builder Phase 3 Task 3.1 — Continuation (3.1.b + 3.1.c)

**Original prompt:** @md-scripts/charts/docs/prompt-phase3-1.md
**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + logging pattern, 500-line max, WCAG 2.2 AA, British spelling)

---

## State at handoff

**Phase 3.1.a shipped — commit `b3f628b` on `main`.** "Stack series" Stage 3 option for bar/line works; visibility is gated on advanced mode + stackable chart type; stacked line uses `fill: true` for visually obvious stacked-area rendering; all five acceptance tests (5, 6, 5b, gating, plus Phase 2.5 regressions 2/3/4) passed end-to-end with human verification.

Files touched in 3.1.a:

- [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) — `applyStacked()` helper + `applyDatasets` fill flag; 411 → 437 lines
- [md-scripts/charts/graph-builder-core.js](../graph-builder-core.js) — `stackSeries` / `stackSeriesGroup` DOM refs, `stacked` in `getConfigurationOptions()`, new `updateStackSeriesVisibility()` method called from `initializeConfiguration()`; now ~2240 lines (pre-existing 500-line violation, noted and deferred)
- [tools.html](../../../tools.html) — Stage 3 "Stack series" checkbox row (`#gb-stack-series-group` / `#gb-stack-series`), initially hidden

**Still pending: 3.1.b (Combo) and 3.1.c (Bubble).** These are defined in full in the original prompt — sections "Sub-task 3.1.b" and "Sub-task 3.1.c" respectively. Read them before starting.

---

## Working protocol — read carefully

These rules were set by the user during 3.1.a and must continue:

1. **One test at a time.** Never paste multiple acceptance tests into a single message. Send one, wait for results, assess, then send the next.
2. **Lead the user through testing.** For each test, give: the Stage 1 setup IIFE → the click sequence → the Stage 4 verification IIFE → the expected numeric table and visual description.
3. **Assess each result before proceeding.** Read the returned `console.table` output carefully. Don't skip to the next test until you have explicit confirmation (numeric values + visual confirmation).
4. **Keep message bodies short.** The user is on Windows over OneDrive with rendering preferences for compact output. A test message should fit in one screen.
5. **Never give X prompts in one go.** No "here are all the acceptance tests you need to run" bulk messages. One. At. A. Time.
6. **Commit only on explicit approval.** After all acceptance + regression tests pass for a sub-task, ask the user "ready to commit?" and hold until they say yes.
7. **Regression tests after every sub-task.** Phase 2.5 Tests 2/3/4 must pass before commit. The test setup IIFEs are captured in the 3.1.a testing transcript — for convenience:
   - Test 2: 3 cols (`Month`/text-label, `Sales`/currency-value, `Returns`/currency-value), 4 rows Jan/Feb/Mar/Apr, bar chart. Expected: `datasets count: 2`, `y-axis title: "Amount (£)"`, y tick `500 → "£500"`, `x scale type: "category"`, first bar height `1200`.
   - Test 3: 3 cols (`Date`/date-label, `Revenue`/number-value, `Profit`/number-value), 4 rows deliberately out-of-order (Mar/Jan/Apr/Feb 2024), line chart. Expected: `x scale type: "time"`, chronological sort (`first data y: 1000`, `last data y: 1800`), `labels[0] month: 0` (Jan), `labels[0] year: 2024`, `maxTicksLimit: 12`.
   - Test 4: Advanced mode **OFF**, basic 2-column apples=10/oranges=20 bar chart. Expected: `datasets count: 1`, `dataset[0].data: [10,20]`, `y-axis title: "Value"`, `config._gbEnhanced: undefined`, toolbar present under `.chart-controls` (not `.chart-controls-container` — my earlier guess was wrong, selector corrected here).

---

## Sub-task 3.1.b — Combo (bar + line mixed)

**Objective:** In advanced mode, each value column can declare its chart type (`bar` or `line`). The rendered chart combines them: some series as bars, others as lines, on shared axes.

**Files and changes** (per the original prompt):

| File | Change |
|---|---|
| `js/graph-builder-column-manager.js` | Add optional `chartType: "bar" \| "line"` field to value column defs. Default: `undefined` (inherits overall chart type). |
| `js/graph-builder-enhanced.js` | Advanced Column Options: per-value-column `<select>` with `(default)`/`bar`/`line`. Hidden for non-value roles. |
| `js/graph-builder-charts-enhanced.js` | In `buildConfig`, when `chartType === "combo"`: set `config.type = "bar"` (Chart.js combo container), then each `dataset.type` = `col.chartType || "bar"`. |
| `md-scripts/charts/graph-builder-ui.js` + `tools.html` | "Combo (mixed)" chart-type button at Stage 2. Enabled only when ≥2 value columns exist. |

**Acceptance test 7** (full IIFE in the original prompt §3.1.b). Expected at Stage 4:
- `chart.config.type === "bar"` (combo container)
- `dataset[0].type === "bar"`, `dataset[1].type === "line"`
- `datasets count === 2`
- `y-axis title === "Amount (£)"` (Phase 2.5 `applyYAxisTitle` still engages for uniform currency)
- Visually: currency bars for Sales with a line overlay for Target on shared y-axis, £ tick formatter + tooltip.

**Non-goals:** per-series dual y-axis (Phase 4); combo + stacked combined (if user ticks both, prefer combo and log a warning).

**Where to read the Stage 2 chart gallery:** `tools.html` lines ~3920-4160. Each chart option is a `<button class="gb-chart-option" data-chart-type="...">` with a `.gb-chart-title` span. The selection logic lives in `md-scripts/charts/graph-builder-ui.js::ChartTypeSelector` (class starts around line 612). The "enabled only when ≥2 value columns" gate can be enforced in `graph-builder-enhanced.js::getCompatibleChartTypes()` (returns an array of compatible types) — add `"combo"` when `valueCols >= 2`.

**Where to add the per-column `<select>`:** `js/graph-builder-enhanced.js`. The existing column-rendering function iterates the column config and emits name/type/role controls per fieldset. Add the `chartType` select conditionally (`if (col.role === "value")`), with `change` handler that writes through to `columnManager.setColumns(...)` or equivalent (match whatever pattern the existing controls use).

---

## Sub-task 3.1.c — Bubble (x, y, radius)

**Objective:** A chart type where each data point has three dimensions: x position, y position, bubble radius. Graph Builder maps three value columns onto those dimensions. First Phase 3 change to **data shape** — Phase 2's "datasets parallel to a shared labels array" assumption no longer applies.

**Files and changes** (per the original prompt):

| File | Change |
|---|---|
| `js/graph-builder-column-manager.js` | Add `"radius"` to valid role enum. Extend chart-compatibility: bubble requires 2 value cols + 1 radius col (label col optional — becomes dataset grouping). |
| `js/graph-builder-data-enhanced.js` | New `processBubbleData(rawData, columnConfig)` → `{ datasets: [{ label, data: [{x,y,r}, ...], backgroundColor, borderColor }], meta }`. No shared `labels` array. Radius values clamped to `>= 1`; log warning if input was negative. |
| `js/graph-builder-charts-enhanced.js` | Branch `buildConfig(processed, "bubble", options)` → bubble-specific builder: linear x-scale, linear y-scale, tooltip formatter showing `(x, y, r=r)` with column-type-aware formatting. |
| `md-scripts/charts/graph-builder-ui.js` + `tools.html` | "Bubble" chart option at Stage 2. Column-config hint at Stage 1 when bubble is selected: "needs 2 value columns (x, y) + 1 radius column". |

**Acceptance test 8** (full IIFE in original prompt §3.1.c). Expected at Stage 4:
- `chart.config.type === "bubble"`
- `data length === 4`
- `data[0] shape ok === true` (has `x`, `y`, `r` keys)
- Both scales `"linear"`
- Visually: four bubbles at `(Revenue, Growth %)` coordinates, areas proportional to Headcount; negative-growth West row at `y = -3` with radius clamped to `>= 1`.

**Non-goals:** logarithmic bubble axes, negative-radius semantics (red bubbles), animated transitions — all Phase 4.

**Design note — data shape.** For non-bubble charts, `processData` produces `{ labels, datasets: [{data: [nums]}] }`. For bubble, `processBubbleData` produces `{ datasets: [{data: [{x,y,r}]}] }` and no shared `labels`. Route via chart type: in `buildConfigRouted` (`md-scripts/charts/graph-builder-charts.js`) or in `chartsEnhanced.buildConfig`, check `chartType === "bubble"` and call the bubble processor instead. Keep `processData` untouched — per the "Do not change Phase 2's core data pipeline" rule, bubble gets its own sibling function.

---

## What to avoid (same as original prompt, reproduced for convenience)

- Do not change Phase 2's core `processData` return shape for bar/line/pie.
- Do not change the ChartBuilderState bypass introduced by Phase 2.5 (`_createEnhancedChartDirect`).
- Do not refactor `graph-builder-charts.js` in-phase unless it crosses 1600 lines (still at 1521).
- Do not add radius-role logic to scalar chart types — reject at column-manager validation or warn + ignore.
- Do not widen scope to 3.2+ (UX polish, transform tools, templates, export).
- Do not commit proactively. Await explicit approval each time.
- Do not undo Phase 2.5 fixes (`applyYAxisTitle`, `displayFormats`+`autoSkip`, chronological sort, `_createEnhancedChartDirect`).
- Do not break basic mode. Test 4 byte-identity is non-negotiable.
- Do not add icons inline — use `icon-library.js` per CLAUDE.md.

---

## Known unresolved item (for Phase 3.2 backlog, not in scope here)

**Data-row overflow at 4+ columns at ~1200px viewport.** When the user enables advanced mode with 4 value columns, the inline `grid-template-columns: 1fr 1fr 1fr 1fr auto` set by `graph-builder-row-sync.js` doesn't reserve enough horizontal room for the "Remove" button, which clips. Pre-existing Stage 1 issue, not a 3.1 regression. User flagged and agreed to defer to Phase 3.2 UX polish alongside:
- Per-column currency symbol selector (`col.symbol`)
- Auto-insert thousand separators on numeric input blur
- Preview-table stats text auto-refresh on row change

---

## Starting message

When you begin, do **not** dump the whole plan. Instead:

1. Confirm you've re-read: the original prompt (sections 3.1.b and 3.1.c), Phase 2.5 Implementation Results in the masterplan, and this continuation document.
2. Ask the user: "Ready to apply Phase 3.1.b (Combo — mixed bar + line)? I'll do one file at a time per the incremental protocol, then lead you through Test 7 + regressions 2/3/4 one at a time before asking to commit."

After they confirm, edit files **one at a time, smallest blast radius first** (column-manager field addition → enhanced.js column-options UI → chart-enhanced.js combo branch → ui.js/tools.html Stage 2 gallery button). After each edit, `node --check` and report line counts. When all edits land, **send one test** with setup IIFE + click sequence + verification IIFE + expected result. Wait for the user's output. Assess. Proceed to the next test.

Only after all of 3.1.b's acceptance test (Test 7) + regressions (2/3/4) pass with user confirmation, ask to commit. Commit message prefix: `Phase 3.1.b:`.

Then proceed to 3.1.c using the same protocol. Commit prefix: `Phase 3.1.c:`.

After all three sub-tasks are committed, make a **final separate commit** updating [graphbuilder-masterplan.md](./graphbuilder-masterplan.md) with a Phase 3.1 Implementation Results block mirroring the Phase 2.5 block's structure (completion date, files created/modified, test results, issues encountered, architecture decisions, notes for Phase 3.2+). Commit prefix: `Phase 3.1 docs:`.

**Do not start 3.1.b until the user confirms.**
