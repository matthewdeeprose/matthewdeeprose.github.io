# Claude Code Prompt: Graph Builder Phase 2.5 — Formatter Integration & TimeScale

**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md
**Phase 2 implementation record:** Inside the masterplan under "Phase 2 Implementation Results" (commit `c7935e8`)
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + logging pattern, 500-line max, WCAG 2.2 AA, British spelling)
**Predecessor:** Phase 2 shipped 2026-04-23 with multi-series rendering working end-to-end. Four Phase 1 integration gaps were patched along the way (sub-step 2.3a). Formatter polish + TimeScale were explicitly deferred to this phase — do not treat Phase 2's "issues encountered" as open bugs; treat them as the brief.

---

## What Phase 2.5 delivers

Phase 2 shipped multi-series rendering: data flows correctly from column configuration through `GraphBuilderDataEnhanced.processData` and `GraphBuilderChartsEnhanced.buildConfig` into Chart.js, producing charts with the right datasets, colours, legend, and series labels. The remaining gap is purely cosmetic:

| What works | What's broken |
|---|---|
| Multi-series bar/line rendering | Y-axis ticks show `2,500` instead of `£2,500` |
| Series-distinct colours | Tooltips show `Sales: 1200` instead of `Sales: £1,200` |
| Multi-series legend | Y-axis title shows first column name instead of `Amount (£)` |
| Basic-mode regression (byte-identical) | Date-labelled line charts use CategoryScale in entry order, not TimeScale in chronological order |
| Preview multi-series render | Preview y-axis has same formatter loss |
| Preview auto-refresh on row add | — |

**Root cause (confirmed 2026-04-23):** `new Chart(ctx, config)` in Chart.js 4 creates a Proxy-wrapped internal config that (a) drops non-standard top-level properties like our `_gbEnhanced` marker, and (b) replaces user tick callbacks with Chart.js's default `Proxy.numeric` formatter on numeric scales. ChartBuilderState also strips `scales.x.type = "time"` before `new Chart()` runs, because it rebuilds its config from internal state. Attempting to set `scales.x.type` on a live Chart instance causes a Chart.js proxy-setter recursion loop (`Object.set → Object.set → ...`), crashing `FinalChartCreator`'s post-generation override block.

Phase 2's post-generation `applyEnhancedOverrides` helper was the right idea at the wrong lifecycle point — Chart.js 4 keeps re-reading defaults after `chart.update()`, so our changes don't persist.

## Three tasks

| Task | Scope | Files |
|------|-------|-------|
| 2.5.1 | Persistent tick/tooltip callbacks surviving `chart.update()` | MODIFY `js/graph-builder-charts-enhanced.js`; maybe `md-scripts/charts/graph-builder-charts.js` |
| 2.5.2 | TimeScale for date-labelled charts without proxy recursion | MODIFY `js/graph-builder-charts-enhanced.js`; possibly ChartBuilderState bridging |
| 2.5.3 | Optional: refactor `graph-builder-charts.js` (1476 lines) to resolve pre-existing 500-line violation | SPLIT `md-scripts/charts/graph-builder-charts.js` |

**Out of scope:** Phase 3 UX (currency symbol selector, thousand-separator auto-insert, preview-stats refresh), stacked/bubble/combo charts, aggregation/pivot. Keep Phase 2.5 strictly to formatter persistence + TimeScale.

---

## Why this is investigative, not feature-building

Tasks 2.5.1 and 2.5.2 don't know their shape until you've probed Chart.js 4's actual behaviour with the current codebase. The *proposed* approaches below are starting points — validate before implementing. Acceptance is behavioural (the chart renders with `£` prefixes and dates in chronological order), not structural.

**Recommended execution shape:**

- **Start with diagnostics.** Re-create Phase 2's Test 2 (advanced currency multi-series bar) and Test 3 (advanced date-axis line) manually. Capture what `chart.config.options.scales.y.ticks.callback`, `chart.options.scales.y.ticks.callback`, and `chart.scales.y.options.ticks.callback` each contain immediately after `new Chart()` — they may differ. Only then decide where to hook.
- **Probably one commit per task**, but if 2.5.1 reveals an approach that incidentally fixes 2.5.2, one combined commit is fine — document the scope in the commit body.
- **Hold 2.5.3** (the refactor) until 2.5.1 + 2.5.2 are done and you have a clear picture of the module boundaries. A pre-refactor measurement and a post-refactor measurement gives a clean PR narrative.
- Follow CLAUDE.md's **"Incremental Development Protocol — one file per iteration"**.
- Run `node --check` after every edit. Provide single-IIFE `console.table()` test blocks between steps (see CLAUDE.md § "Console Testing").

---

## Before you start — read these in order

1. **[graphbuilder-masterplan.md "Phase 2 Implementation Results"](./graphbuilder-masterplan.md)** — the 8 numbered "Issues Encountered" items are your briefing document, especially #5 (Chart.js 4 strips config) and #6 (ChartBuilderState strips scales.x.type). "Architecture Decisions" explains the delegation-vs-duplication rationale you must preserve. "Notes for Phase 2.5" contains the proposed approach list.
2. **[js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) in full** — 368 lines. The `buildConfig` function is correct; `applyEnhancedOverrides` works for legend display (primitive boolean survives) but fails for tick callbacks (Chart.js replaces them). The commented-out block where `opts.scales.x.type = "time"` used to live is the proxy-recursion site.
3. **[md-scripts/charts/graph-builder-charts.js](../graph-builder-charts.js)** — specifically:
   - **lines ~525–660** — `FinalChartCreator.createUsingChartBuilderState`: three-stage config rewrite (Strategy A `updateChartConfig`, Strategy B internal state mutation, post-generation override on live instance). Your applyEnhancedOverrides hook is at line 649-654.
   - **lines ~290–350** — `ChartPreviewManager.update`: bypasses ChartBuilderState entirely, calls `new Chart(canvas, config)` directly at line 339. Same formatter-loss symptom, so the fix likely isn't ChartBuilderState-specific.
   - **`buildConfigRouted`** near the end of the IIFE, added in 2.3. The router itself is fine — don't change it; change what it returns or what the post-gen hook does.
4. **Chart.js 4 behaviour evidence** collected during Phase 2's end-to-end testing:
   - `chart.config._gbEnhanced === undefined` on both preview and final charts (marker stripped).
   - `chart.options.scales.y.ticks.callback` is a function, but calling it bare throws "Cannot read properties of undefined (reading 'chart')" → it's `Proxy.numeric`, Chart.js's default, not ours.
   - Setting `chart.options.scales.x.type = "time"` on a live instance triggers infinite `Object.set` recursion in `chart.min.js:13`. Do not re-attempt this path.
   - `chartjs-adapter-date-fns@3.0.0` IS loaded (verified via `GraphBuilderChartsEnhanced.hasDateAdapter()` returning `true`).
5. **CLAUDE.md** § "Graph Builder — CRITICAL LOAD ORDER" (confirm current order still holds) and § "Incremental Development Protocol".

**Do not** re-read Phase 1's implementation bible or Phase 2.1 / 2.2 source files cover-to-cover. The data processor and config builder are correct in isolation (their 2.1 / 2.2 isolation tests passed). The problem is the Chart.js render lifecycle.

---

## Context (diagnosis in one paragraph each)

**Task 2.5.1 — why tick callbacks vanish.** Chart.js 4's `new Chart(ctx, config)` processes the config internally: it deep-clones, sets up Proxy wrappers for reactive updates, and for numeric scales substitutes its own `Ticks.formatters.numeric` as the default callback if it decides the user's callback is "missing" or if one of its internal init paths runs after config absorption. Our `buildConfig` sets `config.options.scales.y.ticks.callback = function(v) { return formatter(v); }` — demonstrably a function, demonstrably correct in isolation test. Yet after `new Chart()` the live `chart.options.scales.y.ticks.callback` is Chart.js's default. This is not a ChartBuilderState issue (the preview path bypasses ChartBuilderState and shows the same symptom). The fix candidates (try in order — go no further than the first one that works):

1. **Chart.js plugin with `beforeUpdate` / `afterLayout` hook** that reinstalls our callbacks on every update. The plugin receives `chart` and can set `chart.scales.y.options.ticks.callback` before the renderer reads it. Plugins persist across `update()`.
2. **Mutate `chart.config._config` directly** (the "raw" config before proxy wrapping) then call `chart.update("resize")` which triggers scale rebuilding. Chart.js 4 has started exposing `_config` for cases like ours.
3. **Replace `chart.options.scales.y.ticks` as a whole object** instead of mutating a property — some Chart.js proxies intercept property setters but not whole-object reassignments.
4. **Bypass the default numeric formatter substitution** by setting the scale's internal `_ticksLength`/`_cache` to force rebuild with our callback (last resort — most fragile).

Validate whichever approach works for ticks works for `plugins.tooltip.callbacks.label` too (tooltips share the same proxy-wrapping concern).

**Task 2.5.2 — why TimeScale doesn't engage.** `scales.x.type = "time"` is a string, a primitive — it should survive JSON serialisation. Yet by the time `new Chart()` is called on the final-chart path, that property isn't in the config. Either (a) `ChartBuilderState.updateChartConfig(config.options)` discards properties it doesn't know about, or (b) `generateChart` rebuilds a fresh config from `_state.chartConfig` and ignores our options. Inspect `ChartBuilderState._state.chartConfig.scales?.x?.type` immediately before `generateChart` runs — if it's not `"time"`, Strategy A is stripping it. If it is `"time"`, `generateChart` is ignoring it. Either way, the fix is to push `scales.x.type = "time"` directly into `ChartBuilderState._state.chartConfig.scales.x.type` before `generateChart` runs — that bypasses whatever stripped it. Do **not** attempt to set it post-construction; that's the proxy recursion. For the preview path (no ChartBuilderState involved), diagnose separately — the preview calls `new Chart(canvas, config)` directly with our config including `scales.x.type = "time"`, and yet Test 3's preview also showed CategoryScale. Possibly Chart.js 4 needs the adapter registered a specific way, or the preview config's spread at line 329-336 loses the scale config (check whether that shallow spread preserves nested `scales.x.type`).

**Task 2.5.3 — when to refactor the 1476-line file.** `graph-builder-charts.js` was ~1414 lines before Phase 2 and is now 1476. The 500-line CLAUDE.md limit is a pre-existing violation. During 2.5.1 / 2.5.2 you'll be reading large swaths of this file; after the fixes, you'll have a clear view of which chunks are cohesive. Candidate splits: `ChartConfigBuilder` (~200 lines) → `graph-builder-charts-builder.js`; `ChartPreviewManager` + `FinalChartCreator` (~400 lines each) → `graph-builder-charts-preview.js` + `graph-builder-charts-final.js`; `ChartValidator` → `graph-builder-charts-validator.js`; keep the public API and `buildConfigRouted` in the main file. This is a judgement call — if 2.5.1 / 2.5.2 fixes turn out trivial (e.g. one Chart.js plugin does it all), the refactor might not be needed. If the fixes require touching several large classes, bundle the refactor with them.

---

## Execution shape

### Step 0 — Diagnostic baseline (20 minutes, no code)

In browser console with Phase 2 state (advanced mode, 3 cols, 4 rows of Test 2 currency data rendered):

```javascript
(() => {
  const preview = window.GraphBuilderCharts?.getChartRegistry?.()?.preview;
  const final = window.GraphBuilderCharts?.getChartRegistry?.()?.final;

  const probe = (chart, label) => {
    if (!chart) { console.log(label + ": no chart"); return; }
    const o = chart.options;
    const cOpts = chart.config?.options;
    const cRaw = chart.config?._config;  // Chart.js 4 raw config (may not exist)
    const sY = chart.scales?.y;

    console.group(label);
    console.log("chart.options.scales.y.ticks.callback ===", typeof o?.scales?.y?.ticks?.callback);
    console.log("chart.config.options.scales.y.ticks.callback ===", typeof cOpts?.scales?.y?.ticks?.callback);
    console.log("chart.config._config?.options.scales.y.ticks.callback ===", typeof cRaw?.options?.scales?.y?.ticks?.callback);
    console.log("chart.scales.y.options.ticks.callback ===", typeof sY?.options?.ticks?.callback);
    console.log("chart.scales.y.constructor.name:", sY?.constructor?.name);
    console.log("chart.options.scales.x.type:", o?.scales?.x?.type);
    console.log("chart.config.options.scales.x.type:", cOpts?.scales?.x?.type);
    console.groupEnd();
  };

  probe(preview, "=== PREVIEW ===");
  probe(final, "=== FINAL ===");
  console.log("ChartBuilderState._state.chartConfig?", window.ChartBuilderState?._state?.chartConfig);
})();
```

Repeat with Test 3 state (date-labelled data, line chart rendered). Record what each probe shows. This answers the Task 2.5.2 "is it Strategy A or generateChart stripping time type" question and tells you which write path in Task 2.5.1 might work.

### Step 1 — Task 2.5.1: formatter persistence

Probably a Chart.js plugin. Rough shape:

```javascript
const EnhancedFormattersPlugin = {
  id: "gbEnhancedFormatters",
  beforeUpdate(chart) {
    const processed = chart.$gbProcessed;  // stored at construction time
    if (!processed) return;
    // Apply tick callbacks, tooltip callbacks, title overrides
    // that survive this and all subsequent updates.
  },
};
```

Register via `Chart.register(EnhancedFormattersPlugin)` once at module load. Attach the processed-data reference to the chart instance at construction: `chart.$gbProcessed = processed` (via `config.plugins.gbEnhancedFormatters = { processed }` or a direct assignment in the builder). Plugin reads it on every update.

Test on both preview and final paths. Target: `chart.options.scales.y.ticks.callback(1500)` returns `"£1,500"` at any point after render, and the y-axis visually shows `£0, £500, £1,000, £1,500, £2,000, £2,500`.

### Step 2 — Task 2.5.2: TimeScale

Based on Step 0's diagnosis:
- If `ChartBuilderState._state.chartConfig.scales.x.type` is NOT `"time"` after Strategy A: add a Strategy A+ that pushes `scales.x.type = "time"` and `scales.x.time = { tooltipFormat: "PP" }` directly into `_state.chartConfig.scales.x` before `generateChart` runs. This must happen inside `createUsingChartBuilderState`, between lines ~582 and ~598.
- For the preview path: if `new Chart(canvas, config)` with `config.options.scales.x.type = "time"` already sets up a TimeScale correctly (check Step 0 diagnosis of preview), no further action. If not, investigate the shallow spread at lines 329-336 — `config.options = { ...config.options, ... }` may be shallow-copying away our `scales.x.time` config. Test by building the preview config without that spread.

Target: Test 3 re-run shows x-axis in chronological order with date-formatted labels regardless of row entry order.

### Step 3 — Task 2.5.3: refactor (conditional)

Only if the file grew during 2.5.1 / 2.5.2 OR if the fixes touched several large classes anyway. Split candidates above. Mandatory if `graph-builder-charts.js` exceeds 1600 lines after 2.5.1 / 2.5.2 edits. Optional otherwise (the pre-existing violation can be carried into Phase 3).

### Step 4 — Re-run Phase 2 acceptance tests

End-to-end:

1. **Test 2 re-run** (advanced currency multi-series bar):
   - `£0, £500, £1,000, £1,500, £2,000, £2,500` on y-axis
   - Tooltip: `Sales: £1,200` / `Returns: £100`
   - Y-axis title: `Amount (£)`
2. **Test 3 re-run** (advanced date-axis line):
   - X-axis chronological (Jan → Feb → Mar → Apr) regardless of entry order
   - X-axis tick labels formatted via date adapter
   - Two lines still render with distinct colours
3. **Test 4 regression** (basic mode):
   - Byte-identical to Phase 2's Test 4 result (no change)

Human confirmation required for all three. No commits held until human signs off.

### Step 5 — Update the masterplan

1. Flip Phase 2.5 row: `Pending` → `Complete` in the Phase Overview table.
2. Dashboard Completed Phases 2 → 3 (counting 2.5 as a completion milestone); Overall Completion 50% → 60%.
3. Add a "Phase 2.5 Implementation Results" block under the Phase 2.5 heading modelled on Phase 2's block.
4. Update "Document Version" and "Last Updated".
5. Update "Next Action" to Phase 3 Task 3.1 (stacked/bubble/combo charts).

Commit as a small separate commit: `Phase 2.5: record implementation results in masterplan`.

---

## Acceptance criteria

**Per task:**

- [ ] **2.5.1** — Tick and tooltip callbacks persist across `chart.update()` on both preview and final paths. Test 2 re-run passes.
- [ ] **2.5.2** — TimeScale engages for date-labelled charts. Test 3 re-run passes with chronological ordering.
- [ ] **2.5.3** — Either complete with split file sizes all under 500 lines, or documented decision to carry forward with pre-existing violation.

**Overall:**

- [ ] `node --check` passes on all touched files after every edit.
- [ ] No new file exceeds 500 lines.
- [ ] Basic-mode regression (Test 4) still byte-identical.
- [ ] WCAG 2.2 AA unchanged (run axe-core on a rendered advanced-mode chart).
- [ ] All sub-step 2.3a Phase 1 fixes still work: currency inputs accept `£`, advanced-mode nav gate passes, added rows participate in validation.
- [ ] One commit per task (with combination allowed per the execution shape notes).
- [ ] Masterplan updated in a final small commit.
- [ ] All code commits held until human approves each acceptance test.

---

## What to avoid

- **Do not attempt to set `chart.options.scales.x.type = "time"` on a live Chart.js instance.** It causes infinite `Object.set` recursion (`chart.min.js:13:17268 ↔ 13:18528`). That proof is in Phase 2's Test 3 console log. The fix must happen pre-construction.
- **Do not refactor the basic-mode path.** `ChartConfigBuilder` is Phase 1 production code. Wrap, don't modify.
- **Do not rewrite `GraphBuilderDataEnhanced.processData` or `GraphBuilderChartsEnhanced.buildConfig`.** Their 2.1 / 2.2 isolation tests passed; the problem is downstream. Read-only reference.
- **Do not re-introduce the `_gbEnhanced` marker on `chart.config`** — Chart.js strips it. If the plugin approach needs a marker, use `chart.$gbProcessed` (instance property, outside config).
- **Do not break Test 4 (basic regression).** Phase 1 users must see zero behavioural change. If any fix in 2.5.1 / 2.5.2 affects basic-mode rendering, gate it on `config._gbEnhanced` or an equivalent advanced-mode signal.
- **Do not commit proactively.** Hold each task commit until (a) `node --check` passes, (b) human confirms the relevant acceptance test.
- **Do not undo the sub-step 2.3a Phase 1 fixes.** Currency inputs use `type="text" inputmode="decimal"`, validator strips symbols, row-sync writes `_state.chartData`, and `addEnhancedRow` attaches listeners. All four are load-bearing for advanced-mode end-to-end flow.
- **Do not add a date adapter CDN** — `chartjs-adapter-date-fns@3.0.0` is already loaded (tools.html line ~16160). Verify via `GraphBuilderChartsEnhanced.hasDateAdapter()` returning `true`.
- **Do not widen scope to Phase 3.** UX additions (currency symbol selector, thousand-separator auto-insert, preview-stats refresh) are Phase 3 backlog. Stacked/bubble/combo charts are Phase 3. Keep Phase 2.5 strictly to formatter persistence + TimeScale (+ optional refactor).
- **Do not skip Step 0 diagnostics.** The proposed approaches in "Context" are starting points, not guarantees. Step 0's probe output tells you which approach is feasible for *this* Chart.js version + *this* ChartBuilderState integration. Without it, you're guessing.

---

## Starting question

When you begin the conversation, confirm you've read:

1. [graphbuilder-masterplan.md](./graphbuilder-masterplan.md)'s Phase 2 Implementation Results block — especially the 8 "Issues Encountered" items.
2. [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js) in full (368 lines).
3. [md-scripts/charts/graph-builder-charts.js](../graph-builder-charts.js) lines ~290-350 (preview path), ~510-660 (final path), ~1085-1100 (router).
4. CLAUDE.md § "Graph Builder — CRITICAL LOAD ORDER", § "Logging Standards", § "Incremental Development Protocol".

Then ask:

> Ready to apply Phase 2.5 as three tasks (2.5.1 formatter persistence, 2.5.2 TimeScale, 2.5.3 optional refactor). Step 0 first: paste the console diagnostic block (from the prompt's Execution Shape section) on a live advanced-mode chart in both Test 2 and Test 3 states, so I can see where tick callbacks end up after Chart.js construction and whether `ChartBuilderState._state.chartConfig.scales.x.type` survives Strategy A. After that, based on the probe output, I'll propose either (a) a Chart.js plugin for 2.5.1, (b) direct `_state.chartConfig` mutation for 2.5.2, or (c) a different approach entirely if the diagnostic reveals something unexpected. All commits held until you approve each acceptance test. Basic-mode regression (Test 4) must remain byte-identical — I'll re-run it as the final check before the masterplan commit.

Proceed based on the human's answer.
