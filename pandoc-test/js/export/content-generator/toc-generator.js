// toc-generator.js
// Table of Contents Generation Module
// Generates accessible, navigable table of contents for documents

const TOCGenerator = (function () {
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
      console.error("[TOC-GENERATOR]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TOC-GENERATOR]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TOC-GENERATOR]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TOC-GENERATOR]", message, ...args);
  }

  // ===========================================================================================
  // HELPER FUNCTIONS
  // ===========================================================================================

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Build nested TOC structure with proper ul/li hierarchy
   * @param {Array} sections - Section metadata array
   * @param {string} baseIndent - Base indentation string
   * @returns {string} Nested TOC HTML
   */
  function buildNestedTOC(sections, baseIndent) {
    if (!sections.length) return "";

    let html = "";
    let currentLevel = 0;
    let openLists = [];

    sections.forEach((section, index) => {
      const level = section.level;

      // Close lists if we're going to a higher level (less nested)
      while (currentLevel > level) {
        const indent = baseIndent + "    ".repeat(openLists.length - 1);
        html += "\n" + indent + "</ul>";
        html += "\n" + indent.slice(4) + "</li>";
        openLists.pop();
        currentLevel--;
      }

      // Open new lists if we're going to a lower level (more nested)
      while (currentLevel < level) {
        const indent = baseIndent + "    ".repeat(openLists.length);
        if (openLists.length === 0) {
          // First level - just open ul
          html += "\n" + indent + "<ul>";
        } else {
          // Nested level - open ul inside current li
          html += "\n" + indent + "<ul>";
        }
        openLists.push(level);
        currentLevel++;
      }

      // Add the list item
      const indent = baseIndent + "    ".repeat(openLists.length);

      // Transform section ID to match Pandoc's new format
      // Remove leading digits and hyphen, then add "content-" prefix
      // Example: "1-introduction" → "content-introduction"
      let tocHref = section.id;

      // Safety check: if section.id is undefined, generate from title
      if (!tocHref || typeof tocHref !== "string") {
        logWarn(
          `Section missing ID, generating from title: "${section.title}"`
        );
        tocHref = section.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
      }

      if (tocHref.match(/^\d+-/)) {
        // Remove leading number and hyphen
        tocHref = tocHref.replace(/^\d+-/, "");
      }
      // Add content- prefix if not already present
      if (!tocHref.startsWith("content-")) {
        tocHref = "content-" + tocHref;
      }

      html +=
        "\n" +
        indent +
        `<li><a href="#${tocHref}">${escapeHtml(section.title)}</a>`;

      // Check if next section is at a deeper level
      const nextSection = sections[index + 1];
      if (!nextSection || nextSection.level <= level) {
        html += "</li>";
      }
    });

    // Close all remaining open lists
    while (openLists.length > 0) {
      const indent = baseIndent + "    ".repeat(openLists.length - 1);
      html += "\n" + indent + "</ul>";
      if (openLists.length > 1) {
        html += "\n" + indent.slice(4) + "</li>";
      }
      openLists.pop();
    }

    return html;
  }

  // ===========================================================================================
  // TOC GENERATION FUNCTIONS
  // ===========================================================================================

  /**
   * Generate table of contents with proper nested structure
   * @param {Array} sections - Section metadata array
   * @returns {string} TOC HTML
   */
  function generateTableOfContents(sections) {
    if (!sections || sections.length === 0) {
      return "";
    }

    try {
      logInfo(`Generating TOC for ${sections.length} sections`);

      let tocHTML =
        '\n        <nav class="table-of-contents" aria-label="Table of contents" tabindex="0">\n';

      // Build nested structure - heading now provided by CSS
      tocHTML += buildNestedTOC(sections, "            ");

      tocHTML += "\n        </nav>";

      logInfo("✅ Table of contents generated successfully");
      return tocHTML;
    } catch (error) {
      logError("Error generating table of contents:", error);
      return "";
    }
  }

  /**
   * Generate table of contents with ID attribute and proper nesting
   * @param {Array} sections - Section metadata array
   * @returns {string} TOC HTML with id="toc"
   */
  function generateTableOfContentsWithId(sections) {
    if (!sections || sections.length === 0) {
      return "";
    }

    try {
      logInfo(`Generating TOC with ID for ${sections.length} sections`);

      let tocHTML =
        '\n        <nav id="toc" class="table-of-contents" aria-label="Table of contents" tabindex="0">\n';

      // Build nested structure - heading now provided by CSS
      tocHTML += buildNestedTOC(sections, "            ");

      tocHTML += "\n        </nav>";

      logInfo("✅ Table of contents with ID generated successfully");
      return tocHTML;
    } catch (error) {
      logError("Error generating table of contents with ID:", error);
      return "";
    }
  }

  // ===========================================================================================
  // INITIALIZATION
  // ===========================================================================================

  logInfo("TOCGenerator module initialised");

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // TOC generation functions
    generateTableOfContents,
    generateTableOfContentsWithId,

    // Logging (for debugging)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.TOCGenerator = TOCGenerator;
