/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — OCR ENGINE
 * ═══════════════════════════════════════════════════════════════
 *
 * Tesseract.js OCR engine wrapper:
 *   - Worker creation and reuse (_ensureTesseract)
 *   - 2× upscaling for improved small-label detection
 *   - Timeout handling with graceful failure
 *   - PSM 11 (sparse text) mode for scattered diagram labels
 *   - Coordinate normalisation to 0–1 range
 *
 * Depends on: window.ImageDescriberAnalyserUtils
 * External:   Tesseract.js v5 (loaded via CDN script tag)
 *
 * VERSION: 2.0.0
 * DATE: 8 March 2026
 * PHASE: Local Analysis — Phase 2 (file split)
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
      console.error(`[AnalyserOCR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserOCR] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserOCR] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserOCR] ${message}`, ...args);
  }

  // ============================================================================
  // DEPENDENCY REFERENCES
  // ============================================================================

  /** Shorthand reference to utils — resolved at call time, not load time */
  function utils() {
    return window.ImageDescriberAnalyserUtils;
  }

  // ============================================================================
  // WORKER STATE
  // ============================================================================

  /** Shared Tesseract worker — reused across calls */
  let _tesseractWorker = null;
  let _tesseractReady = false;

  // ============================================================================
  // WORKER MANAGEMENT
  // ============================================================================

  /**
   * Creates or reuses the Tesseract worker.
   * Emits library:status events via EmbedEventEmitter for the expert panel
   * status indicator (Phase 4B).
   */
  async function ensureTesseract() {
    if (_tesseractWorker && _tesseractReady) return;

    const startTime = performance.now();

    // Emit loading status
    if (window.EmbedEventEmitter) {
      window.EmbedEventEmitter.emit("library:status", {
        library: "tesseract",
        status: "loading",
      });
    }

    try {
      logDebug("Creating Tesseract worker...");
      _tesseractWorker = await Tesseract.createWorker("eng");
      // Sparse text mode (PSM 11): finds isolated text fragments in any order.
      // Critical for academic diagrams with scattered single-character labels.
      await _tesseractWorker.setParameters({
        tessedit_pageseg_mode: "11",
      });
      _tesseractReady = true;

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      const probablyCached = parseFloat(elapsed) < 1.0;

      logInfo(
        `Tesseract worker created and ready (PSM 11 sparse text mode) — ${elapsed}s${probablyCached ? " (cached)" : ""}`,
      );

      // Emit ready status with timing
      if (window.EmbedEventEmitter) {
        window.EmbedEventEmitter.emit("library:status", {
          library: "tesseract",
          status: "ready",
          elapsed: elapsed,
          cached: probablyCached,
        });
      }
    } catch (err) {
      _tesseractWorker = null;
      _tesseractReady = false;

      logError("Tesseract worker creation failed:", err.message);

      // Emit error status
      if (window.EmbedEventEmitter) {
        window.EmbedEventEmitter.emit("library:status", {
          library: "tesseract",
          status: "error",
          error: err.message,
        });
      }

      throw err;
    }
  }

  /**
   * Terminates the Tesseract worker and cleans up.
   */
  async function destroyWorker() {
    if (_tesseractWorker) {
      try {
        await _tesseractWorker.terminate();
        logInfo("Tesseract worker terminated");
      } catch (err) {
        logWarn("Error terminating Tesseract worker:", err.message);
      }
      _tesseractWorker = null;
      _tesseractReady = false;
    }
  }

  /**
   * Returns a reference to the current Tesseract worker (for cancellation).
   * @returns {object|null}
   */
  function getWorker() {
    return _tesseractWorker;
  }

  // ============================================================================
  // NOISE SUPPRESSION (Phase 4D)
  // ============================================================================

  /** Regex matching strings that consist entirely of punctuation, symbols, or whitespace */
  const PUNCTUATION_ONLY_PATTERN = /^[\p{P}\p{S}\s~_|]+$/u;

  /**
   * Applies noise suppression heuristics to OCR items.
   * Heuristics run in order: A (short text), B (punctuation),
   * C (duplicates by proximity), D (low-confidence + short).
   *
   * @param {Array} items — OCR items from recogniseCanvas/merge
   * @param {object} suppressionConfig — profile's suppression settings
   * @returns {{ filtered: Array, suppressed: Array, stats: object }}
   */
  function suppressNoise(items, suppressionConfig) {
    if (!suppressionConfig || !suppressionConfig.enabled) {
      return {
        filtered: items,
        suppressed: [],
        stats: {
          total: items.length,
          kept: items.length,
          suppressed: 0,
          reasons: {},
        },
      };
    }

    const suppressed = [];
    const reasons = {};

    /**
     * Records a suppressed item with its reason.
     * @param {object} item — OCR item being suppressed
     * @param {string} reason — human-readable reason key
     */
    function suppress(item, reason) {
      suppressed.push(Object.assign({}, item, { suppressionReason: reason }));
      reasons[reason] = (reasons[reason] || 0) + 1;
    }

    // ── Heuristic A: Very short text filter ──
    // Suppress items where text.length <= N AND confidence < threshold
    const shortConf = suppressionConfig.shortTextMinConfidence || {};
    let remaining = [];

    for (const item of items) {
      const len = item.text.length;
      const threshold = shortConf[len];
      if (threshold !== undefined && item.confidence < threshold) {
        suppress(item, "shortText");
      } else {
        remaining.push(item);
      }
    }

    // ── Heuristic B: Punctuation / special character filter ──
    if (suppressionConfig.punctuationFilter) {
      const afterPunct = [];
      for (const item of remaining) {
        if (PUNCTUATION_ONLY_PATTERN.test(item.text)) {
          suppress(item, "punctuation");
        } else {
          afterPunct.push(item);
        }
      }
      remaining = afterPunct;
    }

    // ── Heuristic C: Duplicate text filter (spatial proximity) ──
    const proximity = suppressionConfig.duplicateProximity;
    if (proximity !== undefined && proximity > 0) {
      // Group items by normalised text (case-insensitive, trimmed)
      const textGroups = new Map();
      for (const item of remaining) {
        const key = item.text.trim().toLowerCase();
        if (!textGroups.has(key)) {
          textGroups.set(key, []);
        }
        textGroups.get(key).push(item);
      }

      // For groups with 2+ items, keep highest confidence within proximity
      const duplicateIndices = new Set();
      for (const [, group] of textGroups) {
        if (group.length < 2) continue;

        // Sort by confidence descending so the best item is first
        group.sort((a, b) => b.confidence - a.confidence);

        for (let i = 1; i < group.length; i++) {
          // Check distance from the kept item (index 0) to this one
          const kept = group[0];
          const candidate = group[i];
          const dx =
            kept.bounds.x +
            kept.bounds.w / 2 -
            (candidate.bounds.x + candidate.bounds.w / 2);
          const dy =
            kept.bounds.y +
            kept.bounds.h / 2 -
            (candidate.bounds.y + candidate.bounds.h / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < proximity) {
            // Mark for suppression — use the index in remaining array
            duplicateIndices.add(candidate);
          }
        }
      }

      if (duplicateIndices.size > 0) {
        const afterDedup = [];
        for (const item of remaining) {
          if (duplicateIndices.has(item)) {
            suppress(item, "duplicate");
          } else {
            afterDedup.push(item);
          }
        }
        remaining = afterDedup;
      }
    }

    return {
      filtered: remaining,
      suppressed,
      stats: {
        total: items.length,
        kept: remaining.length,
        suppressed: suppressed.length,
        reasons,
      },
    };
  }

  // ============================================================================
  // LINE GROUPING (Phase 6C)
  // ============================================================================

  /**
   * Groups spatially adjacent OCR words into lines/phrases.
   * Uses geometric proximity: vertical overlap to find same-line items,
   * then horizontal gap to merge adjacent words left-to-right.
   *
   * @param {Array} items — OCR items (after dual-pass merge, before suppression)
   * @param {object} groupingConfig — { enabled, maxVerticalOverlap, maxHorizontalGap }
   * @returns {Array} items with adjacent words merged into line-level phrases
   */
  function groupIntoLines(items, groupingConfig) {
    if (!groupingConfig || groupingConfig.enabled === false || items.length < 2) {
      return items;
    }

    const u = utils();
    const maxVertOverlap = groupingConfig.maxVerticalOverlap || 0.5;
    const maxHorizGap = groupingConfig.maxHorizontalGap || 1.5;

    // ── Step 1: Vertical grouping — find items on the same text line ──
    // Sort by Y-centre
    const sorted = items.slice().sort((a, b) => {
      const aCy = a.bounds.y + a.bounds.h / 2;
      const bCy = b.bounds.y + b.bounds.h / 2;
      return aCy - bCy;
    });

    const verticalGroups = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      const curr = sorted[i];

      const prevCy = prev.bounds.y + prev.bounds.h / 2;
      const currCy = curr.bounds.y + curr.bounds.h / 2;
      const shorterH = Math.min(prev.bounds.h, curr.bounds.h);

      // If vertical centres are within threshold of shorter item's height
      if (shorterH > 0 && Math.abs(currCy - prevCy) <= maxVertOverlap * shorterH) {
        currentGroup.push(curr);
      } else {
        verticalGroups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    verticalGroups.push(currentGroup);

    // ── Step 2: Horizontal merging within each vertical group ──
    const result = [];

    for (const group of verticalGroups) {
      if (group.length === 1) {
        result.push(group[0]);
        continue;
      }

      // Sort left-to-right by X position
      group.sort((a, b) => a.bounds.x - b.bounds.x);

      let merged = group[0];
      let children = merged.children ? merged.children.slice() : [merged];

      for (let i = 1; i < group.length; i++) {
        const next = group[i];
        const mergedRight = merged.bounds.x + merged.bounds.w;
        const gap = next.bounds.x - mergedRight;

        // Estimate average character width from the current merged item
        const avgCharWidth = merged.text.length > 0
          ? merged.bounds.w / merged.text.length
          : merged.bounds.w;

        if (avgCharWidth > 0 && gap <= maxHorizGap * avgCharWidth) {
          // Merge: combine text, encompassing bounds, min confidence
          const nextChildren = next.children ? next.children.slice() : [next];
          children = children.concat(nextChildren);

          const newX = Math.min(merged.bounds.x, next.bounds.x);
          const newY = Math.min(merged.bounds.y, next.bounds.y);
          const newRight = Math.max(mergedRight, next.bounds.x + next.bounds.w);
          const newBottom = Math.max(
            merged.bounds.y + merged.bounds.h,
            next.bounds.y + next.bounds.h
          );

          merged = {
            text: merged.text + " " + next.text,
            confidence: Math.min(merged.confidence, next.confidence),
            bounds: {
              x: parseFloat(newX.toFixed(4)),
              y: parseFloat(newY.toFixed(4)),
              w: parseFloat((newRight - newX).toFixed(4)),
              h: parseFloat((newBottom - newY).toFixed(4)),
            },
            quadrant: u.getQuadrant({ x: newX, y: newY, w: newRight - newX, h: newBottom - newY }),
            level: "line",
            nearbyColour: null,
            isNumeric: false,
            children: children,
          };
        } else {
          // Gap too large — emit current merged item and start fresh
          if (children.length > 1) {
            result.push(merged);
          } else {
            // Single item — pass through unchanged
            result.push(children[0]);
          }
          merged = next;
          children = next.children ? next.children.slice() : [next];
        }
      }

      // Emit final item in this vertical group
      if (children.length > 1) {
        result.push(merged);
      } else {
        result.push(children[0]);
      }
    }

    return result;
  }

  // ============================================================================
  // DUAL-PASS MERGE
  // ============================================================================

  /**
   * Calculates Intersection over Union (IoU) for two normalised bounding boxes.
   * Each box is { x, y, w, h } in 0–1 coordinates.
   *
   * @param {object} a — first bounding box
   * @param {object} b — second bounding box
   * @returns {number} IoU value (0–1)
   */
  function calculateIoU(a, b) {
    const aRight = a.x + a.w;
    const aBottom = a.y + a.h;
    const bRight = b.x + b.w;
    const bBottom = b.y + b.h;

    const interLeft = Math.max(a.x, b.x);
    const interTop = Math.max(a.y, b.y);
    const interRight = Math.min(aRight, bRight);
    const interBottom = Math.min(aBottom, bBottom);

    const interWidth = Math.max(0, interRight - interLeft);
    const interHeight = Math.max(0, interBottom - interTop);
    const interArea = interWidth * interHeight;

    const aArea = a.w * a.h;
    const bArea = b.w * b.h;
    const unionArea = aArea + bArea - interArea;

    if (unionArea === 0) return 0;
    return interArea / unionArea;
  }

  /**
   * Merges OCR items from two passes, deduplicating by spatial overlap.
   * Primary items always win when overlap is detected.
   *
   * @param {Array} primaryItems — items from colour canvas pass (authoritative)
   * @param {Array} secondaryItems — items from preprocessed canvas pass
   * @param {number} [overlapThreshold=0.3] — IoU threshold for considering items as duplicates
   * @returns {{ merged: Array, stats: { primary: number, secondaryAdded: number, secondaryOverlapping: number } }}
   */
  function mergeOCRResults(
    primaryItems,
    secondaryItems,
    overlapThreshold = 0.3,
  ) {
    // Tag all primary items
    const merged = primaryItems.map((item) =>
      Object.assign({}, item, { source: "primary" }),
    );

    let secondaryAdded = 0;
    let secondaryOverlapping = 0;

    for (const secItem of secondaryItems) {
      // Check if any primary item overlaps significantly
      let hasOverlap = false;
      for (const priItem of primaryItems) {
        const iou = calculateIoU(priItem.bounds, secItem.bounds);
        if (iou >= overlapThreshold) {
          hasOverlap = true;
          logDebug(
            `Overlap: secondary "${secItem.text}" overlaps primary "${priItem.text}" (IoU=${iou.toFixed(3)})`,
          );
          break;
        }
      }

      if (hasOverlap) {
        secondaryOverlapping++;
      } else {
        // No overlap — add the secondary item tagged as preprocessed
        merged.push(Object.assign({}, secItem, { source: "preprocessed" }));
        secondaryAdded++;
      }
    }

    const stats = {
      primary: primaryItems.length,
      secondaryAdded,
      secondaryOverlapping,
    };

    logDebug(
      `Merge complete: ${stats.primary} primary, ${stats.secondaryAdded} added from preprocessed, ${stats.secondaryOverlapping} overlapping (discarded)`,
    );

    return { merged, stats };
  }

  // ============================================================================
  // FLORENCE-2 ↔ TESSERACT MERGE (Phase 10D)
  // ============================================================================

  /**
   * Converts a Florence-2 quadBox (pixel coordinates) to normalised { x, y, w, h }.
   * Florence-2 returns [x1,y1, x2,y2, x3,y3, x4,y4] — four corners in pixel coords.
   * We take the axis-aligned bounding box and normalise to 0–1.
   *
   * @param {number[]} quadBox — 8-element array [x1,y1,...x4,y4] in pixels
   * @param {number} imgWidth — image width in pixels
   * @param {number} imgHeight — image height in pixels
   * @returns {{ x: number, y: number, w: number, h: number }} normalised bounds
   */
  function quadBoxToNormalisedBounds(quadBox, imgWidth, imgHeight) {
    if (
      !Array.isArray(quadBox) ||
      quadBox.length !== 8 ||
      imgWidth <= 0 ||
      imgHeight <= 0
    ) {
      logWarn("quadBoxToNormalisedBounds: invalid input", {
        quadBox,
        imgWidth,
        imgHeight,
      });
      return { x: 0, y: 0, w: 0, h: 0 };
    }

    // Extract x and y coordinates from interleaved array
    const xs = [quadBox[0], quadBox[2], quadBox[4], quadBox[6]];
    const ys = [quadBox[1], quadBox[3], quadBox[5], quadBox[7]];

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX / imgWidth,
      y: minY / imgHeight,
      w: (maxX - minX) / imgWidth,
      h: (maxY - minY) / imgHeight,
    };
  }

  /**
   * Merges Tesseract OCR items with Florence-2 OCR items.
   * Tesseract is the primary source — Florence-2 items are only added
   * when they do not spatially overlap any Tesseract item.
   *
   * @param {Array} tesseractItems — items from Tesseract (bounds already normalised)
   * @param {Array} florenceItems — items from Florence-2 ({ text, quadBox })
   * @param {number} imgWidth — image width in pixels (for quadBox conversion)
   * @param {number} imgHeight — image height in pixels (for quadBox conversion)
   * @param {number} [overlapThreshold=0.3] — IoU threshold for spatial dedup
   * @returns {{ merged: Array, stats: { tesseract: number, florenceAdded: number, florenceOverlapping: number } }}
   */
  function mergeTesseractAndFlorence(
    tesseractItems,
    florenceItems,
    imgWidth,
    imgHeight,
    overlapThreshold = 0.3,
  ) {
    // Tag Tesseract items
    const merged = (tesseractItems || []).map(function (item) {
      return Object.assign({}, item, { source: "tesseract" });
    });

    let florenceAdded = 0;
    let florenceOverlapping = 0;

    var safeFlorenceItems = florenceItems || [];
    for (var i = 0; i < safeFlorenceItems.length; i++) {
      var fItem = safeFlorenceItems[i];

      // Convert Florence-2 pixel quadBox to normalised bounds
      var fBounds = quadBoxToNormalisedBounds(
        fItem.quadBox,
        imgWidth,
        imgHeight,
      );

      // Check overlap against every Tesseract item
      var hasOverlap = false;
      for (var j = 0; j < merged.length; j++) {
        if (merged[j].source !== "tesseract") continue;
        var iou = calculateIoU(merged[j].bounds, fBounds);
        if (iou >= overlapThreshold) {
          hasOverlap = true;
          logDebug(
            'Florence-2 "' +
              fItem.text +
              '" overlaps Tesseract "' +
              merged[j].text +
              '" (IoU=' +
              iou.toFixed(3) +
              ")",
          );
          break;
        }
      }

      if (hasOverlap) {
        florenceOverlapping++;
      } else {
        // Add Florence-2 item with normalised bounds
        // Compute quadrant from normalised bounds
        var quadrant = "centre";
        var u = utils();
        if (u && typeof u.getQuadrant === "function") {
          quadrant = u.getQuadrant(fBounds);
        }
        merged.push({
          text: fItem.text,
          bounds: fBounds,
          confidence: null, // Florence-2 does not provide confidence
          source: "florence2",
          quadrant: quadrant,
          level: "word",
          nearbyColour: null,
          isNumeric: u && u.NUMERIC_PATTERN
            ? u.NUMERIC_PATTERN.test((fItem.text || "").trim())
            : false,
        });
        florenceAdded++;
      }
    }

    var stats = {
      tesseract: (tesseractItems || []).length,
      florenceAdded: florenceAdded,
      florenceOverlapping: florenceOverlapping,
    };

    logInfo(
      "Tesseract+Florence merge: " +
        stats.tesseract +
        " Tesseract, " +
        stats.florenceAdded +
        " Florence-2 added, " +
        stats.florenceOverlapping +
        " Florence-2 overlapping (discarded)",
    );

    return { merged: merged, stats: stats };
  }

  // ============================================================================
  // OCR ENGINE
  // ============================================================================

  /**
   * Runs Tesseract OCR with timeout and graceful failure.
   *
   * @param {*} imageSource — any source Tesseract.recognize() accepts
   * @param {number} imgWidth — image pixel width (for coordinate normalisation)
   * @param {number} imgHeight — image pixel height
   * @param {object} ocrConfig — OCR profile configuration
   * @returns {Promise<object>} OCRAnalysisResult
   */
  async function runOCR(imageSource, imgWidth, imgHeight, ocrConfig) {
    const u = utils();
    const ocrStart = Date.now();
    const timeout = (ocrConfig && ocrConfig.timeout) || u.TESSERACT_TIMEOUT;
    const minConfidence =
      (ocrConfig && ocrConfig.minConfidence !== undefined
        ? ocrConfig.minConfidence
        : 0.3) * 100; // Convert 0–1 threshold to Tesseract's 0–100 scale

    // Check Tesseract availability
    if (typeof Tesseract === "undefined") {
      logWarn(
        "Tesseract.js is not loaded — OCR skipped. " +
          'Add <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script> to tools.html',
      );
      return {
        status: "skipped",
        duration: Date.now() - ocrStart,
        error: "Tesseract.js not loaded",
        items: [],
        labelCount: 0,
        quadrantSummary: {
          "top-left": [],
          "top-right": [],
          "bottom-left": [],
          "bottom-right": [],
          centre: [],
        },
      };
    }

    try {
      // Ensure worker is available (reuse across calls)
      await ensureTesseract();

      // ── Primary pass: run OCR on the original (colour) canvas ──
      const primaryItems = await recogniseCanvas(
        imageSource,
        imgWidth,
        imgHeight,
        ocrConfig,
        timeout,
        u,
      );

      logDebug(`Primary pass: ${primaryItems.length} items`);

      // ── Secondary pass: run OCR on preprocessed canvas (if available) ──
      let finalItems = primaryItems;
      let mergeStats = null;
      const preprocess = window.ImageDescriberAnalyserPreprocess;

      if (preprocess && typeof preprocess.preprocessTier1 === "function") {
        try {
          if (imageSource instanceof HTMLCanvasElement) {
            const preprocessStart = Date.now();
            const preprocessedCanvas = preprocess.preprocessTier1(imageSource);
            logDebug(`Preprocessing took ${Date.now() - preprocessStart}ms`);

            const secondaryItems = await recogniseCanvas(
              preprocessedCanvas,
              imgWidth,
              imgHeight,
              ocrConfig,
              timeout,
              u,
            );

            logDebug(`Secondary pass: ${secondaryItems.length} items`);

            // Merge results — primary always wins on overlap
            const mergeResult = mergeOCRResults(primaryItems, secondaryItems);
            finalItems = mergeResult.merged;
            mergeStats = mergeResult.stats;

            logInfo(
              `Dual-pass merge: ${mergeStats.primary} primary + ${mergeStats.secondaryAdded} new from preprocessed (${mergeStats.secondaryOverlapping} overlapping discarded)`,
            );
          } else {
            logDebug("Secondary pass skipped — imageSource is not a canvas");
          }
        } catch (preprocessErr) {
          logWarn(
            "Secondary OCR pass failed — using primary-only results:",
            preprocessErr.message,
          );
          // Graceful fallback: use primary items only
        }
      } else {
        logDebug("Preprocess module not available — single-pass OCR only");
      }

      // ── Line grouping (Phase 6C) ──
      if (ocrConfig.grouping && ocrConfig.grouping.enabled !== false) {
        const beforeGrouping = finalItems.length;
        finalItems = groupIntoLines(finalItems, ocrConfig.grouping);
        logInfo(
          `Line grouping: ${beforeGrouping} items → ${finalItems.length} items`,
        );
      }

      // ── Noise suppression (Phase 4D) ──
      let suppressionStats = null;
      let suppressedItems = [];

      if (ocrConfig.suppression && ocrConfig.suppression.enabled) {
        const suppressionResult = suppressNoise(
          finalItems,
          ocrConfig.suppression,
        );
        finalItems = suppressionResult.filtered;
        suppressedItems = suppressionResult.suppressed;
        suppressionStats = suppressionResult.stats;
        logInfo(
          `Noise suppression: ${suppressionStats.suppressed} of ${suppressionStats.total} items removed` +
            (Object.keys(suppressionStats.reasons).length > 0
              ? ` (${Object.entries(suppressionStats.reasons)
                  .map(([r, c]) => `${c} ${r}`)
                  .join(", ")})`
              : ""),
        );
      }

      // Build quadrant summary from final items
      const quadrantSummary = {
        "top-left": [],
        "top-right": [],
        "bottom-left": [],
        "bottom-right": [],
        centre: [],
      };

      finalItems.forEach((item) => {
        if (quadrantSummary[item.quadrant]) {
          quadrantSummary[item.quadrant].push(item);
        }
      });

      const duration = Date.now() - ocrStart;
      logDebug(`OCR complete: ${finalItems.length} items in ${duration}ms`);

      return {
        status: "complete",
        duration,
        error: null,
        items: finalItems,
        labelCount: finalItems.length,
        quadrantSummary,
        mergeStats,
        suppressionStats,
        suppressedItems,
      };
    } catch (err) {
      const duration = Date.now() - ocrStart;
      const isTimeout = err.message.includes("timed out");

      if (isTimeout) {
        logWarn(`Tesseract OCR timed out after ${timeout}ms`);
      } else {
        logError("Tesseract OCR failed:", err.message);
      }

      return {
        status: isTimeout ? "timed-out" : "failed",
        duration,
        error: err.message,
        items: [],
        labelCount: 0,
        quadrantSummary: {
          "top-left": [],
          "top-right": [],
          "bottom-left": [],
          "bottom-right": [],
          centre: [],
        },
        mergeStats: null,
      };
    }
  }

  // ============================================================================
  // RECOGNITION HELPER
  // ============================================================================

  /**
   * Runs a single Tesseract recognition pass on a canvas.
   * Handles 2× upscaling, PSM 11 mode, confidence filtering,
   * and coordinate normalisation.
   *
   * Extracted from runOCR() to allow reuse across primary and
   * secondary (preprocessed) passes.
   *
   * @param {HTMLCanvasElement} canvas — source canvas for this pass
   * @param {number} imgWidth — original image width (for fallback normalisation)
   * @param {number} imgHeight — original image height
   * @param {object} ocrConfig — OCR profile configuration
   * @param {number} timeout — timeout in milliseconds
   * @param {object} u — reference to utils module
   * @returns {Promise<Array>} array of OCR item objects
   */
  async function recogniseCanvas(
    canvas,
    imgWidth,
    imgHeight,
    ocrConfig,
    timeout,
    u,
  ) {
    // Upscale to 2× for better OCR accuracy on small labels
    let ocrSource = canvas;
    let normWidth = imgWidth;
    let normHeight = imgHeight;

    if (canvas instanceof HTMLCanvasElement && canvas.width < 2000) {
      const scaledCanvas = document.createElement("canvas");
      scaledCanvas.width = canvas.width * 2;
      scaledCanvas.height = canvas.height * 2;
      const scaledCtx = scaledCanvas.getContext("2d");
      scaledCtx.drawImage(
        canvas,
        0,
        0,
        scaledCanvas.width,
        scaledCanvas.height,
      );
      ocrSource = scaledCanvas;
      normWidth = scaledCanvas.width;
      normHeight = scaledCanvas.height;
      logDebug(
        `Upscaled for OCR: ${canvas.width}×${canvas.height} → ${scaledCanvas.width}×${scaledCanvas.height}`,
      );
    }

    // Set sparse text mode (PSM 11) for scattered diagram labels
    await _tesseractWorker.setParameters({
      tessedit_pageseg_mode: "11",
    });

    // Run recognition with timeout
    const recognisePromise = _tesseractWorker.recognize(ocrSource);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tesseract OCR timed out")), timeout),
    );

    const { data } = await Promise.race([recognisePromise, timeoutPromise]);

    logDebug(`Tesseract returned ${data.words ? data.words.length : 0} words`);

    // Process words into normalised items
    const items = [];
    const words = data.words || [];

    words.forEach((word) => {
      // Filter by confidence (Tesseract v5 uses 0–100)
      if (word.confidence < u.TESSERACT_MIN_CONFIDENCE) return;

      const text = word.text.trim();
      if (!text) return;

      const bounds = u.toNormalisedBounds(word.bbox, normWidth, normHeight);
      const quadrant = u.getQuadrant(bounds);
      const confidence = word.confidence / 100; // Normalise to 0–1

      items.push({
        text,
        confidence: parseFloat(confidence.toFixed(3)),
        bounds: {
          x: parseFloat(bounds.x.toFixed(4)),
          y: parseFloat(bounds.y.toFixed(4)),
          w: parseFloat(bounds.w.toFixed(4)),
          h: parseFloat(bounds.h.toFixed(4)),
        },
        quadrant,
        level: ocrConfig.recognitionLevel || "word",
        nearbyColour: null, // Populated by cross-referencing
        isNumeric: u.NUMERIC_PATTERN.test(text.trim()),
      });
    });

    return items;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserOCR = {
    ensureTesseract,
    destroyWorker,
    getWorker,
    runOCR,
    mergeOCRResults,
    mergeTesseractAndFlorence,
    quadBoxToNormalisedBounds,
    suppressNoise,
    groupIntoLines,
  };

  logInfo("Analyser OCR engine loaded");
})();
