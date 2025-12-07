// tikz-preservation-manager.js
// TikZ Preservation Manager - Extract and preserve TikZ content for future rendering
// Part of Enhanced Pandoc-WASM Mathematical Playground
// Future-proof: Preserves TikZ for when rendering feature is added

const TikzPreservationManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
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
      console.error("[TIKZ-PRESERVE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TIKZ-PRESERVE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TIKZ-PRESERVE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TIKZ-PRESERVE]", message, ...args);
  }

  // ===========================================================================================
  // TIKZ REGISTRY
  // ===========================================================================================

  /**
   * Global TikZ registry - stores extracted TikZ blocks for later use
   * Structure: {
   *   id: {
   *     content: "\\begin{tikzpicture}...\\end{tikzpicture}",
   *     position: number,
   *     context: "figure" | "inline",
   *     metadata: { caption, label, etc }
   *   }
   * }
   */
  let tikzRegistry = {};
  let tikzCounter = 0;

  /**
   * Clear the TikZ registry (called at start of new conversion)
   */
  function clearRegistry() {
    tikzRegistry = {};
    tikzCounter = 0;
    logDebug("TikZ registry cleared");
  }

  /**
   * Get the current TikZ registry
   * @returns {Object} Current registry
   */
  function getRegistry() {
    return tikzRegistry;
  }

  /**
   * Get statistics about preserved TikZ content
   * @returns {Object} Statistics
   */
  function getStatistics() {
    const entries = Object.values(tikzRegistry);
    return {
      total: entries.length,
      inFigures: entries.filter((e) => e.context === "figure").length,
      inline: entries.filter((e) => e.context === "inline").length,
      totalCharacters: entries.reduce((sum, e) => sum + e.content.length, 0),
    };
  }

  // ===========================================================================================
  // EXTRACTION AND PRESERVATION
  // ===========================================================================================

  /**
   * Extract TikZ blocks from LaTeX source and replace with placeholders
   * This prevents TikZ math (axis labels, etc.) from interfering with document math
   *
   * @param {string} latexSource - Original LaTeX source
   * @returns {Object} { processed: string, extracted: number, registry: Object }
   */
  function extractAndPreserveTikz(latexSource) {
    logInfo("🎨 Extracting TikZ blocks from source...");

    if (!latexSource || typeof latexSource !== "string") {
      logWarn("No valid LaTeX source provided for TikZ extraction");
      return { processed: latexSource, extracted: 0, registry: {} };
    }

    // Clear registry for fresh start
    clearRegistry();

    let processed = latexSource;
    let extractedCount = 0;

    // Pattern to match TikZ picture environments
    // Handles both simple and complex TikZ blocks
    const tikzPattern = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;

    // Find all TikZ blocks
    const matches = latexSource.match(tikzPattern);

    if (!matches || matches.length === 0) {
      logInfo("No TikZ blocks found in source");
      return { processed: latexSource, extracted: 0, registry: {} };
    }

    logInfo(`Found ${matches.length} TikZ block(s)`);

    // Extract each TikZ block
    matches.forEach((tikzContent, index) => {
      const tikzId = `tikz-${++tikzCounter}-${Date.now()}`;
      const position = latexSource.indexOf(tikzContent);

      // Determine context (is it in a figure environment?)
      // Count matched pairs to handle multiple figures correctly
      const beforeContent = latexSource.substring(0, position);
      const afterContent = latexSource.substring(position + tikzContent.length);

      // Count figure begin/end pairs before this TikZ
      const beginCount = (beforeContent.match(/\\begin\{figure\}/g) || [])
        .length;
      const endCount = (beforeContent.match(/\\end\{figure\}/g) || []).length;

      // If more begins than ends, we're inside an unclosed figure
      const inFigure =
        beginCount > endCount && afterContent.includes("\\end{figure}");

      // Extract metadata if in figure
      let metadata = {};
      if (inFigure) {
        // Try to extract caption
        const captionMatch = afterContent.match(/\\caption\{([^}]*)\}/);
        if (captionMatch) {
          metadata.caption = captionMatch[1];
        }

        // Try to extract label
        const labelMatch = afterContent.match(/\\label\{([^}]*)\}/);
        if (labelMatch) {
          metadata.label = labelMatch[1];
        }
      }

      // Store in registry
      tikzRegistry[tikzId] = {
        content: tikzContent,
        position: position,
        context: inFigure ? "figure" : "inline",
        metadata: metadata,
      };

      // Create simple text marker that survives Pandoc without escaping
      // We'll replace these with proper HTML after Pandoc processes the document
      const placeholder = `[[TIKZ_PLACEHOLDER_${tikzId}]]`;
      processed = processed.replace(tikzContent, placeholder);
      extractedCount++;

      logDebug(
        `Extracted TikZ block ${tikzId}: ${tikzContent.substring(0, 50)}... (${
          inFigure ? "in figure" : "inline"
        })`
      );
    });

    const stats = getStatistics();
    logInfo(`✅ Extracted ${extractedCount} TikZ block(s)`);
    logInfo(`   - In figures: ${stats.inFigures}`);
    logInfo(`   - Inline: ${stats.inline}`);
    logInfo(`   - Total characters preserved: ${stats.totalCharacters}`);

    return {
      processed: processed,
      extracted: extractedCount,
      registry: tikzRegistry,
      statistics: stats,
    };
  }

  /**
   * Mark TikZ placeholders in rendered HTML for export skipping
   * This ensures TikZ math doesn't interfere with export processing
   *
   * @param {HTMLElement|Document} doc - DOM to mark
   * @returns {number} Number of placeholders marked
   */
  function markTikzPlaceholdersInDOM(doc) {
    logDebug("Marking TikZ placeholders in DOM...");

    const placeholders = doc.querySelectorAll("[data-tikz-id]");
    let markedCount = 0;

    placeholders.forEach((placeholder) => {
      const tikzId = placeholder.getAttribute("data-tikz-id");

      // Add additional marker for export processor
      placeholder.setAttribute("data-skip-latex-export", "true");
      placeholder.setAttribute("data-skip-reason", "tikz-content");

      // Mark any math elements inside as TikZ math (shouldn't exist but be safe)
      const mathElements = placeholder.querySelectorAll(
        "mjx-container, span.math"
      );
      mathElements.forEach((mathEl) => {
        mathEl.setAttribute("data-tikz-math", "true");
        mathEl.setAttribute("data-skip-latex-export", "true");
      });

      markedCount++;
      logDebug(`Marked TikZ placeholder: ${tikzId}`);
    });

    if (markedCount > 0) {
      logInfo(
        `✅ Marked ${markedCount} TikZ placeholder(s) for export skipping`
      );
    }

    return markedCount;
  }

  // ===========================================================================================
  // FUTURE: TIKZ RENDERING SUPPORT
  // ===========================================================================================

  /**
   * FUTURE: Render TikZ blocks when rendering feature is added
   * Currently returns placeholder, but infrastructure is ready for actual rendering
   *
   * @param {string} tikzId - TikZ block ID
   * @returns {string} Rendered HTML (currently placeholder)
   */
  function renderTikzBlock(tikzId) {
    const tikzData = tikzRegistry[tikzId];

    if (!tikzData) {
      logError(`TikZ block not found in registry: ${tikzId}`);
      return '<p class="error">TikZ content not found</p>';
    }

    logInfo(`FUTURE: Would render TikZ block ${tikzId}`);
    logDebug(`Content: ${tikzData.content.substring(0, 100)}...`);

    // FUTURE: When TikZ rendering is implemented, this will:
    // 1. Extract TikZ content from registry
    // 2. Use TikZ-to-SVG converter (tikzjax, server-side render, etc.)
    // 3. Return rendered SVG/image
    // 4. Include accessibility metadata (alt text from caption)

    // For now, return informative placeholder
    const caption = tikzData.metadata.caption || "TikZ graphic";
    return `
      <div class="tikz-render-placeholder" data-tikz-id="${tikzId}">
        <p class="info">
          📊 TikZ content preserved for future rendering
          ${tikzData.context === "figure" ? `<br>Caption: ${caption}` : ""}
        </p>
        <details>
          <summary>View TikZ source</summary>
          <pre><code class="language-latex">${escapeHtml(
            tikzData.content
          )}</code></pre>
        </details>
      </div>
    `;
  }

  /**
   * FUTURE: Render all TikZ blocks in a document
   * @param {HTMLElement} container - Container to render into
   * @returns {number} Number of blocks rendered
   */
  function renderAllTikzBlocks(container) {
    if (!container) {
      logError("No container provided for TikZ rendering");
      return 0;
    }

    const placeholders = container.querySelectorAll("[data-tikz-id]");
    let renderedCount = 0;

    placeholders.forEach((placeholder) => {
      const tikzId = placeholder.getAttribute("data-tikz-id");
      const rendered = renderTikzBlock(tikzId);
      placeholder.outerHTML = rendered;
      renderedCount++;
    });

    logInfo(`Rendered ${renderedCount} TikZ block(s) (placeholder mode)`);
    return renderedCount;
  }

  // ===========================================================================================
  // UTILITIES
  // ===========================================================================================

  /**
   * Escape HTML for safe display
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if content contains TikZ blocks
   * @param {string} content - Content to check
   * @returns {boolean} True if TikZ found
   */
  function hasTikzContent(content) {
    if (!content || typeof content !== "string") return false;
    return /\\begin\{tikzpicture\}/i.test(content);
  }

  // ===========================================================================================
  // TESTING
  // ===========================================================================================

  /**
   * Test TikZ preservation system
   */
  function testTikzPreservation() {
    console.log("\n=== Testing TikZ Preservation Manager ===\n");

    const testCases = [
      {
        name: "Simple TikZ block",
        input: `Some math $x^2$
\\begin{tikzpicture}
  \\draw (0,0) -- (1,1);
  \\node at (0.5,0.5) {$f(x)$};
\\end{tikzpicture}
More math $y^2$`,
        expectedCount: 1,
      },
      {
        name: "TikZ in figure",
        input: `\\begin{figure}
\\centering
\\begin{tikzpicture}
  \\begin{axis}[xlabel=$x$, ylabel=$f(x)$]
    \\addplot {x^2};
  \\end{axis}
\\end{tikzpicture}
\\caption{Test graph}
\\end{figure}`,
        expectedCount: 1,
      },
      {
        name: "Multiple TikZ blocks",
        input: `\\begin{tikzpicture}
  Block 1
\\end{tikzpicture}
Text
\\begin{tikzpicture}
  Block 2
\\end{tikzpicture}`,
        expectedCount: 2,
      },
      {
        name: "No TikZ content",
        input: "Just regular math $x^2$ and text",
        expectedCount: 0,
      },
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(({ name, input, expectedCount }) => {
      console.log(`\nTest: ${name}`);

      const result = extractAndPreserveTikz(input);

      if (result.extracted === expectedCount) {
        console.log(`  ✅ PASS: Extracted ${result.extracted} block(s)`);
        console.log(
          `  ✅ Registry has ${Object.keys(result.registry).length} entries`
        );
        console.log(
          `  ✅ Placeholders inserted: ${result.processed.includes(
            "data-tikz-id"
          )}`
        );
        passed++;
      } else {
        console.log(
          `  ❌ FAIL: Expected ${expectedCount}, got ${result.extracted}`
        );
        failed++;
      }

      // Show what was preserved
      if (result.extracted > 0) {
        Object.entries(result.registry).forEach(([id, data]) => {
          console.log(
            `    - ${id}: ${data.content.substring(0, 50)}... (${data.context})`
          );
        });
      }
    });

    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${passed}/${testCases.length}`);
    console.log(`Failed: ${failed}/${testCases.length}`);

    return { passed, failed, total: testCases.length };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functionality
    extractAndPreserveTikz,
    markTikzPlaceholdersInDOM,

    // Registry management
    clearRegistry,
    getRegistry,
    getStatistics,

    // Future rendering support
    renderTikzBlock,
    renderAllTikzBlocks,

    // Utilities
    hasTikzContent,

    // Testing
    testTikzPreservation,
  };
})();

// Make globally available
window.TikzPreservationManager = TikzPreservationManager;

console.log("✅ TikZ Preservation Manager loaded");
console.log("   Run: TikzPreservationManager.testTikzPreservation()");
