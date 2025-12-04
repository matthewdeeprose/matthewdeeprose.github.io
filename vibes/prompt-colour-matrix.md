# Creating a dynamic colour contrast matrix using chroma.js, semantic html, vanilla javascript and css

## Details

### Overview
A single-page web application that generates a colour contrast accessibility matrix. Users input colour palette hex codes (with optional vanity names), and the tool calculates WCAG contrast ratios for all foreground/background combinations, displaying results in an interactive, filterable matrix.

---

### Input Specification

| Aspect | Detail |
|--------|--------|
| Input element | Single `<textarea>` |
| Format | One colour per line |
| Accepted formats | `name, #hex` / `#hex, name` / `name: #hex` / `#hex` alone |
| Delimiters | Comma `,` Tab `\t` Pipe `|` Colon `:` |
| Hash symbol | Optional (accepts `FFFFFF` or `#FFFFFF`) |
| Validation | Real-time; highlight invalid lines in red with error message |
| Generate button | Disabled until ≥2 valid colours entered |
| Example button | Populates textarea with example palette |

**Example Palette:**
```
Snow White, #F8F9FA
Sunset Orange, #F57C00
Midnight Coal, #151414
Lush Green, #4CAF50
Sky Blue, #2196F3
```

---

### Matrix Specification

| Aspect | Detail |
|--------|--------|
| Structure | Foreground colours = columns; Background colours = rows |
| Cell display | Configurable: Rating only / Ratio only / Both |
| Contrast thresholds | F: <3 / G: ≥3 & <4.5 / AA: ≥4.5 & <7 / AAA: ≥7 |
| Cell backgrounds | Colour-coded per rating level |
| Responsive | CSS-based responsive design (single table) |

**Rating Background Colours (Light Mode):**
- F: `#E0E0E0` (neutral grey)
- G: `#B3DBD2` (soft teal)
- AA: `#FCBC00` (amber)
- AAA: `#C1D100` (lime green)

**Rating Background Colours (Dark Mode):**
- Adjusted versions maintaining sufficient contrast

---

### Controls Specification

| Control Group | Controls |
|---------------|----------|
| Display mode | Radio buttons: Rating / Ratio / Both |
| WCAG filters | Buttons: Show G+ / Show AA+ / Show AAA+ / Reset |
| Column filters | Checkbox per colour (show/hide columns) |
| Row filters | Checkbox per colour (show/hide rows) |
| Focus colour | Button per colour (highlights and filters) |
| Table sizing | Buttons: Fit to page / Full size |
| Dark mode | Toggle button + automatic `prefers-color-scheme` |
| CVD simulation | Buttons: Reset / Protanopia / Deuteranopia / Tritanopia |
| Export | Button: Download CSV |

---

### Features Specification

| Feature | Implementation |
|---------|----------------|
| CVD simulation | SVG filters applied via CSS classes |
| CSV export | Full data: names, hex codes, all combinations with rating and ratio |
| Print | Print stylesheet showing matrix and explanatory key |
| Accessibility | WCAG 2.2 AA compliant, semantic HTML, skip link, ARIA where needed |
| Dark mode | CSS custom properties + `prefers-color-scheme` + manual toggle |

---

### Page Structure

1. **Skip link** (hidden until focused)
2. **Header**: Title "Colour Palette Accessibility Matrix" + brief explanation
3. **Input section**: Textarea, validation feedback, Generate button, Example button
4. **Controls section** (hidden until matrix generated): All filter/display controls in fieldsets
5. **Live region** for button feedback (like original `#buttonHelp`)
6. **Matrix section**: Generated table
7. **Explanatory key**: Collapsible `<details>` explaining F, G, AA, AAA with WCAG links
8. **Footer**: Chroma.js credit
9. **SVG filters** (hidden): For CVD simulation

---

### Technical Specification

| Aspect | Detail |
|--------|--------|
| Dependencies | Chroma.js from `https://matthewdeeprose.github.io/scripts/chroma.min.js` |
| Output | Single HTML file with embedded CSS and JS |
| JavaScript | Vanilla JS only (no jQuery) |
| Spelling | British English throughout (colour, initialised, etc.) |
| CSS | Custom properties for theming |

---

## The Prompt

Here is the prompt designed for one-shot generation:

---

**PROMPT BEGINS**

---

Create a single HTML file for a "Colour Palette Accessibility Matrix" tool. This tool allows users to input hex colour codes with optional vanity names, then generates an interactive matrix showing WCAG contrast compliance for all foreground/background colour combinations.

## Technical Requirements

- **Single HTML file** with all CSS in a `<style>` tag and all JS in a `<script>` tag
- **Vanilla JavaScript only** (no jQuery or other libraries)
- **British English spelling** throughout (colour, initialised, centre, etc.) except where American spelling is required for code (e.g., `background-color` in CSS)
- **WCAG 2.2 AA compliant**: semantic HTML, sufficient colour contrast, keyboard accessible, focus visible, ARIA where beneficial
- **Load Chroma.js** from: `https://matthewdeeprose.github.io/scripts/chroma.min.js`

## Page Structure

### 1. Skip Link
Hidden skip link that becomes visible on focus, linking to main content.

### 2. Header
- `<h1>`: "Colour Palette Accessibility Matrix"
- Brief explanatory paragraph about the tool's purpose

### 3. Input Section
- `<label>` and `<textarea>` for colour input (one colour per line)
- Placeholder text showing example format
- Validation feedback area (shows errors for invalid lines)
- Two buttons:
  - "Generate Matrix" (disabled until ≥2 valid colours)
  - "Load Example Palette"

**Input Parsing Rules:**
- Accept formats: `name, #hex` | `#hex, name` | `name: hex` | `hex` alone
- Delimiters: comma, tab, pipe, colon
- Hash symbol optional
- Validate hex codes (3 or 6 character hex)
- Display name as "Name (#HEXCODE)" when name provided, otherwise just "#HEXCODE"

**Example Palette (for Load Example button):**
```
Snow White, #F8F9FA
Sunset Orange, #F57C00
Midnight Coal, #151414
Lush Green, #4CAF50
Sky Blue, #2196F3
```

### 4. Controls Section
Hidden initially; shown after matrix generation. Organised in fieldsets:

**Fieldset: Matrix Controls**
- Button: "Reset" (reloads page)
- Button: "Fit Table to Page"
- Button: "Full Size Table"

**Fieldset: Display Results As**
- Radio buttons: "Rating" (default checked) | "Ratio" | "Rating and Ratio"

**Fieldset: Filter by WCAG Level**
- Button: "Reset Filter" (disabled by default)
- Button: "Show G, AA, AAA only"
- Button: "Show AA, AAA only"
- Button: "Show AAA only"

**Fieldset: Filter Columns**
- "Select All" checkbox
- One checkbox per colour (dynamically generated)

**Fieldset: Filter Rows**
- "Select All" checkbox
- One checkbox per colour (dynamically generated)

**Fieldset: Focus Colour**
- One button per colour (dynamically generated)
- When clicked: highlights that colour's row and column, hides colours that don't have any passing contrast with the focus colour

**Fieldset: Colour Vision Simulation**
- Button: "Reset to Trichromacy" (disabled by default)
- Button: "Simulate Protanopia"
- Button: "Simulate Deuteranopia"
- Button: "Simulate Tritanopia"

**Fieldset: Export**
- Button: "Download CSV"

**Fieldset: Theme**
- Button: "Toggle Dark/Light Mode"

### 5. Live Feedback Region
`<div>` with `aria-live="polite"` that displays feedback when buttons are pressed (e.g., "Showing AA and AAA combinations only").

### 6. Matrix Section
`<table>` with:
- `<caption>` describing the matrix
- First row: empty corner cells, then column headers (colour hex/name)
- Second row: empty corner cells, then colour swatches (small coloured cells)
- Subsequent rows: row header (colour hex/name), row swatch, then result cells

**Result Cells:**
- Show rating (F/G/AA/AAA), ratio (e.g., "4.5:1"), or both based on display mode
- Background colour based on rating:
  - F: `--rating-f` (neutral grey)
  - G: `--rating-g` (teal)
  - AA: `--rating-aa` (amber)
  - AAA: `--rating-aaa` (lime green)
- Add appropriate classes for filtering (e.g., `result-f`, `result-g`, `result-aa`, `result-aaa`)

**Contrast Calculation (using chroma.js):**
```javascript
const ratio = chroma.contrast(foreground, background);
// F: ratio < 3
// G: ratio >= 3 && ratio < 4.5
// AA: ratio >= 4.5 && ratio < 7
// AAA: ratio >= 7
```

### 7. Explanatory Key
`<details>` element (collapsible) containing:
- Explanation of each rating level (F, G, AA, AAA)
- What each level is suitable for
- Links to relevant WCAG 2.1 Success Criteria:
  - 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
  - 1.4.6 Contrast (Enhanced): https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html
  - 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

### 8. Footer
Credit line: "Contrast calculations powered by Chroma.js"

### 9. SVG Filters (Hidden)
Include SVG filters for colour vision deficiency simulation:

```html
<svg style="height: 0; width: 0; position: absolute;">
  <!-- Protanopia filter -->
  <filter id="protanopia" color-interpolation-filters="linearRGB">
    <feColorMatrix type="matrix" in="SourceGraphic" values="
      0.10889,0.89111,-0.00000,0,0
      0.10889,0.89111,0.00000,0,0
      0.00447,-0.00447,1.00000,0,0
      0,0,0,1,0"/>
  </filter>
  
  <!-- Deuteranopia filter -->
  <filter id="deuteranopia" color-interpolation-filters="linearRGB">
    <feColorMatrix type="matrix" in="SourceGraphic" values="
      0.29031,0.70969,-0.00000,0,0
      0.29031,0.70969,-0.00000,0,0
      -0.02197,0.02197,1.00000,0,0
      0,0,0,1,0"/>
  </filter>
  
  <!-- Tritanopia filter -->
  <filter id="tritanopia" color-interpolation-filters="linearRGB">
    <feColorMatrix type="matrix" in="SourceGraphic" result="ProjectionOnPlane1" values="
      1.01354, 0.14268, -0.15622, 0, 0
      -0.01181, 0.87561, 0.13619, 0, 0
      0.07707, 0.81208, 0.11085, 0, 0
      7.92482, -5.66475, -2.26007, 1, -0.2"/>
    <feComponentTransfer in="ProjectionOnPlane1" result="ProjectionOnPlane1">
      <feFuncA type="discrete" tableValues="0 0 0 0 1"/>
    </feComponentTransfer>
    <feColorMatrix type="matrix" in="SourceGraphic" result="ProjectionOnPlane2" values="
      0.93337, 0.19999, -0.13336, 0, 0
      0.05809, 0.82565, 0.11626, 0, 0
      -0.37923, 1.13825, 0.24098, 0, 0
      0,0,0,1,0"/>
    <feBlend in="ProjectionOnPlane1" in2="ProjectionOnPlane2" mode="normal"/>
  </filter>
</svg>
```

## CSS Requirements

### CSS Custom Properties
```css
:root {
  /* Base colours - Light Mode */
  --bg-primary: #FFFFFC;
  --bg-secondary: #F5F5F5;
  --text-primary: #1A1A1A;
  --text-secondary: #4D4D4D;
  --accent-primary: #0066CC;
  --accent-hover: #004C99;
  --border-standard: #CCCCCC;
  --focus-outline: #0066CC;
  
  /* Rating backgrounds - Light Mode */
  --rating-f: #E0E0E0;
  --rating-g: #B3DBD2;
  --rating-aa: #FCBC00;
  --rating-aaa: #C1D100;
  --rating-text: #1A1A1A;
  
  /* Button colours */
  --button-bg: #002E3B;
  --button-text: #FFFFFC;
  --button-hover: #004D5C;
  --button-disabled-bg: #CCCCCC;
  --button-disabled-text: #666666;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Base colours - Dark Mode */
    --bg-primary: #1A1A1A;
    --bg-secondary: #2A2A2A;
    --text-primary: #F5F5F5;
    --text-secondary: #B3B3B3;
    --accent-primary: #66B3FF;
    --accent-hover: #99CCFF;
    --border-standard: #4D4D4D;
    --focus-outline: #66B3FF;
    
    /* Rating backgrounds - Dark Mode (adjusted for contrast) */
    --rating-f: #3D3D3D;
    --rating-g: #1A5C52;
    --rating-aa: #8B6914;
    --rating-aaa: #5C6300;
    --rating-text: #F5F5F5;
    
    /* Button colours */
    --button-bg: #4A9FB8;
    --button-text: #1A1A1A;
    --button-hover: #5CB8D1;
    --button-disabled-bg: #3D3D3D;
    --button-disabled-text: #808080;
  }
}

/* Manual theme override */
[data-theme="light"] {
  /* Light mode values */
}
[data-theme="dark"] {
  /* Dark mode values */
}
```

### CVD Simulation Classes
```css
.cvd-protanopia { filter: url(#protanopia); }
.cvd-deuteranopia { filter: url(#deuteranopia); }
.cvd-tritanopia { filter: url(#tritanopia); }
```

### Responsive Table
Use CSS to make the table scrollable horizontally on small screens while maintaining row headers visible.

### Print Styles
```css
@media print {
  /* Hide controls, input section, buttons */
  /* Show matrix and explanatory key */
  /* Ensure rating backgrounds print */
}
```

### Focus States
All interactive elements must have visible focus indicators using `--focus-outline`.

## JavaScript Requirements

### Logging Configuration
Include configurable logging as per user preferences:
```javascript
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;
// ... logging functions
```

### Key Functions Needed

1. **parseColourInput(text)**: Parse textarea content, return array of {name, hex} objects or validation errors

2. **validateHex(hex)**: Check if string is valid 3 or 6 character hex

3. **calculateContrast(fg, bg)**: Use chroma.contrast() and return {ratio, rating}

4. **generateMatrix(colours)**: Build and insert the table HTML

5. **applyWcagFilter(minLevel)**: Show/hide cells based on minimum rating level

6. **toggleColumn(colourHex, visible)**: Show/hide a column

7. **toggleRow(colourHex, visible)**: Show/hide a row

8. **focusColour(colourHex)**: Highlight colour's row/column, hide non-contrasting colours

9. **setDisplayMode(mode)**: Switch between 'rating', 'ratio', 'both'

10. **applyCvdSimulation(type)**: Apply/remove CVD filter classes

11. **toggleDarkMode()**: Toggle `data-theme` attribute

12. **exportCsv()**: Generate and download CSV with full data

13. **fitTableToPage()** / **fullSizeTable()**: Adjust table sizing

### Event Handling
Use `onclick` attributes on buttons where appropriate, as per user preferences.

### CSV Export Format
```
Foreground Name,Foreground Hex,Background Name,Background Hex,Contrast Ratio,WCAG Rating
Snow White,#F8F9FA,Midnight Coal,#151414,16.3:1,AAA
...
```

## Accessibility Checklist

- [ ] Skip link to main content
- [ ] Semantic HTML (`<header>`, `<main>`, `<nav>`, `<footer>`, `<fieldset>`, `<legend>`)
- [ ] All form inputs have associated labels
- [ ] Buttons have accessible names
- [ ] `aria-disabled` alongside `disabled` attribute on buttons
- [ ] `aria-live` region for dynamic feedback
- [ ] Colour not sole means of conveying information (ratings have text)
- [ ] Focus visible on all interactive elements
- [ ] Table has `<caption>` and proper `<th>` scope attributes
- [ ] Print stylesheet tested
- [ ] Keyboard navigation works throughout