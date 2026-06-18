# Claude Code Prompt: Graph Builder Phase 2 — Enhanced Data Processing & Chart Generation

**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md
**Phase 1 testing record:** @md-scripts/charts/docs/graph-builder-phase1-testing.md
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + logging pattern, 500-line max, WCAG 2.2 AA, British spelling)
**Predecessor:** Phase 1 shipped manual-test-signed-off on 2026-04-22. Read the "Phase 1 Implementation Results" and "Notes for Phase 2" blocks in the masterplan before the first edit — 9-3 of the issues Phase 1 encountered (multi-column extraction, enhanced-mode detection, the `row-sync` bridge) are the scaffolding Phase 2 has to plug into.

---

## What Phase 2 delivers

Phase 1 gave us the UI and data-entry plumbing for multi-column configuration (up to 6 columns with types: text / number / currency / percentage / date, and roles: label / value / grouping). Phase 2 makes that configuration produce **actual multi-series charts**. At present, advanced-mode data is validated and extracted correctly but is then handed to [graph-builder-charts.js:111-145](../graph-builder-charts.js#L111) which hard-codes `labels = row[0]` / `values = row[1]` — so only the first two columns ever reach Chart.js.

Four tasks from the masterplan (§ Phase 2 Implementation Tasks):

| Task | Scope | New/Modified |
|------|-------|--------------|
| 2.1 Enhanced Data Processor | Multi-column extraction → Chart.js datasets; type-aware value parsing (currency £$€, percentage %, date); colour assignment per series | **NEW** `js/graph-builder-data-enhanced.js` |
| 2.2 Enhanced Chart Generator | Multi-series bar/line configs; time-scale for date columns; axis + tooltip formatting per type; legend for multi-series | **NEW** `js/graph-builder-charts-enhanced.js` |
| 2.3 Integration | Detect `GraphBuilderEnhanced.isAdvancedMode()` inside existing chart builder; route to enhanced processors; preserve basic mode | **MODIFY** `md-scripts/charts/graph-builder-charts.js` |
| 2.4 Preview | Live preview reflects multi-series + type formatting during column changes | touches 2.1 / 2.2 / 2.3 — no new file |

**Out of scope (Phase 3+):** bubble charts, stacked variants, combo charts, aggregation/pivot, template save/load. Do not widen scope.

---

## Why this is four tasks, not four commits

Tasks 2.1 and 2.2 are independent new files with no cross-dependency — 2.1 is a pure data transformer (no DOM), 2.2 is a pure config builder (no DOM). They can be written and unit-tested in isolation. Task 2.3 is the integration wire-up that makes them visible to users. Task 2.4 is validation that the preview renderer (already generic per the Phase 1 notes) keeps working.

**Recommended execution shape:**

- **One commit per task.** This is a new phase with net-new modules — the blast radius of each step is small and testable. Commit after 2.1 passes isolation tests, after 2.2 passes config-generation tests, after 2.3 passes end-to-end chart render, and after 2.4 confirms preview behaviour (may be a "no changes required" commit with a masterplan note).
- Follow CLAUDE.md's **"Incremental Development Protocol — one file per iteration"**. Do not open 2.2 until 2.1 is console-validated.
- Run `node --check` after every edit. Provide a single-IIFE `console.table()` test block after each file lands (see CLAUDE.md § "Console Testing").

---

## Before you start — read these in order

1. [graphbuilder-masterplan.md "Phase 1 Implementation Results" + "Notes for Phase 2"](./graphbuilder-masterplan.md) — current state, known bridges, file inventory.
2. [graph-builder-charts.js](../graph-builder-charts.js) in full, but especially:
   - **lines 103–200** — `ChartConfigBuilder.build(data, chartType, options)` — the hard-coded 2-column path Phase 2 must bypass in advanced mode.
   - **lines 124–125** — `labels = data.rows.map(r => r[0]); values = data.rows.map(r => r[1]);` — literally the line that limits us to 2 columns.
   - **lines 128–145** — the pie/doughnut vs bar/line dataset split — the shape Phase 2's multi-series output must match.
3. [graph-builder-data.js:594-669](../graph-builder-data.js#L594) — `extractFormData`'s multi-column-aware path. This is the upstream that already emits `{ headers: [...], rows: [[...]] }` where each row has N values in advanced mode. Phase 2's data processor consumes *this* output, not raw form DOM.
4. The three already-exposed APIs Phase 2 depends on (verify each exists with `typeof window.X.method === "function"` before coding against them — these are claims from the Phase 1 masterplan, not guarantees):
   - `GraphBuilderEnhanced.isAdvancedMode()` — boolean gate.
   - `GraphBuilderEnhanced.getColumnConfiguration()` — array of `{ name, type, role }` objects.
   - `GraphBuilderEnhanced.getCompatibleChartTypes()` — filters the chart type list to those that make sense for the current column set.
5. CLAUDE.md § "Graph Builder — CRITICAL LOAD ORDER" and § "Logging Standards". Both new files must be IIFE-pattern with the standard `LOG_LEVELS` / `shouldLog` / `logError|Warn|Info|Debug` scaffolding.

**Do not** re-read Phase 1's implementation bible (`graph-builder-column-manager.js`, `-csv-processor.js`, `-row-sync.js`, `-enhanced.js`) cover-to-cover. Read their public surface only — you are a consumer of those APIs, not a modifier.

---

## Context (diagnosis in one paragraph each)

**Task 2.1 — why a new data processor.** Right now, `extractFormData` returns `{ headers, rows }` where `rows` is `[[label, val1, val2, …], [label, val1, val2, …], …]` in advanced mode. Chart.js wants `datasets: [{ label, data: [...], backgroundColor: [...] }, …]` — one dataset per *value column*, each dataset's data being the values from that column across all rows. The shape transform is trivial (pivot row-major to column-major), but the Phase 2 processor also has to: (a) distinguish label columns (`role: "label"`) from value columns (`role: "value"`) from grouping columns (`role: "grouping"`); (b) parse currency/percentage/date strings into Chart.js-consumable numbers/Date objects; (c) assign a distinct colour per series (the existing `ChartConfigBuilder.getColours()` cycles a palette — Phase 2 can reuse it, one colour per dataset rather than one per bar). The processor is pure: inputs are `{ headers, rows }` + column config; output is `{ labels, datasets, xAxisType, formatters }`.

**Task 2.2 — why a new chart generator.** The existing `ChartConfigBuilder.build()` builds *one* Chart.js config for *one* `type`. Phase 2's generator wraps it: it takes the processor's output plus the chart type, produces a Chart.js config with (i) multiple datasets, (ii) a time-scaled x-axis when the label column is `type: "date"`, (iii) currency / percentage / date-formatted tick callbacks on the axes, (iv) matching tooltip formatters, (v) `plugins.legend.display: true` forced on when `datasets.length > 1`. Do not duplicate the parts of `ChartConfigBuilder.build()` that aren't type-specific (layout padding, title, accessibility options) — delegate to it or copy only the minimum and document why.

**Task 2.3 — why a router, not a rewrite.** The entry point users hit is `ChartBuilderState.generateChart(container)` (called at [graph-builder-charts.js:597](../graph-builder-charts.js#L597)). Upstream of that, something calls `new ChartConfigBuilder().build(data, chartType, options)`. Find that caller (the Phase 1 notes say Chart Generation is "the main gap"), add a branch: `if (GraphBuilderEnhanced?.isAdvancedMode()) { use GraphBuilderChartsEnhanced } else { use existing path }`. Do **not** delete the existing path — Phase 2's basic-mode users must keep working byte-identical to Phase 1. The branch decision happens at config build time, not render time (Chart.js doesn't care which code produced the config object).

**Task 2.4 — why it's probably a no-op.** Phase 1's notes record that `PreviewManager.renderTable` already iterates `data.headers` and `data.rows` generically, so multi-column previews of the *table* already work. The *chart* preview (if there is a live chart preview in the UI — verify in the Phase 1 record or by reading the UI file) uses the same chart config builder that 2.3 will re-route. If 2.3 is done correctly, 2.4 should need no new code — just a regression check confirming preview updates on column add/remove still fire. If it does not, the fix is likely a one-line "invalidate preview on column config change" in `graph-builder-enhanced.js` or `row-sync.js`. Decide from evidence, not speculation.

---

## Execution shape (four tasks, four commits)

### Step 0 — Validate assumptions before coding (10 minutes)

Open a console on `tools.html` in Graph Builder mode. Paste:

```javascript
(() => {
  const results = {
    "GraphBuilderEnhanced exists": !!window.GraphBuilderEnhanced,
    "isAdvancedMode is fn": typeof window.GraphBuilderEnhanced?.isAdvancedMode === "function",
    "getColumnConfiguration is fn": typeof window.GraphBuilderEnhanced?.getColumnConfiguration === "function",
    "getCompatibleChartTypes is fn": typeof window.GraphBuilderEnhanced?.getCompatibleChartTypes === "function",
    "GraphBuilderData.extractFormData is fn": typeof window.GraphBuilderData?.extractFormData === "function",
    "GraphBuilderCharts exists": !!window.GraphBuilderCharts,
    "ChartBuilderState.generateChart is fn": typeof window.ChartBuilderState?.generateChart === "function",
    "Chart.js loaded": typeof window.Chart !== "undefined",
  };
  console.table(results);
})();
```

All should read `true`. If `getCompatibleChartTypes` is missing, Phase 1's "Console Commands Reference" appendix is out of date — note it and carry on, this task doesn't strictly need it. If anything else is missing, STOP and ask the human before coding against a non-existent API.

Then, enable advanced mode, configure 4 columns (one date, one text, two numeric), enter 3 rows, and dump the extraction:

```javascript
(() => {
  const formRows = document.querySelectorAll(".gb-data-row"); // confirm selector by reading UI file
  const headers = {}; // advanced mode ignores these
  const out = window.GraphBuilderData.extractFormData(formRows, headers);
  console.log(JSON.stringify(out, null, 2));
})();
```

Record the exact shape — this is the contract Task 2.1 consumes. If the selector `.gb-data-row` isn't right, grep `graph-builder-enhanced.js` / `graph-builder-row-sync.js` for the real one.

### Step 1 — Task 2.1: Enhanced Data Processor (new file, isolated)

1. Create [js/graph-builder-data-enhanced.js](../../../js/graph-builder-data-enhanced.js) using the IIFE + logging template from CLAUDE.md. File budget: stay under 500 lines; realistic target ~200-300 lines.
2. Public API (keep it small — easier to evolve later):
   ```javascript
   window.GraphBuilderDataEnhanced = {
     processData(rawData, columnConfig) { /* → { labels, datasets, xAxisType, formatters } */ },
     parseValue(raw, type) { /* type ∈ "text" | "number" | "currency" | "percentage" | "date" */ },
     getSeriesColours(count) { /* distinct colours for N series */ },
   };
   ```
3. `parseValue` strips currency symbols (`£$€¥₹`), percentage signs, thousand separators, and parses dates via `new Date(raw)` with a NaN-guard. Return `null` for unparseable values — don't throw. Callers decide whether to drop the row or surface an error.
4. `processData` rules:
   - If no column has `role: "label"`, default to the first column. If no column has `role: "value"`, default to all non-label numeric columns.
   - `labels = rawData.rows.map(r => r[labelColumnIndex])`.
   - `datasets = valueColumnIndices.map(i => ({ label: headers[i], data: rows.map(r => parseValue(r[i], columns[i].type)), backgroundColor: colour[i] }))`.
   - `xAxisType = columns[labelIdx].type === "date" ? "time" : "category"`.
   - `formatters` is a map keyed by column type → a callback suitable for Chart.js `ticks.callback` and `tooltip.callbacks.label`.
5. No DOM access in this file. Pure data in, pure data out. Testable from a Node REPL in principle (don't set that up; just ensure the file doesn't import or read `document`).
6. `node --check js/graph-builder-data-enhanced.js`.
7. Add the script tag to [tools.html](../../../tools.html) — insert **before** `graph-builder-row-sync.js` (2.1 has no dependencies; slot it next to `-column-manager.js` / `-csv-processor.js` in the "no deps" tier).
8. Console isolation test (paste whole block as one IIFE):
   ```javascript
   (() => {
     const rawData = {
       headers: ["Month", "Sales £", "Returns £"],
       rows: [["Jan", "£1,200.50", "£100"], ["Feb", "£1,500", "£50"]],
     };
     const cfg = [
       { name: "Month", type: "text", role: "label" },
       { name: "Sales £", type: "currency", role: "value" },
       { name: "Returns £", type: "currency", role: "value" },
     ];
     const out = window.GraphBuilderDataEnhanced.processData(rawData, cfg);
     console.table({
       "labels length": out.labels?.length,
       "labels[0]": out.labels?.[0],
       "datasets length": out.datasets?.length,
       "dataset[0].label": out.datasets?.[0]?.label,
       "dataset[0].data[0]": out.datasets?.[0]?.data?.[0],
       "dataset[1].data[0]": out.datasets?.[1]?.data?.[0],
       "xAxisType": out.xAxisType,
       "currency parsed to number": typeof out.datasets?.[0]?.data?.[0] === "number",
     });
   })();
   ```
   Expected: `labels length: 2`, `dataset[0].data[0]: 1200.5` (as a Number, not "£1,200.50"), `xAxisType: "category"` (Month is text, not date).

**Commit 2.1** after isolation tests pass. Message format: `Phase 2.1: Enhanced Data Processor — multi-column extraction, type-aware parsing`.

### Step 2 — Task 2.2: Enhanced Chart Generator (new file, depends on 2.1)

1. Create [js/graph-builder-charts-enhanced.js](../../../js/graph-builder-charts-enhanced.js). Same IIFE + logging template.
2. Public API:
   ```javascript
   window.GraphBuilderChartsEnhanced = {
     buildConfig(processedData, chartType, options) { /* → Chart.js config object */ },
   };
   ```
3. Implementation outline:
   - Call into `ChartConfigBuilder` for the base scaffold (layout, padding, title, accessibility options) OR clone just the non-data parts. Prefer delegation if the existing class exposes a hook; copy if not.
   - Override `data.labels` and `data.datasets` with `processedData.labels` and `processedData.datasets`.
   - Override `options.scales.x.type` to `"time"` when `processedData.xAxisType === "time"`. Add a minimal time-scale config (Chart.js requires `chartjs-adapter-date-fns` or equivalent — check the tools.html for whether an adapter is already loaded; if not, flag and ask before adding a CDN dependency).
   - Hook `options.scales.y.ticks.callback` to the currency / percentage formatter from `processedData.formatters` when the value columns share a type. When value columns have mixed types, fall back to the default numeric formatter and log a warning.
   - Hook `options.plugins.tooltip.callbacks.label` to the same formatter.
   - Force `options.plugins.legend.display = true` when `datasets.length > 1` (single-series charts can keep the existing default).
4. `node --check js/graph-builder-charts-enhanced.js`.
5. Add the script tag to `tools.html` — slot it **after** `graph-builder-charts.js` (2.2 consumes `ChartConfigBuilder`).
6. Console isolation test: run 2.1's test to get a `processedData`, then call `GraphBuilderChartsEnhanced.buildConfig(processedData, "bar", { title: "Test" })` and assert:
   - `config.type === "bar"`
   - `config.data.datasets.length === 2`
   - `config.data.datasets[0].label === "Sales £"`
   - `config.options.plugins.legend.display === true`
   - `config.options.scales.y.ticks.callback` is a function.

**Commit 2.2** after isolation tests pass. Message: `Phase 2.2: Enhanced Chart Generator — multi-series configs, type-aware formatting`.

### Step 3 — Task 2.3: Integration (modify existing file)

1. Read [graph-builder-charts.js](../graph-builder-charts.js) top-to-bottom, or at least until you find the call site of `new ChartConfigBuilder().build(...)`. Add a branch:
   ```javascript
   // Pseudocode — match the file's actual variable names and style
   const enhanced = window.GraphBuilderEnhanced;
   if (enhanced?.isAdvancedMode() && window.GraphBuilderDataEnhanced && window.GraphBuilderChartsEnhanced) {
     const columnCfg = enhanced.getColumnConfiguration();
     const processed = window.GraphBuilderDataEnhanced.processData(data, columnCfg);
     return window.GraphBuilderChartsEnhanced.buildConfig(processed, chartType, options);
   }
   // existing 2-column path, unchanged
   return configBuilder.build(data, chartType, options);
   ```
2. **Do not remove the existing path.** Basic-mode users must keep working byte-identical. A user who never enables the toggle should notice zero behavioural change.
3. If `graph-builder-charts.js` grows past 500 lines after the branch, stop — extract the branch logic into a small helper and keep the router slim. CLAUDE.md's 500-line limit is non-negotiable.
4. `node --check` the modified file.
5. End-to-end console test:
   ```javascript
   // 1. Basic mode — enter 2 cols of data, pick bar chart, render. Verify single series.
   // 2. Advanced mode — configure 3 cols (label + 2 numeric), enter 4 rows, pick bar chart, render.
   //    Verify 2 datasets, legend visible, distinct colours, tooltip shows currency format.
   // 3. Advanced mode + date label — configure 3 cols (date + 2 numeric), enter 4 rows, pick line chart.
   //    Verify x-axis reads as time (not category), points in chronological order regardless of entry order.
   // 4. Toggle advanced mode OFF — render. Verify we're back on the basic path.
   ```
   This test is human-in-the-loop — you can't fully automate it from a console block. Ask the user to report: (a) chart renders without error, (b) expected series count, (c) axis formatting, (d) screenshot if possible.

**Commit 2.3** after human confirms the end-to-end tests. Message: `Phase 2.3: Integration — route advanced mode through enhanced processors`.

### Step 4 — Task 2.4: Preview verification (probably no-op)

1. With advanced mode enabled and a chart rendered, change the column configuration (rename a column, add a column, change a type). Confirm the preview reflects changes without a manual re-render button.
2. If the preview goes stale (doesn't refresh on column-config change), find the preview-update hook in `graph-builder-enhanced.js` or `row-sync.js` — Phase 1's `row-sync` module's `triggerCoreValidation()` bridges to `GraphBuilderUI.showPreview`; extend or wire a parallel `triggerPreviewRefresh()` for chart config changes.
3. If it already works (Phase 1's notes imply it should), **do not add code**. Record in the masterplan that 2.4 required no changes.
4. Regression sweep: basic-mode preview still works, advanced-mode preview updates on row add/delete, preview updates on column-config change.

**Commit 2.4** only if code changed. Otherwise fold the "no-op confirmation" into the masterplan update commit (Step 5). Message: `Phase 2.4: Enhanced Chart Preview — verified (no code changes required)` OR `Phase 2.4: Preview refresh on column-config change`.

### Step 5 — Update the masterplan

After all task commits land, update [graphbuilder-masterplan.md](./graphbuilder-masterplan.md):

1. Flip the Phase 2 row in the Phase Overview table: `Pending` → `Complete`.
2. Update the "Project Status Dashboard": Completed Phases 1 → 2, Overall Completion 25% → 50%.
3. Add a "Phase 2 Implementation Results" block under the Phase 2 heading, modelled on Phase 1's block:
   - Completion Date.
   - Files Created (2.1, 2.2) with size/line counts.
   - Files Modified (2.3).
   - Integration Tests results (whatever you added to `graph-builder-testing.js` or a new `graph-builder-testing-phase2.js`).
   - Manual Tests results.
   - Issues Encountered (e.g. date adapter decision, mixed-type formatter fallback, any caller of `ChartConfigBuilder.build` outside the expected path).
   - Architecture Decisions (e.g. why delegation vs clone in 2.2).
   - Notes for Phase 3.
4. Update the "Appendix A. File Structure" to list the two new files.
5. Expand "Appendix B. Console Commands Reference" with 2.1/2.2 inspection commands.
6. Update "Document Version" and "Last Updated" at the bottom.
7. Update "Next Action" to Phase 3 Task 3.1.

Commit as a small separate commit: `Phase 2: record implementation results in masterplan`.

---

## Acceptance criteria

**Per task:**

- [ ] **2.1** — `window.GraphBuilderDataEnhanced.processData()` returns `{ labels, datasets, xAxisType, formatters }` with correct types for text / number / currency / percentage / date columns. Currency strings parse to Numbers. Date strings parse to Date objects. Isolation test passes.
- [ ] **2.2** — `window.GraphBuilderChartsEnhanced.buildConfig()` returns a valid Chart.js config with N datasets for N value columns, time-scale x-axis when label type is date, type-aware tick + tooltip formatters, and `legend.display: true` when multi-series. Isolation test passes.
- [ ] **2.3** — Advanced mode renders multi-series charts end-to-end. Basic mode renders byte-identical to Phase 1 (no regression). Human confirmation recorded.
- [ ] **2.4** — Preview stays fresh across column-config changes. No stale state. No new code unless a real bug is found.

**Overall:**

- [ ] `node --check` passes on all touched files after every edit.
- [ ] No file exceeds 500 lines.
- [ ] All new files use IIFE + logging pattern from CLAUDE.md.
- [ ] British spelling throughout (`colour`, `initialise`, `behaviour`). American only where CSS/DOM require it.
- [ ] Graph Builder load order preserved — new files slotted in the correct dependency tier.
- [ ] WCAG 2.2 AA unchanged (run axe-core on a rendered advanced-mode chart; no new violations).
- [ ] One commit per task (2.4 may fold into the masterplan commit).
- [ ] Masterplan updated in a final small commit.
- [ ] All commits held until human approves the fixtures and end-to-end test.

---

## What to avoid

- **Do not delete or refactor the basic-mode path in `graph-builder-charts.js`.** Phase 2 is additive. Basic-mode users must see byte-identical behaviour.
- **Do not add a date-adapter CDN dependency without asking.** Chart.js time-scales need `chartjs-adapter-date-fns` or `chartjs-adapter-moment`. Check `tools.html` first — if neither is loaded, flag to the human and get approval before adding the `<script>` tag. CLAUDE.md's "No NPM, no build tools" rule means this is a CDN tag decision, not a package install.
- **Do not mutate `ChartConfigBuilder` in 2.2.** Extend or wrap, don't modify. The basic-mode path consumes it unchanged.
- **Do not over-engineer `parseValue`.** Strip symbols, `parseFloat`, `new Date`, NaN-guard. That's the whole spec. Resist the urge to handle locale-specific date formats, Excel date serials, accounting-format negatives in parens, etc. — those are Phase 3 territory if they come up at all.
- **Do not commit proactively.** Hold each task commit until: (a) file passes `node --check`, (b) isolation/integration test run shows expected results, (c) human confirms for the end-to-end task (2.3).
- **Do not touch Phase 1 files unless integration forces it.** `graph-builder-column-manager.js`, `-csv-processor.js`, `-row-sync.js`, `-enhanced.js` are signed-off. If 2.3 reveals you need a new API on `GraphBuilderEnhanced`, add the method in a named sub-step and call it out in the commit body.
- **Do not widen scope to Phase 3.** Stacked / bubble / combo charts are Phase 3. Aggregation / pivot / template save-load are Phase 3. Keep Phase 2 strictly to multi-series rendering + type-aware formatting.
- **Do not assume `getCompatibleChartTypes()` exists.** The masterplan's Appendix B claims it's exposed; Step 0 verifies. If it doesn't exist, 2.2 can still work — just don't filter the chart type list dynamically. Flag the gap in the delivered block.
- **Do not skip `node --check` between steps.** OneDrive sync has been a known flaky point (CLAUDE.md "OneDrive caveat"). If a write "succeeds" but `node --check` fails with a file-not-found or stale-content error, retry once before assuming the code is wrong.
- **Do not generate a `graph-builder-phase2-testing.md` test script preemptively.** Wait until 2.3 is working end-to-end, then model a new testing doc on `graph-builder-phase1-testing.md`. Scripts written against code that doesn't exist yet go stale fast.

---

## Starting question

When you begin the conversation, confirm you've read:

1. [graphbuilder-masterplan.md](./graphbuilder-masterplan.md) in full — especially Phase 1's "Notes for Phase 2".
2. [graph-builder-charts.js](../graph-builder-charts.js) lines 103-200 (`ChartConfigBuilder.build`, the 2-column hard-coding).
3. [graph-builder-data.js](../graph-builder-data.js) lines 594-669 (`extractFormData` multi-column path — the upstream Phase 2 consumes).
4. [CLAUDE.md](../../../CLAUDE.md) § "Graph Builder — CRITICAL LOAD ORDER", § "Logging Standards", § "Incremental Development Protocol".

Then ask:

> Ready to apply Phase 2 as four sequential commits: 2.1 Enhanced Data Processor (new `js/graph-builder-data-enhanced.js`), then 2.2 Enhanced Chart Generator (new `js/graph-builder-charts-enhanced.js`), then 2.3 Integration (modify `md-scripts/charts/graph-builder-charts.js`), then 2.4 Preview verification (likely no code change). Step 0 first: paste the console API-validation block so I can confirm all three `GraphBuilderEnhanced` methods exist before coding against them. After that, a question: Chart.js time-scales need a date adapter (`chartjs-adapter-date-fns` or similar). Can you check `tools.html` and report whether one is already loaded? If not, I'll need approval before adding a CDN tag for it. Everything else follows the masterplan's Task 2.1-2.4 order, one file per iteration with console validation between steps, all commits held until you approve.

Proceed based on the human's answer.
