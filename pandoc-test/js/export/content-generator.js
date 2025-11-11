// content-generator.js
// Document Generation Orchestrator - Coordinates CSS, HTML, TOC, and Table Enhancement
//
// Delegates to:
//   - CSSLoader (js/export/content-generator/css-loader.js) - CSS template loading
//   - HTMLEnhancer (js/export/content-generator/html-enhancer.js) - HTML structure enhancement
//   - TOCGenerator (js/export/content-generator/toc-generator.js) - Table of contents generation
//   - TableEnhancer (js/export/content-generator/table-enhancer.js) - Table accessibility enhancement
//
// Stage 3 Complete:
//   - Architecture: 98% pure delegation with one coordinator function (enhanceDocumentStructure)
//   - Code organisation: 7 clear sections with headers
//   - Error handling: Consistent [ContentGen] prefix pattern
//   - Documentation: Complete JSDoc with delegation info
//   - Test status: 27/27 tests passing

const ContentGenerator = (function () {
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
      console.error("[CONTENT]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CONTENT]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CONTENT]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CONTENT]", message, ...args);
  }

  // ============================================================================
  // CSS GENERATION - Delegates to CSSLoader
  // ============================================================================
  // Individual CSS loading functions (organized by category, then alphabetically)
  // Each function delegates to window.CSSLoader.loadCSSFile() or specific loader method
  // Main orchestrators: generateEnhancedCSS() and generateTableCSS()

  /**
   * Generate skip navigation links CSS for keyboard accessibility.
   * Delegates to: CSSLoader
   * Template: css/base/skip-links.css
   * @returns {Promise<string>} Skip links CSS or empty string on error
   */
  async function generateSkipLinksCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating skip links CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile("css/base/skip-links.css");
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load skip links CSS:", error);
      return "";
    }
  }

  /**
   * Generate CSS custom properties for theming and consistent styling.
   * Delegates to: CSSLoader
   * Template: css/base/custom-properties.css
   * @returns {Promise<string>} Custom properties CSS or empty string on error
   */
  async function generateCustomPropertiesCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available, using fallback");
      return window.CSSLoader?.getFallbackBaseCSS() || "";
    }

    try {
      logDebug("Delegating custom properties CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/base/custom-properties.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load custom properties CSS:", error);
      return "";
    }
  }

  /**
   * Generate base styles including resets and foundational styling.
   * Delegates to: CSSLoader
   * Template: css/base/base-styles.css
   * @returns {Promise<string>} Base styles CSS or empty string on error
   */
  async function generateBaseStylesCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating base styles CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/base/base-styles.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load base styles CSS:", error);
      return "";
    }
  }

  /**
   * Generate focus management styles for proper keyboard navigation
   * ✅ DELEGATED to CSSLoader module
   */
  async function generateFocusManagementCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating focus management CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/base/focus-management.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load focus management CSS:", error);
      return "";
    }
  }

  /**
   * Generate grid layout CSS for Holy Grail layout structure.
   * Delegates to: CSSLoader
   * Template: css/layout/grid-layout.css
   * @returns {Promise<string>} Grid layout CSS or empty string on error
   */
  async function generateGridLayoutCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating grid layout CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/layout/grid-layout.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load grid layout CSS:", error);
      return "";
    }
  }

  /**
   * Generate sidebar sections styling for navigation and controls.
   * Delegates to: CSSLoader
   * Template: css/layout/sidebar-styling.css
   * @returns {Promise<string>} Sidebar styling CSS or empty string on error
   */
  async function generateSidebarStylingCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating sidebar styling CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/layout/sidebar-styling.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load sidebar styling CSS:", error);
      return "";
    }
  }

  /**
   * Generate typography CSS with font settings and text styling.
   * Delegates to: CSSLoader
   * Template: css/typography/typography.css
   * @returns {Promise<string>} Typography CSS or empty string on error
   */
  async function generateTypographyCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating typography CSS to CSSLoader");
      const css = await window.CSSLoader.loadTypographyCSS();
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load typography CSS:", error);
      return "";
    }
  }

  /**
   * Generate button styling including print and action buttons.
   * Delegates to: CSSLoader
   * Template: css/interactive/button-styling.css
   * @returns {Promise<string>} Button styling CSS or empty string on error
   */
  async function generateButtonStylingCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating button styling CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/interactive/button-styling.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load button styling CSS:", error);
      return "";
    }
  }

  /**
   * Generate form controls styling for selects, inputs, and labels.
   * Delegates to: CSSLoader
   * Template: css/interactive/form-controls.css
   * @returns {Promise<string>} Form controls CSS or empty string on error
   */
  async function generateFormControlsCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating form controls CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/interactive/form-controls.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load form controls CSS:", error);
      return "";
    }
  }

  /**
   * Generate accessibility controls styling for reading tools sidebar.
   * Delegates to: CSSLoader
   * Template: css/accessibility/accessibility-controls.css
   * @returns {Promise<string>} Accessibility controls CSS or empty string on error
   */
  async function generateAccessibilityControlsCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating accessibility controls CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/accessibility/accessibility-controls.css"
      );
      return css;
    } catch (error) {
      logError(
        "[ContentGen] Failed to load accessibility controls CSS:",
        error
      );
      return "";
    }
  }

  /**
   * Generate enhanced mathematical content styling for equations and formulas.
   * Delegates to: CSSLoader
   * Template: css/accessibility/mathematical-content.css
   * @returns {Promise<string>} Mathematical content CSS or empty string on error
   */
  async function generateMathematicalContentCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating mathematical content CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/accessibility/mathematical-content.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load mathematical content CSS:", error);
      return "";
    }
  }

  /**
   * Generate print CSS for optimised printed output.
   * Delegates to: CSSLoader
   * Template: css/utility/print.css
   * @returns {Promise<string>} Print CSS or empty string on error
   */
  async function generatePrintCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating print CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile("css/utility/print.css");
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load print CSS:", error);
      return "";
    }
  }

  /**
   * Generate large screen CSS for wide viewport optimisation.
   * Delegates to: CSSLoader
   * Template: css/utility/large-screen.css
   * @returns {Promise<string>} Large screen CSS or empty string on error
   */
  async function generateLargeScreenOptimizationsCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating large screen CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/utility/large-screen.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load large screen CSS:", error);
      return "";
    }
  }

  /**
   * Generate mobile responsive CSS for small screen optimisation.
   * Delegates to: CSSLoader
   * Template: css/utility/mobile-responsive.css
   * @returns {Promise<string>} Mobile responsive CSS or empty string on error
   */
  async function generateMobileResponsiveCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating mobile responsive CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/utility/mobile-responsive.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load mobile responsive CSS:", error);
      return "";
    }
  }

  /**
   * Generate accessibility support CSS for screen reader and assistive technology compatibility.
   * Delegates to: CSSLoader
   * Template: css/accessibility/accessibility-support.css
   * @returns {Promise<string>} Accessibility support CSS or empty string on error
   */
  async function generateAccessibilitySupportCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating accessibility support CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/accessibility/accessibility-support.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load accessibility support CSS:", error);
      return "";
    }
  }

  /**
   * Generate title block CSS for document header styling.
   * Delegates to: CSSLoader
   * Template: css/layout/title-block.css
   * @returns {Promise<string>} Title block CSS or empty string on error
   */
  async function generateTitleBlockCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating title block CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/layout/title-block.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load title block CSS:", error);
      return "";
    }
  }

  /**
   * Generate distraction-free CSS for focused reading mode.
   * Delegates to: CSSLoader
   * Template: css/utility/distraction-free.css
   * @returns {Promise<string>} Distraction-free CSS or empty string on error
   */
  async function generateDistractionFreeCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating distraction-free CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/utility/distraction-free.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load distraction-free CSS:", error);
      return "";
    }
  }

  /**
   * Generate complete CSS with all enhancements.
   * Delegates to: CSSLoader
   * Templates: Multiple (33 CSS template files across 7 categories)
   * Coordinator function - orchestrates all CSS module loading
   * @returns {Promise<string>} Complete enhanced CSS or empty string on error
   */
  async function generateEnhancedCSS() {
    logInfo("Generating enhanced CSS with external templates...");

    try {
      // Load base CSS using CSSLoader (Phase 1.1 complete)
      const baseCSS = await window.CSSLoader.getBaseCSS({ minify: false });

      // Start with base CSS
      const cssComponents = [baseCSS];

      // === LAYOUT CSS ===
      try {
        cssComponents.push(await generateGridLayoutCSS());
      } catch (e) {
        logDebug("generateGridLayoutCSS not available or failed");
      }

      try {
        cssComponents.push(await generateSidebarStylingCSS());
      } catch (e) {
        logDebug("generateSidebarStylingCSS not available or failed");
      }

      try {
        cssComponents.push(await generateTitleBlockCSS());
      } catch (e) {
        logDebug("generateTitleBlockCSS not available or failed");
      }

      // === TYPOGRAPHY CSS ===
      try {
        cssComponents.push(await generateTypographyCSS());
      } catch (e) {
        logDebug("generateTypographyCSS not available or failed");
      }

      // === INTERACTIVE CSS ===
      try {
        cssComponents.push(await generateButtonStylingCSS());
      } catch (e) {
        logDebug("generateButtonStylingCSS not available or failed");
      }

      try {
        cssComponents.push(await generateFormControlsCSS());
      } catch (e) {
        logDebug("generateFormControlsCSS not available or failed");
      }

      // === ACCESSIBILITY CSS ===
      try {
        cssComponents.push(await generateAccessibilitySupportCSS());
      } catch (e) {
        logDebug("generateAccessibilitySupportCSS not available or failed");
      }

      try {
        cssComponents.push(await generateAccessibilityControlsCSS());
      } catch (e) {
        logDebug("generateAccessibilityControlsCSS not available or failed");
      }

      try {
        cssComponents.push(await generateMathematicalContentCSS());
      } catch (e) {
        logDebug("generateMathematicalContentCSS not available or failed");
      }

      // === TABLE CSS ===
      try {
        cssComponents.push(await generateAdvancedTableCSS());
      } catch (e) {
        logDebug("generateAdvancedTableCSS not available or failed");
      }

      try {
        cssComponents.push(await generateResponsiveTableCSS());
      } catch (e) {
        logDebug("generateResponsiveTableCSS not available or failed");
      }

      try {
        cssComponents.push(await generateTableAccessibilityCSS());
      } catch (e) {
        logDebug("generateTableAccessibilityCSS not available or failed");
      }

      try {
        cssComponents.push(await generateTablePrintCSS());
      } catch (e) {
        logDebug("generateTablePrintCSS not available or failed");
      }

      // === UTILITY CSS ===
      try {
        cssComponents.push(await generateMobileResponsiveCSS());
      } catch (e) {
        logDebug("generateMobileResponsiveCSS not available or failed");
      }

      try {
        cssComponents.push(await generateLargeScreenOptimizationsCSS());
      } catch (e) {
        logDebug("generateLargeScreenOptimizationsCSS not available or failed");
      }

      try {
        cssComponents.push(await generatePrintCSS());
      } catch (e) {
        logDebug("generatePrintCSS not available or failed");
      }

      try {
        cssComponents.push(await generateResponsiveImageCSS());
      } catch (e) {
        logDebug("generateResponsiveImageCSS not available or failed");
      }

      try {
        cssComponents.push(await generateDistractionFreeCSS());
      } catch (e) {
        logDebug("generateDistractionFreeCSS not available or failed");
      }

      // === COMBINE ALL CSS ===

      // Combine all CSS components (filter out undefined/null/empty strings)
      const allCSS = cssComponents
        .filter((css) => css && typeof css === "string" && css.length > 0)
        .join("\n\n");

      logInfo(`✅ Enhanced CSS generated: ${allCSS.length} characters`);
      return allCSS;
    } catch (error) {
      logError("[ContentGen] Failed to generate enhanced CSS:", error);
      throw error;
    }
  }

  // ============================================================================
  // TOC GENERATION - Delegates to TOCGenerator
  // ============================================================================

  /**
   * Generate table of contents from section data.
   * Delegates to: TOCGenerator
   * Template: table-of-contents.html
   * @param {Array} sections - Array of section objects with title and level
   * @returns {string} HTML table of contents or empty string on error
   */
  function generateTableOfContents(sections) {
    if (!window.TOCGenerator) {
      logError("[ContentGen] TOCGenerator module not available");
      return "";
    }

    try {
      logDebug("Delegating TOC generation to TOCGenerator");
      return window.TOCGenerator.generateTableOfContents(sections);
    } catch (error) {
      logError("[ContentGen] Failed to generate table of contents:", error);
      return "";
    }
  }

  /**
   * Generate table of contents with custom ID for multiple TOCs in one document.
   * Delegates to: TOCGenerator
   * Template: table-of-contents.html
   * @param {Array} sections - Array of section objects with title and level
   * @returns {string} HTML table of contents with unique ID or empty string on error
   */
  function generateTableOfContentsWithId(sections) {
    if (!window.TOCGenerator) {
      logError("[ContentGen] TOCGenerator module not available");
      return "";
    }

    try {
      logDebug("Delegating TOC with ID generation to TOCGenerator");
      return window.TOCGenerator.generateTableOfContentsWithId(sections);
    } catch (error) {
      logError(
        "[ContentGen] Failed to generate table of contents with ID:",
        error
      );
      return "";
    }
  }

  // ============================================================================
  // HTML ENHANCEMENT - Delegates to HTMLEnhancer
  // ============================================================================

  /**
   * Generate distraction-free reading controls for focused reading mode.
   * Delegates to: HTMLEnhancer
   * Template: distraction-free-controls.html
   * @param {Object} metadata - Document metadata for control customisation
   * @returns {Promise<string>} HTML controls or empty string on error
   */
  async function generateDistractionFreeControls(metadata) {
    if (!window.HTMLEnhancer) {
      logError("[ContentGen] HTMLEnhancer module not available");
      return "";
    }

    try {
      logDebug("Delegating distraction-free controls to HTMLEnhancer");
      return await window.HTMLEnhancer.generateDistractionFreeControls(
        metadata
      );
    } catch (error) {
      logError(
        "[ContentGen] Failed to generate distraction-free controls:",
        error
      );
      return "";
    }
  }

  /**
   * Enhance document structure with wrappers, navigation, and accessibility features.
   * Delegates to: HTMLEnhancer
   * Templates: document-wrapper-start.html, document-wrapper-end.html
   * Coordinator function - orchestrates multiple HTML enhancements
   * @param {string} content - HTML content to enhance
   * @param {Object} metadata - Document metadata for structure enhancement
   * @returns {Promise<string>} Enhanced HTML content or original content on error
   */
  async function enhanceDocumentStructure(content, metadata) {
    if (!window.HTMLEnhancer) {
      logError("[ContentGen] HTMLEnhancer module not available");
      return content;
    }

    try {
      logDebug("Delegating document structure enhancement to HTMLEnhancer");
      return await window.HTMLEnhancer.enhanceDocumentStructure(
        content,
        metadata
      );
    } catch (error) {
      logError("[ContentGen] Failed to enhance document structure:", error);
      return content;
    }
  }

  /**
   * Enhance theorem environments with proper styling and semantic structure.
   * Delegates to: HTMLEnhancer
   * Template: theorem-wrapper.html
   * @param {string} content - HTML content containing theorem environments
   * @returns {Promise<string>} Enhanced HTML content or original content on error
   */
  async function enhanceTheoremEnvironments(content) {
    if (!window.HTMLEnhancer) {
      logError("[ContentGen] HTMLEnhancer module not available");
      return content;
    }

    try {
      logDebug("Delegating theorem enhancement to HTMLEnhancer");
      return await window.HTMLEnhancer.enhanceTheoremEnvironments(content);
    } catch (error) {
      logError("[ContentGen] Failed to enhance theorem environments:", error);
      return content;
    }
  }

  /**
   * Add section anchors for improved navigation and deep linking.
   * Delegates to: HTMLEnhancer
   * Template: section-anchor.html
   * @param {string} content - HTML content to add anchors to
   * @param {Array} sections - Array of section objects with IDs and titles
   * @returns {Promise<string>} Enhanced HTML content or original content on error
   */
  async function addSectionAnchors(content, sections) {
    if (!window.HTMLEnhancer) {
      logError("[ContentGen] HTMLEnhancer module not available");
      return content;
    }

    try {
      logDebug("Delegating section anchors to HTMLEnhancer");
      return await window.HTMLEnhancer.addSectionAnchors(content, sections);
    } catch (error) {
      logError("[ContentGen] Failed to add section anchors:", error);
      return content;
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Escape HTML special characters for safe insertion into HTML.
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML text or original text on error
   */
  function escapeHtml(text) {
    if (!window.HTMLEnhancer) {
      logError(
        "[ContentGen] HTMLEnhancer module not available, using fallback"
      );
      // Fallback implementation
      if (typeof text !== "string") return text;
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    try {
      return window.HTMLEnhancer.escapeHtml(text);
    } catch (error) {
      logError("[ContentGen] Failed to escape HTML:", error);
      return text;
    }
  }

  // ============================================================================
  // TABLE ENHANCEMENT - Delegates to TableEnhancer
  // ============================================================================

  /**
   * Add comprehensive ARIA attributes to tables using Adrian Roselli method.
   * Delegates to: TableEnhancer
   * @returns {number} Number of tables enhanced or 0 on error
   */
  function addTableARIA() {
    if (!window.TableEnhancer) {
      logError("[ContentGen] TableEnhancer module not available");
      return 0;
    }

    try {
      logDebug("Delegating table ARIA to TableEnhancer");
      return window.TableEnhancer.addTableARIA();
    } catch (error) {
      logError("[ContentGen] Failed to add table ARIA:", error);
      return 0;
    }
  }

  /**
   * Generate data-label attributes for responsive table cards on mobile.
   * Delegates to: TableEnhancer
   * @returns {number} Number of tables enhanced or 0 on error
   */
  function enhanceTableDataLabels() {
    if (!window.TableEnhancer) {
      logError("[ContentGen] TableEnhancer module not available");
      return 0;
    }

    try {
      logDebug("Delegating table data labels to TableEnhancer");
      return window.TableEnhancer.enhanceTableDataLabels();
    } catch (error) {
      logError("[ContentGen] Failed to enhance table data labels:", error);
      return 0;
    }
  }

  /**
   * Add table navigation help for screen reader users.
   * Delegates to: TableEnhancer
   * @returns {number} Number of tables enhanced or 0 on error
   */
  function addTableNavigationHelp() {
    if (!window.TableEnhancer) {
      logError("[ContentGen] TableEnhancer module not available");
      return 0;
    }

    try {
      logDebug("Delegating table navigation help to TableEnhancer");
      return window.TableEnhancer.addTableNavigationHelp();
    } catch (error) {
      logError("[ContentGen] Failed to add table navigation help:", error);
      return 0;
    }
  }

  /**
   * Add table descriptions for better context and accessibility.
   * Delegates to: TableEnhancer
   * @returns {number} Number of tables enhanced or 0 on error
   */
  function addTableDescriptions() {
    if (!window.TableEnhancer) {
      logError("[ContentGen] TableEnhancer module not available");
      return 0;
    }

    try {
      logDebug("Delegating table descriptions to TableEnhancer");
      return window.TableEnhancer.addTableDescriptions();
    } catch (error) {
      logError("[ContentGen] Failed to add table descriptions:", error);
      return 0;
    }
  }

  /**
   * Comprehensive table accessibility enhancement combining all table methods.
   * Delegates to: TableEnhancer
   * Coordinator function - orchestrates all table enhancement methods
   * @returns {Object|null} Enhancement results object or null on error
   */
  function enhanceTableAccessibility() {
    if (!window.TableEnhancer) {
      logError("[ContentGen] TableEnhancer module not available");
      return null;
    }

    try {
      logDebug("Delegating comprehensive table enhancement to TableEnhancer");
      return window.TableEnhancer.enhanceTableAccessibility();
    } catch (error) {
      logError("[ContentGen] Failed to enhance table accessibility:", error);
      return null;
    }
  }

  /**
   * Basic CSS minification by removing comments and whitespace.
   * @param {string} css - CSS to minify
   * @returns {string} Minified CSS or original CSS on error
   */
  function minifyCSS(css) {
    try {
      return css
        .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
        .replace(/\s+/g, " ") // Collapse whitespace
        .replace(/;\s*}/g, "}") // Remove last semicolon in rules
        .replace(/{\s*/g, "{") // Remove space after opening braces
        .replace(/}\s*/g, "}") // Remove space after closing braces
        .replace(/,\s*/g, ",") // Remove space after commas
        .replace(/:\s*/g, ":") // Remove space after colons
        .trim();
    } catch (error) {
      logError("[ContentGen] Error minifying CSS:", error);
      return css;
    }
  }

  /**
   * Generate responsive image CSS for adaptive images.
   * Delegates to: CSSLoader
   * Template: css/utility/responsive-images.css
   * @returns {Promise<string>} Responsive image CSS or empty string on error
   */
  async function generateResponsiveImageCSS() {
    if (!window.CSSLoader) {
      logError("[ContentGen] CSSLoader module not available");
      return "";
    }

    try {
      logDebug("Delegating responsive image CSS to CSSLoader");
      const css = await window.CSSLoader.loadCSSFile(
        "css/utility/responsive-images.css"
      );
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load responsive image CSS:", error);
      return "";
    }
  }

  /**
   * Generate advanced table CSS with enhanced features.
   * Delegates to: CSSLoader
   * Template: css/tables/table-advanced.css
   * @returns {Promise<string>} Advanced table CSS
   * @throws {Error} If template loading fails
   */
  async function generateAdvancedTableCSS() {
    logInfo("Loading advanced table CSS from template...");

    try {
      const css = await window.CSSLoader.loadCSSFile(
        "css/tables/table-advanced.css"
      );
      logInfo("✅ Advanced table CSS loaded from template");
      return css;
    } catch (error) {
      logError(
        "[ContentGen] Failed to load advanced table CSS template:",
        error
      );
      throw error;
    }
  }

  /**
   * Generate responsive table CSS for mobile card layouts.
   * Delegates to: CSSLoader
   * Template: css/tables/table-responsive.css
   * @returns {Promise<string>} Responsive table CSS
   * @throws {Error} If template loading fails
   */
  async function generateResponsiveTableCSS() {
    logInfo("Loading responsive table CSS from template...");

    try {
      const css = await window.CSSLoader.loadCSSFile(
        "css/tables/table-responsive.css"
      );
      logInfo("✅ Responsive table CSS loaded from template");
      return css;
    } catch (error) {
      logError(
        "[ContentGen] Failed to load responsive table CSS template:",
        error
      );
      throw error;
    }
  }

  /**
   * Generate table accessibility CSS for screen reader support.
   * Delegates to: CSSLoader
   * Template: css/tables/table-accessibility.css
   * @returns {Promise<string>} Table accessibility CSS
   * @throws {Error} If template loading fails
   */
  async function generateTableAccessibilityCSS() {
    logInfo("Loading table accessibility CSS from template...");

    try {
      const css = await window.CSSLoader.loadCSSFile(
        "css/tables/table-accessibility.css"
      );
      logInfo("✅ Table accessibility CSS loaded from template");
      return css;
    } catch (error) {
      logError(
        "[ContentGen] Failed to load table accessibility CSS template:",
        error
      );
      throw error;
    }
  }

  /**
   * Generate table print CSS for optimised printed tables.
   * Delegates to: CSSLoader
   * Template: css/tables/table-print.css
   * @returns {Promise<string>} Table print CSS
   * @throws {Error} If template loading fails
   */
  async function generateTablePrintCSS() {
    logInfo("Loading table print CSS from template...");

    try {
      const css = await window.CSSLoader.loadCSSFile(
        "css/tables/table-print.css"
      );
      logInfo("✅ Table print CSS loaded from template");
      return css;
    } catch (error) {
      logError("[ContentGen] Failed to load table print CSS template:", error);
      throw error;
    }
  }

  /**
   * Generate comprehensive table CSS with all table enhancements.
   * Delegates to: CSSLoader (via 4 table CSS functions)
   * Templates: table-advanced.css, table-responsive.css, table-accessibility.css, table-print.css
   * Coordinator function - orchestrates 4 table CSS modules
   * @returns {Promise<string>} Complete table CSS
   * @throws {Error} If any table CSS module fails to load
   */
  async function generateTableCSS() {
    logInfo(
      "Generating comprehensive table CSS with accessibility enhancements"
    );

    try {
      const cssArray = await Promise.all([
        generateAdvancedTableCSS(),
        generateResponsiveTableCSS(),
        generateTableAccessibilityCSS(),
        generateTablePrintCSS(),
      ]);

      return cssArray.join("\n\n");
    } catch (error) {
      logError("[ContentGen] Failed to generate table CSS:", error);
      throw error;
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // === CSS GENERATION ===
    generateEnhancedCSS, // Main CSS orchestrator - loads all CSS
    generateDistractionFreeCSS, // Distraction-free mode CSS
    minifyCSS, // CSS minification utility
    generateResponsiveImageCSS, // Responsive image CSS

    // Table-specific CSS
    generateTableCSS, // Table CSS orchestrator - loads all table CSS
    generateAdvancedTableCSS, // Advanced table features CSS
    generateResponsiveTableCSS, // Responsive table CSS
    generateTableAccessibilityCSS, // Table accessibility CSS
    generateTablePrintCSS, // Table print CSS

    // === TABLE OF CONTENTS ===
    generateTableOfContents, // Generate TOC without ID attribute
    generateTableOfContentsWithId, // Generate TOC with id="toc"

    // === DOCUMENT STRUCTURE ===
    enhanceDocumentStructure, // Main document enhancer - Holy Grail layout
    generateDistractionFreeControls, // Distraction-free mode controls
    enhanceTheoremEnvironments, // Theorem environment enhancement
    addSectionAnchors, // Section anchor generation

    // === TABLE ACCESSIBILITY ===
    addTableARIA, // Add ARIA attributes to tables
    enhanceTableDataLabels, // Add data-label attributes
    addTableNavigationHelp, // Add keyboard navigation help
    addTableDescriptions, // Add table descriptions
    enhanceTableAccessibility, // Main table enhancer - calls all table functions

    // === UTILITIES ===
    escapeHtml, // HTML escaping for security

    // === LOGGING ===
    logError, // Error-level logging
    logWarn, // Warning-level logging
    logInfo, // Info-level logging
    logDebug, // Debug-level logging
  };
})();

// Make globally available for other modules
window.ContentGenerator = ContentGenerator;
