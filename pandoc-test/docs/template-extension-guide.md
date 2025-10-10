# Adding JavaScript and CSS Templates to Exports - Updated Developer Guide

## Overview

This guide explains how to add new JavaScript and CSS functionality to the Pandoc-WASM Mathematical Playground using template files. The system embeds these templates into exported HTML documents, making them fully self-contained and offline-capable.

**Key Learning**: This guide has been updated based on real implementation experience to address common variable naming conflicts and initialization timing issues that occur when multiple templates are loaded together.

## Template System Architecture

### Current Template Structure

```
templates/
├── 📁 js/                          (JavaScript templates)
│   ├── semantic-validation.js      (NEW: Educational accessibility)
│   ├── export-validation.js        (Enhanced validation functions)
│   ├── universal-modal.js           (Modal system)
│   ├── universal-notifications.js   (Notification system)
│   ├── focus-tracking.js           (Focus management)
│   └── ... (other JS templates)
├── 📋 prism-css.html               (Syntax highlighting CSS)
├── 📋 universal-modal.html         (Modal HTML template)
└── ... (other HTML/CSS templates)
```

## Critical Issue: Variable Naming Conflicts

### Problem Overview

When multiple JavaScript templates are loaded into the same exported document, they share the same global scope. This causes conflicts when templates use common variable names like:

- `LOG_LEVELS`
- `config`
- `DEFAULT_LOG_LEVEL`
- Common function names like `shouldLog()`, `initialize()`

### Examples of Conflicts Encountered

```javascript
// ❌ PROBLEMATIC: Multiple templates using same names
// In template A:
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const config = { feature: true };

// In template B:
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 }; // ❌ Conflict!
const config = { feature: false }; // ❌ Conflict!
```

**Runtime Errors**:

- `Uncaught SyntaxError: Identifier 'LOG_LEVELS' has already been declared`
- `Uncaught SyntaxError: Identifier 'config' has already been declared`
- `Uncaught ReferenceError: Cannot access 'LOG_LEVELS' before initialization`

## Solution 1: IIFE Scoping (Recommended)

### Best Practice Template Structure

Encapsulate ALL variables and functions within an IIFE (Immediately Invoked Function Expression) to avoid global conflicts:

```javascript
// templates/js/my-new-feature.js

/**
 * My New Feature - Educational Enhancement
 * Encapsulated to avoid variable conflicts
 */
const MyNewFeature = (function() {
  "use strict";

  // ✅ SCOPED: All variables contained within IIFE
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = {{enableAllLogging}};
  const DISABLE_ALL_LOGGING = {{disableAllLogging}};

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[MY-FEATURE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[MY-FEATURE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[MY-FEATURE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[MY-FEATURE]", message, ...args);
  }

  // ✅ SCOPED: Configuration contained within IIFE
  const config = {
    accuracyTarget: {{accuracyTarget}},
    enableFeature: {{enableFeature}},
    debugMode: {{debugMode}}
  };

  // ✅ SCOPED: Feature state contained within IIFE
  let featureState = {
    initialized: false,
    active: false,
    lastUpdate: null
  };

  /**
   * Initialize feature
   */
  function initialize() {
    logInfo("🔧 Initialising My New Feature");
    logInfo(`📊 Target: ${config.accuracyTarget}%`);

    // Feature initialization code here
    setupEventListeners();
    setupAccessibility();

    featureState.initialized = true;
    featureState.lastUpdate = new Date().toISOString();

    logInfo("✅ My New Feature initialized successfully");
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Event listener setup
    document.addEventListener('DOMContentLoaded', handleDOMReady);
  }

  /**
   * Setup accessibility features
   */
  function setupAccessibility() {
    // WCAG 2.2 AA compliance setup
    logInfo("🎯 Setting up accessibility features");
  }

  /**
   * Handle DOM ready event
   */
  function handleDOMReady() {
    logDebug("DOM ready, activating features");
    featureState.active = true;
  }

  /**
   * Public API - only these functions are exposed globally
   */
  return {
    initialize,
    getState: () => ({ ...featureState }),
    // Export other public methods as needed
  };
})();

// ✅ SAFE: Only the main object is global
window.MyNewFeature = MyNewFeature;

// ✅ SAFE: Auto-initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MyNewFeature.initialize);
} else {
  MyNewFeature.initialize();
}

// ✅ SAFE: Conditional announcement
if ({{educationalMode}}) {
  console.log("🎓 Educational Mode: My New Feature active for disabled students");
}
```

## Solution 2: Unique Prefixing (Alternative)

If IIFE scoping is not suitable, use unique prefixes for all global variables:

```javascript
// templates/js/my-feature-prefixed.js

// ✅ UNIQUE: Prefixed to avoid conflicts
const MY_FEATURE_LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const MY_FEATURE_DEFAULT_LOG_LEVEL = MY_FEATURE_LOG_LEVELS.WARN;
const MY_FEATURE_ENABLE_ALL_LOGGING = {{enableAllLogging}};
const MY_FEATURE_DISABLE_ALL_LOGGING = {{disableAllLogging}};

function myFeatureShouldLog(level) {
  if (MY_FEATURE_DISABLE_ALL_LOGGING) return false;
  if (MY_FEATURE_ENABLE_ALL_LOGGING) return true;
  return level <= MY_FEATURE_DEFAULT_LOG_LEVEL;
}

// ✅ UNIQUE: Prefixed configuration
const myFeatureConfig = {
  accuracyTarget: {{accuracyTarget}},
  enableFeature: {{enableFeature}},
  debugMode: {{debugMode}}
};

// Feature implementation here using prefixed variables
```

## Initialization Timing Issues

### Problem: Premature Variable Access

```javascript
// ❌ PROBLEMATIC: Variables accessed before declaration
function logInfo(message) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message); // ❌ LOG_LEVELS not yet declared
}

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 }; // Declared after use
```

### Solution: Proper Declaration Order

```javascript
// ✅ CORRECT: Within IIFE, all declarations come first
const MyFeature = (function() {
  "use strict";

  // 1. FIRST: All constants and configuration
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const config = { feature: {{enableFeature}} };

  // 2. SECOND: Helper functions that use constants
  function shouldLog(level) {
    return level <= LOG_LEVELS.WARN; // ✅ LOG_LEVELS already declared
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[FEATURE]", message, ...args);
  }

  // 3. THIRD: Main feature functions
  function initialize() {
    logInfo("Initializing feature"); // ✅ Safe to use
  }

  // 4. LAST: Return public API
  return { initialize };
})();
```

## Template Integration Best Practices

### Step-by-Step Implementation

#### 1. Create the Template File

**File**: `templates/js/my-new-feature.js`

```javascript
/**
 * My New Feature - Template
 * Uses IIFE scoping to prevent variable conflicts
 */
const MyNewFeature = (function() {
  "use strict";

  // All variables and functions scoped within IIFE
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = {{enableAllLogging}};
  const DISABLE_ALL_LOGGING = {{disableAllLogging}};

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[MY-FEATURE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[MY-FEATURE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[MY-FEATURE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[MY-FEATURE]", message, ...args);
  }

  const config = {
    accuracyTarget: {{accuracyTarget}},
    enableFeature: {{enableFeature}},
    debugMode: {{debugMode}},
    educationalMode: {{educationalMode}}
  };

  // Feature implementation
  function initialize() {
    logInfo("🔧 Initialising My New Feature");

    if (!config.enableFeature) {
      logInfo("Feature disabled by configuration");
      return;
    }

    try {
      setupFeature();
      logInfo("✅ My New Feature initialized successfully");
    } catch (error) {
      logError("❌ Feature initialization failed:", error);
    }
  }

  function setupFeature() {
    // Feature setup code here
    logDebug("Setting up feature components");
  }

  function getConfig() {
    return { ...config }; // Return copy to prevent external modification
  }

  function getStats() {
    return {
      initialized: true,
      config: getConfig(),
      timestamp: new Date().toISOString()
    };
  }

  // Public API
  return {
    initialize,
    getConfig,
    getStats
  };
})();

// Global export
window.MyNewFeature = MyNewFeature;

// Auto-initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MyNewFeature.initialize);
} else {
  // Use timeout to ensure other systems are ready
  setTimeout(MyNewFeature.initialize, 100);
}

// Educational mode announcement
if ({{educationalMode}}) {
  console.log("🎓 Educational Mode: My New Feature ensuring accessibility compliance");
}
```

#### 2. Add Template Generation Method

**File**: `js/export/template-system.js`

Add to the `EnhancedHTMLGenerator` class:

```javascript
/**
 * Generate My New Feature JavaScript for exported documents
 * Uses external JavaScript template with IIFE scoping
 */
async generateMyNewFeatureJS(options = {}) {
  try {
    logDebug(
      "📄 Loading JavaScript from external template: my-new-feature.js"
    );

    const rawJavascriptContent = await this.loadJavaScriptTemplate(
      "my-new-feature.js"
    );

    const config = {
      accuracyTarget: options.accuracyTarget || 99.9,
      enableFeature: options.enableFeature !== false,
      debugMode: options.debugMode || false,
      educationalMode: options.educationalMode !== false,
      enableAllLogging: options.enableAllLogging || false,
      disableAllLogging: options.disableAllLogging || false
    };

    const tempTemplateName = "myNewFeatureJS_temp";
    this.engine.templates.set(tempTemplateName, rawJavascriptContent);

    const processedContent = this.engine.render(tempTemplateName, config);

    this.engine.templates.delete(tempTemplateName);

    logDebug("✅ My New Feature JavaScript template processed successfully");
    return processedContent;

  } catch (error) {
    logError(
      "⚠ CRITICAL: My New Feature template loading failed:",
      error.message
    );
    throw new Error(`External template required: ${error.message}`);
  }
}
```

#### 3. Add Export Function

**File**: `js/export/export-manager.js`

```javascript
/**
 * Generate My New Feature JavaScript for exported documents
 * Uses external JavaScript template with proper scoping
 */
async function generateMyNewFeatureJS(options = {}) {
  if (window.TemplateSystem) {
    const generator = window.TemplateSystem.createGenerator();
    return await generator.generateMyNewFeatureJS(options);
  }
  throw new Error("Template system required for My New Feature generation");
}
```

#### 4. Integrate into Export Pipeline

**File**: `js/export/export-manager.js`

In the `generateEnhancedJavaScript()` function:

```javascript
// Add My New Feature (conditional loading)
if (accessibilityLevel >= 2) {
  html += "\n        // My New Feature - Educational Enhancement\n";
  html += await generateMyNewFeatureJS({
    accuracyTarget: 99.9,
    enableFeature: true,
    educationalMode: true,
    debugMode: false,
    enableAllLogging: false,
    disableAllLogging: false,
  });
}
```

## Common Conflict Patterns and Solutions

### Pattern 1: Export Validation Functions

```javascript
// ❌ PROBLEM: Functions placed outside IIFE
return {
  // functions here
};
})();

// ❌ These functions are in global scope - will conflict!
function validateSemanticConsistency() { /* ... */ }
function calculateSemanticSimilarity() { /* ... */ }

// ✅ SOLUTION: Move inside IIFE before return statement
return {
  validateSemanticConsistency,
  calculateSemanticSimilarity,
  // other functions
};
})();
```

### Pattern 2: Multiple Logging Systems

```javascript
// ❌ PROBLEM: Multiple templates with same logging names
// Template A
const LOG_LEVELS = {
  /* ... */
};

// Template B
const LOG_LEVELS = {
  /* ... */
}; // Conflict!

// ✅ SOLUTION: Use IIFE scoping
const FeatureA = (function () {
  const LOG_LEVELS = {
    /* ... */
  }; // Scoped to FeatureA
  return {
    /* API */
  };
})();

const FeatureB = (function () {
  const LOG_LEVELS = {
    /* ... */
  }; // Scoped to FeatureB
  return {
    /* API */
  };
})();
```

### Pattern 3: Configuration Objects

```javascript
// ❌ PROBLEM: Global config objects
const config = { feature: "A" };
const config = { feature: "B" }; // Conflict!

// ✅ SOLUTION: Scoped configurations
const FeatureA = (function () {
  const config = { feature: "A" }; // Scoped
  return { getConfig: () => config };
})();

const FeatureB = (function () {
  const config = { feature: "B" }; // Scoped
  return { getConfig: () => config };
})();
```

## Testing Conflict-Free Templates

### Console Testing Commands

```javascript
// Test for variable conflicts
// These should all work without errors:

// Test template loading
window.TemplateSystem.GlobalTemplateCache.hasTemplate("myNewFeatureJS");

// Test feature initialization
window.MyNewFeature.initialize();

// Test configuration access
window.MyNewFeature.getConfig();

// Test that features don't interfere
window.SemanticValidation.getResults();
window.MyNewFeature.getStats();

// Test export generation
await window.ExportManager.testExportGeneration();
```

### Debugging Variable Conflicts

```javascript
// Check for global variable pollution
function checkGlobalVariables() {
  const problematicNames = ["LOG_LEVELS", "config", "shouldLog"];
  const conflicts = [];

  problematicNames.forEach((name) => {
    if (window[name] !== undefined) {
      conflicts.push(`Global variable '${name}' detected - potential conflict`);
    }
  });

  if (conflicts.length === 0) {
    console.log("✅ No global variable conflicts detected");
  } else {
    console.warn("⚠️ Potential conflicts:", conflicts);
  }

  return conflicts;
}

// Run the check
checkGlobalVariables();
```

## Error Recovery Patterns

### Graceful Degradation

```javascript
const MyNewFeature = (function () {
  "use strict";

  // Safe initialization with error recovery
  function initialize() {
    try {
      setupCoreFeature();
    } catch (error) {
      logError("Core feature setup failed:", error);
      setupFallbackFeature();
    }
  }

  function setupCoreFeature() {
    // Main feature code
    if (!requiredDependencyAvailable()) {
      throw new Error("Required dependency not available");
    }
    // Continue setup...
  }

  function setupFallbackFeature() {
    logWarn("Using fallback feature implementation");
    // Minimal functionality that always works
  }

  function requiredDependencyAvailable() {
    return window.MathJax && window.TemplateSystem;
  }

  return { initialize };
})();
```

### Conflict Detection and Recovery

```javascript
const MyNewFeature = (function () {
  "use strict";

  function detectConflicts() {
    const conflicts = [];

    // Check for common conflict points
    if (typeof window.LOG_LEVELS !== "undefined") {
      conflicts.push("LOG_LEVELS already exists globally");
    }

    if (typeof window.config !== "undefined") {
      conflicts.push("config already exists globally");
    }

    return conflicts;
  }

  function initialize() {
    const conflicts = detectConflicts();
    if (conflicts.length > 0) {
      console.warn("[MY-FEATURE] Potential conflicts detected:", conflicts);
      console.warn("[MY-FEATURE] Proceeding with scoped implementation");
    }

    // Safe to proceed - everything is scoped within IIFE
    proceedWithInitialization();
  }

  return { initialize };
})();
```

## Key Takeaways

### Critical Rules for New Templates

1. **Always use IIFE scoping** - encapsulate all variables and functions
2. **Never declare global variables** except for the main feature object
3. **Test integration early** - add templates one at a time and test
4. **Use unique prefixes** if IIFE scoping is not possible
5. **Declare variables before using them** - avoid hoisting issues
6. **Handle errors gracefully** - don't break other features
7. **Test exported documents** - conflicts appear at runtime, not during development

### Template Structure Checklist

- [ ] All variables declared within IIFE
- [ ] No global constants except main object
- [ ] Logging functions use unique names or are scoped
- [ ] Configuration objects are scoped
- [ ] Public API clearly defined in return statement
- [ ] Error handling prevents breaking other features
- [ ] Auto-initialization uses safe patterns
- [ ] Template variables processed correctly

### Integration Testing Protocol

1. **Template Loading Test**: Verify template loads without syntax errors
2. **Variable Conflict Test**: Check for global variable pollution
3. **Integration Test**: Test with other existing templates
4. **Export Test**: Generate full export and test in browser
5. **Functionality Test**: Verify feature works as expected
6. **Accessibility Test**: Ensure WCAG 2.2 AA compliance maintained

This updated guide addresses the real-world challenges of integrating multiple JavaScript templates into exported documents while maintaining the system's reliability and accessibility standards.
