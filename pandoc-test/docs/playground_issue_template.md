# Issue Report: [BRIEF DESCRIPTION]

## Problem Summary
[Describe the issue concisely - what's not working as expected?]

## LaTeX Rendering Pipeline Overview

### How LaTeX is Processed in the Playground

1. **Input Stage** (`index.html`)
   - User enters LaTeX in `#input` textarea
   - Debounced input handler triggers conversion after 300ms

2. **Preprocessing Stage** (`conversion-engine.js`)
   - Document-level commands removed (e.g., `\index{}`, `\qedhere`)
   - Complexity assessment determines processing strategy
   - LaTeX expressions extracted and mapped for annotation preservation

3. **Pandoc Conversion** (`pandoc.wasm`)
   - LaTeX → HTML conversion via WebAssembly
   - Arguments: `--from latex --to html5 --mathml`
   - Enhanced arguments available via investigation mode

4. **Post-processing** (`conversion-engine.js`)
   - HTML cleaning and duplicate removal
   - Title block deduplication for chunked processing

5. **MathJax Rendering** (`mathjax-manager.js`)
   - Mathematical expressions rendered in browser
   - Accessibility features enabled (screen reader support)
   - Original LaTeX preserved for annotations

6. **Export Generation** (`export-manager.js`, `template-system.js`)
   - Self-contained HTML files with embedded dependencies
   - Accessibility compliance (WCAG 2.2 AA)
   - Font embedding and theme support

### Key Files and Responsibilities

#### Core Application Files
- **`index.html`** - Main playground interface, DOM elements, global setup
- **`js/pandoc/conversion-engine.js`** - LaTeX processing, Pandoc integration, error handling
- **`js/export/mathjax-manager.js`** - MathJax configuration and rendering
- **`js/export/export-manager.js`** - Export orchestration and file generation
- **`js/export/template-system.js`** - HTML template generation (2,500+ lines)

#### Supporting Modules
- **`js/pandoc/status-manager.js`** - UI status updates and progress indication
- **`js/pandoc/example-system.js`** - LaTeX example management
- **`js/export/latex-processor.js`** - Advanced LaTeX preprocessing
- **`js/export/content-generator.js`** - CSS and content generation

#### Testing Framework
- **`js/testing/test-utilities.js`** - Core testing infrastructure
- **`js/testing/individual/test-*.js`** - Individual module tests
- **`js/testing/integration/test-*.js`** - Integration tests

### Critical Testing Commands

Before any development work:
```javascript
const baseline = testAllSafe();
if (!baseline.overallSuccess) {
  throw new Error("Cannot begin development with failing tests");
}
```

Essential validation commands:
```javascript
testAllSafe()                    // Silent comprehensive testing
systemStatus()                   // Quick health check  
testRenderingAccuracy()          // Check for MathJax rendering errors
testAccessibilityIntegration()   // WCAG 2.2 AA compliance
testConversionEngine()           // Core conversion validation
```

### LaTeX Processing Flow

```
User Input → Preprocessing → Pandoc WASM → Post-processing → MathJax → Display
     ↓             ↓              ↓              ↓           ↓         ↓
  Raw LaTeX   Clean LaTeX    HTML + MathML   Clean HTML   Rendered   Output
```

### Common Integration Points

1. **DOM Elements** (`window.appElements`)
   - `inputTextarea` - LaTeX input
   - `outputDiv` - Rendered output
   - `argumentsInput` - Pandoc arguments

2. **Global Registries**
   - `window.originalLatexRegistry` - LaTeX expression mapping
   - `window.originalLatexByPosition` - Ordered LaTeX expressions

3. **Status Management**
   - `window.StatusManager.setLoading(message, progress)`
   - `window.StatusManager.setReady(message)`
   - `window.StatusManager.setError(message)`

## Issue Details

### Expected Behaviour
[What should happen?]

### Actual Behaviour  
[What actually happens?]

### Steps to Reproduce
1. 
2. 
3. 

### LaTeX Example (if applicable)
```latex
[Minimal LaTeX that demonstrates the issue]
```

### Browser Console Output
```
[Any error messages or relevant console output]
```

### Testing Results
[Run relevant test commands and paste results]

```javascript
// Example:
testRenderingAccuracy()
// Result: X failed commands detected...
```

## Technical Context

### Files Likely Involved
- [ ] `conversion-engine.js` (LaTeX processing)
- [ ] `mathjax-manager.js` (Mathematical rendering)
- [ ] `export-manager.js` (Export generation)
- [ ] `template-system.js` (HTML generation)
- [ ] `index.html` (UI and DOM)
- [ ] Other: ____________

### Processing Stage Where Issue Occurs
- [ ] Input preprocessing 
- [ ] Pandoc conversion
- [ ] Post-processing
- [ ] MathJax rendering
- [ ] Export generation
- [ ] UI interaction

### Browser and Environment
- Browser: _______________
- Version: _______________
- Operating System: _______

### Accessibility Impact
- [ ] Screen reader compatibility affected
- [ ] Keyboard navigation impacted  
- [ ] WCAG 2.2 AA compliance concerns
- [ ] No accessibility impact

## Proposed Solution (if any)
[Any ideas for fixing the issue]

## Additional Notes
[Any other relevant information]

---

## Development Protocol Reminder

**Single-File Development Protocol:**
1. Pre-test: Run relevant test functions (baseline)
2. Modify: Change ONE file only  
3. Immediate test: Validate changes
4. Integration test: Run `testAllSafe()` 
5. Only proceed when current file proven working

**File Modification Format:**
```
Step X of Y

FIND THIS ENTIRE BLOCK (approximately lines XXX-YYY):
```[code block]```

REPLACE WITH THIS NEW BLOCK:  
```[code block]```
```

**Testing Hierarchy:**
1. Isolated file tests
2. Integration tests
3. Cross-file tests  
4. Real-world validation
5. Performance verification