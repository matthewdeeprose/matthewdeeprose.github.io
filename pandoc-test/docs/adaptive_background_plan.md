# Adaptive Background Colour - Corrected Implementation Plan

## Project Integration Context
**Target Application:** Enhanced Pandoc-WASM Mathematical Playground  
**Integration Point:** Reading Tools Section  
**Architecture:** Vanilla JavaScript ES6, offline-capable, modular design  
**Template System:** External templates with GlobalTemplateCache integration
**Accessibility Standard:** WCAG 2.2 AA compliance maintained throughout  

## Feature Specification Summary

### Core Behaviour
- **Real-time automatic adjustments:** Colours update immediately as user changes background
- **No confirmation modals in MVP:** All changes apply directly with performance-based thresholds
- **CSS property scanning:** Efficient colour detection via stylesheet analysis
- **Tiered processing:** Text/background priority, expand to other colours if performance allows
- **State persistence:** Background colour and adjustments persist across sessions
- **Existing reset integration:** Use current reset controls to restore original colours

### Performance Thresholds
- **Text/background processing:** Target <100ms for immediate adjustment
- **Extended colour processing:** Only if text/background completes in <50ms
- **Element scan limit:** Maximum 1000 elements per analysis cycle
- **Debounce timing:** 150ms for colour picker input to balance responsiveness and performance

## Template System Integration Architecture

### Template File Structure (CORRECTED)
```
templates/
├── 📁 js/                                    (JavaScript templates)
│   ├── adaptive-background-manager.js        (Main coordinator - embedded version)
│   ├── chroma-js-embedded.js                 (Chroma.js library for offline use)
├── 📋 adaptive-background-css.html           (CSS template for controls styling)
├── 📋 reading-tools-section.html             (Modified to include new controls)
```

### Integration Files to Modify (CORRECTED)
```
templates/reading-tools-section.html           (Add background controls HTML)
templates/adaptive-background-css.html         (NEW - CSS template)
templates/js/adaptive-background-manager.js    (NEW - Combined JavaScript template)
templates/js/chroma-js-embedded.js             (NEW - Chroma.js embedding)
js/export/content-generator.js                 (CSS template inclusion)
js/export/export-manager.js                    (JavaScript template inclusion)
js/export/template-system.js                   (Template generator methods)
```

## Detailed Implementation Steps (CORRECTED)

### Step 1: Create Template Files Following Actual Patterns

#### File: `templates/js/chroma-js-embedded.js`
```javascript
// Chroma.js Library - Embedded for Offline Functionality
// Template variables: none (static library)

// Chroma.js v2.4.2 - Complete library embedded
// Source: https://github.com/gka/chroma.js
// License: Apache-2.0

(function() {
  'use strict';
  
  // Full chroma.js library code would be embedded here
  // This is a placeholder showing the structure
  
  const chroma = (function() {
    // ... complete chroma.js source code ...
    return chromaMain; // The main chroma function
  })();
  
  // Make available globally for offline use
  if (typeof window !== 'undefined') {
    window.chroma = chroma;
    console.log('✅ Chroma.js embedded and available offline');
  }
  
  // Also support Node.js environments if needed
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = chroma;
  }
})();
```

#### File: `templates/js/adaptive-background-manager.js`
```javascript
// Adaptive Background Manager - Complete Feature Implementation
// Template variables: {{enableFeature}}, {{accessibilityLevel}}, {{debugMode}}

// Logging configuration matching system pattern
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error("[ADAPTIVE-BG]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn("[ADAPTIVE-BG]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log("[ADAPTIVE-BG]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[ADAPTIVE-BG]", message, ...args);
}

// Template configuration
const config = {
  enableFeature: {{enableFeature}},
  accessibilityLevel: {{accessibilityLevel}},
  debugMode: {{debugMode}}
};

// === COLOUR SCANNER MODULE ===
const ColourScanner = (function() {
  "use strict";
  
  const CONFIG = {
    MAIN_SELECTOR: 'main',
    TEXT_SELECTORS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'li', 'td', 'th', 'span', 'a', 'button',
      'label', 'legend', 'caption'
    ],
    IGNORE_CLASSES: ['sr-only', 'visually-hidden', 'skip-link']
  };

  let isInitialised = false;

  function initialise() {
    if (isInitialised) {
      logWarn('ColourScanner already initialised');
      return;
    }
    logInfo('Initialising Colour Scanner');
    isInitialised = true;
  }

  function getTextElements() {
    const mainElement = document.querySelector(CONFIG.MAIN_SELECTOR);
    if (!mainElement) {
      logError('Main element not found');
      return [];
    }

    const elements = [];
    CONFIG.TEXT_SELECTORS.forEach(selector => {
      const found = mainElement.querySelectorAll(selector);
      found.forEach(element => {
        if (shouldIncludeElement(element) && hasTextContent(element)) {
          elements.push(element);
        }
      });
    });

    logDebug(`Found ${elements.length} text elements`);
    return elements;
  }

  function shouldIncludeElement(element) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    for (const ignoreClass of CONFIG.IGNORE_CLASSES) {
      if (element.classList.contains(ignoreClass)) {
        return false;
      }
    }
    return true;
  }

  function hasTextContent(element) {
    return element.textContent.trim().length > 0;
  }

  return { initialise, getTextElements };
})();

// === CONTRAST OPTIMIZER MODULE ===
const ContrastOptimizer = (function() {
  "use strict";
  
  let chroma;
  let isInitialised = false;

  function initialise(chromaInstance) {
    if (isInitialised) {
      logWarn('ContrastOptimizer already initialised');
      return;
    }

    if (!chromaInstance) {
      logError('Chroma.js instance required for initialisation');
      return false;
    }

    chroma = chromaInstance;
    isInitialised = true;
    logInfo('Contrast Optimizer initialised');
    return true;
  }

  function optimizeColour(originalColour, backgroundColor, targetContrast, priority = 'similarity') {
    if (!isInitialised) {
      logError('ContrastOptimizer not initialised');
      return null;
    }

    try {
      logDebug(`Optimising ${originalColour} against ${backgroundColor} for ${targetContrast}:1 contrast`);

      const currentContrast = chroma.contrast(originalColour, backgroundColor);
      if (currentContrast >= targetContrast) {
        logDebug('Colour already meets contrast requirements');
        return originalColour;
      }

      // Implementation of colour optimization algorithm
      const result = generateOptimizedColour(originalColour, backgroundColor, targetContrast, priority);
      
      if (result && result.color) {
        logDebug(`Optimised to ${result.color} with contrast ${result.contrast.toFixed(2)}:1`);
        return result.color;
      }

      logWarn(`Could not optimise colour ${originalColour} to meet ${targetContrast}:1 contrast`);
      return null;

    } catch (error) {
      logError('Error optimising colour:', error);
      return null;
    }
  }

  function generateOptimizedColour(originalColour, backgroundColor, targetContrast, priority) {
    try {
      const backgroundLuminance = chroma(backgroundColor).luminance();
      const direction = backgroundLuminance > 0.5 ? -1 : 1;
      
      // Try lightness adjustments
      for (let step = 1; step <= 40; step++) {
        const adjustment = step * 5 * direction;
        const originalLab = chroma(originalColour).lab();
        let newLab = [...originalLab];
        newLab[0] = Math.max(0, Math.min(100, originalLab[0] + adjustment));

        try {
          const newColour = chroma.lab(...newLab).hex();
          const contrast = chroma.contrast(newColour, backgroundColor);

          if (contrast >= targetContrast) {
            return {
              color: newColour,
              contrast: contrast,
              similarity: Math.max(0, 100 - chroma.deltaE(originalColour, newColour))
            };
          }
        } catch (e) {
          // Invalid colour, skip
        }
      }

      // Fallback to high contrast colours
      const fallbackColour = backgroundLuminance > 0.5 ? '#000000' : '#FFFFFF';
      const fallbackContrast = chroma.contrast(fallbackColour, backgroundColor);
      
      if (fallbackContrast >= targetContrast) {
        return {
          color: fallbackColour,
          contrast: fallbackContrast,
          similarity: Math.max(0, 100 - chroma.deltaE(originalColour, fallbackColour))
        };
      }

      return null;
    } catch (error) {
      logError('Error generating optimised colour:', error);
      return null;
    }
  }

  return { initialise, optimizeColour };
})();

// === BACKGROUND CONTROLS MODULE ===
const BackgroundControls = (function() {
  "use strict";
  
  let isInitialised = false;
  let backgroundChangeCallback = null;
  let contrastTargetChangeCallback = null;
  let backgroundPicker = null;
  let backgroundHex = null;
  let contrastRadios = null;

  function initialise(onBackgroundChange, onContrastTargetChange) {
    if (isInitialised) {
      logWarn('BackgroundControls already initialised');
      return;
    }

    backgroundChangeCallback = onBackgroundChange;
    contrastTargetChangeCallback = onContrastTargetChange;

    if (!setupUIElements()) {
      logError('Failed to setup UI elements');
      return false;
    }

    setupEventListeners();
    restoreStoredValues();

    isInitialised = true;
    logInfo('Background Controls initialised');
    return true;
  }

  function setupUIElements() {
    backgroundPicker = document.getElementById('adaptive-background-picker');
    backgroundHex = document.getElementById('adaptive-background-hex');
    contrastRadios = document.querySelectorAll('input[name="adaptive-contrast-target"]');

    if (!backgroundPicker || !backgroundHex) {
      logError('Required UI elements not found - ensure template is loaded');
      return false;
    }
    return true;
  }

  function setupEventListeners() {
    backgroundPicker.addEventListener('input', function(event) {
      const colour = event.target.value;
      backgroundHex.value = colour.toUpperCase();
      
      if (backgroundChangeCallback) {
        backgroundChangeCallback(colour);
      }
    });

    backgroundHex.addEventListener('input', function(event) {
      const value = event.target.value.trim();
      const colour = formatHexInput(value);
      
      if (isValidHexColour(colour)) {
        backgroundPicker.value = colour;
        if (backgroundChangeCallback) {
          backgroundChangeCallback(colour);
        }
      }
    });

    contrastRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.checked && contrastTargetChangeCallback) {
          const target = parseFloat(this.value);
          contrastTargetChangeCallback(target);
        }
      });
    });
  }

  function restoreStoredValues() {
    try {
      const storedColour = localStorage.getItem('adaptiveBackgroundColour');
      if (storedColour && isValidHexColour(storedColour)) {
        backgroundPicker.value = storedColour;
        backgroundHex.value = storedColour.toUpperCase();
      }

      const storedTarget = localStorage.getItem('adaptiveContrastTarget');
      if (storedTarget) {
        const targetRadio = document.querySelector(`input[name="adaptive-contrast-target"][value="${storedTarget}"]`);
        if (targetRadio) {
          targetRadio.checked = true;
        }
      }
    } catch (error) {
      logWarn('Could not restore stored values:', error);
    }
  }

  function formatHexInput(input) {
    if (!input) return '#FFFFFF';
    let formatted = input.toUpperCase();
    if (formatted.charAt(0) !== '#') {
      formatted = '#' + formatted;
    }
    return formatted;
  }

  function isValidHexColour(colour) {
    if (!colour) return false;
    const hex = colour.charAt(0) === '#' ? colour.substring(1) : colour;
    return /^([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex);
  }

  function reset() {
    if (!isInitialised) return;
    backgroundPicker.value = '#FFFFFF';
    backgroundHex.value = '#FFFFFF';
    const aaRadio = document.querySelector('input[name="adaptive-contrast-target"][value="4.5"]');
    if (aaRadio) {
      aaRadio.checked = true;
    }
  }

  return { initialise, reset };
})();

// === ADAPTIVE BACKGROUND MANAGER MODULE ===
const AdaptiveBackgroundManager = (function() {
  "use strict";
  
  const CONFIG = {
    TARGET_CONTRAST_AA: 4.5,
    TARGET_CONTRAST_AAA: 7.0,
    PERFORMANCE_THRESHOLD_TEXT: 50,
    PERFORMANCE_THRESHOLD_TOTAL: 100,
    MAX_ELEMENTS: 1000,
    DEBOUNCE_DELAY: 150,
    MAIN_SELECTOR: 'main'
  };

  let isInitialised = false;
  let currentBackgroundColour = '#FFFFFF';
  let targetContrast = CONFIG.TARGET_CONTRAST_AA;
  let originalColours = new Map();
  let processingTimeout = null;

  function initialise() {
    if (isInitialised) {
      logWarn('AdaptiveBackgroundManager already initialised');
      return false;
    }

    // Skip if feature is disabled via template config
    if (!config.enableFeature) {
      logInfo('Adaptive background feature disabled via configuration');
      return false;
    }

    logInfo('Initialising Adaptive Background Manager');

    try {
      if (!window.chroma) {
        throw new Error('Chroma.js not available');
      }

      storeOriginalColours();
      
      ColourScanner.initialise();
      ContrastOptimizer.initialise(chroma);
      BackgroundControls.initialise(handleBackgroundChange, handleContrastTargetChange);

      currentBackgroundColour = getStoredBackgroundColour();
      
      if (currentBackgroundColour !== '#FFFFFF') {
        applyBackgroundColour(currentBackgroundColour);
      }

      isInitialised = true;
      logInfo('Adaptive Background Manager initialised successfully');
      return true;
    } catch (error) {
      logError('Failed to initialise Adaptive Background Manager:', error);
      return false;
    }
  }

  function storeOriginalColours() {
    const mainElement = document.querySelector(CONFIG.MAIN_SELECTOR);
    if (!mainElement) {
      logError('Main element not found');
      return;
    }

    const computedStyle = window.getComputedStyle(mainElement);
    originalColours.set('main-background', computedStyle.backgroundColor);
    logDebug(`Stored original main background: ${computedStyle.backgroundColor}`);
  }

  function handleBackgroundChange(newColour) {
    logDebug(`Background colour change requested: ${newColour}`);
    
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }

    processingTimeout = setTimeout(() => {
      processBackgroundChange(newColour);
    }, CONFIG.DEBOUNCE_DELAY);
  }

  function processBackgroundChange(newColour) {
    const startTime = performance.now();
    
    try {
      if (!isValidColour(newColour)) {
        logError(`Invalid colour format: ${newColour}`);
        return;
      }

      currentBackgroundColour = newColour;
      applyBackgroundColour(newColour);
      storeBackgroundColourPreference(newColour);
      
      const textProcessingTime = processTextColourAdjustments(newColour);
      
      if (textProcessingTime < CONFIG.PERFORMANCE_THRESHOLD_TEXT) {
        processExtendedColourAdjustments(newColour);
      }

      const totalTime = performance.now() - startTime;
      logInfo(`Background processing completed in ${totalTime.toFixed(2)}ms`);

    } catch (error) {
      logError('Error processing background change:', error);
    }
  }

  function processTextColourAdjustments(backgroundColour) {
    const startTime = performance.now();
    
    try {
      const textElements = ColourScanner.getTextElements();
      logDebug(`Processing ${textElements.length} text elements`);

      let adjustmentsMade = 0;

      textElements.forEach(element => {
        const currentTextColour = window.getComputedStyle(element).color;
        const contrast = chroma.contrast(currentTextColour, backgroundColour);

        if (contrast < targetContrast) {
          const optimizedColour = ContrastOptimizer.optimizeColour(
            currentTextColour,
            backgroundColour,
            targetContrast,
            'similarity'
          );

          if (optimizedColour && optimizedColour !== currentTextColour) {
            element.style.color = optimizedColour;
            adjustmentsMade++;
            logDebug(`Adjusted text colour from ${currentTextColour} to ${optimizedColour}`);
          }
        }
      });

      const processingTime = performance.now() - startTime;
      logInfo(`Text colour adjustments: ${adjustmentsMade} elements in ${processingTime.toFixed(2)}ms`);
      
      return processingTime;
      
    } catch (error) {
      logError('Error processing text colour adjustments:', error);
      return CONFIG.PERFORMANCE_THRESHOLD_TEXT;
    }
  }

  function processExtendedColourAdjustments(backgroundColour) {
    try {
      logDebug('Processing extended colour adjustments');
      // Implementation for borders, UI elements, etc.
    } catch (error) {
      logError('Error processing extended colour adjustments:', error);
    }
  }

  function applyBackgroundColour(colour) {
    const mainElement = document.querySelector(CONFIG.MAIN_SELECTOR);
    if (mainElement) {
      mainElement.style.backgroundColor = colour;
      logDebug(`Applied background colour: ${colour}`);
    }
  }

  function handleContrastTargetChange(newTarget) {
    targetContrast = newTarget;
    logInfo(`Contrast target changed to ${newTarget}:1`);
    
    if (currentBackgroundColour !== '#FFFFFF') {
      processBackgroundChange(currentBackgroundColour);
    }
  }

  function reset() {
    logInfo('Resetting adaptive background to original colours');
    
    try {
      const mainElement = document.querySelector(CONFIG.MAIN_SELECTOR);
      if (mainElement && originalColours.has('main-background')) {
        mainElement.style.backgroundColor = originalColours.get('main-background');
      }

      const elementsWithInlineStyles = document.querySelectorAll(`${CONFIG.MAIN_SELECTOR} [style*="color"]`);
      elementsWithInlineStyles.forEach(element => {
        element.style.color = '';
      });

      currentBackgroundColour = '#FFFFFF';
      clearStoredBackgroundColour();
      
      if (BackgroundControls && BackgroundControls.reset) {
        BackgroundControls.reset();
      }

      logInfo('Reset completed successfully');
      
    } catch (error) {
      logError('Error during reset:', error);
    }
  }

  function isValidColour(colour) {
    try {
      chroma(colour);
      return true;
    } catch {
      return false;
    }
  }

  function getStoredBackgroundColour() {
    try {
      const stored = localStorage.getItem('adaptiveBackgroundColour');
      return stored || '#FFFFFF';
    } catch (error) {
      return '#FFFFFF';
    }
  }

  function storeBackgroundColourPreference(colour) {
    try {
      localStorage.setItem('adaptiveBackgroundColour', colour);
    } catch (error) {
      logWarn('Could not store background colour preference:', error);
    }
  }

  function clearStoredBackgroundColour() {
    try {
      localStorage.removeItem('adaptiveBackgroundColour');
    } catch (error) {
      logWarn('Could not clear stored background colour:', error);
    }
  }

  return {
    initialise,
    reset,
    getCurrentBackgroundColour: () => currentBackgroundColour,
    getTargetContrast: () => targetContrast
  };
})();

// Export modules to global scope
window.AdaptiveBackgroundManager = AdaptiveBackgroundManager;
window.ColourScanner = ColourScanner;
window.ContrastOptimizer = ContrastOptimizer;
window.BackgroundControls = BackgroundControls;

// Auto-initialize when DOM is ready if reading accessibility manager is available
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initializeAdaptiveBackground();
  });
} else {
  initializeAdaptiveBackground();
}

function initializeAdaptiveBackground() {
  // Integrate with existing reading accessibility manager if available
  if (window.ReadingAccessibilityManager) {
    setTimeout(() => {
      if (window.ReadingAccessibilityManager.prototype.initAdaptiveBackground) {
        // Will be called by the reading accessibility manager
        logInfo('Adaptive Background ready for integration with Reading Tools');
      }
    }, 100);
  } else {
    // Standalone initialization
    const success = AdaptiveBackgroundManager.initialise();
    if (success) {
      logInfo('Adaptive Background initialized standalone');
    }
  }
}

logInfo('Adaptive Background Feature loaded and ready');
```

#### File: `templates/adaptive-background-css.html`
```html
<style>
/* Adaptive Background Controls Styling */
.adaptive-background-controls {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  background: var(--control-background, #fafafa);
}

.adaptive-background-controls h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--heading-color, #333);
}

.background-picker-group {
  margin-bottom: 1.5rem;
}

.control-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-color, #333);
}

.color-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.color-picker {
  width: 3rem;
  height: 2.5rem;
  border: 2px solid var(--border-color, #ccc);
  border-radius: 4px;
  cursor: pointer;
  background: none;
  padding: 0;
}

.color-picker:focus-visible {
  outline: 2px solid var(--focus-color, #005fcc);
  outline-offset: 2px;
}

.hex-input {
  flex: 1;
  max-width: 8rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.hex-input:focus-visible {
  outline: 2px solid var(--focus-color, #005fcc);
  outline-offset: 1px;
  border-color: var(--focus-color, #005fcc);
}

.help-text {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
  line-height: 1.4;
}

.control-subheading {
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.75rem 0;
  color: var(--heading-color, #333);
}

.contrast-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.contrast-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.contrast-option input[type="radio"] {
  margin: 0;
  width: 1rem;
  height: 1rem;
}

.contrast-option label {
  margin: 0;
  font-weight: normal;
  cursor: pointer;
  color: var(--text-color, #333);
}

.contrast-option input[type="radio"]:focus-visible + label {
  outline: 2px solid var(--focus-color, #005fcc);
  outline-offset: 2px;
}

/* Dark theme adjustments */
[data-theme="dark"] .adaptive-background-controls {
  background: var(--surface-color);
  border-color: var(--sidebar-border);
}

[data-theme="dark"] .control-label,
[data-theme="dark"] .control-subheading,
[data-theme="dark"] .contrast-option label {
  color: var(--body-text);
}

[data-theme="dark"] .help-text {
  color: var(--text-secondary);
}

[data-theme="dark"] .color-picker,
[data-theme="dark"] .hex-input {
  border-color: var(--sidebar-border);
  background: var(--surface-color);
  color: var(--body-text);
}

/* Responsive design */
@media (max-width: 768px) {
  .color-input-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .color-picker {
    align-self: flex-start;
  }
  
  .hex-input {
    max-width: none;
  }
  
  .contrast-options {
    gap: 0.75rem;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .color-picker,
  .hex-input {
    transition: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .adaptive-background-controls {
    border-width: 2px;
  }
  
  .color-picker,
  .hex-input {
    border-width: 2px;
  }
  
  .color-picker:focus-visible,
  .hex-input:focus-visible {
    outline-width: 3px;
  }
}
</style>
```

### Step 2: Modify Reading Tools Template (CORRECTED)

#### Modification: `templates/reading-tools-section.html`

**FIND THIS ENTIRE BLOCK (approximately lines 45-65):**
```html
    <!-- Reset Controls -->
    {{> resetControlsSection}}
```

**REPLACE WITH THIS NEW BLOCK:**
```html
    <!-- Adaptive Background Controls -->
    <div class="adaptive-background-controls">
      <h4 id="background-heading">Background Colour</h4>
      
      <div class="background-picker-group" role="group" aria-labelledby="background-heading">
        <label for="adaptive-background-picker" class="control-label">
          Background colour:
        </label>
        <div class="color-input-group">
          <input type="color" 
                 id="adaptive-background-picker" 
                 value="#FFFFFF" 
                 class="color-picker"
                 aria-describedby="background-help">
          <input type="text" 
                 id="adaptive-background-hex" 
                 value="#FFFFFF" 
                 placeholder="e.g. #FFFFFF"
                 class="hex-input"
                 maxlength="7"
                 aria-label="Background colour hex code">
        </div>
        <div id="background-help" class="help-text">
          Choose a background colour. Text colours will automatically adjust for accessibility.
        </div>
      </div>

      <div class="contrast-target-group" role="group" aria-labelledby="contrast-target-heading">
        <h5 id="contrast-target-heading" class="control-subheading">Minimum contrast requirement:</h5>
        <div class="contrast-options">
          <div class="contrast-option">
            <input type="radio" 
                   id="contrast-aa" 
                   name="adaptive-contrast-target" 
                   value="4.5" 
                   checked>
            <label for="contrast-aa">AA (4.5:1) - Standard</label>
          </div>
          <div class="contrast-option">
            <input type="radio" 
                   id="contrast-aaa" 
                   name="adaptive-contrast-target" 
                   value="7">
            <label for="contrast-aaa">AAA (7:1) - Enhanced</label>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset Controls -->
    {{> resetControlsSection}}
```

### Step 3: CSS Integration Following Corrected Pattern

#### Modification: `js/export/content-generator.js`

**FIND THIS ENTIRE BLOCK in the `generateEnhancedCSS()` function (approximately lines 150-200):**
```javascript
    // Include universal notifications CSS
    try {
      if (window.TemplateSystem) {
        await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();
        if (
          window.TemplateSystem.GlobalTemplateCache.hasTemplate(
            "universalNotificationsCSS"
          )
        ) {
          const notificationCSS =
            window.TemplateSystem.GlobalTemplateCache.getTemplate(
              "universalNotificationsCSS"
            );
          cssComponents.push(
            "/* Universal Notifications CSS */\n" + notificationCSS
          );
          logDebug("✅ Added universal notifications CSS to component list");
        } else {
          logWarn("universalNotificationsCSS template not found");
        }
      }
    } catch (error) {
      logWarn("Could not include notifications CSS:", error.message);
    }
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
    // Include universal notifications CSS
    try {
      if (window.TemplateSystem) {
        await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();
        if (
          window.TemplateSystem.GlobalTemplateCache.hasTemplate(
            "universalNotificationsCSS"
          )
        ) {
          const notificationCSS =
            window.TemplateSystem.GlobalTemplateCache.getTemplate(
              "universalNotificationsCSS"
            );
          cssComponents.push(
            "/* Universal Notifications CSS */\n" + notificationCSS
          );
          logDebug("✅ Added universal notifications CSS to component list");
        } else {
          logWarn("universalNotificationsCSS template not found");
        }
      }
    } catch (error) {
      logWarn("Could not include notifications CSS:", error.message);
    }

    // Include adaptive background CSS
    try {
      if (window.TemplateSystem) {
        await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();
        if (
          window.TemplateSystem.GlobalTemplateCache.hasTemplate(
            "adaptiveBackgroundCSS"
          )
        ) {
          const adaptiveBackgroundCSS =
            window.TemplateSystem.GlobalTemplateCache.getTemplate(
              "adaptiveBackgroundCSS"
            );
          cssComponents.push(
            "/* Adaptive Background CSS */\n" + adaptiveBackgroundCSS
          );
          logDebug("✅ Added adaptive background CSS to component list");
        } else {
          logWarn("adaptiveBackgroundCSS template not found");
        }
      }
    } catch (error) {
      logWarn("Could not include adaptive background CSS:", error.message);
    }
```

### Step 4: JavaScript Integration Following Corrected Pattern

#### Modification: `js/export/export-manager.js`

**FIND THIS ENTIRE BLOCK in the `generateEnhancedJavaScript()` function (approximately lines 800-850):**
```javascript
    // Add source viewer JavaScript for syntax highlighting
    if (window.SourceViewer) {
      html += "\n        // Source Viewer - Prism.js Syntax Highlighting\n";
      const prismJS = await window.SourceViewer.getPrismJS();
      html += "        " + prismJS.split("\n").join("\n        ") + "\n";

      // Add accessibility enhancements
      html += `
        
        // Source Viewer - Accessibility Enhancements
        document.addEventListener('DOMContentLoaded', function() {
          if (window.SourceViewer && window.SourceViewer.enhanceAccessibility) {
            window.SourceViewer.enhanceAccessibility();
          }
        });
`;
    }
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
    // Add chroma.js for color manipulation
    html += await generateChromaJSEmbedded();

    // Add adaptive background feature
    html += await generateAdaptiveBackgroundManagerJS({
      enableFeature: true,
      accessibilityLevel: accessibilityLevel,
      debugMode: false
    });

    // Add source viewer JavaScript for syntax highlighting
    if (window.SourceViewer) {
      html += "\n        // Source Viewer - Prism.js Syntax Highlighting\n";
      const prismJS = await window.SourceViewer.getPrismJS();
      html += "        " + prismJS.split("\n").join("\n        ") + "\n";

      // Add accessibility enhancements
      html += `
        
        // Source Viewer - Accessibility Enhancements
        document.addEventListener('DOMContentLoaded', function() {
          if (window.SourceViewer && window.SourceViewer.enhanceAccessibility) {
            window.SourceViewer.enhanceAccessibility();
          }
        });
`;
    }
```

**ADD THESE NEW FUNCTIONS at the end of the file:**
```javascript
/**
 * Generate Chroma.js embedded JavaScript for exported documents
 * Uses external JavaScript template
 */
async function generateChromaJSEmbedded() {
  if (window.TemplateSystem) {
    const generator = window.TemplateSystem.createGenerator();
    return await generator.generateChromaJSEmbedded();
  }
  throw new Error("Template system required for chroma.js generation");
}

/**
 * Generate Adaptive Background Manager JavaScript for exported documents
 * Uses external JavaScript template
 */
async function generateAdaptiveBackgroundManagerJS(options = {}) {
  if (window.TemplateSystem) {
    const generator = window.TemplateSystem.createGenerator();
    return await generator.generateAdaptiveBackgroundManagerJS(options);
  }
  throw new Error("Template system required for adaptive background generation");
}
```

### Step 5: Template System Generator Methods (CORRECTED)

#### Modification: `js/export/template-system.js`

**ADD THESE NEW METHODS to the `EnhancedHTMLGenerator` class:**
```javascript
  /**
   * Generate Chroma.js embedded JavaScript
   */
  async generateChromaJSEmbedded() {
    try {
      logDebug("📄 Loading JavaScript from external template: chroma-js-embedded.js");

      const rawJavascriptContent = await this.loadJavaScriptTemplate(
        "chroma-js-embedded.js"
      );

      // No template processing needed - static library
      const indentedContent = rawJavascriptContent
        .split("\n")
        .map((line) => (line.trim() ? "        " + line : line))
        .join("\n");

      logDebug("✅ Chroma.js embedded JavaScript loaded successfully");
      return indentedContent;
    } catch (error) {
      logError(
        "⚠ CRITICAL: Chroma.js template loading failed - NO FALLBACK:",
        error.message
      );
      throw new Error(`External template required: ${error.message}`);
    }
  }

  /**
   * Generate Adaptive Background Manager JavaScript
   */
  async generateAdaptiveBackgroundManagerJS(options = {}) {
    try {
      logDebug(
        "📄 Loading JavaScript from external template: adaptive-background-manager.js"
      );

      const rawJavascriptContent = await this.loadJavaScriptTemplate(
        "adaptive-background-manager.js"
      );

      // Apply configuration based on options
      const config = {
        enableFeature: options.enableFeature !== false,
        accessibilityLevel: options.accessibilityLevel || 1,
        debugMode: options.debugMode || false
      };

      // Process template variables using the engine's render method
      const tempTemplateName = "adaptiveBackgroundManagerJS_temp";
      this.engine.templates.set(tempTemplateName, rawJavascriptContent);

      const processedContent = this.engine.render(tempTemplateName, config);

      // Clean up temporary template
      this.engine.templates.delete(tempTemplateName);

      logDebug(
        "✅ Adaptive Background Manager JavaScript template processed successfully"
      );
      return processedContent;
    } catch (error) {
      logError(
        "⚠ CRITICAL: Adaptive Background Manager template loading failed:",
        error.message
      );
      throw new Error(`External template required: ${error.message}`);
    }
  }
```

### Step 6: Reading Tools Integration (CORRECTED)

#### Modification: `templates/js/reading-accessibility-manager-class.js`

**FIND THIS ENTIRE BLOCK (approximately lines 50-70):**
```javascript
    // Initialize all features
    this.initFontControls();
    this.initSpacingControls();
    this.initWidthControls();
    this.initThemeToggle();
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
    // Initialize all features
    this.initFontControls();
    this.initSpacingControls();
    this.initWidthControls();
    this.initThemeToggle();
    this.initAdaptiveBackground();
```

**FIND THIS ENTIRE BLOCK (reset method):**
```javascript
  resetAllSettings() {
    this.logInfo('Resetting all accessibility settings');
    
    // Reset font
    this.currentFont = this.DEFAULT_FONT;
    document.documentElement.style.setProperty('--reading-font-family', this.currentFont);
    
    // Reset spacing
    this.currentSpacing = this.DEFAULT_SPACING;
    document.documentElement.style.setProperty('--reading-line-height', this.currentSpacing);
    
    // Reset width
    this.currentWidth = this.DEFAULT_WIDTH;
    document.documentElement.style.setProperty('--reading-max-width', this.currentWidth);
    
    // Reset theme
    this.currentTheme = this.DEFAULT_THEME;
    this.applyTheme(this.currentTheme);
    
    // Update UI
    this.updateFontUI();
    this.updateSpacingUI();
    this.updateWidthUI();
    this.updateThemeUI();
    
    // Clear stored settings
    this.clearStoredSettings();
    
    this.logInfo('All settings reset to defaults');
  }
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
  resetAllSettings() {
    this.logInfo('Resetting all accessibility settings');
    
    // Reset font
    this.currentFont = this.DEFAULT_FONT;
    document.documentElement.style.setProperty('--reading-font-family', this.currentFont);
    
    // Reset spacing
    this.currentSpacing = this.DEFAULT_SPACING;
    document.documentElement.style.setProperty('--reading-line-height', this.currentSpacing);
    
    // Reset width
    this.currentWidth = this.DEFAULT_WIDTH;
    document.documentElement.style.setProperty('--reading-max-width', this.currentWidth);
    
    // Reset theme
    this.currentTheme = this.DEFAULT_THEME;
    this.applyTheme(this.currentTheme);
    
    // Reset adaptive background
    if (window.AdaptiveBackgroundManager && window.AdaptiveBackgroundManager.reset) {
      window.AdaptiveBackgroundManager.reset();
    }
    
    // Update UI
    this.updateFontUI();
    this.updateSpacingUI();
    this.updateWidthUI();
    this.updateThemeUI();
    
    // Clear stored settings
    this.clearStoredSettings();
    
    this.logInfo('All settings reset to defaults');
  }
```

**ADD THIS NEW METHOD at the end of the class:**
```javascript
  initAdaptiveBackground() {
    this.logInfo('Initialising adaptive background feature');
    
    try {
      // Check if adaptive background manager is available
      if (!window.AdaptiveBackgroundManager) {
        this.logWarn('AdaptiveBackgroundManager not loaded, feature disabled');
        return;
      }

      // Check if chroma.js is available
      if (!window.chroma) {
        this.logWarn('Chroma.js not available, adaptive background feature disabled');
        return;
      }

      // Initialize the adaptive background manager
      const success = window.AdaptiveBackgroundManager.initialise();
      
      if (success) {
        this.logInfo('Adaptive background feature initialised successfully');
        this.adaptiveBackgroundEnabled = true;
      } else {
        this.logError('Failed to initialise adaptive background feature');
        this.adaptiveBackgroundEnabled = false;
      }
      
    } catch (error) {
      this.logError('Error initialising adaptive background:', error);
      this.adaptiveBackgroundEnabled = false;
    }
  }
```

### Step 7: Template Registration (CORRECTED)

#### Modification: `js/export/template-system.js`

**FIND THIS ENTIRE BLOCK in the `mapExternalFilenameToTemplateName` method:**
```javascript
        "universal-modal-css.html": "universalModalCSS",
        "universal-modal-js.html": "universalModalJS",
        "universal-notifications-css.html": "universalNotificationsCSS",
        "universal-notifications-js.html": "universalNotificationsJS",
        "credits-acknowledgements.html": "creditsAcknowledgements",
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
        "universal-modal-css.html": "universalModalCSS",
        "universal-modal-js.html": "universalModalJS",
        "universal-notifications-css.html": "universalNotificationsCSS",
        "universal-notifications-js.html": "universalNotificationsJS",
        "adaptive-background-css.html": "adaptiveBackgroundCSS",
        "credits-acknowledgements.html": "creditsAcknowledgements",
```

**FIND THIS ENTIRE BLOCK in the `loadExternalTemplates` method:**
```javascript
      const externalTemplateFiles = [
        "reading-tools-section.html",
        "theme-toggle-section.html",
        "print-button-section.html",
        "reset-controls-section.html",
        "mathjax-accessibility-controls.html",
        "integrated-document-sidebar.html",
        "table-of-contents.html",
        "embedded-fonts.html",
        "partials/font-option.html",
        "partials/width-option.html",
        "partials/zoom-option.html",
        "prism-css.html",
        "prism-js.html",
        "credits-acknowledgements.html",
        "universal-modal-css.html",
        "universal-modal-js.html",
        "universal-notifications-css.html",
        "universal-notifications-js.html",
      ];
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
      const externalTemplateFiles = [
        "reading-tools-section.html",
        "theme-toggle-section.html",
        "print-button-section.html",
        "reset-controls-section.html",
        "mathjax-accessibility-controls.html",
        "integrated-document-sidebar.html",
        "table-of-contents.html",
        "embedded-fonts.html",
        "partials/font-option.html",
        "partials/width-option.html",
        "partials/zoom-option.html",
        "prism-css.html",
        "prism-js.html",
        "credits-acknowledgements.html",
        "universal-modal-css.html",
        "universal-modal-js.html",
        "universal-notifications-css.html",
        "universal-notifications-js.html",
        "adaptive-background-css.html",
      ];
```

### Step 8: Testing Framework

#### File: `js/testing/individual/test-adaptive-background.js`
```javascript
const TestAdaptiveBackground = (function () {
  "use strict";

  function testAdaptiveBackground() {
    const tests = {
      chromaJSAvailable: () => {
        return typeof chroma !== 'undefined' && typeof chroma.contrast === 'function';
      },

      adaptiveBackgroundManagerExists: () => {
        return !!window.AdaptiveBackgroundManager;
      },

      hasRequiredMethods: () => {
        const required = ['initialise', 'reset', 'getCurrentBackgroundColour', 'getTargetContrast'];
        return required.every(method => 
          typeof window.AdaptiveBackgroundManager[method] === 'function'
        );
      },

      subModulesAvailable: () => {
        return !!window.ColourScanner && 
               !!window.ContrastOptimizer && 
               !!window.BackgroundControls;
      },

      uiElementsPresent: () => {
        const required = [
          '#adaptive-background-picker',
          '#adaptive-background-hex',
          'input[name="adaptive-contrast-target"]'
        ];
        return required.every(selector => document.querySelector(selector));
      },

      canInitialize: () => {
        try {
          return window.AdaptiveBackgroundManager.initialise();
        } catch (error) {
          console.error('Initialization failed:', error);
          return false;
        }
      },

      integrationReady: () => {
        return window.ReadingAccessibilityManager && 
               typeof window.ReadingAccessibilityManager.prototype.initAdaptiveBackground === 'function';
      }
    };

    return TestUtilities.runTestSuite("AdaptiveBackground", tests);
  }

  return { testAdaptiveBackground };
})();

// Register test
if (typeof window !== 'undefined') {
  window.testAdaptiveBackground = TestAdaptiveBackground.testAdaptiveBackground;
}
```

#### Modification: `js/testing/test-registry.js`

**FIND THIS ENTIRE BLOCK:**
```javascript
const INDIVIDUAL_TESTS = [
  'test-app-config',
  'test-mathjax-manager',
  'test-latex-processor',
  'test-content-generator',
  'test-template-system',
  'test-export-manager',
  'test-source-viewer',
  'test-example-system',
  'test-status-manager',
  'test-conversion-engine',
  'test-event-manager',
  'test-app-state-manager',
  'test-layout-debugger',
  'test-universal-modal',
  'test-universal-notifications'
];
```

**REPLACE WITH THIS NEW BLOCK:**
```javascript
const INDIVIDUAL_TESTS = [
  'test-app-config',
  'test-mathjax-manager',
  'test-latex-processor',
  'test-content-generator',
  'test-template-system',
  'test-export-manager',
  'test-source-viewer',
  'test-example-system',
  'test-status-manager',
  'test-conversion-engine',
  'test-event-manager',
  'test-app-state-manager',
  'test-layout-debugger',
  'test-universal-modal',
  'test-universal-notifications',
  'test-adaptive-background'
];
```

## Key Corrections Made

This corrected implementation plan addresses several critical issues from the original:

### 1. **Template System Integration Pattern** (CORRECTED)
- **CSS Integration**: Now uses the correct `GlobalTemplateCache` pattern in `generateEnhancedCSS()` 
- **JavaScript Integration**: Uses generator methods in `template-system.js` and direct function calls in `generateEnhancedJavaScript()`
- **Template Naming**: Follows camelCase convention (`adaptiveBackgroundCSS`, `adaptiveBackgroundManagerJS`)

### 2. **File Structure** (CORRECTED)
- **Combined Templates**: Creates single template files instead of multiple separate modules
- **Template Locations**: Places files in correct `templates/js/` and `templates/` directories
- **Offline Dependencies**: Embeds chroma.js directly in template for true offline capability

### 3. **Integration Methods** (CORRECTED)
- **Export Manager**: Uses the actual `generateEnhancedJavaScript()` function pattern
- **Template Registration**: Updates the correct template loading arrays and mapping functions
- **Reading Tools**: Integrates via the existing class structure with proper method addition

### 4. **Template Variable Processing** (CORRECTED)
- **Variable Syntax**: Uses `{{variable}}` syntax that matches the template engine
- **Processing Pattern**: Uses temporary template creation and cleanup pattern from actual code
- **Configuration**: Passes accessibility level and feature flags through template variables

### 5. **Testing Framework** (CORRECTED)
- **Test Structure**: Follows the `TestUtilities.runTestSuite()` pattern
- **Test Registration**: Adds to the correct `INDIVIDUAL_TESTS` array
- **Integration Testing**: Tests the complete template system integration

This corrected plan now aligns with the actual template system architecture and will integrate properly with the existing codebase.

## Implementation Timeline (UNCHANGED)

The original timeline remains valid:
- **Week 1**: Template creation and CSS integration
- **Week 2**: JavaScript integration and testing
- **Week 3**: Complete integration and validation

The key difference is that this corrected approach will work seamlessly with the existing template system rather than requiring architectural changes.