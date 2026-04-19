/**
 * ═══════════════════════════════════════════════════════════════
 * OCR ENRICHMENT TEST HARNESS
 * ═══════════════════════════════════════════════════════════════
 *
 * Self-contained async IIFE for browser console.
 * Tests 6 images × 5 prompt variants = 30 Qwen3.5 runs.
 *
 * Compares whether adding OCR data (from embedded cache dumps)
 * improves Qwen3.5 output for accessible image descriptions.
 *
 * The 5 variants:
 *   baseline          — standard Qwen prompt, no OCR
 *   text_before       — OCR text list prepended before prompt
 *   text_after        — OCR text list appended after prompt
 *   positioned_before — OCR text + quadrant positions prepended
 *   positioned_after  — OCR text + quadrant positions appended
 *
 * Results stored as window._ocrEnrichmentResults
 *
 * VERSION: 1.0.0
 * DATE: 29 March 2026
 * ═══════════════════════════════════════════════════════════════
 */
(async () => {
  'use strict';

  // ============================================================================
  // EMBEDDED OCR CACHE DATA
  // ============================================================================
  // Pre-cleaned items extracted from IndexedDB cache dumps.
  // Items with confidence: null are from Florence-2 supplementary OCR — valid
  // detections that must be included. Some OCR errors are intentional (real data).

  const OCR_CACHE = {
    "pv.png": {
      hash: "f06a15424facde18d806fc100d76ca9dad23ac79d1163caf529494e8ea52b8b8",
      items: [
        { text: "1", confidence: 0.795, quadrant: "bottom-right" },
        { text: "P", confidence: null, quadrant: "top-left" },
        { text: "2", confidence: null, quadrant: "bottom-left" },
        { text: "V", confidence: null, quadrant: "bottom-right" }
      ]
    },
    "piston.png": {
      hash: "811ea8b3ba42a5e2403fe058702938e66c067e047e0e4199bb8e2b193a43d36f",
      items: [
        { text: "P.V", confidence: 0.892, quadrant: "top-right" },
        { text: "Q", confidence: 0.903, quadrant: "bottom-left" }
      ]
    },
    "Proposed mechanism of action of GA.png": {
      hash: "8dbc7540ff3d7f93fd22daf036ed5112bd29d819984ebc2904cdea7b82ddd74f",
      items: [
        { text: "periphery", confidence: 0.959, quadrant: "top-left" },
        { text: "CNS", confidence: 0.964, quadrant: "top-right" },
        { text: "macrophage", confidence: 0.959, quadrant: "top-left" },
        { text: "microglia", confidence: 0.961, quadrant: "top-right" },
        { text: "GA-therapy", confidence: 0.91, quadrant: "top-left" },
        { text: "MHC", confidence: 0.962, quadrant: "centre" },
        { text: "GA", confidence: 0.968, quadrant: "centre" },
        { text: "CNS Ag", confidence: 0.817, quadrant: "centre" },
        { text: "TCR", confidence: 0.952, quadrant: "centre" },
        { text: "Antiinflamma-", confidence: 0.879, quadrant: "bottom-right" },
        { text: "tory cytokines", confidence: 0.963, quadrant: "bottom-right" },
        { text: "GA-specific T-cell", confidence: 0.931, quadrant: "bottom-left" },
        { text: "neurotrophins", confidence: 0.924, quadrant: "bottom-right" },
        { text: "TH 2", confidence: 0.938, quadrant: "bottom-left" },
        { text: "TH 2", confidence: 0.917, quadrant: "bottom-right" },
        { text: "blood-brain-barrier", confidence: null, quadrant: "top-right" },
        { text: "bystander", confidence: null, quadrant: "top-right" },
        { text: "MHC", confidence: null, quadrant: "centre" },
        { text: "supression", confidence: null, quadrant: "top-right" },
        { text: "TCR", confidence: null, quadrant: "bottom-left" },
        { text: "IL-4", confidence: null, quadrant: "bottom-right" },
        { text: "IL-10", confidence: null, quadrant: "bottom-right" },
        { text: "BDNF", confidence: null, quadrant: "bottom-right" }
      ]
    },
    "Probability_of_exceedance__intensity_.jpg": {
      hash: "0ab1dc02ec96b9d3007b8915e78751f3a653fbf5f562b20727f68a82ccccf718",
      items: [
        { text: "Probability of exceedance (intensity)", confidence: 0.899, quadrant: "top-right" },
        { text: "10,000", confidence: 0.967, quadrant: "top-left" },
        { text: "5,000", confidence: 0.967, quadrant: "top-left" },
        { text: "1,000", confidence: 0.97, quadrant: "top-left" },
        { text: "300", confidence: 0.965, quadrant: "top-left" },
        { text: "100", confidence: 0.965, quadrant: "top-left" },
        { text: "10", confidence: 0.968, quadrant: "bottom-left" },
        { text: "50", confidence: 0.969, quadrant: "bottom-left" },
        { text: "80", confidence: 0.96, quadrant: "bottom-left" },
        { text: "100", confidence: 0.968, quadrant: "bottom-left" },
        { text: "150", confidence: 0.97, quadrant: "bottom-right" },
        { text: "200", confidence: 0.965, quadrant: "bottom-right" },
        { text: "250", confidence: 0.967, quadrant: "bottom-right" },
        { text: "Service life, t (years)", confidence: 0.933, quadrant: "bottom-right" },
        { text: "P=1%", confidence: null, quadrant: "top-left" },
        { text: "p=5%", confidence: null, quadrant: "top-right" },
        { text: "p=10%", confidence: null, quadrant: "top-right" },
        { text: "p=20%", confidence: null, quadrant: "top-right" },
        { text: "p=30%", confidence: null, quadrant: "top-right" },
        { text: "p=50%", confidence: null, quadrant: "top-right" },
        { text: "30", confidence: null, quadrant: "bottom-left" },
        { text: "Return period T (years)", confidence: null, quadrant: "bottom-left" },
        { text: "Buildingings", confidence: null, quadrant: "bottom-left" },
        { text: "Dams, bridges", confidence: null, quadrant: "bottom-left" }
      ]
    },
    "Bacteria_on_an_agar_plate.jpg": {
      hash: "f9f3ded9c4393b6ae7e20ff3e6b71d1e322d03288a273e89565fe2a062b58d8d",
      items: [
        { text: "Zone of inhibition", confidence: 0.962, quadrant: "top-left" },
        { text: "Antibiotic", confidence: 0.961, quadrant: "centre" },
        { text: "mutants", confidence: 0.954, quadrant: "bottom-left" }
      ]
    },
    "Indian_Ocean_Tsunami.png": {
      hash: "02d988aa3c5c26db6ddb06899877b81f8ddd8bef277ece4a2a435bf73f5c89c5",
      items: [
        { text: "Bangladesh", confidence: 0.963, quadrant: "top-right" },
        { text: "2 Deaths", confidence: 0.961, quadrant: "top-right" },
        { text: "Myanmar", confidence: 0.959, quadrant: "top-right" },
        { text: "Number of fatalities", confidence: 0.948, quadrant: "top-right" },
        { text: "71 Deaths", confidence: 0.96, quadrant: "top-right" },
        { text: "Thailand", confidence: 0.959, quadrant: "top-right" },
        { text: "8 345 Deaths", confidence: 0.955, quadrant: "top-right" },
        { text: "Sri Lanka", confidence: null, quadrant: "centre" },
        { text: "35,990 Deafits", confidence: null, quadrant: "centre" },
        { text: "Somalia", confidence: 0.958, quadrant: "top-left" },
        { text: "298 Deaths", confidence: 0.963, quadrant: "top-left" },
        { text: "Malaysia", confidence: 0.962, quadrant: "bottom-right" },
        { text: "Maldives", confidence: 0.96, quadrant: "bottom-left" },
        { text: "102 Deaths", confidence: 0.961, quadrant: "bottom-left" },
        { text: "Kenya", confidence: 0.964, quadrant: "bottom-left" },
        { text: "1 Death", confidence: 0.961, quadrant: "bottom-left" },
        { text: "Tanzania", confidence: 0.961, quadrant: "bottom-left" },
        { text: "Seychelles", confidence: 0.964, quadrant: "bottom-left" },
        { text: "3 Deaths", confidence: 0.962, quadrant: "bottom-left" },
        { text: "10 Deaths", confidence: 0.96, quadrant: "bottom-left" },
        { text: "Indonesia", confidence: 0.958, quadrant: "bottom-right" },
        { text: "165708 Deaths", confidence: 0.915, quadrant: "bottom-right" },
        { text: "Number of Deaths by Country Following the 2004 Indian Ocean Tsunami (Source: EM-DAT)", confidence: 0.912, quadrant: "bottom-left" },
        { text: "India", confidence: null, quadrant: "top-left" },
        { text: "16.380 Deafats", confidence: null, quadrant: "top-left" }
      ]
    }
  };

  // ============================================================================
  // OCR TEXT FORMATTING UTILITIES
  // ============================================================================

  /**
   * Filter and deduplicate OCR items.
   * IMPORTANT: null confidence items (Florence-2) are INCLUDED —
   * this matches the cloud formatter behaviour (formatOCRForPrompt).
   * @param {Array} items - Raw OCR items
   * @returns {Array} Filtered and deduplicated items (max 12)
   */
  function filterOCRItems(items) {
    const seen = new Set();
    const filtered = [];
    for (const item of items) {
      const text = (item.text || '').trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      filtered.push(item);
      if (filtered.length >= 12) break; // slightly higher cap for rich images
    }
    return filtered;
  }

  /**
   * Format 1: text only (flat quoted list)
   * @param {Array} items - Raw OCR items
   * @returns {string|null} Formatted text or null if no items
   */
  function formatOCRTextOnly(items) {
    const filtered = filterOCRItems(items);
    if (filtered.length === 0) return null;
    const quoted = filtered.map(item => {
      let text = item.text.trim();
      if (text.length > 50) text = text.substring(0, 47) + '...';
      return '"' + text + '"';
    });
    return quoted.join(', ');
  }

  /**
   * Format 2: text with quadrant positions
   * @param {Array} items - Raw OCR items
   * @returns {string|null} Formatted text with positions or null if no items
   */
  function formatOCRWithPositions(items) {
    const filtered = filterOCRItems(items);
    if (filtered.length === 0) return null;
    const lines = filtered.map(item => {
      let text = item.text.trim();
      if (text.length > 50) text = text.substring(0, 47) + '...';
      const quadrant = item.quadrant || 'unknown position';
      return '- "' + text + '" \u2014 ' + quadrant;
    });
    return lines.join('\n');
  }

  // ============================================================================
  // PROMPT CONSTRUCTION
  // ============================================================================

  /**
   * Build 5 prompt variants from the base prompt and OCR data.
   * @param {string} basePrompt - The standard Qwen prompt
   * @param {string} ocrTextOnly - Flat text list from formatOCRTextOnly
   * @param {string} ocrPositioned - Positioned text from formatOCRWithPositions
   * @returns {Object} Map of variant key → prompt string
   */
  function buildPrompts(basePrompt, ocrTextOnly, ocrPositioned) {
    const textBlock = 'The following text was detected in this image by automated analysis:\n' + ocrTextOnly;
    const posBlock = 'The following text was detected in this image by automated analysis:\n' + ocrPositioned;

    return {
      baseline: basePrompt,
      text_before: textBlock + '\n\n' + basePrompt,
      text_after: basePrompt + '\n\n' + textBlock,
      positioned_before: posBlock + '\n\n' + basePrompt,
      positioned_after: basePrompt + '\n\n' + posBlock,
    };
  }

  // ============================================================================
  // IMAGE LOADING
  // ============================================================================

  /**
   * Load an image from the testing/images directory.
   * @param {string} filename - Image filename
   * @returns {Object} { img, url, blob }
   */
  async function loadImage(filename) {
    const resp = await fetch('image-describer/testing/images/' + filename);
    if (!resp.ok) throw new Error('Failed to fetch ' + filename + ': ' + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    return { img, url, blob };
  }

  // ============================================================================
  // UTILITY: TIME FORMATTING
  // ============================================================================

  /**
   * Format milliseconds as a human-readable duration string.
   * @param {number} ms - Duration in milliseconds
   * @returns {string} e.g. "2m 34s" or "45s"
   */
  function formatDuration(ms) {
    const totalSec = Math.round(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins === 0) return secs + 's';
    return mins + 'm ' + secs + 's';
  }

  // ============================================================================
  // MAIN TEST EXECUTION
  // ============================================================================

  const VARIANT_ORDER = ['baseline', 'text_before', 'text_after', 'positioned_before', 'positioned_after'];
  const imageNames = Object.keys(OCR_CACHE);
  const totalRuns = imageNames.length * VARIANT_ORDER.length;

  console.log('═══ OCR Enrichment Test — Starting ═══');
  console.log(imageNames.length + ' images × ' + VARIANT_ORDER.length + ' variants = ' + totalRuns + ' runs (~25–30 minutes)');

  // 1. Check Qwen status
  if (typeof ImageDescriberAnalyserTransformers === 'undefined' ||
      typeof ImageDescriberAnalyserTransformers.getQwenStatus !== 'function') {
    console.error('⚠ ImageDescriberAnalyserTransformers not available. Ensure the analyser is loaded.');
    return;
  }

  const qwenStatus = ImageDescriberAnalyserTransformers.getQwenStatus();
  if (qwenStatus !== 'ready') {
    console.error('⚠ Qwen3.5 not loaded (status: ' + qwenStatus + '). Load it via Model Manager first.');
    return;
  }
  console.log('✓ Qwen3.5 status: ready');

  // 2. Get base prompt from the controller
  if (typeof ImageDescriberController === 'undefined' ||
      typeof ImageDescriberController.buildQwenPrompt !== 'function') {
    console.error('⚠ ImageDescriberController.buildQwenPrompt not available.');
    return;
  }

  const basePrompt = ImageDescriberController.buildQwenPrompt();
  console.log('✓ Base prompt obtained (' + basePrompt.length + ' chars)');

  // 3. Run all tests
  const results = [];
  const blobUrls = []; // Track for cleanup
  const testStart = performance.now();
  let completedRuns = 0;

  for (let i = 0; i < imageNames.length; i++) {
    const filename = imageNames[i];
    const cacheEntry = OCR_CACHE[filename];
    const itemCount = cacheEntry.items.length;

    console.log('━━━ Image: ' + filename + ' (' + itemCount + ' OCR items) ━━━');

    // Load image
    let imageData;
    try {
      imageData = await loadImage(filename);
      blobUrls.push(imageData.url);
      console.log('  ✓ Image loaded: ' + imageData.img.naturalWidth + '×' + imageData.img.naturalHeight);
    } catch (err) {
      console.error('  ✗ Failed to load image: ' + err.message);
      // Store error result for all variants
      const errorResult = {
        image: filename,
        ocrItemCount: itemCount,
        ocrTextOnly: null,
        ocrPositioned: null,
        results: {}
      };
      for (const variant of VARIANT_ORDER) {
        errorResult.results[variant] = {
          prompt: null,
          output: null,
          timeMs: 0,
          charCount: 0,
          error: 'Image load failed: ' + err.message
        };
        completedRuns++;
      }
      results.push(errorResult);
      continue;
    }

    // Build OCR format strings from embedded data
    const ocrTextOnly = formatOCRTextOnly(cacheEntry.items);
    const ocrPositioned = formatOCRWithPositions(cacheEntry.items);

    console.log('  OCR text: ' + (ocrTextOnly ? ocrTextOnly.substring(0, 100) + (ocrTextOnly.length > 100 ? '...' : '') : '(none)'));

    // Build 5 prompt variants
    const prompts = buildPrompts(basePrompt, ocrTextOnly, ocrPositioned);

    // Prepare result entry for this image
    const imageResult = {
      image: filename,
      ocrItemCount: itemCount,
      ocrTextOnly: ocrTextOnly,
      ocrPositioned: ocrPositioned,
      results: {}
    };

    // Run each variant
    for (const variant of VARIANT_ORDER) {
      const promptText = prompts[variant];
      console.log('  Running ' + variant + '...');

      let output = null;
      let timeMs = 0;
      let charCount = 0;
      let error = null;

      try {
        const t0 = performance.now();
        output = await ImageDescriberAnalyserTransformers.generateQwenDescription(
          imageData.img,
          { prompt: promptText }
        );
        timeMs = Math.round(performance.now() - t0);
        charCount = output ? output.length : 0;
        console.log('  ✓ ' + variant + ' — ' + timeMs + 'ms, ' + charCount + ' chars');
      } catch (err) {
        timeMs = 0;
        error = err.message || String(err);
        console.error('  ✗ ' + variant + ' failed: ' + error);
      }

      imageResult.results[variant] = {
        prompt: promptText,
        output: output,
        timeMs: timeMs,
        charCount: charCount,
        ...(error ? { error: error } : {})
      };

      completedRuns++;

      // Progress update with time estimate
      const elapsed = performance.now() - testStart;
      const avgPerRun = elapsed / completedRuns;
      const remaining = avgPerRun * (totalRuns - completedRuns);
      console.log('  [' + completedRuns + '/' + totalRuns + '] Elapsed: ' +
        formatDuration(elapsed) + ' | Est. remaining: ' + formatDuration(remaining));

      // 3-second pause between runs to avoid overwhelming the model
      if (completedRuns < totalRuns) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    results.push(imageResult);
  }

  // ============================================================================
  // CLEANUP AND OUTPUT
  // ============================================================================

  // Release blob URLs
  for (const url of blobUrls) {
    URL.revokeObjectURL(url);
  }

  const totalElapsed = performance.now() - testStart;
  console.log('═══ All ' + totalRuns + ' runs complete — total ' + formatDuration(totalElapsed) + ' ═══');

  // Store results globally
  window._ocrEnrichmentResults = results;
  console.log(JSON.stringify(window._ocrEnrichmentResults, null, 2));

  console.log('Results stored as window._ocrEnrichmentResults');
  console.log('Copy with: copy(JSON.stringify(window._ocrEnrichmentResults, null, 2))');

})();
