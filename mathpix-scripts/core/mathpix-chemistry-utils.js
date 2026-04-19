/**
 * @file mathpix-chemistry-utils.js
 * @description Shared chemistry utilities for MathPix integration.
 * Centralises SMILES extraction, InChI formula parsing, and accessibility formatting.
 *
 * @module MathPixChemistryUtils
 * @since 5.0.0 (Phase 5B-1)
 */
const MathPixChemistryUtils = (function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[ChemUtils]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ChemUtils]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ChemUtils]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ChemUtils]", message, ...args);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /** SMILES tag regex — captures attributes (group 1) and notation (group 2) */
  const SMILES_REGEX = /<smiles([^>]*)>(.*?)<\/smiles>/g;

  /** Formula element regex — e.g. "C24", "H", "N1" */
  const ELEMENT_REGEX = /([A-Z][a-z]?)(\d*)/g;

  /**
   * Extract surrounding text context for a SMILES tag.
   * Returns up to the last 5 words within 50 characters before the tag position.
   *
   * @param {string} text - Full text content
   * @param {number} position - Character index of the SMILES tag
   * @returns {string} Context text or "General chemistry"
   * @private
   */
  function extractContext(text, position) {
    const contextStart = Math.max(0, position - 50);
    const contextText = text.substring(contextStart, position).trim();

    const words = contextText.split(/\s+/);
    const contextWords = words.slice(-5).join(" ");

    return contextWords || "General chemistry";
  }

  /**
   * Extract caption context from a LaTeX figure block in PDF MMD.
   *
   * Scans outward from the SMILES tag position to find the enclosing
   * `\begin{figure}...\end{figure}` block, then extracts the `\caption{...}`
   * text within that block.
   *
   * @param {string} text - Full MMD text content
   * @param {number} smilesPosition - Character index of the `<smiles>` tag
   * @returns {string|null} Cleaned caption text, or null if no caption found
   * @private
   */
  function extractCaptionContext(text, smilesPosition) {
    // Find the enclosing \begin{figure}...\end{figure} block
    const beforeSmiles = text.substring(0, smilesPosition);
    const afterSmiles = text.substring(smilesPosition);

    const figBeginIdx = beforeSmiles.lastIndexOf("\\begin{figure}");
    if (figBeginIdx === -1) {
      logDebug("No \\begin{figure} found before SMILES position", {
        smilesPosition,
      });
      return null;
    }

    const figEndIdx = afterSmiles.indexOf("\\end{figure}");
    if (figEndIdx === -1) {
      logDebug("No \\end{figure} found after SMILES position", {
        smilesPosition,
      });
      return null;
    }

    // Extract the full figure block
    const figBlock = text.substring(
      figBeginIdx,
      smilesPosition + figEndIdx + "\\end{figure}".length,
    );

    // Find \caption{...} within the figure block, handling nested braces
    const captionStart = figBlock.indexOf("\\caption{");
    if (captionStart === -1) {
      logDebug("No \\caption found in figure block");
      return null;
    }

    // Extract caption content by counting brace depth
    const contentStart = captionStart + "\\caption{".length;
    let depth = 1;
    let i = contentStart;

    while (i < figBlock.length && depth > 0) {
      if (figBlock[i] === "{") depth++;
      else if (figBlock[i] === "}") depth--;
      i++;
    }

    if (depth !== 0) {
      logWarn("Unmatched braces in \\caption");
      return null;
    }

    // i now points one past the closing brace
    let caption = figBlock.substring(contentStart, i - 1).trim();

    if (!caption) {
      return null;
    }

    // Strip "Fig. N" or "Figure N" prefixes (with optional period/colon after number)
    caption = caption.replace(/^(?:Fig(?:ure)?\.?\s*\d+[.:,]?\s*)/i, "");

    // Strip \captionsetup{...} if embedded
    caption = caption.replace(/\\captionsetup\{[^}]*\}/g, "").trim();

    // Strip basic LaTeX commands but keep their text content
    caption = caption.replace(/\\textbf\{([^}]*)\}/g, "$1");
    caption = caption.replace(/\\textit\{([^}]*)\}/g, "$1");
    caption = caption.replace(/\\emph\{([^}]*)\}/g, "$1");

    caption = caption.trim();

    logDebug("Extracted caption context", { caption, smilesPosition });

    return caption || null;
  }

  /**
   * Parse InChI and InChI Key from a SMILES tag attribute string.
   *
   * @param {string} attributes - The attribute portion inside <smiles ...>
   * @returns {{ inchi: string|null, inchiKey: string|null }}
   * @private
   */
  function parseAttributes(attributes) {
    const inchiMatch = attributes.match(/inchi="([^"]*)"/);
    const inchiKeyMatch = attributes.match(/inchi_key="([^"]*)"/);
    return {
      inchi: inchiMatch ? inchiMatch[1] : null,
      inchiKey: inchiKeyMatch ? inchiKeyMatch[1] : null,
    };
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Extract chemistry (SMILES) data from a MathPix API response.
   *
   * Handles both `text` and `line_data` sources with attribute parsing
   * and deduplication. When the same SMILES notation appears in both
   * sources, confidence and lineId from `line_data` are merged into
   * the existing entry rather than creating a duplicate.
   *
   * @param {Object|null} apiResponse - MathPix API response object
   * @param {string} [apiResponse.text] - Response text potentially containing <smiles> tags
   * @param {Array} [apiResponse.line_data] - Line-level data with subtype annotations
   * @returns {Array<Object>} Array of extracted chemistry objects (empty if none found)
   */
  function extractChemistryFromResponse(apiResponse) {
    if (!apiResponse) {
      logDebug("No API response provided for chemistry extraction");
      return [];
    }

    const smilesArray = [];
    const text = apiResponse.text || "";

    // 1. Extract from response text
    let match;
    // Reset lastIndex in case regex was used before
    SMILES_REGEX.lastIndex = 0;

    while ((match = SMILES_REGEX.exec(text)) !== null) {
      const attributes = match[1] || "";
      const notation = match[2];
      const parsed = parseAttributes(attributes);

      // For MMD text (PDF mode), try caption extraction first
      const isMmd =
        text.includes("\\includegraphics") || text.includes("\\begin{figure}");
      let context = null;
      if (isMmd) {
        context = extractCaptionContext(text, match.index);
      }
      if (!context) {
        context = extractContext(text, match.index);
      }

      smilesArray.push({
        notation: notation,
        inchi: parsed.inchi,
        inchiKey: parsed.inchiKey,
        context: context,
        confidence: null,
        lineId: null,
      });
    }

    // 2. Extract from line_data with deduplication
    if (Array.isArray(apiResponse.line_data)) {
      apiResponse.line_data.forEach((line) => {
        if (
          line.subtype === "chemistry" ||
          line.subtype === "chemistry_reaction"
        ) {
          const lineMatch = /<smiles([^>]*)>(.*?)<\/smiles>/.exec(
            line.text || "",
          );
          if (lineMatch) {
            const lineNotation = lineMatch[2];
            const isDuplicate = smilesArray.some(
              (e) => e.notation === lineNotation,
            );

            if (!isDuplicate) {
              const lineParsed = parseAttributes(lineMatch[1] || "");

              smilesArray.push({
                notation: lineNotation,
                inchi: lineParsed.inchi,
                inchiKey: lineParsed.inchiKey,
                context: line.type || "General chemistry",
                confidence: line.confidence || null,
                lineId: line.id || null,
              });
            } else {
              // Enrich existing entry with line_data confidence/id
              const existing = smilesArray.find(
                (e) => e.notation === lineNotation,
              );
              if (existing && line.confidence !== undefined) {
                existing.confidence = line.confidence;
                existing.lineId = existing.lineId || line.id;
              }
            }
          }
        }
      });
    }

    logDebug("Chemistry extraction complete", {
      count: smilesArray.length,
      hasText: !!text,
      hasLineData: Array.isArray(apiResponse.line_data),
    });

    return smilesArray;
  }

  /**
   * Parse molecular formula from an InChI string.
   *
   * The formula layer sits between the first and second `/` in an InChI
   * string, after the version prefix (e.g. `1S`).
   *
   * @param {string|null} inchiString - Full InChI string
   * @returns {{ raw: string, elements: Object<string, number> }|null} Parsed formula or null
   *
   * @example
   * parseInChIFormula('InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3');
   * // → { raw: 'C2H6O', elements: { C: 2, H: 6, O: 1 } }
   */
  function parseInChIFormula(inchiString) {
    if (!inchiString || typeof inchiString !== "string") {
      return null;
    }

    // InChI format: InChI=<version>/<formula>/<connections>/...
    const parts = inchiString.split("/");
    if (parts.length < 2) {
      logWarn("Invalid InChI format — too few layers", { inchiString });
      return null;
    }

    const formulaRaw = parts[1];
    if (!formulaRaw || !/^[A-Z]/.test(formulaRaw)) {
      logWarn("Invalid InChI formula layer", { formulaRaw });
      return null;
    }

    // Parse element symbols and counts
    const elements = {};
    let elMatch;
    const elRegex = /([A-Z][a-z]?)(\d*)/g;

    while ((elMatch = elRegex.exec(formulaRaw)) !== null) {
      const symbol = elMatch[1];
      const count = elMatch[2] ? parseInt(elMatch[2], 10) : 1;
      if (symbol) {
        elements[symbol] = count;
      }
    }

    if (Object.keys(elements).length === 0) {
      logWarn("No elements parsed from formula", { formulaRaw });
      return null;
    }

    logDebug("InChI formula parsed", { raw: formulaRaw, elements });

    return {
      raw: formulaRaw,
      elements: elements,
    };
  }

  /**
   * Convert molecular formula to screen-reader-friendly text.
   *
   * Each element is spoken separately, with counts only when > 1.
   *
   * @param {string} formulaString - Molecular formula (e.g. "C24H21NO6")
   * @returns {string} Screen reader text (e.g. "C 24, H 21, N, O 6")
   *
   * @example
   * formatFormulaForScreenReader('H2O');
   * // → 'H 2, O'
   */
  function formatFormulaForScreenReader(formulaString) {
    if (!formulaString || typeof formulaString !== "string") {
      return "";
    }

    const parts = [];
    let elMatch;
    const elRegex = /([A-Z][a-z]?)(\d*)/g;

    while ((elMatch = elRegex.exec(formulaString)) !== null) {
      const symbol = elMatch[1];
      const count = elMatch[2] ? parseInt(elMatch[2], 10) : 0;
      if (symbol) {
        parts.push(count > 1 ? symbol + " " + count : symbol);
      }
    }

    return parts.join(", ");
  }

  /**
   * Convert molecular formula to subscripted HTML for visual display.
   *
   * Counts are rendered as `<sub>` elements; elements with count 1 have
   * no subscript.
   *
   * @param {string} formulaString - Molecular formula (e.g. "C2H6O")
   * @returns {string} HTML string (e.g. "C<sub>2</sub>H<sub>6</sub>O")
   *
   * @example
   * formatFormulaAsHTML('C2H6O');
   * // → 'C<sub>2</sub>H<sub>6</sub>O'
   */
  function formatFormulaAsHTML(formulaString) {
    if (!formulaString || typeof formulaString !== "string") {
      return "";
    }

    let html = "";
    let elMatch;
    const elRegex = /([A-Z][a-z]?)(\d*)/g;

    while ((elMatch = elRegex.exec(formulaString)) !== null) {
      const symbol = elMatch[1];
      const count = elMatch[2];
      if (symbol) {
        html += symbol;
        if (count) {
          html += "<sub>" + count + "</sub>";
        }
      }
    }

    return html;
  }

  // Phase 8C: Unicode subscript digits for formula display
  const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

  /**
   * Convert a raw formula string to Unicode subscript notation.
   * e.g. "C9H8O4" → "C₉H₈O₄"
   * Also shared with mathpix-chemistry-descriptions.js via _descriptionInternals.
   * @param {string} formulaString - Raw formula (e.g. "C9H8O4")
   * @returns {string} Unicode subscript version, or empty string
   * @private
   */
  function _formatFormulaUnicode(formulaString) {
    if (!formulaString || typeof formulaString !== "string") return "";
    return formulaString.replace(/\d/g, d => SUBSCRIPT_DIGITS[parseInt(d, 10)]);
  }

  /**
   * Build an accessible description string from available chemistry data.
   *
   * Suitable for use as `aria-label` or screen reader announcement.
   *
   * @param {Object} chemData - Chemistry data object
   * @param {string} chemData.notation - SMILES notation string
   * @param {string} [chemData.inchi] - InChI identifier
   * @param {string} [chemData.inchiKey] - InChI Key
   * @param {{ raw: string }} [chemData.formula] - Parsed formula (from parseInChIFormula)
   * @param {string} [chemData.iupacName] - IUPAC name (e.g. from PubChem)
   * @returns {string} Human-readable accessible description
   *
   * @example
   * generateBasicAccessibleDescription({
   *   notation: 'CCO',
   *   formula: { raw: 'C2H6O' },
   *   iupacName: 'ethanol',
   * });
   * // → 'Chemical structure: ethanol. Molecular formula: C 2, H 6, O. SMILES notation: CCO'
   */
  function generateBasicAccessibleDescription(chemData) {
    if (!chemData || !chemData.notation) {
      return "";
    }

    const parts = [];

    // Opening — with or without IUPAC name
    if (chemData.iupacName) {
      parts.push("Chemical structure: " + chemData.iupacName);
    } else {
      parts.push("Chemical structure");
    }

    // Molecular formula (screen reader format)
    if (chemData.formula && chemData.formula.raw) {
      const srFormula = formatFormulaForScreenReader(chemData.formula.raw);
      if (srFormula) {
        parts.push("Molecular formula: " + srFormula);
      }
    }

    // SMILES notation
    parts.push("SMILES notation: " + chemData.notation);

    return parts.join(". ");
  }

  // Track current rendering for theme-change re-render
  let currentRenderState = null;

  // Phase 7A-4: Molecular graph cache for structural descriptions (Map)
  // Replaces single-slot _cachedGraph/_cachedGraphSmiles with a bounded Map
  // so multiple structures keep their graphs when renderStructureToBlob()
  // is called for the MMD preview.
  /** @type {Map<string, Object>} SMILES → { graph, rings, ringConnections } */
  const _graphCache = new Map();
  /** @type {number} Maximum cache entries — prevents unbounded growth */
  const _GRAPH_CACHE_MAX = 20;

  /**
   * Add a molecular graph to the cache, evicting the oldest entry if at capacity.
   * @param {string} smiles - SMILES notation key
   * @param {Object} graphData - { graph, rings, ringConnections }
   * @private
   */
  function _cacheGraph(smiles, graphData) {
    if (_graphCache.size >= _GRAPH_CACHE_MAX) {
      // Evict oldest entry (first key in Map insertion order)
      const oldest = _graphCache.keys().next().value;
      _graphCache.delete(oldest);
    }
    _graphCache.set(smiles, graphData);
  }

  /**
   * Safely extract the molecular graph from a SmiDrawer instance after draw.
   * Returns null if internal structure is not as expected.
   *
   * @param {Object} smiDrawer - SmiDrawer instance after successful draw()
   * @returns {Object|null} { graph, rings, ringConnections } or null
   * @private
   */
  function _extractGraphFromDrawer(smiDrawer) {
    try {
      const pp = smiDrawer?.drawer?.preprocessor;
      if (!pp?.graph?.vertices || !pp?.graph?.edges) {
        logWarn("_extractGraphFromDrawer: graph structure not found");
        return null;
      }
      return {
        graph: pp.graph,
        rings: pp.rings || [],
        ringConnections: pp.ringConnections || [],
      };
    } catch (error) {
      logWarn("_extractGraphFromDrawer: extraction failed", {
        error: error.message,
      });
      return null;
    }
  }

  // Phase 7A: Feature flags
  const FEATURE_FLAGS = {
    STRUCTURAL_DESCRIPTIONS: true, // Set false to disable structural descriptions
    RENDERING_PRESETS: true,       // Phase 7C: Set false to use legacy hardcoded options
  };

  // =========================================================================
  // Phase 7C-1: Rendering options engine — helpers and central resolver
  // =========================================================================

  /**
   * Phase 7C-1: Read atom colours from CSS custom properties.
   * Returns null if CSS variables are not available.
   * @private
   */
  function _readColoursFromCSS() {
    const cssVar = (name) => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return val || null;
    };
    const C = cssVar("--chem-carbon");
    if (!C) return null;  // CSS not loaded
    return {
      C: C,
      // Phase 7C-3: explicit H colour prevents SmilesDrawer's dim fallback
      // for hydrogen labels (e.g. the H₃C subscripts on terminal carbons).
      // Falls back to the carbon colour when --chem-hydrogen is unset.
      H: cssVar("--chem-hydrogen") || C,
      O: cssVar("--chem-oxygen") || "#b71c1c",
      N: cssVar("--chem-nitrogen") || "#0d47a1",
      S: cssVar("--chem-sulphur") || "#7a5c00",
      F: cssVar("--chem-fluorine") || "#2e7d32",
      CL: cssVar("--chem-chlorine") || "#2e7d32",
      BR: cssVar("--chem-bromine") || "#8d6e63",
      I: cssVar("--chem-iodine") || "#6a1b9a",
      P: cssVar("--chem-phosphorus") || "#a63c00",
      BACKGROUND: cssVar("--chem-bg") || "#ffffff",
    };
  }

  /**
   * Phase 7C-1: Detect whether dark mode is active.
   * @returns {boolean}
   * @private
   */
  function _detectDarkMode() {
    const bgFromCSS = getComputedStyle(document.documentElement)
      .getPropertyValue("--chem-bg").trim();
    if (bgFromCSS) return bgFromCSS !== "#ffffff";
    return !!document.getElementById("darkCSS")?.href?.includes("dark.css");
  }

  /**
   * Phase 7C-1: Legacy drawer options fallback (pre-7C behaviour).
   * Used when FEATURE_FLAGS.RENDERING_PRESETS is false or config missing.
   * @private
   */
  function _legacyDrawerOptions(overrides = {}) {
    const isDark = _detectDarkMode();
    const fallbackLight = {
      C: "#111111", O: "#b71c1c", N: "#0d47a1", S: "#f9a825",
      F: "#2e7d32", CL: "#2e7d32", BR: "#8d6e63", I: "#6a1b9a",
      P: "#e65100", BACKGROUND: overrides.background || "#ffffff",
    };
    const fallbackDark = {
      C: "#e0e0e0", O: "#ef5350", N: "#64b5f6", S: "#fff176",
      F: "#81c784", CL: "#81c784", BR: "#bcaaa4", I: "#ce93d8",
      P: "#ffab91", BACKGROUND: overrides.background || "#1e1e1e",
    };

    const cssColours = _readColoursFromCSS();
    const themeColours = cssColours || (isDark ? fallbackDark : fallbackLight);

    return {
      width: overrides.width || 400,
      height: overrides.height || 300,
      bondThickness: 2.0,
      bondLength: 15,
      shortBondLength: 0.85,
      bondSpacing: 5.1,
      atomVisualization: "default",
      isomeric: true,
      debug: false,
      terminalCarbons: false,
      explicitHydrogens: false,
      overlapSensitivity: 0.42,
      overlapResolutionIterations: 1,
      compactDrawing: true,
      fontSizeLarge: 9,
      fontSizeSmall: 6,
      padding: 20,
      themes: {
        dark: themeColours,
        light: themeColours,
      },
    };
  }

  /**
   * Phase 7C-1: Build SmilesDrawer options from the active preset and current theme.
   * Central resolver — both renderStructure() and renderStructureToBlob() use this.
   *
   * @param {Object} overrides - Optional per-call overrides
   * @param {number} overrides.width - Canvas width
   * @param {number} overrides.height - Canvas height
   * @param {string} overrides.background - Background colour (for blob export)
   * @param {boolean} overrides.forExport - If true, use fixed light colours (ZIP export)
   * @returns {Object} Complete drawerOptions object for SmiDrawer constructor
   * @private
   */
  function getDrawerOptions(overrides = {}) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config || !FEATURE_FLAGS.RENDERING_PRESETS) {
      // Fallback: return legacy hardcoded options (pre-7C behaviour)
      return _legacyDrawerOptions(overrides);
    }

    // Read active preset from localStorage
    const presetName = localStorage.getItem(config.STORAGE_KEY) || config.DEFAULT_PRESET;

    // Phase 7C-3: when active preset is "custom", merge stored custom options
    // onto the skeletal defaults before applying any per-call overrides below
    let preset;
    let customOverrides = null;
    if (presetName === "custom") {
      const base = config.PRESETS[config.DEFAULT_PRESET];
      customOverrides = getCustomOptions();
      preset = { ...base, ...customOverrides };
    } else {
      preset = config.PRESETS[presetName] || config.PRESETS[config.DEFAULT_PRESET];
    }

    // Phase 7C-4: per-image override layer (highest precedence above preset/custom)
    // Phase 7C-5 fix: must happen BEFORE colourScheme resolution so per-image
    // colourScheme (explicit or defaulted to "element") wins over the global
    // preset's palette. Otherwise picking Textbook per-image over a monochrome
    // global leaves the monochrome palette locked in.
    if (
      overrides.perImageOptions &&
      typeof overrides.perImageOptions === "object"
    ) {
      preset = { ...preset, ...overrides.perImageOptions };
    }

    // Determine colour scheme (custom or per-image may override via colourScheme key)
    const colourScheme = preset.colourScheme || "element";

    // Determine theme (light/dark)
    let themeColours;
    if (overrides.forExport) {
      // ZIP export always uses light palette
      themeColours = config.COLOUR_PALETTES[colourScheme]?.light
        || config.COLOUR_PALETTES.element.light;
    } else {
      // On-screen: read from CSS vars or detect theme
      const cssColours = _readColoursFromCSS();
      if (cssColours && colourScheme === "element") {
        // CSS variables override element palette (theme-aware)
        themeColours = cssColours;
      } else {
        // Use config palette for non-element schemes or when CSS unavailable
        const isDark = _detectDarkMode();
        const themeKey = isDark ? "dark" : "light";
        themeColours = config.COLOUR_PALETTES[colourScheme]?.[themeKey]
          || config.COLOUR_PALETTES.element[themeKey];
      }
    }

    // Apply background override if provided (for blob export)
    if (overrides.background) {
      themeColours = { ...themeColours, BACKGROUND: overrides.background };
    }

    return {
      width: overrides.width || 400,
      height: overrides.height || 300,
      bondThickness: preset.bondThickness,
      bondLength: preset.bondLength,
      shortBondLength: preset.shortBondLength,
      bondSpacing: preset.bondSpacing,
      atomVisualization: preset.atomVisualization,
      isomeric: true,
      debug: false,
      terminalCarbons: preset.terminalCarbons,
      explicitHydrogens: preset.explicitHydrogens,
      overlapSensitivity: preset.overlapSensitivity,
      overlapResolutionIterations: 1,
      compactDrawing: preset.compactDrawing,
      fontSizeLarge: preset.fontSizeLarge,
      fontSizeSmall: preset.fontSizeSmall,
      padding: preset.padding,
      themes: {
        dark: themeColours,
        light: themeColours,
      },
    };
  }

  /**
   * Phase 7C-1: Get the active rendering preset name.
   * @returns {string} Preset name (e.g. "skeletal", "textbook")
   */
  function getActivePreset() {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config) return "skeletal";
    return localStorage.getItem(config.STORAGE_KEY) || config.DEFAULT_PRESET;
  }

  /**
   * Phase 7C-1: Set the active rendering preset.
   * Does NOT re-render — caller should trigger re-render if needed.
   * @param {string} presetName - One of: "skeletal", "textbook", "monochrome", "high-contrast"
   * @returns {boolean} True if preset was valid and saved
   */
  function setActivePreset(presetName) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config) return false;
    // Phase 7C-3: accept "custom" as a special case
    if (presetName !== "custom" && !config.PRESETS[presetName]) {
      logWarn("setActivePreset: unknown preset", { presetName });
      return false;
    }
    localStorage.setItem(config.STORAGE_KEY, presetName);
    logInfo("Active chemistry preset changed", { presetName });
    return true;
  }

  /**
   * Phase 7C-3: Persist user-supplied custom rendering option overrides.
   * These are merged on top of the skeletal preset whenever the active
   * preset is "custom". Safe to call with an empty object.
   * @param {Object} optionsObj - Partial SmilesDrawer options to store
   * @returns {boolean} True if stored (or silently ignored when storage unavailable)
   */
  function setCustomOptions(optionsObj) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config || !config.CUSTOM_STORAGE_KEY) return false;
    try {
      const safe = optionsObj && typeof optionsObj === "object" ? optionsObj : {};
      localStorage.setItem(config.CUSTOM_STORAGE_KEY, JSON.stringify(safe));
      logDebug("Custom chemistry options saved", { keys: Object.keys(safe) });
      return true;
    } catch (err) {
      logWarn("setCustomOptions: failed to persist", { error: err.message });
      return false;
    }
  }

  /**
   * Phase 7C-3: Retrieve stored custom rendering options, if any.
   * @returns {Object} Stored options object, or empty object when none set
   */
  function getCustomOptions() {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config || !config.CUSTOM_STORAGE_KEY) return {};
    try {
      const raw = localStorage.getItem(config.CUSTOM_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      logWarn("getCustomOptions: failed to read", { error: err.message });
      return {};
    }
  }

  // =========================================================================
  // Phase 7C-6: Chemistry settings manifest reader
  // =========================================================================

  /**
   * Read and validate the chemistry-settings.json manifest from a loaded ZIP.
   *
   * Returns the parsed manifest object when present and valid. Returns null
   * softly (no throw) for every failure mode: missing file (legacy ZIP),
   * unparseable JSON, or unsupported schemaVersion. Callers can treat a null
   * return as "no per-image settings to restore" and carry on.
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object|null>} Parsed manifest, or null on any failure
   */
  async function readChemistrySettingsFromZip(zip) {
    if (!zip || typeof zip.file !== "function") {
      logWarn("readChemistrySettingsFromZip: invalid zip argument");
      return null;
    }

    const entry = zip.file("data/chemistry-settings.json");
    if (!entry) {
      logDebug(
        "readChemistrySettingsFromZip: no chemistry-settings.json in archive",
      );
      return null;
    }

    let raw;
    try {
      raw = await entry.async("string");
    } catch (err) {
      logWarn("readChemistrySettingsFromZip: failed to read entry", {
        error: err.message,
      });
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      logWarn("readChemistrySettingsFromZip: corrupt JSON", {
        error: err.message,
      });
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      logWarn("readChemistrySettingsFromZip: manifest is not an object");
      return null;
    }

    if (parsed.schemaVersion !== 1) {
      logWarn("Unsupported chemistry-settings schemaVersion", {
        got: parsed.schemaVersion,
        expected: 1,
      });
      return null;
    }

    logInfo("readChemistrySettingsFromZip: manifest loaded", {
      globalPreset: parsed.globalPreset,
      perImageCount: Array.isArray(parsed.perImageOverrides)
        ? parsed.perImageOverrides.length
        : 0,
    });
    return parsed;
  }

  // =========================================================================
  // Phase 5C-2: Structure rendering
  // =========================================================================

  /**
   * Render a SMILES structure onto a canvas element using SmilesDrawer.
   *
   * @param {string} smiles - SMILES notation string
   * @param {HTMLCanvasElement} canvasElement - Target canvas
   * @param {Object} [options] - Rendering options
   * @param {string} [options.theme] - 'light' or 'dark' (auto-detected if omitted)
   * @returns {boolean} true if rendering succeeded, false otherwise
   */
  function renderStructure(smiles, canvasElement, options = {}) {
    if (!smiles || !canvasElement) {
      logWarn("renderStructure: missing smiles or canvas element");
      return false;
    }

    if (typeof window.SmilesDrawer === "undefined") {
      logWarn("SmilesDrawer not available — cannot render structure");
      return false;
    }

    try {
      // Save state so theme observer can re-render with new colours
      currentRenderState = { smiles, canvasElement };

      // Phase 7C-1: centralised options via getDrawerOptions()
      // Phase 7C-4: plumb per-image overrides if provided
      const drawerOptions = getDrawerOptions({
        width: canvasElement.width || 400,
        height: canvasElement.height || 300,
        perImageOptions: options.perImageOptions || null,
      });

      // SmiDrawer.draw() expects a CSS selector string, not a DOM element
      const canvasSelector = canvasElement.id ? "#" + canvasElement.id : null;

      if (!canvasSelector) {
        logWarn("renderStructure: canvas element must have an id attribute");
        return false;
      }

      const drawer = new window.SmilesDrawer.SmiDrawer(drawerOptions);
      // draw() is async — signature: draw(smiles, selector, theme, successCallback)
      // The canvas stays transparent — the figure's CSS background (via --chem-bg)
      // provides the theme-aware background colour behind the molecule.
      drawer.draw(
        smiles,
        canvasSelector,
        "light",
        () => {
          logInfo("Structure rendered successfully", { smiles });
          // Phase 7A-4: cache molecular graph in Map for structural descriptions
          const extracted = _extractGraphFromDrawer(drawer);
          if (extracted) {
            _cacheGraph(smiles, extracted);
            logDebug("Molecular graph cached for structural description", {
              smiles,
            });
          }
          // Phase 7A: notify caller that the graph is ready
          if (typeof options.onGraphReady === "function") {
            options.onGraphReady(smiles);
          }
        },
      );

      // draw() initiated — rendering completes asynchronously via callback
      return true;
    } catch (error) {
      logWarn("Failed to render SMILES structure", {
        smiles,
        error: error.message,
      });

      // Draw fallback text on canvas
      try {
        const ctx = canvasElement.getContext("2d");
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
          "Structure could not be rendered",
          canvasElement.width / 2,
          canvasElement.height / 2 - 10,
        );
        ctx.font = "12px monospace";
        ctx.fillText(
          smiles,
          canvasElement.width / 2,
          canvasElement.height / 2 + 15,
        );
      } catch (canvasError) {
        logWarn("Canvas fallback also failed", {
          error: canvasError.message,
        });
      }

      return false;
    }
  }

  // =========================================================================
  // Phase 6G: Offscreen rendering to Blob (for ZIP image replacement)
  // =========================================================================

  /**
   * Render a SMILES structure to an offscreen canvas and return a PNG Blob.
   *
   * Unlike renderStructure(), this method:
   * - Creates a temporary canvas (not visible, removed after rendering)
   * - Uses fixed light-mode colours for consistent output regardless of theme
   * - Higher resolution with DPI scaling for crisp ZIP images
   * - Returns a Promise<Blob> (PNG) or null on failure
   *
   * @param {string} smiles - SMILES notation string
   * @param {Object} [options] - Rendering options
   * @param {number} [options.width=800] - Canvas width in pixels
   * @param {number} [options.height=600] - Canvas height in pixels
   * @param {string} [options.background='#ffffff'] - Background colour
   * @param {Object} [options.perImageOptions=null] - Phase 7C-5: per-image overrides
   *        merged on top of the active preset/custom layer before the final render.
   *        Pass null/omit to use the active global preset only.
   * @returns {Promise<Blob|null>} PNG blob, or null if rendering fails
   */
  async function renderStructureToBlob(smiles, options = {}) {
    if (!smiles || typeof smiles !== "string") {
      logWarn("renderStructureToBlob: missing or invalid SMILES");
      return null;
    }

    if (typeof window.SmilesDrawer === "undefined") {
      logWarn("renderStructureToBlob: SmilesDrawer not available");
      return null;
    }

    const width = options.width || 800;
    const height = options.height || 600;
    const background = options.background || "#ffffff";

    // Create a temporary offscreen canvas.
    // SmiDrawer.draw() requires a CSS selector for a canvas in the DOM.
    // Use opacity:0 + fixed positioning to keep it in the render tree
    // (visibility:hidden and left:-9999px can cause SmilesDrawer layout issues).
    // CRITICAL: Set explicit CSS dimensions to match the bitmap — SmilesDrawer
    // reads clientWidth/clientHeight for layout, and without explicit CSS sizing
    // the canvas defaults to 300x150 CSS pixels regardless of bitmap resolution.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const tempId = "chem-offscreen-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    canvas.id = tempId;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.opacity = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "-1";
    document.body.appendChild(canvas);

    try {
      // Phase 7C-1: centralised options via getDrawerOptions()
      // Phase 7C-5: forward per-image overrides
      const drawerOptions = getDrawerOptions({
        width: width,
        height: height,
        background: background,
        forExport: true,
        perImageOptions: options.perImageOptions || null,
      });

      const drawer = new window.SmilesDrawer.SmiDrawer(drawerOptions);

      // Wait for SmiDrawer.draw() to complete via its callback.
      // SmilesDrawer logs parse errors but doesn't throw — so we track
      // whether the success callback actually fires to detect invalid SMILES.
      let renderSucceeded = false;

      await new Promise((resolve) => {
        try {
          drawer.draw(
            smiles,
            "#" + tempId,
            "light",
            () => {
              renderSucceeded = true;
              logDebug("renderStructureToBlob: render complete", { smiles });
              // Phase 7A-4: cache molecular graph in Map for structural descriptions
              const extracted = _extractGraphFromDrawer(drawer);
              if (extracted) {
                _cacheGraph(smiles, extracted);
              }
              resolve();
            },
          );
          // Safety timeout — callback may never fire for invalid SMILES
          setTimeout(() => resolve(), 1500);
        } catch (drawError) {
          logWarn("renderStructureToBlob: SmilesDrawer threw", {
            error: drawError.message,
          });
          resolve();
        }
      });

      if (!renderSucceeded) {
        logWarn(
          "renderStructureToBlob: render callback did not fire — SMILES may be invalid",
          { smiles },
        );
        return null;
      }

      // Wait for the browser to actually paint the canvas pixels.
      // SmilesDrawer may use requestAnimationFrame internally — a double-rAF
      // guarantees at least one full frame has been composited before we read.
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );

      // Verify the canvas has non-background content (not blank)
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const sampleData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hasContent = false;
      // Check a sample of pixels for non-transparent, non-white content
      for (let px = 0; px < sampleData.length; px += 40) {
        const r = sampleData[px];
        const g = sampleData[px + 1];
        const b = sampleData[px + 2];
        const a = sampleData[px + 3];
        // Check for any pixel that isn't fully transparent or fully white
        if (a > 0 && (r < 250 || g < 250 || b < 250)) {
          hasContent = true;
          break;
        }
      }

      if (!hasContent) {
        logWarn("renderStructureToBlob: canvas appears blank after rendering", {
          smiles,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        });
        return null;
      }

      // Fill white background behind the molecule.
      // SmilesDrawer clears any pre-fill and renders on transparent canvas.
      // Canvas compositing (destinationOver) interacts badly with SmilesDrawer's
      // canvas state, so we directly replace transparent pixels in the image data.
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) {
          pixels[i] = 255;       // R
          pixels[i + 1] = 255;   // G
          pixels[i + 2] = 255;   // B
          pixels[i + 3] = 255;   // A
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Convert canvas to PNG blob
      const blob = await new Promise((resolve) => {
        canvas.toBlob(
          (b) => resolve(b),
          "image/png",
        );
      });

      if (!blob || blob.size === 0) {
        logWarn("renderStructureToBlob: canvas.toBlob returned empty result");
        return null;
      }

      logInfo("renderStructureToBlob: success", {
        smiles: smiles.substring(0, 30),
        blobSize: blob.size,
        dimensions: `${canvas.width}x${canvas.height}`,
      });

      return blob;
    } catch (error) {
      logWarn("renderStructureToBlob: failed", {
        smiles,
        error: error.message,
      });
      return null;
    } finally {
      // Always clean up — remove the temporary canvas from the DOM
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  // =========================================================================
  // Theme change observer — re-render canvas when stylesheet swaps
  // =========================================================================

  (function initThemeObserver() {
    const darkLink = document.getElementById("darkCSS");
    if (!darkLink) {
      logInfo("No darkCSS link element found — theme observer not started");
      return;
    }

    const observer = new MutationObserver(() => {
      if (currentRenderState) {
        logInfo("Theme change detected — re-rendering chemistry structure");
        // Small delay to let new stylesheet load and apply
        setTimeout(() => {
          renderStructure(
            currentRenderState.smiles,
            currentRenderState.canvasElement
          );
        }, 100);
      }
    });

    observer.observe(darkLink, { attributes: true, attributeFilter: ["href"] });
    logInfo("Chemistry theme observer started");
  })();

  // =========================================================================
  // Phase 5D-1: PubChem PUG REST API client
  // =========================================================================

  const _pubchemCache = new Map();
  let _lastPubchemRequest = 0;
  const PUBCHEM_MIN_GAP_MS = 250; // Max ~4 requests/second (PubChem limit is 5/s)
  const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

  /**
   * Look up a compound on PubChem by InChI Key.
   * Returns IUPAC name, common names, molecular weight, and PubChem CID.
   *
   * @param {string} inchiKey - InChI Key identifier (e.g. "RYYVLZVUVIJVGH-UHFFFAOYSA-N")
   * @returns {Promise<Object>} Lookup result:
   *   { found: boolean, iupacName: string|null, commonNames: string[],
   *     molecularWeight: number|null, molecularFormula: string|null,
   *     pubchemCid: number|null, pubchemUrl: string|null }
   */
  async function lookupPubChem(inchiKey) {
    if (!inchiKey) {
      logWarn("lookupPubChem: no InChI Key provided");
      return {
        found: false,
        iupacName: null,
        commonNames: [],
        molecularWeight: null,
        molecularFormula: null,
        pubchemCid: null,
        pubchemUrl: null,
      };
    }

    // Check cache first
    if (_pubchemCache.has(inchiKey)) {
      logDebug("PubChem cache hit", { inchiKey });
      return _pubchemCache.get(inchiKey);
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLast = now - _lastPubchemRequest;
    if (timeSinceLast < PUBCHEM_MIN_GAP_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, PUBCHEM_MIN_GAP_MS - timeSinceLast),
      );
    }
    _lastPubchemRequest = Date.now();

    const emptyResult = {
      found: false,
      iupacName: null,
      commonNames: [],
      molecularWeight: null,
      molecularFormula: null,
      pubchemCid: null,
      pubchemUrl: null,
    };

    try {
      // Fetch properties (IUPAC name, formula, weight, CID)
      const propsUrl = `${PUBCHEM_BASE}/compound/inchikey/${encodeURIComponent(inchiKey)}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`;

      logDebug("PubChem property lookup", { inchiKey, url: propsUrl });

      const propsResponse = await fetch(propsUrl);

      if (!propsResponse.ok) {
        if (propsResponse.status === 404) {
          logInfo("Compound not found in PubChem", { inchiKey });
          _pubchemCache.set(inchiKey, emptyResult);
          return emptyResult;
        }
        throw new Error(
          `PubChem API error: ${propsResponse.status} ${propsResponse.statusText}`,
        );
      }

      const propsData = await propsResponse.json();
      const props = propsData?.PropertyTable?.Properties?.[0];

      if (!props) {
        logWarn("PubChem returned empty properties", { inchiKey });
        _pubchemCache.set(inchiKey, emptyResult);
        return emptyResult;
      }

      const cid = props.CID;

      // Fetch synonyms (common names) — separate request with rate limiting
      let commonNames = [];
      try {
        await new Promise((resolve) => setTimeout(resolve, PUBCHEM_MIN_GAP_MS));
        _lastPubchemRequest = Date.now();

        const synUrl = `${PUBCHEM_BASE}/compound/cid/${cid}/synonyms/JSON`;
        const synResponse = await fetch(synUrl);

        if (synResponse.ok) {
          const synData = await synResponse.json();
          const synonyms =
            synData?.InformationList?.Information?.[0]?.Synonym || [];
          // Take first 5 human-readable synonyms:
          // - Skip exact IUPAC name match
          // - Skip CAS-style numbers (digits-digits-digit)
          // - Skip registry/catalogue IDs (mostly digits, hyphens, slashes)
          const iupacLower = props.IUPACName?.toLowerCase();
          commonNames = synonyms
            .filter((s) => {
              if (s.toLowerCase() === iupacLower) return false;
              // CAS numbers: e.g. "149-95-1", "51-41-2"
              if (/^\d[\d-]+\d$/.test(s)) return false;
              // EINECS/registry numbers: mostly digits with separators
              if (/^\d{3,}/.test(s) && /^[\d\s./-]+$/.test(s)) return false;
              return true;
            })
            .slice(0, 5);
        }
      } catch (synError) {
        logWarn("PubChem synonym lookup failed (non-critical)", {
          cid,
          error: synError.message,
        });
        // Continue without synonyms — this is non-critical
      }

      const result = {
        found: true,
        iupacName: props.IUPACName || null,
        commonNames,
        molecularWeight: props.MolecularWeight
          ? parseFloat(props.MolecularWeight)
          : null,
        molecularFormula: props.MolecularFormula || null,
        pubchemCid: cid,
        pubchemUrl: cid
          ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
          : null,
      };

      _pubchemCache.set(inchiKey, result);

      logInfo("PubChem lookup successful", {
        inchiKey,
        iupacName: result.iupacName,
        commonNameCount: result.commonNames.length,
        cid,
      });

      return result;
    } catch (error) {
      logWarn("PubChem lookup failed", {
        inchiKey,
        error: error.message,
      });

      // Don't cache errors — allow retry
      return emptyResult;
    }
  }

  /**
   * Look up a compound on PubChem by SMILES notation.
   * Returns the same fields as lookupPubChem() plus InChI and InChI Key,
   * enabling back-population of chemistry data for PDF-mode compounds.
   *
   * Uses GET with URL-encoded SMILES, falling back to POST for complex
   * SMILES that break URL encoding (e.g. containing backslashes or hashes).
   *
   * @param {string} smiles - SMILES notation (e.g. "CC(=O)Oc1ccccc1C(=O)O")
   * @returns {Promise<Object>} Lookup result:
   *   { found: boolean, iupacName: string|null, commonNames: string[],
   *     molecularWeight: number|null, molecularFormula: string|null,
   *     pubchemCid: number|null, pubchemUrl: string|null,
   *     inchi: string|null, inchiKey: string|null }
   */
  async function lookupPubChemBySmiles(smiles) {
    if (!smiles || typeof smiles !== "string" || !smiles.trim()) {
      logWarn("lookupPubChemBySmiles: no SMILES provided");
      return {
        found: false,
        iupacName: null,
        commonNames: [],
        molecularWeight: null,
        molecularFormula: null,
        pubchemCid: null,
        pubchemUrl: null,
        inchi: null,
        inchiKey: null,
      };
    }

    const trimmed = smiles.trim();

    // Check cache first (prefixed to avoid collisions with InChI Key entries)
    const cacheKey = `smiles:${trimmed}`;
    if (_pubchemCache.has(cacheKey)) {
      logDebug("PubChem SMILES cache hit", { smiles: trimmed });
      return _pubchemCache.get(cacheKey);
    }

    // Rate limiting (shared with lookupPubChem)
    const now = Date.now();
    const timeSinceLast = now - _lastPubchemRequest;
    if (timeSinceLast < PUBCHEM_MIN_GAP_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, PUBCHEM_MIN_GAP_MS - timeSinceLast),
      );
    }
    _lastPubchemRequest = Date.now();

    const emptyResult = {
      found: false,
      iupacName: null,
      commonNames: [],
      molecularWeight: null,
      molecularFormula: null,
      pubchemCid: null,
      pubchemUrl: null,
      inchi: null,
      inchiKey: null,
    };

    const propertyList =
      "IUPACName,MolecularFormula,MolecularWeight,InChI,InChIKey";

    try {
      // Attempt GET first with URL-encoded SMILES
      const getUrl = `${PUBCHEM_BASE}/compound/smiles/${encodeURIComponent(trimmed)}/property/${propertyList}/JSON`;

      logDebug("PubChem SMILES property lookup (GET)", {
        smiles: trimmed,
        url: getUrl,
      });

      let propsResponse = await fetch(getUrl);

      // POST fallback for complex SMILES that break URL encoding
      if (propsResponse.status === 400) {
        logInfo(
          "PubChem GET failed for complex SMILES, retrying with POST",
          { smiles: trimmed },
        );

        const postUrl = `${PUBCHEM_BASE}/compound/smiles/property/${propertyList}/JSON`;
        propsResponse = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `smiles=${encodeURIComponent(trimmed)}`,
        });
      }

      if (!propsResponse.ok) {
        if (propsResponse.status === 404) {
          logInfo("Compound not found in PubChem by SMILES", {
            smiles: trimmed,
          });
          _pubchemCache.set(cacheKey, emptyResult);
          return emptyResult;
        }
        throw new Error(
          `PubChem API error: ${propsResponse.status} ${propsResponse.statusText}`,
        );
      }

      const propsData = await propsResponse.json();
      const props = propsData?.PropertyTable?.Properties?.[0];

      if (!props) {
        logWarn("PubChem returned empty properties for SMILES", {
          smiles: trimmed,
        });
        _pubchemCache.set(cacheKey, emptyResult);
        return emptyResult;
      }

      const cid = props.CID;

      // Fetch synonyms (common names) — separate request with rate limiting
      let commonNames = [];
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, PUBCHEM_MIN_GAP_MS),
        );
        _lastPubchemRequest = Date.now();

        const synUrl = `${PUBCHEM_BASE}/compound/cid/${cid}/synonyms/JSON`;
        const synResponse = await fetch(synUrl);

        if (synResponse.ok) {
          const synData = await synResponse.json();
          const synonyms =
            synData?.InformationList?.Information?.[0]?.Synonym || [];
          // Take first 5 human-readable synonyms:
          // - Skip exact IUPAC name match
          // - Skip CAS-style numbers (digits-digits-digit)
          // - Skip registry/catalogue IDs (mostly digits, hyphens, slashes)
          const iupacLower = props.IUPACName?.toLowerCase();
          commonNames = synonyms
            .filter((s) => {
              if (s.toLowerCase() === iupacLower) return false;
              if (/^\d[\d-]+\d$/.test(s)) return false;
              if (/^\d{3,}/.test(s) && /^[\d\s./-]+$/.test(s)) return false;
              return true;
            })
            .slice(0, 5);
        }
      } catch (synError) {
        logWarn("PubChem synonym lookup failed (non-critical)", {
          cid,
          error: synError.message,
        });
        // Continue without synonyms — this is non-critical
      }

      const result = {
        found: true,
        iupacName: props.IUPACName || null,
        commonNames,
        molecularWeight: props.MolecularWeight
          ? parseFloat(props.MolecularWeight)
          : null,
        molecularFormula: props.MolecularFormula || null,
        pubchemCid: cid,
        pubchemUrl: cid
          ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
          : null,
        inchi: props.InChI || null,
        inchiKey: props.InChIKey || null,
      };

      _pubchemCache.set(cacheKey, result);

      logInfo("PubChem SMILES lookup successful", {
        smiles: trimmed,
        iupacName: result.iupacName,
        commonNameCount: result.commonNames.length,
        cid,
        hasInChI: !!result.inchi,
        hasInChIKey: !!result.inchiKey,
      });

      return result;
    } catch (error) {
      logWarn("PubChem SMILES lookup failed", {
        smiles: trimmed,
        error: error.message,
      });

      // Don't cache errors — allow retry
      return emptyResult;
    }
  }

  /**
   * Build a direct URL to a PubChem compound page.
   *
   * @param {string} inchiKey - InChI Key identifier
   * @returns {string} URL to PubChem search page
   */
  function buildPubChemUrl(inchiKey) {
    if (!inchiKey) return "";
    return `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(inchiKey)}`;
  }

  /**
   * Clear the PubChem session cache.
   * Useful when user wants to force a fresh lookup.
   */
  function clearPubChemCache() {
    const size = _pubchemCache.size;
    _pubchemCache.clear();
    logInfo("PubChem cache cleared", { entriesRemoved: size });
  }

  // =========================================================================
  // Phase 5E-1: AI description service
  // =========================================================================

  let _descriptionService = null;

  /** System prompt for chemistry structure descriptions */
  const CHEMISTRY_SYSTEM_PROMPT = [
    "You are a chemistry accessibility assistant.",
    "Describe chemical structures in plain language for screen reader users.",
    "Be concise (under 100 words).",
    "Include: functional groups, ring systems, structure type, and notable features.",
    "Use plain language suitable for a chemistry student.",
    "Do NOT include the SMILES notation or InChI in your description.",
    "Do NOT start with 'This molecule' — start with the compound name if known.",
    "Do NOT use markdown formatting — output plain text only.",
  ].join(" ");

  /**
   * Get or create the chemistry description service.
   * Lazy-initialised on first use.
   *
   * @returns {Object} Service with describe() and clearCache() methods
   */
  function getDescriptionService() {
    if (_descriptionService) return _descriptionService;

    const descriptionCache = new Map();

    _descriptionService = {
      /**
       * Generate an accessible plain-language description of a chemical structure.
       *
       * @param {Object} chemData - Chemistry data
       * @param {string} chemData.notation - SMILES notation
       * @param {string} [chemData.formula] - Molecular formula string
       * @param {string} [chemData.iupacName] - IUPAC name (from PubChem)
       * @param {string[]} [chemData.commonNames] - Common names (from PubChem)
       * @returns {Promise<string>} Plain-language description
       */
      async describe(chemData) {
        if (!chemData?.notation) {
          return "No chemical structure data available.";
        }

        // Check cache
        if (descriptionCache.has(chemData.notation)) {
          logDebug("Chemistry description cache hit", {
            notation: chemData.notation,
          });
          return descriptionCache.get(chemData.notation);
        }

        // Check OpenRouter Embed availability
        if (typeof window.OpenRouterEmbed === "undefined") {
          logWarn("OpenRouterEmbed not available for chemistry descriptions");
          return "AI description not available — OpenRouter Embed not loaded.";
        }

        // Check API key
        const apiKey = localStorage.getItem("openrouter_api_key");
        if (!apiKey) {
          return "AI description not available — please set your OpenRouter API key in the OpenRouter AI tool.";
        }

        // Lazy-create embed instance (system prompt set via constructor)
        if (!this._embed) {
          this._embed = new window.OpenRouterEmbed({
            apiKey: apiKey,
            model: "anthropic/claude-haiku-4.5",
            maxTokens: 400,
            temperature: 0.3,
            systemPrompt: CHEMISTRY_SYSTEM_PROMPT,
            containerId: "chemistry-ai-output",
            showNotifications: false,
          });
        }

        // Build the user prompt
        const formulaInfo = chemData.formula
          ? `Molecular formula: ${chemData.formula}`
          : "";
        const nameInfo = chemData.iupacName
          ? `IUPAC name: ${chemData.iupacName}`
          : "";
        const commonInfo = chemData.commonNames?.length
          ? `Common names: ${chemData.commonNames.join(", ")}`
          : "";

        const userPrompt = [
          "Describe this chemical structure for a screen reader user who cannot see the structural diagram.",
          "",
          chemData.notation ? `SMILES: ${chemData.notation}` : "",
          formulaInfo,
          nameInfo,
          commonInfo,
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const result = await this._embed.sendRequest(userPrompt);

          const description =
            result?.text ||
            result?.content ||
            "Description could not be generated.";
          descriptionCache.set(chemData.notation, description);

          logInfo("Chemistry AI description generated", {
            notation: chemData.notation,
            descriptionLength: description.length,
          });

          return description;
        } catch (error) {
          logWarn("Chemistry AI description failed", {
            error: error.message,
          });
          return `Description could not be generated: ${error.message}`;
        }
      },

      /**
       * Clear the description cache.
       */
      clearCache() {
        descriptionCache.clear();
        logInfo("Chemistry description cache cleared");
      },

      /** @private */
      _embed: null,
    };

    return _descriptionService;
  }

  // =========================================================================
  // Expose public API
  // =========================================================================

  logInfo(
    "MathPixChemistryUtils initialised (Phase 5B-1 + 5C-2 + 5D-1 + 5E-1 + 6A + 6C + 6G + 7A + 7A-2 + 8C — descriptions in separate file)",
  );

  return {
    extractChemistryFromResponse,
    extractContext,
    extractCaptionContext, // Phase 6C
    parseInChIFormula,
    formatFormulaForScreenReader,
    formatFormulaAsHTML,
    generateBasicAccessibleDescription,
    renderStructure, // Phase 5C-2
    renderStructureToBlob, // Phase 6G
    lookupPubChem, // Phase 5D-1
    lookupPubChemBySmiles, // Phase 6A
    buildPubChemUrl, // Phase 5D-1
    clearPubChemCache, // Phase 5D-1
    getDescriptionService, // Phase 5E-1
    analyseStructure: null, // Phase 7A — populated by mathpix-chemistry-descriptions.js
    generateStructuralDescription: null, // Phase 7A-2 — populated by mathpix-chemistry-descriptions.js
    generateStructuralDescriptionForAria: null, // Phase 8C-6 — populated by mathpix-chemistry-descriptions.js
    generateShortDescription: null, // Phase 8C-ST — populated by mathpix-chemistry-descriptions.js
    generateShortDescriptionForAria: null, // Phase 8C-ST — populated by mathpix-chemistry-descriptions.js
    clearGraphCache: function () { _graphCache.clear(); }, // Phase 7A-4 (testing)
    getActivePreset, // Phase 7C-1
    setActivePreset, // Phase 7C-1
    getDrawerOptions, // Phase 7C-1
    setCustomOptions, // Phase 7C-3
    getCustomOptions, // Phase 7C-3
    readChemistrySettingsFromZip, // Phase 7C-6
    // Phase 8C refactor: shared internals for mathpix-chemistry-descriptions.js
    _descriptionInternals: {
      graphCache: _graphCache,
      featureFlags: FEATURE_FLAGS,
      formatFormulaUnicode: _formatFormulaUnicode,
    },
  };
})();

// Expose globally
window.MathPixChemistryUtils = MathPixChemistryUtils;

