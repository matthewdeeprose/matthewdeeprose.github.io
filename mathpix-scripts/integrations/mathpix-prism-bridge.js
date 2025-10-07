// Logging configuration (module level)
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
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * MathPix Prism.js Integration Bridge
 * Provides enhanced syntax highlighting for mathematical formats
 * Integrates with existing Prism.js installation for professional code display
 */
class MathPixPrismBridge {
  constructor() {
    this.supportedLanguages = {
      latex: "latex",
      mathml: "xml",
      html: "html",
      markdown: "markdown",
      json: "json",
      asciimath: "none", // Plain text, no specific highlighting
    };

    this.themeMode = this.detectThemeMode();
    this.isPrismAvailable = this.ensurePrismAvailability();

    logInfo("MathPix Prism Bridge initialised", {
      prismAvailable: this.isPrismAvailable,
      themeMode: this.themeMode,
      supportedLanguages: Object.keys(this.supportedLanguages),
    });
  }

  /**
   * Apply syntax highlighting to a content element
   * @param {HTMLElement} element - The element containing code to highlight
   * @param {string} format - The format type (latex, mathml, html, etc.)
   * @param {string} content - The content to highlight
   */
  applySyntaxHighlighting(element, format, content) {
    if (!element) {
      logWarn("Cannot apply syntax highlighting - element not provided");
      return false;
    }

    if (!content || content.trim() === "") {
      logDebug("No content to highlight for format:", format);
      return false;
    }

    try {
      const language = this.supportedLanguages[format] || "none";

      logDebug("Applying syntax highlighting", {
        format: format,
        language: language,
        contentLength: content.length,
        prismAvailable: this.isPrismAvailable,
      });

      // Set content and prepare for highlighting
      element.textContent = content;

      // Remove existing language classes
      element.className = element.className
        .split(" ")
        .filter((cls) => !cls.startsWith("language-"))
        .join(" ");

      if (language !== "none") {
        // Add language-specific class for Prism
        element.classList.add(`language-${language}`);

        // Apply Prism highlighting if available
        if (this.isPrismAvailable && window.Prism) {
          try {
            window.Prism.highlightElement(element);
            logDebug(`Syntax highlighting applied for ${format} (${language})`);
          } catch (prismError) {
            logWarn("Prism highlighting failed, using plain text", prismError);
            this.applyPlainTextFormatting(element, format);
          }
        } else {
          logDebug("Prism not available, applying plain text formatting");
          this.applyPlainTextFormatting(element, format);
        }
      } else {
        // Apply plain text formatting for unsupported languages
        this.applyPlainTextFormatting(element, format);
      }

      // Apply theme-specific styling
      this.applyThemeSpecificStyling(element, format);

      return true;
    } catch (error) {
      logError("Failed to apply syntax highlighting", error);
      // Fallback to plain text
      element.textContent = content;
      this.applyPlainTextFormatting(element, format);
      return false;
    }
  }

  /**
   * Apply plain text formatting when syntax highlighting is not available
   * @param {HTMLElement} element - The element to format
   * @param {string} format - The format type
   */
  applyPlainTextFormatting(element, format) {
    // Add format-specific class for styling
    element.classList.add("mathpix-format", `mathpix-format-${format}`);

    // Add basic formatting for readability
    if (format === "json") {
      try {
        const parsed = JSON.parse(element.textContent);
        element.textContent = JSON.stringify(parsed, null, 2);
      } catch (e) {
        logDebug("JSON formatting failed, using original content");
      }
    }

    logDebug(`Plain text formatting applied for ${format}`);
  }

  /**
   * Apply theme-specific styling based on current mode
   * @param {HTMLElement} element - The element to style
   * @param {string} format - The format type
   */
  applyThemeSpecificStyling(element, format) {
    const currentTheme = this.detectThemeMode();

    // Update theme if it has changed
    if (currentTheme !== this.themeMode) {
      this.themeMode = currentTheme;
      logDebug("Theme mode updated:", currentTheme);
    }

    // Add theme-specific class
    element.classList.add(`theme-${currentTheme}`);

    // Add format and theme specific attributes for CSS targeting
    element.setAttribute("data-format", format);
    element.setAttribute("data-theme", currentTheme);
  }

  /**
   * Detect current theme mode (light/dark)
   * @returns {string} Theme mode ('light' or 'dark')
   */
  detectThemeMode() {
    // Check for theme toggle button state
    const themeToggle = document.getElementById("modeToggle");
    if (themeToggle) {
      const isDark = themeToggle.getAttribute("aria-pressed") === "true";
      return isDark ? "dark" : "light";
    }

    // Fallback to CSS media query
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }

    return "light";
  }

  /**
   * Ensure Prism.js is available and log capabilities
   * @returns {boolean} True if Prism is available
   */
  ensurePrismAvailability() {
    const isAvailable =
      typeof window !== "undefined" &&
      typeof window.Prism !== "undefined" &&
      typeof window.Prism.highlightElement === "function";

    if (isAvailable) {
      logInfo("Prism.js detected", {
        version: window.Prism.version || "unknown",
        languages: window.Prism.languages
          ? Object.keys(window.Prism.languages).slice(0, 10)
          : [],
        plugins: window.Prism.plugins ? Object.keys(window.Prism.plugins) : [],
      });
    } else {
      logWarn("Prism.js not available - falling back to plain text formatting");
    }

    return isAvailable;
  }

  /**
   * Copy button functionality now handled by existing MarkdownCodeCopy system
   * This method is preserved for backwards compatibility but delegates to the existing system
   * @param {HTMLElement} copyButton - The copy button element (unused)
   * @param {HTMLElement} codeElement - The code element being copied (unused)
   * @param {string} format - The format type
   */
  enhanceCopyButton(copyButton, codeElement, format) {
    logDebug(
      `Copy button enhancement for ${format} delegated to existing MarkdownCodeCopy system`
    );
    // The existing MarkdownCodeCopy system provides superior:
    // - Accessibility with screen reader announcements
    // - Clipboard API with fallbacks
    // - Visual feedback and ARIA live regions
    // - Consistent styling and behavior
  }

  /**
   * Refresh syntax highlighting for all visible formats
   * Called when theme changes or content updates
   */
  refreshAllHighlighting() {
    logInfo("Refreshing all syntax highlighting");

    // Update theme mode
    this.themeMode = this.detectThemeMode();

    // Find all mathpix format elements
    const formatElements = document.querySelectorAll("[data-format]");

    formatElements.forEach((element) => {
      const format = element.getAttribute("data-format");
      const content = element.textContent;

      if (format && content) {
        this.applySyntaxHighlighting(element, format, content);
      }
    });

    logInfo(`Refreshed highlighting for ${formatElements.length} elements`);
  }

  /**
   * Get syntax highlighting capabilities report
   * @returns {Object} Capabilities information
   */
  getCapabilities() {
    return {
      prismAvailable: this.isPrismAvailable,
      currentTheme: this.themeMode,
      supportedFormats: Object.keys(this.supportedLanguages),
      languageMapping: { ...this.supportedLanguages },
      prismLanguages:
        this.isPrismAvailable && window.Prism.languages
          ? Object.keys(window.Prism.languages)
          : [],
      themeDetection: {
        toggleButton: !!document.getElementById("modeToggle"),
        mediaQuery:
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches,
      },
    };
  }

  /**
   * Test syntax highlighting functionality
   * @returns {boolean} True if working correctly
   */
  testHighlighting() {
    logInfo("Testing MathPix syntax highlighting...");

    // Create test element
    const testElement = document.createElement("code");
    testElement.style.display = "none";
    document.body.appendChild(testElement);

    const testCases = [
      { format: "latex", content: "\\frac{1}{2} + \\sqrt{x}" },
      { format: "json", content: '{"test": "value", "number": 123}' },
      { format: "html", content: "<math><mi>x</mi></math>" },
    ];

    let successes = 0;

    testCases.forEach((testCase) => {
      const success = this.applySyntaxHighlighting(
        testElement,
        testCase.format,
        testCase.content
      );
      if (success) successes++;

      logDebug(`Test ${testCase.format}:`, success ? "✓" : "❌");
    });

    // Cleanup
    document.body.removeChild(testElement);

    const allPassed = successes === testCases.length;
    logInfo(
      `Syntax highlighting test completed: ${successes}/${testCases.length} passed`
    );

    return allPassed;
  }
}

export default MathPixPrismBridge;
