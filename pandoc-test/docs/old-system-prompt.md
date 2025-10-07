# Enhanced Pandoc-WASM Mathematical Playground - System Prompt

## Project Mission
Browser-based tool converting LaTeX mathematical documents into fully accessible, self-contained HTML files. Primary focus: university STEM education accessibility for disabled students, particularly those using screen readers.

## Current Architecture Status: **PRODUCTION READY**

### **Core Module System (16 Modules)**
```
📦 Enhanced Pandoc-WASM Mathematical Playground
├── 📄 pandoc_playground.html (Main application entry point)
├── 📁 fonts/
│   ├──AnnotationMono-VF.txt
│   ├──opendyslexic-bold-italic.txt
│   ├──opendyslexic-bold.txt
│   ├──opendyslexic-italic.txt
│   ├──opendyslexic-regular.txt
├── 📁 wasm/ 
│   ├── pandoc.wasm
├── 📁 templates/ 
│   ├── 📋 embedded-fonts.html
│   ├── 📋 reading-tools-section.html (Font, spacing, width controls)
│   ├── 🎨 theme-toggle-section.html (Light/dark theme switching)  
│   ├── 🖨️ print-button-section.html (Print functionality)
│   ├── 🔄 reset-controls-section.html (Reset accessibility settings)
│   ├── 📊 mathjax-accessibility-controls.html (MathJax interaction controls)
│   ├── 📄 integrated-document-sidebar.html (Document navigation sidebar)
│   ├── 📑 table-of-contents.html (Auto-generated ToC template)
│   ├── 🎨 prism-css.html (Syntax highlighting styles)
│   ├── ⚡ prism-js.html (Custom Prism.js build)
│   ├── 🏆 credits-acknowledgements.html (Credits and acknowledgements)
│   ├── 🔔 universal-modal.html (Modal dialog template)
│   ├── 📬 universal-notifications.html (Notification system template)
│   └── 📁 partials/ (Reusable template components)
│       ├── font-option.html (Individual font selection option)
│       ├── width-option.html (Reading width control option)
│       └── zoom-option.html (Zoom level control option)
│   └── 📁 js
│       └── adaptive-background-manager.js (change background colour but ensure sufficient contrast
│       └── chroma-js-embedded.js (embed chroma.js in exports)
│       └── export-validation.js (validate latex quality of exports)
│       └── latex-annotation-enhancer.js (add latex annotations utilising the original latex source)
│       └── mathjax-promise-utility.js (utility to help synchronize your code with MathJax)
│       └── focus-tracking.js
│       └── form-initialization.js
│       └── initialization.js
│       └── mathjax-controls.js
│       └── reading-accessibility-manager-class.js
│       └── theme-management.js
│       └── download-monitor.js
│       └── universal-modal.js (Modal system JavaScript)
│       └── universal-notifications.js (Notification system JavaScript)
├── 📁 css/
│   └── 🎨 playground-styles.css (WCAG 2.2 AA compliant styling)
│   └── 🎨 modal-styles.css (Modal system styles)
│   └── 🎨 universal-notifications-playground.css (Notification styles)
├── 📁 examples/
│   └── 📚 examples.json (External example library)
└── 📁 js/
    ├── 📁 export/ (Document export and generation modules - 7 files)
    │   ├── 🔧 app-config.js (376 lines) 
    │   ├── ⚙️ mathjax-manager.js (398 lines) 
    │   ├── 📝 latex-processor.js (389 lines)
    │   ├── 🎨 content-generator.js (387 lines)
    │   ├── 🏗️ template-system.js (2,500+ lines) - External Templates
    │   ├── 📤 export-manager.js (398 lines)
    │   ├── 📤 scorm-export-manager.js - Scorm content creation
    │   └── 📄 source-viewer.js - Source code viewing with syntax highlighting
    │
    ├── 📁 pandoc/ (Main application modules - 6 files)
    │   ├── 📚 example-system.js
    │   ├── 📊 status-manager.js
    │   ├── ⚡ conversion-engine.js - Enhanced Error Handling
    │   ├── 🎮 event-manager.js
    │   ├── 🚀 app-state-manager.js
    │   └── 🔍 layout-debugger.js (Optional)
    │
    └── 📁 testing/ 
        ├── 📁 individual/ 
        │   ├── test-adaptive-background.js 	
        │   ├── test-app-config.js 
        │   ├── test-comprehensive-latex-syntax.js
		│   ├── test-content-generator.js
		│   ├── test-conversion-engine.js		
		│   ├── test-download-monitor.js	
        │   ├── test-mathjax-manager.js 
        │   ├── test-latex-processor.js 
        │   ├── test-content-generator.js 
        │   ├── test-template-system.js 
        │   ├── test-export-manager.js 
        │   ├── test-source-viewer.js 
        │   ├── test-example-system.js 
        │   ├── test-status-manager.js 
        │   ├── test-conversion-engine.js 
        │   ├── test-event-manager.js 
        │   ├── test-app-state-manager.js 
        │   ├── test-layout-debugger.js 
        │   ├── test-universal-modal.js 
        │   └── test-universal-notifications.js 
        │
        ├── 📁 integration/ (4 integration test files) ✅ All working
        │   ├── test-export-pipeline.js 
        │   ├── test-modular-integration.js 
        │   ├── test-accessibility-integration.js 
        │   └── test-performance.js 
        │
        ├── 📁 comprehensive/ (1 high-level orchestrator)
        │   └── test-runner.js ✅ High-level test orchestration
        │
        ├── 🔧 test-utilities.js ✅ CORE TESTING UTILITIES - Fully functional
        ├── 🔧 test-framework.js ✅ TEST COORDINATOR - Working
        └── 🔧 test-registry.js ✅ TEST DISCOVERY & MANAGEMENT - Working
```

### **Critical Loading Order**
```html
<!-- Export System (Foundation) -->
<script src="./js/export/app-config.js"></script>
<script src="./js/export/mathjax-manager.js"></script>
<script src="./js/export/latex-processor.js"></script>
<script src="./js/export/content-generator.js"></script>
<script src="./js/export/template-system.js"></script>
<script src="./js/export/export-manager.js"></script>
<script src="./js/export/scorm-export-manager.js"></script>
<script src="./js/export/source-viewer.js"></script>

<!-- Application Modules -->
<script src="./js/pandoc/example-system.js"></script>
<script src="./js/pandoc/status-manager.js"></script>
<script src="./js/pandoc/conversion-engine.js"></script>
<script src="./js/pandoc/event-manager.js"></script>
<script src="./js/pandoc/app-state-manager.js"></script>

<!-- Testing Framework -->
<script src="./js/testing/test-utilities.js"></script>
```

## **New Features (Recently Added)**

### **1. SCORM Export System** ✅
- **SCORM 2004 3rd Edition** compliance
- ZIP package generation with manifest and metadata
- LMS upload instructions modal
- Instructor documentation included

### **2. Universal Modal System** ✅  
- **WCAG 2.2 AA** compliant modal dialogs
- Multiple size variants (small, medium, large, fullscreen)
- Custom content and button support
- Integrated with SCORM export instructions
- **Embedded in exports**: All modal functionality works in exported HTML files
- **Promise-based API**: `UniversalModal.confirm()`, `UniversalModal.alert()`, `UniversalModal.custom()`
- **Legacy compatibility**: Backward compatible with existing modal calls
- **In-modal status**: Context-aware status messages that appear within active modals

### **3. Universal Notifications** ✅
- Toast notification system with automatic modal integration
- Success, error, warning, info, loading notification types  
- **Context-aware behavior**: Automatically switches between toast mode (no modal) and in-modal status mode (when modal is active)
- **Backward compatible** with existing notification functions
- Screen reader announcements with `aria-live` regions
- **Self-contained in exports**: Works offline in exported HTML files
- **Global shortcuts**: `notifySuccess()`, `notifyError()`, `notifyWarning()`, `notifyInfo()`

### **4. Enhanced Template System** ✅
- **External JavaScript Templates**: 9+ JS templates in templates/js/
- Template engine now handles both HTML and JavaScript generation
- Modular accessibility component generation
- **Modal & Notification templates**: Embedded universal-modal.js and universal-notifications.js

### **5. Source Viewer System** ✅
- **Embedded source viewing** in all exports with syntax highlighting
- **Comprehensive language detection**: 50+ Pandoc format mappings
- **Custom Prism.js integration** with LaTeX, Markdown, and common programming languages
- **Template-based architecture** for maintainable code
- **Credits and acknowledgements** section with customisable attribution
- **Full accessibility compliance** with WCAG 2.2 AA standards
- **Self-contained exports** with no CDN dependencies

### **6. Modal & Notification Integration in Exports** ✅
- **Automatic context detection**: Notifications switch behavior based on modal state
- **Rich user interactions**: Confirmation dialogs, progress tracking, error handling
- **Accessibility-first design**: Screen reader compatible, keyboard navigable
- **Common patterns**: Document operations, form validation, progress tracking, error recovery

## **Testing Framework - Essential Commands**

### **Primary Validation Commands**
```javascript
testAllSafe()              // ✅ Silent comprehensive testing 
systemStatus()             // Quick health check
testAllModules()           // Individual module tests (16)
testAllIntegration()       // Integration tests (4)
```

### **New Feature Testing**
```javascript
testSCORMExportManager()     // Test SCORM export functionality
testSourceViewer()           // Test source viewer and language detection
testUniversalModal()         // Test modal system functionality
testUniversalNotifications() // Test notification system functionality
testJSMigration()           // Test JavaScript template migration
```

### **Modal & Notification Testing**
```javascript
testUniversalModal()                    // Complete modal functionality
testUniversalNotifications()            // Complete notification functionality
window.UniversalModal.quickDiagnostic() // Modal system diagnostic
testAccessibilityIntegration()          // WCAG compliance validation
```

### **Source Viewer Specific Testing**
```javascript
testSourceViewer()                    // Complete source viewer functionality
window.SourceViewer.testSourceViewer() // Direct module testing
testAccessibilityIntegration()         // WCAG compliance validation
```

### **Pre-Development Protocol**
```javascript
// MANDATORY: Run before any development
const baseline = testAllSafe();
if (!baseline.overallSuccess) {
  throw new Error("Cannot begin development with failing tests");
}
```

## **Using Modals & Notifications in Exports**

### **Quick Start Examples**
```javascript
// Simple notifications
UniversalNotifications.success("Document saved!");
UniversalNotifications.error("Save failed - please try again");

// Confirmation with promise
const confirmed = await UniversalModal.confirm("Delete this section?");
if (confirmed) {
  // Proceed with deletion
  UniversalNotifications.success("Section deleted");
}

// Custom modal with form
const userInput = await UniversalModal.custom(`
  <p>Enter your name:</p>
  <input type="text" id="userName" style="width: 100%; padding: 0.5rem;">
`, {
  title: "User Information",
  buttons: [
    { text: "Submit", type: "primary", action: () => 
      document.getElementById('userName').value 
    },
    { text: "Cancel", type: "secondary", action: false }
  ]
});
```

### **Context-Aware Behavior**
The notification system automatically detects modal state:
- **No modal active**: Shows notifications as toast popups
- **Modal active**: Shows notifications as in-modal status messages
- **Seamless transitions**: Automatically switches between modes

### **Common Use Cases**
- **Document operations**: Save confirmations, export progress
- **Form validation**: Error messages, success confirmations  
- **User guidance**: Step-by-step processes, help dialogs
- **Error handling**: Graceful degradation, retry mechanisms

## **Accessibility Requirements (Critical)**

### **WCAG 2.2 AA Standards**
- **Colour Contrast**: 4.5:1 normal text, 3:1 large text
- **Keyboard Navigation**: Full functionality via keyboard
- **Screen Reader Support**: Semantic markup, ARIA labels, MathML
- **Mathematical Accessibility**: MathJax context menus, equation explorer
- **Source Code Accessibility**: Syntax-highlighted code with screen reader support
- **Modal Accessibility**: Focus management, escape key support, aria-live announcements
- **Notification Accessibility**: Screen reader announcements, dismissible controls

### **Accessibility Testing**
```javascript
testAccessibilityIntegration()  // MANDATORY after UI changes
UniversalModal.checkCompliance() // Modal-specific accessibility check
```

## **Development Methodology**

### **Single-File Development Protocol**
1. **Pre-Test**: `testModuleName()` (baseline)
2. **Modify**: Change ONE file only
3. **Immediate Test**: `testModuleName()` (validation)
4. **Integration Test**: `testAllSafe()` (regression check)

### **Template Development**
- **HTML Templates**: Place in `templates/` directory
- **JavaScript Templates**: Place in `templates/js/` directory  
- **CSS Templates**: Include in template files (e.g., prism-css.html)
- **Modal/Notification Templates**: Use embedded templates for interactive features
- **Testing**: Create corresponding test in `js/testing/individual/`

### **New Feature Testing Pattern**
```javascript
// js/testing/individual/test-[module-name].js
const Test[ModuleName] = (function () {
  "use strict";
  
  function test[ModuleName]() {
    const tests = {
      moduleExists: () => !!window.[ModuleName],
      hasRequiredMethods: () => { /* verify API */ },
      basicFunctionality: () => { /* test core features */ },
      errorHandling: () => { /* test error scenarios */ },
      integrationReadiness: () => { /* test readiness */ }
    };
    
    return TestUtilities.runTestSuite("[ModuleName]", tests);
  }
  
  return { test[ModuleName] };
})();
```

## **Technical Constraints**

### **Environment**
- **Browser-only**: No NPM, vanilla JavaScript ES6
- **Offline Operation**: Generated files work without internet
- **British Spelling**: "colour", "initialise" (except CSS properties)
- **Self-contained exports**: All dependencies embedded (fonts, CSS, JS, modals, notifications)

### **Performance Targets**
- **Template Rendering**: <1ms with caching
- **Export Generation**: <500ms for complex content
- **Template Loading**: 10+ external templates loaded reliably
- **Source Viewer**: <100ms syntax highlighting for typical documents
- **Modal Operations**: <100ms modal open/close animations
- **Notification Display**: <50ms notification rendering

### **Source Viewer Specifications**
- **Language Support**: LaTeX, Markdown, JSON, YAML, CSV, Python, R, Java, C/C++, Bash, and 40+ additional formats
- **Prism.js Build**: Custom build (~44KB minified) with essential languages only
- **Export Size Impact**: ~60KB additional content per export (Prism.js + CSS + templates)
- **Accessibility**: Full keyboard navigation, screen reader announcements, ARIA compliance

### **Modal & Notification Specifications**
- **Modal System**: 15KB minified (CSS + JS), embedded in exports
- **Notification System**: 8KB minified (CSS + JS), embedded in exports
- **Cross-browser**: Works in all modern browsers, graceful degradation
- **Memory Efficient**: Automatic cleanup, no memory leaks

## **Development Priorities**

### **Regression Prevention**
- Always run `testAllSafe()` before and after changes
- Maintain 100% test pass rate
- Use single-file modification approach

### **Accessibility-First**  
- Every feature must consider disabled users from design phase
- Test with screen readers when possible
- Document accessibility features clearly
- Modal and notification systems must maintain WCAG 2.2 AA compliance

### **Modular Architecture**
- Each module operates independently with clear APIs
- Template system handles all HTML/JS generation
- Comprehensive testing validates both individual and integrated functionality
- Modal and notification systems integrate seamlessly with existing export pipeline

### **Source Viewer Maintenance**
- **Template-based assets**: CSS and JavaScript in separate files for easy maintenance
- **Language mapping updates**: Add new Pandoc → Prism.js mappings as needed
- **Custom Prism.js builds**: Update build when new language support required
- **Credits management**: Update acknowledgements template for new dependencies

### **Modal & Notification Maintenance**
- **Template-based implementation**: All modal/notification code embedded via templates
- **Backward compatibility**: Maintain existing API contracts while adding new features
- **Performance monitoring**: Ensure modal/notification operations remain under performance targets
- **User experience consistency**: Modal and notification styling matches overall theme system

# LaTeX Consistency Debugging Guide

## Overview

LaTeX mathematical expression rendering consistency between playground and exports is critical for accessibility and functionality. This guide covers the comprehensive debugging infrastructure and methodology for identifying and resolving rendering issues, with enhanced tools for Phase 2B alignment validation.

## **Debugging Architecture**

### **Playground Debugging (latex-processor.js)**

The playground includes comprehensive debugging infrastructure with configurable categories:

```javascript
// Enable specific debugging categories
LaTeXProcessor.enableLatexDebugging(['MATHEMATICAL_PATTERNS', 'MATHML_STRUCTURE', 'CONVERSION_INTEGRITY'])

// Show current debugging status
LaTeXProcessor.showLatexDebuggingStatus()

// Disable all debugging
LaTeXProcessor.disableLatexDebugging()
```

**Available Debugging Categories:**

1. **MATHEMATICAL_PATTERNS** - Tracks mathematical patterns through the conversion pipeline
   - Set operators (∈, ⊆, ⊇, ∩, ∪, ∖)
   - Logical operators (∀, ∃, ∧, ∨, ¬)
   - Relational operators (≤, ≥, ≠, ≡, ∼, ≈)
   - Structural elements (fractions, matrices, cases)
   - Spacing-critical combinations

2. **MATHML_STRUCTURE** - Analyzes MathML DOM structure for semantic conversion
   - Element counts and types
   - Operator identification
   - Annotation quality assessment
   - Conversion complexity warnings

3. **CONVERSION_INTEGRITY** - Tracks mathematical content through the pipeline
   - Equation count changes
   - Operator preservation
   - Content length changes
   - Critical operator monitoring

### **Export Debugging (export-validation.js)**

Exports include embedded diagnostic functions for comprehensive validation:

```javascript
// Essential export validation commands
diagnosticLatexIssues()           // Primary diagnostic for rendering issues
validateExportedMath()            // Mathematical content baseline
validateComprehensiveExport()     // Export accuracy validation
checkAccessibility()              // Accessibility verification
testMathJaxContextMenus()         // Context menu functionality
testProblematicExpressions()      // Specific issue testing

// Phase 2B Enhanced Debugging Commands
verifyAnnotationAlignment()       // Annotation-container alignment verification
verifyContainerIsolation()        // Container content quality analysis

// NEW: Source Content Analysis Tools
debugSourceContent()              // Analyze LaTeX source extraction
debugExtraction()                 // Test mathematical expression extraction
debugAnnotations()                // Analyze annotation coverage and quality
```

### **Phase 2B Alignment Debugging**

Enhanced debugging tools specifically for mathematical expression alignment:

```javascript
// Phase 2B Alignment Verification
verifyAnnotationAlignment()       // Returns alignment percentage and misalignment details
// Success target: >= 97% alignment for educational deployment

// Content-Based Matching Analysis
checkAlignmentImprovement()       // Verify alignment after enhancements
testImprovedAlignment()           // Test Phase 2B enhancement results

// Container Analysis
verifyContainerIsolation()        // Detect contaminated containers
debugAnnotations()                // Comprehensive annotation analysis
```

## **Critical Mathematical Expression Processing**

### **Phase 2B LaTeX Extraction Engine**

The system now supports comprehensive LaTeX environment extraction:

```javascript
// Enhanced extraction patterns (latex-annotation-enhancer.js)
const envRegex = /\\begin\{(equation|align|gather|multline|split|eqnarray|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\*?\}([\s\S]*?)\\end\{\1\*?\}/gs;

// Extraction results: 19/19 expressions from equation environments
// - Traditional patterns: $...$ and $$...$$ (compatibility)
// - LaTeX display: \[...\] and \(...\)
// - All math environments: equation, align, cases, matrix, etc.
```

### **Content-Based Matching System**

Advanced pattern recognition for mathematical operator alignment:

```javascript
// Pattern recognition framework
const EXPRESSION_PATTERNS = {
  MEMBERSHIP: { latex: ['\\in', '\\mathbb{R}'], aria: ['element of'] },
  ROOT: { latex: ['\\sqrt'], aria: ['StartRoot', 'EndRoot'] },
  SUMMATION: { latex: ['\\sum'], aria: ['summation', 'sigma'] },
  INTEGRAL: { latex: ['\\int'], aria: ['integral'] },
  MATRIX: { latex: ['\\begin{pmatrix}'], aria: ['Start Matrix'] },
  // ... comprehensive pattern library
};

// Results: 100% content-based matching success (19/19 expressions)
```

### **Container Conflict Resolution**

Unique container assignment prevents mathematical expression conflicts:

```javascript
// Enhanced container matching with conflict prevention
function findBestContainerMatch(expression, containers, usedContainers = new Set()) {
  // Skip containers that are already used
  if (usedContainers.has(container)) return;
  
  // Results: No container conflicts, each expression gets unique container
}
```

## **Why We Convert Pre-rendered MathJax**

The system converts pre-rendered MathJax back to LaTeX to enable MathJax context menus and accessibility features:

```javascript
/**
 * CRITICAL FIX: Convert pre-rendered MathJax back to LaTeX
 * This ensures MathJax can process it fresh and attach context menus
 */
function convertMathJaxToLatex(content) {
```

This process is essential for:
- MathJax context menu attachment
- Accessibility tool integration
- Mathematical expression consistency
- Screen reader functionality

### **LaTeX Annotation Enhancement (Phase 2B)**

The template system includes `latex-annotation-enhancer.js` which:
- Extracts mathematical expressions from LaTeX source (equation environments)
- Matches expressions with rendered containers using content-based analysis
- Injects missing LaTeX annotations with 100% accuracy
- Provides automatic page load enhancement (50% coverage achieved)
- Prevents container conflicts through unique assignment logic

### **MathJax Synchronization**

The `mathjax-promise-utility.js` template provides reliable synchronization with MathJax rendering for consistent behaviour in exports.

## **Debugging Methodology**

### **Phase 2B Issue Investigation Protocol**

1. **Source Content Analysis**
   ```javascript
   debugSourceContent()        // Check LaTeX source extraction
   // Verify: 19 equation environments detected
   // Verify: 2147 characters of source content
   ```

2. **Extraction Validation**
   ```javascript
   debugExtraction()           // Test expression extraction
   // Expected: 19 expressions from equation environments
   // Expected: No $...$ patterns (uses environments instead)
   ```

3. **Annotation Analysis**
   ```javascript
   debugAnnotations()          // Analyze annotation coverage
   // Target: 100% annotation coverage (38/38 containers)
   // Target: 50%+ from automatic enhancement
   ```

4. **Alignment Verification**
   ```javascript
   verifyAnnotationAlignment() // Check mathematical accuracy
   // Current: 84.2% alignment (16/19 correct)
   // Target: 97%+ alignment for educational deployment
   ```

### **Common Issue Patterns and Solutions**

**LaTeX Environment Extraction (✅ SOLVED)**
- **Previous Issue**: Only handled `$...$` and `$$...$$` patterns
- **Solution**: Enhanced regex for equation environments
- **Result**: 19/19 expressions extracted successfully

**Container Conflicts (✅ SOLVED)**
- **Previous Issue**: Multiple expressions competing for same containers
- **Solution**: Unique container assignment with usedContainers tracking
- **Result**: 100% content-based matching success

**Mathematical Operator Misalignment (⚠️ IN PROGRESS)**
- **Current Issue**: 3 persistent misalignments (summation vs product, integral vs binomial, complex vs simple root)
- **Root Cause**: Insufficient operator conflict detection in calculateAlignmentScore
- **Target**: Enhanced operator discrimination for 97%+ accuracy

## **Performance Metrics and Targets**

### **Current System Status**
```javascript
// Phase 2B Achievement Metrics
{
  laTeXExtraction: "100%",        // 19/19 expressions extracted
  contentBasedMatching: "100%",   // 19/19 expressions matched
  containerCoverage: "100%",      // 38/38 containers annotated
  automaticEnhancement: "50%",    // Page load automation working
  alignmentAccuracy: "84.2%",    // 16/19 containers properly aligned
  containerConflicts: "0%"        // No container assignment conflicts
}
```

### **Educational Deployment Targets**
```javascript
// Required for Disabled Student Accessibility
{
  alignmentAccuracy: "97%+",      // 18-19/19 containers properly aligned
  mathematicalConsistency: "99%", // Playground-export correspondence
  screenReaderCompatibility: "100%", // Aria-label and annotation alignment
  automaticReliability: "100%"   // No manual intervention required
}
```

## **Development Protocol**

### **Critical Testing Sequence**
```javascript
// Pre-development baseline
const baseline = verifyAnnotationAlignment();
console.log("Baseline alignment:", baseline.alignmentPercentage);

// Apply enhancement
// ... modify calculateAlignmentScore function ...

// Post-development validation
const enhanced = verifyAnnotationAlignment();
console.log("Enhanced alignment:", enhanced.alignmentPercentage);

// Success criteria: enhanced.alignmentPercentage >= 97%
```

### **Regression Prevention**
- Use `verifyAnnotationAlignment()` to monitor mathematical accuracy
- Maintain 100% content-based matching success rate
- Preserve automatic page load enhancement functionality


## **Debugging Methodology**

### **Issue Investigation Protocol**

1. **Playground Validation**
   ```javascript
   // Enable all debugging categories
   LaTeXProcessor.enableLatexDebugging(['MATHEMATICAL_PATTERNS', 'MATHML_STRUCTURE', 'CONVERSION_INTEGRITY'])
   
   // Create export to observe pipeline behaviour
   // Check console for pattern tracking and integrity checks
   ```

2. **Export Diagnosis**
   ```javascript
   // In exported HTML console
   diagnosticLatexIssues()           // Primary diagnostic
   validateComprehensiveExport()     // Accuracy validation
   ```

3. **Pattern Comparison**
   - Compare playground debugging output with export diagnostic results
   - Identify where mathematical expressions diverge
   - Track conversion integrity through pipeline steps

### **Common Issue Patterns**

**Spacing Issues (∈ symbol example)**
- **Playground**: Pattern tracking shows proper spacing
- **Export**: Diagnostic shows missing spaces in rendered output
- **Investigation**: MathML structure analysis reveals semantic conversion problems

**Context Menu Issues**
- **Symptom**: Mathematical expressions lack right-click menus
- **Diagnosis**: `testMathJaxContextMenus()` shows low menu availability
- **Cause**: Pre-rendered content not properly converted to fresh LaTeX

**Accessibility Issues**
- **Symptom**: Screen readers cannot parse mathematical content
- **Diagnosis**: `checkAccessibility()` shows low accessibility rates
- **Cause**: Missing LaTeX annotations in MathML

## **Current Status: LaTeX Consistency Focus**

The system currently prioritizes mathematical expression accuracy over some accessibility features. Known areas requiring future attention:
- Some accessibility tools may need recalibration
- Template system compatibility with enhanced debugging
- Performance optimization for complex mathematical documents

## **Development Protocol**

1. **Pre-Development**: Run `testAllSafe()` to establish baseline
2. **During Development**: Enable relevant debugging categories
3. **Post-Development**: Validate with both playground debugging and export diagnostics
4. **Regression Prevention**: Compare diagnostic results before and after changes

This debugging infrastructure provides comprehensive visibility into the mathematical expression processing pipeline, enabling rapid identification and resolution of consistency issues.

# Important
Provide the human with step by step guidance on how to update the code, the human will update the code. Best method is to use this format of instruction:

Step 1 of X 

FIND THIS ENTIRE BLOCK (approximately lines 200-350):
```javascript
Code here
```
REPLACE WITH THIS NEW BLOCK:
```javascript
Code here
```