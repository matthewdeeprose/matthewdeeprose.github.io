/* ====================================================================
   DOOR PANEL STUDIO

   Four layers, kept genuinely separate so the interaction design can be
   replaced without touching anything that produces a number:

     1. ENGINE    pure functions - geometry, contrast, delta E, solver.
                  No DOM access anywhere in this layer.
     2. MODEL     frozen data - palette, ladders, roles, statuses.
     3. FRAME     the preview, driven only by CSS custom properties.
     4. CONTROLS  generated from the model, through one state object
                  with a single recompute-and-repaint entry point.

   Adding a role, a status or a palette entry is a MODEL edit.
   Redesigning the controls touches LAYER 4 only.
   ==================================================================== */

/**
 * Door Panel Studio - app logic.
 *
 * Split out of door-panel-studio.html on 14 August 2026. The split moved
 * text and changed no behaviour; the canary suite is the instrument that
 * proves it, and the evidence payload was SHA-256 compared either side.
 *
 * Publishes two globals: DoorPanelStudio (the public surface, unchanged) and
 * DoorPanelStudioInternals (the bridge the checks harness reads). The bridge
 * exists because the harness measures the app's own internals - it is a
 * measuring instrument for this file, not a consumer of its public API, and
 * pretending otherwise would mean widening the public surface to suit a test.
 */
(function () {
  "use strict";

  /**
   * The checks harness, reached lazily and never captured.
   *
   * It loads AFTER this file - it has to, because it reads this file's
   * internals bridge - so anything here that names a canary must resolve at
   * CALL time rather than at load time. A `const Checks = window...Checks` at
   * the top of this file would capture `undefined` and every canary button
   * would fail silently, which is the exact shape of the never-assigned-global
   * defect this repo has met before.
   */
  const Checks = new Proxy(
    {},
    {
      get: (_target, name) => {
        const harness = window.DoorPanelStudioChecks;
        if (!harness) {
          logError(
            "The checks harness has not loaded; " + String(name) + " is unavailable"
          );
          return () => [];
        }
        return harness[name];
      },
    }
  );


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

/* ==================================================================
   LAYER 1: ENGINE. Pure functions. No DOM.
   ================================================================== */

/**
 * The CSS reference pixel is defined by visual angle, not by length:
 * one pixel on a 96dpi device at arm's length. Everything about "how
 * big does this look from there" derives from that one angle, so it is
 * stated once and converted, rather than copied in as a radian figure.
 */
const CSS_REFERENCE_PIXEL_DEGREES = 0.0213;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const CSS_REFERENCE_PIXEL_RADIANS =
  CSS_REFERENCE_PIXEL_DEGREES / DEGREES_PER_RADIAN;

// Below this, a rendered line subtends less than one reference pixel
// at the reading distance, so it is at the limit of what the eye
// resolves there whatever its contrast.
const HAIRLINE_EFFECTIVE_PX = 1;

// How far the solver sweep reports. A reporting bound, not a claim
// about the palette.
const SOLVER_MAX_SET_SIZE = 10;

// Recursion steps the clique search may take before it gives up and
// says so. A search that ran out is reported as such, never as "no set
// exists" - the two are different answers.
const SOLVER_STEP_BUDGET = 2000000;

function round(value, places) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

/**
 * Everything physical about the panel, derived from stated dimensions.
 * @param {Object} input
 * @returns {Object}
 */
function computeGeometry(input) {
  const pxPerMmHeight = input.panelHpx / input.panelHmm;
  const pxPerMmWidth = input.panelWpx / input.panelWmm;

  // The guidance derives the millimetre from viewport HEIGHT
  // (--mm: calc(100vh / 135.9)), so that is the primary conversion.
  const mmPerPx = 1 / pxPerMmHeight;
  const mmPerPxWidth = 1 / pxPerMmWidth;

  // The panel's own CSS is html { font-size: calc(max(1vw, 1vh)) },
  // so one rem is one hundredth of the larger viewport axis.
  const rootFontPx = Math.max(
    input.panelWpx / 100,
    input.panelHpx / 100
  );

  return {
    pxPerMmHeight: pxPerMmHeight,
    pxPerMmWidth: pxPerMmWidth,
    mmPerPx: mmPerPx,
    mmPerPxWidth: mmPerPxWidth,
    // How far the two conversions disagree. Non-zero means the stated
    // pixel grid and the stated active area are not the same shape.
    mmPerPxDisagreementPercent:
      (Math.abs(mmPerPxWidth - mmPerPx) / mmPerPx) * 100,
    rootFontPx: rootFontPx,
    rootFontMm: rootFontPx * mmPerPx,
    aspectPx: input.panelWpx / input.panelHpx,
    aspectMm: input.panelWmm / input.panelHmm,
    referencePixelMm: input.distanceMm * CSS_REFERENCE_PIXEL_RADIANS,
    distanceMm: input.distanceMm,
    capRatio: input.capRatio,
  };
}

function capToFontMm(capMm, capRatio) {
  return capMm / capRatio;
}

function fontToCapMm(fontMm, capRatio) {
  return fontMm * capRatio;
}

/**
 * How many CSS reference pixels a physical size subtends at the
 * reading distance - the size the design would need on an ordinary
 * screen to look the same from where the reader stands.
 */
function effectivePixels(sizeMm, geometry) {
  return sizeMm / geometry.referencePixelMm;
}

/**
 * The nine-line budget of principle 3, computed rather than asserted.
 * @param {Object} args - usableHeightMm, capFloorMm, capRatio, spacing
 */
function computeLineBudget(args) {
  const lineMm =
    capToFontMm(args.capFloorMm, args.capRatio) * args.spacing;
  return {
    usableHeightMm: args.usableHeightMm,
    lineHeightMm: lineMm,
    lines: args.usableHeightMm / lineMm,
  };
}

/**
 * WCAG ratio and APCA Lc for one pairing.
 *
 * chroma.contrastAPCA is ASYMMETRIC and SIGNED: the text colour comes
 * first, the background second, and a negative result means light text
 * on a dark background. The ladder reads the magnitude; the sign is
 * kept because it names the polarity.
 */
function contrastPair(textHex, backgroundHex) {
  const signed = chroma.contrastAPCA(textHex, backgroundHex);
  return {
    wcag: round(chroma.contrast(textHex, backgroundHex), 2),
    lc: Math.round(Math.abs(signed)),
    lcSigned: round(signed, 1),
    polarity:
      signed < 0
        ? "light text on a dark background"
        : "dark text on a light background",
  };
}

/**
 * Simulate every colour under every mode, then reduce each pair to the
 * figure that actually binds: its SMALLEST delta E across all modes. A
 * pair is only as separable as its worst mode.
 * @returns {{matrix: number[][], simulated: Object, modes: string[]}}
 */
function buildSeparationMatrix(colours, modes) {
  const simulated = {};
  modes.forEach((mode) => {
    simulated[mode] = colours.map((colour) =>
      window.ContrastCardsCVD.simulate(colour.hex, mode)
    );
  });

  const size = colours.length;
  const matrix = [];
  for (let i = 0; i < size; i += 1) {
    matrix.push(new Array(size).fill(0));
  }

  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      let smallest = Infinity;
      for (let m = 0; m < modes.length; m += 1) {
        const distance = chroma.distance(
          simulated[modes[m]][i],
          simulated[modes[m]][j],
          "lab"
        );
        if (distance < smallest) smallest = distance;
      }
      matrix[i][j] = smallest;
      matrix[j][i] = smallest;
    }
  }

  return { matrix: matrix, simulated: simulated, modes: modes };
}

/**
 * Find a set of `size` nodes all pairwise at or above `threshold` - a
 * clique in the graph joined at that threshold.
 *
 * Exact, with pruning, which is affordable at palette scale. Returns
 * null when no such set exists, and THROWS when the step budget runs
 * out, so "none exists" and "we stopped looking" stay distinguishable.
 *
 * @returns {number[]|null} Indices into the original colour list
 */
function findSeparatedSet(nodes, matrix, threshold, size) {
  if (size > nodes.length) return null;
  if (size === 0) return [];

  const count = nodes.length;
  const adjacent = [];
  for (let i = 0; i < count; i += 1) {
    adjacent.push(new Array(count).fill(false));
  }
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const joined = matrix[nodes[i]][nodes[j]] >= threshold;
      adjacent[i][j] = joined;
      adjacent[j][i] = joined;
    }
  }

  let steps = 0;
  const chosen = [];

  function expand(candidates) {
    if (chosen.length === size) return chosen.slice();

    for (let k = 0; k < candidates.length; k += 1) {
      steps += 1;
      if (steps > SOLVER_STEP_BUDGET) {
        throw new Error("Separation search exceeded its step budget");
      }
      if (chosen.length + (candidates.length - k) < size) return null;

      const vertex = candidates[k];
      const next = [];
      for (let n = k + 1; n < candidates.length; n += 1) {
        if (adjacent[vertex][candidates[n]]) next.push(candidates[n]);
      }

      chosen.push(vertex);
      const found = expand(next);
      if (found) return found;
      chosen.pop();
    }
    return null;
  }

  const all = [];
  for (let i = 0; i < count; i += 1) all.push(i);

  const found = expand(all);
  return found ? found.map((local) => nodes[local]) : null;
}

/**
 * The largest separation a set of `size` colours can hold, found by
 * binary search over the thresholds that actually occur. The graph only
 * loses edges as the threshold rises, so the property is monotone and
 * the search is exact.
 */
function bestSeparationFor(nodes, matrix, size) {
  if (size > nodes.length) {
    return {
      size: size,
      possible: false,
      reason: "fewer usable colours than the set needs",
    };
  }

  const values = new Set([0]);
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      values.add(matrix[nodes[i]][nodes[j]]);
    }
  }
  const ladder = Array.from(values).sort((a, b) => a - b);

  let low = 0;
  let high = ladder.length - 1;
  let bestIndex = -1;
  let bestSet = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const set = findSeparatedSet(nodes, matrix, ladder[middle], size);
    if (set) {
      bestIndex = middle;
      bestSet = set;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (bestIndex < 0) {
    return { size: size, possible: false, reason: "no set found" };
  }

  return {
    size: size,
    possible: true,
    threshold: ladder[bestIndex],
    set: bestSet,
  };
}

function sweepSeparation(nodes, matrix, maxSize) {
  const rows = [];
  const limit = Math.min(maxSize, nodes.length);
  for (let size = 2; size <= limit; size += 1) {
    rows.push(bestSeparationFor(nodes, matrix, size));
  }
  return rows;
}

/**
 * Parse a pasted palette. Accepts "Name #rrggbb", "#rrggbb Name", or a
 * bare hex per line.
 */
function parsePalette(text) {
  const colours = [];
  const rejected = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/#[0-9a-fA-F]{3,8}\b/);
    if (!match) {
      rejected.push(trimmed);
      return;
    }
    const hex = match[0];
    let name = trimmed.replace(hex, "").trim().replace(/[,:;]+$/, "");
    if (!name) name = hex;
    try {
      colours.push({
        name: name,
        hex: chroma(hex).hex().toLowerCase(),
      });
    } catch (error) {
      rejected.push(trimmed);
    }
  });
  return { colours: colours, rejected: rejected };
}

const Engine = Object.freeze({
  CSS_REFERENCE_PIXEL_DEGREES: CSS_REFERENCE_PIXEL_DEGREES,
  CSS_REFERENCE_PIXEL_RADIANS: CSS_REFERENCE_PIXEL_RADIANS,
  HAIRLINE_EFFECTIVE_PX: HAIRLINE_EFFECTIVE_PX,
  SOLVER_MAX_SET_SIZE: SOLVER_MAX_SET_SIZE,
  round: round,
  computeGeometry: computeGeometry,
  capToFontMm: capToFontMm,
  fontToCapMm: fontToCapMm,
  effectivePixels: effectivePixels,
  computeLineBudget: computeLineBudget,
  contrastPair: contrastPair,
  buildSeparationMatrix: buildSeparationMatrix,
  findSeparatedSet: findSeparatedSet,
  bestSeparationFor: bestSeparationFor,
  sweepSeparation: sweepSeparation,
  parsePalette: parsePalette,
});

/* ==================================================================
   LAYER 2: MODEL. Frozen data only.

   Adding a role, a status or a palette entry is an edit HERE and
   nowhere else. The controls, the findings, the export and the solver
   all read this.
   ================================================================== */

/**
 * The 45 University of Southampton brand colours, copied as DATA from
 * contrastCards.html. Specifications get copied; derived figures never
 * do. Every ratio, Lc and delta E on this page is computed at runtime.
 */
const DEFAULT_COLOURS = Object.freeze([
  { name: "White", hex: "#fafafa" },
  { name: "Marine Blue", hex: "#002f4c" },
  { name: "University Blue", hex: "#005c84" },
  { name: "Black", hex: "#111111" },
  { name: "Midnight Blue", hex: "#003784" },
  { name: "Vibrant Blue", hex: "#0265ca" },
  { name: "Mid Blue", hex: "#68b9e8" },
  { name: "Sky Blue", hex: "#91dcf4" },
  { name: "Light Blue", hex: "#cbebfd" },
  { name: "Digital Blue", hex: "#00ddff" },
  { name: "Warm Neutral 01", hex: "#3e3836" },
  { name: "Warm Neutral 02", hex: "#706b69" },
  { name: "Warm Neutral 03", hex: "#b3a59d" },
  { name: "Warm Neutral 04", hex: "#d1c6c0" },
  { name: "Warm Neutral 05", hex: "#ece6e1" },
  { name: "Warm Neutral 06", hex: "#fbf9f7" },
  { name: "Cool Neutral 01", hex: "#495961" },
  { name: "Cool Neutral 02", hex: "#758d9a" },
  { name: "Cool Neutral 03", hex: "#9eb1bd" },
  { name: "Cool Neutral 04", hex: "#e1e8ec" },
  { name: "Cool Neutral 05", hex: "#f5f5f5" },
  { name: "Marine 01", hex: "#00403e" },
  { name: "Marine 02", hex: "#0c838c" },
  { name: "Marine 03", hex: "#00b0b3" },
  { name: "Marine 04", hex: "#83dbd2" },
  { name: "Marine 05", hex: "#c9f7f0" },
  { name: "Digital Marine", hex: "#00ffae" },
  { name: "Forest 01", hex: "#01530d" },
  { name: "Forest 02", hex: "#0c8c41" },
  { name: "Forest 03", hex: "#8bd100" },
  { name: "Forest 04", hex: "#83db8c" },
  { name: "Forest 05", hex: "#d4f7c9" },
  { name: "Digital Forest", hex: "#cfff00" },
  { name: "Horizon 01", hex: "#5a0202" },
  { name: "Horizon 02", hex: "#e63037" },
  { name: "Horizon 03", hex: "#ef7d00" },
  { name: "Horizon 04", hex: "#fcbc00" },
  { name: "Horizon 05", hex: "#fff4dd" },
  { name: "Digital Horizon", hex: "#fbfc00" },
  { name: "Amethyst 01", hex: "#6c0370" },
  { name: "Amethyst 02", hex: "#d500a0" },
  { name: "Amethyst 03", hex: "#ea42cb" },
  { name: "Amethyst 04", hex: "#db83d4" },
  { name: "Amethyst 05", hex: "#ece1ec" },
  { name: "Digital Amethyst", hex: "#ff34d3" },
]);

/**
 * APCA levels, highest first. Copied as data from contrastCards.html,
 * and the same ladder the guidance prints in section 4.
 */
const APCA_LEVELS = Object.freeze([
  {
    min: 90,
    badge: "Lc90+",
    description: "the preferred level for body text",
  },
  { min: 75, badge: "Lc75+", description: "the minimum for body text" },
  {
    min: 60,
    badge: "Lc60+",
    description: "the minimum for larger content text",
  },
  {
    min: 45,
    badge: "Lc45+",
    description:
      "the minimum for large headline text and essential non-text",
  },
  {
    min: 30,
    badge: "Lc30+",
    description:
      "spot-readable only, such as placeholder or disabled text",
  },
]);

// The legal floor. Text and non-text carry different figures.
const WCAG_FLOORS = Object.freeze({
  TEXT: 4.5,
  GRAPHICAL: 3.0,
});

/**
 * READING DISTANCE IS THE MODEL. THE LADDER IS DERIVED FROM IT.
 *
 * Section 2's four rungs - 14, 10, 7 and 6 mm of cap height - sat here
 * as a frozen table for five iterations, which hard-coded one answer
 * to a question that has two coherent ones. They are not four
 * independent numbers. They are ONE angular size, held constant, at
 * four distances.
 *
 * The anchor is the document's own: a 6 mm cap read at 600 mm. Hold
 * that subtense and a cap height is just a distance,
 * cap = 6 x D / 600, and the rungs come back as 1400, 1000, 700 and
 * 600 mm - the endpoints of section 2's two stated viewing ranges.
 *
 * THIS IS A RECONSTRUCTION, NOT A STATED FACT. The document gives the
 * ranges and gives the caps; nowhere does it say the second is derived
 * from the first. The arithmetic reproduces its table exactly, which
 * is strong evidence and is not proof, and every distance this page
 * prints is labelled as reconstructed.
 */
const READING_ANCHOR = Object.freeze({ capMm: 6, distanceMm: 600 });

function capForReadingDistance(distanceMm) {
  return (READING_ANCHOR.capMm * distanceMm) / READING_ANCHOR.distanceMm;
}

function readingDistanceForCap(capMm) {
  return (READING_ANCHOR.distanceMm * capMm) / READING_ANCHOR.capMm;
}

/** The rungs, as the distances they are reconstructed from. */
const GUIDANCE_READING_DISTANCES = Object.freeze({
  status: 1400,
  room: 1000,
  booking: 700,
  body: 600,
});

/**
 * The document's table, copied verbatim as a specification and kept
 * SEPARATE from the derivation - so the reconstruction can be checked
 * against it rather than quietly agreeing with itself. The canary
 * compares the two; if they ever part, the reconstruction is wrong and
 * the stated figures are not.
 */
const GUIDANCE_STATED_CAPS = Object.freeze({
  status: 14,
  room: 10,
  booking: 7,
  body: 6,
});

const SIZE_CLASS_NAMES = Object.freeze({
  status: "Room status word",
  room: "Room identification",
  booking: "Booking title and times",
  body: "Body text floor",
});

const SIZE_LADDER = Object.freeze(
  Object.keys(GUIDANCE_READING_DISTANCES).reduce((ladder, key) => {
    ladder[key] = Object.freeze({
      name: SIZE_CLASS_NAMES[key],
      readMm: GUIDANCE_READING_DISTANCES[key],
      capMm: capForReadingDistance(GUIDANCE_READING_DISTANCES[key]),
      statedCapMm: GUIDANCE_STATED_CAPS[key],
    });
    return ladder;
  }, {})
);

/**
 * Floors stay floors. The guidance states two minima - 6 mm body
 * (section 2) and 10 mm room identification (acceptance criterion 1) -
 * so the approach control decides what is PROMOTED and can never lower
 * a role below its own floor.
 */
function floorCapMmFor(role) {
  if (!role || !role.sizeClass) return 0;
  return role.sizeClass === "room"
    ? GUIDANCE_STATED_CAPS.room
    : GUIDANCE_STATED_CAPS.body;
}

// 600 mm is not the decision - everything must be readable there. The
// decision is what must ALSO be readable at the approach range,
// because only one or two things can be.
const APPROACH_DISTANCE_MM = GUIDANCE_READING_DISTANCES.status;
const SECOND_TIER_DISTANCE_MM = GUIDANCE_READING_DISTANCES.room;
const GUIDANCE_APPROACH_ROLE_ID = "status-text";
const APPROACH_ROLE_IDS = Object.freeze([
  "status-text",
  "title",
  "room",
]);

/**
 * Which APCA level a role has to clear, chosen by its CURRENT rendered
 * cap height rather than by its name - so shrinking a role raises its
 * gate, which is the point being taught.
 *
 * Anchored on two figures the guidance states: body text at the 6mm
 * floor takes Lc 90 (section 4 and acceptance criterion 2), and the
 * 14mm status word sits in the Lc 60 "larger content text" band
 * (section 4's worked example on Horizon 04). The 7mm and 10mm
 * boundaries between them are INFERRED from those two, not stated in
 * the document, and the page says so wherever it uses them.
 */
const APCA_BAND_BY_CAP = Object.freeze([
  Object.freeze({
    minCapMm: SIZE_LADDER.room.capMm,
    lc: 60,
    why: "larger content text - guidance section 4 puts the 14mm status word in this band",
  }),
  Object.freeze({
    minCapMm: SIZE_LADDER.booking.capMm,
    lc: 75,
    why: "the design gate for content text - guidance section 4",
  }),
  Object.freeze({
    minCapMm: 0,
    lc: 90,
    why: "body text at or below the 6mm floor takes the preferred level - guidance section 4 and criterion 2",
  }),
]);

// Essential non-text: the ladder's own Lc 45 row, with WCAG's 3:1.
const NON_TEXT_LC = 45;

/**
 * The badge fill gate is a SWITCH, not a constant.
 *
 * panel-palette-analysis.md gated fills on WCAG 3:1 alone; this tool
 * originally added APCA Lc 45 on top. That is not a rounding
 * difference: Marine 02, Forest 02 and Horizon 02 clear 3:1 and fail
 * Lc 45, and they are exactly the dark colours that move a set of
 * three statuses from a weak separation to a strong one. Both answers
 * are computed and printed side by side so the guidance can settle it
 * on evidence rather than on assertion.
 *
 * Scoped to badge fills ONLY. The logo, divider and footer bar are
 * essential non-text in the ordinary sense and keep Lc 45 whichever
 * setting is chosen.
 */
const FILL_GATE_MODES = Object.freeze([
  Object.freeze({
    id: "both",
    label: "WCAG 3:1 and APCA Lc " + NON_TEXT_LC,
    lc: NON_TEXT_LC,
    note: "the stricter reading, and this tool's default",
  }),
  Object.freeze({
    id: "wcagOnly",
    label: "WCAG 3:1 only",
    lc: 0,
    note: "what panel-palette-analysis.md used",
  }),
]);

const DEFAULT_FILL_GATE = "both";

/**
 * The panel's wording, seeded from the colleague's screenshot. Content
 * is STATE: the status wording is a size decision, and it cannot be
 * demonstrated as one unless someone can type a shorter word and watch
 * it fit.
 */
/**
 * The badge's own levers. Its size is driven by three things and NONE
 * of them is contrast: the cap height, this padding, and the length of
 * the wording. The padding is seeded from the colleague's `.5em 1em`
 * and is roughly half the pill's height - about 19 mm on a 135.9 mm
 * panel at the 14 mm cap rung, near enough a whole body line.
 *
 * The border is the interesting one. It draws the badge's boundary,
 * which removes the fill's own 3:1-against-the-page requirement and so
 * admits the dark end of the palette. Off by default, so existing
 * figures stay comparable and switching it on is a deliberate act.
 */
/**
 * FILLED OR OUTLINED, and the gate is not the same question.
 *
 * A filled badge's colour is a block behind text, so it answers to the
 * fill gate. An OUTLINED badge's colour is the text itself, drawn on
 * the page background with a ring of the same colour - so it takes the
 * TEXT ladder against the page, chosen by the status word's own cap
 * height, and the fill gate never applies to it. Assuming otherwise is
 * the conflation that masked the fill-gate switch in iteration 3, so
 * the gate is recomputed from the style rather than carried over.
 */
const BADGE_STYLE_FILLED = "filled";
const BADGE_STYLE_OUTLINED = "outlined";
const BADGE_STYLES = Object.freeze([
  Object.freeze({
    id: BADGE_STYLE_FILLED,
    label: "Filled",
    note: "a block of colour behind the word, which is what the colleague built",
  }),
  Object.freeze({
    id: BADGE_STYLE_OUTLINED,
    label: "Outlined",
    note: "a ring and the word in the status colour, on the page background - a large cut in the saturated AREA, computed and printed in the area readout rather than estimated here, though the badge's box is the same size either way",
  }),
]);

/**
 * THE BORDER IS A RESCUE, NOT A DECORATION.
 *
 * Under `auto` a fill that already carries its own edge - 3:1 and Lc 45
 * against the page - is drawn without a border, and only a fill that misses
 * that gate gets one. So the border appears exactly where it is doing work,
 * and both chosen schemes render borderless.
 *
 * `always` and `never` exist for demonstration: showing a stakeholder the
 * same scheme with and without is worth more than describing the difference.
 *
 * The consequence that has to be said out loud, because it is the one thing a
 * reader would get wrong: AUTO DOES NOT SHRINK THE POOL. Admission is by the
 * boundary disjunction whenever a border is AVAILABLE, and auto keeps one
 * available for every fill that would need it - so auto and always admit the
 * same colours, and differ only in what is drawn. Only `never` shrinks the
 * pool, back to the fills that carry their own edge.
 */
const BADGE_BORDER_AUTO_MODE = "auto";
const BADGE_BORDER_MODES = Object.freeze([
  Object.freeze({
    id: BADGE_BORDER_AUTO_MODE,
    label: "Automatic - only where the fill needs one",
  }),
  Object.freeze({ id: "always", label: "Always, on every status" }),
  Object.freeze({ id: "never", label: "Never" }),
]);

/**
 * THE TWO CHOSEN SCHEMES, as data.
 *
 * Named trios rather than solver output. The solver's job was to show what the
 * palette could do; these were then CHOSEN by eye from what it showed, and a
 * chosen scheme is a decision, not a result - so it is written down, not
 * recomputed. The recorded figures come from the reviewer's own probe
 * (panel-fill-options.md, 14 August 2026) and the tool cross-checks its own
 * measurements against them, because two instruments agreeing is worth more
 * than either instrument asserting.
 *
 * Applying a scheme CLEARS the chroma ceiling and the lightness floor. Those
 * exist to constrain what the solver may pick; leaving a ceiling of 40 in
 * place beside a chosen gold at chroma 83 would have the readout claim the
 * pool excludes the colour on screen.
 */
const PANEL_SCHEMES = Object.freeze([
  Object.freeze({
    id: "B",
    label: "Gold pop (the default)",
    note: "one colour swapped from the soft default, and better in every mode including greyscale - the poppier scheme is the more distinguishable one",
    fills: Object.freeze(["#fafafa", "#68b9e8", "#fcbc00"]),
    // Reviewer's probe, for the cross-check. Never used as a display value.
    probe: Object.freeze({
      none: 42.4, protanopia: 37.8, deuteranopia: 45.4,
      tritanopia: 36.6, greyscale: 8.1,
    }),
  }),
  Object.freeze({
    id: "F2",
    label: "Green, gold and blue (alternate)",
    note: "the strongest measured red-green separation of any trio reviewed, and the same greyscale figure as the default",
    fills: Object.freeze(["#d4f7c9", "#fcbc00", "#68b9e8"]),
    probe: Object.freeze({
      none: 54.6, protanopia: 55.3, deuteranopia: 59.0,
      tritanopia: 30.9, greyscale: 8.1,
    }),
  }),
]);

const DEFAULT_SCHEME_ID = "B";

const BADGE_DEFAULTS = Object.freeze({
  padY: 0.5,
  padX: 1,
  shape: "pill",
  style: BADGE_STYLE_FILLED,
  borderMode: BADGE_BORDER_AUTO_MODE,
  // Millimetres on the glass, not pixels: 2 panel px is 0.227 mm,
  // about one effective pixel at 600 mm, which is exactly what the
  // divider rule already gets flagged for.
  borderMm: 0.75,
  borderColour: "auto",
});

/**
 * WHICH AUDIENCES THE SOLVER IS ASKED TO SEPARATE FOR.
 *
 * The solver reduces every pair of fills to its SMALLEST delta E
 * across a set of modes, so whatever is in that set binds the answer.
 * Which modes belong in it is a design decision, not a fact:
 *
 * - Normal vision is always in it. A pair that collapses unsimulated
 *   is not a colour scheme.
 * - Colour blindness is in it by default. Protanopia, deuteranopia and
 *   tritanopia are the three the simulator models.
 * - GREYSCALE IS NOT, BY DEFAULT, AND THAT IS THE POINT. The panel
 *   always carries the status WORD, so nobody has to read colour to
 *   read the panel and SC 1.4.1 is satisfied by the text. Greyscale
 *   separation is then a bonus - worth measuring, worth showing, not
 *   worth vetoing a scheme over. It had been binding almost every set,
 *   and because the brand's soft tones cluster at high lightness it was
 *   binding them toward saturated extremes; that is the whole reason
 *   the default panel was a saturated orange beside a saturated blue.
 *
 * Unticked does NOT mean unmeasured. Every mode is measured and shown
 * in every readout whatever this is set to; the switches decide only
 * what the solver's minimum is taken over.
 */
const DESIGN_FOR_DEFAULTS = Object.freeze({
  colourBlindness: true,
  greyscale: false,
});

const BADGE_SHAPES = Object.freeze([
  Object.freeze({
    id: "pill",
    label: "Pill that hugs the wording",
  }),
  Object.freeze({
    id: "bar",
    label: "Full-width bar",
  }),
]);

// Auto-picks between these two per status. Both are brand colours from
// the palette, not invented values.
const BADGE_BORDER_CANDIDATES = Object.freeze(["#111111", "#fafafa"]);
const BADGE_BORDER_AUTO = "auto";

/**
 * The lockup's own artwork box, and how the colleague sizes it.
 *
 * Their CSS sizes it by WIDTH - `.single-day_header__logo { width:
 * 25rem }` - while every role here carries a HEIGHT, so the as-built
 * height is converted through the viewBox rather than typed in.
 */
const LOGO_VIEWBOX = Object.freeze({ width: 1522, height: 620 });
const LOGO_ASPECT = LOGO_VIEWBOX.width / LOGO_VIEWBOX.height;
const LOGO_AS_BUILT_WIDTH_REM = 25;
const LOGO_AS_BUILT_HEIGHT_REM = LOGO_AS_BUILT_WIDTH_REM / LOGO_ASPECT;

const CONTENT_DEFAULTS = Object.freeze({
  logo: "University of Southampton",
  clock: "14:34",
  date: "Friday 15 May",
  times: "14:00 - 16:00",
  room: " | Lecture Theatre A",
  code: "MANG1049",
  title: "Even More Ideas that Shape the Cont World",
});

/**
 * Seed values. Panel dimensions and viewing distance from guidance
 * section 2; the cap ratio is Inter's, which is the typeface the built
 * panel uses.
 */
const PANEL_DEFAULTS = Object.freeze({
  panelWpx: 1920,
  panelHpx: 1200,
  panelWmm: 217.5,
  panelHmm: 135.9,
  distanceMm: 600,
  capRatio: 0.727,
  lineSpacing: 1.5,
  // Guidance section 3's padding allowance for the budget arithmetic.
  paddingMm: 16,
});

const CAP_RATIOS = Object.freeze({
  INTER: 0.727,
  RULE_OF_THUMB: 0.7,
});

/**
 * The as-built layout, read off the colleague's stylesheet. These are
 * source values, not derived ones: rem multipliers, a border width in
 * panel pixels, and the two paddings. Everything measured FROM them -
 * millimetres, cap heights, effective pixels - is computed at runtime.
 */
const AS_BUILT = Object.freeze({
  padXRem: 3,
  padYRem: 0.5,
  dividerPx: 2,
  footerBarRem: 0.25,
  // The colleague's CSS sets no line-height, so the panel renders at
  // the font's own normal. This is the value the frame uses until
  // someone changes it, and it is NOT a measurement of that font.
  lineHeight: 1.2,
});

/**
 * ROLES. One entry per thing on the panel that carries a colour.
 *
 *   kind: "surface"     something other roles sit on
 *         "text"        must reach its derived APCA level
 *         "graphical"   3:1 and Lc 45; flagged when the rendered line
 *                       falls below one effective pixel
 *   sizeClass: which rung of the guidance ladder judges it
 *   lines: what it costs against the nine-line budget
 */
const ROLES = Object.freeze([
  Object.freeze({
    id: "page-bg",
    name: "Page background",
    kind: "surface",
    cssVar: "--marine-blue",
    defaultHex: "#002f4c",
    why: "everything on the panel is judged against this",
  }),
  Object.freeze({
    id: "header-bg",
    name: "Header background",
    kind: "surface",
    cssVar: "--marine-blue",
    defaultHex: "#002f4c",
    why: "the colleague's CSS points this at the same variable as the page background",
  }),
  Object.freeze({
    id: "logo",
    name: "Logo",
    contentKey: "logo",
    kind: "graphical",
    element: "logo",
    surface: "header-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    sizeGated: false,
    asBuiltRem: LOGO_AS_BUILT_HEIGHT_REM,
    lines: 0,
    why: "essential non-text: it identifies the institution, so it takes the 3:1 and Lc 45 non-text floors. This is the real lockup, inlined and filled with currentColor, so the colour on screen is the colour being measured. Its size is a height: the colleague sets width 25rem, converted here through the artwork's own 1522x620 box.",
  }),
  Object.freeze({
    id: "clock",
    name: "Clock",
    contentKey: "clock",
    kind: "text",
    element: "clock",
    surface: "header-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    asBuiltRem: 4,
    sizeClass: "body",
    lines: 1,
  }),
  Object.freeze({
    id: "date",
    name: "Date",
    contentKey: "date",
    kind: "text",
    element: "date",
    surface: "header-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    asBuiltRem: 1.25,
    sizeClass: "body",
    lines: 1,
  }),
  Object.freeze({
    id: "status-text",
    name: "Status word",
    kind: "text",
    element: "status-text",
    surface: "badge",
    cssVar: "--black",
    defaultHex: "#111111",
    asBuiltRem: 2,
    sizeClass: "status",
    lines: 1,
    why: "principle 5: every status carries a word, so this text is load-bearing and is scored against EVERY badge fill, not just the one on screen",
  }),
  Object.freeze({
    id: "times",
    name: "Booking times",
    contentKey: "times",
    kind: "text",
    element: "times",
    surface: "page-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    asBuiltRem: 2,
    sizeClass: "booking",
    lines: 1,
  }),
  Object.freeze({
    id: "room",
    name: "Room identification",
    contentKey: "room",
    kind: "text",
    element: "room",
    surface: "page-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    asBuiltRem: 2,
    sizeClass: "room",
    // Shares its line with the booking times in the built design.
    lines: 0,
    why: "it shares an element with the booking times in the built design, so the two roles are the same size and answer to different rungs of the ladder",
  }),
  Object.freeze({
    id: "code",
    name: "Course code",
    contentKey: "code",
    kind: "text",
    element: "code",
    surface: "page-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    asBuiltRem: 4,
    sizeClass: "body",
    lines: 1,
  }),
  Object.freeze({
    id: "title",
    name: "Booking title",
    contentKey: "title",
    kind: "text",
    element: "title",
    surface: "page-bg",
    cssVar: "--white",
    defaultHex: "#fafafa",
    asBuiltRem: 6,
    sizeClass: "booking",
    lines: 2,
  }),
  Object.freeze({
    id: "divider",
    name: "Divider rule",
    kind: "graphical",
    surface: "page-bg",
    cssVar: "--digital-blue",
    defaultHex: "#00ddff",
    asBuiltThicknessPx: 2,
    lines: 0,
    why: "a 2px border in the built CSS - which is a physical thickness once the panel's pixel is converted",
  }),
  Object.freeze({
    id: "footer-bar",
    name: "Footer bar",
    kind: "graphical",
    surface: "page-bg",
    cssVar: "--digital-blue",
    defaultHex: "#00ddff",
    asBuiltThicknessRem: 0.25,
    lines: 0,
  }),
]);

/**
 * STATUSES. The distinguishable set. Each fill must clear 3:1 against
 * the page background, host the status word at its own level, and hold
 * a delta E floor against every other fill in all five modes.
 *
 * Add one here and its control, its findings and its place in the
 * solver all follow. Nothing else needs editing.
 */
const STATUSES = Object.freeze([
  Object.freeze({
    id: "free",
    label: "Free",
    cssVar: "--digital-blue",
    defaultHex: "#00ddff",
  }),
  Object.freeze({
    id: "soon",
    label: "Starting Soon",
    cssVar: "--digital-marine",
    defaultHex: "#00ffae",
  }),
  Object.freeze({
    id: "running",
    label: "Currently Running",
    cssVar: "--digital-amethyst",
    defaultHex: "#ff34d3",
  }),
]);

// Which status the frame shows when the page opens - the one in the
// colleague's screenshot, so the two can be compared directly.
const DEFAULT_STATUS_ID = "running";

/**
 * Short wording for the recommended panel.
 *
 * At the ladder's 14 mm status cap - the largest rung - "Currently
 * Running" is 17 characters and does not fit the body width, so the
 * as-built wording and the guidance sizes cannot both be satisfied.
 * That collision is real arithmetic and survives the em fix; these are
 * the shortest labels that keep the three statuses distinguishable.
 */
const RECOMMENDED_STATUS_LABELS = Object.freeze({
  free: "Free",
  soon: "Soon",
  running: "In use",
});

// Padding, per preset. As-built keeps the colleague's `.5em 1em` for
// fidelity; the recommended panel takes something tighter, which buys
// characters back at the same cap height.
/**
 * The recommended panel's badge padding and line spacing, taken from a
 * MEASURED frontier. Every figure below is POST scale fix - measured
 * on the corrected 595.2 x 372 surface, not the 571.2 x 348 one the
 * bezel bug produced.
 *
 * The default opened with its booking title entirely clipped for three
 * iterations - 0 of 41 characters - and the cause is not the wording.
 * The title's box is `flex: 1 1 0` and takes what the lines above
 * leave. At the guidance's cap heights and padding 0.3 the badge is
 * 110.7 px of a 296.8 px body, 37.3%, and the title box gets 25.2 px
 * against the 52.71 px it needs (39.5 px of line plus its own 13.18 px
 * of padding-top). Shortening the title from 41 characters to 16
 * changes NOTHING, because no wording fits in zero lines.
 *
 * WHICH LEVER, AND IN WHICH ORDER. Line spacing 1.5 is stated in the
 * guidance; badge padding is stated nowhere, so padding is the free
 * lever and it gets exhausted first. Iteration 7 took padding halfway,
 * to 0.15, then broke the stated figure - which was the wrong order,
 * and was also measured on the pre-fix surface that had 24 px less
 * body height to give.
 *
 * That surface was worse than short by 24 px: at padding 0.3 its body
 * was ALSO overflowing. The parts summed to 284.82 px inside a
 * 272.80 px body and the divider rule was being cut off by 12.02 px,
 * silently, by `overflow: hidden`. So of the 24.02 px the fix
 * returned, 12.02 went to absorbing that clipping and 11.99 to the
 * title box - which is where the "half the height went somewhere
 * unnamed" question resolves. Nothing else moved by a hundredth of a
 * pixel. The canary row "the body's children account for its height"
 * now asserts this.
 *
 * On the corrected surface, at the stated 1.5, the frontier is padding
 * 0.03: headroom +0.91 px at 0.03, -0.12 px at 0.04, and the title
 * clips from 0.05 up. Zero is chosen over 0.03 for margin - under a
 * pixel of headroom flips on any font-metric change - and it costs
 * nothing visually, because a 1.5 line box already carries 0.25em of
 * leading above and below the em box. The padding was doubling that.
 *
 * So the guidance's stated line spacing is affordable and is honoured.
 * Findings go from 4 to 3: the Fit finding on the booking title
 * retires and no Typography finding is raised.
 */
const RECOMMENDED_BADGE_PADDING = Object.freeze({
  padY: 0,
  padX: 0.7,
});
const RECOMMENDED_LINE_SPACING = PANEL_DEFAULTS.lineSpacing;

// The background the guidance document's section 4 analysis assumes,
// kept beside the background actually in use so the two can be scored
// against each other.
const GUIDANCE_BACKGROUND = "#111111";

/**
 * Status fills, expressed as roles, so one list drives every control.
 * @returns {Object[]}
 */
function statusRoles() {
  return STATUSES.map((status) =>
    Object.freeze({
      id: "status-fill-" + status.id,
      statusId: status.id,
      name: status.label + " badge fill",
      kind: "status-fill",
      surface: "page-bg",
      cssVar: status.cssVar,
      defaultHex: status.defaultHex,
      lines: 0,
      why: "a block of solid colour behind the status word: 3:1 against the page background, and far enough from every other fill in all five modes",
    })
  );
}

function allRoles() {
  return ROLES.concat(statusRoles());
}

function roleById(id) {
  return allRoles().filter((role) => role.id === id)[0] || null;
}

const Model = Object.freeze({
  DEFAULT_COLOURS: DEFAULT_COLOURS,
  APCA_LEVELS: APCA_LEVELS,
  WCAG_FLOORS: WCAG_FLOORS,
  SIZE_LADDER: SIZE_LADDER,
  READING_ANCHOR: READING_ANCHOR,
  GUIDANCE_READING_DISTANCES: GUIDANCE_READING_DISTANCES,
  GUIDANCE_STATED_CAPS: GUIDANCE_STATED_CAPS,
  APPROACH_DISTANCE_MM: APPROACH_DISTANCE_MM,
  SECOND_TIER_DISTANCE_MM: SECOND_TIER_DISTANCE_MM,
  GUIDANCE_APPROACH_ROLE_ID: GUIDANCE_APPROACH_ROLE_ID,
  APPROACH_ROLE_IDS: APPROACH_ROLE_IDS,
  capForReadingDistance: capForReadingDistance,
  readingDistanceForCap: readingDistanceForCap,
  floorCapMmFor: floorCapMmFor,
  APCA_BAND_BY_CAP: APCA_BAND_BY_CAP,
  NON_TEXT_LC: NON_TEXT_LC,
  FILL_GATE_MODES: FILL_GATE_MODES,
  DEFAULT_FILL_GATE: DEFAULT_FILL_GATE,
  CONTENT_DEFAULTS: CONTENT_DEFAULTS,
  BADGE_DEFAULTS: BADGE_DEFAULTS,
  DESIGN_FOR_DEFAULTS: DESIGN_FOR_DEFAULTS,
  BADGE_SHAPES: BADGE_SHAPES,
  BADGE_STYLES: BADGE_STYLES,
  BADGE_STYLE_FILLED: BADGE_STYLE_FILLED,
  BADGE_STYLE_OUTLINED: BADGE_STYLE_OUTLINED,
  BADGE_BORDER_CANDIDATES: BADGE_BORDER_CANDIDATES,
  BADGE_BORDER_MODES: BADGE_BORDER_MODES,
  BADGE_BORDER_AUTO_MODE: BADGE_BORDER_AUTO_MODE,
  BADGE_BORDER_AUTO: BADGE_BORDER_AUTO,
  LOGO_VIEWBOX: LOGO_VIEWBOX,
  LOGO_ASPECT: LOGO_ASPECT,
  LOGO_AS_BUILT_WIDTH_REM: LOGO_AS_BUILT_WIDTH_REM,
  PANEL_DEFAULTS: PANEL_DEFAULTS,
  PANEL_SCHEMES: PANEL_SCHEMES,
  DEFAULT_SCHEME_ID: DEFAULT_SCHEME_ID,
  CAP_RATIOS: CAP_RATIOS,
  AS_BUILT: AS_BUILT,
  ROLES: ROLES,
  STATUSES: STATUSES,
  DEFAULT_STATUS_ID: DEFAULT_STATUS_ID,
  RECOMMENDED_STATUS_LABELS: RECOMMENDED_STATUS_LABELS,
  RECOMMENDED_BADGE_PADDING: RECOMMENDED_BADGE_PADDING,
  RECOMMENDED_LINE_SPACING: RECOMMENDED_LINE_SPACING,
  GUIDANCE_BACKGROUND: GUIDANCE_BACKGROUND,
  allRoles: allRoles,
  roleById: roleById,
});
/* ==================================================================
   STATE AND DERIVATION

   The single mutable object, and the pure-ish reduction from it to
   every figure the page shows. The frame and the controls both read
   the derived object and never recompute anything themselves.
   ================================================================== */

/**
 * The one mutable state object. Every derivation below takes a state
 * as an argument, defaulting to this one, so a hypothetical
 * configuration - a gallery candidate - can be scored by exactly the
 * same code that scores what is on screen. Generated commentary that
 * came from a second code path could drift from the numbers; this is
 * how it is prevented.
 */
const state = {
  geometry: Object.assign({}, Model.PANEL_DEFAULTS),
  palette: Model.DEFAULT_COLOURS.map((colour) =>
    Object.assign({}, colour)
  ),
  colours: {},
  caps: {},
  thickness: {},
  locks: {},
  content: Object.assign({}, Model.CONTENT_DEFAULTS),
  statusLabels: {},
  badge: Object.assign({}, Model.BADGE_DEFAULTS),
  // Which modes the solver's minimum is taken over. Everything is
  // still MEASURED whatever this holds - see DESIGN_FOR_DEFAULTS.
  designFor: Object.assign({}, Model.DESIGN_FOR_DEFAULTS),
  fillGate: Model.DEFAULT_FILL_GATE,
  // Which role owns the approach range. The per-role reading
  // distances in `caps` are the mechanism; this records which preset
  // last set them, so a departure can be named.
  approachRoleId: Model.GUIDANCE_APPROACH_ROLE_ID,
  // LCH chroma ceiling over the candidate pool, or null for off. A
  // CEILING and not a weighting: the solver maximises delta E, which
  // is exactly what selects the most extreme colours available, so
  // softer tones cannot be a preference applied to its output. The
  // pool has to be smaller before it runs, and then the cost is
  // directly readable as a smaller pool and a smaller best trio.
  chromaCeiling: null,
  // LCH lightness floor over the same pool, or null for off. See
  // aboveLightnessFloor: the ceiling alone cannot express "soft",
  // because the achromatic extremes pass every ceiling there is.
  lightnessFloor: null,
  scheme: Model.DEFAULT_SCHEME_ID,
  statusId: Model.DEFAULT_STATUS_ID,
  simulation: "none",
  frameHeightPx: 520,
  // "auto" re-fits the frame to its column on resize; any explicit
  // size choice switches this to "manual" and is then left alone.
  frameFit: "auto",
  lineHeight: Model.AS_BUILT.lineHeight,
  overlays: { caps: false, grid: false, calibration: false },
  magnify: false,
  view: "configure",
  present: false,
  presentRoleIndex: 0,
};

Model.STATUSES.forEach((status) => {
  state.statusLabels[status.id] = status.label;
});

/** A shallow-but-deep-enough copy, for scoring a candidate. */
function cloneState(st) {
  return {
    geometry: Object.assign({}, st.geometry),
    palette: st.palette,
    colours: Object.assign({}, st.colours),
    caps: Object.assign({}, st.caps),
    thickness: Object.assign({}, st.thickness),
    locks: {},
    content: Object.assign({}, st.content),
    statusLabels: Object.assign({}, st.statusLabels),
    badge: Object.assign({}, st.badge),
    designFor: Object.assign({}, st.designFor),
    fillGate: st.fillGate,
    approachRoleId: st.approachRoleId,
    chromaCeiling: st.chromaCeiling,
    lightnessFloor: st.lightnessFloor,
    statusId: st.statusId,
    simulation: st.simulation,
    frameHeightPx: st.frameHeightPx,
    frameFit: st.frameFit,
    lineHeight: st.lineHeight,
    overlays: { caps: false, grid: false, calibration: false },
    magnify: false,
  };
}

/** The text a role renders, from state rather than from the markup. */
function contentFor(role, st) {
  const source = st || state;
  if (role.id === "status-text") {
    return source.statusLabels[source.statusId] || "";
  }
  if (!role.contentKey) return "";
  return source.content[role.contentKey] || "";
}

/** Reset every role's colour to the as-built value. */
function applyAsBuiltColours() {
  Model.allRoles().forEach((role) => {
    if (state.locks[role.id]) return;
    state.colours[role.id] = role.defaultHex;
  });
}

/**
 * Reset every role's size from the colleague's CSS, converted through
 * the CURRENT geometry. Nothing is copied: the rem multiplier is the
 * source value and the millimetre comes out of the conversion.
 */
function applyAsBuiltSizes() {
  const geometry = Engine.computeGeometry(state.geometry);
  Model.allRoles().forEach((role) => {
    if (role.asBuiltRem !== undefined) {
      const fontMm = role.asBuiltRem * geometry.rootFontMm;
      state.caps[role.id] = Engine.fontToCapMm(
        fontMm,
        state.geometry.capRatio
      );
    }
    if (role.asBuiltThicknessPx !== undefined) {
      state.thickness[role.id] =
        role.asBuiltThicknessPx * geometry.mmPerPx;
    }
    if (role.asBuiltThicknessRem !== undefined) {
      state.thickness[role.id] =
        role.asBuiltThicknessRem * geometry.rootFontMm;
    }
  });
  // The as-built sizes come from rem multipliers, not from a reading
  // plan, so which element owns the approach range has to be READ back
  // out of them rather than assumed. On the colleague's panel it is
  // the booking title, which is the whole disagreement.
  let widest = null;
  Model.APPROACH_ROLE_IDS.forEach((id) => {
    const cap = state.caps[id];
    if (cap === undefined) return;
    if (!widest || cap > widest.cap) widest = { id: id, cap: cap };
  });
  if (widest) state.approachRoleId = widest.id;
}

/**
 * The per-role reading plan for one approach choice, in millimetres of
 * viewing distance. The dropdown is a PRESET over this, not a
 * replacement for it: every role keeps its own distance and the role
 * table edits them one at a time.
 */
function readingPlanFor(approachRoleId) {
  const plan = {};
  Model.allRoles().forEach((role) => {
    if (!role.sizeClass) return;
    plan[role.id] = Model.SIZE_LADDER[role.sizeClass].readMm;
  });

  if (approachRoleId !== Model.GUIDANCE_APPROACH_ROLE_ID) {
    // Demote whatever held the approach range first. Two elements at
    // 1,400 mm is the state the panel demonstrably has no room for,
    // and letting both stand would hide the trade rather than show it.
    Object.keys(plan).forEach((id) => {
      if (plan[id] > Model.SECOND_TIER_DISTANCE_MM) {
        plan[id] = Model.SECOND_TIER_DISTANCE_MM;
      }
    });
    plan[approachRoleId] = Model.APPROACH_DISTANCE_MM;
  }

  Object.keys(plan).forEach((id) => {
    const floor = Model.readingDistanceForCap(
      Model.floorCapMmFor(Model.roleById(id))
    );
    if (plan[id] < floor) plan[id] = floor;
  });
  return plan;
}

function applyReadingPlan(approachRoleId) {
  const plan = readingPlanFor(approachRoleId);
  state.approachRoleId = approachRoleId;
  Object.keys(plan).forEach((id) => {
    state.caps[id] = Model.capForReadingDistance(plan[id]);
  });
  return plan;
}

/**
 * One role's reading distance, clamped at its floor. Returns what was
 * actually applied and whether the floor bound, so the caller can say
 * so rather than silently doing something other than what was asked.
 */
function clampCapForRole(role, capMm) {
  return Math.max(Model.floorCapMmFor(role), capMm);
}

function setRoleReadingDistance(role, distanceMm) {
  const floorCapMm = Model.floorCapMmFor(role);
  const wanted = Model.capForReadingDistance(distanceMm);
  const capMm = clampCapForRole(role, wanted);
  state.caps[role.id] = capMm;
  return {
    capMm: capMm,
    distanceMm: Model.readingDistanceForCap(capMm),
    clamped: capMm > wanted + 1e-9,
    floorCapMm: floorCapMm,
  };
}

/**
 * How the current assignment differs from the guidance's own table.
 *
 * A DEPARTURE, not a failure. Promoting the booking title is a
 * legitimate answer to a different question - the colleague's panel is
 * a booking display and the guidance describes a room-status display -
 * so this is reported in its own words and never enters the findings
 * list, which is for things that fall short.
 */
function readingDepartures(st) {
  const source = st || state;
  const rows = [];
  Model.allRoles().forEach((role) => {
    if (!role.sizeClass) return;
    const stated = Model.SIZE_LADDER[role.sizeClass].statedCapMm;
    const current = source.caps[role.id];
    if (current === undefined) return;
    if (Math.abs(current - stated) < 0.005) return;
    rows.push({
      role: role,
      statedCapMm: stated,
      currentCapMm: current,
      statedReadMm: Model.readingDistanceForCap(stated),
      currentReadMm: Model.readingDistanceForCap(current),
      promoted: current > stated,
    });
  });
  return rows;
}

/** Set every size-gated role to the floor its ladder rung asks for. */
function applyGuidanceSizes() {
  applyReadingPlan(Model.GUIDANCE_APPROACH_ROLE_ID);
}

function paletteIndexOfHex(hex, st) {
  const source = st || state;
  const wanted = String(hex).toLowerCase();
  for (let i = 0; i < source.palette.length; i += 1) {
    if (source.palette[i].hex.toLowerCase() === wanted) return i;
  }
  return -1;
}

function paletteNameForHex(hex, st) {
  const source = st || state;
  const index = paletteIndexOfHex(hex, source);
  return index < 0 ? "not in the palette" : source.palette[index].name;
}

/**
 * The border colour for one fill. Auto picks whichever of the two
 * brand extremes maximises the WEAKER of its two contrasts - against
 * the fill it outlines and against the page behind it - because those
 * are exactly the two terms the boundary rule below depends on.
 */
function badgeBorderColourFor(fillHex, st) {
  const source = st || state;
  const chosen = source.badge.borderColour;
  if (chosen && chosen !== Model.BADGE_BORDER_AUTO) return chosen;

  const pageHex = source.colours["page-bg"];
  let best = null;
  Model.BADGE_BORDER_CANDIDATES.forEach((candidate) => {
    const weaker = Math.min(
      chroma.contrast(candidate, fillHex),
      chroma.contrast(candidate, pageHex)
    );
    if (!best || weaker > best.weaker) {
      best = { hex: candidate, weaker: weaker };
    }
  });
  return best.hex;
}

/**
 * Is the badge's boundary legible? THE RULE IS A DISJUNCTION: either
 * the fill itself clears 3:1 against the page, OR the border does the
 * job.
 *
 * The border branch needs BOTH of its terms. A border that clears 3:1
 * against the page but not against its own fill - a white border on
 * Digital Marine, say - is invisible against the thing it is meant to
 * outline, so it draws no boundary at all. Stating the rule as "the
 * border clears 3:1" alone would pass exactly that case.
 */
/** Does this ONE fill carry its own edge, at the fill gate against the page? */
function fillCarriesItsOwnEdge(fillHex, st) {
  const source = st || state;
  const measured = Engine.contrastPair(fillHex, source.colours["page-bg"]);
  const gate = fillGateMode(source);
  return (
    measured.wcag >= Model.WCAG_FLOORS.GRAPHICAL && measured.lc >= gate.lc
  );
}

/**
 * Whether THIS fill is drawn with a border. Per-fill, because that is what
 * "only where it is needed" means - under auto the same panel can carry a
 * border on one status and none on the other two.
 */
function borderOnFor(fillHex, st) {
  const source = st || state;
  const mode = source.badge.borderMode || BADGE_BORDER_AUTO_MODE;
  if (mode === "never") return false;
  if (mode === "always") return true;
  return !fillCarriesItsOwnEdge(fillHex, source);
}

/** Whether a border is AVAILABLE at all - which is what admission turns on. */
function badgeAdmitsBorder(st) {
  return (st || state).badge.borderMode !== "never";
}

function badgeBoundaryFor(fillHex, st) {
  const source = st || state;
  const pageHex = source.colours["page-bg"];
  const fillVsPage = Engine.contrastPair(fillHex, pageHex);
  const floor = Model.WCAG_FLOORS.GRAPHICAL;
  const result = {
    fillHex: fillHex,
    fillVsPage: fillVsPage,
    fillCarriesIt: fillVsPage.wcag >= floor,
    borderOn: borderOnFor(fillHex, source),
    floor: floor,
  };

  if (!result.borderOn) {
    result.borderProvidesIt = false;
    result.ok = result.fillCarriesIt;
    result.via = result.ok ? "the fill against the page" : "nothing";
    return result;
  }

  const borderHex = badgeBorderColourFor(fillHex, source);
  const borderVsPage = Engine.contrastPair(borderHex, pageHex);
  const borderVsFill = Engine.contrastPair(borderHex, fillHex);

  result.borderHex = borderHex;
  result.borderVsPage = borderVsPage;
  result.borderVsFill = borderVsFill;
  result.borderProvidesIt =
    borderVsPage.wcag >= floor && borderVsFill.wcag >= floor;
  result.ok = result.fillCarriesIt || result.borderProvidesIt;
  result.via = result.fillCarriesIt
    ? "the fill against the page"
    : result.borderProvidesIt
    ? "the border, against both the page and its own fill"
    : "nothing";
  return result;
}

/** The active badge-fill gate definition. */
function fillGateMode(st) {
  const source = st || state;
  const found = Model.FILL_GATE_MODES.filter(
    (mode) => mode.id === source.fillGate
  )[0];
  return found || Model.FILL_GATE_MODES[0];
}

/** Which APCA band a cap height falls in. */
function apcaBandForCap(capMm) {
  for (let i = 0; i < Model.APCA_BAND_BY_CAP.length; i += 1) {
    if (capMm >= Model.APCA_BAND_BY_CAP[i].minCapMm) {
      return Model.APCA_BAND_BY_CAP[i];
    }
  }
  return Model.APCA_BAND_BY_CAP[Model.APCA_BAND_BY_CAP.length - 1];
}

/** The highest APCA badge a measured Lc earns. */
function apcaBadgeFor(lc) {
  for (let i = 0; i < Model.APCA_LEVELS.length; i += 1) {
    if (lc >= Model.APCA_LEVELS[i].min) return Model.APCA_LEVELS[i];
  }
  return null;
}

/**
 * The gate a role must clear, and the figure that chose it.
 * Text roles are judged by their CURRENT cap height, so shrinking a
 * role raises its gate.
 */
function gateFor(role, capMm, st) {
  if (role.kind === "text") {
    const band = apcaBandForCap(capMm);
    return {
      lc: band.lc,
      wcag: Model.WCAG_FLOORS.TEXT,
      why:
        "cap height " +
        Engine.round(capMm, 2) +
        " mm puts it in the Lc " +
        band.lc +
        " band: " +
        band.why,
    };
  }

  // Badge fills, and ONLY badge fills, answer to the switch - and only
  // while they ARE fills. Outlined, the same colour is the word and
  // its ring on the page background, so it is text and takes the text
  // ladder at the status word's own cap height. Recomputed here rather
  // than inherited, because a gate that does not move with the style
  // is the iteration-3 conflation all over again.
  if (role.kind === "status-fill") {
    const source = st || state;
    if (source.badge.style === Model.BADGE_STYLE_OUTLINED) {
      const statusCapMm = source.caps["status-text"] || 0;
      const band = apcaBandForCap(statusCapMm);
      return {
        lc: band.lc,
        wcag: Model.WCAG_FLOORS.TEXT,
        why:
          "the badge is outlined, so this colour is the status word and its ring on the page rather than a fill behind them - text, at the status word's cap height of " +
          Engine.round(statusCapMm, 2) +
          " mm, which puts it in the Lc " +
          band.lc +
          " band: " +
          band.why,
      };
    }
    const mode = fillGateMode(st);
    return {
      lc: mode.lc,
      wcag: Model.WCAG_FLOORS.GRAPHICAL,
      why:
        "badge fill gate set to " +
        mode.label +
        " - " +
        mode.note +
        (mode.lc === 0
          ? ". No APCA floor is being applied to fills at this setting"
          : ""),
    };
  }

  return {
    lc: Model.NON_TEXT_LC,
    wcag: Model.WCAG_FLOORS.GRAPHICAL,
    why:
      "essential non-text: WCAG 1.4.11 at " +
      Model.WCAG_FLOORS.GRAPHICAL +
      ":1, and the ladder's Lc " +
      Model.NON_TEXT_LC +
      " row",
  };
}

/**
 * The surfaces a role is judged against. Usually one; the status word
 * is judged against EVERY badge fill, because it has to survive all of
 * them and not just the one currently on screen.
 */
function surfacesFor(role, st) {
  const source = st || state;
  if (role.surface === "badge") {
    return Model.STATUSES.map((status) => ({
      label: (source.statusLabels[status.id] || status.label) + " fill",
      hex: source.colours["status-fill-" + status.id],
    }));
  }
  if (!role.surface) return [];
  const surfaceRole = Model.roleById(role.surface);
  return [
    {
      label: surfaceRole ? surfaceRole.name : role.surface,
      hex: source.colours[role.surface],
    },
  ];
}

/**
 * Measure one candidate colour for one role, against every surface it
 * has to work on. The worst surface is the one that decides.
 */
function measureRole(role, hex, capMm, st) {
  const gate = gateFor(role, capMm, st);
  const surfaces = surfacesFor(role, st).map((surface) => {
    const measured = Engine.contrastPair(hex, surface.hex);
    return {
      label: surface.label,
      hex: surface.hex,
      wcag: measured.wcag,
      lc: measured.lc,
      lcSigned: measured.lcSigned,
      polarity: measured.polarity,
      passesWcag: measured.wcag >= gate.wcag,
      passesApca: measured.lc >= gate.lc,
    };
  });

  let worst = null;
  surfaces.forEach((surface) => {
    if (!worst || surface.lc < worst.lc) worst = surface;
  });

  return {
    gate: gate,
    surfaces: surfaces,
    worst: worst,
    passes: surfaces.every(
      (surface) => surface.passesWcag && surface.passesApca
    ),
  };
}

/**
 * Can this colour do this job? Availability is a lookup over the
 * measurements above, plus - for a badge fill - whether the status word
 * still works on it.
 * @returns {{available: boolean, reason: string}}
 */
function availabilityFor(role, hex, st) {
  const source = st || state;
  if (role.kind === "surface") {
    let clears = 0;
    source.palette.forEach((colour) => {
      const measured = Engine.contrastPair(colour.hex, hex);
      if (
        measured.wcag >= Model.WCAG_FLOORS.TEXT &&
        measured.lc >= Model.APCA_BAND_BY_CAP[1].lc
      ) {
        clears += 1;
      }
    });
    return {
      available: clears > 0,
      reason:
        clears +
        " of " +
        source.palette.length +
        " palette colours clear both gates as text on it",
    };
  }

  const capMm = source.caps[role.id] || 0;
  const measured = measureRole(role, hex, capMm, source);
  const reasons = [];

  // With a border, the badge's boundary is drawn by the border, so the
  // fill's own contrast against the page stops being the gate and the
  // disjunction takes over. This is what admits the dark end of the
  // palette.
  // Outlined, there is no fill whose edge needs carrying: the colour
  // is the ring. The disjunction is a question about fills only.
  const outlinedBadge =
    source.badge.style === Model.BADGE_STYLE_OUTLINED;
  const usesBoundaryRule =
    role.kind === "status-fill" &&
    badgeAdmitsBorder(source) &&
    !outlinedBadge;

  if (usesBoundaryRule) {
    const boundary = badgeBoundaryFor(hex, source);
    if (!boundary.ok) {
      return {
        available: false,
        reason:
          "no legible boundary: the fill reads " +
          boundary.fillVsPage.wcag +
          ":1 against the page, and the " +
          boundary.borderHex +
          " border reads " +
          boundary.borderVsPage.wcag +
          ":1 against the page and " +
          boundary.borderVsFill.wcag +
          ":1 against the fill, against a floor of " +
          boundary.floor,
      };
    }
    return {
      available: true,
      reason: "boundary carried by " + boundary.via,
    };
  }

  measured.surfaces.forEach((surface) => {
    if (!surface.passesWcag) {
      reasons.push(
        surface.wcag + ":1 on " + surface.label + ", needs " + measured.gate.wcag
      );
    }
    if (!surface.passesApca) {
      reasons.push(
        "Lc " + surface.lc + " on " + surface.label + ", needs " + measured.gate.lc
      );
    }
  });

  // Whether a fill can CARRY the status word is a separate question
  // from whether the fill itself clears its gate, and it is reported
  // against the status word's own role. Folding it in here made the
  // fill-gate switch inert: every colour the Lc 45 fill floor excludes
  // was already excluded by the word, so both settings gave the same
  // pool and the switch looked unwired. It stays as an advisory note
  // on the option, not as a disqualifier.
  let wordNote = "";
  if (role.kind === "status-fill" && !outlinedBadge) {
    const statusText = Model.roleById("status-text");
    const textGate = gateFor(
      statusText,
      source.caps["status-text"] || 0,
      source
    );
    const onFill = Engine.contrastPair(
      source.colours["status-text"],
      hex
    );
    if (onFill.wcag < textGate.wcag || onFill.lc < textGate.lc) {
      wordNote =
        " - note: the status word reads " +
        onFill.wcag +
        ":1 and Lc " +
        onFill.lc +
        " on it, against its own gate of " +
        textGate.wcag +
        ":1 and Lc " +
        textGate.lc;
    }
  }

  if (reasons.length === 0) {
    const best = measured.worst;
    return {
      available: true,
      reason:
        (best
          ? best.wcag + ":1, Lc " + best.lc + " on " + best.label
          : "no surface to judge against") + wordNote,
    };
  }
  return { available: false, reason: reasons.join("; ") + wordNote };
}

/**
 * Everything the page displays, in one object. Called once per change
 * by the single recompute-and-repaint entry point.
 */
function derive(st) {
  const source = st || state;
  const geometry = Engine.computeGeometry(source.geometry);
  const roles = Model.allRoles();

  const rolesDerived = roles.map((role) => {
    const hex = source.colours[role.id];
    const capMm = source.caps[role.id];
    const record = {
      role: role,
      hex: hex,
      text: contentFor(role, source),
      paletteName: paletteNameForHex(hex, source),
      locked: Boolean(source.locks[role.id]),
    };

    if (capMm !== undefined) {
      record.capMm = capMm;
      record.fontMm = Engine.capToFontMm(
        capMm,
        source.geometry.capRatio
      );
      record.effectivePxCap = Engine.effectivePixels(capMm, geometry);
      record.effectivePxFont = Engine.effectivePixels(
        record.fontMm,
        geometry
      );
      // The distance this size is readable from, reconstructed from
      // the guidance's own 6 mm-at-600 mm anchor.
      record.readMm = Model.readingDistanceForCap(capMm);
      if (role.sizeClass) {
        // The GATE is the stated minimum - 6 mm body, 10 mm room
        // identification - and only those two are stated as minima.
        // The ladder's other rungs are an ASSIGNMENT of the approach
        // range, so differing from them is a departure to be named,
        // not a shortfall to be scored. Before this iteration the rung
        // itself was the gate, which made the colleague's answer to
        // the question look like a failure to answer it.
        record.floorMm = Model.floorCapMmFor(role);
        record.floorName =
          role.sizeClass === "room"
            ? Model.SIZE_LADDER.room.name
            : Model.SIZE_LADDER.body.name;
        record.ladderCapMm =
          Model.SIZE_LADDER[role.sizeClass].statedCapMm;
        record.ladderReadMm = Model.SIZE_LADDER[role.sizeClass].readMm;
        record.sizePasses = capMm >= record.floorMm;
        record.sizeShortfall = record.floorMm / capMm;
      }
    }

    if (source.thickness[role.id] !== undefined) {
      record.thicknessMm = source.thickness[role.id];
      record.thicknessEffectivePx = Engine.effectivePixels(
        record.thicknessMm,
        geometry
      );
    }

    // Outlined, the status word is drawn in the status colour on the
    // page, so this role's own colour is not on screen at all and the
    // three status-fill roles already measure exactly that pairing at
    // exactly that gate. Measuring it here as well would count one
    // decision twice and inflate the colour tally.
    const notInUse =
      role.id === "status-text" &&
      source.badge.style === Model.BADGE_STYLE_OUTLINED;
    record.notInUse = notInUse;

    if (role.kind !== "surface" && !notInUse) {
      const measured = measureRole(role, hex, capMm || 0, source);
      record.gate = measured.gate;
      record.surfaces = measured.surfaces;
      record.worst = measured.worst;
      record.contrastPasses = measured.passes;
      record.badge = measured.worst
        ? apcaBadgeFor(measured.worst.lc)
        : null;
    }

    return record;
  });

  const byId = {};
  rolesDerived.forEach((record) => {
    byId[record.role.id] = record;
  });

  // --- Line budget (principle 3) -------------------------------
  // Capacity is a fixed yardstick: the guidance defines its nine lines
  // at the body floor and 1.5 spacing. Consumption is the design's
  // own, at whatever spacing the frame is actually rendering. The two
  // are different quantities and must not share one input.
  const budget = Engine.computeLineBudget({
    usableHeightMm:
      source.geometry.panelHmm - source.geometry.paddingMm,
    capFloorMm: Model.SIZE_LADDER.body.capMm,
    capRatio: source.geometry.capRatio,
    spacing: Model.PANEL_DEFAULTS.lineSpacing,
  });

  let consumedMm = 0;
  rolesDerived.forEach((record) => {
    const lines = record.role.lines || 0;
    if (lines > 0 && record.fontMm) {
      consumedMm += record.fontMm * source.lineHeight * lines;
    }
  });
  budget.consumedMm = consumedMm;
  budget.consumedLines = consumedMm / budget.lineHeightMm;
  budget.headroomMm = budget.usableHeightMm - consumedMm;

  // --- The distinguishable set ---------------------------------
  const modes = window.ContrastCardsCVD.getModes();
  const fills = Model.STATUSES.map((status) => ({
    status: status,
    label: source.statusLabels[status.id] || status.label,
    hex: source.colours["status-fill-" + status.id],
  }));

  // MEASURED over every mode, BOUND by the chosen ones. `perMode`
  // keeps the full set so greyscale stays visible in every readout
  // whether or not it steers anything; `minDeltaE` is the figure the
  // findings gate on, and it must only reduce over what the solver
  // was actually asked to separate for. Reducing over all five while
  // the solver reduced over four is how a scheme gets failed for a
  // constraint nobody applied to choosing it.
  const binding = bindingModes(source);
  const pairs = [];
  for (let i = 0; i < fills.length; i += 1) {
    for (let j = i + 1; j < fills.length; j += 1) {
      const measured = window.ContrastCardsCVD.measurePair(
        fills[i].hex,
        fills[j].hex,
        { background: source.colours["page-bg"], modes: modes }
      );
      let smallest = Infinity;
      let worstMode = null;
      binding.forEach((mode) => {
        if (measured[mode].deltaE < smallest) {
          smallest = measured[mode].deltaE;
          worstMode = mode;
        }
      });
      let allSmallest = Infinity;
      let allWorstMode = null;
      modes.forEach((mode) => {
        if (measured[mode].deltaE < allSmallest) {
          allSmallest = measured[mode].deltaE;
          allWorstMode = mode;
        }
      });
      pairs.push({
        a: fills[i],
        b: fills[j],
        perMode: measured,
        minDeltaE: smallest,
        worstMode: worstMode,
        // The same pair reduced over EVERY mode, kept beside the
        // binding figure rather than instead of it, so the cost of
        // unbinding a mode is readable rather than invisible.
        measuredMinDeltaE: allSmallest,
        measuredWorstMode: allWorstMode,
      });
    }
  }

  let worstPair = null;
  pairs.forEach((pair) => {
    if (!worstPair || pair.minDeltaE < worstPair.minDeltaE) {
      worstPair = pair;
    }
  });

  // --- The badge -----------------------------------------------
  const badgeFontMm = byId["status-text"]
    ? byId["status-text"].fontMm
    : 0;
  const badge = {
    padY: source.badge.padY,
    padX: source.badge.padX,
    shape: source.badge.shape,
    borderMode: source.badge.borderMode,
    borderOn: borderOnFor(
      source.colours["status-fill-" + source.statusId],
      source
    ),
    borderMm: source.badge.borderMm,
    // Padding is expressed in em, so its physical size follows the
    // status word's font size - which is why it grows with the cap
    // rung and is roughly half the pill's height.
    padYmm: source.badge.padY * badgeFontMm,
    padXmm: source.badge.padX * badgeFontMm,
    borderEffectivePx: Engine.effectivePixels(
      source.badge.borderMm,
      geometry
    ),
    perStatus: fills.map((fill) => ({
      status: fill.status,
      label: fill.label,
      hex: fill.hex,
      boundary: badgeBoundaryFor(fill.hex, source),
    })),
  };

  return {
    state: source,
    badge: badge,
    geometry: geometry,
    roles: rolesDerived,
    byId: byId,
    budget: budget,
    modes: modes,
    fills: fills,
    pairs: pairs,
    worstPair: worstPair,
    bindingModeList: binding,
    bindingLabel: bindingSetLabel(source),
  };
}

/* --- Findings ------------------------------------------------- */

/**
 * One list, size and colour together, ranked on a single shortfall
 * figure - required over achieved - so a size defect cannot hide
 * behind a colour one.
 */
function buildFindings(derived, fit) {
  const source = derived.state || state;
  const findings = [];

  // Fitting findings come first in construction order only; the sort
  // at the end is what decides what a reader sees first.
  if (fit) {
    fit.rows.forEach((row) => {
      // Artwork overflows by width, not by characters, so it needs
      // its own branch - without one an oversized lockup would
      // silently produce no finding at all.
      if (row.isGraphic) {
        if (!row.fits) {
          findings.push({
            kind: "Fit",
            subject: row.name,
            shortfall: row.widthMm / Math.max(row.availableMm, 0.001),
            detail:
              "renders " +
              Engine.round(row.widthMm, 1) +
              " mm wide against " +
              Engine.round(row.availableMm, 1) +
              " mm of body width",
            remedy:
              "reduce its height - the width follows from the artwork's own aspect and cannot be set independently",
          });
        }
        return;
      }
      if (row.clippedLines > 0) {
        findings.push({
          kind: "Fit",
          subject: row.name,
          shortfall: row.linesNeeded / Math.max(row.linesVisible, 0.5),
          detail:
            row.charactersVisible +
            " of " +
            row.characters +
            " characters visible: " +
            row.linesVisible +
            " of " +
            row.linesNeeded +
            " lines fit before the box clips",
          remedy:
            "the colleague's CSS gives this element flex: 1 1 0 with overflow: hidden, so it collapses silently rather than pushing anything off",
        });
      } else if (row.linesNeeded > 1 && row.singleLineExpected) {
        findings.push({
          kind: "Fit",
          subject: row.name,
          shortfall: row.characters / Math.max(row.charactersFitting, 1),
          detail:
            row.characters +
            " characters, room for about " +
            row.charactersFitting +
            ", so it wraps to " +
            row.linesNeeded +
            " lines",
          remedy:
            "the wording is a size decision: shorten it to " +
            row.charactersFitting +
            " characters or fewer, or accept the extra lines out of the budget",
        });
      }
    });
  }

  derived.roles.forEach((record) => {
    const role = record.role;

    if (record.sizePasses === false) {
      findings.push({
        kind: "Size",
        subject: role.name,
        shortfall: record.sizeShortfall,
        detail:
          "cap height " +
          Engine.round(record.capMm, 2) +
          " mm against the " +
          record.floorMm +
          " mm floor for " +
          record.floorName.toLowerCase(),
        remedy:
          "raise it to " +
          record.floorMm +
          " mm cap, which is " +
          Engine.round(
            Engine.capToFontMm(
              record.floorMm,
              source.geometry.capRatio
            ),
            2
          ) +
          " mm font size at this typeface ratio",
      });
    }

    if (record.surfaces) {
      record.surfaces.forEach((surface) => {
        if (!surface.passesApca) {
          findings.push({
            kind: "Contrast",
            subject: role.name + " on " + surface.label,
            shortfall:
              surface.lc > 0 ? record.gate.lc / surface.lc : Infinity,
            detail:
              "Lc " +
              surface.lc +
              " against a gate of Lc " +
              record.gate.lc +
              " (" +
              surface.polarity +
              ")",
            remedy: record.gate.why,
          });
        }
        if (!surface.passesWcag) {
          findings.push({
            kind: "Contrast",
            subject: role.name + " on " + surface.label,
            shortfall:
              surface.wcag > 0
                ? record.gate.wcag / surface.wcag
                : Infinity,
            detail:
              surface.wcag +
              ":1 against the WCAG 2.2 AA floor of " +
              record.gate.wcag +
              ":1",
            remedy: "this is the legal floor, not the design gate",
          });
        }
      });
    }

    if (
      record.thicknessEffectivePx !== undefined &&
      record.thicknessEffectivePx < Engine.HAIRLINE_EFFECTIVE_PX
    ) {
      findings.push({
        kind: "Geometry",
        subject: role.name,
        shortfall:
          Engine.HAIRLINE_EFFECTIVE_PX / record.thicknessEffectivePx,
        detail:
          "renders " +
          Engine.round(record.thicknessMm, 3) +
          " mm thick, which is " +
          Engine.round(record.thicknessEffectivePx, 2) +
          " effective pixels at " +
          source.geometry.distanceMm +
          " mm",
        remedy:
          "below one effective pixel a line is at the limit of what the eye resolves there, whatever its contrast",
      });
    }
  });

  // The badge boundary, per status, under whichever rule is in force.
  if (derived.badge) {
    derived.badge.perStatus.forEach((entry) => {
      if (entry.boundary.ok) return;
      const measured = entry.boundary.fillVsPage.wcag;
      findings.push({
        kind: "Boundary",
        subject: entry.label + " badge edge",
        shortfall:
          measured > 0 ? entry.boundary.floor / measured : Infinity,
        detail: entry.boundary.borderOn
          ? "neither the fill (" +
            measured +
            ":1 against the page) nor the " +
            entry.boundary.borderHex +
            " border (" +
            entry.boundary.borderVsPage.wcag +
            ":1 against the page, " +
            entry.boundary.borderVsFill.wcag +
            ":1 against the fill) draws a legible edge"
          : measured +
            ":1 against the page, under the " +
            entry.boundary.floor +
            ":1 floor for a block of colour",
        remedy: entry.boundary.borderOn
          ? "a border only draws the edge when it is legible against BOTH the page and the fill it outlines"
          : "give the badge a border, and the fill no longer has to carry the edge on its own",
      });
    });

    if (
      derived.badge.borderOn &&
      derived.badge.borderEffectivePx < Engine.HAIRLINE_EFFECTIVE_PX
    ) {
      findings.push({
        kind: "Geometry",
        subject: "Badge border",
        shortfall:
          Engine.HAIRLINE_EFFECTIVE_PX /
          derived.badge.borderEffectivePx,
        detail:
          "renders " +
          Engine.round(derived.badge.borderMm, 3) +
          " mm thick, which is " +
          Engine.round(derived.badge.borderEffectivePx, 2) +
          " effective pixels at " +
          source.geometry.distanceMm +
          " mm",
        remedy:
          "the same sub-pixel limit the divider rule is flagged for: below one effective pixel a line is at the edge of what the eye resolves there",
      });
    }
  }

  derived.pairs.forEach((pair) => {
    const bar =
      window.ContrastCardsCVD.DELTA_E_THRESHOLDS.STATUS_PAIR;
    if (pair.minDeltaE < bar) {
      findings.push({
        kind: "Separation",
        subject: pair.a.label + " against " + pair.b.label,
        shortfall: pair.minDeltaE > 0 ? bar / pair.minDeltaE : Infinity,
        detail:
          "delta E " +
          Engine.round(pair.minDeltaE, 2) +
          " at its worst mode (" +
          pair.worstMode +
          "), against a status-pair bar of " +
          bar,
        remedy:
          "the word carries the status; colour reinforces it and never carries it",
      });
    }
  });

  if (derived.budget.consumedLines > derived.budget.lines) {
    findings.push({
      kind: "Budget",
      subject: "Content budget",
      shortfall:
        derived.budget.consumedLines / derived.budget.lines,
      detail:
        "the design consumes " +
        Engine.round(derived.budget.consumedLines, 1) +
        " lines of a " +
        Engine.round(derived.budget.lines, 1) +
        " line budget",
      remedy:
        "principle 3: every item you add shrinks the rest, so decide what comes off",
    });
  }

  if (source.lineHeight < Model.PANEL_DEFAULTS.lineSpacing) {
    findings.push({
      kind: "Typography",
      subject: "Line spacing",
      shortfall: Model.PANEL_DEFAULTS.lineSpacing / source.lineHeight,
      detail:
        "the frame renders at " +
        source.lineHeight +
        " against the guidance's floor of " +
        Model.PANEL_DEFAULTS.lineSpacing +
        ". The built CSS sets no line-height, so this models the font's own normal rather than measuring it",
      remedy: "guidance section 6 asks for at least 1.5",
    });
  }

  addDesignConflictFinding(findings, derived, fit, source);

  findings.sort((a, b) => b.shortfall - a.shortfall);
  return findings;
}

// The measured frontier on the corrected surface: at the guidance's
// cap heights and its stated 1.5 spacing, the booking title holds one
// line at padding 0.03 (+0.91 px of headroom) and not at 0.04
// (-0.12 px). The default takes 0 for margin, since under a pixel
// flips on any font-metric change.
const BADGE_PADDING_FRONTIER = 0.03;

// Below this the badge has effectively no vertical padding left to
// give, so the panel is paying for the title out of the unstated
// allowance and the design conflict is live.
const BADGE_PADDING_EXHAUSTED = 0.05;

/**
 * THE TWO-JOBS CONFLICT, AS A FINDING RATHER THAN AN ARGUMENT.
 *
 * The colleague built a booking-information display, where the title
 * is the hero at 9.5 mm. The guidance describes a room-status display,
 * where the status word is the hero at 14 mm. Both are coherent. The
 * measurement is that they do not fit together on 135.9 mm:
 *
 *   - at the guidance's cap heights the badge alone takes a large
 *     share of the body, and the title's box gets what is left;
 *   - the title only gets a line at all once badge padding - a figure
 *     stated NOWHERE in the guidance - has been spent to nothing;
 *   - spend less than that and the title clips entirely, at any
 *     wording, because no wording fits in zero lines.
 *
 * So this is not a per-role shortfall and must not be filed as one.
 * It is reported whenever the panel is at guidance cap heights and is
 * paying for the title out of an unstated allowance, or has failed to.
 */
function addDesignConflictFinding(findings, derived, fit, source) {
  const layout = fit && fit.layout;
  if (!layout || !layout.measured) return;

  const status = derived.byId["status-text"];
  const title = derived.byId.title;
  if (!status || !title) return;

  const atGuidanceSizes =
    Math.abs(status.capMm - Model.GUIDANCE_STATED_CAPS.status) < 0.01 &&
    Math.abs(title.capMm - Model.GUIDANCE_STATED_CAPS.booking) < 0.01;
  if (!atGuidanceSizes) return;

  const titleRow = fit.rows.filter((row) => row.id === "title")[0];
  const titleClipped = Boolean(titleRow && titleRow.clippedLines > 0);
  const paddingSpent = source.badge.padY <= BADGE_PADDING_EXHAUSTED;
  if (!titleClipped && !paddingSpent) return;

  findings.push({
    kind: "Design",
    subject: "Two displays, one panel",
    // Ranked by how far the title's box is from holding one line,
    // which is the quantity the conflict is actually about.
    shortfall: titleClipped
      ? layout.titleNeedsPx / Math.max(layout.titleBoxPx, 1)
      : 1.01,
    detail:
      "at the guidance's own cap heights the badge is " +
      Engine.round(layout.badgeHeightPx, 1) +
      " px of a " +
      Engine.round(layout.bodyHeightPx, 1) +
      " px body, " +
      Engine.round(layout.badgeShare * 100, 1) +
      "%, and the booking title's box holds " +
      Engine.round(layout.titleBoxPx, 1) +
      " px against the " +
      Engine.round(layout.titleNeedsPx, 1) +
      " px one line needs" +
      (titleClipped
        ? ". The title is clipped, and shortening it does not help - no wording fits in zero lines"
        : ", which it reaches only with badge padding at or below " +
          BADGE_PADDING_FRONTIER +
          " (this panel is at " +
          source.badge.padY +
          "; the default takes 0 for margin) - a figure the guidance states nowhere"),
    remedy:
      "this is not a shortfall in any one role. The colleague's panel makes the booking title the hero at " +
      Engine.round(
        Engine.fontToCapMm(
          6 * Engine.computeGeometry(source.geometry).rootFontMm,
          source.geometry.capRatio
        ),
        1
      ) +
      " mm; the guidance makes the status word the hero at " +
      Model.GUIDANCE_STATED_CAPS.status +
      " mm. Both are coherent designs and neither fits alongside the other on a " +
      source.geometry.panelHmm +
      " mm panel. Choosing between them is the decision the approach control exists to make",
  });
}
/* ==================================================================
   LAYER 3: FRAME

   The preview. Every length and every colour arrives as a CSS custom
   property, so a change is one property write and no re-render. The
   only DOM the frame builds is the overlay layer, which is a
   measurement aid rather than part of the panel.
   ================================================================== */

const panelElement = document.getElementById("dpsPanel");
const surfaceElement = document.getElementById("dpsSurface");
const overlayElement = document.getElementById("dpsOverlay");

function millimetreInCssPx() {
  return state.frameHeightPx / state.geometry.panelHmm;
}

/**
 * Paint ANY panel from a derived object. The main preview and every
 * gallery miniature go through this one function, so a miniature is
 * the same markup at a smaller --dps-frame-h and cannot diverge from
 * what the preview would show for the same configuration.
 *
 * @param {Element} panelEl - the .dps-panel wrapper
 * @param {Element} surfaceEl - its .dps-surface
 * @param {Object} derived - from derive()
 * @param {Object} options - frameHeightPx, simulation
 */
function paintPanel(panelEl, surfaceEl, derived, options) {
  const geometry = derived.geometry;
  const source = derived.state || state;
  const settings = options || {};
  const frameHeightPx =
    settings.frameHeightPx === undefined
      ? source.frameHeightPx
      : settings.frameHeightPx;

  panelEl.style.setProperty("--dps-frame-h", frameHeightPx + "px");
  panelEl.style.setProperty("--dps-aspect", geometry.aspectPx);
  panelEl.style.setProperty(
    "--dps-mm",
    frameHeightPx / source.geometry.panelHmm + "px"
  );
  panelEl.style.setProperty("--dps-line-height", source.lineHeight);
  // The panel's own root em, so the surface stops inheriting the
  // studio page's 16 px. Everything expressed in em inside the frame
  // scales with the frame from here on.
  panelEl.style.setProperty("--dps-rootFontMm", geometry.rootFontMm);
  panelEl.style.setProperty(
    "--dps-pad-x",
    Model.AS_BUILT.padXRem * geometry.rootFontMm
  );
  panelEl.style.setProperty(
    "--dps-pad-y",
    Model.AS_BUILT.padYRem * geometry.rootFontMm
  );

  // One colour property and one thickness property per role, named
  // from the role id, so a new role needs no new CSS rule.
  derived.roles.forEach((record) => {
    panelEl.style.setProperty(
      "--dps-colour-" + record.role.id,
      record.hex
    );
    if (record.thicknessMm !== undefined) {
      panelEl.style.setProperty(
        "--dps-thickness-" + record.role.id,
        record.thicknessMm
      );
    }
    if (!record.role.element) return;

    const element = surfaceEl.querySelector(
      '[data-role="' + record.role.element + '"]'
    );
    if (!element) return;

    element.style.setProperty("--dps-role-ink", record.hex);
    if (record.fontMm !== undefined) {
      const fontSize = "calc(" + record.fontMm + " * var(--dps-mm))";
      element.style.setProperty("--dps-role-fs", fontSize);

      // The element that owns the em units must be the element the
      // size is on. Where a line hosts exactly ONE role, put the
      // size on the <p> as well, so its padding, margin, radius and
      // strut all resolve against the role rather than against
      // whatever the surface happens to inherit. The badge is the
      // case that made this visible, but every single-role line had
      // the same wrong strut.
      const line = element.closest(".dps-line");
      if (line && line.querySelectorAll("[data-role]").length === 1) {
        line.style.setProperty("--dps-line-fs", fontSize);
      }
    }
    // Content is state, so the markup is a template and the words
    // come from here. An SVG role has no text to set - its content
    // is its accessible name, which is the only thing a reader gets
    // from it, so that is what the content field drives.
    if (record.role.contentKey || record.role.id === "status-text") {
      if (element.tagName.toLowerCase() === "svg") {
        element.setAttribute("aria-label", record.text);
      } else {
        element.textContent = record.text;
      }
    }
  });

  const badgeFill = source.colours["status-fill-" + source.statusId];
  const outlinedBadge =
    source.badge.style === Model.BADGE_STYLE_OUTLINED;
  // Outlined, the status colour moves from the fill to the ring AND to
  // the word, and the badge's background becomes the page. That is one
  // colour doing two jobs over a tenth of the area.
  panelEl.style.setProperty(
    "--dps-badge-fill",
    outlinedBadge ? "transparent" : badgeFill
  );
  panelEl.style.setProperty("--dps-badge-pad-y", source.badge.padY);
  panelEl.style.setProperty("--dps-badge-pad-x", source.badge.padX);
  panelEl.style.setProperty(
    "--dps-badge-border-w",
    outlinedBadge || borderOnFor(badgeFill, source)
      ? "calc(" + source.badge.borderMm + " * var(--dps-mm))"
      : "0px"
  );
  panelEl.style.setProperty(
    "--dps-badge-border-colour",
    outlinedBadge
      ? badgeFill
      : borderOnFor(badgeFill, source)
        ? badgeBorderColourFor(badgeFill, source)
        : "transparent"
  );

  if (outlinedBadge) {
    const word = surfaceEl.querySelector('[data-role="status-text"]');
    if (word) word.style.setProperty("--dps-role-ink", badgeFill);
  }

  const badgeEl = surfaceEl.querySelector(".dps-badge");
  if (badgeEl) {
    badgeEl.classList.toggle(
      "dps-badge--bar",
      source.badge.shape === "bar"
    );
  }

  surfaceEl.setAttribute(
    "data-simulation",
    settings.simulation === undefined
      ? source.simulation
      : settings.simulation
  );
}

function paintFrame(derived) {
  paintPanel(panelElement, surfaceElement, derived, {
    frameHeightPx: state.frameHeightPx,
    simulation: state.simulation,
  });
}

/* --- The measurer: character budgets by rendering ---------------
   An assumed average advance width would be a guess presented as a
   figure, so every string here is rendered at its real size and the
   box is read back. Measurement runs at the PANEL's own pixel scale,
   not the preview's, so how big the frame happens to be on screen
   cannot change whether the panel fits. */

const measurerElement = document.getElementById("dpsMeasurer");

/**
 * LAZY SEAM (iteration G2). On an engine-only load the studio's markup
 * is absent, so the capture above and the surface capture at the top of
 * this layer are both null - a consumer page (the Door Panel Guide)
 * carries its own measurer and surface under its own ids. Resolved by
 * CLASS at call time only when the load-time capture missed; on the
 * studio's own page the captures win and nothing changes.
 */
function measurerNow() {
  return measurerElement || document.querySelector(".dps-measurer");
}

function measureFontSourceNow() {
  return surfaceElement || document.querySelector(".dps-surface");
}

function configureMeasurer(fontPx, lineHeight, uppercase, widthPx) {
  const measurer = measurerNow();
  measurer.style.fontFamily =
    getComputedStyle(measureFontSourceNow()).fontFamily;
  measurer.style.fontWeight = "700";
  measurer.style.fontSize = fontPx + "px";
  measurer.style.lineHeight = String(lineHeight);
  measurer.style.textTransform = uppercase
    ? "uppercase"
    : "none";
  if (widthPx === null) {
    measurer.style.whiteSpace = "pre";
    measurer.style.width = "auto";
  } else {
    measurer.style.whiteSpace = "normal";
    measurer.style.width = widthPx + "px";
  }
}

/** Rendered width of a string on one unbroken line, in CSS pixels. */
function measureWidth(text, fontPx, lineHeight, uppercase) {
  configureMeasurer(fontPx, lineHeight, uppercase, null);
  const measurer = measurerNow();
  measurer.textContent = text;
  return measurer.getBoundingClientRect().width;
}

/** Rendered height of a string wrapped into a box, in CSS pixels. */
function measureHeight(text, fontPx, lineHeight, uppercase, widthPx) {
  configureMeasurer(fontPx, lineHeight, uppercase, widthPx);
  const measurer = measurerNow();
  measurer.textContent = text;
  return measurer.getBoundingClientRect().height;
}

/**
 * The longest prefix of `text` that still satisfies `fits`, found by
 * binary search over prefix length - about six renders rather than an
 * arithmetic estimate.
 */
function longestFittingPrefix(text, fits) {
  if (fits(text)) return text.length;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(text.slice(0, middle))) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/**
 * Measure whether each piece of content fits its box on the PANEL.
 *
 * @param {Element} surfaceEl - a rendered surface, for the clipping
 *        half of the question: how many lines actually survive
 * @param {Object} derived
 */
/**
 * ONE GUARD FOR HIDDEN-ELEMENT MEASUREMENT, NOT THREE FIXES.
 *
 * Three occurrences of one pattern, each found and patched separately
 * before this existed:
 *
 *   1. Iteration 4's render canary measured a panel inside a hidden
 *      tab, every box came back zero, and it reported "0 against 0 -
 *      0% apart - passes".
 *   2. The fitting measurer read clientHeight 0 through a hidden
 *      panel, skipped its clipping branch, and reported "everything
 *      fits" against a title that is entirely clipped.
 *   3. The evidence report inherited (2) on every open, because its
 *      link lives in a tab where the preview is hidden.
 *
 * The shape never varies: an unrendered box measures ZERO, zero flows
 * into arithmetic with no way to object, and the answer comes out
 * looking like good news. So no DOM box is read as a bare number here.
 * It is a number PLUS a flag saying whether it could be taken, and the
 * caller has to consult the flag. A zero that means "not measured" and
 * a zero that means "measured, and it is zero" are different facts.
 */
function measureBox(element) {
  if (!element || !element.getBoundingClientRect) {
    return {
      measured: false,
      why: "there is no such element",
      widthPx: 0,
      heightPx: 0,
      clientHeightPx: 0,
    };
  }
  const rect = element.getBoundingClientRect();
  const measured = rect.width > 0 && rect.height > 0;
  return {
    measured: measured,
    why: measured
      ? ""
      : "the box lays out at zero size, which normally means it or an ancestor is hidden",
    widthPx: rect.width,
    heightPx: rect.height,
    clientHeightPx: element.clientHeight || 0,
  };
}

/**
 * The fitting report. Its wrapping half is arithmetic and holds
 * off-screen; its CLIPPING half needs a rendered box, so the result
 * carries `clipMeasured` and the caller keeps the last real
 * measurement rather than accepting an optimistic fresh one.
 */
function measureFit(surfaceEl, derived) {
  const source = derived.state || state;
  const clipMeasured = measureBox(surfaceEl).measured;
  const geometry = derived.geometry;
  const pxPerMm = geometry.pxPerMmHeight;
  const padXmm = Model.AS_BUILT.padXRem * geometry.rootFontMm;
  const bodyWidthMm = source.geometry.panelWmm - 2 * padXmm;
  const bodyWidthPx = bodyWidthMm * pxPerMm;
  const rows = [];

  // The logo shares the header row, so what it takes decides what the
  // clock and date have left. It is artwork rather than text now, so
  // its width comes from its own box - height times the viewBox
  // aspect - not from measuring an advance width it no longer has.
  const logo = derived.byId.logo;
  const logoWidthPx = logo
    ? logo.fontMm * pxPerMm * Model.LOGO_ASPECT
    : 0;

  // The lockup gets a width row rather than a character row: asking
  // how many characters of it fit stopped being a question the
  // moment it became artwork.
  if (logo) {
    rows.push({
      id: "logo",
      name: "Logo lockup",
      text: logo.text,
      characters: logo.text.length,
      isGraphic: true,
      widthMm: logoWidthPx / pxPerMm,
      availableMm: bodyWidthMm,
      linesNeeded: 1,
      linesVisible: 1,
      charactersFitting: undefined,
      charactersVisible: undefined,
      fits: logoWidthPx <= bodyWidthPx,
    });
  }

  derived.roles.forEach((record) => {
    if (record.role.id === "logo") return;
    const role = record.role;
    if (!role.element || record.fontMm === undefined) return;
    if (!role.contentKey && role.id !== "status-text") return;

    const fontPx = record.fontMm * pxPerMm;
    const uppercase = role.id === "status-text";
    const text = record.text;

    let availablePx = bodyWidthPx;
    let singleLineExpected = false;

    if (role.id === "status-text") {
      // The badge's side padding and border, read from STATE rather
      // than from the stylesheet. If a padding change does not move
      // the characters-that-fit figure, these two have drifted apart.
      const borderPx = borderOnFor(
        source.colours["status-fill-" + source.statusId],
        source
      )
        ? source.badge.borderMm * pxPerMm
        : 0;
      availablePx =
        bodyWidthPx - 2 * (fontPx * source.badge.padX + borderPx);
      singleLineExpected = true;
    } else if (role.id === "clock" || role.id === "date") {
      availablePx = bodyWidthPx - logoWidthPx;
      singleLineExpected = true;
    } else if (role.id === "logo") {
      singleLineExpected = true;
    } else if (role.id === "times" || role.id === "room") {
      singleLineExpected = true;
    }

    const lineHeightPx = fontPx * source.lineHeight;
    const neededHeight = measureHeight(
      text,
      fontPx,
      source.lineHeight,
      uppercase,
      availablePx
    );
    const linesNeeded = Math.max(
      1,
      Math.round(neededHeight / lineHeightPx)
    );

    const charactersFitting = longestFittingPrefix(
      text,
      (prefix) =>
        measureWidth(prefix, fontPx, source.lineHeight, uppercase) <=
        availablePx
    );

    // The clipping half, read from a real rendered element.
    let linesVisible = linesNeeded;
    let charactersVisible = text.length;
    const element = surfaceEl
      ? surfaceEl.querySelector('[data-role="' + role.element + '"]')
      : null;
    const box = element ? element.parentElement : null;

    const boxMeasure = measureBox(box);
    if (box) {
      const boxStyle = getComputedStyle(box);
      const clipped =
        boxStyle.overflowY !== "visible" ||
        boxStyle.overflowX !== "visible";
      if (clipped && boxMeasure.measured) {
        // Scale-invariant: the ratio of visible height to line height
        // is the same whatever size the preview is drawn at.
        const boxLineHeightPx =
          parseFloat(boxStyle.fontSize) * source.lineHeight;
        const paddingTop = parseFloat(boxStyle.paddingTop) || 0;
        const visible = Math.max(
          0,
          Math.floor(
            (boxMeasure.clientHeightPx - paddingTop) / boxLineHeightPx +
              0.02
          )
        );
        linesVisible = Math.min(linesNeeded, visible);
        charactersVisible =
          linesVisible === 0
            ? 0
            : linesVisible >= linesNeeded
            ? text.length
            : longestFittingPrefix(
                text,
                (prefix) =>
                  measureHeight(
                    prefix,
                    fontPx,
                    source.lineHeight,
                    uppercase,
                    availablePx
                  ) <=
                  linesVisible * lineHeightPx + 0.5
              );
      }
    }

    rows.push({
      id: role.id,
      name: role.name,
      text: text,
      characters: text.length,
      charactersFitting: charactersFitting,
      charactersVisible: charactersVisible,
      availableMm: availablePx / pxPerMm,
      linesNeeded: linesNeeded,
      linesVisible: linesVisible,
      clippedLines: linesNeeded - linesVisible,
      singleLineExpected: singleLineExpected,
      fits: linesNeeded === 1 && linesVisible === linesNeeded,
    });
  });

  const saturation = measureSaturatedArea(
    derived,
    pxPerMm,
    bodyWidthPx
  );

  measurerNow().textContent = "";
  return {
    rows: rows,
    bodyWidthMm: bodyWidthMm,
    clipMeasured: clipMeasured,
    saturation: saturation,
    layout: measureBodyLayout(surfaceEl, clipMeasured),
  };
}

/**
 * The vertical division of the body, read from the rendered boxes.
 *
 * This is what turns the two-jobs conflict from an argument into a
 * figure: how much of the body the badge takes at the current sizes,
 * and how much is left for the title against what one line of it
 * costs. Guarded by the shared measure, so a hidden panel returns
 * "not measured" rather than a division by zero.
 */
function measureBodyLayout(surfaceEl, clipMeasured) {
  if (!clipMeasured || !surfaceEl) return { measured: false };
  const body = surfaceEl.querySelector(".dps-body");
  const badge = surfaceEl.querySelector(".dps-badge");
  const titleLine = surfaceEl.querySelector(".dps-title-line");
  const bodyBox = measureBox(body);
  const badgeBox = measureBox(badge);
  if (!bodyBox.measured || !badgeBox.measured) return { measured: false };

  let titleBoxPx = 0;
  let titleNeedsPx = 0;
  if (titleLine) {
    const style = getComputedStyle(titleLine);
    titleBoxPx = measureBox(titleLine).heightPx;
    titleNeedsPx =
      (parseFloat(style.paddingTop) || 0) +
      parseFloat(style.fontSize) * (parseFloat(style.lineHeight) /
        parseFloat(style.fontSize) || 1);
  }

  return {
    measured: true,
    bodyHeightPx: bodyBox.heightPx,
    badgeHeightPx: badgeBox.heightPx,
    badgeShare: badgeBox.heightPx / bodyBox.heightPx,
    titleBoxPx: titleBoxPx,
    titleNeedsPx: titleNeedsPx,
    titleHeadroomPx: titleBoxPx - titleNeedsPx,
  };
}

/**
 * SATURATED AREA - the property a contrast ratio cannot see.
 *
 * #EF7D00 under #111111 is 6.89:1, a comfortable pass and far better
 * than white's 2.76:1 on the same fill. That figure says nothing about
 * the badge being roughly a quarter of the panel in a high-chroma
 * colour, which is a recognised trigger for visual stress, migraine
 * and photophobia - and on a 400-nit panel is also the brightest thing
 * in the corridor. Guidance section 4 covers chromatic aberration and
 * is silent on area.
 *
 * NO THRESHOLD IS APPLIED, because none exists - not in the guidance,
 * not in WCAG. The figures are reported, the relative case is named,
 * and nothing here is dressed up as a standard.
 *
 * Area and chroma are coupled rather than scored separately: a
 * saturated outline is a few square millimetres and a saturated fill
 * at 14 mm cap is a quarter of the panel, so chroma matters in
 * proportion to the area carrying it.
 */
function measureSaturatedArea(derived, pxPerMm, bodyWidthPx) {
  const source = derived.state || state;
  const record = derived.byId["status-text"];
  if (!record || record.fontMm === undefined) return null;

  const fontPx = record.fontMm * pxPerMm;
  const borderPx = borderOnFor(
    source.colours["status-fill-" + source.statusId],
    source
  )
    ? source.badge.borderMm * pxPerMm
    : 0;
  const outlined = source.badge.style === Model.BADGE_STYLE_OUTLINED;
  // An outlined badge draws its own edge whatever the border control
  // says - that IS the treatment - so it always has a ring to measure.
  const ringPx = outlined
    ? Math.max(borderPx, source.badge.borderMm * pxPerMm)
    : borderPx;
  const heightPx =
    fontPx * source.lineHeight +
    2 * (source.badge.padY * fontPx + ringPx);
  const panelAreaMm2 =
    source.geometry.panelWmm * source.geometry.panelHmm;

  // The area a given wording would cover, at THIS state's cap height,
  // padding, style and surface. Used for both the wording actually set
  // and the as-built long wording, so the pair the copy quotes is a
  // pair rather than a before and an after - the trap that put a
  // pre-fix 33.3% next to a post-fix 8.7% in the same sentence.
  const shareForWording = (wording, asOutlined) => {
    const ringed = asOutlined === undefined ? outlined : asOutlined;
    const textPx = measureWidth(wording, fontPx, source.lineHeight, true);
    const widthPx =
      source.badge.shape === "bar"
        ? bodyWidthPx
        : Math.min(
            bodyWidthPx,
            textPx + 2 * (source.badge.padX * fontPx + ringPx)
          );
    const boxAreaMm2 = (widthPx / pxPerMm) * (heightPx / pxPerMm);
    const innerW = Math.max(0, widthPx - 2 * ringPx);
    const innerH = Math.max(0, heightPx - 2 * ringPx);
    const inkAreaMm2 = ringed
      ? boxAreaMm2 - (innerW / pxPerMm) * (innerH / pxPerMm)
      : boxAreaMm2;
    return {
      widthPx: widthPx,
      boxAreaMm2: boxAreaMm2,
      inkAreaMm2: inkAreaMm2,
      share: inkAreaMm2 / panelAreaMm2,
    };
  };

  const perStatus = Model.STATUSES.map((status) => {
    const label = source.statusLabels[status.id] || status.label;
    const hex = source.colours["status-fill-" + status.id];
    const measured = shareForWording(label);
    const asBuiltWording = shareForWording(status.label);
    const widthPx = measured.widthPx;
    const boxAreaMm2 = measured.boxAreaMm2;

    // Filled, the whole box carries the colour. Outlined, only the
    // ring does - box area minus the inner rectangle - which is the
    // order-of-magnitude difference the treatment exists for.
    const inkAreaMm2 = measured.inkAreaMm2;
    const chromaValue = chroma(hex).lch()[1];
    const share = measured.share;
    return {
      statusId: status.id,
      label: label,
      hex: hex,
      chroma: chromaValue,
      boxAreaMm2: boxAreaMm2,
      inkAreaMm2: inkAreaMm2,
      share: share,
      // The same status's as-built wording, at these same settings.
      asBuiltLabel: status.label,
      asBuiltShare: asBuiltWording.share,
      wordingIsShortened: status.label !== label,
      // The same wording in the OTHER badge style, so the fold the
      // copy quotes is computed rather than typed. "Roughly a tenth"
      // was an estimate that outlived its measurement.
      otherStyleShare: shareForWording(label, !outlined).share,
      // Chroma weighted by the area carrying it. A relative quantity
      // for ranking sets against each other, in no stated unit.
      weighted: share * chromaValue,
    };
  });

  let worst = null;
  perStatus.forEach((entry) => {
    if (!worst || entry.weighted > worst.weighted) worst = entry;
  });

  return {
    outlined: outlined,
    panelAreaMm2: panelAreaMm2,
    perStatus: perStatus,
    worst: worst,
    current:
      perStatus.filter(
        (entry) => entry.statusId === source.statusId
      )[0] || null,
  };
}

/**
 * Overlays are drawn ABOVE the filtered surface, so the measurement
 * aids stay legible when a simulation is running.
 */
function paintOverlays(derived) {
  overlayElement.textContent = "";
  const mmPx = millimetreInCssPx();
  const surfaceMeasure = measureBox(surfaceElement);
  // Overlays are drawn in millimetres off the surface's own box, so an
  // unrendered surface would place every rule at zero. Nothing to draw
  // on is not an overlay of zero height.
  if (!surfaceMeasure.measured) return;
  const panelRect = surfaceElement.getBoundingClientRect();

  if (state.overlays.grid) {
    const startMm = state.geometry.paddingMm / 2;
    const lineMm = derived.budget.lineHeightMm;
    const limit = derived.budget.usableHeightMm;
    let index = 1;
    for (let offset = 0; offset <= limit + 0.001; offset += lineMm) {
      const line = document.createElement("div");
      line.className = "dps-gridline";
      line.style.top = (startMm + offset) * mmPx + "px";
      overlayElement.appendChild(line);

      if (offset + lineMm <= limit + 0.001) {
        const label = document.createElement("span");
        label.className = "dps-gridlabel";
        label.style.top = (startMm + offset) * mmPx + 1 + "px";
        label.textContent = "line " + index;
        overlayElement.appendChild(label);
      }
      index += 1;
    }
  }

  if (state.overlays.caps) {
    derived.roles.forEach((record) => {
      if (!record.role.element || record.capMm === undefined) return;
      const element = surfaceElement.querySelector(
        '[data-role="' + record.role.element + '"]'
      );
      if (!element) return;
      const rects = element.getClientRects();
      if (!rects.length) return;

      const first = rects[0];
      const capPx = record.capMm * mmPx;
      const rule = document.createElement("div");
      rule.className = "dps-caprule";
      rule.style.left = first.left - panelRect.left + "px";
      rule.style.width = Math.max(4, first.width) + "px";
      rule.style.height = capPx + "px";
      rule.style.top =
        first.top - panelRect.top + (first.height - capPx) / 2 + "px";
      overlayElement.appendChild(rule);

      const label = document.createElement("span");
      label.className = "dps-caplabel";
      label.style.left = first.left - panelRect.left + "px";
      label.style.top =
        first.top -
        panelRect.top +
        (first.height - capPx) / 2 -
        14 +
        "px";
      label.textContent =
        record.role.name +
        ": " +
        Engine.round(record.capMm, 2) +
        " mm" +
        (record.floorMm ? " (floor " + record.floorMm + ")" : "");
      overlayElement.appendChild(label);
    });
  }

  if (state.overlays.calibration) {
    const block = document.createElement("div");
    block.className = "dps-calibration";
    block.textContent =
      "100 mm - hold a ruler against the screen and check it";
    overlayElement.appendChild(block);
  }
}
/* ==================================================================
   LAYER 4: CONTROLS

   Generated from the model. The control tree is built ONCE and then
   refreshed in place, so a repaint never moves keyboard focus.
   ================================================================== */

// The one long-lived polite region, written only when the message
// actually changes, so nothing is ever spoken twice.
const liveRegion = document.getElementById("dpsLive");
let lastAnnouncement = "";

function announce(message) {
  if (message === lastAnnouncement) return;
  lastAnnouncement = message;
  liveRegion.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mmText(value) {
  return Engine.round(value, 2) + " mm";
}

function verdictHtml(passes) {
  return passes
    ? '<span class="dps-verdict-pass">passes</span>'
    : '<span class="dps-verdict-fail">fails</span>';
}

function swatchHtml(hex) {
  return (
    '<span class="dps-swatch" style="background:' +
    escapeHtml(hex) +
    '"></span> '
  );
}

const controlRefs = {};

/**
 * ONE ROW PER ROLE. A role's colour and its size are one decision, so
 * listing the same eleven roles in two sections far apart was making
 * one decision look like two. The gate explanation stays, in a per-row
 * disclosure.
 *
 * Roles with no size - surfaces, badge fills - leave the cap cell
 * empty rather than dropping out, so the role list stays one list.
 *
 * Built ONCE and refreshed in place, so a repaint never moves focus.
 */
function buildRoleControls() {
  const host = document.getElementById("dpsRoleControls");
  host.textContent = "";

  const table = document.createElement("table");
  table.className = "dps-roletable";

  const head = document.createElement("thead");
  head.innerHTML =
    '<tr><th scope="col">Role</th><th scope="col">Colour</th>' +
    '<th scope="col">Cap (mm)</th>' +
    '<th scope="col">Readable from (mm)</th>' +
    '<th scope="col">Gate</th>' +
    '<th scope="col">Result</th></tr>';
  table.appendChild(head);

  const body = document.createElement("tbody");

  Model.allRoles().forEach((role) => {
    const row = document.createElement("tr");

    // The visible role name IS the select's label, so the accessible
    // name is what is on screen.
    const nameCell = document.createElement("th");
    nameCell.setAttribute("scope", "row");
    const label = document.createElement("label");
    label.setAttribute("for", "dpsColour-" + role.id);
    label.textContent = role.name;
    nameCell.appendChild(label);
    row.appendChild(nameCell);

    const colourCell = document.createElement("td");
    const select = document.createElement("select");
    select.id = "dpsColour-" + role.id;
    select.addEventListener("change", () => {
      state.colours[role.id] = select.value;
      recomputeAndRepaint();
      announceRole(role.id);
    });
    colourCell.appendChild(select);

    const actions = document.createElement("div");
    actions.className = "dps-rolecell-actions";

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "dps-secondary dps-cyclebtn";
    previous.textContent = "Prev";
    previous.setAttribute(
      "aria-label",
      "Prev usable colour for " + role.name
    );
    previous.addEventListener("click", () => cycleRole(role.id, -1));
    actions.appendChild(previous);

    const next = document.createElement("button");
    next.type = "button";
    next.className = "dps-secondary dps-cyclebtn";
    next.textContent = "Next";
    next.setAttribute(
      "aria-label",
      "Next usable colour for " + role.name
    );
    next.addEventListener("click", () => cycleRole(role.id, 1));
    actions.appendChild(next);

    const lockLabel = document.createElement("label");
    const lock = document.createElement("input");
    lock.type = "checkbox";
    lock.addEventListener("change", () => {
      state.locks[role.id] = lock.checked;
      announce(
        role.name + (lock.checked ? " is locked." : " is unlocked.")
      );
    });
    lockLabel.appendChild(lock);
    lockLabel.appendChild(document.createTextNode(" Lock"));
    actions.appendChild(lockLabel);

    colourCell.appendChild(actions);
    row.appendChild(colourCell);

    const sizeCell = document.createElement("td");
    const hasCap = role.asBuiltRem !== undefined;
    const hasThickness =
      role.asBuiltThicknessPx !== undefined ||
      role.asBuiltThicknessRem !== undefined;
    let input = null;

    if (hasCap || hasThickness) {
      input = document.createElement("input");
      input.type = "number";
      input.step = hasCap ? "0.1" : "0.01";
      input.min = "0.01";
      input.id = "dpsSize-" + role.id;

      const sizeLabel = document.createElement("label");
      sizeLabel.className = "dps-visually-hidden";
      sizeLabel.setAttribute("for", input.id);
      sizeLabel.textContent =
        role.name +
        (hasCap
          ? " cap height in millimetres"
          : " thickness in millimetres");

      input.addEventListener("input", () => {
        const value = Number(input.value);
        if (!Number.isFinite(value) || value <= 0) return;
        if (hasCap) {
          state.caps[role.id] = value;
        } else {
          state.thickness[role.id] = value;
        }
        recomputeAndRepaint();
      });

      sizeCell.appendChild(sizeLabel);
      sizeCell.appendChild(input);
    }
    row.appendChild(sizeCell);

    // Reading distance and cap height are the same quantity in two
    // units, so this input and the one beside it edit one value. A
    // role judged by the ladder gets the control; a role that is not
    // (the lockup) gets the figure, because the distance is still a
    // fact about it.
    const distanceCell = document.createElement("td");
    let distanceInput = null;
    let distanceText = null;

    if (hasCap && role.sizeClass) {
      distanceInput = document.createElement("input");
      distanceInput.type = "number";
      distanceInput.step = "50";
      distanceInput.min = String(
        Engine.round(
          Model.readingDistanceForCap(Model.floorCapMmFor(role)),
          0
        )
      );
      distanceInput.id = "dpsRead-" + role.id;

      const distanceLabel = document.createElement("label");
      distanceLabel.className = "dps-visually-hidden";
      distanceLabel.setAttribute("for", distanceInput.id);
      distanceLabel.textContent =
        role.name + " intended reading distance in millimetres";

      distanceInput.addEventListener("input", () => {
        const value = Number(distanceInput.value);
        if (!Number.isFinite(value) || value <= 0) return;
        const applied = setRoleReadingDistance(role, value);
        recomputeAndRepaint();
        if (applied.clamped) {
          announce(
            role.name +
              " is held at its " +
              applied.floorCapMm +
              " mm floor, which the guidance states, so it stays readable from " +
              Engine.round(applied.distanceMm, 0) +
              " mm."
          );
        }
      });

      distanceCell.appendChild(distanceLabel);
      distanceCell.appendChild(distanceInput);
    } else if (hasCap) {
      distanceText = document.createElement("span");
      distanceText.className = "dps-rowfigure";
      distanceCell.appendChild(distanceText);
    }
    row.appendChild(distanceCell);

    const gateCell = document.createElement("td");
    gateCell.className = "dps-rowfigure";
    row.appendChild(gateCell);

    const resultCell = document.createElement("td");
    const readout = document.createElement("div");
    readout.className = "dps-rowfigure";
    resultCell.appendChild(readout);

    const detail = document.createElement("details");
    detail.className = "dps-roledetail";
    const summary = document.createElement("summary");
    summary.textContent = "Why";
    summary.setAttribute("aria-label", "Why this gate: " + role.name);
    const gateNote = document.createElement("p");
    detail.appendChild(summary);
    detail.appendChild(gateNote);
    resultCell.appendChild(detail);
    row.appendChild(resultCell);

    body.appendChild(row);

    controlRefs[role.id] = {
      select: select,
      readout: readout,
      gateCell: gateCell,
      gateNote: gateNote,
      lock: lock,
      input: input,
      hasCap: hasCap,
      distanceInput: distanceInput,
      distanceText: distanceText,
    };
  });

  table.appendChild(body);
  host.appendChild(table);
}

/**
 * Refresh one role's row. Colours the role cannot use stay in the
 * list, disabled, carrying the measured reason - hiding them would
 * waste the teaching. The colour currently in use is never disabled,
 * so an as-built failing state can still be shown.
 */
function refreshRoleRow(record) {
  const role = record.role;
  const refs = controlRefs[role.id];
  if (!refs) return;

  const fragment = document.createDocumentFragment();
  state.palette.forEach((colour) => {
    const availability = availabilityFor(role, colour.hex);
    const option = document.createElement("option");
    option.value = colour.hex;
    const isCurrent =
      colour.hex.toLowerCase() === String(record.hex).toLowerCase();
    option.selected = isCurrent;
    option.disabled = !availability.available && !isCurrent;
    option.textContent =
      colour.name +
      " " +
      colour.hex +
      (availability.available
        ? " - usable: " + availability.reason
        : (isCurrent ? " - IN USE and failing: " : " - unavailable: ") +
          availability.reason);
    fragment.appendChild(option);
  });

  if (paletteIndexOfHex(record.hex) < 0) {
    const option = document.createElement("option");
    option.value = record.hex;
    option.selected = true;
    option.textContent = record.hex + " - not in the palette";
    fragment.appendChild(option);
  }

  refs.select.textContent = "";
  refs.select.appendChild(fragment);
  refs.lock.checked = Boolean(state.locks[role.id]);

  if (refs.input) {
    const value = refs.hasCap ? record.capMm : record.thicknessMm;
    if (document.activeElement !== refs.input) {
      refs.input.value = Engine.round(value, 3);
    }
  }

  if (record.readMm !== undefined) {
    const shown = Engine.round(record.readMm, 0);
    if (refs.distanceInput) {
      if (document.activeElement !== refs.distanceInput) {
        refs.distanceInput.value = shown;
      }
    } else if (refs.distanceText) {
      refs.distanceText.textContent = shown;
    }
  }

  if (record.notInUse) {
    refs.gateCell.textContent = "not in use";
    refs.readout.innerHTML =
      '<span class="dps-hint">The badge is outlined, so the word is drawn in the status colour on the page. This role\'s colour is not rendered, and the three status colours carry the measurement.</span>';
    refs.gateNote.textContent =
      "Switch the badge style back to filled and this role returns, measured against every fill.";
    return;
  }

  if (role.kind === "surface") {
    const availability = availabilityFor(role, record.hex);
    refs.gateCell.textContent = "no gate";
    refs.readout.innerHTML =
      swatchHtml(record.hex) + escapeHtml(record.hex);
    refs.gateNote.textContent =
      role.why + ". " + availability.reason + ".";
    return;
  }

  refs.gateCell.innerHTML =
    "Lc " +
    record.gate.lc +
    "<br>" +
    record.gate.wcag +
    ":1" +
    (record.floorMm ? "<br>" + record.floorMm + " mm" : "");

  const sizeVerdict =
    record.sizePasses === undefined
      ? ""
      : "<br>size " +
        verdictHtml(record.sizePasses) +
        (record.sizePasses
          ? ""
          : " " + Engine.round(record.sizeShortfall, 2) + "x");

  refs.readout.innerHTML =
    swatchHtml(record.hex) +
    record.worst.wcag +
    ":1 &middot; Lc " +
    record.worst.lc +
    " &middot; " +
    verdictHtml(record.contrastPasses) +
    (record.surfaces.length > 1
      ? ' <span class="dps-hint">worst of ' +
        record.surfaces.length +
        "</span>"
      : "") +
    sizeVerdict;

  const notes = [];
  if (role.why) notes.push(role.why);
  notes.push(
    "Gate: WCAG " +
      record.gate.wcag +
      ":1 and APCA Lc " +
      record.gate.lc +
      " - " +
      record.gate.why
  );
  notes.push(
    "Measured: " +
      record.surfaces
        .map(
          (surface) =>
            surface.label +
            " " +
            surface.wcag +
            ":1, Lc " +
            surface.lc +
            " (" +
            surface.lcSigned +
            " signed, " +
            surface.polarity +
            ")"
        )
        .join("; ")
  );
  if (record.capMm !== undefined) {
    notes.push(
      "Font size " +
        mmText(record.fontMm) +
        " at a cap ratio of " +
        state.geometry.capRatio +
        ", " +
        Engine.round(record.effectivePxCap, 1) +
        " effective pixels of cap at " +
        state.geometry.distanceMm +
        " mm" +
        (record.floorName
          ? ", against the " +
            record.floorMm +
            " mm floor for " +
            record.floorName.toLowerCase()
          : "")
    );
  }
  if (record.thicknessMm !== undefined) {
    notes.push(
      "Renders " +
        mmText(record.thicknessMm) +
        " thick, which is " +
        Engine.round(record.thicknessEffectivePx, 2) +
        " effective pixels at " +
        state.geometry.distanceMm +
        " mm"
    );
  }
  refs.gateNote.textContent = notes.join(". ") + ".";
}

/** Step to the next colour in the palette that this role can use. */
function cycleRole(roleId, direction) {
  const role = Model.roleById(roleId);
  const usable = [];
  state.palette.forEach((colour, index) => {
    if (availabilityFor(role, colour.hex).available) usable.push(index);
  });

  if (usable.length === 0) {
    announce(
      "No colour in this palette can serve " +
        role.name +
        " at its current gate."
    );
    return;
  }

  const current = paletteIndexOfHex(state.colours[roleId]);
  let position = usable.indexOf(current);
  if (position < 0) {
    position = direction > 0 ? -1 : 0;
  }
  const nextPosition =
    (position + direction + usable.length) % usable.length;
  state.colours[roleId] = state.palette[usable[nextPosition]].hex;
  recomputeAndRepaint();
  announceRole(roleId);
}

function announceRole(roleId) {
  const record = lastDerived ? lastDerived.byId[roleId] : null;
  if (!record) return;
  if (record.role.kind === "surface") {
    announce(
      record.role.name +
        " set to " +
        record.paletteName +
        " " +
        record.hex +
        "."
    );
    return;
  }
  announce(
    record.role.name +
      " set to " +
      record.paletteName +
      " " +
      record.hex +
      ". Worst surface " +
      record.worst.label +
      ": " +
      record.worst.wcag +
      " to 1, Lc " +
      record.worst.lc +
      ", gate Lc " +
      record.gate.lc +
      ", " +
      (record.contrastPasses ? "passes" : "fails") +
      "."
  );
}

// Two hosts, one state. The rail's group and the one under the panel
// are separate radio GROUPS - they must have different `name`s or the
// browser treats them as one group across the document and unchecking
// becomes impossible - so the shared state is kept by syncStatusChoice
// pushing to both on every change, from whichever side moved.
const STATUS_CHOICE_HOSTS = Object.freeze([
  Object.freeze({ hostId: "dpsStatusChoice", group: "dpsStatus" }),
  Object.freeze({
    hostId: "dpsStatusChoiceBelow",
    group: "dpsStatusBelow",
  }),
]);

function buildStatusChoice() {
  STATUS_CHOICE_HOSTS.forEach((entry) => {
    const host = document.getElementById(entry.hostId);
    if (!host) return;
    host.textContent = "";
    Model.STATUSES.forEach((status) => {
      const wrap = document.createElement("div");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = entry.group;
      input.id = entry.group + "-" + status.id;
      input.value = status.id;
      input.checked = status.id === state.statusId;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        state.statusId = status.id;
        syncStatusChoice();
        recomputeAndRepaint();
        announce(
          "The frame now shows " +
            (state.statusLabels[status.id] || status.label) +
            "."
        );
      });
      const label = document.createElement("label");
      label.setAttribute("for", input.id);
      label.style.display = "inline";
      label.textContent = " " + status.label;
      wrap.appendChild(input);
      wrap.appendChild(label);
      host.appendChild(wrap);
    });
  });
}

/** Push state.statusId into EVERY status control, whoever moved. */
function syncStatusChoice() {
  STATUS_CHOICE_HOSTS.forEach((entry) => {
    const radio = document.getElementById(
      entry.group + "-" + state.statusId
    );
    if (radio) radio.checked = true;
  });
}

function buildSimulationSelect() {
  const select = document.getElementById("dpsSimulation");
  select.textContent = "";
  window.ContrastCardsCVD.getModes().forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent =
      window.ContrastCardsCVD.describeMode(mode).label;
    select.appendChild(option);
  });
  select.value = state.simulation;
  select.addEventListener("change", () => {
    state.simulation = select.value;
    const described = window.ContrastCardsCVD.describeMode(
      select.value
    );
    document.getElementById("dpsSimulationDescription").textContent =
      described.description;
    recomputeAndRepaint();
    announce("Simulation set to " + described.label + ".");
  });
  document.getElementById("dpsSimulationDescription").textContent =
    window.ContrastCardsCVD.describeMode(state.simulation).description;
}

/**
 * Content controls, generated from the role model's contentKey and
 * from STATUSES - so adding a role or a status adds its content field
 * with no UI code.
 */
function buildContentControls() {
  const host = document.getElementById("dpsContentControls");
  host.textContent = "";

  const grid = document.createElement("div");
  grid.className = "dps-rows dps-rows--content";

  function addField(id, labelText, getValue, setValue) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.value = getValue();

    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;

    const readout = document.createElement("span");
    readout.className = "dps-rowfigure";

    input.addEventListener("input", () => {
      setValue(input.value);
      recomputeAndRepaint();
    });

    grid.appendChild(label);
    grid.appendChild(input);
    grid.appendChild(readout);
    grid.appendChild(document.createElement("span"));
    controlRefs["content-" + id] = { input: input, readout: readout };
  }

  Model.STATUSES.forEach((status) => {
    addField(
      "dpsContent-status-" + status.id,
      status.label + " wording",
      () => state.statusLabels[status.id],
      (value) => {
        state.statusLabels[status.id] = value;
      }
    );
  });

  Model.allRoles().forEach((role) => {
    if (!role.contentKey) return;
    addField(
      "dpsContent-" + role.contentKey,
      role.name,
      () => state.content[role.contentKey],
      (value) => {
        state.content[role.contentKey] = value;
      }
    );
  });

  host.appendChild(grid);
}

function buildApproachControl() {
  const select = document.getElementById("dpsApproachRole");
  select.textContent = "";
  Model.APPROACH_ROLE_IDS.forEach((id) => {
    const role = Model.roleById(id);
    if (!role) return;
    const option = document.createElement("option");
    option.value = id;
    option.textContent =
      role.name +
      (id === Model.GUIDANCE_APPROACH_ROLE_ID ? " - recommended" : "");
    select.appendChild(option);
  });
  select.value = state.approachRoleId;

  select.addEventListener("change", () => {
    applyReadingPlan(select.value);
    recomputeAndRepaint();
    const role = Model.roleById(select.value);
    announce(
      (role ? role.name : "That role") +
        " now takes the approach range, at " +
        Model.APPROACH_DISTANCE_MM +
        " mm. " +
        (readingDepartures().length === 0
          ? "This is the guidance's own assignment."
          : "That is a departure from the guidance's table; the readout names what changed.")
    );
  });
}

/**
 * What the current assignment is, and how it differs from the
 * document's table. Departures are stated as a different answer to a
 * different question - they are not scored, and they are not findings.
 */
function renderApproachReadout(derived) {
  const departures = readingDepartures();
  const anchorPx = Engine.round(
    Engine.effectivePixels(
      Model.READING_ANCHOR.capMm,
      Engine.computeGeometry(
        Object.assign({}, state.geometry, {
          distanceMm: Model.READING_ANCHOR.distanceMm,
        })
      )
    ),
    1
  );

  const rows = Model.allRoles()
    .filter((role) => role.sizeClass)
    .map((role) => {
      const record = derived.byId[role.id];
      if (!record || record.capMm === undefined) return "";
      return (
        '<tr><th scope="row">' +
        escapeHtml(role.name) +
        '</th><td class="dps-num">' +
        Engine.round(record.capMm, 2) +
        '</td><td class="dps-num">' +
        Engine.round(record.readMm, 0) +
        '</td><td class="dps-num">' +
        record.ladderCapMm +
        '</td><td class="dps-num">' +
        Engine.round(record.ladderReadMm, 0) +
        "</td></tr>"
      );
    })
    .join("");

  const verdict =
    departures.length === 0
      ? "<p><strong>This is the guidance's own assignment.</strong> Every role sits on section 2's table.</p>"
      : "<p><strong>This departs from the guidance's table, which is a different answer to a different question rather than a failure.</strong> " +
        escapeHtml(
          departures
            .map(
              (row) =>
                row.role.name.toLowerCase() +
                " " +
                (row.promoted ? "promoted" : "demoted") +
                " from " +
                row.statedCapMm +
                " mm to " +
                Engine.round(row.currentCapMm, 2) +
                " mm, so it is read from " +
                Engine.round(row.currentReadMm, 0) +
                " mm rather than " +
                Engine.round(row.statedReadMm, 0) +
                " mm"
            )
            .join("; ")
        ) +
        ". Nothing is below a stated minimum: 6 mm body and 10 mm room identification are floors and the control cannot cross them.</p>";

  // THE RULE FIRST, THE TABLE AS ITS OUTPUT. The guidance gives four
  // cap heights and two viewing ranges; this one line generates the
  // first from the second exactly, and keeps going past the ends of
  // the table to any distance the estate uses.
  const perHundred = Model.capForReadingDistance(100);
  document.getElementById("dpsApproachReadout").innerHTML =
    '<p class="dps-rule"><strong>Cap height in millimetres = viewing distance in millimetres &divide; 100.</strong> ' +
    "One millimetre of capital for every hundred millimetres of distance (" +
    Engine.round(perHundred, 2) +
    " mm at 100 mm), anchored on the guidance's own " +
    Model.READING_ANCHOR.capMm +
    " mm cap at " +
    Model.READING_ANCHOR.distanceMm +
    " mm, which subtends " +
    anchorPx +
    " CSS reference pixels.</p>" +
    '<p class="dps-hint">The four rungs below are that rule\'s OUTPUT, not its source. It reproduces section 2\'s table exactly and returns the endpoints of its two stated viewing ranges — which is why this page treats it as the model. It remains a <strong>reconstruction</strong>: the document gives the ranges and gives the caps, and never says the second comes from the first.</p>' +
    verdict +
    "<table><caption>The rule applied, per role.</caption>" +
    '<thead><tr><th scope="col">Role</th><th scope="col">Cap now (mm)</th><th scope="col">Readable from (mm)</th><th scope="col">Guidance cap (mm)</th><th scope="col">Guidance distance (mm)</th></tr></thead><tbody>' +
    rows +
    "</tbody></table>";
}

// Where the slider starts when the ceiling is switched on. Not a
// recommendation - the table beside it is what makes the choice.
const DEFAULT_CHROMA_CEILING = 50;

// The settings the cost table reports. Chosen to straddle the brand's
// own distribution rather than to flatter any one answer.
const CHROMA_CEILING_SAMPLES = Object.freeze([
  null,
  100,
  80,
  60,
  50,
  40,
  30,
]);

function buildChromaControl() {
  const toggle = document.getElementById("dpsChromaOn");
  const slider = document.getElementById("dpsChromaCeiling");
  slider.value = DEFAULT_CHROMA_CEILING;

  function sync(speak) {
    const on = toggle.checked;
    slider.disabled = !on;
    state.chromaCeiling = on ? Number(slider.value) : null;
    document.getElementById("dpsChromaValue").textContent = on
      ? Number(slider.value)
      : "(off)";
    fillGateCacheKey = "";
    recomputeAndRepaint();
    if (speak) {
      const measured = evaluateChromaCeiling(state.chromaCeiling);
      announce(
        on
          ? "Chroma ceiling " +
            state.chromaCeiling +
            ": " +
            measured.poolSize +
            " colours qualify, best trio delta E " +
            (measured.possible
              ? Engine.round(measured.deltaE, 2) +
                " binding in " +
                measured.bindingMode
              : "none possible") +
            "."
          : "Chroma ceiling off."
      );
    }
  }

  toggle.addEventListener("change", () => sync(true));
  slider.addEventListener("change", () => sync(true));
  slider.addEventListener("input", () => {
    document.getElementById("dpsChromaValue").textContent = Number(
      slider.value
    );
  });
  sync(false);
}

function buildDesignForControl() {
  const cvd = document.getElementById("dpsDesignForCvd");
  const grey = document.getElementById("dpsDesignForGrey");
  cvd.checked = state.designFor.colourBlindness;
  grey.checked = state.designFor.greyscale;

  function sync(speak, movedLabel, movedOn) {
    state.designFor.colourBlindness = cvd.checked;
    state.designFor.greyscale = grey.checked;
    // The separation matrix is keyed on the binding set, and
    // applyBestColours re-solves against it - so the fills move here
    // rather than at the next unrelated repaint.
    applyBestColours();
    recomputeAndRepaint();
    if (speak) {
      announce(
        movedLabel +
          " is now " +
          (movedOn ? "part of" : "outside") +
          " the colour choice. The chooser is separating for " +
          bindingSetLabel() +
          "; every mode is still measured."
      );
    }
  }

  cvd.addEventListener("change", () =>
    sync(true, "Colour blindness", cvd.checked)
  );
  grey.addEventListener("change", () =>
    sync(true, "Greyscale", grey.checked)
  );
}

/**
 * What the current binding set costs, measured both ways: the trio the
 * solver picked, its separation under the modes it was asked about,
 * and its separation under the mode it was NOT. A switch that only
 * ever showed the figure it optimised would hide its own price.
 */
function renderDesignForReadout(derived) {
  const host = document.getElementById("dpsDesignForReadout");
  if (!host) return;
  const pair = derived.worstPair;
  if (!pair) {
    host.textContent = "";
    return;
  }
  const M = window.ContrastCardsCVD.MODES;
  const greyBound = derived.bindingModeList.indexOf(M.GREYSCALE) >= 0;
  const greyWorst = Math.min.apply(
    null,
    derived.pairs.map((entry) => entry.perMode[M.GREYSCALE].deltaE)
  );
  host.innerHTML =
    "<p>Choosing for <strong>" + derived.bindingLabel +
    "</strong>. The two statuses hardest to tell apart are " + pair.a.label +
    " and " + pair.b.label + ". They score " +
    Engine.round(pair.minDeltaE, 2) + " apart for a " + pair.worstMode +
    " reader. Higher is easier to tell apart.</p><p>With no colour at all, the closest pair here scores " +
    Engine.round(greyWorst, 2) + ". " +
    (greyBound
      ? "Greyscale is one of the readers we chose for, so that number helped pick these colours."
      : "<strong>We measure that, but it does not steer the choice</strong>, because the status word already tells anyone who cannot see the colour which status this is.") +
    "</p>";
}

/**
 * What each ceiling costs. Pool size, the best trio that pool can
 * hold, and the mode that binds it - so a ceiling cannot be chosen on
 * how it reads without seeing what it took.
 */
function renderChromaReadout() {
  const rows = CHROMA_CEILING_SAMPLES.map((ceiling) => {
    const measured = evaluateChromaCeiling(ceiling);
    const current =
      (ceiling === null && state.chromaCeiling === null) ||
      ceiling === state.chromaCeiling;
    return (
      '<tr><th scope="row">' +
      (ceiling === null ? "Off" : "Chroma " + ceiling) +
      (current ? " (showing)" : "") +
      '</th><td class="dps-num">' +
      measured.poolSize +
      "</td><td>" +
      (measured.possible
        ? '<span class="dps-num">' +
          Engine.round(measured.deltaE, 2) +
          "</span>"
        : "none") +
      "</td><td>" +
      escapeHtml(
        measured.possible
          ? measured.bindingMode
          : measured.reason || "not possible"
      ) +
      "</td><td>" +
      (measured.possible
        ? measured.set
            .map(
              (colour) => swatchHtml(colour.hex) + escapeHtml(colour.name)
            )
            .join(" ")
        : "") +
      "</td></tr>"
    );
  }).join("");

  document.getElementById("dpsChromaReadout").innerHTML =
    "<table><caption>What each ceiling costs. A ceiling that does not shrink the pool is not reaching the candidate list at all.</caption><thead><tr><th scope=\"col\">Ceiling</th><th scope=\"col\">Pool</th><th scope=\"col\">Best trio delta E</th><th scope=\"col\">Binding mode</th><th scope=\"col\">The set</th></tr></thead><tbody>" +
    rows +
    "</tbody></table><p class=\"dps-hint\">The brand's soft tones are the 05 tints, and they cluster at high lightness — which is exactly the set the original palette analysis found collapsing in greyscale. Expect a ceiling to cost monochrome robustness, and read the binding-mode column before choosing one.</p>";
}

function buildFillGateChoice() {
  const host = document.getElementById("dpsFillGateChoice");
  host.textContent = "";
  Model.FILL_GATE_MODES.forEach((mode) => {
    const wrap = document.createElement("div");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "dpsFillGate";
    input.id = "dpsFillGate-" + mode.id;
    input.value = mode.id;
    input.checked = mode.id === state.fillGate;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.fillGate = mode.id;
      recomputeAndRepaint();
      announce(
        "Badge fill gate set to " +
          mode.label +
          ". " +
          document.getElementById("dpsFillGateReadout").textContent
      );
    });
    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.style.display = "inline";
    label.textContent = " " + mode.label;
    wrap.appendChild(input);
    wrap.appendChild(label);
    host.appendChild(wrap);
  });
}

/**
 * Print BOTH answers, always. The point of the switch is that the
 * choice is evidenced rather than asserted, and a reader cannot weigh
 * it without seeing what the other setting would give.
 */
function renderFillGate() {
  const built = separationMatrix();
  const rows = Model.FILL_GATE_MODES.map((mode) => {
    const probe = cloneState(state);
    probe.fillGate = mode.id;
    const nodes = badgeCandidates(probe);
    let trio = null;
    try {
      trio = Engine.bestSeparationFor(
        nodes,
        built.matrix,
        Model.STATUSES.length
      );
    } catch (error) {
      logError("Fill-gate probe failed", error);
    }
    // How many of that pool can also carry the status word. This is a
    // SEPARATE constraint, printed beside the pool rather than folded
    // into it, so neither gate can hide the other.
    const statusText = Model.roleById("status-text");
    const textGate = gateFor(
      statusText,
      state.caps["status-text"] || 0,
      state
    );
    let carryWord = 0;
    nodes.forEach((index) => {
      const onFill = Engine.contrastPair(
        state.colours["status-text"],
        state.palette[index].hex
      );
      if (onFill.wcag >= textGate.wcag && onFill.lc >= textGate.lc) {
        carryWord += 1;
      }
    });

    return {
      mode: mode,
      pool: nodes.length,
      carryWord: carryWord,
      textGate: textGate,
      trio: trio,
      current: mode.id === state.fillGate,
    };
  });

  const binding =
    rows.length === 2 && rows[0].pool !== rows[1].pool
      ? ""
      : "<p class=\"dps-hint\">Both settings give the same pool at these values, so the fill gate is not the binding constraint here.</p>";

  document.getElementById("dpsFillGateReadout").innerHTML =
    "<table><caption>Both answers, measured</caption><thead><tr><th scope=\"col\">Setting</th><th scope=\"col\">Usable fills</th><th scope=\"col\">Of those, carry the word</th><th scope=\"col\">Best set of " +
    Model.STATUSES.length +
    "</th></tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          "<tr><th scope=\"row\">" +
          escapeHtml(row.mode.label) +
          (row.current ? " (in use)" : "") +
          '</th><td class="dps-num">' +
          row.pool +
          '</td><td class="dps-num">' +
          row.carryWord +
          '</td><td class="dps-num">' +
          (row.trio && row.trio.possible
            ? "delta E " + Engine.round(row.trio.threshold, 2)
            : "not possible") +
          "</td></tr>"
      )
      .join("") +
    "</tbody></table>" +
    binding +
    "<p class=\"dps-hint\">Carrying the word is judged against the status word's own gate, currently WCAG " +
    rows[0].textGate.wcag +
    ":1 and Lc " +
    rows[0].textGate.lc +
    ", which follows its cap height. It is a separate constraint from the fill gate and is reported here so neither can hide the other.</p>";

  return rows;
}

/** The dense strip under the frame: the thing someone photographs. */
function renderSummary(derived, findings, fit) {
  const parts = [];

  parts.push(
    "<span><b>Statuses</b> " +
      derived.fills
        .map(
          (fill) =>
            swatchHtml(fill.hex) +
            escapeHtml(fill.label) +
            " " +
            escapeHtml(fill.hex)
        )
        .join(" &nbsp; ") +
      "</span>"
  );

  const caps = ["status-text", "room", "title", "date"]
    .map((id) => derived.byId[id])
    .filter(Boolean)
    .map(
      (record) =>
        escapeHtml(record.role.name) +
        " " +
        Engine.round(record.capMm, 1) +
        (record.floorMm ? "/" + record.floorMm : "")
    );
  parts.push("<span><b>Cap mm</b> " + caps.join(" &nbsp; ") + "</span>");

  if (derived.worstPair) {
    parts.push(
      "<span><b>Worst pair</b> delta E " +
        Engine.round(derived.worstPair.minDeltaE, 2) +
        " in " +
        escapeHtml(derived.worstPair.worstMode) +
        "</span>"
    );
  }

  parts.push(
    "<span><b>Budget</b> " +
      Engine.round(derived.budget.consumedLines, 1) +
      " of " +
      Engine.round(derived.budget.lines, 1) +
      " lines</span>"
  );

  const sizeFails = derived.roles.filter(
    (record) => record.sizePasses === false
  ).length;
  const sizeGated = derived.roles.filter(
    (record) => record.sizePasses !== undefined
  ).length;
  const colourFails = derived.roles.filter(
    (record) => record.contrastPasses === false
  ).length;
  const colourGated = derived.roles.filter(
    (record) => record.contrastPasses !== undefined
  ).length;

  parts.push(
    "<span><b>Size</b> " +
      (sizeGated - sizeFails) +
      " of " +
      sizeGated +
      " pass</span>"
  );
  // Name the failure, not just its count. "12 of 13" tells a reader
  // there is a problem and nothing about where to look.
  //
  // The DENOMINATOR moves with the badge style, and it must be shown
  // moving: outlined, the status word is drawn in the status colour on
  // the page, which is the same pairing the three status colours
  // already carry, so its role drops out and the tally is 11 of 12
  // rather than 12 of 13. A numerator falling on its own would read as
  // a regression.
  const failingNames = derived.roles
    .filter((record) => record.contrastPasses === false)
    .map((record) => record.role.name);
  parts.push(
    "<span><b>Colour</b> " +
      (colourGated - colourFails) +
      " of " +
      colourGated +
      (failingNames.length === 0
        ? " pass"
        : " pass &mdash; " +
          escapeHtml(failingNames.join(", ")) +
          (failingNames.length === 1 ? " does not" : " do not")) +
      "</span>"
  );

  if (fit) {
    const overflowing = fit.rows.filter((row) => !row.fits).length;
    parts.push(
      "<span><b>Fit</b> " +
        (overflowing === 0
          ? "everything fits"
          : overflowing + " of " + fit.rows.length + " overflow") +
        (fit.stale ? " (preview off-screen, last measured)" : "") +
        "</span>"
    );
  }

  parts.push(
    "<span><b>Findings</b> " + findings.length + "</span>"
  );

  document.getElementById("dpsSummary").innerHTML = parts.join("");
}

/**
 * The cap-height diagram is drawn from the live ratio, so the picture
 * and the number cannot disagree.
 */
function renderCapDiagram() {
  const demoFontRem = 7;
  const ratio = state.geometry.capRatio;
  const diagram = document.getElementById("dpsCapDiagram");
  diagram.style.setProperty("--dps-cap-demo-size", demoFontRem + "rem");
  diagram.style.setProperty(
    "--dps-cap-demo-cap",
    demoFontRem * ratio + "rem"
  );
  // Sit the cap band on the baseline, which for this demo letter is
  // the bottom of the em box less the descender allowance.
  diagram.style.setProperty(
    "--dps-cap-demo-baseline",
    demoFontRem * 0.11 + "rem"
  );

  const exampleFontMm = 20;
  document.getElementById("dpsCapSentence").textContent =
    "At the ratio in use (" +
    ratio +
    "), " +
    exampleFontMm +
    " mm of font size gives about " +
    Engine.round(exampleFontMm * ratio, 1) +
    " mm of capital. Working the other way, the guidance's " +
    Model.SIZE_LADDER.status.capMm +
    " mm status word needs a font size of " +
    Engine.round(
      Engine.capToFontMm(Model.SIZE_LADDER.status.capMm, ratio),
      2
    ) +
    " mm.";
}

/**
 * Why the status word dominates, computed from the ladder rather than
 * asserted. It is the most-asked question about a CORRECT render, and
 * without this sentence a compliant panel reads as a broken one - so
 * it sits beside the character budget in both branches below.
 */
/**
 * THE STATUS WORD'S CHARACTER BUDGET, AS A STATED LIMIT.
 *
 * At the ladder's 14 mm rung the wording is a size decision, not a
 * copy decision, and the limit is a number the tool can give: how many
 * characters fit on one line at the current cap height and padding.
 *
 * Item 2 supplies the second reason to care, and it is the stronger
 * one: WORDING, NOT CAP HEIGHT, DRIVES SATURATED AREA. Both figures
 * below are computed from the CURRENT state - same cap height, same
 * padding, same style, same surface - so the pair is a pair. The
 * earlier form quoted a pre-fix 33.3% beside a post-fix 8.7%, which
 * compared two different panels and flattered the claim.
 */
function statusBudgetNote(derived, fit) {
  const row = fit
    ? fit.rows.filter((entry) => entry.id === "status-text")[0]
    : null;
  if (!row) return "";
  const saturation = fit.saturation;
  const current = saturation ? saturation.current : null;
  return (
    '<p class="dps-hint"><strong>The status word has room for ' +
    row.charactersFitting +
    " letters.</strong> " +
    "That is a limit, not a preference. At " +
    Engine.round(derived.byId["status-text"].capMm, 1) +
    " mm letter height the badge fits " +
    row.charactersFitting +
    " letters on one line, and your word uses " +
    row.characters +
    ". The word you pick also decides how much of the panel is strong colour" +
    (current
      ? ': "' +
        escapeHtml(current.label) +
        '" covers ' +
        Engine.round(current.share * 100, 1) +
        '% of the panel here, where "' +
        escapeHtml(current.asBuiltLabel) +
        '" would cover ' +
        Engine.round(current.asBuiltShare * 100, 1) +
        "%. We measured both on this panel, at this letter height, with this padding and style"
      : "") +
    ". A shorter word is the cheaper of the two ways to bring that down. The other is the outlined badge, which shrinks the colour without shrinking the box.</p>"
  );
}

function statusScaleNote(derived) {
  const status = Model.SIZE_LADDER.status;
  const booking = Model.SIZE_LADDER.booking;
  const record = derived.byId["status-text"];
  const times = Engine.round(status.capMm / booking.capMm, 2);
  return (
    "<p class=\"dps-hint\"><strong>The status word is meant to be the biggest thing here.</strong> " +
    "The ladder gives it " +
    status.capMm +
    " mm of cap height, the largest rung - " +
    times +
    " times the " +
    booking.capMm +
    " mm for " +
    booking.name.toLowerCase() +
    " - so on a compliant panel it dominates by design, and long wording then wraps or overflows" +
    // The size is a consequence of a distance, and saying so is what
    // finally answers the question. Reconstructed, and labelled as
    // such: the document gives the ranges and gives the caps, and
    // never says the second comes from the first.
    ". The reason is that the ladder is a DISTANCE ladder: at " +
    status.capMm +
    " mm it is meant to be read from " +
    Engine.round(status.readMm, 0) +
    " mm away, as you approach the door, while " +
    booking.name.toLowerCase() +
    " at " +
    booking.capMm +
    " mm is for someone " +
    Engine.round(booking.readMm, 0) +
    " mm away, already standing at it. That reconstruction holds the guidance's own anchor - a " +
    Model.READING_ANCHOR.capMm +
    " mm cap at " +
    Model.READING_ANCHOR.distanceMm +
    " mm - constant, and returns the endpoints of its two stated viewing ranges" +
    (record
      ? ". It is currently set to " +
        Engine.round(record.capMm, 2) +
        " mm and reads “" +
        escapeHtml(record.text) +
        "”, " +
        record.text.length +
        " characters"
      : "") +
    ".</p>"
  );
}

/** The fitting report: shown whenever content exceeds its box. */
function renderFitReport(derived, fit) {
  const host = document.getElementById("dpsFitReport");
  const problems = fit.rows.filter((row) => !row.fits);

  if (problems.length === 0 && derived.budget.consumedLines <= derived.budget.lines) {
    host.innerHTML =
      "<p>Every string fits its box, and the design sits inside the line budget. Available width in the body is " +
      mmText(fit.bodyWidthMm) +
      ".</p>" +
      statusScaleNote(derived) +
      statusBudgetNote(derived, fit);
    return;
  }

  const rows = problems
    .map((row) => {
      const detail = row.isGraphic
        ? "the lockup renders " +
          Engine.round(row.widthMm, 1) +
          " mm wide, against " +
          Engine.round(row.availableMm, 1) +
          " mm available"
        : row.clippedLines > 0
          ? row.charactersVisible +
            " of " +
            row.characters +
            " characters visible, " +
            row.linesVisible +
            " of " +
            row.linesNeeded +
            " lines - clipped by flex: 1 1 0"
          : row.characters +
            " characters, room for about " +
            row.charactersFitting +
            " - wraps to " +
            row.linesNeeded +
            " lines";
      return (
        "<tr><th scope=\"row\">" +
        escapeHtml(row.name) +
        "</th><td>" +
        escapeHtml(detail) +
        '</td><td class="dps-num">' +
        Engine.round(row.availableMm, 1) +
        "</td></tr>"
      );
    })
    .join("");

  const advice = [];
  problems.forEach((row) => {
    if (row.isGraphic) {
      advice.push(
        "reduce the " + row.name.toLowerCase() + " height"
      );
    } else if (row.clippedLines > 0) {
      advice.push(
        "give " +
          row.name.toLowerCase() +
          " more room by shortening what sits above it"
      );
    } else {
      advice.push(
        "shorten the " +
          row.name.toLowerCase() +
          " to " +
          row.charactersFitting +
          " characters or fewer"
      );
    }
  });
  if (derived.budget.consumedLines > derived.budget.lines) {
    advice.push("or drop a line of content altogether");
  }

  host.innerHTML =
    "<table><caption>What does not fit</caption><thead><tr><th scope=\"col\">Element</th><th scope=\"col\">Measured</th><th scope=\"col\">Width available (mm)</th></tr></thead><tbody>" +
    rows +
    "</tbody></table><p><strong>Budget</strong> " +
    Engine.round(derived.budget.consumedLines, 1) +
    " lines used of " +
    Engine.round(derived.budget.lines, 1) +
    ".</p><p><strong>To fit:</strong> " +
    escapeHtml(advice.join(", or ")) +
    ".</p>" +
    statusScaleNote(derived) +
    statusBudgetNote(derived, fit);
}

/* --- Views over the derived object ---------------------------- */

function renderGeometry(derived) {
  const geometry = derived.geometry;
  const rows = [
    [
      "Pixel size, from height",
      Engine.round(geometry.mmPerPx, 5) +
        " mm (" +
        Engine.round(geometry.pxPerMmHeight, 4) +
        " px per mm)",
    ],
    [
      "Pixel size, from width",
      Engine.round(geometry.mmPerPxWidth, 5) +
        " mm (" +
        Engine.round(geometry.pxPerMmWidth, 4) +
        " px per mm)",
    ],
    [
      "Disagreement between them",
      Engine.round(geometry.mmPerPxDisagreementPercent, 3) +
        "% - the stated pixel grid and the stated active area are not quite the same shape",
    ],
    [
      "1 rem, from max(1vw, 1vh)",
      Engine.round(geometry.rootFontPx, 2) +
        " px = " +
        mmText(geometry.rootFontMm),
    ],
    [
      "One reference pixel at " + geometry.distanceMm + " mm",
      mmText(geometry.referencePixelMm) +
        " (" +
        Engine.CSS_REFERENCE_PIXEL_DEGREES +
        " degrees of visual angle)",
    ],
    [
      "Panel aspect",
      Engine.round(geometry.aspectPx, 5) +
        " by pixels, " +
        Engine.round(geometry.aspectMm, 5) +
        " by millimetres",
    ],
  ];

  document.getElementById("dpsGeometryReadout").innerHTML =
    "<table><caption>Derived from the dimensions above</caption><tbody>" +
    rows
      .map(
        (row) =>
          "<tr><th scope=\"row\">" +
          escapeHtml(row[0]) +
          "</th><td>" +
          escapeHtml(row[1]) +
          "</td></tr>"
      )
      .join("") +
    "</tbody></table>";
}

function renderFrameReadout() {
  const mmPx = millimetreInCssPx();
  const actualSizePx =
    (state.geometry.panelHmm * 96) / 25.4;
  document.getElementById("dpsFrameReadout").textContent =
    "Frame height " +
    Math.round(state.frameHeightPx) +
    " CSS px. One panel millimetre is " +
    Engine.round(mmPx, 3) +
    " CSS px here, against " +
    Engine.round(actualSizePx / state.geometry.panelHmm, 3) +
    " at nominal actual size, so the frame is " +
    Engine.round((state.frameHeightPx / actualSizePx) * 100, 1) +
    "% of physical size. Check it with the 100 mm block and a ruler.";
}

/* --- Handing the evidence report its figures ---------------------
   The Evidence view is a sibling FILE now, not a tab. It formats
   these figures and computes nothing of its own, so there is exactly
   one implementation of every measurement in the project - two copies
   of a table cannot disagree, two copies of a measurement can.

   The payload is plain JSON through localStorage rather than the URL,
   because the palette-on-both-backgrounds table alone is 45 rows and
   a hash carrying it would be fragile.

   Verification did NOT move. It is an instrument rather than a
   report: the render canary paints a real panel and measures it, so
   it has to live where the panel is. */

const EVIDENCE_PAYLOAD_KEY = "dps-evidence-payload";
const EVIDENCE_PAGE = "door-panel-studio-evidence.html";

function buildEvidencePayload(derived, findings) {
  const geometry = derived.geometry;
  const orNull = (value) => (value === undefined ? null : value);

  const payload = {
    stateGeometry: Object.assign({}, state.geometry),
    geometry: {
      mmPerPx: geometry.mmPerPx,
      rootFontPx: geometry.rootFontPx,
      rootFontMm: geometry.rootFontMm,
    },
    constants: {
      paddingMm: state.geometry.paddingMm,
      bodyCapMm: Model.SIZE_LADDER.body.capMm,
      lineSpacing: Model.PANEL_DEFAULTS.lineSpacing,
      statusPairBar:
        window.ContrastCardsCVD.DELTA_E_THRESHOLDS.STATUS_PAIR,
    },
    findings: findings.map((finding) => ({
      kind: finding.kind,
      subject: finding.subject,
      shortfall: Number.isFinite(finding.shortfall)
        ? finding.shortfall
        : null,
      detail: finding.detail,
      remedy: finding.remedy,
    })),
    budget: {
      usableHeightMm: derived.budget.usableHeightMm,
      lineHeightMm: derived.budget.lineHeightMm,
      lines: derived.budget.lines,
      consumedMm: derived.budget.consumedMm,
      consumedLines: derived.budget.consumedLines,
      headroomMm: derived.budget.headroomMm,
    },
    modes: derived.modes.slice(),
    fills: derived.roles
      .filter((record) => record.role.kind === "status-fill")
      .map((record) => ({
        name: record.role.name,
        hex: record.hex,
        paletteName: record.paletteName,
        wcag: record.worst.wcag,
        lc: record.worst.lc,
        passes: record.contrastPasses,
      })),
    pairs: derived.pairs.map((pair) => {
      const perMode = {};
      derived.modes.forEach((mode) => {
        perMode[mode] = pair.perMode[mode].deltaE;
      });
      return {
        aLabel: pair.a.label,
        bLabel: pair.b.label,
        perMode: perMode,
        minDeltaE: pair.minDeltaE,
        worstMode: pair.worstMode,
      };
    }),
    // Every role contributes its custom property; only the inked
    // ones carry contrast figures. Surfaces have no `worst` record
    // at all - the table this feeds skips them, and reading through
    // them here would throw before it ever got there.
    exportRoles: derived.roles.map((record) => ({
      cssVar: record.role.cssVar,
      hex: record.hex,
      name: record.role.name,
      kind: record.role.kind,
      capMm: orNull(record.capMm),
      fontMm: orNull(record.fontMm),
      floorMm: orNull(record.floorMm),
      sizePasses: orNull(record.sizePasses),
      worstWcag: record.worst ? record.worst.wcag : null,
      worstLc: record.worst ? record.worst.lc : null,
      gateLc: record.gate ? record.gate.lc : null,
      contrastPasses: Boolean(record.contrastPasses),
    })),
    background: buildBackgroundPayload(),
    separation: buildSeparationPayload(),
  };

  return payload;
}

function buildBackgroundPayload() {
  const current = scorePaletteOn(state.colours["page-bg"]);
  const guidance = scorePaletteOn(Model.GUIDANCE_BACKGROUND);
  const flatten = (score) => ({
    background: score.background,
    wcagCount: score.wcagCount,
    gateCount: score.gateCount,
    preferredCount: score.preferredCount,
    bothCount: score.bothCount,
    wcagOnlyCount: score.wcagOnlyCount,
    rows: score.rows.map((row) => ({
      name: row.colour.name,
      hex: row.colour.hex,
      wcag: row.wcag,
      lc: row.lc,
      passesWcag: row.passesWcag,
      passesGate: row.passesGate,
    })),
  });
  return {
    current: flatten(current),
    guidance: flatten(guidance),
    bodyGate: Model.APCA_BAND_BY_CAP[1].lc,
    preferredGate: Model.APCA_BAND_BY_CAP[2].lc,
    paletteLength: state.palette.length,
  };
}

/**
 * The separation sweep. This is the one expensive thing the report
 * needs, so it runs when the payload is built rather than on every
 * repaint - the same trade the "Run the separation sweep" button used
 * to make explicitly.
 */
function buildSeparationPayload() {
  const built = separationMatrix();
  const nodes = badgeCandidates();
  const base = {
    usable: nodes.length,
    paletteLength: state.palette.length,
    fillGateLabel: fillGateMode().label,
    pageBg: state.colours["page-bg"],
    bar: window.ContrastCardsCVD.DELTA_E_THRESHOLDS.STATUS_PAIR,
    distinct: window.ContrastCardsCVD.DELTA_E_THRESHOLDS.DISTINCT,
  };

  if (nodes.length === 0) return Object.assign(base, { empty: true });

  let rows;
  try {
    rows = Engine.sweepSeparation(
      nodes,
      built.matrix,
      Engine.SOLVER_MAX_SET_SIZE
    );
  } catch (error) {
    logError("Separation sweep failed", error);
    return Object.assign(base, { error: error.message });
  }

  return Object.assign(base, {
    rows: rows.map((row) => ({
      size: row.size,
      possible: row.possible,
      threshold: row.threshold,
      reason: row.reason,
      set: row.possible
        ? row.set.map((index) => ({
            hex: state.palette[index].hex,
            name: state.palette[index].name,
          }))
        : [],
    })),
  });
}

/** Write the figures where the report can read them, then go there. */
function openEvidenceReport() {
  if (!lastDerived) return;
  // lastFit, not a fresh measurement: this link lives in the Checks
  // tab, so the preview is hidden when it is followed and a fresh
  // measurement would hand the report an optimistic fitting result.
  const findings = buildFindings(lastDerived, lastFit);
  try {
    window.localStorage.setItem(
      EVIDENCE_PAYLOAD_KEY,
      JSON.stringify(buildEvidencePayload(lastDerived, findings))
    );
  } catch (error) {
    logError("The evidence payload could not be stored", error);
    announce(
      "The evidence report could not be handed its figures. Browser storage is unavailable."
    );
    return;
  }
  window.location.href = EVIDENCE_PAGE;
}

function scorePaletteOn(background) {
  const bodyGate = Model.APCA_BAND_BY_CAP[1].lc;
  const preferredGate = Model.APCA_BAND_BY_CAP[2].lc;
  const rows = state.palette.map((colour) => {
    const measured = Engine.contrastPair(colour.hex, background);
    return {
      colour: colour,
      wcag: measured.wcag,
      lc: measured.lc,
      passesWcag: measured.wcag >= Model.WCAG_FLOORS.TEXT,
      passesGate: measured.lc >= bodyGate,
      passesPreferred: measured.lc >= preferredGate,
    };
  });
  return {
    background: background,
    rows: rows,
    wcagCount: rows.filter((row) => row.passesWcag).length,
    gateCount: rows.filter((row) => row.passesGate).length,
    preferredCount: rows.filter((row) => row.passesPreferred).length,
    bothCount: rows.filter((row) => row.passesWcag && row.passesGate)
      .length,
    wcagOnlyCount: rows.filter(
      (row) => row.passesWcag && !row.passesGate
    ).length,
  };
}



/* --- The separation solver, and what it can say ---------------- */

// Rebuilt only when the palette changes: 45 colours simulated five
// ways, then every pair reduced to its worst mode.
let separationCache = null;

/**
 * The modes the solver's minimum is taken over, from the "Design for"
 * switches. NONE is unconditional - a pair that collapses in normal
 * vision is not a scheme whatever anyone is designing for.
 */
function bindingModes(st) {
  const source = st || state;
  const M = window.ContrastCardsCVD.MODES;
  const chosen = source.designFor || Model.DESIGN_FOR_DEFAULTS;
  const modes = [M.NONE];
  if (chosen.colourBlindness) {
    modes.push(M.PROTANOPIA, M.DEUTERANOPIA, M.TRITANOPIA);
  }
  if (chosen.greyscale) modes.push(M.GREYSCALE);
  return modes;
}

/** Cache key for the matrix: the palette alone is no longer enough. */
function bindingSignature(st) {
  return bindingModes(st).join("|");
}

/** How the binding set reads in prose, for a readout or a canary. */
function bindingSetLabel(st) {
  const chosen = (st || state).designFor || Model.DESIGN_FOR_DEFAULTS;
  const parts = [];
  if (chosen.colourBlindness) parts.push("colour blindness");
  if (chosen.greyscale) parts.push("greyscale");
  if (!parts.length) return "normal vision only";
  return parts.join(" and ");
}

function separationMatrix(st) {
  const source = st || state;
  const signature = bindingSignature(source);
  if (
    separationCache &&
    separationCache.palette === source.palette &&
    separationCache.signature === signature
  ) {
    return separationCache;
  }
  const built = Engine.buildSeparationMatrix(
    source.palette,
    bindingModes(source)
  );
  separationCache = {
    palette: source.palette,
    signature: signature,
    matrix: built.matrix,
    simulated: built.simulated,
  };
  return separationCache;
}

/**
 * The colours that could serve as a badge fill at all: 3:1 against the
 * page background, and able to host the status word at its own gate.
 */
function badgeCandidates(st) {
  const source = st || state;
  const template = {
    id: "status-fill-candidate",
    name: "Badge fill",
    kind: "status-fill",
    surface: "page-bg",
  };
  const nodes = [];
  source.palette.forEach((colour, index) => {
    // The ceiling is applied HERE, at the one place the candidate list
    // is built, so every consumer - the recommender, the gallery, the
    // sweep - sees the same smaller pool. Filtering the solver's
    // output instead would leave the objective still pulling toward
    // the extremes and hide the cost.
    if (!withinChromaCeiling(colour.hex, source)) return;
    if (!aboveLightnessFloor(colour.hex, source)) return;
    if (availabilityFor(template, colour.hex, source).available) {
      nodes.push(index);
    }
  });
  return nodes;
}

function chromaOf(hex) {
  return chroma(hex).lch()[1];
}

function withinChromaCeiling(hex, st) {
  const source = st || state;
  const ceiling = source.chromaCeiling;
  if (ceiling === null || ceiling === undefined) return true;
  return chromaOf(hex) <= ceiling + 1e-9;
}

/**
 * A CHROMA CEILING DOES NOT MEAN "SOFT", AND THIS IS WHY.
 *
 * Measured 14 August 2026, and it is the reverse of what the ceiling
 * was built to do. White is LCH chroma 0 and black is chroma 0, so
 * both clear EVERY ceiling however low it is set - while the solver's
 * objective, dispersion, is exactly what makes it reach for the two
 * lightness extremes first. Set a ceiling of 40 and then of 30 and the
 * filled answer does not move at all: White, Black, Marine 02, both
 * times. The ceiling was not binding; it never touched the colours
 * that made the scheme hard.
 *
 * So "soft" needs the other axis as well: a floor on LCH lightness,
 * which is what removes black and the deep tones and leaves the tints.
 * Same shape as the ceiling - it constrains the POOL before the solver
 * runs, because a preference applied to the solver's output would
 * leave the objective still pulling toward the extremes.
 *
 * It is OFF by default, and the enumeration pins it off explicitly, so
 * the recorded pool ladders cannot move underneath it.
 */
function aboveLightnessFloor(hex, st) {
  const floor = (st || state).lightnessFloor;
  if (floor === null || floor === undefined) return true;
  return chroma(hex).lch()[0] >= floor - 1e-9;
}

/**
 * What one ceiling setting costs, measured rather than asserted: the
 * pool it leaves, the best trio that pool can hold, and which mode
 * binds that trio.
 *
 * The cost is expected to be REAL and to cut against the rest of this
 * project. The brand's soft tones are the 05 tints and they cluster at
 * high lightness, which is precisely the set the original analysis
 * found collapsing in greyscale - so a ceiling that reads well in
 * colour may well read worse in monochrome. That trade is Matthew's to
 * make with the figures in front of him.
 */
function evaluateChromaCeiling(ceiling) {
  const probe = cloneState(state);
  probe.chromaCeiling = ceiling;
  const nodes = badgeCandidates(probe);
  const built = separationMatrix();
  const result = {
    ceiling: ceiling,
    poolSize: nodes.length,
    possible: false,
  };
  if (nodes.length < Model.STATUSES.length) {
    result.reason =
      "fewer usable colours than the " +
      Model.STATUSES.length +
      " statuses need";
    return result;
  }
  let best = null;
  try {
    best = Engine.bestSeparationFor(
      nodes,
      built.matrix,
      Model.STATUSES.length
    );
  } catch (error) {
    logError("Chroma ceiling evaluation failed", error);
    result.reason = "the search exceeded its step budget";
    return result;
  }
  if (!best || !best.possible) {
    result.reason = best ? best.reason : "no set found";
    return result;
  }

  result.possible = true;
  result.deltaE = best.threshold;
  result.set = best.set.map((index) => state.palette[index]);
  result.maxChroma = Math.max.apply(
    null,
    result.set.map((colour) => chromaOf(colour.hex))
  );
  result.bindingMode = bindingModeFor(result.set);
  return result;
}

/**
 * Which mode binds a set, named from that set's OWN per-mode figures
 * rather than inferred from the reduced matrix - the matrix has
 * already collapsed each pair to its worst mode and thrown the label
 * away.
 */
function bindingModeFor(colours, st) {
  // The BINDING modes, not every mode: naming greyscale as the binder
  // of a set the solver chose without it would be a straight
  // misattribution, and it is exactly what this said before the
  // "Design for" switches existed.
  const modes = bindingModes(st);
  let smallest = Infinity;
  let binding = null;
  for (let i = 0; i < colours.length; i += 1) {
    for (let j = i + 1; j < colours.length; j += 1) {
      const measured = window.ContrastCardsCVD.measurePair(
        colours[i].hex,
        colours[j].hex,
        { background: state.colours["page-bg"], modes: modes }
      );
      modes.forEach((mode) => {
        if (measured[mode].deltaE < smallest) {
          smallest = measured[mode].deltaE;
          binding = mode;
        }
      });
    }
  }
  return binding;
}


/* ==================================================================
   THE GALLERY

   Candidate configurations, each scored by the SAME derive() and
   buildFindings() that score the main preview, and each rendered by
   the SAME paintPanel(). The commentary is composed from a
   configuration's own findings, so prose cannot drift from numbers.
   ================================================================== */

let lastGallery = null;

const GALLERY_SIZE = 10;
const GALLERY_FRAME_HEIGHT_PX = 210;

// Fragments keyed to finding kinds, assembled in shortfall order. The
// CARD carries one clause - a contact sheet you have to read is not a
// contact sheet - and the rest sits behind the disclosure beside it.
const COMMENT_CLAUSES = 2;
const CARD_COMMENT_CLAUSES = 1;

function clauseFor(finding, derived) {
  if (finding.kind === "Size") {
    return (
      "the " +
      finding.subject.toLowerCase() +
      " is " +
      Engine.round(
        finding.shortfall === Infinity ? 0 : finding.shortfall,
        1
      ) +
      " times under its floor"
    );
  }
  if (finding.kind === "Separation") {
    const pair = derived.worstPair;
    return (
      "the statuses are only delta E " +
      Engine.round(pair ? pair.minDeltaE : 0, 1) +
      " apart, so they will look similar in " +
      (pair ? pair.worstMode : "the worst mode")
    );
  }
  if (finding.kind === "Fit") {
    return finding.subject.toLowerCase() + " does not fit its box";
  }
  if (finding.kind === "Contrast") {
    return finding.subject.toLowerCase() + " is under its contrast gate";
  }
  if (finding.kind === "Budget") {
    return "the content runs past the nine-line budget";
  }
  if (finding.kind === "Design") {
    return "the badge and the booking title cannot both be the hero here";
  }
  if (finding.kind === "Typography") {
    return "the lines are set tighter than 1.5";
  }
  return finding.subject.toLowerCase() + " falls short";
}

/**
 * Compose the commentary for one configuration from its own findings.
 * An opener naming what it gets right, then up to two clauses naming
 * what it trades away.
 */
function commentaryFor(derived, findings, maxClauses) {
  const kinds = {};
  findings.forEach((finding) => {
    kinds[finding.kind] = (kinds[finding.kind] || 0) + 1;
  });

  if (findings.length === 0) {
    return "Clears every gate this tool measures at these settings.";
  }

  // A positive opener earns a "but"; a negative one earns a colon,
  // because "falls short, but falls short" is not a sentence.
  let opener;
  let joiner = ", but ";
  if (!kinds.Size && !kinds.Fit) {
    opener = "Meets every size floor and everything fits";
  } else if (!kinds.Size) {
    opener = "Meets every size floor";
  } else if (!kinds.Separation && !kinds.Contrast) {
    opener = "Strongest colour separation available here";
  } else {
    opener = "Falls short on " + findings.length + " counts";
    joiner = ", worst first: ";
  }

  const seen = {};
  const clauses = [];
  findings.forEach((finding) => {
    if (clauses.length >= (maxClauses || COMMENT_CLAUSES)) return;
    if (seen[finding.kind]) return;
    seen[finding.kind] = true;
    clauses.push(clauseFor(finding, derived));
  });

  return opener + joiner + clauses.join(", and ") + ".";
}

/** Total shortfall over a configuration's findings; lower is better. */
function scoreFindings(findings) {
  let total = 0;
  findings.forEach((finding) => {
    total += Number.isFinite(finding.shortfall)
      ? finding.shortfall - 1
      : 10;
  });
  return total;
}

/**
 * Size schemes. "Best fit within budget" is measured, not guessed: the
 * status word is grown to the largest cap at which its wording still
 * fits on one line, which is exactly the trade the fitting report
 * exists to show.
 */
function applySizeScheme(candidate, scheme) {
  if (scheme === "as-built") {
    const geometry = Engine.computeGeometry(candidate.geometry);
    Model.allRoles().forEach((role) => {
      if (role.asBuiltRem !== undefined) {
        candidate.caps[role.id] = Engine.fontToCapMm(
          role.asBuiltRem * geometry.rootFontMm,
          candidate.geometry.capRatio
        );
      }
    });
    candidate.lineHeight = Model.AS_BUILT.lineHeight;
    return "as-built sizes";
  }

  if (scheme === "guidance") {
    Model.allRoles().forEach((role) => {
      if (role.sizeClass) {
        candidate.caps[role.id] =
          Model.SIZE_LADDER[role.sizeClass].capMm;
      }
    });
    candidate.lineHeight = Model.PANEL_DEFAULTS.lineSpacing;
    return "guidance floors";
  }

  // best-fit: start at the guidance floors, then find the largest
  // status-word cap whose wording still fits on one line.
  Model.allRoles().forEach((role) => {
    if (role.sizeClass) {
      candidate.caps[role.id] = Model.SIZE_LADDER[role.sizeClass].capMm;
    }
  });
  candidate.lineHeight = Model.PANEL_DEFAULTS.lineSpacing;

  const geometry = Engine.computeGeometry(candidate.geometry);
  const pxPerMm = geometry.pxPerMmHeight;
  const padXmm = Model.AS_BUILT.padXRem * geometry.rootFontMm;
  const bodyWidthPx =
    (candidate.geometry.panelWmm - 2 * padXmm) * pxPerMm;
  const wording = candidate.statusLabels[candidate.statusId] || "";

  const floor = Model.SIZE_LADDER.body.capMm;
  const ceiling = Model.SIZE_LADDER.status.capMm;
  let best = floor;
  for (let cap = ceiling; cap >= floor; cap -= 0.25) {
    const fontPx =
      Engine.capToFontMm(cap, candidate.geometry.capRatio) * pxPerMm;
    const available = bodyWidthPx - 2 * fontPx;
    const width = measureWidth(
      wording,
      fontPx,
      candidate.lineHeight,
      true
    );
    if (width <= available) {
      best = cap;
      break;
    }
  }
  candidate.caps["status-text"] = best;
  return "best fit within the budget";
}

// Two ceilings, not one: a ceiling is a trade, and one sample cannot
// show a trade. 40 is the gentler cut, 30 the one the ladder shows
// costing most.
const SOFT_CANDIDATE_CEILINGS = Object.freeze([40, 30]);

// The provisional opening scheme. One of the two ceilings above, and
// which one is a judgement about how it LOOKS, not a measurement -
// which is exactly why it is labelled provisional and why both are on
// screen as cards beside it.
const PROVISIONAL_CHROMA_CEILING = 40;

// The other half of "soft". Chosen to sit above the palette's deep
// tones and below its tints; both figures are on screen, so the cut
// is readable rather than asserted.
const SOFT_LIGHTNESS_FLOOR = 70;

// "In both looks" - the two ways a soft colour can carry a status
// without becoming a saturated block. Both keep the badge's BOX the
// same size; they differ in how much of it is ink.
const SOFT_LOOKS = Object.freeze([
  Object.freeze({
    label: "pastel fill with a solid border",
    badge: Object.freeze({
      style: Model.BADGE_STYLE_FILLED,
      borderMode: Model.BADGE_BORDER_AUTO_MODE,
    }),
  }),
  Object.freeze({
    label: "outlined",
    badge: Object.freeze({
      style: Model.BADGE_STYLE_OUTLINED,
      borderMode: "never",
    }),
  }),
]);

/** The closest pair anywhere in a set, in greyscale, bound or not. */
function greyscaleWorstFor(derived) {
  const grey = window.ContrastCardsCVD.MODES.GREYSCALE;
  if (!derived.pairs.length) return 0;
  return Math.min.apply(
    null,
    derived.pairs.map((pair) => pair.perMode[grey].deltaE)
  );
}

function buildGalleryCandidates() {
  const built = separationMatrix();
  const colourSets = [];

  colourSets.push({
    label: "as-built colours",
    hexes: Model.STATUSES.map(
      (status) => Model.roleById("status-fill-" + status.id).defaultHex
    ),
  });

  Model.FILL_GATE_MODES.forEach((mode) => {
    const probe = cloneState(state);
    probe.fillGate = mode.id;
    const nodes = badgeCandidates(probe);
    let result = null;
    try {
      result = Engine.bestSeparationFor(
        nodes,
        built.matrix,
        Model.STATUSES.length
      );
    } catch (error) {
      logError("Gallery colour set failed", error);
    }
    if (result && result.possible) {
      colourSets.push({
        label: "solver set, " + mode.label,
        fillGate: mode.id,
        hexes: result.set.map((index) => state.palette[index].hex),
      });
    }
  });

  // A greyscale-only set. Greyscale is where the as-built pair binds,
  // and a set chosen for it alone is a genuinely different answer -
  // worth seeing beside the all-modes sets rather than assumed to be
  // the same.
  const greyMatrix = Engine.buildSeparationMatrix(state.palette, [
    window.ContrastCardsCVD.MODES.GREYSCALE,
  ]);
  try {
    const greyResult = Engine.bestSeparationFor(
      badgeCandidates(),
      greyMatrix.matrix,
      Model.STATUSES.length
    );
    if (greyResult && greyResult.possible) {
      colourSets.push({
        label: "solver set, greyscale only",
        hexes: greyResult.set.map((index) => state.palette[index].hex),
      });
    }
  } catch (error) {
    logError("Greyscale colour set failed", error);
  }

  const candidates = [];

  // --- The soft candidates ---------------------------------------
  // Once greyscale stops binding, a chroma ceiling costs far less
  // dispersion than it used to, so soft schemes become affordable
  // rather than merely available. Each is the SAME solver under a
  // ceiling, shown in the two looks that read soft on a door: a
  // pastel fill with dark text and a solid border, and outlined.
  SOFT_CANDIDATE_CEILINGS.forEach((ceiling) => {
    SOFT_LOOKS.forEach((look) => {
      const candidate = cloneState(state);
      candidate.chromaCeiling = ceiling;
      candidate.lightnessFloor = SOFT_LIGHTNESS_FLOOR;
      candidate.badge = Object.assign({}, state.badge, look.badge);
      const nodes = badgeCandidates(candidate);
      let result = null;
      try {
        result = Engine.bestSeparationFor(
          nodes,
          built.matrix,
          Model.STATUSES.length
        );
      } catch (error) {
        logError("Soft candidate failed", error);
      }
      if (!result || !result.possible) return;
      Model.STATUSES.forEach((status, index) => {
        candidate.colours["status-fill-" + status.id] =
          state.palette[result.set[index]].hex;
      });
      applySizeScheme(candidate, "guidance");
      candidates.push({
        state: candidate,
        soft: true,
        label:
          "soft, chroma ceiling " + ceiling + ", " + look.label,
      });
    });
  });

  colourSets.forEach((set) => {
    ["as-built", "guidance", "best-fit"].forEach((scheme) => {
      const candidate = cloneState(state);
      if (set.fillGate) candidate.fillGate = set.fillGate;
      Model.STATUSES.forEach((status, index) => {
        candidate.colours["status-fill-" + status.id] =
          set.hexes[index];
      });
      const schemeLabel = applySizeScheme(candidate, scheme);
      candidates.push({
        state: candidate,
        label: set.label + ", " + schemeLabel,
      });
    });
  });

  return candidates;
}

/**
 * Every status in one configuration's set, side by side.
 *
 * The card's headline figure is the worst pair's delta E - a statement
 * about separation BETWEEN statuses - while the frame renders exactly
 * one status, so the quantity being ranked was the one thing not on
 * screen. Two cards with different sets and different gates looked
 * identical, because the only colour visible was the one they shared.
 *
 * The greyscale row is not decoration: greyscale has been the binding
 * mode in every set measured, so a pair that separates in colour and
 * collapses in grey is the case the figure is usually reporting.
 */
function statusStrip(derived, greyscale) {
  const source = derived.state || state;
  const ink = derived.byId["status-text"];
  const wrapper = document.createElement("div");
  wrapper.className = "dps-striprow";

  const label = document.createElement("span");
  label.className = "dps-striplabel";
  label.textContent = greyscale ? "In greyscale" : "In colour";
  wrapper.appendChild(label);

  const strip = document.createElement("div");
  strip.className = "dps-strip" + (greyscale ? " dps-strip--grey" : "");
  Model.STATUSES.forEach((status) => {
    const chip = document.createElement("span");
    chip.className = "dps-chip";
    chip.style.background = source.colours["status-fill-" + status.id];
    if (ink) chip.style.color = ink.hex;
    // The wording, not just the swatch - a strip of unlabelled
    // colours would be the same mistake one layer down.
    chip.textContent =
      source.statusLabels[status.id] || status.label;
    strip.appendChild(chip);
  });
  wrapper.appendChild(strip);
  return wrapper;
}

function renderGallery() {
  const host = document.getElementById("dpsGallery");
  host.textContent = "";

  const scored = buildGalleryCandidates().map((candidate) => {
    const derived = derive(candidate.state);
    // Render the miniature first: the clipping half of the fitting
    // question can only be read from a real rendered element.
    const item = document.createElement("div");
    item.className = "dps-galleryitem";

    const panel = document.createElement("div");
    panel.className = "dps-panel";
    panel.style.border = "0.3rem solid #2b2b2b";
    const surface = surfaceElement.cloneNode(true);
    surface.removeAttribute("id");
    surface
      .querySelectorAll("[id]")
      .forEach((node) => node.removeAttribute("id"));
    panel.appendChild(surface);
    item.appendChild(panel);
    host.appendChild(item);

    paintPanel(panel, surface, derived, {
      frameHeightPx: GALLERY_FRAME_HEIGHT_PX,
      simulation: state.simulation,
    });

    const fit = measureFit(surface, derived);
    const findings = buildFindings(derived, fit);

    return {
      candidate: candidate,
      derived: derived,
      fit: fit,
      findings: findings,
      score: scoreFindings(findings),
      item: item,
    };
  });

  scored.sort((a, b) => a.score - b.score);

  // Kept so the commentary can be checked against the findings of the
  // very frame that was rendered, rather than against a re-derivation
  // that might have measured in a different box.
  lastGallery = scored;

  host.textContent = "";
  // Soft candidates first, then the ranked rest. They are the thing
  // being chosen between, and a purely ranked list would drop them:
  // the solver's objective is dispersion, which is exactly what a
  // chroma ceiling gives away, so a soft scheme scores below a
  // saturated one BY CONSTRUCTION and would never survive the slice.
  const softFirst = scored
    .filter((entry) => entry.candidate.soft)
    .concat(scored.filter((entry) => !entry.candidate.soft));
  softFirst.slice(0, GALLERY_SIZE).forEach((entry, position) => {
    const heading = document.createElement("h3");
    heading.textContent =
      position + 1 + ". " + entry.candidate.label;
    entry.item.insertBefore(heading, entry.item.firstChild);

    const figures = document.createElement("p");
    figures.className = "dps-galleryfigures";
    figures.textContent =
      "worst pair delta E " +
      Engine.round(
        entry.derived.worstPair ? entry.derived.worstPair.minDeltaE : 0,
        1
      ) +
      " (" +
      (entry.derived.worstPair
        ? entry.derived.worstPair.worstMode
        : "n/a") +
      ") · greyscale delta E " +
      Engine.round(greyscaleWorstFor(entry.derived), 1) +
      " · pool " +
      badgeCandidates(entry.candidate.state).length +
      " · budget " +
      Engine.round(entry.derived.budget.consumedLines, 1) +
      " of " +
      Engine.round(entry.derived.budget.lines, 1) +
      " · " +
      entry.findings.length +
      " findings";
    entry.item.appendChild(figures);

    // Immediately under the delta E figure, because the strip is what
    // that figure is about.
    entry.item.appendChild(statusStrip(entry.derived, false));
    entry.item.appendChild(statusStrip(entry.derived, true));

    const comment = document.createElement("p");
    comment.className = "dps-gallerycomment";
    comment.textContent = commentaryFor(
      entry.derived,
      entry.findings,
      CARD_COMMENT_CLAUSES
    );
    entry.item.appendChild(comment);

    // The rest of what this configuration trades away, behind the
    // disclosure rather than on the card.
    if (entry.findings.length > 0) {
      const detail = document.createElement("details");
      detail.className = "dps-roledetail";
      const summary = document.createElement("summary");
      summary.textContent = "All " + entry.findings.length + " findings";
      summary.setAttribute(
        "aria-label",
        "All " +
          entry.findings.length +
          " findings for " +
          entry.candidate.label
      );
      detail.appendChild(summary);
      const list = document.createElement("ul");
      entry.findings.forEach((finding) => {
        const item = document.createElement("li");
        item.textContent =
          finding.kind + " - " + finding.subject + ": " + finding.detail;
        list.appendChild(item);
      });
      detail.appendChild(list);
      entry.item.appendChild(detail);
    }

    const load = document.createElement("button");
    load.type = "button";
    load.className = "dps-secondary";
    load.textContent = "Load into the preview";
    load.setAttribute(
      "aria-label",
      "Load into the preview: " + entry.candidate.label
    );
    load.addEventListener("click", () => {
      state.colours = Object.assign(
        {},
        state.colours,
        entry.candidate.state.colours
      );
      state.caps = Object.assign({}, entry.candidate.state.caps);
      state.lineHeight = entry.candidate.state.lineHeight;
      state.fillGate = entry.candidate.state.fillGate;
      document.getElementById(
        "dpsFillGate-" + state.fillGate
      ).checked = true;
      document.getElementById("dpsLineSpacing").value =
        state.lineHeight;
      recomputeAndRepaint();
      announce("Loaded into the preview: " + entry.candidate.label + ".");
    });
    entry.item.appendChild(load);

    host.appendChild(entry.item);
  });

  announce(
    "Gallery built: " +
      Math.min(GALLERY_SIZE, scored.length) +
      " configurations, best first."
  );
}

/* ==================================================================
   RECOMPUTE AND REPAINT - the single entry point
   ================================================================== */

let lastDerived = null;
let lastFit = null;

// The fill-gate table runs the solver twice, which is far too much to
// repeat on every keystroke. It only depends on the palette, the
// background, and the status word's colour and size.
let fillGateCacheKey = "";

function fillGateKey() {
  return [
    state.palette.length,
    state.palette[0] ? state.palette[0].hex : "",
    state.colours["page-bg"],
    state.colours["status-text"],
    state.caps["status-text"],
    state.fillGate,
    state.badge.style,
    state.badge.borderMode,
    state.chromaCeiling,
  ].join("|");
}

function recomputeAndRepaint() {
  if (typeof chroma === "undefined") return;
  const derived = derive();
  lastDerived = derived;

  // Paint first: the clipping half of the fitting question can only be
  // read from a rendered element.
  paintFrame(derived);

  // Keep the last measurement that could actually see the clipping,
  // rather than accepting a fresh optimistic one taken off-screen.
  const fresh = measureFit(surfaceElement, derived);
  const fit = fresh.clipMeasured || !lastFit ? fresh : lastFit;
  fit.stale = !fresh.clipMeasured;
  lastFit = fit;
  const findings = buildFindings(derived, fit);

  derived.roles.forEach(refreshRoleRow);
  renderGeometry(derived);
  renderFrameReadout();
  renderSummary(derived, findings, fit);
  renderCapDiagram();
  renderApproachReadout(derived);
  renderFitReport(derived, fit);
  // Findings, budget, pair table, background comparison and export
  // all render in the evidence report now, from the payload built
  // when the reader follows the link - so a repaint no longer pays
  // for five tables nobody is looking at.
  refreshBadge(derived);
  renderBadgeAreaReadout(fit);
  renderDesignForReadout(derived);
  renderSchemeReadout(derived);
  paintOverlays(derived);

  const key = fillGateKey();
  if (key !== fillGateCacheKey) {
    fillGateCacheKey = key;
    renderFillGate();
    renderBadgeStyleReadout();
    renderChromaReadout();
  }

}

// Breathing room below the frame, in CSS pixels.
const PREVIEW_GAP_PX = 8;

// Stacked, the preview row sizes to its content, so its own height
// cannot be the budget without circularity. This is the share of the
// STAGE the frame and its readouts may take, leaving the rest to the
// controls scrolling beneath.
const STACKED_FRAME_SHARE = 0.58;

// Matches the escape-hatch media query in the stylesheet. Two copies
// of one number, so the pair is asserted by a canary rather than
// trusted: SHORT_VIEWPORT_QUERY below.
const SHORT_VIEWPORT_QUERY = "(max-height: 36rem)";

/**
 * The smallest cap height, in CSS pixels, at which the preview is
 * still worth looking at. Below this the frame is not a small version
 * of the panel, it is an illegible one, and nothing on it can be
 * judged - which is what the old 200 px default produced: the status
 * word rendered at 4.7 px of cap.
 *
 * Chosen as the smallest cap the CSS reference pixel makes meaningful
 * at arm's length rather than by eye, and used to DERIVE a minimum
 * frame height per configuration - the frame floor is whatever height
 * makes the smallest role on the panel reach it.
 */
const MIN_LEGIBLE_CAP_PX = 8;

/**
 * The frame height at which the smallest role still renders at
 * MIN_LEGIBLE_CAP_PX. Derived from the configuration, so changing a
 * role's size changes the floor.
 */
function minimumLegibleFrameHeightPx(derived) {
  let smallestCapMm = Infinity;
  derived.roles.forEach((record) => {
    if (record.capMm === undefined || record.capMm <= 0) return;
    if (record.capMm < smallestCapMm) smallestCapMm = record.capMm;
  });
  if (!Number.isFinite(smallestCapMm)) return 0;
  // capPx = capMm * frameHeightPx / panelHmm, solved for frameHeightPx.
  return (
    (MIN_LEGIBLE_CAP_PX * state.geometry.panelHmm) / smallestCapMm
  );
}

/**
 * Size the frame to its PANE.
 *
 * The pane is a fixed-height scroll container now, so this is a
 * straight fit against measured space - no viewport-share heuristics
 * and no interaction with the controls, because the two panes cannot
 * reach each other.
 *
 * Auto by default and re-fitted on resize; any explicit choice from
 * the slider or the size buttons switches to manual and is left alone.
 */
function fitFrameToPane(force) {
  if (!force && state.frameFit !== "auto") return;
  const preview = document.querySelector(".dps-preview");
  // Fitting a frame to a pane that is not rendered would compute a
  // height from zero available space, which is the same false-zero
  // this file has now paid for three times.
  if (!measureBox(preview).measured) return;
  const style = getComputedStyle(preview);
  const availableWidth =
    preview.clientWidth -
    (parseFloat(style.paddingLeft) || 0) -
    (parseFloat(style.paddingRight) || 0);
  // The readout and the summary sit under the frame and take the same
  // pane. Measure what they cost by SUMMING them: scrollHeight would
  // report the pane's own height whenever the content is shorter than
  // the pane, which reads as a chrome cost of everything the frame is
  // not currently using.
  const scroller = preview.querySelector(".dps-panelscroll");
  const gap = parseFloat(getComputedStyle(preview).rowGap) || 0;
  let chrome = 0;
  Array.prototype.forEach.call(preview.children, (child) => {
    if (child === scroller) return;
    chrome += child.getBoundingClientRect().height + gap;
  });
  const stacked = window.matchMedia("(max-width: 64rem)").matches;
  // Unlocked, every container is height:auto, so the pane's own
  // height IS its content and cannot be the budget for it. The
  // viewport is the only independent measure left.
  const unlocked = window.matchMedia(SHORT_VIEWPORT_QUERY).matches;
  const budget = unlocked
    ? window.innerHeight * STACKED_FRAME_SHARE
    : stacked
      ? document.querySelector(".dps-stage").clientHeight *
        STACKED_FRAME_SHARE
      : preview.clientHeight;
  const availableHeight = budget - chrome - PREVIEW_GAP_PX;
  if (availableWidth <= 0 || availableHeight <= 0) return;

  const geometry = Engine.computeGeometry(state.geometry);
  const slider = document.getElementById("dpsFrameHeight");
  const wanted = Math.min(
    availableWidth / geometry.aspectPx,
    availableHeight
  );

  // The floor is a legibility floor, not a taste one. Where the pane
  // cannot give the frame this much, the frame KEEPS it and the
  // panel scroller takes the overflow - shrinking into illegibility
  // would produce a preview that renders correctly and shows nothing.
  const legibleFloor = lastDerived
    ? minimumLegibleFrameHeightPx(lastDerived)
    : 0;
  const floor = Math.max(Number(slider.min), Math.floor(legibleFloor));
  const clamped = Math.max(
    floor,
    Math.min(Number(slider.max), Math.floor(wanted))
  );

  if (Math.abs(clamped - state.frameHeightPx) < 1) return;
  state.frameHeightPx = clamped;
  slider.value = clamped;
  recomputeAndRepaint();
}

/* --- Presets --------------------------------------------------- */

/**
 * The best the palette can do: the highest-contrast usable colour for
 * every text and graphical role, and - for the badge fills - whatever
 * the solver says is the most separated set of that many colours.
 * Locked roles are left alone.
 */
function applyBestColours(options) {
  const speak = Boolean(options && options.announce);
  const messages = [];

  Model.allRoles().forEach((role) => {
    if (role.kind === "surface" || role.kind === "status-fill") return;
    if (state.locks[role.id]) return;

    let best = null;
    state.palette.forEach((colour) => {
      if (!availabilityFor(role, colour.hex).available) return;
      const measured = measureRole(
        role,
        colour.hex,
        state.caps[role.id] || 0
      );
      if (!best || measured.worst.lc > best.lc) {
        best = { hex: colour.hex, lc: measured.worst.lc };
      }
    });

    if (best) {
      state.colours[role.id] = best.hex;
    } else {
      messages.push("nothing in the palette can serve " + role.name);
    }
  });

  const nodes = badgeCandidates();
  const wanted = Model.STATUSES.length;
  const result = Engine.bestSeparationFor(
    nodes,
    separationMatrix().matrix,
    wanted
  );

  if (result.possible) {
    let position = 0;
    Model.STATUSES.forEach((status) => {
      const roleId = "status-fill-" + status.id;
      if (state.locks[roleId]) return;
      state.colours[roleId] = state.palette[result.set[position]].hex;
      position += 1;
    });
    messages.push(
      "the most separated set of " +
        wanted +
        " fills holds delta E " +
        Engine.round(result.threshold, 2) +
        " at its worst mode"
    );
  } else {
    messages.push(
      "this palette cannot supply " +
        wanted +
        " usable badge fills at all"
    );
  }

  recomputeAndRepaint();
  // Silent by default. This runs once as part of the opening state,
  // and a preset that announced on load would be exactly the load
  // chatter the announcement rules exist to stop; the announcing
  // paths declare themselves instead.
  if (speak) {
    announce(
      "Best available colours applied: " + messages.join("; ") + "."
    );
  }
  return messages;
}

/* --- Whole-panel presets ---------------------------------------
   The pieces above set one dimension each - colours, or sizes, or
   wording. These two set all of them at once, because "the panel the
   colleague built" and "the panel the guidance argues for" are single
   positions, not a menu, and comparing them one dimension at a time
   was how the comparison got lost. */

/** The colleague's panel, exactly: colours, sizes, padding, wording. */
function applyAsBuiltPanel(options) {
  const speak = Boolean(options && options.announce);
  applyAsBuiltColours();
  applyAsBuiltSizes();
  state.lineHeight = Model.AS_BUILT.lineHeight;
  state.badge.padY = Model.BADGE_DEFAULTS.padY;
  state.badge.padX = Model.BADGE_DEFAULTS.padX;
  state.badge.shape = Model.BADGE_DEFAULTS.shape;
  state.badge.borderMode = "never";
  state.content = Object.assign({}, Model.CONTENT_DEFAULTS);
  Model.STATUSES.forEach((status) => {
    state.statusLabels[status.id] = status.label;
  });
  syncPanelControls();
  recomputeAndRepaint();
  if (speak) {
    announce(
      "The as-built panel is showing: the colleague's colours, sizes, padding and wording, converted through the current geometry."
    );
  }
}

/**
 * The panel the guidance argues for: the ladder's sizes, the best
 * colours the palette can supply, tighter badge padding and short
 * status wording - which is what the 14 mm status cap needs.
 */
function applyRecommendedPanel(options) {
  const speak = Boolean(options && options.announce);
  applyGuidanceSizes();
  // The guidance's own 1.5, honoured - see RECOMMENDED_BADGE_PADDING
  // for the frontier that made it affordable once the free lever was
  // exhausted first.
  state.lineHeight = Model.RECOMMENDED_LINE_SPACING;
  state.content = Object.assign({}, Model.CONTENT_DEFAULTS);
  state.badge.padY = Model.RECOMMENDED_BADGE_PADDING.padY;
  state.badge.padX = Model.RECOMMENDED_BADGE_PADDING.padX;
  state.badge.borderMode = Model.BADGE_BORDER_AUTO_MODE;
  Model.STATUSES.forEach((status) => {
    const short = Model.RECOMMENDED_STATUS_LABELS[status.id];
    if (short) state.statusLabels[status.id] = short;
  });
  syncPanelControls();
  // Runs last, so it lands against the sizes just set.
  applyScheme(Model.DEFAULT_SCHEME_ID, { announce: speak });
}

/**
 * Apply one of the chosen schemes. Explicit fills, no solver: the trio was
 * decided by eye from what the solver showed, and re-deriving it here would
 * make the page's default depend on the solver's mood rather than on the
 * decision. The ceiling and floor come OFF for the reason recorded on
 * PANEL_SCHEMES.
 */
function applyScheme(id, options) {
  const scheme = Model.PANEL_SCHEMES.filter((s) => s.id === id)[0];
  if (!scheme) return;
  state.chromaCeiling = null;
  state.lightnessFloor = null;
  const chromaOn = document.getElementById("dpsChromaOn");
  const chromaSlider = document.getElementById("dpsChromaCeiling");
  if (chromaOn) chromaOn.checked = false;
  if (chromaSlider) chromaSlider.disabled = true;
  const chromaValue = document.getElementById("dpsChromaValue");
  if (chromaValue) chromaValue.textContent = "(off)";
  Model.STATUSES.forEach((status, index) => {
    const roleId = "status-fill-" + status.id;
    if (state.locks[roleId]) return;
    state.colours[roleId] = scheme.fills[index];
  });
  state.scheme = scheme.id;
  fillGateCacheKey = "";
  syncSchemeControl();
  recomputeAndRepaint();
  if (options && options.announce) {
    const derived = derive(state);
    const drawn = Model.STATUSES.filter((status) =>
      borderOnFor(state.colours["status-fill-" + status.id])
    ).length;
    announce(
      scheme.label +
        " applied. Closest pair delta E " +
        Engine.round(derived.worstPair ? derived.worstPair.minDeltaE : 0, 1) +
        " in " +
        (derived.worstPair ? derived.worstPair.worstMode : "no mode") +
        ", and " +
        drawn +
        " of " +
        Model.STATUSES.length +
        " badges need a border."
    );
  }
}

function buildSchemeControl() {
  const host = document.getElementById("dpsSchemeChoice");
  if (!host) return;
  host.textContent = "";
  Model.PANEL_SCHEMES.forEach((scheme) => {
    const wrap = document.createElement("div");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "dpsScheme";
    input.id = "dpsScheme-" + scheme.id;
    input.value = scheme.id;
    input.checked = scheme.id === state.scheme;
    input.addEventListener("change", () => {
      if (input.checked) applyScheme(scheme.id, { announce: true });
    });
    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.style.display = "inline";
    label.textContent = " " + scheme.label + " - " + scheme.note;
    wrap.appendChild(input);
    wrap.appendChild(label);
    host.appendChild(wrap);
  });
}

/**
 * THE CROSS-CHECK, and it is the point of the readout rather than a footnote.
 *
 * The reviewer's probe and this page are two implementations of the same
 * measurement. Printing this page's figures alone would be one instrument
 * asserting; printing both, with the gap, is two instruments agreeing - and a
 * disagreement past rounding is a finding about one of them, never something
 * to average away.
 */
const SCHEME_PROBE_TOLERANCE = 0.15;

function renderSchemeReadout(derived) {
  const host = document.getElementById("dpsSchemeReadout");
  if (!host) return;
  const scheme = Model.PANEL_SCHEMES.filter((s) => s.id === state.scheme)[0];
  if (!scheme || !derived.pairs.length) {
    host.innerHTML =
      '<p class="dps-hint">A hand-edited scheme is showing, so there is no recorded probe to compare it with.</p>';
    return;
  }
  const modes = window.ContrastCardsCVD.getModes();
  let worst = 0;
  const rows = modes.map((mode) => {
    const measured = Math.min.apply(
      null,
      derived.pairs.map((pair) => pair.perMode[mode].deltaE)
    );
    const probe = scheme.probe[mode];
    const gap = probe === undefined ? null : Math.abs(measured - probe);
    if (gap !== null && gap > worst) worst = gap;
    return (
      '<tr><th scope="row">' + escapeHtml(mode) +
      '</th><td class="dps-num">' + Engine.round(measured, 1) +
      '</td><td class="dps-num">' + (probe === undefined ? "&mdash;" : probe) +
      '</td><td class="dps-num">' +
      (gap === null ? "&mdash;" : Engine.round(gap, 2)) + "</td></tr>"
    );
  }).join("");
  const agrees = worst <= SCHEME_PROBE_TOLERANCE;
  const drawn = Model.STATUSES.filter((status) =>
    borderOnFor(state.colours["status-fill-" + status.id])
  ).length;
  const wordGate = derived.byId["status-text"].gate;
  const words = Model.STATUSES.map((status) => {
    const hex = state.colours["status-fill-" + status.id];
    const m = Engine.contrastPair(state.colours["status-text"], hex);
    return (
      swatchHtml(hex) + escapeHtml(status.label) + " " + m.wcag + ":1 / Lc " + m.lc +
      (m.wcag >= wordGate.wcag && m.lc >= wordGate.lc ? "" : " <strong>UNDER GATE</strong>")
    );
  }).join(" &middot; ");
  host.innerHTML =
    "<table><caption>How far apart the closest two statuses are, for each kind of reader. We worked this out twice: once on this page, and once by hand when the scheme was chosen. Two separate sums. A gap bigger than " +
    SCHEME_PROBE_TOLERANCE +
    " would mean one of them is wrong.</caption><thead><tr><th scope=\"col\">Reader</th><th scope=\"col\">This page</th><th scope=\"col\">Worked out earlier</th><th scope=\"col\">Gap</th></tr></thead><tbody>" +
    rows + "</tbody></table>" +
    '<p class="dps-hint">' +
    (agrees
      ? "<strong>The two sums agree</strong>, biggest gap " + Engine.round(worst, 2) + "."
      : "<strong>THE TWO SUMS DISAGREE</strong>, biggest gap " + Engine.round(worst, 2) +
        " &mdash; stop, and find out which one is wrong.") +
    " The word on each badge, against a test of " + wordGate.wcag + ":1 and Lc " +
    wordGate.lc + ": " + words + ". Badges needing a border: " + drawn + " of " +
    Model.STATUSES.length + ".</p>";
}

function syncSchemeControl() {
  Model.PANEL_SCHEMES.forEach((scheme) => {
    const radio = document.getElementById("dpsScheme-" + scheme.id);
    if (radio) radio.checked = scheme.id === state.scheme;
  });
}

/** Push state back into the controls the presets just moved. */
function syncPanelControls() {
  const spacing = document.getElementById("dpsLineSpacing");
  if (spacing) spacing.value = state.lineHeight;
  const padY = document.getElementById("dpsBadgePadY");
  if (padY) padY.value = state.badge.padY;
  const padX = document.getElementById("dpsBadgePadX");
  if (padX) padX.value = state.badge.padX;
  const border = document.getElementById("dpsBadgeBorder");
  if (border) border.value = state.badge.borderMode;
  const approach = document.getElementById("dpsApproachRole");
  if (approach) approach.value = state.approachRoleId;
  buildContentControls();
}

/* --- Wiring ---------------------------------------------------- */

const GEOMETRY_INPUTS = Object.freeze([
  { id: "dpsPanelWpx", key: "panelWpx" },
  { id: "dpsPanelHpx", key: "panelHpx" },
  { id: "dpsPanelWmm", key: "panelWmm" },
  { id: "dpsPanelHmm", key: "panelHmm" },
  { id: "dpsDistance", key: "distanceMm" },
  { id: "dpsCapRatio", key: "capRatio" },
  { id: "dpsPaddingMm", key: "paddingMm" },
]);

function wireGeometry() {
  GEOMETRY_INPUTS.forEach((entry) => {
    const input = document.getElementById(entry.id);
    input.value = state.geometry[entry.key];
    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) return;
      state.geometry[entry.key] = value;
      recomputeAndRepaint();
    });
  });

  const spacing = document.getElementById("dpsLineSpacing");
  spacing.value = state.lineHeight;
  spacing.addEventListener("input", () => {
    const value = Number(spacing.value);
    if (!Number.isFinite(value) || value <= 0) return;
    state.lineHeight = value;
    recomputeAndRepaint();
  });

  document
    .getElementById("dpsCapInter")
    .addEventListener("click", () => setCapRatio(Model.CAP_RATIOS.INTER));
  document
    .getElementById("dpsCapRuleOfThumb")
    .addEventListener("click", () =>
      setCapRatio(Model.CAP_RATIOS.RULE_OF_THUMB)
    );
}

function setCapRatio(ratio) {
  state.geometry.capRatio = ratio;
  document.getElementById("dpsCapRatio").value = ratio;
  recomputeAndRepaint();
  announce(
    "Cap height ratio set to " +
      ratio +
      " of font size. Font sizes have moved; the cap heights have not."
  );
}

function setFrameHeight(pixels, spokenLabel) {
  state.frameFit = "manual";
  const slider = document.getElementById("dpsFrameHeight");
  const clamped = Math.max(
    Number(slider.min),
    Math.min(Number(slider.max), pixels)
  );
  state.frameHeightPx = clamped;
  slider.value = clamped;
  recomputeAndRepaint();
  if (spokenLabel) announce(spokenLabel);
}

function wireFrameControls() {
  const slider = document.getElementById("dpsFrameHeight");
  slider.max = Math.max(1400, state.geometry.panelHpx);
  slider.value = state.frameHeightPx;
  slider.addEventListener("input", () => {
    state.frameHeightPx = Number(slider.value);
    state.frameFit = "manual";
    recomputeAndRepaint();
  });

  document
    .getElementById("dpsScaleActual")
    .addEventListener("click", () =>
      setFrameHeight(
        (state.geometry.panelHmm * 96) / 25.4,
        "Frame set to nominal actual size. Check it with the 100 mm block and a ruler before trusting it."
      )
    );

  document
    .getElementById("dpsScaleNative")
    .addEventListener("click", () =>
      setFrameHeight(
        state.geometry.panelHpx,
        "Frame set to one CSS pixel per panel pixel."
      )
    );

  document.getElementById("dpsScaleFit").addEventListener("click", () => {
    state.frameFit = "auto";
    fitFrameToPane(true);
    announce(
      "Frame fitted to the pane, and it will re-fit if the window changes size."
    );
  });

  const overlayMap = [
    { id: "dpsOverlayCaps", key: "caps", label: "Cap-height rules" },
    { id: "dpsOverlayGrid", key: "grid", label: "Line budget grid" },
    {
      id: "dpsOverlayCalibration",
      key: "calibration",
      label: "Calibration block",
    },
  ];

  overlayMap.forEach((entry) => {
    const box = document.getElementById(entry.id);
    box.checked = state.overlays[entry.key];
    box.addEventListener("change", () => {
      state.overlays[entry.key] = box.checked;
      recomputeAndRepaint();
      announce(entry.label + (box.checked ? " shown." : " hidden."));
    });
  });

  const magnify = document.getElementById("dpsMagnify");
  magnify.addEventListener("change", () => {
    state.magnify = magnify.checked;
    document.body.classList.toggle("dps-magnify", magnify.checked);
    announce(
      magnify.checked
        ? "Readouts magnified for projection."
        : "Readouts back to normal size."
    );
  });
}

function wirePresets() {
  document
    .getElementById("dpsPresetPanelRecommended")
    .addEventListener("click", () =>
      applyRecommendedPanel({ announce: true })
    );

  document
    .getElementById("dpsPresetPanelAsBuilt")
    .addEventListener("click", () =>
      applyAsBuiltPanel({ announce: true })
    );

  document
    .getElementById("dpsPresetColoursAsBuilt")
    .addEventListener("click", () => {
      applyAsBuiltColours();
      recomputeAndRepaint();
      announce("As-built colours restored.");
    });

  document
    .getElementById("dpsPresetColoursGuidance")
    .addEventListener("click", () =>
      applyBestColours({ announce: true })
    );

  document
    .getElementById("dpsPresetSizeAsBuilt")
    .addEventListener("click", () => {
      applyAsBuiltSizes();
      state.lineHeight = Model.AS_BUILT.lineHeight;
      document.getElementById("dpsLineSpacing").value =
        state.lineHeight;
      recomputeAndRepaint();
      announce(
        "As-built sizes restored, converted from the panel's own rem values."
      );
    });

  document
    .getElementById("dpsPresetSizeGuidance")
    .addEventListener("click", () => {
      applyGuidanceSizes();
      state.lineHeight = Model.PANEL_DEFAULTS.lineSpacing;
      document.getElementById("dpsLineSpacing").value =
        state.lineHeight;
      recomputeAndRepaint();
      announce(
        "Sizes set to the guidance floors. Read the fitting report: at these sizes the wording is what decides whether the panel works."
      );
    });

  document
    .getElementById("dpsPresetSizeBestFit")
    .addEventListener("click", () => {
      const candidate = cloneState(state);
      applySizeScheme(candidate, "best-fit");
      state.caps = candidate.caps;
      state.lineHeight = candidate.lineHeight;
      document.getElementById("dpsLineSpacing").value =
        state.lineHeight;
      recomputeAndRepaint();
      announce(
        "Sizes set to the largest that still fit. The status word is at " +
          Engine.round(state.caps["status-text"], 2) +
          " mm cap, measured against its current wording."
      );
    });

  document
    .getElementById("dpsContentReset")
    .addEventListener("click", () => {
      state.content = Object.assign({}, Model.CONTENT_DEFAULTS);
      Model.STATUSES.forEach((status) => {
        state.statusLabels[status.id] = status.label;
      });
      buildContentControls();
      recomputeAndRepaint();
      announce("The original wording has been restored.");
    });
}

function wirePalette() {
  const input = document.getElementById("dpsPaletteInput");
  const status = document.getElementById("dpsPaletteStatus");

  function fill() {
    input.value = state.palette
      .map((colour) => colour.name + " " + colour.hex)
      .join("\n");
    status.textContent =
      state.palette.length + " colours in the palette.";
  }

  document
    .getElementById("dpsPaletteApply")
    .addEventListener("click", () => {
      const parsed = Engine.parsePalette(input.value);
      if (parsed.colours.length < 2) {
        status.textContent =
          "At least two colours are needed. Nothing has changed.";
        announce("The palette was not applied: fewer than two colours.");
        return;
      }
      state.palette = parsed.colours;
      separationCache = null;
      buildRoleControls();
      recomputeAndRepaint();
      status.textContent =
        parsed.colours.length +
        " colours applied" +
        (parsed.rejected.length
          ? ", " + parsed.rejected.length + " lines ignored"
          : "") +
        ".";
      announce(
        parsed.colours.length +
          " colours applied. Every figure on the page has been recomputed."
      );
    });

  document
    .getElementById("dpsPaletteReset")
    .addEventListener("click", () => {
      state.palette = Model.DEFAULT_COLOURS.map((colour) =>
        Object.assign({}, colour)
      );
      separationCache = null;
      buildRoleControls();
      fill();
      recomputeAndRepaint();
      announce("The 45 brand colours have been restored.");
    });

  fill();
}

function wireVerification() {
  document.getElementById("dpsRunVerify").addEventListener("click", () => {
    const result = window.ContrastCardsCVD.verifyAgainstFilters();
    const perMode = {};
    result.rows.forEach((row) => {
      if (!perMode[row.mode] || row.delta > perMode[row.mode].delta) {
        perMode[row.mode] = row;
      }
    });

    const modeRows = Object.keys(perMode)
      .map(
        (mode) =>
          "<tr><td>" +
          escapeHtml(mode) +
          '</td><td class="dps-num">' +
          perMode[mode].delta +
          '</td><td class="dps-num">' +
          perMode[mode].tolerance +
          "</td><td>" +
          verdictHtml(perMode[mode].delta <= perMode[mode].tolerance) +
          "</td></tr>"
      )
      .join("");

    document.getElementById("dpsVerifyOut").innerHTML =
      "<p><strong>" +
      (result.passed ? "Agreed" : "DISAGREED") +
      ".</strong> " +
      result.comparisons +
      " comparisons, worst channel delta " +
      result.maxDelta +
      ". A disagreement means this page's arithmetic is wrong, not that the tolerance is.</p><table><caption>Worst channel delta per mode</caption><thead><tr><th scope=\"col\">Mode</th><th scope=\"col\">Worst delta</th><th scope=\"col\">Tolerance</th><th scope=\"col\">Verdict</th></tr></thead><tbody>" +
      modeRows +
      "</tbody></table>";

    announce(
      "Cross-check " +
        (result.passed ? "agreed" : "DISAGREED") +
        " over " +
        result.comparisons +
        " comparisons, worst channel delta " +
        result.maxDelta +
        "."
    );
  });

  document
    .getElementById("dpsRunCanaries")
    .addEventListener("click", () => {
      const geometryRows = Checks.runGeometryCanary().map((row) => ({
        label: row.label,
        expected: row.expected,
        actual: Engine.round(row.actual, 9),
        agrees: row.agrees,
      }));
      const solverRows = Checks.runSolverCanary();
      const renderRows = Checks.runRenderCanary();
      const readingRows = Checks.runReadingCanary();

      document.getElementById("dpsVerifyOut").innerHTML =
        Checks.renderVerificationRows(
          "Geometry against hand arithmetic at the seeded inputs",
          geometryRows,
          ["Quantity", "Hand arithmetic", "This page", "Verdict"]
        ) +
        Checks.renderVerificationRows(
          "Reading distance as the model, against the document's own table",
          readingRows,
          ["Assertion", "The document, or the rule", "This page", "Verdict"]
        ) +
        Checks.renderVerificationRows(
          "What the page RENDERS, against what the model says",
          renderRows,
          ["Assertion", "Measured", "Verdict"]
        ) +
        Checks.renderVerificationRows(
          "The solver, in both directions",
          solverRows,
          ["Assertion", "Outcome", "Verdict"]
        );

      const failed =
        geometryRows.filter((row) => !row.agrees).length +
        readingRows.filter((row) => !row.agrees).length +
        renderRows.filter((row) => !row.agrees).length +
        solverRows.filter((row) => !row.agrees).length;
      announce(
        failed === 0
          ? "All canaries agree."
          : failed + " canaries disagree."
      );
    });

  // The evidence report is a page, so this is a real link and a
  // plain click follows it. The handler only writes the figures the
  // report will read, then lets the navigation happen.
  document
    .getElementById("dpsEvidenceLink")
    .addEventListener("click", (event) => {
      event.preventDefault();
      openEvidenceReport();
    });

  document
    .getElementById("dpsRunGallery")
    .addEventListener("click", renderGallery);

  document
    .getElementById("dpsRunEnumeration")
    .addEventListener("click", () => Checks.renderEnumeration());
}

/* ==================================================================
   VIEWS, PRESENTATION MODE AND THE BADGE CONTROLS
   ================================================================== */

const VIEWS = Object.freeze([
  Object.freeze({ id: "configure", label: "Configure" }),
  Object.freeze({ id: "detail", label: "Detail" }),
  Object.freeze({ id: "gallery", label: "Gallery" }),
  Object.freeze({ id: "checks", label: "Checks" }),
]);

/**
 * The view the page opens on, named rather than inferred. A tab set that
 * starts on "whatever was selected last" is the mode-switcher trap: the
 * state that persisted is not evidence about the state that should hold.
 */
const DEFAULT_VIEW = "configure";

/**
 * COVERAGE MODE - a diagnostic state for the audit engines, never a
 * state a reader is given.
 *
 * Hiding a tab panel is what makes the tabs work, and it is also what
 * stops IBM and axe from evaluating anything inside it: moving four
 * sections to the Detail tab took the tool's potentials from 119 to 34
 * without improving a single thing. A gate that cannot see three
 * quarters of the page is a weaker gate than its zero suggests.
 *
 * So `?coverage=1` un-hides every panel and opens every disclosure, and
 * the engines are run a second time against it. It is opt-in from the
 * URL and touches nothing on a normal load - a coverage state that
 * could be reached by accident would be a worse bug than the blind spot
 * it exists to measure.
 *
 * What it does NOT cover, said here so the number is not read as more
 * than it is: the gallery cards, the enumeration tables and the
 * verification rows are built when their button is pressed, so in this
 * state their panels hold their static markup only.
 */
const COVERAGE_PARAM = "coverage";

function coverageRequested() {
  try {
    return new URLSearchParams(window.location.search).has(COVERAGE_PARAM);
  } catch (error) {
    logError("The coverage flag could not be read from the URL", error);
    return false;
  }
}

function applyCoverageState() {
  VIEWS.forEach((view) => {
    document.getElementById("dpsView-" + view.id).hidden = false;
  });
  Array.prototype.forEach.call(
    document.querySelectorAll("details"),
    (disclosure) => {
      disclosure.open = true;
    }
  );
  logInfo(
    "Coverage mode: every view un-hidden and every disclosure opened. " +
      "This is a diagnostic state, not the shipped one."
  );
}

/**
 * Standard tabs. The panels are `hidden`, which keeps their content in
 * the document but out of the accessibility tree - which is exactly
 * why the live region lives in the always-rendered header instead of
 * inside a panel, where it would silently stop speaking.
 */
function selectView(id, options) {
  const settings = options || {};

  VIEWS.forEach((view) => {
    const tab = document.getElementById("dpsTab-" + view.id);
    const panel = document.getElementById("dpsView-" + view.id);
    const selected = view.id === id;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  });

  state.view = id;
  if (settings.moveFocus) document.getElementById("dpsTab-" + id).focus();

  // The preview pane has no size while hidden, so it can only be
  // fitted once it is showing again.
  if (id === "configure") fitFrameToPane();

  // Silent unless a caller asks, so the announcing paths declare
  // themselves: the page setting its own opening view is not a change
  // anybody made, and a tab set that reports itself on load is chatter.
  if (!settings.announceChange) return;
  const chosen = VIEWS.filter((view) => view.id === id)[0];
  announce(chosen.label + " view.");
}

function setupTabs() {
  const tabs = VIEWS.map((view) =>
    document.getElementById("dpsTab-" + view.id)
  );

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () =>
      selectView(VIEWS[index].id, { announceChange: true })
    );
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") {
        next = (index - 1 + tabs.length) % tabs.length;
      }
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      selectView(VIEWS[next].id, { moveFocus: true, announceChange: true });
    });
  });
}

/* --- Presentation mode ------------------------------------------ */

// Every shortcut has a row in the always-visible legend, because an
// undiscoverable shortcut is not a feature.
function presentableRoles() {
  return Model.allRoles();
}

function currentPresentRole() {
  const roles = presentableRoles();
  return roles[Math.min(state.presentRoleIndex, roles.length - 1)];
}

function updateLegendRole() {
  const role = currentPresentRole();
  document.getElementById("dpsLegendRole").textContent = role.name;
}

function setPresentation(on) {
  state.present = on;
  document
    .getElementById("dpsApp")
    .classList.toggle("dps-app--present", on);
  const button = document.getElementById("dpsPresent");
  button.setAttribute("aria-pressed", on ? "true" : "false");
  button.textContent = on ? "Leave presentation mode" : "Presentation mode";

  if (on) {
    selectView("configure");
    updateLegendRole();
    document.getElementById("dps-main").focus();
  }
  fitFrameToPane(true);
  announce(
    on
      ? "Presentation mode on. Arrow keys change colours and roles, Escape leaves."
      : "Presentation mode off."
  );
}

/**
 * One keystroke, one announcement, through the existing write-if-
 * changed guard - a silent mode change is worse than a doubled one.
 */
function handlePresentationKey(event) {
  if (!state.present) return;
  const tag = (event.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;

  const roles = presentableRoles();
  const key = event.key;

  if (key === "Escape") {
    event.preventDefault();
    setPresentation(false);
    document.getElementById("dpsPresent").focus();
    return;
  }

  if (key === "ArrowLeft" || key === "ArrowRight") {
    event.preventDefault();
    cycleRole(currentPresentRole().id, key === "ArrowLeft" ? -1 : 1);
    return;
  }

  if (key === "ArrowUp" || key === "ArrowDown") {
    event.preventDefault();
    const step = key === "ArrowUp" ? -1 : 1;
    state.presentRoleIndex =
      (state.presentRoleIndex + step + roles.length) % roles.length;
    updateLegendRole();
    const role = currentPresentRole();
    const record = lastDerived ? lastDerived.byId[role.id] : null;
    announce(
      "Role: " +
        role.name +
        (record ? ", currently " + record.paletteName : "") +
        "."
    );
    return;
  }

  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    if (index >= Model.STATUSES.length) return;
    event.preventDefault();
    const status = Model.STATUSES[index];
    state.statusId = status.id;
    // Through the shared sync, not one host by hand - a keyboard
    // shortcut that moved only the rail is exactly the silent drift
    // the second control makes possible.
    syncStatusChoice();
    recomputeAndRepaint();
    announce(
      "Showing " + (state.statusLabels[status.id] || status.label) + "."
    );
    return;
  }

  if (key === "s" || key === "S") {
    event.preventDefault();
    const modes = window.ContrastCardsCVD.getModes();
    const next =
      modes[(modes.indexOf(state.simulation) + 1) % modes.length];
    state.simulation = next;
    const select = document.getElementById("dpsSimulation");
    if (select) select.value = next;
    recomputeAndRepaint();
    announce(
      "Simulation: " + window.ContrastCardsCVD.describeMode(next).label + "."
    );
    return;
  }

  if (key === "g" || key === "G") {
    event.preventDefault();
    state.overlays.caps = !state.overlays.caps;
    const box = document.getElementById("dpsOverlayCaps");
    if (box) box.checked = state.overlays.caps;
    recomputeAndRepaint();
    announce(
      state.overlays.caps
        ? "Cap-height rules shown."
        : "Cap-height rules hidden."
    );
  }
}

/* --- Badge controls ---------------------------------------------- */

function buildBadgeControls() {
  const padY = document.getElementById("dpsBadgePadY");
  const padX = document.getElementById("dpsBadgePadX");
  padY.value = state.badge.padY;
  padX.value = state.badge.padX;

  padY.addEventListener("input", () => {
    const value = Number(padY.value);
    if (!Number.isFinite(value) || value < 0) return;
    state.badge.padY = value;
    recomputeAndRepaint();
  });
  padX.addEventListener("input", () => {
    const value = Number(padX.value);
    if (!Number.isFinite(value) || value < 0) return;
    state.badge.padX = value;
    recomputeAndRepaint();
  });

  const styleHost = document.getElementById("dpsBadgeStyle");
  styleHost.textContent = "";
  Model.BADGE_STYLES.forEach((style) => {
    const wrap = document.createElement("div");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "dpsBadgeStyle";
    input.id = "dpsBadgeStyle-" + style.id;
    input.checked = style.id === state.badge.style;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.badge.style = style.id;
      // The pool depends on the gate and the gate depends on the
      // style, so the cached fill-gate table must be rebuilt.
      fillGateCacheKey = "";
      recomputeAndRepaint();
      announce(
        "Badge style: " +
          style.label +
          ". " +
          (style.id === Model.BADGE_STYLE_OUTLINED
            ? "The status colour is now text on the page, so it takes the text ladder rather than the fill gate."
            : "The status colour is a fill again, so it takes the fill gate.")
      );
    });
    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.style.display = "inline";
    label.textContent = " " + style.label + " - " + style.note;
    wrap.appendChild(input);
    wrap.appendChild(label);
    styleHost.appendChild(wrap);
  });

  const shapeHost = document.getElementById("dpsBadgeShape");
  shapeHost.textContent = "";
  Model.BADGE_SHAPES.forEach((shape) => {
    const wrap = document.createElement("div");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "dpsBadgeShape";
    input.id = "dpsBadgeShape-" + shape.id;
    input.checked = shape.id === state.badge.shape;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.badge.shape = shape.id;
      recomputeAndRepaint();
      announce("Badge shape: " + shape.label + ".");
    });
    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.style.display = "inline";
    label.textContent = " " + shape.label;
    wrap.appendChild(input);
    wrap.appendChild(label);
    shapeHost.appendChild(wrap);
  });

  const border = document.getElementById("dpsBadgeBorder");
  border.textContent = "";
  Model.BADGE_BORDER_MODES.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode.id;
    option.textContent = mode.label;
    border.appendChild(option);
  });
  border.value = state.badge.borderMode;
  border.addEventListener("change", () => {
    state.badge.borderMode = border.value;
    fillGateCacheKey = "";
    recomputeAndRepaint();
    // How many borders the CURRENT scheme actually draws, not what the setting
    // is called - under auto on a well-chosen scheme that is zero, and
    // "automatic" alone would leave a listener guessing which.
    const drawn = Model.STATUSES.filter((status) =>
      borderOnFor(state.colours["status-fill-" + status.id])
    ).length;
    announce(
      "Badge border set to " + border.value + ". " + drawn + " of " +
        Model.STATUSES.length + " statuses draw one at these colours."
    );
  });

  const thickness = document.getElementById("dpsBadgeBorderMm");
  thickness.value = state.badge.borderMm;
  thickness.addEventListener("input", () => {
    const value = Number(thickness.value);
    if (!Number.isFinite(value) || value <= 0) return;
    state.badge.borderMm = value;
    recomputeAndRepaint();
  });

  const colour = document.getElementById("dpsBadgeBorderColour");
  colour.textContent = "";
  const auto = document.createElement("option");
  auto.value = Model.BADGE_BORDER_AUTO;
  auto.textContent =
    "Automatic - black or white, whichever holds up better against both the fill and the page";
  colour.appendChild(auto);
  state.palette.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.hex;
    option.textContent = entry.name + " " + entry.hex;
    colour.appendChild(option);
  });
  colour.value = state.badge.borderColour;
  colour.addEventListener("change", () => {
    state.badge.borderColour = colour.value;
    fillGateCacheKey = "";
    recomputeAndRepaint();
    announce("Badge border colour set.");
  });
}

/**
 * The pool and the gate under EACH style, side by side.
 *
 * Printed together rather than one at a time on purpose: if the two
 * rows ever agree, the style is not wired to the gate, and that is the
 * same conflation that made the fill-gate switch look inert in
 * iteration 3. A reader can see the wiring working.
 */
/**
 * THREE LOOKS, NOT TWO. A border is not a decoration on the filled
 * style; it changes what a colour must clear to enter the pool at all,
 * so filled-with-a-border is a third thing and is listed as one.
 *
 * The table's own rows are the argument. Each states, in words, the
 * rule that decides membership - not a gate figure that happens to be
 * lying about beside it - because for the bordered look those two are
 * DIFFERENT, and printing the figure alone is how this was mis-stated
 * in the first place.
 */
const BADGE_LOOKS = Object.freeze([
  Object.freeze({
    id: "filled",
    label: "Filled",
    style: BADGE_STYLE_FILLED,
    borderMode: "never",
    rule: "the fill itself carries the badge's edge, so it must clear the fill gate against the page background",
    ruleIsGate: true,
    wordCheck: "separately - the word is measured against every fill and a shortfall is reported as a Contrast finding",
  }),
  Object.freeze({
    id: "outlined",
    label: "Outlined",
    style: BADGE_STYLE_OUTLINED,
    borderMode: "never",
    rule: "the colour IS the word and its ring on the page, so it must clear the text ladder at the status word's own cap height",
    ruleIsGate: true,
    wordCheck: "here, by construction - the pool gate and the word's gate are the same measurement, because the colour and the word are the same ink",
  }),
  Object.freeze({
    id: "filled-border",
    label: "Filled + border",
    style: BADGE_STYLE_FILLED,
    borderMode: "always",
    rule: "a DISJUNCTION - the fill clears 3:1 against the page OR the border does, and a border only counts when it is legible against both the page and the fill it outlines. The fill's own contrast is not required, which is what admits the whole palette",
    ruleIsGate: false,
    wordCheck: "separately, and this is the row where that matters - the pool admits fills the word cannot sit on, so the Contrast finding is the only thing catching them",
  }),
]);

function renderBadgeStyleReadout() {
  const probeFor = (look) => {
    const probe = cloneState(state);
    probe.badge = Object.assign({}, state.badge, {
      style: look.style,
      borderMode: look.borderMode,
    });
    return probe;
  };
  const ladderFor = (look) =>
    CHROMA_CEILING_SAMPLES.map((ceiling) => {
      const probe = probeFor(look);
      probe.chromaCeiling = ceiling;
      probe.lightnessFloor = null;
      return badgeCandidates(probe).length;
    }).join(" &middot; ");

  const showing = (look) =>
    look.style === state.badge.style &&
    look.borderMode === state.badge.borderMode;

  const rows = BADGE_LOOKS.map((look) => {
    const probe = probeFor(look);
    probe.lightnessFloor = null;
    probe.chromaCeiling = null;
    const gate = gateFor(
      { id: "status-fill-probe", kind: "status-fill" },
      0,
      probe
    );
    const gateCell = look.ruleIsGate
      ? gate.wcag + ":1, Lc " + gate.lc
      : "<strong>3:1 against the page, by the disjunction above.</strong>" +
        " The fill gate reads " + gate.wcag + ":1, Lc " + gate.lc +
        " here and <em>does not decide membership</em>";
    return (
      '<tr><th scope="row">' + escapeHtml(look.label) +
      (showing(look) ? " (showing)" : "") +
      '</th><td class="dps-num">' + badgeCandidates(probe).length +
      " of " + state.palette.length +
      "</td><td>" + escapeHtml(look.rule) +
      "</td><td>" + gateCell +
      '</td><td class="dps-num">' + ladderFor(look) +
      "</td><td>" + escapeHtml(look.wordCheck) + "</td></tr>"
    );
  }).join("");

  document.getElementById("dpsBadgeStyleReadout").innerHTML =
    '<table><caption>What each look asks of the colour. Three rows, because a border rewrites the membership rule rather than decorating it - and the rows must differ, or a look is not reaching its gate.</caption><thead><tr><th scope="col">Look</th><th scope="col">Colours that qualify</th><th scope="col">What a colour must clear to enter</th><th scope="col">Gate figures</th><th scope="col">Pool at each ceiling (off to 30)</th><th scope="col">Where the word\'s own legibility is enforced</th></tr></thead><tbody>' +
    rows +
    "</tbody></table>" +
    renderAutoBorderNote() +
    renderBorderDenyCase() +
    '<p class="dps-hint">A colour joins a list only if it passes <em>both</em> halves of that look\'s test. The outlined list comes to the same size whichever half you count, and that is a <strong>fluke of these 45 colours</strong>. Lc 60 and 4.5:1 are not the same test. On another palette they would give different answers.</p>' +
    '<p class="dps-hint">Outlined uses less <em>colour</em>, not less <em>room</em>. The badge box is the same size either way, at the same letter height and the same padding, so outlined frees no space for the booking title. Those are two problems, and one number cannot answer both.</p>';
}

/**
 * WHERE AUTO SITS IN THAT TABLE - the sentence a reader would otherwise have
 * to infer, and would infer wrongly.
 *
 * The table's three rows are what each LOOK asks of a colour. Auto is not a
 * fourth look: it is a rule for which look each fill gets, decided per fill.
 * Because auto keeps a border available for any fill that needs one, ADMISSION
 * is the bordered row's disjunction - auto and always admit the same colours.
 * What auto changes is only what is DRAWN, and the count of borders actually
 * drawn is the figure worth reading, so it is measured here rather than
 * described.
 */
function renderAutoBorderNote() {
  const mode = state.badge.borderMode;
  const drawn = Model.STATUSES.filter((status) =>
    borderOnFor(state.colours["status-fill-" + status.id])
  );
  return (
    '<p class="dps-hint"><strong>Where automatic sits in that table.</strong> ' +
    "Automatic is not a fourth look - it decides, per fill, which of the three a status gets. A fill that already clears " +
    Model.WCAG_FLOORS.GRAPHICAL + ":1 and Lc " + fillGateMode().lc +
    " against the page carries its own edge and is drawn plain; only a fill that misses that gate is given a border. " +
    "<strong>So automatic does not shrink the pool.</strong> Admission is the bordered row's disjunction, because a border stays available for anything that needs one &mdash; automatic and always admit the same colours and differ only in what is drawn. Only <em>never</em> shrinks the pool, back to the fills that carry their own edge. " +
    "At this scheme, with the border set to <strong>" + escapeHtml(mode) +
    "</strong>, <strong>" + drawn.length + " of " + Model.STATUSES.length +
    "</strong> statuses draw a border" +
    (drawn.length
      ? ": " + drawn.map((s) => escapeHtml(s.label)).join(", ")
      : " &mdash; every fill carries its own edge") + ".</p>"
  );
}

/**
 * THE DENY CASE for the bordered pool, computed rather than asserted.
 *
 * The bordered look admits the whole palette on the boundary
 * disjunction, and the status word is a FIXED colour - not chosen per
 * fill - so there is no adaptive-text construction that could make the
 * admission safe. Some admitted fills therefore cannot carry the word,
 * and the mid-tone ones cannot carry EITHER a dark or a light word.
 * They are caught downstream, in the findings, and this counts them so
 * that "caught downstream" is a figure rather than a reassurance.
 */
function renderBorderDenyCase() {
  const probe = cloneState(state);
  probe.chromaCeiling = null;
  probe.lightnessFloor = null;
  probe.badge = Object.assign({}, state.badge, {
    style: Model.BADGE_STYLE_FILLED,
    borderMode: "always",
  });
  const ink = state.colours["status-text"];
  const gate = gateFor(
    Model.roleById("status-text"),
    state.caps["status-text"] || 0,
    probe
  );
  const clears = (textHex, fillHex) => {
    const measured = Engine.contrastPair(textHex, fillHex);
    return measured.wcag >= gate.wcag && measured.lc >= gate.lc;
  };
  const pool = badgeCandidates(probe).map((index) => state.palette[index]);
  const failsWord = pool.filter((colour) => !clears(ink, colour.hex));
  const failsEither = failsWord.filter(
    (colour) => !clears("#ffffff", colour.hex)
  );
  const worst = failsEither[0];
  const worstDark = worst ? Engine.contrastPair(ink, worst.hex) : null;
  const worstLight = worst
    ? Engine.contrastPair("#ffffff", worst.hex)
    : null;

  const worstClause = worst
    ? " &mdash; the mid-tone worst case is " + swatchHtml(worst.hex) +
      escapeHtml(worst.name) + " " + escapeHtml(worst.hex) +
      ", where the dark word reads " + worstDark.wcag +
      ":1 but only Lc " + worstDark.lc +
      ", and a white word reads only " + worstLight.wcag + ":1"
    : "";
  return (
    '<p class="dps-hint"><strong>The deny case, and where it lands.</strong> ' +
    "The bordered pool admits " + pool.length + " of " +
    state.palette.length + " colours. Of those, <strong>" +
    failsWord.length +
    "</strong> cannot carry the status word at its gate of " +
    gate.wcag + ":1 and Lc " + gate.lc + ", and <strong>" +
    failsEither.length + "</strong> cannot carry it in either polarity" +
    worstClause +
    ". The word is a <strong>fixed</strong> colour here, not chosen per fill, so no adaptive-text construction rescues them. " +
    "Nothing stops such a fill being selected; the pool is a question about the badge's EDGE and answers only that. " +
    "The word is caught one layer later, as a Contrast finding measured against every fill on the panel &mdash; which is why a bordered badge must never be read as having passed the word's gate by entering the pool.</p>"
  );
}

/** Saturated area, per status. Reported; never scored. */
function renderBadgeAreaReadout(fit) {
  const host = document.getElementById("dpsBadgeAreaReadout");
  const saturation = fit ? fit.saturation : null;
  if (!saturation) {
    host.innerHTML =
      "<p>Not measured — the status word has no rendered size yet.</p>";
    return;
  }

  const rows = saturation.perStatus
    .map(
      (entry) =>
        '<tr><th scope="row">' +
        swatchHtml(entry.hex) +
        escapeHtml(entry.label) +
        '</th><td class="dps-num">' +
        Engine.round(entry.chroma, 1) +
        '</td><td class="dps-num">' +
        Engine.round(entry.share * 100, 1) +
        '%</td><td class="dps-num">' +
        Engine.round(entry.inkAreaMm2, 0) +
        '</td><td class="dps-num">' +
        Engine.round(entry.weighted * 100, 1) +
        "</td></tr>"
    )
    .join("");

  const worst = saturation.worst;
  host.innerHTML =
    '<table><caption>Panel area carried by each status colour, at the badge\'s current size, weighted by that colour\'s LCH chroma. The panel is ' +
    Engine.round(saturation.panelAreaMm2, 0) +
    " square millimetres.</caption><thead><tr><th scope=\"col\">Status</th><th scope=\"col\">Chroma</th><th scope=\"col\">Share of panel</th><th scope=\"col\">Area (mm²)</th><th scope=\"col\">Chroma x share</th></tr></thead><tbody>" +
    rows +
    "</tbody></table>" +
    (worst
      ? "<p>" +
        escapeHtml(worst.label) +
        " is the heaviest of the three: " +
        Engine.round(worst.share * 100, 1) +
        "% of the panel at chroma " +
        Engine.round(worst.chroma, 1) +
        ". <strong>That is a measurement, not a verdict.</strong> Neither the guidance nor WCAG sets a limit on how much of a panel may be strong colour, so there is nothing here to pass or fail. Two things move it: a shorter word, and the outlined badge style" +
        (saturation.outlined ? ", which is showing now" : "") +
        ". Switching style on this same status moves it to " +
        Engine.round(worst.otherStyleShare * 100, 1) +
        "%, a " +
        Engine.round(
          worst.otherStyleShare > 0
            ? worst.share / worst.otherStyleShare
            : 0,
          1
        ) +
        "-fold change — computed here, not quoted. Neither changes the badge's <em>box</em>, so neither helps the booking title's fit — that is a different problem with a different lever.</p>"
      : "");
}

function refreshBadge(derived) {
  const badge = derived.badge;
  document.getElementById("dpsBadgePadReadout").textContent =
    "At the status word's current size that is " +
    mmText(badge.padYmm) +
    " above and below, and " +
    mmText(badge.padXmm) +
    " each side - against a panel " +
    state.geometry.panelHmm +
    " mm tall.";

  const rows = badge.perStatus
    .map((entry) => {
      const boundary = entry.boundary;
      return (
        '<tr><th scope="row">' +
        swatchHtml(entry.hex) +
        escapeHtml(entry.label) +
        '</th><td class="dps-num">' +
        boundary.fillVsPage.wcag +
        "</td><td>" +
        (boundary.borderOn
          ? swatchHtml(boundary.borderHex) +
            boundary.borderVsPage.wcag +
            " / " +
            boundary.borderVsFill.wcag
          : "no border") +
        "</td><td>" +
        verdictHtml(boundary.ok) +
        " " +
        escapeHtml(boundary.via) +
        "</td></tr>"
      );
    })
    .join("");

  document.getElementById("dpsBadgeBorderReadout").innerHTML =
    "<table><caption>The badge edge, per status. The rule is a disjunction: the fill clears " +
    Model.WCAG_FLOORS.GRAPHICAL +
    ":1 against the page, OR the border does - and a border only counts when it is legible against BOTH the page and the fill it outlines.</caption><thead><tr><th scope=\"col\">Status</th><th scope=\"col\">Fill vs page</th><th scope=\"col\">Border vs page / vs fill</th><th scope=\"col\">Edge</th></tr></thead><tbody>" +
    rows +
    "</tbody></table>" +
    (badge.borderOn
      ? "<p class=\"dps-hint\">Border " +
        mmText(badge.borderMm) +
        ", which is " +
        Engine.round(badge.borderEffectivePx, 2) +
        " effective pixels at " +
        state.geometry.distanceMm +
        " mm.</p>"
      : "");
}

/* --- Boot ------------------------------------------------------ */

function init() {
  // ENGINE GUARD. A sibling page (the Door Panel Guide) loads this file
  // for its exported engine and carries none of the studio's markup, so
  // booting the studio UI there would dereference elements that do not
  // exist. The panel frame is the studio's own root; its absence means
  // this is an engine-only load, and everything on window.DoorPanelStudio
  // stays available. This bail runs FIRST - even the chroma warning
  // below writes to a studio element.
  if (!document.getElementById("dpsPanel")) {
    logInfo(
      "Door Panel Studio markup absent - engine-only load, page boot skipped"
    );
    return;
  }

  if (typeof chroma === "undefined") {
    document.getElementById("dpsChromaWarning").hidden = false;
    logError("chroma.js is absent - no measurement is possible");
    return;
  }

  window.ContrastCardsCVD.buildSVGFilters();

  applyAsBuiltColours();
  applyAsBuiltSizes();

  buildRoleControls();
  buildContentControls();
  buildBadgeControls();
  setupTabs();
  // Deterministic opening view, named rather than inherited from whatever
  // the markup happened to say - the mode-switcher invariant.
  selectView(DEFAULT_VIEW);
  if (coverageRequested()) applyCoverageState();
  buildFillGateChoice();
  buildApproachControl();
  buildChromaControl();
  buildDesignForControl();
  buildSchemeControl();
  buildStatusChoice();
  buildSimulationSelect();
  wireGeometry();
  wireFrameControls();
  wirePresets();
  wirePalette();
  wireVerification();

  document
    .getElementById("dpsPresent")
    .addEventListener("click", () => setPresentation(!state.present));
  document.addEventListener("keydown", handlePresentationKey);

  window.addEventListener("resize", () => {
    fitFrameToPane();
    if (lastDerived) paintOverlays(lastDerived);
  });

  // Open on the panel the guidance argues for, not the one that fails
  // nearly every gate. Silent - this is the initial set, not a change
  // - and the as-built panel is one button away. It runs after the
  // controls are built because it pushes its values back into them.
  applyRecommendedPanel();

  recomputeAndRepaint();
  // Twice on purpose: the first pass gives fitFrameToPane a derived
  // object to read the legibility floor from, the second applies the
  // height it chose.
  fitFrameToPane();
  logInfo("Door Panel Studio ready");
}

// Exposed for console checking. Everything here is read-only in
// practice: the page drives itself through recomputeAndRepaint.
window.DoorPanelStudio = {
  Engine: Engine,
  Model: Model,
  state: state,
  derive: derive,
  cloneState: cloneState,
  buildFindings: buildFindings,
  availabilityFor: availabilityFor,
  measureRole: measureRole,
  badgeCandidates: badgeCandidates,
  separationMatrix: separationMatrix,
  gateFor: gateFor,
  bindingModes: bindingModes,
  bindingSetLabel: bindingSetLabel,
  enumerateSets: (...a) => Checks.enumerateSets(...a),
  crossModeChecks: (...a) => Checks.crossModeChecks(...a),
  checkEnumerationBaselines: (...a) => Checks.checkEnumerationBaselines(...a),
  get ENUMERATION_BASELINE_MODES() { return Checks.ENUMERATION_BASELINE_MODES; },
  badgeBoundaryFor: badgeBoundaryFor,
  borderOnFor: borderOnFor,
  badgeAdmitsBorder: badgeAdmitsBorder,
  fillCarriesItsOwnEdge: fillCarriesItsOwnEdge,
  badgeBorderColourFor: badgeBorderColourFor,
  applyScheme: applyScheme,
  selectView: selectView,
  setPresentation: setPresentation,
  measureFit: measureFit,
  measureWidth: measureWidth,
  measureHeight: measureHeight,
  paintPanel: paintPanel,
  renderGallery: renderGallery,
  buildGalleryCandidates: buildGalleryCandidates,
  commentaryFor: commentaryFor,
  scoreFindings: scoreFindings,
  applySizeScheme: applySizeScheme,
  renderFillGate: renderFillGate,
  fillGateMode: fillGateMode,
  contentFor: contentFor,
  runGeometryCanary: (...a) => Checks.runGeometryCanary(...a),
  runSolverCanary: (...a) => Checks.runSolverCanary(...a),
  runRenderCanary: (...a) => Checks.runRenderCanary(...a),
  recomputeAndRepaint: recomputeAndRepaint,
  buildEvidencePayload: buildEvidencePayload,
  getLastGallery: () => lastGallery,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

  // The bridge. Values and stable references pass directly; the one mutable
  // binding the harness reads (lastDerived, reassigned on every repaint) goes
  // through an accessor, because a destructured copy would freeze at load.
  window.DoorPanelStudioInternals = {
    BADGE_LOOKS: BADGE_LOOKS,
    CHROMA_CEILING_SAMPLES: CHROMA_CEILING_SAMPLES,
    Engine: Engine,
    Model: Model,
    SHORT_VIEWPORT_QUERY: SHORT_VIEWPORT_QUERY,
    announce: announce,
    badgeCandidates: badgeCandidates,
    bindingModeFor: bindingModeFor,
    bindingSetLabel: bindingSetLabel,
    clampCapForRole: clampCapForRole,
    cloneState: cloneState,
    derive: derive,
    escapeHtml: escapeHtml,
    gateFor: gateFor,
    logError: logError,
    measureBox: measureBox,
    paintPanel: paintPanel,
    readingDepartures: readingDepartures,
    separationMatrix: separationMatrix,
    state: state,
    surfaceElement: surfaceElement,
    swatchHtml: swatchHtml,
    verdictHtml: verdictHtml,
    getLastDerived: () => lastDerived,
  };
})();
