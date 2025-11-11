// template-generator.js
// HTML & JavaScript Generation Module
// Responsibility: Generate JavaScript code and HTML for exported documents
// Used by: export-manager.js, content-generator.js
// Entry point for: JavaScript template loading, font embedding, HTML generation

const TemplateGenerator = (function () {
  "use strict";

  // Import dependency from TemplateEngine module
  const EnhancedTemplateEngine = window.TemplateEngine.EnhancedTemplateEngine;

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error("[TemplateGenerator]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TemplateGenerator]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TemplateGenerator]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TemplateGenerator]", message, ...args);
  }

  // ===========================================================================================
  // ENHANCED HTML GENERATOR CLASS
  // ===========================================================================================

  /**
   * Legacy EnhancedHTMLGenerator class for backward compatibility.
   *
   * This wrapper class maintains the original EnhancedHTMLGenerator API
   * while delegating all operations to the newer EnhancedTemplateEngine.
   * It exists purely for backward compatibility with code that expects
   * the old class name and method signatures.
   *
   * The class automatically creates an EnhancedTemplateEngine instance
   * during construction and proxies all method calls to it. This allows
   * existing code to continue working without modification while new
   * code can use the more appropriately named EnhancedTemplateEngine.
   *
   * New code should use EnhancedTemplateEngine directly rather than
   * this legacy wrapper. This class may be deprecated in future versions.
   *
   * @class
   * @deprecated Use EnhancedTemplateEngine directly for new code
   */
  class EnhancedHTMLGenerator {
    /**
     * Create a legacy EnhancedHTMLGenerator instance.
     * Delegates to: EnhancedTemplateEngine for all template operations
     *
     * This constructor creates a new EnhancedTemplateEngine instance and
     * stores it in this.engine. All subsequent method calls are proxied
     * to this internal engine instance.
     *
     * @example
     * // Legacy code (still works)
     * const generator = new EnhancedHTMLGenerator();
     * const html = generator.renderTemplate('readingToolsSection');
     *
     * @example
     * // Preferred approach (new code)
     * const engine = new EnhancedTemplateEngine();
     * const html = engine.render('readingToolsSection');
     */
    constructor() {
      this.engine = new EnhancedTemplateEngine();
      this.jsTemplateCache = new Map(); // ✅ OPTIMIZATION 2: Cache for JavaScript templates
      logInfo(
        "✅ Enhanced HTML Template System initialised with caching engine and JS template cache"
      );
    }

    /**
     * Render a template with data - Legacy method signature.
     * Delegates to: EnhancedTemplateEngine.render() for actual rendering
     *
     * This method maintains backward compatibility with the original
     * EnhancedHTMLGenerator API by providing the renderTemplate() method
     * name while internally delegating to the engine's render() method.
     *
     * New code should use engine.render() directly instead of this wrapper.
     *
     * @param {string} templateName - Name of template to render
     * @param {Object} data - Data to pass to template (optional)
     * @returns {string} Rendered HTML string
     *
     * @example
     * // Legacy usage
     * const generator = new EnhancedHTMLGenerator();
     * const html = generator.renderTemplate('themeToggleSection', { isDarkMode: true });
     */
    renderTemplate(templateName, data = {}) {
      return this.engine.render(templateName, data); // ✅ FIXED: Use correct method name
    }

    /**
     * Generate font options HTML - Legacy method for backward compatibility.
     * Delegates to: EnhancedTemplateEngine.getDefaultTemplateData() for font data
     *
     * This method generates HTML <option> elements for a font selection dropdown
     * using the default font options from the template system. It manually
     * constructs HTML strings rather than using templates, maintaining the
     * original API behaviour.
     *
     * The method:
     * 1. Fetches default reading tools data (includes 11 font options)
     * 2. Maps each font option to an HTML <option> element
     * 3. Marks the selected option (Verdana by default)
     * 4. Returns newline-separated HTML string
     *
     * New code should use the readingToolsSection template directly instead
     * of manually generating option HTML.
     *
     * @returns {string} HTML string of <option> elements for font selection
     * @deprecated Use readingToolsSection template for new code
     *
     * @example
     * const generator = new EnhancedHTMLGenerator();
     * const options = generator.getFontOptions();
     * // Returns:
     * // <option value="Verdana, sans-serif" selected>Verdana (sans-serif)</option>
     * // <option value="Arial, sans-serif">Arial (sans-serif)</option>
     * // ...
     */
    getFontOptions() {
      const data = this.engine.getDefaultTemplateData("readingToolsSection");
      return data.fontOptions
        .map(
          (opt) =>
            `<option value="${opt.value}"${opt.selected ? " selected" : ""}>${
              opt.label
            }</option>`
        )
        .join("\n");
    }

    /**
     * Generate reading width options HTML - Legacy method for backward compatibility.
     * Delegates to: EnhancedTemplateEngine.getDefaultTemplateData() for width data
     *
     * This method generates HTML <option> elements for a reading width selection
     * dropdown using the default width options from the template system. Like
     * getFontOptions(), it manually constructs HTML strings for backward compatibility.
     *
     * The method:
     * 1. Fetches default reading tools data (includes 4 width options)
     * 2. Maps each width option to an HTML <option> element
     * 3. Marks the selected option (narrow by default)
     * 4. Returns newline-separated HTML string
     *
     * Width options include: full, wide, narrow (default), extra-narrow
     *
     * New code should use the readingToolsSection template directly instead
     * of manually generating option HTML.
     *
     * @returns {string} HTML string of <option> elements for width selection
     * @deprecated Use readingToolsSection template for new code
     *
     * @example
     * const generator = new EnhancedHTMLGenerator();
     * const options = generator.getWidthOptions();
     * // Returns:
     * // <option value="full">Full width</option>
     * // <option value="wide">Wide</option>
     * // <option value="narrow" selected>Narrow</option>
     * // <option value="extra-narrow">Extra narrow</option>
     */
    getWidthOptions() {
      const data = this.engine.getDefaultTemplateData("readingToolsSection");
      return data.widthOptions
        .map(
          (opt) =>
            `<option value="${opt.value}"${opt.selected ? " selected" : ""}>${
              opt.label
            }</option>`
        )
        .join("\n");
    }

    // ===========================================================================================
    // JAVASCRIPT GENERATION METHODS (for export-manager.js integration)
    // ===========================================================================================

    /**
     * Load JavaScript code from external template file in templates/js/ directory.
     * Templates: templates/js/{filename}
     *
     * This is the core loader for all JavaScript template files. It fetches
     * JavaScript code from the templates/js/ directory, applies proper HTML
     * indentation (8 spaces) for embedding in <script> tags, and provides
     * comprehensive error handling.
     *
     * The method automatically:
     * - Fetches from templates/js/{filename} path
     * - Validates HTTP response (throws on 404/500/etc.)
     * - Indents every non-empty line with 8 spaces for HTML embedding
     * - Preserves empty lines for readability
     * - Logs detailed debug information
     * - Throws descriptive errors for fallback handling
     *
     * This loader is used by all generate*JS() methods to load their
     * respective template files. The consistent 8-space indentation ensures
     * properly formatted <script> tags in exported HTML documents.
     *
     * @param {string} filename - JavaScript filename (e.g., 'initialization.js')
     * @returns {Promise<string>} JavaScript content with 8-space indentation
     * @throws {Error} [TemplateSystem] If file not found or fetch fails
     *
     * @example
     * const js = await generator.loadJavaScriptTemplate('theme-management.js');
     * // Returns properly indented JavaScript:
     * //         // Theme management code
     * //         function initializeTheme() {
     * //           ...
     * //         }
     *
     * @example
     * // Error handling
     * try {
     *   const js = await generator.loadJavaScriptTemplate('missing.js');
     * } catch (error) {
     *   console.error('Failed to load:', error.message);
     *   // Error: [TemplateSystem] Failed to load JavaScript template: missing.js (HTTP 404)
     * }
     */
    async loadJavaScriptTemplate(filename) {
      // ✅ OPTIMIZATION 2: Check cache first
      if (this.jsTemplateCache.has(filename)) {
        logDebug(`📦 Using cached JavaScript template: ${filename}`);
        return this.jsTemplateCache.get(filename);
      }

      try {
        const response = await fetch(`templates/js/${filename}`);
        if (!response.ok) {
          throw new Error(
            `[TemplateSystem] Failed to load JavaScript template: ${filename} (HTTP ${response.status})`
          );
        }
        const content = await response.text();
        logDebug(
          `✅ Loaded JavaScript template: ${filename} (${content.length} chars)`
        );

        // Add proper indentation for HTML embedding (8 spaces)
        const indentedContent = content
          .split("\n")
          .map((line) => (line.trim() ? "        " + line : line))
          .join("\n");

        // ✅ OPTIMIZATION 2: Cache the result
        this.jsTemplateCache.set(filename, indentedContent);

        return indentedContent;
      } catch (error) {
        logError(
          `[TemplateSystem] ❌ Failed to load JavaScript template ${filename}:`,
          error
        );
        throw error; // Re-throw to allow fallback handling
      }
    }

    /**
     * Process JavaScript template with variable substitution.
     *
     * ✅ OPTIMIZATION 3: Helper method to reduce code duplication.
     * Handles the temporary template pattern: set → render → delete.
     *
     * This helper centralises the repetitive pattern used by all generate*JS()
     * methods that need variable substitution. It:
     * 1. Creates a temporary template in the engine
     * 2. Renders the template with provided configuration
     * 3. Cleans up the temporary template (even if render throws)
     *
     * The try-finally ensures cleanup happens even if rendering fails,
     * preventing template pollution in the engine's template Map.
     *
     * @param {string} rawContent - Raw JavaScript template content
     * @param {Object} config - Configuration object for variable substitution
     * @param {string} methodName - Method name for unique temp template key
     * @returns {string} Processed JavaScript content with variables substituted
     * @private
     */
    _processJavaScriptTemplate(rawContent, config, methodName) {
      const tempTemplateName = `${methodName}_temp`;
      this.engine.templates.set(tempTemplateName, rawContent);

      try {
        const processedContent = this.engine.render(tempTemplateName, config);
        return processedContent;
      } finally {
        // Always clean up, even if render throws
        this.engine.templates.delete(tempTemplateName);
      }
    }

    /**
     * Merge user options with AppConfig defaults and hard-coded fallbacks.
     *
     * This helper centralises the three-tier configuration resolution pattern
     * used by multiple generate*JS() methods. The resolution order is:
     * 1. User-provided options (highest priority)
     * 2. AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS (medium priority)
     * 3. Hard-coded fallbacks (lowest priority, guaranteed values)
     *
     * This method eliminates duplicate defaults access code and ensures
     * consistent fallback behaviour across all JavaScript generation methods.
     *
     * @param {Object} options - User-provided configuration overrides
     * @param {Object} fieldMap - Field mapping configuration
     * @param {string} fieldMap[outputField].optionKey - Key to check in options object
     * @param {string} fieldMap[outputField].defaultKey - Key to check in AppConfig defaults
     * @param {*} fieldMap[outputField].fallback - Hard-coded fallback value
     * @returns {Object} Merged configuration with all fields resolved
     * @private
     *
     * @example
     * const config = this._getAccessibilityConfig(options, {
     *   fontSize: {
     *     optionKey: 'defaultFontSize',
     *     defaultKey: 'defaultFontSize',
     *     fallback: 1.0
     *   },
     *   fontFamily: {
     *     optionKey: 'defaultFontFamily',
     *     defaultKey: 'defaultFontFamily',
     *     fallback: 'Verdana, sans-serif'
     *   }
     * });
     * // Returns: { fontSize: 1.0, fontFamily: 'Verdana, sans-serif' }
     */
    _getAccessibilityConfig(options, fieldMap) {
      const defaults = window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS || {};
      const config = {};

      for (const [
        outputField,
        { optionKey, defaultKey, fallback },
      ] of Object.entries(fieldMap)) {
        config[outputField] =
          options[optionKey] || defaults[defaultKey] || fallback;
      }

      return config;
    }

    /**
     * Load and optionally process a JavaScript template with standardized error handling.
     *
     * This helper centralizes the common pattern across all generate*JS() methods:
     * 1. Load JavaScript template from templates/js/ directory
     * 2. Optionally process with configuration (placeholder substitution)
     * 3. Provide consistent error messages and logging
     * 4. Handle failures with clear, actionable error messages
     *
     * Supports two modes:
     * - Simple Loading: Just load and return raw template (config = null)
     * - Configured Loading: Load, process with config, return processed template
     *
     * Error Handling:
     * - All errors include template filename for easy debugging
     * - Consistent error message format across all methods
     * - Appropriate log levels (debug for success, error for failure)
     *
     * This method was added in Stage 3 to eliminate ~120-180 lines of duplicate
     * error handling code across 12 JavaScript generation methods. It complements
     * the Stage 2 _getAccessibilityConfig() helper by handling the loading/processing
     * pattern while configuration helper handles the config merging pattern.
     *
     * @param {string} templateName - Template filename (e.g., "theme-management.js")
     * @param {Object|null} [config=null] - Configuration for processing (null for simple loading)
     * @param {string|null} [methodName=null] - Calling method name (required if config provided)
     * @returns {Promise<string>} Template content (raw or processed)
     * @throws {Error} If template loading or processing fails
     * @private
     *
     * @example
     * // Simple loading (no configuration needed)
     * const themeJS = await this._loadAndProcessTemplate("theme-management.js");
     *
     * @example
     * // Configured loading (with placeholder substitution)
     * const config = {
     *   fontSize: "1.5rem",
     *   fontFamily: "Arial, sans-serif"
     * };
     * const readingJS = await this._loadAndProcessTemplate(
     *   "reading-tools-setup.js",
     *   config,
     *   "readingToolsSetupJS"
     * );
     *
     * @example
     * // Error handling (automatic)
     * try {
     *   const js = await this._loadAndProcessTemplate("missing.js");
     * } catch (error) {
     *   // Error message includes template name: "missing.js loading failed"
     *   console.error(error.message);
     * }
     */
    async _loadAndProcessTemplate(
      templateName,
      config = null,
      methodName = null
    ) {
      try {
        // Log loading attempt (debug level - not noisy in production)
        logDebug(`🔧 Loading JavaScript template: ${templateName}`);

        // Load raw template content from templates/js/ directory
        const rawContent = await this.loadJavaScriptTemplate(templateName);

        // If configuration provided, process template with config substitution
        if (config !== null && methodName) {
          const processed = this._processJavaScriptTemplate(
            rawContent,
            config,
            methodName
          );
          logDebug(`✅ ${templateName} loaded and processed successfully`);
          return processed;
        }

        // Otherwise, return raw content (simple loading mode)
        logDebug(`✅ ${templateName} loaded successfully`);
        return rawContent;
      } catch (error) {
        // Standardized error handling with template name in message
        const errorMsg = `❌ CRITICAL: ${templateName} loading failed - NO FALLBACK: ${error.message}`;
        logError("[TemplateSystem]", errorMsg);

        // Throw with consistent error format for upstream handling
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate initialization JavaScript for exported HTML documents.

    /**
     * Generate initialization JavaScript for exported HTML documents.
     * Delegates to: loadJavaScriptTemplate() for file loading
     * Templates: templates/js/initialization.js
     *
     * ✅ MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *
     * This method loads the core initialization script that runs when an
     * exported HTML document loads. The initialization script:
     * - Sets up global accessibility defaults
     * - Initialises reading tools (font, spacing, width controls)
     * - Configures theme management
     * - Enables keyboard navigation
     * - Prepares MathJax accessibility features
     *
     * The script is loaded from an external template file to enable easy
     * maintenance and updates without modifying the template system code.
     * There is NO fallback - the external template MUST be present.
     *
     * @returns {Promise<string>} JavaScript code for document initialization (8-space indented)
     * @throws {Error} [TemplateSystem] If initialization.js template not found
     *
     * @example
     * const js = await generator.generateInitializationJS();
     * // Returns: Complete initialization script with proper indentation
     * // Ready to embed in <script> tag in exported HTML
     *
     * @example
     * // Used by export-manager.js during export
     * const initScript = await templateSystem.generateInitializationJS();
     * const html = `
     *   <script>
     * ${initScript}
     *   </script>
     * `;
     */
    async generateInitializationJS() {
      // Load JavaScript from external template file - NO FALLBACK
      try {
        logDebug(
          "ðŸ”„ Loading JavaScript from external template: initialization.js"
        );
        const javascriptContent = await this.loadJavaScriptTemplate(
          "initialization.js"
        );
        logDebug(
          " JavaScript template loaded successfully, using external file"
        );
        return javascriptContent;
      } catch (error) {
        logError(
          "[TemplateSystem]  CRITICAL: JavaScript template loading failed - NO FALLBACK AVAILABLE:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate MathJax accessibility controls JavaScript with configurable features.
     * Delegates to: loadJavaScriptTemplate() for file loading, render() for variable substitution
     * Templates: templates/js/mathjax-controls.js
     *
     *  MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *
     * This method generates the JavaScript that controls MathJax accessibility
     * features in exported documents. Configuration varies by accessibility level:
     *
     * Level 1 (Basic):
     * - Click-to-zoom equations (200% default scale)
     * - Assistive MathML for screen readers
     *
     * Level 2 (Enhanced):
     * - All Level 1 features
     * - Tab navigation between equations
     * - Equation explorer mode
     *
     * The method loads the template, applies configuration variables using
     * the Handlebars engine, and returns properly indented JavaScript ready
     * for embedding in <script> tags.
     *
     * @param {number} accessibilityLevel - Accessibility feature level (1 = basic, 2 = enhanced, default: 1)
     * @returns {Promise<string>} Configured MathJax controls JavaScript (8-space indented)
     * @throws {Error} [TemplateSystem] If mathjax-controls.js template not found
     *
     * @example
     * // Basic accessibility
     * const js = await generator.generateMathJaxControlsJS(1);
     * // Enables: click-to-zoom, assistive MathML
     *
     * @example
     * // Enhanced accessibility
     * const js = await generator.generateMathJaxControlsJS(2);
     * // Enables: all basic features + tab navigation + equation explorer
     */
    async generateMathJaxControlsJS(accessibilityLevel = 1) {
      try {
        logDebug(
          "ðŸ”„ Loading JavaScript from external template: mathjax-controls.js"
        );

        // Load the raw JavaScript template (fix: use this.loadJavaScriptTemplate, not this.engine.loadJavaScriptTemplate)
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "mathjax-controls.js"
        );

        // Apply configuration based on accessibility level
        const config = {
          zoom: "Click",
          zscale: "200%",
          assistiveMathML: true,
          tabNavigation: accessibilityLevel >= 2,
          explorerEnabled: accessibilityLevel >= 2,
        };

        // ✅ OPTIMIZATION 3: Use helper method
        const processedContent = this._processJavaScriptTemplate(
          rawJavascriptContent,
          config,
          "mathJaxControlsJS"
        );

        logDebug(
          " JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "[TemplateSystem]  CRITICAL: JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate reading tools setup JavaScript with configurable defaults.
     * Delegates to: loadJavaScriptTemplate() for file loading, render() for variable substitution
     * Templates: templates/js/reading-tools-setup.js
     *
     *  MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *  FIXED: Uses centralised accessibility defaults from AppConfig
     *
     * This method generates the JavaScript that initialises reading accessibility
     * controls in exported documents. It configures:
     * - Default font family (Verdana by default)
     * - Default font size (1.0 = 100% by default)
     * - Default reading width (narrow by default)
     * - Line height (1.6 by default)
     * - Paragraph spacing (1.0 by default)
     * - Advanced controls visibility (accessibilityLevel >= 2)
     *
     * The method:
     * 1. Loads template from templates/js/reading-tools-setup.js
     * 2. Merges user options with AppConfig defaults
     * 3. Processes template variables using Handlebars
     * 4. Returns properly indented JavaScript
     *
     * Options can override any default value. If not provided, the method
     * uses centralised defaults from window.AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS.
     *
     * @param {number} accessibilityLevel - Feature level (1 = basic, 2 = advanced, default: 1)
     * @param {Object} options - Configuration overrides (all optional)
     * @param {number} [options.defaultFontSize=1.0] - Initial font size multiplier
     * @param {string} [options.defaultFontFamily='Verdana, sans-serif'] - Initial font family
     * @param {string} [options.defaultReadingWidth='narrow'] - Initial content width
     * @param {number} [options.defaultLineHeight=1.6] - Initial line height
     * @param {number} [options.defaultParagraphSpacing=1.0] - Initial paragraph spacing
     * @returns {Promise<string>} Reading tools setup JavaScript (8-space indented)
     * @throws {Error} [TemplateSystem] If reading-tools-setup.js template not found
     *
     * @example
     * // Use all defaults
     * const js = await generator.generateReadingToolsSetupJS();
     * // Font: Verdana, Size: 100%, Width: narrow, Line height: 1.6
     *
     * @example
     * // Custom defaults for large print version
     * const js = await generator.generateReadingToolsSetupJS(1, {
     *   defaultFontSize: 1.4,
     *   defaultLineHeight: 1.8
     * });
     */
    async generateReadingToolsSetupJS(accessibilityLevel = 1, options = {}) {
      try {
        logDebug(
          "🔧 Loading JavaScript from external template: reading-tools-setup.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "reading-tools-setup.js"
        );

        // ✅ OPTIMIZATION TG-O1: Use centralised configuration helper
        const config = this._getAccessibilityConfig(options, {
          fontSize: {
            optionKey: "defaultFontSize",
            defaultKey: "defaultFontSize",
            fallback: 1.0,
          },
          fontFamily: {
            optionKey: "defaultFontFamily",
            defaultKey: "defaultFontFamily",
            fallback: "Verdana, sans-serif",
          },
          readingWidth: {
            optionKey: "defaultReadingWidth",
            defaultKey: "defaultReadingWidth",
            fallback: "narrow",
          },
          lineHeight: {
            optionKey: "defaultLineHeight",
            defaultKey: "defaultLineHeight",
            fallback: 1.6,
          },
          paragraphSpacing: {
            optionKey: "defaultParagraphSpacing",
            defaultKey: "defaultParagraphSpacing",
            fallback: 1.0,
          },
        });

        // Add accessibility level flag
        config.advancedControls = accessibilityLevel >= 2;

        // Process template with configuration
        const processedContent = this._processJavaScriptTemplate(
          rawJavascriptContent,
          config,
          "readingToolsSetupJS"
        );

        logDebug(
          "✅ Reading Tools Setup JavaScript template loaded and processed successfully"
        );
        return processedContent;
      } catch (error) {
        logError(
          "[TemplateSystem] ❌ CRITICAL: Reading Tools Setup JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate theme management JavaScript for light/dark mode switching.
     * Delegates to: loadJavaScriptTemplate() for file loading, render() for variable substitution
     * Templates: templates/js/theme-management.js
     *
     *  MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *
     * This method generates the JavaScript that handles theme switching in
     * exported documents. Features include:
     * - Light/dark mode toggle
     * - System preference detection and respect
     * - localStorage persistence (remembers user choice)
     * - Smooth transitions (optional)
     * - WCAG 2.2 AA compliant colour contrast in both modes
     * - Accessible theme toggle button with proper ARIA labels
     *
     * Configuration options:
     * - defaultTheme: Initial theme ('light' or 'dark')
     * - enableTransitions: Smooth transitions between themes
     * - respectSystemPreference: Auto-detect OS preference on first visit
     *
     * The script automatically:
     * - Detects system dark mode preference (prefers-color-scheme)
     * - Applies theme immediately on page load (prevents flash)
     * - Updates button text and ARIA labels
     * - Saves preference to localStorage
     *
     * @param {Object} options - Theme configuration (all optional)
     * @param {string} [options.defaultTheme='light'] - Initial theme ('light' or 'dark')
     * @param {boolean} [options.enableTransitions=true] - Enable smooth transitions
     * @param {boolean} [options.respectSystemPreference=true] - Auto-detect OS preference
     * @returns {Promise<string>} Theme management JavaScript (8-space indented)
     * @throws {Error} [TemplateSystem] If theme-management.js template not found
     *
     * @example
     * // Use defaults (light theme, system detection enabled)
     * const js = await generator.generateThemeManagementJS();
     *
     * @example
     * // Force dark theme by default, no system detection
     * const js = await generator.generateThemeManagementJS({
     *   defaultTheme: 'dark',
     *   respectSystemPreference: false
     * });
     */
    async generateThemeManagementJS(options = {}) {
      try {
        logDebug(
          "ðŸ”„ Loading JavaScript from external template: theme-management.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "theme-management.js"
        );

        // Apply configuration based on options
        const config = {
          defaultTheme: options.defaultTheme || "light",
          enableTransitions: options.enableTransitions !== false,
          respectSystemPreference: options.respectSystemPreference !== false,
        };

        // ✅ OPTIMIZATION 3: Use helper method
        const processedContent = this._processJavaScriptTemplate(
          rawJavascriptContent,
          config,
          "themeManagementJS"
        );

        logDebug(
          " Theme Management JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "[TemplateSystem]  CRITICAL: Theme Management JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate form initialisation JavaScript for accessibility controls.
     * Delegates to: loadJavaScriptTemplate() for file loading, render() for variable substitution
     * Templates: templates/js/form-initialization.js
     *
     *  MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *  FIXED: Uses centralised accessibility defaults from AppConfig
     *
     * This method generates the JavaScript that initialises all form controls
     * in the exported document's accessibility sidebar. It sets up:
     * - Font selection dropdown (default: Verdana)
     * - Font size slider (default: 100%)
     * - Reading width radio buttons (default: narrow)
     * - Line height controls (default: 1.6)
     * - Word spacing controls (default: 0)
     * - Zoom level controls (default: 100%)
     * - Form validation (optional)
     * - Accessibility enhancements (optional)
     * - User preference persistence (optional)
     *
     * The script ensures all form controls reflect their default values on
     * page load and are properly connected to their change handlers. It uses
     * centralised defaults from AppConfig when available, with sensible
     * fallbacks for each control.
     *
     * @param {Object} options - Form configuration overrides (all optional)
     * @param {string} [options.defaultFontSize='1.0'] - Initial font size multiplier
     * @param {string} [options.defaultFontSizePercent='100%'] - Font size as percentage
     * @param {string} [options.defaultLineHeight='1.6'] - Initial line height
     * @param {string} [options.defaultWordSpacing='0'] - Initial word spacing
     * @param {string} [options.defaultReadingWidth='narrow'] - Initial reading width
     * @param {string} [options.defaultZoomLevel='1.0'] - Initial zoom level
     * @param {boolean} [options.enableValidation=true] - Enable form validation
     * @param {boolean} [options.enableAccessibility=true] - Enable accessibility features
     * @param {boolean} [options.enablePreferences=true] - Enable preference persistence
     * @returns {Promise<string>} Form initialisation JavaScript (8-space indented)
     * @throws {Error} [TemplateSystem] If form-initialization.js template not found
     *
     * @example
     * // Use all defaults
     * const js = await generator.generateFormInitializationJS();
     *
     * @example
     * // Custom defaults for specific audience
     * const js = await generator.generateFormInitializationJS({
     *   defaultFontSize: '1.2',
     *   defaultLineHeight: '1.8',
     *   defaultReadingWidth: 'extra-narrow'
     * });
     */
    async generateFormInitializationJS(options = {}) {
      try {
        logDebug(
          "🔧 Loading JavaScript from external template: form-initialization.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "form-initialization.js"
        );

        // ✅ OPTIMIZATION TG-O1: Use centralised configuration helper
        const config = this._getAccessibilityConfig(options, {
          defaultFontSize: {
            optionKey: "defaultFontSize",
            defaultKey: "defaultFontSize",
            fallback: "1.0",
          },
          defaultFontSizePercent: {
            optionKey: "defaultFontSizePercent",
            defaultKey: "defaultFontSizePercent",
            fallback: "100%",
          },
          defaultLineHeight: {
            optionKey: "defaultLineHeight",
            defaultKey: "defaultLineHeight",
            fallback: "1.6",
          },
          defaultWordSpacing: {
            optionKey: "defaultWordSpacing",
            defaultKey: "defaultWordSpacing",
            fallback: "0",
          },
          defaultReadingWidth: {
            optionKey: "defaultReadingWidth",
            defaultKey: "defaultReadingWidth",
            fallback: "narrow",
          },
          defaultZoomLevel: {
            optionKey: "defaultZoomLevel",
            defaultKey: "defaultZoomLevel",
            fallback: "1.0",
          },
        });

        // Add boolean configuration flags
        config.enableValidation = options.enableValidation !== false;
        config.enableAccessibility = options.enableAccessibility !== false;
        config.enablePreferences = options.enablePreferences !== false;

        // Process template with configuration
        const processedContent = this._processJavaScriptTemplate(
          rawJavascriptContent,
          config,
          "formInitializationJS"
        );

        logDebug(
          "✅ Form Initialization JavaScript template loaded and processed successfully"
        );
        return processedContent;
      } catch (error) {
        logError(
          "[TemplateSystem] ❌ CRITICAL: Form Initialization JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate focus tracking JavaScript for keyboard navigation and accessibility.
     * Delegates to: loadJavaScriptTemplate() for file loading, render() for variable substitution
     * Templates: templates/js/focus-tracking.js
     *
     *  MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *
     * This method generates the JavaScript that implements comprehensive keyboard
     * navigation and focus management in exported documents. Features include:
     * - Visual focus indicators (WCAG 2.2 AA compliant)
     * - Focus history tracking (back/forward navigation)
     * - Keyboard shortcuts for common actions
     * - Screen reader announcements for focus changes
     * - Skip link support (skip to main content)
     * - Console commands for debugging focus issues
     *
     * Configuration options control which features are enabled. All features
     * default to enabled (true) for maximum accessibility. The focus tracking
     * system is particularly important for users who rely on keyboard navigation
     * or screen readers.
     *
     * Console commands (when enabled):
     * - getFocusHistory(): Show recent focus changes
     * - getCurrentFocus(): Get currently focused element
     * - clearFocusHistory(): Reset focus tracking
     *
     * @param {Object} options - Focus tracking configuration (all optional)
     * @param {boolean} [options.enableFocusTracking=true] - Track focus changes
     * @param {boolean} [options.enableKeyboardNavigation=true] - Enable keyboard shortcuts
     * @param {boolean} [options.enableAccessibilityAnnouncements=true] - Screen reader announcements
     * @param {boolean} [options.enableFocusHistory=true] - Track focus history
     * @param {boolean} [options.enableConsoleCommands=true] - Enable debug commands
     * @param {number} [options.commandsDelayMs=100] - Delay before enabling commands (ms)
     * @returns {Promise<string>} Focus tracking JavaScript (8-space indented)
     * @throws {Error} [TemplateSystem] If focus-tracking.js template not found
     *
     * @example
     * // Enable all features (default)
     * const js = await generator.generateFocusTrackingJS();
     *
     * @example
     * // Minimal setup (tracking only, no console commands)
     * const js = await generator.generateFocusTrackingJS({
     *   enableConsoleCommands: false,
     *   enableFocusHistory: false
     * });
     */
    async generateFocusTrackingJS(options = {}) {
      try {
        logDebug(
          "ðŸ”„ Loading JavaScript from external template: focus-tracking.js"
        );

        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "focus-tracking.js"
        );

        const config = {
          enableFocusTracking: options.enableFocusTracking !== false,
          enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
          enableAccessibilityAnnouncements:
            options.enableAccessibilityAnnouncements !== false,
          enableFocusHistory: options.enableFocusHistory !== false,
          enableConsoleCommands: options.enableConsoleCommands !== false,
          commandsDelayMs: options.commandsDelayMs || 100,
        };

        // ✅ OPTIMIZATION 3: Use helper method
        const processedContent = this._processJavaScriptTemplate(
          rawJavascriptContent,
          config,
          "focusTrackingJS"
        );

        logDebug(
          " Focus Tracking JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "[TemplateSystem]  CRITICAL: Focus Tracking JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Generate CSS with embedded font data for offline accessibility fonts.
     * Delegates to: loadFontData() for font file loading, render() for CSS generation
     * Templates: templates/embedded-fonts.html
     *
     * This critical method embeds font files directly into CSS using base64
     * data URIs, ensuring exported documents work offline without external
     * font dependencies. Embedded fonts include:
     * - OpenDyslexic (4 variants: regular, bold, italic, bold-italic)
     * - Annotation Mono (variable font with weight range 100-1000)
     *
     * The method:
     * 1. Loads font data from external .txt files (base64 encoded)
     * 2. Maps font data to template variables
     * 3. Renders embedded-fonts template with @font-face declarations
     * 4. Returns CSS ready for embedding in <style> tags
     * 5. Gracefully degrades if fonts unavailable (returns empty string)
     *
     * Font data is loaded from:
     * - fonts/opendyslexic-regular.txt
     * - fonts/opendyslexic-bold.txt
     * - fonts/opendyslexic-italic.txt
     * - fonts/opendyslexic-bold-italic.txt
     * - fonts/AnnotationMono-VF.txt
     *
     * The generated CSS includes proper @font-face declarations with unicode
     * ranges and font-display settings for optimal loading performance.
     *
     * @param {Object} fontData - Optional font data override for testing (keys: regular, bold, italic, boldItalic, AnnotationMonoVF)
     * @returns {Promise<string>} CSS with embedded @font-face declarations or empty string on failure
     *
     * @example
     * // Load all fonts from external files
     * const css = await generator.generateEmbeddedFontsCSS();
     * // Returns: CSS with 5 @font-face declarations (~400-600KB base64 data)
     *
     * @example
     * // Override with custom font data (testing)
     * const css = await generator.generateEmbeddedFontsCSS({
     *   regular: 'CUSTOM_BASE64_DATA',
     *   bold: 'CUSTOM_BASE64_DATA'
     * });
     *
     * @example
     * // Graceful degradation when fonts unavailable
     * const css = await generator.generateEmbeddedFontsCSS();
     * // Returns: '' (empty string, no console errors)
     */
    async generateEmbeddedFontsCSS(fontData = {}) {
      // ✅ OPTIMIZATION 4: Removed duplicate logging (use module-level)

      try {
        logDebug("📄 Loading embedded fonts template");

        // Check if template is available
        if (!this.engine.templates.has("embedded-fonts")) {
          logWarn(
            "[TemplateSystem] Embedded fonts template not found - graceful degradation"
          );
          return "";
        }

        // Load font data from external files or use provided data
        const resolvedFontData = await this.loadFontData(fontData);

        //  Map AnnotationMonoVF data to template variables
        const templateData = {
          // OpenDyslexic (existing static font - direct mapping)
          base64Regular: resolvedFontData.base64Regular,
          base64Bold: resolvedFontData.base64Bold,
          base64Italic: resolvedFontData.base64Italic,
          base64BoldItalic: resolvedFontData.base64BoldItalic,

          //  AnnotationMonoVF variable font mapping
          fontNameVariableBase64: resolvedFontData.base64AnnotationMonoVF,

          //  Conditional flag for template
          hasFontNameVariable:
            !!resolvedFontData.base64AnnotationMonoVF &&
            resolvedFontData.base64AnnotationMonoVF !==
              "YOUR_BASE64_PLACEHOLDER",
        };

        logDebug("ðŸŽ¨ Template data prepared:", {
          staticFonts: 4,
          variableFonts: templateData.hasFontNameVariable ? 1 : 0,
          annotationMonoVFLength: templateData.fontNameVariableBase64
            ? templateData.fontNameVariableBase64.length
            : 0,
        });

        // Render template with mapped data
        const css = this.engine.render("embedded-fonts", templateData);

        logDebug(" Embedded fonts CSS generated successfully");
        logInfo(
          `ðŸŽ¯ Font CSS includes Annotation Mono: ${css.includes(
            "Annotation Mono"
          )}`
        );

        return css;
      } catch (error) {
        logError(
          "[TemplateSystem]  Failed to generate embedded fonts CSS:",
          error.message
        );
        // Return empty string if fonts fail to load (graceful degradation)
        return "";
      }
    }

    /**
     * Load accessibility font data from external base64-encoded files.
     * Delegates to: fetch() for file loading
     *
     * This method loads base64-encoded font data from external .txt files in
     * the fonts/ directory. It handles both OpenDyslexic (4 variants) and
     * Annotation Mono (variable font) with comprehensive error handling and
     * fallback behaviour.
     *
     * Font files loaded:
     * - fonts/opendyslexic-regular.txt â†’ base64Regular
     * - fonts/opendyslexic-bold.txt â†’ base64Bold
     * - fonts/opendyslexic-italic.txt â†’ base64Italic
     * - fonts/opendyslexic-bold-italic.txt â†’ base64BoldItalic
     * - fonts/AnnotationMono-VF.txt â†’ base64AnnotationMonoVF
     *
     * The method:
     * 1. Checks for override data first (useful for testing)
     * 2. Fetches each font file via HTTP
     * 3. Trims whitespace from base64 data
     * 4. Falls back to placeholder on fetch failure
     * 5. Logs detailed progress and errors
     * 6. Returns object with consistently named properties
     *
     * Error handling is graceful - individual font failures don't prevent
     * the method from completing. Failed fonts get placeholder values and
     * a warning is logged.
     *
     * @param {Object} overrideFontData - Optional font data to bypass file loading (for testing)
     * @param {string} [overrideFontData.regular] - Override OpenDyslexic regular
     * @param {string} [overrideFontData.bold] - Override OpenDyslexic bold
     * @param {string} [overrideFontData.italic] - Override OpenDyslexic italic
     * @param {string} [overrideFontData.boldItalic] - Override OpenDyslexic bold-italic
     * @param {string} [overrideFontData.AnnotationMonoVF] - Override Annotation Mono variable font
     * @returns {Promise<Object>} Font data object with base64 strings
     * @returns {string} result.base64Regular - OpenDyslexic regular variant
     * @returns {string} result.base64Bold - OpenDyslexic bold variant
     * @returns {string} result.base64Italic - OpenDyslexic italic variant
     * @returns {string} result.base64BoldItalic - OpenDyslexic bold-italic variant
     * @returns {string} result.base64AnnotationMonoVF - Annotation Mono variable font
     *
     * @example
     * // Load all fonts from external files
     * const fonts = await generator.loadFontData();
     * // Returns: {
     * //   base64Regular: 'AAEAAAALAIAAAwAwT1...',
     * //   base64Bold: 'AAEAAAALAIAAAwAwT1...',
     * //   base64Italic: 'AAEAAAALAIAAAwAwT1...',
     * //   base64BoldItalic: 'AAEAAAALAIAAAwAwT1...',
     * //   base64AnnotationMonoVF: 'AAEAAAALAIAAAwAwT1...'
     * // }
     *
     * @example
     * // Override specific font for testing
     * const fonts = await generator.loadFontData({
     *   regular: 'TEST_BASE64_DATA'
     * });
     * // Loads other fonts from files, uses TEST_BASE64_DATA for regular
     */
    async loadFontData(overrideFontData = {}) {
      // ✅ OPTIMIZATION 1: Removed duplicate logging (use module-level)

      // Font file mapping
      const fontFiles = {
        regular: "fonts/opendyslexic-regular.txt",
        bold: "fonts/opendyslexic-bold.txt",
        italic: "fonts/opendyslexic-italic.txt",
        boldItalic: "fonts/opendyslexic-bold-italic.txt",
        AnnotationMonoVF: "fonts/AnnotationMono-VF.txt",
      };

      // ✅ OPTIMIZATION 1: Parallel font loading (5x faster)
      // Create array of promises for all fonts to load simultaneously
      const loadPromises = Object.entries(fontFiles).map(
        async ([variant, filepath]) => {
          try {
            // Check for override data first
            if (overrideFontData[variant]) {
              return {
                variant,
                base64Data: overrideFontData[variant],
                fromOverride: true,
              };
            }

            // Load from external file
            logDebug(`📄 Loading font file: ${filepath}`);
            const response = await fetch(filepath);

            if (!response.ok) {
              throw new Error(
                `[TemplateSystem] HTTP ${response.status}: ${response.statusText}`
              );
            }

            const base64Data = (await response.text()).trim();
            return {
              variant,
              base64Data,
              fromOverride: false,
            };
          } catch (error) {
            logWarn(
              `[TemplateSystem] Failed to load ${variant} font from ${filepath}:`,
              error.message
            );
            return {
              variant,
              base64Data: "YOUR_BASE64_PLACEHOLDER",
              failed: true,
            };
          }
        }
      );

      // Wait for all fonts to load simultaneously
      const results = await Promise.all(loadPromises);

      // Build fontData object from results
      const fontData = {};
      results.forEach(({ variant, base64Data, fromOverride, failed }) => {
        const propertyName = `base64${
          variant.charAt(0).toUpperCase() + variant.slice(1)
        }`;
        fontData[propertyName] = base64Data;

        if (fromOverride) {
          logDebug(`✅ Using provided font data for ${variant}`);
        } else if (failed) {
          logDebug(`⚠️ Using placeholder for ${variant}`);
        } else {
          logDebug(`✅ Loaded ${variant} font (${base64Data.length} chars)`);
        }
      });

      logInfo(
        `🎨 Font data loading complete: ${
          Object.keys(fontData).length
        }/5 variants loaded`
      );
      return fontData;
    }
    /**
     * Generate ReadingAccessibilityManager class JavaScript for centralised control management.
     * Delegates to: loadJavaScriptTemplate() for file loading, render() for variable substitution
     * Templates: templates/js/reading-accessibility-manager-class.js
     *
     *  MIGRATED: Now uses external JavaScript template file (NO FALLBACK)
     *  FIXED: Uses centralised accessibility defaults from AppConfig
     *
     * This method generates a comprehensive JavaScript class that manages all
     * reading accessibility controls in exported documents. The class provides:
     * - Centralised state management for all accessibility settings
     * - Coordinated updates across multiple UI controls
     * - localStorage persistence for user preferences
     * - Event handling for control interactions
     * - Validation and sanitisation of user inputs
     * - Accessibility announcements for screen readers
     * - Advanced control features (level >= 2)
     *
     * The ReadingAccessibilityManager class acts as the single source of truth
     * for accessibility settings, ensuring consistency between:
     * - Form controls (sliders, dropdowns, radio buttons)
     * - Document styling (CSS custom properties)
     * - User preferences (localStorage)
     * - Screen reader announcements (ARIA live regions)
     *
     * Default values are sourced from:
     * 1. Provided options parameter
     * 2. AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS
     * 3. Hard-coded fallbacks (matching template defaults)
     *
     * @param {Object} options - Manager configuration overrides (all optional)
     * @param {string} [options.defaultFontSize='1.0'] - Initial font size multiplier
     * @param {string} [options.defaultFontFamily='Verdana, sans-serif'] - Initial font family
     * @param {string} [options.defaultReadingWidth='narrow'] - Initial reading width
     * @param {string} [options.defaultLineHeight='1.6'] - Initial line height
     * @param {string} [options.defaultParagraphSpacing='1.0'] - Initial paragraph spacing
     * @param {boolean} [options.enableAdvancedControls=false] - Enable word/letter spacing
     * @returns {Promise<string>} ReadingAccessibilityManager class JavaScript (8-space indented)
     * @throws {Error} [TemplateSystem] If reading-accessibility-manager-class.js template not found
     *
     * @example
     * // Use all defaults
     * const js = await generator.generateReadingAccessibilityManagerClassJS();
     * // Creates class with standard defaults: Verdana, 100%, narrow, 1.6, etc.
     *
     * @example
     * // Custom defaults with advanced controls
     * const js = await generator.generateReadingAccessibilityManagerClassJS({
     *   defaultFontSize: '1.2',
     *   defaultLineHeight: '1.8',
     *   enableAdvancedControls: true
     * });
     * // Enables word spacing and letter spacing controls
     */
    async generateReadingAccessibilityManagerClassJS(options = {}) {
      try {
        logDebug(
          "🔧 Loading JavaScript from external template: reading-accessibility-manager-class.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "reading-accessibility-manager-class.js"
        );

        // ✅ OPTIMIZATION TG-O1: Use centralised configuration helper
        const config = this._getAccessibilityConfig(options, {
          defaultFontSize: {
            optionKey: "defaultFontSize",
            defaultKey: "defaultFontSize",
            fallback: "1.0",
          },
          defaultFontFamily: {
            optionKey: "defaultFontFamily",
            defaultKey: "defaultFontFamily",
            fallback: "Verdana, sans-serif",
          },
          defaultReadingWidth: {
            optionKey: "defaultReadingWidth",
            defaultKey: "defaultReadingWidth",
            fallback: "narrow",
          },
          defaultLineHeight: {
            optionKey: "defaultLineHeight",
            defaultKey: "defaultLineHeight",
            fallback: "1.6",
          },
          defaultParagraphSpacing: {
            optionKey: "defaultParagraphSpacing",
            defaultKey: "defaultParagraphSpacing",
            fallback: "1.0",
          },
        });

        // Add advanced controls flag
        config.enableAdvancedControls =
          options.enableAdvancedControls !== false;

        // Process template with configuration
        const processedContent = this._processJavaScriptTemplate(
          rawJavascriptContent,
          config,
          "readingAccessibilityManagerClassJS"
        );

        logDebug(
          "✅ Reading Accessibility Manager Class JavaScript template loaded and processed successfully"
        );
        return processedContent;
      } catch (error) {
        logError(
          "[TemplateSystem] ❌ CRITICAL: Reading Accessibility Manager Class JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(
          `[TemplateSystem] External template required: ${error.message}`
        );
      }
    }

    /**
     * Pre-load all JavaScript templates into cache for optimal performance.
     *
     * ✅ OPTIMIZATION 2: Optional method to pre-warm the template cache.
     * This eliminates network requests for all subsequent generate*JS() calls.
     *
     * Templates pre-loaded:
     * - initialization.js (core setup)
     * - mathjax-controls.js (equation accessibility)
     * - reading-tools-setup.js (font, spacing, width)
     * - theme-management.js (light/dark mode)
     * - form-initialization.js (control setup)
     * - focus-tracking.js (keyboard navigation)
     * - reading-accessibility-manager-class.js (centralised control manager)
     *
     * This method is optional - templates will load on-demand if not pre-loaded.
     * Pre-loading is recommended for documents that use multiple templates.
     *
     * @returns {Promise<Object>} Summary of pre-load results
     * @returns {number} result.loaded - Number of templates successfully loaded
     * @returns {number} result.failed - Number of templates that failed to load
     * @returns {number} result.total - Total templates attempted
     * @returns {Array<string>} result.failedTemplates - Names of templates that failed
     *
     * @example
     * const generator = new EnhancedHTMLGenerator();
     * const results = await generator.preloadJavaScriptTemplates();
     * console.log(`Pre-loaded ${results.loaded}/${results.total} templates`);
     * // Now all generate*JS() methods use cached templates
     */
    async preloadJavaScriptTemplates() {
      const templates = [
        "initialization.js",
        "mathjax-controls.js",
        "reading-tools-setup.js",
        "theme-management.js",
        "form-initialization.js",
        "focus-tracking.js",
        "reading-accessibility-manager-class.js",
      ];

      logInfo(`🚀 Pre-loading ${templates.length} JavaScript templates...`);

      const results = await Promise.all(
        templates.map(async (filename) => {
          try {
            await this.loadJavaScriptTemplate(filename);
            return { filename, success: true };
          } catch (error) {
            logWarn(`Failed to pre-load ${filename}:`, error.message);
            return { filename, success: false };
          }
        })
      );

      const loaded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);

      logInfo(
        `✅ Pre-loaded ${loaded}/${templates.length} JavaScript templates`
      );

      return {
        loaded,
        failed: failed.length,
        total: templates.length,
        failedTemplates: failed.map((f) => f.filename),
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  logInfo("✅ Template Generator module loaded successfully");

  return {
    EnhancedHTMLGenerator: EnhancedHTMLGenerator,

    // Factory function for easier instantiation
    createGenerator() {
      return new EnhancedHTMLGenerator();
    },
  };
})();

// Make globally available
window.TemplateGenerator = TemplateGenerator;

// Also export for ES6 module compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = TemplateGenerator;
}
