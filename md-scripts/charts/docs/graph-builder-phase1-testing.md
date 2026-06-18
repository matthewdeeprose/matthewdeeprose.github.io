# Graph Builder Phase 1 - Manual Testing Continuation

## Context for Claude Code

Phase 1 of the Graph Builder Progressive Enhancement has been implemented. This prompt picks up manual testing from Test 4 onwards. Tests 1-3 have already passed:

- **Test 1 (basic bar chart):** Works after fixing a pre-existing bug in `graph-builder-ui.js:641` where `querySelector("h3")` was used but chart options use `<span class="gb-chart-title">`.
- **Test 2 (Advanced Column Options toggle):** Toggle appears, expands/collapses correctly.
- **Test 3 (add columns + data row sync):** Adding columns in advanced mode correctly adds input fields to data entry rows, labels update, grid adjusts. A focus-loss bug on column name typing was fixed by updating legend text in-place instead of full DOM re-render.

### What was implemented

**Files created (all under 500 lines, IIFE pattern, British spelling):**

| File | Lines | Purpose |
|------|-------|---------|
| `md-scripts/css/graph-builder-enhanced.css` | 375 | Enhanced CSS, responsive breakpoints, reduced-motion, high-contrast |
| `js/graph-builder-column-manager.js` | 223 | Column CRUD, validation, chart type compatibility |
| `js/graph-builder-csv-processor.js` | 286 | CSV parsing, delimiter/type detection, role suggestion |
| `js/graph-builder-row-sync.js` | 407 | Syncs data entry rows with column config, validation bridge |
| `js/graph-builder-enhanced.js` | 469 | Main UI orchestrator: toggle, panels, dynamic columns, suggestions |
| `js/graph-builder-testing.js` | 263 | Console test harness, integration tests, system inspector |

**Files modified:**

| File | Change |
|------|--------|
| `tools.html` | Added CSS link (line 55), 5 script tags in dependency order (lines 16147-16152) |
| `md-scripts/charts/graph-builder-ui.js` | Fixed chart type selector to fall back to `.gb-chart-title` when `h3` not found |
| `md-scripts/charts/graph-builder-data.js` | `validateFormData` and `extractFormData` now multi-column aware in advanced mode |

**Load order in tools.html:**
```
graph-builder-column-manager.js  (no deps)
graph-builder-csv-processor.js   (no deps)
graph-builder-row-sync.js        (reads Enhanced + Data via window)
graph-builder-enhanced.js        (creates ColumnManager, delegates to RowSync + CSVProcessor)
graph-builder-testing.js         (reads Enhanced)
```

**Known edge case (not a bug):** If a user enters data in the Form tab, then switches to the CSV tab and pastes multi-column CSV, the existing form data is from a different column structure. This is existing Graph Builder behaviour (tabs are independent data sources) and not a Phase 1 concern.

### Masterplan location
`md-scripts/charts/docs/graphbuilder-masterplan.md` — updated with Phase 1 results, issues encountered, and notes for Phase 2.

---

## Tests to Run

Please help me run through these tests one at a time. Start each test from a **hard refresh** of `tools.html`, navigate to **Graph Builder** mode. Ask me to report console output and visual results after each test.

### Test 4: CSV Paste (multi-column)

**Goal:** Verify that pasting multi-column CSV into the "Paste CSV" tab works with both the existing parser and the enhanced processor.

**Steps:**
1. Switch to the **Paste CSV** tab
2. Paste this CSV:
```
Student,Maths,English,Science
Alice,85,78,92
Bob,72,81,68
Charlie,91,65,88
Diana,68,90,75
Edward,77,72,83
```
3. Check: does the preview table appear? How many columns and rows does it show?
4. Run this console diagnostic:
```javascript
(() => {
  const textarea = document.getElementById('gb-csv-input');
  const results = {
    'Textarea value length': textarea ? textarea.value.trim().length : 0,
    'Commas in line 1': textarea ? (textarea.value.split('\n')[0].match(/,/g) || []).length : 0,
  };
  try {
    const parsed = window.GraphBuilderData.parseCSV(textarea.value.trim());
    results['Existing parser headers'] = parsed.headers.join(', ');
    results['Existing parser rows'] = parsed.rows.length;
  } catch (e) {
    results['Existing parser error'] = e.message;
  }
  try {
    const parsed = window.GraphBuilderEnhanced.processCSV(textarea.value.trim());
    results['Enhanced parser headers'] = parsed.headers.join(', ');
    results['Enhanced parser rows'] = parsed.rows.length;
    results['Enhanced confidence'] = (parsed.metadata.intelligentConfig.confidence * 100).toFixed(1) + '%';
  } catch (e) {
    results['Enhanced parser error'] = e.message;
  }
  console.table(results);
})();
```

**Expected results:**
- Preview table shows 4 columns (Student, Maths, English, Science) and 5 rows
- Both parsers succeed
- Enhanced parser confidence around 80-85%

---

### Test 5: Edge case guardrails

**Goal:** Verify column limits, minimum requirements, and validation rules.

**Steps:**
1. Run this in the console (no UI interaction needed):
```javascript
(() => {
  const results = {};

  // Test max 6 columns
  GraphBuilderEnhanced.setColumnConfiguration([
    { name: 'A', type: 'text', role: 'label' },
    { name: 'B', type: 'number', role: 'value' },
    { name: 'C', type: 'number', role: 'value' },
    { name: 'D', type: 'number', role: 'value' },
    { name: 'E', type: 'number', role: 'value' },
    { name: 'F', type: 'number', role: 'value' }
  ], true);
  results['7th column blocked'] = !GraphBuilderEnhanced.addColumn({ name: 'G' });
  results['At 6 columns'] = GraphBuilderEnhanced.getColumnConfiguration().length === 6;

  // Test min 2 columns
  GraphBuilderEnhanced.setColumnConfiguration([
    { name: 'X', type: 'text', role: 'label' },
    { name: 'Y', type: 'number', role: 'value' }
  ], true);
  results['Remove below 2 blocked'] = !GraphBuilderEnhanced.removeColumn(0);

  // Test validation: no value column
  GraphBuilderEnhanced.setColumnConfiguration([
    { name: 'A', type: 'text', role: 'label' },
    { name: 'B', type: 'text', role: 'label' }
  ], true);
  const v = GraphBuilderEnhanced.validateConfiguration();
  results['All-labels invalid'] = !v.valid;
  results['Error message'] = v.errors[0];

  // Test compatible chart types
  GraphBuilderEnhanced.setColumnConfiguration([
    { name: 'Month', type: 'text', role: 'label' },
    { name: 'Sales', type: 'number', role: 'value' },
    { name: 'Profit', type: 'number', role: 'value' }
  ], true);
  results['Multi-value chart types'] = GraphBuilderEnhanced.getCompatibleChartTypes().join(', ');

  // Reset to defaults
  GraphBuilderEnhanced.setColumnConfiguration([
    { name: 'Category', type: 'text', role: 'label' },
    { name: 'Value', type: 'number', role: 'value' }
  ], false);

  console.table(results);
})();
```

**Expected results:**
- `7th column blocked`: true
- `At 6 columns`: true
- `Remove below 2 blocked`: true
- `All-labels invalid`: true
- `Error message`: "At least one value column is required"
- `Multi-value chart types`: "bar, line, scatter"

---

### Test 6: Keyboard accessibility

**Goal:** Verify all enhanced elements are keyboard accessible with visible focus indicators.

**Steps (no console needed, purely visual/keyboard):**
1. Click somewhere outside the Graph Builder form to reset focus
2. **Tab** repeatedly until you reach the "Advanced Column Options" toggle
3. Press **Space** or **Enter** — the panel should expand
4. Continue **Tab**-bing through:
   - Column 1 name input
   - Column 1 type select
   - Column 1 role select
   - Column 2 name input
   - Column 2 type select
   - Column 2 role select
   - "+ Add Column" button
5. Press **Enter** on "+ Add Column" — a new column fieldset should appear
6. **Tab** to the new column's "Remove" button
7. Press **Enter** — the column should be removed
8. **Tab** back to the toggle, press **Space** — panel should collapse

**Check throughout:**
- Every interactive element has a **visible focus indicator** (blue outline)
- No focus traps (you can always tab out)
- Screen reader announcements fire on toggle expand/collapse (if you have a screen reader available)

**Report:** Describe what you observed — did focus move logically? Were indicators always visible? Any elements skipped or trapped?

---

### Test 7: Advanced mode data entry round-trip

**Goal:** Verify the full workflow: configure columns, enter data, see preview.

**Steps:**
1. In the Form tab, set Column 1 to "Student", Column 2 to "Score"
2. Click "Advanced Column Options" to expand
3. Click "+ Add Column" — configure it as: Name="Grade", Type=Text, Role=Value
4. You should now see 3-column data entry rows (Student, Score, Grade)
5. Enter data in at least 2 rows:
   | Student | Score | Grade |
   |---------|-------|-------|
   | Alice   | 85    | A     |
   | Bob     | 72    | B     |
6. Check the preview table — does it show 3 columns?
7. Run this verification:
```javascript
(() => {
  const rows = document.querySelectorAll('#gb-data-rows .gb-data-row');
  const results = {
    'Row count': rows.length,
    'Inputs per row': rows[0] ? rows[0].querySelectorAll('input').length : 0,
    'Advanced mode': GraphBuilderEnhanced.isAdvancedMode(),
    'Column count': GraphBuilderEnhanced.getColumnConfiguration().length,
  };
  const extracted = window.GraphBuilderData.extractFormData(rows, {
    col1Name: 'Student', col2Name: 'Score'
  });
  results['Extracted headers'] = extracted.headers.join(', ');
  results['Extracted rows'] = extracted.rows.length;
  if (extracted.rows[0]) {
    results['First row data'] = JSON.stringify(extracted.rows[0]);
  }
  console.table(results);
})();
```

**Expected:**
- 3 inputs per row
- Extracted headers: "Student, Score, Grade"
- First row data: `["Alice",85,"A"]` (Score parsed as number, Grade kept as text)

---

### Test 8: Deactivate advanced mode (reset)

**Goal:** Verify collapsing Advanced Column Options restores the original 2-column layout.

**Steps:**
1. With advanced mode active and 3+ columns configured, click the "Advanced Column Options" toggle to collapse it
2. Data entry rows should revert to 2 columns (Category + Value)
3. Run:
```javascript
(() => {
  const row = document.querySelector('.gb-data-row');
  const results = {
    'Advanced mode': GraphBuilderEnhanced.isAdvancedMode(),
    'Column count': GraphBuilderEnhanced.getColumnConfiguration().length,
    'Inputs in row 1': row ? row.querySelectorAll('input').length : 0,
    'Row has data-enhanced-cols': row ? row.hasAttribute('data-enhanced-cols') : false,
    'Row inline grid': row ? (row.style.gridTemplateColumns || 'none') : 'N/A',
  };
  console.table(results);
})();
```

**Expected:**
- Advanced mode: false
- Column count: 2
- Inputs in row 1: 2
- `data-enhanced-cols`: false
- Inline grid: "none" (CSS takes over)

---

### Test 9: Responsive layout

**Goal:** Verify enhanced data rows stack properly on narrow viewports.

**Steps:**
1. Activate advanced mode, add a 3rd column
2. Open browser DevTools, toggle responsive mode (or resize window to < 885px)
3. Data entry rows should stack vertically — each input on its own line
4. Resize back to full width — rows should return to horizontal grid

**Report:** Did the stacking work? Any overflow or clipping?

---

## After All Tests

Once all tests pass, report the overall results. If any test fails, paste the console output and describe what you see — we will diagnose and fix before moving on.

The masterplan at `md-scripts/charts/docs/graphbuilder-masterplan.md` should be updated with final Phase 1 test results once all tests pass.
