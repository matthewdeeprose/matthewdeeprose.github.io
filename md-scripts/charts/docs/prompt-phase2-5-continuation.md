# Phase 2.5 Continuation Prompt

**Original prompt:** @md-scripts/charts/docs/prompt-phase2-5.md
**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + logging pattern, 500-line max, WCAG 2.2 AA, British spelling)
**Predecessor commit:** `6cd0a4f` — "Phase 2.5 WIP: bypass ChartBuilderState for advanced-mode final chart"
**Started:** 2026-04-23 (UK), evening session
**Paused because:** user needs to move to a different PC; resume the next day

---

## Where we are

Phase 2.5 core implementation is **in code and committed**, but not all acceptance tests have been re-verified after the final round of fixes. The remaining work is: run three tests, confirm they pass, then write the masterplan's Phase 2.5 Implementation Results block and commit that as a separate commit.

Four fixes landed in `6cd0a4f`:

1. **Bypass ChartBuilderState for advanced mode.** `createUsingChartBuilderState` in `md-scripts/charts/graph-builder-charts.js` now builds the config first. If `config._gbEnhanced === true`, it delegates to a new `_createEnhancedChartDirect(config, options)` helper which does `new Chart(canvas, config)` directly — same pattern as `ChartPreviewManager.update`, which was proven-working. Basic mode falls through to the existing flow unchanged.
2. **Multi-series y-axis title** added to `buildConfig` in `js/graph-builder-charts-enhanced.js` via new `applyYAxisTitle` helper. Uniform currency → `"Amount (£)"`, uniform percentage → `"Percentage (%)"`, mixed/single keep basic scaffold title.
3. **TimeScale year-2001 bug fixed** in `applyXAxisScale`. Removed the `ticks.callback` that did `new Date(value)` on what was actually a pre-formatted string from Chart.js (`"Jan 15"` → V8 defaults to year 2001 → `"15/01/2001"`). Replaced with `displayFormats` so chartjs-adapter-date-fns renders ticks directly. Also added `autoSkip: true` + `maxTicksLimit: 12` to cap x-axis tick density on wide canvases.
4. **Chronological row sort for time axes** in `processData` (`js/graph-builder-data-enhanced.js`). Without it, Chart.js's line chart connects points in data-array order, producing zig-zag lines when entry order is non-chronological (bug that showed "6 lines for 2 series"). Sort runs only when `xAxisType === "time"`; category/text axes keep entry order.

**Verified during the session:**

- Test 2 end-to-end: y-axis shows `£0–£2,500`, tooltip `Sales: £1,200`, y-title `Amount (£)`, legend on, 2 datasets. ✅ (user confirmed via verification IIFE output)
- Test 3 partial: TimeScale engaged (`wa` class), dates show 2024, chronological ticks, y-axis currency. But this was with the year-2001 bug visible (pre-fix #3) and the zig-zag bug visible (pre-fix #4).

**Not yet verified (this is the resumption work):**

- Test 2 after fixes #3 & #4 — should still render identically (date sort doesn't trigger for text labels; displayFormats doesn't trigger for non-time axes). No expected regression, but needs confirmation.
- Test 3 after fixes #3 & #4 — should now show 2024 dates cleanly, two smooth monotonic lines (no zig-zag), ~8–12 x-tick labels.
- Test 4 basic-mode regression — should be byte-identical to pre-2.5 behaviour.

**Architectural decisions captured for the masterplan block:**

- Bypass over plugin. A Chart.js `afterUpdate` plugin was considered (belt-and-braces callback reinstall), but the diagnostic proved direct-construction callbacks survive `update("none")` unchanged — plugin would be dead code. Bypassing ChartBuilderState is the whole fix.
- Bypass does not lose accessibility or toolbar. `ChartBuilderState.applyAccessibilityFeatures` already skips Graph Builder at [chart-builder-state.js:534-541](../chart-builder-state.js#L534-L541). `FinalChartCreator.initializeAccessibilityFeatures` at [graph-builder-charts.js:687-730](../graph-builder-charts.js#L687-L730) runs unconditionally after `createUsingChartBuilderState` and calls `ChartControls.addControlsToContainer` itself. Toolbar + a11y unchanged for both paths.
- `this.buildData.chartConfig` on ChartBuilderState is closure-private — the original prompt's suggestion to "push `scales.x.type = 'time'` into `_state.chartConfig` before `generateChart`" was unreachable without modifying the shared `chart-builder-state.js`. Bypass avoids that.
- File size: `graph-builder-charts.js` went from 1476 → 1521 lines. Still under the 1600 threshold that would make task 2.5.3 refactor mandatory. **2.5.3 deferred to Phase 3** (the pre-existing 500-line violation is not a Phase 2.5 concern).

---

## Resumption checklist

1. **Verify you're on the right commit.**
   ```bash
   git log --oneline -3
   # Expect 6cd0a4f at or near the top
   ```

2. **Sanity-check the three modified files still syntax-valid.**
   ```bash
   node --check js/graph-builder-charts-enhanced.js
   node --check js/graph-builder-data-enhanced.js
   node --check md-scripts/charts/graph-builder-charts.js
   ```
   All three should print nothing (clean exit). If `node --check` isn't available, that's fine — the browser is the final check.

3. **Run the three acceptance tests** (next section). Between each test: hard refresh `tools.html` in the browser, navigate to Graph Builder mode.

4. **If all three pass**, update the masterplan as described in the "After tests pass" section below, commit that, and Phase 2.5 is complete.

5. **If any test fails**, paste the console output + screenshot and diagnose. The most likely culprits are:
   - Fix #4 (chronological sort) regressing something for single-series line charts with date labels.
   - Fix #3's `displayFormats` rendering dates in an unexpected format for very short ranges (seconds/minutes) or very long ranges (decades).
   - Fix #1's bypass missing some post-generation hook that basic mode relies on (notable candidate: `applyGraphBuilderSizing` at [graph-builder-charts.js:704](../graph-builder-charts.js#L704) runs inside `initializeAccessibilityFeatures`, so it should still apply — but worth spot-checking that the advanced-mode chart sizes correctly on wide viewports).

---

## Test setup IIFEs (paste into DevTools console)

These populate the Graph Builder form programmatically so you don't have to type in data each time.

### Test 2 — advanced currency multi-series bar

Hard refresh `tools.html`, switch to **Graph Builder** mode, then paste:

```javascript
// ---- Test 2 setup: 3 cols (Month, Sales £, Returns £) × 4 rows ----
(async () => {
  const GBE = window.GraphBuilderEnhanced;
  const GBRS = window.GraphBuilderRowSync;
  if (!GBE || !GBRS) { console.error("Enhanced / RowSync modules not loaded"); return; }

  const cb = document.getElementById("gb-advanced-checkbox");
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }

  GBE.setColumnConfiguration([
    { name: "Month",   type: "text",     role: "label" },
    { name: "Sales",   type: "currency", role: "value" },
    { name: "Returns", type: "currency", role: "value" },
  ], true);
  GBRS.onColumnsChanged(GBE.getColumnConfiguration());

  const container = document.getElementById("gb-data-rows");
  while (container.querySelectorAll(".gb-data-row").length < 4) GBRS.addEnhancedRow();

  const data = [
    ["Jan", "£1,200",    "£100"],
    ["Feb", "£1,500",    "£50"],
    ["Mar", "£1,800.50", "£75"],
    ["Apr", "£2,400",    "£200"],
  ];
  const rows = container.querySelectorAll(".gb-data-row");
  data.forEach((row, r) => {
    const inputs = rows[r].querySelectorAll("input");
    row.forEach((val, c) => {
      inputs[c].value = val;
      inputs[c].dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  console.log("Test 2 populated. Rows:", rows.length,
              "— now click Next → Bar → Next → Generate.");
})();
```

Then click **Next: Choose Chart Type → Bar → Next: Configure Chart → Generate Chart**. At Stage 4 paste:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  console.table({
    "y-axis title.text":       chart.options.scales.y.title?.text,
    "y.ticks.callback(1500)":  chart.options.scales.y.ticks.callback(1500),
    "legend.display":          chart.options.plugins.legend.display,
    "datasets count":          chart.data.datasets.length,
    "x scale class":           chart.scales.x.constructor.name,
    "tooltip label source":    chart.options.plugins.tooltip.callbacks.label.toString().slice(0, 50),
  });
})();
```

**Expected:**
- `y-axis title.text === "Amount (£)"`
- `y.ticks.callback(1500) === "£1,500"`
- `legend.display === true`
- `datasets count === 2`
- `x scale class === "ta"` (CategoryScale — correct for Month text labels)
- `tooltip label source` contains `"dsType"` (ours, not `"label(t)"` Chart.js default)

**Visual expectations:**
- Y-axis ticks: `£0, £500, £1,000, £1,500, £2,000, £2,500`
- Y-axis title: `Amount (£)` (not `Sales`)
- Legend: `Sales` (yellow/blue), `Returns` (green/pink)
- Bars grouped per month, 2 bars per month
- Hovering a bar: tooltip shows `Sales: £1,200` (or similar with £ prefix)

---

### Test 3 — advanced date-axis line

Hard refresh, navigate to Graph Builder, paste:

```javascript
// ---- Test 3 setup: 3 cols (Date, Sales £, Returns £) × 4 rows NON-chronological ----
(async () => {
  const GBE = window.GraphBuilderEnhanced;
  const GBRS = window.GraphBuilderRowSync;
  if (!GBE || !GBRS) { console.error("Enhanced / RowSync modules not loaded"); return; }

  const cb = document.getElementById("gb-advanced-checkbox");
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }

  GBE.setColumnConfiguration([
    { name: "Date",    type: "date",     role: "label" },
    { name: "Sales",   type: "currency", role: "value" },
    { name: "Returns", type: "currency", role: "value" },
  ], true);
  GBRS.onColumnsChanged(GBE.getColumnConfiguration());

  const container = document.getElementById("gb-data-rows");
  while (container.querySelectorAll(".gb-data-row").length < 4) GBRS.addEnhancedRow();

  // Deliberately non-chronological so we can verify chronological sort works.
  const data = [
    ["2024-03-15", "£1,800.50", "£75"],
    ["2024-01-15", "£1,200",    "£100"],
    ["2024-04-15", "£2,400",    "£200"],
    ["2024-02-15", "£1,500",    "£50"],
  ];
  const rows = container.querySelectorAll(".gb-data-row");
  data.forEach((row, r) => {
    const inputs = rows[r].querySelectorAll("input");
    row.forEach((val, c) => {
      inputs[c].value = val;
      inputs[c].dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  console.log("Test 3 populated (dates NON-chronological on purpose). Rows:", rows.length,
              "— now click Next → Line → Next → Generate.");
})();
```

Click **Next → Line → Next → Generate Chart**. Paste the same verification IIFE from Test 2.

**Expected:**
- `y-axis title.text === "Amount (£)"`
- `y.ticks.callback(1500) === "£1,500"`
- `datasets count === 2`
- `x scale class === "wa"` (TimeScale)

**Visual expectations** (this is the one to pay close attention to — fixes #3 and #4 haven't been re-verified):
- X-axis tick labels: around 8–12 labels spanning `15 Jan 2024 … 15 Apr 2024` (not 45+ at 2-day intervals; not year 2001)
- Two **smooth, monotonic** lines going left-to-right:
  - Sales (primary colour) rising from ~£1,200 at Jan 15 → ~£2,400 at Apr 15
  - Returns (secondary colour) roughly flat near £50–£200
- NO zig-zagging across the chart. Each series should be a single clean polyline.
- 4 data points visible on each line (Jan/Feb/Mar/Apr).

**If x-axis still shows year 2001 or zig-zag lines appear**, something in fixes #3 or #4 didn't land correctly — paste the date-diagnostic IIFE from the previous session (it's in commit history; or reconstruct from: probe `chart.data.labels`, `chart.scales.x.min/max`, and the tick callback behaviour).

---

### Test 4 — basic mode regression

Hard refresh. **Do NOT tick Advanced Column Options.** Stay in basic 2-column mode. Enter any simple data, e.g. in the 2 default rows:
- `Apple`, `10`
- `Banana`, `20`

Click **Next → Bar → Next → Generate**. Paste:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  console.table({
    "final constructor x":        chart.scales.x.constructor.name,
    "final constructor y":        chart.scales.y.constructor.name,
    "datasets count":             chart.data.datasets.length,
    "y-axis title":               chart.options.scales.y.title?.text || "(none)",
    "legend.display":             chart.options.plugins.legend.display,
    "container has .chart-controls": !!chart.canvas.parentElement.querySelector(".chart-controls"),
  });
})();
```

**Expected:**
- `datasets count === 1` (single series)
- Chart went through the ChartBuilderState path (`_gbEnhanced` is undefined for basic mode)
- `.chart-controls` toolbar present (palette selector, copy button)
- Bar chart renders with Apple and Banana bars at heights 10 and 20
- No visual regression from Phase 2 basic-mode behaviour

If any of this differs from pre-2.5 basic-mode behaviour, that's a blocker — fix #1's early branch should only fire for `_gbEnhanced === true`. Verify by spot-checking `createUsingChartBuilderState` in `graph-builder-charts.js` still has `if (config && config._gbEnhanced)` and nothing else skipped for basic mode.

---

## After all three tests pass

### Step 1: Update the masterplan

Edit `md-scripts/charts/docs/graphbuilder-masterplan.md`:

1. **Phase Overview table** (top): flip the **2.5** row's Status from `Pending` to `Complete`.
2. **Project Status Dashboard**: update
   - `Completed Phases: 2` → `Completed Phases: 3` (counting 2.5 as a completion milestone)
   - `Current Phase: Phase 2 complete with deferred 2.5; Phase 2.5 pending` → `Phase 2.5 complete; Phase 3 pending`
   - `Overall Completion: 50%` → `Overall Completion: 60%`
3. **Add a "Phase 2.5 Implementation Results" block** under the `# PHASE 2.5: ChartBuilderState / Chart.js Formatter Integration` heading, modelled on Phase 2's block. Contents should include:
   - Completion Date: **(date of test pass)**
   - Files Modified table (3 files: `js/graph-builder-charts-enhanced.js`, `js/graph-builder-data-enhanced.js`, `md-scripts/charts/graph-builder-charts.js`)
   - Test Results (Test 2 / Test 3 / Test 4 status)
   - Issues Encountered:
     1. *Chart.js 4 Proxy.numeric substitution confirmed.* Diagnostic output: `cb.toString()` literally matched `numeric(t,e,i){...}` on the final chart but `OURS (£ formatter)` on the preview. Chart.js's proxy wraps the options object; all four read paths (`options`, `config.options`, `_config.options`, `scales.y.options`) point to the same substituted function.
     2. *ChartBuilderState rebuilds config from scratch.* `updateChartConfig(config)` delegates to `ChartDataManager.getChartConfig(dataModelId, customOptions)` which invokes an internal config generator. Function callbacks don't survive; neither do `scales.x.type = "time"` overrides.
     3. *`ChartBuilderState._state` is closure-private.* The original prompt's plan — "push `scales.x.type = 'time'` into `_state.chartConfig.scales.x.type` before generateChart runs" — was unreachable without modifying the shared `chart-builder-state.js`.
     4. *Phase 2's applyEnhancedOverrides was correct but misplaced.* Diagnostic proved writing `callback` + `update("none")` does make the render use ours; but something later in Chart.js's own update cycle reset the reference. Bypass avoids the whole fragile sequence.
     5. *TimeScale tick callback re-parsed strings → year 2001 bug.* Chart.js's TimeScale pre-formats ticks via the adapter, then passes the formatted string (e.g. `"Jan 15"`) to the callback. Our callback re-parsed via `new Date(value)` — V8 defaults the year to 2001 on string dates without a year. `displayFormats` is the correct API to configure tick rendering; a callback on a time axis is almost always wrong.
     6. *Line-chart data order matters independently of TimeScale.* Chart.js draws polyline segments in data-array order regardless of x-scale positioning. TimeScale sorts tick *positions* chronologically, but the line still zig-zags if data order is non-chronological. Row sort in the processor is necessary.
     7. *Bypass does not lose accessibility or toolbar.* ChartBuilderState already skips `applyAccessibilityFeatures` for GB containers (id starts with `gb-final-chart`), and `FinalChartCreator.initializeAccessibilityFeatures` runs unconditionally after `createUsingChartBuilderState` and handles ChartControls + ChartAccessibility for both paths.
   - Architecture Decisions:
     - **Bypass over plugin.** Diagnostic Q2 proved direct-construction callbacks survive `update()` unchanged — a Chart.js `afterUpdate` plugin would be dead code for a problem that doesn't recur once the construction path is right.
     - **Row sort in processor, not in chart generator.** The sort is a data-shape concern (polyline ordering) not a Chart.js-configuration concern, so it belongs in `processData`. Skipped for non-time axes to preserve entry order for Q1/Q2/Q3/Q4-style category labels.
     - **`displayFormats` over `ticks.callback` for time axes.** Chart.js's documented mechanism for time-tick labels; avoids the string-reparse class of bug entirely.
   - Notes for Phase 3:
     - Task 2.5.3 (refactor `graph-builder-charts.js` from 1521 lines) **deferred to Phase 3**. File remains under the 1600-line "mandatory refactor" threshold the prompt defined. Pre-existing 500-line CLAUDE.md violation carried forward (same status as before 2.5).
     - UX polish from Phase 2 still on the Phase 3 backlog: per-column currency symbol selector, auto-insert thousand separators on blur, preview-stats refresh on row change.
4. **Update the document header:** `Document Version: 2.3`, `Last Updated: <date of test pass>`, `Status: Phase 2.5 Complete — ChartBuilderState bypass + TimeScale polish shipped`, `Next Action: Begin Phase 3 Task 3.1 (advanced chart types — stacked / bubble / combo)`.

### Step 2: Commit the masterplan update

Commit message format (match existing style):
```
Phase 2.5: record implementation results in masterplan
```

Body should briefly note the four fixes landed and the date. Do NOT squash into the code commit — keep them separate per the Phase 2.5 prompt's "Commit as a small separate commit" instruction.

### Step 3: Verify `git log` and tell the user

```bash
git log --oneline -5
```

Expected:
```
<new>    Phase 2.5: record implementation results in masterplan
6cd0a4f  Phase 2.5 WIP: bypass ChartBuilderState for advanced-mode final chart
2eb6401  Phase 11-1c: record commit hash in masterplan
2e77303  Phase 11-1c: N-post10-7 — collapse helper threaded through SHORT tier
5bd9f9b  Phase 2.5 implementation prompt
```

Then tell the user Phase 2.5 is complete and Phase 3 is next.

---

## Things to watch out for

- **OneDrive sync flakiness** (CLAUDE.md "OneDrive caveat"). Do a throwaway write/edit/delete before starting, especially if this is the first work on the new PC. If `node --check` fails with stale-content or file-not-found, retry once.
- **CLAUDE.md's Graph Builder CRITICAL LOAD ORDER.** All three modified files are in the "enhanced" set that loads after the 6 core files. If the browser console shows `GraphBuilderDataEnhanced is undefined` at page load, tools.html script-tag order is wrong — but nothing in this patch should have touched that.
- **British spelling.** All new code uses `colour`, `initialise`, `behaviour` in identifiers and comments. Preserve on masterplan edits.
- **No commits until human approves each test.** The original prompt's instruction. `6cd0a4f` was committed by explicit user request at end-of-day despite Test 2/3/4 not being fully re-verified — the WIP status is reflected in the commit message's "Status" section. After the resumption tests pass, the masterplan commit is the "confirmed" landing.
- **Do not run the ultrareview tool.** Not needed here and it's user-triggered anyway.

---

## Reference — the four diffs you already have (commit `6cd0a4f`)

For quick recall without re-reading the full files:

### `md-scripts/charts/graph-builder-charts.js`

- `createUsingChartBuilderState` (around line 510) — builds `config` via `buildConfigRouted` FIRST, then branches `if (config && config._gbEnhanced) return this._createEnhancedChartDirect(config, options);` before any ChartBuilderState call. Deleted the old second `const config = buildConfigRouted(...)` inside the function body (it was duplicate after hoisting).
- New method `_createEnhancedChartDirect(config, options)` (around line 705) — creates a canvas inside `this.container`, sets ARIA attributes, `new Chart(canvas, config)`, sets `chartRegistry.final`, logs.

### `js/graph-builder-charts-enhanced.js`

- `applyXAxisScale` (around line 138) — replaced `ticks.callback` assignment with `displayFormats` config and `autoSkip`+`maxTicksLimit: 12` on `scales.x.ticks`.
- New `applyYAxisTitle(config, processedData)` (around line 185) — sets `scales.y.title.text` for multi-series uniform-currency/percentage.
- `buildConfig` — added `applyYAxisTitle(config, processedData)` to the scale-bearing branch after `applyYAxisFormatter`.

### `js/graph-builder-data-enhanced.js`

- `processData` (around line 231) — hoisted `xAxisType` calc before row processing, then `orderedRows = rows.slice().sort(...)` when `xAxisType === "time"`, sorting by parsed date. `labels` and `datasets` now iterate `orderedRows` instead of `rows`.

---

## Starting message to use when resuming

When you resume, a reasonable opening message to Claude Code would be:

> Continuing Phase 2.5 from commit `6cd0a4f`. Please read @md-scripts/charts/docs/prompt-phase2-5-continuation.md and guide me through running Test 2, Test 3, and Test 4 (the setup IIFEs are in that prompt). After all three pass, help me write the masterplan's Phase 2.5 Implementation Results block and commit it separately.

That gives Claude full context and the test-running loop starts immediately.
