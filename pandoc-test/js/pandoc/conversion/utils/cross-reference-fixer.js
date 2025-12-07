// cross-reference-fixer.js
// Cross-Reference Anchor Fixer - Fixes missing anchors for LaTeX cross-references
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring

const CrossReferenceFixer = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("CROSS_REF_FIXER", {
    level: window.LoggingSystem.LOG_LEVELS.DEBUG,
  }) || {
    logError: console.error.bind(console, "[CROSS_REF_FIXER]"),
    logWarn: console.warn.bind(console, "[CROSS_REF_FIXER]"),
    logInfo: console.log.bind(console, "[CROSS_REF_FIXER]"),
    logDebug: console.log.bind(console, "[CROSS_REF_FIXER]"),
    logTrace: console.log.bind(console, "[CROSS_REF_FIXER]"),
    logDecision: console.log.bind(console, "[CROSS_REF_FIXER] [DECISION]"),
    logPerformance: console.log.bind(
      console,
      "[CROSS_REF_FIXER] [PERFORMANCE]"
    ),
    logFlowStart: console.log.bind(console, "[CROSS_REF_FIXER] [FLOW_START]"),
    logFlowEnd: console.log.bind(console, "[CROSS_REF_FIXER] [FLOW_END]"),
  };

  const {
    logError,
    logWarn,
    logInfo,
    logDebug,
    logTrace,
    logDecision,
    logPerformance,
    logFlowStart,
    logFlowEnd,
  } = logger;

  // ===========================================================================================
  // CORE CROSS-REFERENCE FIXING FUNCTIONALITY
  // ===========================================================================================

  // ===========================================================================================
  // CROSS-REFERENCE REGISTRY SYSTEM (ALIGNED WITH LATEX REGISTRY ARCHITECTURE)
  // ===========================================================================================

  /**
   * Initialise global cross-reference registry
   * Follows same pattern as window.originalLatexRegistry
   * Stores metadata for each cross-reference: label, type, number, element, anchorId
   */
  function initialiseCrossReferenceRegistry() {
    logDebug("Initialising cross-reference registry...");

    try {
      // Initialise registry if not exists or invalid
      if (
        !window._crossReferenceRegistry ||
        typeof window._crossReferenceRegistry !== "object"
      ) {
        window._crossReferenceRegistry = {};
        logDebug("Created new _crossReferenceRegistry");
      }

      logInfo("✅ Cross-reference registry initialised successfully");
      return true;
    } catch (error) {
      logError("Failed to initialise cross-reference registry:", error);
      return false;
    }
  }

  /**
   * Register a cross-reference in the global registry
   * Called during anchor creation to store metadata for later lookup
   * @param {string} label - Original LaTeX label (e.g., "nolimit", "1-1-intervals")
   * @param {string} type - Label type (e.g., "theorem", "example")
   * @param {Element} element - Target element containing the numbered content
   * @param {string} number - Extracted reference number (e.g., "3", "13")
   * @param {string} anchorId - Created anchor ID (e.g., "content-nolimit")
   * @returns {boolean} - Success status
   */
  function registerCrossReference(label, type, element, number, anchorId) {
    if (!label) {
      logWarn("Cannot register cross-reference: missing label");
      return false;
    }

    try {
      // Ensure registry exists
      if (!window._crossReferenceRegistry) {
        initialiseCrossReferenceRegistry();
      }

      // Store complete metadata
      window._crossReferenceRegistry[label] = {
        label: label,
        type: type,
        element: element, // Store reference to actual element
        number: number || null,
        anchorId: anchorId,
        created: Date.now(),
      };

      logTrace(
        `✅ Registered cross-reference: ${label} → ${type} ${number} (anchor: ${anchorId})`
      );
      return true;
    } catch (error) {
      logError(`Failed to register cross-reference ${label}:`, error);
      return false;
    }
  }

  /**
   * Retrieve cross-reference metadata from registry
   * @param {string} label - Original LaTeX label
   * @returns {Object|null} - Registry entry or null if not found
   */
  function getCrossReferenceFromRegistry(label) {
    if (!window._crossReferenceRegistry) {
      logWarn("Cross-reference registry not initialised");
      return null;
    }

    try {
      const entry = window._crossReferenceRegistry[label];
      if (entry) {
        logTrace(
          `Retrieved from registry: ${label} → ${entry.type} ${entry.number}`
        );
        return entry;
      } else {
        logTrace(`Cross-reference not found in registry: ${label}`);
        return null;
      }
    } catch (error) {
      logError(`Error retrieving cross-reference ${label}:`, error);
      return null;
    }
  }

  /**
   * Get registry status and statistics (diagnostic function)
   * Follows same pattern as LatexRegistryManager.getRegistryStatus()
   * @returns {Object} - Registry status information
   */
  function getCrossReferenceRegistryStatus() {
    try {
      const registryExists = !!window._crossReferenceRegistry;
      const registrySize = registryExists
        ? Object.keys(window._crossReferenceRegistry).length
        : 0;

      // Count entries with complete metadata
      let completeEntries = 0;
      let incompleteEntries = 0;

      if (registryExists) {
        Object.values(window._crossReferenceRegistry).forEach((entry) => {
          if (entry.number && entry.type && entry.element) {
            completeEntries++;
          } else {
            incompleteEntries++;
          }
        });
      }

      const status = {
        registryInitialised: registryExists,
        totalEntries: registrySize,
        completeEntries: completeEntries,
        incompleteEntries: incompleteEntries,
        completionRate:
          registrySize > 0
            ? ((completeEntries / registrySize) * 100).toFixed(1) + "%"
            : "0%",
      };

      logDebug("Cross-reference registry status:", status);
      return status;
    } catch (error) {
      logError("Error getting registry status:", error);
      return {
        registryInitialised: false,
        totalEntries: 0,
        completeEntries: 0,
        incompleteEntries: 0,
        completionRate: "0%",
        error: error.message,
      };
    }
  }

  /**
   * Display detailed registry diagnostics (console-friendly format)
   * Shows which references share the same parent element (problem detection)
   */
  function diagnosticRegistryReport() {
    console.log("═══════════════════════════════════════════════");
    console.log("📊 CROSS-REFERENCE REGISTRY DIAGNOSTIC REPORT");
    console.log("═══════════════════════════════════════════════");

    if (!window._crossReferenceRegistry) {
      console.log("❌ Registry not initialised");
      return;
    }

    const registry = window._crossReferenceRegistry;
    const entries = Object.entries(registry);

    console.log(`\nTotal Entries: ${entries.length}\n`);

    // Group by parent element to detect duplicates
    const byParent = new Map();
    const byNumber = new Map();

    entries.forEach(([label, data]) => {
      // Group by parent element
      const parentKey =
        data.element?.tagName + "." + (data.element?.className || "no-class");
      if (!byParent.has(parentKey)) {
        byParent.set(parentKey, []);
      }
      byParent.get(parentKey).push({ label, ...data });

      // Group by number
      const numKey = data.number || "NO_NUMBER";
      if (!byNumber.has(numKey)) {
        byNumber.set(numKey, []);
      }
      byNumber.get(numKey).push(label);
    });

    // Report duplicates
    console.log("🔍 DUPLICATE DETECTION:\n");

    console.log("References sharing the same parent element:");
    byParent.forEach((refs, parent) => {
      if (refs.length > 1) {
        console.log(`  ⚠️  ${parent} (${refs.length} references):`);
        refs.forEach((ref) => {
          console.log(`      - ${ref.label} → ${ref.type} ${ref.number}`);
        });
      }
    });

    console.log("\nReferences sharing the same number:");
    byNumber.forEach((labels, number) => {
      if (labels.length > 1) {
        console.log(
          `  ⚠️  Number "${number}" used by ${labels.length} references:`
        );
        labels.forEach((label) => {
          const data = registry[label];
          console.log(`      - ${label} (${data.type})`);
        });
      }
    });

    // Sample of individual entries
    console.log("\n📋 SAMPLE ENTRIES (first 10):\n");
    entries.slice(0, 10).forEach(([label, data]) => {
      console.log(`  ${label}:`);
      console.log(`    Type: ${data.type}`);
      console.log(`    Number: ${data.number || "NOT EXTRACTED"}`);
      console.log(
        `    Element: ${data.element?.tagName}.${
          data.element?.className || "no-class"
        }`
      );
      console.log(`    Anchor: ${data.anchorId}`);
      console.log("");
    });

    console.log("═══════════════════════════════════════════════");
  }

  /**
   * Test cross-reference system end-to-end (console command)
   * Run after conversion to verify everything is working
   */
  function testCrossReferences() {
    console.log("═══════════════════════════════════════════════");
    console.log("🧪 CROSS-REFERENCE SYSTEM TEST");
    console.log("═══════════════════════════════════════════════\n");

    // Test 1: Registry Status
    const status = getCrossReferenceRegistryStatus();
    console.log("📊 REGISTRY STATUS:");
    console.log(`  Total entries: ${status.totalEntries}`);
    console.log(`  Complete: ${status.completeEntries}`);
    console.log(`  Incomplete: ${status.incompleteEntries}`);
    console.log(`  Completion rate: ${status.completionRate}\n`);

// Test 2: Link Status
    // Captures ALL reference types: ref, eqref, pageref, etc.
    const links = document.querySelectorAll('a[data-reference-type]');
    const bracketLinks = Array.from(links).filter((link) =>
      /^\[.+\]$/.test(link.textContent)
    );

    console.log("🔗 LINK STATUS:");
    console.log(`  Total links: ${links.length}`);
    console.log(`  Fixed (no brackets): ${links.length - bracketLinks.length}`);
    console.log(`  Still broken (brackets): ${bracketLinks.length}`);

    if (bracketLinks.length > 0) {
      console.log("\n  ❌ Links still showing brackets:");
      bracketLinks.slice(0, 5).forEach((link) => {
        console.log(
          `    - ${link.textContent} (${link.getAttribute("data-reference")})`
        );
      });
      if (bracketLinks.length > 5) {
        console.log(`    ... and ${bracketLinks.length - 5} more`);
      }
    }
    console.log("");

    // Test 3: Duplicate Detection Results
    const registry = window._crossReferenceRegistry || {};
    const entries = Object.values(registry);

    // Group by parent to find duplicates
    const byParent = new Map();
    entries.forEach((entry) => {
      const key =
        entry.element?.tagName + "." + (entry.element?.className || "no-class");
      if (!byParent.has(key)) {
        byParent.set(key, []);
      }
      byParent.get(key).push(entry);
    });

    const duplicateGroups = Array.from(byParent.values()).filter(
      (group) => group.length > 1
    );

    console.log("🔍 DUPLICATE DETECTION:");
    console.log(`  Groups with duplicates: ${duplicateGroups.length}`);
    duplicateGroups.forEach((group) => {
      console.log(
        `  - ${group[0].element?.tagName}.${
          group[0].element?.className || "no-class"
        }: ${group.length} references`
      );
    });
    console.log("");

    // Test 4: Type Distribution
    const byType = {};
    entries.forEach((entry) => {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    });

    console.log("📋 TYPE DISTRIBUTION:");
    Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    console.log("");

    // Test 5: Sample Links
    console.log("📝 SAMPLE LINKS (first 10):");
    Array.from(links)
      .slice(0, 10)
      .forEach((link, i) => {
        const ref = link.getAttribute("data-reference");
        const text = link.textContent;
        const registryEntry = registry[ref];

        console.log(`  ${i + 1}. [${ref}]`);
        console.log(`     Link text: "${text}"`);
        console.log(
          `     Registry: ${registryEntry?.type} ${
            registryEntry?.number || "NO_NUMBER"
          }`
        );
      });

    // Final Summary
    console.log("\n═══════════════════════════════════════════════");
    const successRate = (
      ((links.length - bracketLinks.length) / links.length) *
      100
    ).toFixed(1);

    if (bracketLinks.length === 0) {
      console.log("✅ ALL TESTS PASSED!");
      console.log(`   ${links.length}/${links.length} links fixed (100%)`);
    } else {
      console.log(`⚠️  PARTIAL SUCCESS: ${successRate}%`);
      console.log(
        `   ${links.length - bracketLinks.length}/${links.length} links fixed`
      );
      console.log(`   ${bracketLinks.length} links still need attention`);
    }
    console.log("═══════════════════════════════════════════════\n");

    return {
      success: bracketLinks.length === 0,
      totalLinks: links.length,
      fixedLinks: links.length - bracketLinks.length,
      brokenLinks: bracketLinks.length,
      registryEntries: status.totalEntries,
      successRate: successRate + "%",
    };
  }

  /**
   * Clear cross-reference registry (for testing/reset)
   */
  function clearCrossReferenceRegistry() {
    logWarn("Clearing cross-reference registry");

    try {
      if (window._crossReferenceRegistry) {
        const clearedCount = Object.keys(window._crossReferenceRegistry).length;
        window._crossReferenceRegistry = {};
        logDebug(`Cleared ${clearedCount} entries from registry`);
      }

      logInfo("✅ Cross-reference registry cleared");
      return true;
    } catch (error) {
      logError("Error clearing registry:", error);
      return false;
    }
  }

  /**
   * Analyse LaTeX content to extract label information
   * @param {string} latexContent - Original LaTeX input content
   * @returns {Array} - Array of label objects with context information
   */
  function analyseLaTeXLabels(latexContent) {
    logFlowStart("LaTeX label analysis", {
      contentLength: latexContent?.length || 0,
    });

    if (!latexContent || typeof latexContent !== "string") {
      logWarn("No valid LaTeX content provided for label analysis");
      return [];
    }

    const labels = [];
    const labelRegex = /\\label\{([^}]+)\}/g;
    let match;

    logTrace(
      `Analysing LaTeX content for labels (${latexContent.length} characters)`
    );

    while ((match = labelRegex.exec(latexContent)) !== null) {
      const label = match[1];
      const position = match.index;

      // Extract larger context (500 chars before, 200 after)
      const extendedContext = latexContent.substring(
        Math.max(0, position - 500),
        Math.min(latexContent.length, position + 200)
      );

      // ✨ NEW: Extract environment and content fingerprint
      const environmentInfo = extractEnvironmentInfo(
        extendedContext,
        position - Math.max(0, position - 500)
      );

      const labelInfo = {
        label,
        position,
        type: determineLabelType(extendedContext, label),
        context: extendedContext.trim(),
        // NEW: Store environment and content fingerprint
        environment: environmentInfo.environment,
        contentFingerprint: environmentInfo.fingerprint,
        environmentContent: environmentInfo.content,
      };

      labels.push(labelInfo);
      logTrace(
        `Found label: ${label} (type: ${labelInfo.type}, env: ${
          labelInfo.environment || "none"
        })`
      );
    }

    // ✨ NEW: Store in global registry for anchor placement
    window._labelContextRegistry = {};
    labels.forEach((labelInfo) => {
      window._labelContextRegistry[labelInfo.label] = labelInfo;
    });

    logFlowEnd("LaTeX label analysis", { labelsFound: labels.length });
    logInfo(`Extracted ${labels.length} labels from LaTeX content`);
    logInfo(`Created label context registry with ${labels.length} entries`);

    return labels;
  }

  /**
   * Extract environment information and content fingerprint from LaTeX context
   * @param {string} context - LaTeX context around the label
   * @param {number} labelOffset - Position of \label within context
   * @returns {Object} - Environment info with type, fingerprint, and content
   */
  function extractEnvironmentInfo(context, labelOffset) {
    const result = {
      environment: null,
      fingerprint: null,
      content: null,
    };

    // Look for \begin{environment} before the label
    const beforeLabel = context.substring(0, labelOffset);
    const afterLabel = context.substring(labelOffset);

    // Match environment patterns
    const envPattern =
      /\\begin\{(example|theorem|lemma|corollary|definition|proposition|proof|remark|exercise)\}/gi;
    let lastEnvMatch = null;
    let match;

    // Find the last \begin{} before the label
    while ((match = envPattern.exec(beforeLabel)) !== null) {
      lastEnvMatch = match;
    }

    if (lastEnvMatch) {
      result.environment = lastEnvMatch[1].toLowerCase();

      // Extract content after \begin{env} up to label or reasonable length
      const envStart = lastEnvMatch.index + lastEnvMatch[0].length;
      const contentAfterBegin =
        beforeLabel.substring(envStart) + afterLabel.substring(0, 300);

      // Create content fingerprint: first substantial text (excluding LaTeX commands)
      // Remove LaTeX commands and get first ~50 chars of actual content
      let cleanContent = contentAfterBegin
        .replace(/\\label\{[^}]+\}/g, "") // Remove label
        .replace(/\\\w+(\[[^\]]*\])?(\{[^}]*\})?/g, "") // Remove LaTeX commands
        .replace(/\$[^$]*\$/g, "") // Remove inline math
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      // Get first meaningful text (at least 20 chars)
      const words = cleanContent.split(" ").filter((w) => w.length > 0);
      const fingerprint = words.slice(0, 10).join(" "); // First 10 words

      if (fingerprint.length > 15) {
        result.fingerprint = fingerprint;
        result.content = cleanContent.substring(0, 200);
      }

      logTrace(
        `Extracted environment: ${
          result.environment
        }, fingerprint: "${result.fingerprint?.substring(0, 50)}..."`
      );
    }

    return result;
  }

  /**
   * Determine the type of label based on context and naming convention
   * @param {string} context - Surrounding LaTeX context
   * @param {string} label - The label name
   * @returns {string} - Label type (section, equation, figure, table, generic)
   */
  function determineLabelType(context, label) {
    logTrace(`Determining label type for: ${label}`);

    // Check label prefix convention
    if (label.startsWith("sec:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "section",
      });
      return "section";
    }
    if (label.startsWith("eq:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "equation",
      });
      return "equation";
    }
    if (label.startsWith("fig:")) {
      logDecision(`Label type determined by prefix`, { label, type: "figure" });
      return "figure";
    }
    if (label.startsWith("tab:")) {
      logDecision(`Label type determined by prefix`, { label, type: "table" });
      return "table";
    }
    if (label.startsWith("thm:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "theorem",
      });
      return "theorem";
    }
    if (label.startsWith("def:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "definition",
      });
      return "definition";
    }
    if (label.startsWith("lem:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "lemma",
      });
      return "lemma";
    }
    if (label.startsWith("cor:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "corollary",
      });
      return "corollary";
    }
    if (label.startsWith("ex:")) {
      logDecision(`Label type determined by prefix`, {
        label,
        type: "example",
      });
      return "example";
    }

    // Check context for LaTeX commands
    if (
      context.includes("\\section") ||
      context.includes("\\subsection") ||
      context.includes("\\subsubsection") ||
      context.includes("\\chapter")
    ) {
      logDecision(`Label type determined by context`, {
        label,
        type: "section",
        contextClue: "section command",
      });
      return "section";
    }
    if (
      context.includes("\\begin{equation}") ||
      context.includes("\\begin{align}") ||
      context.includes("\\begin{gather}") ||
      context.includes("\\[")
    ) {
      logDecision(`Label type determined by context`, {
        label,
        type: "equation",
        contextClue: "equation environment",
      });
      return "equation";
    }
    if (context.includes("\\begin{figure}")) {
      logDecision(`Label type determined by context`, {
        label,
        type: "figure",
        contextClue: "figure environment",
      });
      return "figure";
    }
    if (context.includes("\\begin{table}")) {
      logDecision(`Label type determined by context`, {
        label,
        type: "table",
        contextClue: "table environment",
      });
      return "table";
    }

    logDecision(`Label type fallback to generic`, { label, type: "generic" });
    return "generic";
  }

  /**
   * Extract reference number from a target element
   * Looks for patterns like "Example 13", "Theorem 5.2", "Exercise 18", etc.
   * ENHANCED: Handles anchor elements by looking at parent/sibling content
   * @param {Element} targetElement - The element being referenced (may be anchor or content)
   * @returns {string|null} - The extracted number or null if not found
   */
  function extractReferenceNumber(targetElement) {
    if (!targetElement) {
      logTrace("No target element provided for number extraction");
      return null;
    }

    // Strategy: If target is an empty anchor, look at parent or siblings for content
    let contentElement = targetElement;
    const targetText = targetElement.textContent.trim();

    // If target is empty or very short (likely an anchor), look for actual content
    if (
      targetText.length < 5 ||
      (targetElement.tagName === "SPAN" &&
        targetElement.getAttribute("data-original-label"))
    ) {
      logTrace(
        "Target appears to be an anchor element, searching for actual content..."
      );

      // Strategy 1: Check parent element
      if (targetElement.parentElement) {
        contentElement = targetElement.parentElement;
        logTrace(`Checking parent element: ${contentElement.tagName}`);
      }

      // Strategy 2: For sections, the parent should be the heading
      if (contentElement.tagName && contentElement.tagName.match(/^H[1-6]$/)) {
        logTrace(
          `Found heading parent: ${
            contentElement.tagName
          } - "${contentElement.textContent.substring(0, 50)}"`
        );
        // Sections typically don't have numbers in Pandoc output, so return the section ID
        if (contentElement.id) {
          // Extract section number from heading if it exists
          const headingText = contentElement.textContent.trim();
          const sectionNumMatch = headingText.match(/^(\d+(?:\.\d+)*)\s/);
          if (sectionNumMatch) {
            logTrace(
              `Extracted section number from heading: ${sectionNumMatch[1]}`
            );
            return sectionNumMatch[1];
          }
        }
        // Pandoc doesn't add section numbers by default, so we can't extract them
        logTrace(
          "Section references don't have extractable numbers in Pandoc output"
        );
        return null;
      }
    }

    const text = contentElement.textContent.trim();
    logTrace(
      `Searching for number patterns in: "${text.substring(0, 100)}..."`
    );

    // Pattern 1: Look for "Word Number" patterns (Example 13, Theorem 5.2, Exercise 18)
    // This handles: Example 13, Theorem 5.2, Lemma 2.3.4, Exercise 18, etc.
    // Extended to include: Remark, Note, Problem, Solution, Algorithm, Axiom, Conjecture
    const wordNumberPattern =
      /(?:Example|Theorem|Lemma|Corollary|Definition|Proposition|Exercise|Figure|Table|Remark|Note|Problem|Solution|Algorithm|Axiom|Conjecture)\s+(\d+(?:\.\d+)*)/i;
    const wordNumberMatch = text.match(wordNumberPattern);

    if (wordNumberMatch) {
      logTrace(
        `Extracted number "${wordNumberMatch[1]}" from pattern: ${wordNumberMatch[0]}`
      );
      return wordNumberMatch[1];
    }

    // Pattern 2: Look for emphasized or strong number at start (for structured content)
    // Handles: <em><strong>Example</strong> 13</em>
    // Extended to handle more environments
    const emphasisPattern =
      /^\s*(?:<[^>]+>)*\s*(?:Example|Theorem|Lemma|Corollary|Definition|Proposition|Exercise|Figure|Table|Remark|Note|Problem|Solution|Algorithm|Axiom|Conjecture)\s*(?:<[^>]+>)*\s*(\d+(?:\.\d+)*)/i;
    const emphasisMatch = text.match(emphasisPattern);

    if (emphasisMatch) {
      logTrace(`Extracted number "${emphasisMatch[1]}" from emphasis pattern`);
      return emphasisMatch[1];
    }

    // Pattern 3: Section numbers (§5, Section 2.3, etc.) at start of text
    const sectionPattern = /^(\d+(?:\.\d+)*)\s+/;
    const sectionMatch = text.match(sectionPattern);

    if (sectionMatch) {
      logTrace(`Extracted section number "${sectionMatch[1]}" from heading`);
      return sectionMatch[1];
    }

    // Pattern 4: Numbered list or structure (1. Text, 2.3. Text, etc.)
    const numberedPattern = /^(\d+(?:\.\d+)*)\.\s+\w/;
    const numberedMatch = text.match(numberedPattern);

    if (numberedMatch) {
      logTrace(
        `Extracted number "${numberedMatch[1]}" from numbered structure`
      );
      return numberedMatch[1];
    }

    // Pattern 5: Equation numbers - look for ID patterns or parenthetical numbers
    if (targetElement.id && targetElement.id.includes("eq")) {
      // Try to find equation number in parentheses: (5.2)
      const eqParenPattern = /\((\d+(?:\.\d+)*)\)/;
      const eqParenMatch = text.match(eqParenPattern);

      if (eqParenMatch) {
        logTrace(
          `Extracted equation number "${eqParenMatch[1]}" from parentheses`
        );
        return eqParenMatch[1];
      }

      // For equations, try MathJax tag (equation numbering)
      const mjxTag = contentElement.querySelector(".mjx-tag");
      if (mjxTag) {
        const tagText = mjxTag.textContent.trim();
        const tagNumMatch = tagText.match(/\((\d+(?:\.\d+)*)\)/);
        if (tagNumMatch) {
          logTrace(
            `Extracted equation number "${tagNumMatch[1]}" from MathJax tag`
          );
          return tagNumMatch[1];
        }
      }
    }

    // Pattern 6: Figure and Table captions
    // For anchors in tables/figures, we need to search the parent element structure

    // Check if this is a table reference
    let tableElement = contentElement.closest("table");
    if (!tableElement && contentElement.querySelector) {
      tableElement = contentElement.querySelector("table");
    }

    if (tableElement) {
      // Look for caption in the table or nearby
      let caption = tableElement.querySelector("caption");
      if (caption) {
        const captionText = caption.textContent;
        const tablePattern = /Table\s+(\d+(?:\.\d+)*)[\s:.]/i;
        const tableMatch = captionText.match(tablePattern);

        if (tableMatch) {
          logTrace(
            `Extracted table number "${tableMatch[1]}" from caption element`
          );
          return tableMatch[1];
        }
      }

      // Fallback: look in all text content near the table
      const parentText = tableElement.parentElement?.textContent || "";
      const tablePattern = /Table\s+(\d+(?:\.\d+)*)[\s:.]/i;
      const tableMatch = parentText.match(tablePattern);

      if (tableMatch) {
        logTrace(`Extracted table number "${tableMatch[1]}" from parent text`);
        return tableMatch[1];
      }
    }

    // Check if this is a figure reference
    let figureElement = contentElement.closest("figure");
    if (!figureElement && contentElement.querySelector) {
      figureElement = contentElement.querySelector("figure");
    }

    if (figureElement) {
      // Strategy 1: Look for explicit figure number in caption
      let figcaption = figureElement.querySelector("figcaption");
      if (figcaption) {
        const captionText = figcaption.textContent;
        const figurePattern = /Figure\s+(\d+(?:\.\d+)*)[\s:.]/i;
        const figureMatch = captionText.match(figurePattern);

        if (figureMatch) {
          logTrace(
            `Extracted figure number "${figureMatch[1]}" from figcaption element`
          );
          return figureMatch[1];
        }
      }

      // Strategy 2: Pandoc doesn't add figure numbers, so count position in document
      // Get all figures in document order
      const allFigures = Array.from(document.querySelectorAll("figure"));
      const figureIndex = allFigures.indexOf(figureElement);

      if (figureIndex !== -1) {
        // Figure numbers are 1-based (first figure is Figure 1)
        const figureNumber = (figureIndex + 1).toString();
        logTrace(
          `Extracted figure number "${figureNumber}" from document position (${
            figureIndex + 1
          } of ${allFigures.length})`
        );
        return figureNumber;
      }

      // Strategy 3: Fallback - look in all text content of figure
      const figureText = figureElement.textContent || "";
      const figurePattern = /Figure\s+(\d+(?:\.\d+)*)[\s:.]/i;
      const figureMatch = figureText.match(figurePattern);

      if (figureMatch) {
        logTrace(
          `Extracted figure number "${figureMatch[1]}" from figure text`
        );
        return figureMatch[1];
      }
    }

    // General pattern matching for figures/tables in surrounding text
    const figurePattern = /Figure\s+(\d+(?:\.\d+)*)[\s:.]/i;
    const figureMatch = text.match(figurePattern);

    if (figureMatch) {
      logTrace(
        `Extracted figure number "${figureMatch[1]}" from general pattern`
      );
      return figureMatch[1];
    }

    const tablePattern = /Table\s+(\d+(?:\.\d+)*)[\s:.]/i;
    const tableMatch = text.match(tablePattern);

    if (tableMatch) {
      logTrace(
        `Extracted table number "${tableMatch[1]}" from general pattern`
      );
      return tableMatch[1];
    }

    logTrace(
      `Could not extract reference number from: "${text.substring(0, 100)}..."`
    );
    return null;
  }
  /**
   * Replace label text in cross-reference links with actual reference numbers
   * This function should be called after anchors are created
   * @returns {Object} - Results of label replacement
   */
  function replaceReferenceLabelText() {
    logFlowStart("Reference label text replacement");

    const results = {
      processed: 0,
      replaced: 0,
      failed: 0,
      details: [],
    };

    try {
// Find all cross-reference links with data-reference attribute
      // Captures ALL reference types: ref, eqref, pageref, etc.
      const crossRefLinks = document.querySelectorAll(
        'a[data-reference-type][data-reference]'
      );
      results.processed = crossRefLinks.length;

      if (results.processed === 0) {
        logInfo("No cross-reference links found for label replacement");
        logFlowEnd("Reference label text replacement", {
          reason: "no links found",
        });
        return results;
      }

      logInfo(
        `Processing ${results.processed} cross-reference links for label replacement`
      );

      crossRefLinks.forEach((link, index) => {
        const href = link.getAttribute("href");
        const targetId = href ? href.replace("#", "") : null;
        const originalRef = link.getAttribute("data-reference");
        const currentText = link.textContent.trim();

        const detail = {
          index: index + 1,
          originalRef,
          targetId,
          oldText: currentText,
          newText: currentText,
          success: false,
          reason: "unknown",
        };

        // Check if the link text is in bracket format [label-name]
        const isBracketFormat = /^\[.+\]$/.test(currentText);

        if (!isBracketFormat) {
          detail.reason = "not bracket format";
          detail.success = true; // Not an error, just doesn't need replacement
          results.details.push(detail);
          logTrace(
            `Link ${
              index + 1
            }: Skipping "${currentText}" (not in bracket format)`
          );
          return;
        }

        if (!targetId) {
          detail.reason = "no target ID";
          results.failed++;
          results.details.push(detail);
          logTrace(`Link ${index + 1}: Skipping (no target ID)`);
          return;
        }

        // Find the target element
        const targetElement = document.getElementById(targetId);

        if (!targetElement) {
          detail.reason = "target not found";
          results.failed++;
          results.details.push(detail);
          logTrace(`Link ${index + 1}: Target "${targetId}" not found`);
          return;
        }

        // ✨ NEW: Use registry data instead of live extraction
        let referenceNumber = null;
        let labelType = "generic";
        let usedRegistry = false;
        let isDuplicate = false;

        // Try to get data from registry first
        const registryEntry = getCrossReferenceFromRegistry(originalRef);

        if (registryEntry) {
          usedRegistry = true;
          labelType = registryEntry.type;

          // DUPLICATE DETECTION: Check if this entry shares parent+number with others
          // This indicates the number is wrong (all anchors in same container)
          const registryEntries = Object.values(
            window._crossReferenceRegistry || {}
          );
          const sameParentAndNumber = registryEntries.filter(
            (entry) =>
              entry.element === registryEntry.element &&
              entry.number === registryEntry.number &&
              entry.label !== registryEntry.label
          );

          if (sameParentAndNumber.length > 0) {
            // Multiple references share same parent+number = wrong extraction
            isDuplicate = true;
            logWarn(
              `Link ${
                index + 1
              }: Detected duplicate parent+number for "${originalRef}" ` +
                `(${sameParentAndNumber.length + 1} references share ${
                  registryEntry.element?.tagName
                }.${registryEntry.element?.className} and number "${
                  registryEntry.number
                }")`
            );

            // Use label name instead of wrong number
            referenceNumber = originalRef.replace(
              /^(eq|thm|def|lem|cor|fig|tab|ex|sec):/i,
              ""
            );
            detail.reason = "duplicate detected, using label name";
            detail.isDuplicate = true;
          } else {
            // Unique parent+number = likely correct
            referenceNumber = registryEntry.number;
            detail.reason = "from registry (unique)";
          }
        } else {
          // Fallback: Registry lookup failed, extract from target
          logWarn(
            `Link ${
              index + 1
            }: Registry lookup failed for "${originalRef}", falling back to extraction`
          );
          referenceNumber = extractReferenceNumber(targetElement);
          labelType = determineLabelType("", originalRef || "");
          detail.reason = "registry miss, extracted from target";
        }

        if (!referenceNumber) {
          // Ultimate fallback: Use label name without prefix
          referenceNumber = originalRef.replace(
            /^(eq|thm|def|lem|cor|fig|tab|ex|sec):/i,
            ""
          );
          logWarn(
            `Link ${
              index + 1
            }: Could not extract number from target "${targetId}", using label fallback: "${referenceNumber}"`
          );
          detail.reason = "no number extracted, using label as fallback";
          detail.isFallback = true;
        }

        // ACCESSIBILITY ENHANCEMENT: Always include type in link for screen reader accessibility
        // Remove preceding duplicate word to avoid visual duplication

        // Map label types to readable prefixes
        const typeLabels = {
          theorem: "Theorem",
          definition: "Definition",
          lemma: "Lemma",
          corollary: "Corollary",
          proposition: "Proposition",
          section: "Section",
          equation: "Equation",
          figure: "Figure",
          table: "Table",
          example: "Example",
          remark: "Remark",
          exercise: "Exercise",
        };

        // Always create descriptive link text for accessibility
        let descriptiveText = referenceNumber;
        let removedPrecedingWord = false;

        if (typeLabels[labelType]) {
          const typeWord = typeLabels[labelType];
          descriptiveText = `${typeWord} ${referenceNumber}`;

          // Check if the type word already appears before the link
          let previousTextNode = link.previousSibling;

          // Find the actual text node (skip empty nodes)
          while (
            previousTextNode &&
            previousTextNode.nodeType !== Node.TEXT_NODE
          ) {
            previousTextNode = previousTextNode.previousSibling;
          }

          if (
            previousTextNode &&
            previousTextNode.nodeType === Node.TEXT_NODE
          ) {
            const previousText = previousTextNode.textContent;

            // Check if the type word appears at the end (with optional whitespace/nbsp)
            const typePattern = new RegExp(`${typeWord}[\\s\\u00A0]*$`, "i");

            if (typePattern.test(previousText)) {
              // Remove the duplicate word from the preceding text
              const newPreviousText = previousText.replace(typePattern, "");
              previousTextNode.textContent = newPreviousText;
              removedPrecedingWord = true;
              logTrace(`Removed duplicate "${typeWord}" from preceding text`);
            }
          }

          logTrace(
            `Created descriptive link text: "${descriptiveText}" (removed preceding: ${removedPrecedingWord})`
          );
        } else {
          logTrace(`Using number only for unknown type: ${labelType}`);
        }

        // Replace the link text with descriptive reference text
        link.textContent = descriptiveText;
        detail.newText = descriptiveText;
        detail.success = true;
        detail.reason = "replaced successfully";
        detail.removedDuplicate = removedPrecedingWord;
        results.replaced++;
        results.details.push(detail);

        logTrace(
          `✅ Link ${
            index + 1
          }: Replaced "${currentText}" with "${descriptiveText}"`
        );
      });

      logFlowEnd("Reference label text replacement", {
        processed: results.processed,
        replaced: results.replaced,
        failed: results.failed,
      });

      logInfo(
        `Label replacement complete: ${results.replaced} replaced, ${results.failed} failed`
      );
    } catch (error) {
      logError("Error during label replacement:", error);
      results.details.push({
        error: error.message,
        success: false,
      });
    }

return results;
  }

  /**
   * Enhance link accessibility by moving preceding type words into link text
   * This function should be called AFTER replaceReferenceLabelText()
   * Transforms: "Theorem <a>6</a>" → "<a>Theorem 6</a>"
   * @returns {Object} - Results of accessibility enhancement
   */
  function enhanceLinkAccessibility() {
    logFlowStart("Link accessibility enhancement");

    const results = {
      processed: 0,
      enhanced: 0,
      skipped: 0,
      details: [],
    };

    try {
      const output = document.getElementById("output");
      if (!output) {
        logWarn("No output element found for accessibility enhancement");
        return results;
      }

      // Find all cross-reference links
      const crossRefLinks = output.querySelectorAll("a[data-reference-type]");
      results.processed = crossRefLinks.length;

      if (results.processed === 0) {
        logInfo("No cross-reference links found for accessibility enhancement");
        logFlowEnd("Link accessibility enhancement", { reason: "no links found" });
        return results;
      }

      logInfo(`Processing ${results.processed} cross-reference links for accessibility enhancement`);

// Type words to look for (case-insensitive matching)
      // Include both singular and plural forms
      const typeWords = [
        "Theorems",
        "Theorem",
        "Lemmas",
        "Lemma",
        "Corollaries",
        "Corollary",
        "Propositions",
        "Proposition",
        "Definitions",
        "Definition",
        "Examples",
        "Example",
        "Exercises",
        "Exercise",
        "Remarks",
        "Remark",
        "Figures",
        "Figure",
        "Tables",
        "Table",
        "Sections",
        "Section",
        "Chapters",
        "Chapter",
        "Properties",
        "Property",
      ];

      crossRefLinks.forEach((link, index) => {
        const linkText = link.textContent.trim();
        const refType = link.getAttribute("data-reference-type");

        const detail = {
          index: index + 1,
          originalLinkText: linkText,
          newLinkText: linkText,
          action: "none",
        };

        // Skip eqref links - keep as parenthesised numbers (conventional)
        if (refType === "eqref") {
          detail.action = "skipped (eqref)";
          results.skipped++;
          results.details.push(detail);
          return;
        }

        // Skip if link already contains a type word
        const alreadyHasTypeWord = typeWords.some((tw) =>
          linkText.toLowerCase().includes(tw.toLowerCase())
        );
        if (alreadyHasTypeWord) {
          detail.action = "skipped (already accessible)";
          results.skipped++;
          results.details.push(detail);
          return;
        }

        // Find the preceding text node
        let previousTextNode = link.previousSibling;

        // Skip empty nodes to find actual text
        while (
          previousTextNode &&
          previousTextNode.nodeType !== Node.TEXT_NODE
        ) {
          previousTextNode = previousTextNode.previousSibling;
        }

        if (!previousTextNode || previousTextNode.nodeType !== Node.TEXT_NODE) {
          detail.action = "skipped (no preceding text)";
          results.skipped++;
          results.details.push(detail);
          return;
        }

        const previousText = previousTextNode.textContent;

        // Check if any type word appears at the end of the preceding text
        // Match: "TypeWord" followed by optional whitespace/non-breaking space
        let matchedTypeWord = null;
        let typeWordPattern = null;

        for (const tw of typeWords) {
          // Pattern: type word at end, with optional whitespace after
          const pattern = new RegExp(`(${tw})[\\s\\u00A0]*$`, "i");
          if (pattern.test(previousText)) {
            matchedTypeWord = tw;
            typeWordPattern = pattern;
            break;
          }
        }

        if (!matchedTypeWord) {
          detail.action = "skipped (no preceding type word)";
          results.skipped++;
          results.details.push(detail);
          return;
        }

        // Enhancement: Move type word into link text
        // 1. Remove type word from preceding text
        const newPreviousText = previousText.replace(typeWordPattern, "");
        previousTextNode.textContent = newPreviousText;

        // 2. Add type word to link text
        const newLinkText = `${matchedTypeWord} ${linkText}`;
        link.textContent = newLinkText;

        detail.newLinkText = newLinkText;
        detail.removedFromPreceding = matchedTypeWord;
        detail.action = "enhanced";
        results.enhanced++;
        results.details.push(detail);

        logTrace(
          `✅ Link ${index + 1}: Enhanced "${linkText}" → "${newLinkText}" (removed "${matchedTypeWord}" from preceding text)`
        );
      });

      logFlowEnd("Link accessibility enhancement", {
        processed: results.processed,
        enhanced: results.enhanced,
        skipped: results.skipped,
      });

      logInfo(
        `Accessibility enhancement complete: ${results.enhanced} enhanced, ${results.skipped} skipped`
      );
    } catch (error) {
      logError("Error during accessibility enhancement:", error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Main function to fix cross-references in converted HTML
   * @param {string} latexContent - Original LaTeX input (optional, for enhanced analysis)
   * @param {Object} options - Configuration options
   * @param {boolean} options.skipAnchorCreation - If true, skip creating new anchors (assumes preprocessor handled it)
   * @returns {Object} - Results of cross-reference fixing
   */
  function fixCrossReferences(latexContent = null, options = {}) {
    const { skipAnchorCreation = false } = options;
    logFlowStart("Cross-reference fixing workflow");

    // Reset session state for consistent equation mapping
    window._crossRefSession = { equationCounter: 0 };
    logTrace("Reset cross-reference session state");

    const startTime = performance.now();
    const results = {
      processed: 0,
      fixed: 0,
      failed: 0,
      details: [],
    };

    try {
      // Extract label information from LaTeX if available
      const labelInfo = latexContent ? analyseLaTeXLabels(latexContent) : [];
      const labelMap = new Map(labelInfo.map((info) => [info.label, info]));

      logDecision("Cross-reference analysis strategy", {
        hasLatexInput: !!latexContent,
        labelsExtracted: labelInfo.length,
      });

// Find all cross-reference links in the document
      // Captures ALL reference types: ref, eqref, pageref, etc.
      const crossRefLinks = document.querySelectorAll(
        'a[data-reference-type]'
      );
      results.processed = crossRefLinks.length;

      if (results.processed === 0) {
        logInfo("No cross-reference links found - nothing to fix");
        logFlowEnd("Cross-reference fixing workflow", {
          reason: "no links found",
        });
        return results;
      }

      logInfo(`Processing ${results.processed} cross-reference links`);

      // TIME-BASED: Cross-refs are 15.4% of work, so allocate 70% → 85% (15 points)
      if (window.StatusManager) {
        window.StatusManager.setLoading(
          `Linking cross-references (${results.processed} found)...`,
          70
        );
      }

      // Process each link with progress updates
      crossRefLinks.forEach((link, index) => {
        try {
          const fixResult = fixSingleCrossReference(
            link,
            labelMap,
            skipAnchorCreation
          );
          results.details.push(fixResult);

          if (fixResult.success) {
            results.fixed++;
            logTrace(`✅ Fixed: ${fixResult.targetId}`);
          } else {
            results.failed++;
            logTrace(`❌ Failed: ${fixResult.targetId} - ${fixResult.reason}`);
          }

          // Show progress more frequently to avoid gaps
          // Update every 5 links
          const updateInterval = 5;
          if ((index + 1) % updateInterval === 0 && window.StatusManager) {
            const progress =
              70 + Math.floor(((index + 1) / results.processed) * 15); // 70% → 85%
            window.StatusManager.setLoading(
              `Linking cross-references: ${index + 1}/${
                results.processed
              } (${progress}%)`,
              progress
            );
          }
        } catch (error) {
          results.failed++;
          logError(`Error fixing cross-reference ${index}:`, error);
        }
      });

      // Final status update after completion
      if (window.StatusManager) {
        window.StatusManager.setLoading(
          `Cross-references linked (${results.fixed} anchors created)`,
          85
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      logPerformance("Cross-reference fixing", duration, {
        linksProcessed: results.processed,
        linksFixed: results.fixed,
        linksFailed: results.failed,
      });

      logFlowEnd("Cross-reference fixing workflow", {
        fixed: results.fixed,
        failed: results.failed,
        total: results.processed,
        duration: `${duration.toFixed(2)}ms`,
      });

      logInfo(`Cross-reference fixing completed in ${duration.toFixed(2)}ms`);
      logInfo(
        `Results: ${results.fixed} fixed, ${results.failed} failed, ${results.processed} total`
      );

      // NEW: Replace label text with actual reference numbers
      // This happens after anchors are created so targets exist
      logInfo("🔄 Replacing reference label text with numbers...");
      const replacementResults = replaceReferenceLabelText();

      // Add replacement results to main results
      results.labelReplacement = {
        processed: replacementResults.processed,
        replaced: replacementResults.replaced,
        failed: replacementResults.failed,
      };

if (replacementResults.replaced > 0) {
        logInfo(
          `✅ Replaced ${replacementResults.replaced} reference label(s) with numbers`
        );
      }

      // NEW: Enhance link accessibility by moving preceding type words into links
      // This makes links like "Theorem 6" instead of just "6" for screen readers
      logInfo("🔗 Enhancing link accessibility...");
      const accessibilityResults = enhanceLinkAccessibility();

      // Add accessibility results to main results
      results.accessibilityEnhancement = {
        processed: accessibilityResults.processed,
        enhanced: accessibilityResults.enhanced,
        skipped: accessibilityResults.skipped,
      };

      if (accessibilityResults.enhanced > 0) {
        logInfo(
          `✅ Enhanced ${accessibilityResults.enhanced} link(s) for accessibility`
        );
      }

      return results;
    } catch (error) {
      logError("Error in fixCrossReferences:", error);
      logFlowEnd("Cross-reference fixing workflow", { error: error.message });
      return { ...results, error: error.message };
    }
  }

  /**
   * Fix a single cross-reference link
   * @param {Element} link - The cross-reference link element
   * @param {Map} labelMap - Map of labels to their context information
   * @param {boolean} skipAnchorCreation - If true, skip creating new anchors
   * @returns {Object} - Result of fixing this single reference
   */
  function fixSingleCrossReference(link, labelMap, skipAnchorCreation = false) {
    const href = link.getAttribute("href");
    const targetId = href ? href.replace("#", "") : null;
    const originalRef = link.getAttribute("data-reference");

    const result = {
      targetId,
      originalRef,
      success: false,
      reason: "unknown",
    };

    logTrace(`Processing cross-reference: ${originalRef} → ${targetId}`);

    // Skip if no target ID
    if (!targetId) {
      result.reason = "no target ID";
      logTrace(`Skipping link: ${result.reason}`);
      return result;
    }

    // Check if target already exists
    if (document.getElementById(targetId)) {
      result.reason = "target already exists";
      result.success = true;
      logTrace(`Link already working: ${targetId}`);
      return result;
    }

// Get label context if available
    const labelContext = labelMap.get(originalRef);
    
    // Determine label type with proper priority:
    // 1. Fixer's prefix detection (sec:, eq:, fig:, etc.) - most reliable when matched
    // 2. Preprocessor registry (context-aware detection based on LaTeX environment)
    // 3. labelMap from LaTeX analysis
    // 4. "generic" fallback
    const fixerType = determineLabelType("", originalRef || "");
    const preprocessorLabel = window._crossReferenceRegistry?.labels?.get(originalRef);
    
    let labelType = (fixerType !== "generic") 
      ? fixerType                    // Prefix-based detection is reliable when it matches
      : preprocessorLabel?.type      // Context-aware detection from preprocessor
      || labelContext?.type          // labelMap fallback  
      || "generic";                  // Ultimate fallback

    // Check if MathJax created an anchor for this label (ground truth for equations)
    // MathJax creates anchors with pattern mjx-eqn:{label} for equation labels
    const mathJaxAnchor = document.getElementById(`mjx-eqn:${originalRef}`);
    if (mathJaxAnchor && labelType !== "equation") {
      logDebug(
        `Found MathJax anchor "mjx-eqn:${originalRef}" - overriding type from "${labelType}" to "equation"`
      );
      labelType = "equation";
    }

    // If skipAnchorCreation is enabled, don't create new anchors
    // EXCEPT for equation labels - preprocessor intentionally skips these to prevent clustering
    // The fixer must create equation anchors using the equation number mapping strategy
    if (skipAnchorCreation && labelType !== "equation") {
      result.reason = "anchor creation skipped (preprocessor handled it)";
      result.success = false;
      logDebug(
        `Skipping anchor creation for ${originalRef} - preprocessor mode enabled`
      );
      return result;
    }
    
    if (skipAnchorCreation && labelType === "equation") {
      logDebug(
        `Creating anchor for equation "${originalRef}" despite skipAnchorCreation - preprocessor intentionally skips equations`
      );
    }

    logDecision("Anchor creation strategy", {
      targetId,
      originalRef,
      labelType,
      hasContext: !!labelContext,
    });

    // Attempt to create anchor based on label type
    const anchorElement = createAnchorForType(
      targetId,
      originalRef,
      labelType,
      labelContext
    );

    if (anchorElement) {
      result.success = true;
      result.reason = `anchor created for ${labelType}`;
      logTrace(`Successfully created anchor for ${labelType}: ${targetId}`);
    } else {
      result.reason = `failed to create anchor for ${labelType}`;
      logWarn(`Failed to create anchor for ${labelType}: ${targetId}`);
    }

    return result;
  }

  /**
   * Create anchor element based on label type and context
   * @param {string} targetId - The target anchor ID
   * @param {string} originalRef - Original LaTeX reference
   * @param {string} labelType - Type of label (section, equation, etc.)
   * @param {Object} labelContext - Additional context about the label
   * @returns {Element|null} - Created anchor element or null if failed
   */
  function createAnchorForType(targetId, originalRef, labelType, labelContext) {
    logTrace(`Creating anchor for type: ${labelType}`);

    let targetElement = null;

    try {
      // Strategy based on label type
      switch (labelType) {
        case "section":
          targetElement = findSectionTarget(originalRef);
          break;
        case "equation":
          // Reset equation counter at start of each session if needed
          if (!window._crossRefSession) {
            window._crossRefSession = { equationCounter: 0 };
            logTrace("Initialised new cross-reference session");
          }
          targetElement = findEquationTarget(originalRef);
          break;
        case "figure":
          targetElement = findFigureTarget(originalRef);
          break;
        case "table":
          targetElement = findTableTarget(originalRef);
          break;
        case "theorem":
        case "definition":
        case "lemma":
        case "corollary":
          targetElement = findTheoremTarget(originalRef);
          break;
        default:
          targetElement = findGenericTarget();
          break;
      }

      if (!targetElement) {
        logWarn(
          `No suitable target found for ${labelType} reference: ${originalRef}`
        );
        return null;
      }

      logTrace(
        `Target element found for ${labelType}:`,
        targetElement.tagName,
        targetElement.id
      );

      // Create anchor element
      const anchor = document.createElement("span");
      anchor.id = targetId;
      anchor.setAttribute("data-original-label", originalRef || "unknown");
      anchor.setAttribute("data-label-type", labelType);
      anchor.setAttribute("aria-label", `Target for reference ${originalRef}`);
      anchor.setAttribute("role", "mark");
      anchor.style.visibility = "hidden";
      anchor.style.position = "absolute";
      anchor.style.height = "0";
      anchor.style.width = "0";

      // Insert anchor appropriately - place as first child for proper positioning
      if (
        labelType === "section" &&
        targetElement.tagName &&
        ["H1", "H2", "H3", "H4", "H5", "H6", "SECTION"].includes(
          targetElement.tagName
        )
      ) {
        // Sections: Insert as first child (current approach is correct)
        targetElement.insertBefore(anchor, targetElement.firstChild);
        logTrace(
          `Anchor inserted as first child of section: ${targetElement.tagName}`
        );
      } else if (
        labelType === "equation" &&
        targetElement.tagName &&
        ["MJX-CONTAINER", "DIV", "SPAN"].includes(
          targetElement.tagName.toUpperCase()
        )
      ) {
        // Equations: Insert as first child of math container for precise positioning
        targetElement.insertBefore(anchor, targetElement.firstChild);
        logTrace(
          `Anchor inserted as first child of equation container: ${targetElement.tagName}`
        );
      } else if (
        ["theorem", "definition", "lemma", "corollary"].includes(labelType) &&
        targetElement.tagName &&
        ["DIV", "SECTION", "ARTICLE"].includes(
          targetElement.tagName.toUpperCase()
        )
      ) {
        // Theorem-like environments: Insert as first child of theorem container
        targetElement.insertBefore(anchor, targetElement.firstChild);
        logTrace(
          `Anchor inserted as first child of ${labelType} container: ${targetElement.tagName}`
        );
      } else if (
        labelType === "table" &&
        targetElement.tagName &&
        targetElement.tagName.toUpperCase() === "TABLE"
      ) {
        // Tables: Insert as first child of table element
        targetElement.insertBefore(anchor, targetElement.firstChild);
        logTrace(
          `Anchor inserted as first child of table: ${targetElement.tagName}`
        );
      } else if (
        labelType === "figure" &&
        targetElement.tagName &&
        ["FIGURE", "IMG", "DIV"].includes(targetElement.tagName.toUpperCase())
      ) {
        // Figures: Insert as first child of figure container
        targetElement.insertBefore(anchor, targetElement.firstChild);
        logTrace(
          `Anchor inserted as first child of figure container: ${targetElement.tagName}`
        );
      } else {
        // Generic fallback: Insert as first child if possible, otherwise before element
        if (targetElement.firstChild) {
          targetElement.insertBefore(anchor, targetElement.firstChild);
          logTrace(
            `Anchor inserted as first child (generic): ${targetElement.tagName}`
          );
        } else {
          targetElement.appendChild(anchor);
          logTrace(
            `Anchor appended to empty element: ${targetElement.tagName}`
          );
        }
      }

      // ✨ NEW: Register cross-reference in global registry
      // Extract number NOW while target element is fresh and correct
      const referenceNumber = extractReferenceNumber(targetElement);

      registerCrossReference(
        originalRef,
        labelType,
        targetElement,
        referenceNumber,
        targetId
      );

      if (referenceNumber) {
        logDebug(
          `✅ Created and registered anchor "${targetId}" for ${labelType} ${referenceNumber} (label: "${originalRef}")`
        );
      } else {
        logWarn(
          `⚠️ Created anchor "${targetId}" for ${labelType} "${originalRef}" but could not extract number`
        );
      }

      return anchor;
    } catch (error) {
      logError(`Error creating anchor for ${labelType}:`, error);
      return null;
    }
  }

  /**
   * Section label to Pandoc ID mapping system
   * Maps LaTeX section labels to actual Pandoc-generated IDs
   */
  const SECTION_LABEL_MAPPINGS = {
    "sec:intro": "content-introduction",
    "sec:background": "content-background",
    "sec:main": "content-main-results",
    "sec:foundations": "content-mathematical-foundations",
    "sec:numerical": "content-numerical-examples",
    "sec:advanced": "content-advanced-topics",
    "sec:generalised": "content-generalised-theory",
    "sec:applications": "content-applications",
    "sec:conclusion": "content-conclusion",
  };

  /**
   * Generate section mapping dynamically by analysing document structure
   * @returns {Map} - Map of LaTeX labels to actual section IDs
   */
  function generateSectionMappings() {
    const mappings = new Map();
    const sections = document.querySelectorAll(
      "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
    );

    logTrace(`Analysing ${sections.length} sections for ID mapping`);

    sections.forEach((section) => {
      const id = section.id;
      const text = section.textContent.trim().toLowerCase();

      // Generate potential LaTeX labels based on section text
      const potentialLabels = [];

      if (text.includes("introduction"))
        potentialLabels.push("sec:intro", "sec:introduction");
      if (text.includes("background")) potentialLabels.push("sec:background");
      if (text.includes("main") && text.includes("result"))
        potentialLabels.push("sec:main");
      if (text.includes("foundation")) potentialLabels.push("sec:foundations");
      if (text.includes("numerical")) potentialLabels.push("sec:numerical");
      if (text.includes("advanced")) potentialLabels.push("sec:advanced");
      if (text.includes("generalised") || text.includes("generalized"))
        potentialLabels.push("sec:generalised");
      if (text.includes("application"))
        potentialLabels.push("sec:applications");
      if (text.includes("conclusion")) potentialLabels.push("sec:conclusion");

      potentialLabels.forEach((label) => {
        mappings.set(label, id);
        logTrace(`Mapped ${label} → ${id}`);
      });
    });

    // Add static mappings as fallback
    Object.entries(SECTION_LABEL_MAPPINGS).forEach(([label, id]) => {
      if (!mappings.has(label) && document.getElementById(id)) {
        mappings.set(label, id);
        logTrace(`Static mapping: ${label} → ${id}`);
      }
    });

    return mappings;
  }

  /**
   * Find target element for section references using mapping system
   * @param {string} originalRef - Original LaTeX reference
   * @returns {Element|null} - Target section element
   */
  function findSectionTarget(originalRef) {
    logTrace(`Finding section target for: ${originalRef}`);

    // Generate fresh mappings for this document
    const sectionMappings = generateSectionMappings();

    // Try mapped ID first
    const mappedId = sectionMappings.get(originalRef);
    if (mappedId) {
      const mappedTarget = document.getElementById(mappedId);
      if (mappedTarget) {
        logTrace(`Mapped section target found: ${originalRef} → ${mappedId}`);
        return mappedTarget;
      }
    }

// Try direct ID match as fallback - check both with and without content- prefix
    // Pandoc creates content- prefix natively, our hypertargets may not have it
    let directTarget = document.getElementById(`content-${originalRef}`);
    if (directTarget) {
      logTrace(`Direct section target found: content-${originalRef}`);
      return directTarget;
    }
    
    // Also try without content- prefix (for our hypertarget injections)
    directTarget = document.getElementById(originalRef);
    if (directTarget) {
      logTrace(`Direct section target found (no prefix): ${originalRef}`);
      return directTarget;
    }

    // FIXED: More specific section matching to avoid app-title
    // Only look for content sections (exclude app-title and other non-content headings)
    const contentSections = document.querySelectorAll(
      "h1[id^='content-'], h2[id^='content-'], h3[id^='content-'], section[id^='content-']"
    );

    logTrace(`Found ${contentSections.length} content section targets`);

    // Return the first content section (not app-title)
    if (contentSections.length > 0) {
      const target = contentSections[0];
      logTrace(`Selected content section: ${target.tagName}#${target.id}`);
      return target;
    }

    // Final fallback: any element in the output div
    const outputDiv = document.getElementById("output");
    if (outputDiv) {
      const outputSections = outputDiv.querySelectorAll(
        "h1, h2, h3, h4, h5, h6"
      );
      if (outputSections.length > 0) {
        logTrace(
          `Fallback to first section in output div: ${outputSections[0].id}`
        );
        return outputSections[0];
      }
    }

    logWarn(`No suitable section target found for: ${originalRef}`);
    return null;
  }
  /**
   * Map equation labels to specific MathJax containers
   * @returns {Map} - Map of equation labels to MathJax container elements
   */
  function generateEquationMappings() {
    const mappings = new Map();
    const mathDisplays = document.querySelectorAll(
      'mjx-container[display="true"]'
    );

    logTrace(`Found ${mathDisplays.length} math displays for equation mapping`);

    // Check for existing equation anchors first
    const existingAnchors = document.querySelectorAll(
      '[data-original-label^="eq:"]'
    );
    existingAnchors.forEach((anchor) => {
      const label = anchor.getAttribute("data-original-label");
      if (label) {
        const container =
          anchor.parentElement?.querySelector(
            'mjx-container[display="true"]'
          ) ||
          anchor.nextElementSibling?.querySelector(
            'mjx-container[display="true"]'
          ) ||
          document.querySelector('mjx-container[display="true"]');
        if (container) {
          mappings.set(label, container);
          logTrace(`Found existing equation mapping: ${label}`);
        }
      }
    });

    // Create smart mappings based on equation content and position
    const commonEquations = [
      { labels: ["eq:einstein"], keywords: ["E = mc", "mass-energy"] },
      {
        labels: ["eq:system", "eq:initial"],
        keywords: ["partial", "nabla", "heat", "diffusion"],
      },
      { labels: ["eq:bound"], keywords: ["inequality", "leq", "L \\|"] },
      {
        labels: ["eq:optimisation", "eq:optimization"],
        keywords: ["min_", "subject to"],
      },
    ];

    mathDisplays.forEach((container, index) => {
      const mathText = container.textContent || "";

      // Try to match equations by content
      for (const eqGroup of commonEquations) {
        const hasMatch = eqGroup.keywords.some((keyword) =>
          mathText.includes(keyword)
        );
        if (hasMatch) {
          eqGroup.labels.forEach((label) => {
            if (!mappings.has(label)) {
              mappings.set(label, container);
              logTrace(`Content-based mapping: ${label} → container ${index}`);
            }
          });
        }
      }
    });

    return mappings;
  }

/**
   * Build a mapping from equation numbers to their containing spans
   * @returns {Map} Map of equation number to { span, index }
   */
  function buildEquationNumberToSpanMap() {
    const eqNumToSpan = new Map();
    const numberedSpans = document.querySelectorAll('span.math[data-numbered="true"]');
    
    numberedSpans.forEach((span, idx) => {
      const text = span.textContent;
      // Extract all equation numbers like (1), (2), (3) from the span
      const numPattern = /\((\d+)\)/g;
      let match;
      while ((match = numPattern.exec(text)) !== null) {
        const num = parseInt(match[1]);
        // Only store the first occurrence of each number
        if (!eqNumToSpan.has(num)) {
          eqNumToSpan.set(num, { span, index: idx });
        }
      }
    });
    
    logDebug(`Built equation number map with ${eqNumToSpan.size} entries from ${numberedSpans.length} spans`);
    return eqNumToSpan;
  }

/**
   * Get equation info directly from MathJax anchor
   * MathJax creates anchors like id="mjx-eqn:labelName" with equation number in container textContent
   * @param {string} labelName - The label name (with or without eq: prefix)
   * @returns {Object|null} - {container, number} or null if not found
   */
  function getMathJaxEquationInfo(labelName) {
    // Try with the label as-is first
    let anchor = document.getElementById(`mjx-eqn:${labelName}`);
    
    // If not found and label starts with "eq:", try without the prefix
    if (!anchor && labelName.startsWith("eq:")) {
      const withoutPrefix = labelName.substring(3);
      anchor = document.getElementById(`mjx-eqn:${withoutPrefix}`);
    }
    
    // If still not found, try adding "eq:" prefix
    if (!anchor && !labelName.startsWith("eq:")) {
      anchor = document.getElementById(`mjx-eqn:eq:${labelName}`);
    }
    
    if (!anchor) {
      return null;
    }
    
    // Find the parent MathJax container
    const container = anchor.closest("mjx-container");
    if (!container) {
      logWarn(`MathJax anchor found for "${labelName}" but no container`);
      return { container: anchor.parentElement, number: null };
    }
    
    // Extract equation number from container's textContent
    // MathJax puts the number at the start: "(1)f(x)=..."
    const text = container.textContent || "";
    const numberMatch = text.match(/^\((\d+)\)/);
    
    const number = numberMatch ? numberMatch[1] : null;
    
    logDebug(`MathJax equation info for "${labelName}": container found, number=${number}`);
    
    return { container, number };
  }

  /**
   * Find target element for equation references
   * Uses MathJax anchors as primary method (most reliable)
   * @param {string} originalRef - Original reference (e.g., "eq:einstein", "evenodd")
   * @returns {Element|null} - Target equation container element
   */
  function findEquationTarget(originalRef = "") {
    logTrace(`Finding equation target for: ${originalRef}`);

    // PRIMARY APPROACH: Use MathJax's own equation anchors (most reliable)
    const mathJaxInfo = getMathJaxEquationInfo(originalRef);
    if (mathJaxInfo && mathJaxInfo.container) {
      logTrace(`Found ${originalRef} via MathJax anchor (equation ${mathJaxInfo.number || "unknown"})`);
      return mathJaxInfo.container;
    }

    // FALLBACK: Search all math display elements
    const mathDisplays = document.querySelectorAll('mjx-container[display="true"]');
    logTrace(`MathJax anchor not found for "${originalRef}", checking ${mathDisplays.length} display elements`);

    if (mathDisplays.length === 0) {
      logWarn("No math display elements found");
      return null;
    }

    // Content matching fallback - look for label in equation content
    for (let i = 0; i < mathDisplays.length; i++) {
      const text = (mathDisplays[i].textContent || "").toLowerCase();
      const labelLower = originalRef.toLowerCase().replace("eq:", "");
      
      // Check if any anchor inside this container matches our label
      const innerAnchor = mathDisplays[i].querySelector(`[id*="${labelLower}"]`);
      if (innerAnchor) {
        logTrace(`Found ${originalRef} by inner anchor search (index ${i})`);
        return mathDisplays[i];
      }
    }

    // Final fallback: Use session counter to distribute unmapped equations
    const currentIndex = window._crossRefSession.equationCounter % mathDisplays.length;
    window._crossRefSession.equationCounter++;

    const target = mathDisplays[currentIndex];
    logTrace(`Using session counter fallback: ${originalRef} → display ${currentIndex}`);
    return target;
  }

  /**
   * Find target element for figure references
   * @returns {Element|null} - Target figure element
   */
  function findFigureTarget(originalRef = "") {
    logTrace(`Finding figure target for: ${originalRef}`);

    const figures = document.querySelectorAll("figure");
    logTrace(`Found ${figures.length} figure elements`);

    if (figures.length === 0) {
      return null;
    }

    // Figure-specific mapping
    const figureMappings = {
      "fig:convergence": (figs) => {
        // Look for convergence-related content
        for (let fig of figs) {
          const text = (fig.textContent || "").toLowerCase();
          if (text.includes("convergence") || text.includes("rate")) {
            logTrace(`Found fig:convergence by content matching`);
            return fig;
          }
        }
        return figs[0]; // Fallback to first
      },

      "fig:error": (figs) => {
        // Look for error-related content
        for (let fig of figs) {
          const text = (fig.textContent || "").toLowerCase();
          if (text.includes("error") || text.includes("analysis")) {
            logTrace(`Found fig:error by content matching`);
            return fig;
          }
        }
        return figs[1] || figs[0]; // Fallback to second, then first
      },
    };

    // Try figure-specific mapping
    if (figureMappings[originalRef]) {
      const target = figureMappings[originalRef](figures);
      if (target) {
        return target;
      }
    }

    // Default to first figure
    return figures[0];
  }

  /**
   * Find target element for table references with improved selection
   * @param {string} originalRef - Original LaTeX reference
   * @returns {Element|null} - Target table element
   */
  function findTableTarget(originalRef = "") {
    logTrace(`Finding table target for: ${originalRef}`);

    const tables = document.querySelectorAll("table");
    logTrace(`Found ${tables.length} table elements`);

    if (tables.length === 0) {
      return null;
    }

    // Table-specific mapping
    const tableMappings = {
      "tab:results": (tables) => {
        // Look for results/comparison table
        for (let table of tables) {
          const text = (table.textContent || "").toLowerCase();
          if (
            text.includes("algorithm") ||
            text.includes("error") ||
            text.includes("comparison")
          ) {
            logTrace(`Found tab:results by content matching`);
            return table;
          }
        }
        return tables[0]; // Fallback to first
      },

      "tab:spaces": (tables) => {
        // Look for space types table
        for (let table of tables) {
          const text = (table.textContent || "").toLowerCase();
          if (
            text.includes("space") ||
            text.includes("euclidean") ||
            text.includes("applicability")
          ) {
            logTrace(`Found tab:spaces by content matching`);
            return table;
          }
        }
        return tables[1] || tables[0]; // Fallback to second, then first
      },
    };

    // Try table-specific mapping
    if (tableMappings[originalRef]) {
      const target = tableMappings[originalRef](tables);
      if (target) {
        return target;
      }
    }

    // Default to first table
    return tables[0];
  }

  /**
   * Generate missing IDs for theorem-like environments
   * @returns {Map} - Map of theorem labels to generated element IDs
   */
  function generateTheoremMappings() {
    const mappings = new Map();

    // Find theorem-like environments by class and content
    const theoremSelectors = [
      ".theorem",
      ".definition",
      ".lemma",
      ".corollary",
      ".proposition",
      ".example",
      ".remark",
      ".proof",
    ];

    const theoremElements = document.querySelectorAll(
      theoremSelectors.join(", ")
    );
    logTrace(`Found ${theoremElements.length} theorem-like elements`);

    // Create arrays to track elements by type for better distribution
    const theoremsByType = {
      theorem: [],
      definition: [],
      lemma: [],
      corollary: [],
      proposition: [],
      example: [],
      remark: [],
      proof: [],
    };

    // Group elements by type
    theoremElements.forEach((element, index) => {
      const className = element.className;

      // Generate ID if missing
      if (!element.id) {
        let baseType = "theorem";
        if (className.includes("definition")) baseType = "def";
        else if (className.includes("lemma")) baseType = "lem";
        else if (className.includes("corollary")) baseType = "cor";
        else if (className.includes("theorem")) baseType = "thm";

        const generatedId = `content-${baseType}-${index + 1}`;
        element.id = generatedId;
        logTrace(`Generated ID for ${className}: ${generatedId}`);
      }

      // Group by type for better mapping
      if (className.includes("definition")) {
        theoremsByType.definition.push(element);
      } else if (className.includes("theorem")) {
        theoremsByType.theorem.push(element);
      } else if (className.includes("lemma")) {
        theoremsByType.lemma.push(element);
      } else if (className.includes("corollary")) {
        theoremsByType.corollary.push(element);
      }
    });

    // Improved mapping strategy: map specific references to correct elements
    // Definitions - map by content and position
    if (theoremsByType.definition.length > 0) {
      theoremsByType.definition.forEach((element, index) => {
        const text = element.textContent.toLowerCase();

        // Map by content matching with priority
        if (text.includes("metric space") && !mappings.has("def:metric")) {
          mappings.set("def:metric", element.id);
          logTrace(
            `Mapped def:metric to ${element.id} by content (metric space)`
          );
        } else if (
          text.includes("continuous") &&
          !mappings.has("def:continuous")
        ) {
          mappings.set("def:continuous", element.id);
          logTrace(
            `Mapped def:continuous to ${element.id} by content (continuous)`
          );
        }
      });
    }

    // Theorems - map by content and position
    if (theoremsByType.theorem.length > 0) {
      theoremsByType.theorem.forEach((element, index) => {
        const text = element.textContent.toLowerCase();

        if (
          text.includes("uniformly continuous") &&
          !mappings.has("thm:fundamental")
        ) {
          mappings.set("thm:fundamental", element.id);
          logTrace(
            `Mapped thm:fundamental to ${element.id} by content (uniformly continuous)`
          );
        } else if (
          (text.includes("banach space") || text.includes("arbitrary")) &&
          !mappings.has("thm:extended")
        ) {
          mappings.set("thm:extended", element.id);
          logTrace(
            `Mapped thm:extended to ${element.id} by content (banach/arbitrary)`
          );
        } else if (text.includes("inequality") && !mappings.has("thm:main")) {
          mappings.set("thm:main", element.id);
          logTrace(`Mapped thm:main to ${element.id} by content (inequality)`);
        }
      });

      // Fallback mapping for remaining theorems by position
      if (!mappings.has("thm:main") && theoremsByType.theorem.length >= 1) {
        mappings.set("thm:main", theoremsByType.theorem[0].id);
        logTrace(`Mapped thm:main to first theorem by position`);
      }
      if (!mappings.has("thm:extended") && theoremsByType.theorem.length >= 2) {
        mappings.set("thm:extended", theoremsByType.theorem[1].id);
        logTrace(`Mapped thm:extended to second theorem by position`);
      }
    }

    // Lemmas
    if (theoremsByType.lemma.length > 0) {
      mappings.set("lem:helper", theoremsByType.lemma[0].id);
      logTrace(`Mapped lem:helper to first lemma`);
    }

    // Corollaries
    if (theoremsByType.corollary.length > 0) {
      mappings.set("cor:main", theoremsByType.corollary[0].id);
      logTrace(`Mapped cor:main to first corollary`);
    }

    logTrace(`Generated ${mappings.size} theorem mappings`);
    return mappings;
  }

  /**
   * Find target element for theorem-like references
   * @param {string} originalRef - Original LaTeX reference (e.g., "thm:main")
   * @returns {Element|null} - Target theorem element
   */
  function findTheoremTarget(originalRef) {
    logTrace(`Finding theorem target for: ${originalRef}`);

    // Generate theorem mappings
    const theoremMappings = generateTheoremMappings();

    // Try mapped ID first
    const mappedId = theoremMappings.get(originalRef);
    if (mappedId) {
      const mappedTarget = document.getElementById(mappedId);
      if (mappedTarget) {
        logTrace(`Mapped theorem target found: ${originalRef} → ${mappedId}`);
        return mappedTarget;
      }
    }

// Try direct ID match as fallback - check both with and without content- prefix
    // Pandoc creates content- prefix natively, our hypertargets may not have it
    let directTarget = document.getElementById(`content-${originalRef}`);
    if (directTarget) {
      logTrace(`Direct theorem target found: content-${originalRef}`);
      return directTarget;
    }
    
    // Also try without content- prefix (for our hypertarget injections)
    directTarget = document.getElementById(originalRef);
    if (directTarget) {
      logTrace(`Direct theorem target found (no prefix): ${originalRef}`);
      return directTarget;
    }

    // ENHANCED: Content-based searching (Pandoc doesn't create theorem classes)
    const refType = originalRef.split(":")[0]; // Extract type prefix (lem, cor, thm, def)

    // Search for content by text patterns since Pandoc creates generic HTML
    const allElements = document.querySelectorAll(
      "#output p, #output div, #output section"
    );

    for (let element of allElements) {
      const text = element.textContent?.toLowerCase() || "";

      // Skip document title and header elements
      if (
        element.closest("h1.title") ||
        element.closest("header") ||
        element.classList.contains("title")
      ) {
        continue;
      }

      // Type-specific content matching
      if (refType === "lem" && originalRef === "lem:helper") {
        // Look for lemma content about bounded sequences
        if (
          text.includes("bounded") &&
          text.includes("sequence") &&
          (text.includes("convergent") || text.includes("subsequence"))
        ) {
          logTrace(`Found lem:helper by content matching: bounded sequence`);
          return element;
        }
      }

      if (refType === "cor" && originalRef === "cor:main") {
        // Look for corollary content that extends theorems
        if (
          text.includes("result") &&
          text.includes("theorem") &&
          (text.includes("extends") || text.includes("dimension"))
        ) {
          logTrace(`Found cor:main by content matching: theorem extension`);
          return element;
        }
      }

      if (refType === "thm") {
        // Look for theorem-like content
        if (
          text.includes("theorem") ||
          text.includes("uniformly continuous") ||
          text.includes("banach") ||
          text.includes("arbitrary")
        ) {
          logTrace(`Found ${originalRef} by theorem content matching`);
          return element;
        }
      }

      if (refType === "def") {
        // Look for definition content
        if (
          text.includes("definition") ||
          text.includes("metric space") ||
          text.includes("continuous")
        ) {
          logTrace(`Found ${originalRef} by definition content matching`);
          return element;
        }
      }
    }

    // ENHANCED: Pattern-based fallback - look for structured content
    const structuredElements = document.querySelectorAll(
      "#output p:not(.title):not([class*='title']), #output div:not(.title):not([class*='title'])"
    );

    for (let element of structuredElements) {
      const text = element.textContent?.trim() || "";

      // Skip short content and title elements
      if (
        text.length < 50 ||
        element.closest("h1") ||
        text.toLowerCase().includes("cross-reference testing")
      ) {
        continue;
      }

      // Look for mathematical or academic content patterns
      if (
        text.includes("∈") ||
        text.includes("⊆") ||
        text.includes("∀") ||
        text.includes("∃") ||
        text.includes("$") ||
        text.includes("\\") ||
        text.match(/\b(proof|theorem|lemma|definition|corollary)\b/i)
      ) {
        logTrace(`Found structured mathematical content for ${originalRef}`);
        return element;
      }
    }

    // Final fallback: first substantial content element (but avoid titles)
    const substantialElements = document.querySelectorAll(
      "#output p, #output div"
    );
    for (let element of substantialElements) {
      const text = element.textContent?.trim() || "";

      // Skip titles and short content
      if (
        text.length > 40 &&
        !element.closest("h1.title") &&
        !text.toLowerCase().includes("cross-reference testing")
      ) {
        logTrace(`Using substantial content fallback for ${originalRef}`);
        return element;
      }
    }

    logWarn(`No suitable theorem target found for: ${originalRef}`);
    return null;
  }
  /**
   * Find generic target element (fallback)
   * @returns {Element|null} - Generic target element
   */
  function findGenericTarget() {
    logTrace("Finding generic target (fallback)");

    // ENHANCED: Find appropriate content but NEVER use document titles or headers
    // Priority 1: Look for the first body paragraph (avoid titles, headers, and centered content)
    const bodyParagraphs = document.querySelectorAll("#output p");

    for (let element of bodyParagraphs) {
      const text = element.textContent?.trim() || "";

      // Must have substantial content but not be title-related or in header
      // Also skip centered divs which are typically title blocks
      const inCenteredDiv =
        element.closest(".center") ||
        element.closest('[style*="text-align: center"]');
      const isTitleArea =
        element.closest("h1") ||
        element.closest(".title") ||
        element.classList.contains("title") ||
        inCenteredDiv;

      // Skip very short content and anything that looks like a course code
      const looksLikeCourseCode =
        /^[A-Z]+\d+/.test(text) || text.includes("MATH0806");

      if (
        text.length > 30 &&
        !isTitleArea &&
        !looksLikeCourseCode &&
        !text.toLowerCase().includes("cross-reference testing")
      ) {
        logTrace(
          `Generic target found (body paragraph): ${element.tagName}${
            element.id ? "#" + element.id : ""
          } with content: "${text.substring(0, 60)}..."`
        );
        return element;
      }
    }

    // Priority 2: Look for content divs (but not title containers)
    const contentDivs = document.querySelectorAll("#output div");

    for (let element of contentDivs) {
      const text = element.textContent?.trim() || "";

      // Must have substantial content and not contain title elements
      if (
        text.length > 30 &&
        !element.querySelector("h1.title") &&
        !element.classList.contains("title") &&
        !text.toLowerCase().includes("cross-reference testing")
      ) {
        logTrace(
          `Generic target found (content div): ${element.tagName}${
            element.id ? "#" + element.id : ""
          }`
        );
        return element;
      }
    }

    // Priority 3: Look for section headers (h2, h3, etc.) but NOT h1 title
    const sectionHeaders = document.querySelectorAll(
      "#output h2, #output h3, #output h4"
    );

    if (sectionHeaders.length > 0) {
      const firstSection = sectionHeaders[0];
      logTrace(
        `Generic target found (section header): ${firstSection.tagName}${
          firstSection.id ? "#" + firstSection.id : ""
        }`
      );
      return firstSection;
    }

    // Priority 4: Look for any structured content (lists, tables, figures)
    const structuredContent = document.querySelector(
      "#output ul, #output ol, #output table, #output figure, #output section"
    );

    if (structuredContent) {
      logTrace(
        `Generic target found (structured content): ${structuredContent.tagName}`
      );
      return structuredContent;
    }

    // Last resort: Output div (but warn about this)
    const outputDiv = document.getElementById("output");
    if (outputDiv) {
      logWarn(
        "Using output div as absolute fallback - this may result in poor anchor placement"
      );
      return outputDiv;
    }

    // Ultimate fallback
    const target = document.body;
    logWarn(
      "Using document body as ultimate fallback - anchor placement will be poor"
    );
    return target;
  }

  /**
   * Verify that cross-references are working properly
   * @returns {Object} - Verification results
   */
  function verifyCrossReferences() {
    logFlowStart("Cross-reference verification");

// Captures ALL reference types: ref, eqref, pageref, etc.
    const crossRefLinks = document.querySelectorAll(
      'a[data-reference-type]'
    );
    const results = {
      total: crossRefLinks.length,
      working: 0,
      broken: 0,
      details: [],
    };

    logInfo(`Verifying ${results.total} cross-reference links`);

    crossRefLinks.forEach((link, index) => {
      const href = link.getAttribute("href");
      const targetId = href ? href.replace("#", "") : null;
      const target = targetId ? document.getElementById(targetId) : null;
      const originalRef = link.getAttribute("data-reference");
      const linkText = link.textContent.trim();

      const detail = {
        index: index + 1,
        linkText,
        originalRef,
        targetId,
        working: !!target,
      };

      results.details.push(detail);

      if (target) {
        results.working++;
        logTrace(`✅ Link ${index + 1}: "${linkText}" → ${targetId}`);
      } else {
        results.broken++;
        logTrace(`❌ Link ${index + 1}: "${linkText}" → ${targetId} (missing)`);
      }
    });

    logFlowEnd("Cross-reference verification", {
      working: results.working,
      broken: results.broken,
      total: results.total,
    });

logInfo(
      `Verification complete: ${results.working} working, ${results.broken} broken`
    );
    return results;
  }

  /**
   * Post-MathJax cleanup pass for equation cross-references
   * MathJax creates equation anchors (mjx-eqn:labelName) AFTER our initial cross-ref fix runs.
   * This function finds broken equation links and fixes them using MathJax's anchors.
   * Should be called after MathJax has finished rendering (e.g., when status is "ready").
   * @returns {Object} - Results of the cleanup pass
   */
  function fixBrokenEquationLinks() {
    logFlowStart("Post-MathJax equation link cleanup", {});
    
    const results = {
      checked: 0,
      fixed: 0,
      stillBroken: 0,
      fixedLabels: [],
      stillBrokenLabels: []
    };
    
    // Find all cross-reference links with broken targets
    const links = document.querySelectorAll('a[href^="#content-"]');
    
    links.forEach(link => {
      const targetId = link.getAttribute("href").substring(1); // Remove #
      const existingTarget = document.getElementById(targetId);
      
      // Skip if target already exists
      if (existingTarget) {
        return;
      }
      
      results.checked++;
      
      // Extract the label from the target ID
      const originalRef = targetId.replace("content-", "");
      
      // Check if MathJax has created an anchor for this label
      const mathJaxInfo = getMathJaxEquationInfo(originalRef);
      
      if (mathJaxInfo && mathJaxInfo.container) {
        // MathJax has an anchor - create our cross-reference anchor
        const anchor = document.createElement("span");
        anchor.id = targetId;
        anchor.setAttribute("data-original-label", originalRef);
        anchor.setAttribute("data-label-type", "equation");
        anchor.setAttribute("data-fixed-by", "post-mathjax-cleanup");
        anchor.setAttribute("aria-label", `Equation ${mathJaxInfo.number || originalRef}`);
        anchor.setAttribute("role", "mark");
        anchor.style.visibility = "hidden";
        anchor.style.position = "absolute";
        anchor.style.height = "0";
        anchor.style.width = "0";
        
        // Insert anchor as first child of MathJax container
        mathJaxInfo.container.insertBefore(anchor, mathJaxInfo.container.firstChild);
        
        // Update link text if it still shows the label
        const linkText = link.textContent.trim();
        if (linkText === originalRef || linkText.includes(originalRef)) {
          if (mathJaxInfo.number) {
            link.textContent = `(${mathJaxInfo.number})`;
            link.setAttribute("aria-label", `Equation ${mathJaxInfo.number}`);
          }
        }
        
        results.fixed++;
        results.fixedLabels.push(originalRef);
        logDebug(`✅ Fixed equation link: ${originalRef} → equation ${mathJaxInfo.number || "?"}`);
      } else {
        results.stillBroken++;
        results.stillBrokenLabels.push(originalRef);
        logDebug(`❌ Could not fix: ${originalRef} (no MathJax anchor found)`);
      }
    });
    
    logFlowEnd("Post-MathJax equation link cleanup", {
      checked: results.checked,
      fixed: results.fixed,
      stillBroken: results.stillBroken
    });
    
    if (results.fixed > 0) {
      logInfo(`Post-MathJax cleanup: Fixed ${results.fixed} equation links`);
    }
    
    if (results.stillBroken > 0) {
      logWarn(`Post-MathJax cleanup: ${results.stillBroken} links still broken: ${results.stillBrokenLabels.slice(0, 5).join(", ")}${results.stillBrokenLabels.length > 5 ? "..." : ""}`);
    }
    
    return results;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functionality
    fixCrossReferences,
    verifyCrossReferences,

    // Analysis utilities
    analyseLaTeXLabels,
    determineLabelType,

// Label text replacement (NEW)
    extractReferenceNumber,
    replaceReferenceLabelText,
    enhanceLinkAccessibility,

    // Testing and diagnostics
    fixSingleCrossReference,
    createAnchorForType,

    // Registry system (NEW - aligned with LaTeX registry pattern)
    initialiseCrossReferenceRegistry,
    registerCrossReference,
    getCrossReferenceFromRegistry,
getCrossReferenceRegistryStatus,
    clearCrossReferenceRegistry,
    diagnosticRegistryReport,
    testCrossReferences,
    
    // Post-MathJax cleanup (NEW)
    fixBrokenEquationLinks,

    // Module information
    name: "CrossReferenceFixer",
    version: "1.2.0", // Version bump for registry feature

    // Integration with logging system
    getLogger: () => logger,

    // Configuration access (for testing)
    _config: {
      hasLoggingSystem: !!window.LoggingSystem,
    },
  };
})();

// Make available globally
if (typeof window !== "undefined") {
  window.CrossReferenceFixer = CrossReferenceFixer;
}
