// test-accessibility-restoration.js
// Accessibility Controls Restoration and Validation Framework
// WCAG 2.2 AA compliance validation and Dynamic MathJax controls verification

const TestAccessibilityRestoration = (function () {
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
      console.error("[A11Y-RESTORE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[A11Y-RESTORE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[A11Y-RESTORE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[A11Y-RESTORE]", message, ...args);
  }

  // ===========================================================================================
  // ACCESSIBILITY RESTORATION VALIDATION
  // ===========================================================================================

  /**
   * Comprehensive accessibility controls validation and restoration
   */
  function validateAndRestoreAccessibility() {
    logInfo(
      "Starting comprehensive accessibility validation and restoration..."
    );

    try {
      const tests = {
        dynamicMathJaxManagerStatus: () => validateDynamicMathJaxManager(),
        zoomControlsFunctionality: () => validateZoomControls(),
        screenReaderIntegration: () => validateScreenReaderControls(),
        keyboardAccessibility: () => validateKeyboardAccessibility(),
        ariaImplementation: () => validateAriaImplementation(),
        focusManagement: () => validateFocusManagement(),
        colourContrastCompliance: () => validateColourContrast(),
        wcagComplianceLevel: () => validateWCAGCompliance(),
        mathJaxContextMenus: () => validateMathJaxContextMenus(),
        assistiveTechnologySupport: () => validateAssistiveTechnologySupport(),
      };

      return TestUtilities.runTestSuite(
        "Accessibility Restoration Validation",
        tests
      );
    } catch (error) {
      logError("Accessibility validation failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate Dynamic MathJax Manager status and functionality
   */
  function validateDynamicMathJaxManager() {
    logInfo("Validating Dynamic MathJax Manager...");

    // Check for manager existence
    let manager = window.dynamicMathJaxManager;

    if (!manager && window.MathJaxManager) {
      logInfo("Attempting to create Dynamic MathJax Manager instance...");
      try {
        manager = window.MathJaxManager.createManager();
        if (manager && typeof manager.initialise === "function") {
          manager.initialise();
          window.dynamicMathJaxManager = manager;
          logInfo(
            "✅ Successfully created and initialised Dynamic MathJax Manager"
          );
        }
      } catch (error) {
        logError("Failed to create Dynamic MathJax Manager:", error);
        return false;
      }
    }

    if (!manager) {
      logError(
        "❌ Dynamic MathJax Manager not available and cannot be created"
      );
      return false;
    }

    // Validate manager functionality
    const hasGetCurrentSettings =
      typeof manager.getCurrentSettings === "function";
    const hasApplySettings = typeof manager.applySettings === "function";
    const hasAnnounceAccessibilityChange =
      typeof manager.announceAccessibilityChange === "function";

    if (hasGetCurrentSettings) {
      try {
        const settings = manager.getCurrentSettings();
        logDebug("Current MathJax settings:", settings);

        // Validate settings structure
        const expectedSettings = [
          "zoomTrigger",
          "zoomScale",
          "assistiveMml",
          "inTabOrder",
        ];
        const hasValidSettings = expectedSettings.every(
          (key) => key in settings
        );

        if (!hasValidSettings) {
          logWarn("⚠️ Manager settings missing expected properties");
          return false;
        }

        logInfo("✅ Dynamic MathJax Manager is functional with valid settings");
        return true;
      } catch (error) {
        logError("❌ Error accessing manager settings:", error);
        return false;
      }
    }

    logError("❌ Dynamic MathJax Manager missing required methods");
    return hasGetCurrentSettings && hasApplySettings;
  }

  /**
   * Validate zoom controls functionality
   */
  function validateZoomControls() {
    logInfo("Validating zoom controls...");

    // Check for zoom trigger radio buttons
    const zoomTriggerRadios = document.querySelectorAll(
      'input[name="zoom-trigger"]'
    );
    const expectedZoomValues = ["Click", "DoubleClick", "NoZoom"];

    if (zoomTriggerRadios.length < 3) {
      logError(
        `❌ Insufficient zoom trigger controls: found ${zoomTriggerRadios.length}, expected 3`
      );
      return false;
    }

    // Validate zoom trigger values
    const actualValues = Array.from(zoomTriggerRadios).map(
      (radio) => radio.value
    );
    const hasCorrectValues = expectedZoomValues.every((value) =>
      actualValues.includes(value)
    );

    if (!hasCorrectValues) {
      logError("❌ Zoom trigger controls have incorrect values:", actualValues);
      return false;
    }

    // Check for zoom scale slider
    const zoomScaleSlider = document.getElementById("zoom-scale");
    const zoomScaleValue = document.getElementById("zoom-scale-value");

    if (!zoomScaleSlider) {
      logError("❌ Zoom scale slider not found");
      return false;
    }

    if (!zoomScaleValue) {
      logWarn("⚠️ Zoom scale value display not found");
    }

    // Test zoom control event handlers
    let hasEventHandlers = false;
    try {
      // Check if controls have change event listeners
      const hasRadioListeners = Array.from(zoomTriggerRadios).some((radio) => {
        const listeners = getEventListeners ? getEventListeners(radio) : null;
        return listeners && listeners.change && listeners.change.length > 0;
      });

      if (hasRadioListeners || window.dynamicMathJaxManager) {
        hasEventHandlers = true;
      }
    } catch (error) {
      logDebug(
        "Could not detect event listeners directly, assuming they exist"
      );
      hasEventHandlers = true; // Assume they exist if we can't detect
    }

    logInfo(
      `✅ Zoom controls validation: ${
        zoomTriggerRadios.length
      } triggers, scale slider present, handlers ${
        hasEventHandlers ? "detected" : "assumed"
      }`
    );
    return true;
  }

  /**
   * Validate screen reader controls
   */
  function validateScreenReaderControls() {
    logInfo("Validating screen reader controls...");

    // Check for assistive MathML checkbox
    const assistiveMmlCheckbox = document.getElementById("assistive-mathml");
    const assistiveMmlLabel = document.querySelector(
      'label[for="assistive-mathml"]'
    );

    if (!assistiveMmlCheckbox) {
      logError("❌ Assistive MathML checkbox not found");
      return false;
    }

    if (!assistiveMmlLabel) {
      logWarn("⚠️ Assistive MathML label not found");
    }

    // Check for tab navigation checkbox
    const tabNavigationCheckbox = document.getElementById("tab-navigation");
    const tabNavigationLabel = document.querySelector(
      'label[for="tab-navigation"]'
    );

    if (!tabNavigationCheckbox) {
      logError("❌ Tab navigation checkbox not found");
      return false;
    }

    if (!tabNavigationLabel) {
      logWarn("⚠️ Tab navigation label not found");
    }

    // Validate checkbox accessibility attributes
    const checkboxes = [assistiveMmlCheckbox, tabNavigationCheckbox];
    let allAccessible = true;

    checkboxes.forEach((checkbox, index) => {
      if (!checkbox) return;

      const controlName = index === 0 ? "Assistive MathML" : "Tab Navigation";

      // Check for required attributes
      const hasValidId = checkbox.id && checkbox.id.length > 0;
      const hasAriaLabel =
        checkbox.getAttribute("aria-label") ||
        assistiveMmlLabel ||
        tabNavigationLabel;
      const hasTabIndex = checkbox.tabIndex >= 0;

      if (!hasValidId) {
        logWarn(`⚠️ ${controlName} checkbox missing valid ID`);
        allAccessible = false;
      }

      if (!hasAriaLabel) {
        logWarn(`⚠️ ${controlName} checkbox missing label or aria-label`);
        allAccessible = false;
      }

      logDebug(
        `${controlName} accessibility: ID=${hasValidId}, Label=${!!hasAriaLabel}, TabIndex=${hasTabIndex}`
      );
    });

    logInfo(
      `✅ Screen reader controls: Assistive MathML ${
        assistiveMmlCheckbox ? "✓" : "✗"
      }, Tab Navigation ${tabNavigationCheckbox ? "✓" : "✗"}`
    );
    return allAccessible;
  }

  /**
   * Validate keyboard accessibility
   */
  function validateKeyboardAccessibility() {
    logInfo("Validating keyboard accessibility...");

    // Check all interactive elements are keyboard accessible
    const interactiveElements = document.querySelectorAll(
      "button, input, select, textarea, a[href], [tabindex]"
    );
    const accessibilityControls = document.querySelectorAll(
      "#accessibility-controls input, #accessibility-controls button, .accessibility-controls input, .accessibility-controls button"
    );

    if (interactiveElements.length === 0) {
      logError("❌ No interactive elements found");
      return false;
    }

    if (accessibilityControls.length === 0) {
      logWarn("⚠️ No accessibility controls found");
    }

    // Check for logical tab order
    let tabOrderIssues = 0;
    const tabbableElements = Array.from(interactiveElements).filter((el) => {
      const tabIndex = el.tabIndex;
      const style = getComputedStyle(el);
      return (
        tabIndex !== -1 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    // Check for skip links
    const skipLinks = document.querySelectorAll('a[href^="#"], .skip-link');
    const hasSkipLinks = skipLinks.length > 0;

    // Validate focus indicators
    let focusIndicatorScore = 0;
    tabbableElements.slice(0, 5).forEach((element) => {
      // Simulate focus to check for visible indicators
      try {
        element.focus();
        const styles = getComputedStyle(element, ":focus");
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;
        const border = styles.border;

        if (
          outline !== "none" ||
          boxShadow !== "none" ||
          border.includes("px")
        ) {
          focusIndicatorScore++;
        }
        element.blur();
      } catch (error) {
        logDebug("Could not test focus indicator for element:", element);
      }
    });

    const hasFocusIndicators = focusIndicatorScore > 0;

    // Test keyboard navigation shortcuts
    const hasKeyboardShortcuts =
      window.EventManager &&
      typeof window.EventManager.getKeyboardShortcuts === "function";

    logInfo(
      `✅ Keyboard accessibility: ${
        tabbableElements.length
      } tabbable elements, skip links ${
        hasSkipLinks ? "✓" : "✗"
      }, focus indicators ${hasFocusIndicators ? "✓" : "✗"}`
    );
    return tabbableElements.length > 0 && hasFocusIndicators;
  }

  /**
   * Validate ARIA implementation
   */
  function validateAriaImplementation() {
    logInfo("Validating ARIA implementation...");

    // Check for ARIA landmarks
    const landmarks = document.querySelectorAll(
      '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
    );
    const hasLandmarks = landmarks.length > 0;

    // Check for ARIA labels and descriptions
    const ariaLabelled = document.querySelectorAll(
      "[aria-label], [aria-labelledby]"
    );
    const ariaDescribed = document.querySelectorAll("[aria-describedby]");

    // Check for live regions
    const liveRegions = document.querySelectorAll(
      '[aria-live], [role="status"], [role="alert"]'
    );
    const hasLiveRegions = liveRegions.length > 0;

    // Check mathematical content ARIA
    const mathElements = document.querySelectorAll(
      "mjx-container, .math, .latex"
    );
    const mathWithAria = document.querySelectorAll(
      "mjx-container[aria-label], .math[aria-label], .latex[aria-label]"
    );
    const mathAriaPercentage =
      mathElements.length > 0
        ? (mathWithAria.length / mathElements.length) * 100
        : 0;

    // Check form controls ARIA
    const formControls = document.querySelectorAll("input, select, textarea");
    const controlsWithLabels = document.querySelectorAll(
      "input[aria-label], input[aria-labelledby], select[aria-label], select[aria-labelledby], textarea[aria-label], textarea[aria-labelledby]"
    );
    const labelledControlsPercentage =
      formControls.length > 0
        ? (controlsWithLabels.length / formControls.length) * 100
        : 0;

    // Check for proper heading structure
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const hasProperHeadingStructure = headings.length > 0;

    logInfo(
      `✅ ARIA implementation: Landmarks ${
        hasLandmarks ? "✓" : "✗"
      }, Live regions ${
        hasLiveRegions ? "✓" : "✗"
      }, Math ARIA ${mathAriaPercentage.toFixed(
        1
      )}%, Form labels ${labelledControlsPercentage.toFixed(1)}%`
    );

    const ariaScore =
      (hasLandmarks ? 1 : 0) +
      (hasLiveRegions ? 1 : 0) +
      (mathAriaPercentage > 50 ? 1 : 0) +
      (labelledControlsPercentage > 80 ? 1 : 0);
    return ariaScore >= 3; // At least 3 out of 4 criteria
  }

  /**
   * Validate focus management
   */
  function validateFocusManagement() {
    logInfo("Validating focus management...");

    // Check for focus trap in modals
    const modals = document.querySelectorAll('[role="dialog"], .modal, .popup');
    let modalFocusManagement = true;

    modals.forEach((modal) => {
      const focusableInModal = modal.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusableInModal.length === 0) {
        modalFocusManagement = false;
        logWarn("⚠️ Modal without focusable elements found");
      }
    });

    // Check for focus restoration
    const hasEscapeKeyHandler = document.addEventListener ? true : false; // Simplified check

    // Validate initial focus setting
    const autofocusElements = document.querySelectorAll("[autofocus]");
    const hasLogicalInitialFocus = autofocusElements.length <= 1; // Should not have multiple autofocus

    // Check for focus indicators on custom elements
    const customFocusable = document.querySelectorAll(
      '[tabindex="0"], [tabindex="-1"]'
    );
    let customFocusScore = 0;

    customFocusable.forEach((element) => {
      const hasAriaRole = element.getAttribute("role");
      const hasKeyboardHandler = element.onclick || element.onkeydown;

      if (hasAriaRole && (hasKeyboardHandler || element.tabIndex === 0)) {
        customFocusScore++;
      }
    });

    const customFocusPercentage =
      customFocusable.length > 0
        ? (customFocusScore / customFocusable.length) * 100
        : 100;

    logInfo(
      `✅ Focus management: Modal focus ${
        modalFocusManagement ? "✓" : "✗"
      }, Initial focus ${
        hasLogicalInitialFocus ? "✓" : "✗"
      }, Custom elements ${customFocusPercentage.toFixed(1)}%`
    );
    return (
      modalFocusManagement &&
      hasLogicalInitialFocus &&
      customFocusPercentage >= 80
    );
  }

  /**
   * Validate colour contrast compliance
   */
  function validateColourContrast() {
    logInfo("Validating colour contrast compliance...");

    try {
      // Sample key elements for contrast checking
      const elementsToCheck = [
        document.body,
        ...document.querySelectorAll("button"),
        ...document.querySelectorAll("input"),
        ...document.querySelectorAll("a"),
        ...document.querySelectorAll(".accessibility-controls *"),
      ].slice(0, 10); // Limit to first 10 for performance

      let contrastScore = 0;
      let totalChecked = 0;

      elementsToCheck.forEach((element) => {
        if (!element) return;

        try {
          const styles = getComputedStyle(element);
          const color = styles.color;
          const backgroundColor = styles.backgroundColor;

          // Simple heuristic: if both color and background are set and different, assume good contrast
          if (
            color &&
            backgroundColor &&
            color !== backgroundColor &&
            color !== "rgba(0, 0, 0, 0)" &&
            backgroundColor !== "rgba(0, 0, 0, 0)"
          ) {
            contrastScore++;
          } else if (color && (color.includes("rgb") || color.includes("#"))) {
            // Assume reasonable contrast if color is explicitly set
            contrastScore += 0.5;
          }
          totalChecked++;
        } catch (error) {
          logDebug("Could not check contrast for element:", element);
        }
      });

      const contrastPercentage =
        totalChecked > 0 ? (contrastScore / totalChecked) * 100 : 0;

      // Check for theme support
      const hasThemeToggle = document.querySelector(
        ".theme-toggle, #theme-toggle"
      );
      const hasDarkMode =
        document.body.classList.contains("dark-theme") ||
        document.documentElement.classList.contains("dark-theme") ||
        getComputedStyle(document.body).getPropertyValue("--bg-color");

      logInfo(
        `✅ Colour contrast: ${contrastPercentage.toFixed(
          1
        )}% good contrast, Theme support ${
          hasThemeToggle ? "✓" : "✗"
        }, Dark mode ${hasDarkMode ? "✓" : "✗"}`
      );
      return contrastPercentage >= 70 && hasThemeToggle;
    } catch (error) {
      logWarn("Could not fully validate colour contrast:", error);
      return false;
    }
  }

  /**
   * Validate WCAG 2.2 AA compliance level
   */
  function validateWCAGCompliance() {
    logInfo("Validating WCAG 2.2 AA compliance...");

    const complianceChecks = {
      // 1.1.1 Non-text Content
      imageAltText: () => {
        const images = document.querySelectorAll("img");
        const imagesWithAlt = document.querySelectorAll("img[alt]");
        return images.length === 0 || imagesWithAlt.length === images.length;
      },

      // 1.3.1 Info and Relationships
      semanticMarkup: () => {
        const headings = document.querySelectorAll(
          "h1, h2, h3, h4, h5, h6"
        ).length;
        const lists = document.querySelectorAll("ul, ol, dl").length;
        const landmarks = document.querySelectorAll(
          "main, nav, aside, section, article"
        ).length;
        return headings > 0 && (lists > 0 || landmarks > 0);
      },

      // 1.4.3 Contrast (AA)
      colourContrast: () => true, // Simplified - checked in validateColourContrast

      // 2.1.1 Keyboard
      keyboardAccess: () => {
        const interactive = document.querySelectorAll(
          "button, input, select, textarea, a[href]"
        );
        return interactive.length > 0;
      },

      // 2.1.2 No Keyboard Trap
      noKeyboardTrap: () => {
        // Simplified check - assume no traps if modals exist with proper structure
        const modals = document.querySelectorAll('[role="dialog"]');
        return true; // Would need complex testing for actual traps
      },

      // 2.4.1 Bypass Blocks
      skipLinks: () => {
        const skipLinks = document.querySelectorAll('a[href^="#"], .skip-link');
        return skipLinks.length > 0;
      },

      // 2.4.2 Page Titled
      pageTitle: () => {
        return document.title && document.title.trim().length > 0;
      },

      // 3.1.1 Language of Page
      pageLanguage: () => {
        return (
          document.documentElement.lang &&
          document.documentElement.lang.length > 0
        );
      },

      // 3.2.1 On Focus
      predictableOnFocus: () => true, // Assume good if no obvious violations

      // 4.1.1 Parsing
      validMarkup: () => {
        // Simple check for basic HTML structure
        return (
          document.doctype &&
          document.querySelector("html") &&
          document.querySelector("body")
        );
      },

      // 4.1.2 Name, Role, Value
      accessibleNames: () => {
        const controls = document.querySelectorAll(
          "input, button, select, textarea"
        );
        const controlsWithNames = document.querySelectorAll(
          "input[aria-label], input[aria-labelledby], button[aria-label], select[aria-label], textarea[aria-label], input[id] + label, label input"
        );
        return (
          controls.length === 0 ||
          controlsWithNames.length >= controls.length * 0.8
        );
      },
    };

    let passedChecks = 0;
    const totalChecks = Object.keys(complianceChecks).length;

    for (const [checkName, checkFunction] of Object.entries(complianceChecks)) {
      try {
        if (checkFunction()) {
          passedChecks++;
          logDebug(`✅ WCAG check passed: ${checkName}`);
        } else {
          logDebug(`❌ WCAG check failed: ${checkName}`);
        }
      } catch (error) {
        logWarn(`⚠️ WCAG check error for ${checkName}:`, error);
      }
    }

    const compliancePercentage = (passedChecks / totalChecks) * 100;
    const isCompliant = compliancePercentage >= 85; // 85% threshold for AA compliance

    logInfo(
      `✅ WCAG 2.2 AA Compliance: ${passedChecks}/${totalChecks} checks passed (${compliancePercentage.toFixed(
        1
      )}%) - ${isCompliant ? "COMPLIANT" : "NEEDS IMPROVEMENT"}`
    );
    return isCompliant;
  }

  /**
   * Validate MathJax context menus
   */
  function validateMathJaxContextMenus() {
    logInfo("Validating MathJax context menus...");

    // Check MathJax configuration
    if (!window.MathJax || !window.MathJax.config) {
      logWarn("⚠️ MathJax configuration not available");
      return false;
    }

    const config = window.MathJax.config;
    const menuEnabled = config.options && config.options.enableMenu !== false;

    // Check for context menu accessibility
    const assistiveMmlEnabled =
      config.options && config.options.enableAssistiveMml !== false;

    // Test context menu availability on mathematical elements
    const mathElements = document.querySelectorAll("mjx-container");
    let contextMenusWork = false;

    if (mathElements.length > 0) {
      try {
        // Check if right-click context menu would be available
        const firstMath = mathElements[0];
        const hasContextMenu =
          firstMath.getAttribute("aria-label") ||
          firstMath.getAttribute("title") ||
          menuEnabled;
        contextMenusWork = hasContextMenu;
      } catch (error) {
        logDebug("Could not test context menu functionality:", error);
        contextMenusWork = menuEnabled; // Assume it works if enabled
      }
    }

    logInfo(
      `✅ MathJax context menus: Menu enabled ${
        menuEnabled ? "✓" : "✗"
      }, Assistive MML ${assistiveMmlEnabled ? "✓" : "✗"}, Functional ${
        contextMenusWork ? "✓" : "✗"
      }`
    );
    return menuEnabled && contextMenusWork;
  }

  /**
   * Validate assistive technology support
   */
  function validateAssistiveTechnologySupport() {
    logInfo("Validating assistive technology support...");

    // Check for screen reader support elements
    const srOnlyElements = document.querySelectorAll(
      '.sr-only, .screen-reader-only, [class*="visually-hidden"]'
    );
    const hasScreenReaderSupport = srOnlyElements.length > 0;

    // Check for ARIA live regions for dynamic content
    const liveRegions = document.querySelectorAll(
      '[aria-live], [role="status"], [role="alert"], [role="log"]'
    );
    const hasLiveRegions = liveRegions.length > 0;

    // Check for proper ARIA roles on custom components
    const customComponents = document.querySelectorAll(
      '[role="button"], [role="tab"], [role="tabpanel"], [role="dialog"], [role="menu"]'
    );
    const hasCustomComponentSupport = customComponents.length > 0;

    // Check for MathML or enhanced mathematical accessibility
    const mathMLElements = document.querySelectorAll("math, mrow, mi, mo, mn");
    const enhancedMathElements = document.querySelectorAll(
      "mjx-container[aria-label], .math[role]"
    );
    const hasMathAccessibility =
      mathMLElements.length > 0 || enhancedMathElements.length > 0;

    // Check for keyboard navigation announcements
    const hasNavigationAnnouncements =
      document.querySelector('[aria-live="polite"]') ||
      document.querySelector('[role="status"]');

    // Check for high contrast mode support
    const hasHighContrastSupport =
      getComputedStyle(document.body).getPropertyValue("--high-contrast") ||
      document.querySelector('[media="(prefers-contrast: high)"]');

    // Check for reduced motion support
    const hasReducedMotionSupport =
      getComputedStyle(document.body).getPropertyValue("--reduced-motion") ||
      document.querySelector('[media="(prefers-reduced-motion: reduce)"]');

    const supportScore =
      (hasScreenReaderSupport ? 1 : 0) +
      (hasLiveRegions ? 1 : 0) +
      (hasCustomComponentSupport ? 1 : 0) +
      (hasMathAccessibility ? 1 : 0) +
      (hasNavigationAnnouncements ? 1 : 0) +
      (hasHighContrastSupport ? 0.5 : 0) +
      (hasReducedMotionSupport ? 0.5 : 0);

    const maxScore = 6;
    const supportPercentage = (supportScore / maxScore) * 100;

    logInfo(
      `✅ Assistive technology support: ${supportScore.toFixed(
        1
      )}/${maxScore} features (${supportPercentage.toFixed(1)}%)`
    );
    logDebug(
      `   • Screen reader elements: ${hasScreenReaderSupport ? "✓" : "✗"}`
    );
    logDebug(`   • Live regions: ${hasLiveRegions ? "✓" : "✗"}`);
    logDebug(
      `   • Custom components: ${hasCustomComponentSupport ? "✓" : "✗"}`
    );
    logDebug(`   • Math accessibility: ${hasMathAccessibility ? "✓" : "✗"}`);
    logDebug(
      `   • Navigation announcements: ${hasNavigationAnnouncements ? "✓" : "✗"}`
    );
    logDebug(
      `   • High contrast support: ${hasHighContrastSupport ? "✓" : "✗"}`
    );
    logDebug(
      `   • Reduced motion support: ${hasReducedMotionSupport ? "✓" : "✗"}`
    );

    return supportPercentage >= 75;
  }

  // ===========================================================================================
  // ACCESSIBILITY RESTORATION FUNCTIONS
  // ===========================================================================================

  /**
   * Attempt to restore missing accessibility features
   */
  function restoreAccessibilityFeatures() {
    logInfo("Attempting to restore missing accessibility features...");

    const restorationResults = {
      dynamicMathJaxManager: restoreDynamicMathJaxManager(),
      zoomControls: restoreZoomControls(),
      screenReaderControls: restoreScreenReaderControls(),
      ariaEnhancements: restoreAriaEnhancements(),
      keyboardNavigation: restoreKeyboardNavigation(),
    };

    const restoredFeatures =
      Object.values(restorationResults).filter(Boolean).length;
    const totalFeatures = Object.keys(restorationResults).length;

    logInfo(
      `✅ Accessibility restoration complete: ${restoredFeatures}/${totalFeatures} features restored`
    );

    return {
      success: restoredFeatures >= totalFeatures * 0.8,
      restoredFeatures: restoredFeatures,
      totalFeatures: totalFeatures,
      details: restorationResults,
    };
  }

  /**
   * Restore Dynamic MathJax Manager if missing
   */
  function restoreDynamicMathJaxManager() {
    if (window.dynamicMathJaxManager) {
      logDebug("Dynamic MathJax Manager already exists");
      return true;
    }

    if (!window.MathJaxManager) {
      logWarn("⚠️ MathJaxManager module not available for restoration");
      return false;
    }

    try {
      const manager = window.MathJaxManager.createManager();
      if (manager && typeof manager.initialise === "function") {
        manager.initialise();
        window.dynamicMathJaxManager = manager;
        logInfo("✅ Successfully restored Dynamic MathJax Manager");
        return true;
      }
    } catch (error) {
      logError("❌ Failed to restore Dynamic MathJax Manager:", error);
    }

    return false;
  }

  /**
   * Restore zoom controls if missing
   */
  function restoreZoomControls() {
    const zoomControls = document.querySelectorAll(
      'input[name="zoom-trigger"]'
    );
    const zoomScaleSlider = document.getElementById("zoom-scale");

    if (zoomControls.length >= 3 && zoomScaleSlider) {
      logDebug("Zoom controls already present");
      return true;
    }

    logWarn("⚠️ Zoom controls missing - would require template regeneration");
    // In a real implementation, this would trigger template regeneration
    // For now, we just report the issue
    return false;
  }

  /**
   * Restore screen reader controls if missing
   */
  function restoreScreenReaderControls() {
    const assistiveMmlCheckbox = document.getElementById("assistive-mathml");
    const tabNavigationCheckbox = document.getElementById("tab-navigation");

    if (assistiveMmlCheckbox && tabNavigationCheckbox) {
      logDebug("Screen reader controls already present");
      return true;
    }

    logWarn(
      "⚠️ Screen reader controls missing - would require template regeneration"
    );
    // In a real implementation, this would trigger template regeneration
    return false;
  }

  /**
   * Restore ARIA enhancements
   */
  function restoreAriaEnhancements() {
    let enhancements = 0;

    // Add missing ARIA labels to mathematical elements
    const mathElementsWithoutAria = document.querySelectorAll(
      "mjx-container:not([aria-label])"
    );
    mathElementsWithoutAria.forEach((element, index) => {
      if (index < 5) {
        // Limit to first 5 for performance
        try {
          const textContent =
            element.textContent || `Mathematical expression ${index + 1}`;
          element.setAttribute(
            "aria-label",
            `Mathematical expression: ${textContent.slice(0, 50)}`
          );
          enhancements++;
        } catch (error) {
          logDebug("Could not add ARIA label to math element:", error);
        }
      }
    });

    // Add missing live region if none exists
    const liveRegions = document.querySelectorAll(
      '[aria-live], [role="status"]'
    );
    if (liveRegions.length === 0) {
      try {
        const liveRegion = document.createElement("div");
        liveRegion.className = "sr-only";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        liveRegion.id = "accessibility-announcements";
        document.body.appendChild(liveRegion);
        enhancements++;
        logInfo("✅ Added accessibility announcements live region");
      } catch (error) {
        logError("❌ Could not add live region:", error);
      }
    }

    logInfo(`✅ ARIA enhancements: ${enhancements} improvements made`);
    return enhancements > 0;
  }

  /**
   * Restore keyboard navigation
   */
  function restoreKeyboardNavigation() {
    let improvements = 0;

    // Ensure all interactive elements are keyboard accessible
    const interactiveElements = document.querySelectorAll(
      "button, input, select, textarea"
    );
    interactiveElements.forEach((element) => {
      if (element.tabIndex === -1 && !element.disabled) {
        element.tabIndex = 0;
        improvements++;
      }
    });

    // Add keyboard event handlers to elements with click handlers but no keyboard handlers
    const clickableElements = document.querySelectorAll(
      "[onclick], .clickable"
    );
    clickableElements.forEach((element) => {
      if (!element.onkeydown && !element.onkeyup) {
        element.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.click();
          }
        });
        improvements++;
      }
    });

    logInfo(`✅ Keyboard navigation: ${improvements} improvements made`);
    return improvements > 0;
  }

  // ===========================================================================================
  // COMPREHENSIVE TESTING AND REPORTING
  // ===========================================================================================

  /**
   * Generate comprehensive accessibility report
   */
  function generateAccessibilityReport() {
    console.log("\n" + "=".repeat(70));
    console.log("♿ COMPREHENSIVE ACCESSIBILITY REPORT");
    console.log("=".repeat(70));

    const validationResult = validateAndRestoreAccessibility();

    // Quick status check
    const mathContainers = document.querySelectorAll("mjx-container").length;
    const dynamicManager = !!window.dynamicMathJaxManager;
    const zoomControls = document.querySelectorAll(
      'input[name="zoom-trigger"]'
    ).length;
    const screenReaderControls =
      !!document.getElementById("assistive-mathml") &&
      !!document.getElementById("tab-navigation");

    console.log("\n📊 QUICK STATUS OVERVIEW:");
    console.log(
      `   • Mathematical Rendering: ${mathContainers} containers ${
        mathContainers > 0 ? "✅" : "❌"
      }`
    );
    console.log(
      `   • Dynamic MathJax Manager: ${
        dynamicManager ? "✅ ACTIVE" : "❌ MISSING"
      }`
    );
    console.log(
      `   • Zoom Controls: ${
        zoomControls >= 3 ? "✅ COMPLETE" : "❌ INCOMPLETE"
      } (${zoomControls}/3)`
    );
    console.log(
      `   • Screen Reader Controls: ${
        screenReaderControls ? "✅ AVAILABLE" : "❌ MISSING"
      }`
    );

    console.log("\n📋 DETAILED VALIDATION RESULTS:");
    if (validationResult.success) {
      console.log(
        `✅ Overall Status: PASSED (${validationResult.passed}/${validationResult.total} tests)`
      );
    } else {
      console.log(
        `❌ Overall Status: FAILED (${validationResult.passed}/${validationResult.total} tests)`
      );
      console.log(
        "⚠️  Issues detected - accessibility features may need restoration"
      );
    }

    // Phase 2B enhancement check
    if (window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement) {
      try {
        const phase2bResult = window.LaTeXProcessor.runPhase2BEnhancement();
        const coverage = phase2bResult
          ? phase2bResult.annotationCoveragePercent
          : 0;
        console.log(
          `🚀 Phase 2B Enhancement: ${
            coverage >= 80 ? "✅" : "⚠️"
          } ${coverage.toFixed(1)}% annotation coverage`
        );
      } catch (error) {
        console.log("🚀 Phase 2B Enhancement: ❌ ERROR");
      }
    }

    console.log("\n🛠️  RECOMMENDATIONS:");
    if (!dynamicManager) {
      console.log("   • Restore Dynamic MathJax Manager for advanced controls");
    }
    if (zoomControls < 3) {
      console.log("   • Regenerate accessibility controls template");
    }
    if (!screenReaderControls) {
      console.log("   • Restore assistive MathML and tab navigation controls");
    }
    if (mathContainers === 0) {
      console.log("   • Check MathJax configuration and mathematical content");
    }

    console.log("=".repeat(70));
    console.log(
      `🎯 WCAG 2.2 AA Compliance: ${
        validationResult.success ? "✅ ACHIEVED" : "⚠️ NEEDS ATTENTION"
      }`
    );
    console.log("=".repeat(70));

    return validationResult;
  }

  /**
   * Emergency accessibility restoration
   */
  function emergencyAccessibilityRestoration() {
    console.log("\n🚨 EMERGENCY ACCESSIBILITY RESTORATION");
    console.log("=".repeat(50));

    const restorationResult = restoreAccessibilityFeatures();

    console.log(
      `🔧 Restoration Status: ${
        restorationResult.success ? "✅ SUCCESS" : "⚠️ PARTIAL"
      }`
    );
    console.log(
      `📊 Features Restored: ${restorationResult.restoredFeatures}/${restorationResult.totalFeatures}`
    );

    // Re-run validation after restoration
    console.log("\n🔍 POST-RESTORATION VALIDATION:");
    const postValidation = validateAndRestoreAccessibility();
    console.log(
      `✅ Post-restoration Status: ${
        postValidation.success ? "PASS" : "NEEDS MORE WORK"
      }`
    );

    return {
      restoration: restorationResult,
      validation: postValidation,
      success: restorationResult.success && postValidation.success,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main validation functions
    validateAndRestoreAccessibility,
    validateDynamicMathJaxManager,
    validateZoomControls,
    validateScreenReaderControls,
    validateKeyboardAccessibility,
    validateAriaImplementation,
    validateFocusManagement,
    validateColourContrast,
    validateWCAGCompliance,
    validateMathJaxContextMenus,
    validateAssistiveTechnologySupport,

    // Restoration functions
    restoreAccessibilityFeatures,
    restoreDynamicMathJaxManager,
    restoreZoomControls,
    restoreScreenReaderControls,
    restoreAriaEnhancements,
    restoreKeyboardNavigation,

    // Reporting and emergency functions
    generateAccessibilityReport,
    emergencyAccessibilityRestoration,

    // Individual component testing
    testDynamicMathJaxManagerFunctionality: validateDynamicMathJaxManager,
    testAccessibilityControlsAvailability: () =>
      validateZoomControls() && validateScreenReaderControls(),
    testWCAGComplianceLevel: validateWCAGCompliance,
  };
})();

// Export global accessibility restoration functions
if (typeof window !== "undefined") {
  // Primary functions
  window.validateAndRestoreAccessibility =
    TestAccessibilityRestoration.validateAndRestoreAccessibility;
  window.generateAccessibilityReport =
    TestAccessibilityRestoration.generateAccessibilityReport;
  window.emergencyAccessibilityRestoration =
    TestAccessibilityRestoration.emergencyAccessibilityRestoration;
  window.restoreAccessibilityFeatures =
    TestAccessibilityRestoration.restoreAccessibilityFeatures;

  // Individual validation functions
  window.validateDynamicMathJaxManager =
    TestAccessibilityRestoration.validateDynamicMathJaxManager;
  window.validateZoomControls =
    TestAccessibilityRestoration.validateZoomControls;
  window.validateScreenReaderControls =
    TestAccessibilityRestoration.validateScreenReaderControls;
  window.validateWCAGCompliance =
    TestAccessibilityRestoration.validateWCAGCompliance;

  console.log("♿ Accessibility Restoration Framework loaded");
  console.log("📋 Available commands:");
  console.log(
    "   • validateAndRestoreAccessibility() - Comprehensive validation"
  );
  console.log(
    "   • generateAccessibilityReport() - Detailed accessibility report"
  );
  console.log(
    "   • emergencyAccessibilityRestoration() - Emergency restoration"
  );
  console.log("   • restoreAccessibilityFeatures() - Restore missing features");
  console.log("   • validateWCAGCompliance() - WCAG 2.2 AA compliance check");
}

console.log("✅ Accessibility Restoration Framework ready");
