# Claude Code Prompt: Graph Builder Phase 3.2.b — Form polish (currency symbol, thousand separators, preview stats, title placeholder)

**Predecessor (3.2.a row/column-inputs UI polish):** see "Phase 3.2.a Implementation Results" in @md-scripts/charts/docs/graphbuilder-masterplan.md
**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md (Phase 3 task list — 3.2 entries)
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + 4-level logger, 500-line max, WCAG 2.2 AA, British spelling, never-use-`title`-attribute, icons via `icon-library.js`)

---

## State at handoff

**Phase 3.2.a (row + column-inputs UI polish) shipped to working tree at end of 2026-05-08 session, awaiting commit.** First action in 3.2.b is to ensure 3.2.a is committed before any further work — the working tree currently holds:

- `md-scripts/css/graph-builder-enhanced.css` (~+50 lines net: container-query layout, alignment, overflow fixes, form-control resets)
- `js/graph-builder-enhanced.js` (2 string changes: `"(default)" → "default"`, `"Column Name:" → "Name:"`)

If those changes are uncommitted at the start of 3.2.b, commit them first under `Phase 3.2.a:` prefix. If they're already committed, `git log --oneline -1` will show the commit; verify and skip ahead.

**Phase 3.1 fully shipped** (3.1.a–f, 2026-04-24 → 2026-04-29). All chart types working at the data layer, fullscreen sizing fixed across both Markdown Editor and Graph Builder, canvas DPR supersampling at `Math.max(2, window.devicePixelRatio)` for sharper text.

**Three remaining Phase 3.2 items still pending after 3.2.a:**

1. **Per-column currency symbol selector** — currently `formatCurrency` hard-codes `£`. Should read from a per-column `col.symbol` field set in the column-setup UI.
2. **Auto-insert thousand separators on numeric input blur** — `1000000` → `1,000,000` for readability. Strip regex in `extractFormData` already accepts both forms, so this is a display-only enhancement.
3. **Preview-table stats text auto-refresh on row change** — Phase 1 stats element reads "X rows, Y columns" once at render time; doesn't update when rows are added.

Plus a fourth item that surfaced during 3.2.a visual testing:

4. **"Chart Title" placeholder when user leaves Stage 3 title blank** — currently every chart shows the literal text "Chart Title" in this case. Either suppress the title block entirely or auto-default to a sensible string like `Bubble chart of {y-col} vs {x-col}, sized by {r-col}`.

---

## Working protocol — read carefully

These rules carry forward from 3.1.a–e and 3.2.a:

1. **One sub-task at a time.** Tackle the four items in any order, but finish (test + verify visually) one before starting the next.
2. **Lead the user through testing.** For each sub-task: setup IIFE → user action → verification IIFE or visual check → expected result. Self-contained paste-and-go IIFEs.
3. **Diagnostic-first for any visual issue.** The 3.2.a session burned several iterations on "guess and check"; the moment we switched to `getBoundingClientRect()` + `getComputedStyle()` IIFEs, fixes pinpointed exactly. Carry that pattern forward — if a layout change doesn't look right, write a diagnostic IIFE before trying another CSS edit.
4. **Keep message bodies short.** Compact output. The user is on Windows over OneDrive.
5. **Commit only on explicit approval.** No proactive commits. After all sub-tasks pass, ask "ready to commit?" and hold.
6. **Regression sweep before commit.** Phase 2.5 Tests 2/3/4 must pass after the changes (basic-mode byte-identity is non-negotiable). For currency-symbol work, also re-run Test 2 (advanced multi-series currency bar) since that's the existing currency formatting path.
7. **British spelling, no `title` attribute, icons via `icon-library.js`.**

### Regression test reference (use exactly these — known-passing as of `ca18d07`)

**Test 2** — advanced multi-series currency bar: 3 cols (Month/text-label, Sales/currency-value, Returns/currency-value), 4 rows Jan/Feb/Mar/Apr, **bar** chart. Expected: `datasets count: 2`, `y-axis title: "Amount (£)"`, y tick `500 → "£500"`, `x scale type: "category"`, `first bar value: 1200`.

**Test 3** — advanced date-axis line: 3 cols (Date/date-label, Revenue/number-value, Profit/number-value), 4 rows out-of-order (Mar/Jan/Apr/Feb 2024), **line** chart. Expected: `x scale type: "time"`, chronological sort, `labels[0] month: 0`, `maxTicksLimit: 12`.

**Test 4** — basic-mode byte-identity: advanced mode OFF, basic 2-column apples=10/oranges=20 bar chart. Expected: `datasets count: 1`, `dataset[0].data: [10,20]`, `config._gbEnhanced: undefined`.

(See @md-scripts/charts/docs/prompt-phase3-1e-fullscreen-sizing.md for the full setup IIFEs of these tests if needed.)

---

## Sub-task 3.2.b-1 — Per-column currency symbol selector

### Objective

Allow the user to choose a currency symbol per value column when its `type === "currency"`. The symbol surfaces in:
- The column-setup UI: a small `<select>` next to "Data Type:" when type is `currency` (otherwise hidden).
- The column header / dataset label rendered in tooltips and legend (e.g. "Sales (£)" or "Sales ($)").
- The y-axis tick formatter (currently hard-codes `£` in [`graph-builder-charts-enhanced.js`](../../../js/graph-builder-charts-enhanced.js)'s `applyYAxisTitle` and the corresponding tick callback in `applyYAxisFormatter`).
- The tooltip formatter for the same dataset.

### Scope

| File | Change |
|---|---|
| `js/graph-builder-column-manager.js` | Add `symbol: "£"` field to value columns when `type === "currency"`. Default `£` for backwards compatibility. |
| `js/graph-builder-enhanced.js` | Render the symbol `<select>` inside `.gb-column-inputs` only when `column.type === "currency"`. Use `:has()` for visibility OR JS-driven show/hide consistent with the existing Chart Type select pattern at line ~190. Options: `£`, `$`, `€`, `¥`, `₹`. |
| `js/graph-builder-data-enhanced.js` | `processData` reads `col.symbol` and surfaces it on the dataset (e.g. as `_columnSymbol` alongside the existing `_columnType` and `_columnIndex`). |
| `js/graph-builder-charts-enhanced.js` | Y-axis title and tick formatter use the dataset's `_columnSymbol` instead of the hard-coded `£`. Tooltip label callback similarly. |
| `md-scripts/css/graph-builder-enhanced.css` | If the new symbol select needs a 6th grid track, update the `@container (min-width: 600px)` rule's `grid-template-columns`. Likely will need a wider container threshold or a separate `:has()` rule for "this row has currency type". |

### Layout consideration

The 3.2.a fixed-width grid (Name 145 + 3 selects × 120 + Remove ~88 + 4 gaps × 12 = 641 px) was already at the edge of the parent fieldset's content area (~643 px) at typical widths. Adding a 6th track (Symbol select) won't fit at the current threshold. Two options:

- **(a)** Raise the container-query threshold to ~750 px and accept the stacked-vertical fallback at fieldset widths between 600–750. Simpler. Visually, the user's typical viewport gives fieldsets ~664–676 px, so they'd be in the stacked layout when currency symbol UI is visible. Acceptable trade-off if currency symbol is mostly a "set-and-forget" field.
- **(b)** Make the Symbol select appear in a **separate row** below the existing controls when `type === "currency"`. Use `grid-template-rows: auto auto` and assign the symbol input-group to row 2. Keeps the horizontal layout for the non-currency case and adds a second row only when needed. More complex CSS but keeps the horizontal layout active at typical widths.

Recommend (b). Do measurements at the start of the sub-task via a fresh diagnostic IIFE to confirm the typical fieldset width on the user's setup before committing to a threshold.

### Tests

- **Test 13 — currency symbol per column.** Set up 2 value columns: Sales with `type: currency, symbol: £`, Revenue with `type: currency, symbol: $`. Generate bar chart. Verify:
  - Y-axis ticks for the Sales dataset show `£500`, for Revenue show `$500` (or single y-axis title reads "Amount (£/$)" if mixed-symbol fallback is acceptable — decide based on UX preference).
  - Tooltip on Sales bar shows `Sales: £1,200`; on Revenue bar shows `Revenue: $1,800`.
  - Legend label includes the symbol: `Sales (£)`, `Revenue ($)`.
- **Regression Test 2** still passes (single-symbol all-£ scenario unchanged).

### Non-goals for this sub-task

- Mixed-currency stacking (already non-sensical at the data level).
- User-supplied custom symbols beyond the 5 preset options.

---

## Sub-task 3.2.b-2 — Thousand separators on numeric input blur

### Objective

Format a numeric or currency input's value with thousand separators on `blur` for readability: `1000000` becomes `1,000,000`. On `focus`, optionally strip back to plain digits for editing (or leave formatted — the strip regex in `extractFormData` already accepts either form, so editing the formatted version still works).

### Scope

| File | Change |
|---|---|
| `js/graph-builder-row-sync.js` | In `addEnhancedRow` (where input listeners are attached), add a `blur` listener on `type="text" inputmode="decimal"` inputs (currency/percentage columns). On blur, parse the value, reformat with `.toLocaleString("en-GB")`, and write back. On `focus` (optional), reformat back to plain digits. |
| `js/graph-builder-data-enhanced.js` | `parseValue` already strips `[£$€¥₹%,\s]` — no change required if we leave the comma stripping intact. |

### Tests

- **Test 14 — thousand separators on blur.** Type `1500000` into a currency input. Tab out (blur). Input value should become `£1,500,000` (or `1,500,000` depending on whether the symbol is included in the formatting — likely yes for currency, no for percentage). Re-focus the input — value should be editable (whether reformatted to plain or left formatted is a sub-decision). Generate chart — `dataset[0].data[0] === 1500000` (parsing still works correctly).
- **Regression Test 2** still passes — entered values still parse to numbers correctly.

### Non-goals

- Internationalisation of the separator (always `,` for `en-GB`).
- Live formatting as the user types (defer to a future sub-task if requested).

---

## Sub-task 3.2.b-3 — Preview-table stats text auto-refresh on row change

### Objective

The Phase 1 preview-table stats element (something like "X rows, Y columns") is rendered once when the preview is first shown. Adding/removing rows in advanced mode updates `_state.chartData` but doesn't refresh the stats text. Hook into the row-sync bridge to update on every row change.

### Scope

| File | Change |
|---|---|
| `js/graph-builder-row-sync.js` | In the `triggerCoreValidation` path (or wherever the row-change bridge lives), after writing `_state.chartData`, call a new `PreviewManager.refreshStats()` method (or in-place update the stats element text). |
| `md-scripts/charts/graph-builder-ui.js` | Expose `PreviewManager.refreshStats()` (or equivalent) — reads the current row count from `_state.chartData.rows` and updates the stats element's `textContent`. |

### Tests

- **Test 15 — stats refresh on row add.** Set up advanced mode with 3 rows. Verify stats reads "3 rows, N columns". Click "Add Row". Verify stats updates to "4 rows, N columns" without re-rendering the whole preview table.
- Similarly for row remove.
- **Regression Test 4** still passes — basic mode is unaffected.

### Non-goals

- Re-rendering the entire preview table on every keystroke (heavy; not required).
- Stats for column count changes — covered by the existing render path when columns are added.

---

## Sub-task 3.2.b-4 — "Chart Title" placeholder when user leaves it blank

### Objective

Currently when the user doesn't enter a Stage 3 chart title, the chart renders with the literal text "Chart Title" as its title (this is the placeholder text from the input field, treated as the actual title). Two acceptable fixes:

- **Suppress the title block entirely** when title is empty — chart renders with no title at all. Cleanest.
- **Auto-default to a sensible string** based on chart type and column names — e.g. `"Bubble chart of {y} vs {x}, sized by {r}"` for bubble, `"{y-col} by {label-col}"` for bar/line. More work but more polished.

Recommend the suppression approach — simpler, predictable, lets the user own the decision. If they want a title, they enter one; if they don't, no title block. Auto-defaults can be Phase 3.3+ if user demand surfaces.

### Scope

| File | Change |
|---|---|
| `md-scripts/charts/graph-builder-charts.js` (or wherever the chart config's `options.plugins.title.text` is set) | Check whether the title input value is empty / equals "Chart Title" / equals the placeholder; if so, set `options.plugins.title.display = false`. |
| Or `js/graph-builder-charts-enhanced.js` | Same check in the enhanced path. |

### Tests

- **Test 16 — empty title suppression.** Generate a chart without entering a title at Stage 3. Verify chart has no title block (no "Chart Title" text). Generate another chart with title "Sales Q1" — title shows correctly.
- **Regression Test 2** still passes.

### Non-goals

- Auto-default title strings (defer).
- Placeholder text change (the input's placeholder is `"Chart Title"` — keep as a UX hint, just don't treat it as the rendered value).

---

## What to avoid

- **Don't refactor `graph-builder-charts.js`** — at 1521 lines, still under the 1600 mandatory-refactor threshold.
- **Don't break basic mode.** Test 4 byte-identity is non-negotiable.
- **Don't widen scope.** Each sub-task is small and discrete. If a sub-task surfaces an issue out of scope, document it as a 3.3+ candidate; don't fix it here.
- **Don't commit proactively.** Hold for explicit user approval after all 4 sub-tasks ship.
- **Don't re-litigate 3.2.a.** The container-query layout, fixed widths, alignment fixes — all stable. If 3.2.b's currency-symbol UI needs a 6th column, work within the existing container-query structure (raise threshold or use sub-row), don't tear up the 3.2.a foundation.
- **Don't add icons inline** — use `icon-library.js` per CLAUDE.md.

---

## Diagnostic starting points

For each sub-task, before writing code, run a fresh diagnostic to confirm current state:

**3.2.b-1** (currency symbol):
```javascript
(() => {
  const cols = window.GraphBuilderEnhanced.getColumnConfiguration();
  const currencyCols = cols.filter(c => c.type === "currency");
  console.table(currencyCols.map(c => ({
    name: c.name, type: c.type, symbol: c.symbol || "(none)",
  })));
})();
```

**3.2.b-2** (thousand separators):
```javascript
(() => {
  const inputs = document.querySelectorAll("#gb-data-rows input[inputmode='decimal']");
  console.log("Currency/percentage inputs found:", inputs.length);
  inputs.forEach((i, n) => console.log(n, i.id, "value:", JSON.stringify(i.value)));
})();
```

**3.2.b-3** (preview stats):
```javascript
(() => {
  // Find the stats element. Check graph-builder-ui.js for the actual selector.
  const stats = document.querySelector(".gb-preview-stats, [data-preview-stats]");
  console.log("Stats element:", stats);
  console.log("Current text:", stats?.textContent);
  console.log("Current chartData rows:", window.GraphBuilder?._state?.chartData?.rows?.length);
})();
```

**3.2.b-4** (title placeholder):
```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  console.table({
    "options.plugins.title.text": chart.options.plugins.title.text,
    "options.plugins.title.display": chart.options.plugins.title.display,
    "title input value": document.getElementById("gb-chart-title")?.value,
  });
})();
```

---

## Starting message

When you begin, do **not** dump the whole plan. Instead:

1. Confirm you've re-read: this document, the masterplan's "Phase 3.2.a Implementation Results" section, and CLAUDE.md.
2. Run `git status` and `git log --oneline -1`. If 3.2.a is uncommitted, ask the user whether to commit it first under `Phase 3.2.a:` before starting any 3.2.b work.
3. Ask the user: "Ready to start Phase 3.2.b? It's four small sub-tasks: per-column currency symbol selector, thousand separators on numeric blur, preview-stats refresh on row change, and 'Chart Title' placeholder suppression. I'll do them one at a time, with diagnostic IIFEs and visual verification at each step, regression tests 2/3/4 at the end, and ask before committing. Which order would you like — currency symbol first (most user-facing), or title placeholder first (smallest change)?"

Wait for confirmation. Then proceed with the user's chosen order.

After all 4 sub-tasks pass and are committed, propose a final masterplan-update commit recording 3.2.b in the "Phase 3.2 Implementation Results" block, then propose moving to Phase 3.3 (data transformation tools) as the next major step. Phase 3.2 will then be fully shipped.

**Do not start 3.2.b until the user confirms.**
