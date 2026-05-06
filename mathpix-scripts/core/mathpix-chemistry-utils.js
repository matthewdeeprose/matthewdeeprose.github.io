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

  // Phase 8C-CT-3c: monotonically-increasing counter for auto-assigned canvas ids.
  // SmiDrawer.draw() takes a CSS selector, so the canvas must have an id; if the
  // caller passes an id-less canvas, renderStructure() assigns "chem-auto-N".
  let _autoCanvasIdCounter = 0;

  // Phase 7A-4: Molecular graph cache for structural descriptions (Map)
  // Replaces single-slot _cachedGraph/_cachedGraphSmiles with a bounded Map
  // so multiple structures keep their graphs when renderStructureToBlob()
  // is called for the MMD preview.
  /** @type {Map<string, Object>} SMILES → { graph, rings, ringConnections } */
  const _graphCache = new Map();
  /** @type {number} Maximum cache entries — prevents unbounded growth */
  const _GRAPH_CACHE_MAX = 20;

  // Phase 12-2b: in-flight RDKit warmup tracking. When `_populateGraphCache`
  // is called with `RDKIT_GRAPH_PATH=true` but RDKit is cold (`_rdkitModule`
  // is null), we fire `_getRdkit()` and resolve the cache asynchronously. The
  // Map ensures concurrent calls for the same SMILES share one warmup
  // promise. `awaitGraphCached(smiles)` (exposed on the public API) lets the
  // harness — and any future cold-path-aware caller — bracket the cold-start
  // window with a single await.
  /** @type {Map<string, Promise<void>>} smiles → in-flight warmup promise */
  const _inflightWarmups = new Map();

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
   * Phase 12-1a: graph-cache bridge.
   *
   * RDKit is now the rendering backend, but the description engine still
   * consumes a SmilesDrawer-shaped graph. Until 12-2a swaps the internals,
   * this helper runs SmilesDrawer offscreen purely to extract the graph and
   * populate `_graphCache`. Visible rendering is RDKit's responsibility.
   *
   * Synchronous on purpose — SmilesDrawer's success callback fires
   * synchronously in canvas-only mode (no image-asset loads), so the cache
   * is populated before this function returns. The `migration-harness`
   * `_primeGraphCache` path depends on this behaviour: it calls
   * `renderStructure(smiles, canvas)` and immediately calls description
   * APIs without awaiting.
   *
   * At 12-2a the body is replaced with RDKit `get_json()` + a
   * SmilesDrawer-shape translator, and the offscreen canvas is removed.
   * The signature stays the same so call sites (renderStructure /
   * renderStructureToBlob) don't change.
   *
   * @param {string} smiles - SMILES notation key
   * @returns {void}
   * @private
   */
  function _populateGraphCache(smiles) {
    if (!smiles || typeof smiles !== "string") return;
    // Phase 12-5c-2 (D2 = C, closure-note 5): canonicalise once at the
    // chokepoint so surface-form variants (e.g. paraxanthine aromatic vs
    // Kekulé) collapse to one cache entry. Cold-start defensive null →
    // falls back to input form (`|| smiles`); warmup path then writes the
    // input-form key, acceptable per gate 4.
    const canonical = _canonicaliseSmiles(smiles) || smiles;
    if (_graphCache.has(canonical)) return; // Already cached, skip.

    // Warm path: RDKit is already loaded — extract synchronously so the
    // existing sync contract (renderStructure → _populateGraphCache → cache
    // populated → description APIs read sync) is preserved.
    if (_rdkitModule) {
      try {
        const graphData = _extractGraphFromRdkitSync(canonical);
        if (graphData) _cacheGraph(canonical, graphData);
      } catch (err) {
        logWarn("_populateGraphCache: RDKit sync extract failed", {
          smiles,
          error: err && err.message,
        });
      }
      return;
    }
    // Cold path: kick off RDKit warmup, return with cache empty for this
    // call. The next call (after the warmup resolves) hits the warm path.
    // Callers that need a populated-cache guarantee across the cold-start
    // window should `await awaitGraphCached(smiles)`.
    _ensureRdkitWarming(smiles);
    return;
  }

  /**
   * Phase 12-2b: register an in-flight RDKit warmup for a SMILES. Idempotent —
   * concurrent calls for the same SMILES share one promise. After the warmup
   * resolves, the translator runs and the cache is populated. The promise's
   * resolution does not signal cache success directly; callers should check
   * `_graphCache.has(smiles)` after awaiting.
   *
   * @param {string} smiles - SMILES key to warm.
   * @returns {Promise<void>} Promise that resolves once warmup + extract finish.
   * @private
   */
  function _ensureRdkitWarming(smiles) {
    if (_inflightWarmups.has(smiles)) return _inflightWarmups.get(smiles);
    const p = _getRdkit()
      .then((rdkit) => {
        if (!rdkit) return;
        try {
          const graphData = _extractGraphFromRdkitSync(smiles);
          if (graphData) _cacheGraph(smiles, graphData);
        } catch (err) {
          logWarn("_ensureRdkitWarming: post-warm extract failed", {
            smiles,
            error: err && err.message,
          });
        }
      })
      .finally(() => {
        _inflightWarmups.delete(smiles);
      });
    _inflightWarmups.set(smiles, p);
    return p;
  }

  /**
   * Phase 12-2b: public-API shim for callers that need a populated-cache
   * guarantee across the cold-start window. Used by the migration harness;
   * production callers (result renderer, MMD preview, comparison view) do
   * not need it because the warm-on-sync steady state preserves their
   * existing contract.
   *
   * Resolves to true when the cache is populated for `smiles`, false on
   * RDKit init failure or invalid SMILES. Triggers a warmup if neither
   * cached nor in flight.
   *
   * @param {string} smiles - SMILES to ensure is cached.
   * @returns {Promise<boolean>} True if cached after the call, false otherwise.
   */
  async function awaitGraphCached(smiles) {
    if (!smiles || typeof smiles !== "string") return false;
    if (_graphCache.has(smiles)) return true;
    if (_inflightWarmups.has(smiles)) {
      await _inflightWarmups.get(smiles);
      return _graphCache.has(smiles);
    }
    _populateGraphCache(smiles);
    const inflight = _inflightWarmups.get(smiles);
    if (inflight) await inflight;
    return _graphCache.has(smiles);
  }

  // =========================================================================
  // Phase 12-2a: RDKit graph translator — get_json() → SmilesDrawer-shape
  // =========================================================================
  //
  // Consumes RDKit's mol.get_json() output and emits a graph object structurally
  // equivalent to what _extractGraphFromDrawer() returns: { graph, rings,
  // ringConnections } with the same nested shape, field names, and value
  // types that mathpix-chemistry-descriptions.js, mathpix-chemistry-
  // comprehensive.js, and mathpix-chemistry-locants.js consume.
  //
  // CRITICAL CORRECTNESS — preserves Phase 11-3b's single-fix-point cascade.
  // RDKit's perception layer reports atom-level aromaticity (extensions
  // .aromaticAtoms) and bond-level aromaticity (extensions.aromaticBonds) in
  // a single perception step; the translator writes BOTH the atom-level flag
  // (vertex.value._rdkit.aromatic) AND the bond-level flag
  // (edge.isPartOfAromaticRing) in a single pass over the JSON. The five
  // downstream consumers — named-system identifier (descriptions.js
  // _classifyRing aggregation), locant gate (r.aromatic), alkene detector
  // pass 12 (descriptions.js:874), flanker classifier (descriptions.js:435),
  // comprehensive tail-H tally (comprehensive.js _tailImplicitH:92) — all
  // cascade from edge.isPartOfAromaticRing. Atom-level aromaticity is
  // additive data for Phase 13+ adoption; consumers don't read it today,
  // but it must remain consistent with the bond-level flag.
  //
  // ATOM-INDEX IDENTITY. Vertices use RDKit's canonical atom indices
  // directly (vertex.id = rdkitAtomIdx, 0..N-1, stable per SMILES). Edges
  // reference these indices via sourceId/targetId. Phase 12-3a (locants
  // module rebase on RDKit canonical atom indexing) depends on this contract;
  // changing the index scheme later would require coordinated updates there.
  //
  // BOND-ORDER POLICY. Emits Kekulé bond symbols (`-` / `=` / `#`) — NOT
  // collapsing aromatic bonds to `:`. Aromatic bonds carry their actual
  // Kekulé order in `bondType` plus `isPartOfAromaticRing = true`. Pass 12
  // and other consumers filter aromatic edges via the flag before consulting
  // bondType, so the explicit Kekulé order is safe and matches the post-
  // 11-3b SmilesDrawer-shape contract.
  //
  // RING DETECTION. Derived from RDKit's SSSR via the rdkitRepresentation
  // extension's atomRings field (array of arrays of atom indices, one per
  // ring). Each ring's array index serves as its ring id; vertex.value.rings
  // lists the ring indices the atom belongs to (consumers use this only as
  // "is in any ring" / "shares a ring with neighbour" via Set equality).
  // Fused/bridged/spiro flags are derived from ring-overlap topology:
  // - isFused: ring shares >= 2 atoms with at least one other ring
  // - isSpiro: ring shares exactly 1 atom with at least one other ring
  // - isBridged: ring shares >= 2 atoms with another ring AND those shared
  //   atoms are not adjacent (a fused-ring overlap is two adjacent atoms;
  //   a bridged overlap is two non-adjacent atoms or > 2 shared atoms).
  //
  // RING CONNECTIONS. Emitted as `[]` — production consumers do not read
  // this field (verified by repo-wide grep). Per the prompt's "don't
  // translate fields production doesn't consume" rule, omitted as dead
  // weight rather than reconstructed.
  //
  // CIP DESCRIPTORS. Bonus data — no current consumer. Emitted under
  // vertex.value._rdkit.cipCode for Phase 13+ adoption per the acceptance
  // criteria. Read from extensions.rdkitRepresentation.cipCodes (array of
  // [atomIdx, "R" | "S"]).

  const _ELEMENT_SYMBOLS = {
    1: "H", 2: "He", 3: "Li", 4: "Be", 5: "B", 6: "C", 7: "N", 8: "O",
    9: "F", 10: "Ne", 11: "Na", 12: "Mg", 13: "Al", 14: "Si", 15: "P",
    16: "S", 17: "Cl", 18: "Ar", 19: "K", 20: "Ca", 35: "Br", 53: "I",
  };

  function _bondOrderToSymbol(rawOrder) {
    if (rawOrder === 2 || rawOrder === "2" || rawOrder === "double") return "=";
    if (rawOrder === 3 || rawOrder === "3" || rawOrder === "triple") return "#";
    return "-";
  }

  /**
   * Phase 12-2a (extracted at 12-5b-4): parse RDKit's get_json() output for
   * one mol and emit a SmilesDrawer-shape graph. See header comment above
   * this function for the shape contract, atom-index identity, bond-order
   * policy, and aromaticity cascade.
   *
   * The mol and smiles arguments must correspond. _extractGraphFromRdkitSync
   * passes either (originalMol, originalSmiles) on the short-circuit path or
   * (canonMol, canonicalSmiles) on the re-parse path; the _smiles field
   * embedded in the result reflects whichever was passed in.
   *
   * @param {object} mol - RDKit mol object (caller owns lifetime).
   * @param {string} smiles - SMILES string corresponding to mol; embedded
   *   in the result's _smiles field for downstream locants-module use.
   * @returns {{graph: {vertices: Array, edges: Array}, rings: Array, ringConnections: Array, _source: string, _smiles: string} | null}
   * @private
   */
  function _extractGraphFromRdkitJson(mol, smiles) {
    const rawJson =
      typeof mol.get_json === "function" ? mol.get_json() : null;
    if (!rawJson) {
      logWarn("_extractGraphFromRdkit: get_json unavailable", { smiles });
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      logWarn("_extractGraphFromRdkit: get_json parse failed", {
        smiles,
        error: err && err.message,
      });
      return null;
    }

    // CommonChem nests the molecule under molecules[0]; some builds put
    // atoms/bonds at the top level. Handle both.
    let molData = null;
    if (
      parsed &&
      Array.isArray(parsed.molecules) &&
      parsed.molecules[0]
    ) {
      molData = parsed.molecules[0];
    } else if (parsed && (parsed.atoms || parsed.bonds)) {
      molData = parsed;
    }
    if (!molData) {
      logWarn("_extractGraphFromRdkit: unexpected JSON shape", { smiles });
      return null;
    }

    // ----- Single-pass extraction of the rdkitRepresentation extension ----
    // CIP codes, aromatic atoms/bonds, and SSSR atomRings all live here.
    // Pulling them in one walk keeps atom-level + bond-level aromaticity
    // sourced from one parse — preserves the 11-3b single-fix-point property.
    const cipCodesByAtom = {};
    const aromaticAtomSet = new Set();
    const aromaticBondSet = new Set();
    const atomRings = [];
    const extensions = molData.extensions || [];
    for (const ext of extensions) {
      if (ext && ext.name === "rdkitRepresentation") {
        if (Array.isArray(ext.cipCodes)) {
          for (const entry of ext.cipCodes) {
            if (Array.isArray(entry) && entry.length >= 2) {
              cipCodesByAtom[entry[0]] = entry[1];
            }
          }
        }
        if (Array.isArray(ext.aromaticAtoms)) {
          for (const idx of ext.aromaticAtoms) aromaticAtomSet.add(idx);
        }
        if (Array.isArray(ext.aromaticBonds)) {
          for (const idx of ext.aromaticBonds) aromaticBondSet.add(idx);
        }
        if (Array.isArray(ext.atomRings)) {
          for (const r of ext.atomRings) {
            if (Array.isArray(r)) atomRings.push(r.slice());
          }
        }
      }
    }

    // Per-atom ring-membership map (atomIdx → array of ring indices).
    const ringMembership = new Map();
    atomRings.forEach((ring, ringIdx) => {
      for (const atomIdx of ring) {
        if (!ringMembership.has(atomIdx)) ringMembership.set(atomIdx, []);
        ringMembership.get(atomIdx).push(ringIdx);
      }
    });

    // ----- Vertices -----
    const atoms = molData.atoms || [];
    const vertices = atoms.map((atom, i) => {
      const atomicNum =
        atom.z != null
          ? atom.z
          : atom.atomicNumber != null
            ? atom.atomicNumber
            : atom.element_num != null
              ? atom.element_num
              : 6;
      const element = _ELEMENT_SYMBOLS[atomicNum] || String(atomicNum);
      const impHs =
        atom.impHs != null
          ? atom.impHs
          : atom.implicitHs != null
            ? atom.implicitHs
            : atom.num_implicit_hs != null
              ? atom.num_implicit_hs
              : null;
      const isotope =
        atom.mass != null
          ? atom.mass
          : atom.isotope != null
            ? atom.isotope
            : null;
      const stereo = atom.stereo || null;
      const cipCode = cipCodesByAtom[i] || null;
      const isAromatic = aromaticAtomSet.has(i);

      return {
        id: i,
        value: {
          element: element,
          // Ring IDs are array indices into the rings array below.
          // Consumers use these only as opaque keys for "is in ring" /
          // "shares a ring with neighbour" Set equality checks.
          rings: ringMembership.get(i) || [],
          // Bracket carries hcount whenever RDKit reports impHs. Consumers
          // (descriptions.js:427, comprehensive.js:94) treat null bracket
          // and bracket.hcount === undefined identically; emitting an
          // explicit { hcount: 0 } for pyridinic-N reads as "0 H" which
          // matches the chemistry.
          bracket: impHs !== null ? { hcount: impHs } : null,
          _rdkit: {
            formalCharge:
              atom.chg != null
                ? atom.chg
                : atom.formalCharge != null
                  ? atom.formalCharge
                  : 0,
            isotope: isotope,
            // Atom-level aromaticity — additive field. NOT read by current
            // consumers; held in lock-step with edge.isPartOfAromaticRing
            // below to preserve the 11-3b cascade invariant per the
            // prompt's "load-bearing" requirement.
            aromatic: isAromatic,
            stereo: stereo,
            cipCode: cipCode,
            isChiral: Boolean(stereo || cipCode),
          },
        },
      };
    });

    // ----- Edges -----
    const bondsRaw = molData.bonds || [];
    const edges = bondsRaw.map((bond, i) => {
      const bondAtoms =
        bond.atoms ||
        bond.bondAtoms ||
        (bond.begin != null && bond.end != null
          ? [bond.begin, bond.end]
          : [null, null]);
      const sourceId = bondAtoms[0];
      const targetId = bondAtoms[1];
      const rawOrder =
        bond.bo != null
          ? bond.bo
          : bond.order != null
            ? bond.order
            : bond.type != null
              ? bond.type
              : 1;
      const isAromatic = aromaticBondSet.has(i);

      return {
        id: i,
        sourceId: sourceId,
        targetId: targetId,
        // Kekulé order — `-` / `=` / `#`. Aromatic bonds keep their actual
        // Kekulé order; aromaticity is signalled separately via
        // isPartOfAromaticRing. This matches the post-11-3b SmilesDrawer-
        // shape contract that downstream consumers expect.
        bondType: _bondOrderToSymbol(rawOrder),
        // Bond-level aromaticity flag — load-bearing for the 11-3b
        // cascade. Consumed by all five downstream paths listed in the
        // header comment above.
        isPartOfAromaticRing: isAromatic,
        _rdkit: {
          stereo: bond.stereo || null,
          kekuleBondOrder: rawOrder,
        },
      };
    });

    // ----- Rings (SSSR) with fused/spiro/bridged annotation -----
    // Build pairwise overlap once so we can classify each ring with
    // O(R^2) ring comparisons rather than O(R^2) per-ring rebuilds.
    const ringSets = atomRings.map((r) => new Set(r));

    // Edge adjacency for the bridged-vs-fused distinction: two rings that
    // share two atoms are FUSED if those atoms are bonded, BRIDGED if not.
    const adjacencyKey = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
    const bondedPairs = new Set();
    for (const e of edges) {
      if (e.sourceId != null && e.targetId != null) {
        bondedPairs.add(adjacencyKey(e.sourceId, e.targetId));
      }
    }

    const rings = atomRings.map((memberIds, ringIdx) => {
      let isFused = false;
      let isSpiro = false;
      let isBridged = false;
      for (let other = 0; other < atomRings.length; other++) {
        if (other === ringIdx) continue;
        const otherSet = ringSets[other];
        const shared = memberIds.filter((id) => otherSet.has(id));
        if (shared.length === 0) continue;
        if (shared.length === 1) {
          isSpiro = true;
        } else if (shared.length === 2) {
          // Two shared atoms: fused if bonded, bridged otherwise.
          if (bondedPairs.has(adjacencyKey(shared[0], shared[1]))) {
            isFused = true;
          } else {
            isBridged = true;
          }
        } else {
          // Three or more shared atoms — bridged-bicyclic topology.
          isBridged = true;
        }
      }
      return {
        id: ringIdx,
        members: memberIds.slice(),
        isFused: isFused,
        isSpiro: isSpiro,
        isBridged: isBridged,
      };
    });

    // Phase 12-2b: aromaticity-cascade backstop. The 11-3b cascade depends on
    // edge.isPartOfAromaticRing being set for every bond in any ring whose
    // atoms are flagged aromatic. If RDKit reports aromatic atoms in a ring
    // but the bond-level flag is missing for some of those bonds, downstream
    // consumers (alkene detector pass 12, _classifyRingInternalCarbonyl
    // flanker check, _tailImplicitH) silently disagree on aromaticity. Surface
    // the inconsistency so the gate's third condition can localise it.
    let inconsistentRings = 0;
    for (let r = 0; r < atomRings.length; r++) {
      const ring = atomRings[r];
      const ringHasAromaticAtom = ring.some((idx) => aromaticAtomSet.has(idx));
      if (!ringHasAromaticAtom) continue;
      const ringSet = ringSets[r];
      let allFlagged = true;
      for (const e of edges) {
        if (ringSet.has(e.sourceId) && ringSet.has(e.targetId)) {
          if (!e.isPartOfAromaticRing) {
            allFlagged = false;
            break;
          }
        }
      }
      if (!allFlagged) inconsistentRings++;
    }
    if (inconsistentRings > 0) {
      logWarn(
        "_extractGraphFromRdkit: aromaticity inconsistency — aromatic atoms in ring(s) without all-aromatic bonds",
        { smiles, inconsistentRings },
      );
    }

    return {
      graph: {
        vertices: vertices,
        edges: edges,
      },
      rings: rings,
      // ringConnections: emitted empty — verified by grep that no current
      // production consumer (descriptions.js, comprehensive.js, locants.js)
      // reads this field. Reconstructing it would be dead weight per the
      // 12-2a "don't translate fields production doesn't consume" rule.
      ringConnections: [],
      _source: "rdkit-translation",
      // 12-3a dependency: locants module recovers the SMILES from this
      // field to drive InChI-auxinfo lookups (_getInchiAtomMap) without
      // re-parsing the graph. Don't optimise away.
      _smiles: smiles,
    };
  }

  /**
   * Phase 12-2a (rewritten at 12-5b-4 for input-form independence): canonicalise
   * the input SMILES and dispatch to _extractGraphFromRdkitJson with a mol
   * whose atom array is in canonical order.
   *
   * Strategy: parse the input mol once, read its canonical SMILES via
   * mol.get_smiles(). If canonical === input, the input was already canonical
   * and we use the original mol directly (short-circuit, no re-parse).
   * Otherwise re-parse the canonical SMILES into a fresh mol whose atom
   * array is canonical-order-stable, eliminating SMILES-input-form dependence
   * downstream. Per investigation section 3.1-3.2; closes N-post12-1.
   *
   * Defensive fall-through: if mol.get_smiles is missing on the pinned
   * MinimalLib version, log and dispatch with the original mol. Pre-flight
   * (Iteration 0 of 12-5b-4) confirmed get_smiles available on the pinned
   * 2025.03.4 build; the defensive branch keeps any future MinimalLib
   * downgrade observable rather than silent.
   *
   * @param {string} smiles - SMILES string to translate.
   * @returns {{graph: {vertices: Array, edges: Array}, rings: Array, ringConnections: Array, _source: string, _smiles: string} | null}
   * @private
   */
  function _extractGraphFromRdkitSync(smiles) {
    if (!smiles || typeof smiles !== "string") return null;

    return _withRdkitMolSync(smiles, (mol) => {
      const canonicalSmiles =
        typeof mol.get_smiles === "function" ? mol.get_smiles() : null;
      if (canonicalSmiles == null) {
        logWarn(
          "12-5b-4: mol.get_smiles unavailable; falling through to non-canonicalised translator path. Output may be input-form-dependent for this molecule.",
          { smiles },
        );
        return _extractGraphFromRdkitJson(mol, smiles);
      }
      if (canonicalSmiles === smiles) {
        // Short-circuit: input is already canonical, no re-parse needed.
        return _extractGraphFromRdkitJson(mol, smiles);
      }
      // Re-parse the canonical SMILES into a fresh mol whose atom array is
      // in canonical order; that mol drives the translator.
      return _withRdkitMolSync(canonicalSmiles, (canonMol) =>
        _extractGraphFromRdkitJson(canonMol, canonicalSmiles)
      );
    });
  }

  /**
   * Phase 12-2a: async wrapper around `_extractGraphFromRdkitSync`. Awaits
   * `_getRdkit()` so first-call cold paths still resolve, then delegates to
   * the sync path. Preserves the contract `auditMigrationDiff` and
   * `testRdkitGraph` rely on — both await the function and their unchanged
   * outputs cross-verify the sync path used by `_populateGraphCache`.
   *
   * @param {string} smiles - SMILES string to translate.
   * @returns {Promise<Object|null>} Resolves to the translated graph, or null.
   * @private
   */
  async function _extractGraphFromRdkit(smiles) {
    if (!smiles || typeof smiles !== "string") return null;
    const rdkit = await _getRdkit();
    if (!rdkit) return null;
    return _extractGraphFromRdkitSync(smiles);
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
   * Phase 7C-1: Detect whether dark mode is active.
   *
   * Phase 12-1b prerequisite: original logic compared `--chem-bg` directly
   * against `"#ffffff"` and treated any non-white value as dark. That was
   * brittle — once `--chem-bg: #f0f2e9` (cream, not white) became visible
   * to JS, the comparison incorrectly reported dark mode in light mode,
   * which made Monochrome and High Contrast pick up `paletteSet.dark`
   * (black-on-black) even though the page was in light mode. Replaced with
   * a luminance check that works for any colour pair the user may choose.
   *
   * @returns {boolean}
   * @private
   */
  function _detectDarkMode() {
    const bgFromCSS = getComputedStyle(document.documentElement)
      .getPropertyValue("--chem-bg").trim();
    if (bgFromCSS) {
      const rgb = _hexToFloatRgb(bgFromCSS);
      if (rgb) {
        // Average-channel luminance approximation. Dark if mean channel < 0.5.
        // Cream (#f0f2e9) → ~0.93 → light. Deep navy (#00131d) → ~0.06 → dark.
        const lum = (rgb[0] + rgb[1] + rgb[2]) / 3;
        return lum < 0.5;
      }
    }
    return !!document.getElementById("darkCSS")?.href?.includes("dark.css");
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
  // Phase 12-1a: RDKit drawing-options resolver + Image loader
  // =========================================================================

  /**
   * Phase 12-1a: convert a hex colour string to a [r, g, b] float triple
   * in the 0–1 range that RDKit's atomColourPalette / backgroundColour
   * options expect.
   * @param {string} hex
   * @returns {number[]|null}
   * @private
   */
  function _hexToFloatRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return null;
    return [
      parseInt(match[1], 16) / 255,
      parseInt(match[2], 16) / 255,
      parseInt(match[3], 16) / 255,
    ];
  }

  /**
   * Phase 12-1b: read atom colours from CSS custom properties and emit them
   * in the RDKit `atomColourPalette` shape — atomic-number-keyed RGB-float
   * triples plus a `BACKGROUND` key (also a triple).
   *
   * Returns null when CSS variables are not available (e.g. early page load
   * before the chemistry stylesheet has applied), letting the caller fall
   * back to `COLOUR_PALETTES` static values. Per-key fallbacks (mirroring
   * `COLOUR_PALETTES.element.light`) cover the rare case where the
   * stylesheet is loaded but a single variable is missing or malformed.
   *
   * @returns {Object|null} { 1: [r,g,b], 6: [r,g,b], ..., BACKGROUND: [r,g,b] }
   *   or null if CSS not loaded.
   * @private
   */
  function _readRdkitColoursFromCSS() {
    const cssVar = (name) => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
      return val || null;
    };
    const carbonHex = cssVar("--chem-carbon");
    if (!carbonHex) return null;  // CSS not loaded yet

    const carbon = _hexToFloatRgb(carbonHex);
    if (!carbon) return null;     // CSS variable malformed

    // Atomic-number map. Hydrogen falls back to carbon's colour to avoid
    // dim H subscripts (preserves Phase 7C-3 carbon=hydrogen rule).
    const cssMap = {
      1:  _hexToFloatRgb(cssVar("--chem-hydrogen")) || carbon,
      6:  carbon,
      7:  _hexToFloatRgb(cssVar("--chem-nitrogen"))   || [0.051, 0.278, 0.631],
      8:  _hexToFloatRgb(cssVar("--chem-oxygen"))     || [0.718, 0.110, 0.110],
      9:  _hexToFloatRgb(cssVar("--chem-fluorine"))   || [0.180, 0.490, 0.196],
      15: _hexToFloatRgb(cssVar("--chem-phosphorus")) || [0.651, 0.235, 0.000],
      16: _hexToFloatRgb(cssVar("--chem-sulphur"))    || [0.478, 0.361, 0.000],
      17: _hexToFloatRgb(cssVar("--chem-chlorine"))   || [0.180, 0.490, 0.196],
      35: _hexToFloatRgb(cssVar("--chem-bromine"))    || [0.553, 0.431, 0.388],
      53: _hexToFloatRgb(cssVar("--chem-iodine"))     || [0.416, 0.106, 0.604],
    };

    const bgHex = cssVar("--chem-bg") || "#ffffff";
    const background = _hexToFloatRgb(bgHex) || [1, 1, 1];

    return { ...cssMap, BACKGROUND: background };
  }

  /**
   * Phase 12-1a: resolve the active rendering preset and translate it to
   * the RDKit-shaped option object consumed by `mol.get_svg_with_highlights`.
   *
   * Always reads `MATHPIX_CONFIG.CHEMISTRY_RENDERING.PRESETS` and
   * `COLOUR_PALETTES` (Step 2a decision A: 12-1a is a new code path,
   * the `RDKIT_PRESETS` flag is vestigial until 12-4c retires it). The
   * preset KEY is read from the legacy localStorage key — keys are
   * unchanged at 12-0b; only the per-preset option shape was redesigned.
   *
   * Returned object has an internal `_addHsInPlace` flag that the caller
   * strips before passing to RDKit (RDKit ignores unknown keys, but we
   * delete it to keep the SVG-options blob clean and so the flag's name
   * doesn't accidentally collide with a future RDKit option).
   *
   * Phase 12-1b: when `paletteName === "element"` AND `!overrides.forExport`,
   * the on-screen palette is read from CSS custom properties via
   * `_readRdkitColoursFromCSS()` so it tracks the active stylesheet
   * (light.css vs dark.css). Non-element palettes (Monochrome, High Contrast)
   * stay locked to the static `COLOUR_PALETTES` table to preserve their
   * deliberate accessibility-tuned contrast ratios. ZIP export
   * (`forExport: true`) continues to bypass CSS and use the static light
   * palette, regardless of current page theme.
   *
   * @param {Object} overrides - per-call overrides
   * @param {number} [overrides.width] - Canvas width
   * @param {number} [overrides.height] - Canvas height
   * @param {string} [overrides.background] - Background colour hex (overrides palette)
   * @param {boolean} [overrides.forExport] - If true, force the light palette (ZIP export)
   * @param {Object} [overrides.perImageOptions] - Per-image override layer
   * @returns {Object} RDKit-shaped draw options + internal `_addHsInPlace`
   * @private
   */
  function _resolveRdkitDrawOptions(overrides = {}) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    const presets = config?.PRESETS;
    const palettes = config?.COLOUR_PALETTES;

    // Defensive fallback if RDKit-shaped config is missing (12-0b not landed
    // or stripped). Returns RDKit-acceptable defaults so the renderer still
    // produces output.
    if (!presets || !palettes) {
      logWarn(
        "_resolveRdkitDrawOptions: PRESETS/COLOUR_PALETTES missing — using defaults",
      );
      return {
        width: overrides.width || 400,
        height: overrides.height || 300,
        bondLineWidth: 2.0,
        minFontSize: 6,
        maxFontSize: 9,
        backgroundColour: _hexToFloatRgb(overrides.background) || [1, 1, 1],
        _addHsInPlace: false,
      };
    }

    const presetName =
      localStorage.getItem(config.STORAGE_KEY) || config.DEFAULT_PRESET;

    // Build the effective preset (custom merges over skeletal; per-image
    // overrides win above both). Custom options are stored in
    // SmilesDrawer-shape (set by the existing settings UI), so we translate
    // the relevant keys to RDKit-shape on the fly.
    // Phase 12-1d: useCoordGen defaults to true for all four shipped presets;
    // Custom can opt out via the CoordGen orientation toggle.
    let preset;
    if (presetName === "custom") {
      const base = presets[config.DEFAULT_PRESET] || presets.skeletal;
      const custom = getCustomOptions();
      preset = { ...base };
      preset.useCoordGen = custom.useCoordGen !== false; // default-on
      if (typeof custom.bondThickness === "number")
        preset.bondLineWidth = custom.bondThickness;
      if (typeof custom.fontSizeSmall === "number")
        preset.minFontSize = custom.fontSizeSmall;
      if (typeof custom.fontSizeLarge === "number")
        preset.maxFontSize = custom.fontSizeLarge;
      if (typeof custom.colourScheme === "string")
        preset.atomColourPalette = custom.colourScheme;
      if (typeof custom.explicitHydrogens === "boolean")
        preset.addHsInPlace = custom.explicitHydrogens;
    } else {
      preset =
        presets[presetName] || presets[config.DEFAULT_PRESET] || presets.skeletal;
      preset = { ...preset, useCoordGen: true };
    }

    // Per-image overrides — accept both SmilesDrawer-shape (legacy) and
    // RDKit-shape keys so existing callers (settings manifests, tests) keep
    // working without translation churn at 12-1a.
    if (
      overrides.perImageOptions &&
      typeof overrides.perImageOptions === "object"
    ) {
      const pio = overrides.perImageOptions;
      if (typeof pio.bondLineWidth === "number")
        preset.bondLineWidth = pio.bondLineWidth;
      else if (typeof pio.bondThickness === "number")
        preset.bondLineWidth = pio.bondThickness;
      if (typeof pio.minFontSize === "number")
        preset.minFontSize = pio.minFontSize;
      else if (typeof pio.fontSizeSmall === "number")
        preset.minFontSize = pio.fontSizeSmall;
      if (typeof pio.maxFontSize === "number")
        preset.maxFontSize = pio.maxFontSize;
      else if (typeof pio.fontSizeLarge === "number")
        preset.maxFontSize = pio.fontSizeLarge;
      if (typeof pio.atomColourPalette === "string")
        preset.atomColourPalette = pio.atomColourPalette;
      else if (typeof pio.colourScheme === "string")
        preset.atomColourPalette = pio.colourScheme;
      if (typeof pio.addHsInPlace === "boolean")
        preset.addHsInPlace = pio.addHsInPlace;
      else if (typeof pio.explicitHydrogens === "boolean")
        preset.addHsInPlace = pio.explicitHydrogens;
      // Phase 12-1d: per-image override for textbook orientation.
      if (typeof pio.useCoordGen === "boolean")
        preset.useCoordGen = pio.useCoordGen;
    }

    const paletteName = preset.atomColourPalette || "element";
    const paletteSet = palettes[paletteName] || palettes.element;

    // Theme key — ZIP export forces light; on-screen reads dark-mode signal.
    const themeKey = overrides.forExport
      ? "light"
      : _detectDarkMode()
        ? "dark"
        : "light";
    let themeColours = paletteSet[themeKey] || paletteSet.light;

    // Phase 12-1b: prefer CSS-derived element palette for on-screen rendering.
    // CSS variables track the active stylesheet (light.css vs dark.css) so the
    // theme observer's re-render picks up the swap automatically. Non-element
    // palettes (Monochrome, High Contrast) stay locked to COLOUR_PALETTES
    // to preserve their explicit accessibility-tuned contrast.
    if (paletteName === "element" && !overrides.forExport) {
      const cssColours = _readRdkitColoursFromCSS();
      if (cssColours) {
        themeColours = cssColours;
      }
    }

    // Build atomColourPalette as { atomicNumber: [r, g, b] }, dropping
    // BACKGROUND (mapped separately). Theme palette values are already
    // RGB-float triples per 12-0b's COLOUR_PALETTES shape.
    const atomColourPalette = {};
    for (const [key, value] of Object.entries(themeColours)) {
      if (key === "BACKGROUND") continue;
      const num = Number(key);
      if (Number.isFinite(num)) atomColourPalette[num] = value;
    }

    let backgroundColour = themeColours.BACKGROUND || [1, 1, 1];
    if (overrides.background) {
      const rgb = _hexToFloatRgb(overrides.background);
      if (rgb) backgroundColour = rgb;
    }

    // Phase 12-1d follow-up: scale font sizes and bond line width
    // proportionally to the requested canvas width. RDKit emits absolute
    // pixel values in the SVG's coordinate space, so a 9px font on a 400-wide
    // SVG (~2.25% of canvas width) becomes a 9px font on the 1000-wide
    // PNG-export SVG (~0.9% — visibly tiny). Phase 12-1b tuned these values
    // for the canonical 400-wide visible render, so we anchor scaling to 400
    // and grow fonts/bonds with the requested width. Visible render
    // (width=400) is unaffected; PNG export (width=800 nominally, 800×dpr
    // internally after 12-1d) scales up to match the visible's text-to-
    // canvas ratio.
    const REFERENCE_WIDTH = 400;
    const requestedWidth = overrides.width || REFERENCE_WIDTH;
    const fontScale = requestedWidth / REFERENCE_WIDTH;

    return {
      width: requestedWidth,
      height: overrides.height || 300,
      bondLineWidth: preset.bondLineWidth * fontScale,
      minFontSize: Math.max(1, Math.round(preset.minFontSize * fontScale)),
      maxFontSize: Math.max(1, Math.round(preset.maxFontSize * fontScale)),
      atomColourPalette,
      backgroundColour,
      _addHsInPlace: preset.addHsInPlace === true,
      // Phase 12-1d: textbook-style depiction via CoordGen. Default-on for the
      // four shipped presets; Custom can opt out via the orientation toggle.
      _useCoordGen: preset.useCoordGen !== false,
    };
  }

  // Phase 12-1d: per-canvas cache of the last rendered SVG markup. Keyed by
  // canvas element id (upload mode = "chemistry-structure-canvas",
  // resume mode = "resume-chemistry-structure-canvas") so the two surfaces
  // never collide. Holds at most one string per canvas — re-rendering
  // overwrites; never grows unbounded.
  const _lastRenderedSvgString = new Map();

  /**
   * Phase 12-1d: map a target canvas element to the prefixed sibling SVG
   * element that mirrors its visible render. Upload-mode and resume-mode
   * each populate their own DOM tree per the Phase 7A-5d "own elements with
   * prefixed IDs" pattern; never relocate.
   * @param {HTMLCanvasElement} canvasElement
   * @returns {string} The id of the visible <svg> peer
   * @private
   */
  function _visibleSvgIdFor(canvasElement) {
    if (canvasElement?.id === "resume-chemistry-structure-canvas") {
      return "resume-chemistry-structure-svg";
    }
    return "chemistry-structure-svg";
  }

  /**
   * Phase 12-1d: replace the contents of the visible <svg> placeholder with
   * RDKit's SVG markup, preserving the placeholder's id/class identity.
   *
   * Implementation note: RDKit's output is trusted internal data (SMILES →
   * RDKit MinimalLib → SVG); we still parse via DOMParser rather than
   * innerHTML so that nodes adopted into the live document carry the
   * SVG namespace correctly (innerHTML on an <svg> element handles this
   * inconsistently across browsers when the source string declares its own
   * `<svg xmlns=…>` root).
   *
   * @param {SVGElement} svgEl - The placeholder <svg> in the figure
   * @param {string} svgString - RDKit-emitted SVG markup
   * @private
   */
  function _injectSvgIntoElement(svgEl, svgString) {
    if (!svgEl || !svgString) return;
    let parsed;
    try {
      parsed = new DOMParser().parseFromString(svgString, "image/svg+xml");
    } catch (err) {
      logWarn("_injectSvgIntoElement: DOMParser threw", {
        error: err && err.message,
      });
      return;
    }
    const root = parsed && parsed.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") {
      logWarn("_injectSvgIntoElement: parsed root is not <svg>", {
        nodeName: root && root.nodeName,
      });
      return;
    }

    // Mirror layout-affecting attributes from the parsed SVG so the visible
    // element scales correctly. Identity attributes (id, class, aria-hidden)
    // are owned by the placeholder in tools.html and stay untouched.
    const attrsToCopy = ["viewBox", "preserveAspectRatio"];
    for (const name of attrsToCopy) {
      const value = root.getAttribute(name);
      if (value) svgEl.setAttribute(name, value);
      else svgEl.removeAttribute(name);
    }

    // Replace contents. importNode adopts each child into svgEl's document
    // with the correct (SVG) namespace.
    const ownerDoc = svgEl.ownerDocument;
    const newChildren = [];
    for (const child of Array.from(root.childNodes)) {
      newChildren.push(ownerDoc.importNode(child, true));
    }
    svgEl.replaceChildren(...newChildren);
  }

  /**
   * Phase 12-1d: read the cached SVG markup for the given canvas id.
   * Public — exposed on the module API so the Save-as-SVG handlers (upload
   * + resume) can serve a download without re-rendering.
   * @param {string} canvasId
   * @returns {string|null}
   */
  function getLastRenderedSvgString(canvasId) {
    if (!canvasId) return null;
    return _lastRenderedSvgString.get(canvasId) || null;
  }

  /**
   * Phase 12-1a: load an SVG (or any image) URL into an HTMLImageElement,
   * resolving when decoded. Used by both `renderStructure` and
   * `renderStructureToBlob` to bridge SVG → canvas.
   * @param {string} url - Object URL or data URL
   * @returns {Promise<HTMLImageElement>}
   * @private
   */
  function _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Failed to load SVG into Image element"));
      img.src = url;
    });
  }

  /**
   * Phase 12-1a: render a SMILES to an SVG string via RDKit.
   * Wraps the `mol.get_svg_with_highlights` call (with `get_svg` fallback)
   * and the optional `add_hs_in_place` invocation. Memory management is
   * via `_withRdkitMol` from 12-0c.
   *
   * @param {string} smiles
   * @param {Object} rdkitOpts - Output of `_resolveRdkitDrawOptions`
   * @returns {Promise<string|null>} Normalised SVG markup, or null on failure
   * @private
   */
  async function _renderSmilesToSvgString(smiles, rdkitOpts) {
    return await _withRdkitMol(smiles, (mol) => {
      // Phase 12-1d: 2D depiction via CoordGen (Schrödinger's open-source
      // layout library bundled inside RDKit MinimalLib — mol.set_new_coords(true)
      // selects it over RDKit's default DG layout). Default-on for all four
      // shipped presets; the Custom preset can opt out via the CoordGen
      // orientation toggle (sets _useCoordGen=false). Note: CoordGen is
      // generally textbook-style for most scaffolds but for purines (e.g.
      // theobromine, caffeine) it produces the imidazole-on-left layout,
      // which is the mirror of the most common textbook depiction. Users
      // who prefer that layout can uncheck the toggle in the Custom preset.
      if (rdkitOpts._useCoordGen !== false) {
        try {
          mol.set_new_coords(true);
        } catch (err) {
          logWarn(
            "_renderSmilesToSvgString: set_new_coords(true) threw, falling back to default DG layout",
            { smiles, error: err && err.message },
          );
        }
      }

      // All hydrogens preset → invoke add_hs_in_place BEFORE get_svg.
      // This is what closes the original benzaldehyde aldehyde-H regression
      // (rdkit-migration-notes.md § "Why consider migration → The trigger").
      if (rdkitOpts._addHsInPlace) {
        try {
          mol.add_hs_in_place();
        } catch (err) {
          logWarn(
            "_renderSmilesToSvgString: add_hs_in_place threw",
            { smiles, error: err && err.message },
          );
        }
      }

      // Strip the internal flags before serialising — RDKit ignores unknown
      // keys but we keep the JSON blob clean.
      const svgOpts = { ...rdkitOpts };
      delete svgOpts._addHsInPlace;
      delete svgOpts._useCoordGen;

      let svgString;
      try {
        svgString = mol.get_svg_with_highlights(JSON.stringify(svgOpts));
      } catch (err) {
        logWarn(
          "_renderSmilesToSvgString: get_svg_with_highlights threw, falling back to get_svg",
          { smiles, error: err && err.message },
        );
        try {
          svgString = mol.get_svg(svgOpts.width, svgOpts.height);
        } catch (err2) {
          logWarn("_renderSmilesToSvgString: get_svg also threw", {
            smiles,
            error: err2 && err2.message,
          });
          return null;
        }
      }

      if (!svgString) {
        logWarn("_renderSmilesToSvgString: empty SVG from RDKit", { smiles });
        return null;
      }

      // Defensive: ensure xmlns attribute is present so the browser parses
      // the blob URL as SVG inside an Image element. RDKit's output should
      // already include it.
      if (!/xmlns\s*=/.test(svgString)) {
        svgString = svgString.replace(
          /<svg\b/,
          '<svg xmlns="http://www.w3.org/2000/svg"',
        );
      }
      return svgString;
    });
  }

  /**
   * Phase 12-4c (C3.5): translate an RDKit-shape preset entry to the
   * SmilesDrawer-shape used by the UI populate path.
   *
   * Storage layer (customOptions in localStorage, item.renderOptions, ZIP
   * manifest customOptions / perImageOverrides) is SmilesDrawer-shape per
   * the Phase 7C-3 contract; `_resolveRdkitDrawOptions` translates to
   * RDKit-shape at render time. This helper is the populate-side mirror of
   * that translation: the four `_populate*AdvancedControls*` functions
   * (renderer × 2, restorer × 2) merge translated preset bases with
   * SmilesDrawer-shape custom / per-image options, then read SmilesDrawer-
   * shape names uniformly across both code paths.
   *
   * Three SmilesDrawer-shape keys (bondSpacing, compactDrawing,
   * terminalCarbons) are intentionally absent — the corresponding UI
   * controls retire in C3.5 (no clean RDKit equivalent for compactDrawing;
   * bondSpacing and terminalCarbons removed as part of the same atomic
   * cleanup per the locked dispositions).
   *
   * @param {Object} rdkitPreset - An entry from MATHPIX_CONFIG.CHEMISTRY_RENDERING.PRESETS
   * @returns {Object} SmilesDrawer-shape mirror suitable for the UI populate path
   */
  function presetToUIShape(rdkitPreset) {
    if (!rdkitPreset || typeof rdkitPreset !== "object") return {};
    return {
      bondThickness: rdkitPreset.bondLineWidth,
      fontSizeSmall: rdkitPreset.minFontSize,
      fontSizeLarge: rdkitPreset.maxFontSize,
      colourScheme: rdkitPreset.atomColourPalette,
      explicitHydrogens: rdkitPreset.addHsInPlace,
      useCoordGen: rdkitPreset.useCoordGen,
    };
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
   * Render a SMILES structure onto a canvas element via the RDKit pipeline.
   *
   * Phase 12-1a rewrite: replaces SmilesDrawer with
   * `RDKit.get_mol` → `mol.get_svg_with_highlights` → `<img>` decode →
   * `canvas.drawImage`. Public API preserved — returns `boolean` (whether
   * the draw was *initiated* successfully, matching the original
   * SmilesDrawer-era contract). The visible draw completes asynchronously;
   * callers that need a "draw done" signal use the existing `onGraphReady`
   * callback option.
   *
   * The graph cache is populated synchronously via `_populateGraphCache`
   * before this function returns, so consumers that don't await it
   * (`migration-harness._primeGraphCache`, certain tests) still find a
   * cached graph when they immediately call description APIs.
   *
   * @param {string} smiles - SMILES notation string
   * @param {HTMLCanvasElement} canvasElement - Target canvas
   * @param {Object} [options]
   * @param {Object} [options.perImageOptions] - per-image override layer (Phase 7C-4)
   * @param {Function} [options.onGraphReady] - fired after the graph cache
   *   is populated AND the visible draw completes (existing contract).
   * @returns {boolean} true if a draw was initiated, false otherwise
   *
   * Theme observer hook: `currentRenderState = { smiles, canvasElement }`
   * is set at the top so the dark-stylesheet swap re-render path keeps
   * working. (12-1b will wire CSS-derived colours; at 12-1a the static
   * preset palette is used.)
   */
  function renderStructure(smiles, canvasElement, options = {}) {
    if (!smiles || !canvasElement) {
      logWarn("renderStructure: missing smiles or canvas element");
      return false;
    }

    // Save state so theme observer can re-render with new colours.
    currentRenderState = { smiles, canvasElement };

    // Auto-assign id for parity with prior behaviour. Several test paths
    // and ad-hoc consumers rely on it; not strictly required by the RDKit
    // pipeline, which doesn't need a CSS selector.
    if (!canvasElement.id) {
      canvasElement.id = "chem-auto-" + ++_autoCanvasIdCounter;
      logDebug("renderStructure: auto-assigned canvas id", {
        id: canvasElement.id,
      });
    }

    // Populate the graph cache synchronously via the bridge helper so the
    // description engine has data the moment renderStructure returns.
    _populateGraphCache(smiles);

    // Phase 12-1d: derive CSS pixel dimensions from style.width when
    // previously set (subsequent renders find canvasElement.width already
    // scaled by DPR), falling back to the original HTML attribute / layout
    // width on first render.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let cssWidth = parseFloat(canvasElement.style.width);
    if (!Number.isFinite(cssWidth) || cssWidth <= 0) {
      cssWidth = canvasElement.width || canvasElement.clientWidth || 400;
    }
    let cssHeight = parseFloat(canvasElement.style.height);
    if (!Number.isFinite(cssHeight) || cssHeight <= 0) {
      cssHeight = canvasElement.height || canvasElement.clientHeight || 300;
    }
    const internalWidth = Math.round(cssWidth * dpr);
    const internalHeight = Math.round(cssHeight * dpr);

    const rdkitOpts = _resolveRdkitDrawOptions({
      width: cssWidth,
      height: cssHeight,
      perImageOptions: options.perImageOptions || null,
    });

    // Fire-and-forget the visible draw. RDKit's pipeline is async (image
    // decode), but the public API contract is sync (`boolean`). The
    // canvas error overlay below preserves the existing user-visible
    // signal when rendering fails.
    (async () => {
      try {
        const svgString = await _renderSmilesToSvgString(smiles, rdkitOpts);
        if (!svgString) {
          _drawCanvasErrorText(canvasElement, smiles);
          return;
        }

        // Phase 12-1d: route the SVG to the visible inline element + cache
        // for Save-as-SVG, then continue rasterising to the (DPR-scaled)
        // export canvas.
        const svgEl = document.getElementById(_visibleSvgIdFor(canvasElement));
        if (svgEl) _injectSvgIntoElement(svgEl, svgString);
        _lastRenderedSvgString.set(canvasElement.id, svgString);

        const svgBlob = new Blob([svgString], {
          type: "image/svg+xml;charset=utf-8",
        });
        const svgUrl = URL.createObjectURL(svgBlob);
        try {
          const img = await _loadImage(svgUrl);
          // Phase 12-1d: preserve CSS dimensions; scale internal pixel buffer
          // by DPR so canvas.toBlob() consumers (Save Image, comparison view,
          // total downloader) automatically receive higher-resolution PNGs.
          canvasElement.style.width = cssWidth + "px";
          canvasElement.style.height = cssHeight + "px";
          canvasElement.width = internalWidth;
          canvasElement.height = internalHeight;
          const ctx = canvasElement.getContext("2d");
          ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
          // The RDKit SVG already paints its own backgroundColour, but
          // browsers can introduce transparent edges when scaling — fill
          // first to keep the visible canvas opaque.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
          ctx.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);
          logInfo("renderStructure: drawn", {
            smiles,
            cssWidth,
            cssHeight,
            dpr,
          });
        } finally {
          URL.revokeObjectURL(svgUrl);
        }

        if (typeof options.onGraphReady === "function") {
          options.onGraphReady(smiles);
        }
      } catch (err) {
        logWarn("renderStructure: async draw failed", {
          smiles,
          error: err && err.message,
        });
        _drawCanvasErrorText(canvasElement, smiles);
      }
    })();

    return true;
  }

  /**
   * Phase 12-1a: overlay the existing "Structure could not be rendered"
   * fallback text on a canvas. Lifted from the original `renderStructure`
   * catch block — this is the only user-visible signal that rendering
   * failed, so the code path is preserved verbatim.
   * @param {HTMLCanvasElement} canvasElement
   * @param {string} smiles
   * @private
   */
  function _drawCanvasErrorText(canvasElement, smiles) {
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
        error: canvasError && canvasError.message,
      });
    }
  }

  // =========================================================================
  // Phase 6G: Offscreen rendering to Blob (for ZIP image replacement)
  // =========================================================================

  /**
   * Render a SMILES structure to a PNG Blob via the RDKit pipeline.
   *
   * Phase 12-1a rewrite: replaces SmilesDrawer offscreen-canvas rendering
   * with `RDKit.get_mol` → `mol.get_svg_with_highlights` → `<img>` decode →
   * `canvas.drawImage` → `canvas.toBlob('image/png')`. Public API
   * preserved: returns `Promise<Blob|null>`, with `null` for invalid
   * SMILES or render failure.
   *
   * The graph cache is populated synchronously via `_populateGraphCache`
   * before the RDKit await, so consumers calling this function for its
   * blob *and* relying on the side-effect cache (e.g. MMD preview) keep
   * the same observable contract.
   *
   * Improvements over the SmilesDrawer pipeline:
   * - No DOM canvas appended to `document.body` (SVG → in-memory canvas)
   * - No `requestAnimationFrame` double-pump (Image decode is synchronous-on-load)
   * - No blank-canvas pixel sampling (RDKit returns SVG or throws)
   * - `add_hs_in_place()` invoked when the All hydrogens preset is active —
   *   closes the original benzaldehyde aldehyde-H regression.
   *
   * @param {string} smiles - SMILES notation string
   * @param {Object} [options] - Rendering options
   * @param {number} [options.width=800] - Canvas width in pixels
   * @param {number} [options.height=600] - Canvas height in pixels
   * @param {string} [options.background='#ffffff'] - Background colour (hex)
   * @param {Object} [options.perImageOptions=null] - Phase 7C-5: per-image overrides
   *   merged on top of the active preset/custom layer before the final render.
   *   Pass null/omit to use the active global preset only.
   * @returns {Promise<Blob|null>} PNG blob, or null if rendering fails
   */
  async function renderStructureToBlob(smiles, options = {}) {
    if (!smiles || typeof smiles !== "string") {
      logWarn("renderStructureToBlob: missing or invalid SMILES");
      return null;
    }

    const width = options.width || 800;
    const height = options.height || 600;
    const background = options.background || "#ffffff";

    // Populate the graph cache via the bridge BEFORE awaiting RDKit so
    // descriptions can run as soon as the function awaits — preserves the
    // pre-12-1a observable side-effect contract.
    _populateGraphCache(smiles);

    // Phase 12-1d: scale BOTH the requested SVG dimensions AND the offscreen
    // canvas dimensions by devicePixelRatio. SVG is rasterised at higher
    // resolution; canvas captures it at higher resolution; toBlob returns a
    // higher-resolution PNG. Existing consumers (Save Image, total downloader,
    // image-manager cache, MMD preview, comparison view) benefit transparently.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const internalWidth = Math.round(width * dpr);
    const internalHeight = Math.round(height * dpr);

    const rdkitOpts = _resolveRdkitDrawOptions({
      width: internalWidth,
      height: internalHeight,
      background,
      forExport: true,
      perImageOptions: options.perImageOptions || null,
    });

    const svgString = await _renderSmilesToSvgString(smiles, rdkitOpts);
    if (!svgString) {
      logWarn("renderStructureToBlob: RDKit SVG render failed", { smiles });
      return null;
    }

    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = await _loadImage(svgUrl);
      const canvas = document.createElement("canvas");
      canvas.width = internalWidth;
      canvas.height = internalHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, internalWidth, internalHeight);
      ctx.drawImage(img, 0, 0, internalWidth, internalHeight);
      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!blob || blob.size === 0) {
        logWarn("renderStructureToBlob: canvas.toBlob returned empty");
        return null;
      }
      logInfo("renderStructureToBlob: success", {
        smiles: smiles.substring(0, 30),
        blobSize: blob.size,
        cssDimensions: `${width}x${height}`,
        internalDimensions: `${internalWidth}x${internalHeight}`,
        dpr,
      });
      return blob;
    } catch (err) {
      logWarn("renderStructureToBlob: SVG → canvas pipeline failed", {
        smiles,
        error: err && err.message,
      });
      return null;
    } finally {
      URL.revokeObjectURL(svgUrl);
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

  // Phase 12-5b-1: archaic / non-English synonym blocklist for filter F4.
  // Extensible — add lowercase entries as new wrong-name regressions surface.
  const ARCHAIC_BLOCKLIST = new Set([
    "naphthalin",
    "benzoic aldehyde",
    "carbamide",
    "iminourea",
  ]);

  // Phase 12-5b-2: CID-keyed override for synonyms the heuristic in
  // _isLikelyEnglishCommonName cannot select correctly on its own.
  // Two motivating patterns drive entries here:
  //
  //   1. Tautomer ambiguity. PubChem indexes keto and enol tautomers as
  //      separate CIDs (separate InChI Keys → separate records). Whichever
  //      CID our SMILES resolves to inherits PubChem's primary-name choice
  //      for that tautomer — which may be the chemistry-correct name for
  //      the OTHER tautomer if PubChem's record favours it. Example:
  //      CID 8871 (keto, "2-pyridone") has "2-HYDROXYPYRIDINE" as its top
  //      synonym; the heuristic alone produces self-contradicting prose
  //      ("2-Hydroxypyridine ... with a lactam") because the enol-form
  //      name and the keto-form structural label are inconsistent.
  //
  //   2. PubChem-ranking-window-miss. The recognised common name exists
  //      in PubChem's synonym list but sits below the slice(0, 5) window
  //      OR is shadowed by stereo-prefixed forms (DL-, Racemic-, R-, S-,
  //      alpha-, beta-). Example: CID 1302 (naproxen) — top synonyms are
  //      all DL-/Racemic- prefixed; plain "Naproxen" is window-miss.
  //
  // Pattern is established, not exceptional. Add an entry whenever F2/F3/
  // F4/F-DB do their job correctly but the surviving synonym is still a
  // chemistry-misleading or pedagogically-suboptimal label. Phase 14
  // fixture sweeps (especially chiral drugs) are likely to surface more
  // of these.
  //
  // Doc-drift note (record-once, capture in 12-5b-5 closure): the audit
  // (§ 3 N-post12-3), the investigation (§ 6.7), and the implementation
  // prompt (§ "Commit 12-5b-2") all cite CID 14441 for 2-pyridone. CID
  // 14441 is the ENOL tautomer ("2-hydroxypyridine"); the SMILES the
  // engine sees (`O=c1cccc[nH]1`) is the KETO tautomer and resolves
  // empirically to CID 8871 via both lookup paths (verified at 12-5b-2
  // Gate 1 + InChI-Key probe). The curated key here matches the empirical
  // CID, not the docs.
  const CURATED_COMMON_NAMES = {
    8871: "2-Pyridone", // tautomer ambiguity (keto record; PubChem ranks "2-HYDROXYPYRIDINE")
    1302: "Naproxen",   // window-miss + DL/Racemic shadowing
  };

  // =========================================================================
  // Phase 12-5c-3 (D3 = A): Named aromatic ring lookup — single source
  // =========================================================================
  //
  // Replaces the previously soft-coupled inline maps in
  // mathpix-chemistry-descriptions.js (`NAMED_AROMATIC_BY_TYPE`, label form)
  // and mathpix-chemistry-comprehensive.js (`namedAromatics`, phrase form).
  // Both consumers now read via the helpers below; new entries (e.g.
  // thiazole) land here only — neither consumer needs touching to extend.
  const NAMED_AROMATIC_RINGS = {
    benzene:    { label: "benzene",    sizeWord: "six"  },
    pyridine:   { label: "pyridine",   sizeWord: "six"  },
    pyrimidine: { label: "pyrimidine", sizeWord: "six"  },
    pyrrole:    { label: "pyrrole",    sizeWord: "five" },
    furan:      { label: "furan",      sizeWord: "five" },
    thiophene:  { label: "thiophene",  sizeWord: "five" },
    imidazole:  { label: "imidazole",  sizeWord: "five" },
  };

  /**
   * Returns the bare aromatic ring label for a `ring.type` value, or null
   * if the ring is not in the named-aromatic set. Used by descriptions.js's
   * `_selectNamedSystemLabel` for the single-ring fallback case.
   *
   * @param {string} ringType - aromatic ring.type from analyseStructure()
   * @returns {string|null}
   */
  function getNamedAromaticLabel(ringType) {
    return NAMED_AROMATIC_RINGS[ringType]?.label || null;
  }

  /**
   * Returns the prose phrase for a named aromatic ring (e.g.
   * `"a six-membered aromatic ring (benzene)"`), or null if the ring is
   * not in the named-aromatic set. Used by comprehensive.js's
   * `_describeRingTopology` for the named-aromatic prose path; the
   * heteroatom-composition append is performed by the caller.
   *
   * @param {string} ringType - aromatic ring.type from analyseStructure()
   * @returns {string|null}
   */
  function getNamedAromaticPhrase(ringType) {
    const entry = NAMED_AROMATIC_RINGS[ringType];
    if (!entry) return null;
    return "a " + entry.sizeWord + "-membered aromatic ring (" + entry.label + ")";
  }

  // Phase 12-5b-1: shared synonym filter (DRY of the previously-duplicated
  // inline filters in lookupPubChem and lookupPubChemBySmiles). Returns true
  // if `s` is a plausible English common name.
  //
  // Design pivot from initial 12-5b-1 spec: empirical PubChem ranking puts
  // the recognised English name at synonym index [0] for most fixtures, in
  // either lowercase (matching iupacName) or all-caps. The original audit
  // assumed those forms were noise and explicitly rejected them; the result
  // was the filter consistently surfacing long-tail archaic/IUPAC alternatives
  // (Tar camphor, Phenylmethanal, Malonylurea, etc.). The revised filter:
  //
  //   - Drops the case-insensitive iupacName-match rule (the original "Skip
  //     exact IUPAC name match" rule). For plain-English IUPAC names like
  //     "naphthalene" / "urea" / "benzaldehyde", the IUPAC name *is* the
  //     recognised name; rejecting it leaves only noise.
  //   - Drops F1 (all-caps reject). PubChem ranks recognised names in all-
  //     caps for some fixtures (BARBITURIC ACID, 1-METHYLNAPHTHALENE).
  //     Casing is normalised on display via _smartTitleCase rather than
  //     by rejection here.
  //   - Adds F-DB to catch database/registry IDs that pre-12-5b's CAS+EINECS
  //     filters missed (RefChem:..., DTXSID..., UNII codes, FEMA No., etc.).
  //
  // The `smiles` parameter is reserved for future tautomer-aware filters;
  // null on the InChI Key path.
  function _isLikelyEnglishCommonName(s, smiles, iupacLower) {
    if (/^\d[\d-]+\d$/.test(s)) return false;                 // CAS-style
    if (/^\d{3,}/.test(s) && /^[\d\s./-]+$/.test(s)) return false; // EINECS/registry digits
    // F2: IUPAC-syntax penalty.
    //
    // Empirical refinement after first 12-5b-1 verification round:
    //   - Parenthesised content (with anything inside) is the strongest IUPAC
    //     marker — catches "2-(6-Methoxy-2-naphthyl)propionic acid",
    //     "2,4,6(1H,3H,5H)-Pyrimidinetrione", "(+/-)-...", "2(1H)-Pyridone".
    //   - Comma-then-locant (",1-", ", 1-") catches CAS-index-style
    //     "Naphthalene, 1-methyl-" without rejecting recognised
    //     "1-Methylnaphthalene" (no comma).
    //   - The original `^\d+-[A-Z]` rule was dropped because it over-rejected
    //     all-caps recognised forms ("1-METHYLNAPHTHALENE") that smart-title-
    //     case would have converted cleanly. Real IUPAC patterns starting
    //     with a locant typically also have parens or commas, so the parens/
    //     comma rules subsume the cases the old rule was meant to catch.
    if (/\([^)]+\)/.test(s)) return false;                    // parenthesised content
    if (/,\s*\d+-/.test(s)) return false;                     // "Name, 1-methyl-" CAS-index style
    if (/-yl\)/.test(s)) return false;                        // defensive (usually subsumed by parens rule)
    // F3: Greek-letter prefix (Alpha-Methylnaphthalene → reject)
    if (/^(Alpha|Beta|Gamma|Delta|Epsilon)-/i.test(s)) return false;
    // F4: archaic / non-English blocklist
    if (ARCHAIC_BLOCKLIST.has(s.toLowerCase())) return false;
    // F-DB: database / registry ID rejection
    if (/:/.test(s)) return false;                            // "RefChem:459236", "ChEBI:..."
    if (/^[A-Z]{2,}[-_]?\d{3,}/.test(s)) return false;        // "DTXSID8020129", "NSC-3574"
    if (/^[A-Z]{2}\d+[A-Z0-9]{4,}$/.test(s)) return false;    // UNII codes "JU58VJ6Y3B"
    if (/^FEMA\b/i.test(s)) return false;                     // "FEMA No. 3193"
    return true;
  }

  // Phase 12-5b-1: smart-title-case normalisation for synonym display.
  // PubChem returns recognised names in inconsistent casing — sometimes
  // lowercase ("naphthalene"), sometimes all-caps ("BARBITURIC ACID"),
  // sometimes already title-case ("Tar camphor"). This helper produces a
  // consistent display form without losing fidelity for mixed-case inputs.
  //
  //   "naphthalene"          → "Naphthalene"           (lowercase → title-case)
  //   "BARBITURIC ACID"      → "Barbituric acid"        (all-caps → smart-title)
  //   "1-METHYLNAPHTHALENE"  → "1-Methylnaphthalene"    (handles digit prefix)
  //   "DL-Naproxen"          → "DL-Naproxen"            (mixed-case preserved)
  //   "2-Acetoxybenzoic acid"→ "2-Acetoxybenzoic acid"  (mixed-case preserved)
  function _smartTitleCase(s) {
    if (!s || typeof s !== "string") return s;
    if (/[A-Z]/.test(s)) {
      // All-caps → lowercase first, then title-case the first ASCII alpha
      if (s.toUpperCase() === s) {
        return s.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase());
      }
      return s; // mixed case — preserve input
    }
    // All-lowercase → title-case the first ASCII alpha
    return s.replace(/[a-z]/, (c) => c.toUpperCase());
  }

  // Phase 12-5b-1: derive the public-API result from a raw cache entry.
  // Cache entries store the raw `synonyms` list (not a filtered `commonNames`)
  // so the cache survives heuristic re-tightening; this helper applies the
  // current filter + smart-title-case on read. External callers continue to
  // consume `result.commonNames` unchanged.
  function _buildPublicResult(cacheEntry, smiles) {
    if (!cacheEntry || !cacheEntry.found) {
      return { ...cacheEntry, commonNames: [] };
    }
    // Phase 12-5b-2: curated CID overrides bypass the filter entirely.
    // Curated names are authoritative — no smart-title-case applied; single-
    // entry array (filter would slice to 5 anyway). See CURATED_COMMON_NAMES
    // for the two motivating patterns (tautomer ambiguity + ranking-window-
    // miss).
    const curated = CURATED_COMMON_NAMES[cacheEntry.pubchemCid];
    if (curated) {
      return { ...cacheEntry, commonNames: [curated] };
    }
    const iupacLower = cacheEntry.iupacName?.toLowerCase();
    const commonNames = (cacheEntry.synonyms || [])
      .filter((s) => _isLikelyEnglishCommonName(s, smiles, iupacLower))
      .slice(0, 5)
      .map(_smartTitleCase);
    return { ...cacheEntry, commonNames };
  }

  // Phase 12-5c-1 (D1 = B): single normaliser shared by post-OCR and
  // session-restore lookup paths. Pre-12-5c, the post-OCR path emitted a
  // 5-field pubchemData from 6 identical inline literals in the renderer;
  // the session-restore path emitted a 2-field shape (conditionally
  // undefined when item._resolvedName was falsy) from 5 of 6 STD/SHORT
  // call sites — and a 5-field shape from the 6 COMP sites + the apply-
  // from-cache exception. Visible effect on resumed STD/SHORT for items
  // without a cached _resolvedName: missing formula parenthetical, missing
  // MW clause, possibly missing name opener (audit caveat 12).
  //
  // Both paths now route through this helper; A-shape sites get a 5-field
  // object unconditionally — the engine receives a consistent shape from
  // every entry surface. Returns null only when item itself is null/non-
  // object (the renderer's notation-aware ternary at line 4174-4182
  // preserves its own gating).
  function _buildPubchemDataFromItem(item) {
    if (!item || typeof item !== "object") return null;
    return {
      commonNames: item.commonNames || (item._resolvedName ? [item._resolvedName] : []),
      iupacName: item.iupacName || null,
      molecularWeight: item.molecularWeight || null,
      molecularFormula: item.molecularFormula || null,
      inchi: item.inchi || null,
    };
  }

  /**
   * Phase 12-5c-2 (D2 = C, closure-note 5): module-level helper that lifts
   * `mol.get_smiles()` out of `_extractGraphFromRdkitSync` so cache-keying
   * call sites (_populateGraphCache, lookupPubChemBySmiles) can canonicalise
   * SMILES before key construction. Single chokepoint upstream of cache
   * lookups; surface-form variants (e.g. paraxanthine aromatic vs Kekulé)
   * collapse to one cache entry.
   *
   * Defensive null-fallthrough preserved per 12-5b-4 pattern: returns null
   * when `_rdkitModule` is null (cold-start) or when `mol.get_smiles` is
   * missing on the pinned MinimalLib build. Callers fall through to using
   * the input SMILES verbatim per gate-4 design ("input-form cache keys
   * acceptable in cold-start; canonical alignment after warmup").
   *
   * @param {string} smiles - SMILES to canonicalise.
   * @returns {string|null} Canonical SMILES, or null if RDKit unavailable.
   * @private
   */
  function _canonicaliseSmiles(smiles) {
    if (!smiles || typeof smiles !== "string") return null;
    if (!_rdkitModule) return null; // Cold-start: no synchronous canonicalisation.
    return _withRdkitMolSync(smiles, (mol) =>
      typeof mol.get_smiles === "function" ? mol.get_smiles() : null
    );
  }

  /**
   * Phase 12-5c-2 (D2 = C, closure-note 5): single-chokepoint cached-graph
   * getter. Canonicalises input SMILES via _canonicaliseSmiles before
   * looking up in _graphCache, mirroring the write-side canonicalisation
   * in _populateGraphCache. Defends future consumers from re-introducing
   * the input/canonical key-mismatch regression that the original 12-5c-2
   * manifest missed at the read-side.
   *
   * Defensive null-fallthrough preserved per 12-5b-4 / _canonicaliseSmiles
   * pattern: if RDKit cold or get_smiles missing, falls back to input form.
   *
   * @param {string} smiles - SMILES key.
   * @returns {Object|null} Cached graph data, or null if absent.
   * @private
   */
  function _getCachedGraph(smiles) {
    if (!smiles || typeof smiles !== "string") return null;
    const canonical = _canonicaliseSmiles(smiles) || smiles;
    return _graphCache.get(canonical) || null;
  }

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

    // Check cache first (Phase 12-5b-1: cache stores raw synonyms; filter
    // applies on read via _buildPublicResult so cache survives heuristic
    // re-tightening cleanly).
    if (_pubchemCache.has(inchiKey)) {
      logDebug("PubChem cache hit", { inchiKey });
      return _buildPublicResult(_pubchemCache.get(inchiKey), null);
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

    // Phase 12-5b-1: cache shape uses `synonyms` (raw); `commonNames` is
    // derived at return via _buildPublicResult.
    const emptyResult = {
      found: false,
      iupacName: null,
      synonyms: [],
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
          return _buildPublicResult(emptyResult, null);
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
        return _buildPublicResult(emptyResult, null);
      }

      const cid = props.CID;

      // Phase 12-5b-1: collect raw synonyms; the filter applies at return-time
      // via _buildPublicResult so the cache survives heuristic re-tightening.
      let synonyms = [];
      try {
        await new Promise((resolve) => setTimeout(resolve, PUBCHEM_MIN_GAP_MS));
        _lastPubchemRequest = Date.now();

        const synUrl = `${PUBCHEM_BASE}/compound/cid/${cid}/synonyms/JSON`;
        const synResponse = await fetch(synUrl);

        if (synResponse.ok) {
          const synData = await synResponse.json();
          synonyms =
            synData?.InformationList?.Information?.[0]?.Synonym || [];
        }
      } catch (synError) {
        logWarn("PubChem synonym lookup failed (non-critical)", {
          cid,
          error: synError.message,
        });
        // Continue without synonyms — this is non-critical
      }

      // Phase 12-5b-1: cache stores raw synonyms; commonNames is derived at
      // return via _buildPublicResult (filter applies on read).
      const cacheEntry = {
        found: true,
        iupacName: props.IUPACName || null,
        synonyms,
        molecularWeight: props.MolecularWeight
          ? parseFloat(props.MolecularWeight)
          : null,
        molecularFormula: props.MolecularFormula || null,
        pubchemCid: cid,
        pubchemUrl: cid
          ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
          : null,
      };

      _pubchemCache.set(inchiKey, cacheEntry);

      const result = _buildPublicResult(cacheEntry, null);

      logInfo("PubChem lookup successful", {
        inchiKey,
        iupacName: result.iupacName,
        synonymCount: synonyms.length,
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
      return _buildPublicResult(emptyResult, null);
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

    // Check cache first (prefixed to avoid collisions with InChI Key entries).
    // Phase 12-5b-1: cache stores raw synonyms; filter applies on read via
    // _buildPublicResult so cache survives heuristic re-tightening cleanly.
    // Phase 12-5c-2 (D2 = C, closure-note 5): canonicalise SMILES before
    // key construction so surface-form variants share one cache entry.
    // Defensive fallback (`|| trimmed`) covers cold-start.
    const canonical = _canonicaliseSmiles(trimmed) || trimmed;
    const cacheKey = `smiles:${canonical}`;
    if (_pubchemCache.has(cacheKey)) {
      logDebug("PubChem SMILES cache hit", { smiles: trimmed, canonical });
      return _buildPublicResult(_pubchemCache.get(cacheKey), trimmed);
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

    // Phase 12-5b-1: cache shape uses `synonyms` (raw); `commonNames` is
    // derived at return via _buildPublicResult.
    const emptyResult = {
      found: false,
      iupacName: null,
      synonyms: [],
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
          return _buildPublicResult(emptyResult, trimmed);
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
        return _buildPublicResult(emptyResult, trimmed);
      }

      const cid = props.CID;

      // Phase 12-5b-1: collect raw synonyms; the filter applies at return-time
      // via _buildPublicResult so the cache survives heuristic re-tightening.
      let synonyms = [];
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, PUBCHEM_MIN_GAP_MS),
        );
        _lastPubchemRequest = Date.now();

        const synUrl = `${PUBCHEM_BASE}/compound/cid/${cid}/synonyms/JSON`;
        const synResponse = await fetch(synUrl);

        if (synResponse.ok) {
          const synData = await synResponse.json();
          synonyms =
            synData?.InformationList?.Information?.[0]?.Synonym || [];
        }
      } catch (synError) {
        logWarn("PubChem synonym lookup failed (non-critical)", {
          cid,
          error: synError.message,
        });
        // Continue without synonyms — this is non-critical
      }

      // Phase 12-5b-1: cache stores raw synonyms; commonNames is derived at
      // return via _buildPublicResult (filter applies on read).
      const cacheEntry = {
        found: true,
        iupacName: props.IUPACName || null,
        synonyms,
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

      _pubchemCache.set(cacheKey, cacheEntry);

      const result = _buildPublicResult(cacheEntry, trimmed);

      logInfo("PubChem SMILES lookup successful", {
        smiles: trimmed,
        iupacName: result.iupacName,
        synonymCount: synonyms.length,
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
      return _buildPublicResult(emptyResult, trimmed);
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
  // Phase 12-0c: RDKit.js lazy-init accessor + memory-management helper
  // =========================================================================
  //
  // _getRdkit() lazy-initialises RDKit.js on first call (downloads ~2 MB WASM)
  // and caches the resolved module handle for the lifetime of the page.
  // _withRdkitMol() centralises the mandatory get_mol/try/finally/mol.delete()
  // pattern; every 12-1a-onwards code path that touches RDKit must route through
  // it to avoid WASM allocator leaks. No production code calls these yet —
  // 12-1a is the first sub-stage that does.

  let _rdkitModule = null;
  let _rdkitLoadPromise = null;

  /**
   * Lazy-initialise RDKit.js on first call. Subsequent calls return the cached
   * module handle. Concurrent first-render calls share the in-flight init
   * promise (no double-download, no double-init).
   *
   * @returns {Promise<object|null>} RDKit module, or null if init failed.
   * @private
   */
  async function _getRdkit() {
    if (_rdkitModule) return _rdkitModule;
    if (_rdkitLoadPromise) return _rdkitLoadPromise;

    if (typeof window.initRDKitModule !== "function") {
      logError(
        "_getRdkit: window.initRDKitModule unavailable — RDKit script tag missing or failed to load",
      );
      return null;
    }

    logInfo(
      "_getRdkit: initialising RDKit.js (first call — downloads ~2 MB WASM)",
    );
    _rdkitLoadPromise = window
      .initRDKitModule()
      .then((mod) => {
        _rdkitModule = mod;
        logInfo("_getRdkit: RDKit ready", {
          version: mod.version ? mod.version() : "unknown",
        });
        return mod;
      })
      .catch((err) => {
        logError("_getRdkit: initRDKitModule rejected", {
          error: err && err.message,
        });
        // Reset in-flight promise so a transient failure (CDN flake) can be
        // retried on a later call. _rdkitModule stays null.
        _rdkitLoadPromise = null;
        return null;
      });

    return _rdkitLoadPromise;
  }

  /**
   * Run a callback against an RDKit mol object with mandatory cleanup.
   *
   * RDKit's WASM allocator does not garbage-collect mol objects — every
   * RDKit.get_mol() must have a matching mol.delete(), including on every
   * error path. This helper centralises that contract.
   *
   * @param {string} smiles - SMILES string to parse.
   * @param {function(object): *} fn - Callback invoked with a valid mol; may be
   *   sync or async. Return value is forwarded to the caller.
   * @returns {Promise<*>} Result of fn(mol), or null on parse failure / RDKit
   *   unavailable / fn throw.
   * @private
   */
  async function _withRdkitMol(smiles, fn) {
    const RDKit = await _getRdkit();
    if (!RDKit) return null;

    let mol = null;
    try {
      mol = RDKit.get_mol(smiles);
      // RDKit returns a mol object even for unparseable SMILES; is_valid() is
      // the gate. Skipping this leaks a no-op mol on every invalid render.
      if (!mol || !mol.is_valid()) {
        logWarn("_withRdkitMol: invalid SMILES", { smiles });
        return null;
      }
      return await fn(mol);
    } catch (err) {
      logWarn("_withRdkitMol: callback threw", {
        smiles,
        error: err && err.message,
      });
      return null;
    } finally {
      if (mol) {
        try {
          mol.delete();
        } catch (delErr) {
          // Cleanup must not throw — log and continue rather than masking the
          // original error.
          logWarn("_withRdkitMol: mol.delete threw", {
            error: delErr && delErr.message,
          });
        }
      }
    }
  }

  /**
   * Phase 12-2b: synchronous mirror of `_withRdkitMol`. Throws if RDKit is
   * not warm — caller is responsible for ensuring `_rdkitModule` is non-null
   * (e.g. via the warm-path branch in `_populateGraphCache` after a flag-on
   * cold-path warmup has resolved). The is_valid() gate, callback try/catch,
   * and mol.delete try/catch are all preserved verbatim from the async
   * original — they're load-bearing for invalid-SMILES handling and WASM
   * allocator hygiene.
   *
   * @param {string} smiles - SMILES string to parse.
   * @param {function(object): *} fn - Sync callback invoked with a valid mol.
   * @returns {*} Result of fn(mol), or null on parse failure / fn throw.
   * @throws {Error} If RDKit is not yet loaded.
   * @private
   */
  function _withRdkitMolSync(smiles, fn) {
    if (!_rdkitModule) {
      throw new Error("_withRdkitMolSync called before RDKit warm");
    }
    let mol = null;
    try {
      mol = _rdkitModule.get_mol(smiles);
      // Match _withRdkitMol's gate: RDKit returns a mol object even for
      // unparseable SMILES; is_valid() is what catches that. Skipping it
      // would leak a no-op mol on every invalid render.
      if (!mol || !mol.is_valid()) {
        logWarn("_withRdkitMolSync: invalid SMILES", { smiles });
        return null;
      }
      return fn(mol);
    } catch (err) {
      logWarn("_withRdkitMolSync: callback threw", {
        smiles,
        error: err && err.message,
      });
      return null;
    } finally {
      if (mol) {
        try {
          mol.delete();
        } catch (delErr) {
          logWarn("_withRdkitMolSync: mol.delete threw", {
            error: delErr && delErr.message,
          });
        }
      }
    }
  }

  // =========================================================================
  // Phase 12-3a: InChI auxinfo → input-atom-index → InChI-canonical-number map
  // =========================================================================
  //
  // The locants module rebases its named-system labelling on top of InChI
  // canonical numbering (a stable, reproducible numbering scheme produced by
  // RDKit's bundled InChI library). The atom map produced here is the input
  // to _buildLocantMapFromInchi in mathpix-chemistry-locants.js — that builder
  // translates each substrate's InChI canonical numbers to IUPAC nomenclature
  // locants via the named-system tables (xanthine, naphthalene, etc.).
  //
  // Only used when MATHPIX_CONFIG.RDKIT_LOCANTS is true. Retires with the
  // legacy starting-atom + walk approach at 12-4c.

  /**
   * Bounded LRU cache mirroring `_GRAPH_CACHE_MAX = 20`. Keys are SMILES
   * strings; values are `Map<rdkitAtomIdx, inchiCanonicalNumber>` or `null`
   * (cached so repeated calls for an unparseable SMILES don't re-attempt the
   * extraction). LRU semantics: re-insert on hit; evict oldest on overflow.
   * @private
   */
  const _inchiAtomMapCache = new Map();
  const _INCHI_ATOM_MAP_CACHE_MAX = 20;

  /**
   * Extract the InChI auxinfo's input-atom-index → InChI-canonical-number map
   * from a live RDKit mol object. Tries multiple accessor patterns to remain
   * resilient across RDKit MinimalLib builds:
   *   - `mol.get_inchi(JSON.stringify({ options: "/AuxInfo" }))` — newer
   *     bindings include AuxInfo in the returned string when this option
   *     flag is set.
   *   - `mol.get_inchi_aux()` / `mol.get_aux_info()` — separate accessors
   *     in some bindings.
   *   - `mol.get_inchi("AuxInfo")` — short-form option in still other builds.
   *
   * Returns null if no accessor produces an AuxInfo string with a parseable
   * `/N:` field. The locants module treats null as "InChI path unavailable"
   * and falls back to the legacy topology-walk builder.
   *
   * AuxInfo `/N:` field format (per IUPAC InChI spec): `N:n1,n2,...,nN`
   * where the kth value is the original atom number (1-based) of the atom
   * assigned canonical number k. We invert this to a 0-based-input → 1-based-
   * canonical map suitable for direct lookups against RDKit atom indices.
   *
   * @param {object} mol - Live RDKit mol object (must have is_valid() === true)
   * @returns {Map<number, number> | null}
   * @private
   */
  function _extractInchiAtomMap(mol) {
    let auxInfo = null;
    const tryPatterns = [
      () => {
        if (typeof mol.get_inchi !== "function") return null;
        const result = mol.get_inchi(
          JSON.stringify({ options: "/AuxInfo" }),
        );
        return typeof result === "string" ? result : null;
      },
      () => {
        if (typeof mol.get_inchi !== "function") return null;
        const result = mol.get_inchi("/AuxInfo");
        return typeof result === "string" ? result : null;
      },
      () => {
        if (typeof mol.get_inchi_aux !== "function") return null;
        const result = mol.get_inchi_aux();
        return typeof result === "string" ? result : null;
      },
      () => {
        if (typeof mol.get_aux_info !== "function") return null;
        const result = mol.get_aux_info();
        return typeof result === "string" ? result : null;
      },
    ];

    for (const tryFn of tryPatterns) {
      let result;
      try {
        result = tryFn();
      } catch (err) {
        continue;
      }
      if (!result) continue;
      if (result.includes("AuxInfo=")) {
        auxInfo = result.substring(result.indexOf("AuxInfo="));
        break;
      }
      if (result.startsWith("/") || result.includes("/N:")) {
        // Some accessors return the auxinfo body without the "AuxInfo=" prefix.
        auxInfo = result;
        break;
      }
    }

    if (!auxInfo) {
      logDebug(
        "_extractInchiAtomMap: no AuxInfo accessor produced a parseable string",
      );
      return null;
    }

    // Multi-component molecules separate per-component data with `;`.
    // For the locants pipeline (which only sees single-component graphs) take
    // the first component.
    const nMatch = auxInfo.match(/\/N:([0-9,;]+)/);
    if (!nMatch) {
      logDebug("_extractInchiAtomMap: AuxInfo missing /N: field", { auxInfo });
      return null;
    }
    const firstComponent = nMatch[1].split(";")[0];
    const parts = firstComponent.split(",").map((s) => Number(s.trim()));
    if (parts.some((n) => !Number.isInteger(n) || n < 1)) {
      logDebug("_extractInchiAtomMap: /N: field unparseable", {
        firstComponent,
      });
      return null;
    }

    const map = new Map();
    parts.forEach((origAtom1Based, indexInList) => {
      const inputIdx0Based = origAtom1Based - 1;
      const canonicalNumber = indexInList + 1;
      map.set(inputIdx0Based, canonicalNumber);
    });
    return map;
  }

  function _cacheInchiAtomMap(smiles, map) {
    if (_inchiAtomMapCache.has(smiles)) _inchiAtomMapCache.delete(smiles);
    _inchiAtomMapCache.set(smiles, map);
    if (_inchiAtomMapCache.size > _INCHI_ATOM_MAP_CACHE_MAX) {
      const oldestKey = _inchiAtomMapCache.keys().next().value;
      if (oldestKey !== undefined) _inchiAtomMapCache.delete(oldestKey);
    }
  }

  /**
   * Async accessor for the InChI atom map. Lazy-initialises RDKit if needed,
   * extracts the auxinfo map, caches by SMILES, and returns it. Returns null
   * for invalid SMILES, unavailable AuxInfo accessors, or unparseable AuxInfo.
   *
   * Cache hits return immediately (including cached `null` results — re-attempting
   * extraction on every call for a SMILES whose accessor pattern doesn't expose
   * AuxInfo would be wasted work).
   *
   * Used from console probes via `_rdkitInternals.getInchiAtomMap` and from the
   * async migration harness. Sync callers in the locants module use
   * `_getInchiAtomMapSync` instead.
   *
   * @param {string} smiles
   * @returns {Promise<Map<number, number> | null>}
   * @private
   */
  async function _getInchiAtomMap(smiles) {
    if (!smiles || typeof smiles !== "string") return null;
    if (_inchiAtomMapCache.has(smiles)) return _inchiAtomMapCache.get(smiles);
    const map = await _withRdkitMol(smiles, (mol) => _extractInchiAtomMap(mol));
    _cacheInchiAtomMap(smiles, map);
    return map;
  }

  /**
   * Synchronous mirror of `_getInchiAtomMap`. Throws if RDKit is not warm —
   * caller is responsible for either pre-warming via an async render path or
   * catching the throw and falling back. Used from `mapAtomToLocant` (which
   * is sync per its contract with descriptions.js / comprehensive.js).
   *
   * Cache hits return immediately; cold cache attempts the extraction via
   * `_withRdkitMolSync` and caches the result (including null on failure).
   *
   * @param {string} smiles
   * @returns {Map<number, number> | null}
   * @private
   */
  function _getInchiAtomMapSync(smiles) {
    if (!smiles || typeof smiles !== "string") return null;
    if (_inchiAtomMapCache.has(smiles)) return _inchiAtomMapCache.get(smiles);
    if (!_rdkitModule) {
      // Don't throw — caller (locants module) treats null as "InChI path
      // unavailable" and falls back to legacy. Extraction will succeed once
      // the warm path has resolved on a later call.
      logDebug("_getInchiAtomMapSync: RDKit not warm; returning null");
      return null;
    }
    let map = null;
    try {
      map = _withRdkitMolSync(smiles, (mol) => _extractInchiAtomMap(mol));
    } catch (err) {
      logDebug("_getInchiAtomMapSync: extraction threw", {
        smiles,
        error: err && err.message,
      });
      return null;
    }
    _cacheInchiAtomMap(smiles, map);
    return map;
  }

  /**
   * Console probe — verifies the RDKit script tag is wired and the WASM
   * bundle resolves. Returns true after the first successful _getRdkit()
   * call; subsequent calls hit the warm cache.
   * @returns {Promise<boolean>}
   */
  window.testRdkitAvailable = async function () {
    const rdkit = await _getRdkit();
    if (!rdkit) {
      console.error("testRdkitAvailable: RDKit not available");
      return false;
    }
    const version = rdkit.version ? rdkit.version() : "unknown";
    console.log("testRdkitAvailable: RDKit ready, version =", version);
    return true;
  };

  /**
   * Phase 12-2a console probe — runs the RDKit translator for one SMILES and
   * returns the resulting SmilesDrawer-shape graph object plus a stats summary
   * (vertex/edge/aromatic/ring counts). Useful for eyeball checks against
   * known fixtures during translator development:
   *   await window.testRdkitGraph("Cn1c(=O)c2c(ncn2C)n(C)c1=O");  // caffeine
   *   await window.testRdkitGraph("c1ccncc1");                      // pyridine
   *   await window.testRdkitGraph("c1ccc2ccccc2c1");                // naphthalene
   * @param {string} smiles
   * @returns {Promise<{graph, rings, ringConnections, _stats} | null>}
   */
  window.testRdkitGraph = async function (smiles) {
    const graphData = await _extractGraphFromRdkit(smiles);
    if (!graphData) {
      console.error("testRdkitGraph: translator returned null for", smiles);
      return null;
    }
    const vertices = graphData.graph.vertices;
    const edges = graphData.graph.edges;
    const aromaticVertices = vertices.filter(
      (v) => v.value && v.value._rdkit && v.value._rdkit.aromatic,
    ).length;
    const aromaticEdges = edges.filter(
      (e) => e.isPartOfAromaticRing === true,
    ).length;
    const stats = {
      smiles,
      vertices: vertices.length,
      edges: edges.length,
      aromaticVertices,
      aromaticEdges,
      rings: graphData.rings.length,
      fusedRings: graphData.rings.filter((r) => r.isFused).length,
      spiroRings: graphData.rings.filter((r) => r.isSpiro).length,
      bridgedRings: graphData.rings.filter((r) => r.isBridged).length,
    };
    console.log("testRdkitGraph stats:", stats);
    graphData._stats = stats;
    return graphData;
  };

  // =========================================================================
  // Expose public API
  // =========================================================================

  logInfo(
    "MathPixChemistryUtils initialised (Phase 5B-1 + 5C-2 + 5D-1 + 5E-1 + 6A + 6C + 6G + 7A + 7A-2 + 8C + 12-0c + 12-1a + 12-1d — renderStructure* now RDKit-backed; visible SVG + Save-as-SVG cache + DPR exports + CoordGen orientation; SmilesDrawer retained only for graph-cache bridge until 12-2a)",
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
    awaitGraphCached, // Phase 12-2b — populated-cache guarantee for cold-start
    getLastRenderedSvgString, // Phase 12-1d
    lookupPubChem, // Phase 5D-1
    lookupPubChemBySmiles, // Phase 6A
    buildPubChemUrl, // Phase 5D-1
    clearPubChemCache, // Phase 5D-1
    _buildPubchemDataFromItem, // Phase 12-5c-1 (D1 = B): single normaliser shared by post-OCR + session-restore
    getDescriptionService, // Phase 5E-1
    getNamedAromaticLabel,  // Phase 12-5c-3 (D3 = A): single source for named-aromatic ring labels
    getNamedAromaticPhrase, // Phase 12-5c-3 (D3 = A): single source for named-aromatic ring prose
    analyseStructure: null, // Phase 7A — populated by mathpix-chemistry-descriptions.js
    generateStructuralDescription: null, // Phase 7A-2 — populated by mathpix-chemistry-descriptions.js
    generateStructuralDescriptionForAria: null, // Phase 8C-6 — populated by mathpix-chemistry-descriptions.js
    generateShortDescription: null, // Phase 8C-ST — populated by mathpix-chemistry-descriptions.js
    generateShortDescriptionForAria: null, // Phase 8C-ST — populated by mathpix-chemistry-descriptions.js
    clearGraphCache: function () { _graphCache.clear(); }, // Phase 7A-4 (testing)
    getActivePreset, // Phase 7C-1
    setActivePreset, // Phase 7C-1
    setCustomOptions, // Phase 7C-3
    getCustomOptions, // Phase 7C-3
    presetToUIShape, // Phase 12-4c (C3.5) — RDKit-shape preset → SmilesDrawer-shape UI translator
    readChemistrySettingsFromZip, // Phase 7C-6
    // Phase 8C refactor: shared internals for mathpix-chemistry-descriptions.js
    _descriptionInternals: {
      graphCache: _graphCache,
      getCachedGraph: _getCachedGraph, // Phase 12-5c-2 (D2 = C): single read-side chokepoint
      namedAromaticRings: NAMED_AROMATIC_RINGS, // Phase 12-5c-3 (D3 = A): mirror for diagnostic probes; consumers prefer top-level helpers
      featureFlags: FEATURE_FLAGS,
      formatFormulaUnicode: _formatFormulaUnicode,
    },
    // Phase 12-5b-1: PubChem heuristic accessors for tests + diagnostic probes.
    // _isLikelyEnglishCommonName is the shared filter (F2/F3/F4/F-DB after the
    // 12-5b-1 design pivot); _smartTitleCase is the display normaliser. Both
    // are inlined into _buildPublicResult on every lookup; exposed here so
    // tests can compute "afterFilter" counts from raw synonyms without
    // duplicating filter logic.
    _pubchemInternals: {
      isLikelyEnglishCommonName: _isLikelyEnglishCommonName,
      smartTitleCase: _smartTitleCase,
      // Phase 12-5c-1: also surfaced on top-level public API; mirrored here
      // for symmetry with the _descriptionInternals/_rdkitInternals pattern.
      buildPubchemDataFromItem: _buildPubchemDataFromItem,
    },
    // Phase 12-0c: RDKit runtime accessors for cross-file consumers
    // (mathpix-chemistry-comprehensive.js, -descriptions.js, -locants.js,
    // mathpix-result-renderer.js). Kept separate from _descriptionInternals
    // because RDKit access is a runtime concern, not a description-engine one.
    // Consumed by 12-1a onwards; unused at 12-0c commit time.
    _rdkitInternals: {
      getRdkit: _getRdkit,
      withRdkitMol: _withRdkitMol,
      // Phase 12-2a: graph-extraction shim. Async translator that consumes
      // RDKit's get_json() output and emits the SmilesDrawer-shape graph.
      // Used by the migration harness's auditMigrationDiff RDKit branch and
      // by the testRdkitGraph console probe. Production callers route through
      // _populateGraphCache's flag dispatch (12-2b); this export exists for
      // diff verification and translator inspection.
      extractGraphFromRdkit: _extractGraphFromRdkit,
      // Phase 12-3a: InChI auxinfo → input-atom-index → InChI-canonical-number
      // map. Async (cache-warming + console probes); sync (used by locants
      // module's _buildLocantMapFromInchi, which is itself sync).
      getInchiAtomMap: _getInchiAtomMap,
      getInchiAtomMapSync: _getInchiAtomMapSync,
    },
  };
})();

// Expose globally
window.MathPixChemistryUtils = MathPixChemistryUtils;

