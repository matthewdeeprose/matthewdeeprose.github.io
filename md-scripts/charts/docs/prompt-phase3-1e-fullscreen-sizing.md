# Claude Code Prompt: Graph Builder Phase 3 Task 3.1.e — Fullscreen Chart Sizing Fix

**Predecessor (3.1.d bubble polish):** @md-scripts/charts/docs/prompt-phase3-1d-bubble-polish.md
**Masterplan:** @md-scripts/charts/docs/graphbuilder-masterplan.md (Phase 3.1 task list — see 3.1.e entry)
**Project conventions:** @CLAUDE.md (Graph Builder CRITICAL LOAD ORDER, IIFE + 4-level logger, 500-line max, WCAG 2.2 AA, British spelling, never-use-`title`-attribute, icons via `icon-library.js`)

---

## State at handoff

**Phase 3.1.d (Bubble visual polish) shipped — commit `47a8555` on `main`** (2026-04-26). Bubble radii now scale to 6–40 px with sqrt area-proportionality; raw datum preserved as `_rRaw`; tooltip reads the raw value; bubble interaction switched to `nearest/intersect:false` for forgiving hit-detection.

**3.1.e was discovered during 3.1.d's Test 2 regression run.** The user generated a chart, clicked the fullscreen toolbar button, and observed the chart rendering at preview size centred in the fullscreen viewport rather than filling it. Diagnostic IIFE confirmed:

| Property | Value |
|---|---|
| canvas width / height | 557 × 278 |
| canvas style w / h | `618.889px` / `308.889px` |
| container client w / h | 1405 × 1152 |
| container class | `gb-final-chart-container gb-chart-constrained chart-container view-controls-added fullscreen-mode` |
| `responsive` | `true` |
| `maintainAspectRatio` | `true` |
| `aspectRatio` | `2` |

**Root cause:** [md-scripts/css/graph-builder.css:1130-1136](../../css/graph-builder.css#L1130-L1136) defines two rules:

```css
.gb-chart-constrained {
  max-width: 800px;
}

.gb-chart-constrained.expanded {
  max-width: none !important;
}
```

The `.gb-chart-constrained` class is added unconditionally to every Graph Builder chart container at [graph-builder-charts.js:492-494](../graph-builder-charts.js#L492-L494). The `.expanded` override is keyed off the toolbar's "expand width" button — there is **no equivalent override for `.fullscreen-mode`**, so when the chart enters fullscreen it inherits the 800 px cap. With `responsive: true` + `maintainAspectRatio: true` + `aspectRatio: 2`, Chart.js fits the canvas to the constrained container and the result is a small chart centred in a large viewport.

**Not a 3.1.a/b/c/d regression** — the cap is pre-existing — but only became visible during 3.1.d testing.

Current line counts (after 3.1.d, commit `47a8555`):

| File | Lines | 3.1.e expected impact |
|---|---|---|
| [md-scripts/css/graph-builder.css](../../css/graph-builder.css) | (large) | +3 lines (one new rule). Well under any threshold. |
| Everything else | unchanged | No JS, HTML, or other CSS files expected to change. |

---

## Working protocol — read carefully

These rules carry forward from 3.1.a/b/c/d:

1. **One test at a time.** Never paste multiple acceptance tests into a single message. Send one, wait, assess, send the next.
2. **Lead the user through testing.** For each test, give: the Stage 1 setup IIFE → click sequence → Stage 4 verification IIFE (or interaction step) → expected result.
3. **Make test setup IIFEs fully self-contained.** Paste-and-go — no multi-step manual data entry.
4. **Assess each result before proceeding.** Read returned `console.table` output. Don't skip.
5. **Keep message bodies short.** The user is on Windows over OneDrive with rendering preferences for compact output.
6. **Never bulk-prompt.** No "here are all the tests" mega-messages.
7. **Commit only on explicit approval.** After all acceptance + regression tests pass, ask "ready to commit?" and hold until they say yes.
8. **Regression sweep before commit.** Phase 2.5 Tests 2/3/4 must pass after the CSS change, plus a fullscreen visual confirmation on bubble (Test 9 setup) since that's the chart type whose preview was most affected by 3.1.d.

### Regression test reference (use exactly these — known-passing as of `47a8555`)

**Test 2 — advanced multi-series currency bar:**
- 3 cols (`Month`/text-label, `Sales`/currency-value, `Returns`/currency-value), 4 rows Jan/Feb/Mar/Apr, **bar** chart.
- Expected: `datasets count: 2`, `y-axis title: "Amount (£)"`, y tick `500 → "£500"`, `x scale type: "category"`, `first bar value: 1200`, `dataset[0].type: undefined`.

**Test 3 — advanced date-axis line:**
- 3 cols (`Date`/date-label, `Revenue`/number-value, `Profit`/number-value), 4 rows out-of-order (Mar/Jan/Apr/Feb 2024), **line** chart.
- Expected: `x scale type: "time"`, chronological sort (`first data y: 1000`, `last data y: 1800`), `labels[0] month: 0`, `labels[0] year: 2024`, `maxTicksLimit: 12`, `autoSkip: true`, `dataset[0].type: undefined`, `dataset[0].fill: false`.

**Test 4 — basic mode byte-identity (the non-negotiable):**
- Advanced mode **OFF**, basic 2-column apples=10/oranges=20 bar chart. Inputs use `document.getElementById("gb-row-1-col1")` (no hyphen between "col" and the digit).
- Expected: `datasets count: 1`, `dataset[0].data: [10,20]`, `config._gbEnhanced: undefined`, toolbar present under `.chart-controls`.

**Test 9 — bubble radius scaling (3.1.d):**
- 4 rows, Headcount 30/50/80/120 with negative growth on West.
- Expected: `min visual r (px) >= 6`, `max visual r (px) <= 40`, `_rRaw` preserved as `[80, 50, 120, 30]`, ordering preserved.

---

## Sub-task 3.1.e — Fullscreen chart sizing fix

### Objective

Make Graph Builder charts fill the available viewport when entered into fullscreen mode, while preserving the existing 800 px cap in normal preview mode and the existing `.expanded` toolbar-button override.

### Scope

**One file. One CSS rule.**

| File | Change |
|---|---|
| [md-scripts/css/graph-builder.css](../../css/graph-builder.css) | Add a `.gb-chart-constrained.fullscreen-mode` rule that lifts the `max-width: 800px` cap. Place immediately after the existing `.expanded` override (line ~1136) so the two override rules sit together. |

### The fix

```css
.gb-chart-constrained.fullscreen-mode {
  max-width: none !important;
}
```

Three lines. `!important` matches the `.expanded` rule's specificity strategy — required because the base `.gb-chart-constrained` rule is widely-applied and the cascade order isn't otherwise predictable when both classes are present.

### Why not a JS change?

The `fullscreen-mode` class is already added/removed by the existing chart toolbar's fullscreen toggle (see [chart-view-controls.js](../chart-view-controls.js) — search for `fullscreen-mode`). The class lifecycle is correct; only the CSS is missing the corresponding override. JS changes are out of scope for 3.1.e.

### Acceptance test 11 — fullscreen canvas size

Reuse the 3.1.d Test 9 bubble setup (4 rows, Headcount 30/50/80/120). After generating the chart at Stage 4, click the fullscreen button on the chart toolbar (the icon expands the chart to viewport size). Then paste this verification IIFE into the console:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  const canvas = chart.canvas;
  const container = canvas.parentElement;
  const styleW = parseFloat(canvas.style.width) || 0;
  const containerW = container.clientWidth;
  const fillRatio = styleW / containerW;
  console.table({
    "container w (px)":     containerW,
    "container has fs class": container.classList.contains("fullscreen-mode"),
    "canvas style w (px)":  canvas.style.width,
    "canvas style h (px)":  canvas.style.height,
    "fill ratio":           fillRatio.toFixed(3),
    "fills viewport":       fillRatio >= 0.9,
    "responsive":           chart.options.responsive,
    "aspectRatio":          chart.options.aspectRatio,
  });
})();
```

**Expected:**

| Key | Value |
|---|---|
| `container has fs class` | `true` (sanity check — fullscreen actually entered) |
| `canvas style w` | a number close to `container w` (e.g. ~1400 px in a fullscreen 1405×1152 viewport) |
| `fill ratio` | `>= 0.9` (canvas fills at least 90% of container width, accounting for any padding) |
| `fills viewport` | `true` |
| `responsive` | `true` |
| `aspectRatio` | `2` (preserved — height auto-scales to maintain ratio) |

**Visual:** The bubble chart should fill most of the fullscreen viewport. Bubbles still 6–40 px, axis labels readable, no excessive whitespace around the canvas. Press Esc or click "Exit Fullscreen" — the chart should return to its normal preview size (≤ 800 px wide).

### Acceptance test 12 — non-fullscreen preview unchanged

Reload, run any setup (Test 2 / 3 / 9 — pick one), generate the chart, but **do NOT enter fullscreen**. Paste:

```javascript
(() => {
  const chart = window.GraphBuilderCharts.getChartRegistry().final;
  const canvas = chart.canvas;
  const container = canvas.parentElement;
  const styleW = parseFloat(canvas.style.width) || 0;
  console.table({
    "container has fs class": container.classList.contains("fullscreen-mode"),
    "container has expanded": container.classList.contains("expanded"),
    "canvas style w (px)":  canvas.style.width,
    "canvas style w <= 800": styleW <= 800,
  });
})();
```

**Expected:**

| Key | Value |
|---|---|
| `container has fs class` | `false` |
| `container has expanded` | `false` |
| `canvas style w <= 800` | `true` (cap preserved in normal preview mode) |

This confirms the 3.1.e CSS rule didn't accidentally remove the cap from non-fullscreen contexts.

### Non-goals

- Changing the 800 px cap value itself — Phase 3.2+ if reconsidered.
- Touching the `.expanded` toolbar override — already correct.
- Modifying the fullscreen toggle JS — already correct.
- Changing aspect ratio behaviour — Chart.js's `aspectRatio: 2` stays as-is.
- Mobile / touch responsive breakpoints — Phase 3.2 UX backlog.

---

## What to avoid

- **Do not change `.gb-chart-constrained`'s base `max-width: 800px`** — the cap is correct for normal preview.
- **Do not remove the `.expanded` rule** — the toolbar's "expand width" button still depends on it.
- **Do not add the override anywhere other than [md-scripts/css/graph-builder.css](../../css/graph-builder.css)** — the file is the single source of truth for Graph Builder chart styling.
- **Do not add `!important` to additional unrelated rules** to "match" the new rule's specificity. The `!important` is scoped to this one override and matches the existing `.expanded` precedent.
- **Do not refactor `graph-builder-charts.js`** — out of scope.
- **Do not change basic mode** — Test 4 byte-identity is non-negotiable.
- **Do not commit proactively.** Await explicit approval.
- **Do not skip the regression sweep.** Tests 2/3/4 + Test 9 + acceptance Tests 11/12 — all must pass before commit.

---

## Starting message

When you begin, do **not** dump the whole plan. Instead:

1. Confirm you've re-read: this document, [prompt-phase3-1d-bubble-polish.md](./prompt-phase3-1d-bubble-polish.md), and the masterplan's Phase 3 task list (3.1.e entry).
2. Ask the user: "Ready to apply Phase 3.1.e (fullscreen chart sizing fix — 3-line CSS override)? I'll add the rule, then run acceptance Tests 11 (fullscreen fills viewport) and 12 (non-fullscreen preview cap preserved), then re-run regression Tests 2/3/4 + Test 9 one at a time before asking to commit."

After they confirm, proceed in this order:

1. **Add the CSS rule** in [md-scripts/css/graph-builder.css](../../css/graph-builder.css) immediately after the `.gb-chart-constrained.expanded` block.
2. **Run Test 11** (fullscreen fills viewport) — bubble chart, enter fullscreen, paste verification IIFE.
3. **Run Test 12** (non-fullscreen preview cap preserved) — fresh chart, do NOT enter fullscreen, paste verification IIFE.
4. **Re-run Test 9** (bubble radius scaling) — confirms 3.1.d behaviour unaffected.
5. **Re-run regressions Tests 2, 3, 4** — confirms bar/line/basic paths unaffected.
6. **Optional visual spot-check:** ask the user to enter fullscreen on a bar chart and a line chart and confirm both fill the viewport.

Only after all acceptance + regression tests pass with user confirmation, ask to commit. Commit message prefix: `Phase 3.1.e:`.

After 3.1.e is committed, propose a **final masterplan update commit** extending the Phase 3.1 Implementation Results block to cover 3.1.e (completion date, files modified, test results, notes for Phase 3.2). Commit prefix: `Phase 3.1 docs:`.

**Do not start 3.1.e until the user confirms.**
