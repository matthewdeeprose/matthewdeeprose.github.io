// css-loader.js
// CSS Template Loading and Management Module
// Loads CSS from external template files

const CSSLoader = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[CSS-LOADER]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[CSS-LOADER]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[CSS-LOADER]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[CSS-LOADER]", message, ...args);
  }

  // ===========================================================================================
  // CSS TEMPLATE CACHE
  // ===========================================================================================

  const cssCache = new Map();
  let cacheLoaded = false;

  /**
   * CSS template file mappings
   */
  const CSS_TEMPLATES = {
    base: [
      "css/base/custom-properties.css",
      "css/base/skip-links.css",
      "css/base/base-styles.css",
      "css/base/focus-management.css",
    ],
    layout: [
      "css/layout/grid-layout.css",
      "css/layout/sidebar-styling.css",
      "css/layout/title-block.css",
    ],
    typography: ["css/typography/typography.css"],
    interactive: [
      "css/interactive/button-styling.css",
      "css/interactive/form-controls.css",
    ],
    accessibility: [
      "css/accessibility/accessibility-controls.css",
      "css/accessibility/mathematical-content.css",
      "css/accessibility/accessibility-support.css",
    ],
    tables: [
      "css/tables/table-advanced.css",
      "css/tables/table-responsive.css",
      "css/tables/table-accessibility.css",
      "css/tables/table-print.css",
    ],

    utility: [
      "css/utility/mobile-responsive.css",
      "css/utility/large-screen.css",
      "css/utility/print.css",
      "css/utility/responsive-images.css",
      "css/utility/distraction-free.css",
    ],
  };

  // ===========================================================================================
  // CACHE MANAGEMENT
  // ===========================================================================================

  /**
   * Load a single CSS template file
   * @param {string} filePath - Path to CSS file relative to templates/
   * @returns {Promise<string>} CSS content
   */
  async function loadCSSFile(filePath) {
    // Check cache first
    if (cssCache.has(filePath)) {
      logDebug(`Using cached CSS: ${filePath}`);
      return cssCache.get(filePath);
    }

    try {
      logDebug(`Loading CSS template: ${filePath}`);
      const response = await fetch(`templates/${filePath}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const css = await response.text();

      // Cache the result
      cssCache.set(filePath, css);
      logDebug(`✅ Loaded and cached: ${filePath} (${css.length} characters)`);

      return css;
    } catch (error) {
      logError(`Failed to load CSS template: ${filePath}`, error);
      throw new Error(
        `CSS template loading failed: ${filePath} - ${error.message}`
      );
    }
  }

  /**
   * Load multiple CSS files
   * @param {string[]} filePaths - Array of CSS file paths
   * @returns {Promise<string[]>} Array of CSS content
   */
  async function loadMultipleCSSFiles(filePaths) {
    logInfo(`Loading ${filePaths.length} CSS templates...`);

    const loadPromises = filePaths.map((path) => loadCSSFile(path));
    const results = await Promise.all(loadPromises);

    logInfo(`✅ Loaded ${results.length} CSS templates successfully`);
    return results;
  }

  /**
   * Preload all CSS templates into cache
   * @returns {Promise<Object>} Loading results
   */
  async function preloadAllCSS() {
    if (cacheLoaded) {
      logInfo("CSS templates already preloaded");
      return { success: true, cached: true };
    }

    logInfo("Preloading all CSS templates...");

    const allFiles = [
      ...CSS_TEMPLATES.base,
      ...CSS_TEMPLATES.layout,
      ...CSS_TEMPLATES.typography,
      ...CSS_TEMPLATES.interactive,
      ...CSS_TEMPLATES.accessibility,
      ...CSS_TEMPLATES.tables,
      ...CSS_TEMPLATES.utility,
    ];

    try {
      await loadMultipleCSSFiles(allFiles);
      cacheLoaded = true;
      logInfo(`✅ Preloaded ${allFiles.length} CSS templates`);
      return { success: true, count: allFiles.length };
    } catch (error) {
      logError("Failed to preload CSS templates:", error);
      return { success: false, error: error.message };
    }
  }
  // ===========================================================================================
  // CATEGORY LOADERS
  // ===========================================================================================

  /**
   * Load base CSS (custom properties, skip links, base styles, focus)
   * @returns {Promise<string>} Combined base CSS
   */
  async function loadBaseCSS() {
    logInfo("Loading base CSS...");

    try {
      const cssFiles = CSS_TEMPLATES.base;
      const cssArray = await loadMultipleCSSFiles(cssFiles);
      const combinedCSS = cssArray.join("\n\n");

      logInfo(`✅ Base CSS loaded: ${combinedCSS.length} characters`);
      return combinedCSS;
    } catch (error) {
      logError("Failed to load base CSS:", error);
      throw error;
    }
  }

  /**
   * Load layout CSS (grid, sidebar, title block)
   * @returns {Promise<string>} Combined layout CSS
   */
  async function loadLayoutCSS() {
    logInfo("Loading layout CSS...");

    try {
      const cssFiles = CSS_TEMPLATES.layout;
      const cssArray = await loadMultipleCSSFiles(cssFiles);
      const combinedCSS = cssArray.join("\n\n");

      logInfo(`✅ Layout CSS loaded: ${combinedCSS.length} characters`);
      return combinedCSS;
    } catch (error) {
      logError("Failed to load layout CSS:", error);
      throw error;
    }
  }

  /**
   * Load typography CSS (typography styles)
   * @returns {Promise<string>} Combined typography CSS
   */
  async function loadTypographyCSS() {
    logInfo("Loading typography CSS...");

    try {
      const cssFiles = CSS_TEMPLATES.typography;
      const cssArray = await loadMultipleCSSFiles(cssFiles);
      const combinedCSS = cssArray.join("\n\n");

      logInfo(`✅ Typography CSS loaded: ${combinedCSS.length} characters`);
      return combinedCSS;
    } catch (error) {
      logError("Failed to load typography CSS:", error);
      throw error;
    }
  }

  /**
   * Load interactive CSS (buttons, forms)
   * @returns {Promise<string>} Combined interactive CSS
   */
  async function loadInteractiveCSS() {
    logInfo("Loading interactive CSS...");

    try {
      const cssFiles = CSS_TEMPLATES.interactive;
      const cssArray = await loadMultipleCSSFiles(cssFiles);
      const combinedCSS = cssArray.join("\n\n");

      logInfo(`✅ Interactive CSS loaded: ${combinedCSS.length} characters`);
      return combinedCSS;
    } catch (error) {
      logError("Failed to load interactive CSS:", error);
      throw error;
    }
  }

  /**
   * Load accessibility CSS (controls, mathematical content, support)
   * @returns {Promise<string>} Combined accessibility CSS
   */
  async function loadAccessibilityCSS() {
    logInfo("Loading accessibility CSS...");

    try {
      const cssFiles = CSS_TEMPLATES.accessibility;
      const cssArray = await loadMultipleCSSFiles(cssFiles);
      const combinedCSS = cssArray.join("\n\n");

      logInfo(`✅ Accessibility CSS loaded: ${combinedCSS.length} characters`);
      return combinedCSS;
    } catch (error) {
      logError("Failed to load accessibility CSS:", error);
      throw error;
    }
  }

  /**
   * Load table CSS (advanced, responsive, accessibility, print)
   * @returns {Promise<string>} Combined table CSS
   */
  async function loadTableCSS() {
    logInfo("Loading table CSS...");

    try {
      const cssFiles = CSS_TEMPLATES.tables;
      const cssArray = await loadMultipleCSSFiles(cssFiles);
      const combinedCSS = cssArray.join("\n\n");

      logInfo(`✅ Table CSS loaded: ${combinedCSS.length} characters`);
      return combinedCSS;
    } catch (error) {
      logError("Failed to load table CSS:", error);
      throw error;
    }
  }

  /**
   * Load all utility CSS templates
   * Batch 3: Mobile responsive, large screen, print, responsive images, distraction-free
   * @returns {Promise<string>} Combined utility CSS
   */
  async function loadUtilityCSS() {
    logInfo("Loading all utility CSS templates...");
    try {
      const templates = CSS_TEMPLATES.utility;
      const cssPromises = templates.map((path) => loadCSSFile(path));
      const cssArray = await Promise.all(cssPromises);
      const combinedCSS = cssArray.join("\n\n");
      logInfo(
        `✅ All utility CSS loaded: ${combinedCSS.length} characters from ${templates.length} files`
      );
      return combinedCSS;
    } catch (error) {
      logError("Failed to load utility CSS:", error);
      throw error;
    }
  }

  // ===========================================================================================
  // FALLBACK CSS GENERATION
  // ===========================================================================================

  /**
   * Generate fallback CSS if template loading fails
   * Returns minimal CSS to ensure functionality
   * @returns {string} Fallback CSS
   */
  function getFallbackBaseCSS() {
    logWarn("Using fallback base CSS");

    return `
  /* Fallback Base CSS */
  :root {
    --body-bg: #FFFFF4;
    --body-text: #00131D;
    --link-color: #002E3B;
    --link-hover: #005051;
  }
  
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  body {
    margin: 0;
    padding: 0;
    font-family: Verdana, sans-serif;
    line-height: 1.6;
    color: var(--body-text);
    background-color: var(--body-bg);
  }
  
  :focus-visible {
    outline: 3px solid var(--link-color) !important;
    outline-offset: 2px !important;
  }
      `.trim();
  }

  // ===========================================================================================
  // CSS MINIFICATION
  // ===========================================================================================

  /**
   * Minify CSS by removing unnecessary whitespace and comments
   * @param {string} css - CSS to minify
   * @returns {string} Minified CSS
   */
  function minifyCSS(css) {
    if (!css || typeof css !== "string") {
      logWarn("Invalid CSS provided for minification");
      return "";
    }

    let minified = css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Remove whitespace
      .replace(/\s+/g, " ")
      // Remove space around selectors and properties
      .replace(/\s*([{}:;,])\s*/g, "$1")
      // Remove trailing semicolons
      .replace(/;}/g, "}")
      // Trim
      .trim();

    const originalSize = css.length;
    const minifiedSize = minified.length;
    const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    logDebug(
      `CSS minified: ${originalSize} → ${minifiedSize} bytes (${reduction}% reduction)`
    );

    return minified;
  }

  // ===========================================================================================
  // PUBLIC API - SAFE WITH FALLBACKS
  // ===========================================================================================

  /**
   * Get complete base CSS with fallback
   * @param {Object} options - Options
   * @param {boolean} options.minify - Whether to minify CSS
   * @returns {Promise<string>} CSS content
   */
  async function getBaseCSS(options = {}) {
    try {
      let css = await loadBaseCSS();

      if (options.minify) {
        css = minifyCSS(css);
      }

      return css;
    } catch (error) {
      logError("Failed to get base CSS, using fallback:", error);
      return getFallbackBaseCSS();
    }
  }

  // ===========================================================================================
  // INITIALIZATION
  // ===========================================================================================

  logInfo("CSSLoader module initialised");

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main API
    getBaseCSS,
    preloadAllCSS,

    // Category loaders
    loadBaseCSS,
    loadLayoutCSS,
    loadTypographyCSS,
    loadInteractiveCSS,
    loadAccessibilityCSS,
    loadTableCSS,
    loadUtilityCSS,

    // Direct file loading (used by content-generator functions)
    loadCSSFile,

    // Utilities
    minifyCSS,
    getFallbackBaseCSS,

    // Cache management
    getCacheStatus: () => ({
      loaded: cacheLoaded,
      size: cssCache.size,
      files: Array.from(cssCache.keys()),
    }),

    clearCache: () => {
      cssCache.clear();
      cacheLoaded = false;
      logInfo("CSS cache cleared");
    },

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.CSSLoader = CSSLoader;
