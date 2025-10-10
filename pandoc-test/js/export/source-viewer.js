// source-viewer.js
// Source Code Viewing Module for Enhanced Exports
// Refactored to use external templates for better maintainability

const SourceViewer = (function () {
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
      console.error("[SOURCE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[SOURCE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[SOURCE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[SOURCE]", message, ...args);
  }

  // ===========================================================================================
  // COMPREHENSIVE PANDOC → PRISM.JS LANGUAGE MAPPING
  // ===========================================================================================

  const PANDOC_TO_PRISM_MAPPING = {
    // Markup languages
    latex: { prism: "latex", display: "LaTeX", category: "markup" },
    tex: { prism: "latex", display: "TeX", category: "markup" },
    markdown: { prism: "markdown", display: "Markdown", category: "markup" },
    markdown_strict: {
      prism: "markdown",
      display: "Markdown (Strict)",
      category: "markup",
    },
    markdown_phpextra: {
      prism: "markdown",
      display: "Markdown (PHP Extra)",
      category: "markup",
    },
    markdown_github: {
      prism: "markdown",
      display: "Markdown (GitHub)",
      category: "markup",
    },
    markdown_mmd: {
      prism: "markdown",
      display: "MultiMarkdown",
      category: "markup",
    },
    gfm: {
      prism: "markdown",
      display: "GitHub Flavoured Markdown",
      category: "markup",
    },
    commonmark: {
      prism: "markdown",
      display: "CommonMark",
      category: "markup",
    },
    commonmark_x: {
      prism: "markdown",
      display: "CommonMark (Extended)",
      category: "markup",
    },

    // HTML and XML variants
    html: { prism: "markup", display: "HTML", category: "markup" },
    xml: { prism: "markup", display: "XML", category: "markup" },
    docbook: { prism: "markup", display: "DocBook XML", category: "markup" },
    jats: { prism: "markup", display: "JATS XML", category: "markup" },

    // Other markup formats
    rst: { prism: "rest", display: "reStructuredText", category: "markup" },
    textile: { prism: "textile", display: "Textile", category: "markup" },
    org: { prism: "markup", display: "Emacs Org Mode", category: "markup" },
    creole: { prism: "markup", display: "Creole", category: "markup" },
    muse: { prism: "markup", display: "Muse", category: "markup" },
    djot: { prism: "markup", display: "Djot", category: "markup" },
    t2t: { prism: "markup", display: "txt2tags", category: "markup" },
    vimwiki: { prism: "markup", display: "Vimwiki", category: "markup" },
    haddock: { prism: "markup", display: "Haddock", category: "markup" },

    // Wiki formats
    mediawiki: {
      prism: "wiki",
      display: "MediaWiki",
      category: "markup",
      fallback: "markup",
    },
    dokuwiki: { prism: "markup", display: "DokuWiki", category: "markup" },
    tikiwiki: { prism: "markup", display: "TikiWiki", category: "markup" },
    twiki: { prism: "markup", display: "TWiki", category: "markup" },
    jira: { prism: "markup", display: "Jira/Confluence", category: "markup" },

    // Programming languages
    css: { prism: "css", display: "CSS", category: "style" },
    javascript: {
      prism: "javascript",
      display: "JavaScript",
      category: "programming",
    },
    typescript: {
      prism: "typescript",
      display: "TypeScript",
      category: "programming",
    },
    python: { prism: "python", display: "Python", category: "programming" },
    java: { prism: "java", display: "Java", category: "programming" },
    c: { prism: "c", display: "C", category: "programming" },
    cpp: { prism: "cpp", display: "C++", category: "programming" },
    csharp: { prism: "csharp", display: "C#", category: "programming" },
    php: { prism: "php", display: "PHP", category: "programming" },
    ruby: { prism: "ruby", display: "Ruby", category: "programming" },
    perl: { prism: "perl", display: "Perl", category: "programming" },
    lua: { prism: "lua", display: "Lua", category: "programming" },
    rust: { prism: "rust", display: "Rust", category: "programming" },
    go: { prism: "go", display: "Go", category: "programming" },
    haskell: { prism: "haskell", display: "Haskell", category: "programming" },
    scala: { prism: "scala", display: "Scala", category: "programming" },
    swift: { prism: "swift", display: "Swift", category: "programming" },
    kotlin: { prism: "kotlin", display: "Kotlin", category: "programming" },
    r: { prism: "r", display: "R", category: "programming" },
    julia: { prism: "julia", display: "Julia", category: "programming" },
    matlab: { prism: "matlab", display: "MATLAB", category: "programming" },
    bash: { prism: "bash", display: "Bash", category: "scripting" },
    powershell: {
      prism: "powershell",
      display: "PowerShell",
      category: "scripting",
    },

    // Data formats
    json: { prism: "json", display: "JSON", category: "data" },
    yaml: { prism: "yaml", display: "YAML", category: "data" },
    csv: { prism: "csv", display: "CSV", category: "data" },
    tsv: { prism: "csv", display: "TSV", category: "data" },
    ipynb: { prism: "json", display: "Jupyter Notebook", category: "data" },

    // Bibliography formats
    bibtex: { prism: "latex", display: "BibTeX", category: "bibliography" },
    biblatex: { prism: "latex", display: "BibLaTeX", category: "bibliography" },
    csljson: { prism: "json", display: "CSL JSON", category: "bibliography" },
    endnotexml: {
      prism: "markup",
      display: "EndNote XML",
      category: "bibliography",
    },
    ris: { prism: "markup", display: "RIS", category: "bibliography" },

    // Document formats
    docx: { prism: "none", display: "Microsoft Word", category: "document" },
    odt: { prism: "none", display: "OpenDocument Text", category: "document" },
    epub: { prism: "none", display: "EPUB", category: "document" },
    fb2: { prism: "markup", display: "FictionBook2", category: "document" },
    rtf: { prism: "none", display: "Rich Text Format", category: "document" },
    man: { prism: "markup", display: "roff man", category: "documentation" },
    mdoc: { prism: "markup", display: "mdoc", category: "documentation" },
    pod: { prism: "markup", display: "Perl POD", category: "documentation" },

    // Specialized formats
    plain: { prism: "none", display: "Plain Text", category: "text" },
    txt: { prism: "none", display: "Plain Text", category: "text" },
    native: {
      prism: "haskell",
      display: "Pandoc Native (Haskell)",
      category: "internal",
    },
    opml: { prism: "markup", display: "OPML", category: "data" },
    typst: { prism: "markup", display: "Typst", category: "markup" },
    bits: { prism: "markup", display: "BITS XML", category: "markup" },
  };

  const LANGUAGE_CATEGORIES = {
    markup: { fallback: "markup", description: "Markup languages" },
    programming: { fallback: "clike", description: "Programming languages" },
    scripting: { fallback: "bash", description: "Scripting languages" },
    data: { fallback: "json", description: "Data formats" },
    style: { fallback: "css", description: "Styling languages" },
    bibliography: { fallback: "latex", description: "Bibliography formats" },
    document: { fallback: "none", description: "Document formats" },
    documentation: { fallback: "markup", description: "Documentation formats" },
    text: { fallback: "none", description: "Plain text" },
    internal: { fallback: "none", description: "Internal formats" },
  };

  // ===========================================================================================
  // TEMPLATE-BASED ASSET GENERATION
  // ===========================================================================================

  /**
   * Get Prism.js CSS using template system
   * @returns {Promise<string>} CSS content
   */
  async function getPrismCSS() {
    try {
      if (!window.TemplateSystem) {
        logWarn("TemplateSystem not available, using fallback CSS");
        return getFallbackPrismCSS();
      }

      // Ensure templates are loaded
      await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();

      // Check if template exists
      if (!window.TemplateSystem.GlobalTemplateCache.hasTemplate("prismCSS")) {
        logWarn("prismCSS template not found, using fallback");
        return getFallbackPrismCSS();
      }

      const template =
        window.TemplateSystem.GlobalTemplateCache.getTemplate("prismCSS");
      logDebug("Loaded Prism CSS template, length:", template.length);
      return template;
    } catch (error) {
      logError("Error loading Prism CSS template:", error);
      return getFallbackPrismCSS();
    }
  }

  /**
   * Get Prism.js JavaScript using template system
   * @returns {Promise<string>} JavaScript content
   */
  async function getPrismJS() {
    try {
      if (!window.TemplateSystem) {
        logWarn("TemplateSystem not available, using fallback JS");
        return getFallbackPrismJS();
      }

      // Ensure templates are loaded
      await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();

      // Check if template exists
      if (!window.TemplateSystem.GlobalTemplateCache.hasTemplate("prismJS")) {
        logWarn("prismJS template not found, using fallback");
        return getFallbackPrismJS();
      }

      const template =
        window.TemplateSystem.GlobalTemplateCache.getTemplate("prismJS");
      logDebug("Loaded Prism JS template, length:", template.length);
      return template;
    } catch (error) {
      logError("Error loading Prism JS template:", error);
      return getFallbackPrismJS();
    }
  }

  /**
   * Fallback CSS for when template system is unavailable
   * @returns {string} Minimal CSS
   */
  function getFallbackPrismCSS() {
    return (
      "/* Fallback Prism CSS */\n" +
      ".source-viewer {\n" +
      "  margin: 2rem 0 1rem 0;\n" +
      "  border: 1px solid var(--border-color);\n" +
      "  border-radius: 6px;\n" +
      "  overflow: hidden;\n" +
      "}\n" +
      "\n" +
      ".source-viewer summary {\n" +
      "  background: var(--surface-color);\n" +
      "  padding: 0.75rem 1rem;\n" +
      "  cursor: pointer;\n" +
      "  font-weight: 500;\n" +
      "  color: var(--body-text);\n" +
      "  user-select: none;\n" +
      "  display: flex;\n" +
      "  align-items: center;\n" +
      "  gap: 0.5rem;\n" +
      "}\n" +
      "\n" +
      ".source-viewer pre {\n" +
      "  margin: 0;\n" +
      "  padding: 1rem;\n" +
      "  background: var(--code-bg);\n" +
      "  color: var(--body-text);\n" +
      "  font-family: monospace;\n" +
      "  font-size: 0.875rem;\n" +
      "  line-height: 1.5;\n" +
      "  overflow-x: auto;\n" +
      "}"
    );
  }

  /**
   * Fallback JavaScript for when template system is unavailable
   * @returns {string} Minimal JS
   */
  function getFallbackPrismJS() {
    return (
      "/* Fallback: Basic syntax highlighting not available */\n" +
      'console.log("Source Viewer: Using fallback mode - syntax highlighting disabled");'
    );
  }

  // ===========================================================================================
  // ENHANCED LANGUAGE DETECTION
  // ===========================================================================================

  /**
   * Enhanced language detection with comprehensive Pandoc → Prism.js mapping
   * @param {string} pandocArgs - Pandoc arguments string
   * @returns {Object} Enhanced language information
   */
  function detectSourceLanguage(pandocArgs) {
    try {
      logDebug("Detecting source language from Pandoc args:", pandocArgs);

      // Default fallback
      const defaultResult = {
        pandocLanguage: "latex",
        prismLanguage: "latex",
        displayName: "LaTeX",
        category: "markup",
        confidence: "default",
      };

      if (!pandocArgs || typeof pandocArgs !== "string") {
        logWarn("No valid Pandoc arguments provided, using default LaTeX");
        return defaultResult;
      }

      // Parse --from parameter with improved regex
      const fromMatch = pandocArgs.match(/--from[=\s]+([^\s]+)/i);
      if (!fromMatch) {
        logDebug("No --from parameter found, using default LaTeX");
        return defaultResult;
      }

      const fromValue = fromMatch[1].toLowerCase().trim();
      logDebug("Found --from parameter:", fromValue);

      // Handle extensions (e.g., latex+fancy_lists+citations)
      const baseFormat = fromValue.split("+")[0];
      const extensions = fromValue.includes("+")
        ? fromValue.split("+").slice(1)
        : [];

      // Look up base format in comprehensive mapping
      let languageInfo = PANDOC_TO_PRISM_MAPPING[baseFormat];

      if (!languageInfo) {
        // Try partial matches for complex format names
        const partialMatch = Object.keys(PANDOC_TO_PRISM_MAPPING).find(
          (key) => baseFormat.includes(key) || key.includes(baseFormat)
        );

        if (partialMatch) {
          languageInfo = PANDOC_TO_PRISM_MAPPING[partialMatch];
          logDebug("Found partial match:", partialMatch);
        }
      }

      if (languageInfo) {
        const result = {
          pandocLanguage: fromValue,
          prismLanguage: languageInfo.prism,
          displayName: languageInfo.display,
          category: languageInfo.category,
          confidence: "direct",
        };

        // Add extension information to display name
        if (extensions.length > 0) {
          result.displayName += " (with " + extensions.join(", ") + ")";
          result.extensions = extensions;
        }

        // Handle fallback if primary language not available
        if (
          languageInfo.fallback &&
          !isPrismLanguageAvailable(languageInfo.prism)
        ) {
          logWarn(
            "Primary language " +
              languageInfo.prism +
              " not available, using fallback: " +
              languageInfo.fallback
          );
          result.prismLanguage = languageInfo.fallback;
          result.confidence = "fallback";
        }

        logInfo("Detected source language:", result);
        return result;
      } else {
        // Unknown format - use intelligent fallback based on common patterns
        const intelligentFallback = getIntelligentFallback(baseFormat);
        logWarn(
          "Unknown source format: " +
            baseFormat +
            ", using intelligent fallback:",
          intelligentFallback
        );

        return {
          pandocLanguage: fromValue,
          prismLanguage: intelligentFallback.prism,
          displayName: intelligentFallback.display,
          category: intelligentFallback.category,
          confidence: "intelligent_fallback",
          extensions: extensions.length > 0 ? extensions : undefined,
        };
      }
    } catch (error) {
      logError("Error detecting source language:", error);
      return {
        pandocLanguage: "latex",
        prismLanguage: "latex",
        displayName: "LaTeX",
        category: "markup",
        confidence: "error_fallback",
      };
    }
  }

  /**
   * Intelligent fallback system for unknown formats
   * @param {string} format - Unknown format string
   * @returns {Object} Fallback language info
   */
  function getIntelligentFallback(format) {
    const patterns = [
      {
        pattern: /^(.*md|.*markdown)$/i,
        result: {
          prism: "markdown",
          display: "Markdown (variant)",
          category: "markup",
        },
      },
      {
        pattern: /^(.*tex|.*latex)$/i,
        result: {
          prism: "latex",
          display: "LaTeX (variant)",
          category: "markup",
        },
      },
      {
        pattern: /^(.*html|.*xml)$/i,
        result: {
          prism: "markup",
          display: "Markup (variant)",
          category: "markup",
        },
      },
      {
        pattern: /^(.*json)$/i,
        result: { prism: "json", display: "JSON (variant)", category: "data" },
      },
      {
        pattern: /^(.*yaml|.*yml)$/i,
        result: { prism: "yaml", display: "YAML (variant)", category: "data" },
      },
      {
        pattern: /^(.*csv|.*tsv)$/i,
        result: { prism: "csv", display: "Tabular data", category: "data" },
      },
      {
        pattern: /^(.*wiki)$/i,
        result: { prism: "markup", display: "Wiki markup", category: "markup" },
      },
      {
        pattern: /^(.*script|.*sh|.*bash)$/i,
        result: { prism: "bash", display: "Script", category: "scripting" },
      },
    ];

    for (const { pattern, result } of patterns) {
      if (pattern.test(format)) {
        return result;
      }
    }

    return {
      prism: "none",
      display: "Unknown format (" + format + ")",
      category: "unknown",
    };
  }

  /**
   * Check if a Prism.js language is available
   * @param {string} language - Prism.js language identifier
   * @returns {boolean} Whether the language is available
   */
  function isPrismLanguageAvailable(language) {
    if (
      typeof window !== "undefined" &&
      window.Prism &&
      window.Prism.languages
    ) {
      return !!window.Prism.languages[language];
    }

    // Fallback: assume common languages are available
    const commonLanguages = [
      "markup",
      "html",
      "xml",
      "css",
      "javascript",
      "json",
      "markdown",
      "latex",
      "tex",
      "python",
      "java",
      "c",
      "cpp",
      "bash",
      "yaml",
      "csv",
      "rest",
      "none",
    ];

    return commonLanguages.includes(language);
  }

  // ===========================================================================================
  // SOURCE VIEWER GENERATION
  // ===========================================================================================

  /**
   * Generate enhanced footer with embedded source viewer and credits
   * @param {string} originalSource - Original source content
   * @param {string} pandocArgs - Pandoc arguments for language detection
   * @param {Object} metadata - Document metadata
   * @returns {Promise<string>} HTML footer with source viewer and credits
   */
  async function generateEnhancedFooter(
    originalSource,
    pandocArgs,
    metadata = {}
  ) {
    try {
      logInfo("Generating enhanced footer with source viewer and credits");

      // Generate current timestamp in ISO format
      const generationDate = new Date().toISOString().split("T")[0];

      // Detect source language
      const language = detectSourceLanguage(pandocArgs);

      // Clean and escape source content
      const cleanSource = originalSource
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .trim();

      // Generate unique IDs for accessibility
      const viewerId = `source-viewer-${Date.now()}`;
      const summaryId = `${viewerId}-summary`;
      const contentId = `${viewerId}-content`;

      // Generate credits section using template system
      let creditsHTML = "";
      try {
        if (window.TemplateSystem) {
          await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();

          if (
            window.TemplateSystem.GlobalTemplateCache.hasTemplate(
              "creditsAcknowledgements"
            )
          ) {
            const creditsData = {
              customCredits: metadata.customCredits || [],
            };

            // Create a temporary template generator
            const generator = new window.TemplateSystem.EnhancedHTMLGenerator();
            await generator.engine.initializeFromGlobalCache();

            creditsHTML = generator.renderTemplate(
              "creditsAcknowledgements",
              creditsData
            );
            logDebug("Generated credits section using template");
          } else {
            logWarn("Credits template not found, using fallback");
            creditsHTML = generateFallbackCredits();
          }
        } else {
          logWarn("TemplateSystem not available, using fallback credits");
          creditsHTML = generateFallbackCredits();
        }
      } catch (error) {
        logError("Error generating credits section:", error);
        creditsHTML = generateFallbackCredits();
      }

      // Build footer HTML
      const footerParts = [
        '<footer class="document-footer" role="contentinfo">',
        "    <p>",
        `        Generated on <time datetime="${generationDate}">${generationDate}</time>`,
        `        from a ${language.displayName} source.`,
        "    </p>",
        "    ",
        `    <details class="source-viewer" id="${viewerId}">`,
        "        <summary",
        `            id="${summaryId}"`,
        `            aria-controls="${contentId}"`,
        '            aria-expanded="false"',
        '            role="button"',
        '            tabindex="0">',
        '            <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21" aria-hidden="true"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 3)"><line x1="10.5" x2="6.5" y1=".5" y2="14.5"/><polyline points="7.328 2.672 7.328 8.328 1.672 8.328" transform="rotate(135 4.5 5.5)"/><polyline points="15.328 6.672 15.328 12.328 9.672 12.328" transform="scale(1 -1) rotate(-45 -10.435 0)"/></g></svg>',
        "            View source file",
        `            <span class="source-viewer-indicator">(${
          language.displayName
        }${language.confidence === "fallback" ? " - fallback" : ""})</span>`,
        "        </summary>",
        "        ",
        `        <div id="${contentId}" role="region" aria-labelledby="${summaryId}">`,
        `            <pre><code class="language-${language.prismLanguage}">${cleanSource}</code></pre>`,
        "        </div>",
        "    </details>",
        "    ",
        "    " + creditsHTML,
        "</footer>",
      ];

      const footerHTML = footerParts.join("\n");
      logDebug(
        "Generated footer HTML with credits:",
        footerHTML.length,
        "characters"
      );
      return footerHTML;
    } catch (error) {
      logError("Error generating enhanced footer:", error);

      // Fallback to basic footer
      const generationDate = new Date().toISOString().split("T")[0];
      return `<footer class="document-footer" role="contentinfo">
    <p>Generated on <time datetime="${generationDate}">${generationDate}</time> using Pandoc-WASM and MathJax.</p>
    <p><em>Source viewing and credits temporarily unavailable</em></p>
</footer>`;
    }
  }

  /**
   * Generate fallback credits when template system is unavailable
   * @returns {string} Basic credits HTML
   */
  function generateFallbackCredits() {
    return `<section class="credits-acknowledgements" aria-labelledby="credits-heading">
    <h3 id="credits-heading">Credits and Acknowledgements</h3>
    <ul class="credits-list">
        <li><strong>Document Processing:</strong> <a href="https://pandoc.org/" target="_blank" rel="noopener">Pandoc</a></li>
        <li><strong>Mathematical Rendering:</strong> <a href="https://www.mathjax.org/" target="_blank" rel="noopener">MathJax</a></li>
        <li><strong>Syntax Highlighting:</strong> <a href="https://prismjs.com/" target="_blank" rel="noopener">Prism.js</a></li>
        <li><strong>Accessibility:</strong> <a href="https://www.w3.org/WAI/WCAG22/quickref/" target="_blank" rel="noopener">WCAG 2.2 AA</a></li>
    </ul>
</section>`;
  }

  /**
   * Generate complete embedded assets for source viewing
   * @returns {Promise<Object>} CSS and JS content for embedding
   */
  async function generateEmbeddedAssets() {
    try {
      const css = await getPrismCSS();
      const js = await getPrismJS();
      return { css: css, js: js };
    } catch (error) {
      logError("Error generating embedded assets:", error);
      return {
        css: getFallbackPrismCSS(),
        js: getFallbackPrismJS(),
      };
    }
  }

  // ===========================================================================================
  // ACCESSIBILITY ENHANCEMENTS
  // ===========================================================================================

  /**
   * Add enhanced accessibility features to source viewer
   */
  function enhanceAccessibility() {
    try {
      const sourceViewers = document.querySelectorAll(".source-viewer");

      sourceViewers.forEach(function (viewer) {
        const summary = viewer.querySelector("summary");
        const content = viewer.querySelector('[role="region"]');

        if (!summary || !content) return;

        // Enhanced keyboard interaction
        summary.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            viewer.open = !viewer.open;
            summary.setAttribute("aria-expanded", viewer.open.toString());

            const message = viewer.open
              ? "Source code expanded. Use arrow keys to navigate content."
              : "Source code collapsed.";

            announceToScreenReader(message);
          }
        });

        // Update ARIA attributes when toggled by mouse
        viewer.addEventListener("toggle", function () {
          summary.setAttribute("aria-expanded", viewer.open.toString());

          if (viewer.open) {
            setTimeout(function () {
              const codeElement = content.querySelector("code");
              if (codeElement) {
                codeElement.setAttribute("tabindex", "0");
                codeElement.focus();
              }
            }, 100);
          }
        });
      });

      logDebug(
        "Enhanced accessibility for",
        sourceViewers.length,
        "source viewers"
      );
    } catch (error) {
      logError("Error enhancing source viewer accessibility:", error);
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    try {
      const announcement = document.createElement("div");
      announcement.setAttribute("aria-live", "polite");
      announcement.setAttribute("aria-atomic", "true");
      announcement.className = "sr-only";
      announcement.style.cssText =
        "position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;";
      announcement.textContent = message;

      document.body.appendChild(announcement);

      setTimeout(function () {
        if (document.body.contains(announcement)) {
          document.body.removeChild(announcement);
        }
      }, 2000);
    } catch (error) {
      logError("Error announcing to screen reader:", error);
    }
  }

  // ===========================================================================================
  // TESTING FUNCTIONALITY
  // ===========================================================================================

  /**
   * Test source viewer functionality
   * @returns {Object} Test results
   */
  function testSourceViewer() {
    logInfo("Testing source viewer functionality...");

    try {
      const tests = {
        languageDetection: function () {
          const testCases = [
            { args: "--from latex --to html5", expected: "latex" },
            { args: "--from markdown --to html5", expected: "markdown" },
            { args: "--from gfm --to html5", expected: "markdown" },
            { args: "--from latex+fancy_lists --to html5", expected: "latex" },
            { args: "--to html5", expected: "latex" },
            { args: "", expected: "latex" },
          ];

          return testCases.every(function (test) {
            const result = detectSourceLanguage(test.args);
            const passed = result.prismLanguage === test.expected;
            if (!passed) {
              logError(
                'Language detection failed for "' +
                  test.args +
                  '": expected ' +
                  test.expected +
                  ", got " +
                  result.prismLanguage
              );
            }
            return passed;
          });
        },

        footerGeneration: async function () {
          const testSource =
            "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}";
          const testArgs = "--from latex --to html5 --mathjax";
          const footer = await generateEnhancedFooter(testSource, testArgs);

          return (
            typeof footer === "string" &&
            footer.includes("<footer") &&
            footer.includes("source-viewer") &&
            footer.includes("View source file") &&
            footer.includes("language-latex") &&
            footer.includes(new Date().toISOString().split("T")[0])
          );
        },

        templateSystemIntegration: function () {
          return (
            typeof window.TemplateSystem !== "undefined" &&
            typeof window.TemplateSystem.GlobalTemplateCache !== "undefined"
          );
        },

        escaping: async function () {
          const testSource = "<script>alert('test')</script>";
          const footer = await generateEnhancedFooter(
            testSource,
            "--from latex"
          );
          return (
            typeof footer === "string" &&
            footer.includes("&lt;script&gt;") &&
            !footer.includes("<script>alert")
          );
        },

        accessibilityFeatures: async function () {
          const footer = await generateEnhancedFooter(
            "Test source",
            "--from latex"
          );
          return (
            typeof footer === "string" &&
            footer.includes('role="contentinfo"') &&
            footer.includes("aria-controls=") &&
            footer.includes("aria-expanded=") &&
            footer.includes('role="button"') &&
            footer.includes('role="region"') &&
            footer.includes("aria-labelledby=") &&
            footer.includes('tabindex="0"')
          );
        },
      };

      const results = {
        passed: 0,
        total: Object.keys(tests).length,
        details: {},
      };

      for (const testName in tests) {
        if (tests.hasOwnProperty(testName)) {
          try {
            const testFunc = tests[testName];
            const passed = testFunc();
            results.details[testName] = passed;
            if (passed) results.passed++;
            logDebug(
              "Test " + testName + ": " + (passed ? "PASSED" : "FAILED")
            );
          } catch (error) {
            logError("Test " + testName + " threw error:", error);
            results.details[testName] = false;
          }
        }
      }

      const success = results.passed === results.total;
      logInfo(
        "Source viewer tests: " +
          results.passed +
          "/" +
          results.total +
          " passed (" +
          (success ? "SUCCESS" : "FAILED") +
          ")"
      );

      return {
        success: success,
        passed: results.passed,
        total: results.total,
        details: results.details,
      };
    } catch (error) {
      logError("Source viewer testing failed:", error);
      return {
        success: false,
        error: error.message,
        passed: 0,
        total: 0,
        details: {},
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functionality
    generateEnhancedFooter: generateEnhancedFooter,
    detectSourceLanguage: detectSourceLanguage,
    generateEmbeddedAssets: generateEmbeddedAssets,

    // Accessibility
    enhanceAccessibility: enhanceAccessibility,
    announceToScreenReader: announceToScreenReader,

    // Assets (async now)
    getPrismCSS: getPrismCSS,
    getPrismJS: getPrismJS,

    // Testing
    testSourceViewer: testSourceViewer,

    // Language mapping access
    PANDOC_TO_PRISM_MAPPING: PANDOC_TO_PRISM_MAPPING,
    LANGUAGE_CATEGORIES: LANGUAGE_CATEGORIES,
    getIntelligentFallback: getIntelligentFallback,
    isPrismLanguageAvailable: isPrismLanguageAvailable,

    // Logging
    logError: logError,
    logWarn: logWarn,
    logInfo: logInfo,
    logDebug: logDebug,
  };
})();

// Make globally available for other modules
window.SourceViewer = SourceViewer;
