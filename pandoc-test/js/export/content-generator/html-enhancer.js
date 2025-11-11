// html-enhancer.js
// HTML/JavaScript Template Loading and Document Enhancement Module
// Loads HTML and JavaScript templates from external files

const HTMLEnhancer = (function () {
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
      console.error("[HTML-ENHANCER]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[HTML-ENHANCER]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[HTML-ENHANCER]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[HTML-ENHANCER]", message, ...args);
  }

  // ===========================================================================================
  // TEMPLATE CACHE
  // ===========================================================================================

  const templateCache = new Map();
  let cacheLoaded = false;

  /**
   * HTML/JS template file mappings
   */
  const HTML_TEMPLATES = {
    structure: [
      "structure/document-wrapper-start.html",
      "structure/document-wrapper-end.html",
      "structure/distraction-free-controls.html",
      "structure/theorem-wrapper.html",
      "structure/section-anchor.html",
    ],
    scripts: [
      "js/distraction-free-manager.js",
      "js/table-accessibility-enhancement.js",
    ],
  };

  // ===========================================================================================
  // TEMPLATE LOADING
  // ===========================================================================================

  /**
   * Load a single template file
   * @param {string} filePath - Path to template file relative to templates/
   * @returns {Promise<string>} Template content
   */
  async function loadTemplateFile(filePath) {
    // Check cache first
    if (templateCache.has(filePath)) {
      logDebug(`Using cached template: ${filePath}`);
      return templateCache.get(filePath);
    }

    try {
      logDebug(`Loading template: ${filePath}`);
      const response = await fetch(`templates/${filePath}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const template = await response.text();

      // Cache the result
      templateCache.set(filePath, template);
      logDebug(
        `✅ Loaded and cached: ${filePath} (${template.length} characters)`
      );

      return template;
    } catch (error) {
      logError(`Failed to load template: ${filePath}`, error);
      throw new Error(
        `Template loading failed: ${filePath} - ${error.message}`
      );
    }
  }

  /**
   * Load multiple template files
   * @param {string[]} filePaths - Array of template file paths
   * @returns {Promise<string[]>} Array of template content
   */
  async function loadMultipleTemplates(filePaths) {
    logInfo(`Loading ${filePaths.length} templates...`);

    const loadPromises = filePaths.map((path) => loadTemplateFile(path));
    const results = await Promise.all(loadPromises);

    logInfo(`✅ Loaded ${results.length} templates successfully`);
    return results;
  }

  /**
   * Preload all templates into cache
   * @returns {Promise<Object>} Loading results
   */
  async function preloadAllTemplates() {
    if (cacheLoaded) {
      logInfo("Templates already preloaded");
      return { success: true, cached: true };
    }

    logInfo("Preloading all HTML/JS templates...");

    const allFiles = [...HTML_TEMPLATES.structure, ...HTML_TEMPLATES.scripts];

    try {
      await loadMultipleTemplates(allFiles);
      cacheLoaded = true;
      logInfo(`✅ Preloaded ${allFiles.length} templates`);
      return { success: true, count: allFiles.length };
    } catch (error) {
      logError("Failed to preload templates:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // UTILITY FUNCTIONS
  // ===========================================================================================

  /**
   * HTML escaping for security and proper display
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  function escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ===========================================================================================
  // DOCUMENT ENHANCEMENT FUNCTIONS
  // ===========================================================================================

  /**
   * Generate distraction-free controls HTML
   * @param {Object} metadata - Document metadata
   * @returns {Promise<string>} Distraction-free controls HTML
   */
  async function generateDistractionFreeControls(metadata = {}) {
    logInfo(
      "Generating distraction-free controls HTML for neurodivergent users"
    );

    try {
      // Load the template
      const template = await loadTemplateFile(
        "structure/distraction-free-controls.html"
      );

      // Determine if TOC button should be shown
      const hasTOC = metadata.sections && metadata.sections.length > 0;

      logDebug(
        `Generating distraction-free controls: hasTOC=${hasTOC}, sections=${
          metadata.sections ? metadata.sections.length : 0
        }`
      );

// If no TOC, remove the TOC button from template
      if (!hasTOC) {
        logDebug("No TOC detected - attempting to remove TOC button from template");
        
        // Remove everything from "<!-- TOC Toggle Button" to the end of toc-help div
        const tocButtonStart = template.indexOf('<!-- TOC Toggle Button');
        
        if (tocButtonStart !== -1) {
          // Find the toc-help div closing tag
          const tocHelpStart = template.indexOf('<div id="toc-help"', tocButtonStart);
          if (tocHelpStart !== -1) {
            const tocHelpEnd = template.indexOf('</div>', tocHelpStart) + 6;
            
            // Remove the entire TOC section (button + help text + trailing whitespace)
            const beforeTOC = template.substring(0, tocButtonStart).trimEnd();
            const afterTOC = template.substring(tocHelpEnd).trimStart();
            
            const modifiedTemplate = beforeTOC + '\n    \n    ' + afterTOC;
            logDebug("✅ Successfully removed TOC button from template");
            return modifiedTemplate;
          }
        }
        
        // If removal fails, log warning but still return template without TOC button
        // This is a fallback - better to show the button than fail entirely
        logWarn("⚠️ Failed to remove TOC button from template - returning unmodified template");
        logWarn(`Debug info: tocButtonStart=${tocButtonStart !== -1 ? 'found' : 'NOT FOUND'}`);
      } else {
        logDebug("TOC detected - keeping TOC button in template");
      }

      return template;
    } catch (error) {
      logError("Failed to generate distraction-free controls:", error);
      // Return empty string on error
      return "";
    }
  }

  /**
   * Enhance document structure with Holy Grail layout
   * @param {string} content - Document content
   * @param {Object} metadata - Document metadata
   * @returns {Promise<string>} Enhanced document structure
   */
async function enhanceDocumentStructure(content, metadata) {
    logInfo("Enhancing document structure with improved layout");

    try {
      // Load all required templates
      const [
        wrapperStart,
        wrapperEnd,
        distractionFreeScript,
        tableAccessibilityScript,
      ] = await Promise.all([
        loadTemplateFile("structure/document-wrapper-start.html"),
        loadTemplateFile("structure/document-wrapper-end.html"),
        loadTemplateFile("js/distraction-free-manager.js"),
        loadTemplateFile("js/table-accessibility-enhancement.js"),
      ]);

      let enhancedContent = content;

      // Build the complete structure
      let structure = wrapperStart;

      // Generate and insert table of contents if sections exist
      let tocHTML = "";
      if (metadata && metadata.sections && metadata.sections.length > 0) {
        logInfo(`Generating ToC for ${metadata.sections.length} sections`);
        if (window.ContentGenerator && window.ContentGenerator.generateTableOfContentsWithId) {
          tocHTML = window.ContentGenerator.generateTableOfContentsWithId(metadata.sections);
          logInfo("✅ ToC generated successfully");
        } else {
          logWarn("ContentGenerator.generateTableOfContentsWithId not available");
        }
      } else {
        logInfo("No sections found - skipping ToC generation");
      }

      // Replace TOC placeholder with actual ToC (or empty string if no ToC)
      structure = structure.replace("TOC_PLACEHOLDER", tocHTML);

      // Add distraction-free controls
      const controls = await generateDistractionFreeControls(metadata);
      structure += controls + "\n";

      // Add enhanced content (will be processed by other functions)
      structure += enhancedContent + "\n";

      // Close wrapper
      structure += wrapperEnd + "\n";

      // Add scripts
      structure += "<script>\n";
      structure += tableAccessibilityScript + "\n\n";
      structure += distractionFreeScript + "\n";
      structure += "</script>";

      logInfo(
        "Document structure enhancement complete with improved layout and table accessibility"
      );
      return structure;
    } catch (error) {
      logError("Error enhancing document structure:", error);
      return content;
    }
  }

  /**
   * Enhance theorem environments with proper semantic structure
   * @param {string} content - Document content
   * @returns {Promise<string>} Content with enhanced theorem environments
   */
  async function enhanceTheoremEnvironments(content) {
    try {
      // Skip if already processed
      if (
        content.includes('role="region"') &&
        content.includes("aria-labelledby")
      ) {
        logDebug("Theorem environments already enhanced, skipping");
        return content;
      }

      // Load the theorem wrapper template
      const template = await loadTemplateFile("structure/theorem-wrapper.html");

      const theoremPatterns = [
        { name: "theorem", class: "theorem" },
        { name: "definition", class: "definition" },
        { name: "lemma", class: "lemma" },
        { name: "corollary", class: "corollary" },
        { name: "proposition", class: "proposition" },
        { name: "example", class: "example" },
        { name: "proof", class: "proof" },
      ];

      let enhancedContent = content;

      theoremPatterns.forEach((pattern) => {
        const regex = new RegExp(
          "<p[^>]*>\\s*<strong>\\s*(" +
            pattern.name +
            "\\s+[^<]*?)\\s*</strong>(.*?)</p>",
          "gis"
        );

        enhancedContent = enhancedContent.replace(
          regex,
          (match, fullTitle, body) => {
            logDebug(
              `Processing ${
                pattern.name
              }: "${fullTitle}" with body: "${body.substring(0, 50)}..."`
            );

            // Use template and replace placeholders
            return template
              .replace(/THEOREM_CLASS/g, pattern.class)
              .replace(/THEOREM_ID/g, pattern.name + "-title")
              .replace(/THEOREM_TITLE/g, fullTitle.trim())
              .replace(/THEOREM_BODY/g, body);
          }
        );
      });

      logDebug("Theorem environments enhancement complete");
      return enhancedContent;
    } catch (error) {
      logError("Error enhancing theorem environments:", error);
      return content;
    }
  }

  /**
   * Add navigation anchors to sections
   * @param {string} content - Document content
   * @param {Array} sections - Section metadata
   * @returns {Promise<string>} Content with section anchors
   */
  async function addSectionAnchors(content, sections) {
    try {
      if (!sections) return content;

      let enhancedContent = content;

      sections.forEach((section) => {
        const sectionRegex = new RegExp(
          "(<h" + section.level + "[^>]*>)(.*?)(</h" + section.level + ">)",
          "gi"
        );
        enhancedContent = enhancedContent.replace(
          sectionRegex,
          (match, openTag, title, closeTag) => {
            if (!openTag.includes("id=")) {
              return (
                openTag.slice(0, -1) +
                ' id="' +
                section.id +
                '">' +
                title +
                closeTag
              );
            }
            return match;
          }
        );
      });

      return enhancedContent;
    } catch (error) {
      logError("Error adding section anchors:", error);
      return content;
    }
  }

  // ===========================================================================================
  // INITIALIZATION
  // ===========================================================================================

  logInfo("HTMLEnhancer module initialised");

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Template loading
    loadTemplateFile,
    loadMultipleTemplates,
    preloadAllTemplates,

    // Document enhancement functions
    generateDistractionFreeControls,
    enhanceDocumentStructure,
    enhanceTheoremEnvironments,
    addSectionAnchors,

    // Utilities
    escapeHtml,

    // Cache management
    getCacheStatus: () => ({
      loaded: cacheLoaded,
      size: templateCache.size,
      files: Array.from(templateCache.keys()),
    }),

    clearCache: () => {
      templateCache.clear();
      cacheLoaded = false;
      logInfo("Template cache cleared");
    },

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.HTMLEnhancer = HTMLEnhancer;
