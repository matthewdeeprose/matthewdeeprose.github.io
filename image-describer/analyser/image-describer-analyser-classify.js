/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — HEURISTIC CLASSIFIER (Phase 5A)
 * ═══════════════════════════════════════════════════════════════
 *
 * Takes a completed ImageAnalysisResult and suggests which
 * analysis profile best matches the image, using rules based
 * on existing OCR and colour data.
 *
 * Zero new dependencies — uses only data already produced by
 * the OCR and colour analysers.
 *
 * Public API:
 *   suggestProfile(analysisResult) → ClassificationResult
 *   scoreChart(ocr, colour)       → number (0–1)
 *   scoreDiagram(ocr, colour)     → number (0–1)
 *   scoreMap(ocr, colour)         → number (0–1)
 *   scoreEquation(ocr)            → number (0–1)
 *   scorePhotograph(ocr, colour)  → number (0–1)
 *   scorePainting(ocr, colour)    → number (0–1)
 *   getNumericItemRatio(items)    → number (0–1)
 *   hasGeographicTerms(items)     → boolean
 *   hasMathematicalSymbols(items) → boolean
 *   getColourDiversity(colour)    → number
 *
 * VERSION: 1.0.0
 * DATE: 15 March 2026
 * PHASE: Local Analysis — Phase 5A (heuristic classifier)
 * ═══════════════════════════════════════════════════════════════
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
      console.error(`[AnalyserClassify] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserClassify] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserClassify] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserClassify] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /** Minimum confidence to make a suggestion */
  const CONFIDENCE_THRESHOLD = 0.5;

  /** Geographic terms for map detection (case-insensitive) */
  const GEOGRAPHIC_TERMS = [
    // Scale and legend terms
    "km", "miles", "scale", "legend", "key",
    // Direction terms
    "north", "south", "east", "west",
    // Common country/region names in academic maps
    "china", "india", "usa", "europe", "africa", "asia",
    "pacific", "atlantic", "indonesia", "japan", "brazil",
    "australia", "russia", "mexico", "canada", "myanmar",
    "france", "germany", "spain", "italy", "uk",
  ];

  /** Single-letter direction abbreviations (matched as whole words) */
  const DIRECTION_ABBREVIATIONS = ["n", "s", "e", "w"];

  /** Unicode mathematical symbols */
  const MATH_UNICODE_PATTERN = /[∂∫∑∏√≈≠≤≥±∞∝∈∉⊂⊃∪∩∆∇λθαβγδεζηικμνξπρστυφχψω]/;

  /** Text-based mathematical patterns (word boundaries) */
  const MATH_TEXT_PATTERN = /\b(sin|cos|tan|log|ln|lim|dx|dy|dt|d[a-z])\b/i;

  /** Caret notation for exponents */
  const MATH_CARET_PATTERN = /[a-zA-Z]\^\d|[a-zA-Z]\^[a-zA-Z]/;

  /** Fraction-like patterns */
  const MATH_FRACTION_PATTERN = /\b\d+\/\d+\b/;

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Returns the ratio of OCR items that contain numeric content.
   * Items with digits, decimal points, percentages, or currency symbols
   * are counted as numeric.
   *
   * @param {Array} ocrItems — array of OCR item objects with .text
   * @returns {number} ratio 0–1
   */
  function getNumericItemRatio(ocrItems) {
    if (!ocrItems || ocrItems.length === 0) return 0;

    const numericPattern = /\d/;
    const numericCount = ocrItems.filter((item) =>
      numericPattern.test(item.text)
    ).length;

    return numericCount / ocrItems.length;
  }

  /**
   * Checks whether OCR items contain geographic terms indicating a map.
   *
   * @param {Array} ocrItems — array of OCR item objects with .text
   * @returns {boolean}
   */
  function hasGeographicTerms(ocrItems) {
    if (!ocrItems || ocrItems.length === 0) return false;

    // Combine all text for efficient searching
    const allText = ocrItems.map((item) => item.text.toLowerCase()).join(" ");

    // Check multi-character geographic terms
    for (const term of GEOGRAPHIC_TERMS) {
      if (allText.includes(term)) return true;
    }

    // Check single-letter direction abbreviations as whole words
    const words = allText.split(/\s+/);
    for (const abbrev of DIRECTION_ABBREVIATIONS) {
      if (words.includes(abbrev)) return true;
    }

    return false;
  }

  /**
   * Checks whether OCR items contain mathematical symbols or patterns.
   *
   * @param {Array} ocrItems — array of OCR item objects with .text
   * @returns {boolean}
   */
  function hasMathematicalSymbols(ocrItems) {
    if (!ocrItems || ocrItems.length === 0) return false;

    for (const item of ocrItems) {
      const text = item.text;
      if (MATH_UNICODE_PATTERN.test(text)) return true;
      if (MATH_TEXT_PATTERN.test(text)) return true;
      if (MATH_CARET_PATTERN.test(text)) return true;
      if (MATH_FRACTION_PATTERN.test(text)) return true;
    }

    return false;
  }

  /**
   * Counts the number of distinct hue families across colour regions.
   * Groups hues into 30° buckets (12 families) and counts how many
   * are represented. Achromatic colours (very low saturation) are
   * counted as one additional family.
   *
   * @param {object} colourResult — ColourAnalysisResult with .regions
   * @returns {number} count of distinct hue families
   */
  function getColourDiversity(colourResult) {
    if (!colourResult || !colourResult.regions || colourResult.regions.length === 0) {
      return 0;
    }

    const hueBuckets = new Set();
    let hasAchromatic = false;

    for (const region of colourResult.regions) {
      // Use saturation to detect achromatic regions
      if (region.avgSaturation !== undefined && region.avgSaturation < 0.1) {
        hasAchromatic = true;
        continue;
      }

      // If region has palette-like HSL data via colourName, we need hue
      // Regions have avgLuminance and avgSaturation but not direct hue
      // Use the colourName as a proxy for hue family
      if (region.colourName) {
        hueBuckets.add(region.colourName);
      }
    }

    // Also check palette for more accurate hue diversity
    if (colourResult.palette && colourResult.palette.length > 0) {
      const paletteHueBuckets = new Set();
      let paletteAchromatic = false;

      for (const entry of colourResult.palette) {
        if (entry.hsl) {
          const saturation = entry.hsl[1];
          if (saturation < 0.1) {
            paletteAchromatic = true;
            continue;
          }
          // Group into 30° hue buckets
          const hueBucket = Math.floor(entry.hsl[0] / 30);
          paletteHueBuckets.add(hueBucket);
        }
      }

      // Use whichever gives more diversity (palette is usually more accurate)
      const paletteDiversity = paletteHueBuckets.size + (paletteAchromatic ? 1 : 0);
      const regionDiversity = hueBuckets.size + (hasAchromatic ? 1 : 0);

      return Math.max(paletteDiversity, regionDiversity);
    }

    return hueBuckets.size + (hasAchromatic ? 1 : 0);
  }

  // ============================================================================
  // SCORING METHODS
  // ============================================================================

  /**
   * Scores likelihood of being a chart.
   * Charts typically have high OCR density with numeric content
   * and a limited colour palette.
   *
   * @param {object} ocr — OCR analysis result
   * @param {object} colour — Colour analysis result
   * @returns {number} score 0–1
   */
  function scoreChart(ocr, colour) {
    if (!ocr || ocr.status !== "complete") return 0;

    const items = ocr.items || [];
    const itemCount = items.length;
    const numericRatio = getNumericItemRatio(items);
    const paletteSize = colour?.palette?.length || 0;

    let score = 0;

    // Primary signal: many OCR items with high numeric ratio
    if (itemCount > 15 && numericRatio > 0.4) {
      score = 0.7;

      // Boost for very high numeric density
      if (numericRatio > 0.6) score += 0.1;

      // Boost for limited palette (charts use distinct colours)
      if (paletteSize > 0 && paletteSize <= 6) score += 0.05;
    } else if (itemCount > 10 && numericRatio > 0.5) {
      // Moderate signal: fewer items but very numeric
      score = 0.55;
    }

    return Math.min(score, 1);
  }

  /**
   * Scores likelihood of being a diagram.
   * Diagrams typically have moderate OCR (labels, arrows) with
   * a limited colour palette and no strong numeric bias.
   *
   * @param {object} ocr — OCR analysis result
   * @param {object} colour — Colour analysis result
   * @returns {number} score 0–1
   */
  function scoreDiagram(ocr, colour) {
    if (!ocr || ocr.status !== "complete") return 0;

    const items = ocr.items || [];
    const itemCount = items.length;
    const numericRatio = getNumericItemRatio(items);
    const diversity = getColourDiversity(colour);

    let score = 0;

    // Primary signal: some OCR with low colour diversity, not numeric-heavy
    // Uses colourDiversity (distinct hue families) rather than raw palette
    // size, because palette is always 5 entries even for achromatic images
    if (itemCount >= 2 && itemCount <= 25 && diversity <= 5) {
      if (numericRatio < 0.4) {
        score = 0.55;

        // Boost for very low diversity (line diagrams, mostly achromatic)
        if (diversity <= 3) score += 0.1;

        // Slight boost for lower item counts (simpler diagrams)
        if (itemCount <= 10) score += 0.05;
      }
    } else if (itemCount === 1 && diversity <= 4) {
      // Very simple diagrams (single label)
      // With only 1 item, numeric ratio is binary (0 or 1) and unreliable
      // so we skip that check here
      score = 0.5;
    }

    return Math.min(score, 1);
  }

  /**
   * Scores likelihood of being a map.
   * Maps typically contain geographic terms, have a gradient
   * (terrain/heat maps), and moderate OCR item counts.
   *
   * @param {object} ocr — OCR analysis result
   * @param {object} colour — Colour analysis result
   * @returns {number} score 0–1
   */
  function scoreMap(ocr, colour) {
    if (!ocr || ocr.status !== "complete") return 0;

    const items = ocr.items || [];
    const itemCount = items.length;
    const hasGeoTerms = hasGeographicTerms(items);

    // Gradient: use gradientDirection and luminanceRange as proxy for strength
    const hasGradient = colour
      && colour.gradientDirection
      && colour.gradientDirection !== "uniform";
    const luminanceRange = colour?.luminanceRange || 0;

    let score = 0;

    // Primary signal: geographic terms present
    if (hasGeoTerms) {
      score = 0.6;

      // Boost for gradient presence (heat maps, terrain)
      if (hasGradient && luminanceRange > 0.15) score += 0.1;

      // Boost for moderate item count (typical label density)
      if (itemCount >= 10 && itemCount <= 60) score += 0.05;
    } else if (hasGradient && luminanceRange > 0.3 && itemCount >= 5 && itemCount <= 40) {
      // Weaker signal: gradient with moderate labels but no geo terms
      score = 0.4;
    }

    return Math.min(score, 1);
  }

  /**
   * Scores likelihood of being a mathematical equation.
   * Equations contain mathematical symbols, Greek letters,
   * or common function names.
   *
   * @param {object} ocr — OCR analysis result
   * @returns {number} score 0–1
   */
  function scoreEquation(ocr) {
    if (!ocr || ocr.status !== "complete") return 0;

    const items = ocr.items || [];
    const hasMath = hasMathematicalSymbols(items);

    if (!hasMath) return 0;

    let score = 0.6;

    // Count how many items contain mathematical content
    let mathItemCount = 0;
    for (const item of items) {
      const text = item.text;
      if (
        MATH_UNICODE_PATTERN.test(text) ||
        MATH_TEXT_PATTERN.test(text) ||
        MATH_CARET_PATTERN.test(text)
      ) {
        mathItemCount++;
      }
    }

    // Boost for multiple mathematical items
    if (mathItemCount >= 3) score += 0.1;
    if (mathItemCount >= 5) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Scores likelihood of being a photograph.
   * Photographs typically have very low OCR (no text) and
   * high colour diversity with smooth gradients.
   *
   * @param {object} ocr — OCR analysis result
   * @param {object} colour — Colour analysis result
   * @returns {number} score 0–1
   */
  function scorePhotograph(ocr, colour) {
    const items = ocr?.items || [];
    const itemCount = items.length;
    const diversity = getColourDiversity(colour);

    // Photographs: very few text items, rich colour
    const hasGradient = colour
      && colour.gradientDirection
      && colour.gradientDirection !== "uniform";

    let score = 0;

    if (itemCount <= 2 && diversity > 8) {
      score = 0.55;

      // Slight penalty for strong gradient (more likely a map)
      if (hasGradient && (colour?.luminanceRange || 0) > 0.3) {
        score -= 0.1;
      }
    } else if (itemCount === 0 && diversity > 5) {
      // No text at all with moderate diversity
      score = 0.5;
    }

    // Also consider OCR that failed or timed out with high diversity
    if (ocr && ocr.status === "complete" && itemCount <= 2 && diversity >= 6) {
      score = Math.max(score, 0.5);
    }

    return Math.max(score, 0);
  }

  /**
   * Scores likelihood of being a painting.
   * Paintings often cause OCR timeout (complex textures) or have
   * very high noise suppression ratios (OCR detects artefacts).
   *
   * @param {object} ocr — OCR analysis result
   * @param {object} colour — Colour analysis result
   * @returns {number} score 0–1
   */
  function scorePainting(ocr, colour) {
    let score = 0;

    // Primary signal: OCR timed out (complex texture overwhelms OCR)
    if (ocr && ocr.status === "timed-out") {
      score = 0.6;
    }

    // Secondary signal: high suppression ratio (lots of noise detected)
    if (ocr && ocr.suppressionStats) {
      const ss = ocr.suppressionStats;
      if (ss.total > 0) {
        const suppressionRatio = ss.suppressed / ss.total;
        if (suppressionRatio > 0.6) {
          score = Math.max(score, 0.55);

          // Boost for very high suppression
          if (suppressionRatio > 0.8) score = Math.max(score, 0.6);
        }
      }
    }

    // Slight boost for high colour diversity (rich palette in paintings)
    const diversity = getColourDiversity(colour);
    if (diversity > 6 && score > 0) {
      score += 0.05;
    }

    return Math.min(score, 1);
  }

  // ============================================================================
  // MAIN CLASSIFICATION METHOD
  // ============================================================================

  /**
   * Analyses a completed ImageAnalysisResult and suggests the most
   * appropriate profile based on heuristic rules.
   *
   * @param {object} analysisResult — completed ImageAnalysisResult
   * @returns {object} ClassificationResult
   */
  function suggestProfile(analysisResult, clipResult) {
    // Edge case: null or undefined input
    if (!analysisResult) {
      return {
        profile: null,
        confidence: 0,
        reason: "No analysis data",
        source: "heuristic",
        scores: {},
      };
    }

    const ocr = analysisResult.ocr || null;
    const colour = analysisResult.colour || null;

    // Edge case: both null
    if (!ocr && !colour) {
      return {
        profile: null,
        confidence: 0,
        reason: "No OCR or colour data available",
        source: "heuristic",
        scores: {},
      };
    }

    // Calculate all heuristic scores
    const scores = {
      chart: scoreChart(ocr, colour),
      diagram: scoreDiagram(ocr, colour),
      map: scoreMap(ocr, colour),
      equation: scoreEquation(ocr),
      photograph: scorePhotograph(ocr, colour),
      painting: scorePainting(ocr, colour),
    };

    logDebug("Heuristic scores:", scores);

    // Find the highest-scoring heuristic profile
    let bestProfile = null;
    let bestScore = 0;

    for (const [profile, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestProfile = profile;
      }
    }

    // Check if CLIP data is available (Phase 5B-2)
    if (clipResult && clipResult.status === "success" && clipResult.topConfidence > 0.3) {
      const profiles = window.ImageDescriberAnalyserProfiles;
      const clipProfile = profiles.LABEL_TO_PROFILE?.[clipResult.topLabel] || null;

      if (clipProfile) {
        logInfo(
          `CLIP suggests: ${clipProfile} via "${clipResult.topLabel}" (${(clipResult.topConfidence * 100).toFixed(0)}%)`,
        );

        return {
          profile: clipProfile,
          confidence: clipResult.topConfidence,
          reason: `CLIP identified as "${clipResult.topLabel}" (${(clipResult.topConfidence * 100).toFixed(0)}% confidence)`,
          source: "clip",
          scores,
          heuristic: { profile: bestProfile, confidence: bestScore },
        };
      }
    }

    // Only suggest heuristic if confidence exceeds threshold
    if (bestScore < CONFIDENCE_THRESHOLD) {
      logInfo(
        `No profile exceeded confidence threshold (best: ${bestProfile} at ${bestScore.toFixed(2)})`,
      );
      return {
        profile: null,
        confidence: 0,
        reason: "Insufficient signal for classification",
        source: "heuristic",
        scores,
      };
    }

    // Build human-readable reason
    const reason = buildReason(bestProfile, ocr, colour, scores);

    logInfo(
      `Suggested profile: ${bestProfile} (confidence: ${(bestScore * 100).toFixed(0)}%)`,
    );

    return {
      profile: bestProfile,
      confidence: bestScore,
      reason,
      source: "heuristic",
      scores,
    };
  }

  /**
   * Builds a human-readable explanation for the classification.
   *
   * @param {string} profile — the suggested profile
   * @param {object} ocr — OCR result
   * @param {object} colour — Colour result
   * @param {object} scores — all profile scores
   * @returns {string}
   */
  function buildReason(profile, ocr, colour, scores) {
    const items = ocr?.items || [];
    const itemCount = items.length;

    switch (profile) {
      case "chart":
        return `High OCR density (${itemCount} items) with ${Math.round(getNumericItemRatio(items) * 100)}% numeric content`;

      case "diagram":
        return `Moderate OCR (${itemCount} items) with limited colour palette`;

      case "map":
        return `Geographic terms detected in OCR text` +
          (colour?.gradientDirection && colour.gradientDirection !== "uniform"
            ? ` with ${colour.gradientDirection} gradient`
            : "");

      case "equation":
        return "Mathematical symbols or notation detected in OCR text";

      case "photograph":
        return `Very low text content (${itemCount} items) with high colour diversity`;

      case "painting":
        if (ocr?.status === "timed-out") {
          return "OCR timed out — complex texture suggests a painting or artwork";
        }
        if (ocr?.suppressionStats) {
          const ratio = ocr.suppressionStats.total > 0
            ? Math.round((ocr.suppressionStats.suppressed / ocr.suppressionStats.total) * 100)
            : 0;
          return `High noise suppression ratio (${ratio}%) suggests non-textual image`;
        }
        return "Image characteristics suggest a painting or artwork";

      default:
        return "Classification based on heuristic analysis";
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserClassify = {
    suggestProfile,
    scoreChart,
    scoreDiagram,
    scoreMap,
    scoreEquation,
    scorePhotograph,
    scorePainting,
    getNumericItemRatio,
    hasGeographicTerms,
    hasMathematicalSymbols,
    getColourDiversity,
  };

  logInfo("Heuristic classifier loaded (Phase 5A)");
})();
