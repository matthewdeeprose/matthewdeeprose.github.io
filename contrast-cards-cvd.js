/**
 * Colour vision deficiency simulation for Contrast Cards.
 *
 * Two surfaces over ONE set of coefficients:
 *   - buildSVGFilters() writes SVG <filter> elements the page applies as a
 *     CSS filter, so the palette can be LOOKED at under simulation.
 *   - simulate() / measurePair() / measurePalette() return NUMBERS, so the
 *     same transform can be MEASURED and quoted in guidance documents.
 *
 * The filters are generated from CVD_MATRICES at runtime rather than hand
 * written beside it. A hand-maintained SVG next to a hand-maintained JS matrix
 * would drift invisibly: the picture would still look like a CVD simulation
 * while the figures described something else.
 *
 * Coefficients from DaltonLens:
 *   https://daltonlens.org/cvd-simulation-svg-filters/
 *   https://github.com/DaltonLens/libDaltonLens
 *
 * Depends on the page's chroma.js global for the colour metrics only; the
 * simulation itself is self-contained.
 */
(function () {
  "use strict";

  // Logging configuration (inside IIFE scope)
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // The mode identifiers. "none" is the unsimulated view and has no matrix.
  const MODES = Object.freeze({
    NONE: "none",
    PROTANOPIA: "protanopia",
    DEUTERANOPIA: "deuteranopia",
    TRITANOPIA: "tritanopia",
    GREYSCALE: "greyscale",
  });

  // Shown when no simulation is selected.
  const NONE_DESCRIPTION =
    "Colours are shown as they are, with no simulation applied.";

  /**
   * The single source of truth for every coefficient.
   *
   * Protanopia and deuteranopia are the single-matrix approximations of
   * Vienot, Brettel & Mollon 1999.
   *
   * Tritanopia is not a single matrix. The Brettel, Vienot & Mollon 1997
   * construction uses TWO projection planes with a separating test: if
   * dot(rgb, separationNormal) >= 0 use `projection`, otherwise use
   * `projectionAlternate`. The single-matrix approximations are NOT accurate
   * for tritanopia.
   *
   * In the SVG the separation test is smuggled through the alpha channel:
   *   - a 1.0 factor on source alpha, so 0 input alpha stays 0
   *   - the separation normal in the alpha row's RGB columns
   *   - TRITAN_ALPHA_OFFSET subtracted, so a negative dot product lands below
   *     the discrete threshold and a positive one at or above it
   *   - the factors are large deliberately: intermediate RGB is stored
   *     PREMULTIPLIED by alpha, so a large alpha threshold preserves numerical
   *     accuracy through the premultiply/unpremultiply round trip
   *   - it assumes negative values clip to 0 and positive values clip to 1
   *     without overflowing, which is the case in every browser tested
   * simulate() takes the branch directly, which in JS is simpler than the
   * SVG encoding rather than harder.
   *
   * Greyscale is a fourth mode with a different purpose. It uses the linear
   * relative-luminance coefficients of Rec. 709 / sRGB, so it runs the same
   * linearRGB code path as the three dichromacies — no special case, and the
   * canvas cross-check covers it for free. It is NOT a simulation of
   * achromatopsia; see its description.
   */
  const CVD_MATRICES = Object.freeze({
    [MODES.PROTANOPIA]: Object.freeze({
      label: "Protanopia",
      description:
        "Protanopia means lacking the long-wavelength sensitive retinal cone cells, the red cones. People with protanopia may be unable to tell the difference between red and green. Blue and yellow shades are more likely to stand out.",
      projection: Object.freeze([
        Object.freeze([0.10889, 0.89111, -0.0]),
        Object.freeze([0.10889, 0.89111, 0.0]),
        Object.freeze([0.00447, -0.00447, 1.0]),
      ]),
    }),
    [MODES.DEUTERANOPIA]: Object.freeze({
      label: "Deuteranopia",
      description:
        "Deuteranopia means lacking the medium-wavelength sensitive retinal cone cells, the green cones. People with deuteranopia may be unable to tell the difference between red and green. Blue and yellow shades are more likely to stand out.",
      projection: Object.freeze([
        Object.freeze([0.29031, 0.70969, -0.0]),
        Object.freeze([0.29031, 0.70969, -0.0]),
        Object.freeze([-0.02197, 0.02197, 1.0]),
      ]),
    }),
    [MODES.TRITANOPIA]: Object.freeze({
      label: "Tritanopia",
      description:
        "Tritanopia means lacking the short-wavelength sensitive retinal cone cells, the blue cones. People with tritanopia may be unable to tell the difference between blue and green, purple and red, and yellow and pink. It also makes colours look less bright.",
      projection: Object.freeze([
        Object.freeze([1.01354, 0.14268, -0.15622]),
        Object.freeze([-0.01181, 0.87561, 0.13619]),
        Object.freeze([0.07707, 0.81208, 0.11085]),
      ]),
      projectionAlternate: Object.freeze([
        Object.freeze([0.93337, 0.19999, -0.13336]),
        Object.freeze([0.05809, 0.82565, 0.11626]),
        Object.freeze([-0.37923, 1.13825, 0.24098]),
      ]),
      separationNormal: Object.freeze([7.92482, -5.66475, -2.26007]),
    }),
    [MODES.GREYSCALE]: Object.freeze({
      label: "Greyscale (luminance only)",
      description:
        "Greyscale removes hue entirely and keeps only relative luminance. It is not a simulation of achromatopsia, which also involves reduced acuity and light sensitivity that no colour transform models. It answers a narrower question: does this design still work in print, on a photocopy, or on a monochrome display, where colour can do no work on its own.",
      projection: Object.freeze([
        Object.freeze([0.2126, 0.7152, 0.0722]),
        Object.freeze([0.2126, 0.7152, 0.0722]),
        Object.freeze([0.2126, 0.7152, 0.0722]),
      ]),
    }),
  });

  // Subtracted from the alpha row so a negative dot product with the
  // separation normal lands below the discrete threshold.
  const TRITAN_ALPHA_OFFSET = 0.2;

  // Five discrete tableValues means the last chunk starts here.
  const TRITAN_ALPHA_TABLE = "0 0 0 0 1";

  // sRGB electro-optical transfer function constants (IEC 61966-2-1), which
  // is what SVG's linearRGB colour-interpolation uses.
  const SRGB_LINEAR_THRESHOLD = 0.04045;
  const SRGB_LINEAR_DIVISOR = 12.92;
  const SRGB_ALPHA = 0.055;
  const SRGB_GAMMA = 2.4;
  const SRGB_ENCODE_THRESHOLD = 0.0031308;

  // Id of the injected <svg> holding the generated filters.
  const FILTER_HOST_ID = "cvdFilterDefinitions";

  /**
   * Cross-check tolerances, in 8-bit channel units, set from measurement
   * rather than taste. Measured 13 August 2026, Chromium 1223, over the 45
   * palette colours plus primaries and a grey ladder - 212 comparisons:
   * deuteranopia and greyscale agreed EXACTLY (max delta 0), protanopia max 1,
   * tritanopia max 5.
   *
   * Tritanopia gets its own, wider figure because its SVG encoding is the less
   * accurate of the two paths, not because simulate() is less accurate there.
   * Its separation test is smuggled through alpha, which forces the filter's
   * intermediate RGB through a premultiply/unpremultiply round trip at 8-bit
   * linear precision. That is ruinous at the dark end, where a linear value of
   * roughly 1.4/255 quantises to the integer 1. Verified by disable-and-
   * remeasure: an IDENTITY RGB filter carrying the SAME alpha trick reproduces
   * the error exactly (#111111 to #0d0d0d, #050505 to #000000), while a plain
   * identity linearRGB filter is exact for every grey - so no CVD coefficient
   * is involved in producing it.
   *
   * The wider figure does not blunt the gate. Measured against deliberately
   * broken variants: applying the matrix in sRGB instead of linear RGB lands
   * at 78, always taking tritanopia plane 1 at 40, always plane 2 at 85. The
   * correct implementation lands at 4.
   */
  const CROSS_CHECK_TOLERANCE = Object.freeze({
    DEFAULT: 2,
    TRITANOPIA: 6,
  });

  /**
   * Working proposal, not a standard. Delta E here is CIE76 (Euclidean
   * distance in CIE Lab), chosen for transparency over CMC - state which is
   * used wherever figures are quoted.
   */
  const DELTA_E_THRESHOLDS = Object.freeze({
    // Below the just-noticeable difference: effectively the same colour
    JND: 2.3,
    // Separable side by side, unreliable at a glance or at distance
    DISTINCT: 10,
    // Stricter working bar for status pairs judged at distance and apart
    STATUS_PAIR: 20,
  });

  const DELTA_E_VERDICTS = Object.freeze({
    SAME: "below the just-noticeable difference - effectively the same colour",
    WEAK: "separable side by side, unreliable at a glance or at distance",
    DISTINCT: "comfortably distinct",
  });

  /**
   * Decode one sRGB channel to linear light.
   * @param {number} channel - 0 to 1
   * @returns {number} Linear-light value, 0 to 1
   */
  function srgbToLinear(channel) {
    if (channel <= SRGB_LINEAR_THRESHOLD) {
      return channel / SRGB_LINEAR_DIVISOR;
    }
    return Math.pow((channel + SRGB_ALPHA) / (1 + SRGB_ALPHA), SRGB_GAMMA);
  }

  /**
   * Encode one linear-light channel back to sRGB.
   * @param {number} channel - 0 to 1
   * @returns {number} sRGB-encoded value, 0 to 1
   */
  function linearToSrgb(channel) {
    if (channel <= SRGB_ENCODE_THRESHOLD) {
      return channel * SRGB_LINEAR_DIVISOR;
    }
    return (1 + SRGB_ALPHA) * Math.pow(channel, 1 / SRGB_GAMMA) - SRGB_ALPHA;
  }

  function clamp01(value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  /**
   * Apply a 3x3 projection to a linear RGB triple.
   * SVG filter primitives clamp intermediate results, so this does too - the
   * clamp is part of matching the browser, not a tidiness measure.
   * @param {number[]} rgbLinear
   * @param {number[][]} matrix - three rows of three
   * @returns {number[]} Clamped linear RGB
   */
  function applyProjection(rgbLinear, matrix) {
    return matrix.map((row) =>
      clamp01(
        row[0] * rgbLinear[0] + row[1] * rgbLinear[1] + row[2] * rgbLinear[2]
      )
    );
  }

  /**
   * Pick the projection for a mode, taking the tritanopia branch where the
   * mode carries a separating plane.
   * @param {number[]} rgbLinear
   * @param {Object} definition - a CVD_MATRICES entry
   * @returns {number[][]} The matrix to apply
   */
  function selectProjection(rgbLinear, definition) {
    if (!definition.separationNormal) return definition.projection;

    const normal = definition.separationNormal;
    const dot =
      normal[0] * rgbLinear[0] +
      normal[1] * rgbLinear[1] +
      normal[2] * rgbLinear[2];

    return dot >= 0 ? definition.projection : definition.projectionAlternate;
  }

  /**
   * Simulate one colour under one mode.
   *
   * The transform runs in LINEAR RGB, matching the filters'
   * color-interpolation-filters="linearRGB". Applying the matrix straight to
   * sRGB values yields a wrong answer that still looks like a plausible CVD
   * simulation, which is why verifyAgainstFilters() exists.
   *
   * @param {string} hex - Any chroma-parseable colour
   * @param {string} mode - A MODES value
   * @returns {string} Lowercase hex, or the input colour normalised when the
   *                   mode is "none" or unknown
   */
  function simulate(hex, mode) {
    const definition = CVD_MATRICES[mode];

    if (!definition) {
      if (mode !== MODES.NONE) {
        logWarn(`Unknown simulation mode "${mode}" - returning input colour`);
      }
      return normaliseHex(hex);
    }

    const rgb = chroma(hex).rgb();
    const rgbLinear = rgb.map((channel) => srgbToLinear(channel / 255));
    const projected = applyProjection(
      rgbLinear,
      selectProjection(rgbLinear, definition)
    );
    const encoded = projected.map((channel) =>
      Math.round(clamp01(linearToSrgb(channel)) * 255)
    );

    return chroma(encoded).hex().toLowerCase();
  }

  function normaliseHex(hex) {
    return chroma(hex).hex().toLowerCase();
  }

  /**
   * Format one CVD_MATRICES projection as an feColorMatrix `values` string.
   * @param {number[][]} matrix - three rows of three
   * @param {number[]} [alphaRow] - five values; defaults to pass-through alpha
   * @returns {string}
   */
  function formatMatrixValues(matrix, alphaRow) {
    const rows = matrix.map((row) => `${row.join(", ")}, 0, 0`);
    rows.push((alphaRow || [0, 0, 0, 1, 0]).join(", "));
    return rows.join("\n            ");
  }

  /**
   * Build the markup for one filter from its CVD_MATRICES entry.
   * @param {string} mode
   * @param {Object} definition
   * @returns {string} SVG markup for a single <filter>
   */
  function buildFilterMarkup(mode, definition) {
    const openTag = `<filter id="${mode}" color-interpolation-filters="linearRGB">`;

    if (!definition.separationNormal) {
      return `${openTag}
          <feColorMatrix type="matrix" in="SourceGraphic" values="
            ${formatMatrixValues(definition.projection)}" />
        </filter>`;
    }

    // Two projection planes, with the separating test encoded in alpha and
    // then binarised, so feBlend picks one plane or the other per pixel.
    const alphaRow = definition.separationNormal.concat([1, -TRITAN_ALPHA_OFFSET]);

    return `${openTag}
          <feColorMatrix type="matrix" in="SourceGraphic" result="ProjectionOnPlane1" values="
            ${formatMatrixValues(definition.projection, alphaRow)}" />
          <feComponentTransfer in="ProjectionOnPlane1" result="ProjectionOnPlane1">
            <feFuncA type="discrete" tableValues="${TRITAN_ALPHA_TABLE}" />
          </feComponentTransfer>
          <feColorMatrix type="matrix" in="SourceGraphic" result="ProjectionOnPlane2" values="
            ${formatMatrixValues(definition.projectionAlternate)}" />
          <feBlend in="ProjectionOnPlane1" in2="ProjectionOnPlane2" mode="normal" />
        </filter>`;
  }

  /**
   * Inject the zero-size <svg> carrying every generated filter.
   * Idempotent - safe to call twice.
   * @returns {boolean} True if the host element is present afterwards
   */
  function buildSVGFilters() {
    if (document.getElementById(FILTER_HOST_ID)) {
      logDebug("CVD filters already present - nothing to build");
      return true;
    }

    const filters = Object.keys(CVD_MATRICES)
      .map((mode) => buildFilterMarkup(mode, CVD_MATRICES[mode]))
      .join("\n        ");

    const host = document.createElement("div");
    host.innerHTML = `<svg id="${FILTER_HOST_ID}" aria-hidden="true" focusable="false"
        style="height: 0; width: 0; position: absolute; overflow: hidden"
        xmlns="http://www.w3.org/2000/svg">
        ${filters}
      </svg>`;

    const svg = host.firstElementChild;
    if (!svg) {
      logError("Failed to build the CVD filter SVG");
      return false;
    }

    document.body.appendChild(svg);
    logInfo(
      `CVD filters built: ${Object.keys(CVD_MATRICES).join(", ")}`
    );
    return true;
  }

  /**
   * List the filter ids the page can reference, in const order.
   * @returns {string[]}
   */
  function getModes() {
    return [MODES.NONE].concat(Object.keys(CVD_MATRICES));
  }

  /**
   * Human-readable label and description for a mode.
   * @param {string} mode
   * @returns {{label: string, description: string}}
   */
  function describeMode(mode) {
    const definition = CVD_MATRICES[mode];
    if (!definition) {
      return { label: "None", description: NONE_DESCRIPTION };
    }
    return { label: definition.label, description: definition.description };
  }

  function verdictForDeltaE(deltaE) {
    if (deltaE < DELTA_E_THRESHOLDS.JND) return DELTA_E_VERDICTS.SAME;
    if (deltaE < DELTA_E_THRESHOLDS.DISTINCT) return DELTA_E_VERDICTS.WEAK;
    return DELTA_E_VERDICTS.DISTINCT;
  }

  /**
   * Smallest angle between two LCH hues, in degrees.
   * @returns {number|null} Null when either colour is achromatic
   */
  function hueGap(hueA, hueB) {
    if (Number.isNaN(hueA) || Number.isNaN(hueB)) return null;
    const raw = Math.abs(hueA - hueB) % 360;
    return Number((raw > 180 ? 360 - raw : raw).toFixed(2));
  }

  /**
   * WCAG ratio and APCA Lc for one colour against one background.
   * INDICATIVE ONLY under simulation: WCAG and APCA are defined on the actual
   * colours, and no conformance claim may rest on a simulated figure.
   */
  function contrastAgainst(colour, background) {
    return {
      wcag: Number(chroma.contrast(colour, background).toFixed(2)),
      // contrastAPCA is signed and asymmetric: colour is the text, the
      // background is the background. The sign carries polarity, so the
      // magnitude is what the badge ladder reads.
      apca: Math.round(Math.abs(chroma.contrastAPCA(colour, background))),
    };
  }

  /**
   * Measure two colours against a background, under every mode.
   * @param {string} colourA
   * @param {string} colourB
   * @param {Object} [options]
   * @param {string} [options.background="#ffffff"]
   * @param {string[]} [options.modes] - defaults to every mode
   * @returns {Object} Keyed by mode
   */
  function measurePair(colourA, colourB, options) {
    const settings = options || {};
    const background = settings.background || "#ffffff";
    const modes = settings.modes || getModes();
    const result = {};

    modes.forEach((mode) => {
      const simA = simulate(colourA, mode);
      const simB = simulate(colourB, mode);
      const simBackground = simulate(background, mode);

      const lchA = chroma(simA).lch();
      const lchB = chroma(simB).lch();
      const deltaE = Number(chroma.distance(simA, simB, "lab").toFixed(2));

      result[mode] = {
        mode: mode,
        label: describeMode(mode).label,
        a: { original: normaliseHex(colourA), simulated: simA },
        b: { original: normaliseHex(colourB), simulated: simB },
        background: {
          original: normaliseHex(background),
          simulated: simBackground,
        },
        deltaE: deltaE,
        deltaEMethod: "CIE76",
        verdict: verdictForDeltaE(deltaE),
        meetsStatusPairBar: deltaE >= DELTA_E_THRESHOLDS.STATUS_PAIR,
        lightnessGap: Number(Math.abs(lchA[0] - lchB[0]).toFixed(2)),
        hueGap: hueGap(lchA[2], lchB[2]),
        aAgainstBackground: contrastAgainst(simA, simBackground),
        bAgainstBackground: contrastAgainst(simB, simBackground),
      };
    });

    return result;
  }

  /**
   * Read the page's default palette, if the analyser has exposed it.
   * @returns {Array} Array of {name, hex}
   */
  function resolvePalette() {
    if (
      typeof ColourContrastAnalyser !== "undefined" &&
      Array.isArray(ColourContrastAnalyser.DEFAULT_COLOURS)
    ) {
      return ColourContrastAnalyser.DEFAULT_COLOURS;
    }
    logWarn("No palette available - pass one via options.colours");
    return [];
  }

  /**
   * Measure every palette colour against a background, under every mode.
   * @param {string} background
   * @param {Object} [options]
   * @param {Array} [options.colours] - defaults to the page's DEFAULT_COLOURS
   * @param {string[]} [options.modes]
   * @returns {Object} Keyed by mode, each an array of per-colour records
   */
  function measurePalette(background, options) {
    const settings = options || {};
    const colours = settings.colours || resolvePalette();
    const modes = settings.modes || getModes();
    const result = {};

    modes.forEach((mode) => {
      const simBackground = simulate(background, mode);

      result[mode] = colours.map((colour) => {
        const simulated = simulate(colour.hex, mode);
        const contrast = contrastAgainst(simulated, simBackground);
        return {
          name: colour.name,
          original: normaliseHex(colour.hex),
          simulated: simulated,
          wcag: contrast.wcag,
          apca: contrast.apca,
        };
      });
    });

    return result;
  }

  /**
   * THE GATING INSTRUMENT.
   *
   * Prove simulate() agrees with the browser's own SVG filter, by running the
   * same swatches through both paths. Canvas 2D honours SVG filter
   * references, so ctx.filter = "url(#protanopia)" gives the browser's
   * filtered pixels back as numbers.
   *
   * A mismatch means simulate() is wrong - most likely the linearRGB
   * decode/encode - and the fix is simulate(), never the tolerance. The
   * per-mode tolerances in CROSS_CHECK_TOLERANCE are measured, and that
   * comment records what they were measured against.
   *
   * @param {Object} [options]
   * @param {string[]} [options.swatches]
   * @param {number} [options.tolerance] - overrides the per-mode tolerances
   * @returns {Object} {passed, maxDelta, tolerance, rows}
   */
  function verifyAgainstFilters(options) {
    const settings = options || {};
    const toleranceFor = (mode) => {
      if (settings.tolerance !== undefined) return settings.tolerance;
      return mode === MODES.TRITANOPIA
        ? CROSS_CHECK_TOLERANCE.TRITANOPIA
        : CROSS_CHECK_TOLERANCE.DEFAULT;
    };
    const swatches = settings.swatches || [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#111111",
      "#ffe0b0",
      "#00ffae",
      "#fafafa",
      "#005c84",
      "#e63037",
      "#8bd100",
    ];

    buildSVGFilters();

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const rows = [];
    let maxDelta = 0;

    Object.keys(CVD_MATRICES).forEach((mode) => {
      swatches.forEach((swatch) => {
        context.filter = "none";
        context.clearRect(0, 0, 1, 1);
        context.filter = `url(#${mode})`;
        context.fillStyle = swatch;
        context.fillRect(0, 0, 1, 1);

        const pixel = context.getImageData(0, 0, 1, 1).data;
        const browserHex = chroma([pixel[0], pixel[1], pixel[2]])
          .hex()
          .toLowerCase();
        const jsHex = simulate(swatch, mode);
        const jsRgb = chroma(jsHex).rgb();

        const delta = Math.max(
          Math.abs(pixel[0] - jsRgb[0]),
          Math.abs(pixel[1] - jsRgb[1]),
          Math.abs(pixel[2] - jsRgb[2])
        );
        if (delta > maxDelta) maxDelta = delta;

        rows.push({
          mode: mode,
          swatch: swatch,
          browser: browserHex,
          js: jsHex,
          delta: delta,
          tolerance: toleranceFor(mode),
          agrees: delta <= toleranceFor(mode),
        });
      });
    });

    const failures = rows.filter((row) => !row.agrees);
    const passed = failures.length === 0;

    if (passed) {
      logInfo(
        `CVD cross-check passed: ${rows.length} comparisons, max channel delta ${maxDelta}`
      );
    } else {
      logError(
        `CVD cross-check FAILED: ${failures.length} of ${rows.length} comparisons exceeded tolerance`,
        failures
      );
    }

    return {
      passed: passed,
      maxDelta: maxDelta,
      tolerance:
        settings.tolerance === undefined
          ? CROSS_CHECK_TOLERANCE
          : settings.tolerance,
      comparisons: rows.length,
      failures: failures,
      rows: rows,
    };
  }

  // Public API
  window.ContrastCardsCVD = {
    MODES: MODES,
    CVD_MATRICES: CVD_MATRICES,
    DELTA_E_THRESHOLDS: DELTA_E_THRESHOLDS,
    CROSS_CHECK_TOLERANCE: CROSS_CHECK_TOLERANCE,
    FILTER_HOST_ID: FILTER_HOST_ID,
    buildSVGFilters: buildSVGFilters,
    getModes: getModes,
    describeMode: describeMode,
    simulate: simulate,
    measurePair: measurePair,
    measurePalette: measurePalette,
    verifyAgainstFilters: verifyAgainstFilters,
  };

  logInfo("Contrast Cards CVD simulation module loaded");
})();
