/**
 * @fileoverview MathPix Semantic Mapper — Lines.json Analysis for LLM Prompt Enrichment
 * @module MathPixSemanticMapper
 * @requires None — Standalone data transformation module
 * @version 1.0.0
 * @since Phase 7.5E
 *
 * @description
 * Extracts semantically useful data from MathPix's lines.json API response and
 * formats it for LLM prompt injection. Produces two output formats:
 * - formatForPrompt(): concise text (200–600 tokens) for chain-of-thought prompts
 * - formatForDisplay(): structured object for UI rendering
 *
 * Data extracted:
 * 1. Document region map (page-by-page content type summary)
 * 2. Low-confidence OCR regions (areas needing extra LLM attention)
 * 3. Diagram/image inventory with extracted labels
 * 4. Table detection
 * 5. Page-level statistics (line counts, confidence distribution)
 *
 * Architecture:
 * - IIFE with singleton pattern (matches project conventions)
 * - Zero external dependencies — pure data transformation
 * - Defensive coding for varying lines.json formats
 * - Independent of pdf-visualiser and mmd-analyser modules
 *
 * Lines.json Structure (from real data audit):
 * { pages: [{ page, lines: [{ type, text, confidence, confidence_rate,
 *   is_handwritten, is_printed, font_size, cnt, region, id,
 *   children_ids, parent_id, ... }], page_width, page_height }] }
 *
 * @see mathpix-ai-enhancer.js — Consumes this module's output (Phase 7.5F)
 * @see mathpix-ai-mmd-analyser.js — Companion module for MMD text analysis
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[SemanticMapper] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[SemanticMapper] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[SemanticMapper] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[SemanticMapper] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /**
   * Confidence thresholds for categorisation.
   * Aligned conceptually with pdf-visualiser but independently defined
   * to avoid coupling.
   */
  const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.95,
    MEDIUM: 0.8,
    LOW: 0.6,
    // Below LOW = VERY_LOW
  };

  /**
   * Threshold below which a region is flagged for LLM attention.
   * Lines with confidence below this are reported in the prompt.
   */
  const LOW_CONFIDENCE_ALERT_THRESHOLD = 0.6;

  /**
   * Minimum number of adjacent low-confidence lines to form a "cluster".
   * Single low-confidence lines are still reported individually.
   */
  const LOW_CONFIDENCE_CLUSTER_MIN = 2;

  /**
   * Line types that represent structural containers rather than content.
   * These typically have no confidence and no text — skip in content analysis.
   */
  const STRUCTURAL_TYPES = new Set([
    "section_header",
    "column",
    "table",
    "table_column",
    "table_row",
  ]);

  /**
   * Line types indicating diagram/chart content.
   */
  const DIAGRAM_TYPES = new Set(["diagram", "chart"]);

  /**
   * Line types that carry diagram label text (children of diagram lines).
   */
  const DIAGRAM_LABEL_TYPES = new Set(["chart_info", "figure_label"]);

  /**
   * Line types that are table-related.
   */
  const TABLE_TYPES = new Set([
    "table",
    "table_column",
    "table_row",
    "simple_cell",
  ]);

  /**
   * Line types to exclude from content analysis (metadata, not document content).
   */
  const METADATA_TYPES = new Set(["page_info"]);

  // ============================================================================
  // MAIN CLASS
  // ============================================================================

  class MathPixSemanticMapper {
    constructor() {
      logInfo("Creating MathPixSemanticMapper instance...");
      this.version = "1.0.0";
    }

    // ==========================================================================
    // MAIN ENTRY POINT
    // ==========================================================================

    /**
     * Main entry point — analyse lines.json data.
     * @param {Array|Object|null} linesData - Raw lines.json data from session
     * @returns {Object|null} Structured analysis, or null if no data available
     */
    analyse(linesData) {
      if (!linesData) {
        logDebug("No lines data provided");
        return null;
      }

      const normalised = this.normaliseInput(linesData);
      if (!normalised || normalised.pages.length === 0) {
        logDebug("No pages after normalisation");
        return null;
      }

      const startTime = performance.now();

      const result = {
        version: this.version,
        timestamp: Date.now(),
        regionMap: this.extractRegionMap(normalised),
        lowConfidence: this.extractLowConfidence(normalised),
        diagrams: this.extractDiagramInventory(normalised),
        tables: this.extractTableInfo(normalised),
        pageStats: this.extractPageStats(normalised),
      };

      const elapsed = performance.now() - startTime;
      logDebug(`Analysis completed in ${elapsed.toFixed(1)}ms`);

      return result;
    }

    // ==========================================================================
    // INPUT NORMALISATION
    // ==========================================================================

    /**
     * Normalise various lines.json input formats into a consistent structure.
     * Real data is always { pages: [{ page, lines, ... }] } but we handle
     * edge cases defensively.
     *
     * @param {*} linesData - Raw input
     * @returns {{ pages: Array }|null} Normalised structure or null
     */
    normaliseInput(linesData) {
      // Standard format: { pages: [...] }
      if (
        linesData &&
        typeof linesData === "object" &&
        !Array.isArray(linesData)
      ) {
        if (Array.isArray(linesData.pages) && linesData.pages.length > 0) {
          logDebug(
            `Normalised: object with pages array (${linesData.pages.length} pages)`,
          );
          return { pages: linesData.pages };
        }

        // Alternative: { lines: [...] } — single page, no pages wrapper
        if (Array.isArray(linesData.lines) && linesData.lines.length > 0) {
          logDebug(
            `Normalised: object with lines array (${linesData.lines.length} lines, wrapping as single page)`,
          );
          return {
            pages: [
              {
                page: 1,
                lines: linesData.lines,
                page_width: linesData.page_width ?? null,
                page_height: linesData.page_height ?? null,
              },
            ],
          };
        }
      }

      // Flat array of lines — treat as single page
      if (Array.isArray(linesData) && linesData.length > 0) {
        // Check if it's an array of page objects
        if (linesData[0] && Array.isArray(linesData[0].lines)) {
          logDebug(
            `Normalised: array of page objects (${linesData.length} pages)`,
          );
          return { pages: linesData };
        }

        // Array of line objects
        logDebug(
          `Normalised: flat array of lines (${linesData.length} lines, wrapping as single page)`,
        );
        return {
          pages: [
            {
              page: 1,
              lines: linesData,
              page_width: null,
              page_height: null,
            },
          ],
        };
      }

      logWarn("Could not normalise lines.json input", typeof linesData);
      return null;
    }

    // ==========================================================================
    // EXTRACTION METHODS
    // ==========================================================================

    /**
     * Extract a page-by-page content region map.
     * Determines content type (handwritten/printed/mixed), primary content
     * categories, and notable characteristics per page.
     *
     * @param {{ pages: Array }} normalised - Normalised lines data
     * @returns {Array<Object>} Per-page region summaries
     */
    extractRegionMap(normalised) {
      const regionMap = [];

      for (const page of normalised.pages) {
        const pageNum = page.page ?? regionMap.length + 1;
        const lines = page.lines || [];

        // Count content lines (excluding metadata like page_info)
        const contentLines = lines.filter((l) => !METADATA_TYPES.has(l.type));

        let handwrittenCount = 0;
        let printedCount = 0;
        const typeDistribution = {};

        for (const line of contentLines) {
          if (line.is_handwritten) handwrittenCount++;
          if (line.is_printed) printedCount++;

          const lineType = line.type || "unknown";
          if (
            !STRUCTURAL_TYPES.has(lineType) &&
            !METADATA_TYPES.has(lineType)
          ) {
            typeDistribution[lineType] = (typeDistribution[lineType] || 0) + 1;
          }
        }

        // Determine writing type
        let writingType = "unknown";
        if (handwrittenCount > 0 && printedCount > 0) {
          // Both present — check ratio
          const total = handwrittenCount + printedCount;
          const hwRatio = handwrittenCount / total;
          if (hwRatio > 0.8) {
            writingType = "handwritten";
          } else if (hwRatio < 0.2) {
            writingType = "printed";
          } else {
            writingType = "mixed";
          }
        } else if (handwrittenCount > 0) {
          writingType = "handwritten";
        } else if (printedCount > 0) {
          writingType = "printed";
        }

        // Determine primary content types (sorted by frequency)
        const sortedTypes = Object.entries(typeDistribution)
          .sort((a, b) => b[1] - a[1])
          .map(([type]) => type);

        // Calculate page mean confidence
        const confidences = contentLines
          .map((l) => l.confidence)
          .filter((c) => c != null && typeof c === "number");
        const meanConfidence =
          confidences.length > 0
            ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
            : null;

        // Check for notable features
        const hasDiagrams = contentLines.some((l) => DIAGRAM_TYPES.has(l.type));
        const hasTables = contentLines.some((l) => TABLE_TYPES.has(l.type));
        const hasLowConfidence = confidences.some(
          (c) => c < LOW_CONFIDENCE_ALERT_THRESHOLD,
        );

        regionMap.push({
          page: pageNum,
          writingType,
          contentTypes: sortedTypes,
          lineCount: contentLines.length,
          meanConfidence,
          hasDiagrams,
          hasTables,
          hasLowConfidence,
          handwrittenCount,
          printedCount,
        });
      }

      return regionMap;
    }

    /**
     * Extract low-confidence regions that the LLM should pay extra attention to.
     * Groups adjacent low-confidence lines into clusters for concise reporting.
     *
     * @param {{ pages: Array }} normalised - Normalised lines data
     * @returns {Array<Object>} Low-confidence regions with page, line range, confidence
     */
    extractLowConfidence(normalised) {
      const regions = [];

      for (const page of normalised.pages) {
        const pageNum = page.page ?? 1;
        const lines = page.lines || [];

        // Collect low-confidence lines with their line numbers
        const lowConfLines = [];
        for (const line of lines) {
          const conf = line.confidence;
          if (
            conf != null &&
            typeof conf === "number" &&
            conf < LOW_CONFIDENCE_ALERT_THRESHOLD
          ) {
            lowConfLines.push({
              lineNum: line.line ?? null,
              confidence: conf,
              type: line.type || "unknown",
              isHandwritten: !!line.is_handwritten,
              textSnippet: this._truncateText(line.text, 40),
            });
          }
        }

        if (lowConfLines.length === 0) continue;

        // Group adjacent lines into clusters
        const clusters = this._clusterLowConfidenceLines(lowConfLines);

        for (const cluster of clusters) {
          const meanConf =
            cluster.reduce((sum, l) => sum + l.confidence, 0) / cluster.length;
          const minConf = Math.min(...cluster.map((l) => l.confidence));
          const maxConf = Math.max(...cluster.map((l) => l.confidence));

          // Determine line range description
          let lineRange;
          const lineNums = cluster
            .map((l) => l.lineNum)
            .filter((n) => n != null);
          if (lineNums.length > 0) {
            const minLine = Math.min(...lineNums);
            const maxLine = Math.max(...lineNums);
            lineRange =
              minLine === maxLine ? `${minLine}` : `${minLine}-${maxLine}`;
          } else {
            lineRange = "unknown";
          }

          // Note characteristics
          const allHandwritten = cluster.every((l) => l.isHandwritten);
          const note = allHandwritten ? "handwritten" : "";

          regions.push({
            page: pageNum,
            lineRange,
            lineCount: cluster.length,
            meanConfidence: Math.round(meanConf * 1000) / 1000,
            minConfidence: Math.round(minConf * 1000) / 1000,
            maxConfidence: Math.round(maxConf * 1000) / 1000,
            note,
          });
        }
      }

      return regions;
    }

    /**
     * Extract diagram/image inventory with any labels found in child elements.
     * Diagrams in lines.json have type="diagram" or type="chart", with
     * chart_info/figure_label children carrying extracted text labels.
     *
     * @param {{ pages: Array }} normalised - Normalised lines data
     * @returns {Array<Object>} Diagram inventory
     */
    extractDiagramInventory(normalised) {
      const diagrams = [];

      for (const page of normalised.pages) {
        const pageNum = page.page ?? 1;
        const lines = page.lines || [];

        // Build parent→children map for this page
        const childrenMap = new Map();
        for (const line of lines) {
          if (line.children_ids && Array.isArray(line.children_ids)) {
            childrenMap.set(line.id, line.children_ids);
          }
        }

        // Build id→line lookup for label extraction
        const lineById = new Map();
        for (const line of lines) {
          if (line.id) {
            lineById.set(line.id, line);
          }
        }

        // Find diagram/chart lines
        for (const line of lines) {
          if (!DIAGRAM_TYPES.has(line.type)) continue;

          // Collect labels from children
          const labels = [];
          const childIds = childrenMap.get(line.id) || [];

          for (const childId of childIds) {
            const child = lineById.get(childId);
            if (!child) continue;

            // Direct label children
            if (DIAGRAM_LABEL_TYPES.has(child.type) && child.text) {
              const cleaned = this._cleanLabelText(child.text);
              if (cleaned) labels.push(cleaned);
            }

            // Also check grandchildren (chart_info can be nested)
            const grandchildIds = childrenMap.get(childId) || [];
            for (const gcId of grandchildIds) {
              const gc = lineById.get(gcId);
              if (gc && DIAGRAM_LABEL_TYPES.has(gc.type) && gc.text) {
                const cleaned = this._cleanLabelText(gc.text);
                if (cleaned) labels.push(cleaned);
              }
            }
          }

          // Also find chart_info/figure_label lines whose parent_id matches this diagram
          for (const otherLine of lines) {
            if (
              otherLine.parent_id === line.id &&
              DIAGRAM_LABEL_TYPES.has(otherLine.type) &&
              otherLine.text
            ) {
              const cleaned = this._cleanLabelText(otherLine.text);
              if (cleaned && !labels.includes(cleaned)) {
                labels.push(cleaned);
              }
            }
          }

          // Deduplicate labels
          const uniqueLabels = [...new Set(labels)];

          diagrams.push({
            page: pageNum,
            type: line.type,
            isHandwritten: !!line.is_handwritten,
            labels: uniqueLabels,
            hasLabels: uniqueLabels.length > 0,
          });
        }
      }

      return diagrams;
    }

    /**
     * Extract table information from the document.
     *
     * @param {{ pages: Array }} normalised - Normalised lines data
     * @returns {Array<Object>} Table inventory per page
     */
    extractTableInfo(normalised) {
      const tables = [];

      for (const page of normalised.pages) {
        const pageNum = page.page ?? 1;
        const lines = page.lines || [];

        const tableLines = lines.filter((l) => l.type === "table");
        if (tableLines.length === 0) continue;

        for (const tableLine of tableLines) {
          // Count cells belonging to this table
          const cellCount = lines.filter(
            (l) => l.type === "simple_cell" && l.parent_id === tableLine.id,
          ).length;

          // Count rows
          const rowCount = lines.filter(
            (l) => l.type === "table_row" && l.parent_id === tableLine.id,
          ).length;

          tables.push({
            page: pageNum,
            cellCount,
            rowCount,
            isHandwritten: !!tableLine.is_handwritten,
          });
        }
      }

      return tables;
    }

    /**
     * Extract page-level statistics for display purposes.
     *
     * @param {{ pages: Array }} normalised - Normalised lines data
     * @returns {Object} Page statistics
     */
    extractPageStats(normalised) {
      const allConfidences = [];
      const perPage = [];

      for (const page of normalised.pages) {
        const pageNum = page.page ?? perPage.length + 1;
        const lines = page.lines || [];

        const confidences = lines
          .map((l) => l.confidence)
          .filter((c) => c != null && typeof c === "number");

        allConfidences.push(...confidences);

        const meanConf =
          confidences.length > 0
            ? confidences.reduce((s, c) => s + c, 0) / confidences.length
            : null;

        // Confidence distribution
        let high = 0;
        let medium = 0;
        let low = 0;
        let veryLow = 0;
        for (const c of confidences) {
          if (c >= CONFIDENCE_THRESHOLDS.HIGH) high++;
          else if (c >= CONFIDENCE_THRESHOLDS.MEDIUM) medium++;
          else if (c >= CONFIDENCE_THRESHOLDS.LOW) low++;
          else veryLow++;
        }

        perPage.push({
          page: pageNum,
          totalLines: lines.length,
          linesWithConfidence: confidences.length,
          meanConfidence: meanConf ? Math.round(meanConf * 1000) / 1000 : null,
          distribution: { high, medium, low, veryLow },
        });
      }

      // Overall stats
      const overallMean =
        allConfidences.length > 0
          ? allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length
          : null;

      return {
        totalPages: normalised.pages.length,
        totalLines: normalised.pages.reduce(
          (sum, p) => sum + (p.lines?.length || 0),
          0,
        ),
        overallMeanConfidence: overallMean
          ? Math.round(overallMean * 1000) / 1000
          : null,
        perPage,
      };
    }

    // ==========================================================================
    // OUTPUT FORMATTERS
    // ==========================================================================

    /**
     * Format analysis for LLM prompt injection.
     * Produces concise text (target 200–600 tokens) suitable for chain-of-thought.
     * Omits empty sections to save tokens.
     *
     * @param {Object|null} analysis - Output from analyse()
     * @returns {string} Formatted text for prompt
     */
    formatForPrompt(analysis) {
      if (!analysis) {
        return "SEMANTIC CONTEXT:\nNo OCR engine metadata available for this session.";
      }

      const sections = [];

      // --- Document Overview ---
      const overview = this._formatOverviewForPrompt(analysis);
      if (overview) sections.push(overview);

      // --- Low-Confidence Regions ---
      const lowConf = this._formatLowConfidenceForPrompt(analysis);
      if (lowConf) sections.push(lowConf);

      // --- Diagrams ---
      const diagrams = this._formatDiagramsForPrompt(analysis);
      if (diagrams) sections.push(diagrams);

      // --- Tables ---
      const tables = this._formatTablesForPrompt(analysis);
      if (tables) sections.push(tables);

      if (sections.length === 0) {
        return "SEMANTIC CONTEXT:\nDocument processed but no notable semantic features detected.";
      }

      return (
        "SEMANTIC CONTEXT (from OCR engine analysis):\n\n" +
        sections.join("\n\n")
      );
    }

    /**
     * Format analysis for UI display.
     * Produces structured object for rendering in the Document Analysis tab.
     *
     * @param {Object|null} analysis - Output from analyse()
     * @returns {Object} Structured display data
     */
    formatForDisplay(analysis) {
      if (!analysis) {
        return {
          summary: {
            totalPages: 0,
            totalLines: 0,
            handwrittenPages: 0,
            printedPages: 0,
            mixedPages: 0,
            diagramCount: 0,
            tableCount: 0,
            meanConfidence: null,
            lowConfidenceRegions: 0,
          },
          pages: [],
          lowConfidence: [],
          diagrams: [],
          tables: [],
        };
      }

      const regionMap = analysis.regionMap || [];
      const stats = analysis.pageStats || {};

      return {
        summary: {
          totalPages: stats.totalPages || 0,
          totalLines: stats.totalLines || 0,
          handwrittenPages: regionMap.filter(
            (p) => p.writingType === "handwritten",
          ).length,
          printedPages: regionMap.filter((p) => p.writingType === "printed")
            .length,
          mixedPages: regionMap.filter((p) => p.writingType === "mixed").length,
          diagramCount: (analysis.diagrams || []).length,
          tableCount: (analysis.tables || []).length,
          meanConfidence: stats.overallMeanConfidence,
          lowConfidenceRegions: (analysis.lowConfidence || []).length,
        },
        pages: regionMap.map((p) => ({
          page: p.page,
          writingType: p.writingType,
          contentTypes: p.contentTypes,
          lineCount: p.lineCount,
          meanConfidence: p.meanConfidence
            ? Math.round(p.meanConfidence * 1000) / 1000
            : null,
          hasDiagrams: p.hasDiagrams,
          hasTables: p.hasTables,
          hasLowConfidence: p.hasLowConfidence,
        })),
        lowConfidence: (analysis.lowConfidence || []).map((r) => ({
          page: r.page,
          lineRange: r.lineRange,
          lineCount: r.lineCount,
          meanConfidence: r.meanConfidence,
          minConfidence: r.minConfidence,
          note: r.note,
        })),
        diagrams: (analysis.diagrams || []).map((d) => ({
          page: d.page,
          type: d.type,
          labels: d.labels,
          isHandwritten: d.isHandwritten,
        })),
        tables: (analysis.tables || []).map((t) => ({
          page: t.page,
          cellCount: t.cellCount,
          rowCount: t.rowCount,
          isHandwritten: t.isHandwritten,
        })),
      };
    }

    // ==========================================================================
    // PROMPT SECTION FORMATTERS (PRIVATE)
    // ==========================================================================

    /**
     * Format document overview section for prompt.
     * @param {Object} analysis
     * @returns {string|null}
     * @private
     */
    _formatOverviewForPrompt(analysis) {
      const regionMap = analysis.regionMap || [];
      const stats = analysis.pageStats || {};

      if (regionMap.length === 0) return null;

      const totalPages = stats.totalPages || regionMap.length;
      const hwPages = regionMap.filter((p) => p.writingType === "handwritten");
      const prPages = regionMap.filter((p) => p.writingType === "printed");
      const mxPages = regionMap.filter((p) => p.writingType === "mixed");

      // Determine dominant content type
      let dominantType;
      if (hwPages.length > prPages.length && hwPages.length > mxPages.length) {
        dominantType = "predominantly handwritten";
      } else if (
        prPages.length > hwPages.length &&
        prPages.length > mxPages.length
      ) {
        dominantType = "predominantly printed";
      } else if (mxPages.length > 0) {
        dominantType = "mixed handwritten and printed";
      } else {
        dominantType = "content type undetermined";
      }

      const lines = [`DOCUMENT OVERVIEW:`];
      lines.push(
        `${totalPages} page${totalPages !== 1 ? "s" : ""}, ${dominantType}.`,
      );

      // Per-page breakdown (compact format — group consecutive same-type pages)
      const groups = this._groupConsecutivePages(regionMap);
      for (const group of groups) {
        const pageRange = this._formatPageRange(group.pages);
        let description = group.writingType;

        // Add notable content types for context
        const notable = this._getNotableContentTypes(group.pages);
        if (notable) {
          description += ` (${notable})`;
        }

        lines.push(`${pageRange}: ${description}`);
      }

      return lines.join("\n");
    }

    /**
     * Format low-confidence regions for prompt.
     * @param {Object} analysis
     * @returns {string|null}
     * @private
     */
    _formatLowConfidenceForPrompt(analysis) {
      const regions = analysis.lowConfidence || [];
      if (regions.length === 0) return null;

      const lines = [
        "LOW-CONFIDENCE OCR REGIONS (prioritise corrections here):",
      ];

      for (const region of regions) {
        let entry = `- Page ${region.page}`;

        if (region.lineRange && region.lineRange !== "unknown") {
          entry += `, line${region.lineCount > 1 ? "s" : ""} ~${region.lineRange}`;
        }

        // Show confidence range
        if (region.minConfidence === region.maxConfidence) {
          entry += `: confidence ${(region.minConfidence * 100).toFixed(0)}%`;
        } else {
          entry += `: confidence ${(region.minConfidence * 100).toFixed(0)}-${(region.maxConfidence * 100).toFixed(0)}%`;
        }

        if (region.note) {
          entry += ` — ${region.note}`;
        }

        lines.push(entry);

        // Add focus guidance for each low-confidence region
        if (region.lineRange && region.lineRange !== "unknown") {
          lines.push(
            `  FOCUS: Check all symbols in this range against the PDF`,
          );
        }
      }

      return lines.join("\n");
    }

    /**
     * Format diagram inventory for prompt.
     * @param {Object} analysis
     * @returns {string|null}
     * @private
     */
    _formatDiagramsForPrompt(analysis) {
      const diagrams = analysis.diagrams || [];
      if (diagrams.length === 0) return null;

      const lines = ["DIAGRAMS AND IMAGES:"];

      for (const d of diagrams) {
        let entry = `- Page ${d.page}: ${d.type} detected`;

        if (d.hasLabels && d.labels.length > 0) {
          // Show up to 8 labels to stay within token budget
          const shown = d.labels.slice(0, 8);
          entry += ` (labels: ${shown.map((l) => `"${l}"`).join(", ")}`;
          if (d.labels.length > 8) {
            entry += `, +${d.labels.length - 8} more`;
          }
          entry += ")";
        } else {
          entry += " (no extractable text)";
        }

        lines.push(entry);
      }

      lines.push(
        "Do NOT attempt to correct diagram content as text — preserve image references.",
      );

      return lines.join("\n");
    }

    /**
     * Format table info for prompt.
     * @param {Object} analysis
     * @returns {string|null}
     * @private
     */
    _formatTablesForPrompt(analysis) {
      const tables = analysis.tables || [];
      if (tables.length === 0) return null;

      const lines = ["TABLES:"];

      for (const t of tables) {
        let entry = `- Page ${t.page}: table detected`;
        if (t.rowCount > 0) {
          entry += ` (${t.rowCount} rows, ${t.cellCount} cells)`;
        }
        if (t.isHandwritten) {
          entry += " — handwritten";
        }
        lines.push(entry);
      }

      lines.push("Preserve table structure exactly during correction.");

      return lines.join("\n");
    }

    // ==========================================================================
    // UTILITY METHODS (PRIVATE)
    // ==========================================================================

    /**
     * Group adjacent low-confidence lines into clusters.
     * Lines with sequential line numbers (or no line numbers) are grouped.
     *
     * @param {Array} lowConfLines - Array of { lineNum, confidence, ... }
     * @returns {Array<Array>} Array of clusters
     * @private
     */
    _clusterLowConfidenceLines(lowConfLines) {
      if (lowConfLines.length === 0) return [];
      if (lowConfLines.length === 1) return [lowConfLines];

      // Sort by line number (null values at end)
      const sorted = [...lowConfLines].sort((a, b) => {
        if (a.lineNum == null && b.lineNum == null) return 0;
        if (a.lineNum == null) return 1;
        if (b.lineNum == null) return -1;
        return a.lineNum - b.lineNum;
      });

      const clusters = [];
      let currentCluster = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        // Adjacent if line numbers differ by at most 2 (allow small gaps)
        const isAdjacent =
          prev.lineNum != null &&
          curr.lineNum != null &&
          curr.lineNum - prev.lineNum <= 2;

        if (isAdjacent) {
          currentCluster.push(curr);
        } else {
          clusters.push(currentCluster);
          currentCluster = [curr];
        }
      }

      clusters.push(currentCluster);
      return clusters;
    }

    /**
     * Group consecutive pages with the same writing type for compact reporting.
     *
     * @param {Array} regionMap
     * @returns {Array<{ writingType: string, pages: Array }>}
     * @private
     */
    _groupConsecutivePages(regionMap) {
      if (regionMap.length === 0) return [];

      const groups = [];
      let currentGroup = {
        writingType: regionMap[0].writingType,
        pages: [regionMap[0]],
      };

      for (let i = 1; i < regionMap.length; i++) {
        if (regionMap[i].writingType === currentGroup.writingType) {
          currentGroup.pages.push(regionMap[i]);
        } else {
          groups.push(currentGroup);
          currentGroup = {
            writingType: regionMap[i].writingType,
            pages: [regionMap[i]],
          };
        }
      }

      groups.push(currentGroup);
      return groups;
    }

    /**
     * Format a page range label from an array of page objects.
     * e.g., [p1] → "Page 1", [p2,p3,p4] → "Pages 2-4"
     *
     * @param {Array} pages - Array of page objects with .page property
     * @returns {string}
     * @private
     */
    _formatPageRange(pages) {
      if (pages.length === 1) return `Page ${pages[0].page}`;
      const first = pages[0].page;
      const last = pages[pages.length - 1].page;
      return `Pages ${first}-${last}`;
    }

    /**
     * Get notable content type descriptions from a group of pages.
     *
     * @param {Array} pages - Page objects from regionMap
     * @returns {string} Description of notable content
     * @private
     */
    _getNotableContentTypes(pages) {
      const notable = [];
      const allTypes = new Set();

      for (const page of pages) {
        for (const type of page.contentTypes || []) {
          allTypes.add(type);
        }
        if (page.hasDiagrams) notable.push("diagrams");
        if (page.hasTables) notable.push("tables");
      }

      // Add primary content types
      if (allTypes.has("math") || allTypes.has("equation_number")) {
        notable.unshift("mathematics");
      }
      if (allTypes.has("text") && !notable.includes("mathematics")) {
        notable.unshift("text");
      }

      // Deduplicate
      return [...new Set(notable)].slice(0, 3).join(", ");
    }

    /**
     * Clean label text extracted from diagram children.
     * Removes LaTeX delimiters for cleaner display.
     *
     * @param {string} text
     * @returns {string} Cleaned text
     * @private
     */
    _cleanLabelText(text) {
      if (!text || typeof text !== "string") return "";

      return text
        .replace(/^\$+/, "")
        .replace(/\$+$/, "")
        .replace(/^\\\(/, "")
        .replace(/\\\)$/, "")
        .replace(/^\\\[/, "")
        .replace(/\\\]$/, "")
        .replace(/\{ \}/g, "")
        .trim();
    }

    /**
     * Truncate text to a maximum length with ellipsis.
     *
     * @param {string} text
     * @param {number} maxLength
     * @returns {string}
     * @private
     */
    _truncateText(text, maxLength) {
      if (!text || typeof text !== "string") return "";
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + "...";
    }
  }

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  let mapperInstance = null;

  /**
   * Get the singleton MathPixSemanticMapper instance.
   * @returns {MathPixSemanticMapper}
   */
  function getMathPixSemanticMapper() {
    if (!mapperInstance) {
      logDebug("Creating new MathPixSemanticMapper singleton instance");
      mapperInstance = new MathPixSemanticMapper();
    }
    return mapperInstance;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixSemanticMapper = MathPixSemanticMapper;
  window.getMathPixSemanticMapper = getMathPixSemanticMapper;

  // ============================================================================
  // TEST SUITE
  // ============================================================================

  window.testSemanticMapper = function () {
    console.log("=== MathPix Semantic Mapper Test Suite ===\n");

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(condition, testName) {
      if (condition) {
        passed++;
        results.push(`✅ ${testName}`);
      } else {
        failed++;
        results.push(`❌ ${testName}`);
        console.error(`FAILED: ${testName}`);
      }
    }

    const mapper = getMathPixSemanticMapper();

    // ========================================================================
    // TEST DATA — based on real lines.json structure audit
    // ========================================================================

    // Minimal line factory
    function makeLine(overrides = {}) {
      return {
        cnt: [
          [0, 0],
          [100, 0],
          [100, 50],
          [0, 50],
        ],
        region: { top_left_x: 0, top_left_y: 0, width: 100, height: 50 },
        line: 1,
        column: 0,
        font_size: 51,
        is_printed: false,
        is_handwritten: false,
        id: "id_" + Math.random().toString(36).substring(2, 10),
        type: "text",
        conversion_output: true,
        text: "",
        text_display: "",
        confidence: 0.95,
        confidence_rate: 0.99,
        ...overrides,
      };
    }

    function makePage(pageNum, lines, extras = {}) {
      return {
        image_id: "img_" + pageNum,
        page: pageNum,
        lines,
        page_width: 2066,
        page_height: 2924,
        languages_detected: [],
        ...extras,
      };
    }

    function makeStandardDoc(pages) {
      return { pages };
    }

    // -- Test data sets --

    const emptyDoc = makeStandardDoc([]);

    const singlePrintedPage = makeStandardDoc([
      makePage(1, [
        makeLine({
          line: 1,
          is_printed: true,
          confidence: 0.99,
          text: "Title",
        }),
        makeLine({
          line: 2,
          is_printed: true,
          confidence: 0.97,
          text: "Body text here",
        }),
        makeLine({
          line: 3,
          is_printed: true,
          confidence: 1.0,
          text: "More text",
          type: "math",
        }),
      ]),
    ]);

    const handwrittenDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          line: 1,
          is_printed: true,
          confidence: 1.0,
          text: "Exam Header",
          type: "section_header",
        }),
        makeLine({
          line: 2,
          is_printed: true,
          confidence: 0.98,
          text: "Instructions",
        }),
      ]),
      makePage(2, [
        makeLine({
          line: 1,
          is_handwritten: true,
          confidence: 0.45,
          text: "Handwritten answer",
        }),
        makeLine({
          line: 2,
          is_handwritten: true,
          confidence: 0.38,
          text: "More writing",
          type: "math",
        }),
        makeLine({
          line: 3,
          is_handwritten: true,
          confidence: 0.42,
          text: "Another line",
        }),
        makeLine({
          line: 4,
          is_handwritten: true,
          confidence: 0.85,
          text: "Clear line",
        }),
      ]),
      makePage(3, [
        makeLine({
          line: 1,
          is_handwritten: true,
          confidence: 0.72,
          text: "Answer",
        }),
        makeLine({
          line: 2,
          is_printed: true,
          confidence: 0.95,
          text: "Question 3",
        }),
        makeLine({
          line: 3,
          is_handwritten: true,
          confidence: 0.55,
          text: "Solution work",
        }),
      ]),
    ]);

    const diagramDocId = "diag_001";
    const chartInfoId1 = "ci_001";
    const chartInfoId2 = "ci_002";
    const chartInfoId3 = "ci_003";

    const diagramDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          line: 1,
          is_printed: true,
          confidence: 1.0,
          text: "Introduction",
        }),
      ]),
      makePage(2, [
        makeLine({
          type: "diagram",
          id: diagramDocId,
          is_handwritten: true,
          confidence: null,
          text: "",
          children_ids: [chartInfoId1, chartInfoId2, chartInfoId3],
        }),
        makeLine({
          type: "chart_info",
          id: chartInfoId1,
          parent_id: diagramDocId,
          is_handwritten: true,
          confidence: 0.8,
          text: "$F$",
        }),
        makeLine({
          type: "chart_info",
          id: chartInfoId2,
          parent_id: diagramDocId,
          is_handwritten: true,
          confidence: 0.7,
          text: "$mg$",
        }),
        makeLine({
          type: "figure_label",
          id: chartInfoId3,
          parent_id: diagramDocId,
          is_handwritten: true,
          confidence: 0.9,
          text: "θ",
        }),
        makeLine({
          line: 5,
          is_handwritten: true,
          confidence: 0.85,
          text: "Solution",
        }),
      ]),
      makePage(3, [
        makeLine({
          type: "diagram",
          id: "diag_002",
          is_handwritten: true,
          confidence: null,
          text: "",
        }),
      ]),
    ]);

    const tableDocId = "tbl_001";
    const tableDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          type: "table",
          id: tableDocId,
          is_printed: true,
          confidence: null,
          text: "",
          children_ids: ["row1", "row2", "cell1", "cell2", "cell3", "cell4"],
        }),
        makeLine({
          type: "table_row",
          id: "row1",
          parent_id: tableDocId,
          confidence: null,
        }),
        makeLine({
          type: "table_row",
          id: "row2",
          parent_id: tableDocId,
          confidence: null,
        }),
        makeLine({
          type: "simple_cell",
          id: "cell1",
          parent_id: tableDocId,
          confidence: 0.99,
          text: "A",
          is_printed: true,
        }),
        makeLine({
          type: "simple_cell",
          id: "cell2",
          parent_id: tableDocId,
          confidence: 0.98,
          text: "B",
          is_printed: true,
        }),
        makeLine({
          type: "simple_cell",
          id: "cell3",
          parent_id: tableDocId,
          confidence: 0.97,
          text: "C",
          is_printed: true,
        }),
        makeLine({
          type: "simple_cell",
          id: "cell4",
          parent_id: tableDocId,
          confidence: 0.96,
          text: "D",
          is_printed: true,
        }),
      ]),
    ]);

    // Large document for performance test
    function makeLargeDoc(lineCount) {
      const linesPerPage = 50;
      const pageCount = Math.ceil(lineCount / linesPerPage);
      const pages = [];
      let lineNum = 0;

      for (let p = 0; p < pageCount; p++) {
        const lines = [];
        const linesThisPage = Math.min(linesPerPage, lineCount - lineNum);
        for (let l = 0; l < linesThisPage; l++) {
          lines.push(
            makeLine({
              line: l + 1,
              is_handwritten: Math.random() > 0.5,
              is_printed: Math.random() > 0.5,
              confidence: Math.random(),
              text: `Line ${lineNum + 1} content`,
              type: Math.random() > 0.8 ? "math" : "text",
            }),
          );
          lineNum++;
        }
        pages.push(makePage(p + 1, lines));
      }

      return makeStandardDoc(pages);
    }

    // ========================================================================
    // GROUP 1: INPUT HANDLING
    // ========================================================================
    console.log("--- Input Handling ---");

    assert(mapper.analyse(null) === null, "null input returns null");
    assert(mapper.analyse(undefined) === null, "undefined input returns null");
    assert(mapper.analyse([]) === null, "empty array returns null");
    assert(mapper.analyse({}) === null, "empty object returns null");
    assert(mapper.analyse({ pages: [] }) === null, "empty pages returns null");
    assert(mapper.analyse("string") === null, "string input returns null");
    assert(mapper.analyse(42) === null, "number input returns null");

    // Standard format: { pages: [...] }
    const stdResult = mapper.analyse(singlePrintedPage);
    assert(stdResult !== null, "standard format { pages: [...] } works");
    assert(stdResult.version === "1.0.0", "version is set");
    assert(typeof stdResult.timestamp === "number", "timestamp is set");

    // Alternative format: { lines: [...] } (single page)
    const altResult = mapper.analyse({
      lines: [makeLine({ is_printed: true, confidence: 0.9, text: "Test" })],
    });
    assert(altResult !== null, "{ lines: [...] } format normalises correctly");
    assert(
      altResult.pageStats.totalPages === 1,
      "{ lines: [...] } wraps as single page",
    );

    // Flat array of lines
    const flatResult = mapper.analyse([
      makeLine({ is_printed: true, confidence: 0.9 }),
    ]);
    assert(flatResult !== null, "flat array of lines normalises correctly");

    // Array of page objects
    const pageArrayResult = mapper.analyse([
      makePage(1, [makeLine({ is_printed: true, confidence: 0.95 })]),
      makePage(2, [makeLine({ is_handwritten: true, confidence: 0.7 })]),
    ]);
    assert(
      pageArrayResult !== null && pageArrayResult.pageStats.totalPages === 2,
      "array of page objects normalises correctly",
    );

    // ========================================================================
    // GROUP 2: REGION MAP EXTRACTION
    // ========================================================================
    console.log("\n--- Region Map ---");

    const printedAnalysis = mapper.analyse(singlePrintedPage);
    assert(
      printedAnalysis.regionMap.length === 1,
      "single page produces 1 region entry",
    );
    assert(
      printedAnalysis.regionMap[0].writingType === "printed",
      "all-printed page detected as printed",
    );
    assert(printedAnalysis.regionMap[0].page === 1, "page number is correct");

    const hwAnalysis = mapper.analyse(handwrittenDoc);
    assert(
      hwAnalysis.regionMap.length === 3,
      "3-page doc produces 3 region entries",
    );
    assert(
      hwAnalysis.regionMap[1].writingType === "handwritten",
      "all-handwritten page detected",
    );
    assert(
      hwAnalysis.regionMap[2].writingType === "mixed",
      "mixed hw+printed page detected",
    );
    assert(
      hwAnalysis.regionMap[1].hasLowConfidence === true,
      "low confidence flag set on page with low conf lines",
    );
    assert(
      hwAnalysis.regionMap[0].hasLowConfidence === false,
      "low confidence flag NOT set on high-conf page",
    );

    // Content types detected
    assert(
      printedAnalysis.regionMap[0].contentTypes.includes("text"),
      "text content type detected",
    );
    assert(
      printedAnalysis.regionMap[0].contentTypes.includes("math"),
      "math content type detected",
    );

    // Unknown writing type when neither flag set
    const unknownDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          is_printed: false,
          is_handwritten: false,
          confidence: 0.9,
          text: "Test",
        }),
      ]),
    ]);
    const unknownAnalysis = mapper.analyse(unknownDoc);
    assert(
      unknownAnalysis.regionMap[0].writingType === "unknown",
      "unknown writing type when neither hw nor printed",
    );

    // page_info lines excluded from content analysis
    const pageInfoDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          type: "page_info",
          is_printed: true,
          confidence: 1.0,
          text: "Page 1 of 5",
        }),
        makeLine({
          type: "text",
          is_handwritten: true,
          confidence: 0.8,
          text: "Content",
        }),
      ]),
    ]);
    const pageInfoAnalysis = mapper.analyse(pageInfoDoc);
    assert(
      pageInfoAnalysis.regionMap[0].lineCount === 1,
      "page_info lines excluded from content line count",
    );

    // ========================================================================
    // GROUP 3: LOW-CONFIDENCE EXTRACTION
    // ========================================================================
    console.log("\n--- Low Confidence ---");

    // No low confidence
    assert(
      printedAnalysis.lowConfidence.length === 0,
      "no low-confidence regions when all confident",
    );

    // Low confidence detection
    assert(
      hwAnalysis.lowConfidence.length > 0,
      "low-confidence regions detected in handwritten doc",
    );

    // Check page 2 cluster (confidence 0.45, 0.38, 0.42 — all below 0.6)
    const page2Regions = hwAnalysis.lowConfidence.filter((r) => r.page === 2);
    assert(page2Regions.length >= 1, "page 2 has low-confidence region(s)");
    assert(
      page2Regions[0].minConfidence < 0.5,
      "min confidence below 0.5 in page 2 region",
    );

    // Page 3 has one line at 0.55 (below 0.6)
    const page3Regions = hwAnalysis.lowConfidence.filter((r) => r.page === 3);
    assert(page3Regions.length >= 1, "page 3 low-confidence line detected");

    // Threshold boundary test — exactly at threshold should NOT be flagged
    const boundaryDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          line: 1,
          is_printed: true,
          confidence: 0.6,
          text: "Boundary",
        }),
        makeLine({
          line: 2,
          is_printed: true,
          confidence: 0.59,
          text: "Just below",
        }),
      ]),
    ]);
    const boundaryAnalysis = mapper.analyse(boundaryDoc);
    assert(
      boundaryAnalysis.lowConfidence.length === 1,
      "0.59 flagged, 0.60 not flagged (boundary test)",
    );

    // Missing confidence values — skipped gracefully
    const noConfDoc = makeStandardDoc([
      makePage(1, [
        makeLine({ confidence: null, text: "No confidence" }),
        makeLine({ confidence: undefined, text: "Undefined confidence" }),
      ]),
    ]);
    const noConfAnalysis = mapper.analyse(noConfDoc);
    assert(
      noConfAnalysis.lowConfidence.length === 0,
      "missing confidence values skipped gracefully",
    );

    // ========================================================================
    // GROUP 4: DIAGRAM INVENTORY
    // ========================================================================
    console.log("\n--- Diagram Inventory ---");

    // No diagrams
    assert(
      printedAnalysis.diagrams.length === 0,
      "no diagrams in text-only doc",
    );

    // Diagrams with labels
    const diagAnalysis = mapper.analyse(diagramDoc);
    assert(
      diagAnalysis.diagrams.length === 2,
      "2 diagrams detected across pages",
    );

    const diag1 = diagAnalysis.diagrams[0];
    assert(diag1.page === 2, "first diagram on page 2");
    assert(diag1.hasLabels === true, "diagram has labels");
    assert(diag1.labels.length === 3, "3 labels extracted (F, mg, θ)");
    assert(
      diag1.labels.includes("F") && diag1.labels.includes("mg"),
      "F and mg labels present",
    );

    // Diagram without labels
    const diag2 = diagAnalysis.diagrams[1];
    assert(diag2.page === 3, "second diagram on page 3");
    assert(diag2.hasLabels === false, "no-label diagram detected");
    assert(
      diag2.labels.length === 0,
      "empty labels array for no-label diagram",
    );

    // Missing is_diagram field — only type-based detection
    const fakeDiagramDoc = makeStandardDoc([
      makePage(1, [makeLine({ type: "text", text: "Not a diagram" })]),
    ]);
    assert(
      mapper.analyse(fakeDiagramDoc).diagrams.length === 0,
      "text lines not falsely detected as diagrams",
    );

    // ========================================================================
    // GROUP 5: TABLE DETECTION
    // ========================================================================
    console.log("\n--- Tables ---");

    // No tables
    assert(printedAnalysis.tables.length === 0, "no tables in text-only doc");

    // Table detection
    const tblAnalysis = mapper.analyse(tableDoc);
    assert(tblAnalysis.tables.length === 1, "1 table detected");
    assert(tblAnalysis.tables[0].page === 1, "table on page 1");
    assert(tblAnalysis.tables[0].rowCount === 2, "2 rows detected");
    assert(tblAnalysis.tables[0].cellCount === 4, "4 cells detected");

    // ========================================================================
    // GROUP 6: PAGE STATISTICS
    // ========================================================================
    console.log("\n--- Page Statistics ---");

    assert(
      printedAnalysis.pageStats.totalPages === 1,
      "correct page count (1)",
    );
    assert(
      printedAnalysis.pageStats.totalLines === 3,
      "correct total line count",
    );
    assert(
      printedAnalysis.pageStats.overallMeanConfidence > 0.95,
      "overall mean confidence correct for high-conf doc",
    );

    const hwStats = hwAnalysis.pageStats;
    assert(hwStats.totalPages === 3, "correct page count (3)");

    // Per-page stats
    assert(hwStats.perPage.length === 3, "per-page stats for all 3 pages");
    assert(hwStats.perPage[0].page === 1, "per-page page number correct");

    // Confidence distribution
    const p2Stats = hwStats.perPage[1]; // Page 2: confs 0.45, 0.38, 0.42, 0.85
    assert(
      p2Stats.distribution.veryLow === 3,
      "3 very-low confidence lines on page 2",
    );
    assert(
      p2Stats.distribution.medium === 1,
      "1 medium confidence line on page 2",
    );

    // ========================================================================
    // GROUP 7: formatForPrompt
    // ========================================================================
    console.log("\n--- formatForPrompt ---");

    // Null analysis
    const nullPrompt = mapper.formatForPrompt(null);
    assert(
      nullPrompt.includes("No OCR engine metadata available"),
      "null analysis produces 'not available' message",
    );

    // Full document prompt
    const hwPrompt = mapper.formatForPrompt(hwAnalysis);
    assert(
      hwPrompt.includes("SEMANTIC CONTEXT"),
      "prompt includes SEMANTIC CONTEXT header",
    );
    assert(
      hwPrompt.includes("DOCUMENT OVERVIEW"),
      "prompt includes DOCUMENT OVERVIEW section",
    );
    assert(
      hwPrompt.includes("LOW-CONFIDENCE"),
      "prompt includes LOW-CONFIDENCE section",
    );
    assert(hwPrompt.includes("3 pages"), "prompt mentions page count");

    // Diagram prompt
    const diagPrompt = mapper.formatForPrompt(diagAnalysis);
    assert(
      diagPrompt.includes("DIAGRAMS"),
      "diagram prompt includes DIAGRAMS section",
    );
    assert(
      diagPrompt.includes("Do NOT attempt to correct"),
      "diagram prompt includes preservation instruction",
    );

    // Table prompt
    const tblPrompt = mapper.formatForPrompt(tblAnalysis);
    assert(
      tblPrompt.includes("TABLES"),
      "table prompt includes TABLES section",
    );
    assert(
      tblPrompt.includes("Preserve table structure"),
      "table prompt includes structure preservation",
    );

    // Empty sections omitted
    const printedPrompt = mapper.formatForPrompt(printedAnalysis);
    assert(
      !printedPrompt.includes("LOW-CONFIDENCE"),
      "low-confidence section omitted when none exist",
    );
    assert(
      !printedPrompt.includes("DIAGRAMS"),
      "diagrams section omitted when none exist",
    );

    // Token budget check (approximate: chars/4)
    const hwTokens = Math.ceil(hwPrompt.length / 4);
    assert(
      hwTokens < 600,
      `handwritten doc prompt within budget (${hwTokens} est. tokens)`,
    );

    const diagTokens = Math.ceil(diagPrompt.length / 4);
    assert(
      diagTokens < 600,
      `diagram doc prompt within budget (${diagTokens} est. tokens)`,
    );

    // ========================================================================
    // GROUP 8: formatForDisplay
    // ========================================================================
    console.log("\n--- formatForDisplay ---");

    // Null analysis
    const nullDisplay = mapper.formatForDisplay(null);
    assert(
      nullDisplay.summary.totalPages === 0,
      "null analysis display has 0 pages",
    );
    assert(Array.isArray(nullDisplay.pages), "null display has pages array");

    // Full display
    const hwDisplay = mapper.formatForDisplay(hwAnalysis);
    assert(
      hwDisplay.summary.totalPages === 3,
      "display summary page count correct",
    );
    assert(
      hwDisplay.summary.handwrittenPages >= 1,
      "display counts handwritten pages",
    );
    assert(
      hwDisplay.summary.lowConfidenceRegions > 0,
      "display counts low-confidence regions",
    );
    assert(hwDisplay.pages.length === 3, "display has per-page data");
    assert(
      hwDisplay.lowConfidence.length > 0,
      "display has low-confidence details",
    );

    // Diagram display
    const diagDisplay = mapper.formatForDisplay(diagAnalysis);
    assert(
      diagDisplay.summary.diagramCount === 2,
      "display diagram count correct",
    );
    assert(diagDisplay.diagrams.length === 2, "display has diagram details");
    assert(
      diagDisplay.diagrams[0].labels.length === 3,
      "display diagram labels preserved",
    );

    // Table display
    const tblDisplay = mapper.formatForDisplay(tblAnalysis);
    assert(tblDisplay.summary.tableCount === 1, "display table count correct");

    // ========================================================================
    // GROUP 9: PERFORMANCE
    // ========================================================================
    console.log("\n--- Performance ---");

    const largeDoc500 = makeLargeDoc(500);
    const startLarge = performance.now();
    const largeResult = mapper.analyse(largeDoc500);
    const largeDuration = performance.now() - startLarge;
    assert(largeResult !== null, "large doc (500 lines) produces result");
    assert(
      largeDuration < 50,
      `large doc (500 lines) in ${largeDuration.toFixed(1)}ms (target <50ms)`,
    );

    const veryLargeDoc = makeLargeDoc(2000);
    const startVLarge = performance.now();
    const vlResult = mapper.analyse(veryLargeDoc);
    const vlDuration = performance.now() - startVLarge;
    assert(vlResult !== null, "very large doc (2000 lines) produces result");
    assert(
      vlDuration < 200,
      `very large doc (2000 lines) in ${vlDuration.toFixed(1)}ms (target <200ms)`,
    );

    // ========================================================================
    // GROUP 10: INTEGRATION
    // ========================================================================
    console.log("\n--- Integration ---");

    // Singleton
    const m1 = window.getMathPixSemanticMapper();
    const m2 = window.getMathPixSemanticMapper();
    assert(m1 === m2, "singleton returns same instance");

    // Global exposure
    assert(
      typeof window.MathPixSemanticMapper === "function",
      "MathPixSemanticMapper class exposed globally",
    );
    assert(
      typeof window.getMathPixSemanticMapper === "function",
      "getMathPixSemanticMapper function exposed globally",
    );

    // Full pipeline: analyse → formatForPrompt
    const fullPipeline = mapper.formatForPrompt(mapper.analyse(handwrittenDoc));
    assert(
      typeof fullPipeline === "string" && fullPipeline.length > 50,
      "analyse → formatForPrompt pipeline works",
    );

    // Full pipeline: analyse → formatForDisplay
    const fullDisplay = mapper.formatForDisplay(mapper.analyse(diagramDoc));
    assert(
      typeof fullDisplay === "object" && fullDisplay.summary.diagramCount === 2,
      "analyse → formatForDisplay pipeline works",
    );

    // Null pipeline
    const nullPipeline = mapper.formatForPrompt(mapper.analyse(null));
    assert(
      nullPipeline.includes("No OCR engine metadata"),
      "null → analyse → formatForPrompt handles gracefully",
    );

    // ========================================================================
    // GROUP 11: EDGE CASES
    // ========================================================================
    console.log("\n--- Edge Cases ---");

    // Lines with no type
    const noTypeDoc = makeStandardDoc([
      makePage(1, [
        { confidence: 0.9, text: "No type field", is_printed: true },
      ]),
    ]);
    const noTypeResult = mapper.analyse(noTypeDoc);
    assert(noTypeResult !== null, "lines without type field handled");

    // Duplicate label deduplication
    const dupLabelDiagId = "dup_diag";
    const dupLabelDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          type: "diagram",
          id: dupLabelDiagId,
          confidence: null,
          children_ids: ["dup_c1", "dup_c2"],
        }),
        makeLine({
          type: "chart_info",
          id: "dup_c1",
          parent_id: dupLabelDiagId,
          confidence: 0.9,
          text: "m",
        }),
        makeLine({
          type: "chart_info",
          id: "dup_c2",
          parent_id: dupLabelDiagId,
          confidence: 0.9,
          text: "m",
        }),
      ]),
    ]);
    const dupResult = mapper.analyse(dupLabelDoc);
    assert(
      dupResult.diagrams[0].labels.length === 1,
      "duplicate diagram labels deduplicated",
    );

    // LaTeX delimiters cleaned from labels
    const latexLabelDiagId = "ltx_diag";
    const latexLabelDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          type: "diagram",
          id: latexLabelDiagId,
          confidence: null,
          children_ids: ["ltx_c1"],
        }),
        makeLine({
          type: "chart_info",
          id: "ltx_c1",
          parent_id: latexLabelDiagId,
          confidence: 0.9,
          text: "$k_{1}$",
        }),
      ]),
    ]);
    const latexResult = mapper.analyse(latexLabelDoc);
    assert(
      latexResult.diagrams[0].labels[0] === "k_{1}",
      "LaTeX delimiters cleaned from diagram labels",
    );

    // Very low confidence single line
    const singleLowDoc = makeStandardDoc([
      makePage(1, [
        makeLine({
          line: 1,
          confidence: 0.02,
          is_handwritten: true,
          text: "Garbled",
        }),
        makeLine({
          line: 2,
          confidence: 0.98,
          is_printed: true,
          text: "Clear",
        }),
      ]),
    ]);
    const singleLowResult = mapper.analyse(singleLowDoc);
    assert(
      singleLowResult.lowConfidence.length === 1,
      "single low-confidence line detected",
    );
    assert(
      singleLowResult.lowConfidence[0].note === "handwritten",
      "handwritten note on low-confidence region",
    );

    // ========================================================================
    // RESULTS
    // ========================================================================
    console.log("\n" + results.join("\n"));
    console.log(`\n=== Test Results: ${passed}/${passed + failed} passed ===`);

    if (failed > 0) {
      console.error(`${failed} test(s) FAILED`);
    } else {
      console.log("All tests passed! ✅");
    }

    return { passed, failed, total: passed + failed };
  };

  // ============================================================================
  // REAL DATA TEST — Run against uploaded lines.json files
  // ============================================================================

  /**
   * Test the mapper against real lines.json data.
   * Call with: window.testSemanticMapperRealData(linesJsonObject)
   *
   * @param {Object} linesData - Real lines.json data
   * @returns {Object} Analysis results with token counts
   */
  window.testSemanticMapperRealData = function (linesData) {
    const mapper = getMathPixSemanticMapper();

    console.log("=== Semantic Mapper — Real Data Test ===\n");

    const analysis = mapper.analyse(linesData);

    if (!analysis) {
      console.warn("No analysis produced — check data format");
      return null;
    }

    const promptText = mapper.formatForPrompt(analysis);
    const displayData = mapper.formatForDisplay(analysis);

    const estimatedTokens = Math.ceil(promptText.length / 4);

    console.log("--- Prompt Output ---");
    console.log(promptText);
    console.log(`\n--- Estimated tokens: ${estimatedTokens} ---`);
    console.log("\n--- Display Summary ---");
    console.log(JSON.stringify(displayData.summary, null, 2));
    console.log("\n--- Region Map ---");
    for (const page of displayData.pages) {
      console.log(
        `  Page ${page.page}: ${page.writingType}, ${page.lineCount} lines, conf=${page.meanConfidence}`,
      );
    }

    return {
      analysis,
      promptText,
      displayData,
      estimatedTokens,
    };
  };

  logInfo("MathPixSemanticMapper module loaded (v1.0.0)");
})();
