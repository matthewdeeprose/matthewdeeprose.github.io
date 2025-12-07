// latex-export-verifier.js
// LaTeX Export Verification System
// Programmatic comparison of source LaTeX against exported HTML
// Designed for large document support (500+ expressions) with LLM-friendly diagnostics

const LatexExportVerifier = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[LATEX-VERIFY]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LATEX-VERIFY]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LATEX-VERIFY]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LATEX-VERIFY]", message, ...args);
  }

  // ===========================================================================================
  // CONFIGURATION - LARGE FILE ACCOMMODATIONS
  // ===========================================================================================

const CONFIG = {
    maxExpressionsToStore: 1000, // Hard limit with warning
    maxIssuesToShowConsole: 20, // Console shows first N issues
    expressionPreviewLength: 60, // Truncate previews
    hashAlgorithm: "simple", // Use simple string hash (no crypto needed)
    
    // Size thresholds for adaptive behaviour
    thresholds: {
      small: 50,    // Full detail everywhere
      medium: 200,  // Console summary, full in download
      large: 500,   // Grouped console, summary download default
    },
    
    // Cross-reference configuration
    crossRef: {
      // Label prefixes and their expected target types
      labelTypes: {
        "eq": "equation",
        "sec": "section",
        "subsec": "subsection", 
        "tab": "table",
        "fig": "figure",
        "ref": "bibliography",
        "note": "footnote",
        "fn": "footnote",
      },
      // Labels that should display as numbers
      numericDisplayTypes: ["eq", "sec", "subsec", "tab", "fig", "ref"],
    },
  };

  // ===========================================================================================
  // INTERNAL STATE
  // ===========================================================================================

  let sourceInventory = null;
  let sourceCrossReferences = null;
  let lastVerificationResult = null;

  // ===========================================================================================
  // UTILITY FUNCTIONS
  // ===========================================================================================

  /**
   * Simple string hash for expression comparison
   * Fast and collision-resistant enough for our purposes
   * @param {string} str - String to hash
   * @returns {string} - 8-character hex hash
   */
  function simpleHash(str) {
    if (!str) return "00000000";
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to 8-character hex string
    return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
  }

  /**
   * Truncate string with ellipsis for preview
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated string
   */
  function truncate(str, maxLength = CONFIG.expressionPreviewLength) {
    if (!str) return "";
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  /**
   * Estimate line number from character position
   * @param {string} content - Full content
   * @param {number} position - Character position
   * @returns {number} - Approximate line number
   */
  function estimateLineNumber(content, position) {
    if (!content || position < 0) return 0;
    const upToPosition = content.substring(0, Math.min(position, content.length));
    return (upToPosition.match(/\n/g) || []).length + 1;
  }

  /**
   * Get document size category
   * @param {number} expressionCount - Number of expressions
   * @returns {string} - 'small' | 'medium' | 'large' | 'veryLarge'
   */
  function getSizeCategory(expressionCount) {
    if (expressionCount < CONFIG.thresholds.small) return "small";
    if (expressionCount < CONFIG.thresholds.medium) return "medium";
    if (expressionCount < CONFIG.thresholds.large) return "large";
    return "veryLarge";
  }

  /**
   * Normalise LaTeX for comparison (removes whitespace variations)
   * @param {string} latex - LaTeX string
   * @returns {string} - Normalised string
   */
  function normaliseLatex(latex) {
    if (!latex) return "";
    return latex
      .replace(/\s+/g, " ")
      .replace(/\s*([{}\\])\s*/g, "$1")
      .trim();
  }

  // ===========================================================================================
  // PHASE 1: SOURCE INVENTORY CAPTURE
  // ===========================================================================================

  /**
   * Capture source LaTeX inventory from input text
   * Uses LatexPreservationEngine for extraction
   * @param {string} sourceText - Optional source text (defaults to input textarea)
   * @returns {Object} - Inventory with expressions, statistics, and metadata
   */
  function captureSourceInventory(sourceText = null) {
    logInfo("📋 Capturing source LaTeX inventory...");

    try {
      // Get source text from input if not provided
      if (!sourceText) {
        const inputTextarea = document.getElementById("input");
        if (!inputTextarea || !inputTextarea.value.trim()) {
          logWarn("No source text available - input textarea empty");
          return null;
        }
        sourceText = inputTextarea.value;
      }

      // Check for LatexPreservationEngine
      if (!window.LatexPreservationEngine?.extractAndMapLatexExpressions) {
        logError("LatexPreservationEngine not available");
        return null;
      }

      // Extract expressions using existing engine
      const latexMap = window.LatexPreservationEngine.extractAndMapLatexExpressions(sourceText);

      if (!latexMap || Object.keys(latexMap).length === 0) {
        logWarn("No LaTeX expressions found in source");
        return {
          success: true,
          timestamp: new Date().toISOString(),
          sourceLength: sourceText.length,
          expressions: [],
          statistics: {
            total: 0,
            byType: { inline: 0, display: 0, environment: 0 },
            byPattern: {},
          },
          sizeCategory: "small",
        };
      }

      const expressionCount = Object.keys(latexMap).length;
      const sizeCategory = getSizeCategory(expressionCount);

      // Check for very large documents
      if (expressionCount > CONFIG.maxExpressionsToStore) {
        logWarn(
          `⚠️ Very large document detected (${expressionCount} expressions). ` +
          `Only storing first ${CONFIG.maxExpressionsToStore} for verification.`
        );
      }

      // Build compact inventory with hashes
      const expressions = [];
      const expressionEntries = Object.entries(latexMap);
      const limitedEntries = expressionEntries.slice(0, CONFIG.maxExpressionsToStore);

      for (const [index, expr] of limitedEntries) {
        expressions.push({
          index: parseInt(index, 10),
          latex: expr.latex,
          preview: truncate(expr.latex),
          hash: simpleHash(normaliseLatex(expr.latex)),
          type: expr.type,
          pattern: expr.pattern,
          position: expr.position,
          fullLength: expr.latex.length,
          approximateLine: estimateLineNumber(sourceText, expr.position),
        });
      }

// Calculate statistics
      const statistics = {
        total: expressionCount,
        stored: expressions.length,
        truncated: expressionCount > CONFIG.maxExpressionsToStore,
        byType: {
          inline: expressions.filter((e) => e.type === "inline").length,
          display: expressions.filter((e) => e.type === "display").length,
          environment: expressions.filter((e) => e.type === "environment").length,
        },
        byPattern: {},
        duplicateHashes: [],
      };

      expressions.forEach((expr) => {
        statistics.byPattern[expr.pattern] = 
          (statistics.byPattern[expr.pattern] || 0) + 1;
      });

      // Detect duplicate hashes (expressions that hash to same value)
      const hashCounts = {};
      expressions.forEach((expr) => {
        if (!hashCounts[expr.hash]) {
          hashCounts[expr.hash] = [];
        }
        hashCounts[expr.hash].push(expr.index);
      });

      Object.entries(hashCounts).forEach(([hash, indices]) => {
        if (indices.length > 1) {
          statistics.duplicateHashes.push({
            hash: hash,
            count: indices.length,
            indices: indices,
          });
        }
      });

      if (statistics.duplicateHashes.length > 0) {
        logWarn(
          `⚠️ ${statistics.duplicateHashes.length} hash collision(s) detected - ` +
          `verification may be less precise for duplicate expressions`
        );
      }

sourceInventory = {
        success: true,
        timestamp: new Date().toISOString(),
        sourceLength: sourceText.length,
        expressions: expressions,
        statistics: statistics,
        sizeCategory: sizeCategory,
        sourceText: sourceText, // Keep for line estimation
      };

      // Also capture cross-references
      sourceCrossReferences = extractSourceCrossReferences(sourceText);

      logInfo(
        `✅ Captured ${expressions.length} expressions ` +
        `(${sizeCategory} document, ${statistics.byType.inline} inline, ` +
        `${statistics.byType.display} display, ${statistics.byType.environment} env)`
      );

      if (sourceCrossReferences) {
        logInfo(
          `🔗 Captured ${sourceCrossReferences.statistics.totalLabels} labels and ` +
          `${sourceCrossReferences.statistics.totalReferences} references`
        );
      }

      return sourceInventory;
    } catch (error) {
      logError("Error capturing source inventory:", error);
      return null;
    }
  }

  // ===========================================================================================
  // PHASE 1B: SOURCE CROSS-REFERENCE EXTRACTION
  // ===========================================================================================

// ===========================================================================================
  // FUTURE ENHANCEMENT: PREVIEW VS EXPORT COMPARISON
  // ===========================================================================================
  // TODO: Add function to compare cross-reference behaviour between:
  //   - Playground preview: document.querySelector('#output')
  //   - Export HTML: the generated standalone file
  // 
  // This would help diagnose whether issues are:
  //   - "Totally broken" - fails in both preview and export
  //   - "Export-only issue" - works in preview but breaks in export pipeline
  //
  // Implementation approach:
  //   1. Add capturePreviewCrossReferences() to analyse #output div
  //   2. Compare preview vs export in verification report
  //   3. Flag issues with "worksInPreview: true/false" for debugging
  // ===========================================================================================
  
  /**
   * Extract cross-references (\label and \ref) from LaTeX source
   * @param {string} sourceText - LaTeX source text
   * @returns {Object} - Cross-reference inventory
   */
  function extractSourceCrossReferences(sourceText) {
    logInfo("🔗 Extracting cross-references from source...");

    if (!sourceText || typeof sourceText !== "string") {
      logWarn("No source text provided for cross-reference extraction");
      return null;
    }

    const crossRefs = {
      timestamp: new Date().toISOString(),
      labels: [],      // \label{...} definitions
      references: [],  // \ref{...} usage
      statistics: {
        totalLabels: 0,
        totalReferences: 0,
        byLabelType: {},
        byRefType: {},
      },
    };

    try {
      // Extract \label{...} definitions
      const labelPattern = /\\label\{([^}]+)\}/g;
      let match;
      let labelIndex = 0;

      while ((match = labelPattern.exec(sourceText)) !== null) {
        const labelId = match[1];
        const labelType = getLabelType(labelId);
        
        crossRefs.labels.push({
          index: labelIndex++,
          id: labelId,
          type: labelType,
          position: match.index,
          approximateLine: estimateLineNumber(sourceText, match.index),
        });

        crossRefs.statistics.byLabelType[labelType] = 
          (crossRefs.statistics.byLabelType[labelType] || 0) + 1;
      }

      // Extract \ref{...} references
      const refPattern = /\\ref\{([^}]+)\}/g;
      let refIndex = 0;

      while ((match = refPattern.exec(sourceText)) !== null) {
        const refTarget = match[1];
        const refType = getLabelType(refTarget);
        
        crossRefs.references.push({
          index: refIndex++,
          target: refTarget,
          type: refType,
          position: match.index,
          approximateLine: estimateLineNumber(sourceText, match.index),
        });

        crossRefs.statistics.byRefType[refType] = 
          (crossRefs.statistics.byRefType[refType] || 0) + 1;
      }

      crossRefs.statistics.totalLabels = crossRefs.labels.length;
      crossRefs.statistics.totalReferences = crossRefs.references.length;

      logInfo(
        `✅ Extracted ${crossRefs.labels.length} labels and ` +
        `${crossRefs.references.length} references from source`
      );

      return crossRefs;
    } catch (error) {
      logError("Error extracting cross-references:", error);
      return null;
    }
  }

  /**
   * Determine the type of a label based on its prefix
   * @param {string} labelId - Label identifier (e.g., "eq:fundamental")
   * @returns {string} - Label type
   */
  function getLabelType(labelId) {
    if (!labelId) return "unknown";
    
    const colonIndex = labelId.indexOf(":");
    if (colonIndex === -1) return "other";
    
    const prefix = labelId.substring(0, colonIndex);
    return CONFIG.crossRef.labelTypes[prefix] || "other";
  }

  /**
   * Analyse cross-references in exported HTML
   * @param {string} html - Exported HTML content
   * @returns {Object} - Cross-reference analysis
   */
  function analyseCrossReferencesInExport(html) {
    logInfo("🔗 Analysing cross-references in export...");

    if (!html || typeof html !== "string") {
      logWarn("No HTML provided for cross-reference analysis");
      return null;
    }

const analysis = {
      timestamp: new Date().toISOString(),
      links: [],           // All <a href="#content-..."> elements
      userRefs: [],        // Links with data-reference-type="ref" (from \ref{})
      navLinks: [],        // Links without data-reference-type (ToC, navigation)
      anchors: [],         // Elements with id="content-..."
      footnoteLinks: [],   // Footnote references
      footnoteAnchors: [], // Footnote targets
      issues: [],
      statistics: {
        totalLinks: 0,
        totalUserRefs: 0,
        totalNavLinks: 0,
        totalAnchors: 0,
        totalFootnotes: 0,
        byLinkType: {},
        byAnchorType: {},
      },
    };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

// =====================================================================
      // Find all internal links (cross-references)
      // Categorise into:
      //   - userRefs: Links from \ref{} commands (have data-reference-type="ref")
      //   - navLinks: Navigation links (ToC, sidebar) without data-reference-type
      // =====================================================================
      const internalLinks = doc.querySelectorAll('a[href^="#content-"]');
      
      let userRefIndex = 0;
      let navLinkIndex = 0;
      
      internalLinks.forEach((link, idx) => {
        const href = link.getAttribute("href") || "";
        const targetId = href.replace("#", "");
        const displayText = link.textContent || "";
        const refType = link.getAttribute("data-reference-type") || "";
        const refTarget = link.getAttribute("data-reference") || "";
        
        // Determine label type from target ID
        const labelType = getLabelTypeFromExportId(targetId);
        
        // Check display quality (only relevant for user refs)
        const hasProperDisplay = checkDisplayQuality(displayText, labelType, refTarget);
        
        // Determine if this is a user cross-reference or a navigation link
        const isUserRef = refType === "ref" || !!refTarget;
        
        const linkData = {
          index: isUserRef ? userRefIndex++ : navLinkIndex++,
          targetId: targetId,
          displayText: truncate(displayText, 40),
          labelType: labelType,
          refType: refType,
          refTarget: refTarget,
          hasProperDisplay: hasProperDisplay,
          isUserRef: isUserRef,
        };
        
        // Add to appropriate category
        analysis.links.push(linkData);
        
        if (isUserRef) {
          analysis.userRefs.push(linkData);
        } else {
          analysis.navLinks.push(linkData);
        }

        analysis.statistics.byLinkType[labelType] = 
          (analysis.statistics.byLinkType[labelType] || 0) + 1;
      });

      // =====================================================================
      // Find all anchor targets (elements with content- IDs)
      // =====================================================================
      const anchorElements = doc.querySelectorAll('[id^="content-"]');
      
      anchorElements.forEach((el, idx) => {
        const id = el.getAttribute("id") || "";
        const tagName = el.tagName.toLowerCase();
        const labelType = getLabelTypeFromExportId(id);
        
        analysis.anchors.push({
          index: idx,
          id: id,
          tagName: tagName,
          labelType: labelType,
        });

        analysis.statistics.byAnchorType[labelType] = 
          (analysis.statistics.byAnchorType[labelType] || 0) + 1;
      });

      // =====================================================================
      // Find footnote-specific elements
      // =====================================================================
      const footnoteRefs = doc.querySelectorAll('.footnote-ref, [role="doc-noteref"]');
      footnoteRefs.forEach((ref, idx) => {
        const href = ref.getAttribute("href") || "";
        const id = ref.getAttribute("id") || "";
        
        analysis.footnoteLinks.push({
          index: idx,
          id: id,
          targetId: href.replace("#", ""),
        });
      });

      const footnoteBacklinks = doc.querySelectorAll('.footnote-back, [role="doc-backlink"]');
      footnoteBacklinks.forEach((backlink, idx) => {
        const href = backlink.getAttribute("href") || "";
        
        analysis.footnoteAnchors.push({
          index: idx,
          targetId: href.replace("#", ""),
          hasBacklink: true,
        });
      });

// Update statistics
      analysis.statistics.totalLinks = analysis.links.length;
      analysis.statistics.totalUserRefs = analysis.userRefs.length;
      analysis.statistics.totalNavLinks = analysis.navLinks.length;
      analysis.statistics.totalAnchors = analysis.anchors.length;
      analysis.statistics.totalFootnotes = analysis.footnoteLinks.length;

      logInfo(
        `✅ Found ${analysis.userRefs.length} user cross-references, ` +
        `${analysis.navLinks.length} navigation links, and ` +
        `${analysis.anchors.length} anchor targets`
      );

      return analysis;
    } catch (error) {
      logError("Error analysing cross-references in export:", error);
      return null;
    }
  }

  /**
   * Get label type from export ID (e.g., "content-eq:fundamental" -> "equation")
   * @param {string} exportId - Export element ID
   * @returns {string} - Label type
   */
  function getLabelTypeFromExportId(exportId) {
    if (!exportId) return "unknown";
    
    // Remove "content-" prefix if present
    const labelPart = exportId.replace(/^content-/, "");
    return getLabelType(labelPart);
  }

  /**
   * Check if a cross-reference has proper display text
   * @param {string} displayText - The visible text of the link
   * @param {string} labelType - Type of label (equation, section, etc.)
   * @param {string} refTarget - The reference target (e.g., "eq:fundamental")
   * @returns {boolean} - True if display is proper
   */
  function checkDisplayQuality(displayText, labelType, refTarget) {
    if (!displayText) return false;
    
    const text = displayText.trim().toLowerCase();
    
    // Check if display text contains the raw label name (bad)
    if (refTarget && text.includes(refTarget.toLowerCase())) {
      return false;
    }
    
    // Check for common bad patterns
    const badPatterns = [
      /^ref:/i,           // Shows "ref:smith2020"
      /^eq:/i,            // Shows "eq:fundamental"
      /^sec:/i,           // Shows "sec:introduction"
      /^tab:/i,           // Shows "tab:results"
      /^fig:/i,           // Shows "fig:diagram"
      /equation\s+\w+-/i, // Shows "Equation fundamental-" instead of number
    ];
    
    for (const pattern of badPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }
    
    // Good patterns (should contain numbers or proper text)
    const goodPatterns = [
      /^\d+$/,                    // Just a number "1"
      /^section\s+\d/i,           // "Section 1"
      /^equation\s+\d/i,          // "Equation 1" (not "Equation fundamental")
      /^table\s+\d/i,             // "Table 1"
      /^figure\s+\d/i,            // "Figure 1"
      /^\[\d+\]$/,                // "[1]" for bibliography
    ];
    
    // For numeric display types, prefer patterns with numbers
    if (CONFIG.crossRef.numericDisplayTypes.includes(getLabelTypePrefix(refTarget))) {
      return goodPatterns.some(pattern => pattern.test(text));
    }
    
    return true; // For non-numeric types, accept any non-raw-label display
  }

  /**
   * Get label type prefix from reference target
   * @param {string} refTarget - Reference target (e.g., "eq:fundamental")
   * @returns {string} - Prefix (e.g., "eq")
   */
  function getLabelTypePrefix(refTarget) {
    if (!refTarget) return "";
    const colonIndex = refTarget.indexOf(":");
    return colonIndex > -1 ? refTarget.substring(0, colonIndex) : "";
  }

  /**
   * Compare source cross-references against export analysis
   * @param {Object} sourceRefs - Source cross-reference inventory
   * @param {Object} exportRefs - Export cross-reference analysis
   * @returns {Object} - Comparison results with issues
   */
  function compareCrossReferences(sourceRefs, exportRefs) {
    logInfo("⚖️ Comparing cross-references...");

    if (!sourceRefs || !exportRefs) {
      logWarn("Missing source or export cross-references for comparison");
      return null;
    }

    const comparison = {
      timestamp: new Date().toISOString(),
      issues: [],
      passedChecks: [],
      statistics: {
        sourceLabels: sourceRefs.statistics.totalLabels,
        sourceRefs: sourceRefs.statistics.totalReferences,
        exportLinks: exportRefs.statistics.totalLinks,
        exportAnchors: exportRefs.statistics.totalAnchors,
      },
    };

    try {
      // Build lookup sets for efficient comparison
      const sourceLabelIds = new Set(sourceRefs.labels.map(l => l.id));
      const sourceRefTargets = new Set(sourceRefs.references.map(r => r.target));
      const exportAnchorIds = new Set(exportRefs.anchors.map(a => 
        a.id.replace(/^content-/, "")
      ));
      const exportLinkTargets = new Set(exportRefs.links.map(l => 
        l.targetId.replace(/^content-/, "")
      ));

// =====================================================================
      // Check 1: Orphan links (links pointing to non-existent anchors)
      // Separate user cross-references from navigation links for clarity
      // =====================================================================
      const anchorIdSet = new Set(exportRefs.anchors.map(a => a.id));
      
      const orphanUserRefs = exportRefs.userRefs.filter(link => 
        !anchorIdSet.has(link.targetId)
      );
      
      const orphanNavLinks = exportRefs.navLinks.filter(link => 
        !anchorIdSet.has(link.targetId)
      );

      // Report user cross-reference issues (from \ref{}) - these are errors
      if (orphanUserRefs.length === 0) {
        comparison.passedChecks.push({
          check: "crossref_user_refs_valid",
          message: `All ${exportRefs.userRefs.length} user cross-references (from \\ref{}) have valid targets`,
        });
      } else {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "crossref_orphan_refs",
          severity: "error",
          message: `${orphanUserRefs.length} cross-reference(s) from \\ref{} point to non-existent anchors`,
          details: orphanUserRefs.slice(0, 5).map(l => ({
            targetId: l.targetId,
            displayText: l.displayText,
            refTarget: l.refTarget,
          })),
        });
      }

      // Report navigation link issues (ToC, sidebar) - these are warnings
      if (orphanNavLinks.length === 0) {
        if (exportRefs.navLinks.length > 0) {
          comparison.passedChecks.push({
            check: "crossref_nav_links_valid",
            message: `All ${exportRefs.navLinks.length} navigation links have valid targets`,
          });
        }
      } else {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "crossref_orphan_nav",
          severity: "warning",
          message: `${orphanNavLinks.length} navigation link(s) (ToC/sidebar) point to non-existent anchors`,
          details: orphanNavLinks.slice(0, 5).map(l => ({
            targetId: l.targetId,
            displayText: l.displayText,
            note: "Navigation links use different ID format than heading IDs",
          })),
        });
      }
// =====================================================================
      // Check 2: Display quality (refs showing label names instead of numbers)
      // Only check user cross-references (navigation links don't need number display)
      // =====================================================================
      const poorDisplayRefs = exportRefs.userRefs.filter(link => !link.hasProperDisplay);

      if (poorDisplayRefs.length === 0) {
        comparison.passedChecks.push({
          check: "crossref_display_quality",
          message: `All ${exportRefs.userRefs.length} cross-references display properly formatted text`,
        });
      } else {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "crossref_display_quality",
          severity: "warning",
          message: `${poorDisplayRefs.length} cross-reference(s) from \\ref{} show raw label names instead of proper numbers`,
          details: poorDisplayRefs.slice(0, 10).map(l => ({
            targetId: l.targetId,
            displayText: l.displayText,
            refTarget: l.refTarget,
            suggestion: `Should display as number or proper reference, not "${l.displayText}"`,
          })),
        });
      }

      // =====================================================================
      // Check 3: Label/anchor count match
      // =====================================================================
      const labelCount = sourceRefs.statistics.totalLabels;
      const anchorCount = exportRefs.statistics.totalAnchors;
      const countRatio = anchorCount / Math.max(labelCount, 1);

      if (labelCount === 0 && anchorCount === 0) {
        comparison.passedChecks.push({
          check: "crossref_count_match",
          message: "No cross-references in document (none expected)",
        });
      } else if (countRatio >= 0.9) {
        comparison.passedChecks.push({
          check: "crossref_count_match",
          message: `Cross-reference anchors: ${anchorCount}/${labelCount} labels preserved (${Math.round(countRatio * 100)}%)`,
        });
      } else {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "crossref_count_mismatch",
          severity: "warning",
          message: `Cross-reference count mismatch: ${anchorCount} anchors for ${labelCount} source labels`,
          details: {
            sourceLabels: labelCount,
            exportAnchors: anchorCount,
            ratio: countRatio,
          },
        });
      }

      // =====================================================================
      // Check 4: Footnote back-links
      // =====================================================================
      if (exportRefs.footnoteLinks.length > 0) {
        const footnotesWithBacklinks = exportRefs.footnoteAnchors.length;
        
        if (footnotesWithBacklinks >= exportRefs.footnoteLinks.length) {
          comparison.passedChecks.push({
            check: "crossref_footnote_backlinks",
            message: `All ${exportRefs.footnoteLinks.length} footnote(s) have working back-links`,
          });
        } else {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "crossref_footnote_backlinks",
            severity: "warning",
            message: `${exportRefs.footnoteLinks.length - footnotesWithBacklinks} footnote(s) missing back-links`,
          });
        }
      }

      // =====================================================================
      // Check 5: Orphan anchors (informational - anchors never referenced)
      // =====================================================================
      const referencedTargets = new Set(exportRefs.links.map(l => l.targetId));
      const orphanAnchors = exportRefs.anchors.filter(anchor => 
        !referencedTargets.has(anchor.id) && 
        // Exclude section headings (they're navigation targets, not always referenced)
        anchor.labelType !== "section" &&
        anchor.labelType !== "subsection"
      );

      if (orphanAnchors.length > 0 && orphanAnchors.length <= 5) {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "crossref_orphan_anchors",
          severity: "info",
          message: `${orphanAnchors.length} anchor(s) defined but never referenced`,
          details: orphanAnchors.slice(0, 5).map(a => ({
            id: a.id,
            type: a.labelType,
          })),
        });
      }

      logInfo(
        `✅ Cross-reference comparison complete: ` +
        `${comparison.issues.length} issues, ${comparison.passedChecks.length} passed`
      );

      return comparison;
    } catch (error) {
      logError("Error comparing cross-references:", error);
      return null;
    }
  }

  // ===========================================================================================
  // PHASE 2: EXPORT HTML ANALYSIS
  // ===========================================================================================

  /**
   * Analyse exported HTML for LaTeX rendering status
   * Handles both:
   *   - Pandoc output: <span class="math inline">\(...\)</span> and <span class="math display">\[...\]</span>
   *   - MathJax rendered: <mjx-container> elements (after client-side rendering)
   * @param {string} html - Exported HTML content
   * @returns {Object} - Analysis results
   */
  function analyseExportHTML(html) {
    logInfo("🔍 Analysing export HTML for LaTeX rendering...");

    if (!html || typeof html !== "string") {
      logError("Invalid HTML provided for analysis");
      return null;
    }

    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        htmlLength: html.length,
        mathElements: [],        // Pandoc math spans (pre-MathJax)
        mathJaxContainers: [],   // MathJax rendered containers (post-rendering)
        unrenderedLatex: [],
        corruptedDelimiters: [],
        environmentFailures: [],
        macroFailures: [],
      };

      // Parse HTML for analysis
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // =====================================================================
      // Find Pandoc math spans (the primary format in exports)
      // These include:
      //   - <span class="math inline">\(...\)</span>
      //   - <span class="math display">\[...\]</span>
      //   - <span class="math numbered-env">\begin{align}...\end{align}</span>
      // =====================================================================
      const mathSpans = doc.querySelectorAll("span.math");
      
      mathSpans.forEach((span, idx) => {
        const content = span.textContent || "";
        let latex = "";
        let type = "inline";
        
        // Determine type from class
        if (span.classList.contains("display")) {
          type = "display";
        } else if (span.classList.contains("numbered-env")) {
          type = "environment";
        }
        
        // Extract LaTeX from delimiters
        if (type === "environment") {
          // Match \begin{...}...\end{...}
          const envMatch = content.match(/^\\begin\{(\w+\*?)\}([\s\S]*)\\end\{\1\}$/);
          if (envMatch) {
            latex = envMatch[2] || content;
          } else {
            latex = content;
          }
        } else if (type === "display") {
          // Match \[...\]
          const displayMatch = content.match(/^\\\[([\s\S]*)\\\]$/);
          if (displayMatch) {
            latex = displayMatch[1];
          } else {
            latex = content;
          }
        } else {
          // Match \(...\)
          const inlineMatch = content.match(/^\\\(([\s\S]*)\\\)$/);
          if (inlineMatch) {
            latex = inlineMatch[1];
          } else {
            latex = content;
          }
        }

        analysis.mathElements.push({
          index: idx,
          type: type,
          latex: latex.trim(),
          hash: simpleHash(normaliseLatex(latex)),
          preview: truncate(latex.trim()),
          hasParentId: !!span.getAttribute("data-math-parent-id"),
        });
      });

      logDebug(`Found ${analysis.mathElements.length} Pandoc math spans`);

      // =====================================================================
      // Also find MathJax containers (for already-rendered exports)
      // =====================================================================
      const mjxContainers = doc.querySelectorAll("mjx-container");
      
      mjxContainers.forEach((container, idx) => {
        let originalLatex = "";
        const mathElement = container.querySelector("math");
        
        if (mathElement) {
          originalLatex = mathElement.getAttribute("alttext") || "";
        }
        
        if (!originalLatex) {
          originalLatex = container.getAttribute("aria-label") || "";
        }

        analysis.mathJaxContainers.push({
          index: idx,
          hash: simpleHash(normaliseLatex(originalLatex)),
          preview: truncate(originalLatex),
          isDisplay: container.getAttribute("display") === "true" || 
                     container.classList.contains("MathJax_Display"),
        });
      });

      logDebug(`Found ${analysis.mathJaxContainers.length} MathJax containers`);

      // =====================================================================
      // Get text content from MAIN CONTENT AREA ONLY
      // The full export includes JavaScript/metadata that stores original LaTeX
      // We only want to check the actual document content for unrendered math
      // =====================================================================
      
      // Clone the document to avoid modifying the original
      const docClone = doc.cloneNode(true);
      
      // Find the main content area - try various selectors
      let contentArea = docClone.querySelector("main, .document-content, #main, article, .content");
      
      // If no specific content area found, fall back to body but remove scripts first
      if (!contentArea) {
        contentArea = docClone.body;
        logDebug("No main content area found, using body");
      }
      
      if (!contentArea) {
        logWarn("No content area found for unrendered LaTeX detection");
        // Return early with empty unrendered array
        analysis.summary = {
          totalContainers: analysis.mathElements.length + analysis.mathJaxContainers.length,
          pandocMathSpans: analysis.mathElements.length,
          mathJaxContainers: analysis.mathJaxContainers.length,
          unrenderedCount: 0,
          corruptedCount: 0,
          environmentFailureCount: 0,
          macroFailureCount: 0,
          hasIssues: false,
        };
        return analysis;
      }
      
      // Remove elements that shouldn't be scanned for LaTeX
      contentArea.querySelectorAll("script, style, noscript, template").forEach((el) => el.remove());
      
      // Remove all math spans (these contain CORRECT \(...\) and \[...\] delimiters)
      contentArea.querySelectorAll("span.math, [class*='math']").forEach((el) => el.remove());
      
      // Remove MathJax containers (already rendered math)
      contentArea.querySelectorAll("mjx-container, .MathJax").forEach((el) => el.remove());
      
      // Remove any hidden/metadata elements that might store LaTeX
      contentArea.querySelectorAll("[hidden], .sr-only, [aria-hidden='true']").forEach((el) => el.remove());
      
      // Get clean text content from main area only
      const textContent = contentArea.textContent || "";
      
      logDebug(`Scanning ${textContent.length} characters of main content for unrendered LaTeX`);

      // =====================================================================
      // Find truly unrendered LaTeX - raw $ delimiters in visible content
      // =====================================================================
      let match;
      
      // Pattern for inline math with $ delimiters (truly unrendered)
      // Must contain at least one LaTeX-like character (backslash, ^, _, {, })
      const dollarInlinePattern = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
      
      while ((match = dollarInlinePattern.exec(textContent)) !== null) {
        const content = match[1].trim();
        // Only flag if it looks like actual math (contains LaTeX-like content)
        const looksLikeMath = /[\\^_{}]|[a-z]\s*=|[0-9]\s*[+\-*/]\s*[0-9a-z]/i.test(content);
        
        if (content.length > 1 && looksLikeMath) {
          analysis.unrenderedLatex.push({
            type: "inline",
            pattern: "$",
            content: content,
            preview: truncate(content),
            hash: simpleHash(normaliseLatex(content)),
            approximatePosition: match.index,
            severity: "error",
          });
        }
      }

      // Pattern for display math with $$ delimiters (truly unrendered)
      const dollarDisplayPattern = /\$\$([\s\S]*?)\$\$/g;
      while ((match = dollarDisplayPattern.exec(textContent)) !== null) {
        analysis.unrenderedLatex.push({
          type: "display",
          pattern: "$$",
          content: match[1],
          preview: truncate(match[1]),
          hash: simpleHash(normaliseLatex(match[1])),
          approximatePosition: match.index,
          severity: "error",
        });
      }

      logDebug(`Found ${analysis.unrenderedLatex.length} truly unrendered LaTeX expressions`);

      // =====================================================================
      // Find corrupted delimiters (double-escaped) - check in main content only
      // =====================================================================
      const corruptedPatterns = [
        { pattern: /\\\\\\\\+\\\(/g, type: "double_escaped_inline_open" },
        { pattern: /\\\\\\\\+\\\)/g, type: "double_escaped_inline_close" },
        { pattern: /\\\\\\\\+\\\[/g, type: "double_escaped_display_open" },
        { pattern: /\\\\\\\\+\\\]/g, type: "double_escaped_display_close" },
      ];

      corruptedPatterns.forEach(({ pattern, type }) => {
        pattern.lastIndex = 0;
        while ((match = pattern.exec(textContent)) !== null) {
          analysis.corruptedDelimiters.push({
            type: type,
            content: match[0],
            approximatePosition: match.index,
          });
        }
      });

      // =====================================================================
      // Find environment failures - ONLY raw \begin{...} in visible text
      // (outside of any math span)
      // =====================================================================
      const envPattern = /\\begin\{(equation|align|gather|multline|eqnarray|alignat)\*?\}/g;
      while ((match = envPattern.exec(textContent)) !== null) {
        analysis.environmentFailures.push({
          environment: match[1],
          fullMatch: match[0],
          approximatePosition: match.index,
        });
      }

      // =====================================================================
      // Summary statistics
      // Total "containers" = Pandoc math spans + MathJax containers
      // (They shouldn't both exist, but handle both cases)
      // =====================================================================
      const totalMathElements = analysis.mathElements.length + analysis.mathJaxContainers.length;
      
      analysis.summary = {
        totalContainers: totalMathElements,
        pandocMathSpans: analysis.mathElements.length,
        mathJaxContainers: analysis.mathJaxContainers.length,
        unrenderedCount: analysis.unrenderedLatex.length,
        corruptedCount: analysis.corruptedDelimiters.length,
        environmentFailureCount: analysis.environmentFailures.length,
        macroFailureCount: analysis.macroFailures.length,
        hasIssues:
          analysis.unrenderedLatex.length > 0 ||
          analysis.corruptedDelimiters.length > 0 ||
          analysis.environmentFailures.length > 0,
      };

      logInfo(
        `✅ Analysis complete: ${totalMathElements} math elements ` +
        `(${analysis.mathElements.length} Pandoc spans, ${analysis.mathJaxContainers.length} MathJax), ` +
        `${analysis.summary.unrenderedCount} unrendered, ` +
        `${analysis.summary.corruptedCount} corrupted`
      );

      return analysis;
    } catch (error) {
      logError("Error analysing export HTML:", error);
      return null;
    }
  }

  // ===========================================================================================
  // PHASE 2B: MATHJAX CONFIGURATION ANALYSIS
  // ===========================================================================================

  /**
   * Extract and analyse MathJax configuration from export HTML
   * @param {string} html - Full export HTML
   * @returns {Object} - MathJax configuration analysis
   */
function analyseMathJaxConfig(html) {
    logInfo("🔧 Analysing MathJax configuration...");

    const config = {
      found: false,
      delimiters: {
        inlineMath: [],
        displayMath: [],
      },
      packages: [],
      macros: {},
      macroCount: 0,
      tags: null,
      processEscapes: null,
      processEnvironments: null,
      a11y: {
        modules: [],
        assistiveMml: null,
        speechRules: null,
        explorer: null,
      },
      issues: [],
    };

    try {
      // Find MathJax configuration block
      const configMatch = html.match(/window\.MathJax\s*=\s*\{[\s\S]*?\};/);
      
      if (!configMatch) {
        config.issues.push({
          type: "missing_config",
          severity: "error",
          message: "No MathJax configuration found in export",
        });
        return config;
      }

      config.found = true;
      const configStr = configMatch[0];

// Helper function to unescape JavaScript string escapes from raw HTML source
      // When reading '\\(' from HTML, we get two backslashes - need to convert to one
      function unescapeDelimiter(str) {
        if (!str) return str;
        return str.replace(/\\\\/g, '\\');
      }

      // Extract inline math delimiters
      // Use \[\[ ... \]\] pattern to capture the full nested array structure
      const inlineMathMatch = configStr.match(/inlineMath:\s*(\[\[[\s\S]*?\]\])/);
      if (inlineMathMatch) {
        const arrayContent = inlineMathMatch[1];
        const delims = arrayContent.match(/\['([^']+)',\s*'([^']+)'\]/g);
        if (delims) {
          config.delimiters.inlineMath = delims.map(d => {
            const m = d.match(/\['([^']+)',\s*'([^']+)'\]/);
            // Unescape the delimiters - '\\(' in HTML source becomes '\(' for comparison
            return m ? [unescapeDelimiter(m[1]), unescapeDelimiter(m[2])] : null;
          }).filter(Boolean);
        }
        logDebug(`Extracted inline delimiters: ${JSON.stringify(config.delimiters.inlineMath)}`);
      }

      // Extract display math delimiters
      // Use \[\[ ... \]\] pattern to capture the full nested array structure
      const displayMathMatch = configStr.match(/displayMath:\s*(\[\[[\s\S]*?\]\])/);
      if (displayMathMatch) {
        const arrayContent = displayMathMatch[1];
        const delims = arrayContent.match(/\['([^']+)',\s*'([^']+)'\]/g);
        if (delims) {
          config.delimiters.displayMath = delims.map(d => {
            const m = d.match(/\['([^']+)',\s*'([^']+)'\]/);
            // Unescape the delimiters - '\\[' in HTML source becomes '\[' for comparison
            return m ? [unescapeDelimiter(m[1]), unescapeDelimiter(m[2])] : null;
          }).filter(Boolean);
        }
        logDebug(`Extracted display delimiters: ${JSON.stringify(config.delimiters.displayMath)}`);
      }

      // Extract packages
      const packagesMatch = configStr.match(/packages:\s*\{\s*'\[\+\]':\s*\[([\s\S]*?)\]/);
      if (packagesMatch) {
        const pkgStr = packagesMatch[1];
        const pkgs = pkgStr.match(/'([^']+)'/g);
        if (pkgs) {
          config.packages = pkgs.map(p => p.replace(/'/g, ""));
        }
      }

// Extract macros
      // Use pattern that handles one level of nested braces (e.g., \mathbb{R} inside strings)
      const macrosMatch = configStr.match(/macros:\s*\{((?:[^{}]|\{[^{}]*\})*)\}/);
      if (macrosMatch) {
        const macroStr = macrosMatch[1];
        // Match macro definitions like: macroName: ['definition', argCount]
        const macroPattern = /(\w+):\s*\[['"]([^'"]+)['"],\s*(\d+)\]/g;
        let m;
        while ((m = macroPattern.exec(macroStr)) !== null) {
          config.macros[m[1]] = {
            definition: m[2],
            argCount: parseInt(m[3], 10),
          };
        }
        config.macroCount = Object.keys(config.macros).length;
        logDebug(`Extracted ${config.macroCount} macros: ${Object.keys(config.macros).join(', ')}`);
      }

      // Extract tags setting
      const tagsMatch = configStr.match(/tags:\s*['"]([^'"]+)['"]/);
      if (tagsMatch) {
        config.tags = tagsMatch[1];
      }

      // Extract processEscapes
      const escapesMatch = configStr.match(/processEscapes:\s*(true|false)/);
      if (escapesMatch) {
        config.processEscapes = escapesMatch[1] === "true";
      }

// Extract processEnvironments
      const envsMatch = configStr.match(/processEnvironments:\s*(true|false)/);
      if (envsMatch) {
        config.processEnvironments = envsMatch[1] === "true";
      }

      // =====================================================================
      // Extract Accessibility Configuration
      // =====================================================================
      
      // Extract a11y loader modules
      const loaderMatch = configStr.match(/loader:\s*\{[\s\S]*?load:\s*\[([\s\S]*?)\]/);
      if (loaderMatch) {
        const loadStr = loaderMatch[1];
        // Extract all 'a11y/...' module names
        const a11yModules = loadStr.match(/['"]a11y\/([^'"]+)['"]/g);
        if (a11yModules) {
          config.a11y.modules = a11yModules.map(m => {
            const match = m.match(/['"]a11y\/([^'"]+)['"]/);
            return match ? match[1] : null;
          }).filter(Boolean);
        }
        logDebug(`Extracted a11y modules: ${config.a11y.modules.join(', ')}`);
      }

      // Extract a11y block settings
      const a11yBlockMatch = configStr.match(/a11y:\s*\{([\s\S]*?)\}/);
      if (a11yBlockMatch) {
        const a11yStr = a11yBlockMatch[1];
        
        const assistiveMmlMatch = a11yStr.match(/assistiveMml:\s*(true|false)/);
        if (assistiveMmlMatch) {
          config.a11y.assistiveMml = assistiveMmlMatch[1] === "true";
        }
        
        const speechRulesMatch = a11yStr.match(/speechRules:\s*['"]([^'"]+)['"]/);
        if (speechRulesMatch) {
          config.a11y.speechRules = speechRulesMatch[1];
        }
      }

      // Check for explorer in options
      const explorerMatch = configStr.match(/explorer:\s*(true|false)/);
      if (explorerMatch) {
        config.a11y.explorer = explorerMatch[1] === "true";
      }

      // Validation checks
      const hasDollarInline = config.delimiters.inlineMath.some(
        d => d[0] === "$" && d[1] === "$"
      );
      const hasParenInline = config.delimiters.inlineMath.some(
        d => d[0] === "\\(" && d[1] === "\\)"
      );
      const hasDollarDisplay = config.delimiters.displayMath.some(
        d => d[0] === "$$" && d[1] === "$$"
      );
      const hasBracketDisplay = config.delimiters.displayMath.some(
        d => d[0] === "\\[" && d[1] === "\\]"
      );

      if (!hasParenInline) {
        config.issues.push({
          type: "missing_delimiter",
          severity: "error",
          message: "Missing \\(...\\) inline delimiter (required for Pandoc output)",
        });
      }

      if (!hasBracketDisplay) {
        config.issues.push({
          type: "missing_delimiter",
          severity: "error",
          message: "Missing \\[...\\] display delimiter (required for Pandoc output)",
        });
      }

// Check essential packages
      const essentialPackages = ["ams", "amssymb"];
      essentialPackages.forEach(pkg => {
        if (!config.packages.includes(pkg)) {
          config.issues.push({
            type: "missing_package",
            severity: "warning",
            message: `Package '${pkg}' not loaded - some symbols may not render`,
          });
        }
      });

      // Check essential accessibility modules
      const essentialA11yModules = ["assistive-mml", "sre"];
      const recommendedA11yModules = ["semantic-enrich", "explorer"];
      
      essentialA11yModules.forEach(mod => {
        if (!config.a11y.modules.includes(mod)) {
          config.issues.push({
            type: "missing_a11y_module",
            severity: "warning",
            message: `Essential accessibility module '${mod}' not loaded - screen reader support may be limited`,
          });
        }
      });

      recommendedA11yModules.forEach(mod => {
        if (!config.a11y.modules.includes(mod)) {
          config.issues.push({
            type: "missing_a11y_module",
            severity: "info",
            message: `Recommended accessibility module '${mod}' not loaded`,
          });
        }
      });

      // Check assistiveMml is enabled
      if (config.a11y.assistiveMml === false) {
        config.issues.push({
          type: "a11y_disabled",
          severity: "warning",
          message: "assistiveMml is disabled - MathML fallback for screen readers won't be available",
        });
      }

      logInfo(`✅ MathJax config analysis: ${config.packages.length} packages, ${config.macroCount} macros, ${config.a11y.modules.length} a11y modules`);

    } catch (error) {
      logError("Error analysing MathJax config:", error);
      config.issues.push({
        type: "parse_error",
        severity: "error",
        message: `Failed to parse MathJax config: ${error.message}`,
      });
    }

    return config;
  }

  /**
   * Detect custom macros used in source that need to be defined in export
   * @param {Object} inventory - Source inventory
   * @returns {Array} - List of custom macros found
   */
  function detectCustomMacros(inventory) {
    const customMacros = new Set();
    
    // Common single-letter macros that are often custom-defined
    const likelyCustom = /\\([A-Z])(?![a-zA-Z])/g;
    
    // Multi-letter macros that aren't standard LaTeX
    const multiLetterCustom = /\\(ds|supp|abs|norm|inner|ceil|floor|set|R|N|Z|Q|C|F|E|Var|Cov|P)(?![a-zA-Z])/g;

    inventory.expressions.forEach(expr => {
      const latex = expr.latex || "";
      
      let match;
      while ((match = likelyCustom.exec(latex)) !== null) {
        customMacros.add(match[1]);
      }
      
      likelyCustom.lastIndex = 0; // Reset regex
      
      while ((match = multiLetterCustom.exec(latex)) !== null) {
        customMacros.add(match[1]);
      }
      
      multiLetterCustom.lastIndex = 0;
    });

    return Array.from(customMacros);
  }

  // ===========================================================================================
  // PHASE 3: COMPARISON AND VERIFICATION
  // ===========================================================================================

  /**
   * Compare source inventory against export analysis
   * @param {Object} inventory - Source inventory from captureSourceInventory
   * @param {Object} analysis - Export analysis from analyseExportHTML
   * @param {Object} mathJaxConfig - MathJax configuration analysis (optional)
   * @returns {Object} - Comparison results with issues
   */
  function compareSourceToExport(inventory, analysis, mathJaxConfig = null) {
    logInfo("⚖️ Comparing source inventory to export...");

    if (!inventory || !analysis) {
      logError("Missing inventory or analysis for comparison");
      return null;
    }

    try {
      const comparison = {
        timestamp: new Date().toISOString(),
        sourceExpressionCount: inventory.statistics.total,
        exportContainerCount: analysis.summary.totalContainers,
        issues: [],
        passedChecks: [],
        status: "pass", // Will be updated based on findings
      };

      // Build hash lookup for export math elements
      // Combine both Pandoc math spans and MathJax containers
      const allExportMath = [
        ...analysis.mathElements,
        ...analysis.mathJaxContainers,
      ];
      const exportHashes = new Set(allExportMath.map((c) => c.hash));

      // =====================================================================
      // Check 1: Count validation
      // =====================================================================
      const countDiff = Math.abs(
        inventory.statistics.total - analysis.summary.totalContainers
      );
      const countRatio = analysis.summary.totalContainers / 
        Math.max(inventory.statistics.total, 1);

      if (countRatio >= 0.95) {
        comparison.passedChecks.push({
          check: "expression_count",
          message: `Expression count: ${analysis.summary.totalContainers}/${inventory.statistics.total} (${Math.round(countRatio * 100)}%)`,
        });
      } else {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "count_mismatch",
          severity: countRatio < 0.8 ? "error" : "warning",
          message: `Expression count mismatch: found ${analysis.summary.totalContainers} math elements for ${inventory.statistics.total} source expressions`,
          details: {
            sourceCount: inventory.statistics.total,
            exportCount: analysis.summary.totalContainers,
            pandocSpans: analysis.summary.pandocMathSpans,
            mathJaxContainers: analysis.summary.mathJaxContainers,
            ratio: countRatio,
          },
        });
      }

      // =====================================================================
      // Check 2: Sequence/Order verification
      // =====================================================================
      if (analysis.mathElements.length > 0 && inventory.expressions.length > 0) {
        let sequenceMatch = true;
        const minLength = Math.min(analysis.mathElements.length, inventory.expressions.length);
        const sequenceMismatches = [];

        for (let i = 0; i < minLength; i++) {
          const sourceExpr = inventory.expressions[i];
          const exportExpr = analysis.mathElements[i];
          
          // Compare hashes to check if same expression is in same position
          if (sourceExpr.hash !== exportExpr.hash) {
            sequenceMatch = false;
            sequenceMismatches.push({
              position: i + 1,
              sourcePreview: sourceExpr.preview,
              exportPreview: exportExpr.preview,
            });
          }
        }

if (sequenceMatch) {
          comparison.passedChecks.push({
            check: "sequence_order",
            message: "Expression sequence matches source order",
          });
        } else if (sequenceMismatches.length <= 3) {
          // Minor mismatches - might be due to hash collision or minor changes
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "sequence_mismatch",
            severity: "warning",
            message: `${sequenceMismatches.length} expression(s) may be in different order`,
            details: sequenceMismatches.slice(0, 5),
          });
        } else {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "sequence_mismatch",
            severity: "warning",
            message: `Expression order may differ from source (${sequenceMismatches.length} mismatches)`,
            details: sequenceMismatches.slice(0, 5),
          });
        }
      }

      // =====================================================================
      // Check 2b: Duplicate hash warning
      // =====================================================================
      if (inventory.statistics.duplicateHashes && 
          inventory.statistics.duplicateHashes.length > 0) {
        const totalDupes = inventory.statistics.duplicateHashes.reduce(
          (sum, d) => sum + d.count, 0
        );
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "duplicate_hashes",
          severity: "info",
          message: `${inventory.statistics.duplicateHashes.length} expression(s) share hashes with others (${totalDupes} total) - verification precision may be reduced`,
          details: inventory.statistics.duplicateHashes.slice(0, 5),
        });
      }

      // =====================================================================
      // Check 3: Anchor/ID verification (data-math-parent-id)
      // =====================================================================
      const elementsWithIds = analysis.mathElements.filter(e => e.hasParentId);
      const elementsWithoutIds = analysis.mathElements.filter(e => !e.hasParentId);

      if (analysis.mathElements.length > 0) {
        if (elementsWithoutIds.length === 0) {
          comparison.passedChecks.push({
            check: "anchor_ids",
            message: `All ${elementsWithIds.length} math elements have parent IDs for accessibility`,
          });
        } else if (elementsWithoutIds.length < analysis.mathElements.length * 0.1) {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "missing_ids",
            severity: "warning",
            message: `${elementsWithoutIds.length} math element(s) missing data-math-parent-id`,
          });
        } else {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "missing_ids",
            severity: "error",
            message: `${elementsWithoutIds.length}/${analysis.mathElements.length} math elements missing accessibility IDs`,
          });
        }
      }

      // =====================================================================
      // Check 4: Type consistency (inline stays inline, display stays display)
      // =====================================================================
      if (analysis.mathElements.length === inventory.expressions.length) {
        let typeMatches = 0;
        let typeMismatches = [];

        for (let i = 0; i < inventory.expressions.length; i++) {
          const sourceType = inventory.expressions[i].type;
          const exportType = analysis.mathElements[i].type;
          
          // Normalize types for comparison
          const sourceNorm = sourceType === "environment" ? "display" : sourceType;
          const exportNorm = exportType === "environment" ? "display" : exportType;
          
          if (sourceNorm === exportNorm) {
            typeMatches++;
          } else {
            typeMismatches.push({
              position: i + 1,
              sourceType: sourceType,
              exportType: exportType,
              preview: inventory.expressions[i].preview,
            });
          }
        }

if (typeMismatches.length === 0) {
          comparison.passedChecks.push({
            check: "type_consistency",
            message: "All expressions maintain correct display mode (inline/display)",
          });
        } else {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "type_mismatch",
            severity: "warning",
            message: `${typeMismatches.length} expression(s) changed display mode`,
            details: typeMismatches.slice(0, 5),
          });
        }
      }

      // =====================================================================
      // Check 4b: Content fidelity (sample-based deep comparison)
      // =====================================================================
      if (analysis.mathElements.length > 0 && inventory.expressions.length > 0) {
        const sampleSize = Math.min(10, inventory.expressions.length);
        const sampleIndices = [];
        
        // Take evenly distributed samples
        for (let i = 0; i < sampleSize; i++) {
          sampleIndices.push(Math.floor(i * inventory.expressions.length / sampleSize));
        }
        
        let contentMatches = 0;
        const contentMismatches = [];
        
        sampleIndices.forEach(idx => {
          if (idx < analysis.mathElements.length) {
            const sourceLatex = normaliseLatex(inventory.expressions[idx].latex);
            const exportLatex = normaliseLatex(analysis.mathElements[idx].latex);
            
            if (sourceLatex === exportLatex) {
              contentMatches++;
            } else {
              // Check if it's just whitespace/formatting difference
              const sourceCompact = sourceLatex.replace(/\s/g, "");
              const exportCompact = exportLatex.replace(/\s/g, "");
              
              if (sourceCompact === exportCompact) {
                contentMatches++; // Whitespace-only difference is OK
              } else {
                contentMismatches.push({
                  position: idx + 1,
                  sourceLatex: truncate(inventory.expressions[idx].latex, 40),
                  exportLatex: truncate(analysis.mathElements[idx].latex, 40),
                });
              }
            }
          }
        });
        
        if (contentMismatches.length === 0) {
          comparison.passedChecks.push({
            check: "content_fidelity",
            message: `Content fidelity: ${contentMatches}/${sampleSize} sampled expressions match exactly`,
          });
        } else {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "content_mismatch",
            severity: "warning",
            message: `${contentMismatches.length}/${sampleSize} sampled expressions have content differences`,
            details: contentMismatches,
          });
        }
      }

      // =====================================================================
      // Check 5: MathJax configuration validation
      // =====================================================================
      if (mathJaxConfig) {
        if (mathJaxConfig.found) {
          if (mathJaxConfig.issues.length === 0) {
            comparison.passedChecks.push({
              check: "mathjax_config",
              message: `MathJax configured with ${mathJaxConfig.packages.length} packages, ${mathJaxConfig.macroCount} macros`,
            });
          } else {
            mathJaxConfig.issues.forEach(issue => {
              comparison.issues.push({
                id: comparison.issues.length + 1,
                type: "mathjax_config",
                severity: issue.severity,
                message: issue.message,
              });
            });
          }
        } else {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "mathjax_config",
            severity: "error",
            message: "MathJax configuration not found in export",
          });
        }

// Check custom macros are defined
        const detectedMacros = detectCustomMacros(inventory);
        const missingMacros = detectedMacros.filter(
          macro => !mathJaxConfig.macros[macro]
        );

        if (detectedMacros.length > 0 && missingMacros.length === 0) {
          comparison.passedChecks.push({
            check: "custom_macros",
            message: `All ${detectedMacros.length} detected custom macro(s) defined in MathJax`,
          });
        } else if (missingMacros.length > 0) {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "missing_macros",
            severity: "warning",
            message: `Custom macro(s) may not be defined: ${missingMacros.join(", ")}`,
            details: {
              detected: detectedMacros,
              missing: missingMacros,
              defined: Object.keys(mathJaxConfig.macros),
            },
          });
        }

        // =====================================================================
        // Check 6: Accessibility module verification
        // =====================================================================
        const essentialA11y = ["assistive-mml", "sre"];
        const loadedA11y = mathJaxConfig.a11y?.modules || [];
        const missingEssentialA11y = essentialA11y.filter(
          mod => !loadedA11y.includes(mod)
        );

        if (missingEssentialA11y.length === 0 && loadedA11y.length >= 2) {
          comparison.passedChecks.push({
            check: "a11y_modules",
            message: `Accessibility: ${loadedA11y.length} module(s) loaded (${loadedA11y.join(", ")})`,
          });
        } else if (missingEssentialA11y.length > 0) {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "missing_a11y",
            severity: "warning",
            message: `Essential accessibility module(s) not loaded: ${missingEssentialA11y.join(", ")}`,
            details: {
              loaded: loadedA11y,
              missing: missingEssentialA11y,
              recommendation: "Add 'a11y/assistive-mml' and 'a11y/sre' to MathJax loader.load array",
            },
          });
        } else if (loadedA11y.length === 0) {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "no_a11y",
            severity: "warning",
            message: "No MathJax accessibility modules detected - screen reader users may have difficulty",
            details: {
              recommendation: "Add accessibility modules to MathJax loader configuration",
            },
          });
        }
      }

      // =====================================================================
      // Check 2: Unrendered LaTeX detection
      // =====================================================================
      if (analysis.unrenderedLatex.length > 0) {
        analysis.unrenderedLatex.forEach((unrendered, idx) => {
          // Try to match with source expression
          const sourceMatch = inventory.expressions.find(
            (e) => e.hash === unrendered.hash
          );

          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "unrendered",
            severity: "warning",
            sourceIndex: sourceMatch?.index ?? null,
            sourcePreview: sourceMatch?.preview ?? unrendered.preview,
            approximateLine: sourceMatch?.approximateLine ?? null,
            pattern: unrendered.pattern,
            likelyCause: determineLikelyCause(unrendered, sourceMatch),
            suggestedFix: suggestFix("unrendered", unrendered),
          });
        });
      } else {
        comparison.passedChecks.push({
          check: "no_unrendered",
          message: "No unrendered LaTeX detected",
        });
      }

      // =====================================================================
      // Check 3: Missing expressions (hash not found in export)
      // =====================================================================
      let missingCount = 0;
      inventory.expressions.forEach((expr) => {
        if (!exportHashes.has(expr.hash)) {
          // Double-check it's not in unrendered (already caught)
          const isUnrendered = analysis.unrenderedLatex.some(
            (u) => u.hash === expr.hash
          );
          
          if (!isUnrendered) {
            missingCount++;
            if (missingCount <= CONFIG.maxIssuesToShowConsole) {
              comparison.issues.push({
                id: comparison.issues.length + 1,
                type: "missing",
                severity: "warning",
                sourceIndex: expr.index,
                sourcePreview: expr.preview,
                approximateLine: expr.approximateLine,
                pattern: expr.pattern,
                likelyCause: "Expression may have been modified during processing or is embedded in another structure",
                suggestedFix: "Check if expression appears within a larger construct or was combined with adjacent content",
              });
            }
          }
        }
      });

      if (missingCount === 0) {
        comparison.passedChecks.push({
          check: "no_missing",
          message: "All source expressions found in export",
        });
      } else if (missingCount > CONFIG.maxIssuesToShowConsole) {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "missing_summary",
          severity: "info",
          message: `+${missingCount - CONFIG.maxIssuesToShowConsole} more missing expressions (see diagnostic file for full list)`,
        });
      }

      // =====================================================================
      // Check 4: Corrupted delimiters
      // =====================================================================
      if (analysis.corruptedDelimiters.length > 0) {
        comparison.issues.push({
          id: comparison.issues.length + 1,
          type: "corrupted_delimiters",
          severity: "error",
          count: analysis.corruptedDelimiters.length,
          message: `Found ${analysis.corruptedDelimiters.length} corrupted delimiter(s)`,
          details: analysis.corruptedDelimiters.slice(0, 5),
          suggestedFix: "Check escaping in LaTeX processor - delimiters may be double-escaped",
        });
      } else {
        comparison.passedChecks.push({
          check: "delimiter_integrity",
          message: "Delimiter integrity: OK",
        });
      }

      // =====================================================================
      // Check 5: Environment failures
      // =====================================================================
      if (analysis.environmentFailures.length > 0) {
        analysis.environmentFailures.forEach((failure) => {
          comparison.issues.push({
            id: comparison.issues.length + 1,
            type: "environment_failure",
            severity: "error",
            environment: failure.environment,
            message: `Environment \\begin{${failure.environment}} appears unprocessed`,
            likelyCause: "MathJax may not have the required package loaded for this environment",
            suggestedFix: `Ensure ams package is loaded in MathJax configuration`,
          });
        });
      }

      // =====================================================================
      // Determine overall status
      // =====================================================================
      const errorCount = comparison.issues.filter(
        (i) => i.severity === "error"
      ).length;
      const warningCount = comparison.issues.filter(
        (i) => i.severity === "warning"
      ).length;

      if (errorCount > 0) {
        comparison.status = "fail";
      } else if (warningCount > 0) {
        comparison.status = "warn";
      } else {
        comparison.status = "pass";
      }

comparison.summary = {
        status: comparison.status,
        errorCount: errorCount,
        warningCount: warningCount,
        passedCount: comparison.passedChecks.length,
        issuesByType: {
          unrendered: comparison.issues.filter((i) => i.type === "unrendered").length,
          missing: comparison.issues.filter((i) => i.type === "missing").length,
          corrupted: comparison.issues.filter((i) => i.type === "corrupted_delimiters").length,
          environmentFailure: comparison.issues.filter((i) => i.type === "environment_failure").length,
          a11y: comparison.issues.filter((i) => i.type === "missing_a11y" || i.type === "no_a11y").length,
          contentMismatch: comparison.issues.filter((i) => i.type === "content_mismatch").length,
          duplicateHashes: comparison.issues.filter((i) => i.type === "duplicate_hashes").length,
        },
      };

      logInfo(
        `✅ Comparison complete: ${comparison.status.toUpperCase()} ` +
        `(${errorCount} errors, ${warningCount} warnings)`
      );

      lastVerificationResult = comparison;
      return comparison;
    } catch (error) {
      logError("Error comparing source to export:", error);
      return null;
    }
  }

  /**
   * Determine likely cause of unrendered LaTeX
   * @param {Object} unrendered - Unrendered expression
   * @param {Object} sourceMatch - Matching source expression (if found)
   * @returns {string} - Likely cause description
   */
  function determineLikelyCause(unrendered, sourceMatch) {
    const content = unrendered.content || "";

    // Check for custom macros
    if (/\\[A-Z][a-z]*(?![a-zA-Z])/.test(content)) {
      return "Custom macro may not be defined in MathJax configuration";
    }

    // Check for complex environments
    if (/\\begin\{/.test(content)) {
      return "Environment may require additional MathJax packages";
    }

    // Check for special symbols
    if (/\\mathbb|\\mathcal/.test(content)) {
      return "Requires ams or mathtools package in MathJax";
    }

    // Default
    return "Expression may not have been processed by MathJax";
  }

  /**
   * Suggest fix for issue type
   * @param {string} issueType - Type of issue
   * @param {Object} details - Issue details
   * @returns {string} - Suggested fix
   */
  function suggestFix(issueType, details) {
    switch (issueType) {
      case "unrendered":
        if (details.pattern === "$") {
          return "Check that single-dollar delimiters are enabled in MathJax config (inlineMath: [['$', '$']])";
        }
        return "Verify MathJax is properly initialised and the expression is syntactically correct";
      
      case "missing":
        return "Expression may be embedded in another structure - check export HTML source";
      
      case "corrupted_delimiters":
        return "Review escaping logic in export pipeline - possible double-escaping";
      
      default:
        return "Review export pipeline configuration";
    }
  }

  // ===========================================================================================
  // PHASE 4: DIAGNOSTIC REPORTING
  // ===========================================================================================

  /**
   * Generate console diagnostic report
   * @param {Object} comparison - Comparison results
   * @param {Object} inventory - Source inventory
   * @param {Object} analysis - Export analysis
   * @param {Object} mathJaxConfig - MathJax configuration analysis (optional)
   */
function printDiagnosticReport(comparison, inventory, analysis, mathJaxConfig = null, crossRefAnalysis = null) {
    const sizeCategory = inventory?.sizeCategory || "unknown";
    const maxToShow = CONFIG.maxIssuesToShowConsole;

    console.log("\n" + "═".repeat(70));
    console.log("📊 LATEX EXPORT VERIFICATION REPORT");
    console.log("═".repeat(70));

    // Source inventory section
    console.log("\n📝 SOURCE INVENTORY:");
    if (inventory) {
      console.log(`   Total expressions: ${inventory.statistics.total}`);
      console.log(`   ├── Inline ($...$): ${inventory.statistics.byType.inline}`);
      console.log(`   ├── Display ($$...$$ or \\[...\\]): ${inventory.statistics.byType.display}`);
      console.log(`   └── Environments: ${inventory.statistics.byType.environment}`);
      
      if (Object.keys(inventory.statistics.byPattern).length > 0) {
        console.log("   Pattern breakdown:");
        Object.entries(inventory.statistics.byPattern).forEach(([pattern, count]) => {
          console.log(`      ${pattern}: ${count}`);
        });
      }
    } else {
      console.log("   ⚠️ No source inventory captured");
    }

    // Export analysis section
    console.log("\n📤 EXPORT ANALYSIS:");
    if (analysis) {
      console.log(`   Math elements found: ${analysis.summary.totalContainers}`);
      if (analysis.summary.pandocMathSpans > 0) {
        console.log(`   ├── Pandoc math spans: ${analysis.summary.pandocMathSpans}`);
      }
      if (analysis.summary.mathJaxContainers > 0) {
        console.log(`   ├── MathJax containers: ${analysis.summary.mathJaxContainers}`);
      }
      
      const unrenderedIcon = analysis.summary.unrenderedCount > 0 ? "⚠️" : "✅";
      console.log(`   Unrendered LaTeX found: ${analysis.summary.unrenderedCount} ${unrenderedIcon}`);
      
      if (analysis.summary.corruptedCount > 0) {
        console.log(`   Corrupted delimiters: ${analysis.summary.corruptedCount} ❌`);
      }
      if (analysis.summary.environmentFailureCount > 0) {
        console.log(`   Environment failures: ${analysis.summary.environmentFailureCount} ❌`);
      }
    } else {
      console.log("   ⚠️ No export analysis available");
    }

// MathJax configuration section
    if (mathJaxConfig) {
      console.log("\n🔧 MATHJAX CONFIGURATION:");
      if (mathJaxConfig.found) {
        console.log(`   ├── Packages: ${mathJaxConfig.packages.join(", ") || "none"}`);
        console.log(`   ├── Custom macros: ${mathJaxConfig.macroCount}`);
        if (mathJaxConfig.macroCount > 0) {
          const macroNames = Object.keys(mathJaxConfig.macros).slice(0, 5);
          console.log(`   │   (${macroNames.join(", ")}${mathJaxConfig.macroCount > 5 ? "..." : ""})`);
        }
        console.log(`   ├── Tags: ${mathJaxConfig.tags || "not set"}`);
        
        const delimIcon = mathJaxConfig.issues.length === 0 ? "✅" : "⚠️";
        console.log(`   ├── Delimiter config: ${delimIcon}`);
        
        // Accessibility modules section
        console.log("   └── ♿ Accessibility:");
        if (mathJaxConfig.a11y.modules.length > 0) {
          console.log(`       ├── Modules: ${mathJaxConfig.a11y.modules.join(", ")}`);
        } else {
          console.log("       ├── Modules: ⚠️ none loaded");
        }
        const mmlIcon = mathJaxConfig.a11y.assistiveMml === true ? "✅" : "⚠️";
        console.log(`       ├── AssistiveMML: ${mmlIcon} ${mathJaxConfig.a11y.assistiveMml ?? "not set"}`);
        if (mathJaxConfig.a11y.speechRules) {
          console.log(`       └── Speech rules: ${mathJaxConfig.a11y.speechRules}`);
        }
} else {
        console.log("   ❌ MathJax configuration not found!");
      }
    }

    // Cross-reference section
    if (crossRefAnalysis || (comparison && comparison.crossReferences)) {
      console.log("\n🔗 CROSS-REFERENCES:");
      
      if (sourceCrossReferences) {
        console.log(`   Source: ${sourceCrossReferences.statistics.totalLabels} labels, ${sourceCrossReferences.statistics.totalReferences} references`);
        
        if (Object.keys(sourceCrossReferences.statistics.byLabelType).length > 0) {
          console.log("   Label types:");
          Object.entries(sourceCrossReferences.statistics.byLabelType).forEach(([type, count]) => {
            console.log(`      ${type}: ${count}`);
          });
        }
      }
      
      if (crossRefAnalysis) {
        console.log(`   Export: ${crossRefAnalysis.statistics.totalAnchors} anchors`);
        console.log(`   ├── User refs (\\ref{}): ${crossRefAnalysis.statistics.totalUserRefs}`);
        console.log(`   ├── Navigation links: ${crossRefAnalysis.statistics.totalNavLinks}`);
        
        if (crossRefAnalysis.statistics.totalFootnotes > 0) {
          console.log(`   └── Footnotes: ${crossRefAnalysis.statistics.totalFootnotes}`);
        }
      }
      // Show display quality issues summary
      if (comparison && comparison.crossReferences) {
        const displayIssues = comparison.issues.filter(i => i.type === "crossref_display_quality");
        if (displayIssues.length > 0) {
          console.log(`   ⚠️ Display quality issues: ${displayIssues.length}`);
        }
      }
    }

    // Issues section
    if (comparison && comparison.issues.length > 0) {
      const issueCount = comparison.issues.length;
      const showCount = Math.min(issueCount, maxToShow);
      
      console.log(`\n⚠️ ISSUES DETECTED (showing ${showCount} of ${issueCount}):\n`);

      comparison.issues.slice(0, maxToShow).forEach((issue) => {
        const icon = issue.severity === "error" ? "❌" : "⚠️";
        console.log(`   [${issue.id}] ${icon} ${issue.type.toUpperCase()}`);
        
        if (issue.approximateLine) {
          console.log(`       Line ~${issue.approximateLine}`);
        }
        if (issue.sourcePreview) {
          console.log(`       Source: ${issue.sourcePreview}`);
        }
        if (issue.likelyCause) {
          console.log(`       Likely cause: ${issue.likelyCause}`);
        }
        console.log("");
      });

      if (issueCount > maxToShow) {
        console.log(`   [+${issueCount - maxToShow} more - run downloadLatexDiagnostics() for full list]\n`);
      }
    }

    // Passed checks section
    if (comparison && comparison.passedChecks.length > 0) {
      console.log("✅ PASSED CHECKS:");
      comparison.passedChecks.forEach((check) => {
        console.log(`   ├── ${check.message}`);
      });
    }

    // Status summary
    if (comparison) {
      console.log("\n" + "─".repeat(70));
      const statusIcon = 
        comparison.status === "pass" ? "✅" :
        comparison.status === "warn" ? "⚠️" : "❌";
      console.log(`${statusIcon} VERIFICATION STATUS: ${comparison.status.toUpperCase()}`);
      console.log("─".repeat(70));
    }

    console.log("\n💾 Run downloadLatexDiagnostics() for detailed LLM-friendly report");
    console.log("═".repeat(70) + "\n");
  }

  /**
   * Generate downloadable diagnostic file
   * @param {Object} options - Download options
   * @param {string} options.detail - 'summary' or 'full'
   * @returns {void}
   */
  function downloadDiagnostics(options = {}) {
    const { detail = "summary" } = options;

    if (!lastVerificationResult) {
      console.warn("⚠️ No verification results available. Run verifyLatexExport() first.");
      return;
    }

const diagnostic = {
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.1.0",
        documentTitle: document.title || "Unknown",
        detailLevel: detail,
        generatedBy: "LatexExportVerifier",
        verificationTiming: lastVerificationResult.timing || null,
      },
      summary: lastVerificationResult.summary,
      issues: lastVerificationResult.issues,
      passedChecks: lastVerificationResult.passedChecks,
    };

    // Add source inventory summary
    if (sourceInventory) {
      diagnostic.sourceInventorySummary = {
        total: sourceInventory.statistics.total,
        byType: sourceInventory.statistics.byType,
        byPattern: sourceInventory.statistics.byPattern,
        sizeCategory: sourceInventory.sizeCategory,
      };

      // Include expression samples based on detail level
      if (detail === "full") {
        diagnostic.sourceExpressions = sourceInventory.expressions;
      } else {
        // Summary mode: first 10 expressions
        diagnostic.expressionSamples = sourceInventory.expressions.slice(0, 10);
      }
    }

    // Generate LLM context summary
    diagnostic.llmContext = generateLLMContext(diagnostic);

    // Create and download file
    const blob = new Blob(
      [JSON.stringify(diagnostic, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `latex-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logInfo(`✅ Diagnostic file downloaded (${detail} mode)`);
  }

  /**
   * Generate LLM-friendly context summary
   * @param {Object} diagnostic - Diagnostic data
   * @returns {string} - Markdown-formatted context
   */
  function generateLLMContext(diagnostic) {
    let context = "## LaTeX Export Issue Summary\n\n";

    const summary = diagnostic.summary;
    const sourceStats = diagnostic.sourceInventorySummary;

    if (sourceStats) {
      context += `Document has ${sourceStats.total} LaTeX expressions `;
      context += `(${sourceStats.byType.inline} inline, ${sourceStats.byType.display} display, `;
      context += `${sourceStats.byType.environment} environments).\n\n`;
    }

    if (summary.status === "pass") {
      context += "**Status: PASS** - All expressions verified successfully.\n";
    } else {
      context += `**Status: ${summary.status.toUpperCase()}** - Issues detected:\n\n`;

if (summary.issuesByType.unrendered > 0) {
        context += `- ${summary.issuesByType.unrendered} unrendered expression(s)\n`;
      }
      if (summary.issuesByType.missing > 0) {
        context += `- ${summary.issuesByType.missing} missing expression(s)\n`;
      }
      if (summary.issuesByType.corrupted > 0) {
        context += `- ${summary.issuesByType.corrupted} corrupted delimiter(s)\n`;
      }
      if (summary.issuesByType.environmentFailure > 0) {
        context += `- ${summary.issuesByType.environmentFailure} environment failure(s)\n`;
      }
      if (summary.issuesByType.a11y > 0) {
        context += `- ${summary.issuesByType.a11y} accessibility issue(s)\n`;
      }
      if (summary.issuesByType.contentMismatch > 0) {
        context += `- ${summary.issuesByType.contentMismatch} content mismatch(es)\n`;
      }

      context += "\n### Issue Details\n\n";

      diagnostic.issues.slice(0, 10).forEach((issue, idx) => {
        context += `${idx + 1}. **${issue.type}**`;
        if (issue.approximateLine) {
          context += ` (line ~${issue.approximateLine})`;
        }
        context += "\n";
        if (issue.sourcePreview) {
          context += `   - Expression: \`${issue.sourcePreview}\`\n`;
        }
        if (issue.likelyCause) {
          context += `   - Likely cause: ${issue.likelyCause}\n`;
        }
        if (issue.suggestedFix) {
          context += `   - Suggested fix: ${issue.suggestedFix}\n`;
        }
        context += "\n";
      });

      if (diagnostic.issues.length > 10) {
        context += `\n*...and ${diagnostic.issues.length - 10} more issues*\n`;
      }
    }

    context += "\n## Suggested Investigation\n\n";
    context += "- Check MathJax configuration for required packages\n";
    context += "- Verify custom macros are defined in export MathJax config\n";
    context += "- Review delimiter escaping in export pipeline\n";

    return context;
  }

  // ===========================================================================================
  // MAIN PUBLIC FUNCTIONS
  // ===========================================================================================

  /**
   * Full verification workflow
   * Captures source (if needed), analyses export, compares, and reports
   * @param {Object} options - Verification options
   * @param {boolean} options.captureSource - Force re-capture of source
   * @param {string} options.exportHTML - Optional HTML to analyse (defaults to last export)
   * @param {boolean} options.skipMathJaxConfig - Skip MathJax config analysis
   * @returns {Object} - Verification results
   */
  function verifyLatexExport(options = {}) {
    logInfo("🔬 Starting LaTeX export verification...");
     const startTime = performance.now();

    const { 
      captureSource = false, 
      exportHTML = null,
      skipMathJaxConfig = false,
    } = options;

    // Step 1: Ensure we have source inventory
    if (!sourceInventory || captureSource) {
      captureSourceInventory();
    }

    if (!sourceInventory) {
      console.warn("⚠️ Cannot verify - no source inventory available");
      console.log("💡 Tip: Enter LaTeX content in the input area first");
      return null;
    }

    // Step 2: Get export HTML
    let html = exportHTML;
    if (!html) {
      // Try to get from stored export
      html = window.__lastExportHTML || window.lastGeneratedHTML;
    }

    if (!html) {
      console.warn("⚠️ Cannot verify - no exported HTML available");
      console.log("💡 Tip: Export a document first, then run verifyLatexExport()");
      return null;
    }

// Step 3: Analyse export
    const analysis = analyseExportHTML(html);
    if (!analysis) {
      logError("Export analysis failed");
      return null;
    }

    // Step 4: Analyse MathJax configuration
    let mathJaxConfig = null;
    if (!skipMathJaxConfig) {
      mathJaxConfig = analyseMathJaxConfig(html);
    }

    // Step 5: Analyse cross-references in export
    let crossRefAnalysis = null;
    let crossRefComparison = null;
    if (sourceCrossReferences) {
      crossRefAnalysis = analyseCrossReferencesInExport(html);
      if (crossRefAnalysis) {
        crossRefComparison = compareCrossReferences(sourceCrossReferences, crossRefAnalysis);
      }
    }

    // Step 6: Compare LaTeX expressions
    const comparison = compareSourceToExport(sourceInventory, analysis, mathJaxConfig);
    if (!comparison) {
      logError("Comparison failed");
      return null;
    }

    // Merge cross-reference results into main comparison
    if (crossRefComparison) {
      comparison.crossReferences = {
        sourceLabels: crossRefComparison.statistics.sourceLabels,
        sourceRefs: crossRefComparison.statistics.sourceRefs,
        exportLinks: crossRefComparison.statistics.exportLinks,
        exportAnchors: crossRefComparison.statistics.exportAnchors,
      };
      
      // Add cross-reference issues to main issues list
      crossRefComparison.issues.forEach(issue => {
        comparison.issues.push({
          ...issue,
          id: comparison.issues.length + 1,
        });
      });
      
      // Add cross-reference passed checks
      crossRefComparison.passedChecks.forEach(check => {
        comparison.passedChecks.push(check);
      });

// Update summary
      comparison.summary.issuesByType.crossRefOrphanRefs = 
        crossRefComparison.issues.filter(i => i.type === "crossref_orphan_refs").length;
      comparison.summary.issuesByType.crossRefOrphanNav = 
        crossRefComparison.issues.filter(i => i.type === "crossref_orphan_nav").length;
      comparison.summary.issuesByType.crossRefDisplayQuality = 
        crossRefComparison.issues.filter(i => i.type === "crossref_display_quality").length;
      comparison.summary.issuesByType.crossRefMismatch = 
        crossRefComparison.issues.filter(i => i.type === "crossref_count_mismatch").length;

      // Recalculate status
      const errorCount = comparison.issues.filter(i => i.severity === "error").length;
      const warningCount = comparison.issues.filter(i => i.severity === "warning").length;
      
      if (errorCount > 0) {
        comparison.status = "fail";
      } else if (warningCount > 0) {
        comparison.status = "warn";
      } else {
        comparison.status = "pass";
      }
      
      comparison.summary.status = comparison.status;
      comparison.summary.errorCount = errorCount;
      comparison.summary.warningCount = warningCount;
    }

    // Calculate duration
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    // Add timing to comparison result
    if (comparison) {
      comparison.timing = {
        durationMs: durationMs,
        durationFormatted: durationMs < 1000 
          ? `${durationMs}ms` 
          : `${(durationMs / 1000).toFixed(2)}s`,
      };
    }

    // Print diagnostic report
    printDiagnosticReport(comparison, sourceInventory, analysis, mathJaxConfig, crossRefAnalysis);

    logInfo(`⏱️ Verification completed in ${durationMs}ms`);

    return {
      status: comparison.status,
      sourceExpressionCount: sourceInventory.statistics.total,
      exportContainerCount: analysis.summary.totalContainers,
      issueCount: comparison.issues.length,
      passedChecks: comparison.passedChecks.length,
      comparison: comparison,
      mathJaxConfig: mathJaxConfig,
    };
  }

  /**
   * Get current verification status
   * @returns {string} - 'pass' | 'warn' | 'fail' | 'unknown'
   */
  function getVerificationStatus() {
    if (!lastVerificationResult) {
      return "unknown";
    }
    return lastVerificationResult.status;
  }

  /**
   * Clear stored inventory and results
   */
  function clearInventory() {
    sourceInventory = null;
    sourceCrossReferences = null;
    lastVerificationResult = null;
    logInfo("✅ LaTeX inventory and cross-references cleared");
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  /**
   * Test the LatexExportVerifier module
   * @returns {Object} - Test results
   */
  function testLatexExportVerifier() {
    logInfo("🧪 Testing LatexExportVerifier...");

    const tests = {
      moduleExists: () => !!window.LatexExportVerifier,
      
      hasRequiredMethods: () => {
        const required = [
          "captureSourceInventory",
          "analyseExportHTML",
          "analyseMathJaxConfig",
          "verifyLatexExport",
          "downloadDiagnostics",
          "getVerificationStatus",
          "clearInventory",
          "detectCustomMacros",
        ];
        return required.every((method) => 
          typeof window.LatexExportVerifier[method] === "function"
        );
      },

      simpleHashWorks: () => {
        const hash1 = simpleHash("test");
        const hash2 = simpleHash("test");
        const hash3 = simpleHash("different");
        return hash1 === hash2 && hash1 !== hash3 && hash1.length === 8;
      },

      truncateWorks: () => {
        const short = truncate("short", 10);
        const long = truncate("this is a very long string", 10);
        return short === "short" && long.endsWith("...");
      },

      normaliseLatexWorks: () => {
        const normalised = normaliseLatex("  x  +  y  ");
        return normalised === "x + y";
      },

      analyseExportHTMLHandlesEmpty: () => {
        const result = analyseExportHTML("<html><body></body></html>");
        return result !== null && 
               result.summary.totalContainers === 0 &&
               result.mathElements.length === 0;
      },

      analyseExportHTMLFindsPandocSpans: () => {
        const testHTML = `
          <html><body>
            <span class="math inline">\\(x^2\\)</span>
            <span class="math display">\\[y = mx + b\\]</span>
            <span class="math numbered-env">\\begin{align}a &= b\\end{align}</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && 
               result.mathElements.length === 3 &&
               result.summary.pandocMathSpans === 3;
      },

      analyseExportHTMLExcludesScripts: () => {
        const testHTML = `
          <html><body>
            <script>const x = \${variable}; const price = $100;</script>
            <span class="math inline">\\(real math\\)</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        // Should find 1 math element, not pick up the JS template literal or $100
        return result !== null && 
               result.mathElements.length === 1 &&
               result.unrenderedLatex.length === 0;
      },

      doesNotFlagCorrectMathAsUnrendered: () => {
        // This is the key test - correct Pandoc output should NOT be flagged
        const testHTML = `
          <html><body>
            <p>Some text with <span class="math inline">\\(x^2 + y^2\\)</span> inline math.</p>
            <p>Display: <span class="math display">\\[E = mc^2\\]</span></p>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && 
               result.mathElements.length === 2 &&
               result.unrenderedLatex.length === 0 &&
               result.environmentFailures.length === 0;
      },

      getSizeCategoryWorks: () => {
        return (
          getSizeCategory(10) === "small" &&
          getSizeCategory(100) === "medium" &&
          getSizeCategory(300) === "large" &&
          getSizeCategory(600) === "veryLarge"
        );
      },

analyseMathJaxConfigFindsConfig: () => {
        const testHTML = `
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true,
                packages: {'[+]': ['ams', 'amssymb']},
                tags: 'ams',
                macros: {
                  R: ['\\\\mathbb{R}', 0],
                  N: ['\\\\mathbb{N}', 0]
                }
              }
            };
          </script>
        `;
        const result = analyseMathJaxConfig(testHTML);
        
        if (!result || !result.found) {
          return false;
        }
        
        // Verify delimiters were correctly extracted and unescaped
        const hasParenDelim = result.delimiters.inlineMath.some(
          d => d[0] === "\\(" && d[1] === "\\)"
        );
        const hasBracketDelim = result.delimiters.displayMath.some(
          d => d[0] === "\\[" && d[1] === "\\]"
        );
        
        // Check for critical config issues (not a11y warnings, which are expected when no a11y config)
        const criticalIssues = result.issues.filter(
          i => i.type !== "missing_a11y_module" && i.severity === "error"
        );
        
        return result.packages.includes("ams") &&
               result.macroCount === 2 &&
               hasParenDelim &&
               hasBracketDelim &&
               criticalIssues.length === 0;
      },

      analyseMathJaxConfigDetectsMissingConfig: () => {
        const testHTML = "<html><body>No MathJax here</body></html>";
        const result = analyseMathJaxConfig(testHTML);
        return result !== null &&
               result.found === false &&
               result.issues.length > 0;
      },

detectCustomMacrosWorks: () => {
        const mockInventory = {
          expressions: [
            { latex: "\\R^n" },
            { latex: "\\N \\cup \\Z" },
            { latex: "x + y" }, // No custom macros
          ],
        };
        const macros = detectCustomMacros(mockInventory);
        return macros.includes("R") && 
               macros.includes("N") && 
               macros.includes("Z");
      },

      // =====================================================================
      // Display Math Tests
      // =====================================================================
      
      analyseExportHTMLHandlesDisplayMath: () => {
        const testHTML = `
          <html><body>
            <p>Text before</p>
            <span class="math display" data-math-parent-id="test-1">\\[E = mc^2\\]</span>
            <p>Text after</p>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        if (!result || result.mathElements.length !== 1) return false;
        
        const elem = result.mathElements[0];
        return elem.type === "display" && 
               elem.latex === "E = mc^2" &&
               elem.hasParentId === true;
      },

      analyseExportHTMLHandlesEnvironments: () => {
        const testHTML = `
          <html><body>
            <span class="math numbered-env" data-math-env="align" data-math-parent-id="test-1">\\begin{align}a &= b \\\\c &= d\\end{align}</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        if (!result || result.mathElements.length !== 1) return false;
        
        const elem = result.mathElements[0];
        return elem.type === "environment" && elem.hasParentId === true;
      },

      analyseExportHTMLHandlesMixedTypes: () => {
        const testHTML = `
          <html><body>
            <p>Inline: <span class="math inline" data-math-parent-id="test-1">\\(x^2\\)</span></p>
            <span class="math display" data-math-parent-id="test-2">\\[\\int_0^1 x\\,dx\\]</span>
            <span class="math numbered-env" data-math-parent-id="test-3">\\begin{equation}y = mx + b\\end{equation}</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        if (!result || result.mathElements.length !== 3) return false;
        
        const types = result.mathElements.map(e => e.type);
        return types[0] === "inline" && 
               types[1] === "display" && 
               types[2] === "environment";
      },

      // =====================================================================
      // Negative Tests - Ensure verifier catches real problems
      // =====================================================================

      detectsUnrenderedDollarMath: () => {
        // Raw $...$ in content area (outside math spans) should be flagged
        const testHTML = `
          <html><body>
            <main>
              <p>This has unrendered math: $x^2 + y^2 = z^2$ in the text.</p>
            </main>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && result.unrenderedLatex.length > 0;
      },

      detectsUnrenderedDisplayMath: () => {
        // Raw $$...$$ in content area should be flagged
        const testHTML = `
          <html><body>
            <main>
              <p>Display math: $$E = mc^2$$ not rendered.</p>
            </main>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && result.unrenderedLatex.length > 0;
      },

      detectsEnvironmentFailures: () => {
        // Raw \begin{align} in content (outside math spans) is a failure
        const testHTML = `
          <html><body>
            <main>
              <p>Failed: \\begin{align}a &= b\\end{align}</p>
            </main>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && result.environmentFailures.length > 0;
      },

detectsMissingMathJaxConfig: () => {
        const testHTML = `
          <html><head></head><body>
            <span class="math inline">\\(x\\)</span>
          </body></html>
        `;
        const config = analyseMathJaxConfig(testHTML);
        return config !== null && 
               config.found === false && 
               config.issues.length > 0;
      },

      // =====================================================================
      // Accessibility Module Tests
      // =====================================================================

      analyseMathJaxConfigFindsA11yModules: () => {
        const testHTML = `
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
              },
              loader: {
                load: [
                  'a11y/assistive-mml',
                  'a11y/sre',
                  'a11y/semantic-enrich',
                  'a11y/explorer'
                ]
              },
              a11y: {
                assistiveMml: true,
                speechRules: 'mathspeak'
              }
            };
          </script>
        `;
        const result = analyseMathJaxConfig(testHTML);
        
        if (!result || !result.found) return false;
        
        return result.a11y.modules.includes("assistive-mml") &&
               result.a11y.modules.includes("sre") &&
               result.a11y.modules.includes("semantic-enrich") &&
               result.a11y.modules.includes("explorer") &&
               result.a11y.assistiveMml === true &&
               result.a11y.speechRules === "mathspeak";
      },

analyseMathJaxConfigWarnsOnMissingA11y: () => {
        const testHTML = `
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
              }
            };
          </script>
        `;
        const result = analyseMathJaxConfig(testHTML);
        
        if (!result || !result.found) return false;
        
        // Should have warnings about missing a11y modules
        const hasA11yWarning = result.issues.some(
          issue => issue.type === "missing_a11y_module"
        );
        return hasA11yWarning;
      },

      // =====================================================================
      // Nested Math and Edge Case Tests
      // =====================================================================

      handlesNestedTextInMath: () => {
        // Math containing \text{} with nested math should be handled
        const testHTML = `
          <html><body>
            <span class="math display" data-math-parent-id="test-1">\\[f(x) = \\begin{cases} 1 & \\text{if } x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}\\]</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && 
               result.mathElements.length === 1 &&
               result.mathElements[0].type === "display";
      },

      handlesComplexEnvironments: () => {
        // Complex environments like cases, matrix should be detected
        const testHTML = `
          <html><body>
            <span class="math display" data-math-parent-id="test-1">\\[\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\]</span>
            <span class="math display" data-math-parent-id="test-2">\\[\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}\\]</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && result.mathElements.length === 2;
      },

      handlesSpecialCharactersInMath: () => {
        // Math with special characters should be handled correctly
        const testHTML = `
          <html><body>
            <span class="math inline" data-math-parent-id="test-1">\\(\\alpha \\beta \\gamma\\)</span>
            <span class="math inline" data-math-parent-id="test-2">\\(\\sum_{i=1}^{n} x_i\\)</span>
            <span class="math inline" data-math-parent-id="test-3">\\(\\frac{\\partial f}{\\partial x}\\)</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && 
               result.mathElements.length === 3 &&
               result.unrenderedLatex.length === 0;
      },

      handlesUnicodeInMath: () => {
        // Unicode characters in math context
        const testHTML = `
          <html><body>
            <span class="math inline" data-math-parent-id="test-1">\\(x \\in \\mathbb{R}\\)</span>
            <span class="math inline" data-math-parent-id="test-2">\\(\\forall \\epsilon > 0\\)</span>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        return result !== null && result.mathElements.length === 2;
      },

      doesNotFlagCurrencySymbols: () => {
        // Currency like $100 should NOT be flagged as unrendered math
        const testHTML = `
          <html><body>
            <main>
              <p>The price is $100 and the discount is $20.</p>
              <p>Total: $80</p>
            </main>
          </body></html>
        `;
        const result = analyseExportHTML(testHTML);
        // Should NOT flag these as unrendered (no LaTeX-like content)
        return result !== null && result.unrenderedLatex.length === 0;
      },

      // =====================================================================
      // Large Document / Performance Tests
      // =====================================================================

      handlesLargeExpressionCount: () => {
        // Generate HTML with 100 math expressions
        let mathSpans = "";
        for (let i = 0; i < 100; i++) {
          mathSpans += `<span class="math inline" data-math-parent-id="test-${i}">\\(x_{${i}}\\)</span>\n`;
        }
        const testHTML = `<html><body>${mathSpans}</body></html>`;
        
        const startTime = performance.now();
        const result = analyseExportHTML(testHTML);
        const duration = performance.now() - startTime;
        
        // Should complete in reasonable time (<500ms) and find all expressions
        return result !== null && 
               result.mathElements.length === 100 &&
               duration < 500;
      },

      // =====================================================================
      // Cross-Reference Tests
      // =====================================================================

      extractsCrossReferencesFromSource: () => {
        const testSource = `
          \\section{Introduction}
          \\label{sec:intro}
          
          See Section~\\ref{sec:methods} for details.
          
          \\begin{equation}
          \\label{eq:fundamental}
          E = mc^2
          \\end{equation}
          
          As shown in Equation~\\ref{eq:fundamental}.
        `;
        const result = extractSourceCrossReferences(testSource);
        return result !== null && 
               result.statistics.totalLabels === 2 &&
               result.statistics.totalReferences === 2;
      },

      identifiesLabelTypes: () => {
        return getLabelType("eq:fundamental") === "equation" &&
               getLabelType("sec:intro") === "section" &&
               getLabelType("tab:results") === "table" &&
               getLabelType("fig:diagram") === "figure" &&
               getLabelType("ref:smith2020") === "bibliography";
      },

      analysesCrossRefsInExport: () => {
        const testHTML = `
          <html><body>
            <h1 id="content-sec:intro">Introduction</h1>
            <p>See <a href="#content-sec:methods" data-reference-type="ref" data-reference="sec:methods">Section 2</a>.</p>
            <span id="content-eq:fundamental" class="math display">E = mc^2</span>
            <p>As shown in <a href="#content-eq:fundamental" data-reference-type="ref" data-reference="eq:fundamental">Equation 1</a>.</p>
          </body></html>
        `;
        const result = analyseCrossReferencesInExport(testHTML);
        return result !== null && 
               result.links.length === 2 &&
               result.anchors.length === 2;
      },

detectsOrphanUserRefs: () => {
        // User ref (from \ref{}) with data-reference-type="ref" pointing to non-existent anchor
        const testHTML = `
          <html><body>
            <span id="content-sec:exists"></span>
            <p>See <a href="#content-nonexistent" data-reference-type="ref" data-reference="nonexistent">broken ref</a>.</p>
          </body></html>
        `;
        const analysis = analyseCrossReferencesInExport(testHTML);
        const sourceRefs = {
          labels: [{ id: "sec:exists" }],
          references: [{ target: "nonexistent" }],
          statistics: { totalLabels: 1, totalReferences: 1, byLabelType: {}, byRefType: {} },
        };
        const comparison = compareCrossReferences(sourceRefs, analysis);
        return comparison !== null && 
               comparison.issues.some(i => i.type === "crossref_orphan_refs");
      },

      detectsOrphanNavLinks: () => {
        // Navigation link (ToC/sidebar) without data-reference-type pointing to non-existent anchor
        const testHTML = `
          <html><body>
            <p>See <a href="#content-nonexistent">broken nav link</a>.</p>
          </body></html>
        `;
        const analysis = analyseCrossReferencesInExport(testHTML);
        const sourceRefs = {
          labels: [],
          references: [],
          statistics: { totalLabels: 0, totalReferences: 0, byLabelType: {}, byRefType: {} },
        };
        const comparison = compareCrossReferences(sourceRefs, analysis);
        return comparison !== null && 
               comparison.issues.some(i => i.type === "crossref_orphan_nav");
      },
      detectsPoorDisplayQuality: () => {
        const testHTML = `
          <html><body>
            <span id="content-eq:fundamental"></span>
            <p><a href="#content-eq:fundamental" data-reference="eq:fundamental">Equation fundamental</a></p>
            <span id="content-ref:smith2020"></span>
            <p><a href="#content-ref:smith2020" data-reference="ref:smith2020">ref:smith2020</a></p>
          </body></html>
        `;
        const analysis = analyseCrossReferencesInExport(testHTML);
        // Both links have poor display (showing label names, not numbers)
        const poorDisplayCount = analysis.links.filter(l => !l.hasProperDisplay).length;
        return poorDisplayCount === 2;
      },

      acceptsGoodDisplayQuality: () => {
        const testHTML = `
          <html><body>
            <span id="content-eq:fundamental"></span>
            <p><a href="#content-eq:fundamental" data-reference="eq:fundamental">Equation 1</a></p>
            <span id="content-sec:intro"></span>
            <p><a href="#content-sec:intro" data-reference="sec:intro">Section 1</a></p>
          </body></html>
        `;
        const analysis = analyseCrossReferencesInExport(testHTML);
        // Both links have good display (showing numbers)
        const goodDisplayCount = analysis.links.filter(l => l.hasProperDisplay).length;
        return goodDisplayCount === 2;
      },

      hashPerformanceIsAcceptable: () => {
        // Test hash function performance with many calls
        const startTime = performance.now();
        for (let i = 0; i < 1000; i++) {
          simpleHash(`expression_${i}_with_some_latex_content_\\frac{x}{y}`);
        }
        const duration = performance.now() - startTime;
        
        // Should complete 1000 hashes in <100ms
        return duration < 100;
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          console.log(`  ✅ ${testName}: PASSED`);
        } else {
          console.log(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        console.log(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    console.log(`\n📊 LatexExportVerifier: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      moduleName: "LatexExportVerifier",
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

return {
    // Main verification functions
    verifyLatexExport,
    captureSourceInventory,
    analyseExportHTML,
    analyseMathJaxConfig,
    downloadDiagnostics,
    
    // Cross-reference functions
    extractSourceCrossReferences,
    analyseCrossReferencesInExport,
    compareCrossReferences,
    
    // Status and utility
    getVerificationStatus,
    clearInventory,
    detectCustomMacros,
    
    // Testing
    testLatexExportVerifier,
    
    // Logging (for debugging)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.LatexExportVerifier = LatexExportVerifier;

// ===========================================================================================
// REGISTER GLOBAL CONSOLE SHORTCUTS
// ===========================================================================================
// These provide convenient access to common functions without typing the module prefix

(function registerGlobalShortcuts() {
  // Main verification functions
  window.verifyLatexExport = function(options) {
    return LatexExportVerifier.verifyLatexExport(options);
  };
  
  window.captureLatexInventory = function(sourceText) {
    return LatexExportVerifier.captureSourceInventory(sourceText);
  };
  
  window.downloadLatexDiagnostics = function(options) {
    return LatexExportVerifier.downloadDiagnostics(options);
  };
  
  // Status and utility functions
  window.getLatexVerificationStatus = function() {
    return LatexExportVerifier.getVerificationStatus();
  };
  
  window.clearLatexInventory = function() {
    return LatexExportVerifier.clearInventory();
  };
  
  // Testing function
  window.testLatexExportVerifier = function() {
    return LatexExportVerifier.testLatexExportVerifier();
  };
  
  // Analyse function for direct HTML analysis
  window.analyseLatexExport = function(html) {
    return LatexExportVerifier.analyseExportHTML(html);
  };
  
  // MathJax config analysis
  window.analyseMathJaxConfig = function(html) {
    return LatexExportVerifier.analyseMathJaxConfig(html);
  };
})();

console.log(
  "✅ LatexExportVerifier v1.1 loaded - Use verifyLatexExport() after exporting to check LaTeX rendering"
);
console.log(
  "   Available commands: testLatexExportVerifier(), captureLatexInventory(), verifyLatexExport(), downloadLatexDiagnostics()"
);
console.log(
  "   Checks: expression count, sequence, anchors, types, content fidelity, a11y modules, MathJax config, custom macros"
);