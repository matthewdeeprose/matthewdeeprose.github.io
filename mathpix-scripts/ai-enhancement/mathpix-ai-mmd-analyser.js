/**
 * @fileoverview MMD Structural Analyser — Extracts metadata from MathPix Markdown
 * @module MathPixMMDAnalyser
 * @version 1.0.0
 * @since Phase 7.5D
 *
 * Analyses MMD content to produce a structural inventory for LLM prompt enrichment.
 * Pure string parsing — no API calls, no DOM manipulation.
 *
 * @requires mmd-feature-catalogue.json (reference data, not runtime loaded)
 */
(function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
      console.error(`[MMDAnalyser] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MMDAnalyser] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MMDAnalyser] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MMDAnalyser] ${message}`, ...args);
  }

  // ==========================================================================
  // NOTATION GROUP DEFINITIONS
  // ==========================================================================

  /**
   * Notation groups where variant choice must be preserved.
   * Each group contains semantically similar commands — the document's
   * specific choice is intentional and must not be normalised.
   *
   * Derived from mmd-feature-catalogue.json notationGroups array.
   */
  const NOTATION_GROUPS = [
    {
      name: "inequality_leq",
      label: "Less-than-or-equal",
      members: ["\\leq", "\\leqslant", "\\le"],
    },
    {
      name: "inequality_geq",
      label: "Greater-than-or-equal",
      members: ["\\geq", "\\geqslant", "\\ge"],
    },
    {
      name: "arrow_right",
      label: "Right arrow",
      members: [
        "\\to",
        "\\rightarrow",
        "\\longrightarrow",
        "\\Rightarrow",
        "\\Longrightarrow",
        "\\implies",
      ],
    },
    {
      name: "arrow_left",
      label: "Left arrow",
      members: [
        "\\leftarrow",
        "\\longleftarrow",
        "\\Leftarrow",
        "\\Longleftarrow",
      ],
    },
    {
      name: "arrow_leftright",
      label: "Bidirectional arrow",
      members: [
        "\\leftrightarrow",
        "\\longleftrightarrow",
        "\\Leftrightarrow",
        "\\Longleftrightarrow",
        "\\iff",
      ],
    },
    {
      name: "arrow_mapsto",
      label: "Mapsto arrow",
      members: ["\\mapsto", "\\longmapsto"],
    },
    {
      name: "multiplication",
      label: "Multiplication operator",
      members: ["\\cdot", "\\times", "\\bullet", "\\ast", "\\star"],
    },
    {
      name: "subset",
      label: "Subset relation",
      members: ["\\subset", "\\subseteq", "\\subsetneq", "\\Subset"],
    },
    {
      name: "superset",
      label: "Superset relation",
      members: ["\\supset", "\\supseteq", "\\supsetneq", "\\Supset"],
    },
    {
      name: "dots",
      label: "Ellipsis",
      members: ["\\dots", "\\ldots", "\\cdots", "\\vdots", "\\ddots"],
    },
    {
      name: "approx_sim",
      label: "Approximation/similarity",
      members: ["\\approx", "\\sim", "\\simeq", "\\cong", "\\equiv"],
    },
    {
      name: "norm_abs",
      label: "Absolute value / norm",
      members: ["\\vert", "\\Vert", "\\lvert", "\\rvert", "\\lVert", "\\rVert"],
    },
    {
      name: "bracket_variants",
      label: "Delimiter sizing",
      members: ["\\left", "\\right", "\\big", "\\Big", "\\bigg", "\\Bigg"],
    },
    {
      name: "sum_product",
      label: "Large operator",
      members: [
        "\\sum",
        "\\prod",
        "\\coprod",
        "\\bigcup",
        "\\bigcap",
        "\\bigoplus",
        "\\bigotimes",
      ],
    },
    {
      name: "integral_variants",
      label: "Integral",
      members: ["\\int", "\\iint", "\\iiint", "\\oint", "\\oiint"],
    },
    {
      name: "partial_nabla",
      label: "Differential operator",
      members: ["\\partial", "\\nabla"],
    },
    {
      name: "negation_not",
      label: "Negation",
      members: ["\\not", "\\neq", "\\ne", "\\notin", "\\notsubset"],
    },
    {
      name: "set_membership",
      label: "Set membership",
      members: ["\\in", "\\notin", "\\ni", "\\owns"],
    },
    {
      name: "prec_succ",
      label: "Ordering relation",
      members: [
        "\\prec",
        "\\succ",
        "\\preceq",
        "\\succeq",
        "\\preccurlyeq",
        "\\succcurlyeq",
      ],
    },
  ];

  /**
   * Greek letter variant pairs — if the document uses one form,
   * the LLM must not "correct" it to the other.
   */
  const GREEK_VARIANT_PAIRS = [
    { standard: "\\epsilon", variant: "\\varepsilon" },
    { standard: "\\theta", variant: "\\vartheta" },
    { standard: "\\phi", variant: "\\varphi" },
    { standard: "\\rho", variant: "\\varrho" },
    { standard: "\\sigma", variant: "\\varsigma" },
    { standard: "\\pi", variant: "\\varpi" },
  ];

  // ==========================================================================
  // MAIN CLASS
  // ==========================================================================

  /**
   * MathPix MMD Structural Analyser
   *
   * Analyses MathPix Markdown content to extract a structural inventory
   * for LLM prompt enrichment and UI display.
   *
   * @class MathPixMMDAnalyser
   * @since Phase 7.5D
   *
   * @example
   * const analyser = getMathPixMMDAnalyser();
   * const analysis = analyser.analyse(mmdContent);
   * const promptText = analyser.formatForPrompt(analysis);
   * const displayData = analyser.formatForDisplay(analysis);
   */
  class MathPixMMDAnalyser {
    /**
     * Create a new MathPixMMDAnalyser instance
     */
    constructor() {
      logInfo("MathPixMMDAnalyser instance created");
    }

    // ========================================================================
    // MAIN ENTRY POINT
    // ========================================================================

    /**
     * Main entry point — analyse MMD content and return complete metadata.
     *
     * @param {string} mmdContent - The MMD content to analyse
     * @returns {Object} Structural metadata report with all detection results
     */
    analyse(mmdContent) {
      if (!mmdContent || typeof mmdContent !== "string") {
        logWarn("analyse() called with empty or invalid input");
        return this._emptyAnalysis();
      }

      const startTime = performance.now();
      logInfo("Starting MMD analysis...", { length: mmdContent.length });

      const lines = mmdContent.split("\n");

      const analysis = {
        layout: this.analyseLayout(mmdContent, lines),
        environments: this.detectEnvironments(mmdContent, lines),
        headings: this.detectHeadings(mmdContent, lines),
        notationForms: this.detectNotationForms(mmdContent, lines),
        tables: this.detectTables(mmdContent, lines),
        images: this.detectImages(mmdContent, lines),
        mathBlocks: this.detectMathBlocks(mmdContent, lines),
        formatting: this.detectFormatting(mmdContent, lines),
        metadata: this.detectMetadata(mmdContent, lines),
        greekVariants: this.detectGreekVariants(mmdContent, lines),
        chemistry: this.detectChemistry(mmdContent, lines),
        references: this.detectReferences(mmdContent, lines),
      };

      const elapsed = (performance.now() - startTime).toFixed(1);
      logInfo(`MMD analysis complete in ${elapsed}ms`, {
        totalLines: analysis.layout.totalLines,
        environments: analysis.environments.length,
        notationForms: analysis.notationForms.length,
        images: analysis.images.length,
      });

      return analysis;
    }

    /**
     * Return an empty analysis structure for invalid input
     * @returns {Object} Empty analysis with all expected keys
     * @private
     */
    _emptyAnalysis() {
      return {
        layout: {
          totalLines: 0,
          blankLines: 0,
          blankLinePositions: [],
        },
        environments: [],
        headings: [],
        notationForms: [],
        tables: [],
        images: [],
        mathBlocks: {
          displayMath: { count: 0, lines: [] },
          inlineMath: { count: 0 },
          blockBracket: { count: 0, lines: [] },
          inlineParen: { count: 0 },
        },
        formatting: {
          bold: { count: 0, lines: [] },
          italic: { count: 0, lines: [] },
          blockquotes: { count: 0, lines: [] },
          strikethrough: { count: 0, lines: [] },
          underline: { count: 0, lines: [] },
          codeBlocks: { count: 0, lines: [] },
        },
        metadata: {
          comments: [],
          pageMarkers: [],
          newtheorems: [],
          nonumbers: [],
        },
        greekVariants: [],
        chemistry: [],
        references: {
          labels: [],
          refs: [],
          footnotes: [],
          links: [],
        },
      };
    }

    // ========================================================================
    // 1. LAYOUT ANALYSIS
    // ========================================================================

    /**
     * Analyse document layout — total lines, blank lines, and their positions.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Object} Layout metadata
     */
    analyseLayout(mmd, lines) {
      const totalLines = lines.length;
      const blankLinePositions = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "") {
          blankLinePositions.push(i + 1); // 1-indexed
        }
      }

      const result = {
        totalLines,
        blankLines: blankLinePositions.length,
        blankLinePositions,
      };

      logDebug("Layout analysis:", {
        totalLines,
        blankLines: result.blankLines,
      });
      return result;
    }

    // ========================================================================
    // 2. ENVIRONMENT DETECTION
    // ========================================================================

    /**
     * Detect all \\begin{X}...\\end{X} environments with type and line ranges.
     * Handles nesting and extracts column specs for tabular/array environments.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Array of detected environments
     */
    detectEnvironments(mmd, lines) {
      const environments = [];
      const beginRegex = /\\begin\{([a-zA-Z*]+)\}/g;
      const endRegex = /\\end\{([a-zA-Z*]+)\}/;

      // Track nesting via a stack
      const stack = [];

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // Check for \begin{...} — multiple possible on one line
        let match;
        beginRegex.lastIndex = 0;
        while ((match = beginRegex.exec(line)) !== null) {
          const envType = match[1];

          const envInfo = {
            type: envType,
            startLine: lineNum,
            endLine: null,
            nested: stack.length > 0,
          };

          // Extract column spec for tabular/array environments
          if (
            envType === "tabular" ||
            envType === "array" ||
            envType === "longtable"
          ) {
            const specMatch = line.match(
              new RegExp(
                `\\\\begin\\{${envType.replace("*", "\\*")}\\}\\s*\\{([^}]*)\\}`,
              ),
            );
            if (specMatch) {
              envInfo.columnSpec = specMatch[1];
              // Count actual columns from spec (l, c, r, p{} count as columns)
              envInfo.columnCount = this._countColumnsFromSpec(specMatch[1]);
            }
          }

          stack.push(envInfo);
        }

        // Check for \end{...}
        const endMatch = line.match(endRegex);
        if (endMatch) {
          const envType = endMatch[1];

          // Find matching begin on the stack (search from top)
          for (let j = stack.length - 1; j >= 0; j--) {
            if (stack[j].type === envType && stack[j].endLine === null) {
              stack[j].endLine = lineNum;

              // Move completed environment to results
              environments.push(stack[j]);
              stack.splice(j, 1);
              break;
            }
          }
        }
      }

      // Any unclosed environments — still record them
      stack.forEach((env) => {
        env.endLine = lines.length; // Assume extends to end
        env.unclosed = true;
        environments.push(env);
      });

      // Sort by startLine for consistent output
      environments.sort((a, b) => a.startLine - b.startLine);

      logDebug("Environments detected:", environments.length);
      return environments;
    }

    /**
     * Count columns from a LaTeX column specification string.
     * Handles l, c, r, p{...}, |, @{...} etc.
     *
     * @param {string} spec - Column specification (e.g. "l|c|r", "p{3cm}lr")
     * @returns {number} Number of data columns
     * @private
     */
    _countColumnsFromSpec(spec) {
      if (!spec) return 0;

      let count = 0;
      let i = 0;
      while (i < spec.length) {
        const ch = spec[i];

        if (ch === "l" || ch === "c" || ch === "r") {
          count++;
          i++;
        } else if (ch === "p" || ch === "m" || ch === "b") {
          // p{width}, m{width}, b{width} — skip the brace contents
          count++;
          const braceStart = spec.indexOf("{", i);
          if (braceStart !== -1) {
            const braceEnd = spec.indexOf("}", braceStart);
            i = braceEnd !== -1 ? braceEnd + 1 : spec.length;
          } else {
            i++;
          }
        } else if (ch === "@" || ch === "!") {
          // @{...} or !{...} — inter-column spec, skip brace contents
          const braceStart = spec.indexOf("{", i);
          if (braceStart !== -1) {
            const braceEnd = spec.indexOf("}", braceStart);
            i = braceEnd !== -1 ? braceEnd + 1 : spec.length;
          } else {
            i++;
          }
        } else {
          // |, *, or other — skip
          i++;
        }
      }

      return count;
    }

    // ========================================================================
    // 3. HEADING DETECTION
    // ========================================================================

    /**
     * Detect headings — both Markdown (#) and LaTeX (\\section, \\title) forms.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Array of detected headings
     */
    detectHeadings(mmd, lines) {
      const headings = [];

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // Markdown headings: # to ######
        const mdMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (mdMatch) {
          headings.push({
            level: mdMatch[1].length,
            syntax: "markdown",
            text: mdMatch[2].trim(),
            line: lineNum,
          });
          continue;
        }

        // Setext H1: line of === after text
        if (/^={3,}\s*$/.test(line) && i > 0 && lines[i - 1].trim() !== "") {
          headings.push({
            level: 1,
            syntax: "setext",
            text: lines[i - 1].trim(),
            line: i, // The text is on the previous line
          });
          continue;
        }

        // Setext H2: line of --- after text (but not inside tables or after blank lines)
        if (/^-{3,}\s*$/.test(line) && i > 0 && lines[i - 1].trim() !== "") {
          // Avoid false positives: skip if previous line looks like a table row
          if (!lines[i - 1].includes("|")) {
            headings.push({
              level: 2,
              syntax: "setext",
              text: lines[i - 1].trim(),
              line: i,
            });
            continue;
          }
        }

        // LaTeX \title{...}
        const titleMatch = line.match(/\\title\{([^}]*)\}/);
        if (titleMatch) {
          headings.push({
            level: 1,
            syntax: "\\title",
            text: titleMatch[1],
            line: lineNum,
          });
          continue;
        }

        // LaTeX \section{...} and \section*{...}
        const sectionMatch = line.match(/\\(section\*?)\{([^}]*)\}/);
        if (sectionMatch) {
          headings.push({
            level: 2,
            syntax: `\\${sectionMatch[1]}`,
            text: sectionMatch[2],
            line: lineNum,
          });
          continue;
        }

        // LaTeX \subsection{...} and \subsection*{...}
        const subsectionMatch = line.match(/\\(subsection\*?)\{([^}]*)\}/);
        if (subsectionMatch) {
          headings.push({
            level: 3,
            syntax: `\\${subsectionMatch[1]}`,
            text: subsectionMatch[2],
            line: lineNum,
          });
          continue;
        }

        // LaTeX \subsubsection{...} and \subsubsection*{...}
        const subsubMatch = line.match(/\\(subsubsection\*?)\{([^}]*)\}/);
        if (subsubMatch) {
          headings.push({
            level: 4,
            syntax: `\\${subsubMatch[1]}`,
            text: subsubMatch[2],
            line: lineNum,
          });
          continue;
        }
      }

      logDebug("Headings detected:", headings.length);
      return headings;
    }

    // ========================================================================
    // 4. NOTATION FORM DETECTION
    // ========================================================================

    /**
     * Detect specific notation variants used in the document.
     * Scans for members of each notation group and records which
     * forms appear and where.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Detected notation forms with group, form, count, and lines
     */
    detectNotationForms(mmd, lines) {
      const results = [];

      for (const group of NOTATION_GROUPS) {
        for (const member of group.members) {
          // Build a regex that matches the command as a whole word
          // Escape backslashes for regex, add word boundary after command name
          const escaped = member.replace(/\\/g, "\\\\").replace(/\*/g, "\\*");
          // Use a negative lookahead for letters to avoid partial matches
          // e.g. \le should not match inside \leq
          const pattern = new RegExp(escaped + "(?![a-zA-Z])", "g");

          const matchLines = [];
          let totalCount = 0;

          for (let i = 0; i < lines.length; i++) {
            const lineMatches = lines[i].match(pattern);
            if (lineMatches) {
              totalCount += lineMatches.length;
              matchLines.push(i + 1);
            }
          }

          if (totalCount > 0) {
            results.push({
              group: group.name,
              groupLabel: group.label,
              form: member,
              count: totalCount,
              lines: matchLines,
            });
          }
        }
      }

      logDebug("Notation forms detected:", results.length);
      return results;
    }

    // ========================================================================
    // 5. TABLE DETECTION
    // ========================================================================

    /**
     * Detect tables — both LaTeX tabular and Markdown pipe tables.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Detected tables with format, dimensions, and line ranges
     */
    detectTables(mmd, lines) {
      const tables = [];

      // LaTeX tabular tables are detected in detectEnvironments(),
      // but here we extract richer data (row counts).
      // We also detect markdown pipe tables which are NOT \begin{} environments.

      // --- Markdown pipe tables ---
      let inMarkdownTable = false;
      let tableStart = -1;
      let tableColumns = 0;
      let tableRows = 0;
      let hasSeparator = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const isPipeLine = /^\|.*\|$/.test(line);

        if (isPipeLine && !inMarkdownTable) {
          // Potential table start
          inMarkdownTable = true;
          tableStart = i + 1;
          tableRows = 1;
          tableColumns = (line.match(/\|/g) || []).length - 1;
          hasSeparator = false;
        } else if (isPipeLine && inMarkdownTable) {
          // Check if this is the separator row
          if (/^\|[\s:|-]+\|$/.test(line)) {
            hasSeparator = true;
          } else {
            tableRows++;
          }
        } else if (inMarkdownTable) {
          // End of table
          if (hasSeparator && tableRows >= 1) {
            tables.push({
              format: "markdown_pipe",
              startLine: tableStart,
              endLine: i, // Previous line was last table line
              columns: Math.max(tableColumns, 1),
              rows: tableRows,
            });
          }
          inMarkdownTable = false;
          tableStart = -1;
          tableRows = 0;
          hasSeparator = false;
        }
      }

      // Handle table at end of document
      if (inMarkdownTable && hasSeparator && tableRows >= 1) {
        tables.push({
          format: "markdown_pipe",
          startLine: tableStart,
          endLine: lines.length,
          columns: Math.max(tableColumns, 1),
          rows: tableRows,
        });
      }

      // --- LaTeX tabular tables (enrich with row count) ---
      const beginTabularRegex = /\\begin\{tabular\}\s*\{([^}]*)\}/;
      let inTabular = false;
      let tabularStart = -1;
      let tabularSpec = "";
      let tabularRowCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!inTabular) {
          const tabMatch = line.match(beginTabularRegex);
          if (tabMatch) {
            inTabular = true;
            tabularStart = i + 1;
            tabularSpec = tabMatch[1];
            tabularRowCount = 0;
          }
        } else {
          // Count rows via \\ (line breaks in tabular)
          if (/\\\\/.test(line)) {
            tabularRowCount++;
          }

          if (/\\end\{tabular\}/.test(line)) {
            // Last row may not have \\ so add 1
            tabularRowCount++;
            tables.push({
              format: "latex_tabular",
              startLine: tabularStart,
              endLine: i + 1,
              columns: this._countColumnsFromSpec(tabularSpec),
              rows: tabularRowCount,
              columnSpec: tabularSpec,
            });
            inTabular = false;
          }
        }
      }

      // Sort by startLine
      tables.sort((a, b) => a.startLine - b.startLine);

      logDebug("Tables detected:", tables.length);
      return tables;
    }

    // ========================================================================
    // 6. IMAGE DETECTION
    // ========================================================================

    /**
     * Detect image references — Markdown ![alt](url), \\includegraphics, and MathPix CDN URLs.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Detected images with line, alt text, URL, and CDN flag
     */
    detectImages(mmd, lines) {
      const images = [];

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // Markdown image: ![alt](url) with optional params
        const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        while ((match = mdImgRegex.exec(line)) !== null) {
          const altText = match[1];
          const url = match[2];
          images.push({
            line: lineNum,
            syntax: "markdown",
            hasAlt: altText.length > 0,
            altText: altText || null,
            url,
            isMathPixCDN:
              /cdn\.mathpix\.com/.test(url) ||
              /mathpix-ocr-examples\.s3\.amazonaws\.com/.test(url),
          });
        }

        // LaTeX \includegraphics[options]{url}
        const includeMatch = line.match(
          /\\includegraphics\s*(\[[^\]]*\])?\s*\{([^}]+)\}/,
        );
        if (includeMatch) {
          const url = includeMatch[2];
          images.push({
            line: lineNum,
            syntax: "\\includegraphics",
            hasAlt: false,
            altText: null,
            url,
            isMathPixCDN:
              /cdn\.mathpix\.com/.test(url) ||
              /mathpix-ocr-examples\.s3\.amazonaws\.com/.test(url),
          });
        }
      }

      logDebug("Images detected:", images.length);
      return images;
    }

    // ========================================================================
    // 7. MATH BLOCK DETECTION
    // ========================================================================

    /**
     * Detect mathematics delimiters — display and inline math in all forms.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Object} Math block statistics
     */
    detectMathBlocks(mmd, lines) {
      const result = {
        displayMath: { count: 0, lines: [] }, // $$...$$
        inlineMath: { count: 0 }, // $...$
        blockBracket: { count: 0, lines: [] }, // \[...\]
        inlineParen: { count: 0 }, // \(...\)
      };

      // --- Display math $$ ... $$ ---
      // Track opening/closing $$ across lines
      let inDisplayMath = false;
      let displayStart = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for $$ that opens or closes a block
        // A line with just $$ toggles state
        // A line with $$...$$ is a single-line display math
        const dollarPairs = line.match(/\$\$/g);
        if (dollarPairs) {
          if (dollarPairs.length >= 2 && !inDisplayMath) {
            // Single-line display math: $$content$$
            result.displayMath.count++;
            result.displayMath.lines.push(i + 1);
          } else if (!inDisplayMath) {
            // Opening $$
            inDisplayMath = true;
            displayStart = i + 1;
          } else {
            // Closing $$
            inDisplayMath = false;
            result.displayMath.count++;
            result.displayMath.lines.push(displayStart);
          }
        }
      }

      // --- Block bracket \[...\] ---
      for (let i = 0; i < lines.length; i++) {
        if (/\\\[/.test(lines[i])) {
          result.blockBracket.count++;
          result.blockBracket.lines.push(i + 1);
        }
      }

      // --- Inline math $...$ (not $$) ---
      // Count across the whole document using a regex that excludes $$
      const inlineRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
      let inlineMatch;
      while ((inlineMatch = inlineRegex.exec(mmd)) !== null) {
        result.inlineMath.count++;
      }

      // --- Inline paren \(...\) ---
      const parenRegex = /\\\(.*?\\\)/g;
      let parenMatch;
      while ((parenMatch = parenRegex.exec(mmd)) !== null) {
        result.inlineParen.count++;
      }

      logDebug("Math blocks detected:", {
        display: result.displayMath.count,
        inline: result.inlineMath.count,
        blockBracket: result.blockBracket.count,
        inlineParen: result.inlineParen.count,
      });

      return result;
    }

    // ========================================================================
    // 8. FORMATTING DETECTION
    // ========================================================================

    /**
     * Detect formatting elements — bold, italic, blockquotes, strikethrough,
     * underlines, and code blocks.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Object} Formatting statistics
     */
    detectFormatting(mmd, lines) {
      const result = {
        bold: { count: 0, lines: [] },
        italic: { count: 0, lines: [] },
        blockquotes: { count: 0, lines: [] },
        strikethrough: { count: 0, lines: [] },
        underline: { count: 0, lines: [] },
        codeBlocks: { count: 0, lines: [] },
      };

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // Bold: **text** or __text__ or \textbf{}
        if (
          /\*\*[^*]+\*\*/.test(line) ||
          /__[^_]+__/.test(line) ||
          /\\textbf\{/.test(line)
        ) {
          result.bold.count++;
          result.bold.lines.push(lineNum);
        }

        // Italic: *text* (not **) or _text_ (not __) or \textit{} or \emph{}
        if (
          /(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/.test(line) ||
          /\\textit\{/.test(line) ||
          /\\emph\{/.test(line)
        ) {
          result.italic.count++;
          result.italic.lines.push(lineNum);
        }

        // Blockquotes: > text
        if (/^>\s/.test(line)) {
          result.blockquotes.count++;
          result.blockquotes.lines.push(lineNum);
        }

        // Strikethrough: ~~text~~ or \sout{} or \xout{}
        if (
          /~~[^~]+~~/.test(line) ||
          /\\sout\{/.test(line) ||
          /\\xout\{/.test(line)
        ) {
          result.strikethrough.count++;
          result.strikethrough.lines.push(lineNum);
        }

        // Underline: \underline{} or \uline{} or \uuline{} or \uwave{} or \dashuline{} or \dotuline{}
        if (
          /\\underline\{/.test(line) ||
          /\\uline\{/.test(line) ||
          /\\uuline\{/.test(line) ||
          /\\uwave\{/.test(line) ||
          /\\dashuline\{/.test(line) ||
          /\\dotuline\{/.test(line)
        ) {
          result.underline.count++;
          result.underline.lines.push(lineNum);
        }

        // Code blocks: ``` (fenced)
        if (/^```/.test(line)) {
          result.codeBlocks.count++;
          result.codeBlocks.lines.push(lineNum);
        }
      }

      logDebug("Formatting detected:", {
        bold: result.bold.count,
        italic: result.italic.count,
        blockquotes: result.blockquotes.count,
      });

      return result;
    }

    // ========================================================================
    // 9. METADATA DETECTION
    // ========================================================================

    /**
     * Detect metadata elements — comments, page markers, newtheorem declarations,
     * and MMD-specific annotations.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Object} Metadata elements
     */
    detectMetadata(mmd, lines) {
      const result = {
        comments: [],
        pageMarkers: [],
        newtheorems: [],
        nonumbers: [],
      };

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // LaTeX comments: % (not \%) — includes %% AI: comments
        if (/(?<!\\)%/.test(line)) {
          const commentText = line.replace(/^[^%]*(?<!\\)%\s*/, "").trim();
          result.comments.push({
            line: lineNum,
            text: commentText,
            isAIComment: /^%?\s*AI:/.test(commentText),
          });
        }

        // Page breaks
        if (/\\pagebreak/.test(line)) {
          result.pageMarkers.push({
            line: lineNum,
            type: "\\pagebreak",
          });
        }

        // \newtheorem declarations
        const theoremMatch = line.match(
          /\\newtheorem(\*?)\{([^}]+)\}\{([^}]+)\}/,
        );
        if (theoremMatch) {
          result.newtheorems.push({
            line: lineNum,
            name: theoremMatch[2],
            title: theoremMatch[3],
            starred: theoremMatch[1] === "*",
          });
        }

        // \nonumber or \notag
        if (/\\nonumber/.test(line) || /\\notag/.test(line)) {
          result.nonumbers.push(lineNum);
        }
      }

      logDebug("Metadata detected:", {
        comments: result.comments.length,
        pageMarkers: result.pageMarkers.length,
        newtheorems: result.newtheorems.length,
      });

      return result;
    }

    // ========================================================================
    // GREEK VARIANT DETECTION
    // ========================================================================

    /**
     * Detect Greek letter variant pairs — flags if the document uses
     * \\varepsilon vs \\epsilon, \\varphi vs \\phi, etc.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Detected Greek variant usages
     */
    detectGreekVariants(mmd, lines) {
      const results = [];

      for (const pair of GREEK_VARIANT_PAIRS) {
        const stdEscaped = pair.standard
          .replace(/\\/g, "\\\\")
          .replace(/\*/g, "\\*");
        const varEscaped = pair.variant
          .replace(/\\/g, "\\\\")
          .replace(/\*/g, "\\*");

        const stdRegex = new RegExp(stdEscaped + "(?![a-zA-Z])", "g");
        const varRegex = new RegExp(varEscaped + "(?![a-zA-Z])", "g");

        const stdCount = (mmd.match(stdRegex) || []).length;
        const varCount = (mmd.match(varRegex) || []).length;

        if (stdCount > 0 || varCount > 0) {
          const stdLines = [];
          const varLines = [];

          for (let i = 0; i < lines.length; i++) {
            if (stdRegex.test(lines[i])) stdLines.push(i + 1);
            stdRegex.lastIndex = 0;
            if (varRegex.test(lines[i])) varLines.push(i + 1);
            varRegex.lastIndex = 0;
          }

          results.push({
            standard: pair.standard,
            variant: pair.variant,
            standardCount: stdCount,
            variantCount: varCount,
            standardLines: stdLines,
            variantLines: varLines,
          });
        }
      }

      logDebug("Greek variants detected:", results.length);
      return results;
    }

    // ========================================================================
    // CHEMISTRY DETECTION
    // ========================================================================

    /**
     * Detect chemistry notation — SMILES and \\ce{} commands.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Array<Object>} Detected chemistry elements
     */
    detectChemistry(mmd, lines) {
      const results = [];

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // <smiles>...</smiles>
        if (/<smiles>/.test(line)) {
          results.push({ type: "smiles_inline", line: lineNum });
        }

        // ```smiles code blocks
        if (/^```smiles/.test(line)) {
          results.push({ type: "smiles_block", line: lineNum });
        }

        // \ce{...}
        if (/\\ce\{/.test(line)) {
          results.push({ type: "ce", line: lineNum });
        }
      }

      logDebug("Chemistry elements detected:", results.length);
      return results;
    }

    // ========================================================================
    // REFERENCE DETECTION
    // ========================================================================

    /**
     * Detect cross-references, labels, footnotes, and links.
     *
     * @param {string} mmd - Raw MMD content
     * @param {string[]} lines - Pre-split lines array
     * @returns {Object} Reference elements by type
     */
    detectReferences(mmd, lines) {
      const result = {
        labels: [],
        refs: [],
        footnotes: [],
        links: [],
      };

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // \label{...}
        const labelMatch = line.match(/\\label\{([^}]+)\}/);
        if (labelMatch) {
          result.labels.push({ line: lineNum, id: labelMatch[1] });
        }

        // \ref{...} and \eqref{...}
        const refMatches = line.matchAll(/\\(eq)?ref\{([^}]+)\}/g);
        for (const m of refMatches) {
          result.refs.push({
            line: lineNum,
            type: m[1] ? "\\eqref" : "\\ref",
            id: m[2],
          });
        }

        // \tag{...}
        const tagMatch = line.match(/\\tag\{([^}]+)\}/);
        if (tagMatch) {
          result.refs.push({
            line: lineNum,
            type: "\\tag",
            id: tagMatch[1],
          });
        }

        // LaTeX footnotes: \footnote{}, \footnotemark, \footnotetext{}
        if (/\\footnote\{/.test(line)) {
          result.footnotes.push({ line: lineNum, type: "\\footnote" });
        }
        if (/\\footnotemark/.test(line)) {
          result.footnotes.push({ line: lineNum, type: "\\footnotemark" });
        }
        if (/\\footnotetext\{/.test(line)) {
          result.footnotes.push({ line: lineNum, type: "\\footnotetext" });
        }

        // Markdown footnotes: [^id]
        if (/\[\^[^\]]+\]/.test(line)) {
          result.footnotes.push({
            line: lineNum,
            type: "markdown_footnote",
          });
        }

        // Markdown links: [text](url) — but NOT images ![alt](url)
        const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(line)) !== null) {
          result.links.push({
            line: lineNum,
            text: linkMatch[1],
            url: linkMatch[2],
          });
        }
      }

      logDebug("References detected:", {
        labels: result.labels.length,
        refs: result.refs.length,
        footnotes: result.footnotes.length,
        links: result.links.length,
      });

      return result;
    }

    // ========================================================================
    // FORMAT FOR PROMPT
    // ========================================================================

    /**
     * Format analysis results as prompt-ready inventory text.
     * This output goes directly into the LLM user prompt.
     *
     * Design goals:
     * - Concise (200–500 tokens)
     * - Actionable (each item is a preservation instruction)
     * - Grouped by category with clear headers
     * - Line references included
     * - Empty sections omitted
     * - Layout section always present
     *
     * @param {Object} analysis - Output from analyse()
     * @returns {string} Text for injection into LLM user prompt
     */
    formatForPrompt(analysis) {
      if (!analysis) {
        logWarn("formatForPrompt() called with null analysis");
        return "";
      }

      const sections = [];

      sections.push(
        "STRUCTURAL INVENTORY — preserve every item below exactly as-is:",
      );

      // --- ENVIRONMENTS ---
      if (analysis.environments.length > 0) {
        const envSection = this._formatEnvironmentsForPrompt(
          analysis.environments,
        );
        if (envSection) sections.push(envSection);
      }

      // --- HEADINGS ---
      if (analysis.headings.length > 0) {
        const headingSection = this._formatHeadingsForPrompt(analysis.headings);
        if (headingSection) sections.push(headingSection);
      }

      // --- NOTATION ---
      const notationItems = this._formatNotationForPrompt(
        analysis.notationForms,
        analysis.greekVariants,
      );
      if (notationItems) sections.push(notationItems);

      // --- TABLES ---
      if (analysis.tables.length > 0) {
        const tableSection = this._formatTablesForPrompt(analysis.tables);
        if (tableSection) sections.push(tableSection);
      }

      // --- IMAGES ---
      if (analysis.images.length > 0) {
        const imgLines = analysis.images.map((img) => img.line);
        sections.push(
          `IMAGES (never remove or modify URLs):\n- ${analysis.images.length}× image reference${analysis.images.length > 1 ? "s" : ""}: Line${imgLines.length > 1 ? "s" : ""} ${imgLines.join(", ")}`,
        );
      }

      // --- FORMATTING ---
      const fmtSection = this._formatFormattingForPrompt(analysis.formatting);
      if (fmtSection) sections.push(fmtSection);

      // --- CHEMISTRY ---
      if (analysis.chemistry.length > 0) {
        const chemLines = analysis.chemistry.map(
          (c) => `${c.type} (Line ${c.line})`,
        );
        sections.push(
          `CHEMISTRY (preserve exactly):\n- ${chemLines.join(", ")}`,
        );
      }

      // --- REFERENCES ---
      const refSection = this._formatReferencesForPrompt(analysis.references);
      if (refSection) sections.push(refSection);

      // --- MATH DELIMITERS (consistency check) ---
      const delimSection = this._formatMathDelimitersForPrompt(
        analysis.mathBlocks,
      );
      if (delimSection) sections.push(delimSection);

      // --- LAYOUT (always present) ---
      const layout = analysis.layout;
      const minLines = Math.floor(layout.totalLines * 0.95);
      const maxLines = Math.ceil(layout.totalLines * 1.05);
      sections.push(
        `LAYOUT:\n- ${layout.totalLines} total lines, ${layout.blankLines} blank lines\n- Target output: ${minLines}–${maxLines} lines (±5%). Aim to match ${layout.totalLines} exactly.`,
      );

      return sections.join("\n\n");
    }

    /**
     * Format environments section for prompt
     * @param {Array} environments
     * @returns {string|null}
     * @private
     */
    _formatEnvironmentsForPrompt(environments) {
      // Group by type and collect line ranges
      const grouped = {};
      for (const env of environments) {
        if (!grouped[env.type]) grouped[env.type] = [];
        const rangeStr =
          env.startLine === env.endLine
            ? `Line ${env.startLine}`
            : `Lines ${env.startLine}-${env.endLine}`;
        const extra = env.columnCount ? ` (${env.columnCount} columns)` : "";
        grouped[env.type].push(rangeStr + extra);
      }

      const lines = [];
      for (const [type, ranges] of Object.entries(grouped)) {
        lines.push(
          `- ${ranges.length}× \\begin{${type}}: ${ranges.join(", ")}`,
        );
      }

      if (lines.length === 0) return null;

      return `ENVIRONMENTS (do NOT convert, dismantle, or substitute):\n${lines.join("\n")}`;
    }

    /**
     * Format headings section for prompt
     * @param {Array} headings
     * @returns {string|null}
     * @private
     */
    _formatHeadingsForPrompt(headings) {
      // Group by syntax
      const grouped = {};
      for (const h of headings) {
        const key = h.syntax;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(`Line ${h.line}`);
      }

      const lines = [];
      for (const [syntax, refs] of Object.entries(grouped)) {
        lines.push(`- ${refs.length}× ${syntax}: ${refs.join(", ")}`);
      }

      if (lines.length === 0) return null;

      return `HEADINGS (preserve wrapper syntax and level):\n${lines.join("\n")}`;
    }

    /**
     * Format notation forms and Greek variants for prompt
     * @param {Array} notationForms
     * @param {Array} greekVariants
     * @returns {string|null}
     * @private
     */
    _formatNotationForPrompt(notationForms, greekVariants) {
      const lines = [];

      // Notation groups — only show groups where a specific non-default variant is used
      // Group forms by their group and show which variant the document uses
      const groupsWithMultipleOptions = {};
      for (const nf of notationForms) {
        if (!groupsWithMultipleOptions[nf.group]) {
          groupsWithMultipleOptions[nf.group] = [];
        }
        groupsWithMultipleOptions[nf.group].push(nf);
      }

      for (const [, forms] of Object.entries(groupsWithMultipleOptions)) {
        // Only report if there's a meaningful preservation instruction
        for (const form of forms) {
          const lineRef =
            form.lines.length <= 3
              ? form.lines.map((l) => `Line ${l}`).join(", ")
              : `${form.lines.length} occurrences`;
          lines.push(
            `- ${form.form} (not alternatives): ${lineRef} ×${form.count}`,
          );
        }
      }

      // Greek variants — only flag if the variant form is used
      for (const gv of greekVariants || []) {
        if (gv.variantCount > 0) {
          lines.push(
            `- ${gv.variant} (not ${gv.standard}): ×${gv.variantCount}`,
          );
        }
      }

      if (lines.length === 0) return null;

      return `NOTATION (preserve these exact forms — do NOT normalise):\n${lines.join("\n")}`;
    }

    /**
     * Format tables section for prompt
     * @param {Array} tables
     * @returns {string|null}
     * @private
     */
    _formatTablesForPrompt(tables) {
      const latexCount = tables.filter(
        (t) => t.format === "latex_tabular",
      ).length;
      const mdCount = tables.filter((t) => t.format === "markdown_pipe").length;

      const parts = [];
      if (latexCount > 0) parts.push(`${latexCount}× LaTeX \\begin{tabular}`);
      if (mdCount > 0) parts.push(`${mdCount}× Markdown pipe table`);

      if (parts.length === 0) return null;

      return `TABLES (preserve format type — do NOT convert between LaTeX and markdown):\n- ${parts.join("\n- ")}`;
    }

    /**
     * Format formatting section for prompt
     * @param {Object} formatting
     * @returns {string|null}
     * @private
     */
    _formatFormattingForPrompt(formatting) {
      const items = [];

      if (formatting.blockquotes.count > 0) {
        items.push(
          `${formatting.blockquotes.count}× blockquote line${formatting.blockquotes.count > 1 ? "s" : ""}: Line${formatting.blockquotes.lines.length > 1 ? "s" : ""} ${formatting.blockquotes.lines.slice(0, 5).join(", ")}${formatting.blockquotes.lines.length > 5 ? "..." : ""}`,
        );
      }

      if (formatting.codeBlocks.count > 0) {
        items.push(`${formatting.codeBlocks.count}× code fence markers`);
      }

      if (formatting.underline.count > 0) {
        items.push(`${formatting.underline.count}× underline commands`);
      }

      if (items.length === 0) return null;

      return `FORMATTING:\n- ${items.join("\n- ")}`;
    }

    /**
     * Format references section for prompt
     * @param {Object} references
     * @returns {string|null}
     * @private
     */
    _formatReferencesForPrompt(references) {
      const items = [];

      if (references.labels.length > 0) {
        items.push(
          `${references.labels.length}× \\label{} (Lines ${references.labels.map((l) => l.line).join(", ")})`,
        );
      }
      if (references.refs.length > 0) {
        items.push(`${references.refs.length}× \\ref/\\eqref/\\tag references`);
      }
      if (references.footnotes.length > 0) {
        items.push(`${references.footnotes.length}× footnotes`);
      }

      if (items.length === 0) return null;

      return `REFERENCES (preserve all label IDs and cross-references):\n- ${items.join("\n- ")}`;
    }

    /**
     * Format maths delimiter consistency check for prompt
     * @param {Object} mathBlocks
     * @returns {string|null}
     * @private
     */
    _formatMathDelimitersForPrompt(mathBlocks) {
      const items = [];

      // Check for mixed inline delimiters
      if (mathBlocks.inlineMath.count > 0 && mathBlocks.inlineParen.count > 0) {
        items.push(
          `Mixed inline maths delimiters: ${mathBlocks.inlineMath.count}× $...$ and ${mathBlocks.inlineParen.count}× \\(...\\) — preserve each as-is`,
        );
      }

      // Check for mixed display delimiters
      if (
        mathBlocks.displayMath.count > 0 &&
        mathBlocks.blockBracket.count > 0
      ) {
        items.push(
          `Mixed display maths delimiters: ${mathBlocks.displayMath.count}× $$...$$ and ${mathBlocks.blockBracket.count}× \\[...\\] — preserve each as-is`,
        );
      }

      if (items.length === 0) return null;

      return `MATHS DELIMITERS (do NOT convert between delimiter styles):\n- ${items.join("\n- ")}`;
    }

    // ========================================================================
    // FORMAT FOR DISPLAY
    // ========================================================================

    /**
     * Format analysis results as UI-friendly summary.
     * Returns data for rendering in the enhancement modal.
     *
     * @param {Object} analysis - Output from analyse()
     * @returns {Object} Summary with counts and highlights for display
     */
    formatForDisplay(analysis) {
      if (!analysis) {
        logWarn("formatForDisplay() called with null analysis");
        return { summary: {}, details: {} };
      }

      // Group environments by type
      const envTypes = {};
      for (const env of analysis.environments) {
        envTypes[env.type] = (envTypes[env.type] || 0) + 1;
      }

      // Group headings by syntax type
      const headingTypes = {};
      for (const h of analysis.headings) {
        headingTypes[h.syntax] = (headingTypes[h.syntax] || 0) + 1;
      }

      // Count table types
      const latexTables = analysis.tables.filter(
        (t) => t.format === "latex_tabular",
      ).length;
      const mdTables = analysis.tables.filter(
        (t) => t.format === "markdown_pipe",
      ).length;

      return {
        summary: {
          totalLines: analysis.layout.totalLines,
          blankLines: analysis.layout.blankLines,
          environments: {
            total: analysis.environments.length,
            types: envTypes,
          },
          headings: {
            total: analysis.headings.length,
            types: headingTypes,
          },
          images: {
            total: analysis.images.length,
            withAlt: analysis.images.filter((img) => img.hasAlt).length,
            withoutAlt: analysis.images.filter((img) => !img.hasAlt).length,
          },
          displayMath: analysis.mathBlocks.displayMath.count,
          inlineMath: analysis.mathBlocks.inlineMath.count,
          tables: {
            latex: latexTables,
            markdown: mdTables,
          },
          notationVariants: analysis.notationForms.length,
          greekVariants: analysis.greekVariants.length,
          formatting: {
            bold: analysis.formatting.bold.count,
            italic: analysis.formatting.italic.count,
            blockquotes: analysis.formatting.blockquotes.count,
            strikethrough: analysis.formatting.strikethrough.count,
            underline: analysis.formatting.underline.count,
            codeBlocks: analysis.formatting.codeBlocks.count,
          },
          chemistry: analysis.chemistry.length,
          references: {
            labels: analysis.references.labels.length,
            refs: analysis.references.refs.length,
            footnotes: analysis.references.footnotes.length,
            links: analysis.references.links.length,
          },
        },
        details: analysis,
      };
    }
  }

  // ==========================================================================
  // SINGLETON PATTERN
  // ==========================================================================

  let instance = null;

  /**
   * Get or create singleton instance of MathPixMMDAnalyser.
   *
   * @returns {MathPixMMDAnalyser} Singleton instance
   */
  function getMathPixMMDAnalyser() {
    if (!instance) {
      instance = new MathPixMMDAnalyser();
    }
    return instance;
  }

  // ==========================================================================
  // GLOBAL EXPOSURE
  // ==========================================================================

  window.MathPixMMDAnalyser = MathPixMMDAnalyser;
  window.getMathPixMMDAnalyser = getMathPixMMDAnalyser;

  // ==========================================================================
  // TEST SUITE
  // ==========================================================================

  /**
   * Run the MMD Analyser test suite.
   * Executes synthetic test cases covering each detection method.
   *
   * @returns {Object} Test results: { passed, failed, total, results }
   */
  window.testMMDAnalyser = function () {
    const analyser = getMathPixMMDAnalyser();
    const results = [];
    let passed = 0;
    let failed = 0;

    /**
     * Assert helper
     * @param {string} testName
     * @param {boolean} condition
     * @param {string} [detail]
     */
    function assert(testName, condition, detail) {
      if (condition) {
        passed++;
        results.push({ name: testName, status: "PASS" });
        console.log(`  ✓ ${testName}`);
      } else {
        failed++;
        results.push({
          name: testName,
          status: "FAIL",
          detail: detail || "",
        });
        console.error(`  ✗ ${testName}${detail ? ": " + detail : ""}`);
      }
    }

    console.log("=== MMD Analyser Test Suite ===\n");

    // ---- Test 1: Empty input ----
    console.log("1. Empty input handling");
    {
      const r = analyser.analyse("");
      assert("Empty string returns valid structure", r.layout.totalLines === 0);
      assert(
        "Empty string has empty environments",
        r.environments.length === 0,
      );

      const r2 = analyser.analyse(null);
      assert("Null input returns valid structure", r2.layout.totalLines === 0);

      const r3 = analyser.analyse(undefined);
      assert(
        "Undefined input returns valid structure",
        r3.layout.totalLines === 0,
      );
    }

    // ---- Test 2: Layout analysis ----
    console.log("\n2. Layout analysis");
    {
      const mmd = "Line 1\n\nLine 3\nLine 4\n\nLine 6";
      const r = analyser.analyse(mmd);
      assert("Total lines = 6", r.layout.totalLines === 6);
      assert("Blank lines = 2", r.layout.blankLines === 2);
      assert(
        "Blank line positions correct",
        JSON.stringify(r.layout.blankLinePositions) === JSON.stringify([2, 5]),
      );
    }

    // ---- Test 3: Single environment detection ----
    console.log("\n3. Single environment detection");
    {
      const mmd =
        "Before\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\nAfter";
      const r = analyser.analyse(mmd);
      assert(
        "One environment detected",
        r.environments.length === 1,
        `Got ${r.environments.length}`,
      );
      assert(
        "Type is aligned",
        r.environments[0]?.type === "aligned",
        `Got ${r.environments[0]?.type}`,
      );
      assert(
        "Start line correct",
        r.environments[0]?.startLine === 2,
        `Got ${r.environments[0]?.startLine}`,
      );
      assert(
        "End line correct",
        r.environments[0]?.endLine === 5,
        `Got ${r.environments[0]?.endLine}`,
      );
    }

    // ---- Test 4: Nested environments ----
    console.log("\n4. Nested environments");
    {
      const mmd =
        "\\begin{equation*}\n\\begin{aligned}\nx &= 1\n\\end{aligned}\n\\end{equation*}";
      const r = analyser.analyse(mmd);
      assert(
        "Two environments detected",
        r.environments.length === 2,
        `Got ${r.environments.length}`,
      );
      const aligned = r.environments.find((e) => e.type === "aligned");
      assert(
        "Aligned is nested",
        aligned?.nested === true,
        `nested = ${aligned?.nested}`,
      );
    }

    // ---- Test 5: Tabular with column spec ----
    console.log("\n5. Tabular with column spec");
    {
      const mmd =
        "\\begin{tabular}{|l|c|r|}\n\\hline\nA & B & C \\\\\n\\hline\n1 & 2 & 3 \\\\\n\\hline\n\\end{tabular}";
      const r = analyser.analyse(mmd);
      const tab = r.environments.find((e) => e.type === "tabular");
      assert("Tabular detected", !!tab);
      assert(
        "Column count = 3",
        tab?.columnCount === 3,
        `Got ${tab?.columnCount}`,
      );
    }

    // ---- Test 6: Heading detection (all formats) ----
    console.log("\n6. Heading detection");
    {
      const mmd =
        "# Heading 1\n## Heading 2\n### Heading 3\n\\section{Section}\n\\subsection{Subsection}\n\\title{My Document}";
      const r = analyser.analyse(mmd);
      assert(
        "Six headings detected",
        r.headings.length === 6,
        `Got ${r.headings.length}`,
      );
      assert(
        "Markdown H1 found",
        r.headings.some((h) => h.syntax === "markdown" && h.level === 1),
      );
      assert(
        "LaTeX \\section found",
        r.headings.some((h) => h.syntax === "\\section"),
      );
      assert(
        "LaTeX \\title found",
        r.headings.some((h) => h.syntax === "\\title"),
      );
    }

    // ---- Test 7: Notation variant detection ----
    console.log("\n7. Notation variant detection");
    {
      const mmd =
        "We have $a \\leqslant b$ and $c \\geqslant d$.\nAlso $x \\leqslant y$ on this line.\nAnd $\\cdot$ product.";
      const r = analyser.analyse(mmd);
      const leqslant = r.notationForms.find((n) => n.form === "\\leqslant");
      assert("\\leqslant detected", !!leqslant);
      assert(
        "\\leqslant count = 2",
        leqslant?.count === 2,
        `Got ${leqslant?.count}`,
      );
      const geqslant = r.notationForms.find((n) => n.form === "\\geqslant");
      assert("\\geqslant detected", !!geqslant);
      const cdot = r.notationForms.find((n) => n.form === "\\cdot");
      assert("\\cdot detected", !!cdot);
    }

    // ---- Test 8: Markdown table detection ----
    console.log("\n8. Markdown table detection");
    {
      const mmd =
        "Some text\n\n| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n\nMore text";
      const r = analyser.analyse(mmd);
      const mdTable = r.tables.find((t) => t.format === "markdown_pipe");
      assert("Markdown table detected", !!mdTable);
      assert(
        "Markdown table columns = 3",
        mdTable?.columns === 3,
        `Got ${mdTable?.columns}`,
      );
      assert(
        "Markdown table rows = 3 (header + 2 data)",
        mdTable?.rows === 3,
        `Got ${mdTable?.rows}`,
      );
    }

    // ---- Test 9: Image detection ----
    console.log("\n9. Image detection");
    {
      const mmd =
        "Text\n![A diagram](https://cdn.mathpix.com/snip/images/abc.png)\n![](local.png)\nMore text";
      const r = analyser.analyse(mmd);
      assert(
        "Two images detected",
        r.images.length === 2,
        `Got ${r.images.length}`,
      );
      const cdnImage = r.images.find((img) => img.isMathPixCDN);
      assert("MathPix CDN image flagged", !!cdnImage);
      const noAlt = r.images.find((img) => !img.hasAlt);
      assert("Image without alt text detected", !!noAlt);
    }

    // ---- Test 10: Math block detection ----
    console.log("\n10. Math block detection");
    {
      const mmd =
        "Inline $x = 1$ and $y = 2$.\n$$\na = b\n$$\n\\[c = d\\]\nAlso \\(z = 3\\) inline.";
      const r = analyser.analyse(mmd);
      assert(
        "2 inline math",
        r.mathBlocks.inlineMath.count === 2,
        `Got ${r.mathBlocks.inlineMath.count}`,
      );
      assert(
        "1 display math",
        r.mathBlocks.displayMath.count === 1,
        `Got ${r.mathBlocks.displayMath.count}`,
      );
      assert(
        "1 block bracket",
        r.mathBlocks.blockBracket.count === 1,
        `Got ${r.mathBlocks.blockBracket.count}`,
      );
      assert(
        "1 inline paren",
        r.mathBlocks.inlineParen.count === 1,
        `Got ${r.mathBlocks.inlineParen.count}`,
      );
    }

    // ---- Test 11: Formatting detection ----
    console.log("\n11. Formatting detection");
    {
      const mmd =
        "**bold** text\n> blockquote\n~~struck~~\n\\underline{underlined}\n```js\ncode\n```";
      const r = analyser.analyse(mmd);
      assert(
        "Bold detected",
        r.formatting.bold.count >= 1,
        `Got ${r.formatting.bold.count}`,
      );
      assert(
        "Blockquote detected",
        r.formatting.blockquotes.count >= 1,
        `Got ${r.formatting.blockquotes.count}`,
      );
      assert(
        "Strikethrough detected",
        r.formatting.strikethrough.count >= 1,
        `Got ${r.formatting.strikethrough.count}`,
      );
      assert(
        "Underline detected",
        r.formatting.underline.count >= 1,
        `Got ${r.formatting.underline.count}`,
      );
      assert(
        "Code block detected",
        r.formatting.codeBlocks.count >= 1,
        `Got ${r.formatting.codeBlocks.count}`,
      );
    }

    // ---- Test 12: Metadata detection ----
    console.log("\n12. Metadata detection");
    {
      const mmd =
        "\\newtheorem{theorem}{Theorem}\n% This is a comment\n%% AI: uncertain about X\n\\pagebreak\n$a \\nonumber$";
      const r = analyser.analyse(mmd);
      assert(
        "Newtheorem detected",
        r.metadata.newtheorems.length === 1,
        `Got ${r.metadata.newtheorems.length}`,
      );
      assert(
        "Comments detected",
        r.metadata.comments.length >= 2,
        `Got ${r.metadata.comments.length}`,
      );
      const aiComment = r.metadata.comments.find((c) => c.isAIComment);
      assert("AI comment flagged", !!aiComment);
      assert(
        "Pagebreak detected",
        r.metadata.pageMarkers.length === 1,
        `Got ${r.metadata.pageMarkers.length}`,
      );
      assert(
        "\\nonumber detected",
        r.metadata.nonumbers.length === 1,
        `Got ${r.metadata.nonumbers.length}`,
      );
    }

    // ---- Test 13: Greek variant detection ----
    console.log("\n13. Greek variant detection");
    {
      const mmd =
        "We use $\\varepsilon > 0$ and $\\varphi$ throughout.\nAlso $\\epsilon$ appears once.";
      const r = analyser.analyse(mmd);
      const epsilonPair = r.greekVariants.find(
        (g) => g.variant === "\\varepsilon",
      );
      assert("Epsilon variant pair detected", !!epsilonPair);
      assert(
        "\\varepsilon count = 1",
        epsilonPair?.variantCount === 1,
        `Got ${epsilonPair?.variantCount}`,
      );
      assert(
        "\\epsilon count = 1",
        epsilonPair?.standardCount === 1,
        `Got ${epsilonPair?.standardCount}`,
      );
      const phiPair = r.greekVariants.find((g) => g.variant === "\\varphi");
      assert("Phi variant pair detected", !!phiPair);
    }

    // ---- Test 14: formatForPrompt output ----
    console.log("\n14. formatForPrompt output");
    {
      const mmd =
        "\\section*{Introduction}\n\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n\n![](img.png)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nTotal: $a \\leqslant b$";
      const r = analyser.analyse(mmd);
      const prompt = analyser.formatForPrompt(r);

      assert(
        "Prompt starts with STRUCTURAL INVENTORY",
        prompt.startsWith("STRUCTURAL INVENTORY"),
      );
      assert(
        "Prompt contains ENVIRONMENTS section",
        prompt.includes("ENVIRONMENTS"),
      );
      assert("Prompt contains LAYOUT section", prompt.includes("LAYOUT:"));
      assert("Prompt contains total lines", prompt.includes("total lines"));
      assert("Prompt contains ±5%", prompt.includes("±5%"));
      assert(
        "Prompt is concise (<3000 chars for small doc)",
        prompt.length < 3000,
        `Length: ${prompt.length}`,
      );
    }

    // ---- Test 15: formatForDisplay output ----
    console.log("\n15. formatForDisplay output");
    {
      const mmd = "\\begin{aligned}\nx = 1\n\\end{aligned}\n\n![alt](img.png)";
      const r = analyser.analyse(mmd);
      const display = analyser.formatForDisplay(r);

      assert(
        "Summary has totalLines",
        typeof display.summary.totalLines === "number",
      );
      assert(
        "Summary has environments.total",
        typeof display.summary.environments?.total === "number",
      );
      assert(
        "Summary has images.total",
        typeof display.summary.images?.total === "number",
      );
      assert("Details object present", !!display.details);
    }

    // ---- Test 16: LaTeX table detection via detectTables ----
    console.log("\n16. LaTeX table detection");
    {
      const mmd =
        "\\begin{tabular}{|l|c|r|}\n\\hline\nA & B & C \\\\\n\\hline\n1 & 2 & 3 \\\\\n\\hline\n\\end{tabular}";
      const r = analyser.analyse(mmd);
      const ltxTable = r.tables.find((t) => t.format === "latex_tabular");
      assert("LaTeX tabular table detected", !!ltxTable);
      assert(
        "LaTeX table columns = 3",
        ltxTable?.columns === 3,
        `Got ${ltxTable?.columns}`,
      );
      assert(
        "LaTeX table rows counted",
        ltxTable?.rows >= 2,
        `Got ${ltxTable?.rows}`,
      );
    }

    // ---- Test 17: Chemistry detection ----
    console.log("\n17. Chemistry detection");
    {
      const mmd = "<smiles>C(=O)O</smiles>\n```smiles\nCCO\n```\n$\\ce{H2O}$";
      const r = analyser.analyse(mmd);
      assert(
        "Three chemistry elements",
        r.chemistry.length === 3,
        `Got ${r.chemistry.length}`,
      );
    }

    // ---- Test 18: Reference detection ----
    console.log("\n18. Reference detection");
    {
      const mmd =
        "\\label{eq:main}\nSee \\eqref{eq:main} and \\ref{fig:1}.\n\\footnote{A footnote}.\n[Link](https://example.com)";
      const r = analyser.analyse(mmd);
      assert(
        "1 label detected",
        r.references.labels.length === 1,
        `Got ${r.references.labels.length}`,
      );
      assert(
        "2 refs detected",
        r.references.refs.length === 2,
        `Got ${r.references.refs.length}`,
      );
      assert(
        "1 footnote detected",
        r.references.footnotes.length === 1,
        `Got ${r.references.footnotes.length}`,
      );
      assert(
        "1 link detected",
        r.references.links.length === 1,
        `Got ${r.references.links.length}`,
      );
    }

    // ---- Test 19: \\le should not match inside \\leq ----
    console.log("\n19. Notation word boundary correctness");
    {
      const mmd = "$a \\leq b$ and $c \\leqslant d$";
      const r = analyser.analyse(mmd);
      const leForm = r.notationForms.find((n) => n.form === "\\le");
      // \\le should NOT match \\leq or \\leqslant
      assert(
        "\\le does not false-match \\leq",
        !leForm || leForm.count === 0,
        `Got count=${leForm?.count}`,
      );
      const leq = r.notationForms.find((n) => n.form === "\\leq");
      assert("\\leq detected", !!leq);
      const leqslant = r.notationForms.find((n) => n.form === "\\leqslant");
      assert("\\leqslant detected", !!leqslant);
    }

    // ---- Test 20: Performance check ----
    console.log("\n20. Performance check");
    {
      // Generate a ~5KB document
      const bigMmd = Array.from({ length: 200 }, (_, i) => {
        if (i % 20 === 0) return `\\section{Section ${i / 20 + 1}}`;
        if (i % 10 === 0) return "$$\nx = \\frac{1}{2}\n$$";
        return `Line ${i + 1}: $a_{${i}} \\leqslant b_{${i}}$`;
      }).join("\n");

      const start = performance.now();
      const r = analyser.analyse(bigMmd);
      const elapsed = performance.now() - start;

      assert(
        `Performance: ${elapsed.toFixed(1)}ms < 100ms`,
        elapsed < 100,
        `Took ${elapsed.toFixed(1)}ms`,
      );
      assert(
        "Large doc analysed successfully",
        r.layout.totalLines >= 200,
        `Got ${r.layout.totalLines} lines`,
      );
    }

    // ---- Summary ----
    const total = passed + failed;
    console.log(`\n=== Test Results: ${passed}/${total} passed ===`);
    if (failed > 0) {
      console.warn(`${failed} test(s) FAILED`);
    } else {
      console.log("All tests passed! ✓");
    }

    return { passed, failed, total, results };
  };

  logInfo("MathPixMMDAnalyser module loaded");
})();
