// test-mathematical-consistency.js
// Enhanced Mathematical Consistency Testing Framework
// Comprehensive validation for playground vs export mathematical rendering

const TestMathematicalConsistency = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[MATHTEST]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MATHTEST]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[MATHTEST]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MATHTEST]", message, ...args);
  }

  // ===========================================================================================
  // MATHEMATICAL TEST EXPRESSIONS
  // ===========================================================================================

  const testExpressions = {
    basic: {
      superscript: "x^2 + y^2 = z^2",
      subscript: "H_2O + NaCl \\rightarrow H_2SO_4",
      fraction: "\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}",
      squareRoot: "\\sqrt{x^2 + y^2} = |z|",
      nthRoot: "\\sqrt[n]{x} = x^{1/n}",
      mixed: "x^{2n+1} + \\frac{1}{\\sqrt{2\\pi}} = \\sum_{i=1}^n a_i",
    },

    complex: {
      summation: "\\sum_{i=1}^{\\infty} \\frac{1}{i^2} = \\frac{\\pi^2}{6}",
      integral: "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
      limit: "\\lim_{x \\to \\infty} \\left(1 + \\frac{1}{x}\\right)^x = e",
      matrix:
        "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} ax+by \\\\ cx+dy \\end{pmatrix}",
      cases:
        "f(x) = \\begin{cases} x^2 & \\text{if } x > 0 \\\\ -x^2 & \\text{if } x < 0 \\\\ 0 & \\text{if } x = 0 \\end{cases}",
      aligned: "\\begin{align} x + y &= 5 \\\\ 2x - y &= 1 \\end{align}",
    },

    symbols: {
      setTheory: "A \\cup B = \\{x : x \\in A \\text{ or } x \\in B\\}",
      logic:
        "\\forall x \\in \\mathbb{R}, \\exists y \\in \\mathbb{R} : x + y = 0",
      relations: "a \\equiv b \\pmod{n} \\Leftrightarrow n \\mid (a-b)",
      arrows: "A \\xrightarrow{f} B \\xrightarrow{g} C",
      blackboard:
        "\\mathbb{N} \\subset \\mathbb{Z} \\subset \\mathbb{Q} \\subset \\mathbb{R} \\subset \\mathbb{C}",
      calligraphic:
        "\\mathcal{L}(\\mathcal{F}) = \\{f \\in \\mathcal{F} : f \\text{ is linear}\\}",
    },

    fonts: {
      bold: "\\mathbf{v} = \\mathbf{u} + \\mathbf{w}",
      italic: "\\mathit{velocity} = \\frac{\\mathit{distance}}{\\mathit{time}}",
      roman:
        "\\mathrm{sin}(x) + \\mathrm{cos}(x) = \\sqrt{2}\\mathrm{sin}(x + \\frac{\\pi}{4})",
      typewriter: "\\mathtt{function}(\\mathtt{argument}) = \\mathtt{result}",
      sans: "\\mathsf{Vector} \\times \\mathsf{Matrix} = \\mathsf{Result}",
      fraktur:
        "\\mathfrak{g} \\subseteq \\mathfrak{h} \\text{ implies } [\\mathfrak{g}, \\mathfrak{g}] \\subseteq \\mathfrak{g}",
    },

    mixed: {
      inlineDisplay:
        "Inline $\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$ and display $$\\int_0^1 x^2 dx = \\frac{1}{3}$$",
      environments:
        "\\begin{theorem} For any $n \\in \\mathbb{N}$: $$\\sum_{k=1}^n k^2 = \\frac{n(n+1)(2n+1)}{6}$$ \\end{theorem}",
      chemical:
        "\\ce{2H2 + O2 -> 2H2O} \\quad \\Delta H = -285.8 \\text{ kJ/mol}",
      physics:
        "E = mc^2 \\quad F = ma \\quad \\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\epsilon_0}",
    },
  };

  // ===========================================================================================
  // MATHEMATICAL CONSISTENCY TESTING
  // ===========================================================================================

  /**
   * Test mathematical expression rendering consistency
   */
  function testLatexConsistency() {
    logInfo("Testing LaTeX mathematical consistency...");

    try {
      const tests = {
        basicExpressions: () => testExpressionCategory("basic"),
        complexExpressions: () => testExpressionCategory("complex"),
        symbolsAndOperators: () => testExpressionCategory("symbols"),
        mathematicalFonts: () => testExpressionCategory("fonts"),
        mixedContent: () => testExpressionCategory("mixed"),
        playgroundRendering: () => validatePlaygroundRendering(),
        phase2bEnhancement: () => validatePhase2BEnhancement(),
        annotationCoverage: () => validateAnnotationCoverage(),
      };

      return TestUtilities.runTestSuite(
        "LaTeX Mathematical Consistency",
        tests
      );
    } catch (error) {
      logError("LaTeX consistency test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test all mathematical expressions in a category
   */
  function testExpressionCategory(category) {
    const expressions = testExpressions[category];
    if (!expressions) return false;

    let passed = 0;
    let total = 0;

    for (const [name, latex] of Object.entries(expressions)) {
      total++;
      if (testMathExpression(latex, `${category}.${name}`)) {
        passed++;
      }
    }

    logDebug(`Category ${category}: ${passed}/${total} expressions passed`);
    return passed === total;
  }

  /**
   * Test individual mathematical expression
   */
  function testMathExpression(latex, identifier = null) {
    try {
      logDebug(
        `Testing expression: ${identifier || latex.substring(0, 20) + "..."}`
      );

      // Validate LaTeX syntax
      if (!validateLatexSyntax(latex)) {
        logWarn(`Invalid LaTeX syntax: ${identifier}`);
        return false;
      }

      // Test playground rendering
      if (!testPlaygroundRendering(latex)) {
        logWarn(`Playground rendering failed: ${identifier}`);
        return false;
      }

      // Test export generation
      if (!testExportGeneration(latex)) {
        logWarn(`Export generation failed: ${identifier}`);
        return false;
      }

      return true;
    } catch (error) {
      logError(`Error testing expression ${identifier}:`, error);
      return false;
    }
  }

  /**
   * Validate LaTeX syntax
   */
  function validateLatexSyntax(latex) {
    // Basic syntax validation
    const brackets = latex.match(/[\{\}]/g) || [];
    const openBrackets = brackets.filter((b) => b === "{").length;
    const closeBrackets = brackets.filter((b) => b === "}").length;

    if (openBrackets !== closeBrackets) {
      logWarn("Unbalanced braces in LaTeX");
      return false;
    }

    // Check for common LaTeX commands
    const hasValidCommands =
      /\\[a-zA-Z]+/.test(latex) || /[\$\{\}\^\_]/.test(latex);

    return hasValidCommands;
  }

  /**
   * Test playground rendering
   */
  function testPlaygroundRendering(latex) {
    try {
      // Check if MathJax is available
      if (!window.MathJax || !window.MathJax.tex2chtml) {
        logWarn("MathJax not available for playground testing");
        return false;
      }

      // Test rendering
      const rendered = window.MathJax.tex2chtml(latex, { display: false });
      return rendered && rendered.outerHTML && rendered.outerHTML.length > 0;
    } catch (error) {
      logError("Playground rendering error:", error);
      return false;
    }
  }

  /**
   * Test export generation
   */
  function testExportGeneration(latex) {
    try {
      // Check if LaTeXProcessor is available
      if (!window.LaTeXProcessor) {
        logWarn("LaTeXProcessor not available for export testing");
        return false;
      }

      // Test LaTeX processing
      const processed = window.LaTeXProcessor.processLatexDocument(latex);
      return processed && processed.includes("mjx-container");
    } catch (error) {
      logError("Export generation error:", error);
      return false;
    }
  }

  /**
   * Validate playground mathematical rendering
   */
  function validatePlaygroundRendering() {
    const containers = document.querySelectorAll("mjx-container");
    const count = containers.length;

    logInfo(`Found ${count} mathematical containers in playground`);

    // Check for minimum threshold (should have mathematical content)
    if (count === 0) {
      logWarn("No mathematical containers found in playground");
      return false;
    }

    // Validate container content
    let validContainers = 0;
    containers.forEach((container, index) => {
      if (container.textContent && container.textContent.trim().length > 0) {
        validContainers++;
      } else {
        logWarn(`Empty mathematical container found at index ${index}`);
      }
    });

    const success = validContainers === count && count >= 10; // Reasonable threshold
    logInfo(
      `Playground rendering validation: ${validContainers}/${count} valid containers`
    );

    return success;
  }

  /**
   * Validate Phase 2B enhancement
   */
  function validatePhase2BEnhancement() {
    try {
      if (
        !window.LaTeXProcessor ||
        !window.LaTeXProcessor.runPhase2BEnhancement
      ) {
        logWarn("Phase 2B enhancement not available");
        return false;
      }

      const result = window.LaTeXProcessor.runPhase2BEnhancement();

      if (!result) {
        logWarn("Phase 2B enhancement returned no result");
        return false;
      }

      const success = result.annotationCoveragePercent >= 80;
      logInfo(
        `Phase 2B enhancement: ${result.annotationCoveragePercent}% coverage (target: 80%)`
      );

      return success;
    } catch (error) {
      logError("Phase 2B enhancement validation error:", error);
      return false;
    }
  }

  /**
   * Validate annotation coverage
   */
  function validateAnnotationCoverage() {
    try {
      // Check for annotated mathematical elements
      const annotatedElements = document.querySelectorAll(
        '[title*="annotation"], [aria-label*="equation"], [data-semantic-annotation]'
      );
      const totalMathElements = document.querySelectorAll(
        "mjx-container, .math, .latex"
      ).length;

      if (totalMathElements === 0) {
        logWarn("No mathematical elements found for annotation coverage check");
        return false;
      }

      const coveragePercent =
        (annotatedElements.length / totalMathElements) * 100;
      const success = coveragePercent >= 70; // Slightly lower threshold for browser variance

      logInfo(
        `Annotation coverage: ${
          annotatedElements.length
        }/${totalMathElements} elements (${coveragePercent.toFixed(1)}%)`
      );

      return success;
    } catch (error) {
      logError("Annotation coverage validation error:", error);
      return false;
    }
  }

  // ===========================================================================================
  // ACCESSIBILITY CONTROLS TESTING
  // ===========================================================================================

  /**
   * Comprehensive accessibility controls validation
   */
  function testAccessibilityControls() {
    logInfo("Testing accessibility controls...");

    try {
      const tests = {
        dynamicMathJaxManager: () => testDynamicMathJaxManager(),
        zoomControls: () => testZoomControls(),
        screenReaderControls: () => testScreenReaderControls(),
        keyboardNavigation: () => testKeyboardNavigation(),
        contextMenus: () => testContextMenus(),
        ariaSupport: () => testAriaSupport(),
        themeCompatibility: () => testThemeCompatibility(),
        focusManagement: () => testFocusManagement(),
      };

      return TestUtilities.runTestSuite("Accessibility Controls", tests);
    } catch (error) {
      logError("Accessibility controls test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test Dynamic MathJax Manager
   */
  function testDynamicMathJaxManager() {
    // Check for manager existence
    if (!window.dynamicMathJaxManager && !window.MathJaxManager) {
      logWarn("No Dynamic MathJax Manager available");
      return false;
    }

    // Try to create manager if not exists
    if (!window.dynamicMathJaxManager && window.MathJaxManager) {
      try {
        window.dynamicMathJaxManager = window.MathJaxManager.createManager();
        logInfo("Created Dynamic MathJax Manager instance for testing");
      } catch (error) {
        logError("Failed to create Dynamic MathJax Manager:", error);
        return false;
      }
    }

    const manager = window.dynamicMathJaxManager;
    if (!manager) return false;

    // Test manager methods
    const hasGetCurrentSettings =
      typeof manager.getCurrentSettings === "function";
    const hasApplySettings = typeof manager.applySettings === "function";

    if (hasGetCurrentSettings) {
      const settings = manager.getCurrentSettings();
      logDebug("Current MathJax settings:", settings);

      return settings && typeof settings.zoomTrigger === "string";
    }

    return hasGetCurrentSettings && hasApplySettings;
  }

  /**
   * Test zoom controls
   */
  function testZoomControls() {
    // Check for zoom trigger controls
    const zoomTriggerRadios = document.querySelectorAll(
      'input[name="zoom-trigger"]'
    );
    const zoomScaleSlider = document.getElementById("zoom-scale");
    const zoomScaleValue = document.getElementById("zoom-scale-value");

    logDebug(`Found ${zoomTriggerRadios.length} zoom trigger controls`);
    logDebug(`Zoom scale slider: ${!!zoomScaleSlider}`);
    logDebug(`Zoom scale value display: ${!!zoomScaleValue}`);

    // Minimum requirements
    const hasZoomTriggers = zoomTriggerRadios.length >= 3; // Click, DoubleClick, NoZoom
    const hasZoomScale = !!zoomScaleSlider;

    // Test zoom trigger values
    const expectedValues = ["Click", "DoubleClick", "NoZoom"];
    const actualValues = Array.from(zoomTriggerRadios).map((r) => r.value);
    const hasCorrectValues = expectedValues.every((val) =>
      actualValues.includes(val)
    );

    return hasZoomTriggers && hasZoomScale && hasCorrectValues;
  }

  /**
   * Test screen reader controls
   */
  function testScreenReaderControls() {
    // Check for assistive MathML checkbox
    const assistiveMmlCheckbox = document.getElementById("assistive-mathml");
    const tabNavigationCheckbox = document.getElementById("tab-navigation");

    logDebug(`Assistive MathML control: ${!!assistiveMmlCheckbox}`);
    logDebug(`Tab navigation control: ${!!tabNavigationCheckbox}`);

    // Check for proper labeling
    const hasProperLabels =
      document.querySelectorAll(
        'label[for="assistive-mathml"], label[for="tab-navigation"]'
      ).length >= 2;

    return !!assistiveMmlCheckbox && !!tabNavigationCheckbox && hasProperLabels;
  }

  /**
   * Test keyboard navigation
   */
  function testKeyboardNavigation() {
    // Check for keyboard-accessible elements
    const focusableElements = document.querySelectorAll(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const accessibilityControls = document.querySelectorAll(
      "#accessibility-controls button, #accessibility-controls input"
    );

    logDebug(`Total focusable elements: ${focusableElements.length}`);
    logDebug(`Accessibility controls: ${accessibilityControls.length}`);

    // Test tab order
    let hasLogicalTabOrder = true;
    const controlsArray = Array.from(accessibilityControls);
    for (let i = 0; i < controlsArray.length - 1; i++) {
      const current = controlsArray[i];
      const next = controlsArray[i + 1];

      if (
        current.tabIndex > 0 &&
        next.tabIndex > 0 &&
        current.tabIndex > next.tabIndex
      ) {
        hasLogicalTabOrder = false;
        break;
      }
    }

    return (
      focusableElements.length > 0 &&
      accessibilityControls.length > 0 &&
      hasLogicalTabOrder
    );
  }

  /**
   * Test context menus
   */
  function testContextMenus() {
    // Check if MathJax context menus are enabled
    if (!window.MathJax || !window.MathJax.config) {
      logWarn("MathJax not available for context menu testing");
      return false;
    }

    const config = window.MathJax.config;
    const hasMenuEnabled =
      config.options && config.options.enableMenu !== false;

    // Check for context menu elements in the DOM
    const contextMenus = document.querySelectorAll(
      '.MJX_ContextMenu, [role="menu"]'
    );

    logDebug(`MathJax menu enabled: ${hasMenuEnabled}`);
    logDebug(`Context menu elements found: ${contextMenus.length}`);

    return hasMenuEnabled;
  }

  /**
   * Test ARIA support
   */
  function testAriaSupport() {
    // Check for proper ARIA labels and roles
    const ariaElements = document.querySelectorAll(
      "[aria-label], [aria-labelledby], [aria-describedby], [role]"
    );
    const mathElements = document.querySelectorAll(
      "mjx-container[aria-label], .math[role]"
    );

    logDebug(`Elements with ARIA attributes: ${ariaElements.length}`);
    logDebug(`Mathematical elements with ARIA: ${mathElements.length}`);

    // Check for screen reader announcements
    const liveRegions = document.querySelectorAll(
      '[aria-live], [role="status"], [role="alert"]'
    );

    logDebug(`Live regions for announcements: ${liveRegions.length}`);

    return ariaElements.length > 0 && liveRegions.length > 0;
  }

  /**
   * Test theme compatibility
   */
  function testThemeCompatibility() {
    // Check if accessibility controls work with both light and dark themes
    const themeToggle = document.querySelector(".theme-toggle, #theme-toggle");

    if (!themeToggle) {
      logWarn("Theme toggle not found");
      return false;
    }

    // Check for theme-aware CSS
    const styles = getComputedStyle(document.body);
    const hasThemeVariables =
      styles.getPropertyValue("--bg-color") ||
      styles.getPropertyValue("--text-color") ||
      styles.backgroundColor !== "";

    logDebug(`Theme toggle available: ${!!themeToggle}`);
    logDebug(`Theme-aware styling: ${hasThemeVariables}`);

    return !!themeToggle && hasThemeVariables;
  }

  /**
   * Test focus management
   */
  function testFocusManagement() {
    // Check for visible focus indicators
    const focusableElements = document.querySelectorAll(
      "button, input, select, textarea"
    );

    let hasFocusStyles = false;
    focusableElements.forEach((element) => {
      const styles = getComputedStyle(element, ":focus");
      if (styles.outline !== "none" || styles.boxShadow !== "none") {
        hasFocusStyles = true;
      }
    });

    // Check for skip links
    const skipLinks = document.querySelectorAll(
      '.skip-link, [href="#main-content"]'
    );

    logDebug(`Focusable elements: ${focusableElements.length}`);
    logDebug(`Has focus styles: ${hasFocusStyles}`);
    logDebug(`Skip links: ${skipLinks.length}`);

    return hasFocusStyles && focusableElements.length > 0;
  }

  // ===========================================================================================
  // EXPORT CONSISTENCY TESTING
  // ===========================================================================================

  /**
   * Test export mathematical consistency
   */
  function testExportConsistency() {
    logInfo("Testing export mathematical consistency...");

    try {
      const tests = {
        exportGeneration: () => testExportGeneration(),
        mathJaxEmbedding: () => testMathJaxEmbedding(),
        accessibilityInExport: () => testAccessibilityInExport(),
        templateIntegration: () => testTemplateIntegration(),
        selfContainedExport: () => testSelfContainedExport(),
      };

      return TestUtilities.runTestSuite("Export Consistency", tests);
    } catch (error) {
      logError("Export consistency test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test export generation
   */
  function testExportGeneration() {
    if (
      !window.ExportManager ||
      !window.ExportManager.generateSelfContainedHTML
    ) {
      logWarn("ExportManager not available");
      return false;
    }

    try {
      // Test with simple mathematical content
      const testContent =
        "Simple test: $x^2 + y^2 = z^2$ and $$\\int_0^1 x dx = \\frac{1}{2}$$";

      // This is a simplified test - in practice, we'd need to mock the full export process
      const hasExportFunction =
        typeof window.ExportManager.generateSelfContainedHTML === "function";
      const hasContentGenerator = !!window.ContentGenerator;
      const hasTemplateSystem = !!window.TemplateSystem;

      return hasExportFunction && hasContentGenerator && hasTemplateSystem;
    } catch (error) {
      logError("Export generation test error:", error);
      return false;
    }
  }

  /**
   * Test MathJax embedding in exports
   */
  function testMathJaxEmbedding() {
    if (
      !window.ContentGenerator ||
      !window.ContentGenerator.generateMathJaxConfig
    ) {
      logWarn("ContentGenerator MathJax functions not available");
      return false;
    }

    try {
      const config = window.ContentGenerator.generateMathJaxConfig();
      const hasValidConfig =
        config.includes("MathJax") && config.includes("tex2chtml");

      return hasValidConfig;
    } catch (error) {
      logError("MathJax embedding test error:", error);
      return false;
    }
  }

  /**
   * Test accessibility features in exports
   */
  function testAccessibilityInExport() {
    if (!window.TemplateSystem) {
      logWarn("TemplateSystem not available for accessibility testing");
      return false;
    }

    try {
      const generator = window.TemplateSystem.createGenerator();
      const accessibilityHTML = generator.renderTemplate(
        "mathJaxAccessibilityControls"
      );

      const hasAccessibilityControls =
        accessibilityHTML.includes("zoom-trigger") &&
        accessibilityHTML.includes("assistive-mathml");

      return hasAccessibilityControls;
    } catch (error) {
      logError("Accessibility in export test error:", error);
      return false;
    }
  }

  /**
   * Test template integration
   */
  function testTemplateIntegration() {
    if (!window.TemplateSystem) {
      logWarn("TemplateSystem not available");
      return false;
    }

    try {
      const generator = window.TemplateSystem.createGenerator();

      // Test key templates
      const templates = [
        "mathJaxAccessibilityControls",
        "readingToolsSection",
        "themeToggleSection",
      ];

      let allTemplatesWork = true;
      templates.forEach((templateName) => {
        try {
          const html = generator.renderTemplate(templateName);
          if (!html || html.length < 50) {
            allTemplatesWork = false;
            logWarn(`Template ${templateName} produced insufficient content`);
          }
        } catch (error) {
          allTemplatesWork = false;
          logWarn(`Template ${templateName} failed:`, error.message);
        }
      });

      return allTemplatesWork;
    } catch (error) {
      logError("Template integration test error:", error);
      return false;
    }
  }

  /**
   * Test self-contained export functionality
   */
  function testSelfContainedExport() {
    // Check for required modules
    const requiredModules = [
      "ExportManager",
      "ContentGenerator",
      "TemplateSystem",
      "LaTeXProcessor",
    ];

    let allModulesAvailable = true;
    requiredModules.forEach((moduleName) => {
      if (!window[moduleName]) {
        logWarn(`Required module ${moduleName} not available`);
        allModulesAvailable = false;
      }
    });

    // Check for export button functionality
    const exportButton = document.getElementById("export-button");
    const hasExportButton = !!exportButton && !exportButton.disabled;

    return allModulesAvailable && hasExportButton;
  }

  // ===========================================================================================
  // COMPREHENSIVE TESTING COMMANDS
  // ===========================================================================================

  /**
   * Test all mathematical expressions comprehensively
   */
  function testAllMathExpressions() {
    logInfo("Running comprehensive mathematical expression tests...");

    const results = {
      consistency: testLatexConsistency(),
      accessibility: testAccessibilityControls(),
      exportConsistency: testExportConsistency(),
    };

    const overallSuccess = Object.values(results).every((r) => r.success);

    console.log("\n" + "=".repeat(60));
    console.log("🧮 COMPREHENSIVE MATHEMATICAL TESTING RESULTS");
    console.log("=".repeat(60));
    console.log(
      `📊 LaTeX Consistency: ${
        results.consistency.success ? "✅ PASS" : "❌ FAIL"
      } (${results.consistency.passed}/${results.consistency.total} tests)`
    );
    console.log(
      `♿ Accessibility Controls: ${
        results.accessibility.success ? "✅ PASS" : "❌ FAIL"
      } (${results.accessibility.passed}/${results.accessibility.total} tests)`
    );
    console.log(
      `📤 Export Consistency: ${
        results.exportConsistency.success ? "✅ PASS" : "❌ FAIL"
      } (${results.exportConsistency.passed}/${
        results.exportConsistency.total
      } tests)`
    );
    console.log("=".repeat(60));
    console.log(
      `🎯 Overall Status: ${
        overallSuccess ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
      }`
    );
    console.log("=".repeat(60));

    return {
      success: overallSuccess,
      results: results,
      summary: {
        totalTests: Object.values(results).reduce((sum, r) => sum + r.total, 0),
        passedTests: Object.values(results).reduce(
          (sum, r) => sum + r.passed,
          0
        ),
        categories: Object.keys(results).length,
      },
    };
  }

  /**
   * Quick mathematical consistency check
   */
  function checkMathConsistency() {
    const containers = document.querySelectorAll("mjx-container");
    const hasRendering = containers.length > 0;

    // Check Phase 2B enhancement
    let phase2bStatus = false;
    if (window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement) {
      try {
        const result = window.LaTeXProcessor.runPhase2BEnhancement();
        phase2bStatus = result && result.annotationCoveragePercent >= 80;
      } catch (error) {
        logWarn("Phase 2B enhancement check failed:", error);
      }
    }

    // Check accessibility controls
    const zoomControls =
      document.querySelectorAll('input[name="zoom-trigger"]').length >= 3;
    const dynamicManager = !!window.dynamicMathJaxManager;

    return {
      mathematicalRendering: hasRendering,
      containerCount: containers.length,
      phase2bEnhancement: phase2bStatus,
      zoomControls: zoomControls,
      dynamicManager: dynamicManager,
      overallHealth: hasRendering && zoomControls,
    };
  }

  /**
   * Diagnostic report for mathematical consistency
   */
  function generateMathDiagnosticReport() {
    console.log("\n" + "=".repeat(50));
    console.log("🔬 MATHEMATICAL CONSISTENCY DIAGNOSTIC REPORT");
    console.log("=".repeat(50));

    const consistency = checkMathConsistency();

    console.log(
      `📊 Mathematical Containers: ${consistency.containerCount} ${
        consistency.mathematicalRendering ? "✅" : "❌"
      }`
    );
    console.log(
      `🚀 Phase 2B Enhancement: ${
        consistency.phase2bEnhancement ? "✅ ACTIVE" : "❌ INACTIVE"
      }`
    );
    console.log(
      `🎛️ Zoom Controls: ${
        consistency.zoomControls ? "✅ AVAILABLE" : "❌ MISSING"
      }`
    );
    console.log(
      `⚙️ Dynamic Manager: ${
        consistency.dynamicManager ? "✅ LOADED" : "❌ NOT LOADED"
      }`
    );

    // Accessibility status
    console.log("\n📋 Accessibility Controls Status:");
    const assistiveMml = document.getElementById("assistive-mathml");
    const tabNavigation = document.getElementById("tab-navigation");
    const zoomScale = document.getElementById("zoom-scale");

    console.log(
      `   • Assistive MathML: ${
        assistiveMml
          ? assistiveMml.checked
            ? "✅ ENABLED"
            : "⚠️ AVAILABLE"
          : "❌ MISSING"
      }`
    );
    console.log(
      `   • Tab Navigation: ${
        tabNavigation
          ? tabNavigation.checked
            ? "✅ ENABLED"
            : "⚠️ AVAILABLE"
          : "❌ MISSING"
      }`
    );
    console.log(
      `   • Zoom Scale: ${
        zoomScale ? `✅ SET TO ${zoomScale.value}%` : "❌ MISSING"
      }`
    );

    // Test expressions
    console.log("\n🧮 Quick Expression Tests:");
    const quickTests = {
      "Basic Equation": "x^2 + y^2 = z^2",
      Fraction: "\\frac{a}{b}",
      Summation: "\\sum_{i=1}^n i",
    };

    for (const [name, latex] of Object.entries(quickTests)) {
      const works = testMathExpression(latex, name);
      console.log(`   • ${name}: ${works ? "✅ RENDERS" : "❌ FAILED"}`);
    }

    console.log("=".repeat(50));
    console.log(
      `🎯 Overall Status: ${
        consistency.overallHealth ? "✅ HEALTHY" : "⚠️ NEEDS ATTENTION"
      }`
    );
    console.log("=".repeat(50));

    return consistency;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testLatexConsistency,
    testAccessibilityControls,
    testExportConsistency,
    testAllMathExpressions,
    testMathExpression,
    checkMathConsistency,
    generateMathDiagnosticReport,

    // Individual test categories
    testExpressionCategory,
    testDynamicMathJaxManager,
    testZoomControls,
    testScreenReaderControls,
    testKeyboardNavigation,

    // Test data access
    getTestExpressions: () => testExpressions,

    // Quick validation
    validatePlaygroundRendering,
    validatePhase2BEnhancement,
    validateAnnotationCoverage,
  };
})();

// Export global testing functions
if (typeof window !== "undefined") {
  // Enhanced mathematical testing commands
  window.testLatexConsistency =
    TestMathematicalConsistency.testLatexConsistency;
  window.testAccessibilityControls =
    TestMathematicalConsistency.testAccessibilityControls;
  window.testExportConsistency =
    TestMathematicalConsistency.testExportConsistency;
  window.testAllMathExpressions =
    TestMathematicalConsistency.testAllMathExpressions;
  window.testMathExpression = TestMathematicalConsistency.testMathExpression;
  window.checkMathConsistency =
    TestMathematicalConsistency.checkMathConsistency;
  window.generateMathDiagnosticReport =
    TestMathematicalConsistency.generateMathDiagnosticReport;

  // Individual component tests
  window.testDynamicMathJaxManager =
    TestMathematicalConsistency.testDynamicMathJaxManager;
  window.testZoomControls = TestMathematicalConsistency.testZoomControls;
  window.testScreenReaderControls =
    TestMathematicalConsistency.testScreenReaderControls;

  console.log("🧮 Enhanced Mathematical Consistency Testing Framework loaded");
  console.log("📋 Available commands:");
  console.log(
    "   • testAllMathExpressions() - Comprehensive mathematical testing"
  );
  console.log("   • testLatexConsistency() - LaTeX expression validation");
  console.log(
    "   • testAccessibilityControls() - Accessibility features validation"
  );
  console.log("   • testExportConsistency() - Export pipeline validation");
  console.log("   • checkMathConsistency() - Quick health check");
  console.log(
    "   • generateMathDiagnosticReport() - Detailed diagnostic report"
  );
  console.log("   • testMathExpression('latex') - Test individual expression");
}

console.log("✅ Enhanced Mathematical Consistency Testing Framework ready");
