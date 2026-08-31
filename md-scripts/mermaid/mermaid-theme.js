/**
 * Mermaid Theme Management
 * Provides theme switching and custom theme support for Mermaid diagrams
 * with focus on digital accessibility and meeting WCAG 2.2 AA standards
 */
window.MermaidThemes = (function () {
  // Logging configuration
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur based on current level
   * @param {number} level - Log level to check
   * @returns {boolean} True if logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Themes Error] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Themes Warning] ${message}`, ...args);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Themes Info] ${message}`, ...args);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Themes Debug] ${message}`, ...args);
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - New logging level
   */
  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        )}`
      );
    } else {
      logWarn(`Invalid log level: ${level}`);
    }
  }

  // Theme configuration
  const themeConfig = {
    // Default themes to use based on site theme
    // Default themes to use based on site theme.
    //
    // BOTH are the accessible pair deliberately, changed 25 August 2026. The
    // dark default was the `dark` BUILT-IN, whose palette this repo cannot
    // reach through themeVariables: two of its ten entries sit below 3:1
    // against its own #333 ground (#34495e at 1.36:1, #9b59b6 at 2.71:1), and a
    // line series landing on either cannot be lifted by the CSS outline, because
    // a line has no fill and its palette colour IS its stroke. It also puts a
    // red and a green adjacent in series order, which is the CVD collision the
    // design seat's screenshots show.
    //
    // Changing the DEFAULT is not the same as removing a theme. Every built-in
    // stays in the selector, so the failure recorded as item 53 in
    // docs/mermaid-outstanding.md is now opt-in rather than what a dark-mode
    // user is handed.
    defaultThemes: {
      light: "accessibleLight", // Default theme for light mode
      dark: "accessibleDark", // Default theme for dark mode
    },

    // Control which themes appear in the selector
    // Set to true to show in selector, false to hide
    visibleThemes: {
      // Built-in themes
      default: true,
      neutral: true,
      dark: true,
      forest: true,

      // Custom themes
      wcagLight: true,
      accessibleLight: true,
      accessibleDark: true,
      highContrastLight: true,
      highContrastDark: true,
      blueAccent: true, // Add your new theme here
    },
    modeVisibleThemes: {
      light: [
        "default",
        "neutral",
        "forest",
        "accessibleLight",
        "highContrastLight",
        "wcagLight",
      ],
      dark: ["dark", "accessibleDark", "highContrastDark"],
    },
  };

  // Built-in themes available in Mermaid
  const builtInThemes = [
    { id: "default", name: "Mermaid" },
    { id: "neutral", name: "Neutral" },
    { id: "dark", name: "Dark" },
    { id: "forest", name: "Forest" },
  ];

  // Define base colours for accessibility calculations
  const accessibleBaseColors = {
    darkMode: {
      canvasColor: "#1E1E1E",
      textColor: "#FFFFFF",
      accentColor: "#6082B6", // Proper blue for dark mode
    },
    lightMode: {
      canvasColor: "#FFFFFF",
      textColor: "#333333",
      accentColor: "#1E56A0", // Proper blue for light mode
    },
  };

  /**
   * xychart-beta series palettes, one per theme ground.
   *
   * Mermaid exposes exactly ONE string for all series colour
   * (themeVariables.xyChart.plotColorPalette) and hard-codes the bar outline to
   * `strokeWidth: 0`, so a palette is the only colour lever a theme has here.
   * Before this block existed no theme in this repo set any xyChart variable at
   * all, so every custom theme fell through to Mermaid's `base` default palette
   * — of which one entry in ten cleared 3:1 on white. The first bar series
   * measured 1.09:1, in "High Contrast Light" among others.
   *
   * Derived from the Chart.js palettes in md-scripts/charts/chart-controls.js so
   * the two engines' charts read as one system: light grounds take the "Okabe
   * and Ito" borderColor list, dark grounds "Paul Tol Bright", both as
   * full-opacity FILLS. Entries that failed the target against their ground were
   * darkened (light) or lightened (dark) in HSL with hue and saturation held, to
   * the first value clearing it with margin. Every substitution and its
   * before/after ratio is recorded in
   * docs/mermaid-xychart-svg-theming-fix-2026-08-25.md § 2.
   *
   * Why every entry must clear the bar on its own: a LINE series has no fill, so
   * its palette colour IS its stroke, and the CSS outline in light.css/dark.css
   * changes a line's stroke-width but never its colour. A palette entry that
   * leans on the outline would be correct for bars and still fail for lines.
   */
  /**
   * ORDER IS LOAD-BEARING, and it is not the order these palettes shipped in.
   *
   * Series colour is assigned by walking this list, so consecutive entries land
   * on adjacent series. Reordered 25 August 2026 to alternate the palette's
   * darker and lighter halves — sort by relative luminance, then interleave
   * dark/light/dark/light — so neighbouring series differ in LIGHTNESS and not
   * only in hue. Reordering cannot change any entry's ratio against the chart
   * ground, so every figure in the 25 August fix report still holds.
   *
   * Measured improvement in adjacent-pair contrast (minimum across the six
   * pairs, then mean):
   *
   *   dark               min 1.04 -> 1.58,  mean 1.91 -> 2.35
   *   darkHighContrast   min 1.01 -> 1.58,  mean 1.76 -> 2.22
   *   light              min 1.00 -> 1.00,  mean 1.18 -> 1.19
   *   lightHighContrast  min 1.00 -> 1.00,  mean 1.04 -> 1.02
   *
   * THE LIGHT PALETTES CANNOT BE HELPED BY ANY ORDERING, and that is a proof
   * rather than an observation: an exhaustive search of all 5,040 orderings of
   * seven entries gives a best-possible adjacent-pair minimum of 1.06 for
   * `light` and 1.01 for `lightHighContrast`. The cause is self-inflicted and
   * unavoidable — every entry was tuned to clear the SAME ratio against the
   * SAME white ground, which forces their luminances together. The dark
   * palettes reach 1.58 against a ceiling of 1.69 and 1.68, i.e. 94% of what is
   * achievable.
   *
   * This is the argument for the pattern fills in applySeriesEncoding(): on a
   * light ground, lightness is exhausted as a channel and only texture is left.
   * Pairwise 3:1 across seven series is unreachable and is not a WCAG
   * requirement — SC 1.4.11 asks about the object against its background, which
   * every entry already satisfies.
   */
  const XYCHART_PALETTES = Object.freeze({
    // Okabe and Ito, every entry >= 3.2:1 against #FFFFFF
    light: "#0072B2,#CA74A4,#D55E00,#9C920C,#009E73,#BF8400,#1D97DC",
    // Okabe and Ito, every entry >= 4.7:1 against #FFFFFF
    lightHighContrast: "#0072B2,#177AB2,#008360,#BE5400,#7D750A,#BA4B89,#9A6A00",
    // Paul Tol Bright, every entry >= 3.2:1 against #1E1E1E
    dark: "#BC3883,#66CCEE,#4477AA,#BBBBBB,#228833,#CCBB44,#EE6677",
    // Paul Tol Bright, every entry >= 4.7:1 against #000000
    darkHighContrast: "#C74690,#66CCEE,#467BAF,#BBBBBB,#228A34,#CCBB44,#EE6677",
  });

  /**
   * Marker Mermaid sets on an xychart diagram root and on nothing else.
   *
   * Every query in applySeriesEncoding() is scoped through this. A bare
   * `querySelector("svg")` on a container can return a CONTROL BUTTON'S 16x16
   * icon once controls exist — that trap cost the grounding session a false
   * reading, where a probe reported the diagram SVG empty having measured a
   * button icon. Matching the roledescription makes a button icon unmatchable
   * by construction rather than by exclusion.
   */
  const XYCHART_ROLEDESCRIPTION = "xychart";

  /**
   * Pattern vocabulary, mirroring the Chart.js names in
   * md-scripts/charts/chart-controls.js one-for-one so the two engines read as
   * one system. Chart.js lists `solid` first; here the FIRST bar series is left
   * unpatterned instead, so this list starts at the second.
   */
  const SERIES_PATTERNS = Object.freeze([
    "lines",
    "dots",
    "diagonal",
    "crosses",
    "crosshatch",
  ]);

  /**
   * Dash vocabulary, taken from the same file's `borderDash` list with its
   * leading `[]` (solid) dropped for the same reason.
   */
  const SERIES_DASHES = Object.freeze([
    "5,5",
    "2,2",
    "15,3,3,3",
    "10,5,2,5",
    "3,3,10,3",
  ]);

  /** Tile size for every pattern, in user units. */
  const PATTERN_TILE = 8;

  /**
   * How much wider a line's casing is than the line itself, in user units.
   * Four gives a 2-unit halo on each side, which is enough to separate a line
   * from a patterned bar without the halo reading as a second line.
   */
  const CASING_EXTRA_WIDTH = 4;

  /**
   * Single-point marker radius, as a multiple of the line's own stroke width.
   * At the 3px lines this repo sets in light.css/dark.css that is r=6, a 12-unit
   * disc on a 700x500 chart — large enough to find without implying a data band.
   * Derived from the stroke rather than fixed so it tracks any future width
   * change rather than silently going out of proportion.
   */
  const MARKER_RADIUS_MULTIPLE = 2;

  /** Casing width for the single-point marker's own outline, in user units. */
  const MARKER_STROKE_WIDTH = 2;

  /** Attributes marking elements this pass owns, so the sweep can rebuild them. */
  const CASING_ATTRIBUTE = "data-xychart-casing";
  const MARKER_ATTRIBUTE = "data-xychart-marker";

  /** The two inks a pattern may use; whichever contrasts better with the fill wins. */
  const PATTERN_INKS = Object.freeze(["#FFFFFF", "#00131D"]);

  // ==========================================================================
  // GANTT ENCODING — findings G3 to G7, 30 August 2026
  //
  // Same shape as the xychart work above and for the same reason: no theme in
  // this repo set a gantt variable except wcagLight, so eight of the nine
  // selectable theme/mode combinations fell through to Mermaid's own gantt
  // palette. Measured before any change, on a five-state chart driven through
  // the real theme selector: the four bar states `plain`, `done`, `active` and
  // `crit` are byte-identical in every non-colour channel, and four bars are
  // left with neither a fill nor an outline clearing 3:1 against the band they
  // sit on. The state is carried by colour and by nothing else.
  //
  // THREE MECHANISMS DECIDED THE DESIGN, all read out of the rendered SVG
  // rather than assumed. They are recorded here because each one makes the
  // obvious implementation wrong.
  //
  //  1. THE BANDS ARE 20% OPAQUE. Mermaid's in-SVG block carries
  //     `.section { stroke:none; opacity:0.2 }`, so a band's DECLARED fill is
  //     never the colour anything sits on. There are two declared fills per
  //     theme and two COMPOSITED grounds, and the composite is what an outline
  //     has to clear. Deriving against the declaration would have produced
  //     confident wrong numbers in all nine cells.
  //
  //  2. EVERY WRITE MUST BE AN INLINE STYLE. Mermaid's block sets
  //     `.task { stroke-width:2 }`, `.done0 { stroke:grey; fill:lightgrey }`,
  //     `.today { stroke:red; stroke-width:2px }` and more, as CLASS rules — and
  //     a presentation attribute is the weakest source in the cascade, so an
  //     attribute write is inert. This is the xychart casing lesson (§ 14.18)
  //     arriving at a second diagram type.
  //
  //  3. LABEL FILLS ADDITIONALLY NEED `!important`. `.activeText0`,
  //     `.doneText0`, `.activeCritText0` and `.doneCritText0` are declared
  //     `fill:#000000!important` in that same block, so even an inline style
  //     loses to them. Only an inline style carrying its own `important`
  //     priority wins. Written that way for EVERY label, not only the four, so
  //     no future Mermaid release can silently reclaim one.
  // ==========================================================================

  /** Marker Mermaid sets on a gantt diagram root and on nothing else. */
  const GANTT_ROLEDESCRIPTION = "gantt";

  /** SC 1.4.11 for outlines, boundaries and the today marker. */
  const GANTT_OBJECT_TARGET = 3;

  /** SC 1.4.3 for every bar label. */
  const GANTT_TEXT_TARGET = 4.5;

  /**
   * Non-colour channel per task state. `plain` is the unmarked case and
   * `milestone` is already shape-distinct through Mermaid's own
   * `.milestone { transform: rotate(45deg) scale(0.8,0.8) }`, so neither takes
   * a channel here — adding one would only blur what the other three mean.
   *
   * The three that DO take one are separated on three DIFFERENT axes — texture,
   * dash and weight — rather than three variants of one axis, so no pair
   * depends on a reader judging a quantity.
   */
  const GANTT_STATE_ENCODING = Object.freeze({
    plain: { width: 2, dash: null, pattern: null },
    done: { width: 2, dash: null, pattern: "diagonal" },
    active: { width: 2, dash: "4,3", pattern: null },
    crit: { width: 4, dash: null, pattern: null },
    milestone: { width: 2, dash: null, pattern: null },
  });

  /**
   * Order matters: `milestone` is tested first because Mermaid writes it
   * ALONGSIDE a `task<n>` class (measured: `class="task milestone  task1"`), so
   * a plain-first test would claim the milestone as plain.
   */
  const GANTT_STATE_TESTS = Object.freeze([
    ["milestone", /(^|\s)milestone(\s|$)/],
    ["crit", /(^|\s)(crit|doneCrit|activeCrit)\d*(\s|$)/],
    ["done", /(^|\s)done\d*(\s|$)/],
    ["active", /(^|\s)active\d*(\s|$)/],
  ]);

  /** Tile size for the gantt pattern, matching the xychart vocabulary. */
  const GANTT_PATTERN_TILE = 8;

  /** Dash for the today marker, so it is never a colour-only signal. */
  const GANTT_TODAY_DASH = "6,4";

  /** Width of a synthesised section-boundary line, in user units. */
  const GANTT_BOUNDARY_WIDTH = 2;

  /** Attributes marking elements and defs this pass owns, so a re-run rebuilds them. */
  const GANTT_BOUNDARY_ATTRIBUTE = "data-gantt-boundary";
  const GANTT_DEFS_ATTRIBUTE = "data-gantt-encoding";

  /** Where a bar's ORIGINAL fill is parked, so a re-run does not read back a url(). */
  const GANTT_ORIGINAL_FILL_ATTRIBUTE = "data-gantt-fill";

  /** Where the FLAT colour a label sits on is parked - the fill after any adjustment. */
  const GANTT_PAINT_ATTRIBUTE = "data-gantt-paint";

  /**
   * Grey ramp for deriving outlines, boundaries and pattern motifs.
   *
   * A ramp rather than the two-ink set, because an outline has to clear its
   * target against BOTH of a theme's composited band grounds at once, and a
   * theme can carry one dark band and one mid band (`accessibleDark` measures
   * #2f2f34 and #585355). Seventeen steps is enough to land within one step of
   * any achievable optimum and small enough to search per element.
   */
  const GANTT_INK_RAMP = Object.freeze(
    Array.from({ length: 17 }, (unused, i) => {
      const v = Math.round((i * 255) / 16);
      return rgbToHex(v, v, v);
    })
  );

  /**
   * Geometry for one pattern tile, drawn over a ground rect of the series colour.
   * Strokes overrun the tile deliberately so the motif is continuous across tiles.
   *
   * @param {string} name - One of SERIES_PATTERNS
   * @param {string} ink - Stroke/fill colour for the motif
   * @returns {string} SVG markup for the tile's contents, ground rect excluded
   */
  function patternMotif(name, ink) {
    const s = `stroke="${ink}" fill="none" stroke-linecap="square"`;
    switch (name) {
      case "lines":
        return `<path d="M0,2 H8 M0,6 H8" ${s} stroke-width="2"/>`;
      case "dots":
        return `<circle cx="2" cy="2" r="1.4" fill="${ink}"/><circle cx="6" cy="6" r="1.4" fill="${ink}"/>`;
      case "diagonal":
        return `<path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" ${s} stroke-width="2"/>`;
      case "crosses":
        return `<path d="M4,1 V7 M1,4 H7" ${s} stroke-width="1.6"/>`;
      case "crosshatch":
        return `<path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4 M-2,6 l4,4 M0,0 l8,8 M6,-2 l4,4" ${s} stroke-width="1.4"/>`;
      default:
        return "";
    }
  }

  /**
   * Pick the ink that contrasts better with a given series fill.
   *
   * THE CHART.JS MODEL DOES NOT TRANSFER UNCHANGED, and this is where it
   * diverges. There, a series is a 20%-alpha fill with the motif drawn in the
   * full-strength series colour — the motif contrasts against a pale ground.
   * Here the bars carry FULL-STRENGTH fills, chosen to clear 3:1 against the
   * chart ground, so a motif in the series colour would be invisible on itself.
   * The motif therefore uses white or near-black, whichever is further from
   * that fill, and the fill keeps its own ground contrast unchanged.
   *
   * @param {string} fill - The series colour, as #rrggbb
   * @returns {string} One of PATTERN_INKS
   */
  function pickPatternInk(fill) {
    let best = PATTERN_INKS[0];
    let bestRatio = -1;
    PATTERN_INKS.forEach((ink) => {
      const ratio = calculateContrastRatio(ink, fill);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = ink;
      }
    });
    return best;
  }

  /**
   * The chart's own ground colour, resolved rather than assumed.
   *
   * Read from the COMPUTED fill of rect.background at pass time, so it is right
   * for whichever theme is active and re-derives on every theme change without
   * this module holding a second copy of the palette. Falls back to the
   * attribute if the SVG is detached, where getComputedStyle returns empty.
   *
   * @param {SVGElement} svg - The xychart diagram root
   * @returns {string} A colour, or "#FFFFFF" if the chart has no background rect
   */
  function resolveGroundColour(svg) {
    const background = svg.querySelector("rect.background");
    if (!background) return "#FFFFFF";

    const computed = window.getComputedStyle(background).fill;
    return computed || background.getAttribute("fill") || "#FFFFFF";
  }

  /**
   * Recover the single coordinate of a one-point line series, or null.
   *
   * MERMAID 11.6.0 RENDERS A ONE-POINT LINE SERIES AS NOTHING AT ALL, and this
   * is the signature. `line [42]` on a one-category axis emits a real path with
   * a real `d` — measured verbatim as `d="M386.4,287.4Z"` — which is a moveto
   * followed by a closepath and NO line segment. A zero-length subpath under the
   * default `stroke-linecap: butt` paints no pixels, so the plot is empty while
   * the accessible description correctly says "a single value, 42". The picture
   * says less than the words.
   *
   * Detection counts coordinates rather than matching the `M…Z` string: a path
   * carrying exactly one pair is a single point whatever punctuation d uses. The
   * two-point control measures `d="M78.301,287.4L694.5,214.5"` — four numbers —
   * and is correctly not matched.
   *
   * @param {string} d - The path's d attribute
   * @returns {{x: number, y: number}|null} The point, or null if not a single point
   */
  function singlePointOf(d) {
    if (!d) return null;

    const numbers = d.match(/-?\d+(?:\.\d+)?/g);
    if (!numbers || numbers.length !== 2) return null;

    return { x: parseFloat(numbers[0]), y: parseFloat(numbers[1]) };
  }

  /**
   * Parse any CSS colour a computed style can hand back into {r,g,b,a}.
   *
   * The existing hexToRgb takes hex only, and every value read off a rendered
   * diagram arrives as `rgb(…)` or `rgba(…)`. Returns null for `none`,
   * `transparent` and anything unparseable, so a caller can tell "no paint"
   * from "black".
   *
   * @param {string} value - A computed colour
   * @returns {{r: number, g: number, b: number, a: number}|null}
   */
  function parsePaint(value) {
    if (!value) return null;

    const text = String(value).trim();
    if (text === "none" || text === "transparent") return null;

    const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
    if (functional) {
      const parts = functional[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
      return {
        r: parts[0],
        g: parts[1],
        b: parts[2],
        a: parts.length > 3 ? parts[3] : 1,
      };
    }

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) {
      const [r, g, b] = hexToRgb(text);
      return { r, g, b, a: 1 };
    }

    return null;
  }

  /**
   * Composite a partly transparent colour over an opaque one.
   *
   * @param {{r,g,b,a}|null} top - The overlay, or null for none
   * @param {{r,g,b,a}} bottom - An opaque ground
   * @returns {{r,g,b,a}} The resulting opaque colour
   */
  function compositeOver(top, bottom) {
    if (!top || top.a <= 0) return bottom;
    if (top.a >= 1) return { r: top.r, g: top.g, b: top.b, a: 1 };

    return {
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1,
    };
  }

  /**
   * @param {{r,g,b}} colour
   * @returns {string} #rrggbb
   */
  function paintToHex(colour) {
    return rgbToHex(colour.r, colour.g, colour.b);
  }

  /**
   * The first OPAQUE background above an element, as hex.
   *
   * Identical in intent to resolveExportBackground in the export module and
   * kept separate on purpose: that one answers what a SAVED FILE should be
   * painted on, this one answers what a rendered band is composited over. They
   * agree today and are free to diverge.
   *
   * @param {Element} element - Any element in the document
   * @returns {string} #rrggbb, defaulting to white
   */
  function resolveHostGround(element) {
    let node = element;

    while (node && node.nodeType === 1) {
      const parsed = parsePaint(window.getComputedStyle(node).backgroundColor);
      if (parsed && parsed.a >= 1) return paintToHex(parsed);
      node = node.parentNode;
    }

    return "#FFFFFF";
  }

  /**
   * Pick the ink from a candidate list that maximises the WORST contrast across
   * every target it has to clear.
   *
   * Maximising the minimum rather than the mean is deliberate: an outline that
   * clears one band by 15:1 and the other by 1.2:1 is invisible on half the
   * chart, and a mean would call that a good result.
   *
   * @param {string[]} candidates - Hex colours to choose from
   * @param {string[]} targets - Hex colours the ink must contrast against
   * @param {Function} [permits] - Optional extra predicate on a candidate
   * @returns {{ink: string, worst: number}} The winner and its worst ratio
   */
  function pickInkAgainst(candidates, targets, permits) {
    let best = candidates[0];
    let bestWorst = -1;

    candidates.forEach((ink) => {
      if (permits && !permits(ink)) return;

      const worst = targets.reduce(
        (lowest, target) =>
          Math.min(lowest, calculateContrastRatio(ink, target)),
        Infinity
      );

      if (worst > bestWorst) {
        bestWorst = worst;
        best = ink;
      }
    });

    return { ink: best, worst: bestWorst };
  }

  /**
   * Every gantt band, with the ground it ACTUALLY presents once its 20% opacity
   * is composited over the page.
   *
   * @param {SVGElement} svg - The gantt diagram root
   * @param {string} pageGround - Hex ground behind the diagram
   * @returns {{rows: Array, grounds: string[]}} Per-band rows and the distinct grounds
   */
  function resolveGanttBands(svg, pageGround) {
    const base = parsePaint(pageGround) || { r: 255, g: 255, b: 255, a: 1 };

    const rows = [...svg.querySelectorAll("rect.section")].map((rect) => {
      const computed = window.getComputedStyle(rect);
      const declared = parsePaint(computed.fill);
      const alpha =
        (declared ? declared.a : 1) *
        (parseFloat(computed.fillOpacity) || 1) *
        (parseFloat(computed.opacity) || 1);

      const ground = paintToHex(
        compositeOver(declared ? { ...declared, a: alpha } : null, base)
      );

      return {
        element: rect,
        className: rect.getAttribute("class") || "",
        y: parseFloat(rect.getAttribute("y")) || 0,
        height: parseFloat(rect.getAttribute("height")) || 0,
        x: parseFloat(rect.getAttribute("x")) || 0,
        width: parseFloat(rect.getAttribute("width")) || 0,
        declaredFill: computed.fill,
        effectiveAlpha: Math.round(alpha * 1000) / 1000,
        ground,
      };
    });

    rows.sort((a, b) => a.y - b.y);

    return { rows, grounds: [...new Set(rows.map((row) => row.ground))] };
  }

  /**
   * Which of the five states a task rect is in, from its class list.
   *
   * @param {Element} rect - A rect.task
   * @returns {string} A key of GANTT_STATE_ENCODING
   */
  function ganttStateOf(rect) {
    const className = rect.getAttribute("class") || "";
    const match = GANTT_STATE_TESTS.find(([, test]) => test.test(className));
    return match ? match[0] : "plain";
  }

  /**
   * Apply the accessibility encoding to a rendered gantt chart: an outline that
   * clears its own band, a non-colour channel per state, section boundaries,
   * label inks that clear their bar, and a today marker that is not colour-only.
   *
   * WHY AN AFTER-RENDER PASS AND NOT THEME VARIABLES. Four of the nine
   * selectable theme/mode combinations are Mermaid BUILT-INS, which applyTheme
   * reaches as `{'theme': '<id>'}` with no themeVariables at all — so a variable
   * written here could never reach `default`, `neutral`, `forest` or `dark`. A
   * pass over the rendered SVG reaches all nine by construction, and derives
   * from what each theme actually produced rather than from a table that has to
   * be kept in step with it.
   *
   * IDEMPOTENT, on the xychart pattern: everything this pass owns is swept
   * first, and each bar's ORIGINAL fill is parked in an attribute so a re-run
   * never reads back the `url(#…)` it wrote last time.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was applied and every ratio measured, or null
   */
  function applyGanttEncoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === GANTT_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${GANTT_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      logDebug("No gantt SVG in this container - gantt encoding skipped");
      return null;
    }

    const chartId = (svg.getAttribute("id") || "gantt").replace(
      /[^A-Za-z0-9_-]/g,
      "-"
    );
    const svgNS = "http://www.w3.org/2000/svg";

    // --- sweep what a previous run owned ------------------------------------
    const ownedDefs = svg.querySelector(`defs[${GANTT_DEFS_ATTRIBUTE}]`);
    if (ownedDefs) ownedDefs.remove();
    svg
      .querySelectorAll(`[${GANTT_BOUNDARY_ATTRIBUTE}]`)
      .forEach((owned) => owned.remove());

    const pageGround = resolveHostGround(svg);
    const { rows: bands, grounds } = resolveGanttBands(svg, pageGround);
    // A chart with no sections still has bars; the page is then their ground.
    const groundSet = grounds.length ? grounds : [pageGround];

    const applied = {
      pageGround,
      bandGrounds: groundSet,
      bands: bands.length,
      bars: [],
      labels: [],
      boundaries: [],
      today: null,
      warnings: [],
    };

    // --- the outline ink, ONE per chart, clearing EVERY band ----------------
    // One ink rather than one per state, because outline COLOUR is no longer
    // carrying the state — texture, dash and weight are — and a single ink is
    // the only way to clear every band at once without a per-band search whose
    // result would change as a bar moved row.
    const outline = pickInkAgainst(GANTT_INK_RAMP, groundSet);
    if (outline.worst < GANTT_OBJECT_TARGET) {
      applied.warnings.push(
        `no outline ink clears ${GANTT_OBJECT_TARGET}:1 against every band (best ${
          Math.round(outline.worst * 100) / 100
        }:1 with ${outline.ink}); using the best available`
      );
    }
    applied.outline = { ink: outline.ink, worst: Math.round(outline.worst * 100) / 100 };

    // --- bars: outline, weight, dash, pattern -------------------------------
    const defs = document.createElementNS(svgNS, "defs");
    defs.setAttribute(GANTT_DEFS_ATTRIBUTE, "true");
    const tiles = [];

    const groundForY = (centre) => {
      const band = bands.find(
        (row) => centre >= row.y && centre <= row.y + row.height
      );
      return band ? band.ground : pageGround;
    };

    [...svg.querySelectorAll("rect.task")].forEach((rect, index) => {
      const state = ganttStateOf(rect);
      const encoding = GANTT_STATE_ENCODING[state];
      const computed = window.getComputedStyle(rect);

      // Read the ORIGINAL fill, never the live one, which is a url() on re-run.
      const originalFill =
        rect.getAttribute(GANTT_ORIGINAL_FILL_ATTRIBUTE) ||
        paintToHex(parsePaint(computed.fill) || { r: 255, g: 255, b: 255 });
      rect.setAttribute(GANTT_ORIGINAL_FILL_ATTRIBUTE, originalFill);

      // THE FILL IS ADJUSTED ONLY WHEN THE LABEL CANNOT BE RESCUED WITHOUT IT.
      // A bar fill can put 4.5:1 out of reach of BOTH label inks at once:
      // `neutral`'s crit red #dd4422 measured 4.43:1 against near-black and
      // 4.26:1 against white, so no choice of ink clears SC 1.4.3 and the
      // ceiling belongs to the fill. The fill is then moved away from the
      // better ink — lightened when the label wants to be dark, darkened when
      // it wants to be light — by the smallest step that clears the target.
      //
      // Minimal by construction: a fill that already admits a passing ink is
      // left exactly as the theme drew it, so this fires on one bar in one
      // theme today rather than repainting every chart.
      const bestLabelInk = pickInkAgainst(PATTERN_INKS, [originalFill]);
      let workingFill = originalFill;
      if (bestLabelInk.worst < GANTT_TEXT_TARGET) {
        const wantsLighterFill =
          calculateLuminance(hexToRgb(bestLabelInk.ink)) < 0.5;
        workingFill = adjustColorForContrast(
          originalFill,
          bestLabelInk.ink,
          GANTT_TEXT_TARGET,
          wantsLighterFill
        );
        applied.warnings.push(
          `${state} fill ${originalFill} put every label ink below ${GANTT_TEXT_TARGET}:1 (best ${
            Math.round(bestLabelInk.worst * 100) / 100
          }:1); adjusted to ${workingFill}`
        );
      }

      const centre =
        (parseFloat(rect.getAttribute("y")) || 0) +
        (parseFloat(rect.getAttribute("height")) || 0) / 2;
      const ground = groundForY(centre);

      // ⚠ INLINE STYLES, NOT ATTRIBUTES. Mermaid's in-SVG block declares
      // `.task { stroke-width:2 }` and per-state `stroke`/`fill` as CLASS
      // rules, which beat any presentation attribute. See the block comment
      // above GANTT_ROLEDESCRIPTION.
      rect.style.setProperty("stroke", outline.ink);
      rect.style.setProperty("stroke-width", `${encoding.width}px`);
      if (encoding.dash) {
        rect.style.setProperty("stroke-dasharray", encoding.dash);
      } else {
        rect.style.removeProperty("stroke-dasharray");
      }

      let motif = null;
      if (encoding.pattern) {
        // The motif ink is chosen to be as visible as possible against the bar
        // SUBJECT TO a label still clearing 4.5:1 against both the bar and the
        // motif. Maximising the motif alone would make the label unreadable —
        // see the patterned-surface rule this session mints.
        const permits = (ink) =>
          PATTERN_INKS.some(
            (labelInk) =>
              calculateContrastRatio(labelInk, workingFill) >=
                GANTT_TEXT_TARGET &&
              calculateContrastRatio(labelInk, ink) >= GANTT_TEXT_TARGET
          );

        let chosen = pickInkAgainst(GANTT_INK_RAMP, [workingFill], permits);

        // THE LABEL CONSTRAINT USUALLY BINDS, AND THAT IS THE DESIGN, NOT A
        // DEFECT — but it must not be silent. On the standard `lightgrey`
        // done fill the darkest ink a readable label permits is #808080, which
        // sits at 2.64:1 against the fill rather than the 3:1 an SC 1.4.11
        // OBJECT would need. The bar itself is not relying on it: its outline
        // measures 7.5:1 to 20.5:1 against the band in every theme, so the
        // pattern is a redundancy channel for colour-vision deficiency and for
        // greyscale, and the label is the thing with a conformance target.
        // Reported at every run so the figure is never assumed.
        if (chosen.worst >= 0 && chosen.worst < GANTT_OBJECT_TARGET) {
          applied.warnings.push(
            `${state} motif ${chosen.ink} sits at ${
              Math.round(chosen.worst * 100) / 100
            }:1 against ${workingFill} - the darkest ink that still leaves the label at ${GANTT_TEXT_TARGET}:1; texture channel, not an SC 1.4.11 object`
          );
        }

        if (chosen.worst < 0) {
          // No ink leaves a readable label. The label wins: the state keeps its
          // texture at whatever contrast is left rather than the bar becoming
          // unreadable, and the shortfall is reported rather than swallowed.
          chosen = pickInkAgainst(GANTT_INK_RAMP, [workingFill]);
          applied.warnings.push(
            `${state} pattern on ${workingFill}: no motif ink leaves a label at ${GANTT_TEXT_TARGET}:1; using ${chosen.ink}`
          );
        }

        const patternId = `${chartId}-gantt-${state}-${index}`;
        tiles.push(
          `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${GANTT_PATTERN_TILE}" height="${GANTT_PATTERN_TILE}">` +
            `<rect width="${GANTT_PATTERN_TILE}" height="${GANTT_PATTERN_TILE}" fill="${workingFill}"/>` +
            patternMotif(encoding.pattern, chosen.ink) +
            `</pattern>`
        );
        rect.style.setProperty("fill", `url(#${patternId})`);
        motif = {
          pattern: encoding.pattern,
          ink: chosen.ink,
          inkOnFill: Math.round(chosen.worst * 100) / 100,
        };
      } else if (workingFill !== originalFill) {
        rect.style.setProperty("fill", workingFill);
      } else {
        rect.style.removeProperty("fill");
      }

      // The FLAT colour a label actually sits on, parked so the label pass and
      // any probe read the adjusted value rather than either the theme's
      // original or the `url(#…)` a patterned bar computes to.
      rect.setAttribute(GANTT_PAINT_ATTRIBUTE, workingFill);

      applied.bars.push({
        state,
        className: rect.getAttribute("class") || "",
        fill: workingFill,
        originalFill,
        fillAdjusted: workingFill !== originalFill,
        ground,
        outlineOnGround:
          Math.round(calculateContrastRatio(outline.ink, ground) * 100) / 100,
        fillOnGround:
          Math.round(calculateContrastRatio(workingFill, ground) * 100) / 100,
        width: encoding.width,
        dash: encoding.dash,
        motif,
      });
    });

    if (tiles.length) {
      defs.innerHTML = tiles.join("");
      svg.insertBefore(defs, svg.firstChild);
    }

    // --- labels -------------------------------------------------------------
    // A label's target is resolved GEOMETRICALLY, not from its class: two plain
    // tasks in one section carry identical class lists, so class matching
    // cannot tell which bar a label belongs to. A label whose centre is inside
    // no bar is an OUTSIDE label — the milestone's is — and its ground is the
    // band, not a bar.
    const barBoxes = [...svg.querySelectorAll("rect.task")].map((rect) => ({
      rect,
      box: rect.getBoundingClientRect(),
      fill: rect.getAttribute(GANTT_PAINT_ATTRIBUTE),
      state: ganttStateOf(rect),
    }));
    const motifByRect = new Map();
    applied.bars.forEach((bar, i) => {
      if (bar.motif) motifByRect.set(barBoxes[i] && barBoxes[i].rect, bar.motif.ink);
    });

    svg
      .querySelectorAll(
        'text.taskText, text[class*="taskTextOutside"], text.milestoneText'
      )
      .forEach((label) => {
        const box = label.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;

        const host = barBoxes.find(
          (candidate) =>
            candidate.box.width > 0 &&
            cx >= candidate.box.left &&
            cx <= candidate.box.right &&
            cy >= candidate.box.top &&
            cy <= candidate.box.bottom
        );

        const targets = [];
        let where;
        if (host) {
          targets.push(host.fill);
          const motifInk = motifByRect.get(host.rect);
          if (motifInk) targets.push(motifInk);
          where = `bar:${host.state}`;
        } else {
          const centre =
            parseFloat(label.getAttribute("y")) ||
            (box.top + box.height / 2);
          targets.push(groundForY(centre));
          where = "band";
        }

        const chosen = pickInkAgainst(PATTERN_INKS, targets);
        // ⚠ `important` IS REQUIRED. `.activeText0` and `.doneText0` are
        // declared `fill:#000000!important` in Mermaid's own block, which beats
        // a plain inline style. Applied to every label so a future release
        // cannot silently reclaim one.
        label.style.setProperty("fill", chosen.ink, "important");

        if (chosen.worst < GANTT_TEXT_TARGET) {
          applied.warnings.push(
            `label on ${where} (${targets.join(", ")}): best ink ${
              chosen.ink
            } reaches only ${Math.round(chosen.worst * 100) / 100}:1`
          );
        }

        applied.labels.push({
          where,
          targets,
          ink: chosen.ink,
          worst: Math.round(chosen.worst * 100) / 100,
          text: (label.textContent || "").trim().slice(0, 24),
        });
      });

    // --- section boundaries -------------------------------------------------
    // MERMAID DRAWS NO BOUNDARY ELEMENT. Measured on a rendered chart: the only
    // non-tick <line> in the whole SVG is `line.today`, and `rect.section` is
    // emitted once per ROW rather than once per section, so consecutive rows
    // whose section class differs are where a boundary belongs. The line is
    // therefore SYNTHESISED, on the same precedent as the xychart casings and
    // single-point markers above — it is swept and rebuilt on every run, and it
    // is aria-hidden because it carries no information the description lacks.
    for (let i = 1; i < bands.length; i += 1) {
      const above = bands[i - 1];
      const below = bands[i];
      if (above.className === below.className) continue;

      const ink = pickInkAgainst(GANTT_INK_RAMP, [above.ground, below.ground]);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute(GANTT_BOUNDARY_ATTRIBUTE, "true");
      line.setAttribute("x1", String(below.x));
      line.setAttribute("x2", String(below.x + below.width));
      line.setAttribute("y1", String(below.y));
      line.setAttribute("y2", String(below.y));
      line.style.setProperty("stroke", ink.ink);
      line.style.setProperty("stroke-width", `${GANTT_BOUNDARY_WIDTH}px`);
      line.setAttribute("aria-hidden", "true");
      svg.appendChild(line);

      if (ink.worst < GANTT_OBJECT_TARGET) {
        applied.warnings.push(
          `section boundary at y=${below.y}: best ink ${ink.ink} reaches only ${
            Math.round(ink.worst * 100) / 100
          }:1 against its two bands`
        );
      }

      applied.boundaries.push({
        y: below.y,
        between: [above.className, below.className],
        grounds: [above.ground, below.ground],
        ink: ink.ink,
        worst: Math.round(ink.worst * 100) / 100,
      });
    }

    // --- today marker -------------------------------------------------------
    // Its HUE is kept and only its lightness moved, because red is Mermaid's
    // own today semantic and a grey today marker would lose meaning a sighted
    // reader already has. The dash is what stops it being colour-only.
    // `line.today` EXPLICITLY. Mermaid wraps the marker in a `<g class="today">`
    // that precedes the line, so a `querySelector("line.today, .today")` returns
    // the GROUP — and because stroke and stroke-dasharray both inherit in SVG,
    // styling the group still works, which is exactly what makes the mistake
    // hard to see. It cost this session a polluted baseline: the probe's
    // disable arm stripped the line and left the group, so the "before" reading
    // showed a marker already dashed and already at 3.05:1.
    const today = svg.querySelector("line.today");
    if (today) {
      const computed = window.getComputedStyle(today);
      const original =
        today.getAttribute(GANTT_ORIGINAL_FILL_ATTRIBUTE) ||
        paintToHex(parsePaint(computed.stroke) || { r: 255, g: 0, b: 0 });
      today.setAttribute(GANTT_ORIGINAL_FILL_ATTRIBUTE, original);

      // It crosses every band and the page, so it must clear all of them.
      const crossed = [...new Set([...groundSet, pageGround])];
      const worstGround = crossed.reduce(
        (worst, ground) =>
          calculateContrastRatio(original, ground) <
          calculateContrastRatio(original, worst)
            ? ground
            : worst,
        crossed[0]
      );

      const groundLuminance = calculateLuminance(hexToRgb(worstGround));
      let stroke = original;
      if (
        calculateContrastRatio(original, worstGround) < GANTT_OBJECT_TARGET
      ) {
        stroke = adjustColorForContrast(
          original,
          worstGround,
          GANTT_OBJECT_TARGET,
          groundLuminance < 0.5
        );
      }

      today.style.setProperty("stroke", stroke);
      today.style.setProperty("stroke-dasharray", GANTT_TODAY_DASH);

      const worst = crossed.reduce(
        (lowest, ground) =>
          Math.min(lowest, calculateContrastRatio(stroke, ground)),
        Infinity
      );
      if (worst < GANTT_OBJECT_TARGET) {
        applied.warnings.push(
          `today marker ${stroke} reaches only ${
            Math.round(worst * 100) / 100
          }:1 against its worst ground`
        );
      }

      applied.today = {
        original,
        stroke,
        dash: GANTT_TODAY_DASH,
        worstGround,
        worst: Math.round(worst * 100) / 100,
      };
    }

    logInfo(
      `Gantt encoding applied: ${applied.bars.length} bars, ${applied.labels.length} labels, ${applied.boundaries.length} section boundaries, outline ${outline.ink} at ${applied.outline.worst}:1, ${applied.warnings.length} warnings`
    );
    applied.warnings.forEach((warning) => logWarn(`Gantt encoding: ${warning}`));

    return applied;
  }

  /**
   * Apply non-colour series encoding to a rendered xychart: pattern fills on
   * bars from the second bar onwards, dash arrays on lines from the second line
   * onwards.
   *
   * WHY THIS EXISTS. Series colour is the only channel Mermaid's xychart offers,
   * and on a light ground it is exhausted: see XYCHART_PALETTES above, where an
   * exhaustive search shows NO ordering of the light palettes can separate
   * adjacent series past 1.06:1. Texture is the remaining channel, and it is the
   * one that survives both colour-vision deficiency and a greyscale print.
   *
   * MECHANISM, AND WHY THIS ONE. Each pattern carries the series colour as its
   * own ground rect and the motif on top, so a single `fill="url(#id)"` both
   * keeps the colour and adds the texture. The alternative — layering a second
   * transparent rect over each bar — was not used: it doubles the rect count,
   * needs every geometry attribute copied, and each copy is a chance for the two
   * to drift apart. One attribute on the existing element cannot drift.
   *
   * ATTRIBUTES, NOT CSS, and that is forced rather than chosen. Pattern ids must
   * be unique per chart (they are document-scoped), so a stylesheet cannot name
   * them. The compensation is that attributes survive `cloneNode(true)` by
   * construction, so the export carries patterns without further work.
   *
   * IDEMPOTENT. Re-running replaces its own defs block and re-reads each series'
   * colour from `data-series-fill` rather than from the live `fill`, which by
   * then is a `url(#…)`. Safe after every re-render, theme change and
   * orientation change.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG itself
   * @returns {Object|null} Summary of what was applied, or null if no xychart was found
   */
  function applySeriesEncoding(root) {
    if (!root) return null;

    // GANTT DISPATCH, added 30 August 2026. `applySeriesEncoding` is the one
    // named after-render encoding step: mermaid-controls.js's
    // reapplyAfterRender calls it, and applyTheme's own fallback calls it. A
    // second exported entry point would have to be wired into both, and one of
    // them is in a module this session must not touch — so the gantt pass is
    // reached from here rather than beside it. The name is kept for the same
    // reason: renaming it would break reapplyAfterRender's call.
    //
    // A diagram is one type or the other, so exactly one of these two ever does
    // work; each returns null for a diagram it does not recognise.
    const ganttEncoding = applyGanttEncoding(root);

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === XYCHART_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${XYCHART_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      if (ganttEncoding) return { gantt: ganttEncoding };
      logDebug(
        "No xychart or gantt SVG in this container - series encoding skipped"
      );
      return null;
    }

    // Pattern ids are document-scoped, so they must be unique per chart. The
    // render id is already unique and is stable across re-renders of the same
    // diagram, which is what keeps the assignment deterministic.
    const chartId = (svg.getAttribute("id") || "xychart").replace(
      /[^A-Za-z0-9_-]/g,
      "-"
    );

    // Idempotency: drop everything this pass owns before writing new ones. The
    // casings and markers are swept the same way the defs are, and for the same
    // reason — a second run must rebuild them, never stack a second copy on top.
    const existingDefs = svg.querySelector("defs[data-xychart-series]");
    if (existingDefs) existingDefs.remove();
    svg
      .querySelectorAll(`[${CASING_ATTRIBUTE}], [${MARKER_ATTRIBUTE}]`)
      .forEach((owned) => owned.remove());

    const ground = resolveGroundColour(svg);
    const svgNS = "http://www.w3.org/2000/svg";

    const defs = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "defs"
    );
    defs.setAttribute("data-xychart-series", "true");
    const tiles = [];
    const applied = { patterns: [], dashes: [], casings: [], markers: [] };

    // --- bars: first stays solid, the rest take patterns in vocabulary order
    const barGroups = svg.querySelectorAll('g[class^="bar-plot"]');
    barGroups.forEach((group, ordinal) => {
      const rects = group.querySelectorAll("rect");
      if (!rects.length) return;

      // Read the ORIGINAL colour, not the live fill, which is a url() on re-run.
      const seriesFill =
        rects[0].getAttribute("data-series-fill") || rects[0].getAttribute("fill");
      rects.forEach((rect) => rect.setAttribute("data-series-fill", seriesFill));

      if (ordinal === 0) {
        // Restore, in case a re-run follows a change that reduced the series count.
        rects.forEach((rect) => rect.setAttribute("fill", seriesFill));
        applied.patterns.push({ group: group.getAttribute("class"), pattern: "solid" });
        return;
      }

      const name = SERIES_PATTERNS[(ordinal - 1) % SERIES_PATTERNS.length];
      const ink = pickPatternInk(seriesFill);
      const patternId = `${chartId}-pat-${ordinal}`;

      tiles.push(
        `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${PATTERN_TILE}" height="${PATTERN_TILE}">` +
          `<rect width="${PATTERN_TILE}" height="${PATTERN_TILE}" fill="${seriesFill}"/>` +
          patternMotif(name, ink) +
          `</pattern>`
      );

      rects.forEach((rect) => rect.setAttribute("fill", `url(#${patternId})`));
      applied.patterns.push({
        group: group.getAttribute("class"),
        pattern: name,
        seriesFill,
        ink,
        inkOnFill: calculateContrastRatio(ink, seriesFill),
      });
    });

    // --- lines: first stays solid, the rest take dash arrays in vocabulary order.
    // Each line then gains a ground-coloured casing behind it, and a one-point
    // series gains a marker, because Mermaid draws one-point series as nothing.
    const lineGroups = svg.querySelectorAll('g[class^="line-plot"]');
    lineGroups.forEach((group, ordinal) => {
      // Only Mermaid's own paths: this pass's casings were swept above, so
      // nothing here can pick up a casing from a previous run.
      const paths = group.querySelectorAll("path");
      if (!paths.length) return;

      // Dash FIRST, because the casing copies whatever dash the line ends with.
      let dash = null;
      if (ordinal === 0) {
        paths.forEach((path) => path.removeAttribute("stroke-dasharray"));
        applied.dashes.push({ group: group.getAttribute("class"), dash: "solid" });
      } else {
        dash = SERIES_DASHES[(ordinal - 1) % SERIES_DASHES.length];
        paths.forEach((path) => path.setAttribute("stroke-dasharray", dash));
        applied.dashes.push({ group: group.getAttribute("class"), dash });
      }

      paths.forEach((path) => {
        const d = path.getAttribute("d");
        const computed = window.getComputedStyle(path);
        const lineWidth =
          parseFloat(computed.strokeWidth) ||
          parseFloat(path.getAttribute("stroke-width")) ||
          2;

        // --- casing: a ground-coloured halo, painted BEHIND its own line.
        // Sibling order is paint order in SVG, so inserting before the line is
        // what puts the halo underneath it.
        const casing = document.createElementNS(svgNS, "path");
        casing.setAttribute(CASING_ATTRIBUTE, "true");
        casing.setAttribute("d", d);
        casing.setAttribute("fill", "none");
        casing.setAttribute("stroke", ground);
        // ⚠ THE WIDTH MUST BE AN INLINE STYLE, NOT A PRESENTATION ATTRIBUTE.
        // light.css and dark.css carry
        //   svg[aria-roledescription="xychart"] g[class^="line-plot"] path
        //     { stroke-width: 3px; }
        // and this casing IS a path inside a line-plot group, so that rule
        // matches it too. A presentation attribute is the weakest source in the
        // cascade — the whole reason session 1's outline work is possible — so
        // `stroke-width="7"` computed to 3px and the casing was drawn at exactly
        // the line's own width, haloing nothing. It looked correct in every
        // attribute reading and was inert on screen; the export measurement is
        // what caught it, because inlineComputedPaint writes the COMPUTED value
        // and the clone came back carrying 3.
        // An inline style beats an author rule that carries no !important, and
        // neither theme sheet uses one here.
        casing.style.strokeWidth = `${lineWidth + CASING_EXTRA_WIDTH}px`;
        // THE CASING MUST CARRY THE LINE'S OWN DASH. A solid casing behind a
        // dashed line fills the line's gaps with ground colour, which redraws it
        // as a solid band of background and destroys the dash as a channel —
        // the very thing session 2 added it for.
        if (dash) casing.setAttribute("stroke-dasharray", dash);
        casing.setAttribute("stroke-linecap", computed.strokeLinecap || "butt");
        casing.setAttribute("stroke-linejoin", computed.strokeLinejoin || "miter");
        casing.setAttribute("aria-hidden", "true");
        group.insertBefore(casing, path);
        applied.casings.push({
          group: group.getAttribute("class"),
          stroke: ground,
          width: lineWidth + CASING_EXTRA_WIDTH,
          dash: dash || "solid",
        });

        // --- single-point marker: only where Mermaid drew nothing.
        const point = singlePointOf(d);
        if (!point) return;

        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          logWarn(
            `Single-point line series in ${group.getAttribute(
              "class"
            )} has an unrecoverable coordinate (d="${d}") - no marker drawn, rather than one guessed from axis geometry`
          );
          applied.markers.push({
            group: group.getAttribute("class"),
            drawn: false,
            reason: "coordinate not recoverable from d",
          });
          return;
        }

        const marker = document.createElementNS(svgNS, "circle");
        marker.setAttribute(MARKER_ATTRIBUTE, "true");
        marker.setAttribute("cx", String(point.x));
        marker.setAttribute("cy", String(point.y));
        marker.setAttribute("r", String(lineWidth * MARKER_RADIUS_MULTIPLE));
        marker.setAttribute("fill", path.getAttribute("stroke"));
        marker.setAttribute("stroke", ground);
        marker.setAttribute("stroke-width", String(MARKER_STROKE_WIDTH));
        marker.setAttribute("aria-hidden", "true");
        // Appended, not inserted, so the marker sits ON TOP of its own casing.
        group.appendChild(marker);
        applied.markers.push({
          group: group.getAttribute("class"),
          drawn: true,
          cx: point.x,
          cy: point.y,
          r: lineWidth * MARKER_RADIUS_MULTIPLE,
          fill: path.getAttribute("stroke"),
          stroke: ground,
        });
      });
    });

    if (tiles.length) {
      defs.innerHTML = tiles.join("");
      svg.insertBefore(defs, svg.firstChild);
    }

    logInfo(
      `Series encoding applied: ${applied.patterns.length} bar series, ${applied.dashes.length} line series, ${tiles.length} patterns, ${applied.casings.length} casings, ${applied.markers.filter((m) => m.drawn).length} single-point markers`
    );
    return applied;
  }

  /**
   * Build the COMPLETE xyChart theme block for a theme.
   *
   * ⚠ ALL ELEVEN KEYS ARE SET DELIBERATELY, AND OMITTING ANY ONE IS A DEFECT.
   * Supplying an `xyChart` block inside `themeVariables` is all-or-nothing: any
   * key left out does NOT fall through to this theme's own `primaryTextColor`,
   * it falls through to Mermaid's `default` theme value, which is the near-black
   * olive #131300. Measured 25 August 2026 on the accessibleDark variables, four
   * controlled renders reading the same three elements:
   *
   *   A  no xyChart block at all      label #ffffff   background #1E1E1E   (correct)
   *   B  xyChart: palette only        label #131300   background white     (both lost)
   *   C  xyChart: background+palette  label #131300   background #1E1E1E   (axes lost)
   *   D  xyChart: all eleven keys     label #ffffff   background #1E1E1E   (correct)
   *
   * Row C is what this function shipped for its first half hour, and it put the
   * dark themes' axis labels at 1.12:1 against their own ground — a WORSE defect
   * than the pale series this change exists to fix, and one no reading of the
   * fallback chain in Mermaid's source predicts. The grounding document
   * explicitly expected the fallback to hold and recorded the ten axis colours
   * as needing no work; that expectation was correct about the colours and wrong
   * about what happens once any sibling key is supplied.
   *
   * @param {string} ground - Chart background, the ground the palette was measured against
   * @param {string} ink - Axis, tick, label and title colour; this theme's text colour
   * @param {string} palette - One of XYCHART_PALETTES
   * @returns {Object} A complete themeVariables.xyChart block
   */
  function buildXyChartTheme(ground, ink, palette) {
    return {
      backgroundColor: ground,
      titleColor: ink,
      xAxisTitleColor: ink,
      xAxisLabelColor: ink,
      xAxisTickColor: ink,
      xAxisLineColor: ink,
      yAxisTitleColor: ink,
      yAxisLabelColor: ink,
      yAxisTickColor: ink,
      yAxisLineColor: ink,
      plotColorPalette: palette,
    };
  }

  /**
   * Convert hex colour to RGB array
   * @param {string} hex - Hex colour code
   * @returns {Array} RGB values array [r, g, b]
   */
  function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, "");

    // Parse hex values
    let r, g, b;
    if (hex.length === 3) {
      // Short notation #RGB
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else {
      // Standard notation #RRGGBB
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }

    return [r, g, b];
  }

  /**
   * Convert RGB values to hex colour
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   * @returns {string} Hex colour code
   */
  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = Math.min(255, Math.max(0, Math.round(x))).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  /**
   * Calculate relative luminance of a colour (for WCAG contrast calculations)
   * @param {Array} rgb - RGB values array [r, g, b]
   * @returns {number} Relative luminance value
   */
  function calculateLuminance(rgb) {
    // Convert RGB values to sRGB
    const sRGB = rgb.map((val) => {
      val = val / 255;
      return val <= 0.03928
        ? val / 12.92
        : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    // Calculate luminance using WCAG formula
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }

  /**
   * Calculate contrast ratio between two colours
   * @param {string} color1 - First colour in hex
   * @param {string} color2 - Second colour in hex
   * @returns {number} Contrast ratio (1-21)
   */
  function calculateContrastRatio(color1, color2) {
    const lum1 = calculateLuminance(hexToRgb(color1));
    const lum2 = calculateLuminance(hexToRgb(color2));

    // Calculate contrast ratio using WCAG formula
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Adjust colour lightness until it meets the required contrast ratio
   * @param {string} baseColor - Base colour in hex
   * @param {string} targetColor - Target colour to contrast with in hex
   * @param {number} targetRatio - Target contrast ratio (3 for stroke, 4.5 for text)
   * @param {boolean} lighter - Whether to make the colour lighter (true) or darker (false)
   * @returns {string} Adjusted colour in hex
   */
  function adjustColorForContrast(
    baseColor,
    targetColor,
    targetRatio,
    lighter = true
  ) {
    const rgb = hexToRgb(baseColor);
    let currentRatio = calculateContrastRatio(baseColor, targetColor);
    let steps = 0;

    // Maximum number of iterations to prevent infinite loop
    const maxSteps = 100;

    // Adjust until we meet or exceed the target ratio
    while (currentRatio < targetRatio && steps < maxSteps) {
      // Adjust RGB values by different amounts for better colour preservation
      if (lighter) {
        rgb[0] = Math.min(255, rgb[0] + 5);
        rgb[1] = Math.min(255, rgb[1] + 5);
        rgb[2] = Math.min(255, rgb[2] + 5);
      } else {
        rgb[0] = Math.max(0, rgb[0] - 5);
        rgb[1] = Math.max(0, rgb[1] - 5);
        rgb[2] = Math.max(0, rgb[2] - 5);
      }

      const adjustedColor = rgbToHex(rgb[0], rgb[1], rgb[2]);
      currentRatio = calculateContrastRatio(adjustedColor, targetColor);
      steps++;
    }

    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  /**
   * Detect if the site is currently using dark theme
   * @returns {boolean} True if dark theme is active
   */
  function isDarkThemeActive() {
    // First check localStorage for explicit theme preference
    try {
      const storedTheme = localStorage.getItem("theme");
      if (storedTheme) {
        const isDark = storedTheme === "Dark";
        logDebug("Theme detected from localStorage:", storedTheme);
        return isDark;
      }
    } catch (e) {
      logWarn("Error accessing localStorage:", e);
    }

    // Check for theme attribute on modeToggle button (if site uses that pattern)
    const modeToggle = document.getElementById("modeToggle");
    if (modeToggle && modeToggle.getAttribute("aria-pressed") === "true") {
      logDebug("Dark theme active based on modeToggle button");
      return true;
    }

    // Fall back to system preference
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    logDebug("Using system preference:", systemPrefersDark ? "dark" : "light");
    return systemPrefersDark;
  }

  /**
   * Get the appropriate default theme based on current site theme
   * @returns {string} Theme ID
   */
  function getDefaultThemeForCurrentMode() {
    const isDark = isDarkThemeActive();
    const themeToUse = isDark
      ? themeConfig.defaultThemes.dark
      : themeConfig.defaultThemes.light;

    logDebug("Current mode is:", isDark ? "dark" : "light");
    logDebug("Default theme for this mode:", themeToUse);

    return themeToUse;
  }

  // ---------------------------------------------------------------------------
  // Diagram theme persistence — register item 55
  // ---------------------------------------------------------------------------

  /**
   * Storage key for the user's diagram-theme choice.
   *
   * DELIBERATELY NOT "theme". That key is the SITE light/dark theme and is what
   * isDarkThemeActive() reads; writing a diagram palette into it would let a
   * chart decide whether the whole site is in dark mode. Item 55 names the
   * collision as the one thing whoever took it had to get right.
   *
   * The preference is per PAGE, not per diagram: one stored value, every
   * diagram on the page follows it. Decided 27 August 2026.
   */
  const THEME_PREFERENCE_KEY = "mermaid-diagram-theme";

  /**
   * Light/dark counterparts, for a stored choice that the mode the user has
   * just switched to does not offer.
   *
   * Only TRUE pairs belong here — two themes of the same family, one in each
   * mode's `modeVisibleThemes` list. DERIVED from that config on 27 August
   * 2026 rather than guessed, and the derivation is worth keeping: `wcagLight`,
   * `default`, `neutral` and `forest` are light-only and the `dark` built-in is
   * dark-only, so none of them has anything to map to. Adding a `wcagDark`
   * later means adding a pair here in the same change, or the new theme
   * silently behaves as unpaired.
   */
  const THEME_PAIRS = Object.freeze({
    accessibleLight: "accessibleDark",
    accessibleDark: "accessibleLight",
    highContrastLight: "highContrastDark",
    highContrastDark: "highContrastLight",
  });

  /**
   * Read the stored diagram theme preference.
   * @returns {string|null} The stored theme id, or null if none or unreadable
   */
  function getStoredThemePreference() {
    // Guarded because localStorage throws outright in some private-browsing
    // modes — the same guard isDarkThemeActive() carries, for the same reason.
    try {
      return localStorage.getItem(THEME_PREFERENCE_KEY);
    } catch (e) {
      logWarn("Error reading stored diagram theme preference:", e);
      return null;
    }
  }

  /**
   * Store the user's diagram theme preference.
   * @param {string} themeId - Theme id to store
   * @returns {boolean} True if it was written
   */
  function saveThemePreference(themeId) {
    try {
      localStorage.setItem(THEME_PREFERENCE_KEY, themeId);
      logDebug("Saved diagram theme preference:", themeId);
      return true;
    } catch (e) {
      logWarn("Error saving diagram theme preference:", e);
      return false;
    }
  }

  /**
   * Decide which theme a diagram should show right now, honouring the stored
   * preference where the current mode can express it.
   *
   * Three outcomes, in order:
   *
   * 1. The stored choice is offered in this mode — use it.
   * 2. It is not, but its counterpart is — use the counterpart, and REWRITE the
   *    stored value to it. The map is symmetric, so a light→dark→light round
   *    trip returns the user to what they originally picked.
   * 3. It is not, and it has no counterpart — show the mode default but LEAVE
   *    THE STORED VALUE ALONE. This is the deliberate half. Overwriting it with
   *    the fallback would destroy the choice permanently, which is the very
   *    complaint item 55 was raised about; preserving it means the return flip
   *    restores the original, giving unpaired themes the same round-trip
   *    guarantee the paired ones get. The consequence to know: while the user
   *    is in the other mode, the selector and the stored value disagree — the
   *    selector shows what is applied, the stored value holds the intent.
   *
   * @returns {{themeId: string, storeAs: string|null}} The theme to apply, and
   *   the value to store if the caller should rewrite the preference
   */
  function resolveThemeForCurrentMode() {
    const defaultTheme = getDefaultThemeForCurrentMode();
    const storedTheme = getStoredThemePreference();

    if (!storedTheme) {
      logDebug("No stored diagram theme; using the mode default:", defaultTheme);
      return { themeId: defaultTheme, storeAs: null };
    }

    // Validate against what this mode actually offers, never against the full
    // theme list — modeVisibleThemes is what the selector is built from, so a
    // value absent from it cannot be selected and must not be applied.
    const availableIds = getAllThemes().map((theme) => theme.id);

    if (availableIds.includes(storedTheme)) {
      logDebug("Stored diagram theme is offered in this mode:", storedTheme);
      return { themeId: storedTheme, storeAs: null };
    }

    const counterpart = THEME_PAIRS[storedTheme];
    if (counterpart && availableIds.includes(counterpart)) {
      logDebug(
        `Stored diagram theme "${storedTheme}" is not offered in this mode; mapped to its counterpart "${counterpart}"`
      );
      return { themeId: counterpart, storeAs: counterpart };
    }

    logDebug(
      `Stored diagram theme "${storedTheme}" has no counterpart in this mode; applying the mode default "${defaultTheme}" and keeping the stored choice for the return flip`
    );
    return { themeId: defaultTheme, storeAs: null };
  }
  /**
   * Generate an accessible theme based on mode and base colours
   * @param {boolean} isDarkMode - Whether to use dark mode colours
   * @returns {Object} Theme variables object
   */
  function generateAccessibleTheme(isDarkMode) {
    const baseColors = isDarkMode
      ? accessibleBaseColors.darkMode
      : accessibleBaseColors.lightMode;
    const { canvasColor, textColor, accentColor } = baseColors;

    // For light theme, ensure we have a proper light background and dark text
    const actualTextColor = isDarkMode ? textColor : "#000000"; // Force black text for light theme
    const actualCanvasColor = isDarkMode ? canvasColor : "#FFFFFF"; // Force white background for light theme

    // Calculate accessible colours
    const theme = {
      // Base colours
      darkMode: isDarkMode,
      background: actualCanvasColor,
      fontFamily: "trebuchet ms, verdana, arial, sans-serif",
      fontSize: "16px",
      textColor: actualTextColor,
    };

    // Light theme-specific adjustments
    if (!isDarkMode) {
      // For light theme, use specific colours that we know work well
      theme.primaryColor = "#FFFFFF"; // White node backgrounds
      theme.secondaryColor = "#E8F4F8"; // Light blue secondary nodes
      theme.tertiaryColor = "#F8F8F8"; // Very light gray tertiary
      theme.lineColor = "#333333"; // Dark gray lines
      theme.primaryTextColor = "#000000"; // Black text
      theme.secondaryTextColor = "#000000"; // Black text
      theme.tertiaryTextColor = "#000000"; // Black text
      theme.primaryBorderColor = "#333333"; // Dark borders
      theme.secondaryBorderColor = "#333333"; // Dark borders
      theme.tertiaryBorderColor = "#666666"; // Medium gray borders
      theme.noteBkgColor = "#FFF8DC"; // Light cream note background
      theme.noteTextColor = "#000000"; // Black note text
      theme.noteBorderColor = "#333333"; // Dark note borders
      theme.errorBkgColor = "#FFD2D2"; // Light red error background
      theme.errorTextColor = "#D8000C"; // Dark red error text
    } else {
      // For dark theme, keep the original calculation approach
      theme.primaryColor = isDarkMode ? "#2C3E50" : "#E8F4F8"; // Container fill colour
      theme.secondaryColor = accentColor; // Secondary container fill
      theme.tertiaryColor = isDarkMode ? "#34495E" : "#EAEAEA"; // Tertiary container fill

      // Line colours
      theme.lineColor = adjustColorForContrast(
        accentColor,
        canvasColor,
        3,
        !isDarkMode
      );

      // Notes
      theme.noteBkgColor = isDarkMode ? "#3A3A3A" : "#FFF8DC";
      theme.noteTextColor = isDarkMode ? "#FFFFFF" : "#333333";

      // Error colours
      theme.errorBkgColor = isDarkMode ? "#8B0000" : "#FFD2D2";
      theme.errorTextColor = isDarkMode ? "#FFFFFF" : "#D8000C";

      // Calculate derived colours with proper contrast
      theme.primaryTextColor = adjustColorForContrast(
        textColor,
        theme.primaryColor,
        4.5,
        isDarkMode
      );

      theme.primaryBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.primaryColor,
        3,
        !isDarkMode
      );

      theme.secondaryTextColor = adjustColorForContrast(
        textColor,
        theme.secondaryColor,
        4.5,
        isDarkMode
      );

      theme.secondaryBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.secondaryColor,
        3,
        !isDarkMode
      );

      theme.tertiaryTextColor = adjustColorForContrast(
        textColor,
        theme.tertiaryColor,
        4.5,
        isDarkMode
      );

      theme.tertiaryBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.tertiaryColor,
        3,
        !isDarkMode
      );

      theme.noteBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.noteBkgColor,
        3,
        !isDarkMode
      );
    }

    // xychart-beta series colour. Both branches above leave xychart untouched,
    // so without this the chart falls through to Mermaid's pale `base` palette
    // whatever the rest of the theme says.
    theme.xyChart = buildXyChartTheme(
      actualCanvasColor,
      actualTextColor,
      isDarkMode ? XYCHART_PALETTES.dark : XYCHART_PALETTES.light
    );

    return theme;
  }
  // Create custom accessible themes
  const customThemes = [
    // Add this to your customThemes array in the MermaidThemes module
    {
      id: "wcagLight",
      name: "Varied Light",
      variables: {
        // Base settings
        darkMode: false,
        background: "#FFFFFF",
        fontFamily: "trebuchet ms, verdana, arial, sans-serif",
        fontSize: "16px",
        textColor: "#000000",

        // Basic colours with more blue accent
        primaryColor: "#E8F5FF", // Light blue background (was #FFFFFF)
        primaryTextColor: "#000000",
        primaryBorderColor: "#104E8B", // Medium blue border (was #000000)
        secondaryColor: "#F0F7FB", // Slightly darker blue (was #E8F4F8)
        secondaryTextColor: "#000000",
        secondaryBorderColor: "#104E8B", // Medium blue (was #000000)
        tertiaryColor: "#F4FAFF", // Very light blue (was #F8F8F8)
        tertiaryTextColor: "#000000",
        tertiaryBorderColor: "#104E8B", // Medium blue (was #000000)

        // Lines and connectors
        lineColor: "#104E8B", // Medium blue line color (was #000000)
        defaultLinkColor: "#104E8B", // Medium blue link color (was #000000)

        // Notes, warnings, errors
        noteBkgColor: "#FFF8DC", // Keep this
        noteTextColor: "#000000",
        noteBorderColor: "#104E8B", // Medium blue (was #000000)

        // Entity colors - these are more likely to be applied in the diagram
        mainBkg: "#E8F5FF", // Light blue background
        nodeBorder: "#104E8B", // Medium blue
        nodeTextColor: "#000000",
        clusterBkg: "#F0F7FB",
        clusterBorder: "#104E8B",

        // Section colors - more likely to be used in mindmaps
        sectionBkgColor: "#E8F5FF",
        sectionBkgColor2: "#BBDEFB",
        sectionBkgColor3: "#90CAF9",
        sectionBkgColor4: "#64B5F6",
        sectionBkgColor5: "#42A5F5",
        sectionBkgColor6: "#2196F3",
        sectionBkgColor7: "#1E88E5",

        // Nodes and clusters
        nodeBorder: "#104E8B", // Change to blue instead of black
        nodeTextColor: "#000000",
        clusterBkg: "#F8F8F8",
        clusterBorder: "#104E8B", // Change to blue instead of black

        // Diagram element colours (WCAG AA compliant)
        // These are specifically designed for different diagram elements

        // Mindmap (high contrast colours)
        mindmapColor1: "#C8E6C9", // Light green
        mindmapColor2: "#BBDEFB", // Light blue
        mindmapColor3: "#E1BEE7", // Light purple
        mindmapColor4: "#FFE0B2", // Light orange
        mindmapColor5: "#F8BBD0", // Light pink
        mindmapColor6: "#B3E5FC", // Different light blue
        mindmapColor7: "#DCEDC8", // Different light green
        mindmapColor8: "#D7CCC8", // Light brown

        // Timeline colours
        timelineColor1: "#004D40", // Dark teal with white text
        timelineColor2: "#0D47A1", // Dark blue with white text
        timelineColor3: "#311B92", // Dark purple with white text
        timelineColor4: "#880E4F", // Dark pink with white text
        timelineColor5: "#3E2723", // Dark brown with white text
        timelineTextColor: "#FFFFFF", // White text for timeline items

        // Gantt chart (distinguishable but muted colours)
        taskBkgColor: "#BBDEFB", // Light blue
        taskBorderColor: "#1565C0", // Darker blue
        activeTaskBkgColor: "#C8E6C9", // Light green
        activeTaskBorderColor: "#2E7D32", // Darker green
        doneTaskBkgColor: "#E0E0E0", // Light grey
        doneTaskBorderColor: "#616161", // Darker grey
        critTaskBkgColor: "#FFCDD2", // Light red
        critTaskBorderColor: "#C62828", // Darker red

        // Git graph colours (8 distinct branch colours)
        gitBranchColor0: "#3E2723", // Dark brown
        gitBranchColor1: "#1565C0", // Dark blue
        gitBranchColor2: "#2E7D32", // Dark green
        gitBranchColor3: "#C62828", // Dark red
        gitBranchColor4: "#6A1B9A", // Dark purple
        gitBranchColor5: "#00695C", // Dark teal
        gitBranchColor6: "#FF6F00", // Dark orange
        gitBranchColor7: "#5D4037", // Different dark brown

        // Pie chart colours (all with sufficient contrast against white text)
        pie1: "#1565C0", // Dark blue
        pie2: "#2E7D32", // Dark green
        pie3: "#C62828", // Dark red
        pie4: "#6A1B9A", // Dark purple
        pie5: "#00695C", // Dark teal
        pie6: "#FF6F00", // Dark orange
        pie7: "#5D4037", // Dark brown
        pie8: "#0D47A1", // Different dark blue
        pie9: "#1B5E20", // Different dark green
        pie10: "#B71C1C", // Different dark red
        pie11: "#4A148C", // Different dark purple
        pie12: "#004D40", // Different dark teal
        pieTitleTextSize: "25px",
        pieTitleTextColor: "#000000",
        pieSectionTextSize: "17px",
        pieSectionTextColor: "#FFFFFF", // White text on dark backgrounds

        // Entity Relationship diagram colours
        classText: "#000000",
        classBorder: "#000000",
        labelBoxBkgColor: "#E8F4F8", // Light blue
        labelBoxBorderColor: "#000000",
        labelTextColor: "#000000",

        // Sequence diagram actors
        actorBkg: "#E8F4F8", // Light blue
        actorBorder: "#000000",
        actorTextColor: "#000000",
        actorLineColor: "#000000",

        // Other common elements
        loopTextColor: "#000000",
        activationBorderColor: "#000000",
        activationBkgColor: "#F8F8F8",
        sequenceNumberColor: "#000000",

        // User journey diagram
        fillType0: "#C8E6C9", // Light green
        fillType1: "#BBDEFB", // Light blue
        fillType2: "#E1BEE7", // Light purple
        fillType3: "#FFE0B2", // Light orange
        fillType4: "#F8BBD0", // Light pink
        fillType5: "#B3E5FC", // Different light blue
        fillType6: "#DCEDC8", // Different light green
        fillType7: "#D7CCC8", // Light brown

        // State diagram
        labelColor: "#000000",
        altBackground: "#F5F5F5", // Very light grey

        // Other elements
        edgeLabelBackground: "#FFFFFF",
        titleColor: "#000000",

        // xychart-beta: ground is this theme's own `background`, #FFFFFF
        xyChart: buildXyChartTheme(
          "#FFFFFF",
          "#000000",
          XYCHART_PALETTES.light
        ),
      },
    },
    {
      id: "accessibleLight",
      name: "Plain Light",
      variables: generateAccessibleTheme(false), // Light mode
    },
    {
      id: "accessibleDark",
      name: "Dark V2",
      variables: generateAccessibleTheme(true), // Dark mode
    },
    {
      id: "highContrastLight",
      name: "High Contrast Light",
      variables: {
        darkMode: false,
        background: "#FFFFFF",
        primaryColor: "#FFFFFF",
        primaryTextColor: "#000000",
        primaryBorderColor: "#000000",
        lineColor: "#000000",
        textColor: "#000000",
        secondaryColor: "#EEEEEE",
        secondaryTextColor: "#000000",
        secondaryBorderColor: "#000000",
        tertiaryColor: "#DDDDDD",
        tertiaryTextColor: "#000000",
        tertiaryBorderColor: "#000000",
        noteBkgColor: "#FFFFFF",
        noteTextColor: "#000000",
        noteBorderColor: "#000000",

        // xychart-beta: high-contrast pair targets 4.7:1, not 3.2:1
        xyChart: buildXyChartTheme(
          "#FFFFFF",
          "#000000",
          XYCHART_PALETTES.lightHighContrast
        ),
      },
    },
    {
      id: "highContrastDark",
      name: "High Contrast Dark",
      variables: {
        darkMode: true,
        background: "#000000",
        primaryColor: "#000000",
        primaryTextColor: "#FFFFFF",
        primaryBorderColor: "#FFFFFF",
        lineColor: "#FFFFFF",
        textColor: "#FFFFFF",
        secondaryColor: "#222222",
        secondaryTextColor: "#FFFFFF",
        secondaryBorderColor: "#FFFFFF",
        tertiaryColor: "#333333",
        tertiaryTextColor: "#FFFFFF",
        tertiaryBorderColor: "#FFFFFF",
        noteBkgColor: "#000000",
        noteTextColor: "#FFFFFF",
        noteBorderColor: "#FFFFFF",

        // xychart-beta: high-contrast pair targets 4.7:1, not 3.2:1
        xyChart: buildXyChartTheme(
          "#000000",
          "#FFFFFF",
          XYCHART_PALETTES.darkHighContrast
        ),
      },
    },
    {
      id: "blueAccent",
      name: "Blue Accent",
      variables: {
        nodeBorder: "#004990",
        mainBkg: "#c9d7e4",
        background: "#FFFFFF",
        primaryColor: "#c9d7e4",
        primaryTextColor: "#000000", // Changed for better contrast
        primaryBorderColor: "#004990",
        secondaryColor: "#01A6F0",
        secondaryTextColor: "#FFFFFF", // Changed for better contrast
        secondaryBorderColor: "#004990",
        tertiaryColor: "#F8F8F8",
        tertiaryTextColor: "#000000",
        tertiaryBorderColor: "#004990",
        noteBkgColor: "#FFBA01",
        noteTextColor: "#000000", // Changed for better contrast
        noteBorderColor: "#FFBA01",
        lineColor: "#004990",
        textColor: "#000000", // Changed from #747474 for better contrast
        actorBkg: "#01A6F0",
        signalColor: "#F34F1C",
        loopTextColor: "#4A4A4A", // Changed from #C7C7C7 for better contrast
        labelTextColor: "#000000", // Changed from #C7C7C7 for better contrast
        labelBoxBorderColor: "#7FBC00",
        labelBoxBkgColor: "#7FBC00",
        fontFamily: "Inter, sans-serif",
        fontSize: "13px",

        // xychart-beta: ground is this theme's own `background`, #FFFFFF.
        // blueAccent is in `visibleThemes` but in NEITHER modeVisibleThemes
        // list, so it never reaches the selector today; it is themed anyway so
        // that adding it to a list later is a one-line change rather than a
        // silent contrast regression.
        xyChart: buildXyChartTheme(
          "#FFFFFF",
          "#000000",
          XYCHART_PALETTES.light
        ),
      },
    },
  ];
  /**
   * Apply a theme to a Mermaid diagram
   * @param {HTMLElement} container - The container with the Mermaid diagram
   * @param {string} themeId - The ID of the theme to apply
   */
  function applyTheme(container, themeId) {
    if (!container) return;

    logDebug(`Applying theme "${themeId}" to container`);

    // Find the Mermaid diagram inside the container
    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) {
      logWarn("No mermaid diagram found in container");
      return;
    }

    // Get the original Mermaid code
    const originalCode =
      decodeURIComponent(container.getAttribute("data-diagram-code")) ||
      mermaidDiv.textContent;

    // Create new code with the theme directive
    let newCode = originalCode;

    // Check if it's a built-in theme or custom theme
    const customTheme = customThemes.find((theme) => theme.id === themeId);

    if (customTheme) {
      // For custom themes, we need to use the 'base' theme and apply theme variables
      const initDirective = `%%{init: {'theme': 'base', 'themeVariables': ${JSON.stringify(
        customTheme.variables
      )}}}%%\n`;

      // Remove any existing init directive
      newCode = newCode.replace(/^%%{init:.*?}%%\n/m, "");

      // Add new init directive
      newCode = initDirective + newCode;
      logDebug(`Applied custom theme variables for "${themeId}"`);
    } else if (builtInThemes.find((theme) => theme.id === themeId)) {
      // For built-in themes, we just need to specify the theme name
      const initDirective = `%%{init: {'theme': '${themeId}'}}%%\n`;

      // Remove any existing init directive
      newCode = newCode.replace(/^%%{init:.*?}%%\n/m, "");

      // Add new init directive
      newCode = initDirective + newCode;
      logDebug(`Applied built-in theme "${themeId}"`);
    }

    // Update the container with the new code
    container.setAttribute("data-diagram-code", encodeURIComponent(newCode));

    // Re-render the diagram
    const mermaidId = mermaidDiv.id;
    mermaidDiv.textContent = newCode;

    window.mermaid
      .render(mermaidId + "-svg", newCode)
      .then((result) => {
        mermaidDiv.innerHTML = result.svg;
        logInfo(`Successfully re-rendered diagram with theme "${themeId}"`);

        const index = mermaidId.split("-").pop();

        // A fresh SVG has landed. Series encoding and size are re-applied
        // through the one named after-render step in mermaid-controls.js,
        // rather than this site keeping its own copy of the list.
        //
        // The helper is SAFE to call from inside applyTheme's own .then
        // because it never calls applyTheme — it applies encoding and size and
        // nothing else, so there is no re-render loop. That is a standing
        // constraint on the helper, recorded in register item 56, not an
        // accident of its current body.
        //
        // The local fallback is deliberate and is NOT a second route. The
        // helper lives in another module, and encoding on this path used to be
        // guaranteed by a module-internal call that needed nothing external;
        // routing through the helper without a fallback would make that
        // guarantee depend on MermaidControls being loaded. In practice it
        // always is here, because applyTheme is reached through
        // addThemeSelector, which requires the controls container to exist —
        // but applyTheme is also exported, and a direct caller has no such
        // guarantee.
        if (
          window.MermaidControls &&
          typeof window.MermaidControls.reapplyAfterRender === "function"
        ) {
          window.MermaidControls.reapplyAfterRender(container, mermaidDiv, {
            index: index,
          });
        } else {
          logWarn(
            "MermaidControls.reapplyAfterRender unavailable; applying series encoding locally"
          );
          applySeriesEncoding(mermaidDiv);
        }

        // Re-initialize controls if needed. This stays with applyTheme: it is a
        // lifecycle decision, not part of re-applying what we already knew
        // about the diagram.
        if (
          window.MermaidControls &&
          typeof window.MermaidControls.addControlsToContainer === "function"
        ) {
          window.MermaidControls.addControlsToContainer(container, index);
          logDebug("Re-initialised diagram controls");
        }
      })
      .catch((error) => {
        logError("Error re-rendering Mermaid diagram:", error);
        mermaidDiv.textContent = `Error rendering diagram with theme: ${error.message}`;
      });
  }
  /**
   * Get all available themes (built-in and custom) filtered by visibility settings
   * @returns {Array} Array of theme objects with id and name properties
   */
  /**
   * Get all available themes (built-in and custom) filtered by visibility settings
   * @returns {Array} Array of theme objects with id and name properties
   */
  function getAllThemes() {
    const allThemes = [...builtInThemes, ...customThemes];
    const isDark = isDarkThemeActive();

    // Get themes visible in current mode
    const modeVisibleIds = themeConfig.modeVisibleThemes
      ? isDark
        ? themeConfig.modeVisibleThemes.dark
        : themeConfig.modeVisibleThemes.light
      : null;

    // Filter themes based on visibility configuration
    const filteredThemes = allThemes.filter((theme) => {
      // First check if theme is visible at all
      const isVisible = themeConfig.visibleThemes[theme.id] !== false;

      // Then check if it's visible in current mode (if mode filtering is enabled)
      const isVisibleInMode = modeVisibleIds
        ? modeVisibleIds.includes(theme.id)
        : true;

      return isVisible && isVisibleInMode;
    });

    logDebug(
      `Retrieved ${filteredThemes.length} available themes for ${
        isDark ? "dark" : "light"
      } mode`
    );
    return filteredThemes;
  }

  /**
   * Validate a theme's contrast ratios
   * @param {Object} themeVars - Theme variables object
   * @returns {Object} Validation results with any issues found
   */
  function validateThemeContrast(themeVars) {
    const issues = [];
    const background = themeVars.background || "#f4f4f4";

    // Check text contrast (4.5:1 minimum)
    const textRatio = calculateContrastRatio(
      themeVars.textColor || "#333333",
      background
    );
    if (textRatio < 4.5) {
      issues.push(
        `Text to background contrast ratio is ${textRatio.toFixed(
          2
        )}:1, should be at least 4.5:1`
      );
    }

    // Check primary text contrast (4.5:1 minimum)
    const primaryTextRatio = calculateContrastRatio(
      themeVars.primaryTextColor || "#333333",
      themeVars.primaryColor || "#fff4dd"
    );
    if (primaryTextRatio < 4.5) {
      issues.push(
        `Primary text to primary background contrast ratio is ${primaryTextRatio.toFixed(
          2
        )}:1, should be at least 4.5:1`
      );
    }

    // Check line to background contrast (3:1 minimum)
    const lineRatio = calculateContrastRatio(
      themeVars.lineColor || "#333333",
      background
    );
    if (lineRatio < 3) {
      issues.push(
        `Line to background contrast ratio is ${lineRatio.toFixed(
          2
        )}:1, should be at least 3:1`
      );
    }

    // Check primary border to primary background contrast (3:1 minimum)
    const primaryBorderRatio = calculateContrastRatio(
      themeVars.primaryBorderColor || "#7C0000",
      themeVars.primaryColor || "#fff4dd"
    );
    if (primaryBorderRatio < 3) {
      issues.push(
        `Primary border to primary background contrast ratio is ${primaryBorderRatio.toFixed(
          2
        )}:1, should be at least 3:1`
      );
    }

    const result = {
      valid: issues.length === 0,
      issues: issues,
    };

    if (result.valid) {
      logDebug("Theme contrast validation passed");
    } else {
      logWarn("Theme contrast validation failed:", result.issues);
    }

    return result;
  }
  /**
   * Add a theme selector to a Mermaid container
   * @param {HTMLElement} container - The Mermaid container
   * @param {number} index - Index for unique IDs
   */
  function addThemeSelector(container, index) {
    logDebug("Adding theme selector to container", index);

    // Check if controls container exists
    const controlsContainer = container.querySelector(".mermaid-controls");
    if (!controlsContainer) {
      logDebug("No controls container found, aborting");
      return;
    }

    // Check if theme selector already exists
    if (container.querySelector(".mermaid-theme-select")) {
      logDebug("Theme selector already exists, aborting");
      return;
    }

    // Find the sliders container
    const slidersContainer =
      controlsContainer.querySelector(".sliders-container");
    if (!slidersContainer) {
      logDebug("No sliders container found, aborting");
      return;
    }

    // Create theme selector container
    const themeContainer = document.createElement("div");
    themeContainer.className = "mermaid-theme-container";

    // Create label
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "Theme:";
    themeLabel.className = "mermaid-theme-label";
    themeLabel.setAttribute("for", `mermaid-theme-${index}`);

    // Create select element
    const themeSelect = document.createElement("select");
    themeSelect.id = `mermaid-theme-${index}`;
    themeSelect.className = "mermaid-theme-select";
    themeSelect.setAttribute("aria-label", "Change diagram theme");

    // Get all available themes
    const availableThemes = getAllThemes();
    logDebug(
      "Available themes:",
      availableThemes.map((t) => t.id)
    );

    // Add theme options (filtered by visibility config)
    availableThemes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      themeSelect.appendChild(option);
    });

    // Which theme this diagram should show. Register item 55: a stored choice
    // wins where the current mode offers it, maps to its counterpart where it
    // does not, and yields to the mode default otherwise.
    const resolvedTheme = resolveThemeForCurrentMode();
    const themeToApply = resolvedTheme.themeId;
    if (resolvedTheme.storeAs) {
      saveThemePreference(resolvedTheme.storeAs);
    }
    logDebug("Theme to use:", themeToApply);

    // Set the resolved theme as the selected option. THE CONTROL REFLECTING
    // THE RESTORED STATE IS THE SIGNAL — item 55 rules out announcing a
    // restore, because the user did not just make this change and a spoken
    // line on every page load is load chatter, not information.
    themeSelect.value = themeToApply;

    // Add event listener for theme changes
    themeSelect.addEventListener("change", function () {
      const newTheme = this.value;
      logInfo("User changed theme to:", newTheme);

      // Store the choice. Register item 55: this line replaces a comment
      // reading "but don't save preference", which described the defect
      // rather than a decision — a reload, or a site light/dark flip, threw
      // the user's choice away without telling them.
      saveThemePreference(newTheme);

      // Apply the theme to the diagram
      applyTheme(container, newTheme);

      // Announce to screen readers if MermaidControls is available
      if (
        window.MermaidControls &&
        typeof window.MermaidControls.announceToScreenReader === "function"
      ) {
        window.MermaidControls.announceToScreenReader(
          `Theme changed to ${this.options[this.selectedIndex].text}`
        );
      }
    });

    // Add theme selector to container
    themeContainer.appendChild(themeLabel);
    themeContainer.appendChild(themeSelect);

    // Create a new row container for the theme selector
    const themeRow = document.createElement("div");
    themeRow.className = "mermaid-controls-row";
    themeRow.appendChild(themeContainer);

    // Append as the last row in the sliders container
    slidersContainer.appendChild(themeRow);

    // Apply the resolved theme
    logDebug("Applying theme:", themeToApply);
    applyTheme(container, themeToApply);

    logInfo("Theme selector added and theme applied");
  }
  // Find the updateDiagramsForThemeChange function and replace it with this updated version:

  /**
   * Update mermaid diagrams when site theme changes
   * This function should be called when the site theme is toggled
   */
  function updateDiagramsForThemeChange() {
    logInfo("Theme change detected, updating diagrams");

    // Get all mermaid containers
    const mermaidContainers = document.querySelectorAll(".mermaid-container");
    logDebug("Found", mermaidContainers.length, "mermaid containers");

    // Register item 55. This used to compute the mode default and force it
    // into every selector, so a user who picked "High Contrast Light" and then
    // toggled the site to dark and back had lost their choice with no notice.
    // The preference is now carried across the flip: mapped to its counterpart
    // where one exists, and where none does the mode default is APPLIED while
    // the stored choice is LEFT INTACT, so flipping back restores what the
    // user actually picked rather than the fallback they never chose.
    //
    // Resolved ONCE, outside the loop: the preference is per page, so every
    // container gets the same answer and the store is written at most once.
    const resolvedTheme = resolveThemeForCurrentMode();
    const themeToApply = resolvedTheme.themeId;
    if (resolvedTheme.storeAs) {
      saveThemePreference(resolvedTheme.storeAs);
    }
    logDebug("Theme to apply after the mode change:", themeToApply);

    // Get visible themes for current mode
    const visibleThemes = getAllThemes();

    mermaidContainers.forEach((container, idx) => {
      const themeSelect = container.querySelector(".mermaid-theme-select");
      if (!themeSelect) {
        logDebug("No theme select found for container", idx);
        return;
      }

      // Update available options
      while (themeSelect.firstChild) {
        themeSelect.removeChild(themeSelect.firstChild);
      }

      // Add new options
      visibleThemes.forEach((theme) => {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.name;
        themeSelect.appendChild(option);
      });

      // Show and apply the resolved theme, so the control reflects what the
      // diagram is actually rendering in.
      themeSelect.value = themeToApply;
      applyTheme(container, themeToApply);
    });

    logInfo(`Updated ${mermaidContainers.length} diagrams for theme change`);
  }
  /**
   * Create a custom theme based on user preferences
   * @param {Object} options - Theme options
   * @returns {Object} Custom theme variables
   */
  function createCustomTheme(options = {}) {
    const isDarkMode = options.darkMode || false;
    const baseTextColor =
      options.textColor || (isDarkMode ? "#FFFFFF" : "#333333");
    const baseCanvasColor =
      options.backgroundColor || (isDarkMode ? "#1E1E1E" : "#FFFFFF");
    const baseAccentColor =
      options.accentColor || (isDarkMode ? "#6082B6" : "#1E56A0");

    logDebug("Creating custom theme:", {
      isDarkMode,
      baseTextColor,
      baseCanvasColor,
      baseAccentColor,
    });

    // Override base colours
    accessibleBaseColors.darkMode.textColor = isDarkMode
      ? baseTextColor
      : accessibleBaseColors.darkMode.textColor;
    accessibleBaseColors.darkMode.canvasColor = isDarkMode
      ? baseCanvasColor
      : accessibleBaseColors.darkMode.canvasColor;
    accessibleBaseColors.darkMode.accentColor = isDarkMode
      ? baseAccentColor
      : accessibleBaseColors.darkMode.accentColor;

    accessibleBaseColors.lightMode.textColor = !isDarkMode
      ? baseTextColor
      : accessibleBaseColors.lightMode.textColor;
    accessibleBaseColors.lightMode.canvasColor = !isDarkMode
      ? baseCanvasColor
      : accessibleBaseColors.lightMode.canvasColor;
    accessibleBaseColors.lightMode.accentColor = !isDarkMode
      ? baseAccentColor
      : accessibleBaseColors.lightMode.accentColor;

    // Generate theme
    const customTheme = generateAccessibleTheme(isDarkMode);
    logInfo("Custom theme created successfully");
    return customTheme;
  }

  /**
   * Initialize theme selection for all Mermaid diagrams
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    // Find all Mermaid containers
    const mermaidContainers = container.querySelectorAll(".mermaid-container");
    if (mermaidContainers.length === 0) {
      logDebug("No mermaid containers found for initialisation");
      return;
    }

    logInfo(
      `Initialising theme selectors for ${mermaidContainers.length} diagrams`
    );

    // Add theme selector to each diagram
    mermaidContainers.forEach((container, index) => {
      addThemeSelector(container, index);
    });

    logInfo("Theme system initialisation complete");
  }

  /**
   * Validates WCAG AA compliance for all theme colours
   * @param {Object} themeVars - Theme variables object
   * @returns {Object} Object with validation results
   */
  function validateWCAGCompliance(themeVars) {
    const results = {
      pass: true,
      failures: [],
    };

    // For text on coloured backgrounds (4.5:1 minimum)
    const textElements = [
      {
        background: themeVars.mindmapColor1,
        text: themeVars.textColor,
        name: "Mindmap Colour 1",
      },
      {
        background: themeVars.mindmapColor2,
        text: themeVars.textColor,
        name: "Mindmap Colour 2",
      },
      {
        background: themeVars.mindmapColor3,
        text: themeVars.textColor,
        name: "Mindmap Colour 3",
      },
      {
        background: themeVars.mindmapColor4,
        text: themeVars.textColor,
        name: "Mindmap Colour 4",
      },
      {
        background: themeVars.mindmapColor5,
        text: themeVars.textColor,
        name: "Mindmap Colour 5",
      },
      {
        background: themeVars.mindmapColor6,
        text: themeVars.textColor,
        name: "Mindmap Colour 6",
      },
      {
        background: themeVars.mindmapColor7,
        text: themeVars.textColor,
        name: "Mindmap Colour 7",
      },
      {
        background: themeVars.mindmapColor8,
        text: themeVars.textColor,
        name: "Mindmap Colour 8",
      },

      // Timeline and pie charts use white text on dark backgrounds
      {
        background: themeVars.timelineColor1,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 1",
      },
      {
        background: themeVars.timelineColor2,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 2",
      },
      {
        background: themeVars.timelineColor3,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 3",
      },
      {
        background: themeVars.timelineColor4,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 4",
      },
      {
        background: themeVars.timelineColor5,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 5",
      },

      {
        background: themeVars.pie1,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 1",
      },
      {
        background: themeVars.pie2,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 2",
      },
      {
        background: themeVars.pie3,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 3",
      },
      {
        background: themeVars.pie4,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 4",
      },
      {
        background: themeVars.pie5,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 5",
      },
      {
        background: themeVars.pie6,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 6",
      },
      {
        background: themeVars.pie7,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 7",
      },
      {
        background: themeVars.pie8,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 8",
      },
      {
        background: themeVars.pie9,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 9",
      },
      {
        background: themeVars.pie10,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 10",
      },
      {
        background: themeVars.pie11,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 11",
      },
      {
        background: themeVars.pie12,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 12",
      },

      // Gantt chart colours
      {
        background: themeVars.taskBkgColor,
        text: themeVars.textColor,
        name: "Task Background",
      },
      {
        background: themeVars.activeTaskBkgColor,
        text: themeVars.textColor,
        name: "Active Task Background",
      },
      {
        background: themeVars.doneTaskBkgColor,
        text: themeVars.textColor,
        name: "Done Task Background",
      },
      {
        background: themeVars.critTaskBkgColor,
        text: themeVars.textColor,
        name: "Critical Task Background",
      },
    ];

    // Check all text elements for 4.5:1 minimum contrast
    textElements.forEach((element) => {
      if (!element.background || !element.text) return;

      const ratio = calculateContrastRatio(element.background, element.text);

      if (ratio < 4.5) {
        results.pass = false;
        results.failures.push({
          element: element.name,
          background: element.background,
          text: element.text,
          ratio: ratio.toFixed(2),
          recommendation: "Needs at least 4.5:1 contrast ratio for text",
        });
      }
    });

    // For non-text elements (visual boundaries, etc.) - 3:1 minimum
    const graphicElements = [
      {
        foreground: themeVars.primaryBorderColor,
        background: themeVars.primaryColor,
        name: "Primary Border vs Background",
      },
      {
        foreground: themeVars.secondaryBorderColor,
        background: themeVars.secondaryColor,
        name: "Secondary Border vs Background",
      },
      {
        foreground: themeVars.lineColor,
        background: themeVars.background,
        name: "Line vs Background",
      },
      {
        foreground: themeVars.defaultLinkColor,
        background: themeVars.background,
        name: "Link vs Background",
      },
    ];

    // Check all graphic elements for 3:1 minimum contrast
    graphicElements.forEach((element) => {
      if (!element.foreground || !element.background) return;

      const ratio = calculateContrastRatio(
        element.foreground,
        element.background
      );

      if (ratio < 3) {
        results.pass = false;
        results.failures.push({
          element: element.name,
          foreground: element.foreground,
          background: element.background,
          ratio: ratio.toFixed(2),
          recommendation:
            "Needs at least 3:1 contrast ratio for graphical elements",
        });
      }
    });

    if (results.pass) {
      logDebug("WCAG compliance validation passed");
    } else {
      logWarn(
        "WCAG compliance validation failed:",
        results.failures.length,
        "issues found"
      );
    }

    return results;
  }

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    logDebug("DOM content loaded");

    // Initialize for existing diagrams after a short delay
    // to ensure MermaidControls has been initialised
    setTimeout(function () {
      logDebug("Running delayed initialisation");

      if (typeof window.MermaidThemes !== "undefined") {
        logInfo("MermaidThemes module found, beginning initialisation");
        window.MermaidThemes.init();
      } else {
        logError("MermaidThemes module is undefined!");
      }
    }, 300);
  });

  // Public API
  return {
    init: init,
    addThemeSelector: addThemeSelector,
    applyTheme: applyTheme,
    applySeriesEncoding: applySeriesEncoding,
    // Exported for MEASUREMENT, not as a second wiring route. Every production
    // path reaches it through applySeriesEncoding above; a probe needs to call
    // it directly and read back the ratios it measured.
    applyGanttEncoding: applyGanttEncoding,
    getAllThemes: getAllThemes,
    createCustomTheme: createCustomTheme,
    validateThemeContrast: validateThemeContrast,
    validateWCAGCompliance: validateWCAGCompliance, // Add this new function
    calculateContrastRatio: calculateContrastRatio,
    updateDiagramsForThemeChange: updateDiagramsForThemeChange,
    themeConfig: themeConfig, // Expose configuration for external modification
    // Expose logging controls
    setLogLevel: setLogLevel,
    LOG_LEVELS: LOG_LEVELS,
    utils: {
      hexToRgb: hexToRgb,
      rgbToHex: rgbToHex,
      calculateLuminance: calculateLuminance,
      adjustColorForContrast: adjustColorForContrast,
      isDarkThemeActive: isDarkThemeActive,
      getDefaultThemeForCurrentMode: getDefaultThemeForCurrentMode,
    },
  };
})();
