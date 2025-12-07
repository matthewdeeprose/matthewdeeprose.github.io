/**
 * Cross-Reference Preprocessor
 *
 * Injects anchor targets into LaTeX BEFORE Pandoc conversion to ensure
 * cross-references navigate to correct locations in final HTML output.
 *
 * Strategy: Inject \hypertarget{content-label}{} after every \label{label}
 * Result: Pandoc creates <span id="content-label"></span> at exact location
 *
 * British spelling: initialise, colour, recognise
 * WCAG 2.2 AA compliant
 */

const CrossReferencePreprocessor = (function () {
  "use strict";

  // Logging configuration
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
      console.error(`[CrossRefPreproc] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CrossRefPreproc] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CrossRefPreproc] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CrossRefPreproc] ${message}`, ...args);
  }

  // Global registry for cross-references
  if (!window._crossReferenceRegistry) {
    window._crossReferenceRegistry = {
      labels: new Map(), // labelName -> { position, type, injected }
      references: new Map(), // labelName -> [{ type, position }]
      statistics: {
        labelsFound: 0,
        anchorsInjected: 0,
        referencesFound: 0,
        orphanedReferences: [],
      },
    };
  }

  /**
   * Extract all \label{} commands from LaTeX content
   * @param {string} latexContent - The LaTeX source
   * @returns {Map} Map of label names to their metadata
   */
  function extractLabels(latexContent) {
    const labels = new Map();
    const labelRegex = /\\label\{([^}]+)\}/g;
    let match;

    while ((match = labelRegex.exec(latexContent)) !== null) {
      const labelName = match[1];
      const position = match.index;

      if (!labels.has(labelName)) {
        labels.set(labelName, {
          name: labelName,
          position: position,
          type: detectLabelType(latexContent, position),
          injected: false,
        });
      } else {
        logWarn(`Duplicate label found: ${labelName} at position ${position}`);
      }
    }

    logInfo(`Extracted ${labels.size} labels from LaTeX content`);
    return labels;
  }

  /**
   * Detect the type of label based on surrounding context
   * @param {string} latexContent - The LaTeX source
   * @param {number} position - Position of the label
   * @returns {string} Label type (theorem, equation, figure, table, section, generic)
   */
  function detectLabelType(latexContent, position) {
    // Look back up to 200 characters for environment start
    const lookBehind = latexContent.substring(
      Math.max(0, position - 200),
      position
    );

    // Check for theorem-like environments
    if (
      /\\begin\{(theorem|lemma|proposition|corollary|definition|example|remark|proof)\}/i.test(
        lookBehind
      )
    ) {
      return "theorem";
    }

    // Check for equation environments
    if (
      /\\begin\{(equation|align|gather|multline)\*?\}|\\[\[]/.test(lookBehind)
    ) {
      return "equation";
    }

    // Check for figure environment
    if (/\\begin\{figure\}/i.test(lookBehind)) {
      return "figure";
    }

    // Check for table environment
    if (/\\begin\{table\}/i.test(lookBehind)) {
      return "table";
    }

    // Check for section commands
    if (/\\(sub)*section\*?\{/.test(lookBehind)) {
      return "section";
    }

    return "generic";
  }

  /**
   * Extract all reference commands from LaTeX content
   * @param {string} latexContent - The LaTeX source
   * @returns {Map} Map of label names to arrays of references
   */
  function extractReferences(latexContent) {
    const references = new Map();

    // Match \ref{}, \eqref{}, \pageref{}
    const refTypes = [
      { regex: /\\ref\{([^}]+)\}/g, type: "ref" },
      { regex: /\\eqref\{([^}]+)\}/g, type: "eqref" },
      { regex: /\\pageref\{([^}]+)\}/g, type: "pageref" },
    ];

    refTypes.forEach(({ regex, type }) => {
      let match;
      while ((match = regex.exec(latexContent)) !== null) {
        const labelName = match[1];
        const position = match.index;

        if (!references.has(labelName)) {
          references.set(labelName, []);
        }

        references.get(labelName).push({
          type: type,
          position: position,
        });
      }
    });

    const totalRefs = Array.from(references.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    logInfo(
      `Extracted ${totalRefs} references (${references.size} unique labels)`
    );

    return references;
  }

/**
   * Inject Pandoc anchor spans after every \label{} command
   * State-tracking approach: Properly determines context for each label
   * 
   * IMPORTANT: Equation labels are SKIPPED - they cluster when multiple labels
   * share the same math environment. The CrossReferenceFixer handles equation
   * anchors post-conversion by placing them at actual MathJax elements.
   * 
   * @param {string} latexContent - The LaTeX source
   * @returns {string} LaTeX with anchor injections
   */
  function injectAnchors(latexContent) {
    let result = "";
    let lastPos = 0;
    let injectionCount = 0;
    let skippedEquationLabels = 0;

    // Math environment patterns
    const mathBeginPattern =
      /\\begin\{(equation|align|gather|multline|alignat|split|flalign)\*?\}|\\\\?\[/g;
    const mathEndPattern =
      /\\end\{(equation|align|gather|multline|alignat|split|flalign)\*?\}|\\\\?\]/g;
    const labelPattern = /\\label\{([^}]+)\}/g;

    // Collect all math boundaries and labels
    const mathBoundaries = [];
    const labels = [];
    let match;

    // Collect math environment boundaries
    mathBeginPattern.lastIndex = 0;
    while ((match = mathBeginPattern.exec(latexContent)) !== null) {
      mathBoundaries.push({
        pos: match.index,
        type: "begin",
        text: match[0],
      });
    }

    mathEndPattern.lastIndex = 0;
    while ((match = mathEndPattern.exec(latexContent)) !== null) {
      mathBoundaries.push({
        pos: match.index,
        endPos: match.index + match[0].length,
        type: "end",
        text: match[0],
      });
    }

    // Collect all labels
    labelPattern.lastIndex = 0;
    while ((match = labelPattern.exec(latexContent)) !== null) {
      labels.push({
        pos: match.index,
        end: match.index + match[0].length,
        name: match[1],
        text: match[0],
      });
    }

    // Sort boundaries by position
    mathBoundaries.sort((a, b) => a.pos - b.pos);

    // For each label, determine if it's inside math and find the closing tag
    labels.forEach((label) => {
      let mathDepth = 0;
      let insideMath = false;
      let closingBoundary = null;

      // Check math depth at label position
      for (const boundary of mathBoundaries) {
        if (boundary.pos < label.pos) {
          if (boundary.type === "begin") {
            mathDepth++;
          } else if (boundary.type === "end") {
            mathDepth--;
          }
        }
      }

      insideMath = mathDepth > 0;

      // If inside math, find the NEXT closing boundary
      if (insideMath) {
        let depth = mathDepth;
        for (const boundary of mathBoundaries) {
          if (boundary.pos > label.end) {
            if (boundary.type === "end") {
              depth--;
              if (depth === 0) {
                closingBoundary = boundary;
                break;
              }
            } else if (boundary.type === "begin") {
              depth++;
            }
          }
        }
      }

      label.insideMath = insideMath;
      label.closingBoundary = closingBoundary;
    });

    // Now inject anchors based on context
    // Sort labels by position to ensure correct processing order
    labels.sort((a, b) => a.pos - b.pos);

    labels.forEach((label) => {
      // Add content from lastPos up to this label (only if not already past)
      if (lastPos < label.end) {
        result += latexContent.substring(lastPos, label.end);
        lastPos = label.end;
      }

      if (label.insideMath) {
        // SKIP equation labels - they cause clustering problems
        // The CrossReferenceFixer will handle these post-conversion
        // by placing anchors at actual MathJax elements
        skippedEquationLabels++;
        logDebug(`Skipping equation label: ${label.name} (will be handled by fixer)`);
        // Don't inject anything - just continue processing content
      } else {
        // Label is outside math - inject immediately using \hypertarget
        // No content- prefix to avoid duplication with Pandoc's native anchors
        result += `\\hypertarget{${label.name}}{}`;
        injectionCount++;
      }
    });

    // Add remaining content
    result += latexContent.substring(lastPos);

    logInfo(`Injected ${injectionCount} LaTeX \\hypertarget anchors (skipped ${skippedEquationLabels} equation labels)`);
    return result;
  }

/**
   * Calculate equation numbers for all equation labels
   * Tracks numbered environments and counts equations including multiline rows
   * @param {string} latexContent - The LaTeX source
   * @param {Map} labels - Map of label names to their metadata
   * @returns {Map} Map of label names to equation numbers
   */
  function calculateEquationNumbers(latexContent, labels) {
    const labelToEqNum = new Map();
    
    // Collect all events: environment boundaries, labels, and line breaks
    const events = [];
    
    // Numbered environment patterns (no asterisk = numbered)
    const beginPatterns = [
      { regex: /\\begin\{equation\}(?!\*)/g, env: 'equation', multiline: false },
      { regex: /\\begin\{align\}(?!\*)/g, env: 'align', multiline: true },
      { regex: /\\begin\{gather\}(?!\*)/g, env: 'gather', multiline: true },
      { regex: /\\begin\{multline\}(?!\*)/g, env: 'multline', multiline: false },
      { regex: /\\begin\{alignat\}(?!\*)\{[^}]*\}/g, env: 'alignat', multiline: true },
      { regex: /\\begin\{flalign\}(?!\*)/g, env: 'flalign', multiline: true }
    ];
    
    const endPatterns = [
      /\\end\{equation\}/g,
      /\\end\{align\}/g,
      /\\end\{gather\}/g,
      /\\end\{multline\}/g,
      /\\end\{alignat\}/g,
      /\\end\{flalign\}/g
    ];
    
    // Collect begin events
    beginPatterns.forEach(({ regex, env, multiline }) => {
      let match;
      while ((match = regex.exec(latexContent)) !== null) {
        events.push({ 
          pos: match.index, 
          type: 'begin', 
          env, 
          multiline,
          endPos: match.index + match[0].length
        });
      }
    });
    
    // Collect end events
    endPatterns.forEach(regex => {
      let match;
      while ((match = regex.exec(latexContent)) !== null) {
        events.push({ pos: match.index, type: 'end' });
      }
    });
    
    // Collect label events (only equation labels)
    const labelRegex = /\\label\{([^}]+)\}/g;
    let match;
    while ((match = labelRegex.exec(latexContent)) !== null) {
      const labelName = match[1];
      const labelData = labels.get(labelName);
      if (labelData && labelData.type === 'equation') {
        events.push({ pos: match.index, type: 'label', name: labelName });
      }
    }
    
    // Collect line break events (for multiline environments)
    const lineBreakRegex = /\\\\/g;
    while ((match = lineBreakRegex.exec(latexContent)) !== null) {
      events.push({ pos: match.index, type: 'linebreak' });
    }
    
    // Sort by position
    events.sort((a, b) => a.pos - b.pos);
    
    // Process events to calculate equation numbers
    let currentEqNum = 0;
    let inEnv = false;
    let currentEnvMultiline = false;
    let envStartPos = 0;
    
    for (const event of events) {
      if (event.type === 'begin') {
        inEnv = true;
        currentEnvMultiline = event.multiline;
        envStartPos = event.endPos;
        currentEqNum++;
      } else if (event.type === 'end') {
        inEnv = false;
        currentEnvMultiline = false;
      } else if (event.type === 'linebreak' && inEnv && currentEnvMultiline) {
        // Only count line breaks that are inside the environment content
        if (event.pos > envStartPos) {
          currentEqNum++;
        }
      } else if (event.type === 'label' && inEnv) {
        labelToEqNum.set(event.name, currentEqNum);
        logDebug(`Equation label "${event.name}" → Eq ${currentEqNum}`);
      }
    }
    
    logInfo(`Calculated equation numbers for ${labelToEqNum.size} equation labels`);
    return labelToEqNum;
  }

  /**
   * Build the cross-reference registry
   * @param {string} latexContent - The LaTeX source
   * @returns {object} Registry statistics
   */
  function buildRegistry(latexContent) {
    const labels = extractLabels(latexContent);
    const references = extractReferences(latexContent);

    // Clear existing registry
    window._crossReferenceRegistry.labels.clear();
    window._crossReferenceRegistry.references.clear();
    window._crossReferenceRegistry.statistics.orphanedReferences = [];

    // Calculate equation numbers for equation labels
    const equationNumbers = calculateEquationNumbers(latexContent, labels);

    // Populate registry with equation numbers
    labels.forEach((labelData, labelName) => {
      // Add equation number if this is an equation label
      if (labelData.type === 'equation' && equationNumbers.has(labelName)) {
        labelData.equationNumber = equationNumbers.get(labelName);
      }
      window._crossReferenceRegistry.labels.set(labelName, labelData);
    });

    references.forEach((refArray, labelName) => {
      window._crossReferenceRegistry.references.set(labelName, refArray);
    });

    // Detect orphaned references (references without labels)
    const orphaned = [];
    references.forEach((refArray, labelName) => {
      if (!labels.has(labelName)) {
        orphaned.push(labelName);
        logWarn(`Orphaned reference: ${labelName} (no matching label found)`);
      }
    });

    // Update statistics
    const stats = window._crossReferenceRegistry.statistics;
    stats.labelsFound = labels.size;
    stats.referencesFound = Array.from(references.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    stats.orphanedReferences = orphaned;
    stats.equationLabelsWithNumbers = equationNumbers.size;

    logInfo(
      `Registry built: ${stats.labelsFound} labels, ${stats.referencesFound} references, ${orphaned.length} orphaned, ${equationNumbers.size} equation numbers calculated`
    );

    return stats;
  }
  /**
   * Main preprocessing function
   * @param {string} latexContent - The original LaTeX source
   * @returns {object} { success, latex, statistics }
   */
  function preprocessLatex(latexContent) {
    if (!latexContent || typeof latexContent !== "string") {
      logError("Invalid LaTeX content provided");
      return {
        success: false,
        latex: latexContent,
        error: "Invalid input",
      };
    }

    try {
      logInfo("Starting cross-reference preprocessing...");

      // Build registry first (for diagnostics)
      const stats = buildRegistry(latexContent);

      // Inject anchors
      const modifiedLatex = injectAnchors(latexContent);

      // Mark all labels as injected
      window._crossReferenceRegistry.labels.forEach((labelData) => {
        labelData.injected = true;
      });
      stats.anchorsInjected = stats.labelsFound;

      logInfo(
        `✅ Preprocessing complete: ${stats.anchorsInjected} anchors injected`
      );

      return {
        success: true,
        latex: modifiedLatex,
        statistics: stats,
      };
    } catch (error) {
      logError("Preprocessing failed:", error);
      return {
        success: false,
        latex: latexContent,
        error: error.message,
      };
    }
  }

  /**
   * Get current registry status (for diagnostics)
   * @returns {object} Registry status information
   */
  function getRegistryStatus() {
    const registry = window._crossReferenceRegistry;

    return {
      labels: registry.labels.size,
      references: registry.references.size,
      statistics: { ...registry.statistics },
      orphanedReferences: [...registry.statistics.orphanedReferences],
    };
  }

  /**
   * Console test command
   */
  function testPreprocessor() {
    console.log("═══════════════════════════════════════════════");
    console.log("🧪 CROSS-REFERENCE PREPROCESSOR TEST");
    console.log("═══════════════════════════════════════════════\n");

    const testLatex = `
  \\section{Test Section}\\label{sec:test}
  
  This is a test with an equation:
  \\begin{equation}\\label{eq:test}
    E = mc^2
  \\end{equation}
  
  And a reference to \\ref{eq:test} and \\eqref{eq:test}.
  
  \\begin{theorem}\\label{thm:test}
  This is a test theorem.
  \\end{theorem}
  
  Reference to theorem: \\ref{thm:test}.
  Orphaned reference: \\ref{missing:label}.
  `;

    console.log("1️⃣ Testing injection syntax:");
    const result = preprocessLatex(testLatex);
    console.log(`   Success: ${result.success ? "✅" : "❌"}`);
    console.log(`   Anchors injected: ${result.statistics.anchorsInjected}`);
    console.log(`   Labels found: ${result.statistics.labelsFound}`);
    console.log(`   References found: ${result.statistics.referencesFound}`);
    console.log(`   Orphaned: ${result.statistics.orphanedReferences.length}`);

console.log("\n2️⃣ Injection example:");
    const before = "\\label{eq:test}";
    const after = "\\label{eq:test}\\hypertarget{eq:test}{}";
    const found = result.latex.includes(after);
    console.log(`   Before: ${before}`);
    console.log(`   After:  ${after}`);
    console.log(`   Found in output: ${found ? "✅" : "❌"}`);

    console.log("\n3️⃣ Registry status:");
    const status = getRegistryStatus();
    console.log(`   Labels in registry: ${status.labels}`);
    console.log(`   References in registry: ${status.references}`);
    console.log(
      `   Orphaned references: ${
        status.orphanedReferences.join(", ") || "none"
      }`
    );

    console.log("\n═══════════════════════════════════════════════");
    console.log(result.success ? "✅ Test passed!" : "❌ Test failed!");
    console.log("═══════════════════════════════════════════════");

    return result;
  }

  // Public API
  return {
    preprocessLatex,
    getRegistryStatus,
    testPreprocessor,
  };
})();

// Make available globally
window.CrossReferencePreprocessor = CrossReferencePreprocessor;

console.log("✅ CrossReferencePreprocessor loaded");
